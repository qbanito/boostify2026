import { CheckCircle2, Copy, Music, Instagram, Twitter, Youtube, Loader2 } from 'lucide-react';
import { TOKENS, FONT_MONO } from '../../artist-acquisition/shared/tokens';
import { SectionCard } from '../../artist-acquisition/shared/SectionCard';
import { useMasterJson } from '../hooks/useAlliancesApi';

interface ArtistMasterJsonCardProps {
  contactId: number | null;
  onViewProfile: () => void;
}

function formatCompactJson(obj: any): string {
  if (!obj) return '{}';
  const lines: string[] = [];
  Object.entries(obj).forEach(([key, value]) => {
    let rendered: string;
    if (Array.isArray(value)) {
      rendered = `[${value.map((v) => (typeof v === 'string' ? `"${v}"` : String(v))).join(', ')}]`;
    } else if (typeof value === 'string') {
      rendered = `"${value}"`;
    } else if (value === null || value === undefined) {
      rendered = 'null';
    } else {
      rendered = String(value);
    }
    lines.push(`  "${key}": ${rendered},`);
  });
  return `{\n${lines.join('\n')}\n}`;
}

export function ArtistMasterJsonCard({ contactId, onViewProfile }: ArtistMasterJsonCardProps) {
  const { data, isLoading } = useMasterJson(contactId);
  const compact = data?.compact;
  const profile = data?.profile;
  const json = formatCompactJson(compact);

  return (
    <SectionCard
      title="ARTIST MASTER JSON"
      action={
        <div className="flex items-center gap-3">
          <button
            className="text-[11.5px] font-semibold disabled:opacity-50"
            style={{ color: TOKENS.ORANGE_GLOW }}
            onClick={onViewProfile}
            disabled={!contactId}
            data-testid="alliances-masterjson-view-profile"
          >
            View Full Profile
          </button>
          <button
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.MUTED }}
            aria-label="Copy JSON"
            onClick={() => {
              try { navigator.clipboard.writeText(json); } catch {}
            }}
            data-testid="alliances-masterjson-copy"
          >
            <Copy size={12} />
          </button>
        </div>
      }
    >
      {isLoading && !data ? (
        <div className="p-6 flex items-center justify-center">
          <Loader2 size={14} className="animate-spin" style={{ color: TOKENS.MUTED }} />
        </div>
      ) : !compact ? (
        <div className="text-[12px] text-center py-6" style={{ color: TOKENS.MUTED }}>
          Select an artist to view their master JSON.
        </div>
      ) : (
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-[130px]">
            <div
              className="w-full aspect-square rounded-xl flex items-center justify-center text-white font-black text-[32px] overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${profile?.gradient?.[0] || '#2a1f1a'}, ${profile?.gradient?.[1] || '#5a3620'})`,
                border: `1px solid ${TOKENS.BORDER}`,
                boxShadow: '0 0 24px rgba(255,138,31,0.18)',
              }}
            >
              {profile?.imageUrl ? (
                <img src={profile.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                profile?.initials || '??'
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[12.5px] font-bold truncate" style={{ color: TOKENS.TEXT }}>
                {profile?.name}
              </span>
              {profile?.verified && (
                <CheckCircle2 size={11} style={{ color: TOKENS.ORANGE_GLOW }} />
              )}
            </div>
            <div className="text-[10.5px] truncate" style={{ color: TOKENS.MUTED }}>
              {profile?.location}
            </div>
            <div className="text-[10.5px] truncate" style={{ color: TOKENS.MUTED }}>
              {profile?.label}
            </div>
            <div className="flex items-center gap-2 mt-2" style={{ color: TOKENS.MUTED_2 }}>
              <Music size={11} />
              <span className="w-0.5 h-3" style={{ background: TOKENS.BORDER }} />
              <Instagram size={11} />
              <Twitter size={11} />
              <Youtube size={11} />
            </div>
          </div>

          <pre
            className="flex-1 min-w-0 rounded-xl p-3 overflow-auto text-[10.5px] leading-[1.55] max-h-[260px] custom-scroll"
            style={{
              background: '#0a0b0e',
              border: `1px solid ${TOKENS.BORDER}`,
              color: TOKENS.ORANGE_GLOW,
              fontFamily: FONT_MONO,
              whiteSpace: 'pre',
            }}
          >
{json}
          </pre>
        </div>
      )}
    </SectionCard>
  );
}
