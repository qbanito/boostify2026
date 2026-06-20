import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWeb3 } from "@/hooks/use-web3";
import { useBTF2300 } from "@/hooks/use-btf2300";
import { useArtistTokens } from "@/hooks/use-artist-tokens";
import { useToast } from "@/hooks/use-toast";
import { TOKEN_PREFIXES } from "@/lib/btf2300-config";
import { formatEther } from "viem";
import { Loader2, Plus, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface AddLiquidityModalProps {
  triggerLabel?: string;
  poolId?: number;
}

export function AddLiquidityModal({ triggerLabel = "Add Liquidity", poolId }: AddLiquidityModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [maticAmount, setMaticAmount] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [poolInfo, setPoolInfo] = useState<any>(null);
  
  const { isConnected, address, isWeb3Ready } = useWeb3();
  const btf2300 = useBTF2300();
  const artistTokens = useArtistTokens();
  const { toast } = useToast();

  // Get token ID
  const getTokenId = (tokenIdStr: string) => {
    const artistId = parseInt(tokenIdStr);
    return TOKEN_PREFIXES.ARTIST + artistId;
  };

  // Fetch pool info when token selected
  useEffect(() => {
    if (selectedToken) {
      const tokenId = getTokenId(selectedToken);
      btf2300.getPoolInfo(tokenId).then(setPoolInfo);
    }
  }, [selectedToken, btf2300]);

  const handleAddLiquidity = async () => {
    if (!selectedToken || !tokenAmount || !maticAmount) {
      toast({
        title: "Error",
        description: "Completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: "Wallet no conectada",
        description: "Conecta tu wallet primero",
        variant: "destructive",
      });
      return;
    }

    const tokenId = getTokenId(selectedToken);
    
    const result = await btf2300.addLiquidity(
      tokenId,
      parseInt(tokenAmount),
      maticAmount,
      0 // minLPTokens
    );

    if (result.success) {
      setIsSuccess(true);
      // Refresh pool info
      btf2300.getPoolInfo(tokenId).then(setPoolInfo);
      
      setTimeout(() => {
        setIsSuccess(false);
        setOpen(false);
        setTokenAmount("");
        setMaticAmount("");
      }, 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle>Añadir Liquidez al DEX</DialogTitle>
          <DialogDescription>
            Provee liquidez para ganar fees de trading en Polygon
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isConnected && (
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-3 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <p className="text-amber-400 text-sm">Conecta tu wallet primero</p>
              </div>
              {isWeb3Ready ? (
                <ConnectButton 
                  showBalance={false}
                  chainStatus="icon"
                  accountStatus="address"
                  label="🔗 Conectar Wallet"
                />
              ) : (
                <Button 
                  onClick={() => toast({ title: "⏳ Inicializando Web3...", description: "Por favor espera un momento" })}
                  className="bg-purple-500 hover:bg-purple-600"
                >
                  Conectar Wallet
                </Button>
              )}
            </div>
          )}

          {/* Token Selection */}
          <div className="space-y-2">
            <Label>Token de Artista</Label>
            <Select value={selectedToken} onValueChange={setSelectedToken}>
              <SelectTrigger className="bg-slate-900/50 border-slate-700">
                <SelectValue placeholder="Selecciona un artista" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {artistTokens.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.symbol} - {t.artist}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Token Amount */}
          <div className="space-y-2">
            <Label>Cantidad de Tokens</Label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                className="bg-slate-900/50 border-slate-700 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Tokens
              </span>
            </div>
          </div>

          {/* MATIC Amount */}
          <div className="space-y-2">
            <Label>Cantidad de MATIC</Label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.0"
                value={maticAmount}
                onChange={(e) => setMaticAmount(e.target.value)}
                className="bg-slate-900/50 border-slate-700 pr-16"
                step="0.01"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                MATIC
              </span>
            </div>
          </div>

          {/* Pool Info */}
          {poolInfo && poolInfo.isActive && (
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2">Pool existente:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Reserva Tokens</p>
                  <p className="font-semibold text-white">{poolInfo.tokenReserve.toString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reserva MATIC</p>
                  <p className="font-semibold text-white">{formatEther(poolInfo.ethReserve)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total LP</p>
                  <p className="font-semibold text-orange-400">{poolInfo.totalLPTokens.toString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fees acumulados</p>
                  <p className="font-semibold text-green-400">{formatEther(poolInfo.feeAccumulated)}</p>
                </div>
              </div>
            </div>
          )}

          {/* No Pool - Will Create */}
          {selectedToken && (!poolInfo || !poolInfo.isActive) && (
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-blue-400 text-sm">
                Este token no tiene pool aún. Al añadir liquidez crearás un nuevo pool.
              </p>
            </div>
          )}

          <Button
            onClick={handleAddLiquidity}
            disabled={!isConnected || btf2300.isLoading || !selectedToken || !tokenAmount || !maticAmount || isSuccess}
            className="w-full bg-orange-500 hover:bg-orange-600"
          >
            {btf2300.isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando en Polygon...
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                ¡Liquidez Añadida!
              </>
            ) : (
              "Añadir Liquidez"
            )}
          </Button>

          {/* Transaction Link */}
          {btf2300.txHash && (
            <a 
              href={`https://polygonscan.com/tx/${btf2300.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="h-4 w-4" />
              Ver transacción en PolygonScan
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
