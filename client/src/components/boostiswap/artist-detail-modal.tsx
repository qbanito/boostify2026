import React, { useState, useEffect } from "react";
import { parseEther, formatEther } from 'viem';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  Users,
  Music2,
  Target,
  Zap,
  Award,
  Calendar,
  X,
  BarChart3,
  Rocket,
  ShoppingCart,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Wallet,
  ExternalLink,
  Coins,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWeb3 } from "@/hooks/use-web3";
import { useBTF2300 } from "@/hooks/use-btf2300";
import { ArtistProfile } from "@/data/artist-profiles";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TOKEN_PREFIXES, CONTRACT_PRICE_MATIC, getContractTokenId } from "@/lib/btf2300-token-mapping";
import { ArtistProgressWidget } from "./artist-progress-widget";
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface ArtistDetailModalProps {
  artist: ArtistProfile | null;
  isOpen: boolean;
  onClose: () => void;
  artistImage?: string;
}

// Modal component - siempre renderiza el contenido, Web3 se maneja internamente
export function ArtistDetailModal({
  artist,
  isOpen,
  onClose,
  artistImage,
}: ArtistDetailModalProps) {
  // Don't render anything if no artist
  if (!artist) return null;
  
  // Siempre renderizar el contenido - el botón de wallet manejará el estado de Web3
  return (
    <ArtistDetailModalContent
      artist={artist}
      isOpen={isOpen}
      onClose={onClose}
      artistImage={artistImage}
    />
  );
}

