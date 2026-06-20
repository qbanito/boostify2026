/**
 * useBTFSwap — Hook for swapping MATIC ↔ BTF directly on QuickSwap (Uniswap V2 fork)
 * 
 * Interacts with the QuickSwap Router V2 on Polygon Mainnet to:
 *   - Get real-time quotes (MATIC → BTF and BTF → MATIC)
 *   - Execute swaps on-chain
 *   - Track transaction status
 * 
 * No external APIs needed — 100% on-chain via router contract
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  parseEther, formatEther, parseUnits, formatUnits,
  createPublicClient, http, createWalletClient, custom, fallback,
  type Address,
} from 'viem';
import { polygon } from 'viem/chains';
import { useWeb3 } from './use-web3';
import { useToast } from './use-toast';
import { BTF_TOKEN_ADDRESS } from '@/lib/btf-token-config';

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════

// QuickSwap Router V2 on Polygon
const QUICKSWAP_ROUTER = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff' as const;
// WMATIC on Polygon
const WMATIC = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' as const;
// QuickSwap Factory V2
const QUICKSWAP_FACTORY = '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32' as const;

// Polygon RPC fallbacks
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
//  ABIs (minimal — only what we need)
// ═══════════════════════════════════════════════════════

const ROUTER_ABI = [
  // Read: Get amounts out for a swap path
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOut',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Read: Get amounts in for a desired output
  {
    inputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsIn',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Write: Swap exact ETH (MATIC) for tokens
  {
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactETHForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  // Write: Swap exact tokens for ETH (MATIC)
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForETH',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Read: Factory address
  {
    inputs: [],
    name: 'factory',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Read: WETH (WMATIC on polygon)
  {
    inputs: [],
    name: 'WETH',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const FACTORY_ABI = [
  {
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    name: 'getPair',
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const PAIR_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: '_reserve0', type: 'uint112' },
      { name: '_reserve1', type: 'uint112' },
      { name: '_blockTimestampLast', type: 'uint32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ═══════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  outputAmountRaw: bigint;
  minimumOutput: string;     // After slippage
  minimumOutputRaw: bigint;
  priceImpact: string;
  path: Address[];
  rate: string;              // BTF per MATIC (or vice versa)
}

export interface PoolInfo {
  pairAddress: Address | null;
  hasLiquidity: boolean;
  reserveMATIC: string;
  reserveBTF: string;
  btfPriceInMATIC: string;
  maticPriceInBTF: string;
}

export type SwapDirection = 'buy' | 'sell';
export type SwapStatus = 'idle' | 'quoting' | 'approving' | 'swapping' | 'success' | 'error';

// ═══════════════════════════════════════════════════════
//  HOOK
// ═══════════════════════════════════════════════════════

export function useBTFSwap() {
  const { address, isConnected, chainId } = useWeb3();
  const { toast } = useToast();

  const [status, setStatus] = useState<SwapStatus>('idle');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slippage, setSlippage] = useState(1); // 1%

  const isPolygon = chainId === 137;

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
  //  POOL INFO
  // ═════════════════════════════════════════

  const fetchPoolInfo = useCallback(async () => {
    try {
      // Check if pair exists
      const pairAddress = await publicClient.readContract({
        address: QUICKSWAP_FACTORY,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [WMATIC, BTF_TOKEN_ADDRESS as Address],
      });

      if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') {
        setPoolInfo({
          pairAddress: null,
          hasLiquidity: false,
          reserveMATIC: '0',
          reserveBTF: '0',
          btfPriceInMATIC: '0',
          maticPriceInBTF: '0',
        });
        return;
      }

      // Get pair reserves
      const [reserves, token0] = await Promise.all([
        publicClient.readContract({
          address: pairAddress,
          abi: PAIR_ABI,
          functionName: 'getReserves',
        }),
        publicClient.readContract({
          address: pairAddress,
          abi: PAIR_ABI,
          functionName: 'token0',
        }),
      ]);

      const isToken0WMATIC = token0.toLowerCase() === WMATIC.toLowerCase();
      const reserveMATIC = isToken0WMATIC ? reserves[0] : reserves[1];
      const reserveBTF = isToken0WMATIC ? reserves[1] : reserves[0];

      const maticF = parseFloat(formatEther(reserveMATIC));
      const btfF = parseFloat(formatEther(reserveBTF));

      setPoolInfo({
        pairAddress,
        hasLiquidity: maticF > 0 && btfF > 0,
        reserveMATIC: formatEther(reserveMATIC),
        reserveBTF: formatEther(reserveBTF),
        btfPriceInMATIC: btfF > 0 ? (maticF / btfF).toFixed(8) : '0',
        maticPriceInBTF: maticF > 0 ? (btfF / maticF).toFixed(2) : '0',
      });
    } catch (err) {
      console.error('[BTFSwap] Pool info error:', err);
      setPoolInfo({
        pairAddress: null,
        hasLiquidity: false,
        reserveMATIC: '0',
        reserveBTF: '0',
        btfPriceInMATIC: '0',
        maticPriceInBTF: '0',
      });
    }
  }, []);

  // Auto-fetch pool info
  useEffect(() => {
    fetchPoolInfo();
    const interval = setInterval(fetchPoolInfo, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchPoolInfo]);

  // ═════════════════════════════════════════
  //  GET QUOTE: MATIC → BTF
  // ═════════════════════════════════════════

  const getQuoteBuy = useCallback(async (maticAmount: string): Promise<SwapQuote | null> => {
    if (!maticAmount || parseFloat(maticAmount) <= 0) {
      setQuote(null);
      return null;
    }

    setStatus('quoting');
    try {
      const amountIn = parseEther(maticAmount);
      const path: Address[] = [WMATIC, BTF_TOKEN_ADDRESS as Address];

      const amounts = await publicClient.readContract({
        address: QUICKSWAP_ROUTER,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountIn, path],
      });

      const outputRaw = amounts[1];
      const outputFormatted = formatEther(outputRaw);

      // Apply slippage
      const slippageBps = BigInt(Math.floor(slippage * 100)); // 1% = 100 bps
      const minimumOutputRaw = outputRaw - (outputRaw * slippageBps / BigInt(10000));
      const minimumOutput = formatEther(minimumOutputRaw);

      // Price impact (simplified)
      const maticReserve = parseFloat(poolInfo?.reserveMATIC || '0');
      const impact = maticReserve > 0
        ? ((parseFloat(maticAmount) / maticReserve) * 100).toFixed(2)
        : '0';

      // Rate
      const inputF = parseFloat(maticAmount);
      const outputF = parseFloat(outputFormatted);
      const rate = inputF > 0 ? (outputF / inputF).toFixed(2) : '0';

      const q: SwapQuote = {
        inputAmount: maticAmount,
        outputAmount: outputFormatted,
        outputAmountRaw: outputRaw,
        minimumOutput,
        minimumOutputRaw,
        priceImpact: impact,
        path,
        rate,
      };

      setQuote(q);
      setStatus('idle');
      return q;
    } catch (err) {
      console.error('[BTFSwap] Quote error:', err);
      setQuote(null);
      setStatus('idle');
      return null;
    }
  }, [slippage, poolInfo]);

  // ═════════════════════════════════════════
  //  GET QUOTE: BTF → MATIC
  // ═════════════════════════════════════════

  const getQuoteSell = useCallback(async (btfAmount: string): Promise<SwapQuote | null> => {
    if (!btfAmount || parseFloat(btfAmount) <= 0) {
      setQuote(null);
      return null;
    }

    setStatus('quoting');
    try {
      const amountIn = parseEther(btfAmount);
      const path: Address[] = [BTF_TOKEN_ADDRESS as Address, WMATIC];

      const amounts = await publicClient.readContract({
        address: QUICKSWAP_ROUTER,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountIn, path],
      });

      const outputRaw = amounts[1];
      const outputFormatted = formatEther(outputRaw);

      const slippageBps = BigInt(Math.floor(slippage * 100));
      const minimumOutputRaw = outputRaw - (outputRaw * slippageBps / BigInt(10000));
      const minimumOutput = formatEther(minimumOutputRaw);

      const btfReserve = parseFloat(poolInfo?.reserveBTF || '0');
      const impact = btfReserve > 0
        ? ((parseFloat(btfAmount) / btfReserve) * 100).toFixed(2)
        : '0';

      const inputF = parseFloat(btfAmount);
      const outputF = parseFloat(outputFormatted);
      const rate = inputF > 0 ? (outputF / inputF).toFixed(6) : '0';

      const q: SwapQuote = {
        inputAmount: btfAmount,
        outputAmount: outputFormatted,
        outputAmountRaw: outputRaw,
        minimumOutput,
        minimumOutputRaw,
        priceImpact: impact,
        path,
        rate,
      };

      setQuote(q);
      setStatus('idle');
      return q;
    } catch (err) {
      console.error('[BTFSwap] Sell quote error:', err);
      setQuote(null);
      setStatus('idle');
      return null;
    }
  }, [slippage, poolInfo]);

  // ═════════════════════════════════════════
  //  EXECUTE SWAP: Buy BTF with MATIC
  // ═════════════════════════════════════════

  const buyBTF = useCallback(async (maticAmount: string): Promise<string | null> => {
    if (!isConnected || !address) {
      toast({ title: 'Conecta Wallet', description: 'Conecta tu wallet para hacer swap', variant: 'destructive' });
      return null;
    }

    if (!poolInfo?.hasLiquidity) {
      const msg = 'No hay pool de liquidez WMATIC/BTF en QuickSwap. Usa la compra directa si está disponible.';
      setError(msg);
      setStatus('error');
      toast({ title: 'Sin Liquidez', description: msg, variant: 'destructive' });
      return null;
    }

    setError(null);
    setStatus('quoting');

    try {
      // Get fresh quote
      const freshQuote = await getQuoteBuy(maticAmount);
      if (!freshQuote) {
        throw new Error('No se pudo obtener cotización');
      }

      setStatus('swapping');
      toast({ title: 'Swap en progreso...', description: `Swapping ${maticAmount} MATIC → BTF` });

      const walletClient = await getWalletClient();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 min

      const hash = await walletClient.writeContract({
        address: QUICKSWAP_ROUTER,
        abi: ROUTER_ABI,
        functionName: 'swapExactETHForTokens',
        args: [
          freshQuote.minimumOutputRaw,
          freshQuote.path,
          address as Address,
          deadline,
        ],
        value: parseEther(maticAmount),
        account: address as Address,
        chain: polygon,
      });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setTxHash(hash);
        setStatus('success');
        toast({ title: '¡Swap Exitoso! 🎉', description: `Compraste ~${parseFloat(freshQuote.outputAmount).toFixed(2)} BTF` });
        fetchPoolInfo(); // Refresh
        return hash;
      } else {
        throw new Error('Transaction reverted');
      }
    } catch (err: any) {
      console.error('[BTFSwap] Buy error:', err);
      const msg = err.shortMessage || err.message || 'Swap failed';
      setError(msg);
      setStatus('error');
      toast({ title: 'Swap Fallido', description: msg, variant: 'destructive' });
      return null;
    }
  }, [isConnected, address, poolInfo, getQuoteBuy, getWalletClient, toast, fetchPoolInfo]);

  // ═════════════════════════════════════════
  //  EXECUTE SWAP: Sell BTF for MATIC
  // ═════════════════════════════════════════

  const sellBTF = useCallback(async (btfAmount: string): Promise<string | null> => {
    if (!isConnected || !address) {
      toast({ title: 'Conecta Wallet', description: 'Conecta tu wallet para hacer swap', variant: 'destructive' });
      return null;
    }

    if (!poolInfo?.hasLiquidity) {
      const msg = 'No hay pool de liquidez WMATIC/BTF en QuickSwap para vender.';
      setError(msg);
      setStatus('error');
      toast({ title: 'Sin Liquidez', description: msg, variant: 'destructive' });
      return null;
    }

    setError(null);
    setStatus('quoting');

    try {
      const freshQuote = await getQuoteSell(btfAmount);
      if (!freshQuote) {
        throw new Error('No se pudo obtener cotización');
      }

      const walletClient = await getWalletClient();
      const amountIn = parseEther(btfAmount);

      // Check & set approval for Router to spend BTF
      setStatus('approving');
      toast({ title: 'Aprobando BTF...', description: 'Confirma en tu wallet' });

      const currentAllowance = await publicClient.readContract({
        address: BTF_TOKEN_ADDRESS as Address,
        abi: ERC20_APPROVE_ABI,
        functionName: 'allowance',
        args: [address as Address, QUICKSWAP_ROUTER],
      });

      if (currentAllowance < amountIn) {
        const approveHash = await walletClient.writeContract({
          address: BTF_TOKEN_ADDRESS as Address,
          abi: ERC20_APPROVE_ABI,
          functionName: 'approve',
          args: [QUICKSWAP_ROUTER, amountIn],
          account: address as Address,
          chain: polygon,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Execute sell
      setStatus('swapping');
      toast({ title: 'Vendiendo BTF...', description: `${btfAmount} BTF → MATIC` });

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

      const hash = await walletClient.writeContract({
        address: QUICKSWAP_ROUTER,
        abi: ROUTER_ABI,
        functionName: 'swapExactTokensForETH',
        args: [
          amountIn,
          freshQuote.minimumOutputRaw,
          freshQuote.path,
          address as Address,
          deadline,
        ],
        account: address as Address,
        chain: polygon,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setTxHash(hash);
        setStatus('success');
        toast({ title: '¡Venta Exitosa!', description: `Recibiste ~${parseFloat(freshQuote.outputAmount).toFixed(4)} MATIC` });
        fetchPoolInfo();
        return hash;
      } else {
        throw new Error('Transaction reverted');
      }
    } catch (err: any) {
      console.error('[BTFSwap] Sell error:', err);
      const msg = err.shortMessage || err.message || 'Swap failed';
      setError(msg);
      setStatus('error');
      toast({ title: 'Venta Fallida', description: msg, variant: 'destructive' });
      return null;
    }
  }, [isConnected, address, poolInfo, getQuoteSell, getWalletClient, toast, fetchPoolInfo]);

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
    quote,
    poolInfo,
    txHash,
    error,
    slippage,
    isPolygon,
    isConnected,

    // Actions
    setSlippage,
    getQuoteBuy,
    getQuoteSell,
    buyBTF,
    sellBTF,
    fetchPoolInfo,
    reset,
  };
}
