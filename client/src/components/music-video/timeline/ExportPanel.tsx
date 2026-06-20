/**
 * ExportPanel — Full-screen cinematic overlay for exporting timeline
 * Supports multiple formats, aspect ratios, resolutions, quality presets
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  X, Download, Film, Monitor, Smartphone, Square,
  Check, ChevronRight, Loader2, Settings, Zap,
  Image as ImageIcon, Clock,
} from 'lucide-react';
import { TimelineClip } from '@/interfaces/timeline';
import { logger } from '@/lib/logger';
import { apiRequest } from '@/lib/queryClient';

// ── Export Formats ──────────────────────────────────────────
const EXPORT_FORMATS = [
  { id: 'mp4',    label: 'MP4',    ext: '.mp4',    mime: 'video/mp4',    desc: 'H.264 — Compatible universal', icon: '🎬', color: '#f97316' },
  { id: 'webm',   label: 'WebM',   ext: '.webm',   mime: 'video/webm',   desc: 'VP9 — Web optimizado',         icon: '🌐', color: '#3b82f6' },
  { id: 'mov',    label: 'MOV',    ext: '.mov',     mime: 'video/quicktime', desc: 'ProRes — Apple profesional', icon: '🍎', color: '#8b5cf6' },
  { id: 'gif',    label: 'GIF',    ext: '.gif',     mime: 'image/gif',    desc: 'Animado — Redes sociales',     icon: '✨', color: '#ec4899' },
] as const;

// ── Resolutions ─────────────────────────────────────────────
const RESOLUTIONS = [
  { id: '4k',     label: '4K',        w: 3840, h: 2160, badge: 'Ultra' },
  { id: '1080p',  label: '1080p',     w: 1920, h: 1080, badge: 'Full HD' },
  { id: '720p',   label: '720p',      w: 1280, h: 720,  badge: 'HD' },
  { id: '480p',   label: '480p',      w: 854,  h: 480,  badge: 'SD' },
  { id: 'custom', label: 'Custom',    w: 0,    h: 0,    badge: '' },
] as const;

// ── Aspect Ratios ───────────────────────────────────────────
export const ASPECT_RATIOS = [
  { id: '16:9',   label: '16:9',  ratio: 16/9,  desc: 'YouTube / Cine',     icon: Monitor },
  { id: '9:16',   label: '9:16',  ratio: 9/16,  desc: 'TikTok / Reels',     icon: Smartphone },
  { id: '1:1',    label: '1:1',   ratio: 1,     desc: 'Instagram Square',   icon: Square },
  { id: '4:3',    label: '4:3',   ratio: 4/3,   desc: 'Clásico',            icon: Monitor },
  { id: '4:5',    label: '4:5',   ratio: 4/5,   desc: 'Instagram Portrait', icon: Smartphone },
  { id: '21:9',   label: '21:9',  ratio: 21/9,  desc: 'Ultra-Wide / Cine',  icon: Film },
] as const;

// ── Quality Presets ─────────────────────────────────────────
const QUALITY_PRESETS = [
  { id: 'draft',    label: '⚡ Borrador',     bitrate: 2,  fps: 24, desc: 'Rápido, baja calidad' },
  { id: 'standard', label: '📺 Estándar',     bitrate: 8,  fps: 30, desc: 'Balance calidad/tamaño' },
  { id: 'high',     label: '🎬 Alta',         bitrate: 15, fps: 30, desc: 'Calidad profesional' },
  { id: 'ultra',    label: '💎 Ultra',        bitrate: 30, fps: 60, desc: 'Máxima calidad' },
] as const;

// ── Props ───────────────────────────────────────────────────
interface ExportPanelProps {
  open: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  duration: number;
  audioUrl?: string;
  projectName?: string;
  aspectRatio: string;
  onExportComplete?: (videoUrl: string) => void; // Callback cuando el video está listo
}

// ── Helper ──────────────────────────────────────────────────
function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function estimateFileSize(bitrateMbps: number, durationSec: number): string {
  const bytes = (bitrateMbps * 1000000 / 8) * durationSec;
  if (bytes > 1e9) return `~${(bytes / 1e9).toFixed(1)} GB`;
  return `~${(bytes / 1e6).toFixed(0)} MB`;
}

// ═══════════════════════════════════════════════════════════
// 🎬 ExportPanel Component
// ═══════════════════════════════════════════════════════════
export const ExportPanel: React.FC<ExportPanelProps> = ({
  open,
  onClose,
  clips,
  duration,
  audioUrl,
  projectName,
  aspectRatio: initialAspectRatio,
  onExportComplete,
}) => {
  const { toast } = useToast();

  // ── State ─────────────────────────────────────────────
  const [format, setFormat] = useState('mp4');
  const [resolution, setResolution] = useState('1080p');
  const [quality, setQuality] = useState('high');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(initialAspectRatio || '16:9');
  const [customFps, setCustomFps] = useState(30);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // ── Derived ───────────────────────────────────────────
  const selectedFormat = useMemo(() => EXPORT_FORMATS.find(f => f.id === format)!, [format]);
  const selectedRes = useMemo(() => RESOLUTIONS.find(r => r.id === resolution)!, [resolution]);
  const selectedQuality = useMemo(() => QUALITY_PRESETS.find(q => q.id === quality)!, [quality]);
  const selectedAR = useMemo(() => ASPECT_RATIOS.find(a => a.id === selectedAspectRatio)!, [selectedAspectRatio]);

  const effectiveRes = useMemo(() => {
    if (!selectedRes || !selectedAR) return { w: 1920, h: 1080 };
    const baseW = selectedRes.w || 1920;
    if (selectedAR.ratio >= 1) {
      return { w: baseW, h: Math.round(baseW / selectedAR.ratio) };
    } else {
      const baseH = selectedRes.h || 1080;
      return { w: Math.round(baseH * selectedAR.ratio), h: baseH };
    }
  }, [selectedRes, selectedAR]);

  const videoClips = useMemo(() => clips.filter(c => c.layerId === 1), [clips]);
  const audioClips = useMemo(() => clips.filter(c => c.layerId === 2), [clips]);
  const estimatedSize = useMemo(
    () => estimateFileSize(selectedQuality?.bitrate || 8, duration),
    [selectedQuality, duration]
  );

  // ── Export Handler ────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (clips.length === 0) {
      toast({ title: 'Sin clips', description: 'Añade clips al timeline para exportar', variant: 'destructive' });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    toast({ title: '🎬 Iniciando exportación...', description: `Formato: ${selectedFormat.label} • ${effectiveRes.w}×${effectiveRes.h}` });

    try {
      const exportData = {
        clips: clips.map(c => ({
          id: c.id,
          start: c.start,
          duration: c.duration,
          layerId: c.layerId,
          type: c.type,
          imageUrl: c.imageUrl || c.url,
          videoUrl: c.metadata?.videoUrl,
          title: c.title,
          effects: c.effects,
          transition: c.transition,
          imageFit: c.metadata?.imageFit || 'cover',
        })),
        settings: {
          format: format,
          width: effectiveRes.w,
          height: effectiveRes.h,
          fps: selectedQuality?.fps || customFps,
          bitrate: selectedQuality?.bitrate || 8,
          quality: quality,
          aspectRatio: selectedAspectRatio,
        },
        duration,
        audioUrl,
        projectName: projectName || `Export_${new Date().toISOString().slice(0, 10)}`,
      };

      const data = await apiRequest('/api/video-projects/export', {
        method: 'POST',
        data: exportData,
      });

      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
        toast({ title: '✅ Exportación completa', description: 'Tu video está listo para descargar' });
        // Notificar al parent que el video está listo para guardarlo en el perfil del artista
        onExportComplete?.(data.downloadUrl);
        onClose();
      } else if (data.jobId) {
        toast({ title: '🎬 Renderizando...', description: 'Tu video se está procesando...' });
        // Poll for render completion
        const pollInterval = setInterval(async () => {
          try {
            const statusData = await apiRequest(`/api/video-projects/export/status/${data.jobId}`);
            if (statusData.status === 'done' && statusData.downloadUrl) {
              clearInterval(pollInterval);
              setExportProgress(100);
              toast({ title: '✅ Video listo', description: 'Tu video está listo para descargar' });
              window.open(statusData.downloadUrl, '_blank');
              onExportComplete?.(statusData.downloadUrl);
              setIsExporting(false);
              onClose();
            } else if (statusData.status === 'failed') {
              clearInterval(pollInterval);
              toast({ title: 'Error', description: statusData.error || 'El renderizado falló', variant: 'destructive' });
              setIsExporting(false);
            } else {
              setExportProgress(statusData.progress || exportProgress);
            }
          } catch (err) {
            clearInterval(pollInterval);
            logger.error('[ExportPanel] Error consultando estado de render:', err);
            toast({ title: 'Error', description: 'No se pudo consultar el estado del render', variant: 'destructive' });
            setIsExporting(false);
          }
        }, 5000);
        // Safety timeout: clear polling after 10 minutes
        setTimeout(() => clearInterval(pollInterval), 600000);
        return; // Don't hit finally block yet
      }

      logger.info('🎬 [Export] Exportación exitosa', data);
    } catch (error) {
      logger.error('❌ [Export] Error:', error);
      toast({
        title: 'Error en exportación',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [clips, duration, audioUrl, projectName, format, effectiveRes, selectedQuality, quality, customFps, selectedAspectRatio, selectedFormat, toast, onClose, onExportComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-sm" style={{ zIndex: 99999 }}>
      <div className="relative w-[96vw] max-w-4xl max-h-[92vh] rounded-xl border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 shadow-2xl overflow-hidden flex flex-col">

        {/* ── Header ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-black/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-orange-500/15">
              <Download className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Exportar Video</h2>
              <p className="text-xs text-white/50 flex items-center gap-1.5">
                <Film className="w-3 h-3" /> {videoClips.length} clips visuales
                <span className="text-white/20">•</span>
                <Clock className="w-3 h-3" /> {fmtTime(duration)}
                <span className="text-white/20">•</span>
                <span className="text-orange-400">{estimatedSize}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ROW 1: Format + Aspect Ratio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Format Selection */}
            <section>
              <Label className="text-sm font-semibold text-white/70 mb-2 block">Formato</Label>
              <div className="grid grid-cols-2 gap-2">
                {EXPORT_FORMATS.map(f => {
                  const active = format === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={`relative rounded-xl p-3 text-left transition-all border ${
                        active ? 'border-2 shadow-lg' : 'border-white/8 hover:border-white/20 hover:bg-white/5'
                      }`}
                      style={active ? { borderColor: f.color, background: `${f.color}12`, boxShadow: `0 0 20px ${f.color}20` } : undefined}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{f.icon}</span>
                        <span className={`font-bold text-sm ${active ? 'text-white' : 'text-white/70'}`}>{f.label}</span>
                      </div>
                      <p className="text-[10px] text-white/40">{f.desc}</p>
                      {active && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: f.color }}>
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Aspect Ratio */}
            <section>
              <Label className="text-sm font-semibold text-white/70 mb-2 block">Aspect Ratio</Label>
              <div className="grid grid-cols-3 gap-2">
                {ASPECT_RATIOS.map(ar => {
                  const active = selectedAspectRatio === ar.id;
                  const IconComp = ar.icon;
                  // Visual ratio preview
                  const previewW = ar.ratio >= 1 ? 32 : Math.round(24 * ar.ratio);
                  const previewH = ar.ratio >= 1 ? Math.round(32 / ar.ratio) : 24;
                  return (
                    <button
                      key={ar.id}
                      onClick={() => setSelectedAspectRatio(ar.id)}
                      className={`relative rounded-xl p-2.5 text-center transition-all border ${
                        active ? 'border-2 border-orange-500 bg-orange-500/10 shadow-lg' : 'border-white/8 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      {/* Ratio preview box */}
                      <div className="flex justify-center mb-1.5">
                        <div
                          className={`border-2 rounded-sm ${active ? 'border-orange-400' : 'border-white/30'}`}
                          style={{ width: previewW, height: previewH }}
                        />
                      </div>
                      <div className={`text-xs font-bold ${active ? 'text-orange-400' : 'text-white/60'}`}>{ar.label}</div>
                      <div className="text-[9px] text-white/30">{ar.desc}</div>
                      {active && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ROW 2: Resolution + Quality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Resolution */}
            <section>
              <Label className="text-sm font-semibold text-white/70 mb-2 block">Resolución</Label>
              <div className="flex flex-wrap gap-2">
                {RESOLUTIONS.filter(r => r.id !== 'custom').map(r => {
                  const active = resolution === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setResolution(r.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        active
                          ? 'bg-orange-500/15 border-orange-500/60 text-orange-300'
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      <span className="font-bold">{r.label}</span>
                      {r.badge && <span className="text-[9px] ml-1 text-white/30">{r.badge}</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-white/30 mt-2">
                Salida: {effectiveRes.w} × {effectiveRes.h}px
              </p>
            </section>

            {/* Quality Presets */}
            <section>
              <Label className="text-sm font-semibold text-white/70 mb-2 block">Calidad</Label>
              <div className="space-y-1.5">
                {QUALITY_PRESETS.map(q => {
                  const active = quality === q.id;
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setQuality(q.id);
                        setCustomFps(q.fps);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all border ${
                        active
                          ? 'bg-orange-500/12 border-orange-500/50 text-white'
                          : 'bg-white/3 border-white/8 text-white/50 hover:bg-white/8'
                      }`}
                    >
                      <div>
                        <span className="text-sm font-medium">{q.label}</span>
                        <span className="text-[10px] text-white/30 ml-2">{q.desc}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/30">{q.fps}fps • {q.bitrate}Mbps</span>
                        {active && <Check className="w-3.5 h-3.5 text-orange-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ROW 3: Preview + Summary */}
          <section className="rounded-xl border border-white/10 bg-white/3 p-4">
            <div className="flex items-start gap-4">
              {/* Mini preview */}
              <div
                className="flex-shrink-0 rounded-lg border border-white/10 bg-black/50 flex items-center justify-center overflow-hidden"
                style={{ width: 120, height: Math.round(120 / (selectedAR?.ratio || 16/9)) }}
              >
                {videoClips.length > 0 && (videoClips[0].imageUrl || videoClips[0].url) ? (
                  <img
                    src={videoClips[0].imageUrl || videoClips[0].url || ''}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-white/20" />
                )}
              </div>

              {/* Summary details */}
              <div className="flex-1 space-y-1.5">
                <h3 className="text-sm font-bold text-white">Resumen de exportación</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <div className="text-white/40">Formato</div>
                  <div className="text-white/80 font-medium">{selectedFormat.label} ({selectedFormat.ext})</div>
                  <div className="text-white/40">Resolución</div>
                  <div className="text-white/80 font-medium">{effectiveRes.w} × {effectiveRes.h}</div>
                  <div className="text-white/40">Aspect Ratio</div>
                  <div className="text-white/80 font-medium">{selectedAspectRatio}</div>
                  <div className="text-white/40">Calidad</div>
                  <div className="text-white/80 font-medium">{selectedQuality?.label}</div>
                  <div className="text-white/40">FPS</div>
                  <div className="text-white/80 font-medium">{selectedQuality?.fps || customFps}</div>
                  <div className="text-white/40">Duración</div>
                  <div className="text-white/80 font-medium">{fmtTime(duration)}</div>
                  <div className="text-white/40">Clips</div>
                  <div className="text-white/80 font-medium">{videoClips.length} visual + {audioClips.length} audio</div>
                  <div className="text-white/40">Tamaño est.</div>
                  <div className="text-orange-400 font-bold">{estimatedSize}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Export progress */}
          {isExporting && (
            <section className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70 font-medium flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                  Exportando...
                </span>
                <span className="text-orange-400 font-bold">{Math.round(exportProgress)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </section>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-black/40 flex-shrink-0">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-white/50 hover:text-white hover:bg-white/10 h-9"
          >
            <X className="w-4 h-4 mr-1.5" /> Cancelar
          </Button>

          <Button
            onClick={handleExport}
            disabled={isExporting || clips.length === 0}
            className="h-10 px-6 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Exportar {selectedFormat.label}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
