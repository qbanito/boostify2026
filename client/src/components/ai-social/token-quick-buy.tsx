/**
 * Token Quick Buy - Widget de compra rápida de tokens en el feed social
 * 
 * Integración BoostiSwap + Social Network
 * "Trade tokens while scrolling the AI feed"
 */

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Zap, 
  ExternalLink,
  Loader2,
  Wallet,
  ShoppingCart
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../../hooks/use-toast';
import { Link } from 'wouter';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface TokenQuickBuyProps {
  artistId: number;
  artistName: string;
  artistSlug?: string;
  compact?: boolean;
}

interface TokenData {
  id: number;
  tokenSymbol: string;
  pricePerTokenUsd: number;
  change24h: number;
  holders: number;
  volume24h: number;
  availableSupply: number;
  totalSupply: number;
}

export function TokenQuickBuy({ artistId, artistName, artistSlug, compact = false }: TokenQuickBuyProps) {
  const { toast } = useToast();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Fetch token data para este artista
  const { data: tokenData, isLoading } = useQuery<TokenData | null>({
    queryKey: ['/api/boostiswap/artist-token', artistId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/boostiswap/artist-token/${artistId}`);
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
    staleTime: 30000, // 30 segundos de cache
  });

  const handleQuickBuy = async (amount: number) => {
    setSelectedAmount(amount);
    setIsPurchasing(true);

    // Simular proceso de compra (en producción conectaría con wallet)
    toast({
      title: "🔗 Conectando Wallet...",
      description: "Abre tu wallet para confirmar la transacción",
    });

    // Redirigir a BoostiSwap con el token preseleccionado
    setTimeout(() => {
      setIsPurchasing(false);
      setSelectedAmount(null);
      // En producción: window.location.href = `/boostiswap?buy=${tokenData?.tokenSymbol}&amount=${amount}`;
      toast({
        title: "🚀 Compra Iniciada",
        description: `Redirigiendo a BoostiSwap para comprar ${amount} $${tokenData?.tokenSymbol}...`,
      });
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 bg-slate-800/30 rounded-lg animate-pulse">
        <Coins className="h-4 w-4 text-orange-400" />
        <span className="text-xs text-gray-400">Cargando token...</span>
      </div>
    );
  }

  if (!tokenData) {
    return null; // No mostrar widget si el artista no tiene token
  }

  const priceChange = parseFloat(String(tokenData.change24h)) || 0;
  const pricePerToken = parseFloat(String(tokenData.pricePerTokenUsd)) || 0;
  const isPositive = priceChange >= 0;
  const tokenSymbol = tokenData.tokenSymbol || artistName.split(' ')[0].toUpperCase().slice(0, 4);

  if (compact) {
    // Versión compacta para mostrar inline en posts
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 py-2 px-3 bg-gradient-to-r from-slate-800/50 to-slate-900/50 rounded-lg border border-orange-500/20 hover:border-orange-500/40 transition-colors"
      >
        <Coins className="h-4 w-4 text-orange-400" />
        <span className="font-bold text-orange-400">${tokenSymbol}</span>
        <span className="text-white font-medium">${pricePerToken.toFixed(2)}</span>
        <Badge 
          variant="outline" 
          className={cn(
            "text-xs",
            isPositive ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"
          )}
        >
          {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
          {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
        </Badge>
        <Link href={artistSlug ? `/boostiswap?artist=${artistSlug}` : '/boostiswap'}>
          <Button 
            size="sm" 
            className="h-6 px-2 bg-orange-500 hover:bg-orange-600 text-xs"
          >
            <ShoppingCart className="h-3 w-3 mr-1" />
            Buy
          </Button>
        </Link>
      </motion.div>
    );
  }

  // Versión expandida con opciones de compra rápida
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 p-3 bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-xl border border-orange-500/20"
    >
      {/* Header del token */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
            <Coins className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-orange-400">${tokenSymbol}</span>
              <span className="text-xs text-gray-400">Artist Token</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white font-semibold">${pricePerToken.toFixed(2)}</span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs px-1",
                  isPositive ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-red-400 border-red-400/30 bg-red-400/10"
                )}
              >
                {isPositive ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </div>

        <div className="text-right text-xs text-gray-400">
          <div>{tokenData.holders} holders</div>
          <div className="text-green-400">${(parseFloat(String(tokenData.volume24h)) / 1000).toFixed(1)}K vol</div>
        </div>
      </div>

      {/* Botones de compra rápida */}
      <div className="flex gap-2">
        {[10, 50, 100].map((amount) => (
          <Button
            key={amount}
            size="sm"
            variant="outline"
            disabled={isPurchasing}
            onClick={() => handleQuickBuy(amount)}
            className={cn(
              "flex-1 border-orange-500/30 hover:border-orange-500 hover:bg-orange-500/20",
              selectedAmount === amount && isPurchasing && "bg-orange-500/20 border-orange-500"
            )}
          >
            {selectedAmount === amount && isPurchasing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Zap className="h-3 w-3 mr-1 text-orange-400" />
                {amount}
              </>
            )}
          </Button>
        ))}
        <Link href={artistSlug ? `/boostiswap?artist=${artistSlug}` : '/boostiswap'}>
          <Button
            size="sm"
            className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
          >
            <Wallet className="h-3 w-3 mr-1" />
            Trade
          </Button>
        </Link>
      </div>

      {/* Footer con link a perfil completo */}
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
        <span>Powered by BoostiSwap</span>
        <Link href={`/boostiswap`}>
          <span className="flex items-center gap-1 text-orange-400 hover:text-orange-300 cursor-pointer">
            View on DEX <ExternalLink className="h-3 w-3" />
          </span>
        </Link>
      </div>
    </motion.div>
  );
}

/**
 * Trading Activity Badge - Muestra cuando un artista hace trading
 */
interface TradingActivityBadgeProps {
  action: 'buy' | 'sell';
  tokenSymbol: string;
  amount: number;
  artistName: string;
}

export function TradingActivityBadge({ action, tokenSymbol, amount, artistName }: TradingActivityBadgeProps) {
  const isBuy = action === 'buy';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        isBuy 
          ? "bg-green-500/20 text-green-400 border border-green-500/30" 
          : "bg-red-500/20 text-red-400 border border-red-500/30"
      )}
    >
      {isBuy ? (
        <TrendingUp className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      )}
      <span>
        {isBuy ? 'Bought' : 'Sold'} {amount} ${tokenSymbol}
      </span>
    </motion.div>
  );
}
