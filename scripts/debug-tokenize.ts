/**
 * Debug tokenizeSong with detailed error
 */
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

const ARTIST_TOKEN = '0x8D39Ee33fBA624Da8666d74428aD5De2DfE8e469' as const;

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

async function debug() {
  console.log('=== DEBUG TOKENIZE SONG ===\n');

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
  
  console.log('Wallet:', account.address);
  console.log('');
  
  // Parameters for tokenizeSong
  const args = {
    artistId: 1n,
    title: 'Test Song',
    metadataURI: 'https://boostify-music.onrender.com/api/metadata/song/1',
    totalSupply: 10000n,
    pricePerToken: parseEther('0.001') // 0.001 MATIC
  };
  
  console.log('Parameters:');
  console.log('  artistId:', args.artistId.toString());
  console.log('  title:', args.title);
  console.log('  metadataURI:', args.metadataURI);
  console.log('  totalSupply:', args.totalSupply.toString());
  console.log('  pricePerToken:', args.pricePerToken.toString(), 'wei');
  console.log('');

  // Try to simulate
  console.log('Simulating tokenizeSong...');
  try {
    const { request } = await publicClient.simulateContract({
      address: ARTIST_TOKEN,
      abi: tokenizeSongAbi,
      functionName: 'tokenizeSong',
      args: [args.artistId, args.title, args.metadataURI, args.totalSupply, args.pricePerToken],
      account: account.address,
    });
    
    console.log('✅ Simulation SUCCESS!');
    console.log('Request:', JSON.stringify(request, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  } catch (error: any) {
    console.log('❌ Simulation FAILED');
    console.log('');
    console.log('Full error:');
    console.log(error);
    console.log('');
    
    // Try to decode the error
    if (error.cause) {
      console.log('Cause:', error.cause);
    }
    if (error.shortMessage) {
      console.log('Short message:', error.shortMessage);
    }
    if (error.metaMessages) {
      console.log('Meta messages:', error.metaMessages);
    }
  }
}

debug().catch(console.error);
