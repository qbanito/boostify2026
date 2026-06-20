import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Trophy, Flame, MessageCircle, Layout, Loader2, Copy } from 'lucide-react';
import { useState } from 'react';

interface WinningPatternsMemoryProps {
  artistId: number;
}

const SECTION_CONFIG = [
  { key: 'bestHooks', label: 'Winning Hooks', icon: Flame, accent: 'text-orange-400', empty: 'No winning hooks yet. Mark hooks as winners from the Hook Generator.' },
  { key: 'bestCtas', label: 'Winning CTAs', icon: MessageCircle, accent: 'text-green-400', empty: 'No CTAs saved yet.' },
  { key: 'bestVisuals', label: 'Winning Formats', icon: Layout, accent: 'text-blue-400', empty: 'No formats saved yet.' },
];

export function WinningPatternsMemory({ artistId }: WinningPatternsMemoryProps) {
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [`/api/audience-capture/memory/${artistId}`],
    queryFn: () => apiRequest('GET', `/api/audience-capture/memory/${artistId}`) as Promise<{ patterns: any }>,
    staleTime: 60_000,
  });

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIdx(key);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-orange-400" />
      </div>
    );
  }

  const patterns = data?.patterns;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Trophy size={16} className="text-orange-400" />
        <h3 className="text-sm font-semibold text-white">Winning Patterns Memory</h3>
        <span className="text-[10px] text-white/30 ml-1">what works for this artist</span>
      </div>

      {SECTION_CONFIG.map(({ key, label, icon: Icon, accent, empty }) => {
        const items: string[] = patterns?.[key] ?? [];
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={13} className={accent} />
              <span className="text-xs font-medium text-white/70">{label}</span>
              {items.length > 0 && (
                <span className="ml-auto text-[10px] text-white/30">{items.length}</span>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-[11px] text-white/25 italic pl-4">{empty}</p>
            ) : (
              <div className="space-y-1.5">
                {items.slice(0, 8).map((item, i) => {
                  const copyKey = `${key}-${i}`;
                  return (
                    <div
                      key={i}
                      className="group flex items-start gap-2 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 hover:border-white/15 transition-all"
                    >
                      <span className="text-[10px] text-white/20 mt-0.5 font-mono">{i + 1}.</span>
                      <span className="flex-1 text-xs text-white/75 leading-relaxed">{item}</span>
                      <button
                        type="button"
                        onClick={() => copy(item, copyKey)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-white"
                      >
                        {copiedIdx === copyKey ? <span className="text-[9px] text-green-400">✓</span> : <Copy size={11} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Losing hooks warning */}
      {(patterns?.losingHooks ?? []).length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <div className="text-[11px] font-semibold text-red-400 mb-2">
            ✕ Weak Hooks to Avoid ({patterns.losingHooks.length})
          </div>
          <div className="space-y-1">
            {(patterns.losingHooks as string[]).slice(0, 5).map((h, i) => (
              <div key={i} className="text-[10px] text-red-400/60 pl-2 line-through">{h}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
