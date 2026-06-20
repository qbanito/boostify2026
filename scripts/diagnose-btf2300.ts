/**
 * BTF-2300 Diagnostic Script
 * Verifica el estado de los contratos en Polygon
 */

import { createPublicClient, http, formatEther } from 'viem';
import { polygon } from 'viem/chains';

const artistTokenAddress = '0x8D39Ee33fBA624Da8666d74428aD5De2DfE8e469';
const dexAddress = '0xdDcB670fA7eedc85Da3923beDca8dfe225f7146E';
const royaltiesAddress = '0xF871a26F3Ed6AF4957f7c8fE7e53720D6B2Aca76';

const client = createPublicClient({
  chain: polygon,
  transport: http('https://polygon-rpc.com'),
});

const tokenCountsAbi = [{
  inputs: [],
  name: 'getCurrentTokenCounts',
  outputs: [
    { name: 'artists', type: 'uint256' },
    { name: 'songs', type: 'uint256' },
    { name: 'catalogs', type: 'uint256' },
    { name: 'licenses', type: 'uint256' }
  ],
  stateMutability: 'view',
  type: 'function'
}] as const;

const artistsAbi = [{
  inputs: [{ name: '', type: 'uint256' }],
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
}] as const;

const songsAbi = [{
  inputs: [{ name: '', type: 'uint256' }],
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
    { name: 'createdAt', type: 'uint256' }
  ],
  stateMutability: 'view',
  type: 'function'
}] as const;

const ownerAbi = [{
  inputs: [],
  name: 'owner',
  outputs: [{ name: '', type: 'address' }],
  stateMutability: 'view',
  type: 'function'
}] as const;

const poolInfoAbi = [{
  inputs: [{ name: 'tokenId', type: 'uint256' }],
  name: 'getPoolInfo',
  outputs: [
    { name: 'tokenReserve', type: 'uint256' },
    { name: 'ethReserve', type: 'uint256' },
    { name: 'totalLPTokens', type: 'uint256' },
    { name: 'feeAccumulated', type: 'uint256' },
    { name: 'isActive', type: 'bool' }
  ],
  stateMutability: 'view',
  type: 'function'
}] as const;

