/**
 * Boostify Timeline Desktop — Electron Main Process
 *
 * Standalone timeline editor that connects to the remote Boostify API.
 * Lighter than the full Boostify Music desktop — only the timeline.
 */

import { app, BrowserWindow, shell, ipcMain, dialog, Menu, nativeTheme, protocol, net } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────────────
const isDev = !app.isPackaged;
const FORCE_PROD = process.env.FORCE_PROD === '1'; // For testing packaged mode
const DEV_URL = 'http://localhost:5174'; // Vite dev server for timeline
const PROD_API_URL = 'https://boostify.app';

// ─── Custom Protocol (serves renderer over app:// so Clerk works) ────────────
const PROTOCOL_SCHEME = 'app';

// Register protocol before app is ready
protocol.registerSchemesAsPrivileged([{
  scheme: PROTOCOL_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
}]);

// ─── Window ──────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    title: 'Boostify Timeline',
    backgroundColor: '#0a0a0f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 12, y: 12 } }
      : {}),
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // External links → system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && !FORCE_PROD) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Use custom app:// protocol so Clerk auth works (file:// is not supported)
    mainWindow.loadURL(`${PROTOCOL_SCHEME}://timeline/timeline.html`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Application Menu ────────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Importar Media...',
          accelerator: 'CmdOrCtrl+I',
          click: () => mainWindow?.webContents.send('menu:import-media'),
        },
        {
          label: 'Exportar Video...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu:export-video'),
        },
        { type: 'separator' },
        {
          label: 'Guardar Proyecto',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save-project'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow?.webContents.send('menu:undo') },
        { label: 'Rehacer', accelerator: 'CmdOrCtrl+Shift+Z', click: () => mainWindow?.webContents.send('menu:redo') },
        { type: 'separator' },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'Vista',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        { label: 'Boostify Web', click: () => shell.openExternal('https://boostify.app') },
        { label: 'Reportar Problema', click: () => shell.openExternal('https://github.com/convoycubano1-glitch/boostify_music/issues') },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFiles', async (_event, options: { filters?: Electron.FileFilter[] }) => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: options?.filters || [
      { name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      { name: 'Video', extensions: ['mp4', 'webm', 'mov'] },
      { name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] },
    ],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('dialog:saveFile', async (_event, options: { defaultPath?: string; filters?: Electron.FileFilter[] }) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options?.defaultPath || 'boostify-export.mp4',
    filters: options?.filters || [{ name: 'Video', extensions: ['mp4', 'webm'] }],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('app:getConfig', () => ({
  isDev: isDev && !FORCE_PROD,
  apiBaseUrl: (isDev && !FORCE_PROD) ? '' : PROD_API_URL,
  platform: process.platform,
  version: app.getVersion(),
  appName: 'Boostify Timeline',
}));

// ─── Auto-Updater ────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev && !FORCE_PROD) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info: any) => mainWindow?.webContents.send('updater:available', info));
  autoUpdater.on('download-progress', (progress: any) => mainWindow?.webContents.send('updater:progress', progress));
  autoUpdater.on('update-downloaded', (info: any) => mainWindow?.webContents.send('updater:downloaded', info));

  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate());
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall());

  setTimeout(() => autoUpdater.checkForUpdates(), 5000);
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';

  // Register custom protocol to serve renderer files over app://
  if (!isDev || FORCE_PROD) {
    const rendererDir = path.join(__dirname, '..', 'renderer');
    
    protocol.handle(PROTOCOL_SCHEME, (request) => {
      const url = new URL(request.url);
      // Map app://timeline/path → renderer/path
      let filePath = path.join(rendererDir, decodeURIComponent(url.pathname));
      
      // Default to timeline.html for root
      if (filePath.endsWith(path.sep) || filePath === rendererDir) {
        filePath = path.join(rendererDir, 'timeline.html');
      }
      
      return net.fetch(pathToFileURL(filePath).toString());
    });
  }

  buildMenu();
  createMainWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
