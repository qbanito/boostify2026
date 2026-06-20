/**
 * CEX TRADING PANEL — Funding Rate Arbitrage & Multi-Exchange Module
 *
 * Features:
 *  • Per-artist exchange API key management (Bybit / OKX / Kraken / Bitget)
 *  • Live funding rate scanner across all supported exchanges
 *  • Active arbitrage positions with P&L tracking
 *  • Testnet ↔ Mainnet switch
 *  • Full info/guide modal with risk disclosure
 *
 * ⚠️ All exchanges listed are NOT banned in the USA and accept US traders.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Shield, TrendingUp, AlertTriangle, Info, Plus, Trash2,
  CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink,
  ChevronDown, ChevronUp, Eye, EyeOff, Power,
  BookOpen, X, ArrowUpRight, ArrowDownRight, Zap,
  Activity, DollarSign
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';

// ─── Types ────────────────────────────────────────────────────────────────

interface Exchange {
  id: string;
  name: string;
  website: string;
  hasFunding: boolean;
  hasPerps: boolean;
  sandboxSupported: boolean;
  usaAvailable: boolean;
  setupGuideUrl: string;
}

interface ExchangeKeyConfig {
  id: number;
  exchangeId: string;
  label: string | null;
  isTestnet: boolean;
  permissions: string[];
  isActive: boolean;
  lastVerifiedAt: string | null;
  createdAt: string;
}

interface FundingRateResult {
  exchangeId: string;
  symbol: string;
  baseSymbol: string;
  fundingRate: number;
  intervalHours: number;
  annualizedRate: number;
  annualizedRatePct: number;
  direction: 'positive' | 'negative';
  nextFundingTime: number | null;
  scannedAt: string;
}

interface ArbitrageOpportunity {
  type: string;
  exchangeId: string;
  symbol: string;
  baseSymbol: string;
  grossApr: number;
  grossAprPct: number;
  netAprPct: number;
  requiredCapitalUsd: number;
  direction: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface FundingPosition {
  id: number;
  exchangeId: string;
  symbol: string;
  spotSymbol: string;
  spotSizeUsd: string;
  entryFundingRate: string;
  currentFundingRate: string;
  accumulatedFundingUsd: string;
  estimatedApr: string;
  netPnlUsd: string;
  status: 'open' | 'closed' | 'error';
  isTestnet: boolean;
  openedAt: string;
  closedAt: string | null;
  closeReason: string | null;
}

// ─── Exchange logo colors ─────────────────────────────────────────────────

const EXCHANGE_COLORS: Record<string, string> = {
  bybit: '#F7A600',
  okx: '#121212',
  kraken: '#5741D9',
  bitget: '#00F0FF',
};

const EXCHANGE_LOGOS: Record<string, string> = {
  bybit: 'B',
  okx: 'O',
  kraken: 'K',
  bitget: 'BG',
};

// ─── Risk color helpers ────────────────────────────────────────────────────

const RISK_COLORS = {
  low: 'text-green-400 bg-green-400/10 border-green-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  high: 'text-red-400 bg-red-400/10 border-red-400/20',
};

// ─── Info / Guide Modal ────────────────────────────────────────────────────

function CexInfoModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'setup' | 'strategies' | 'risks'>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'setup', label: 'Setup', icon: Key },
    { id: 'strategies', label: 'Strategies', icon: TrendingUp },
    { id: 'risks', label: 'Risk Disclosure', icon: AlertTriangle },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0d0d14] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-base sm:text-lg truncate">CEX Trading Module</h2>
              <p className="text-white/40 text-xs truncate">Funding Rate Arbitrage & Multi-Exchange</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4 text-sm text-white/70">
          {tab === 'overview' && (
            <>
              <h3 className="text-white font-semibold text-base">What is the CEX Trading Module?</h3>
              <p>
                The CEX Trading Module connects your Boostify Economic Engine to centralized exchanges (CEX) via
                CCXT — a professional multi-exchange trading library used by institutions worldwide.
              </p>
              <p>
                The module currently implements <strong className="text-white">Funding Rate Arbitrage</strong> (Phase 1),
                a delta-neutral strategy that earns passive income from perpetual futures funding payments
                without taking directional market risk.
              </p>

              <h3 className="text-white font-semibold mt-4">Supported Exchanges (available in the USA)</h3>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  { name: 'Bybit', desc: 'Derivatives leader. Best funding rate data.', color: '#F7A600' },
                  { name: 'OKX', desc: 'OKX US available. Deep perpetuals liquidity.', color: '#ffffff' },
                  { name: 'Kraken Pro', desc: 'Most compliant US exchange. Registered MSB.', color: '#5741D9' },
                  { name: 'Bitget', desc: 'Competitive funding rates. US accessible.', color: '#00F0FF' },
                ].map((ex) => (
                  <div key={ex.name} className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="font-semibold text-white text-sm" style={{ color: ex.color }}>{ex.name}</div>
                    <div className="text-white/50 text-xs mt-1">{ex.desc}</div>
                  </div>
                ))}
              </div>

              <h3 className="text-white font-semibold mt-4">How Funding Rate Arbitrage Works</h3>
              <ol className="list-decimal list-inside space-y-2">
                <li>The scanner monitors funding rates on BTC, ETH, SOL and other top pairs every 5 minutes.</li>
                <li>When rates exceed 15% APR, an opportunity is flagged.</li>
                <li>The agent simultaneously buys spot AND shorts the perpetual (same size).</li>
                <li>Every 8 hours, the short position RECEIVES funding payments from longs.</li>
                <li>The spot hedge neutralizes price risk — profits are purely from funding.</li>
                <li>Auto-close when: rate drops below 5% APR, stop-loss at −3%, or after 7 days.</li>
              </ol>
            </>
          )}

          {tab === 'setup' && (
            <>
              <h3 className="text-white font-semibold text-base">Setting Up Your Exchange Connection</h3>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <p className="text-blue-300 font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Always start with Testnet mode enabled
                </p>
                <p className="mt-1 text-white/60 text-xs">
                  Test all connections in sandbox mode before switching to live trading.
                  The testnet toggle is per exchange key.
                </p>
              </div>

              <h3 className="text-white font-semibold mt-4">Step-by-step: Bybit API Setup</h3>
              <ol className="list-decimal list-inside space-y-2">
                <li>Go to <strong className="text-white">bybit.com → Account → API Management</strong></li>
                <li>Click <strong className="text-white">"Create New Key"</strong></li>
                <li>Set permissions: <strong className="text-white">Read + Trade</strong> (never Withdraw)</li>
                <li>Copy the API Key and Secret</li>
                <li>Paste them here and click <strong className="text-white">Save & Verify</strong></li>
              </ol>

              <h3 className="text-white font-semibold mt-4">Step-by-step: OKX API Setup</h3>
              <ol className="list-decimal list-inside space-y-2">
                <li>Go to <strong className="text-white">okx.com → Profile → API</strong></li>
                <li>Create API key with <strong className="text-white">Trade</strong> permission only</li>
                <li>OKX requires a <strong className="text-white">Passphrase</strong> — enter it in the Passphrase field</li>
                <li>Enable the API for <strong className="text-white">Unified Account</strong></li>
              </ol>

              <h3 className="text-white font-semibold mt-4">Security Notes</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Keys are encrypted with AES-256-GCM before storage</li>
                <li>Never grant Withdrawal permissions to trading API keys</li>
                <li>Enable IP whitelist on the exchange if possible</li>
                <li>Each artist's keys are completely isolated from other artists</li>
              </ul>
            </>
          )}

          {tab === 'strategies' && (
            <>
              <h3 className="text-white font-semibold text-base">Phase 1 — Funding Rate Arbitrage (Active)</h3>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <p className="text-green-400 font-medium text-sm">Currently implemented and available</p>
              </div>
              <p className="mt-2">
                Delta-neutral strategy. Long spot + short perpetual. Earns funding payments every 8h.
                Historical average APR: <strong className="text-white">20–80%</strong> during normal markets.
              </p>

              <h3 className="text-white font-semibold mt-4">Phase 2 — Cross-Exchange Funding (Coming)</h3>
              <p>
                Compare funding rates across multiple exchanges. Long perp on exchange with lowest rate,
                short perp on exchange with highest rate. Captures the spread.
                Example: Bybit +0.12% vs Kraken +0.01% = net 0.11% per period.
              </p>

              <h3 className="text-white font-semibold mt-4">Phase 3 — Basis Trading (Coming)</h3>
              <p>
                Long spot + short quarterly futures. Captures the premium (basis) that converges to zero
                at expiration. Lower returns than funding arb but more predictable.
              </p>

              <h3 className="text-white font-semibold mt-4">Phase 4 — DEX/CEX Arbitrage (Coming)</h3>
              <p>
                Compares prices between Uniswap/1inch (on-chain) and CEX orderbooks.
                When price discrepancy exceeds fees + gas, executes on both venues simultaneously.
              </p>
            </>
          )}

          {tab === 'risks' && (
            <>
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                <h3 className="text-red-400 font-bold flex items-center gap-2 text-base">
                  <AlertTriangle className="w-5 h-5" /> RISK DISCLOSURE — READ CAREFULLY
                </h3>
                <p className="mt-2 text-white/70">
                  Trading perpetual futures and managing exchange connections involves significant financial risk.
                  You may lose some or all of the capital deployed.
                </p>
              </div>

              <h3 className="text-white font-semibold mt-4">Key Risks</h3>
              <div className="space-y-3">
                {[
                  {
                    title: 'Funding Rate Flip Risk',
                    desc: 'Funding rates can reverse rapidly during market stress. When rates turn negative, your SHORT perp pays funding instead of receiving it, creating losses.',
                    severity: 'HIGH',
                  },
                  {
                    title: 'Liquidation Risk',
                    desc: 'If the price moves significantly against your short perpetual position, you risk liquidation. The spot hedge offsets this but is not perfect.',
                    severity: 'HIGH',
                  },
                  {
                    title: 'Exchange Risk',
                    desc: 'Exchange insolvency, trading halts, regulatory actions, or API failures may prevent you from closing positions at the desired time.',
                    severity: 'MEDIUM',
                  },
                  {
                    title: 'Slippage & Fees',
                    desc: 'Large positions may receive worse fills than the scanner detected. All fees (maker/taker) eat into profitability.',
                    severity: 'MEDIUM',
                  },
                  {
                    title: 'Smart Contract Risk',
                    desc: 'For DEX/CEX arbitrage (Phase 4), on-chain execution carries smart contract and bridge risks.',
                    severity: 'MEDIUM',
                  },
                  {
                    title: 'Regulatory Risk',
                    desc: 'Crypto regulations change. Perpetual futures trading restrictions may apply in your jurisdiction.',
                    severity: 'MEDIUM',
                  },
                ].map((r) => (
                  <div key={r.title} className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium text-sm">{r.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.severity === 'HIGH' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>{r.severity}</span>
                    </div>
                    <p className="text-white/50 text-xs mt-1">{r.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-2">
                <p className="text-white/60 text-xs">
                  <strong className="text-white">Disclaimer:</strong> Boostify is a music technology platform.
                  This module is provided as an optional economic optimization tool for artists.
                  Boostify is NOT a registered investment adviser, broker-dealer, or financial institution.
                  Nothing here constitutes financial advice. Trade only with capital you can afford to lose.
                  All trading is performed on your own exchange accounts under your sole responsibility.
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Add Exchange Key Form ─────────────────────────────────────────────────

function AddKeyForm({
  exchanges,
  onSave,
  onCancel,
}: {
  exchanges: Exchange[];
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    exchangeId: 'bybit',
    label: '',
    apiKey: '',
    apiSecret: '',
    passphrase: '',
    isTestnet: true,
  });
  const [showSecret, setShowSecret] = useState(false);

  const selectedExchange = exchanges.find((e) => e.id === form.exchangeId);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Add Exchange Connection</h3>
        <button onClick={onCancel} className="text-white/40 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Testnet / Mainnet switch */}
      <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
        <div className="flex-1">
          <div className="text-white font-medium text-sm">
            {form.isTestnet ? 'Testnet Mode (safe)' : 'Mainnet (LIVE TRADING)'}
          </div>
          <div className="text-white/40 text-xs mt-0.5">
            {form.isTestnet
              ? 'No real money. Test your connection first.'
              : 'Real funds will be used. Trade at your own risk.'}
          </div>
        </div>
        <button
          onClick={() => setForm((f) => ({ ...f, isTestnet: !f.isTestnet }))}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            form.isTestnet ? 'bg-blue-500' : 'bg-red-500'
          }`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            form.isTestnet ? 'left-1' : 'left-7'
          }`} />
        </button>
      </div>

      {!form.isTestnet && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs">
            <strong>Live mode enabled.</strong> Orders will execute with real money on your exchange account.
            Ensure you understand the risks before proceeding.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Exchange selector */}
        <div className="col-span-2">
          <label className="text-white/50 text-xs mb-1.5 block">Exchange</label>
          <select
            value={form.exchangeId}
            onChange={(e) => setForm((f) => ({ ...f, exchangeId: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-400/50"
          >
            {exchanges.map((ex) => (
              <option key={ex.id} value={ex.id} className="bg-[#0d0d14]">{ex.name}</option>
            ))}
          </select>
        </div>

        {selectedExchange && (
          <div className="col-span-2 flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/10">
            <span className="text-white/50 text-xs">Setup guide</span>
            <a
              href={selectedExchange.setupGuideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 text-xs flex items-center gap-1 hover:text-blue-300"
            >
              {selectedExchange.name} API Docs <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        <div>
          <label className="text-white/50 text-xs mb-1.5 block">Label (optional)</label>
          <input
            type="text"
            placeholder="e.g. Main Account"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-400/50"
          />
        </div>

        <div>
          <label className="text-white/50 text-xs mb-1.5 block">API Key</label>
          <input
            type="text"
            placeholder="Your API Key"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-400/50 font-mono text-xs"
          />
        </div>

        <div className="col-span-2">
          <label className="text-white/50 text-xs mb-1.5 block">API Secret</label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              placeholder="Your API Secret"
              value={form.apiSecret}
              onChange={(e) => setForm((f) => ({ ...f, apiSecret: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-400/50 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {form.exchangeId === 'okx' && (
          <div className="col-span-2">
            <label className="text-white/50 text-xs mb-1.5 block">Passphrase (OKX — required)</label>
            <input
              type="password"
              placeholder="The passphrase you set when creating the OKX API key"
              value={form.passphrase}
              onChange={(e) => setForm((f) => ({ ...f, passphrase: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-400/50 font-mono text-xs"
            />
            <p className="text-white/30 text-[11px] mt-1.5">
              OKX needs all three: API Key, Secret Key and the Passphrase you chose when generating the key.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:border-white/20 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={!form.apiKey || !form.apiSecret || (form.exchangeId === 'okx' && !form.passphrase)}
          className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Save & Encrypt
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Panel Component ─────────────────────────────────────────────────

interface CexTradingPanelProps {
  artistId: number;
  colors?: { hexAccent?: string };
}

export function CexTradingPanel({ artistId, colors }: CexTradingPanelProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const accent = colors?.hexAccent ?? '#3B82F6';

  const [showInfo, setShowInfo] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'exchanges' | 'scanner' | 'positions'>('exchanges');

  // ── Queries ──
  const { data: exchangesData } = useQuery<{ exchanges: Exchange[] }>({
    queryKey: ['cex-exchanges'],
    queryFn: () => apiRequest({ url: '/api/cex/exchanges', method: 'GET' }),
    staleTime: Infinity,
  });

  const { data: keysData, isLoading: keysLoading } = useQuery<{ configs: ExchangeKeyConfig[] }>({
    queryKey: ['cex-keys', artistId],
    queryFn: () => apiRequest({ url: '/api/cex/keys', method: 'GET' }),
  });

  const { data: ratesData, isLoading: ratesLoading } = useQuery<{ results: FundingRateResult[]; scannedAt: string }>({
    queryKey: ['cex-funding-rates'],
    queryFn: () => apiRequest({ url: '/api/cex/funding-rates', method: 'GET' }),
    refetchInterval: 60000, // refresh every 60s
  });

  const { data: oppsData } = useQuery<{ opportunities: ArbitrageOpportunity[] }>({
    queryKey: ['cex-opportunities'],
    queryFn: () => apiRequest({ url: '/api/cex/opportunities', method: 'GET' }),
    refetchInterval: 60000,
  });

  const { data: positionsData, isLoading: positionsLoading } = useQuery<{ positions: FundingPosition[] }>({
    queryKey: ['cex-positions', artistId],
    queryFn: () => apiRequest({ url: '/api/cex/positions', method: 'GET' }),
    refetchInterval: 30000,
  });

  const { data: engineStatus } = useQuery<{ cexTradingEnabled: boolean }>({
    queryKey: ['cex-engine-status', artistId],
    queryFn: () => apiRequest({ url: '/api/cex/engine-status', method: 'GET' }),
    refetchInterval: 30000,
  });

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest({ url: '/api/cex/keys', method: 'POST', data }),
    onSuccess: () => {
      toast({ title: 'Keys saved', description: 'API keys encrypted and stored successfully.' });
      qc.invalidateQueries({ queryKey: ['cex-keys'] });
      setShowAddForm(false);
    },
    onError: (err: any) => {
      toast({ title: 'Save failed', description: err?.message, variant: 'destructive' });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (keyId: number) => apiRequest({ url: `/api/cex/keys/${keyId}/verify`, method: 'POST' }),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: 'Connection verified', description: `Balance: ${data.usdtBalance?.toFixed(2) ?? 0} USDT` });
      } else {
        toast({ title: 'Verification failed', description: data.errorMessage, variant: 'destructive' });
      }
      qc.invalidateQueries({ queryKey: ['cex-keys'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (keyId: number) => apiRequest({ url: `/api/cex/keys/${keyId}`, method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Exchange removed' });
      qc.invalidateQueries({ queryKey: ['cex-keys'] });
    },
  });

  const closePositionMutation = useMutation({
    mutationFn: (posId: number) => apiRequest({ url: `/api/cex/positions/${posId}/close`, method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'Position close initiated' });
      qc.invalidateQueries({ queryKey: ['cex-positions'] });
    },
    onError: (err: any) => {
      toast({ title: 'Close failed', description: err?.message, variant: 'destructive' });
    },
  });

  const toggleEngineMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest({ url: '/api/cex/toggle-engine', method: 'POST', data: { enabled } }),
    onSuccess: (_, enabled) => {
      toast({
        title: enabled ? 'Auto-Arb Enabled' : 'Auto-Arb Disabled',
        description: enabled
          ? 'Funding rate arbitrage cycle will run with the economic engine.'
          : 'Auto-arb cycle paused. Existing positions are unaffected.',
      });
      qc.invalidateQueries({ queryKey: ['cex-engine-status'] });
    },
    onError: (err: any) => {
      toast({ title: 'Toggle failed', description: err?.message, variant: 'destructive' });
    },
  });

  const exchanges = exchangesData?.exchanges ?? [];
  const keys = keysData?.configs ?? [];
  const rates = ratesData?.results ?? [];
  const opportunities = oppsData?.opportunities ?? [];
  const positions = positionsData?.positions ?? [];
  const autoArbEnabled = engineStatus?.cexTradingEnabled ?? false;

  const openPositions = positions.filter((p) => p.status === 'open');
  const closedPositions = positions.filter((p) => p.status !== 'open');

  const tabs = [
    { id: 'exchanges', label: 'Exchanges', count: keys.length },
    { id: 'scanner', label: 'Scanner', count: opportunities.length },
    { id: 'positions', label: 'Positions', count: openPositions.length },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <TrendingUp className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold">CEX Trading Engine</h2>
            <p className="text-white/40 text-xs">Funding Rate Arbitrage · Multi-Exchange</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-Arb Engine toggle */}
          <button
            onClick={() => toggleEngineMutation.mutate(!autoArbEnabled)}
            disabled={toggleEngineMutation.isPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              autoArbEnabled
                ? 'border-green-400/40 bg-green-400/10 text-green-400 hover:bg-green-400/20'
                : 'border-white/15 bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10'
            }`}
          >
            {toggleEngineMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Power className="w-3.5 h-3.5" />
            )}
            Auto-Arb {autoArbEnabled ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setShowInfo(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-400/30 bg-blue-400/10 text-blue-400 text-xs hover:bg-blue-400/20 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            Guide & Risks
          </button>
        </div>
      </div>

      {/* Risk Banner */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-amber-200/70 text-xs">
          <strong className="text-amber-300">Risk Reminder:</strong> Funding rate arbitrage involves
          real exchange accounts with real money. Rates can flip, liquidations can occur.
          Only deploy capital you can afford to lose. Read the full Risk Disclosure before enabling.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === t.id ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-white/40'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* ── EXCHANGES TAB ── */}
        {activeTab === 'exchanges' && (
          <motion.div
            key="exchanges"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-3"
          >
            {keysLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-8 text-white/30">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No exchange connections configured</p>
                <p className="text-xs mt-1">Add your first exchange to start earning funding rates</p>
              </div>
            ) : (
              keys.map((key) => {
                const ex = exchanges.find((e) => e.id === key.exchangeId);
                return (
                  <div
                    key={key.id}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: `${EXCHANGE_COLORS[key.exchangeId] ?? '#666'}22`,
                        color: EXCHANGE_COLORS[key.exchangeId] ?? '#666',
                        border: `1px solid ${EXCHANGE_COLORS[key.exchangeId] ?? '#666'}33`,
                      }}
                    >
                      {EXCHANGE_LOGOS[key.exchangeId] ?? key.exchangeId.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{ex?.name ?? key.exchangeId}</span>
                        {key.label && <span className="text-white/40 text-xs">· {key.label}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          key.isTestnet
                            ? 'bg-blue-500/10 text-blue-400 border-blue-400/20'
                            : 'bg-red-500/10 text-red-400 border-red-400/20'
                        }`}>
                          {key.isTestnet ? 'Testnet' : 'LIVE'}
                        </span>
                      </div>
                      <div className="text-white/40 text-xs mt-0.5">
                        {key.lastVerifiedAt
                          ? `Verified ${new Date(key.lastVerifiedAt).toLocaleDateString()}`
                          : 'Not verified yet'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => verifyMutation.mutate(key.id)}
                        disabled={verifyMutation.isPending}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:border-white/20 hover:text-white transition-colors"
                      >
                        {verifyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify'}
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(key.id)}
                        className="px-2 py-1.5 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {showAddForm ? (
              <AddKeyForm
                exchanges={exchanges}
                onSave={(data) => saveMutation.mutate(data)}
                onCancel={() => setShowAddForm(false)}
              />
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full py-3 rounded-xl border border-dashed border-white/20 text-white/40 text-sm hover:border-blue-400/40 hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Exchange Connection
              </button>
            )}
          </motion.div>
        )}

        {/* ── SCANNER TAB ── */}
        {activeTab === 'scanner' && (
          <motion.div
            key="scanner"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-3"
          >
            {/* Top opportunities */}
            {opportunities.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-white/60 text-xs font-medium uppercase tracking-wider">
                  Top Opportunities
                </h3>
                {opportunities.slice(0, 5).map((opp, i) => (
                  <div
                    key={i}
                    className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{opp.baseSymbol}</span>
                        <span className="text-white/40 text-xs">{opp.exchangeId}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${RISK_COLORS[opp.riskLevel]}`}>
                          {opp.riskLevel}
                        </span>
                      </div>
                      <div className="text-white/40 text-xs mt-0.5">
                        {opp.direction === 'long_spot_short_perp' ? 'Long Spot + Short Perp' : 'Short Spot + Long Perp'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-green-400 font-bold text-sm">{opp.grossAprPct.toFixed(1)}%</div>
                      <div className="text-white/40 text-xs">APR gross</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* All rates table */}
            <div className="space-y-2">
              <h3 className="text-white/60 text-xs font-medium uppercase tracking-wider flex items-center justify-between">
                <span>All Funding Rates</span>
                {ratesData?.scannedAt && (
                  <span className="text-white/30 text-xs normal-case">
                    Updated {new Date(ratesData.scannedAt).toLocaleTimeString()}
                  </span>
                )}
              </h3>
              {ratesLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
                </div>
              ) : rates.length === 0 ? (
                <div className="text-center py-6 text-white/30 text-sm">
                  No scan data yet. The scanner runs every 5 minutes.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="text-left text-white/40 font-medium py-2.5 px-3">Symbol</th>
                        <th className="text-left text-white/40 font-medium py-2.5 px-3">Exchange</th>
                        <th className="text-right text-white/40 font-medium py-2.5 px-3">Rate</th>
                        <th className="text-right text-white/40 font-medium py-2.5 px-3">APR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rates.slice(0, 30).map((r, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 text-white font-medium">{r.baseSymbol}</td>
                          <td className="py-2 px-3 text-white/50">{r.exchangeId}</td>
                          <td className={`py-2 px-3 text-right font-mono ${
                            r.fundingRate >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {(r.fundingRate * 100).toFixed(4)}%
                          </td>
                          <td className={`py-2 px-3 text-right font-bold ${
                            Math.abs(r.annualizedRatePct) > 30
                              ? 'text-yellow-400'
                              : r.annualizedRatePct >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {r.annualizedRatePct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── POSITIONS TAB ── */}
        {activeTab === 'positions' && (
          <motion.div
            key="positions"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-3"
          >
            {positionsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
              </div>
            ) : positions.length === 0 ? (
              <div className="text-center py-8 text-white/30">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No positions yet</p>
                <p className="text-xs mt-1">Configure an exchange and the engine will find opportunities automatically</p>
              </div>
            ) : (
              <>
                {openPositions.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-white/60 text-xs font-medium uppercase tracking-wider">
                      Open Positions ({openPositions.length})
                    </h3>
                    {openPositions.map((pos) => {
                      const pnl = parseFloat(pos.netPnlUsd ?? '0');
                      const apr = parseFloat(pos.estimatedApr ?? '0');
                      return (
                        <div
                          key={pos.id}
                          className="bg-white/5 border border-white/10 rounded-xl p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-semibold text-sm">{pos.symbol.split('/')[0]}</span>
                              <span className="text-white/40 text-xs">{pos.exchangeId}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                                pos.isTestnet
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-400/20'
                                  : 'bg-red-500/10 text-red-400 border-red-400/20'
                              }`}>
                                {pos.isTestnet ? 'Test' : 'LIVE'}
                              </span>
                            </div>
                            <button
                              onClick={() => closePositionMutation.mutate(pos.id)}
                              disabled={closePositionMutation.isPending}
                              className="px-3 py-1 rounded-lg text-xs border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 transition-colors"
                            >
                              Close
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div>
                              <div className="text-white/40">Size</div>
                              <div className="text-white font-medium">${parseFloat(pos.spotSizeUsd).toFixed(0)}</div>
                            </div>
                            <div>
                              <div className="text-white/40">APR</div>
                              <div className="text-green-400 font-medium">{apr.toFixed(1)}%</div>
                            </div>
                            <div>
                              <div className="text-white/40">Funding</div>
                              <div className="text-white font-medium">${parseFloat(pos.accumulatedFundingUsd).toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-white/40">Net P&L</div>
                              <div className={pnl >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          <div className="text-white/30 text-xs mt-2">
                            Opened {new Date(pos.openedAt).toLocaleDateString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {closedPositions.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-white/60 text-xs font-medium uppercase tracking-wider">
                      History ({closedPositions.length})
                    </h3>
                    {closedPositions.slice(0, 10).map((pos) => {
                      const pnl = parseFloat(pos.netPnlUsd ?? '0');
                      return (
                        <div
                          key={pos.id}
                          className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center gap-3 opacity-60"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-white font-medium">{pos.symbol.split('/')[0]}</span>
                              <span className="text-white/40">{pos.exchangeId}</span>
                              <span className={`text-xs ${pos.status === 'error' ? 'text-red-400' : 'text-white/30'}`}>
                                {pos.status}
                              </span>
                            </div>
                            {pos.closeReason && (
                              <div className="text-white/30 text-xs mt-0.5">{pos.closeReason}</div>
                            )}
                          </div>
                          <div className={`text-sm font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && <CexInfoModal onClose={() => setShowInfo(false)} />}
      </AnimatePresence>
    </div>
  );
}
