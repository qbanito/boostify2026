/**
 * Quick seed more songs - simpler version
 */
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

const ARTIST_TOKEN_V2 = '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027' as const;

const abi = [
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
] as const;

const songTitles = [
  'Midnight Dreams',
  'Electric Soul', 
  'Into the Unknown',
  'City Lights',
  'Ocean Waves',
  'Summer Nights',
];

async function seed() {
  console.log('=== QUICK TOKENIZE SONGS ===\n');

  let privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey?.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com', { timeout: 60000 }),
  });

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http('https://polygon-rpc.com', { timeout: 60000 }),
  });

  const counts = await publicClient.readContract({
    address: ARTIST_TOKEN_V2,
    abi,
    functionName: 'getCurrentTokenCounts',
  });

  const totalArtists = Number(counts[0]);
  let songNumber = Number(counts[1]);
  
  console.log(`Artists: ${totalArtists} | Current Songs: ${songNumber}\n`);

  // Tokenize 10 songs across artists
  for (let i = 0; i < 10; i++) {
    const artistId = (songNumber % totalArtists) + 1;
    const title = songTitles[songNumber % songTitles.length] + ` #${songNumber + 1}`;
    const songURI = `https://boostify-music.onrender.com/api/metadata/song/${songNumber + 1}`;

    console.log(`[${i + 1}/10] "${title}" (Artist ${artistId})...`);

    try {
      const hash = await walletClient.writeContract({
        address: ARTIST_TOKEN_V2,
        abi,
        functionName: 'tokenizeSong',
        args: [BigInt(artistId), title, songURI, 10000n, parseEther('0.001')],
      });

      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      console.log(`   ✅ TX: ${hash.slice(0, 20)}...`);
      songNumber++;
    } catch (error: any) {
      console.log(`   ❌ ${error.shortMessage || error.message}`);
      // Continue anyway
    }

    await new Promise(r => setTimeout(r, 3000)); // 3s delay
  }

  // Final count
  const finalCounts = await publicClient.readContract({
    address: ARTIST_TOKEN_V2,
    abi,
    functionName: 'getCurrentTokenCounts',
  });
  
  console.log(`\n✅ Final: ${finalCounts[1]} songs tokenized`);
}

seed().catch(console.error);
