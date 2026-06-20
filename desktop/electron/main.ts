/**
 * Boostify Music Desktop — Electron Main Process
 *
 * Loads the same React app from Vite (dev) or the built renderer (production).
 * All API calls go to the remote server — no local backend.
 */

import { app, BrowserWindow, shell, ipcMain, dialog, Menu, nativeTheme } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────────────
const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:5173'; // Vite dev server for desktop
const PROD_API_URL = 'https://boostify.app'; // Remote production API

// ─── Window ──────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Boostify Music — Timeline Editor',
    backgroundColor: '#1a1a2e',
    show: false, // show after ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    // Frameless look with native title bar on macOS, standard on Windows
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 12, y: 12 } }
      : {}),
  });

  // Graceful show
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load content
  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rendererPath = path.join(__dirname, '..', 'renderer', 'index.html');
    mainWindow.loadFile(rendererPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Application Menu ────────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
    // File
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
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    // Edit
    {
      label: 'Editar',
      submenu: [
        {
          label: 'Deshacer',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow?.webContents.send('menu:undo'),
        },
        {
          label: 'Rehacer',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => mainWindow?.webContents.send('menu:redo'),
        },
        { type: 'separator' },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    // View
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
    // Help
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Abrir Boostify Web',
          click: () => shell.openExternal('https://boostify.app'),
        },
        {
          label: 'Reportar Problema',
          click: () => shell.openExternal('https://github.com/convoycubano1-glitch/boostify_music/issues'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

// Native file picker for media import
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

// Native save dialog for export
ipcMain.handle('dialog:saveFile', async (_event, options: { defaultPath?: string; filters?: Electron.FileFilter[] }) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options?.defaultPath || 'boostify-export.mp4',
    filters: options?.filters || [
      { name: 'Video', extensions: ['mp4', 'webm'] },
    ],
  });
  return result.canceled ? null : result.filePath;
});

// Provide runtime config to renderer
ipcMain.handle('app:getConfig', () => ({
  isDev,
  apiBaseUrl: isDev ? '' : PROD_API_URL,
  platform: process.platform,
  version: app.getVersion(),
}));

// ─── Auto-Updater ────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:available', info);
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:downloaded', info);
  });

  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate());
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall());

  // Check for updates 5s after launch
  setTimeout(() => autoUpdater.checkForUpdates(), 5000);
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark'; // Force dark mode
  buildMenu();
  createMainWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    // macOS dock click re-creates window
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
