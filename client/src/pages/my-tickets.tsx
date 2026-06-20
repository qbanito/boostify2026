// ─────────────────────────────────────────────────────────────────────────
// MyTicketsPage — Fan Ticket Wallet (Boostify Live Ticketing)
// ─────────────────────────────────────────────────────────────────────────
// A public, no-login wallet identified by email (consistent with the rest of
// the fan-facing ticket flow). A fan enters the email they bought with (or
// arrives via ?email= from a confirmation link) and sees every live ticket
// with its scannable QR, seat, and status — plus the option to securely
// transfer a ticket to someone else (which invalidates the old QR server-side).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-qr-code';
import { Ticket, Loader2, Search, Send, X, CheckCircle2, MapPin, Calendar } from 'lucide-react';
import { apiRequest } from '../lib/queryClient';
import { Header } from '../components/layout/header';

interface WalletPass {
  id: number;
  passCode: string;
  token: string;
  tierName?: string | null;
  seat?: string | null;
  status: 'valid' | 'checked_in';
  buyerName?: string | null;
  checkedInAt?: string | null;
}
interface WalletTicketGroup {
  eventId: number;
  title: string;
  startsAt?: string | null;
  venue?: string | null;
  location?: string | null;
  posterUrl?: string | null;
  artistSlug?: string | null;
  passes: WalletPass[];
}

function fmtDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MyTicketsPage() {
  const qc = useQueryClient();
  const [emailInput, setEmailInput] = useState('');
  const [activeEmail, setActiveEmail] = useState('');
  const [transferFor, setTransferFor] = useState<WalletPass | null>(null);

  // Prefill from ?email= (confirmation/transfer links) and auto-load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = (params.get('email') || '').trim();
    if (e) { setEmailInput(e); setActiveEmail(e.toLowerCase()); }
  }, []);

  const walletQ = useQuery({
    queryKey: ['fan-wallet', activeEmail],
    queryFn: async () => {
      const data: any = await apiRequest('GET', `/api/concerts/wallet?email=${encodeURIComponent(activeEmail)}`);
      return (data?.tickets || []) as WalletTicketGroup[];
    },
    enabled: !!activeEmail,
  });

  const tickets = walletQ.data || [];
  const totalPasses = useMemo(() => tickets.reduce((s, t) => s + t.passes.length, 0), [tickets]);

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const v = emailInput.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) setActiveEmail(v);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="container mx-auto px-4 py-10 pt-24 max-w-3xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl" style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
            <Ticket className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Tickets</h1>
            <p className="text-sm text-gray-400">Your Boostify ticket wallet — scan the QR at the door.</p>
          </div>
        </div>

        {/* Email lookup */}
        <form onSubmit={submitEmail} className="flex gap-2 mt-6 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter the email you bought with"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <button type="submit" className="px-5 py-2.5 rounded-lg text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
            View tickets
          </button>
        </form>

        {walletQ.isLoading && (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-purple-400" /></div>
        )}

        {activeEmail && !walletQ.isLoading && tickets.length === 0 && (
          <div className="text-center py-12 rounded-2xl border border-gray-800 bg-gray-900/40">
            <Ticket className="h-10 w-10 mx-auto text-gray-600 mb-3" />
            <p className="text-gray-300 font-medium">No tickets found for {activeEmail}</p>
            <p className="text-sm text-gray-500 mt-1">Make sure you use the exact email from your purchase.</p>
          </div>
        )}

        {tickets.length > 0 && (
          <p className="text-xs text-gray-500 mb-4">{totalPasses} ticket{totalPasses !== 1 ? 's' : ''} · {activeEmail}</p>
        )}

        <div className="space-y-6">
          {tickets.map((group) => (
            <div key={group.eventId} className="rounded-2xl border border-gray-800 overflow-hidden bg-gray-900/40">
              {group.posterUrl && (
                <img src={group.posterUrl} alt={group.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
                <h2 className="text-lg font-bold">{group.title}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
                  {group.startsAt && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmtDate(group.startsAt)}</span>}
                  {(group.venue || group.location) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[group.venue, group.location].filter(Boolean).join(' · ')}</span>}
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  {group.passes.map((p) => (
                    <div key={p.id} className="rounded-xl border border-gray-700 bg-black p-3 flex gap-3 items-center">
                      <div className="bg-white p-1.5 rounded-lg flex-shrink-0">
                        <QRCode value={p.token} size={84} style={{ height: 84, width: 84 }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{p.tierName || 'General'}</p>
                        {p.seat && <p className="text-xs text-purple-300">{p.seat}</p>}
                        <p className="text-[10px] text-gray-500 mt-0.5 font-mono truncate">{p.passCode}</p>
                        {p.status === 'checked_in' ? (
                          <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-emerald-400"><CheckCircle2 className="h-3 w-3" />Checked in</span>
                        ) : (
                          <button
                            onClick={() => setTransferFor(p)}
                            className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-pink-400 hover:text-pink-300"
                          >
                            <Send className="h-3 w-3" />Transfer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-[11px] text-gray-600 mt-8">
          Tickets are verified live at the door. Screenshots of an old or transferred QR will not be admitted.
        </p>
      </main>

      {transferFor && (
        <TransferModal
          pass={transferFor}
          fromEmail={activeEmail}
          onClose={() => setTransferFor(null)}
          onDone={() => { setTransferFor(null); qc.invalidateQueries({ queryKey: ['fan-wallet', activeEmail] }); }}
        />
      )}
    </div>
  );
}

function TransferModal({ pass, fromEmail, onClose, onDone }: { pass: WalletPass; fromEmail: string; onClose: () => void; onDone: () => void }) {
  const [toEmail, setToEmail] = useState('');
  const [toName, setToName] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const transferMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/concerts/transfer', {
      fromEmail, toEmail: toEmail.trim(), toName: toName.trim() || undefined, passCode: pass.passCode,
    }),
    onSuccess: () => { setDone(true); setTimeout(onDone, 1800); },
    onError: (e: any) => setError(e?.message || 'Transfer failed'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail.trim())) { setError('Enter a valid recipient email'); return; }
    if (toEmail.trim().toLowerCase() === fromEmail) { setError('Pick a different email than yours'); return; }
    transferMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-[#0f0f12] p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-bold">Transfer ticket</h3>
            <p className="text-xs text-gray-400">{pass.tierName || 'General'}{pass.seat ? ` · ${pass.seat}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-400 mb-2" />
            <p className="text-sm font-medium">Ticket transferred</p>
            <p className="text-xs text-gray-400 mt-1">The old QR is now invalid. {toEmail} received their ticket.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-[11px] text-gray-400">
              The recipient gets a brand-new QR. Your current ticket will stop working immediately — this can't be undone.
            </p>
            <input type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="Recipient email *"
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 text-sm" />
            <input type="text" value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Recipient name (optional)"
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 text-sm" />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="submit" disabled={transferMutation.isPending}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
              {transferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Transfer now
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
