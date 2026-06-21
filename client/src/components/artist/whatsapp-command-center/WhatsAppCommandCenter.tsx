import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone, Sparkles, Users, Megaphone, Ticket, ShoppingBag,
  CalendarCheck, Gift, Wallet, BarChart3, ChevronDown, MessageCircle, ShieldAlert,
} from 'lucide-react';
import { useWhatsAppCenter } from '../../../hooks/use-whatsapp-center';
import { StatusDot } from './shared';
import { ConnectNumber } from './ConnectNumber';
import { AICommandConsole } from './AICommandConsole';
import { FanMessenger } from './FanMessenger';
import { CampaignSender } from './CampaignSender';
import { TicketMessenger } from './TicketMessenger';
import { MerchMessenger } from './MerchMessenger';
import { BookingAssistant } from './BookingAssistant';
import { LiveGiftsPanel } from './LiveGiftsPanel';
import { BTFWalletMessenger } from './BTFWalletMessenger';
import { AnalyticsPanel } from './AnalyticsPanel';

interface Props {
  artistId: string;
  artistName: string;
  artistImageUrl?: string | null;
}

const TABS = [
  { key: 'connect', label: 'Connect', icon: Smartphone },
  { key: 'ai', label: 'AI Console', icon: Sparkles },
  { key: 'fans', label: 'Fans', icon: Users },
  { key: 'campaigns', label: 'Campañas', icon: Megaphone },
  { key: 'tickets', label: 'Tickets', icon: Ticket },
  { key: 'merch', label: 'Merch', icon: ShoppingBag },
  { key: 'booking', label: 'Booking', icon: CalendarCheck },
  { key: 'gifts', label: 'Live Gifts', icon: Gift },
  { key: 'wallet', label: 'BTF Wallet', icon: Wallet },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/**
 * WhatsApp Artist Command Center — premium dark, glassmorphism dashboard that
 * turns WhatsApp into the artist's operational channel: sessions, AI commands,
 * fans, campaigns, tickets, merch, booking, live gifts, wallet and analytics.
 * Owner-only; mounted inside the Artist Profile.
 */
export function WhatsAppCommandCenter({ artistId, artistName, artistImageUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('connect');
  const center = useWhatsAppCenter({ artistId, artistName });

  return (
    <section id="whatsapp-command-center" className="scroll-mt-24">
      <div className="overflow-hidden rounded-3xl border border-emerald-500/15 bg-gradient-to-b from-[#0a1410] to-[#070b0d] shadow-[0_20px_80px_rgba(16,185,129,0.08)]">
        {/* Header */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 p-5 text-left"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-black shadow-[0_0_24px_rgba(16,185,129,0.45)]">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-white">WhatsApp Command Center</h2>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                Premium
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-white/55">
              <StatusDot connected={center.isConnected} />
              {center.isConnected ? 'Conectado' : 'Desconectado'}
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
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : 'text-white/55 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 border-b border-white/5 bg-amber-400/[0.04] px-5 py-2.5 text-[11px] text-amber-200/70">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Powered by OpenWA (no oficial de Meta). Úsalo para soporte, concierge y automatizaciones
                  controladas — nunca para spam. Migración futura a WhatsApp Business Cloud API prevista.
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
                    {tab === 'connect' && <ConnectNumber center={center} />}
                    {tab === 'ai' && <AICommandConsole center={center} />}
                    {tab === 'fans' && <FanMessenger center={center} />}
                    {tab === 'campaigns' && <CampaignSender center={center} />}
                    {tab === 'tickets' && <TicketMessenger center={center} />}
                    {tab === 'merch' && <MerchMessenger center={center} />}
                    {tab === 'booking' && <BookingAssistant center={center} />}
                    {tab === 'gifts' && <LiveGiftsPanel center={center} />}
                    {tab === 'wallet' && <BTFWalletMessenger center={center} />}
                    {tab === 'analytics' && <AnalyticsPanel center={center} />}
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

export default WhatsAppCommandCenter;
