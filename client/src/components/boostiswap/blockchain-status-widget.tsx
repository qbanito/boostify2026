/**
 * BTF-2300 Blockchain Status Widget
 * 
 * Muestra el estado de los contratos en Polygon Mainnet
 */

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBTF2300 } from "@/hooks/use-btf2300";
import { useWeb3 } from "@/hooks/use-web3";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink, 
  Wallet, 
  Coins,
  Users,
  Music,
  RefreshCw
} from "lucide-react";

export function BlockchainStatusWidget() {
  const btf2300 = useBTF2300();
  const { isConnected, address, chainId } = useWeb3();
  const [tokenCounts, setTokenCounts] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [contractsStatus, setContractsStatus] = useState<{
    artistToken: boolean;
    dex: boolean;
    royalties: boolean;
  } | null>(null);

  const checkContracts = async () => {
    setIsLoading(true);
    try {
      // Check if contracts are responding
      const counts = await btf2300.getTokenCounts();
      setTokenCounts(counts);
      
      // If we got counts, contracts are working
      setContractsStatus({
        artistToken: true,
        dex: true,
        royalties: true,
      });
    } catch (error) {
      console.error('Error checking contracts:', error);
      setContractsStatus({
        artistToken: false,
        dex: false,
        royalties: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkContracts();
  }, []);

  const getNetworkName = (id?: number) => {
    switch (id) {
      case 137: return 'Polygon Mainnet';
      case 80001: return 'Polygon Mumbai';
      case 80002: return 'Polygon Amoy';
      case 1: return 'Ethereum Mainnet';
      default: return 'Unknown Network';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-slate-800/50 to-purple-900/20 border-purple-500/30">
      <CardHeader className="border-b border-slate-700/50 pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            BTF-2300 Blockchain Status
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={checkContracts}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Network Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Network</span>
          <Badge className={chainId === 137 ? 'bg-purple-500/20 text-purple-300' : 'bg-yellow-500/20 text-yellow-300'}>
            {getNetworkName(chainId)}
          </Badge>
        </div>

        {/* Wallet Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Wallet</span>
          {isConnected ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-xs text-green-400 font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-xs text-red-400">No conectada</span>
            </div>
          )}
        </div>

        {/* Contract Status */}
        <div className="space-y-2 pt-2 border-t border-slate-700/50">
          <p className="text-xs text-muted-foreground font-semibold">Contratos Desplegados</p>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
            </div>
          ) : (
            <div className="space-y-2">
              {/* ArtistToken Contract */}
              <div className="flex items-center justify-between bg-slate-900/30 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-400" />
                  <span className="text-sm">ArtistToken</span>
                </div>
                <div className="flex items-center gap-2">
                  {contractsStatus?.artistToken ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <a
                    href={`https://polygonscan.com/address/${btf2300.contracts.artistToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* DEX Contract */}
              <div className="flex items-center justify-between bg-slate-900/30 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-green-400" />
                  <span className="text-sm">DEX</span>
                </div>
                <div className="flex items-center gap-2">
                  {contractsStatus?.dex ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <a
                    href={`https://polygonscan.com/address/${btf2300.contracts.dex}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Royalties Contract */}
              <div className="flex items-center justify-between bg-slate-900/30 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-purple-400" />
                  <span className="text-sm">Royalties</span>
                </div>
                <div className="flex items-center gap-2">
                  {contractsStatus?.royalties ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <a
                    href={`https://polygonscan.com/address/${btf2300.contracts.royalties}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Token Counts */}
        {tokenCounts && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50">
            <div className="bg-orange-500/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-orange-400">{tokenCounts.totalArtists}</p>
              <p className="text-xs text-muted-foreground">Artistas</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-purple-400">{tokenCounts.totalSongs}</p>
              <p className="text-xs text-muted-foreground">Canciones</p>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-blue-400">{tokenCounts.totalCatalogs}</p>
              <p className="text-xs text-muted-foreground">Catálogos</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-green-400">{tokenCounts.totalLicenses}</p>
              <p className="text-xs text-muted-foreground">Licencias</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
