import { useEffect, useState } from 'react';
import { Plug, Check, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { SectionCard } from '../shared/SectionCard';
import { TOKENS } from '../shared/tokens';
import { apiRequest } from '../../../lib/queryClient';

interface Integration {
  id: string;
  name: string;
  status: 'connected' | 'optional' | 'missing' | 'error';
  required: boolean;
  docs: string | null;
}

const FALLBACK: Integration[] = [
  { id: 'clerk', name: 'Clerk', status: 'connected', required: true, docs: null },
  { id: 'postgres', name: 'Postgres', status: 'connected', required: true, docs: null },
  { id: 'spotify', name: 'Spotify', status: 'optional', required: false, docs: null },
  { id: 'sendgrid', name: 'SendGrid', status: 'optional', required: false, docs: null },
];

export function IntegrationsCard() {
  const [integrations, setIntegrations] = useState<Integration[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiRequest('GET', '/api/admin/artist-acquisition/integrations')
      .then((res: any) => {
        if (mounted && res?.integrations) setIntegrations(res.integrations);
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const connected = integrations.filter((i) => i.status === 'connected').length;
  const missingRequired = integrations.filter((i) => i.required && i.status !== 'connected').length;

  return (
    <SectionCard
      title="Integrations"
      action={
        <span
          className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{
            color: missingRequired > 0 ? TOKENS.DANGER : TOKENS.MUTED,
            background: TOKENS.SURFACE_3,
            border: `1px solid ${missingRequired > 0 ? 'rgba(239,68,68,0.35)' : TOKENS.BORDER}`,
          }}
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : null}
          {connected} connected{missingRequired > 0 ? ` · ${missingRequired} missing` : ''}
        </span>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {integrations.map((i) => {
          const ok = i.status === 'connected';
          const err = i.status === 'error' || (i.required && i.status !== 'connected');
          const statusColor = ok ? '#7bb77b' : err ? TOKENS.DANGER : TOKENS.MUTED;
          const statusLabel =
            i.status === 'connected' ? 'Connected'
              : i.status === 'error' ? 'Error'
              : i.required ? 'Missing'
              : 'Optional';
          return (
            <div
              key={i.id}
              className="flex items-center gap-2 p-2.5 rounded-md"
              style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
              data-testid={`integration-${i.id}`}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{
                  background: ok ? 'rgba(34,197,94,0.12)' : TOKENS.ORANGE_SOFT,
                  border: `1px solid ${ok ? 'rgba(34,197,94,0.35)' : TOKENS.ORANGE_RING}`,
                }}
              >
                <Plug size={12} style={{ color: ok ? '#7bb77b' : TOKENS.ORANGE_GLOW }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate flex items-center gap-1" style={{ color: TOKENS.TEXT }}>
                  {i.name}
                  {i.docs && (
                    <a
                      href={i.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-60 hover:opacity-100"
                      style={{ color: TOKENS.MUTED }}
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <div className="text-[10.5px] flex items-center gap-1" style={{ color: statusColor }}>
                  {ok && <Check size={10} />}
                  {err && <AlertCircle size={10} />}
                  {statusLabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
