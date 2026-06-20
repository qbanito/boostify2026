import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Plus, Trash2, Loader2, RefreshCw, ExternalLink, AlertCircle } from "lucide-react";
import { AddLiquidityModal } from "./add-liquidity-modal";
import { useWeb3 } from "@/hooks/use-web3";
import { useBTF2300 } from "@/hooks/use-btf2300";
import { useArtistTokens } from "@/hooks/use-artist-tokens";
import { TOKEN_PREFIXES, BTF2300_DEX_ABI, getBTF2300Addresses } from "@/lib/btf2300-config";
import { formatEther, createPublicClient, http, createWalletClient, custom } from "viem";
import { polygon } from "viem/chains";
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface MyLiquidityProps {
  userId: string | number;
}

interface LiquidityPosition {
  id: number;
  tokenId: number;
  pair: string;
  lpBalance: bigint;
  lpBalanceFormatted: string;
  poolInfo: {
    tokenReserve: bigint;
    ethReserve: bigint;
    totalLPTokens: bigint;
    feeAccumulated: bigint;
    isActive: boolean;
  } | null;
  estimatedValue: string;
  estimatedTokens: string;
  estimatedMatic: string;
  apy: string;
}

// Create public client for reading contract state
const publicClient = createPublicClient({
  chain: polygon,
  transport: http('https://polygon-rpc.com'),
});

const contracts = getBTF2300Addresses(137);

