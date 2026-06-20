/**
 * BTF-2300 Contract Verification Script
 * 
 * Pruebas reales en Polygon Mainnet para verificar que los contratos funcionan
 */

import { createPublicClient, http, formatEther, parseAbi } from 'viem';
import { polygon } from 'viem/chains';

// Contract Addresses
const CONTRACTS = {
  artistToken: '0x8D39Ee33fBA624Da8666d74428aD5De2DfE8e469',
  dex: '0xdDcB670fA7eedc85Da3923beDca8dfe225f7146E',
  royalties: '0xF871a26F3Ed6AF4957f7c8fE7e53720D6B2Aca76',
};

// ABIs for testing (view functions only)
const ARTIST_TOKEN_ABI = parseAbi([
  'function contractName() view returns (string)',
  'function contractSymbol() view returns (string)',
  'function platformWallet() view returns (address)',
  'function baseMetadataURI() view returns (string)',
  'function getCurrentTokenCounts() view returns (uint256 totalArtists, uint256 totalSongs, uint256 totalCatalogs, uint256 totalLicenses)',
  'function ARTIST_ROYALTY_BPS() view returns (uint256)',
  'function PLATFORM_ROYALTY_BPS() view returns (uint256)',
  'function paused() view returns (bool)',
]);

const DEX_ABI = parseAbi([
  'function btfToken() view returns (address)',
  'function feeRecipient() view returns (address)',
  'function FEE_BPS() view returns (uint256)',
  'function maxDailyVolumePerUser() view returns (uint256)',
  'function paused() view returns (bool)',
]);

const ROYALTIES_ABI = parseAbi([
  'function btfToken() view returns (address)',
  'function platformWallet() view returns (address)',
  'function pricePerThousandStreams() view returns (uint256)',
  'function ARTIST_SHARE_BPS() view returns (uint256)',
  'function HOLDER_SHARE_BPS() view returns (uint256)',
  'function PLATFORM_SHARE_BPS() view returns (uint256)',
  'function paused() view returns (bool)',
]);