async function diagnose() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           BTF-2300 DIAGNOSTIC REPORT - POLYGON               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Check contracts deployed
  console.log('1️⃣ VERIFICACIÓN DE CONTRATOS DESPLEGADOS');
  console.log('─'.repeat(60));
  
  const artistCode = await client.getBytecode({ address: artistTokenAddress as `0x${string}` });
  const dexCode = await client.getBytecode({ address: dexAddress as `0x${string}` });
  const royaltiesCode = await client.getBytecode({ address: royaltiesAddress as `0x${string}` });
  
  console.log(`   ArtistToken (${artistTokenAddress}):`);
  console.log(`      ${artistCode ? '✅ DESPLEGADO (' + artistCode.length + ' chars)' : '❌ NO ENCONTRADO'}`);
  
  console.log(`   DEX (${dexAddress}):`);
  console.log(`      ${dexCode ? '✅ DESPLEGADO (' + dexCode.length + ' chars)' : '❌ NO ENCONTRADO'}`);
  
  console.log(`   Royalties (${royaltiesAddress}):`);
  console.log(`      ${royaltiesCode ? '✅ DESPLEGADO (' + royaltiesCode.length + ' chars)' : '❌ NO ENCONTRADO'}`);

  if (!artistCode) {
    console.log('\n❌ PROBLEMA CRÍTICO: El contrato ArtistToken no está desplegado.');
    console.log('   Los usuarios no pueden comprar tokens sin un contrato válido.');
    return;
  }

  // 2. Token Counts
  console.log('\n2️⃣ CONTEO DE TOKENS EN BLOCKCHAIN');
  console.log('─'.repeat(60));
  
  try {
    const counts = await client.readContract({
      address: artistTokenAddress as `0x${string}`,
      abi: tokenCountsAbi,
      functionName: 'getCurrentTokenCounts'
    });
    console.log(`   Artistas registrados: ${counts[0].toString()}`);
    console.log(`   Canciones tokenizadas: ${counts[1].toString()}`);
    console.log(`   Catálogos: ${counts[2].toString()}`);
    console.log(`   Licencias: ${counts[3].toString()}`);
    
    if (Number(counts[0]) === 0) {
      console.log('\n   ⚠️ PROBLEMA: No hay artistas registrados en el contrato.');
      console.log('   Los usuarios no pueden comprar tokens de artistas inexistentes.');
    }
  } catch (e: any) {
    console.log(`   ❌ Error leyendo conteo: ${e.message?.slice(0, 100)}`);
  }

  // 3. Contract Owner
  console.log('\n3️⃣ PROPIETARIO DEL CONTRATO');
  console.log('─'.repeat(60));
  
  try {
    const owner = await client.readContract({
      address: artistTokenAddress as `0x${string}`,
      abi: ownerAbi,
      functionName: 'owner'
    });
    console.log(`   Owner: ${owner}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message?.slice(0, 100)}`);
  }

  // 4. Check first 3 artists
  console.log('\n4️⃣ ARTISTAS EN BLOCKCHAIN (primeros 3)');
  console.log('─'.repeat(60));
  
  for (let i = 1; i <= 3; i++) {
    try {
      const artist = await client.readContract({
        address: artistTokenAddress as `0x${string}`,
        abi: artistsAbi,
        functionName: 'artists',
        args: [BigInt(i)]
      });
      
      if (artist[0] === 0n) {
        console.log(`   Artista #${i}: NO REGISTRADO`);
      } else {
        console.log(`   Artista #${i}:`);
        console.log(`      ID: ${artist[0]}`);
        console.log(`      Nombre: ${artist[2] || '(sin nombre)'}`);
        console.log(`      Wallet: ${artist[1]}`);
        console.log(`      isActive: ${artist[7]}`);
        console.log(`      isVerified: ${artist[6]}`);
      }
    } catch (e: any) {
      console.log(`   Artista #${i}: ❌ Error - ${e.message?.slice(0, 50)}`);
    }
  }

  // 5. Check DEX pools
  console.log('\n5️⃣ POOLS DEX (Artist Token ID: 1000000001)');
  console.log('─'.repeat(60));
  
  if (dexCode) {
    try {
      const pool = await client.readContract({
        address: dexAddress as `0x${string}`,
        abi: poolInfoAbi,
        functionName: 'getPoolInfo',
        args: [1000000001n] // First artist token
      });
      
      console.log(`   Token Reserve: ${pool[0].toString()}`);
      console.log(`   MATIC Reserve: ${formatEther(pool[1])} MATIC`);
      console.log(`   LP Tokens: ${pool[2].toString()}`);
      console.log(`   isActive: ${pool[4]}`);
      
      if (!pool[4]) {
        console.log('\n   ⚠️ El pool NO está activo. Los swaps no funcionarán.');
      }
      if (pool[0] === 0n || pool[1] === 0n) {
        console.log('\n   ⚠️ El pool NO tiene liquidez. Los swaps fallarán.');
      }
    } catch (e: any) {
      console.log(`   ❌ Error leyendo pool: ${e.message?.slice(0, 100)}`);
    }
  }

  // 6. Diagnóstico Final
  console.log('\n' + '═'.repeat(60));
  console.log('📋 DIAGNÓSTICO FINAL');
  console.log('═'.repeat(60));
  
  const issues: string[] = [];
  
  if (!artistCode) issues.push('ArtistToken contract not deployed');
  if (!dexCode) issues.push('DEX contract not deployed');
  
  if (issues.length === 0) {
    console.log('✅ Contratos desplegados correctamente.');
    console.log('\n🔍 POSIBLES PROBLEMAS DE TRANSACCIÓN:');
    console.log('   1. No hay artistas registrados en el contrato → Los usuarios');
    console.log('      intentan comprar tokens de artistas que no existen on-chain.');
    console.log('   2. No hay liquidez en los pools DEX → Los swaps fallan.');
    console.log('   3. Precio incorrecto → El usuario no envía suficiente MATIC.');
    console.log('   4. Chain incorrecto → El usuario no está en Polygon (137).');
    console.log('   5. MetaMask rechaza → El usuario cancela la transacción.');
  } else {
    console.log('❌ PROBLEMAS DETECTADOS:');
    issues.forEach(i => console.log(`   - ${i}`));
  }
}

diagnose().catch(console.error);
