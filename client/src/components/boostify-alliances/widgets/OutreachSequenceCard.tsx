import { Link } from 'wouter';
import { Mail, Send, Clock, Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import { TOKENS } from '../../artist-acquisition/shared/tokens';
import { SectionCard } from '../../artist-acquisition/shared/SectionCard';
import { useOutreachSequence } from '../hooks/useAlliancesApi';

const ICONS: Record<string, any> = { Mail, Send, Clock, Calendar };

interface OutreachSequenceCardProps {
  contactId: number | null;
}

export function OutreachSequenceCard({ contactId }: OutreachSequenceCardProps) {
  const { data, isLoading } = useOutreachSequence(contactId);
  const steps: Array<{
    icon: string; title: string; subtitle: string;
    status: 'completed' | 'in-progress' | 'pending';
    statusLabel: string; badge?: string;
  }> = data?.steps || [];

  return (
    <SectionCard
      title={`OUTREACH SEQUENCE${data?.artistName ? ` · ${data.artistName}` : ''}`}
      action={
        <Link
          href="/admin/artist-acquisition"
          className="text-[11.5px] font-semibold"
          style={{ color: TOKENS.ORANGE_GLOW }}
          data-testid="alliances-outreach-edit-sequence"
        >
          Edit Sequence
        </Link>
      }
    >
      {isLoading && !data ? (
        <div className="p-4 flex items-center justify-center">
          <Loader2 size={14} className="animate-spin" style={{ color: TOKENS.MUTED }} />
        </div>
      ) : steps.length === 0 ? (
        <div className="text-[11px] text-center py-2" style={{ color: TOKENS.MUTED }}>
          No outreach activity yet.
        </div>
      ) : (
        <div className="relative flex items-start justify-between gap-2">
          <div
            className="absolute left-5 right-5 top-5 h-[2px]"
            style={{
              background:
                'linear-gradient(90deg, rgba(255,138,31,0.1), rgba(255,138,31,0.5), rgba(255,138,31,0.5), rgba(255,255,255,0.05))',
            }}
          />

          {steps.map((s, i) => {
            const Icon = ICONS[s.icon] || Mail;
            const isCompleted = s.status === 'completed';
            const isInProgress = s.status === 'in-progress';
            const isPending = s.status === 'pending';
            return (
              <div
                key={s.title + i}
                className="relative flex-1 flex flex-col items-center text-center min-w-0"
                data-testid={`alliances-outreach-step-${i}`}
              >
                <div
                  className="relative w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: isPending ? TOKENS.SURFACE_3 : TOKENS.ORANGE_SOFT,
                    border: `1.5px solid ${
                      isPending ? TOKENS.BORDER : isInProgress ? TOKENS.ORANGE_GLOW : TOKENS.ORANGE_RING
                    }`,
                    color: isPending ? TOKENS.MUTED : TOKENS.ORANGE_GLOW,
                    boxShadow: isInProgress
                      ? '0 0 18px rgba(255,138,31,0.5)'
                      : isCompleted
                      ? '0 0 12px rgba(255,138,31,0.25)'
                      : 'none',
                  }}
                >
                  <Icon size={16} />
                  {isCompleted && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: TOKENS.ORANGE, color: '#0a0a0a' }}
                    >
                      <CheckCircle2 size={10} strokeWidth={3} />
                    </span>
                  )}
                  {s.badge && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                      style={{ background: TOKENS.ORANGE, color: '#0a0a0a' }}
                    >
                      {s.badge}
                    </span>
                  )}
                </div>
                <div className="text-[12px] font-semibold mt-2 truncate w-full" style={{ color: TOKENS.TEXT }}>
                  {s.title}
                </div>
                <div className="text-[10px] truncate w-full" style={{ color: TOKENS.MUTED_2 }}>
                  {s.subtitle}
                </div>
                <div
                  className="text-[9.5px] font-semibold mt-1.5 flex items-center gap-1"
                  style={{
                    color: isCompleted
                      ? TOKENS.POSITIVE
                      : isInProgress
                      ? TOKENS.ORANGE_GLOW
                      : TOKENS.MUTED_2,
                  }}
                >
                  {isCompleted && <CheckCircle2 size={9} />}
                  {s.statusLabel}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
