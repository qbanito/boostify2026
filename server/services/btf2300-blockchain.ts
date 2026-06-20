/**
 * BTF-2300 Blockchain Service
 * 
 * Servicio para interactuar con los contratos inteligentes BTF-2300 en Polygon
 * Permite registrar artistas, tokenizar canciones y gestionar NFTs automáticamente
 * 
 * IMPORTANTE: Requiere PLATFORM_PRIVATE_KEY en las variables de entorno
 * Esta wallet debe tener MATIC para pagar gas y tener MINTER_ROLE en el contrato
 */

import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Contract Addresses (Polygon Mainnet) - V2 with ERC1155Receiver fix
const BTF2300_CONTRACTS = {
  artistToken: '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027' as `0x${string}`,
  dex: '0xe6577a7e81cd4bf6cf2d074e28fd5a6970fe2647' as `0x${string}`,
  royalties: '0x09ebf2b96741222bbc6d48035c9bf5a66f6aec91' as `0x${string}`,
};

// Base URL for metadata
const BASE_METADATA_URL = process.env.BASE_URL || 'https://boostifymusic.com';

// ABI for BTF2300ArtistToken (only the functions we need)
const ARTIST_TOKEN_ABI = parseAbi([
  // Read functions
  'function artists(uint256) view returns (uint256 artistId, address walletAddress, string artistName, string profileURI, uint256 totalEarnings, uint256 totalSongs, bool isVerified, bool isActive, uint256 registeredAt)',
  'function artistIdByWallet(address) view returns (uint256)',
  'function getCurrentTokenCounts() view returns (uint256 totalArtists, uint256 totalSongs, uint256 totalCatalogs, uint256 totalLicenses)',
  'function songs(uint256) view returns (uint256 tokenId, uint256 artistId, string title, string metadataURI, uint256 totalSupply, uint256 availableSupply, uint256 pricePerToken, bool isActive, uint256 totalEarnings, uint256 createdAt)',
  'function uri(uint256 tokenId) view returns (string)',
  'function paused() view returns (bool)',
  
  // Write functions
  'function registerArtist(address wallet, string artistName, string profileURI) returns (uint256 artistId, uint256 identityTokenId)',
  'function updateArtistProfile(uint256 artistId, string newName, string newProfileURI)',
  'function tokenizeSong(uint256 artistId, string title, string metadataURI, uint256 totalSupply, uint256 pricePerToken) returns (uint256 tokenId)',
  'function verifyArtist(uint256 artistId, bool verified)',
  
  // Events
  'event ArtistRegistered(uint256 indexed artistId, address indexed wallet, string artistName, uint256 identityTokenId)',
  'event SongTokenized(uint256 indexed tokenId, uint256 indexed artistId, string title, uint256 totalSupply, uint256 pricePerToken)',
  'event ArtistProfileUpdated(uint256 indexed artistId, string artistName, string profileURI)',
]);

// Singleton clients
let publicClient: ReturnType<typeof createPublicClient> | null = null;
let walletClient: ReturnType<typeof createWalletClient> | null = null;
let platformAccount: ReturnType<typeof privateKeyToAccount> | null = null;

/**
 * Initialize blockchain clients
 */
function initializeClients() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: polygon,
      transport: http('https://polygon-rpc.com'),
    });
  }

  if (!walletClient && process.env.PLATFORM_PRIVATE_KEY) {
    try {
      // Ensure private key has 0x prefix
      let privateKey = process.env.PLATFORM_PRIVATE_KEY;
      if (!privateKey.startsWith('0x')) {
        privateKey = `0x${privateKey}`;
      }
      
      platformAccount = privateKeyToAccount(privateKey as `0x${string}`);
      
      walletClient = createWalletClient({
        account: platformAccount,
        chain: polygon,
        transport: http('https://polygon-rpc.com'),
      });
      
      console.log(`🔐 BTF-2300: Platform wallet initialized: ${platformAccount.address}`);
    } catch (error) {
      console.error('❌ BTF-2300: Failed to initialize wallet:', error);
    }
  }
  
  return { publicClient, walletClient, platformAccount };
}

/**
 * Check if blockchain service is available
 */
