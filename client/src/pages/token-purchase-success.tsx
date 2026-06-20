import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  CheckCircle2, Wallet, Copy, ExternalLink, ArrowLeft,
  Sparkles, CreditCard, Coins, ShieldCheck, Mail,
} from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════

const POLYGONSCAN_TX = 'https://polygonscan.com/tx/';

const BTF_TOKEN = {
  address: '0x3DF18dAa074D8744cC620a89CFc8b7c4138CEb05',
  symbol: 'BTF',
  decimals: 18,
  image: 'https://boostifymusic.com/btf_logo.png',
  name: 'Boostify Token',
};

const BTF2300_TOKEN = {
  address: '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027',
  symbol: 'BTF-2300',
  name: 'BTF-2300 Artist Token',
};

/**
 * Token Purchase Success Page
 * Shows after buying BTF or Artist tokens (MATIC or card).
 * 
 * URL params:
 *   tx        — transaction hash
 *   amount    — token amount purchased
 *   token     — 'btf' (default) or 'artist'
 *   artist    — artist name (if artist token)
 *   method    — 'matic' | 'card'
 *   usd       — USD amount (if card purchase)
 */
export default function TokenPurchaseSuccessPage() {
  const { toast } = useToast();
  const [params, setParams] = useState({
    txHash: '',
    amount: '',
    tokenType: 'btf' as 'btf' | 'artist',
    artistName: '',
    method: 'matic' as 'matic' | 'card',
    usdAmount: '',
  });
  const [addedToWallet, setAddedToWallet] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      txHash: sp.get('tx') || '',
      amount: sp.get('amount') || '0',
      tokenType: (sp.get('token') as 'btf' | 'artist') || 'btf',
      artistName: sp.get('artist') || '',
      method: (sp.get('method') as 'matic' | 'card') || 'matic',
      usdAmount: sp.get('usd') || '',
    });

    // Auto-send email invoice on load
    const tx = sp.get('tx');
    const amount = sp.get('amount');
    if (tx && amount) {
      sendEmailInvoice(sp);
    }
  }, []);

  const sendEmailInvoice = async (sp: URLSearchParams) => {
    if (emailSent || sendingEmail) return;
    setSendingEmail(true);
    try {
      const resp = await fetch('/api/btf-card/send-purchase-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: sp.get('tx') || '',
          amount: sp.get('amount') || '0',
          tokenType: sp.get('token') || 'btf',
          artistName: sp.get('artist') || '',
          method: sp.get('method') || 'matic',
          usdAmount: sp.get('usd') || '',
        }),
      });
      if (resp.ok) {
        setEmailSent(true);
      }
    } catch {
      // Silently fail — user can still see the success page
    } finally {
      setSendingEmail(false);
    }
  };

  const isBTF = params.tokenType === 'btf';
  const tokenSymbol = isBTF ? 'BTF' : 'BTF-2300';
  const tokenName = isBTF ? 'Boostify Token' : `${params.artistName || 'Artist'} Token`;
  const tokenAddress = isBTF ? BTF_TOKEN.address : BTF2300_TOKEN.address;

  // ── Add token to MetaMask / wallet ──
  const addTokenToWallet = useCallback(async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      toast({
        title: '⚠️ MetaMask no detectado',
        description: 'Instala MetaMask o usa un navegador con wallet compatible',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (isBTF) {
        // ERC-20 token
        const wasAdded = await ethereum.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20',
            options: {
              address: BTF_TOKEN.address,
              symbol: BTF_TOKEN.symbol,
              decimals: BTF_TOKEN.decimals,
              image: BTF_TOKEN.image,
            },
          },
        });
        if (wasAdded) {
          setAddedToWallet(true);
          toast({ title: '✅ BTF agregado a tu wallet!' });
        }
      } else {
        // ERC-1155 — can't use wallet_watchAsset for 1155 in MM, so copy address
        await navigator.clipboard.writeText(BTF2300_TOKEN.address);
        setAddedToWallet(true);
        toast({
          title: '📋 Dirección copiada',
          description: 'Importa manualmente el NFT en tu wallet con esta dirección',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'No se pudo agregar el token',
        variant: 'destructive',
      });
    }
  }, [isBTF, toast]);

  const copyAddress = useCallback(async () => {
    await navigator.clipboard.writeText(tokenAddress);
    toast({ title: '📋 Dirección copiada al portapapeles' });
  }, [tokenAddress, toast]);

  const copyTxHash = useCallback(async () => {
    if (params.txHash) {
      await navigator.clipboard.writeText(params.txHash);
      toast({ title: '📋 Hash de transacción copiado' });
    }
  }, [params.txHash, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-green-500/5">
      <div className="container max-w-3xl mx-auto px-4 py-12">
        {/* ── Success Animation ── */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative p-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-2xl shadow-green-500/30">
              <CheckCircle2 className="h-16 w-16 text-white" />
            </div>
          </div>
        </motion.div>

        {/* ── Title ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            ¡Compra{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-500">
              Exitosa!
            </span>
          </h1>
          <p className="text-lg text-muted-foreground">
            {isBTF
              ? `Has comprado ${Number(params.amount).toLocaleString()} BTF`
              : `Has comprado ${Number(params.amount).toLocaleString()} tokens de ${params.artistName || 'artista'}`}
          </p>
          {params.method === 'card' && params.usdAmount && (
            <p className="text-sm text-green-400 mt-1">
              Pagado: ${Number(params.usdAmount).toFixed(2)} USD con tarjeta
            </p>
          )}
        </motion.div>

        {/* ── Transaction Details Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-6"
        >
          <Card className="border-green-500/30 bg-gradient-to-br from-background to-green-500/5 shadow-xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-600" />
            <CardContent className="p-6 md:p-8 space-y-5">
              {/* Purchase Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <div className="text-sm text-muted-foreground mb-1">Token</div>
                  <div className="flex items-center gap-2">
                    {isBTF && <img src="/btf_logo.png" alt="BTF" className="w-6 h-6 rounded" />}
                    <span className="font-bold text-white">{tokenSymbol}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <div className="text-sm text-muted-foreground mb-1">Cantidad</div>
                  <div className="font-bold text-green-400 text-lg">
                    {Number(params.amount).toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <div className="text-sm text-muted-foreground mb-1">Red</div>
                  <div className="font-bold text-purple-400">Polygon</div>
                </div>
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <div className="text-sm text-muted-foreground mb-1">Método</div>
                  <div className="flex items-center gap-2 font-bold text-white">
                    {params.method === 'card'
                      ? <><CreditCard className="h-4 w-4 text-blue-400" /> Tarjeta</>
                      : <><Coins className="h-4 w-4 text-orange-400" /> MATIC</>}
                  </div>
                </div>
              </div>

              {/* Transaction Hash */}
              {params.txHash && (
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="text-sm text-muted-foreground mb-2">Transacción (hash)</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-green-400 flex-1 truncate">
                      {params.txHash}
                    </code>
                    <button onClick={copyTxHash} className="p-1.5 hover:bg-slate-700 rounded transition-colors">
                      <Copy className="h-4 w-4 text-gray-400" />
                    </button>
                    <a
                      href={`${POLYGONSCAN_TX}${params.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                    >
                      <ExternalLink className="h-4 w-4 text-green-400" />
                    </a>
                  </div>
                </div>
              )}

              {/* Email Sent Indicator */}
              {emailSent && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Mail className="h-5 w-5 text-blue-400" />
                  <span className="text-sm text-blue-300">
                    Se ha enviado un email con la factura de tu compra
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Add Token to Wallet Guide ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-6"
        >
          <Card className="border-orange-500/30 bg-gradient-to-br from-background to-orange-500/5 shadow-xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />
            <CardContent className="p-6 md:p-8">
              <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                <Wallet className="h-5 w-5 text-orange-400" />
                Agregar Token a tu Wallet
              </h2>

              <p className="text-muted-foreground mb-5 text-sm">
                Para ver tus {tokenSymbol} en MetaMask u otra wallet compatible, sigue estos pasos:
              </p>

              {/* Steps */}
              <div className="space-y-4 mb-6">
                <div className="relative pl-10 space-y-5">
                  {/* Vertical Line */}
                  <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gradient-to-b from-orange-500 via-orange-500/50 to-orange-500/10" />

                  {/* Step 1 — Automatic */}
                  <div className="relative">
                    <div className="absolute -left-6 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white">1</div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">Método Automático (Recomendado)</h3>
                      <p className="text-muted-foreground text-xs mt-1">
                        Haz clic en el botón de abajo y MetaMask te pedirá aprobación para agregar el token.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 — Manual */}
                  <div className="relative">
                    <div className="absolute -left-6 w-5 h-5 rounded-full bg-orange-500/60 flex items-center justify-center text-[10px] font-bold text-white">2</div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">Método Manual</h3>
                      <p className="text-muted-foreground text-xs mt-1">
                        Abre MetaMask → <strong>Importar Tokens</strong> → pega la dirección del contrato:
                      </p>
                      <div className="flex items-center gap-2 mt-2 p-2.5 bg-slate-800/70 rounded-lg border border-slate-700/50">
                        <code className="text-xs text-orange-400 flex-1 truncate">{tokenAddress}</code>
                        <button
                          onClick={copyAddress}
                          className="p-1 hover:bg-slate-700 rounded transition-colors flex-shrink-0"
                        >
                          <Copy className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                      </div>
                      {isBTF && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 bg-slate-800/40 rounded">
                            <span className="text-muted-foreground">Símbolo:</span>{' '}
                            <span className="text-white font-semibold">BTF</span>
                          </div>
                          <div className="p-2 bg-slate-800/40 rounded">
                            <span className="text-muted-foreground">Decimales:</span>{' '}
                            <span className="text-white font-semibold">18</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3 — Verify */}
                  <div className="relative">
                    <div className="absolute -left-6 w-5 h-5 rounded-full bg-orange-500/30 flex items-center justify-center text-[10px] font-bold text-white">3</div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">Verificar Balance</h3>
                      <p className="text-muted-foreground text-xs mt-1">
                        Asegúrate de estar en la red <strong className="text-purple-400">Polygon</strong> en tu wallet.
                        Los tokens aparecerán automáticamente una vez confirmada la transacción.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add Token Button */}
              <Button
                onClick={addTokenToWallet}
                disabled={addedToWallet}
                className={`w-full ${
                  addedToWallet
                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
                } font-semibold py-3`}
              >
                {addedToWallet ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {isBTF ? 'BTF Agregado a tu Wallet' : 'Dirección Copiada'}
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4 mr-2" />
                    {isBTF ? 'Agregar BTF a MetaMask' : 'Copiar Dirección del Contrato'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Security Note ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mb-6"
        >
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <ShieldCheck className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <strong className="text-emerald-400">Tus tokens están seguros.</strong>{' '}
              La transacción ha sido confirmada en la blockchain de Polygon. 
              Siempre puedes verificar tu balance en{' '}
              <a
                href={`https://polygonscan.com/token/${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                PolygonScan
              </a>.
            </div>
          </div>
        </motion.div>

        {/* ── Action Buttons ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Link href="/boostiswap">
            <Button variant="outline" className="w-full sm:flex-1 border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver a BoostiSwap
            </Button>
          </Link>
          <Link href="/btf-wallet">
            <Button className="w-full sm:flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
              <Sparkles className="h-4 w-4 mr-2" /> Ver mi Portfolio
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
