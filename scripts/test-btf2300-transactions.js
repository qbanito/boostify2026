/**
 * BTF-2300 Real Transaction Tests
 * 
 * ⚠️ IMPORTANTE: Este script requiere una private key para firmar transacciones
 * Solo usar con wallets de testing o con fondos mínimos
 * 
 * Uso: PRIVATE_KEY=0x... node scripts/test-btf2300-transactions.js
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Contract Addresses
const CONTRACTS = {
  artistToken: '0x76F4c51204E096f6993A6171B524A7AaedDcD723',
  dex: '0xdDcB670fA7eedc85Da3923beDca8dfe225f7146E',
  royalties: '0xF871a26F3Ed6AF4957f7c8fE7e53720D6B2Aca76',
};

// ABI for write functions
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
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'maxPricePerToken', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'buyTokens',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'payable',
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
];

async function main() {
  console.log('\n🚀 BTF-2300 Real Transaction Tests on Polygon Mainnet\n');
  console.log('═'.repeat(60) + '\n');

  // Check for private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ ERROR: Private key required!');
    console.log('\nUso: PRIVATE_KEY=0x... node scripts/test-btf2300-transactions.js');
    console.log('\n⚠️  ADVERTENCIA: Solo usa wallets de testing con fondos mínimos!\n');
    process.exit(1);
  }

  // Setup clients
  const account = privateKeyToAccount(privateKey);
  console.log(`👛 Wallet: ${account.address}\n`);

  const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${formatEther(balance)} MATIC\n`);

  if (balance < parseEther('0.01')) {
    console.error('❌ Insufficient balance! Need at least 0.01 MATIC for gas');
    process.exit(1);
  }

  // ============ TEST 1: Register Artist ============
  console.log('━'.repeat(60));
  console.log('📝 TEST 1: Register Artist');
  console.log('━'.repeat(60));

  try {
    // Check if already registered
    const [totalArtists] = await publicClient.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'getCurrentTokenCounts',
    });

    console.log(`Current artists registered: ${totalArtists}`);

    // Register new artist
    console.log('\n📤 Sending registerArtist transaction...');
    
    const hash1 = await walletClient.writeContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'registerArtist',
      args: [
        account.address,
        'Boostify Test Artist',
        'ipfs://QmBoostifyTestArtistMetadata',
      ],
    });

    console.log(`✅ TX Hash: ${hash1}`);
    console.log(`   View: https://polygonscan.com/tx/${hash1}`);

    // Wait for confirmation
    console.log('\n⏳ Waiting for confirmation...');
    const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
    console.log(`✅ Confirmed in block: ${receipt1.blockNumber}`);
    console.log(`   Gas used: ${receipt1.gasUsed}`);

    // Verify registration
    const [newTotalArtists] = await publicClient.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'getCurrentTokenCounts',
    });
    console.log(`\n🎉 Artists now registered: ${newTotalArtists}`);

  } catch (error) {
    if (error.message.includes('Artist already registered')) {
      console.log('ℹ️  Artist already registered, skipping...');
    } else {
      console.error(`\n❌ Error: ${error.message}`);
    }
  }

  // ============ TEST 2: Tokenize Song ============
  console.log('\n' + '━'.repeat(60));
  console.log('🎵 TEST 2: Tokenize Song');
  console.log('━'.repeat(60));

  try {
    console.log('\n📤 Sending tokenizeSong transaction...');
    
    const hash2 = await walletClient.writeContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'tokenizeSong',
      args: [
        1n, // artistId
        'Boostify Test Song #1',
        'ipfs://QmBoostifyTestSongMetadata',
        10000n, // totalSupply: 10,000 tokens
        parseEther('0.001'), // pricePerToken: 0.001 MATIC
      ],
    });

    console.log(`✅ TX Hash: ${hash2}`);
    console.log(`   View: https://polygonscan.com/tx/${hash2}`);

    // Wait for confirmation
    console.log('\n⏳ Waiting for confirmation...');
    const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
    console.log(`✅ Confirmed in block: ${receipt2.blockNumber}`);
    console.log(`   Gas used: ${receipt2.gasUsed}`);

    // Verify tokenization
    const [, newTotalSongs] = await publicClient.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'getCurrentTokenCounts',
    });
    console.log(`\n🎉 Songs now tokenized: ${newTotalSongs}`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }

  // ============ TEST 3: Buy Tokens ============
  console.log('\n' + '━'.repeat(60));
  console.log('💳 TEST 3: Buy Song Tokens');
  console.log('━'.repeat(60));

  try {
    // Song token ID = 2_000_000_000 + 1 (first song)
    const songTokenId = 2000000001n;
    const tokensToBuy = 10n;
    const pricePerToken = parseEther('0.001');
    const totalPrice = pricePerToken * tokensToBuy;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

    console.log(`\n📤 Buying ${tokensToBuy} tokens for ${formatEther(totalPrice)} MATIC...`);
    
    const hash3 = await walletClient.writeContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'buyTokens',
      args: [
        songTokenId,
        tokensToBuy,
        pricePerToken,
        deadline,
      ],
      value: totalPrice,
    });

    console.log(`✅ TX Hash: ${hash3}`);
    console.log(`   View: https://polygonscan.com/tx/${hash3}`);

    // Wait for confirmation
    console.log('\n⏳ Waiting for confirmation...');
    const receipt3 = await publicClient.waitForTransactionReceipt({ hash: hash3 });
    console.log(`✅ Confirmed in block: ${receipt3.blockNumber}`);
    console.log(`   Gas used: ${receipt3.gasUsed}`);

    console.log(`\n🎉 Successfully purchased ${tokensToBuy} song tokens!`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }

  // ============ SUMMARY ============
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL STATUS');
  console.log('═'.repeat(60));

  try {
    const [totalArtists, totalSongs, totalCatalogs, totalLicenses] = await publicClient.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'getCurrentTokenCounts',
    });

    console.log(`
┌─────────────────┬────────────┐
│ Metric          │ Count      │
├─────────────────┼────────────┤
│ Artists         │ ${totalArtists.toString().padEnd(10)} │
│ Songs           │ ${totalSongs.toString().padEnd(10)} │
│ Catalogs        │ ${totalCatalogs.toString().padEnd(10)} │
│ Licenses        │ ${totalLicenses.toString().padEnd(10)} │
└─────────────────┴────────────┘

📋 PolygonScan Contract:
https://polygonscan.com/address/${CONTRACTS.artistToken}
`);
  } catch (error) {
    console.error(`Error getting final status: ${error.message}`);
  }
}

main().catch(console.error);