export function isBlockchainServiceAvailable(): boolean {
  const { walletClient } = initializeClients();
  return walletClient !== null;
}

/**
 * Get platform wallet balance
 */
export async function getPlatformWalletBalance(): Promise<string> {
  const { publicClient, platformAccount } = initializeClients();
  
  if (!publicClient || !platformAccount) {
    throw new Error('Blockchain service not initialized');
  }
  
  const balance = await publicClient.getBalance({ address: platformAccount.address });
  return formatEther(balance);
}

/**
 * Get current token counts from the contract
 */
export async function getTokenCounts(): Promise<{
  totalArtists: number;
  totalSongs: number;
  totalCatalogs: number;
  totalLicenses: number;
}> {
  const { publicClient } = initializeClients();
  
  if (!publicClient) {
    throw new Error('Blockchain service not initialized');
  }
  
  const result = await publicClient.readContract({
    address: BTF2300_CONTRACTS.artistToken,
    abi: ARTIST_TOKEN_ABI,
    functionName: 'getCurrentTokenCounts',
  });
  
  return {
    totalArtists: Number(result[0]),
    totalSongs: Number(result[1]),
    totalCatalogs: Number(result[2]),
    totalLicenses: Number(result[3]),
  };
}

/**
 * Register a new artist on the blockchain
 * 
 * @param artistWallet - Artist's wallet address (or platform wallet if not provided)
 * @param artistName - Display name of the artist
 * @param postgresId - PostgreSQL ID of the artist (used to generate metadata URL)
 * @returns Transaction result with artistId and tokenId
 */
