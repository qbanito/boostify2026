/**
 * BTF-2300 Admin Script
 * 
 * Script para administrar el contrato BTF-2300 en Polygon Mainnet:
 * - Registrar nuevos artistas
 * - Tokenizar canciones
 * - Verificar estado del contrato
 * 
 * Contrato: 0x16ba188e438b4ebc7edc6acb49bdc1256de2f027
 * 
 * USO:
 *   node scripts/btf2300-admin.cjs register-artist <id> <name> <wallet>
 *   node scripts/btf2300-admin.cjs tokenize-song <songId> <artistId> <supply> <priceWei>
 *   node scripts/btf2300-admin.cjs status
 *   node scripts/btf2300-admin.cjs my-balance
 */

const { createPublicClient, createWalletClient, http, parseEther, formatEther } = require('viem');
const { polygon } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
require('dotenv').config();

// Configuración del contrato
const BTF2300_ADDRESS = '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027';
const POLYGON_RPC = 'https://polygon-rpc.com';

// Prefijos de tokenId
const TOKEN_PREFIXES = {
  ARTIST: 1000000000,
  SONG: 2000000000,
  CATALOG: 3000000000,
  LICENSE: 4000000000,
};

// ABI del contrato BTF-2300 (funciones principales)
const BTF2300_ABI = [
  // Lectura
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'getArtist', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [{ name: 'id', type: 'uint256' }, { name: 'name', type: 'string' }, { name: 'wallet', type: 'address' }, { name: 'royaltyBPS', type: 'uint256' }, { name: 'isActive', type: 'bool' }]}] },
  { name: 'getSong', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [{ name: 'tokenId', type: 'uint256' }, { name: 'artistId', type: 'uint256' }, { name: 'totalSupply', type: 'uint256' }, { name: 'currentSupply', type: 'uint256' }, { name: 'pricePerToken', type: 'uint256' }, { name: 'isActive', type: 'bool' }]}] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'artistCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'songCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  
  // Escritura (requieren ser owner/operator)
  { name: 'registerArtist', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'string' }, { type: 'address' }, { type: 'uint256' }], outputs: [] },
  { name: 'tokenizeSong', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], outputs: [] },
  { name: 'buyTokens', type: 'function', stateMutability: 'payable', inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'address' }], outputs: [] },
  { name: 'setOperator', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'bool' }], outputs: [] },
];

// Crear clientes
function createClients() {
  const publicClient = createPublicClient({
    chain: polygon,
    transport: http(POLYGON_RPC),
  });

  let walletClient = null;
  if (process.env.PLATFORM_PRIVATE_KEY) {
    const account = privateKeyToAccount(`0x${process.env.PLATFORM_PRIVATE_KEY.replace('0x', '')}`);
    walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(POLYGON_RPC),
    });
  }

  return { publicClient, walletClient };
}