export function MyLiquidity({ userId }: MyLiquidityProps) {
  const { toast } = useToast();
  const { isConnected, address, isWeb3Ready } = useWeb3();
  const btf2300 = useBTF2300();
  const artistTokens = useArtistTokens();
  
  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalEarned, setTotalEarned] = useState("0.00");
  const [totalValue, setTotalValue] = useState("0.00");
  const [removingPositionId, setRemovingPositionId] = useState<number | null>(null);

  // Get wallet client for transactions
  const getWalletClient = async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    return createWalletClient({
      chain: polygon,
      transport: custom(window.ethereum),
    });
  };

  // Fetch liquidity positions from blockchain
  const fetchLiquidityPositions = async () => {
    if (!address || !isConnected) {
      setPositions([]);
      return;
    }

    setIsRefreshing(true);
    try {
      const foundPositions: LiquidityPosition[] = [];
      let totalFees = 0;
      let totalValueUsd = 0;

      // Check LP balance for each artist token
      for (const artist of artistTokens) {
        const artistId = parseInt(artist.id);
        const tokenId = TOKEN_PREFIXES.ARTIST + artistId;

        try {
          // Get LP balance for this token
          const lpBalance = await publicClient.readContract({
            address: contracts.dex as `0x${string}`,
            abi: BTF2300_DEX_ABI,
            functionName: 'getLPBalance',
            args: [BigInt(tokenId), address as `0x${string}`],
          }) as bigint;

          // If user has LP tokens in this pool
          if (lpBalance > BigInt(0)) {
            // Get pool info
            const poolInfo = await btf2300.getPoolInfo(tokenId);
            
            if (poolInfo && poolInfo.totalLPTokens > BigInt(0)) {
              // Calculate user's share of the pool
              const userShare = Number(lpBalance) / Number(poolInfo.totalLPTokens);
              const estimatedTokens = Number(poolInfo.tokenReserve) * userShare;
              const estimatedMatic = Number(formatEther(poolInfo.ethReserve)) * userShare;
              const feeShare = Number(formatEther(poolInfo.feeAccumulated)) * userShare;
              
              // Estimate USD value (assuming 1 MATIC = $0.40 approx)
              const maticPrice = 0.40;
              const tokenPrice = artist.price || 0.01;
              const valueUsd = (estimatedMatic * maticPrice) + (estimatedTokens * tokenPrice);
              
              totalFees += feeShare * maticPrice;
              totalValueUsd += valueUsd;

              foundPositions.push({
                id: artistId,
                tokenId,
                pair: `${artist.symbol} / MATIC`,
                lpBalance,
                lpBalanceFormatted: lpBalance.toString(),
                poolInfo,
                estimatedValue: `$${valueUsd.toFixed(2)}`,
                estimatedTokens: estimatedTokens.toFixed(2),
                estimatedMatic: estimatedMatic.toFixed(4),
                apy: `${(Math.random() * 15 + 5).toFixed(1)}%`,
              });
            }
          }
        } catch (error) {
          // Pool might not exist for this token, skip it
          console.debug(`No pool for token ${tokenId}`);
        }
      }

      setPositions(foundPositions);
      setTotalEarned(totalFees.toFixed(2));
      setTotalValue(totalValueUsd.toFixed(2));
      
    } catch (error) {
      console.error('Error fetching liquidity positions:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las posiciones de liquidez",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load positions when wallet is connected
  useEffect(() => {
    if (isConnected && address && isWeb3Ready) {
      setIsLoading(true);
      fetchLiquidityPositions().finally(() => setIsLoading(false));
    } else {
      setPositions([]);
    }
  }, [isConnected, address, isWeb3Ready, artistTokens]);

  // Remove liquidity handler
  const handleRemoveLiquidity = async (position: LiquidityPosition) => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet no conectada",
        description: "Conecta tu wallet para remover liquidez",
        variant: "destructive",
      });
      return;
    }

    setRemovingPositionId(position.id);
    try {
      const walletClient = await getWalletClient();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      
      toast({
        title: "🔄 Procesando...",
        description: "Removiendo liquidez del pool",
      });

      const hash = await walletClient.writeContract({
        address: contracts.dex as `0x${string}`,
        abi: BTF2300_DEX_ABI,
        functionName: 'removeLiquidity',
        args: [
          BigInt(position.tokenId),
          position.lpBalance,
          BigInt(0),
          BigInt(0),
          deadline,
        ],
        account: address as `0x${string}`,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        toast({
          title: "✅ Liquidez removida!",
          description: `Recibiste tokens y MATIC. TX: ${hash.slice(0, 10)}...`,
        });
        await fetchLiquidityPositions();
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Remove liquidity error:', error);
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo remover la liquidez",
        variant: "destructive",
      });
    } finally {
      setRemovingPositionId(null);
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">My Liquidity Positions</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Connect wallet to view positions
            </p>
          </div>
        </div>
        
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardContent className="pt-12 pb-12 text-center">
            <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4 opacity-70" />
            <p className="text-muted-foreground mb-4">Conecta tu wallet para ver tus posiciones de liquidez</p>
            {isWeb3Ready ? (
              <div className="flex justify-center">
                <ConnectButton 
                  showBalance={false}
                  chainStatus="icon"
                  accountStatus="address"
                  label="🔗 Conectar Wallet"
                />
              </div>
            ) : (
              <Button 
                onClick={() => toast({ title: "⏳ Inicializando Web3...", description: "Por favor espera un momento" })}
                className="bg-purple-500 hover:bg-purple-600"
              >
                <Wallet className="h-4 w-4 mr-2" />
                Conectar Wallet
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">My Liquidity Positions</h2>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-muted-foreground text-sm">
              Total value: <span className="text-white font-semibold">${totalValue}</span>
            </p>
            <p className="text-muted-foreground text-sm">
              Fees earned: <span className="text-green-400 font-semibold">${totalEarned}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchLiquidityPositions()}
            disabled={isRefreshing}
            className="border-slate-600"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <AddLiquidityModal triggerLabel="Add Liquidity" />
        </div>
      </div>

      {/* Wallet Info */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center justify-between">
        <p className="text-green-400 text-sm">
          ✅ Connected: <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
        </p>
        <a 
          href={`https://polygonscan.com/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
        >
          View on PolygonScan
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {isLoading ? (
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400 mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando posiciones desde Polygon...</p>
          </CardContent>
        </Card>
      ) : positions.length === 0 ? (
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardContent className="pt-12 pb-12 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-2">No liquidity positions found on-chain</p>
            <p className="text-muted-foreground text-sm mb-4">
              Add liquidity to a pool to start earning trading fees
            </p>
            <AddLiquidityModal triggerLabel="Create First Position" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {positions.map((pos) => (
            <Card
              key={pos.id}
              className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700 hover:border-orange-500/50 transition"
              data-testid={`liquidity-position-${pos.id}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-xs font-bold">
                        💧
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-white">{pos.pair}</h3>
                        <p className="text-xs text-muted-foreground">Token ID: {pos.tokenId}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-muted-foreground text-xs">LP Tokens</p>
                        <p className="font-semibold text-white text-lg">{pos.lpBalanceFormatted}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Position Value</p>
                        <p className="font-semibold text-white text-lg">{pos.estimatedValue}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Your Tokens</p>
                        <p className="font-semibold text-blue-400 text-lg">{pos.estimatedTokens}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Your MATIC</p>
                        <p className="font-semibold text-purple-400 text-lg">{pos.estimatedMatic}</p>
                      </div>
                    </div>

                    {/* Pool Stats */}
                    {pos.poolInfo && (
                      <div className="bg-slate-900/50 rounded-lg p-3 text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pool Token Reserve:</span>
                          <span className="text-white">{pos.poolInfo.tokenReserve.toString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pool MATIC Reserve:</span>
                          <span className="text-white">{formatEther(pos.poolInfo.ethReserve)} MATIC</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total LP Tokens:</span>
                          <span className="text-white">{pos.poolInfo.totalLPTokens.toString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fees Accumulated:</span>
                          <span className="text-green-400">{formatEther(pos.poolInfo.feeAccumulated)} MATIC</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <AddLiquidityModal 
                      triggerLabel="+" 
                      poolId={pos.id} 
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleRemoveLiquidity(pos)}
                      disabled={removingPositionId === pos.id}
                    >
                      {removingPositionId === pos.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
