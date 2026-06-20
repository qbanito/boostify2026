// ─── ShowPackageExporter ─────────────────────────────────────────────────────
// Export and import show packages in .holostage.json format.

import React, { useState, useRef } from 'react';
import { Download, Upload, FileJson, CheckCircle, AlertCircle, Music, Zap, Clock } from 'lucide-react';
import type { HoloShow } from '../../schemas/holostage/showPackage.schema';
import { useHoloLang } from './holoLangContext';
import { exportShowPackage, importShowPackage } from '../../services/holostage/showPackageExporter';
import { formatTime } from '../../services/holostage/audioSyncEngine';

interface ShowPackageExporterProps {
  show: HoloShow;
  onShowImported: (show: HoloShow) => void;
  onMetadataChange: (show: HoloShow) => void;
}

export function ShowPackageExporter({ show, onShowImported, onMetadataChange }: ShowPackageExporterProps) {
  const { t } = useHoloLang();
  const [exportOptions, setExportOptions] = useState({
    includeWaveformData: false,
    includeThumbnails: false,
    prettyPrint: true,
    embedCharacterMetadata: true,
  });
  const [lastExport, setLastExport] = useState<Date | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalDuration = show.songs.reduce((s, song) => s + song.duration, 0);
  const packageSize = (() => {
    try {
      const j = JSON.stringify(show);
      return (new Blob([j]).size / 1024).toFixed(1) + ' KB';
    } catch {
      return '—';
    }
  })();

  const handleExport = async () => {
    await exportShowPackage(show, exportOptions);
    setLastExport(new Date());
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    setImportSuccess(false);
    try {
      const result = await importShowPackage(file);
      if (!result.success || !result.show) {
        throw new Error(result.error ?? 'Error desconocido');
      }
      onShowImported(result.show);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Error al importar el archivo');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const update = (partial: Partial<HoloShow['metadata']>) =>
    onMetadataChange({ ...show, metadata: { ...show.metadata, ...partial } });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileJson className="w-4 h-4 text-orange-400" />
        <h3 className="text-base font-bold text-white tracking-wider uppercase">{t('exp_header')}</h3>
        <span className="text-xs text-gray-600 ml-2">.holostage.json</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Music, label: t('exp_songs'), value: show.songs.length },
          { icon: Zap, label: 'Cues', value: show.cues.length },
          { icon: Clock, label: t('exp_duration'), value: formatTime(totalDuration) },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 p-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Icon className="w-4 h-4 text-orange-400" />
            <span className="text-base font-bold text-white">{value}</span>
            <span className="text-xs text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Show metadata */}
      <div className="space-y-3 p-3 rounded-xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('exp_metadata')}</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: t('exp_name'), key: 'name', value: show.name },
            { label: t('exp_artist'), key: 'artistName', value: show.artistName },
          ].map(({ label, key, value }) => (
            <div key={key}>
              <label className="text-xs text-gray-600 block mb-1">{label}</label>
              <input
                value={value}
                onChange={e => onMetadataChange({ ...show, [key]: e.target.value })}
                className="w-full bg-black/40 border rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-600 block mb-1">Venue</label>
            <input
              value={show.metadata.venueName || show.metadata.venue || ''}
              onChange={e => update({ venueName: e.target.value, venue: e.target.value })}
              className="w-full bg-black/40 border rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              placeholder={t('exp_venue_ph')}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">{t('exp_date')}</label>
            <input
              type="date"
              value={show.metadata.date || ''}
              onChange={e => update({ date: e.target.value })}
              className="w-full bg-black/40 border rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">{t('exp_notes')}</label>
          <textarea
            value={show.metadata.notes || ''}
            onChange={e => update({ notes: e.target.value })}
            rows={2}
            className="w-full bg-black/40 border rounded-lg px-2 py-1.5 text-xs text-white outline-none resize-none focus:border-orange-500"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            placeholder={t('exp_notes_ph')}
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">{t('exp_city')}</label>
          <input
            value={show.metadata.city || ''}
            onChange={e => update({ city: e.target.value })}
            className="w-full bg-black/40 border rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              placeholder={t('exp_city_ph')}
          />
        </div>
      </div>

      {/* Export options */}
      <div className="space-y-2 p-3 rounded-xl border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('exp_options')}</p>
        {[
          { key: 'includeWaveformData', label: t('exp_waveform'), desc: t('exp_waveform_desc') },
          { key: 'includeThumbnails', label: t('exp_thumbnails'), desc: t('exp_thumbnails_desc') },
          { key: 'prettyPrint', label: 'Pretty print JSON', desc: t('exp_pretty_desc') },
        ].map(({ key, label, desc }) => (
          <label key={key} className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={exportOptions[key as keyof typeof exportOptions]}
              onChange={e => setExportOptions(o => ({ ...o, [key]: e.target.checked }))}
              className="mt-0.5 accent-orange-400"
            />
            <div>
              <span className="text-xs text-gray-300">{label}</span>
              <span className="text-xs text-gray-600 block">{desc}</span>
            </div>
          </label>
        ))}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-600">{t('exp_size', { size: packageSize })}</span>
          <span className="text-xs text-gray-700">v{show.version}</span>
        </div>
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold tracking-wider uppercase text-sm transition-all hover:scale-102"
        style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.1))', color: '#f97316', border: '1px solid rgba(249,115,22,0.4)' }}
      >
        <Download className="w-4 h-4" />
        {t('exp_btn')}
      </button>
      {lastExport && (
        <p className="text-xs text-center text-gray-600 -mt-2">
          <CheckCircle className="inline w-3 h-3 text-emerald-400 mr-1" />
          {t('exp_exported')} {lastExport.toLocaleTimeString()}
        </p>
      )}

      {/* Import section */}
      <div className="p-3 rounded-xl border space-y-3" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('exp_import')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.holostage.json"
          onChange={handleImportFile}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.03)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Upload className="w-4 h-4" />
          {importing ? t('exp_importing') : t('exp_select_file')}
        </button>
        {importError && (
          <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-400">{importError}</p>
          </div>
        )}
        {importSuccess && (
          <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400">{t('exp_imported_ok')}</p>
          </div>
        )}
        <p className="text-xs text-gray-700">
          Formato: <span className="font-mono">boostify-holostage-v1</span>
        </p>
      </div>
    </div>
  );
}
