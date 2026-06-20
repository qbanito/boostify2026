import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useArtistTokens } from "@/hooks/use-artist-tokens";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TrendingUp, Droplets, Loader2 } from "lucide-react";
import { AddLiquidityModal } from "./add-liquidity-modal";
import { PoolAnalytics } from "./pool-analytics";

export function PoolsView() {
  const artistTokens = useArtistTokens();

  // Generate mock pools from artist tokens
  const mockPools = artistTokens.slice(0, 6).map((token, idx) => ({
    id: idx + 1,
    name: `${token.symbol} / USDC`,
    token1: token.symbol,
    token2: "USDC",
    tvl: `$${(Math.random() * 500000 + 100000).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
    apy: `${(Math.random() * 30 + 5).toFixed(1)}%`,
    volume24h: `$${(Math.random() * 100000 + 10000).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
    liquidity: Math.random() * 500000 + 100000,
    token1Reserve: Math.random() * 1000 + 100,
    token2Reserve: Math.random() * 50000 + 5000,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Available Pools</h2>
          <p className="text-muted-foreground text-sm mt-1">{mockPools.length} active pools</p>
        </div>
        <AddLiquidityModal triggerLabel="Create New Pool" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockPools.map((pool) => (
          <Card
            key={pool.id}
            className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700 hover:border-orange-500/50 transition cursor-pointer group"
            data-testid={`pool-card-${pool.id}`}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-xs font-bold group-hover:scale-110 transition">
                    <Droplets className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{pool.name}</h3>
                    <p className="text-xs text-muted-foreground">TVL: {pool.tvl}</p>
                  </div>
                </div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {pool.apy}
                </Badge>
              </div>

              <div className="space-y-3 mb-4 p-3 bg-slate-900/50 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">24h Volume</p>
                    <p className="font-semibold text-orange-400">{pool.volume24h}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">APY Yield</p>
                    <p className="font-semibold text-green-400">{pool.apy}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{pool.token1} Reserve</p>
                    <p className="font-semibold text-white">{pool.token1Reserve.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{pool.token2} Reserve</p>
                    <p className="font-semibold text-white">{pool.token2Reserve.toFixed(0)}</p>
                  </div>
                </div>
              </div>

              <AddLiquidityModal triggerLabel="Add Liquidity" poolId={pool.id} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Liquidity Pool Analytics ── */}
      <PoolAnalytics />
    </div>
  );
}
