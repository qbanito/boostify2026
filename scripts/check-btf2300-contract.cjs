// Script simple para verificar estado del contrato BTF-2300
require('dotenv').config();
const { createPublicClient, http, formatEther } = require('viem');
const { polygon } = require('viem/chains');

const CONTRACT = '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027';
const ABI = [
  {
    inputs: [],
    name: 'getCurrentTokenCounts',
    outputs: [{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'}],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{type:'uint256'}],
    name: 'artists',
    outputs: [{type:'uint256'},{type:'address'},{type:'string'},{type:'string'},{type:'uint256'},{type:'uint256'},{type:'bool'},{type:'bool'},{type:'uint256'}],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{type:'uint256'}],
    name: 'songs',
    outputs: [{type:'uint256'},{type:'uint256'},{type:'string'},{type:'string'},{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'bool'},{type:'uint256'},{type:'uint256'}],
    stateMutability: 'view',
    type: 'function'
  }
];

async function main() {
  const client = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com')
  });

  console.log('🔍 Verificando contrato BTF-2300...\n');
  console.log('📍 Contrato:', CONTRACT);

  // Get counts
  const counts = await client.readContract({
    address: CONTRACT,
    abi: ABI,
    functionName: 'getCurrentTokenCounts'
  });
  
  console.log('\n📊 Estado del contrato:');
  console.log('   Artistas:', counts[0].toString());
  console.log('   Canciones:', counts[1].toString());
  console.log('   Catálogos:', counts[2].toString());
  console.log('   Licencias:', counts[3].toString());

  // Get first artist
  console.log('\n🎤 Artistas registrados:');
  for (let i = 1; i <= Number(counts[0]); i++) {
    try {
      const artist = await client.readContract({
        address: CONTRACT,
        abi: ABI,
        functionName: 'artists',
        args: [BigInt(i)]
      });
      console.log(`   [${i}] ${artist[2]} - Wallet: ${artist[1].slice(0,10)}... - Activo: ${artist[7]}`);
    } catch (e) {
      console.log(`   [${i}] Error: ${e.message}`);
    }
  }

  // Get songs
  console.log('\n🎵 Canciones tokenizadas:');
  const SONG_PREFIX = 2000000000n;
  for (let i = 1; i <= Number(counts[1]); i++) {
    try {
      const tokenId = SONG_PREFIX + BigInt(i);
      const song = await client.readContract({
        address: CONTRACT,
        abi: ABI,
        functionName: 'songs',
        args: [tokenId]
      });
      console.log(`   [${tokenId}] "${song[2]}" - Supply: ${song[4].toString()} - Available: ${song[5].toString()} - Price: ${formatEther(song[6])} MATIC - Active: ${song[7]}`);
    } catch (e) {
      console.log(`   [${i}] Error: ${e.message}`);
    }
  }
}

main().catch(console.error);
