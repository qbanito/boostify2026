/**
 * Quick check V2 contracts status
 */
import { createPublicClient, http, formatEther } from 'viem';
import { polygon } from 'viem/chains';

const ARTIST_TOKEN_V2 = '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027' as const;

const abi = [
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
] as const;

async function check() {
  console.log('=== BTF-2300 V2 STATUS ===\n');

  const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  const counts = await publicClient.readContract({
    address: ARTIST_TOKEN_V2,
    abi,
    functionName: 'getCurrentTokenCounts',
  });

  console.log(`🎨 Artists: ${counts[0]}`);
  console.log(`🎵 Songs: ${counts[1]}`);
  console.log(`💿 Catalogs: ${counts[2]}`);
  console.log(`📜 Licenses: ${counts[3]}`);
}

check().catch(console.error);
