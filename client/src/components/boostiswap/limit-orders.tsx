/**
 * LimitOrders — Client-side DEX limit order system for BoostiSwap
 *
 * Orders are stored in localStorage, scoped per wallet address.
 * On-chain spot prices are polled every 30 s to detect executability.
 * Execution is always user-initiated (no silent auto-execution).
 *
 * Buy  limit: triggers when spot price (MATIC/token) ≤ limitPrice
 * Sell limit: triggers when spot price (MATIC/token) ≥ limitPrice
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useBTF2300, type PoolInfo } from "@/hooks/use-btf2300";
import { useArtistTokens, type ArtistToken } from "@/hooks/use-artist-tokens";
import { useWeb3 } from "@/hooks/use-web3";
import { useToast } from "@/hooks/use-toast";
import { TOKEN_PREFIXES } from "@/lib/btf2300-config";
import { formatEther } from "viem";
import {
  Clock, Zap, AlertTriangle, CheckCircle2, XCircle, Loader2,
  Trash2, Play, RefreshCw, TrendingUp, TrendingDown, Info,
  ExternalLink, Copy, Check,
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "boostiswap_limit_orders";

const EXPIRY_OPTIONS = [
  { label: "1 hour",   ms: 3_600_000   },
  { label: "6 hours",  ms: 21_600_000  },
  { label: "24 hours", ms: 86_400_000  },
  { label: "3 days",   ms: 259_200_000 },
  { label: "7 days",   ms: 604_800_000 },
] as const;

const SLIPPAGE_PRESETS = [0.5, 1, 3] as const;
const POLL_INTERVAL_MS = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus    = "pending" | "executable" | "executed" | "cancelled" | "expired";
type OrderDirection = "buy" | "sell";

interface LimitOrder {
  id:               string;
  ownerAddress:     string;        // lowercase wallet address
  direction:        OrderDirection;
  tokenId:          string;        // ArtistToken.id (numeric string)
  symbol:           string;
  artist:           string;
  image:            string;
  amount:           string;        // MATIC (buy) or integer token count (sell)
  limitPrice:       string;        // MATIC per token
  slippage:         number;
  expiry:           number;        // Unix ms — when the order expires
  status:           OrderStatus;
  createdAt:        number;        // Unix ms
  executedTxHash?:  string;
  spotAtCreation:   string;        // MATIC/token at time of placement
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadOrders(): LimitOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LimitOrder[];
  } catch {
    return [];
  }
}

function saveOrders(orders: LimitOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function spotFromPool(info: PoolInfo): number {
  const eth = parseFloat(formatEther(info.ethReserve));
  const tok = Number(info.tokenReserve);
  if (tok === 0) return 0;
  return eth / tok;
}

function fmtPrice(p: number): string {
  if (!p || p === 0) return "—";
  if (p < 0.000001) return p.toExponential(4);
  if (p < 0.0001)   return p.toFixed(8);
  if (p < 0.01)     return p.toFixed(6);
  return p.toFixed(4);
}

function fmtRemaining(expiry: number): string {
  const ms = expiry - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0)   return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Returns positive number = how far price must move to trigger (%). Negative = already executable. */
