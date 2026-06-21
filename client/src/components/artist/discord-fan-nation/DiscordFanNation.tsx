import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Hash, ShieldCheck, Crown, Users, Megaphone, CalendarPlus,
  Radio, Gift, Coins, ShieldAlert, BarChart3, Bot, ChevronDown,
} from 'lucide-react';
import { useDiscordNation } from '../../../hooks/use-discord-nation';
import { StatusDot } from './shared';
import ConnectDiscord from './ConnectDiscord';
import ServerManager from './ServerManager';
import RoleManager from './RoleManager';
import VIPAccess from './VIPAccess';
import FanCommunity from './FanCommunity';
import CampaignSender from './CampaignSender';
import EventManager from './EventManager';
import LiveChatPanel from './LiveChatPanel';
import RewardsCenter from './RewardsCenter';
import BTFTokenGate from './BTFTokenGate';
import ConciergeAI from './ConciergeAI';
import ModerationAI from './ModerationAI';
import DiscordAnalytics from './DiscordAnalytics';

interface Props {
  artistId: string;
  artistName: string;
  artistImageUrl?: string | null;
}

const TABS = [
  { key: 'connect', label: 'Conectar', icon: ShieldCheck },
  { key: 'server', label: 'Servidor', icon: Hash },
  { key: 'roles', label: 'Roles', icon: ShieldCheck },
  { key: 'vip', label: 'VIP', icon: Crown },
  { key: 'community', label: 'Comunidad', icon: Users },
  { key: 'campaigns', label: 'Campañas', icon: Megaphone },
  { key: 'events', label: 'Eventos', icon: CalendarPlus },
  { key: 'live', label: 'Live Chat', icon: Radio },
  { key: 'rewards', label: 'Recompensas', icon: Gift },
  { key: 'tokengate', label: 'Token Gate', icon: Coins },
  { key: 'concierge', label: 'AI Concierge', icon: Bot },
  { key: 'moderation', label: 'AI Moderator', icon: ShieldAlert },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/**
 * Discord Fan Nation — premium blurple-themed community hub mounted inside the
 * Artist Profile (owner-only). Connect a Discord server via OAuth2 + bot, run the
 * setup wizard, manage roles, gate VIP access with $BTF, run campaigns & events,
 * reward top fans, moderate with AI and answer fans with an AI concierge. The bot
 * token lives server-side only; every action is rate-limited and audit-logged.
 */
export function DiscordFanNation({ artistId, artistName }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('connect');
  const dc = useDiscordNation({ artistId, artistName });

  return (
    <section id="discord-fan-nation" className="scroll-mt-24">
      <div className="overflow-hidden rounded-3xl border border-[#5865F2]/20 bg-gradient-to-b from-[#0d0e1a] to-[#070710] shadow-[0_20px_80px_rgba(88,101,242,0.12)]">
        {/* Header */}
        <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-5 text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5865F2] to-[#7b3fe4] text-white shadow-[0_0_24px_rgba(88,101,242,0.5)]">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-white">Discord Fan Nation</h2>
              <span className="rounded-full border border-[#5865F2]/30 bg-[#5865F2]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a5adfb]">Premium</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-white/55">
              <StatusDot active={dc.connected} />
              {dc.connected
                ? `${dc.guild?.guildName || 'Servidor'} · ${dc.memberTotal ?? dc.members.length} miembros`
                : 'Sin conectar'}
              {dc.simulated && <span className="text-amber-300/70">· simulación</span>}
            </div>
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }}><ChevronDown className="h-5 w-5 text-white/50" /></motion.div>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
              {/* Tab bar */}
              <div className="flex gap-1.5 overflow-x-auto border-y border-white/5 px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setTab(key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                      tab === key ? 'bg-[#5865F2]/15 text-[#a5adfb]' : 'text-white/55 hover:bg-white/5 hover:text-white'
                    }`}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 border-b border-white/5 bg-[#5865F2]/[0.04] px-5 py-2.5 text-[11px] text-[#a5adfb]/70">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Conexión segura vía OAuth2 — el token del bot vive solo en el servidor, nunca en tu navegador. Boostify cumple la Discord Developer Policy: sin spam automático, permisos mínimos, rate-limit y registro de auditoría en cada acción.
                </span>
              </div>

              {/* Panel */}
              <div className="p-5">
                <AnimatePresence mode="wait">
                  <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    {tab === 'connect' && <ConnectDiscord dc={dc} />}
                    {tab === 'server' && <ServerManager dc={dc} />}
                    {tab === 'roles' && <RoleManager dc={dc} />}
                    {tab === 'vip' && <VIPAccess dc={dc} />}
                    {tab === 'community' && <FanCommunity dc={dc} />}
                    {tab === 'campaigns' && <CampaignSender dc={dc} />}
                    {tab === 'events' && <EventManager dc={dc} />}
                    {tab === 'live' && <LiveChatPanel dc={dc} />}
                    {tab === 'rewards' && <RewardsCenter dc={dc} />}
                    {tab === 'tokengate' && <BTFTokenGate dc={dc} />}
                    {tab === 'concierge' && <ConciergeAI dc={dc} />}
                    {tab === 'moderation' && <ModerationAI dc={dc} />}
                    {tab === 'analytics' && <DiscordAnalytics dc={dc} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

export default DiscordFanNation;
