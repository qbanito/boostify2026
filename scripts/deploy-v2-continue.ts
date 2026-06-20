/**
 * Continue deployment from ArtistToken already deployed
 */
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// ArtistToken already deployed!
const ARTIST_TOKEN_V2 = '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027' as const;

async function deploy() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     CONTINUE BTF-2300 DEPLOYMENT (DEX + Royalties)         ║');
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
  console.log('📍 Deployer:', account.address);
  console.log('📍 ArtistToken V2:', ARTIST_TOKEN_V2);

  const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('💰 Balance:', formatEther(balance), 'MATIC');
  console.log('');

  const compiledDir = path.join(process.cwd(), 'compiled');
  
  const dexArtifact = JSON.parse(
    fs.readFileSync(path.join(compiledDir, 'BTF2300DEX.json'), 'utf8')
  );
  const royaltiesArtifact = JSON.parse(
    fs.readFileSync(path.join(compiledDir, 'BTF2300Royalties.json'), 'utf8')
  );

  const platformWallet = account.address;

  // Deploy DEX
  console.log('════════════════════════════════════════════════════════════');
  console.log('2️⃣  DEPLOYING DEX...');
  console.log('════════════════════════════════════════════════════════════');
  
  const dexHash = await walletClient.deployContract({
    abi: dexArtifact.abi,
    bytecode: dexArtifact.bytecode as `0x${string}`,
    args: [ARTIST_TOKEN_V2, platformWallet],  // btfToken, feeRecipient
  });
  
  console.log('   📤 TX Hash:', dexHash);
  console.log('   ⏳ Waiting...');
  
  const dexReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: dexHash,
    confirmations: 2,
  });
  
  const dexAddress = dexReceipt.contractAddress!;
  console.log('   ✅ DEX:', dexAddress);
  console.log('');

  // Deploy Royalties
  console.log('════════════════════════════════════════════════════════════');
  console.log('3️⃣  DEPLOYING Royalties...');
  console.log('════════════════════════════════════════════════════════════');
  
  const royaltiesHash = await walletClient.deployContract({
    abi: royaltiesArtifact.abi,
    bytecode: royaltiesArtifact.bytecode as `0x${string}`,
    args: [ARTIST_TOKEN_V2, platformWallet],  // btfToken, platformWallet
  });
  
  console.log('   📤 TX Hash:', royaltiesHash);
  console.log('   ⏳ Waiting...');
  
  const royaltiesReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: royaltiesHash,
    confirmations: 2,
  });
  
  const royaltiesAddress = royaltiesReceipt.contractAddress!;
  console.log('   ✅ Royalties:', royaltiesAddress);
  console.log('');

  // Summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    DEPLOYMENT COMPLETE                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📍 NEW CONTRACT ADDRESSES (v2):');
  console.log('');
  console.log(`VITE_BTF2300_ARTIST_TOKEN=${ARTIST_TOKEN_V2}`);
  console.log(`VITE_BTF2300_DEX=${dexAddress}`);
  console.log(`VITE_BTF2300_ROYALTIES=${royaltiesAddress}`);
  console.log('');

  // Save
  const deploymentInfo = {
    network: 'polygon',
    chainId: 137,
    timestamp: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      artistToken: ARTIST_TOKEN_V2,
      dex: dexAddress,
      royalties: royaltiesAddress,
    }
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'deployment-v2.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log('💾 Saved to deployment-v2.json');
}

deploy().catch(console.error);
