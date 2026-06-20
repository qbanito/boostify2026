// ─── CharacterImporter v2 ─────────────────────────────────────────────────────
// Multi-format character importer: GLB · GLTF · VRM · FBX · OBJ · DAE · USDZ · ZIP
// Tabs: Upload | URL / Platform | CC4 Guide | Demo Library | Recent
// Wired to: characterCreatorImporter.ts service, CharacterAsset schema, holoLangContext

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useHoloLang } from './holoLangContext';
import type { CharacterAsset } from '../../schemas/holostage/character.schema';
import {
  importGLBFromFile,
  importGLBFromURL,
  formatFileSize,
  detectFormat,
  getFormatInfo,
  ACCEPTED_EXTENSIONS,
  FORMAT_REGISTRY,
  NATIVE_FORMATS,
  type ImportFormat,
} from '../../services/holostage/characterCreatorImporter';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onImport: (character: CharacterAsset) => void;
  currentCharacter: CharacterAsset | null;
}

// ─── Demo Characters ──────────────────────────────────────────────────────────

interface DemoCharacter {
  id: string;
  name: string;
  url: string;
  descKey: import('./holoLangContext').HoloDictKey;
  polyCount: number;
  rigType: 'humanoid' | 'custom' | 'unknown';
  tags: string[];
  format: ImportFormat;
}

const DEMO_CHARACTERS: DemoCharacter[] = [
  {
    id: 'astronaut',
    name: 'Astronaut',
    url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    descKey: 'demo_astronaut_desc',
    polyCount: 12500,
    rigType: 'humanoid',
    tags: ['humanoid', 'sci-fi'],
    format: 'glb',
  },
  {
    id: 'neil',
    name: 'Neil Armstrong',
    url: 'https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb',
    descKey: 'demo_neil_desc',
    polyCount: 15800,
    rigType: 'humanoid',
    tags: ['humanoid', 'realistic'],
    format: 'glb',
  },
  {
    id: 'cesiumman',
    name: 'Cesium Man',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/CesiumMan/glTF-Binary/CesiumMan.glb',
    descKey: 'demo_cesiumman_desc',
    polyCount: 7200,
    rigType: 'humanoid',
    tags: ['humanoid', 'animated'],
    format: 'glb',
  },
  {
    id: 'brainstem',
    name: 'BrainStem Robot',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BrainStem/glTF-Binary/BrainStem.glb',
    descKey: 'demo_brainstem_desc',
    polyCount: 12000,
    rigType: 'humanoid',
    tags: ['robot', 'mechanical'],
    format: 'glb',
  },
  {
    id: 'riggedfigure',
    name: 'Rigged Figure',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/RiggedFigure/glTF-Binary/RiggedFigure.glb',
    descKey: 'demo_riggedfigure_desc',
    polyCount: 4000,
    rigType: 'humanoid',
    tags: ['humanoid', 'minimal'],
    format: 'glb',
  },
  {
    id: 'fox',
    name: 'Fox',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Fox/glTF-Binary/Fox.glb',
    descKey: 'demo_fox_desc',
    polyCount: 5000,
    rigType: 'custom',
    tags: ['animal', 'animated'],
    format: 'glb',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Tab = 'upload' | 'url' | 'cc4' | 'demo' | 'recent';

interface RecentEntry {
  id: string;
  name: string;
  format: string;
  source: string;
  fileSize?: number;
  importedAt: string;
  glbUrl?: string; // only set for remote URLs (not blob:)
}

const RECENT_KEY = 'holostage_recent_imports';

function loadRecent(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch { return []; }
}

function saveRecent(list: RecentEntry[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10))); } catch {}
}

