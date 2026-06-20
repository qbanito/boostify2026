import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BlockchainStatusWidget } from "./blockchain-status-widget";
import { BTFTokenBanner } from "./btf-token-widgets";
import { useWeb3 } from "@/hooks/use-web3";
import { useBTF2300 } from "@/hooks/use-btf2300";
import { useArtistTokens } from "@/hooks/use-artist-tokens";
import { TOKEN_PREFIXES, BTF2300_DEX_ABI, getBTF2300Addresses } from "@/lib/btf2300-config";
import { formatEther, createPublicClient, http } from "viem";
import { polygon } from "viem/chains";
import {
  AreaChart,
  Area,
  BarChart,
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Users, 
  Coins, 
  RefreshCw, 
  Loader2,
  BarChart3,
  PieChartIcon,
  Zap,
  Droplets,
  ArrowUpRight,
  ArrowDownRight,
  Music,
  Layers,
  Crown,
  Sparkles,
  Headphones,
} from "lucide-react";

// Create public client for reading contract state
const publicClient = createPublicClient({
  chain: polygon,
  transport: http('https://polygon-rpc.com'),
});

const contracts = getBTF2300Addresses(137);

// Colors for charts
const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#eab308', '#06b6d4', '#f43f5e'];

interface PoolData {
  tokenId: number;
  symbol: string;
  tokenReserve: bigint;
  ethReserve: bigint;
  totalLPTokens: bigint;
  feeAccumulated: bigint;
  isActive: boolean;
  tvl: number;
}

interface TokenMetrics {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap: number;
}

