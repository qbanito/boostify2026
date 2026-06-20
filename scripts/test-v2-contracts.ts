/**
 * Test the NEW v2 contracts - Register artists and tokenize songs
 */
import { createPublicClient, createWalletClient, http, parseEther, formatEther, keccak256, toBytes } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

// NEW V2 Contract Addresses
const ARTIST_TOKEN_V2 = '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027' as const;

const abi = [
  {
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'artistName', type: 'string' },
      { name: 'profileURI', type: 'string' },
    ],
    name: 'registerArtist',
    outputs: [{ name: 'artistId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'artistId', type: 'uint256' },
      { name: 'title', type: 'string' },
      { name: 'metadataURI', type: 'string' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'pricePerToken', type: 'uint256' },
    ],
    name: 'tokenizeSong',
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getCurrentTokenCounts',
    outputs: [
      { name: 'totalArtists', type: 'uint256' },
      { name: 'totalSongs', type: 'uint256' },
      { name: 'totalCatalogs', type: 'uint256' },
      { name: 'totalLicenses', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'artistId', type: 'uint256' }],
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
      { name: 'registeredAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'songs',
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'artistId', type: 'uint256' },
      { name: 'title', type: 'string' },
      { name: 'metadataURI', type: 'string' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'availableSupply', type: 'uint256' },
      { name: 'pricePerToken', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'totalEarnings', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function test() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     TEST BTF-2300 V2 - Register Artist + Tokenize Song     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PLATFORM_PRIVATE_KEY not found');
    return;
  }
  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log('Platform Wallet:', account.address);
  console.log('Contract V2:', ARTIST_TOKEN_V2);
  console.log('');

  const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com', {
      timeout: 60000,
      retryCount: 3,
      retryDelay: 2000,
    }),
  });

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http('https://polygon-rpc.com', {
      timeout: 60000,
      retryCount: 3,
      retryDelay: 2000,
    }),
  });

  // Check current state
  console.log('═══ CURRENT STATE ═══');
  const counts = await publicClient.readContract({
    address: ARTIST_TOKEN_V2,
    abi,
    functionName: 'getCurrentTokenCounts',
  });
  console.log(`Artists: ${counts[0]} | Songs: ${counts[1]}`);
  console.log('');

  // Generate a derived wallet for the test artist
  function deriveWallet(index: number): `0x${string}` {
    const hash = crypto.createHash('sha256')
      .update(`boostify-artist-v2-${index}`)
      .digest('hex');
    return `0x${hash.slice(0, 40)}` as `0x${string}`;
  }

  // 1. Register a test artist
  console.log('═══ STEP 1: REGISTER ARTIST ═══');
  const artistWallet = deriveWallet(1);
  const artistName = 'Test Artist V2';
  const profileURI = 'https://boostify-music.onrender.com/api/metadata/artist/1';

  console.log(`Registering: ${artistName}`);
  console.log(`Wallet: ${artistWallet}`);

  try {
    const registerHash = await walletClient.writeContract({
      address: ARTIST_TOKEN_V2,
      abi,
      functionName: 'registerArtist',
      args: [artistWallet, artistName, profileURI],
    });

    console.log(`TX: ${registerHash}`);
    console.log('Waiting for confirmation...');

    const registerReceipt = await publicClient.waitForTransactionReceipt({
      hash: registerHash,
      confirmations: 2,
    });

    console.log(`✅ Artist registered! Gas: ${registerReceipt.gasUsed}`);
  } catch (error: any) {
    console.log('⚠️  Artist registration failed (may already exist):', error.shortMessage || error.message);
  }
  console.log('');

  // Get updated counts
  const countsAfterArtist = await publicClient.readContract({
    address: ARTIST_TOKEN_V2,
    abi,
    functionName: 'getCurrentTokenCounts',
  });
  console.log(`Artists now: ${countsAfterArtist[0]}`);
  const artistId = countsAfterArtist[0] > 0n ? 1n : 1n; // Use artist 1
  console.log('');

  // 2. Tokenize a song
  console.log('═══ STEP 2: TOKENIZE SONG ═══');
  const songTitle = 'First Song V2';
  const songURI = 'https://boostify-music.onrender.com/api/metadata/song/1';
  const totalSupply = 10000n;
  const pricePerToken = parseEther('0.001'); // 0.001 MATIC

  console.log(`Tokenizing: "${songTitle}"`);
  console.log(`Artist ID: ${artistId}`);
  console.log(`Supply: ${totalSupply}`);
  console.log(`Price: 0.001 MATIC per token`);

  try {
    // First simulate
    console.log('Simulating...');
    const { request } = await publicClient.simulateContract({
      address: ARTIST_TOKEN_V2,
      abi,
      functionName: 'tokenizeSong',
      args: [artistId, songTitle, songURI, totalSupply, pricePerToken],
      account: account.address,
    });

    console.log('✅ Simulation SUCCESS!');

    // Execute directly
    const tokenizeHash = await walletClient.writeContract({
      address: ARTIST_TOKEN_V2,
      abi,
      functionName: 'tokenizeSong',
      args: [artistId, songTitle, songURI, totalSupply, pricePerToken],
    });
    console.log(`TX: ${tokenizeHash}`);
    console.log('Waiting for confirmation...');

    const tokenizeReceipt = await publicClient.waitForTransactionReceipt({
      hash: tokenizeHash,
      confirmations: 2,
    });

    console.log(`✅ SONG TOKENIZED! Gas: ${tokenizeReceipt.gasUsed}`);
  } catch (error: any) {
    console.log('❌ Tokenization FAILED:', error.shortMessage || error.message);
    if (error.cause) {
      console.log('Cause:', error.cause.shortMessage || error.cause);
    }
  }
  console.log('');

  // Final state
  console.log('═══ FINAL STATE ═══');
  const finalCounts = await publicClient.readContract({
    address: ARTIST_TOKEN_V2,
    abi,
    functionName: 'getCurrentTokenCounts',
  });
  console.log(`Artists: ${finalCounts[0]} | Songs: ${finalCounts[1]}`);

  if (finalCounts[1] > 0n) {
    // Get song details
    const songTokenId = 2_000_000_000n + 1n; // SONG_TOKEN_PREFIX + 1
    const song = await publicClient.readContract({
      address: ARTIST_TOKEN_V2,
      abi,
      functionName: 'songs',
      args: [songTokenId],
    });
    console.log('');
    console.log('Song Details:');
    console.log(`  Token ID: ${song[0]}`);
    console.log(`  Artist ID: ${song[1]}`);
    console.log(`  Title: ${song[2]}`);
    console.log(`  Supply: ${song[4]} (${song[5]} available)`);
    console.log(`  Price: ${formatEther(song[6])} MATIC`);
    console.log(`  Active: ${song[7]}`);
  }

  console.log('\n🎉 TEST COMPLETE!');
}

test().catch(console.error);
