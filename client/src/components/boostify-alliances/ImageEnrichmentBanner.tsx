import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Sparkles, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { TOKENS } from '../artist-acquisition/shared/tokens';

interface EnrichStatus {
  ok: boolean;
  total: number;
  withImage: number;
  withoutImage: number;
  spotifyConfigured: boolean;
}

interface EnrichResult {
  ok: boolean;
  processed: number;
  updated: number;
  notFound: number;
  skipped: number;
  error?: string;
}

async function fetchStatus(): Promise<EnrichStatus> {
  const resp = await fetch('/api/admin/boostify-alliances/enrich-images/status', {
    credentials: 'include',
  });
  if (!resp.ok) throw new Error('status failed');
  return resp.json();
}

async function runEnrichment(limit: number): Promise<EnrichResult> {
  const resp = await fetch('/api/admin/boostify-alliances/enrich-images', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  });
  return resp.json();
}

export function ImageEnrichmentBanner() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<EnrichStatus>({
    queryKey: ['/api/admin/boostify-alliances/enrich-images/status'],
    queryFn: fetchStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<EnrichResult | null>(null);

  const total = data?.total || 0;
  const withImage = data?.withImage || 0;
  const withoutImage = data?.withoutImage || 0;
  const pct = total > 0 ? Math.round((withImage / total) * 100) : 0;
  const spotifyOk = data?.spotifyConfigured !== false;

  const handleRun = async (limit: number) => {
    if (running) return;
    setRunning(true);
    setLastResult(null);
    try {
      const result = await runEnrichment(limit);
      setLastResult(result);
      qc.invalidateQueries({ queryKey: ['/api/admin/boostify-alliances/enrich-images/status'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/boostify-alliances/artist-radar'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/boostify-alliances/pipeline'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/boostify-alliances/master-json'] });
    } catch (e: any) {
      setLastResult({ ok: false, processed: 0, updated: 0, notFound: 0, skipped: 0, error: e?.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
      style={{
        background: TOKENS.SURFACE_2,
        border: `1px solid ${withoutImage > 0 ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
        boxShadow: withoutImage > 0 ? '0 0 22px rgba(255,138,31,0.12) inset' : 'none',
      }}
      data-testid="alliances-enrich-images-banner"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: TOKENS.ORANGE_SOFT,
          border: `1px solid ${TOKENS.ORANGE_RING}`,
          color: TOKENS.ORANGE_GLOW,
        }}
      >
        <ImageIcon size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold" style={{ color: TOKENS.TEXT }}>
            Artist photos
          </span>
          {isLoading ? (
            <Loader2 size={12} className="animate-spin" style={{ color: TOKENS.MUTED }} />
          ) : (
            <span className="text-[11px]" style={{ color: TOKENS.MUTED }}>
              {withImage.toLocaleString()} / {total.toLocaleString()} with image · {pct}% covered
            </span>
          )}
          {!spotifyOk && (
            <span
              className="text-[10px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <AlertTriangle size={10} />
              Spotify keys missing
            </span>
          )}
        </div>

        <div
          className="mt-2 h-1.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${TOKENS.ORANGE}, ${TOKENS.ORANGE_GLOW})`,
              boxShadow: '0 0 10px rgba(255,138,31,0.4)',
            }}
          />
        </div>

        {lastResult && (
          <div
            className="mt-2 text-[11px] flex items-center gap-1.5"
            style={{ color: lastResult.ok ? TOKENS.POSITIVE : TOKENS.DANGER }}
          >
            {lastResult.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
            {lastResult.ok
              ? `Updated ${lastResult.updated} · not found ${lastResult.notFound} · skipped ${lastResult.skipped} (of ${lastResult.processed})`
              : `Error: ${lastResult.error || 'unknown'}`}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => handleRun(50)}
          disabled={running || withoutImage === 0 || !spotifyOk}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[11.5px] font-semibold disabled:opacity-50"
          style={{
            background: TOKENS.SURFACE_3,
            border: `1px solid ${TOKENS.BORDER}`,
            color: TOKENS.TEXT,
          }}
          data-testid="alliances-enrich-images-batch-50"
        >
          {running ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          Fetch next 50
        </button>
        <button
          onClick={() => handleRun(200)}
          disabled={running || withoutImage === 0 || !spotifyOk}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[11.5px] font-semibold disabled:opacity-50"
          style={{
            background: `linear-gradient(90deg, ${TOKENS.ORANGE}, ${TOKENS.ORANGE_GLOW})`,
            color: '#0a0a0a',
            boxShadow: '0 0 18px rgba(255,138,31,0.4)',
          }}
          data-testid="alliances-enrich-images-batch-200"
        >
          {running ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          Enrich 200
        </button>
      </div>
    </div>
  );
}