async function main() {
  console.log('🔍 BTF-2300 Contract Verification on Polygon Mainnet\n');
  console.log('='.repeat(60) + '\n');

  // Connect to Polygon
  const client = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  // Verify network
  const chainId = await client.getChainId();
  console.log(`📡 Connected to Polygon (Chain ID: ${chainId})\n`);

  if (chainId !== 137) {
    console.error('❌ ERROR: Not connected to Polygon Mainnet!');
    process.exit(1);
  }

  // ================== TEST 1: Artist Token Contract ==================
  console.log('━'.repeat(60));
  console.log('📜 TEST 1: BTF2300ArtistToken');
  console.log('━'.repeat(60));
  console.log(`Address: ${CONTRACTS.artistToken}\n`);

  try {
    // Check contract code exists
    const code = await client.getBytecode({ address: CONTRACTS.artistToken });
    if (!code) {
      throw new Error('No contract code at address');
    }
    console.log('✅ Contract code exists');

    // Read contract name
    const name = await client.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'contractName',
    });
    console.log(`✅ Contract Name: ${name}`);

    // Read symbol
    const symbol = await client.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'contractSymbol',
    });
    console.log(`✅ Contract Symbol: ${symbol}`);

    // Read platform wallet
    const platformWallet = await client.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'platformWallet',
    });
    console.log(`✅ Platform Wallet: ${platformWallet}`);

    // Read base URI
    const baseURI = await client.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'baseMetadataURI',
    });
    console.log(`✅ Base Metadata URI: ${baseURI}`);

    // Check royalty settings
    const artistRoyalty = await client.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'ARTIST_ROYALTY_BPS',
    });
    const platformRoyalty = await client.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'PLATFORM_ROYALTY_BPS',
    });
    console.log(`✅ Royalty Split: ${Number(artistRoyalty)/100}% artist / ${Number(platformRoyalty)/100}% platform`);

    // Check if paused
    const isPaused = await client.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'paused',
    });
    console.log(`✅ Contract Paused: ${isPaused ? '⚠️ YES' : 'NO'}`);

    // Get token counts
    const [totalArtists, totalSongs, totalCatalogs, totalLicenses] = await client.readContract({
      address: CONTRACTS.artistToken,
      abi: ARTIST_TOKEN_ABI,
      functionName: 'getCurrentTokenCounts',
    });
    console.log(`✅ Token Counts:`);
    console.log(`   - Artists: ${totalArtists}`);
    console.log(`   - Songs: ${totalSongs}`);
    console.log(`   - Catalogs: ${totalCatalogs}`);
    console.log(`   - Licenses: ${totalLicenses}`);

    console.log('\n🎉 BTF2300ArtistToken: ALL TESTS PASSED\n');
  } catch (error) {
    console.error(`\n❌ BTF2300ArtistToken ERROR: ${error.message}\n`);
  }

  // ================== TEST 2: DEX Contract ==================
  console.log('━'.repeat(60));
  console.log('📜 TEST 2: BTF2300DEX');
  console.log('━'.repeat(60));
  console.log(`Address: ${CONTRACTS.dex}\n`);

  try {
    // Check contract code exists
    const code = await client.getBytecode({ address: CONTRACTS.dex });
    if (!code) {
      throw new Error('No contract code at address');
    }
    console.log('✅ Contract code exists');

    // Check linked BTF token
    const btfToken = await client.readContract({
      address: CONTRACTS.dex,
      abi: DEX_ABI,
      functionName: 'btfToken',
    });
    console.log(`✅ Linked BTF Token: ${btfToken}`);
    
    if (btfToken.toLowerCase() === CONTRACTS.artistToken.toLowerCase()) {
      console.log('   ✅ Correctly linked to ArtistToken!');
    } else {
      console.log('   ⚠️ WARNING: Not linked to expected ArtistToken!');
    }

    // Fee recipient
    const feeRecipient = await client.readContract({
      address: CONTRACTS.dex,
      abi: DEX_ABI,
      functionName: 'feeRecipient',
    });
    console.log(`✅ Fee Recipient: ${feeRecipient}`);

    // Trading fee
    const feeBps = await client.readContract({
      address: CONTRACTS.dex,
      abi: DEX_ABI,
      functionName: 'FEE_BPS',
    });
    console.log(`✅ Trading Fee: ${Number(feeBps)/100}%`);

    // Max daily volume
    const maxVolume = await client.readContract({
      address: CONTRACTS.dex,
      abi: DEX_ABI,
      functionName: 'maxDailyVolumePerUser',
    });
    console.log(`✅ Max Daily Volume: ${formatEther(maxVolume)} MATIC`);

    // Check if paused
    const isPaused = await client.readContract({
      address: CONTRACTS.dex,
      abi: DEX_ABI,
      functionName: 'paused',
    });
    console.log(`✅ Contract Paused: ${isPaused ? '⚠️ YES' : 'NO'}`);

    console.log('\n🎉 BTF2300DEX: ALL TESTS PASSED\n');
  } catch (error) {
    console.error(`\n❌ BTF2300DEX ERROR: ${error.message}\n`);
  }

  // ================== TEST 3: Royalties Contract ==================
  console.log('━'.repeat(60));
  console.log('📜 TEST 3: BTF2300Royalties');
  console.log('━'.repeat(60));
  console.log(`Address: ${CONTRACTS.royalties}\n`);

  try {
    // Check contract code exists
    const code = await client.getBytecode({ address: CONTRACTS.royalties });
    if (!code) {
      throw new Error('No contract code at address');
    }
    console.log('✅ Contract code exists');

    // Check linked BTF token
    const btfToken = await client.readContract({
      address: CONTRACTS.royalties,
      abi: ROYALTIES_ABI,
      functionName: 'btfToken',
    });
    console.log(`✅ Linked BTF Token: ${btfToken}`);
    
    if (btfToken.toLowerCase() === CONTRACTS.artistToken.toLowerCase()) {
      console.log('   ✅ Correctly linked to ArtistToken!');
    } else {
      console.log('   ⚠️ WARNING: Not linked to expected ArtistToken!');
    }

    // Platform wallet
    const platformWallet = await client.readContract({
      address: CONTRACTS.royalties,
      abi: ROYALTIES_ABI,
      functionName: 'platformWallet',
    });
    console.log(`✅ Platform Wallet: ${platformWallet}`);

    // Streaming price
    const streamPrice = await client.readContract({
      address: CONTRACTS.royalties,
      abi: ROYALTIES_ABI,
      functionName: 'pricePerThousandStreams',
    });
    console.log(`✅ Price per 1000 Streams: ${formatEther(streamPrice)} MATIC`);

    // Royalty shares
    const artistShare = await client.readContract({
      address: CONTRACTS.royalties,
      abi: ROYALTIES_ABI,
      functionName: 'ARTIST_SHARE_BPS',
    });
    const holderShare = await client.readContract({
      address: CONTRACTS.royalties,
      abi: ROYALTIES_ABI,
      functionName: 'HOLDER_SHARE_BPS',
    });
    const platformShare = await client.readContract({
      address: CONTRACTS.royalties,
      abi: ROYALTIES_ABI,
      functionName: 'PLATFORM_SHARE_BPS',
    });
    console.log(`✅ Royalty Distribution:`);
    console.log(`   - Artist: ${Number(artistShare)/100}%`);
    console.log(`   - Holders: ${Number(holderShare)/100}%`);
    console.log(`   - Platform: ${Number(platformShare)/100}%`);

    // Check if paused
    const isPaused = await client.readContract({
      address: CONTRACTS.royalties,
      abi: ROYALTIES_ABI,
      functionName: 'paused',
    });
    console.log(`✅ Contract Paused: ${isPaused ? '⚠️ YES' : 'NO'}`);

    console.log('\n🎉 BTF2300Royalties: ALL TESTS PASSED\n');
  } catch (error) {
    console.error(`\n❌ BTF2300Royalties ERROR: ${error.message}\n`);
  }

  // ================== SUMMARY ==================
  console.log('═'.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`
┌─────────────────────┬──────────────────────────────────────────────┐
│ Contract            │ Address                                      │
├─────────────────────┼──────────────────────────────────────────────┤
│ BTF2300ArtistToken  │ ${CONTRACTS.artistToken} │
│ BTF2300DEX          │ ${CONTRACTS.dex} │
│ BTF2300Royalties    │ ${CONTRACTS.royalties} │
└─────────────────────┴──────────────────────────────────────────────┘

📋 PolygonScan Links:
• ArtistToken: https://polygonscan.com/address/${CONTRACTS.artistToken}
• DEX: https://polygonscan.com/address/${CONTRACTS.dex}
• Royalties: https://polygonscan.com/address/${CONTRACTS.royalties}
`);
}

main().catch(console.error);
