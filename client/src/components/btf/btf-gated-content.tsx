/**
 * BTFGatedContent — Wrapper that hides content unless user meets BTF requirements
 * 
 * Gate Types:
 *   'holder'  — Just needs to hold any BTF
 *   'balance' — Needs minimum BTF balance
 *   'tier'    — Needs minimum staking tier
 * 
 * Usage:
 *   <BTFGatedContent gate="vip">
 *     <ExclusiveContent />
 *   </BTFGatedContent>
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Shield, Flame, Wallet, Crown, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';
import { useBTFToken } from '@/hooks/use-btf-token';
import { useWeb3 } from '@/hooks/use-web3';
import {
  CONTENT_GATES,
  passesGate,
  type ContentGate,
} from '@/lib/btf-service-pricing';
import { STAKING_TIERS, BTF_TOKEN_ADDRESS, type StakingTier } from '@/lib/btf-token-config';

interface BTFGatedContentProps {
  /** Named gate preset ('basic', 'premium', 'vip', 'exclusive', 'platinum') */
  gate?: string;
  /** Or provide a custom gate directly */
  customGate?: ContentGate;
  /** Content to show when unlocked */
  children: React.ReactNode;
  /** Optional label override for the locked state */
  lockedLabel?: string;
  /** If true, shows a blurred teaser instead of the lock card */
  blurPreview?: boolean;
  /** Custom fallback content when locked */
  fallback?: React.ReactNode;
  className?: string;
}

export function BTFGatedContent({
  gate = 'basic',
  customGate,
  children,
  lockedLabel,
  blurPreview = false,
  fallback,
  className = '',
}: BTFGatedContentProps) {
  const { balance, userDashboard } = useBTFToken();
  const { isConnected } = useWeb3();

  const gateConfig = customGate || CONTENT_GATES[gate] || CONTENT_GATES.basic;
  const userBalance = parseFloat(balance) || 0;
  const userTier: StakingTier = userDashboard?.tier || 'None';
  const hasAccess = isConnected && passesGate(gateConfig, userBalance, userTier);

  // Unlocked — render children directly
  if (hasAccess) {
    return <>{children}</>;
  }

  // Custom fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // Blur preview mode
  if (blurPreview) {
    return (
      <div className={`relative ${className}`}>
        <div className="blur-md pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
          <GateLockCard gate={gateConfig} label={lockedLabel} compact />
        </div>
      </div>
    );
  }

  // Full lock card
  return (
    <div className={className}>
      <GateLockCard gate={gateConfig} label={lockedLabel} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  GateLockCard — Visual lock indicator
// ═══════════════════════════════════════════════════════

function GateLockCard({
  gate,
  label,
  compact = false,
}: {
  gate: ContentGate;
  label?: string;
  compact?: boolean;
}) {
  const { isConnected } = useWeb3();

  const displayLabel = label || gate.label;
  const Icon = gate.type === 'tier' ? Crown : gate.type === 'balance' ? Flame : Shield;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-2 p-4"
      >
        <Lock className="w-8 h-8 text-purple-400 mx-auto" />
        <p className="text-sm font-semibold text-white">{displayLabel}</p>
        {!isConnected ? (
          <p className="text-xs text-gray-400">Connect wallet to unlock</p>
        ) : (
          <UnlockActions gate={gate} compact />
        )}
      </motion.div>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-black/80 to-purple-900/20 border-purple-500/20 p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        {/* Lock Animation */}
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-purple-400" />
          </div>
        </motion.div>

        {/* Label */}
        <div>
          <h3 className="font-bold text-lg text-white flex items-center justify-center gap-2">
            <Icon className="w-5 h-5 text-purple-400" />
            {displayLabel}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {getGateDescription(gate)}
          </p>
        </div>

        {/* Actions */}
        {!isConnected ? (
          <div className="text-center">
            <Wallet className="w-5 h-5 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Connect your wallet to access this content</p>
          </div>
        ) : (
          <UnlockActions gate={gate} />
        )}
      </motion.div>
    </Card>
  );
}

function UnlockActions({ gate, compact = false }: { gate: ContentGate; compact?: boolean }) {
  const size = compact ? 'sm' : 'default';

  switch (gate.type) {
    case 'holder':
      return (
        <div className="flex flex-col gap-2">
          <Link href="/boostiswap">
            <Button size={size} className="w-full bg-purple-600 hover:bg-purple-700">
              <Flame className="w-4 h-4 mr-1" /> Buy BTF Token
            </Button>
          </Link>
        </div>
      );
    case 'balance':
      return (
        <div className="flex flex-col gap-2">
          <Link href="/boostiswap">
            <Button size={size} className="w-full bg-purple-600 hover:bg-purple-700">
              <Flame className="w-4 h-4 mr-1" /> Buy {gate.minBalance}+ BTF
            </Button>
          </Link>
        </div>
      );
    case 'tier':
      return (
        <div className="flex flex-col gap-2">
          <Link href="/btf-wallet">
            <Button size={size} className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
              <Shield className="w-4 h-4 mr-1" />
              Stake for {gate.minTier} Tier
            </Button>
          </Link>
          <p className="text-xs text-gray-500 text-center">
            Requires {STAKING_TIERS[gate.minTier || 'Bronze'].threshold} BTF staked
          </p>
        </div>
      );
    default:
      return null;
  }
}

function getGateDescription(gate: ContentGate): string {
  switch (gate.type) {
    case 'holder':
      return 'You need to hold BTF tokens to unlock this exclusive content.';
    case 'balance':
      return `You need at least ${gate.minBalance} BTF in your wallet to access this.`;
    case 'tier':
      return `This content is exclusive to ${gate.minTier} tier stakers and above.`;
    default:
      return 'Unlock this content with BTF tokens.';
  }
}

// ═══════════════════════════════════════════════════════
//  Quick Gate Badges (for listing items)
// ═══════════════════════════════════════════════════════

interface GateBadgeProps {
  gate: string;
  className?: string;
}

export function GateBadge({ gate, className = '' }: GateBadgeProps) {
  const config = CONTENT_GATES[gate];
  if (!config) return null;

  const colors: Record<string, string> = {
    basic: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    premium: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    vip: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    exclusive: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    platinum: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30',
  };

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold border px-1.5 py-0.5 rounded-full ${colors[gate] || colors.basic} ${className}`}>
      <Lock className="w-2.5 h-2.5" /> {config.label}
    </span>
  );
}
