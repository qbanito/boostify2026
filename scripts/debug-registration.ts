/**
 * Debug artist registration on BTF-2300
 */
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

const ARTIST_TOKEN = '0x8D39Ee33fBA624Da8666d74428aD5De2DfE8e469' as const;

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

async function debug() {
  console.log('═'.repeat(50));
  console.log('🔍 DEBUG ARTIST REGISTRATION');
  console.log('═'.repeat(50));

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

  console.log('Wallet:', account.address);
  
  // Check if wallet already registered as artist
  const existingArtistId = await publicClient.readContract({
    address: ARTIST_TOKEN,
    abi: artistIdByWalletAbi,
    functionName: 'artistIdByWallet',
    args: [account.address]
  });
  
  console.log('Existing artist ID for wallet:', existingArtistId.toString());
  
  if (existingArtistId > 0n) {
    console.log('⚠️ This wallet is already registered as artist ID:', existingArtistId.toString());
    console.log('   Cannot register same wallet twice!');
    console.log('');
    console.log('SOLUTION: Use a DIFFERENT wallet address for each artist.');
    return;
  }

  // Try to simulate the call
  console.log('\nSimulating registerArtist call...');
  
  try {
    const { request } = await publicClient.simulateContract({
      address: ARTIST_TOKEN,
      abi: registerArtistAbi,
      functionName: 'registerArtist',
      args: [account.address, 'Test Artist', 'https://boostify.com/api/metadata/artist/99'],
      account: account.address,
    });
    
    console.log('✅ Simulation successful! Request:', request);
  } catch (error: any) {
    console.log('❌ Simulation failed:');
    console.log('   Error:', error.message);
    
    if (error.message.includes('Artist already registered')) {
      console.log('\n💡 REASON: The wallet address is already registered as an artist.');
      console.log('   Each artist needs a UNIQUE wallet address.');
    }
  }
}

debug().catch(console.error);
