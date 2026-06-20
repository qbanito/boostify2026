/**
 * Script para registrar artistas y tokens en el contrato BTF-2300 en Polygon Mainnet
 * 
 * REQUISITOS:
 * 1. Tener MATIC en la wallet PLATFORM_PRIVATE_KEY para gas
 * 2. La wallet debe ser el owner/admin del contrato
 * 
 * USO:
 * node scripts/register-btf2300-artists.js
 */

require('dotenv').config();
const { createPublicClient, createWalletClient, http, parseEther, formatEther } = require('viem');
const { polygon } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

// Contract address on Polygon Mainnet
const ARTIST_TOKEN_ADDRESS = '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027';

// ABI mínimo para registrar artistas y tokenizar canciones
const BTF2300_ABI = [
  // Register Artist
  {
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
  },
  // Tokenize Song
  {
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
  },
  // Get current token counts
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
  // Owner
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// Artistas a registrar (los primeros 5 como ejemplo)
const ARTISTS_TO_REGISTER = [
  {
    name: 'Luna Wave',
    wallet: '0x0000000000000000000000000000000000000001', // Placeholder - cambiar por wallet real
    profileURI: 'ipfs://QmLunaWaveProfile',
    songs: [
      { title: 'Midnight Dreams', supply: 10000, priceWei: '0.005' },
      { title: 'Electric Soul', supply: 5000, priceWei: '0.008' },
    ]
  },
  {
    name: 'Nova Beats',
    wallet: '0x0000000000000000000000000000000000000002',
    profileURI: 'ipfs://QmNovaBeatsProfile',
    songs: [
      { title: 'Future Sound', supply: 10000, priceWei: '0.005' },
    ]
  },
  {
    name: 'Echo Chamber',
    wallet: '0x0000000000000000000000000000000000000003',
    profileURI: 'ipfs://QmEchoChamberProfile',
    songs: [
      { title: 'Reverb City', supply: 8000, priceWei: '0.006' },
    ]
  },
];

async function main() {
  console.log('🚀 BTF-2300 Artist Registration Script');
  console.log('=====================================\n');

  // Verificar private key
  const privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PLATFORM_PRIVATE_KEY no está configurada en .env');
    process.exit(1);
  }

  // Crear account desde private key
  const account = privateKeyToAccount(`0x${privateKey}`);
  console.log('📍 Wallet address:', account.address);

  // Crear clients
  const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  const walletClient = createWalletClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
    account,
  });

  // Verificar balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log('💰 Balance MATIC:', formatEther(balance));

  if (balance < parseEther('0.1')) {
    console.error('❌ Necesitas al menos 0.1 MATIC para gas');
    process.exit(1);
  }

  // Verificar owner del contrato
  try {
    const owner = await publicClient.readContract({
      address: ARTIST_TOKEN_ADDRESS,
      abi: BTF2300_ABI,
      functionName: 'owner',
    });
    console.log('👑 Contract owner:', owner);
    
    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      console.warn('⚠️  Tu wallet NO es el owner del contrato');
      console.warn('   Solo el owner puede registrar artistas');
      console.warn('   Owner actual:', owner);
      console.warn('   Tu wallet:', account.address);
      
      // Preguntamos si quiere continuar de todas formas
      console.log('\n¿Continuar de todas formas? (puede fallar)');
    }
  } catch (error) {
    console.error('❌ Error verificando owner:', error.message);
  }

  // Obtener conteos actuales
  try {
    const counts = await publicClient.readContract({
      address: ARTIST_TOKEN_ADDRESS,
      abi: BTF2300_ABI,
      functionName: 'getCurrentTokenCounts',
    });
    console.log('\n📊 Estado actual del contrato:');
    console.log('   Artistas registrados:', counts[0].toString());
    console.log('   Canciones tokenizadas:', counts[1].toString());
    console.log('   Catálogos:', counts[2].toString());
    console.log('   Licencias:', counts[3].toString());
  } catch (error) {
    console.error('❌ Error obteniendo conteos:', error.message);
  }

  console.log('\n📝 Artistas a registrar:', ARTISTS_TO_REGISTER.length);
  console.log('=====================================\n');

  // Registrar cada artista
  for (const artist of ARTISTS_TO_REGISTER) {
    console.log(`\n🎤 Registrando: ${artist.name}`);
    
    try {
      // Registrar artista
      const registerHash = await walletClient.writeContract({
        address: ARTIST_TOKEN_ADDRESS,
        abi: BTF2300_ABI,
        functionName: 'registerArtist',
        args: [artist.wallet, artist.name, artist.profileURI],
      });
      
      console.log('   ⏳ Tx enviada:', registerHash);
      
      // Esperar confirmación
      const receipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
      
      if (receipt.status === 'success') {
        console.log('   ✅ Artista registrado!');
        
        // Obtener el artistId del evento (simplificado - asumimos ID incremental)
        // En producción deberías parsear los logs del evento
        const artistId = 1; // Placeholder
        
        // Tokenizar canciones del artista
        for (const song of artist.songs) {
          console.log(`   🎵 Tokenizando: ${song.title}`);
          
          const songHash = await walletClient.writeContract({
            address: ARTIST_TOKEN_ADDRESS,
            abi: BTF2300_ABI,
            functionName: 'tokenizeSong',
            args: [
              BigInt(artistId),
              song.title,
              `ipfs://Qm${song.title.replace(/\s/g, '')}Metadata`,
              BigInt(song.supply),
              parseEther(song.priceWei),
            ],
          });
          
          const songReceipt = await publicClient.waitForTransactionReceipt({ hash: songHash });
          
          if (songReceipt.status === 'success') {
            console.log(`      ✅ Canción tokenizada: ${song.title}`);
          } else {
            console.log(`      ❌ Error tokenizando: ${song.title}`);
          }
        }
      } else {
        console.log('   ❌ Error registrando artista');
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n=====================================');
  console.log('✅ Script completado');
}

main().catch(console.error);
