/**
 * BOOSTIFY ECONOMIC ENGINE — Blockchain Provider
 * Manages RPC connections to Polygon/Ethereum via Alchemy
 * Provides ethers.js provider, signer, and contract factories
 */

import { ethers } from 'ethers';
import { Alchemy, Network } from 'alchemy-sdk';

// ============================================
// CONFIGURATION
// ============================================

const POLYGON_CHAIN_ID = 137;
const POLYGON_MAINNET_RPC = 'https://polygon-rpc.com';

interface BlockchainConfig {
  alchemyApiKey: string;
  network: Network;
  polygonRpc: string;
  treasuryPrivateKey?: string;
}

function getConfig(): BlockchainConfig {
  return {
    alchemyApiKey: process.env.ALCHEMY_API_KEY || '',
    network: Network.MATIC_MAINNET,
    polygonRpc: process.env.POLYGON_RPC_URL || POLYGON_MAINNET_RPC,
    treasuryPrivateKey: process.env.TREASURY_WALLET_PRIVATE_KEY || process.env.PLATFORM_PRIVATE_KEY,
  };
}

// ============================================
// PROVIDER SINGLETON
// ============================================

let _provider: ethers.JsonRpcProvider | null = null;
let _alchemy: Alchemy | null = null;
let _signer: ethers.Wallet | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const config = getConfig();
    const rpcUrl = config.alchemyApiKey
      ? `https://polygon-mainnet.g.alchemy.com/v2/${config.alchemyApiKey}`
      : config.polygonRpc;
    _provider = new ethers.JsonRpcProvider(rpcUrl, POLYGON_CHAIN_ID);
  }
  return _provider;
}

export function getAlchemy(): Alchemy {
  if (!_alchemy) {
    const config = getConfig();
    if (!config.alchemyApiKey) {
      throw new Error('ALCHEMY_API_KEY not configured');
    }
    _alchemy = new Alchemy({
      apiKey: config.alchemyApiKey,
      network: config.network,
    });
  }
  return _alchemy;
}

export function getSigner(): ethers.Wallet {
  if (!_signer) {
    const config = getConfig();
    if (!config.treasuryPrivateKey) {
      throw new Error('TREASURY_WALLET_PRIVATE_KEY not configured');
    }
    _signer = new ethers.Wallet(config.treasuryPrivateKey, getProvider());
  }
  return _signer;
}

// ============================================
// COMMON CONTRACT ADDRESSES (POLYGON)
// ============================================

export const POLYGON_ADDRESSES = {
  // Tokens
  USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',

  // DeFi Protocols
  AAVE_V3_POOL: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  AAVE_V3_POOL_DATA_PROVIDER: '0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654',
  UNISWAP_V3_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  UNISWAP_V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  UNISWAP_V3_QUOTER: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  SUSHISWAP_ROUTER: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',

  // 1inch
  ONEINCH_ROUTER_V5: '0x1111111254EEB25477B68fb85Ed929f73A960582',

  // Chainlink Price Feeds (Polygon)
  CHAINLINK_MATIC_USD: '0xAB594600376Ec9fD91F8e8dC64f1816EF17C58B9',
  CHAINLINK_ETH_USD: '0xF9680D99D6C9589e2a93a78A04A279e509205945',
  CHAINLINK_BTC_USD: '0xc907E116054Ad103354f2D350FD2514433D57F6f',

  // BTF Token (deploy address — to be set via env)
  BTF_TOKEN: process.env.BTF_TOKEN_ADDRESS || '',
} as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

export async function getTokenBalance(tokenAddress: string, walletAddress: string): Promise<bigint> {
  const provider = getProvider();
  const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
  const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
  return contract.balanceOf(walletAddress);
}

export async function getMaticBalance(walletAddress: string): Promise<bigint> {
  const provider = getProvider();
  return provider.getBalance(walletAddress);
}

export async function getGasPrice(): Promise<bigint> {
  const provider = getProvider();
  const feeData = await provider.getFeeData();
  return feeData.gasPrice || 0n;
}

export async function estimateGasCost(gasUnits: bigint): Promise<string> {
  const gasPrice = await getGasPrice();
  const costWei = gasUnits * gasPrice;
  return ethers.formatEther(costWei);
}

export function isConfigured(): boolean {
  const config = getConfig();
  // Wallet is required; Alchemy is optional (falls back to public RPC)
  return Boolean(config.treasuryPrivateKey);
}

export function getConfigStatus(): {
  alchemyConfigured: boolean;
  walletConfigured: boolean;
  btfTokenConfigured: boolean;
  network: string;
} {
  const config = getConfig();
  return {
    alchemyConfigured: Boolean(config.alchemyApiKey),
    walletConfigured: Boolean(config.treasuryPrivateKey),
    btfTokenConfigured: Boolean(POLYGON_ADDRESSES.BTF_TOKEN),
    network: 'Polygon Mainnet',
  };
}