// Obtener estado del contrato
async function getContractStatus() {
  const { publicClient } = createClients();
  
  console.log('\n📊 Estado del Contrato BTF-2300');
  console.log('================================');
  console.log(`Dirección: ${BTF2300_ADDRESS}`);
  console.log(`Red: Polygon Mainnet`);
  
  try {
    // Owner
    const owner = await publicClient.readContract({
      address: BTF2300_ADDRESS,
      abi: BTF2300_ABI,
      functionName: 'owner',
    });
    console.log(`\n👤 Owner: ${owner}`);

    // Contar artistas
    let artistCount = 0;
    for (let i = 1; i <= 20; i++) {
      try {
        const artist = await publicClient.readContract({
          address: BTF2300_ADDRESS,
          abi: BTF2300_ABI,
          functionName: 'getArtist',
          args: [BigInt(i)],
        });
        if (artist && artist.name && artist.name.length > 0) {
          artistCount++;
          console.log(`  Artista #${i}: ${artist.name} (${artist.isActive ? '✅ Activo' : '❌ Inactivo'})`);
        }
      } catch {
        break;
      }
    }
    console.log(`\n🎤 Total Artistas: ${artistCount}`);

    // Contar canciones
    console.log('\n🎵 Canciones Tokenizadas:');
    let songCount = 0;
    for (let i = 1; i <= 20; i++) {
      const tokenId = TOKEN_PREFIXES.SONG + i;
      try {
        const song = await publicClient.readContract({
          address: BTF2300_ADDRESS,
          abi: BTF2300_ABI,
          functionName: 'getSong',
          args: [BigInt(tokenId)],
        });
        if (song && song.totalSupply > 0n) {
          songCount++;
          console.log(`  TokenID ${tokenId}: Supply ${song.totalSupply.toString()}, Precio ${formatEther(song.pricePerToken)} MATIC, ${song.isActive ? '✅' : '❌'}`);
        }
      } catch {
        break;
      }
    }
    console.log(`\n🎵 Total Canciones: ${songCount}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Registrar nuevo artista
async function registerArtist(id, name, wallet, royaltyBPS = 1000) {
  const { publicClient, walletClient } = createClients();
  
  if (!walletClient) {
    console.error('❌ PLATFORM_PRIVATE_KEY no configurada en .env');
    return;
  }

  console.log(`\n🎤 Registrando Artista #${id}: ${name}`);
  console.log(`   Wallet: ${wallet}`);
  console.log(`   Royalty: ${royaltyBPS / 100}%`);
  
  try {
    const hash = await walletClient.writeContract({
      address: BTF2300_ADDRESS,
      abi: BTF2300_ABI,
      functionName: 'registerArtist',
      args: [BigInt(id), name, wallet, BigInt(royaltyBPS)],
    });
    
    console.log(`\n✅ Transacción enviada: ${hash}`);
    console.log(`   Ver en: https://polygonscan.com/tx/${hash}`);
    
    // Esperar confirmación
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   Confirmada en bloque: ${receipt.blockNumber}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Tokenizar nueva canción
async function tokenizeSong(songId, artistId, supply = 10000, priceMatic = '0.001') {
  const { publicClient, walletClient } = createClients();
  
  if (!walletClient) {
    console.error('❌ PLATFORM_PRIVATE_KEY no configurada en .env');
    return;
  }

  const tokenId = TOKEN_PREFIXES.SONG + songId;
  const priceWei = parseEther(priceMatic);
  
  console.log(`\n🎵 Tokenizando Canción:`);
  console.log(`   Token ID: ${tokenId}`);
  console.log(`   Artista ID: ${artistId}`);
  console.log(`   Supply: ${supply}`);
  console.log(`   Precio: ${priceMatic} MATIC`);
  
  try {
    const hash = await walletClient.writeContract({
      address: BTF2300_ADDRESS,
      abi: BTF2300_ABI,
      functionName: 'tokenizeSong',
      args: [BigInt(songId), BigInt(artistId), BigInt(supply), priceWei],
    });
    
    console.log(`\n✅ Transacción enviada: ${hash}`);
    console.log(`   Ver en: https://polygonscan.com/tx/${hash}`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   Confirmada en bloque: ${receipt.blockNumber}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ver mi balance de tokens
async function myBalance() {
  const { publicClient, walletClient } = createClients();
  
  if (!walletClient) {
    console.error('❌ PLATFORM_PRIVATE_KEY no configurada en .env');
    return;
  }

  const address = walletClient.account.address;
  console.log(`\n💰 Balance de: ${address}`);
  
  for (let i = 1; i <= 8; i++) {
    const tokenId = TOKEN_PREFIXES.SONG + i;
    try {
      const balance = await publicClient.readContract({
        address: BTF2300_ADDRESS,
        abi: BTF2300_ABI,
        functionName: 'balanceOf',
        args: [address, BigInt(tokenId)],
      });
      if (balance > 0n) {
        console.log(`  Token ${tokenId}: ${balance.toString()} tokens`);
      }
    } catch {}
  }
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'status':
    getContractStatus();
    break;
    
  case 'register-artist':
    if (args.length < 4) {
      console.log('Uso: node btf2300-admin.cjs register-artist <id> <name> <wallet> [royaltyBPS]');
      console.log('Ejemplo: node btf2300-admin.cjs register-artist 8 "New Artist" 0x123... 1000');
    } else {
      registerArtist(parseInt(args[1]), args[2], args[3], parseInt(args[4] || '1000'));
    }
    break;
    
  case 'tokenize-song':
    if (args.length < 3) {
      console.log('Uso: node btf2300-admin.cjs tokenize-song <songId> <artistId> [supply] [priceMatic]');
      console.log('Ejemplo: node btf2300-admin.cjs tokenize-song 9 8 10000 0.001');
    } else {
      tokenizeSong(parseInt(args[1]), parseInt(args[2]), parseInt(args[3] || '10000'), args[4] || '0.001');
    }
    break;
    
  case 'my-balance':
    myBalance();
    break;
    
  default:
    console.log(`
BTF-2300 Admin Script
=====================

Comandos disponibles:

  status              Ver estado del contrato (artistas, canciones)
  register-artist     Registrar un nuevo artista
  tokenize-song       Tokenizar una nueva canción
  my-balance          Ver mi balance de tokens

Ejemplos:

  node scripts/btf2300-admin.cjs status
  node scripts/btf2300-admin.cjs register-artist 8 "Mi Artista" 0xWALLET 1000
  node scripts/btf2300-admin.cjs tokenize-song 9 8 10000 0.001
  node scripts/btf2300-admin.cjs my-balance
`);
}