export async function registerArtistOnChain(
  artistWallet: string | undefined,
  artistName: string,
  postgresId: number
): Promise<{
  success: boolean;
  artistId?: number;
  tokenId?: number;
  txHash?: string;
  error?: string;
}> {
  const { publicClient, walletClient, platformAccount } = initializeClients();
  
  if (!publicClient || !walletClient || !platformAccount) {
    console.warn('⚠️ BTF-2300: Blockchain service not available. Set PLATFORM_PRIVATE_KEY to enable.');
    return {
      success: false,
      error: 'Blockchain service not configured. Missing PLATFORM_PRIVATE_KEY.',
    };
  }
  
  try {
    // Use artist wallet or platform wallet as fallback
    const targetWallet = (artistWallet || platformAccount.address) as `0x${string}`;
    
    // Generate metadata URL pointing to our API
    const profileURI = `${BASE_METADATA_URL}/api/metadata/artist/${postgresId}`;
    
    console.log(`🚀 BTF-2300: Registering artist "${artistName}" on Polygon...`);
    console.log(`   Wallet: ${targetWallet}`);
    console.log(`   Metadata URI: ${profileURI}`);
    
    // Check if contract is paused
    const isPaused = await publicClient.readContract({
      address: BTF2300_CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'paused',
    });
    
    if (isPaused) {
      return {
        success: false,
        error: 'Contract is paused',
      };
    }
    
    // Check if wallet already has an artist registered
    const existingArtistId = await publicClient.readContract({
      address: BTF2300_CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'artistIdByWallet',
      args: [targetWallet],
    });
    
    if (existingArtistId && Number(existingArtistId) > 0) {
      console.log(`ℹ️ BTF-2300: Wallet already has artist ID ${existingArtistId}`);
      return {
        success: true,
        artistId: Number(existingArtistId),
        error: 'Wallet already registered as artist',
      };
    }
    
    // Estimate gas first
    const gasEstimate = await publicClient.estimateContractGas({
      address: BTF2300_CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'registerArtist',
      args: [targetWallet, artistName, profileURI],
      account: platformAccount.address,
    });
    
    console.log(`⛽ BTF-2300: Estimated gas: ${gasEstimate}`);
    
    // Send transaction
    const txHash = await walletClient.writeContract({
      chain: polygon,
      address: BTF2300_CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'registerArtist',
      args: [targetWallet, artistName, profileURI],
      gas: gasEstimate * BigInt(120) / BigInt(100), // Add 20% buffer
    });
    
    console.log(`📤 BTF-2300: Transaction sent: ${txHash}`);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      confirmations: 2,
    });
    
    if (receipt.status === 'success') {
      // Parse logs to get artistId and tokenId
      // For now, get the current count as an approximation
      const counts = await getTokenCounts();
      
      console.log(`✅ BTF-2300: Artist registered successfully!`);
      console.log(`   Artist ID: ${counts.totalArtists}`);
      console.log(`   Token ID: 1000000000 + ${counts.totalArtists}`);
      console.log(`   Tx Hash: ${txHash}`);
      
      return {
        success: true,
        artistId: counts.totalArtists,
        tokenId: 1_000_000_000 + counts.totalArtists,
        txHash,
      };
    } else {
      return {
        success: false,
        txHash,
        error: 'Transaction failed',
      };
    }
  } catch (error: any) {
    console.error('❌ BTF-2300: Error registering artist:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Tokenize a song on the blockchain
 * 
 * @param artistId - On-chain artist ID
 * @param songTitle - Song title
 * @param postgresSongId - PostgreSQL ID of the song
 * @param totalSupply - Total tokens to create
 * @param pricePerToken - Price per token in wei
 * @returns Transaction result with tokenId
 */
export async function tokenizeSongOnChain(
  artistId: number,
  songTitle: string,
  postgresSongId: number,
  totalSupply: number = 1000,
  pricePerToken: bigint = BigInt('1000000000000000') // 0.001 MATIC
): Promise<{
  success: boolean;
  tokenId?: number;
  txHash?: string;
  error?: string;
}> {
  const { publicClient, walletClient, platformAccount } = initializeClients();
  
  if (!publicClient || !walletClient || !platformAccount) {
    return {
      success: false,
      error: 'Blockchain service not configured',
    };
  }
  
  try {
    const metadataURI = `${BASE_METADATA_URL}/api/metadata/song/${postgresSongId}`;
    
    console.log(`🎵 BTF-2300: Tokenizing song "${songTitle}"...`);
    console.log(`   Artist ID: ${artistId}`);
    console.log(`   Total Supply: ${totalSupply}`);
    console.log(`   Price: ${formatEther(pricePerToken)} MATIC per token`);
    
    // Send transaction
    const txHash = await walletClient.writeContract({
      chain: polygon,
      address: BTF2300_CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'tokenizeSong',
      args: [BigInt(artistId), songTitle, metadataURI, BigInt(totalSupply), pricePerToken],
    });
    
    console.log(`📤 BTF-2300: Transaction sent: ${txHash}`);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      confirmations: 2,
    });
    
    if (receipt.status === 'success') {
      const counts = await getTokenCounts();
      const tokenId = 2_000_000_000 + counts.totalSongs;
      
      console.log(`✅ BTF-2300: Song tokenized successfully!`);
      console.log(`   Token ID: ${tokenId}`);
      
      return {
        success: true,
        tokenId,
        txHash,
      };
    } else {
      return {
        success: false,
        txHash,
        error: 'Transaction failed',
      };
    }
  } catch (error: any) {
    console.error('❌ BTF-2300: Error tokenizing song:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Update artist profile on the blockchain
 */
export async function updateArtistProfileOnChain(
  artistId: number,
  newName?: string,
  postgresId?: number
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  const { publicClient, walletClient, platformAccount } = initializeClients();
  
  if (!publicClient || !walletClient || !platformAccount) {
    return {
      success: false,
      error: 'Blockchain service not configured',
    };
  }
  
  try {
    const newProfileURI = postgresId 
      ? `${BASE_METADATA_URL}/api/metadata/artist/${postgresId}`
      : '';
    
    console.log(`📝 BTF-2300: Updating artist profile...`);
    
    const txHash = await walletClient.writeContract({
      chain: polygon,
      address: BTF2300_CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'updateArtistProfile',
      args: [BigInt(artistId), newName || '', newProfileURI],
    });
    
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      confirmations: 2,
    });
    
    return {
      success: receipt.status === 'success',
      txHash,
    };
  } catch (error: any) {
    console.error('❌ BTF-2300: Error updating artist:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

// Export contract addresses for reference
export const BTF2300_CONTRACT_ADDRESSES = BTF2300_CONTRACTS;
