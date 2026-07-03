/**
 * QualityGatePanel — panel de control de calidad del timeline (Montage IQ)
 *
 * Muestra el riesgo de "slideshow", issues pre-render y permite alinear los
 * cortes al beat. Additive: no toca ningún flujo existente del editor.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, X, Zap, AlertTriangle, AlertCircle, Info, Loader2, CheckCircle2 } from 'lucide-react';
import { TimelineClip } from '@/interfaces/timeline';
import { analyzeTimelineQuality, snapClipsToBeats, type QualityVerdict } from '@/lib/services/montage-quality';

interface QualityGatePanelProps {
  clips: TimelineClip[];
  duration: number;
  beats?: number[];
  onApplyClips: (newClips: TimelineClip[], operation: string) => void;
  onClose: () => void;
  videoPreviewUrl?: string;
}

const VERDICT_UI: Record<QualityVerdict, { label: string; color: string; bg: string }> = {
  strong: { label: 'FUERTE', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/40' },
  acceptable: { label: 'ACEPTABLE', color: 'text-lime-400', bg: 'bg-lime-500/15 border-lime-500/40' },
  revise: { label: 'REVISAR', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/40' },
  fail: { label: 'RIESGO ALTO', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/40' },
};

export function QualityGatePanel({ clips, duration, beats, onApplyClips, onClose, videoPreviewUrl }: QualityGatePanelProps) {
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<any | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  const report = useMemo(
    () => analyzeTimelineQuality(clips, { duration, beats }),
    [clips, duration, beats]
  );

  const verdictUi = VERDICT_UI[report.verdict];
  const beatsAvailable = (beats?.length || 0) > 3;

  const handleBeatSnap = () => {
    if (!beatsAvailable) return;
    const res = snapClipsToBeats(clips, beats!, { toleranceSec: 0.3 });
    if (res.movedCount > 0) {
      onApplyClips(res.clips, 'beat-snap');
    }
  };

  const handleProbe = async () => {
    if (!videoPreviewUrl || probing) return;
    setProbing(true);
    setProbeError(null);
    try {
      const r = await fetch('/api/video-qc/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ videoUrl: videoPreviewUrl }),
      });
      const data = await r.json();
      if (!r.ok || !data?.success) throw new Error(data?.error || `HTTP ${r.status}`);
      setProbe(data.probe);
    } catch (e: any) {
      setProbeError(e?.message || 'No se pudo analizar el video');
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="bg-neutral-900/95 backdrop-blur border border-white/15 rounded-lg shadow-2xl text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <Shield size={13} className="text-sky-400" />
          <span className="text-xs font-semibold">Quality Gate</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${verdictUi.bg} ${verdictUi.color}`}>
            {verdictUi.label}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} className="p-0.5 h-5 w-5 hover:bg-white/10">
          <X size={11} className="text-white/60" />
        </Button>
      </div>

      <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
        {/* Score */}
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
              <circle
                cx="18" cy="18" r="15.5" fill="none"
                stroke={report.score < 25 ? '#34d399' : report.score < 50 ? '#a3e635' : report.score < 75 ? '#fbbf24' : '#f87171'}
                strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${(report.score / 100) * 97.4} 97.4`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold">{report.score}</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium">Riesgo de "slideshow"</div>
            <div className="text-[10px] text-white/50 leading-tight">
              {report.stats.videoClips} video · {report.stats.stillClips} imagen · media {report.stats.avgClipSeconds}s/clip
              {report.stats.beatAlignedCutRatio !== null && ` · ${Math.round(report.stats.beatAlignedCutRatio * 100)}% cortes en beat`}
            </div>
          </div>
        </div>

        {/* Factores */}
        <div className="space-y-1.5">
          {report.factors.map((f) => (
            <div key={f.key} title={f.detail}>
              <div className="flex justify-between text-[9px] text-white/60 mb-0.5">
                <span>{f.label}</span>
                <span className={f.score < 30 ? 'text-emerald-400' : f.score < 60 ? 'text-amber-400' : 'text-red-400'}>{f.score}</span>
              </div>
              <div className="h-1 rounded bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded ${f.score < 30 ? 'bg-emerald-500' : f.score < 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.max(2, f.score)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Beat snap */}
        <Button
          size="sm"
          onClick={handleBeatSnap}
          disabled={!beatsAvailable}
          className="w-full h-7 text-[10px] gap-1.5 bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-300 border border-yellow-500/30"
          variant="ghost"
          title={beatsAvailable ? 'Mueve cada corte al beat más cercano (deshacible con Ctrl+Z)' : 'Añade audio para detectar beats primero'}
        >
          <Zap size={11} />
          Alinear cortes al beat {beatsAvailable ? `(${beats!.length} beats)` : '(sin beats)'}
        </Button>

        {/* Issues */}
        {report.issues.length > 0 && (
          <div className="space-y-1">
            <div className="text-[9px] uppercase tracking-wide text-white/40 font-semibold">Validación pre-render</div>
            {report.issues.slice(0, 8).map((issue, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] leading-snug">
                {issue.severity === 'error' ? (
                  <AlertCircle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
                ) : issue.severity === 'warning' ? (
                  <AlertTriangle size={11} className="text-amber-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <Info size={11} className="text-sky-400 mt-0.5 flex-shrink-0" />
                )}
                <span className="text-white/75">{issue.message}</span>
              </div>
            ))}
            {report.issues.length > 8 && (
              <div className="text-[9px] text-white/40">+{report.issues.length - 8} más…</div>
            )}
          </div>
        )}
        {report.issues.length === 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
            <CheckCircle2 size={11} /> Sin problemas detectados en el timeline
          </div>
        )}

        {/* Sugerencias */}
        {report.suggestions.length > 0 && (
          <div className="space-y-1">
            <div className="text-[9px] uppercase tracking-wide text-white/40 font-semibold">Sugerencias</div>
            {report.suggestions.map((s, i) => (
              <div key={i} className="text-[10px] text-white/60 leading-snug pl-2 border-l border-white/15">{s}</div>
            ))}
          </div>
        )}

        {/* QC post-render (ffprobe server) */}
        {videoPreviewUrl && (
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleProbe}
              disabled={probing}
              className="w-full h-7 text-[10px] gap-1.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30"
            >
              {probing ? <Loader2 size={11} className="animate-spin" /> : <Shield size={11} />}
              Verificar video renderizado (ffprobe)
            </Button>
            {probeError && <div className="text-[10px] text-red-400">{probeError}</div>}
            {probe && (
              <div className="text-[10px] text-white/70 space-y-0.5">
                <div>{probe.width}×{probe.height} · {probe.fps ? `${probe.fps}fps` : '—'} · {probe.durationSec?.toFixed(1)}s</div>
                <div>Video: {probe.videoCodec || '—'} · Audio: {probe.hasAudio ? probe.audioCodec || 'sí' : 'SIN AUDIO ⚠️'}</div>
                {Array.isArray(probe.checks) && probe.checks.map((c: any, i: number) => (
                  <div key={i} className={`flex items-center gap-1 ${c.pass ? 'text-emerald-400' : 'text-red-400'}`}>
                    {c.pass ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />} {c.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default QualityGatePanel;
