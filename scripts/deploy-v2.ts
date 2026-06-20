/**
 * Deploy BTF-2300 contracts to Polygon Mainnet
 * 
 * This deploys the FIXED version that includes onERC1155Received
 * to allow the contract to hold its own tokens (custody model)
 */
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function deploy() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     BTF-2300 CONTRACT DEPLOYMENT - POLYGON MAINNET         ║');
  console.log('║     (Fixed: ERC1155InvalidReceiver bug)                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PLATFORM_PRIVATE_KEY not found in .env');
    return;
  }
  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log('📍 Deployer Address:', account.address);

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
  console.log('💰 Balance:', formatEther(balance), 'MATIC');
  
  if (balance < parseEther('5')) {
    console.error('⚠️  Warning: Low balance. Deployment may fail.');
  }
  console.log('');

  // Load compiled artifacts
  const compiledDir = path.join(process.cwd(), 'compiled');
  
  const artistTokenArtifact = JSON.parse(
    fs.readFileSync(path.join(compiledDir, 'BTF2300ArtistToken.json'), 'utf8')
  );
  const dexArtifact = JSON.parse(
    fs.readFileSync(path.join(compiledDir, 'BTF2300DEX.json'), 'utf8')
  );
  const royaltiesArtifact = JSON.parse(
    fs.readFileSync(path.join(compiledDir, 'BTF2300Royalties.json'), 'utf8')
  );

  console.log('📦 Compiled artifacts loaded');
  console.log(`   - ArtistToken: ${artistTokenArtifact.bytecode.length / 2} bytes`);
  console.log(`   - DEX: ${dexArtifact.bytecode.length / 2} bytes`);
  console.log(`   - Royalties: ${royaltiesArtifact.bytecode.length / 2} bytes`);
  console.log('');

  // Constructor args
  const platformWallet = account.address;
  const baseMetadataURI = 'https://boostify-music.onrender.com/api/metadata/';

  console.log('📋 Constructor Arguments:');
  console.log(`   platformWallet: ${platformWallet}`);
  console.log(`   baseMetadataURI: ${baseMetadataURI}`);
  console.log('');

  // 1. Deploy ArtistToken
  console.log('════════════════════════════════════════════════════════════');
  console.log('1️⃣  DEPLOYING ArtistToken...');
  console.log('════════════════════════════════════════════════════════════');
  
  const artistTokenHash = await walletClient.deployContract({
    abi: artistTokenArtifact.abi,
    bytecode: artistTokenArtifact.bytecode as `0x${string}`,
    args: [platformWallet, baseMetadataURI],  // Order: platformWallet first, then baseMetadataURI
  });
  
  console.log('   📤 TX Hash:', artistTokenHash);
  console.log('   ⏳ Waiting for confirmation...');
  
  const artistTokenReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: artistTokenHash,
    confirmations: 2,
  });
  
  const artistTokenAddress = artistTokenReceipt.contractAddress!;
  console.log('   ✅ ArtistToken deployed at:', artistTokenAddress);
  console.log('   ⛽ Gas used:', artistTokenReceipt.gasUsed.toString());
  console.log('');

  // 2. Deploy DEX
  console.log('════════════════════════════════════════════════════════════');
  console.log('2️⃣  DEPLOYING DEX...');
  console.log('════════════════════════════════════════════════════════════');
  
  const dexHash = await walletClient.deployContract({
    abi: dexArtifact.abi,
    bytecode: dexArtifact.bytecode as `0x${string}`,
    args: [artistTokenAddress, platformWallet],  // btfToken, feeRecipient
  });
  
  console.log('   📤 TX Hash:', dexHash);
  console.log('   ⏳ Waiting for confirmation...');
  
  const dexReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: dexHash,
    confirmations: 2,
  });
  
  const dexAddress = dexReceipt.contractAddress!;
  console.log('   ✅ DEX deployed at:', dexAddress);
  console.log('   ⛽ Gas used:', dexReceipt.gasUsed.toString());
  console.log('');

  // 3. Deploy Royalties
  console.log('════════════════════════════════════════════════════════════');
  console.log('3️⃣  DEPLOYING Royalties...');
  console.log('════════════════════════════════════════════════════════════');
  
  const royaltiesHash = await walletClient.deployContract({
    abi: royaltiesArtifact.abi,
    bytecode: royaltiesArtifact.bytecode as `0x${string}`,
    args: [artistTokenAddress, platformWallet],
  });
  
  console.log('   📤 TX Hash:', royaltiesHash);
  console.log('   ⏳ Waiting for confirmation...');
  
  const royaltiesReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: royaltiesHash,
    confirmations: 2,
  });
  
  const royaltiesAddress = royaltiesReceipt.contractAddress!;
  console.log('   ✅ Royalties deployed at:', royaltiesAddress);
  console.log('   ⛽ Gas used:', royaltiesReceipt.gasUsed.toString());
  console.log('');

  // Summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    DEPLOYMENT COMPLETE                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📍 NEW CONTRACT ADDRESSES:');
  console.log('');
  console.log(`VITE_BTF2300_ARTIST_TOKEN=${artistTokenAddress}`);
  console.log(`VITE_BTF2300_DEX=${dexAddress}`);
  console.log(`VITE_BTF2300_ROYALTIES=${royaltiesAddress}`);
  console.log('');
  
  console.log('🔗 PolygonScan Links:');
  console.log(`   ArtistToken: https://polygonscan.com/address/${artistTokenAddress}`);
  console.log(`   DEX: https://polygonscan.com/address/${dexAddress}`);
  console.log(`   Royalties: https://polygonscan.com/address/${royaltiesAddress}`);
  console.log('');

  // Save to file
  const deploymentInfo = {
    network: 'polygon',
    chainId: 137,
    timestamp: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      artistToken: artistTokenAddress,
      dex: dexAddress,
      royalties: royaltiesAddress,
    },
    transactions: {
      artistToken: artistTokenHash,
      dex: dexHash,
      royalties: royaltiesHash,
    }
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'deployment-v2.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log('💾 Deployment info saved to deployment-v2.json');
  console.log('');
  console.log('⚠️  NEXT STEPS:');
  console.log('   1. Update .env with new contract addresses');
  console.log('   2. Run: npx tsx scripts/setup-new-contracts.ts');
  console.log('   3. Run: npx tsx scripts/seed-artists-v2.ts');
}

deploy().catch(console.error);
