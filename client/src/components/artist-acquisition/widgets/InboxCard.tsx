import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Inbox,
  Mail,
  MousePointerClick,
  Link2,
  UserPlus,
  Sparkles,
  CreditCard,
  Share2,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { SectionCard } from '../shared/SectionCard';
import { Modal } from '../shared/Modal';
import { TOKENS } from '../shared/tokens';
import { apiRequest } from '../../../lib/queryClient';

interface InboxItem {
  id: string;
  kind: 'message' | 'event';
  type: string;
  provider?: string;
  name?: string | null;
  email?: string | null;
  to?: string | null;
  subject?: string | null;
  preview?: string | null;
  text?: string | null;
  html?: string | null;
  country?: string | null;
  score?: number | null;
  time: string;
  createdAt: string;
}

interface InboxResponse {
  ok: boolean;
  items?: InboxItem[];
  messages?: InboxItem[];
  events?: InboxItem[];
  counts?: { messages: number; events: number; total: number };
  providers?: {
    brevo?: boolean;
    resend?: boolean;
    brevoWebhook?: string;
    brevoInbound?: string;
    resendWebhook?: string;
    resendInbound?: string;
  };
}

const TYPE_ICON: Record<string, any> = {
  email_replied: MessageSquare,
  email_opened: Mail,
  email_clicked: MousePointerClick,
  email_delivered: Mail,
  email_soft_bounce: AlertCircle,
  magic_link_clicked: Link2,
  account_created: UserPlus,
  upgrade_clicked: Sparkles,
  upgrade_completed: CreditCard,
  referral_sent: Share2,
};

const TYPE_LABEL: Record<string, string> = {
  email_replied: 'Reply',
  email_opened: 'Email opened',
  email_clicked: 'Email clicked',
  email_delivered: 'Email delivered',
  email_soft_bounce: 'Soft bounce',
  magic_link_clicked: 'Magic link',
  account_created: 'Account created',
  upgrade_clicked: 'Upgrade clicked',
  upgrade_completed: 'Upgrade completed',
  referral_sent: 'Referral sent',
};

type Tab = 'all' | 'messages' | 'events';