function distancePct(dir: OrderDirection, spot: number, limit: number): number {
  if (spot === 0 || limit === 0) return 0;
  return dir === "buy"
    ? ((spot - limit) / spot) * 100      // positive → price must fall
    : ((limit - spot) / spot) * 100;     // positive → price must rise
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<OrderStatus, { label: string; badge: string }> = {
  pending:    { label: "Pending",    badge: "bg-slate-700/60 text-gray-300 border-slate-600" },
  executable: { label: "Executable", badge: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  executed:   { label: "Executed",   badge: "bg-green-500/20 text-green-300 border-green-500/40" },
  cancelled:  { label: "Cancelled",  badge: "bg-red-500/10 text-red-400/70 border-red-500/20" },
  expired:    { label: "Expired",    badge: "bg-slate-700/30 text-gray-500 border-slate-600/30" },
};

// ─── Main component ───────────────────────────────────────────────────────────

export function LimitOrders() {
  const { toast }  = useToast();
  const { isConnected, address, balanceFormatted } = useWeb3();
  const btf2300    = useBTF2300();
  const artistTokens = useArtistTokens();

  // ── Form state ──
  const [formDir,        setFormDir]        = useState<OrderDirection>("buy");
  const [formTokenId,    setFormTokenId]    = useState("");
  const [formAmount,     setFormAmount]     = useState("");
  const [formLimitPrice, setFormLimitPrice] = useState("");
  const [formExpiry,     setFormExpiry]     = useState<number>(86_400_000);
  const [formSlippage,   setFormSlippage]   = useState<number>(0.5);
  const [formSpot,       setFormSpot]       = useState<number | null>(null);
  const [formHasPool,    setFormHasPool]    = useState(true);
  const [isLoadingSpot,  setIsLoadingSpot]  = useState(false);
  const [isPlacing,      setIsPlacing]      = useState(false);

  // ── Orders state ──
  const [orders,      setOrders]      = useState<LimitOrder[]>(() => loadOrders());
  const [spotPrices,  setSpotPrices]  = useState<Record<string, number>>({});
  const [orderTab,    setOrderTab]    = useState<"active" | "history">("active");
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [copiedId,    setCopiedId]    = useState<string | null>(null);
  const [isPolling,   setIsPolling]   = useState(false);

  // Keep a ref to latest orders for stable poll callback
  const latestOrders = useRef<LimitOrder[]>(orders);
  useEffect(() => { latestOrders.current = orders; }, [orders]);

  // ── Persist orders ──
  useEffect(() => { saveOrders(orders); }, [orders]);

  // ── Derived ──
  const formTokenData: ArtistToken | undefined = useMemo(
    () => artistTokens.find((t) => t.id === formTokenId),
    [artistTokens, formTokenId],
  );

  const myOrders = useMemo(() => {
    if (!address) return [];
    return orders.filter((o) => o.ownerAddress === address.toLowerCase());
  }, [orders, address]);

  const activeOrders  = useMemo(() => myOrders.filter((o) => o.status === "pending" || o.status === "executable"), [myOrders]);
  const historyOrders = useMemo(() => myOrders.filter((o) => o.status === "executed" || o.status === "cancelled" || o.status === "expired"), [myOrders]);

  const maticBalance = parseFloat(balanceFormatted ?? "0");

  // ── Immediate-execution warning ──
  const wouldExecuteNow = useMemo(() => {
    if (formSpot === null || !formLimitPrice) return false;
    const limit = parseFloat(formLimitPrice);
    if (isNaN(limit) || limit <= 0) return false;
    return formDir === "buy" ? formSpot <= limit : formSpot >= limit;
  }, [formDir, formSpot, formLimitPrice]);

  const insufficientBalance = useMemo(() => {
    if (!formAmount || formDir !== "buy") return false;
    const amt = parseFloat(formAmount);
    if (isNaN(amt)) return false;
    return amt > maticBalance;
  }, [formAmount, formDir, maticBalance]);

  // ── Fetch spot for the form token ──
  const handleTokenSelect = useCallback(async (tokenId: string) => {
    setFormTokenId(tokenId);
    setFormAmount("");
    setFormLimitPrice("");
    setFormSpot(null);
    setFormHasPool(true);
    if (!tokenId) return;

    setIsLoadingSpot(true);
    try {
      const poolId = TOKEN_PREFIXES.ARTIST + parseInt(tokenId, 10);
      const info   = await btf2300.getPoolInfo(poolId);
      if (info?.isActive) {
        const spot = spotFromPool(info);
        setFormSpot(spot);
        setFormHasPool(true);
        setFormLimitPrice(spot.toFixed(8));
      } else {
        setFormHasPool(false);
      }
    } catch {
      setFormHasPool(false);
    } finally {
      setIsLoadingSpot(false);
    }
  }, [btf2300]);

  // ── Toggle direction ──
  const handleDirToggle = useCallback((dir: OrderDirection) => {
    setFormDir(dir);
    setFormAmount("");
  }, []);

  // ── Quick price offsets (± from spot) ──
  const handleQuickPrice = useCallback((offsetPct: number) => {
    if (formSpot === null) return;
    const p = formSpot * (1 + offsetPct / 100);
    setFormLimitPrice(p.toFixed(8));
  }, [formSpot]);

  // ── Quick amount ──
  const handleQuickAmount = useCallback((fraction: number) => {
    if (formDir === "buy") {
      if (maticBalance > 0) setFormAmount((maticBalance * fraction).toFixed(4));
    }
  }, [formDir, maticBalance]);

  // ── Poll spot prices for all active orders ──
  const pollSpotPrices = useCallback(async () => {
    if (!address) return;
    const currentOrders = latestOrders.current;
    const activeList = currentOrders.filter(
      (o) =>
        (o.status === "pending" || o.status === "executable") &&
        o.ownerAddress === address.toLowerCase(),
    );
    if (activeList.length === 0) return;

    setIsPolling(true);
    const uniqueTokenIds = [...new Set(activeList.map((o) => o.tokenId))];
    const newPrices: Record<string, number> = {};

    await Promise.all(
      uniqueTokenIds.map(async (tokenId) => {
        try {
          const poolId = TOKEN_PREFIXES.ARTIST + parseInt(tokenId, 10);
          const info   = await btf2300.getPoolInfo(poolId);
          if (info?.isActive) newPrices[tokenId] = spotFromPool(info);
        } catch {
          // silent
        }
      }),
    );

    setIsPolling(false);

    if (Object.keys(newPrices).length === 0) return;

    setSpotPrices((prev) => ({ ...prev, ...newPrices }));

    const now = Date.now();
    setOrders((prev) =>
      prev.map((order) => {
        if (order.status !== "pending" && order.status !== "executable") return order;
        if (now >= order.expiry) return { ...order, status: "expired" as OrderStatus };

        const spot  = newPrices[order.tokenId];
        if (spot === undefined) return order;

        const limit       = parseFloat(order.limitPrice);
        const isTriggered = order.direction === "buy" ? spot <= limit : spot >= limit;

        if (isTriggered  && order.status !== "executable") return { ...order, status: "executable" as OrderStatus };
        if (!isTriggered && order.status === "executable") return { ...order, status: "pending"    as OrderStatus };
        return order;
      }),
    );
  }, [address, btf2300]);

  // ── Auto-poll interval ──
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    pollSpotPrices();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(pollSpotPrices, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollSpotPrices]);

  // ── Place order ──
  const handlePlaceOrder = useCallback(async () => {
    if (!isConnected || !address) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    if (!formTokenId || !formTokenData) {
      toast({ title: "Select a token", variant: "destructive" });
      return;
    }
    if (!formAmount || parseFloat(formAmount) <= 0) {
      toast({ title: "Enter an amount", variant: "destructive" });
      return;
    }
    if (!formLimitPrice || parseFloat(formLimitPrice) <= 0) {
      toast({ title: "Enter a limit price", variant: "destructive" });
      return;
    }
    if (!formHasPool) {
      toast({ title: "No liquidity pool", description: "This token has no active pool", variant: "destructive" });
      return;
    }

    const limit = parseFloat(formLimitPrice);
    const now   = Date.now();

    const newOrder: LimitOrder = {
      id:             `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      ownerAddress:   address.toLowerCase(),
      direction:      formDir,
      tokenId:        formTokenId,
      symbol:         formTokenData.symbol,
      artist:         formTokenData.artist,
      image:          formTokenData.image,
      amount:         formDir === "buy"
        ? parseFloat(formAmount).toFixed(6)
        : Math.floor(parseFloat(formAmount)).toString(),
      limitPrice:     limit.toFixed(8),
      slippage:       formSlippage,
      expiry:         now + formExpiry,
      status:         "pending",
      createdAt:      now,
      spotAtCreation: formSpot !== null ? formSpot.toFixed(8) : "0",
    };

    // If the price condition is already met, mark as executable immediately
    if (formSpot !== null) {
      const isTriggered = formDir === "buy" ? formSpot <= limit : formSpot >= limit;
      if (isTriggered) newOrder.status = "executable";
    }

    setIsPlacing(true);
    setOrders((prev) => [newOrder, ...prev]);

    toast({
      title: "✅ Limit order placed",
      description: `${formDir === "buy" ? "Buy" : "Sell"} ${formTokenData.symbol} @ ${fmtPrice(limit)} MATIC/token`,
    });

    setFormAmount("");
    setIsPlacing(false);

    // Trigger an immediate price poll so the order list updates
    pollSpotPrices();
  }, [
    isConnected, address, formDir, formTokenId, formTokenData, formAmount,
    formLimitPrice, formExpiry, formSlippage, formSpot, formHasPool,
    toast, pollSpotPrices,
  ]);

  // ── Execute order ──
  const executeOrder = useCallback(async (order: LimitOrder) => {
    if (!isConnected || !address) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    setExecutingId(order.id);
    const tokenId = TOKEN_PREFIXES.ARTIST + parseInt(order.tokenId, 10);

    try {
      let result: { hash: `0x${string}`; success: boolean } | null = null;

      if (order.direction === "buy") {
        const expectedTokens = await btf2300.getExpectedTokensOut(tokenId, order.amount);
        const minTokensOut   = Number(expectedTokens);
        result = await btf2300.buyTokensFromDEX(tokenId, order.amount, minTokensOut, order.slippage);
      } else {
        const tokenAmount = parseInt(order.amount, 10);
        const expectedEth = await btf2300.getExpectedEthOut(tokenId, tokenAmount);
        result = await btf2300.sellTokens(tokenId, tokenAmount, expectedEth, order.slippage);
      }

      if (result?.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? { ...o, status: "executed" as OrderStatus, executedTxHash: result!.hash }
              : o,
          ),
        );
      }
    } catch (err) {
      console.error("Execute limit order error:", err);
    } finally {
      setExecutingId(null);
    }
  }, [isConnected, address, btf2300, toast]);

  // ── Cancel order ──
  const cancelOrder = useCallback((orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: "cancelled" as OrderStatus } : o,
      ),
    );
    toast({ title: "Order cancelled" });
  }, [toast]);

  // ── Copy tx hash ──
  const copyTxHash = useCallback((txHash: string, orderId: string) => {
    navigator.clipboard.writeText(txHash).then(() => {
      setCopiedId(orderId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  // ── Render order row ──
  const renderOrder = (order: LimitOrder) => {
    const spot     = spotPrices[order.tokenId];
    const dist     = spot !== undefined ? distancePct(order.direction, spot, parseFloat(order.limitPrice)) : null;
    const isExec   = executingId === order.id;
    const cfg      = STATUS_CFG[order.status];
    const isActive = order.status === "pending" || order.status === "executable";

    return (
      <div
        key={order.id}
        className={`rounded-xl border p-3 sm:p-4 transition-colors ${
          order.status === "executable"
            ? "bg-orange-500/5 border-orange-500/30"
            : order.status === "executed"
            ? "bg-green-500/5 border-green-500/20"
            : "bg-slate-800/40 border-slate-700/40"
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Token image */}
          <img
            src={order.image}
            alt={order.symbol}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Row 1: symbol, direction, status, time */}
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="font-bold text-white text-sm">{order.symbol}/MATIC</span>

              <Badge className={`text-[10px] px-1.5 py-0 ${
                order.direction === "buy"
                  ? "bg-green-500/15 text-green-400 border-green-500/30"
                  : "bg-red-500/15 text-red-400 border-red-500/30"
              }`}>
                {order.direction.toUpperCase()}
              </Badge>

              <Badge className={`text-[10px] px-1.5 py-0 ${cfg.badge} flex items-center gap-1`}>
                {order.status === "executable" && <Zap className="h-2.5 w-2.5" />}
                {order.status === "executed"   && <CheckCircle2 className="h-2.5 w-2.5" />}
                {order.status === "expired"    && <Clock className="h-2.5 w-2.5" />}
                {cfg.label}
              </Badge>

              {isActive && (
                <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {fmtRemaining(order.expiry)}
                </span>
              )}
              {!isActive && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {fmtDate(order.createdAt)}
                </span>
              )}
            </div>

            {/* Row 2: amounts and prices */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="text-white font-medium">
                {order.direction === "buy"
                  ? `${parseFloat(order.amount).toFixed(4)} MATIC`
                  : `${parseInt(order.amount, 10).toLocaleString()} tokens`}
              </span>
              <span>@</span>
              <span className="font-mono text-orange-300">{fmtPrice(parseFloat(order.limitPrice))} MATIC/token</span>
              {spot !== undefined && isActive && (
                <>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono">spot: {fmtPrice(spot)}</span>

                  {dist !== null && (
                    <span className={`font-semibold ${
                      dist <= 0
                        ? "text-orange-400"
                        : order.direction === "buy"
                        ? "text-blue-400"
                        : "text-blue-400"
                    }`}>
                      {dist <= 0
                        ? "● Ready"
                        : order.direction === "buy"
                        ? `↓ ${dist.toFixed(1)}% to trigger`
                        : `↑ ${dist.toFixed(1)}% to trigger`
                      }
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Row 3: slippage info + tx hash */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              <span>Slippage: {order.slippage}%</span>
              {order.executedTxHash && (
                <button
                  type="button"
                  onClick={() => copyTxHash(order.executedTxHash!, order.id)}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  {copiedId === order.id
                    ? <><Check className="h-2.5 w-2.5 text-green-400" /> Copied</>
                    : <><Copy className="h-2.5 w-2.5" /> TX: {order.executedTxHash.slice(0, 10)}...</>
                  }
                </button>
              )}
              {order.executedTxHash && (
                <a
                  href={`https://polygonscan.com/tx/${order.executedTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-orange-400 transition-colors"
                >
                  <ExternalLink className="h-2.5 w-2.5" /> View
                </a>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {isActive && (
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              {order.status === "executable" && (
                <button
                  type="button"
                  onClick={() => executeOrder(order)}
                  disabled={isExec}
                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  {isExec
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Play className="h-3.5 w-3.5" />
                  }
                  Execute
                </button>
              )}
              <button
                type="button"
                onClick={() => cancelOrder(order.id)}
                disabled={isExec}
                className="flex items-center gap-1.5 bg-slate-700/60 hover:bg-red-500/20 hover:border-red-500/40 border border-slate-600/40 text-muted-foreground hover:text-red-400 text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Form + Info grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* ── Place Order card ── */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-slate-800/60 to-slate-700/40 border-slate-700">
          <CardHeader className="border-b border-slate-700/50 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-400" />
              Place Limit Order
              <Badge className="ml-auto bg-slate-700/60 text-gray-400 border-slate-600 text-[10px]">
                Off-chain monitoring · On-chain execution
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">

            {/* ── Buy / Sell toggle ── */}
            <div className="flex rounded-xl overflow-hidden border border-slate-600/50 text-sm font-semibold">
              {(["buy", "sell"] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => handleDirToggle(dir)}
                  className={`flex-1 py-2.5 transition-colors ${
                    formDir === dir
                      ? dir === "buy"
                        ? "bg-green-500/20 text-green-400 border-b-2 border-green-500"
                        : "bg-red-500/20 text-red-400 border-b-2 border-red-500"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  {dir === "buy" ? "▲ Buy" : "▼ Sell"}
                </button>
              ))}
            </div>

            {/* ── Token selector ── */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Token</label>
              <Select value={formTokenId} onValueChange={handleTokenSelect}>
                <SelectTrigger className="bg-slate-900/60 border-slate-600 h-11">
                  <SelectValue placeholder="Select a token…">
                    {formTokenData && (
                      <div className="flex items-center gap-2">
                        <img
                          src={formTokenData.image}
                          alt={formTokenData.symbol}
                          className="w-5 h-5 rounded-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                        <span>{formTokenData.symbol}</span>
                        <span className="text-muted-foreground text-xs">· {formTokenData.artist}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                  {artistTokens.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="hover:bg-slate-800">
                      <div className="flex items-center gap-2">
                        <img
                          src={t.image}
                          alt={t.symbol}
                          className="w-5 h-5 rounded-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                        <span>{t.symbol}</span>
                        <span className="text-muted-foreground text-xs truncate max-w-[120px]">· {t.artist}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Current spot price */}
              <div className="flex items-center gap-2 mt-1.5 text-xs">
                {isLoadingSpot
                  ? <span className="text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Fetching price…</span>
                  : formTokenId && formHasPool && formSpot !== null
                  ? <span className="text-muted-foreground">Current spot: <span className="text-white font-mono">{fmtPrice(formSpot)} MATIC/token</span></span>
                  : formTokenId && !formHasPool
                  ? <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> No active liquidity pool</span>
                  : null
                }
              </div>
            </div>

            {/* ── Amount input ── */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-muted-foreground">
                  {formDir === "buy" ? "Amount (MATIC to spend)" : "Amount (tokens to sell)"}
                </label>
                {formDir === "buy" && isConnected && (
                  <span className="text-xs text-muted-foreground">
                    Balance: <span className="text-white">{parseFloat(balanceFormatted ?? "0").toFixed(4)} MATIC</span>
                  </span>
                )}
              </div>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step={formDir === "buy" ? "0.001" : "1"}
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder={formDir === "buy" ? "0.0" : "0"}
                className="bg-slate-900/60 border-slate-600 h-11 font-mono text-sm"
              />
              {/* Quick amounts for buy */}
              {formDir === "buy" && isConnected && maticBalance > 0 && (
                <div className="flex gap-1.5 mt-1.5">
                  {([0.25, 0.5, 0.75, 1] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => handleQuickAmount(f)}
                      className="flex-1 py-1 text-[10px] bg-slate-700/50 hover:bg-slate-700 rounded-md text-muted-foreground hover:text-white transition-colors border border-slate-600/30"
                    >
                      {f === 1 ? "MAX" : `${f * 100}%`}
                    </button>
                  ))}
                </div>
              )}
              {insufficientBalance && (
                <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" /> Insufficient MATIC balance
                </p>
              )}
            </div>

            {/* ── Limit price input ── */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Limit Price (MATIC per token)
                <span className="ml-1 text-orange-400/70">
                  {formDir === "buy" ? "· trigger when price drops to or below" : "· trigger when price rises to or above"}
                </span>
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.00000001"
                value={formLimitPrice}
                onChange={(e) => setFormLimitPrice(e.target.value)}
                placeholder="0.00000000"
                className="bg-slate-900/60 border-slate-600 h-11 font-mono text-sm"
              />

              {/* Quick offset buttons */}
              {formSpot !== null && (
                <div className="flex gap-1.5 mt-1.5">
                  {(formDir === "buy"
                    ? [{ label: "−1%", pct: -1 }, { label: "−5%", pct: -5 }, { label: "−10%", pct: -10 }, { label: "Spot", pct: 0 }]
                    : [{ label: "Spot", pct: 0 }, { label: "+1%", pct: 1 }, { label: "+5%", pct: 5 }, { label: "+10%", pct: 10 }]
                  ).map(({ label, pct }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleQuickPrice(pct)}
                      className="flex-1 py-1 text-[10px] bg-slate-700/50 hover:bg-orange-500/20 hover:text-orange-300 rounded-md text-muted-foreground hover:border-orange-500/30 transition-colors border border-slate-600/30"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Immediate execution warning */}
              {wouldExecuteNow && (
                <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">
                    This limit price {formDir === "buy" ? "exceeds" : "is below"} the current market price
                    — the order will be executable immediately. Consider using the Swap tab for instant fills.
                  </p>
                </div>
              )}
            </div>

            {/* ── Expiry + Slippage row ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Order Expires In</label>
                <Select
                  value={formExpiry.toString()}
                  onValueChange={(v) => setFormExpiry(parseInt(v, 10))}
                >
                  <SelectTrigger className="bg-slate-900/60 border-slate-600 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {EXPIRY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.ms} value={opt.ms.toString()} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Max Slippage</label>
                <div className="flex rounded-lg overflow-hidden border border-slate-600/50 h-9">
                  {SLIPPAGE_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormSlippage(s)}
                      className={`flex-1 text-xs transition-colors ${
                        formSlippage === s
                          ? "bg-orange-500/20 text-orange-400"
                          : "text-muted-foreground hover:text-white"
                      }`}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Submit ── */}
            {isConnected ? (
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={
                  isPlacing ||
                  !formTokenId ||
                  !formAmount ||
                  !formLimitPrice ||
                  !formHasPool ||
                  insufficientBalance ||
                  parseFloat(formAmount) <= 0 ||
                  parseFloat(formLimitPrice) <= 0
                }
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                  formDir === "buy"
                    ? "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white disabled:from-slate-700 disabled:to-slate-700 disabled:text-muted-foreground"
                    : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white disabled:from-slate-700 disabled:to-slate-700 disabled:text-muted-foreground"
                } disabled:cursor-not-allowed`}
              >
                {isPlacing
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Placing…</span>
                  : !formTokenId
                  ? "Select a Token"
                  : !formHasPool
                  ? "No Liquidity Pool"
                  : `Place ${formDir === "buy" ? "Buy" : "Sell"} Limit Order`
                }
              </button>
            ) : (
              <div className="flex justify-center pt-1">
                <ConnectButton />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── How it works card ── */}
        <Card className="bg-gradient-to-br from-slate-800/40 to-slate-700/20 border-slate-700/60">
          <CardHeader className="border-b border-slate-700/40 pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Info className="h-4 w-4 text-blue-400" />
              How Limit Orders Work
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs text-muted-foreground">
            <div className="space-y-3">
              {[
                {
                  icon: <TrendingDown className="h-4 w-4 text-green-400 flex-shrink-0" />,
                  title: "Buy Limit",
                  desc: "Set a maximum price you're willing to pay per token. The order triggers when the pool spot price drops to or below your limit.",
                },
                {
                  icon: <TrendingUp className="h-4 w-4 text-red-400 flex-shrink-0" />,
                  title: "Sell Limit",
                  desc: "Set a minimum price you want to receive per token. The order triggers when the spot price rises to or above your limit.",
                },
                {
                  icon: <RefreshCw className="h-4 w-4 text-blue-400 flex-shrink-0" />,
                  title: "Price Monitoring",
                  desc: "Spot prices are polled every 30 seconds from the on-chain pool. When your condition is met the order becomes Executable.",
                },
                {
                  icon: <Zap className="h-4 w-4 text-orange-400 flex-shrink-0" />,
                  title: "Manual Execution",
                  desc: "Click Execute Now on an Executable order to run the on-chain swap. A slippage guard protects you if the price moves between check and execution.",
                },
                {
                  icon: <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />,
                  title: "Expiry",
                  desc: "Orders that aren't executed before their expiry are automatically marked as Expired and won't execute.",
                },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-2.5">
                  <div className="mt-0.5">{icon}</div>
                  <div>
                    <p className="font-semibold text-white text-xs mb-0.5">{title}</p>
                    <p>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-700/30">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-400/80 text-[10px]">
                  Orders are stored locally in your browser. Clearing browser data will remove them.
                  Only execute from the same browser and wallet that placed the order.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Order book card ── */}
      <Card className="bg-gradient-to-br from-slate-800/60 to-slate-700/40 border-slate-700">
        <CardHeader className="border-b border-slate-700/50 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-400" />
            Your Orders
            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-[10px]">
              {activeOrders.length} active
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={pollSpotPrices}
                disabled={isPolling}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white border border-slate-600/50 hover:border-slate-500 px-2.5 py-1 rounded-lg transition-colors"
              >
                {isPolling
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />
                }
                Refresh
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Active / History tab buttons */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700/50 mb-4 text-xs font-semibold">
            {(["active", "history"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setOrderTab(tab)}
                className={`flex-1 py-2 transition-colors capitalize ${
                  orderTab === tab
                    ? "bg-slate-700/70 text-white"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {tab === "active" ? `Active (${activeOrders.length})` : `History (${historyOrders.length})`}
              </button>
            ))}
          </div>

          {!isConnected ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <p className="text-muted-foreground text-sm">Connect your wallet to view orders</p>
              <ConnectButton />
            </div>
          ) : orderTab === "active" ? (
            activeOrders.length > 0 ? (
              <div className="space-y-3">
                {activeOrders.map(renderOrder)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Zap className="h-10 w-10 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground text-sm">No active orders</p>
                <p className="text-xs text-muted-foreground">Place a limit order above to get started.</p>
              </div>
            )
          ) : (
            historyOrders.length > 0 ? (
              <div className="space-y-3">
                {historyOrders.map(renderOrder)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Clock className="h-10 w-10 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground text-sm">No order history yet</p>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
