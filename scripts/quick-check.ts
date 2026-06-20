/**
 * Quick contract status check
 */
import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';

const client = createPublicClient({
  chain: polygon,
  transport: http('https://polygon-rpc.com'),
});

const ADDR = '0x8D39Ee33fBA624Da8666d74428aD5De2DfE8e469' as const;

async function check() {
  console.log('=== BTF-2300 QUICK CHECK ===\n');
  
  // Check if paused
  try {
    const paused = await client.readContract({
      address: ADDR,
      abi: [{ inputs: [], name: 'paused', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' }],
      functionName: 'paused'
    });
    console.log('Contract Paused:', paused ? '🔴 YES - CANNOT TRANSACT!' : '🟢 NO');
  } catch (e: any) {
    console.log('Paused check error:', e.message?.slice(0, 50));
  }
  
  // Check artist 1 status
  try {
    const artist = await client.readContract({
      address: ADDR,
      abi: [{
        inputs: [{ type: 'uint256' }],
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
          { name: 'registeredAt', type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function'
      }],
      functionName: 'artists',
      args: [1n]
    });
    console.log('Artist 1:', artist[2], '- isActive:', artist[7]);
  } catch (e: any) {
    console.log('Artist check error:', e.message?.slice(0, 50));
  }
  
  // Check song count
  try {
    const counts = await client.readContract({
      address: ADDR,
      abi: [{
        inputs: [],
        name: 'getCurrentTokenCounts',
        outputs: [
          { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function'
      }],
      functionName: 'getCurrentTokenCounts'
    });
    console.log('Artists:', counts[0].toString(), '| Songs:', counts[1].toString());
  } catch (e: any) {
    console.log('Counts error:', e.message?.slice(0, 50));
  }
}

check().catch(console.error);
