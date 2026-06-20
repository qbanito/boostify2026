import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Crown, Star, Trophy, Flame, Sparkles, Loader2, Share2, Users,
  MessageCircle, Send, Upload, Mail, Wand2, Trash2, Megaphone, ChevronDown, CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';

interface FanClubColors {
  hexPrimary?: string;
  hexAccent?: string;
  hexBorder?: string;
}

interface FanClubPanelProps {
  artistId: number;
  artistName: string;
  artistSlug?: string;
  colors?: FanClubColors;
  isOwner?: boolean;
}

interface FanMember {
  fanNumber: number;
  name: string | null;
  points: number;
  tier: string;
  tierLabel: string;
  streakDays: number;
  nextTier: { id: string; label: string; min: number; remaining: number } | null;
  joinedAt: string;
  rank: number | null;
}

interface LeaderboardEntry {
  rank: number;
  fanNumber: number;
  name: string;
  points: number;
  tier: string;
  tierLabel: string;
  streakDays: number;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const FALLBACK_PRIMARY = '#f97316';
const FALLBACK_ACCENT = '#f59e0b';

function normalizeHex(value: string | undefined, fallback: string) {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}
function hexToRgba(hex: string, alpha: number) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const TIER_META: Record<string, { icon: any; glow: string }> = {
  rookie: { icon: Star, glow: '#9ca3af' },
  bronze: { icon: Trophy, glow: '#d97706' },
  gold: { icon: Crown, glow: '#fbbf24' },
  backstage: { icon: Sparkles, glow: '#a855f7' },
};

export function FanClubPanel({ artistId, artistName, artistSlug, colors, isOwner }: FanClubPanelProps) {
  const primary = normalizeHex(colors?.hexPrimary, FALLBACK_PRIMARY);
  const accent = normalizeHex(colors?.hexAccent, FALLBACK_ACCENT);
  const border = colors?.hexBorder || hexToRgba(primary, 0.3);
  const qc = useQueryClient();

  const storageKey = `boostify_fanclub_email_${artistSlug || artistId}`;
  const [email, setEmail] = useState<string>(() => {
    try { return localStorage.getItem(storageKey) || ''; } catch { return ''; }
  });
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // ── AI chat with the artist's social-network agent ──────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Membership of the current visitor (if they've joined before)
  const meQuery = useQuery<{ member: FanMember | null }>({
    queryKey: ['fan-club-me', artistId, email],
    queryFn: async () => {
      if (!email) return { member: null };
      return apiRequest('GET', `/api/fan-club/${artistId}/me?email=${encodeURIComponent(email)}`);
    },
    enabled: !!artistId,
  });

  // Public summary + leaderboard
  const summaryQuery = useQuery<{ totalMembers: number; leaderboard: LeaderboardEntry[] }>({
    queryKey: ['fan-club-summary', artistId],
    queryFn: async () => {
      return apiRequest('GET', `/api/fan-club/${artistId}/summary`);
    },
    enabled: !!artistId,
  });

  const member = meQuery.data?.member || null;
  const totalMembers = summaryQuery.data?.totalMembers ?? 0;
  const leaderboard = summaryQuery.data?.leaderboard ?? [];

  const joinMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/fan-club/${artistId}/join`, {
        email: formEmail.trim(),
        name: formName.trim() || undefined,
        artistSlug,
      });
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        const clean = formEmail.trim().toLowerCase();
        try { localStorage.setItem(storageKey, clean); } catch {}
        setEmail(clean);
        setToast(data.alreadyMember ? "You're already in the club!" : `Welcome, you're Fan #${data.member?.fanNumber}!`);
        qc.invalidateQueries({ queryKey: ['fan-club-me', artistId] });
        qc.invalidateQueries({ queryKey: ['fan-club-summary', artistId] });
      }
    },
    onError: () => setError('Could not join. Please try again.'),
  });

  const pointsMutation = useMutation({
    mutationFn: async (action: string) => {
      return apiRequest('POST', `/api/fan-club/${artistId}/points`, { email, action });
    },
    onSuccess: (data: any) => {
      if (data?.alreadyClaimed) setToast('Already claimed today ✓');
      else if (data?.awarded) setToast(`+${data.awarded} Boost Points 🔥`);
      qc.invalidateQueries({ queryKey: ['fan-club-me', artistId] });
      qc.invalidateQueries({ queryKey: ['fan-club-summary', artistId] });
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (text: string) => {
      const history = chatMessages.slice(-8);
      return apiRequest('POST', `/api/fan-club/${artistId}/chat`, {
        email: email || undefined,
        message: text,
        history,
      });
    },
    onSuccess: (data: any) => {
      const reply = typeof data?.reply === 'string' && data.reply.trim()
        ? data.reply.trim()
        : "I'm here — tell me more!";
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      if (data?.awarded) {
        setToast(`+${data.awarded} Boost Points for the chat 🔥`);
        qc.invalidateQueries({ queryKey: ['fan-club-me', artistId] });
        qc.invalidateQueries({ queryKey: ['fan-club-summary', artistId] });
      }
    },
    onError: () => {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't reply just now. Try again in a moment." },
      ]);
    },
  });

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatMutation.isPending) return;
    setChatMessages((prev) => [...prev, { role: 'user', content: text }]);
    setChatInput('');
    chatMutation.mutate(text);
  };

  // Keep the chat scrolled to the latest message.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, chatMutation.isPending]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formEmail.trim()) { setError('Email is required'); return; }
    joinMutation.mutate();
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) await navigator.share({ title: artistName, url });
      else await navigator.clipboard.writeText(url);
    } catch { /* user cancelled */ }
    if (member) pointsMutation.mutate('share');
  };

  const progressPct = useMemo(() => {
    if (!member) return 0;
    if (!member.nextTier) return 100;
    return Math.min(100, Math.round((member.points / member.nextTier.min) * 100));
  }, [member]);

  const cardBg = 'rgba(17,20,28,0.6)';

  return (
    <div className="space-y-5">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Owner-only CRM studio: import fan emails + send non-aggressive news campaigns */}
      {isOwner && (
        <FanCrmStudio
          artistId={artistId}
          artistName={artistName}
          primary={primary}
          accent={accent}
          border={border}
        />
      )}

      {!member ? (
        /* ── JOIN STATE ─────────────────────────────────────────── */
        <div
          className="rounded-2xl p-5 sm:p-7 border relative overflow-hidden"
          style={{
            borderColor: hexToRgba(primary, 0.35),
            background: `radial-gradient(circle at 20% 0%, ${hexToRgba(primary, 0.18)}, transparent 60%), ${cardBg}`,
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold mb-4"
            style={{ background: hexToRgba(accent, 0.18), color: accent }}
          >
            <Users className="w-3.5 h-3.5" /> {totalMembers} fans already in
          </div>
          <h3 className="text-2xl font-extrabold text-white leading-tight">
            Join {artistName}'s Fan Club
          </h3>
          <p className="text-sm text-gray-300 mt-2 max-w-md">
            Get your fan number, earn Boost Points and level up all the way to Backstage access.
            Be part of the artist's inner circle.
          </p>

          <div className="flex flex-wrap gap-3 mt-4">
            {[
              { icon: Heart, label: 'Your official fan number' },
              { icon: Flame, label: 'Boost Points for taking part' },
              { icon: Crown, label: 'Levels up to Backstage' },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-200">
                <b.icon className="w-4 h-4" style={{ color: primary }} /> {b.label}
              </div>
            ))}
          </div>

          <form onSubmit={handleJoin} className="mt-5 space-y-3 max-w-md">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/40 border text-white text-sm outline-none focus:ring-2"
              style={{ borderColor: border }}
            />
            <input
              type="email"
              placeholder="you@email.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/40 border text-white text-sm outline-none focus:ring-2"
              style={{ borderColor: border }}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={joinMutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
            >
              {joinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
              Join the Fan Club
            </button>
          </form>
        </div>
      ) : (
        /* ── MEMBER STATE ───────────────────────────────────────── */
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Fan card */}
          <div
            className="rounded-2xl p-5 sm:p-6 border relative overflow-hidden"
            style={{
              borderColor: hexToRgba(primary, 0.4),
              background: `radial-gradient(circle at 80% 0%, ${hexToRgba(accent, 0.2)}, transparent 55%), ${cardBg}`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">You are</p>
                <p className="text-3xl font-extrabold text-white">Fan #{member.fanNumber}</p>
                {member.name && <p className="text-sm text-gray-300 mt-0.5">{member.name}</p>}
              </div>
              <TierBadge tier={member.tier} label={member.tierLabel} primary={primary} accent={accent} />
            </div>

            {/* Points + rank */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              <Stat value={member.points} label="Boost Points" color={primary} />
              <Stat value={member.rank ? `#${member.rank}` : '—'} label="Rank" color={accent} />
              <Stat value={member.streakDays} label="Streak (days)" color="#f43f5e" />
            </div>

            {/* Progress to next tier */}
            {member.nextTier ? (
              <div className="mt-5">
                <div className="flex justify-between text-xs text-gray-300 mb-1.5">
                  <span>Next level: <b className="text-white">{member.nextTier.label}</b></span>
                  <span>{member.nextTier.remaining} pts to go</span>
                </div>
                <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-2 text-sm font-semibold" style={{ color: accent }}>
                <Crown className="w-4 h-4" /> Max Backstage level reached!
              </div>
            )}

            {/* Earn actions */}
            <div className="flex flex-wrap gap-2.5 mt-5">
              <button
                onClick={() => pointsMutation.mutate('checkin')}
                disabled={pointsMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border transition-transform active:scale-95 disabled:opacity-60"
                style={{ borderColor: hexToRgba(primary, 0.45), background: hexToRgba(primary, 0.14) }}
              >
                <Flame className="w-4 h-4" /> Daily check-in <span className="opacity-70">+20</span>
              </button>
              <button
                onClick={handleShare}
                disabled={pointsMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border transition-transform active:scale-95 disabled:opacity-60"
                style={{ borderColor: hexToRgba(accent, 0.45), background: hexToRgba(accent, 0.14) }}
              >
                <Share2 className="w-4 h-4" /> Share <span className="opacity-70">+15</span>
              </button>
            </div>
          </div>

          {/* Leaderboard */}
          <div
            className="rounded-2xl p-5 border"
            style={{ borderColor: border, background: cardBg }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5" style={{ color: accent }} />
              <h4 className="text-base font-bold text-white">Superfans</h4>
              <span className="ml-auto text-xs text-gray-400">{totalMembers} fans</span>
            </div>
            <div className="space-y-1.5">
              {leaderboard.length === 0 && (
                <p className="text-sm text-gray-400">No superfans yet. Be the first!</p>
              )}
              {leaderboard.map((f) => {
                const isMe = member && f.fanNumber === member.fanNumber;
                return (
                  <div
                    key={f.fanNumber}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{
                      background: isMe ? hexToRgba(primary, 0.16) : 'rgba(255,255,255,0.03)',
                      border: isMe ? `1px solid ${hexToRgba(primary, 0.4)}` : '1px solid transparent',
                    }}
                  >
                    <span
                      className="w-6 text-center text-sm font-bold"
                      style={{ color: f.rank <= 3 ? accent : '#9ca3af' }}
                    >
                      {f.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {f.name} {isMe && <span className="text-[10px]" style={{ color: primary }}>(you)</span>}
                      </p>
                      <p className="text-[11px] text-gray-400">Fan #{f.fanNumber} · {f.tierLabel}</p>
                    </div>
                    <span className="text-sm font-bold" style={{ color: primary }}>{f.points}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── AI CHAT WITH THE ARTIST ──────────────────────────────── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: hexToRgba(primary, 0.3), background: cardBg }}
      >
        <div
          className="flex items-center gap-2.5 px-5 py-3.5 border-b"
          style={{
            borderColor: hexToRgba(primary, 0.2),
            background: `linear-gradient(135deg, ${hexToRgba(primary, 0.16)}, transparent)`,
          }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
          >
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">Chat with {artistName}</p>
            <p className="text-[11px] text-gray-400 leading-tight">
              Talk live with the artist's AI · earn Boost Points
            </p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: accent }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} /> Online
          </span>
        </div>

        {/* Messages */}
        <div ref={chatScrollRef} className="px-4 py-4 space-y-3 max-h-72 overflow-y-auto">
          {chatMessages.length === 0 && (
            <div className="flex items-start gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div
                className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-gray-100 max-w-[85%]"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                Hey{member?.name ? ` ${member.name}` : ''}! I'm {artistName}. Ask me anything — about my music,
                what inspires me, or what's coming next. 🎶
              </div>
            </div>
          )}
          {chatMessages.map((m, i) =>
            m.role === 'assistant' ? (
              <div key={i} className="flex items-start gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div
                  className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-gray-100 max-w-[85%] whitespace-pre-wrap"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2.5 flex-row-reverse">
                <div
                  className="rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-white max-w-[85%] whitespace-pre-wrap"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
                >
                  {m.content}
                </div>
              </div>
            ),
          )}
          {chatMutation.isPending && (
            <div className="flex items-start gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div
                className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <TypingDot color={primary} />
                <TypingDot color={primary} delay={0.15} />
                <TypingDot color={primary} delay={0.3} />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSendChat}
          className="flex items-center gap-2 px-3 py-3 border-t"
          style={{ borderColor: hexToRgba(primary, 0.18) }}
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={`Message ${artistName}…`}
            maxLength={1000}
            className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border text-white text-sm outline-none focus:ring-2"
            style={{ borderColor: border }}
          />
          <button
            type="submit"
            disabled={chatMutation.isPending || !chatInput.trim()}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 transition-transform active:scale-95 disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
            aria-label="Send message"
          >
            {chatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        {!member && (
          <p className="px-4 pb-3 -mt-1 text-[11px] text-gray-400">
            Join the Fan Club to earn Boost Points every day you chat.
          </p>
        )}
      </div>
    </div>
  );
}

function TypingDot({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <motion.span
      className="w-1.5 h-1.5 rounded-full inline-block"
      style={{ background: color }}
      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
      transition={{ duration: 0.9, repeat: Infinity, delay }}
    />
  );
}

function Stat({ value, label, color }: { value: React.ReactNode; label: string; color: string }) {
  return (
    <div className="rounded-xl bg-black/30 px-3 py-2.5 text-center">
      <p className="text-xl font-extrabold" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function TierBadge({ tier, label, primary, accent }: { tier: string; label: string; primary: string; accent: string }) {
  const meta = TIER_META[tier] || TIER_META.rookie;
  const Icon = meta.icon;
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
      style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, boxShadow: `0 0 16px ${hexToRgba(meta.glow, 0.5)}` }}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </div>
  );
}

// ─── Owner CRM studio ────────────────────────────────────────────────────────
interface CrmAudience { contacts: number; subscribedContacts: number; members: number; reachable: number }
interface CrmContact { id: number; email: string; name: string | null; source: string; tags: string | null; subscribed: boolean; created_at: string; last_emailed_at: string | null }
interface CrmCampaign {
  id: number; name: string; subject: string; message: string; audience: string; tag: string | null;
  cta_url: string | null; cta_label: string | null; status: string;
  recipients_count: number; sent_count: number; failed_count: number; created_at: string; sent_at: string | null;
}

// Lightweight CSV parser → [{ email, name }]. Detects an email/name header row;
// otherwise treats the first column as email and second as name.
function parseFanCsv(text: string): { email: string; name?: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const splitRow = (row: string) => row.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
  const first = splitRow(lines[0]).map((c) => c.toLowerCase());
  let emailIdx = first.findIndex((c) => c === 'email' || c.includes('email') || c.includes('correo'));
  let nameIdx = first.findIndex((c) => c === 'name' || c.includes('name') || c.includes('nombre'));
  let startRow = 0;
  if (emailIdx >= 0 || nameIdx >= 0) {
    startRow = 1; // header detected
    if (emailIdx < 0) emailIdx = 0;
    if (nameIdx < 0) nameIdx = emailIdx === 0 ? 1 : 0;
  } else {
    emailIdx = 0; nameIdx = 1;
  }
  const out: { email: string; name?: string }[] = [];
  const seen = new Set<string>();
  for (let i = startRow; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    const email = (cells[emailIdx] || '').toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name: cells[nameIdx] || undefined });
  }
  return out;
}

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Everyone (fans + imported)' },
  { value: 'members', label: 'Fan Club members only' },
  { value: 'contacts', label: 'Imported contacts only' },
];

function FanCrmStudio({ artistId, artistName, primary, accent, border }: {
  artistId: number; artistName: string; primary: string; accent: string; border: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'audience' | 'campaigns'>('audience');
  const [note, setNote] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importTag, setImportTag] = useState('');
  const [importing, setImporting] = useState(false);

  // Campaign composer
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [ctaUrl, setCtaUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const flash = (ok: boolean, msg: string) => { setNote({ ok, msg }); setTimeout(() => setNote(null), 4000); };

  const audienceQ = useQuery<CrmAudience>({
    queryKey: ['fan-crm-audience', artistId],
    enabled: open,
    queryFn: () => apiRequest('GET', `/api/fan-club/${artistId}/crm/audience`),
    staleTime: 20000,
  });
  const contactsQ = useQuery<{ contacts: CrmContact[] }>({
    queryKey: ['fan-crm-contacts', artistId],
    enabled: open && tab === 'audience',
    queryFn: () => apiRequest('GET', `/api/fan-club/${artistId}/crm/contacts`),
    staleTime: 20000,
  });
  const campaignsQ = useQuery<{ campaigns: CrmCampaign[] }>({
    queryKey: ['fan-crm-campaigns', artistId],
    enabled: open && tab === 'campaigns',
    queryFn: () => apiRequest('GET', `/api/fan-club/${artistId}/crm/campaigns`),
    staleTime: 15000,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['fan-crm-audience', artistId] });
    qc.invalidateQueries({ queryKey: ['fan-crm-contacts', artistId] });
    qc.invalidateQueries({ queryKey: ['fan-crm-campaigns', artistId] });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) e.target.value = '';
    if (!file) return;
    setImporting(true);
    setNote(null);
    try {
      const text = await file.text();
      const contacts = parseFanCsv(text);
      if (contacts.length === 0) { flash(false, 'No valid email addresses found in that file.'); return; }
      const res = await apiRequest('POST', `/api/fan-club/${artistId}/crm/import`, { contacts, tags: importTag.trim() || undefined });
      flash(true, `Imported ${res.imported} new contact${res.imported === 1 ? '' : 's'}${res.skipped ? ` · ${res.skipped} skipped/duplicate` : ''}.`);
      refreshAll();
    } catch (err: any) {
      flash(false, err?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const deleteContact = async (id: number) => {
    try {
      await apiRequest('DELETE', `/api/fan-club/${artistId}/crm/contacts/${id}`);
      refreshAll();
    } catch { /* noop */ }
  };

  const aiDraft = async () => {
    setDrafting(true);
    setNote(null);
    try {
      const res = await apiRequest('POST', `/api/fan-club/${artistId}/crm/ai-draft`, { topic: aiTopic.trim() });
      if (res.subject) setSubject(res.subject);
      if (res.message) setMessage(res.message);
      if (!name.trim()) setName(aiTopic.trim() ? aiTopic.trim().slice(0, 60) : `News from ${artistName}`);
      flash(true, res.source === 'openai' ? 'Draft written by AI — review and tweak before sending.' : 'Draft ready (template) — add your details.');
    } catch (err: any) {
      flash(false, err?.message || 'Could not draft the email.');
    } finally {
      setDrafting(false);
    }
  };

  const saveDraft = async () => {
    if (!name.trim() || !subject.trim() || !message.trim()) { flash(false, 'Add a name, subject and message first.'); return; }
    setSavingDraft(true);
    try {
      await apiRequest('POST', `/api/fan-club/${artistId}/crm/campaigns`, {
        name: name.trim(), subject: subject.trim(), message: message.trim(), audience,
        ctaUrl: ctaUrl.trim() || undefined, ctaLabel: ctaLabel.trim() || undefined,
      });
      flash(true, 'Campaign saved as a draft.');
      setName(''); setSubject(''); setMessage(''); setCtaUrl(''); setCtaLabel(''); setAiTopic('');
      qc.invalidateQueries({ queryKey: ['fan-crm-campaigns', artistId] });
      setTab('campaigns');
    } catch (err: any) {
      flash(false, err?.message || 'Could not save the campaign.');
    } finally {
      setSavingDraft(false);
    }
  };

  const sendCampaign = async (c: CrmCampaign) => {
    if (sendingId) return;
    if (!window.confirm(`Send "${c.subject}" to your fans now? This emails everyone in the selected audience.`)) return;
    setSendingId(c.id);
    setNote(null);
    try {
      const res = await apiRequest('POST', `/api/fan-club/${artistId}/crm/campaigns/${c.id}/send`);
      flash(true, `Sent to ${res.sent} fan${res.sent === 1 ? '' : 's'}${res.failed ? ` · ${res.failed} failed` : ''}.`);
      refreshAll();
    } catch (err: any) {
      flash(false, err?.message || 'Send failed.');
    } finally {
      setSendingId(null);
    }
  };

  const deleteCampaign = async (id: number) => {
    try {
      await apiRequest('DELETE', `/api/fan-club/${artistId}/crm/campaigns/${id}`);
      qc.invalidateQueries({ queryKey: ['fan-crm-campaigns', artistId] });
    } catch { /* noop */ }
  };

  const a = audienceQ.data;
  const contacts = contactsQ.data?.contacts || [];
  const campaigns = campaignsQ.data?.campaigns || [];

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: hexToRgba(primary, 0.3), background: 'rgba(17,20,28,0.5)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: hexToRgba(primary, 0.18) }}>
            <Megaphone className="w-4 h-4" style={{ color: primary }} />
          </span>
          Fan CRM — import & news campaigns
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ background: hexToRgba(accent, 0.18), color: accent }}>Artist tools</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-xs text-gray-400 -mt-1">Bring your own fan email list and stay in touch with warm, non-aggressive news updates. Every email includes a one-click unsubscribe.</p>

          {note && (
            <div className={`text-xs rounded-lg px-3 py-2 ${note.ok ? 'text-emerald-300' : 'text-red-300'}`} style={{ background: note.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
              {note.msg}
            </div>
          )}

          {/* Audience stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <CrmStat label="Contacts" value={a?.contacts ?? '—'} primary={primary} />
            <CrmStat label="Subscribed" value={a?.subscribedContacts ?? '—'} primary={primary} />
            <CrmStat label="Club members" value={a?.members ?? '—'} primary={primary} />
            <CrmStat label="Reachable" value={a?.reachable ?? '—'} primary={accent} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)' }}>
            {([['audience', 'Audience'], ['campaigns', 'Campaigns']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={tab === id ? { background: `linear-gradient(135deg, ${primary}, ${accent})`, color: '#fff' } : { color: '#9ca3af' }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'audience' ? (
            <div className="space-y-3">
              {/* Import */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${hexToRgba(primary, 0.15)}` }}>
                <p className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" style={{ color: primary }} /> Import fan emails (CSV)</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={importTag}
                    onChange={(e) => setImportTag(e.target.value)}
                    placeholder="Optional tag (e.g. 2024-tour)"
                    className="flex-1 px-3 py-2 rounded-lg bg-black/40 border text-white text-xs outline-none"
                    style={{ borderColor: border }}
                  />
                  <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} className="hidden" />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={importing}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
                  >
                    {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {importing ? 'Importing…' : 'Choose CSV'}
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5">Accepts a column named "email" (and optional "name"), or a simple list of emails.</p>
              </div>

              {/* Contacts list */}
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5">Recent contacts {contacts.length ? `(${contacts.length})` : ''}</p>
                {contactsQ.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
                ) : contacts.length === 0 ? (
                  <div className="rounded-xl p-4 text-center text-xs text-gray-400" style={{ background: 'rgba(0,0,0,0.2)', border: `1px dashed ${hexToRgba(primary, 0.25)}` }}>
                    No imported contacts yet. Upload a CSV to build your list.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {contacts.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
                        <div className="min-w-0">
                          <p className="text-xs text-white truncate flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-gray-500 shrink-0" /> {c.email}
                            {!c.subscribed && <span className="text-[9px] text-red-400 uppercase">unsub</span>}
                          </p>
                          {(c.name || c.tags) && <p className="text-[10px] text-gray-500 truncate">{[c.name, c.tags].filter(Boolean).join(' · ')}</p>}
                        </div>
                        <button onClick={() => deleteContact(c.id)} className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-white/5 shrink-0" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Composer */}
              <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${hexToRgba(primary, 0.15)}` }}>
                <p className="text-xs font-semibold text-white flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" style={{ color: accent }} /> Compose a news update</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="What's the news? (e.g. new single out Friday)"
                    className="flex-1 px-3 py-2 rounded-lg bg-black/40 border text-white text-xs outline-none"
                    style={{ borderColor: border }}
                  />
                  <button
                    onClick={aiDraft}
                    disabled={drafting}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
                  >
                    {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    AI draft
                  </button>
                </div>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name (internal)" className="w-full px-3 py-2 rounded-lg bg-black/40 border text-white text-xs outline-none" style={{ borderColor: border }} />
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" className="w-full px-3 py-2 rounded-lg bg-black/40 border text-white text-xs outline-none" style={{ borderColor: border }} />
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message to fans…" rows={5} className="w-full px-3 py-2 rounded-lg bg-black/40 border text-white text-xs outline-none resize-none" style={{ borderColor: border }} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select value={audience} onChange={(e) => setAudience(e.target.value)} className="px-3 py-2 rounded-lg bg-black/40 border text-white text-xs outline-none" style={{ borderColor: border }}>
                    {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Button label (optional)" className="px-3 py-2 rounded-lg bg-black/40 border text-white text-xs outline-none" style={{ borderColor: border }} />
                  <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="Button link (optional)" className="px-3 py-2 rounded-lg bg-black/40 border text-white text-xs outline-none" style={{ borderColor: border }} />
                </div>
                <button
                  onClick={saveDraft}
                  disabled={savingDraft}
                  className="w-full py-2 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{ background: hexToRgba(primary, 0.25), border: `1px solid ${hexToRgba(primary, 0.4)}` }}
                >
                  {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save as draft
                </button>
              </div>

              {/* Campaign list */}
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5">Campaigns</p>
                {campaignsQ.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
                ) : campaigns.length === 0 ? (
                  <div className="rounded-xl p-4 text-center text-xs text-gray-400" style={{ background: 'rgba(0,0,0,0.2)', border: `1px dashed ${hexToRgba(primary, 0.25)}` }}>
                    No campaigns yet. Compose your first news update above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {campaigns.map((c) => (
                      <div key={c.id} className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${hexToRgba(primary, 0.12)}` }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{c.subject}</p>
                            <p className="text-[10px] text-gray-500">{c.name} · {c.audience} · {c.recipients_count} recipients</p>
                          </div>
                          <CampaignStatus status={c.status} sent={c.sent_count} failed={c.failed_count} accent={accent} />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1.5 line-clamp-2 whitespace-pre-wrap">{c.message}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {c.status !== 'sent' && c.status !== 'sending' && (
                            <button
                              onClick={() => sendCampaign(c)}
                              disabled={sendingId === c.id}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white flex items-center gap-1.5 disabled:opacity-60"
                              style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
                            >
                              {sendingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              {sendingId === c.id ? 'Sending…' : 'Send now'}
                            </button>
                          )}
                          {c.status === 'sent' && <span className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Sent to {c.sent_count}</span>}
                          <button onClick={() => deleteCampaign(c.id)} className="ml-auto p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-white/5" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CrmStat({ label, value, primary }: { label: string; value: React.ReactNode; primary: string }) {
  return (
    <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
      <p className="text-lg font-extrabold" style={{ color: primary }}>{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function CampaignStatus({ status, sent, failed, accent }: { status: string; sent: number; failed: number; accent: string }) {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: '#9ca3af' },
    sending: { label: 'Sending…', color: accent },
    sent: { label: 'Sent', color: '#34d399' },
    failed: { label: 'Failed', color: '#f87171' },
  };
  const m = map[status] || map.draft;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: hexToRgba(m.color, 0.15), color: m.color }}>
      {m.label}
    </span>
  );
}

export default FanClubPanel;
