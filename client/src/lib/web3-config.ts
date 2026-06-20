import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http, fallback } from 'wagmi';
import { polygon, polygonMumbai } from 'wagmi/chains';

// Custom Polygon RPCs — override wagmi defaults that include dead endpoints (e.g. polygon.llamarpc.com)
const POLYGON_TRANSPORTS = fallback([
  http('https://polygon-bor-rpc.publicnode.com', { timeout: 10000, retryCount: 2 }),
  http('https://rpc.ankr.com/polygon', { timeout: 10000, retryCount: 2 }),
  http('https://1rpc.io/matic', { timeout: 10000, retryCount: 2 }),
  http('https://polygon-rpc.com', { timeout: 10000, retryCount: 2 }),
]);

// WalletConnect Project ID - debe ser válido de https://cloud.walletconnect.com
// IMPORTANT: This must be set in .env as VITE_WALLETCONNECT_PROJECT_ID for production builds
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

// Check if WalletConnect is properly configured
const isWalletConnectConfigured = WALLETCONNECT_PROJECT_ID && WALLETCONNECT_PROJECT_ID !== 'demo-project-id' && WALLETCONNECT_PROJECT_ID.length > 10;

if (!isWalletConnectConfigured) {
  console.warn('[Web3Config] ⚠️ VITE_WALLETCONNECT_PROJECT_ID not configured properly. WalletConnect features may not work.');
  console.warn('[Web3Config] Current value:', WALLETCONNECT_PROJECT_ID || 'undefined');
}

let wagmiConfigInstance: ReturnType<typeof getDefaultConfig> | null = null;

export function getWagmiConfig() {
  if (!wagmiConfigInstance) {
    try {
      // Only initialize if WalletConnect is configured, otherwise use a minimal config
      const projectId = isWalletConnectConfigured ? WALLETCONNECT_PROJECT_ID! : 'boostify-music-fallback';
      
      wagmiConfigInstance = getDefaultConfig({
        appName: 'Boostify Music',
        projectId: projectId,
        chains: [
          polygon,
          polygonMumbai,
        ],
        transports: {
          [polygon.id]: POLYGON_TRANSPORTS,
          [polygonMumbai.id]: http('https://rpc-amoy.polygon.technology'),
        },
        ssr: false,
      });
      
      if (isWalletConnectConfigured) {
        console.log('[Web3Config] ✅ WalletConnect initialized with project ID');
      }
    } catch (error) {
      console.error('[Web3Config] Error initializing wagmi config:', error);
      // Crear config mínima sin WalletConnect
      wagmiConfigInstance = getDefaultConfig({
        appName: 'Boostify Music',
        projectId: 'boostify-fallback',
        chains: [polygon],
        transports: {
          [polygon.id]: POLYGON_TRANSPORTS,
        },
        ssr: false,
      });
    }
  }
  return wagmiConfigInstance;
}

// Para compatibilidad con código existente
export const wagmiConfig = getWagmiConfig();

// BTF-2300 ArtistToken Contract - DEPLOYED ON POLYGON MAINNET
export const BOOSTIFY_CONTRACT_ADDRESS = '0x76F4c51204E096f6993A6171B524A7AaedDcD723';

export const ERC1155_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'uint256', name: 'id', type: 'uint256' },
    ],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'buyTokens',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'uri',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
