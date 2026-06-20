import { useState, useEffect } from 'react';
import { parseEther } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wallet, CheckCircle2 } from 'lucide-react';
import { BOOSTIFY_CONTRACT_ADDRESS, ERC1155_ABI } from '@/lib/web3-config';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useWeb3 } from '@/hooks/use-web3';

interface TokenizedSong {
  id: number;
  songName: string;
  tokenSymbol: string;
  availableSupply: number;
  pricePerTokenUsd: string;
  pricePerTokenEth?: string;
  contractAddress: string;
  tokenId: number;
}

interface BuyTokensDialogProps {
  song: TokenizedSong;
  artistName?: string;
  onClose: () => void;
}

export function BuyTokensDialog({ song, artistName, onClose }: BuyTokensDialogProps) {
  const { address, isConnected } = useWeb3();
  const { toast } = useToast();
  const [amount, setAmount] = useState(1);
  const [recorded, setRecorded] = useState(false);

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Record purchase and show toast once confirmed on-chain
  useEffect(() => {
    if (!isSuccess || recorded || !txHash || !address) return;
    setRecorded(true);

    const pricePerTokenEth = song.pricePerTokenEth || '0.0001';
    const totalPrice = (parseFloat(pricePerTokenEth) * amount).toString();

    apiRequest({
      url: '/api/tokenization/purchase/record',
      method: 'POST',
      data: {
        tokenizedSongId: song.id,
        buyerWalletAddress: address,
        amountTokens: amount,
        pricePaidEth: totalPrice,
        transactionHash: txHash,
      },
    }).catch(console.error);

    queryClient.invalidateQueries({ queryKey: ['/api/tokenization/songs/active'] });

    toast({
      title: '¡Compra exitosa!',
      description: `Has comprado ${amount} ${song.tokenSymbol} token${amount !== 1 ? 's' : ''}`,
    });

    setTimeout(onClose, 2500);
  }, [isSuccess, recorded, txHash, address, amount, song, onClose, toast]);

  // Show write error as toast
  useEffect(() => {
    if (!writeError) return;
    const msg = (writeError as any)?.shortMessage || writeError.message || 'Error al iniciar la transacción';
    toast({ title: 'Error en la transacción', description: msg, variant: 'destructive' });
  }, [writeError, toast]);

  const handlePurchase = () => {
    if (!address || amount <= 0 || amount > song.availableSupply) return;

    const pricePerTokenEth = song.pricePerTokenEth || '0.0001';
    const totalEth = (parseFloat(pricePerTokenEth) * amount).toString();

    // This opens MetaMask / connected wallet to confirm the transaction
    writeContract({
      address: (song.contractAddress || BOOSTIFY_CONTRACT_ADDRESS) as `0x${string}`,
      abi: ERC1155_ABI,
      functionName: 'buyTokens',
      args: [BigInt(song.tokenId), BigInt(amount)],
      value: parseEther(totalEth),
    });
  };

  const pricePerTokenEth = song.pricePerTokenEth || '0.0001';
  const totalPriceUsd = parseFloat(song.pricePerTokenUsd) * amount;
  const totalPriceEth = parseFloat(pricePerTokenEth) * amount;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent data-testid="dialog-buy-tokens">
        <DialogHeader>
          <DialogTitle>Comprar Tokens: {song.songName}</DialogTitle>
          <DialogDescription>
            {artistName && `Por ${artistName} • `}
            {song.tokenSymbol}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!isConnected ? (
            <div className="text-center py-8">
              <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Conecta tu wallet para comprar tokens
              </p>
              <ConnectButton />
            </div>
          ) : isConfirming || isPending ? (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
              <p className="font-semibold mb-2">
                {isConfirming ? 'Confirmando en blockchain...' : 'Aprobando en wallet...'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isConfirming
                  ? 'Esperando confirmación de la red Polygon'
                  : 'Por favor confirma la transacción en tu wallet'}
              </p>
            </div>
          ) : isSuccess ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <p className="font-semibold mb-2">¡Compra exitosa!</p>
              <p className="text-sm text-muted-foreground">
                Tus tokens han sido transferidos a tu wallet
              </p>
            </div>
          ) : (
            <>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Precio por token:</span>
                  <span className="font-medium">${song.pricePerTokenUsd}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Disponibles:</span>
                  <span className="font-medium">{song.availableSupply}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="amount">Cantidad de tokens</Label>
                <Input
                  id="amount"
                  type="number"
                  min={1}
                  max={song.availableSupply}
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
                  className="mt-2"
                  data-testid="input-token-amount"
                />
              </div>

              <div className="bg-primary/10 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold">Total:</span>
                  <div className="text-right">
                    <p className="font-bold text-lg">${totalPriceUsd.toFixed(2)} USD</p>
                    <p className="text-sm text-muted-foreground">
                      ≈ {totalPriceEth.toFixed(6)} MATIC
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handlePurchase}
                disabled={isPending || isConfirming || amount <= 0 || amount > song.availableSupply}
                data-testid="button-confirm-purchase"
              >
                {isPending || isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isPending ? 'Abriendo wallet...' : 'Confirmando...'}
                  </>
                ) : (
                  `Comprar ${amount} ${amount === 1 ? 'Token' : 'Tokens'}`
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                La transacción se ejecutará en Polygon blockchain a través de MetaMask
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