export function InboxCard() {
  const [tab, setTab] = useState<Tab>('all');
  const [open, setOpen] = useState<InboxItem | null>(null);

  const { data, isLoading } = useQuery<InboxResponse>({
    queryKey: ['aas-inbox', tab],
    queryFn: () =>
      apiRequest('GET', `/api/admin/artist-acquisition/inbox?filter=${tab}`) as any,
    refetchInterval: 20000,
  });

  const items = data?.items || [];
  const counts = data?.counts || { messages: 0, events: 0, total: 0 };
  const providers = data?.providers || {};

  return (
    <>
      <SectionCard
        title="Inbox"
        action={
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              title={`Brevo ${providers.brevo ? 'connected' : 'not configured'}`}
              style={{
                color: providers.brevo ? '#7bb77b' : TOKENS.MUTED,
                background: TOKENS.SURFACE_3,
                border: `1px solid ${TOKENS.BORDER}`,
              }}
            >
              Brevo {providers.brevo ? '●' : '○'}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              title={`Resend ${providers.resend ? 'connected' : 'not configured'}`}
              style={{
                color: providers.resend ? '#7bb77b' : TOKENS.MUTED,
                background: TOKENS.SURFACE_3,
                border: `1px solid ${TOKENS.BORDER}`,
              }}
            >
              Resend {providers.resend ? '●' : '○'}
            </span>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ color: TOKENS.MUTED, background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
            >
              {counts.total}
            </span>
          </div>
        }
        bodyClassName="!py-3"
      >
        <div className="flex items-center gap-1 mb-2">
          {(['all', 'messages', 'events'] as Tab[]).map((t) => {
            const active = tab === t;
            const count = t === 'all' ? counts.total : t === 'messages' ? counts.messages : counts.events;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="text-[10.5px] px-2 py-0.5 rounded-full transition-colors"
                style={{
                  color: active ? TOKENS.ORANGE_GLOW : TOKENS.MUTED,
                  background: active ? TOKENS.ORANGE_SOFT : TOKENS.SURFACE_3,
                  border: `1px solid ${active ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
                }}
              >
                {t === 'all' ? 'All' : t === 'messages' ? `Messages (${count})` : `Events (${count})`}
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="text-[11.5px]" style={{ color: TOKENS.MUTED }}>
            Loading inbox…
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-center" style={{ color: TOKENS.MUTED }}>
            <Inbox size={20} />
            <div className="text-[11.5px]">
              No {tab === 'messages' ? 'replies' : tab === 'events' ? 'events' : 'items'} yet.
            </div>
            {tab !== 'events' && !providers.brevo && !providers.resend && (
              <div className="text-[10.5px]" style={{ color: TOKENS.MUTED_2 }}>
                Configure BREVO_API_KEY or RESEND_API_KEY to start receiving replies.
              </div>
            )}
          </div>
        )}

        <div className="space-y-1 max-h-[360px] overflow-y-auto custom-scroll pr-1">
          {items.map((e) => {
            const Icon = TYPE_ICON[e.type] || Inbox;
            const isMsg = e.kind === 'message';
            return (
              <button
                key={e.id}
                onClick={() => isMsg && setOpen(e)}
                disabled={!isMsg}
                className="w-full text-left flex items-start gap-2.5 p-2 rounded-md transition-colors hover:bg-white/[0.03] disabled:cursor-default"
                style={{ border: `1px solid ${TOKENS.BORDER}`, background: TOKENS.SURFACE_3 }}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: isMsg ? TOKENS.ORANGE_SOFT : TOKENS.SURFACE_2,
                    border: `1px solid ${isMsg ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
                  }}
                >
                  <Icon size={12} style={{ color: isMsg ? TOKENS.ORANGE_GLOW : TOKENS.MUTED }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold" style={{ color: TOKENS.TEXT }}>
                      {isMsg ? (e.name || e.email) : TYPE_LABEL[e.type] || e.type}
                    </span>
                    {isMsg && e.provider && (
                      <span
                        className="text-[9.5px] font-mono px-1.5 rounded-full uppercase"
                        style={{ color: TOKENS.MUTED, background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}` }}
                      >
                        {e.provider}
                      </span>
                    )}
                    {!isMsg && typeof e.score === 'number' && (
                      <span
                        className="text-[10px] font-mono px-1.5 rounded-full"
                        style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
                      >
                        {e.score}
                      </span>
                    )}
                  </div>
                  {isMsg ? (
                    <>
                      <div className="text-[11.5px] font-medium truncate mt-0.5" style={{ color: TOKENS.TEXT }}>
                        {e.subject}
                      </div>
                      <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: TOKENS.MUTED }}>
                        {e.preview}
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] truncate mt-0.5" style={{ color: TOKENS.MUTED }}>
                      {e.name || e.email || '—'}
                      {e.country ? ` • ${e.country}` : ''}
                    </div>
                  )}
                  <div className="text-[10px] mt-0.5" style={{ color: TOKENS.MUTED_2 }}>
                    {e.time}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {open && (
        <Modal open={!!open} onClose={() => setOpen(null)} title={open.subject || '(no subject)'} size="lg">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: TOKENS.BORDER }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
              >
                <MessageSquare size={13} style={{ color: TOKENS.ORANGE_GLOW }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold" style={{ color: TOKENS.TEXT }}>
                  {open.name || open.email}
                </div>
                <div className="text-[11px]" style={{ color: TOKENS.MUTED }}>
                  {open.email}
                  {open.to ? ` → ${open.to}` : ''}
                </div>
              </div>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-full uppercase"
                style={{ color: TOKENS.MUTED, background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
              >
                {open.provider}
              </span>
            </div>
            <div className="text-[10.5px]" style={{ color: TOKENS.MUTED_2 }}>
              Received {open.time}
            </div>
            {open.html ? (
              <div
                className="text-[12.5px] leading-relaxed rounded-md p-3 max-h-[400px] overflow-y-auto custom-scroll"
                style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.TEXT }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(open.html) }}
              />
            ) : (
              <pre
                className="text-[12.5px] leading-relaxed rounded-md p-3 max-h-[400px] overflow-y-auto custom-scroll whitespace-pre-wrap"
                style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.TEXT, fontFamily: 'inherit' }}
              >
                {open.text || open.preview || '(empty body)'}
              </pre>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

// Minimal HTML sanitizer — strips script/style tags and event handlers.
// For production-grade sanitization, swap to DOMPurify.
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

