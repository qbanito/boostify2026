import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useArtistTokens, ArtistToken } from "../../../hooks/use-artist-tokens";
import { TrendingUp, TrendingDown, Search } from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export function ArtistTokensDashboard() {
  const artistTokens = useArtistTokens();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedToken, setSelectedToken] = useState<ArtistToken | null>(null);

  // Generate mock price history for selected token
  const priceHistory = useMemo(() => {
    if (!selectedToken) return [];
    return Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      price: selectedToken.price * (1 + (Math.random() - 0.5) * 0.15),
    }));
  }, [selectedToken]);

  const filteredTokens = useMemo(() => {
    return artistTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.artist.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [artistTokens, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by artist or symbol..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-slate-800/50 border-slate-700"
        />
      </div>

      {/* Selected Token Chart */}
      {selectedToken && (
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardHeader className="border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                  📊
                </div>
                <div>
                  <CardTitle>{selectedToken.artist}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{selectedToken.genre}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-orange-400">
                  ${selectedToken.price.toFixed(2)}
                </p>
                <p
                  className={`text-sm font-semibold ${
                    selectedToken.change24h >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {selectedToken.change24h >= 0 ? "+" : ""}{selectedToken.change24h.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#f97316"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Token Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-700/50">
              <div>
                <p className="text-xs text-muted-foreground">Market Cap</p>
                <p className="font-semibold text-white mt-1">
                  ${(selectedToken.marketCap / 1000000).toFixed(2)}M
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">24h Volume</p>
                <p className="font-semibold text-white mt-1">
                  ${(selectedToken.volume24h / 1000).toFixed(0)}K
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Liquidity</p>
                <p className="font-semibold text-white mt-1">
                  ${(selectedToken.liquidity / 1000).toFixed(0)}K
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Symbol</p>
                <p className="font-semibold text-orange-400 mt-1">{selectedToken.symbol}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tokens Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTokens.map((token) => (
          <Card
            key={token.id}
            className={`bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700 cursor-pointer transition hover:border-orange-500/50 ${
              selectedToken?.id === token.id ? "border-orange-500 ring-1 ring-orange-500/50" : ""
            }`}
            onClick={() => setSelectedToken(token)}
            data-testid={`token-card-${token.symbol}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-sm font-bold">
                    {token.symbol[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{token.symbol}</p>
                    <p className="text-xs text-muted-foreground">{token.artist}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="bg-slate-700/50 border-slate-600 text-orange-400 text-xs"
                >
                  {token.genre}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-2xl font-bold text-orange-400">
                    ${token.price.toFixed(2)}
                  </span>
                  <span
                    className={`text-sm font-semibold flex items-center gap-1 ${
                      token.change24h >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {token.change24h >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(token.change24h).toFixed(2)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Market Cap</p>
                    <p className="font-semibold text-white">
                      ${(token.marketCap / 1000000).toFixed(2)}M
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Liquidity</p>
                    <p className="font-semibold text-white">
                      ${(token.liquidity / 1000).toFixed(0)}K
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
