import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { SwapInterface } from "../components/boostiswap/swap-interface";
import { BTFSwapWidget } from "../components/boostiswap/btf-swap-widget";
import { PoolsView } from "../components/boostiswap/pools-view";
import { MyLiquidity } from "../components/boostiswap/my-liquidity";
import { DashboardView } from "../components/boostiswap/dashboard-view";
import { ArtistTokensMarketplace } from "../components/boostiswap/artist-tokens-marketplace";
import { SongTokensMarketplace } from "../components/boostiswap/song-tokens-marketplace";
import { WalletConnectButton } from "../components/boostiswap/wallet-connect-button";
import { CryptoPriceWidget } from "../components/boostiswap/crypto-price-widget";
import { ArtistPricesTicker } from "../components/boostiswap/artist-prices-ticker";
import { BTFTokenBanner } from "../components/boostiswap/btf-token-widgets";
import { LimitOrders } from "../components/boostiswap/limit-orders";
import { UtilityDisclaimer } from "../components/btf/utility-disclaimer";
import { useWeb3 } from "../hooks/use-web3";
import { useBTFToken } from "../hooks/use-btf-token";
import { Zap, Droplets, BarChart2, Wallet, AlertCircle, Music2, Music, Coins, AlarmClock, ShieldCheck } from "lucide-react";