function pushRecent(char: CharacterAsset): void {
  const entry: RecentEntry = {
    id: char.id,
    name: char.name,
    format: char.format ?? 'glb',
    source: char.source,
    fileSize: char.fileSize,
    importedAt: char.importedAt,
    // only persist URL if it's not a blob (blob: URLs don't survive page refresh)
    glbUrl: char.glbUrl.startsWith('blob:') ? undefined : char.glbUrl,
  };
  const existing = loadRecent().filter(r => r.id !== char.id);
  saveRecent([entry, ...existing]);
}

const FORMAT_COLORS: Record<string, string> = {
  glb:   '#22c55e',
  gltf:  '#16a34a',
  vrm:   '#a855f7',
  fbx:   '#f59e0b',
  obj:   '#f59e0b',
  dae:   '#f59e0b',
  usdz:  '#f59e0b',
  zip:   '#f59e0b',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CharacterImporter({ onImport, currentCharacter }: Props) {
  const { t } = useHoloLang();
  const [tab, setTab] = useState<Tab>('upload');

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [pendingConvert, setPendingConvert] = useState<{ fmt: string; note: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL state
  const [urlValue, setUrlValue] = useState('');
  const [urlName, setUrlName] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  // Demo state
  const [demoLoadingId, setDemoLoadingId] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Recent state
  const [recentList, setRecentList] = useState<RecentEntry[]>([]);

  useEffect(() => {
    setRecentList(loadRecent());
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function handleImportSuccess(character: CharacterAsset) {
    onImport(character);
    pushRecent(character);
    setRecentList(loadRecent());
  }

  // ── Upload handlers ────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setUploadError(null);
    setUploadWarnings([]);
    setPendingConvert(null);
    setUploadLoading(true);

    const fmt = detectFormat(file.name);
    const info = getFormatInfo(file.name);

    if (info && !info.native) {
      setPendingConvert({ fmt: info.label, note: info.convertNote ?? '' });
      setUploadLoading(false);
      return;
    }

    const result = await importGLBFromFile(file);
    setUploadLoading(false);

    if (result.success && result.character) {
      setUploadWarnings(result.warnings ?? []);
      handleImportSuccess(result.character);
    } else {
      setUploadError(result.error ?? 'Unknown error');
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  // ── URL handler ────────────────────────────────────────────────────────────

  const handleLoadURL = useCallback(async () => {
    setUrlError(null);
    setUrlLoading(true);
    const result = await importGLBFromURL(urlValue, urlName);
    setUrlLoading(false);
    if (result.success && result.character) {
      handleImportSuccess(result.character);
      setUrlValue('');
      setUrlName('');
    } else {
      setUrlError(result.error ?? 'Unknown error');
    }
  }, [urlValue, urlName]);

  // ── Demo handler ───────────────────────────────────────────────────────────

  const handleLoadDemo = useCallback(async (demo: DemoCharacter) => {
    setDemoError(null);
    setDemoLoadingId(demo.id);
    const result = await importGLBFromURL(demo.url, demo.name);
    setDemoLoadingId(null);
    if (result.success && result.character) {
      const enriched: CharacterAsset = {
        ...result.character,
        polyCount: demo.polyCount,
        rigType: demo.rigType,
        source: 'demo',
        format: demo.format,
      };
      handleImportSuccess(enriched);
    } else {
      setDemoError(result.error ?? 'Unknown error');
    }
  }, []);

  // ── Tab config ─────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: 'upload', label: t('import_tab_upload') },
    { key: 'url',    label: t('import_tab_url') },
    { key: 'cc4',    label: t('import_tab_cc4') },
    { key: 'demo',   label: t('import_tab_demo') },
    { key: 'recent', label: t('import_tab_recent') },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white font-semibold text-base">{t('import_header')}</h3>
          <p className="text-zinc-400 text-xs mt-0.5">{t('import_v2_subtitle')}</p>
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#f9731620', color: '#f97316', border: '1px solid #f9731640' }}
        >
          {currentCharacter ? t('import_active') : t('import_no_char')}
        </span>
      </div>

      {/* ── Active Character Card ──────────────────────────────────────── */}
      {currentCharacter && (
        <div
          className="rounded-xl p-3 flex items-start justify-between gap-3"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-white font-medium text-sm truncate">{currentCharacter.name}</span>
            <div className="flex items-center gap-2 flex-wrap">
              {currentCharacter.format && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${FORMAT_COLORS[currentCharacter.format] ?? '#6b7280'}25`, color: FORMAT_COLORS[currentCharacter.format] ?? '#6b7280' }}
                >
                  {currentCharacter.format.toUpperCase()}
                </span>
              )}
              <span className="text-zinc-500 text-xs">{t('import_source_label')}: {currentCharacter.source}</span>
              {currentCharacter.fileSize && (
                <span className="text-zinc-500 text-xs">{formatFileSize(currentCharacter.fileSize)}</span>
              )}
              {currentCharacter.polyCount && (
                <span className="text-zinc-500 text-xs">{currentCharacter.polyCount.toLocaleString()} polys</span>
              )}
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: currentCharacter.rigType === 'humanoid' ? '#22c55e20' : '#6b728020',
                  color: currentCharacter.rigType === 'humanoid' ? '#22c55e' : '#6b7280',
                }}
              >
                {currentCharacter.rigType}
              </span>
            </div>
          </div>
          <button
            onClick={() => setTab('upload')}
            className="text-xs px-2 py-1 rounded-lg shrink-0 transition-colors"
            style={{ background: '#f9731615', color: '#f97316', border: '1px solid #f9731630' }}
          >
            {t('import_change')}
          </button>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 p-1 rounded-xl overflow-x-auto"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-150"
            style={
              tab === key
                ? { background: '#f97316', color: '#fff' }
                : { color: '#9ca3af', background: 'transparent' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: UPLOAD
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'upload' && (
        <div className="flex flex-col gap-3">

          {/* Conversion blocker */}
          {pendingConvert && (
            <div
              className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background: '#f59e0b10', border: '1px solid #f59e0b40' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ background: '#f59e0b20', color: '#f59e0b' }}
                >
                  {pendingConvert.fmt}
                </span>
                <span className="text-amber-400 text-sm font-medium">{t('import_convert_title')}</span>
              </div>
              <p className="text-zinc-400 text-xs">{t('import_convert_body')}</p>
              <p className="text-zinc-300 text-xs">{pendingConvert.note}</p>
              <div className="flex gap-2 mt-1">
                <a
                  href="https://www.gltf.report"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40' }}
                >
                  gltf.report ↗
                </a>
                <button
                  onClick={() => setPendingConvert(null)}
                  className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 transition-colors hover:text-white"
                  style={{ background: '#2a2a2a' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Drop zone */}
          {!pendingConvert && (
            <div
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={e => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200"
              style={{
                padding: '2rem 1rem',
                border: `2px dashed ${isDragging ? '#f97316' : '#3a3a3a'}`,
                background: isDragging ? '#f9731608' : '#111',
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: '#f9731618' }}
              >
                📁
              </div>
              <div className="text-center">
                <p className="text-white text-sm font-medium">{t('import_drop_hint2')}</p>
                <p className="text-zinc-500 text-xs mt-1">{t('import_formats2')}</p>
              </div>

              {/* Format badges */}
              <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                {(Object.keys(FORMAT_REGISTRY) as ImportFormat[]).map(fmt => {
                  const info = FORMAT_REGISTRY[fmt];
                  const isNative = NATIVE_FORMATS.includes(fmt);
                  return (
                    <span
                      key={fmt}
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{
                        background: isNative ? `${FORMAT_COLORS[fmt]}20` : '#f59e0b15',
                        color: isNative ? (FORMAT_COLORS[fmt] ?? '#6b7280') : '#f59e0b',
                        border: `1px solid ${isNative ? `${FORMAT_COLORS[fmt]}40` : '#f59e0b30'}`,
                      }}
                      title={info.description}
                    >
                      {fmt.toUpperCase()}
                      {!isNative && ' *'}
                    </span>
                  );
                })}
              </div>
              <p className="text-zinc-600 text-xs">* requires conversion — see CC4 Guide tab</p>

              {uploadLoading && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: '#f97316', borderTopColor: 'transparent' }}
                  />
                  <span className="text-zinc-400 text-xs">{t('import_processing')}</span>
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={onFileChange}
          />

          {/* Warnings */}
          {uploadWarnings.length > 0 && (
            <div
              className="rounded-xl p-3 flex flex-col gap-1"
              style={{ background: '#f59e0b10', border: '1px solid #f59e0b30' }}
            >
              <span className="text-amber-400 text-xs font-semibold">{t('import_warnings_title')}</span>
              {uploadWarnings.map((w, i) => (
                <p key={i} className="text-zinc-400 text-xs">{w}</p>
              ))}
            </div>
          )}

          {/* Error */}
          {uploadError && (
            <div
              className="rounded-xl p-3 text-red-400 text-xs"
              style={{ background: '#ef444415', border: '1px solid #ef444430' }}
            >
              {uploadError}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: URL / PLATFORM
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'url' && (
        <div className="flex flex-col gap-4">

          {/* Generic URL */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <p className="text-white text-sm font-medium">{t('import_url_label')}</p>
            <p className="text-zinc-500 text-xs">{t('import_url_hint')}</p>
            <input
              type="url"
              value={urlValue}
              onChange={e => setUrlValue(e.target.value)}
              placeholder="https://… or rpm:{avatarId}"
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none"
              style={{ background: '#111', border: '1px solid #333' }}
            />
            <input
              type="text"
              value={urlName}
              onChange={e => setUrlName(e.target.value)}
              placeholder={t('import_url_name')}
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none"
              style={{ background: '#111', border: '1px solid #333' }}
            />
            <button
              onClick={handleLoadURL}
              disabled={!urlValue.trim() || urlLoading}
              className="text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-40"
              style={{ background: '#f97316', color: '#fff' }}
            >
              {urlLoading ? t('import_processing') : t('import_load_btn')}
            </button>
            {urlError && (
              <p className="text-red-400 text-xs">{urlError}</p>
            )}
          </div>

          {/* ReadyPlayerMe */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">ReadyPlayerMe</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: '#22c55e20', color: '#22c55e' }}
              >
                {t('import_native_badge')}
              </span>
            </div>
            <p className="text-zinc-500 text-xs">{t('import_rpm_hint')}</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="rpm:638df693d72bffc6fa17943c"
                className="flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none"
                style={{ background: '#111', border: '1px solid #333' }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) { setUrlValue(v); setTab('url'); }
                  }
                }}
                onChange={e => setUrlValue(e.target.value.trim() ? e.target.value.trim() : urlValue)}
              />
              <button
                onClick={handleLoadURL}
                disabled={!urlValue.trim() || urlLoading}
                className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
                style={{ background: '#f97316', color: '#fff' }}
              >
                {t('import_rpm_load')}
              </button>
            </div>
          </div>

          {/* VRoid Hub */}
          <div
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">VRoid Hub</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: '#a855f720', color: '#a855f7' }}
              >
                VRM
              </span>
            </div>
            <p className="text-zinc-500 text-xs">{t('import_vroid_hint')}</p>
            <a
              href="https://hub.vroid.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium mt-1 transition-colors"
              style={{ color: '#a855f7' }}
            >
              hub.vroid.com ↗
            </a>
            <p className="text-zinc-600 text-xs">Paste the VRM download URL above to load directly.</p>
          </div>

          {/* Mixamo */}
          <div
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">Mixamo</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: '#f59e0b20', color: '#f59e0b' }}
              >
                FBX → GLB
              </span>
            </div>
            <p className="text-zinc-500 text-xs">Mixamo exports FBX. Convert in Blender → Export GLB, then drag to Upload tab.</p>
            <a
              href="https://www.mixamo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium transition-colors"
              style={{ color: '#f59e0b' }}
            >
              mixamo.com ↗
            </a>
          </div>

          {/* Sketchfab */}
          <div
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">Sketchfab</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: '#22c55e20', color: '#22c55e' }}
              >
                GLB download
              </span>
            </div>
            <p className="text-zinc-500 text-xs">Download the GLB from Sketchfab and drag it to the Upload tab. Look for "Download 3D Model → Original format".</p>
            <a
              href="https://sketchfab.com/search?q=humanoid&type=models"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium transition-colors"
              style={{ color: '#22c55e' }}
            >
              Sketchfab humanoid search ↗
            </a>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: CC4 GUIDE
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'cc4' && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <p className="text-white text-sm font-semibold">{t('import_cc4_title')}</p>

            <div className="flex flex-col gap-2">
              {[
                t('import_cc4_step1'),
                t('import_cc4_step2'),
                t('import_cc4_step3'),
                t('import_cc4_step4'),
                t('import_cc4_step5'),
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: '#f97316', color: '#fff' }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-zinc-300 text-sm">{step}</p>
                </div>
              ))}
            </div>

            <div
              className="rounded-lg p-3 mt-1"
              style={{ background: '#f59e0b10', border: '1px solid #f59e0b30' }}
            >
              <p className="text-amber-400 text-xs font-medium mb-1">FBX note</p>
              <p className="text-zinc-400 text-xs">{t('import_cc4_fbx_note')}</p>
            </div>
          </div>

          {/* Recommended tools */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <p className="text-white text-sm font-semibold">{t('import_cc4_tools')}</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-zinc-200 text-sm">Blender</p>
                  <p className="text-zinc-500 text-xs">{t('import_cc4_blender')}</p>
                </div>
                <a
                  href="https://www.blender.org/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded shrink-0 font-medium"
                  style={{ background: '#f9731620', color: '#f97316' }}
                >
                  Free ↗
                </a>
              </div>
              <div
                className="h-px w-full"
                style={{ background: '#2a2a2a' }}
              />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-zinc-200 text-sm">gltf.report</p>
                  <p className="text-zinc-500 text-xs">{t('import_cc4_gltfreport')}</p>
                </div>
                <a
                  href="https://www.gltf.report"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded shrink-0 font-medium"
                  style={{ background: '#22c55e20', color: '#22c55e' }}
                >
                  Open ↗
                </a>
              </div>
              <div
                className="h-px w-full"
                style={{ background: '#2a2a2a' }}
              />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-zinc-200 text-sm">VRoid Studio</p>
                  <p className="text-zinc-500 text-xs">Create VTuber-style VRM avatars for free</p>
                </div>
                <a
                  href="https://vroid.com/en/studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded shrink-0 font-medium"
                  style={{ background: '#a855f720', color: '#a855f7' }}
                >
                  Free ↗
                </a>
              </div>
            </div>
          </div>

          {/* Format support table */}
          <div
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <p className="text-white text-sm font-semibold mb-1">Format Support Reference</p>
            {(Object.values(FORMAT_REGISTRY)).map(info => (
              <div key={info.ext} className="flex items-start gap-2">
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0 w-12 text-center"
                  style={{
                    background: info.native ? `${FORMAT_COLORS[info.ext] ?? '#6b7280'}20` : '#f59e0b15',
                    color: info.native ? (FORMAT_COLORS[info.ext] ?? '#6b7280') : '#f59e0b',
                  }}
                >
                  {info.ext.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 text-xs">{info.description}</p>
                  {!info.native && info.convertNote && (
                    <p className="text-zinc-500 text-xs mt-0.5">{info.convertNote}</p>
                  )}
                </div>
                <span
                  className="text-xs shrink-0"
                  style={{ color: info.native ? '#22c55e' : '#f59e0b' }}
                >
                  {info.native ? t('import_native_badge') : t('import_convert_badge')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: DEMO LIBRARY
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'demo' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">{t('import_demo_title')}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{t('import_demo_desc')}</p>
            </div>
            <span className="text-zinc-500 text-xs">{DEMO_CHARACTERS.length} characters</span>
          </div>

          {demoError && (
            <div
              className="rounded-xl p-3 text-red-400 text-xs"
              style={{ background: '#ef444415', border: '1px solid #ef444430' }}
            >
              {demoError}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {DEMO_CHARACTERS.map(demo => {
              const isActive = currentCharacter?.name === demo.name;
              const isLoading = demoLoadingId === demo.id;
              return (
                <div
                  key={demo.id}
                  className="rounded-xl p-3 flex items-center justify-between gap-3"
                  style={{
                    background: isActive ? '#f9731610' : '#1a1a1a',
                    border: `1px solid ${isActive ? '#f9731640' : '#2a2a2a'}`,
                  }}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{demo.name}</span>
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: `${FORMAT_COLORS[demo.format] ?? '#6b7280'}20`,
                          color: FORMAT_COLORS[demo.format] ?? '#6b7280',
                        }}
                      >
                        {demo.format.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs">{t(demo.descKey)}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {demo.tags.map(tag => (
                        <span
                          key={tag}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: '#2a2a2a', color: '#6b7280' }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLoadDemo(demo)}
                    disabled={isLoading || isActive}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                    style={
                      isActive
                        ? { background: '#f9731630', color: '#f97316' }
                        : { background: '#f97316', color: '#fff' }
                    }
                  >
                    {isLoading ? t('import_demo_loading') : isActive ? t('import_active') : t('import_demo_load')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: RECENT
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'recent' && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-white text-sm font-medium">{t('import_recent_title')}</p>
            <p className="text-zinc-500 text-xs mt-0.5">{t('import_recent_note')}</p>
          </div>

          {recentList.length === 0 ? (
            <div
              className="rounded-xl p-6 flex flex-col items-center gap-2"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
            >
              <span className="text-3xl opacity-40">📂</span>
              <p className="text-zinc-500 text-sm">{t('import_recent_empty')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentList.map(entry => {
                const isActive = currentCharacter?.id === entry.id;
                return (
                  <div
                    key={entry.id}
                    className="rounded-xl p-3 flex items-center justify-between gap-3"
                    style={{
                      background: isActive ? '#f9731610' : '#1a1a1a',
                      border: `1px solid ${isActive ? '#f9731640' : '#2a2a2a'}`,
                    }}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm truncate">{entry.name}</span>
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: `${FORMAT_COLORS[entry.format] ?? '#6b7280'}20`,
                            color: FORMAT_COLORS[entry.format] ?? '#6b7280',
                          }}
                        >
                          {entry.format.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-xs">
                        {entry.source} · {new Date(entry.importedAt).toLocaleDateString()}
                        {entry.fileSize ? ` · ${formatFileSize(entry.fileSize)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.glbUrl && !isActive && (
                        <button
                          onClick={async () => {
                            const result = await importGLBFromURL(entry.glbUrl!, entry.name);
                            if (result.success && result.character) handleImportSuccess(result.character);
                          }}
                          className="text-xs px-2 py-1 rounded-lg font-medium transition-colors"
                          style={{ background: '#f9731620', color: '#f97316', border: '1px solid #f9731640' }}
                        >
                          {t('import_recent_reuse')}
                        </button>
                      )}
                      {isActive && (
                        <span
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: '#f9731620', color: '#f97316' }}
                        >
                          {t('import_current')}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const updated = recentList.filter(r => r.id !== entry.id);
                          setRecentList(updated);
                          saveRecent(updated);
                        }}
                        className="text-xs px-2 py-1 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                        style={{ background: '#2a2a2a' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
