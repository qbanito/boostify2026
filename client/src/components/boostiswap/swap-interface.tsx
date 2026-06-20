import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  ArrowDownUp, AlertCircle, Zap, ExternalLink, Loader2,
  CheckCircle2, RefreshCw, Copy, Check, TrendingDown, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWeb3 } from "@/hooks/use-web3";
import { useBTF2300, type PoolInfo } from "@/hooks/use-btf2300";
import { useArtistTokens, type ArtistToken } from "@/hooks/use-artist-tokens";
import { TOKEN_PREFIXES } from "@/lib/btf2300-config";
import { formatEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";

// ─── helpers ──────────────────────────────────────────────────────
const SLIPPAGE_PRESETS = [0.5, 1, 3] as const;
const QUICK_FRACTIONS = [
  { label: "25%", fraction: 0.25 },
  { label: "50%", fraction: 0.5 },
  { label: "75%", fraction: 0.75 },
  { label: "MAX", fraction: 1 },
] as const;

function fmtNum(val: string | number, dp = 4): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n) || n === 0) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return n.toLocaleString("en", { maximumFractionDigits: 2 });
  return n.toFixed(dp);
}

function calcPriceImpact(
  inputAmt: number,
  pool: PoolInfo,
  mode: "buy" | "sell",
): number {
  // AMM constant product: estimate price impact from reserve ratio change
  if (!pool.isActive) return 0;
  const ethRes = parseFloat(formatEther(pool.ethReserve));
  const tokRes = Number(pool.tokenReserve);
  if (ethRes === 0 || tokRes === 0) return 0;
  if (mode === "buy") {
    // fraction of ETH reserve being consumed
    return Math.min((inputAmt / ethRes) * 100, 99);
  } else {
    return Math.min((inputAmt / tokRes) * 100, 99);
  }
}