export default function BoostiSwapPage() {
  const { isConnected, address, balanceFormatted, symbol } = useWeb3();
  const { balance: btfBalance } = useBTFToken();
  const [activeTab, setActiveTab] = useState("artists");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-900/20 to-slate-900">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header with Wallet Connect */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-white">BTF Utility Hub</h1>
                <p className="text-xs sm:text-sm text-orange-400">Add Credits • Activate Artist Packs • Access Services</p>
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <WalletConnectButton />
            </div>
          </div>

          {/* Wallet Status Alert */}
          {!isConnected && (
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-2 sm:p-3 flex items-start gap-2 sm:gap-3 text-xs sm:text-sm">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium">Connect your wallet to use the BTF Utility Hub</p>
                <p className="text-amber-400/70 text-xs mt-0.5 sm:mt-1">You need a compatible wallet (MetaMask, WalletConnect, etc.) to add or use BTF Credits</p>
              </div>
            </div>
          )}

          {isConnected && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-2 sm:p-3 text-xs sm:text-sm">
              <p className="text-green-400">
                ✅ Connected • Balance: <span className="font-semibold">{balanceFormatted} {symbol}</span>
                {btfBalance && parseFloat(btfBalance) > 0 && (
                  <> • <span className="font-semibold text-orange-400">{parseFloat(btfBalance).toLocaleString('en', { maximumFractionDigits: 2 })} BTF</span></>
                )}
              </p>
            </div>
          )}
        </div>

        {/* BTF Token Ecosystem Banner */}
        <div className="mb-4 sm:mb-6">
          <BTFTokenBanner />
        </div>

        {/* Artist Prices Ticker - LARGE */}
        <div className="mb-4 sm:mb-6">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Artist Access Packs</h3>
          <ArtistPricesTicker />
        </div>

        {/* Crypto Price Widget - SMALL */}
        <div className="mb-4 sm:mb-6">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Crypto Markets</h3>
          <CryptoPriceWidget />
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-700 rounded-lg p-2 sm:p-4 hover:border-orange-500/50 transition">
            <div className="text-xs sm:text-sm text-muted-foreground">Platform Service Usage</div>
            <div className="text-lg sm:text-2xl font-bold text-orange-400">12K+</div>
            <div className="text-xs text-green-400 mt-0.5 sm:mt-1">Services activated</div>
          </div>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-700 rounded-lg p-2 sm:p-4 hover:border-orange-500/50 transition">
            <div className="text-xs sm:text-sm text-muted-foreground">Credits Circulating</div>
            <div className="text-lg sm:text-2xl font-bold text-orange-400">8.2M</div>
            <div className="text-xs text-green-400 mt-0.5 sm:mt-1">BTF Credits active</div>
          </div>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-700 rounded-lg p-2 sm:p-4 hover:border-orange-500/50 transition">
            <div className="text-xs sm:text-sm text-muted-foreground">Artist Packs</div>
            <div className="text-lg sm:text-2xl font-bold text-orange-400">24</div>
            <div className="text-xs text-blue-400 mt-0.5 sm:mt-1">+3 new</div>
          </div>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-700 rounded-lg p-2 sm:p-4 hover:border-orange-500/50 transition">
            <div className="text-xs sm:text-sm text-muted-foreground">Utility Score Avg</div>
            <div className="text-lg sm:text-2xl font-bold text-orange-400">High</div>
            <div className="text-xs text-green-400 mt-0.5 sm:mt-1">Service engagement</div>
          </div>
        </div>

        {/* Tabs - Fully Responsive */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-3 sm:space-y-4">
          <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full bg-slate-800/50 gap-0 h-auto p-1 overflow-x-auto">
            <TabsTrigger value="artists" className="gap-1 sm:gap-2 flex items-center text-xs sm:text-sm py-2 px-1 sm:px-2 whitespace-nowrap">
              👤
              <span className="hidden sm:inline">Artists</span>
            </TabsTrigger>
            <TabsTrigger value="buy-btf" className="gap-1 sm:gap-2 flex items-center text-xs sm:text-sm py-2 px-1 sm:px-2 whitespace-nowrap">
              <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-orange-400" />
              <span className="hidden sm:inline">Add Credits</span>
            </TabsTrigger>
            <TabsTrigger value="songs" className="gap-1 sm:gap-2 flex items-center text-xs sm:text-sm py-2 px-1 sm:px-2 whitespace-nowrap">
              🎵
              <span className="hidden sm:inline">Songs</span>
            </TabsTrigger>
            <TabsTrigger value="swap" className="gap-1 sm:gap-2 flex items-center text-xs sm:text-sm py-2 px-1 sm:px-2 whitespace-nowrap">
              <Zap className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Swap</span>
            </TabsTrigger>
            <TabsTrigger value="pools" className="gap-1 sm:gap-2 flex items-center text-xs sm:text-sm py-2 px-1 sm:px-2 whitespace-nowrap">
              <Droplets className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Pools</span>
            </TabsTrigger>
            <TabsTrigger value="liquidity" className="gap-1 sm:gap-2 flex items-center text-xs sm:text-sm py-2 px-1 sm:px-2 whitespace-nowrap">
              <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden lg:inline">Liq</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1 sm:gap-2 flex items-center text-xs sm:text-sm py-2 px-1 sm:px-2 whitespace-nowrap">
              <BarChart2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Usage</span>
            </TabsTrigger>
            <TabsTrigger value="limits" className="gap-1 sm:gap-2 flex items-center text-xs sm:text-sm py-2 px-1 sm:px-2 whitespace-nowrap">
              <AlarmClock className="h-3 w-3 sm:h-4 sm:w-4 text-orange-400" />
              <span className="hidden sm:inline">Limits</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="artists" className="space-y-3 sm:space-y-4 w-full">
            <ArtistTokensMarketplace />
          </TabsContent>

          {/* ═══ BUY BTF — In-App Swap ═══ */}
          <TabsContent value="buy-btf" className="space-y-3 sm:space-y-4 w-full">
            <div className="max-w-lg mx-auto">
              <BTFSwapWidget />
            </div>
          </TabsContent>

          <TabsContent value="songs" className="space-y-3 sm:space-y-4 w-full">
            <SongTokensMarketplace />
          </TabsContent>

          <TabsContent value="swap" className="space-y-3 sm:space-y-4 w-full">
            <SwapInterface />
          </TabsContent>

          <TabsContent value="pools" className="space-y-3 sm:space-y-4 w-full">
            <PoolsView />
          </TabsContent>

          <TabsContent value="liquidity" className="space-y-3 sm:space-y-4 w-full">
            <MyLiquidity userId={address || "guest"} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-3 sm:space-y-4 w-full">
            <DashboardView />
          </TabsContent>

          <TabsContent value="limits" className="space-y-3 sm:space-y-4 w-full">
            <LimitOrders />
          </TabsContent>
        </Tabs>

        {/* Legal Disclaimer */}
        <UtilityDisclaimer variant="short" size="sm" className="mt-8 mb-4" />
      </div>
    </div>
  );
}
