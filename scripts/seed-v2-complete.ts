/**
 * Seed all artists and songs to the new V2 contracts
 */
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

// NEW V2 Contract
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
] as const;

// Artists to register (from database)
const artists = [
  { name: 'Luna Waves', genre: 'Electronic' },
  { name: 'Marcus Cole', genre: 'Hip Hop' },
  { name: 'The Midnight Echoes', genre: 'Indie Rock' },
  { name: 'Sarah Chen', genre: 'Pop' },
  { name: 'Django Rhythms', genre: 'Jazz' },
  { name: 'Northern Lights', genre: 'Ambient' },
  { name: 'Pulse Theory', genre: 'EDM' },
  { name: 'River Stone', genre: 'Folk' },
  { name: 'Cyber Pulse', genre: 'Synthwave' },
  { name: 'Maria Valdez', genre: 'Latin' },
  { name: 'The Velvet Underground Revival', genre: 'Alternative' },
  { name: 'DJ Spectrum', genre: 'House' },
  { name: 'Acoustic Dreams', genre: 'Acoustic' },
  { name: 'Bass Mechanics', genre: 'Drum & Bass' },
  { name: 'Soul Kitchen', genre: 'R&B' },
  { name: 'Crystal Harmonics', genre: 'New Age' },
  { name: 'Urban Poets', genre: 'Rap' },
  { name: 'Classical Fusion', genre: 'Classical Crossover' },
  { name: 'Reggae Roots', genre: 'Reggae' },
];

// Songs per artist
const songsPerArtist = [
  'Midnight Dreams',
  'Electric Soul',
  'Into the Unknown',
];

function deriveWallet(index: number): `0x${string}` {
  const hash = crypto.createHash('sha256')
    .update(`boostify-artist-v2-seed-${index}`)
    .digest('hex');
  return `0x${hash.slice(0, 40)}` as `0x${string}`;
}

async function seed() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     SEED ARTISTS & SONGS TO BTF-2300 V2                    ║');
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

  const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com', {
      timeout: 120000,
      retryCount: 5,
      retryDelay: 3000,
    }),
  });

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http('https://polygon-rpc.com', {
      timeout: 120000,
      retryCount: 5,
      retryDelay: 3000,
    }),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log('Balance:', formatEther(balance), 'MATIC');

  // Current state
  const initialCounts = await publicClient.readContract({
    address: ARTIST_TOKEN_V2,
    abi,
    functionName: 'getCurrentTokenCounts',
  });
  console.log(`\nCurrent: ${initialCounts[0]} artists, ${initialCounts[1]} songs\n`);

  // Skip already registered artists
  const startIndex = Number(initialCounts[0]);
  const artistsToRegister = artists.slice(startIndex);

  if (artistsToRegister.length === 0 && initialCounts[0] >= 20n) {
    console.log('✅ All 20 artists already registered!');
  } else {
    console.log(`═══ REGISTERING ${artistsToRegister.length} ARTISTS ═══\n`);

    for (let i = 0; i < artistsToRegister.length; i++) {
      const artist = artistsToRegister[i];
      const artistIndex = startIndex + i + 2; // +2 because test artist is 1
      const wallet = deriveWallet(artistIndex);
      const profileURI = `https://boostify-music.onrender.com/api/metadata/artist/${artistIndex}`;

      console.log(`[${i + 1}/${artistsToRegister.length}] ${artist.name}...`);

      try {
        const hash = await walletClient.writeContract({
          address: ARTIST_TOKEN_V2,
          abi,
          functionName: 'registerArtist',
          args: [wallet, artist.name, profileURI],
        });

        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        console.log(`   ✅ Registered`);
      } catch (error: any) {
        console.log(`   ⚠️  ${error.shortMessage || 'Failed'}`);
      }

      // Small delay to avoid RPC issues
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Get updated counts
  const afterArtists = await publicClient.readContract({
    address: ARTIST_TOKEN_V2,
    abi,
    functionName: 'getCurrentTokenCounts',
  });
  console.log(`\n✅ Total Artists: ${afterArtists[0]}\n`);

  // Tokenize songs
  const totalArtists = Number(afterArtists[0]);
  const currentSongs = Number(afterArtists[1]);

  // Calculate how many songs we should have
  const targetSongs = totalArtists * 3; // 3 songs per artist

  if (currentSongs >= targetSongs) {
    console.log(`✅ Already have ${currentSongs} songs tokenized`);
  } else {
    console.log(`═══ TOKENIZING SONGS ═══\n`);

    // Start from where we left off
    let songNumber = currentSongs;

    for (let artistId = 1; artistId <= totalArtists && songNumber < targetSongs; artistId++) {
      const artistSongCount = Math.min(3, targetSongs - songNumber);
      
      for (let s = 0; s < artistSongCount && songNumber < targetSongs; s++) {
        const songTitle = songsPerArtist[s % songsPerArtist.length];
        const fullTitle = `${songTitle} (Artist ${artistId})`;
        const songURI = `https://boostify-music.onrender.com/api/metadata/song/${songNumber + 1}`;

        console.log(`[Song ${songNumber + 1}] "${fullTitle}"...`);

        try {
          const hash = await walletClient.writeContract({
            address: ARTIST_TOKEN_V2,
            abi,
            functionName: 'tokenizeSong',
            args: [
              BigInt(artistId),
              fullTitle,
              songURI,
              10000n, // 10,000 tokens
              parseEther('0.001'), // 0.001 MATIC
            ],
          });

          await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
          console.log(`   ✅ Tokenized`);
          songNumber++;
        } catch (error: any) {
          console.log(`   ❌ ${error.shortMessage || 'Failed'}`);
        }

        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  // Final state
  const finalCounts = await publicClient.readContract({
    address: ARTIST_TOKEN_V2,
    abi,
    functionName: 'getCurrentTokenCounts',
  });

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    SEEDING COMPLETE                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n🎨 Artists: ${finalCounts[0]}`);
  console.log(`🎵 Songs: ${finalCounts[1]}`);
  console.log(`💿 Catalogs: ${finalCounts[2]}`);
  console.log(`📜 Licenses: ${finalCounts[3]}`);
}

seed().catch(console.error);
