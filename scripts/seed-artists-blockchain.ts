/**
 * Seed BTF-2300 Artists to Blockchain
 * 
 * Este script registra los artistas de la plataforma en el contrato BTF-2300
 * desplegado en Polygon Mainnet.
 * 
 * Prerrequisitos:
 * - PLATFORM_PRIVATE_KEY en .env (wallet con MATIC para gas)
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

// Contract addresses
const ARTIST_TOKEN_ADDRESS = '0x8D39Ee33fBA624Da8666d74428aD5De2DfE8e469';
const DEX_ADDRESS = '0xdDcB670fA7eedc85Da3923beDca8dfe225f7146E';
const METADATA_BASE_URL = 'https://boostify-music.onrender.com/api/metadata/artist/';

// Artists to register (matching the frontend profiles)
const ARTISTS = [
  { id: 2, name: "Urban Pulse", genre: "Hip-Hop/R&B" },
  { id: 3, name: "Neon Velocity", genre: "Electronic" },
  { id: 4, name: "Electric Symphony", genre: "Electronic/Classical" },
  { id: 5, name: "Soul Frequency", genre: "Neo-Soul" },
  { id: 6, name: "Midnight Groove", genre: "Funk/Soul" },
  { id: 7, name: "Crimson Beats", genre: "Industrial/Electronic" },
  { id: 8, name: "Cosmic Rhythm", genre: "Space Disco" },
  { id: 9, name: "Golden Harmonics", genre: "Jazz Fusion" },
  { id: 10, name: "Thunder Voice", genre: "Rock" },
  { id: 11, name: "Crystal Notes", genre: "Dream Pop" },
  { id: 12, name: "Velvet Sound", genre: "Lo-Fi/Chill" },
  { id: 13, name: "Phoenix Rising", genre: "Alternative Rock" },
  { id: 14, name: "Digital Dreams", genre: "Synthwave" },
  { id: 15, name: "Mystic Waves", genre: "Ambient" },
  { id: 16, name: "Street Poetry", genre: "Underground Hip-Hop" },
  { id: 17, name: "Aurora Beats", genre: "Future Bass" },
  { id: 18, name: "Rhythm Nation", genre: "World Music" },
  { id: 19, name: "Chrome Hearts", genre: "Indie Pop" },
  { id: 20, name: "Bassline Kings", genre: "Drum & Bass" },
];

// ABI for registration
const ARTIST_TOKEN_ABI = [
  {
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'artistName', type: 'string' },
      { name: 'profileURI', type: 'string' },
    ],
    name: 'registerArtist',
    outputs: [
      { name: 'artistId', type: 'uint256' },
      { name: 'identityTokenId', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getCurrentTokenCounts',
    outputs: [
      { name: 'artists', type: 'uint256' },
      { name: 'songs', type: 'uint256' },
      { name: 'catalogs', type: 'uint256' },
      { name: 'licenses', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'artists',
    outputs: [
      { name: 'artistId', type: 'uint256' },
      { name: 'walletAddress', type: 'address' },
      { name: 'artistName', type: 'string' },
      { name: 'profileURI', type: 'string' },
      { name: 'totalEarnings', type: 'uint256' },
      { name: 'totalSongs', type: 'uint256' },
      { name: 'isVerified', type: 'bool' },
      { name: 'isActive', type: 'bool' },
      { name: 'registeredAt', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'nextArtistId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

const DEX_ABI = [
  {
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokenAmount', type: 'uint256' },
    ],
    name: 'createPool',
    outputs: [{ name: 'liquidity', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getPoolInfo',
    outputs: [
      { name: 'tokenReserve', type: 'uint256' },
      { name: 'ethReserve', type: 'uint256' },
      { name: 'totalLPTokens', type: 'uint256' },
      { name: 'feeAccumulated', type: 'uint256' },
      { name: 'isActive', type: 'bool' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        BTF-2300 BLOCKCHAIN ARTIST REGISTRATION               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Check private key
  let privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PLATFORM_PRIVATE_KEY not found in .env');
    console.log('   Please add: PLATFORM_PRIVATE_KEY=0x...');
    process.exit(1);
  }

  // Add 0x prefix if not present
  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  // Create clients
  const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  console.log('📍 Platform wallet:', account.address);
  
  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log('💰 Balance:', formatEther(balance), 'MATIC\n');

  if (balance < parseEther('0.1')) {
    console.error('❌ Insufficient MATIC balance. Need at least 0.1 MATIC for gas.');
    process.exit(1);
  }

  // Check current artist count
  const counts = await publicClient.readContract({
    address: ARTIST_TOKEN_ADDRESS,
    abi: ARTIST_TOKEN_ABI,
    functionName: 'getCurrentTokenCounts'
  });
  
  console.log('📊 Current state:');
  console.log('   Artists registered:', counts[0].toString());
  console.log('   Songs tokenized:', counts[1].toString());
  console.log('');

  // Register artists
  console.log('─'.repeat(60));
  console.log('📝 REGISTERING ARTISTS');
  console.log('─'.repeat(60));

  let registered = 0;
  let skipped = 0;

  for (const artist of ARTISTS) {
    try {
      // Check if artist already exists
      const existingArtist = await publicClient.readContract({
        address: ARTIST_TOKEN_ADDRESS,
        abi: ARTIST_TOKEN_ABI,
        functionName: 'artists',
        args: [BigInt(artist.id)]
      });

      if (existingArtist[0] !== 0n) {
        console.log(`   ⏭️  ${artist.name} (ID ${artist.id}) - Already registered`);
        skipped++;
        continue;
      }

      // Register artist
      const profileURI = `${METADATA_BASE_URL}${artist.id}`;
      
      console.log(`   🔄 Registering ${artist.name}...`);
      
      const hash = await walletClient.writeContract({
        address: ARTIST_TOKEN_ADDRESS,
        abi: ARTIST_TOKEN_ABI,
        functionName: 'registerArtist',
        args: [account.address, artist.name, profileURI],
      });

      console.log(`      TX: ${hash.slice(0, 18)}...`);
      
      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        console.log(`   ✅ ${artist.name} registered successfully!`);
        registered++;
      } else {
        console.log(`   ❌ ${artist.name} - Transaction failed`);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (error: any) {
      console.log(`   ❌ ${artist.name} - Error: ${error.message?.slice(0, 50)}`);
    }
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('📋 REGISTRATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   ✅ Registered: ${registered}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   Total artists: ${Number(counts[0]) + registered}`);
  console.log('');

  // Final count
  const finalCounts = await publicClient.readContract({
    address: ARTIST_TOKEN_ADDRESS,
    abi: ARTIST_TOKEN_ABI,
    functionName: 'getCurrentTokenCounts'
  });
  
  console.log('📊 Final state:');
  console.log('   Artists registered:', finalCounts[0].toString());
}

main().catch(console.error);
