/**
 * Tokenize Songs for Artists on BTF-2300
 * 
 * Creates song tokens that users can actually purchase.
 * Each song token has a supply and price.
 */
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

const ARTIST_TOKEN = '0x8D39Ee33fBA624Da8666d74428aD5De2DfE8e469' as const;
const METADATA_BASE_URL = 'https://boostify-music.onrender.com/api/metadata/song/';

// Songs to tokenize - one flagship song per artist
const SONGS = [
  { artistId: 1, title: "Boostify Anthem", supply: 10000, price: "0.001" },
  { artistId: 2, title: "Urban Pulse Beat", supply: 10000, price: "0.001" },
  { artistId: 3, title: "Neon Nights", supply: 10000, price: "0.001" },
  { artistId: 4, title: "Electric Symphony", supply: 10000, price: "0.001" },
  { artistId: 5, title: "Soul Frequency Vibes", supply: 10000, price: "0.001" },
  { artistId: 6, title: "Midnight Groove", supply: 10000, price: "0.001" },
  { artistId: 7, title: "Crimson Beats Drop", supply: 10000, price: "0.001" },
  { artistId: 8, title: "Cosmic Rhythm", supply: 10000, price: "0.001" },
  { artistId: 9, title: "Golden Harmonics", supply: 10000, price: "0.001" },
  { artistId: 10, title: "Thunder Voice", supply: 10000, price: "0.001" },
  { artistId: 11, title: "Crystal Notes", supply: 10000, price: "0.001" },
  { artistId: 12, title: "Velvet Sound", supply: 10000, price: "0.001" },
  { artistId: 13, title: "Phoenix Rising", supply: 10000, price: "0.001" },
  { artistId: 14, title: "Digital Dreams", supply: 10000, price: "0.001" },
  { artistId: 15, title: "Mystic Waves", supply: 10000, price: "0.001" },
  { artistId: 16, title: "Street Poetry", supply: 10000, price: "0.001" },
  { artistId: 17, title: "Aurora Beats", supply: 10000, price: "0.001" },
  { artistId: 18, title: "Rhythm Nation", supply: 10000, price: "0.001" },
  { artistId: 19, title: "Chrome Hearts", supply: 10000, price: "0.001" },
  { artistId: 20, title: "Bassline Kings", supply: 10000, price: "0.001" },
];

const tokenizeSongAbi = [{
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
}] as const;

const tokenCountsAbi = [{
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
}] as const;

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           BTF-2300 SONG TOKENIZATION                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PLATFORM_PRIVATE_KEY not found');
    return;
  }
  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

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
  
  const balance = await publicClient.getBalance({ address: account.address });
  console.log('💰 Balance:', formatEther(balance), 'MATIC');
  
  // Get current counts
  const counts = await publicClient.readContract({
    address: ARTIST_TOKEN,
    abi: tokenCountsAbi,
    functionName: 'getCurrentTokenCounts'
  });
  console.log('📊 Current songs tokenized:', counts[1].toString());
  console.log('');

  if (Number(counts[1]) >= SONGS.length) {
    console.log('✅ Songs already tokenized. Skipping.');
    return;
  }

  console.log('─'.repeat(60));
  console.log('🎵 TOKENIZING SONGS');
  console.log('─'.repeat(60));

  let tokenized = 0;

  for (const song of SONGS) {
    try {
      const metadataURI = `${METADATA_BASE_URL}${song.artistId}`;
      const priceWei = parseEther(song.price);
      
      console.log(`   🔄 Tokenizing "${song.title}"...`);
      console.log(`      Artist ID: ${song.artistId}, Supply: ${song.supply}, Price: ${song.price} MATIC`);

      const hash = await walletClient.writeContract({
        address: ARTIST_TOKEN,
        abi: tokenizeSongAbi,
        functionName: 'tokenizeSong',
        args: [
          BigInt(song.artistId),
          song.title,
          metadataURI,
          BigInt(song.supply),
          priceWei
        ],
      });

      console.log(`      TX: ${hash.slice(0, 20)}...`);
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        console.log(`   ✅ "${song.title}" tokenized!`);
        tokenized++;
      } else {
        console.log(`   ❌ "${song.title}" - Transaction failed`);
      }

      // Delay
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (error: any) {
      console.log(`   ❌ "${song.title}" - Error: ${error.message?.slice(0, 80)}`);
    }
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('📋 TOKENIZATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   ✅ Tokenized: ${tokenized}`);

  // Final count
  const finalCounts = await publicClient.readContract({
    address: ARTIST_TOKEN,
    abi: tokenCountsAbi,
    functionName: 'getCurrentTokenCounts'
  });
  console.log(`   📊 Total songs now: ${finalCounts[1].toString()}`);
  console.log('');
  console.log('🎉 Songs are now available for purchase on BoostiSwap!');
}

main().catch(console.error);
