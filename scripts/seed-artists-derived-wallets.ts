/**
 * Seed Artists with Derived Wallets
 * 
 * Genera wallets determinísticas para cada artista y los registra en blockchain.
 * Usa la private key de la plataforma como seed para derivar wallets únicas.
 */
import { createPublicClient, createWalletClient, http, formatEther, keccak256, toBytes, parseEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const ARTIST_TOKEN = '0x8D39Ee33fBA624Da8666d74428aD5De2DfE8e469' as const;
const METADATA_BASE_URL = 'https://boostify-music.onrender.com/api/metadata/artist/';

// Artists to register (IDs 2-20, since 1 is already registered)
const ARTISTS = [
  { id: 2, name: "Urban Pulse" },
  { id: 3, name: "Neon Velocity" },
  { id: 4, name: "Electric Symphony" },
  { id: 5, name: "Soul Frequency" },
  { id: 6, name: "Midnight Groove" },
  { id: 7, name: "Crimson Beats" },
  { id: 8, name: "Cosmic Rhythm" },
  { id: 9, name: "Golden Harmonics" },
  { id: 10, name: "Thunder Voice" },
  { id: 11, name: "Crystal Notes" },
  { id: 12, name: "Velvet Sound" },
  { id: 13, name: "Phoenix Rising" },
  { id: 14, name: "Digital Dreams" },
  { id: 15, name: "Mystic Waves" },
  { id: 16, name: "Street Poetry" },
  { id: 17, name: "Aurora Beats" },
  { id: 18, name: "Rhythm Nation" },
  { id: 19, name: "Chrome Hearts" },
  { id: 20, name: "Bassline Kings" },
];

const registerArtistAbi = [{
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
}] as const;

const artistIdByWalletAbi = [{
  inputs: [{ name: '', type: 'address' }],
  name: 'artistIdByWallet',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
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

// Derive a unique wallet for each artist from platform key
function deriveArtistWallet(platformKey: string, artistId: number): `0x${string}` {
  const seed = `${platformKey}:artist:${artistId}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `0x${hash}` as `0x${string}`;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     BTF-2300 ARTIST REGISTRATION WITH DERIVED WALLETS        ║');
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

  const platformAccount = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account: platformAccount,
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  console.log('📍 Platform wallet:', platformAccount.address);
  
  const balance = await publicClient.getBalance({ address: platformAccount.address });
  console.log('💰 Balance:', formatEther(balance), 'MATIC');
  
  // Get current counts
  const counts = await publicClient.readContract({
    address: ARTIST_TOKEN,
    abi: tokenCountsAbi,
    functionName: 'getCurrentTokenCounts'
  });
  console.log('📊 Current artists in contract:', counts[0].toString());
  console.log('');

  console.log('─'.repeat(60));
  console.log('📝 REGISTERING ARTISTS WITH UNIQUE WALLETS');
  console.log('─'.repeat(60));

  let registered = 0;
  let skipped = 0;
  const derivedWallets: { artistId: number; name: string; wallet: string }[] = [];

  for (const artist of ARTISTS) {
    // Derive unique wallet address for this artist
    const artistWallet = deriveArtistWallet(privateKey, artist.id);
    const artistAccount = privateKeyToAccount(artistWallet);
    
    derivedWallets.push({
      artistId: artist.id,
      name: artist.name,
      wallet: artistAccount.address
    });

    try {
      // Check if this derived wallet is already registered
      const existingId = await publicClient.readContract({
        address: ARTIST_TOKEN,
        abi: artistIdByWalletAbi,
        functionName: 'artistIdByWallet',
        args: [artistAccount.address]
      });

      if (existingId > 0n) {
        console.log(`   ⏭️  ${artist.name} - Already registered (ID ${existingId})`);
        skipped++;
        continue;
      }

      const profileURI = `${METADATA_BASE_URL}${artist.id}`;
      console.log(`   🔄 Registering ${artist.name}...`);
      console.log(`      Wallet: ${artistAccount.address}`);

      // Register using platform wallet (has MINTER_ROLE)
      // but assign the identity token to the derived artist wallet
      const hash = await walletClient.writeContract({
        address: ARTIST_TOKEN,
        abi: registerArtistAbi,
        functionName: 'registerArtist',
        args: [artistAccount.address, artist.name, profileURI],
      });

      console.log(`      TX: ${hash.slice(0, 20)}...`);
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        console.log(`   ✅ ${artist.name} registered!`);
        registered++;
      } else {
        console.log(`   ❌ ${artist.name} - Transaction failed`);
      }

      // Delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (error: any) {
      console.log(`   ❌ ${artist.name} - Error: ${error.message?.slice(0, 80)}`);
    }
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('📋 REGISTRATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   ✅ Registered: ${registered}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);

  // Final count
  const finalCounts = await publicClient.readContract({
    address: ARTIST_TOKEN,
    abi: tokenCountsAbi,
    functionName: 'getCurrentTokenCounts'
  });
  console.log(`   📊 Total artists now: ${finalCounts[0].toString()}`);
  
  console.log('');
  console.log('🔑 DERIVED WALLETS (save these!):');
  console.log('─'.repeat(60));
  for (const w of derivedWallets) {
    console.log(`   Artist ${w.artistId} (${w.name}): ${w.wallet}`);
  }
}

main().catch(console.error);