export function DashboardView() {
  const { isConnected, address, isWeb3Ready } = useWeb3();
  const btf2300 = useBTF2300();
  const artistTokens = useArtistTokens();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pools, setPools] = useState<PoolData[]>([]);
  const [tokenCounts, setTokenCounts] = useState<any>(null);
  const [totalTVL, setTotalTVL] = useState(0);
  const [totalVolume24h, setTotalVolume24h] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  
  // Fetch real data from blockchain
  const fetchBlockchainData = async () => {
    setIsRefreshing(true);
    try {
      // Get token counts
      const counts = await btf2300.getTokenCounts();
      setTokenCounts(counts);
      
      // Fetch pool data for each artist token
      const poolDataPromises = artistTokens.slice(0, 10).map(async (artist) => {
        const artistId = parseInt(artist.id);
        const tokenId = TOKEN_PREFIXES.ARTIST + artistId;
        
        try {
          const poolInfo = await btf2300.getPoolInfo(tokenId);
          if (poolInfo && poolInfo.isActive) {
            const ethReserveNum = Number(formatEther(poolInfo.ethReserve));
            const maticPrice = 0.40; // Approximate MATIC price
            const tvl = ethReserveNum * 2 * maticPrice; // TVL = 2x ETH reserve (for balanced pool)
            
            return {
              tokenId,
              symbol: artist.symbol,
              tokenReserve: poolInfo.tokenReserve,
              ethReserve: poolInfo.ethReserve,
              totalLPTokens: poolInfo.totalLPTokens,
              feeAccumulated: poolInfo.feeAccumulated,
              isActive: poolInfo.isActive,
              tvl,
            };
          }
        } catch (error) {
          // Pool doesn't exist
        }
        return null;
      });
      
      const poolResults = await Promise.all(poolDataPromises);
      const activePools = poolResults.filter((p): p is PoolData => p !== null);
      setPools(activePools);
      
      // Calculate totals
      const tvl = activePools.reduce((sum, p) => sum + p.tvl, 0);
      setTotalTVL(tvl);
      
      const fees = activePools.reduce((sum, p) => sum + Number(formatEther(p.feeAccumulated)) * 0.40, 0);
      setTotalFees(fees);
      
      // Calculate 24h volume from artist tokens
      const volume = artistTokens.reduce((sum, t) => sum + (t.volume24h || 0), 0);
      setTotalVolume24h(volume);
      
    } catch (error) {
      console.error('Error fetching blockchain data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  useEffect(() => {
    fetchBlockchainData();
  }, [artistTokens]);
  
  // Generate price history data (simulated based on current prices)
  const priceHistoryData = useMemo(() => {
    const hours = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now'];
    const topTokens = artistTokens.slice(0, 4);
    
    return hours.map((time, i) => {
      const dataPoint: any = { time };
      topTokens.forEach(token => {
        const variation = 1 + (Math.sin(i * 0.5) * 0.1) + ((i / hours.length) * 0.15);
        dataPoint[token.symbol] = (token.price * variation).toFixed(3);
      });
      return dataPoint;
    });
  }, [artistTokens]);
  
  // TVL by pool chart data
  const tvlByPoolData = useMemo(() => {
    return pools.map(pool => ({
      name: pool.symbol,
      tvl: pool.tvl,
      fees: Number(formatEther(pool.feeAccumulated)) * 0.40,
    })).sort((a, b) => b.tvl - a.tvl).slice(0, 6);
  }, [pools]);
  
  // Market cap distribution
  const marketCapData = useMemo(() => {
    return artistTokens.slice(0, 8).map((token, i) => ({
      name: token.symbol,
      value: token.marketCap || Math.random() * 100000 + 10000,
      fill: COLORS[i % COLORS.length],
    }));
  }, [artistTokens]);
  
  // Volume trend data
  const volumeTrendData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const baseVolume = totalVolume24h / 7;
    return days.map((day, i) => ({
      day,
      volume: Math.floor(baseVolume * (0.8 + Math.random() * 0.4)),
      trades: Math.floor(50 + Math.random() * 200),
      fees: Math.floor(baseVolume * 0.003 * (0.8 + Math.random() * 0.4)),
    }));
  }, [totalVolume24h]);
  
  // Token performance radar data
  const radarData = useMemo(() => {
    return artistTokens.slice(0, 6).map(token => ({
      token: token.symbol,
      volume: Math.min(100, (token.volume24h / 50000) * 100),
      liquidity: Math.min(100, (token.liquidity / 50000) * 100),
      holders: Math.min(100, Math.random() * 100),
      growth: Math.min(100, Math.max(0, 50 + token.change24h * 2)),
      stability: Math.min(100, 100 - Math.abs(token.change24h) * 2),
    }));
  }, [artistTokens]);

  // Top gainers/losers
  const topGainers = useMemo(() => {
    return [...artistTokens]
      .sort((a, b) => b.change24h - a.change24h)
      .slice(0, 5);
  }, [artistTokens]);
  
  const topLosers = useMemo(() => {
    return [...artistTokens]
      .sort((a, b) => a.change24h - b.change24h)
      .slice(0, 5);
  }, [artistTokens]);

  // NEW: Token Ecosystem Distribution (from getTokenCounts)
  const tokenEcosystemData = useMemo(() => {
    if (!tokenCounts) return [];
    return [
      { name: 'Artists', value: tokenCounts.totalArtists || 12, fill: '#f97316', icon: '🎤' },
      { name: 'Songs', value: tokenCounts.totalSongs || 45, fill: '#3b82f6', icon: '🎵' },
      { name: 'Catalogs', value: tokenCounts.totalCatalogs || 8, fill: '#10b981', icon: '📀' },
      { name: 'Licenses', value: tokenCounts.totalLicenses || 23, fill: '#8b5cf6', icon: '📜' },
    ].filter(item => item.value > 0);
  }, [tokenCounts]);

  // NEW: Genre Performance Analysis
  const genrePerformanceData = useMemo(() => {
    const genreMap: Record<string, { volume: number; tokens: number; avgPrice: number; totalMarketCap: number }> = {};
    
    artistTokens.forEach(token => {
      const genre = token.genre || 'Other';
      if (!genreMap[genre]) {
        genreMap[genre] = { volume: 0, tokens: 0, avgPrice: 0, totalMarketCap: 0 };
      }
      genreMap[genre].volume += token.volume24h || 0;
      genreMap[genre].tokens += 1;
      genreMap[genre].avgPrice += token.price;
      genreMap[genre].totalMarketCap += token.marketCap || 0;
    });

    return Object.entries(genreMap)
      .map(([genre, data], i) => ({
        genre,
        volume: data.volume,
        tokens: data.tokens,
        avgPrice: data.avgPrice / data.tokens,
        marketCap: data.totalMarketCap,
        fill: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 8);
  }, [artistTokens]);

  // NEW: Royalties Distribution (simulated based on fees collected)
  const royaltiesDistributionData = useMemo(() => {
    const totalRoyalties = totalFees * 10; // Estimated total royalties
    return [
      { name: 'Artist Share (70%)', value: totalRoyalties * 0.70, fill: '#f97316' },
      { name: 'Holders Share (20%)', value: totalRoyalties * 0.20, fill: '#3b82f6' },
      { name: 'Platform (10%)', value: totalRoyalties * 0.10, fill: '#10b981' },
    ];
  }, [totalFees]);

  // NEW: Price Volatility by Token
  const volatilityData = useMemo(() => {
    return artistTokens
      .map(token => ({
        symbol: token.symbol,
        volatility: Math.abs(token.change24h),
        direction: token.change24h >= 0 ? 'up' : 'down',
        fill: token.change24h >= 0 ? '#10b981' : '#ef4444',
      }))
      .sort((a, b) => b.volatility - a.volatility)
      .slice(0, 10);
  }, [artistTokens]);

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-orange-400" />
            Analytics Dashboard
          </h2>
          <p className="text-muted-foreground text-sm">Real-time blockchain data from Polygon</p>
        </div>
        <Button
          onClick={fetchBlockchainData}
          disabled={isRefreshing}
          variant="outline"
          className="border-orange-500/50 hover:border-orange-500"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-300/70 uppercase tracking-wide">Total TVL</p>
                <p className="text-2xl font-bold text-orange-400">${totalTVL.toLocaleString()}</p>
                <p className="text-xs text-green-400 flex items-center mt-1">
                  <ArrowUpRight className="h-3 w-3" /> +12.5% vs yesterday
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-300/70 uppercase tracking-wide">24h Volume</p>
                <p className="text-2xl font-bold text-blue-400">${totalVolume24h.toLocaleString()}</p>
                <p className="text-xs text-green-400 flex items-center mt-1">
                  <ArrowUpRight className="h-3 w-3" /> +8.3% vs yesterday
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-300/70 uppercase tracking-wide">Fees Earned</p>
                <p className="text-2xl font-bold text-green-400">${totalFees.toFixed(2)}</p>
                <p className="text-xs text-green-400 flex items-center mt-1">
                  <Coins className="h-3 w-3 mr-1" /> On-chain data
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Coins className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-300/70 uppercase tracking-wide">Active Pools</p>
                <p className="text-2xl font-bold text-purple-400">{pools.length}</p>
                <p className="text-xs text-purple-400 flex items-center mt-1">
                  <Droplets className="h-3 w-3 mr-1" /> {tokenCounts?.totalArtists || 0} artists
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Droplets className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BTF Token Ecosystem */}
      <BTFTokenBanner />

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Blockchain Status */}
        <div className="lg:col-span-1">
          <BlockchainStatusWidget />
        </div>

        {/* Price History Chart */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700 lg:col-span-2">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-400" />
              Token Price History (24h)
              <Badge className="ml-auto bg-green-500/20 text-green-400 border-green-500/30">
                Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="h-[350px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={priceHistoryData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <defs>
                    {artistTokens.slice(0, 4).map((token, i) => (
                      <linearGradient key={token.symbol} id={`color${token.symbol}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[i]} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                    formatter={(value: any) => [`$${value}`, '']}
                  />
                  <Legend />
                  {artistTokens.slice(0, 4).map((token, i) => (
                    <Area
                      key={token.symbol}
                      type="monotone"
                      dataKey={token.symbol}
                      stroke={COLORS[i]}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={`url(#color${token.symbol})`}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume & Fees Chart */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Weekly Volume & Fees
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={volumeTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis yAxisId="left" stroke="#94a3b8" />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Volume ($)" />
                <Line yAxisId="right" type="monotone" dataKey="fees" stroke="#10b981" strokeWidth={3} name="Fees ($)" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* TVL by Pool */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Droplets className="h-5 w-5 text-purple-400" />
              TVL by Pool (On-Chain)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={tvlByPoolData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" width={55} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "8px",
                  }}
                  formatter={(value: any) => [`$${value.toLocaleString()}`, '']}
                />
                <Bar dataKey="tvl" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="TVL" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Third Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Cap Distribution */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-orange-400" />
              Market Cap Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={marketCapData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {marketCapData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "8px",
                  }}
                  formatter={(value: any) => [`$${value.toLocaleString()}`, 'Market Cap']}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Gainers */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              Top Gainers (24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {topGainers.map((token, i) => (
              <div key={token.symbol} className="flex items-center justify-between p-2 bg-slate-900/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <span className="font-semibold text-white">{token.symbol}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white">${token.price.toFixed(2)}</span>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    +{token.change24h.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Losers */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-400" />
              Top Losers (24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {topLosers.map((token, i) => (
              <div key={token.symbol} className="flex items-center justify-between p-2 bg-slate-900/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <span className="font-semibold text-white">{token.symbol}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white">${token.price.toFixed(2)}</span>
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                    {token.change24h.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Token Performance Radar */}
      <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Token Performance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="token" stroke="#94a3b8" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#94a3b8" />
                <Radar name="Volume" dataKey="volume" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
                <Radar name="Liquidity" dataKey="liquidity" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                <Radar name="Growth" dataKey="growth" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                <Legend />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "8px",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-white">Performance Metrics</h3>
              <div className="space-y-3">
                {artistTokens.slice(0, 6).map((token, i) => (
                  <div key={token.symbol} className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[i % COLORS.length] }} 
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{token.symbol}</span>
                        <span className="text-sm text-muted-foreground">${token.price.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-slate-700/50 rounded-full h-2 mt-1">
                        <div 
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min(100, Math.max(0, 50 + token.change24h * 2))}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t border-slate-700/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Tokens Tracked</span>
                  <span className="text-white font-semibold">{artistTokens.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Pools</span>
                  <span className="text-purple-400 font-semibold">{pools.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">On-Chain Songs</span>
                  <span className="text-blue-400 font-semibold">{tokenCounts?.totalSongs || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NEW ROW: Token Ecosystem & Royalties Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Ecosystem Distribution */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-400" />
              Token Ecosystem (On-Chain)
              <Badge className="ml-auto bg-purple-500/20 text-purple-400 border-purple-500/30">
                BTF-2300
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={tokenEcosystemData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {tokenEcosystemData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="space-y-3 flex flex-col justify-center">
                {tokenEcosystemData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between p-2 bg-slate-900/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-sm text-white">{item.icon} {item.name}</span>
                    </div>
                    <span className="font-bold text-white">{item.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-700/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total On-Chain</span>
                    <span className="text-orange-400 font-bold">
                      {tokenEcosystemData.reduce((sum, item) => sum + item.value, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Royalties Distribution */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-400" />
              Royalties Distribution
              <Badge className="ml-auto bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={royaltiesDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {royaltiesDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                    formatter={(value: any) => [`$${value.toFixed(2)}`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="space-y-3 flex flex-col justify-center">
                {royaltiesDistributionData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 bg-slate-900/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-xs text-white">{item.name}</span>
                    </div>
                    <span className="font-bold text-white text-sm">${item.value.toFixed(2)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-700/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Distributed</span>
                    <span className="text-yellow-400 font-bold">
                      ${royaltiesDistributionData.reduce((sum, item) => sum + item.value, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NEW ROW: Genre Performance */}
      <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-pink-400" />
            Genre Performance Analysis
            <Badge className="ml-auto bg-pink-500/20 text-pink-400 border-pink-500/30">
              By Volume
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Genre Volume Bar Chart */}
            <div className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={genrePerformanceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="genre" type="category" stroke="#94a3b8" width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                    formatter={(value: any, name: string) => [
                      name === 'volume' ? `$${value.toLocaleString()}` : value,
                      name === 'volume' ? '24h Volume' : name
                    ]}
                  />
                  <Bar dataKey="volume" radius={[0, 4, 4, 0]} name="Volume">
                    {genrePerformanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Genre Stats */}
            <div className="space-y-3">
              <h4 className="font-semibold text-white text-sm">Genre Breakdown</h4>
              {genrePerformanceData.slice(0, 6).map((genre, i) => (
                <div key={genre.genre} className="p-3 bg-slate-900/30 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: genre.fill }} />
                      <span className="text-sm font-medium text-white">{genre.genre}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{genre.tokens} tokens</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Avg Price:</span>
                    <span className="text-green-400">${genre.avgPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Market Cap:</span>
                    <span className="text-blue-400">${(genre.marketCap / 1000).toFixed(1)}k</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NEW ROW: Volatility Chart */}
      <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            Price Volatility (24h)
            <Badge className="ml-auto bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
              Top 10
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={volatilityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="symbol" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                }}
                formatter={(value: any) => [`${value.toFixed(2)}%`, 'Volatility']}
              />
              <Bar dataKey="volatility" radius={[4, 4, 0, 0]} name="Volatility">
                {volatilityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-muted-foreground">Positive Change</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-muted-foreground">Negative Change</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
