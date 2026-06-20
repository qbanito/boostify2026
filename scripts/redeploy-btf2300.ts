/**
 * Redeploy BTF-2300 contracts with the fix for ERC1155InvalidReceiver
 * 
 * The previous deployment had a bug: the ArtistToken contract uses
 * _mint(address(this), ...) for custody model, but didn't implement
 * onERC1155Received, causing ERC1155InvalidReceiver error.
 */
import { createPublicClient, createWalletClient, http, parseEther, formatEther, encodeDeployData } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// You need to compile the contracts with Hardhat first
// npx hardhat compile

async function deploy() {
  console.log('=== BTF-2300 REDEPLOYMENT ===\n');
  console.log('Fixing ERC1155InvalidReceiver bug...\n');

  let privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PLATFORM_PRIVATE_KEY not found');
    return;
  }
  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log('Deployer:', account.address);

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
  console.log('Balance:', formatEther(balance), 'MATIC');
  
  if (balance < parseEther('1')) {
    console.error('❌ Need at least 1 MATIC for deployment');
    return;
  }
  console.log('');

  // Try to load compiled artifacts
  // Check if hardhat artifacts exist
  const artifactsPath = path.join(process.cwd(), 'artifacts', 'contracts');
  
  if (!fs.existsSync(artifactsPath)) {
    console.log('⚠️  No compiled artifacts found.');
    console.log('');
    console.log('Please compile the contracts first:');
    console.log('  1. Install Hardhat if not installed:');
    console.log('     npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox');
    console.log('');
    console.log('  2. Create hardhat.config.js with:');
    console.log(`
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    polygon: {
      url: "https://polygon-rpc.com",
      accounts: [process.env.PLATFORM_PRIVATE_KEY]
    }
  }
};
`);
    console.log('  3. Compile contracts:');
    console.log('     npx hardhat compile');
    console.log('');
    console.log('  4. Run this script again');
    return;
  }

  // Load ArtistToken artifact
  const artistTokenArtifact = JSON.parse(
    fs.readFileSync(
      path.join(artifactsPath, 'BTF2300_ArtistToken.sol', 'BTF2300ArtistToken.json'),
      'utf8'
    )
  );

  const dexArtifact = JSON.parse(
    fs.readFileSync(
      path.join(artifactsPath, 'BTF2300_DEX.sol', 'BTF2300DEX.json'),
      'utf8'
    )
  );

  const royaltiesArtifact = JSON.parse(
    fs.readFileSync(
      path.join(artifactsPath, 'BTF2300_Royalties.sol', 'BTF2300Royalties.json'),
      'utf8'
    )
  );

  console.log('📦 Artifacts loaded successfully');
  console.log('');

  // Deploy ArtistToken
  console.log('1️⃣  Deploying ArtistToken...');
  const artistTokenHash = await walletClient.deployContract({
    abi: artistTokenArtifact.abi,
    bytecode: artistTokenArtifact.bytecode as `0x${string}`,
    args: [
      'https://boostify-music.onrender.com/api/metadata/', // baseMetadataURI
      account.address, // platformWallet
    ],
  });
  
  console.log('   TX:', artistTokenHash);
  const artistTokenReceipt = await publicClient.waitForTransactionReceipt({ hash: artistTokenHash });
  const artistTokenAddress = artistTokenReceipt.contractAddress!;
  console.log('   ✅ ArtistToken:', artistTokenAddress);
  console.log('');

  // Deploy DEX
  console.log('2️⃣  Deploying DEX...');
  const dexHash = await walletClient.deployContract({
    abi: dexArtifact.abi,
    bytecode: dexArtifact.bytecode as `0x${string}`,
    args: [artistTokenAddress],
  });
  
  console.log('   TX:', dexHash);
  const dexReceipt = await publicClient.waitForTransactionReceipt({ hash: dexHash });
  const dexAddress = dexReceipt.contractAddress!;
  console.log('   ✅ DEX:', dexAddress);
  console.log('');

  // Deploy Royalties
  console.log('3️⃣  Deploying Royalties...');
  const royaltiesHash = await walletClient.deployContract({
    abi: royaltiesArtifact.abi,
    bytecode: royaltiesArtifact.bytecode as `0x${string}`,
    args: [
      artistTokenAddress,
      account.address, // platformWallet
    ],
  });
  
  console.log('   TX:', royaltiesHash);
  const royaltiesReceipt = await publicClient.waitForTransactionReceipt({ hash: royaltiesHash });
  const royaltiesAddress = royaltiesReceipt.contractAddress!;
  console.log('   ✅ Royalties:', royaltiesAddress);
  console.log('');

  // Print all addresses
  console.log('=== NEW CONTRACT ADDRESSES ===');
  console.log(`VITE_BTF2300_ARTIST_TOKEN=${artistTokenAddress}`);
  console.log(`VITE_BTF2300_DEX=${dexAddress}`);
  console.log(`VITE_BTF2300_ROYALTIES=${royaltiesAddress}`);
  console.log('');
  console.log('Update your .env file with these addresses!');
}

deploy().catch(console.error);
