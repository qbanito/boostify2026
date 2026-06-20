/**
 * VinylRecordsHub
 *
 * Unified "VINYL RECORDS" section combining:
 *  • Pre-Order Campaigns  (VinylPreorderModule)
 *  • Limited Edition Tokens (VinylEditionModule)
 *
 * Single beautiful tabbed container, fully in English.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Disc3, ShoppingCart, Gem, Radio, Sparkles } from "lucide-react";
import { VinylPreorderModule } from "./vinyl-preorder-module";
import { VinylEditionModule } from "./VinylEditionModule";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VinylRecordsHubProps {
  artist: any;
  colors?: {
    hexPrimary?: string;
    hexAccent?: string;
    hexBorder?: string;
    cardBg?: string;
    [key: string]: any;
  };
  isOwner?: boolean;
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  {
    id: "preorder" as const,
    label: "Pre-Order Campaigns",
    sublabel: "Fund your pressing",
    icon: ShoppingCart,
  },
  {
    id: "editions" as const,
    label: "Limited Editions",
    sublabel: "Numbered investment tokens",
    icon: Gem,
  },
];

// ─── Hub ──────────────────────────────────────────────────────────────────────

export function VinylRecordsHub({ artist, colors, isOwner }: VinylRecordsHubProps) {
  const [activeTab, setActiveTab] = useState<"preorder" | "editions">("preorder");

  const accent = colors?.hexAccent || "#7c3aed";
  const artistId = artist?.pgId ?? artist?.id;
  const artistName = artist?.artistName ?? artist?.name;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.015)",
        border: `1px solid ${accent}22`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: `0 0 40px ${accent}08, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* ─── Hero Header ─────────────────────────────────────────────────── */}
      <div
        className="relative px-6 py-5 flex items-center justify-between overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accent}14 0%, ${accent}05 40%, transparent 70%)`,
          borderBottom: `1px solid ${accent}1a`,
        }}
      >
        {/* Decorative glow orb */}
        <div
          className="absolute right-0 top-0 w-48 h-full opacity-10 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at right center, ${accent}, transparent 70%)`,
          }}
        />

        <div className="flex items-center gap-4 relative z-10">
          {/* Icon container */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${accent}25, ${accent}10)`,
              border: `1px solid ${accent}30`,
              boxShadow: `0 0 16px ${accent}20`,
            }}
          >
            <Disc3 className="w-5 h-5" style={{ color: accent }} />
          </div>

          <div>
            <h2
              className="text-base font-black uppercase tracking-[0.12em] text-white"
              style={{ textShadow: `0 0 20px ${accent}40` }}
            >
              Vinyl Records
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Pre-Order Campaigns · Limited Edition Tokens · Physical Collectibles
            </p>
          </div>
        </div>

        {/* Live badge */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold relative z-10"
          style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}25` }}
        >
          <Radio className="w-3 h-3 animate-pulse" />
          LIVE
        </div>
      </div>

      {/* ─── Tab Bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex"
        style={{ borderBottom: `1px solid ${accent}12` }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-3.5 px-4 transition-all duration-200"
              style={{
                color: active ? accent : "#52525b",
                background: active ? `${accent}08` : "transparent",
              }}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[12px] font-bold tracking-tight">{tab.label}</span>
              </div>
              <span className="text-[10px] opacity-70">{tab.sublabel}</span>
              {active && (
                <motion.div
                  layoutId="vinyl-hub-tab-underline"
                  className="absolute bottom-0 left-4 right-4 h-0.5 rounded-t-full"
                  style={{ background: accent }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Module Content ───────────────────────────────────────────────── */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {activeTab === "preorder" ? (
            <motion.div
              key="preorder-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <VinylPreorderModule artist={artist} colors={colors as any} isOwner={!!isOwner} />
            </motion.div>
          ) : (
            <motion.div
              key="editions-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="p-5"
            >
              <VinylEditionModule
                artistId={artistId}
                artistName={artistName}
                accentColor={accent}
                isOwner={!!isOwner}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-2 px-6 py-3 text-[10px] text-zinc-700"
        style={{ borderTop: `1px solid ${accent}10` }}
      >
        <Sparkles className="w-3 h-3 text-zinc-700" />
        Powered by Diggers Factory · AI Cover Art by FAL FLUX Pro · Payments via Stripe
      </div>
    </div>
  );
}

export default VinylRecordsHub;
