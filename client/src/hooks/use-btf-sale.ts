/**
 * useBTFSale — Hook for buying BTF directly via BTFTokenSale contract
 * 
 * This is the PRIMARY purchase method when no DEX liquidity pool exists.
 * Users send MATIC → receive BTF at the configured rate.
 * 
 * Falls back gracefully when sale contract is not deployed yet.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  parseEther, formatEther,
  createPublicClient, http, createWalletClient, custom, fallback,
  type Address,
} from 'viem';
import { polygon } from 'viem/chains';
import { useWeb3 } from './use-web3';
import { useToast } from './use-toast';
import { BTF_TOKEN_ADDRESS, BTF_SALE_ADDRESS } from '@/lib/btf-token-config';

// ═══════════════════════════════════════════════════════
//  RPC CLIENT
// ═══════════════════════════════════════════════════════

const POLYGON_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://rpc.ankr.com/polygon',
  'https://1rpc.io/matic',
  'https://polygon-rpc.com',
];

const publicClient = createPublicClient({
  chain: polygon,
  transport: fallback(
    POLYGON_RPCS.map(url => http(url, { timeout: 10000, retryCount: 2 })),
    { rank: true }
  ),
});

// ═══════════════════════════════════════════════════════
//  ABI (minimal — only what the frontend needs)
// ═══════════════════════════════════════════════════════

const SALE_ABI = [
  {
    inputs: [],
    name: 'buyTokens',
    outputs: [{ name: 'btfAmount', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'maticAmount', type: 'uint256' }],
    name: 'getQuote',
    outputs: [
      { name: 'btfAmount', type: 'uint256' },
      { name: 'isAvailable', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getSaleInfo',
    outputs: [
      { name: '_rate', type: 'uint256' },
      { name: '_minPurchase', type: 'uint256' },
      { name: '_maxPurchase', type: 'uint256' },
      { name: '_btfAvailable', type: 'uint256' },
      { name: '_totalRaised', type: 'uint256' },
      { name: '_totalSold', type: 'uint256' },
      { name: '_totalPurchases', type: 'uint256' },
      { name: '_isPaused', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'rate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'purchasedByWallet',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ═══════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════

export interface SaleInfo {
  rate: string;            // BTF per 1 MATIC (formatted)
  rateRaw: bigint;
  minPurchase: string;     // Min MATIC (formatted)
  maxPurchase: string;     // Max MATIC (formatted)
  btfAvailable: string;    // BTF in contract (formatted)
  totalRaised: string;     // MATIC raised (formatted)
  totalSold: string;       // BTF sold (formatted)
  totalPurchases: number;
  isPaused: boolean;
  isActive: boolean;       // deployed + not paused + has BTF
}

export interface SaleQuote {
  inputMatic: string;
  outputBTF: string;
  outputBTFRaw: bigint;
  isAvailable: boolean;
  rate: string;
}

export type SaleStatus = 'idle' | 'quoting' | 'buying' | 'success' | 'error';

// ═══════════════════════════════════════════════════════
//  HOOK
// ═══════════════════════════════════════════════════════

export function useBTFSale() {
  const { address, isConnected, chainId } = useWeb3();
  const { toast } = useToast();

  const [status, setStatus] = useState<SaleStatus>('idle');
  const [saleInfo, setSaleInfo] = useState<SaleInfo | null>(null);
  const [quote, setQuote] = useState<SaleQuote | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDeployed = !!BTF_SALE_ADDRESS && BTF_SALE_ADDRESS !== '0x0000000000000000000000000000000000000000';

  // ── Wallet Client ──
  const getWalletClient = useCallback(async () => {
    if (!window.ethereum) throw new Error('MetaMask not installed');
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    // Ensure we're on Polygon — switch if needed and wait for confirmation
    const currentChainHex = await window.ethereum.request({ method: 'eth_chainId' }) as string;
    const currentChain = parseInt(currentChainHex, 16);

    if (currentChain !== 137) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x89' }],
        });
      } catch (e: any) {
        if (e.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x89',
              chainName: 'Polygon Mainnet',
              nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
              rpcUrls: ['https://polygon-rpc.com/'],
              blockExplorerUrls: ['https://polygonscan.com/'],
            }],
          });
        } else {
          throw new Error('Cambia tu wallet a Polygon para continuar');
        }
      }

      // Wait for the chain to actually switch (MetaMask is async)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout esperando cambio a Polygon')), 15000);
        const check = async () => {
          const hex = await window.ethereum.request({ method: 'eth_chainId' }) as string;
          if (parseInt(hex, 16) === 137) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(check, 500);
          }
        };
        check();
      });
    }

    return createWalletClient({ chain: polygon, transport: custom(window.ethereum) });
  }, []);

  // ═════════════════════════════════════════
  //  FETCH SALE INFO
  // ═════════════════════════════════════════

  const fetchSaleInfo = useCallback(async () => {
    if (!isDeployed) {
      setSaleInfo(null);
      return;
    }

    try {
      const info = await publicClient.readContract({
        address: BTF_SALE_ADDRESS as Address,
        abi: SALE_ABI,
        functionName: 'getSaleInfo',
      });

      const rateFormatted = formatEther(info[0]);
      const btfAvailable = formatEther(info[3]);

      setSaleInfo({
        rate: rateFormatted,
        rateRaw: info[0],
        minPurchase: formatEther(info[1]),
        maxPurchase: formatEther(info[2]),
        btfAvailable,
        totalRaised: formatEther(info[4]),
        totalSold: formatEther(info[5]),
        totalPurchases: Number(info[6]),
        isPaused: info[7],
        isActive: !info[7] && parseFloat(btfAvailable) > 0,
      });
    } catch (err) {
      console.error('[BTFSale] getSaleInfo error:', err);
      setSaleInfo(null);
    }
  }, [isDeployed]);

  // Auto-fetch sale info
  useEffect(() => {
    fetchSaleInfo();
    const interval = setInterval(fetchSaleInfo, 30000);
    return () => clearInterval(interval);
  }, [fetchSaleInfo]);

  // ═════════════════════════════════════════
  //  GET QUOTE
  // ═════════════════════════════════════════

  const getQuote = useCallback(async (maticAmount: string): Promise<SaleQuote | null> => {
    if (!isDeployed || !maticAmount || parseFloat(maticAmount) <= 0) {
      setQuote(null);
      return null;
    }

    setStatus('quoting');
    try {
      const amountWei = parseEther(maticAmount);

      const result = await publicClient.readContract({
        address: BTF_SALE_ADDRESS as Address,
        abi: SALE_ABI,
        functionName: 'getQuote',
        args: [amountWei],
      });

      const btfAmount = result[0];
      const isAvailable = result[1];

      const q: SaleQuote = {
        inputMatic: maticAmount,
        outputBTF: formatEther(btfAmount),
        outputBTFRaw: btfAmount,
        isAvailable,
        rate: saleInfo?.rate || formatEther(btfAmount / BigInt(Math.max(1, Math.floor(parseFloat(maticAmount))))),
      };

      setQuote(q);
      setStatus('idle');
      return q;
    } catch (err) {
      console.error('[BTFSale] getQuote error:', err);
      // Fallback: calculate locally if contract call fails
      if (saleInfo?.rateRaw) {
        const amountWei = parseEther(maticAmount);
        const btfRaw = (amountWei * saleInfo.rateRaw) / BigInt(1e18);
        const q: SaleQuote = {
          inputMatic: maticAmount,
          outputBTF: formatEther(btfRaw),
          outputBTFRaw: btfRaw,
          isAvailable: parseFloat(saleInfo.btfAvailable) >= parseFloat(formatEther(btfRaw)),
          rate: saleInfo.rate,
        };
        setQuote(q);
        setStatus('idle');
        return q;
      }
      setQuote(null);
      setStatus('idle');
      return null;
    }
  }, [isDeployed, saleInfo]);

  // ═════════════════════════════════════════
  //  BUY TOKENS
  // ═════════════════════════════════════════

  const buyBTF = useCallback(async (maticAmount: string): Promise<string | null> => {
    if (!isConnected || !address) {
      toast({ title: 'Conecta Wallet', description: 'Conecta tu wallet para comprar BTF', variant: 'destructive' });
      return null;
    }

    if (!isDeployed) {
      toast({ title: 'Sale no disponible', description: 'El contrato de venta no está desplegado aún', variant: 'destructive' });
      return null;
    }

    setError(null);
    setStatus('buying');

    try {
      toast({ title: 'Comprando BTF...', description: `${maticAmount} MATIC → BTF. Confirma en tu wallet` });

      const walletClient = await getWalletClient();

      const hash = await walletClient.writeContract({
        address: BTF_SALE_ADDRESS as Address,
        abi: SALE_ABI,
        functionName: 'buyTokens',
        args: [],
        value: parseEther(maticAmount),
        account: address as Address,
        chain: polygon,
      });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setTxHash(hash);
        setStatus('success');

        // Calculate expected output
        const expectedBTF = quote?.outputBTF || '—';
        toast({ title: '¡Compra Exitosa! 🎉', description: `Compraste ~${parseFloat(expectedBTF).toFixed(2)} BTF` });
        fetchSaleInfo(); // Refresh
        return hash;
      } else {
        throw new Error('Transaction reverted');
      }
    } catch (err: any) {
      console.error('[BTFSale] Buy error:', err);
      const msg = err.shortMessage || err.message || 'Purchase failed';
      setError(msg);
      setStatus('error');
      toast({ title: 'Compra Fallida', description: msg, variant: 'destructive' });
      return null;
    }
  }, [isConnected, address, isDeployed, getWalletClient, toast, fetchSaleInfo, quote]);

  // Reset
  const reset = useCallback(() => {
    setStatus('idle');
    setQuote(null);
    setTxHash(null);
    setError(null);
  }, []);

  return {
    // State
    status,
    saleInfo,
    quote,
    txHash,
    error,
    isDeployed,
    isActive: saleInfo?.isActive ?? false,

    // Actions
    getQuote,
    buyBTF,
    fetchSaleInfo,
    reset,
  };
}
