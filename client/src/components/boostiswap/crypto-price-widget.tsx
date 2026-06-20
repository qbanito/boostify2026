import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Loader2, WifiOff } from "lucide-react";

interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  image: string;
  marketCap: number;
  volume24h: number;
}

// CoinGecko API IDs
const CRYPTO_IDS = ['bitcoin', 'ethereum', 'solana', 'avalanche-2', 'matic-network', 'chainlink'];

// Fallback data in case API fails
const FALLBACK_PRICES: CryptoPrice[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 0, change24h: 0, image: '₿', marketCap: 0, volume24h: 0 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 0, change24h: 0, image: 'Ξ', marketCap: 0, volume24h: 0 },
  { id: 'solana', symbol: 'SOL', name: 'Solana', price: 0, change24h: 0, image: '◎', marketCap: 0, volume24h: 0 },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', price: 0, change24h: 0, image: '🔺', marketCap: 0, volume24h: 0 },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon', price: 0, change24h: 0, image: '⬡', marketCap: 0, volume24h: 0 },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', price: 0, change24h: 0, image: '⬢', marketCap: 0, volume24h: 0 },
];

// Symbol icons mapping
const SYMBOL_ICONS: Record<string, string> = {
  'bitcoin': '₿',
  'ethereum': 'Ξ',
  'solana': '◎',
  'avalanche-2': '🔺',
  'matic-network': '⬡',
  'chainlink': '⬢',
};

export function CryptoPriceWidget() {
  const [prices, setPrices] = useState<CryptoPrice[]>(FALLBACK_PRICES);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      setError(null);
      
      // CoinGecko free API endpoint (no API key required)
      const ids = CRYPTO_IDS.join(',');
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      const formattedPrices: CryptoPrice[] = data.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h || 0,
        image: SYMBOL_ICONS[coin.id] || '●',
        marketCap: coin.market_cap,
        volume24h: coin.total_volume,
      }));

      setPrices(formattedPrices);
      setLastUpdate(new Date());
      setIsOnline(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching crypto prices:', err);
      setError('Failed to fetch prices');
      setIsOnline(false);
      setIsLoading(false);
      
      // Keep previous prices if we had any valid ones
      if (prices[0]?.price === 0) {
        setPrices(FALLBACK_PRICES);
      }
    }
  }, [prices]);

  useEffect(() => {
    // Initial fetch
    fetchPrices();

    // Refresh every 30 seconds (CoinGecko free tier allows ~10-50 calls/minute)
    const interval = setInterval(fetchPrices, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    } else if (price >= 1) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    }
  };

  return (
    <div className="bg-slate-800/30 border-t border-b border-slate-700/50 py-2 px-4 overflow-hidden">
      <div className="flex items-center gap-4">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isOnline ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-400 font-medium">LIVE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="text-[10px] text-red-400 font-medium">OFFLINE</span>
            </>
          )}
        </div>

        {/* Scrollable prices */}
        <div className="overflow-x-auto scrollbar-hide flex-1">
          <div className="flex gap-6 min-w-min">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading prices...</span>
              </div>
            ) : (
              prices.map((crypto) => (
                <div
                  key={crypto.id}
                  className="flex-shrink-0 flex items-center gap-2 hover:opacity-80 transition group cursor-pointer"
                  title={`${crypto.name}\nMarket Cap: $${(crypto.marketCap / 1e9).toFixed(2)}B\n24h Volume: $${(crypto.volume24h / 1e9).toFixed(2)}B`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold text-orange-400">
                    {crypto.image}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white whitespace-nowrap">{crypto.symbol}</p>
                    <p className="text-xs text-muted-foreground">
                      ${crypto.price > 0 ? formatPrice(crypto.price) : '--'}
                    </p>
                  </div>
                  <div className={`flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap ${
                    crypto.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {crypto.change24h >= 0 ? (
                      <TrendingUp className="h-2.5 w-2.5" />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5" />
                    )}
                    {crypto.price > 0 ? `${Math.abs(crypto.change24h).toFixed(1)}%` : '--'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Last update & refresh */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchPrices}
            disabled={isLoading}
            className="p-1 hover:bg-slate-700/50 rounded transition disabled:opacity-50"
            title="Refresh prices"
          >
            <RefreshCw className={`h-3 w-3 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Data source attribution */}
      <div className="text-[9px] text-muted-foreground/50 text-right mt-1">
        Powered by CoinGecko API
      </div>
    </div>
  );
}