// Internal component that uses wagmi hooks - only rendered when Web3 is ready
function ArtistDetailModalContent({
  artist,
  isOpen,
  onClose,
  artistImage,
}: ArtistDetailModalProps) {
  const { address, isConnected, isWeb3Ready } = useWeb3();
  const { toast } = useToast();
  const btf2300 = useBTF2300();
  
  const [tokenAmount, setTokenAmount] = useState<number>(100);
  const [isSuccess, setIsSuccess] = useState(false);
  const [userBalance, setUserBalance] = useState<string>("0");
  const [artistOnChain, setArtistOnChain] = useState<any>(null);
  const [payMethod, setPayMethod] = useState<'matic' | 'card'>('matic');
  const [cardLoading, setCardLoading] = useState(false);
  const [cardSuccess, setCardSuccess] = useState(false);
  const [cardTxHash, setCardTxHash] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);

  // Fetch artist data from blockchain
  useEffect(() => {
    if (artist?.id && isWeb3Ready) {
      // Get artist info from contract
      btf2300.getArtist(artist.id).then(setArtistOnChain);
      
      // Get user balance if connected
      if (address) {
        const tokenId = TOKEN_PREFIXES.ARTIST + artist.id;
        btf2300.getTokenBalance(tokenId).then((balance) => {
          setUserBalance(balance.toString());
        });
      }
    }
  }, [artist?.id, address, btf2300, isWeb3Ready]);

  // artist is guaranteed to exist here
  if (!artist) return null;

  // Generate chart data for growth trends
  const generateGrowthData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month, i) => ({
      month,
      fans: artist.fans * (1 + (artist.growthMetrics.monthlyGrowth / 100) * i),
      streams: artist.streams * (1 + (artist.growthMetrics.monthlyGrowth / 100) * i),
      activityScore: Math.round(artist.fans / 1000 * (1 + (artist.growthMetrics.monthlyGrowth / 100) * i))
    }));
  };

  // IMPORTANTE: Los tokens comprables son SONGS (2000000000+), no ARTISTS
  // El contrato tiene canciones en tokenIds 2000000001 - 2000000008 con precio 0.001 MATIC
  const songTokenId = Number(getContractTokenId(artist.id)); // Usar función de mapeo
  const contractPrice = CONTRACT_PRICE_MATIC; // Precio real del contrato: 0.001 MATIC
  const totalCostMatic = (parseFloat(contractPrice) * tokenAmount).toFixed(4);
  // USD price: ~$0.001 per token (1 MATIC ≈ $0.40, contract price 0.001 MATIC)
  const USD_PER_TOKEN = 0.001;
  const totalCostUSD = (USD_PER_TOKEN * tokenAmount).toFixed(2);

  const handleBuyWithCard = async () => {
    if (!address) {
      toast({ title: "Wallet requerida", description: "Conecta tu wallet para recibir los tokens", variant: "destructive" });
      return;
    }
    if (tokenAmount <= 0) return;

    setCardLoading(true);
    setCardError(null);
    try {
      // Step 1: Create payment
      const usdAmount = Math.max(5, parseFloat(totalCostUSD)); // min $5
      const resp = await fetch('/api/btf-card/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usdAmount, walletAddress: address }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Error creando pago');

      // Step 2: Open Stripe Checkout in new window
      const { loadStripe } = await import('@stripe/stripe-js');
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
      let publishableKey = stripeKey;
      if (!publishableKey) {
        const keyResp = await fetch('/api/stripe/publishable-key');
        const keyData = await keyResp.json();
        publishableKey = keyData.publishableKey;
      }
      if (!publishableKey) throw new Error('Stripe no configurado');

      const stripe = await loadStripe(publishableKey);
      if (!stripe) throw new Error('Error cargando Stripe');

      const { error, paymentIntent } = await stripe.confirmPayment({
        clientSecret: data.clientSecret,
        confirmParams: { return_url: window.location.origin },
        redirect: 'if_required',
      });

      if (error) throw new Error(error.message || 'Pago fallido');

      if (paymentIntent?.status === 'succeeded') {
        // Step 3: Verify and get BTF transfer
        const verifyResp = await fetch('/api/btf-card/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purchaseId: data.purchaseId, paymentIntentId: paymentIntent.id }),
        });
        const verifyData = await verifyResp.json();
        if (verifyData.success && verifyData.txHash) {
          setCardTxHash(verifyData.txHash);
          setCardSuccess(true);
          toast({ title: '✅ Compra exitosa!', description: `${data.btfAmount} BTF enviados a tu wallet` });
        } else {
          throw new Error(verifyData.error || 'Error en transferencia');
        }
      }
    } catch (err: any) {
      setCardError(err.message);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCardLoading(false);
    }
  };

  const handleBuyTokens = async (selectedArtist: ArtistProfile) => {
    if (!isConnected) {
      toast({
        title: "Wallet no conectada",
        description: "Por favor conecta tu MetaMask para comprar tokens",
        variant: "destructive",
      });
      return;
    }

    if (!address) {
      toast({
        title: "Error",
        description: "No se pudo obtener tu dirección de wallet",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("🛒 Comprando tokens para:", selectedArtist.name);
      console.log(`📊 Song Token ID: ${songTokenId}, Cantidad: ${tokenAmount}, Precio: ${contractPrice} MATIC`);

      // Use the BTF-2300 hook to buy tokens - usando el tokenId de CANCIÓN
      const result = await btf2300.buyTokensDirect(songTokenId, tokenAmount, contractPrice);
      
      if (result.success) {
        setIsSuccess(true);
        // Refresh balance
        btf2300.getTokenBalance(songTokenId).then((balance) => {
          setUserBalance(balance.toString());
        });
      }
    } catch (error: any) {
      console.error("❌ Error:", error);
      toast({
        title: "Error en la compra",
        description: error.message || "No se pudo procesar la compra",
        variant: "destructive",
      });
    }
  };

  // Handle transaction confirmation
  useEffect(() => {
    if (isSuccess && btf2300.txHash) {
      toast({
        title: "✅ Compra exitosa!",
        description: `Transacción confirmada en Polygon`,
      });
    }
  }, [isSuccess, btf2300.txHash, toast]);

  const potentialColors = {
    High: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    "Very High": "bg-purple-500/20 text-purple-300 border-purple-500/30",
    Exceptional: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  };

  const engagementLabels: Record<string, string> = {
    High: "Popular",
    "Very High": "Highly Followed",
    Exceptional: "Top Creator",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700/50 text-white max-h-[90vh] overflow-y-auto">
        {/* Artist Image Header */}
        {artistImage && (
          <div className="relative w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] h-56 sm:h-64 -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 rounded-t-lg overflow-hidden">
            <img 
              src={artistImage} 
              alt={artist.name}
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900" />
          </div>
        )}
        
        <DialogHeader className={`${artistImage ? 'border-t border-slate-700/30' : 'border-b border-slate-700/30'} pb-4`}>
          <div className="flex items-start justify-between w-full">
            <div className="flex-1">
              <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                {artist.name}
              </DialogTitle>
              <p className="text-muted-foreground mt-1">{artist.genre}</p>
            </div>
            <Badge
              className={`${potentialColors[artist.investmentPotential]} border text-sm py-1 px-3`}
            >
              {engagementLabels[artist.investmentPotential] ?? artist.investmentPotential}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Artist Progress Milestones */}
          <ArtistProgressWidget 
            milestones={artist.milestones}
            streams={artist.streams}
          />

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-lg p-4 border border-orange-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-orange-400" />
                <p className="text-xs text-muted-foreground">Fans</p>
              </div>
              <p className="text-lg font-bold text-orange-300">
                {(artist.fans / 1000000).toFixed(1)}M
              </p>
              <p className="text-xs text-green-400 mt-1">↑ +12.5%/mo</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-lg p-4 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Music2 className="h-4 w-4 text-purple-400" />
                <p className="text-xs text-muted-foreground">Streams</p>
              </div>
              <p className="text-lg font-bold text-purple-300">
                {(artist.streams / 1000000).toFixed(0)}M
              </p>
              <p className="text-xs text-green-400 mt-1">↑ +145%/year</p>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-lg p-4 border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <p className="text-xs text-muted-foreground">Engagement</p>
              </div>
              <p className="text-lg font-bold text-green-400">{artist.roi}K+</p>
              <p className="text-xs text-orange-300 mt-1">Monthly Listeners</p>
            </div>

            <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 rounded-lg p-4 border border-pink-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-pink-400" />
                <p className="text-xs text-muted-foreground">Active Since</p>
              </div>
              <p className="text-lg font-bold text-pink-300">{artist.founded}</p>
              <p className="text-xs text-slate-400 mt-1">{new Date().getFullYear() - artist.founded} years</p>
            </div>
          </div>

          {/* Growth Trend Chart */}
          <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-orange-400" />
              <h3 className="font-semibold">6-Month Fan Activity Estimate</h3>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={generateGrowthData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
                <XAxis dataKey="month" stroke="rgba(148,163,184,0.5)" />
                <YAxis stroke="rgba(148,163,184,0.5)" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(100,116,139,0.3)' }} />
                <Legend />
                <Line type="monotone" dataKey="activityScore" stroke="#ff8800" strokeWidth={2} name="Fan Activity Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Growth Metrics */}
          <div className="bg-gradient-to-r from-slate-800/40 to-slate-900/40 rounded-lg p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-orange-400" />
              <h3 className="font-semibold">Growth Metrics</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Monthly Growth
                </p>
                <p className="text-2xl font-bold text-blue-400">
                  +{artist.growthMetrics.monthlyGrowth}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Yearly Growth
                </p>
                <p className="text-2xl font-bold text-purple-400">
                  +{artist.growthMetrics.yearlyGrowth}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Community Growth
                </p>
                <p className="text-2xl font-bold text-green-400">
                  +{artist.growthMetrics.tokenAppreciation}%
                </p>
              </div>
            </div>
          </div>

          {/* Highlights */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-5 w-5 text-yellow-400" />
              <h3 className="font-semibold">Achievements & Highlights</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {artist.highlights.map((highlight, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/20 flex items-start gap-2"
                >
                  <Zap className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{highlight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Market Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-pink-400" />
                <p className="text-xs text-muted-foreground">Target Audience</p>
              </div>
              <p className="text-sm font-semibold">{artist.targetAudience}</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-blue-400" />
                <p className="text-xs text-muted-foreground">Market Size</p>
              </div>
              <p className="text-sm font-semibold">{artist.marketSize}</p>
            </div>
          </div>

          {/* Roadmap */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Rocket className="h-5 w-5 text-orange-400" />
              <h3 className="font-semibold">Roadmap</h3>
            </div>
            <div className="space-y-2">
              {artist.roadmap.map((milestone, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-lg p-3 border border-orange-500/20 flex items-start gap-3"
                >
                  <div className="bg-orange-500/30 rounded-full p-1.5 mt-0.5">
                    <div className="w-2 h-2 bg-orange-400 rounded-full" />
                  </div>
                  <p className="text-sm">{milestone}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Artist Profile Link */}
          <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/10 rounded-lg p-4 border border-blue-500/30">
            <p className="text-sm text-muted-foreground mb-3">
              Learn more about{" "}
              <span className="font-semibold text-blue-300">
                {artist.name}
              </span>
            </p>
            <a 
              href={`/artist/${artist.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="w-full inline-block"
            >
              <Button 
                variant="outline"
                className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
              >
                Visit Profile Page
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>

          {/* Investment Call to Action */}
          <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/10 rounded-lg p-4 border border-orange-500/30">
            <p className="text-sm text-muted-foreground mb-3">
              Ready to invest in{" "}
              <span className="font-semibold text-orange-300">
                {artist.name}
              </span>
              's future?
            </p>
            
            {/* User Balance Display */}
            {isConnected && userBalance !== "0" && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-3 flex items-center gap-2">
                <Coins className="h-4 w-4 text-green-400" />
                <p className="text-sm text-green-300">
                  Tu balance: <span className="font-bold">{userBalance} tokens</span>
                </p>
              </div>
            )}

            {/* Artist On-Chain Status */}
            {artistOnChain && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-blue-400" />
                  <p className="text-xs text-blue-300 font-semibold">Artista verificado en Polygon</p>
                </div>
                <p className="text-xs text-slate-400">
                  Token ID: {songTokenId} • {artistOnChain.isVerified ? '✓ Verificado' : 'Pendiente'}
                </p>
              </div>
            )}

            {/* Payment method tabs */}
            <div className="flex gap-2 bg-slate-900/60 rounded-xl p-1 border border-slate-700/30 mb-3">
              <button
                onClick={() => setPayMethod('matic')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                  payMethod === 'matic'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Coins className="h-3.5 w-3.5" />
                MATIC
              </button>
              <button
                onClick={() => setPayMethod('card')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                  payMethod === 'card'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Tarjeta (USD)
              </button>
            </div>
            
            <div className="space-y-3">
              {!isConnected && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300">Conecta tu wallet para comprar tokens</p>
                </div>
              )}

              {/* Token Amount Input */}
              {isConnected && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Cantidad de tokens</label>
                    <Input
                      type="number"
                      value={tokenAmount}
                      onChange={(e) => setTokenAmount(parseInt(e.target.value) || 0)}
                      min={1}
                      max={10000}
                      className="bg-slate-800/50 border-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">
                      {payMethod === 'matic' ? 'Precio por token' : 'Precio USD'}
                    </label>
                    <div className="bg-slate-800/50 border border-slate-600 rounded-md px-3 py-2 text-sm font-semibold">
                      {payMethod === 'matic' ? (
                        <span className="text-orange-400">{contractPrice} MATIC</span>
                      ) : (
                        <span className="text-blue-400">${USD_PER_TOKEN} USD</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Total cost preview */}
              {isConnected && tokenAmount > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-2.5 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Total</span>
                  <span className={`text-sm font-bold ${payMethod === 'matic' ? 'text-orange-400' : 'text-blue-400'}`}>
                    {payMethod === 'matic' ? `${totalCostMatic} MATIC` : `$${totalCostUSD} USD`}
                  </span>
                </div>
              )}
              
              {/* Connect Wallet Button */}
              {!isConnected ? (
                isWeb3Ready ? (
                  <div className="w-full flex justify-center">
                    <ConnectButton 
                      showBalance={false}
                      chainStatus="icon"
                      accountStatus="address"
                      label="🔗 Conectar Wallet para Comprar"
                    />
                  </div>
                ) : (
                  <Button 
                    className="w-full font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    onClick={() => {
                      toast({
                        title: "⏳ Inicializando Web3...",
                        description: "Espera 2 segundos mientras se conecta a la blockchain. Intenta de nuevo.",
                      });
                    }}
                    data-testid="button-connect-wallet"
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Conectar Wallet
                  </Button>
                )
              ) : payMethod === 'matic' ? (
                /* ── MATIC Purchase ── */
                <>
                  <Button 
                    onClick={() => handleBuyTokens(artist)}
                    disabled={btf2300.isLoading || isSuccess || tokenAmount <= 0}
                    className="w-full font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="button-buy-artist-token"
                  >
                    {btf2300.isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando en Polygon...
                      </>
                    ) : isSuccess ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        ¡Compra exitosa!
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Comprar {tokenAmount} Tokens - {totalCostMatic} MATIC
                      </>
                    )}
                  </Button>
                  
                  <div className="w-full flex justify-center">
                    <ConnectButton 
                      showBalance={false}
                      chainStatus="icon"
                      accountStatus="address"
                    />
                  </div>
                </>
              ) : (
                /* ── Card (USD) Purchase ── */
                <>
                  {cardError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-400">{cardError}</p>
                    </div>
                  )}

                  <Button 
                    onClick={handleBuyWithCard}
                    disabled={cardLoading || cardSuccess || tokenAmount <= 0 || parseFloat(totalCostUSD) < 5}
                    className="w-full font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cardLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando pago...
                      </>
                    ) : cardSuccess ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        ¡Compra exitosa!
                      </>
                    ) : parseFloat(totalCostUSD) < 5 ? (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Mínimo $5.00 USD ({Math.ceil(5 / USD_PER_TOKEN).toLocaleString()} tokens)
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Pagar ${totalCostUSD} USD → {tokenAmount.toLocaleString()} Tokens
                      </>
                    )}
                  </Button>

                  {parseFloat(totalCostUSD) < 5 && tokenAmount > 0 && (
                    <p className="text-[10px] text-amber-400 text-center">
                      💡 Mínimo $5 USD para pago con tarjeta. Incrementa la cantidad a {Math.ceil(5 / USD_PER_TOKEN).toLocaleString()} tokens o más.
                    </p>
                  )}

                  <div className="w-full flex justify-center">
                    <ConnectButton 
                      showBalance={false}
                      chainStatus="icon"
                      accountStatus="address"
                    />
                  </div>
                </>
              )}
              
              <p className="text-xs text-slate-400 text-center">
                {isConnected ? (
                  payMethod === 'matic' ? (
                    <>💎 {tokenAmount} tokens @ {contractPrice} MATIC cada uno • Total: {totalCostMatic} MATIC</>
                  ) : (
                    <>💳 {tokenAmount} tokens @ ${USD_PER_TOKEN} USD cada uno • Total: ${totalCostUSD} USD</>
                  )
                ) : (
                  <>Conecta tu wallet para comprar tokens</>
                )}
              </p>
              
              {(btf2300.txHash || cardTxHash) && (
                <>
                  <a 
                    href={`https://polygonscan.com/tx/${btf2300.txHash || cardTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver transacción en PolygonScan
                  </a>
                  <Button
                    onClick={() => {
                      const tx = btf2300.txHash || cardTxHash || '';
                      const method = cardTxHash ? 'card' : 'matic';
                      const usd = method === 'card' ? `&usd=${totalCostUSD}` : '';
                      window.location.href = `/token-purchase-success?tx=${tx}&amount=${tokenAmount}&token=artist&artist=${encodeURIComponent(artist.name)}&method=${method}${usd}`;
                    }}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-sm py-2"
                  >
                    <Wallet className="h-4 w-4 mr-2" /> Agregar a Wallet & Ver Factura
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