// ─── component ────────────────────────────────────────────────────
export function SwapInterface() {
  const { toast } = useToast();
  const { isConnected, address, isWeb3Ready, balanceFormatted } = useWeb3();
  const btf2300 = useBTF2300();
  const artistTokens = useArtistTokens();

  const [swapMode, setSwapMode] = useState<"buy" | "sell">("buy");
  const [selectedToken, setSelectedToken] = useState("");
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [slippage, setSlippage] = useState<number>(0.5);
  const [customSlippage, setCustomSlippage] = useState("");
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0));
  const [txHashCopied, setTxHashCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived token info ──
  const selectedTokenData: ArtistToken | undefined = artistTokens.find(
    (t) => t.id === selectedToken,
  );

  // ── Token ID ──
  const getTokenId = useCallback((tokenIdStr: string): number => {
    return TOKEN_PREFIXES.ARTIST + parseInt(tokenIdStr, 10);
  }, []);

  // ── Fetch pool info ──
  const refreshPool = useCallback(
    async (silent = false) => {
      if (!selectedToken) return;
      if (!silent) setIsRefreshing(true);
      try {
        const info = await btf2300.getPoolInfo(getTokenId(selectedToken));
        setPoolInfo(info);
      } finally {
        if (!silent) setIsRefreshing(false);
      }
    },
    [selectedToken, btf2300, getTokenId],
  );

  // ── Fetch token balance (sell mode) ──
  const refreshTokenBalance = useCallback(async () => {
    if (!selectedToken || !address) { setTokenBalance(BigInt(0)); return; }
    const bal = await btf2300.getTokenBalance(getTokenId(selectedToken), address);
    setTokenBalance(bal);
  }, [selectedToken, address, btf2300, getTokenId]);

  // ── On token change: reset state + fetch pool + fetch balance ──
  useEffect(() => {
    setInputAmount("");
    setOutputAmount("");
    setPoolInfo(null);
    setTokenBalance(BigInt(0));
    if (selectedToken) {
      refreshPool();
      if (swapMode === "sell") refreshTokenBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToken]);

  // ── On mode change: refresh token balance if needed ──
  useEffect(() => {
    if (swapMode === "sell" && selectedToken) refreshTokenBalance();
  }, [swapMode, refreshTokenBalance, selectedToken]);

  // ── Quote calculation (debounced 200ms) ──
  const calculateOutput = useCallback(async () => {
    if (!selectedToken || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount("");
      return;
    }
    setIsQuoting(true);
    try {
      const tokenId = getTokenId(selectedToken);
      if (swapMode === "buy") {
        const expected = await btf2300.getExpectedTokensOut(tokenId, inputAmount);
        setOutputAmount(expected.toString());
      } else {
        const expected = await btf2300.getExpectedEthOut(tokenId, parseInt(inputAmount, 10));
        setOutputAmount(expected);
      }
    } finally {
      setIsQuoting(false);
    }
  }, [selectedToken, inputAmount, swapMode, btf2300, getTokenId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(calculateOutput, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [calculateOutput]);

  // ── Auto-refresh quote every 30s ──
  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    autoRefreshRef.current = setInterval(() => {
      if (inputAmount && parseFloat(inputAmount) > 0) {
        calculateOutput();
        refreshPool(true);
      }
    }, 30_000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [calculateOutput, refreshPool, inputAmount]);

  // ── Quick amount fill ──
  const handleQuickAmount = useCallback(
    (fraction: number) => {
      if (swapMode === "buy") {
        const bal = parseFloat(balanceFormatted ?? "0");
        if (bal > 0) setInputAmount((bal * fraction).toFixed(4));
      } else {
        const bal = Number(tokenBalance);
        if (bal > 0) setInputAmount(Math.floor(bal * fraction).toString());
      }
    },
    [swapMode, balanceFormatted, tokenBalance],
  );

  // ── Toggle buy/sell ──
  const toggleSwapMode = useCallback(() => {
    setSwapMode((m) => (m === "buy" ? "sell" : "buy"));
    setInputAmount(outputAmount);
    setOutputAmount(inputAmount);
  }, [inputAmount, outputAmount]);

  // ── Manual refresh ──
  const handleManualRefresh = useCallback(async () => {
    await refreshPool();
    await calculateOutput();
  }, [refreshPool, calculateOutput]);

  // ── Copy tx hash ──
  const copyTxHash = useCallback(() => {
    if (btf2300.txHash) {
      navigator.clipboard.writeText(btf2300.txHash).then(() => {
        setTxHashCopied(true);
        setTimeout(() => setTxHashCopied(false), 2000);
      });
    }
  }, [btf2300.txHash]);

  // ── Swap handler ──
  const handleSwap = useCallback(async () => {
    if (!selectedToken || !inputAmount) {
      toast({ title: "Missing fields", description: "Select a token and enter an amount", variant: "destructive" });
      return;
    }
    if (!isConnected) {
      toast({ title: "Wallet not connected", description: "Connect your wallet first", variant: "destructive" });
      return;
    }

    const inputNum = parseFloat(inputAmount);
    // Insufficient balance check
    if (swapMode === "buy") {
      const maticBal = parseFloat(balanceFormatted ?? "0");
      if (inputNum > maticBal) {
        toast({ title: "Insufficient MATIC balance", description: `You have ${fmtNum(maticBal, 4)} MATIC`, variant: "destructive" });
        return;
      }
    } else {
      if (inputNum > Number(tokenBalance)) {
        toast({ title: "Insufficient token balance", description: `You have ${Number(tokenBalance)} tokens`, variant: "destructive" });
        return;
      }
    }

    const tokenId = getTokenId(selectedToken);
    try {
      let result;
      if (swapMode === "buy") {
        const minTokensOut = parseInt(outputAmount, 10) || 0;
        result = await btf2300.buyTokensFromDEX(tokenId, inputAmount, minTokensOut, slippage);
      } else {
        const tokenAmount = parseInt(inputAmount, 10);
        result = await btf2300.sellTokens(tokenId, tokenAmount, outputAmount, slippage);
      }

      if (result?.success) {
        setIsSuccess(true);
        setInputAmount("");
        setOutputAmount("");
        refreshPool();
        refreshTokenBalance();
        setTimeout(() => setIsSuccess(false), 4000);
      }
    } catch (err) {
      console.error("Swap error:", err);
    }
  }, [
    selectedToken, inputAmount, outputAmount, isConnected, swapMode,
    balanceFormatted, tokenBalance, slippage, btf2300, getTokenId,
    toast, refreshPool, refreshTokenBalance,
  ]);

  // ── Derived: price impact, min received ──
  const inputNum = parseFloat(inputAmount) || 0;
  const outputNum = parseFloat(outputAmount) || 0;
  const priceImpact = poolInfo ? calcPriceImpact(inputNum, poolInfo, swapMode) : 0;
  const minReceived = outputNum > 0 ? outputNum * (1 - slippage / 100) : 0;

  // ── Exchange rate label ──
  const exchangeRateLabel: string | null =
    inputNum > 0 && outputNum > 0
      ? swapMode === "buy"
        ? `1 MATIC ≈ ${fmtNum(outputNum / inputNum, 2)} ${selectedTokenData?.symbol ?? "Tokens"}`
        : `1 ${selectedTokenData?.symbol ?? "Token"} ≈ ${fmtNum(outputNum / inputNum, 6)} MATIC`
      : null;

  // ── Insufficient balance flags ──
  const insufficientBuy =
    swapMode === "buy" && inputNum > 0 && inputNum > parseFloat(balanceFormatted ?? "0");
  const insufficientSell =
    swapMode === "sell" && inputNum > 0 && inputNum > Number(tokenBalance);
  const hasInsufficientBalance = insufficientBuy || insufficientSell;

  const canSwap =
    isConnected &&
    !!selectedToken &&
    inputNum > 0 &&
    outputNum > 0 &&
    !btf2300.isLoading &&
    !isQuoting &&
    !hasInsufficientBalance &&
    !isSuccess &&
    !!(poolInfo?.isActive);

  return (
    <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700 hover:border-orange-500/30 transition max-w-lg mx-auto">
      <CardHeader className="border-b border-slate-700/50 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-orange-400" />
            Swap Artist Tokens
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
              Polygon
            </Badge>
            <button
              type="button"
              title="Refresh quote"
              onClick={handleManualRefresh}
              className={`p-1.5 rounded-lg bg-slate-800/60 text-gray-400 hover:text-white transition-colors ${isRefreshing ? "animate-spin" : ""}`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Slippage settings"
              onClick={() => setShowSettings((v) => !v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                showSettings
                  ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                  : "bg-slate-800/60 text-gray-400 border-slate-700/30 hover:text-white"
              }`}
            >
              {slippage}% slip
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        {/* ── Slippage Settings ── */}
        {showSettings && (
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/30 space-y-2">
            <p className="text-xs text-gray-400 font-medium">Slippage Tolerance</p>
            <div className="flex gap-1.5">
              {SLIPPAGE_PRESETS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => { setSlippage(val); setCustomSlippage(""); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 ${
                    slippage === val && !customSlippage
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      : "bg-slate-800/50 text-gray-400 hover:text-white border border-slate-700/30"
                  }`}
                >
                  {val}%
                </button>
              ))}
              <div className="relative flex-1">
                <input
                  type="number"
                  placeholder="Custom"
                  value={customSlippage}
                  onChange={(e) => {
                    setCustomSlippage(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (v > 0 && v <= 50) setSlippage(v);
                  }}
                  className="w-full px-2 py-1.5 rounded-lg text-xs bg-slate-800/50 border border-slate-700/30 text-white focus:border-orange-500/50 focus:outline-none"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">%</span>
              </div>
            </div>
            {slippage > 5 && (
              <p className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> High slippage — may result in unfavorable trade
              </p>
            )}
          </div>
        )}

        {/* ── Buy / Sell toggle ── */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-900/40 p-1 rounded-xl border border-slate-700/30">
          <button
            type="button"
            onClick={() => setSwapMode("buy")}
            className={`py-2 rounded-lg text-sm font-semibold transition-all ${
              swapMode === "buy"
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Buy Tokens
          </button>
          <button
            type="button"
            onClick={() => setSwapMode("sell")}
            className={`py-2 rounded-lg text-sm font-semibold transition-all ${
              swapMode === "sell"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Sell Tokens
          </button>
        </div>

        {/* ── Token Selection ── */}
        <div>
          <Select value={selectedToken} onValueChange={setSelectedToken}>
            <SelectTrigger className="bg-slate-900/50 border-slate-700 hover:border-orange-500/50">
              <SelectValue placeholder="Select an artist token…" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {artistTokens.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No tokens available</div>
              ) : (
                artistTokens.map((token) => (
                  <SelectItem key={token.id} value={token.id}>
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={token.image}
                        alt={token.symbol}
                        className="w-5 h-5 rounded-full flex-shrink-0 object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                      <span className="font-semibold">{token.symbol}</span>
                      <span className="text-muted-foreground text-xs truncate">{token.artist}</span>
                      <span className="ml-auto text-xs text-orange-400 flex-shrink-0">
                        ${token.price.toFixed(4)}
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* ── INPUT BOX ── */}
        <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
              {swapMode === "buy" ? "You Pay" : "You Sell"}
            </span>
            <span className="text-[10px] text-gray-500">
              Balance:{" "}
              {swapMode === "buy"
                ? `${fmtNum(balanceFormatted ?? "0", 4)} MATIC`
                : `${Number(tokenBalance).toLocaleString()} ${selectedTokenData?.symbol ?? "Tokens"}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className={`flex-1 bg-transparent text-2xl font-bold text-white placeholder-gray-600 focus:outline-none min-w-0 ${
                hasInsufficientBalance ? "text-red-400" : ""
              }`}
            />
            <span className="text-sm text-gray-400 font-medium flex-shrink-0">
              {swapMode === "buy" ? "MATIC" : (selectedTokenData?.symbol ?? "Tokens")}
            </span>
          </div>

          {/* Quick amount buttons */}
          {isConnected && selectedToken && (
            <div className="flex gap-1 pt-1">
              {QUICK_FRACTIONS.map(({ label, fraction }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleQuickAmount(fraction)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/60 text-gray-400 hover:bg-orange-500/20 hover:text-orange-400 transition-colors border border-slate-700/30"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Insufficient balance warning */}
          {hasInsufficientBalance && (
            <p className="text-[11px] text-red-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Insufficient balance
            </p>
          )}
        </div>

        {/* ── FLIP BUTTON ── */}
        <div className="flex justify-center -my-1">
          <button
            type="button"
            onClick={toggleSwapMode}
            className="p-2 rounded-full bg-slate-800/80 border border-slate-700/50 hover:border-orange-500/50 hover:bg-orange-500/10 text-gray-400 hover:text-orange-400 transition-all"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        {/* ── OUTPUT BOX ── */}
        <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">You Receive</span>
            {isQuoting && (
              <span className="flex items-center gap-1 text-[10px] text-orange-400">
                <Loader2 className="h-3 w-3 animate-spin" /> Calculating…
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex-1 text-2xl font-bold min-w-0 ${
              outputAmount && !isQuoting ? "text-white" : "text-gray-600"
            }`}>
              {isQuoting
                ? <span className="inline-block w-24 h-7 bg-slate-700/50 rounded animate-pulse" />
                : (outputAmount ? fmtNum(outputAmount, swapMode === "buy" ? 0 : 6) : "0.0")}
            </span>
            <span className="text-sm text-gray-400 font-medium flex-shrink-0">
              {swapMode === "buy" ? (selectedTokenData?.symbol ?? "Tokens") : "MATIC"}
            </span>
          </div>
        </div>

        {/* ── Trade details ── */}
        {outputAmount && inputNum > 0 && (
          <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/20 space-y-2 text-xs">
            {exchangeRateLabel && (
              <div className="flex justify-between">
                <span className="text-gray-500 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Rate
                </span>
                <span className="text-gray-300">{exchangeRateLabel}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Min. received ({slippage}% slip)</span>
              <span className="text-gray-300">
                {fmtNum(minReceived, swapMode === "buy" ? 0 : 6)}{" "}
                {swapMode === "buy" ? (selectedTokenData?.symbol ?? "Tokens") : "MATIC"}
              </span>
            </div>
            {priceImpact > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" /> Price Impact
                </span>
                <span
                  className={
                    priceImpact > 15
                      ? "text-red-400 font-semibold"
                      : priceImpact > 5
                      ? "text-amber-400"
                      : "text-green-400"
                  }
                >
                  {priceImpact.toFixed(2)}%
                  {priceImpact > 15 && " ⚠️"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Pool Info (compact) ── */}
        {poolInfo?.isActive && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Tokens", value: Number(poolInfo.tokenReserve).toLocaleString() },
              { label: "MATIC", value: fmtNum(formatEther(poolInfo.ethReserve), 2) },
              { label: "Fees", value: fmtNum(formatEther(poolInfo.feeAccumulated), 4) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/20 text-center">
                <p className="text-[10px] text-gray-500 uppercase">{label}</p>
                <p className="text-xs text-white font-semibold mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── No pool warning ── */}
        {selectedToken && poolInfo && !poolInfo.isActive && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 text-sm font-semibold">No liquidity pool</p>
              <p className="text-yellow-400/60 text-xs mt-0.5">
                This token doesn't have a DEX pool yet. Add liquidity to enable swaps.
              </p>
            </div>
          </div>
        )}

        {/* ── High price impact warning ── */}
        {priceImpact > 15 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">
              <strong>High price impact ({priceImpact.toFixed(1)}%).</strong> Consider splitting into smaller swaps to reduce impact.
            </p>
          </div>
        )}

        {/* ── Wallet connect / swap button ── */}
        {!isConnected ? (
          <div className="space-y-2">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <p className="text-amber-400 text-xs">Connect your wallet to execute swaps</p>
            </div>
            <div className="w-full flex justify-center">
              {isWeb3Ready ? (
                <ConnectButton
                  showBalance={false}
                  chainStatus="icon"
                  accountStatus="address"
                  label="Connect Wallet"
                />
              ) : (
                <Button
                  onClick={() => toast({ title: "Initializing Web3…", description: "Please wait a moment and try again" })}
                  className="w-full bg-purple-500 hover:bg-purple-600"
                >
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Button
            onClick={handleSwap}
            disabled={!canSwap}
            className={`w-full py-6 text-base font-bold transition-all ${
              isSuccess
                ? "bg-green-500 hover:bg-green-600"
                : hasInsufficientBalance
                ? "bg-red-500/60 cursor-not-allowed"
                : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            }`}
          >
            {btf2300.isLoading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing on Polygon…</>
            ) : isSuccess ? (
              <><CheckCircle2 className="mr-2 h-5 w-5" /> Swap Successful!</>
            ) : isQuoting ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Fetching quote…</>
            ) : hasInsufficientBalance ? (
              <>Insufficient Balance</>
            ) : !selectedToken ? (
              <>Select a Token</>
            ) : !poolInfo?.isActive ? (
              <>No Liquidity Pool</>
            ) : (
              <>{swapMode === "buy" ? "Buy" : "Sell"} {selectedTokenData?.symbol ?? "Tokens"}</>
            )}
          </Button>
        )}

        {/* ── Transaction hash ── */}
        {btf2300.txHash && (
          <div className="flex items-center gap-2 bg-slate-900/40 rounded-lg px-3 py-2 border border-slate-700/20">
            <span className="text-xs text-gray-400 flex-1 truncate font-mono">
              {btf2300.txHash.slice(0, 10)}…{btf2300.txHash.slice(-8)}
            </span>
            <button
              type="button"
              onClick={copyTxHash}
              className="text-gray-400 hover:text-white transition-colors"
              title="Copy tx hash"
            >
              {txHashCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <a
              href={`https://polygonscan.com/tx/${btf2300.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              title="View on PolygonScan"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
