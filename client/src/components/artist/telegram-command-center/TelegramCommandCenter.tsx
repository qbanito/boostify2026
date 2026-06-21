import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Sparkles, Users, Megaphone, Radio, UsersRound, Ticket, ShoppingBag,
  CalendarCheck, Gift, Wallet, BarChart3, ChevronDown, Send, ShieldAlert,
} from 'lucide-react';
import { useTelegramCenter } from '../../../hooks/use-telegram-center';
import { StatusDot } from './shared';
import { ConnectBot } from './ConnectBot';
import { AICommandConsole } from './AICommandConsole';
import { FanCommunity } from './FanCommunity';
import { CampaignSender } from './CampaignSender';
import { ChannelManager } from './ChannelManager';
import { GroupManager } from './GroupManager';
import { TicketMessenger } from './TicketMessenger';
import { MerchMessenger } from './MerchMessenger';
import { BookingAssistant } from './BookingAssistant';
import { LiveGiftsPanel } from './LiveGiftsPanel';
import { BTFWalletMessenger } from './BTFWalletMessenger';
import { TelegramAnalytics } from './TelegramAnalytics';

interface Props {
  artistId: string;
  artistName: string;
  artistImageUrl?: string | null;
}

const TABS = [
  { key: 'connect', label: 'Connect Bot', icon: Bot },
  { key: 'ai', label: 'AI Console', icon: Sparkles },
  { key: 'fans', label: 'Fans', icon: Users },
  { key: 'campaigns', label: 'Campañas', icon: Megaphone },
  { key: 'channels', label: 'Canales', icon: Radio },
  { key: 'groups', label: 'Grupos VIP', icon: UsersRound },
  { key: 'tickets', label: 'Tickets', icon: Ticket },
  { key: 'merch', label: 'Merch', icon: ShoppingBag },
  { key: 'booking', label: 'Booking', icon: CalendarCheck },
  { key: 'gifts', label: 'Live Gifts', icon: Gift },
  { key: 'wallet', label: 'BTF Wallet', icon: Wallet },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/**
 * Telegram Artist Command Center — premium dark, glassmorphism dashboard that
 * turns a Telegram bot into the artist's operational channel: bot connection,
 * AI commands, fans, campaigns, channels, VIP groups, tickets, merch, booking,
 * live gifts, wallet and analytics. Owner-only; mounted inside the Artist Profile.
 */
export function TelegramCommandCenter({ artistId, artistName, artistImageUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('connect');
  const center = useTelegramCenter({ artistId, artistName });

  return (
    <section id="telegram-command-center" className="scroll-mt-24">
      <div className="overflow-hidden rounded-3xl border border-sky-500/15 bg-gradient-to-b from-[#0a1018] to-[#070a0d] shadow-[0_20px_80px_rgba(34,158,217,0.10)]">
        {/* Header */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 p-5 text-left"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_0_24px_rgba(34,158,217,0.5)]">
            <Send className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-white">Telegram Command Center</h2>
              <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                Premium
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-white/55">
              <StatusDot connected={center.isConnected} />
              {center.isConnected ? (center.botUsername ? `@${center.botUsername}` : 'Conectado') : 'Desconectado'}
              {center.simulated && <span className="text-amber-300/70">· simulación</span>}
            </div>
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }}>
            <ChevronDown className="h-5 w-5 text-white/50" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              {/* Tab bar */}
              <div className="flex gap-1.5 overflow-x-auto border-y border-white/5 px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                      tab === key
                        ? 'bg-sky-500/15 text-sky-200'
                        : 'text-white/55 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 border-b border-white/5 bg-sky-400/[0.04] px-5 py-2.5 text-[11px] text-sky-200/70">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Conecta tu bot oficial de Telegram (token de @BotFather). Úsalo para concierge, canales,
                  grupos VIP y automatizaciones con consentimiento — nunca para spam. Respeta los límites de la Bot API.
                </span>
              </div>

              {/* Panel */}
              <div className="p-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {tab === 'connect' && <ConnectBot center={center} />}
                    {tab === 'ai' && <AICommandConsole center={center} />}
                    {tab === 'fans' && <FanCommunity center={center} />}
                    {tab === 'campaigns' && <CampaignSender center={center} />}
                    {tab === 'channels' && <ChannelManager center={center} />}
                    {tab === 'groups' && <GroupManager center={center} />}
                    {tab === 'tickets' && <TicketMessenger center={center} />}
                    {tab === 'merch' && <MerchMessenger center={center} />}
                    {tab === 'booking' && <BookingAssistant center={center} />}
                    {tab === 'gifts' && <LiveGiftsPanel center={center} />}
                    {tab === 'wallet' && <BTFWalletMessenger center={center} />}
                    {tab === 'analytics' && <TelegramAnalytics center={center} />}
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

export default TelegramCommandCenter;
