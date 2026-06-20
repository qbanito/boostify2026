/**
 * Transferir tokens del contrato a tu wallet personal
 * Para que puedas verlos en MetaMask/OpenSea
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

const BTF2300_CONTRACT = '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027' as `0x${string}`;
const PLATFORM_WALLET = '0xa617cC0998c0bC4bf86301003FF2c172d57B506E' as `0x${string}`;

const TOKEN_PREFIXES = {
  ARTIST: 1_000_000_000,
  SONG: 2_000_000_000,
};

// ABI mínimo para transferir
const ABI = parseAbi([
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
]);

async function main() {
  let privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PLATFORM_PRIVATE_KEY no encontrada en .env');
  }
  
  // Ensure it starts with 0x
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  console.log('\n🎨 === TRANSFERIR TOKENS A TU WALLET ===\n');
  console.log(`📍 Contrato: ${BTF2300_CONTRACT}`);
  console.log(`👛 Tu Wallet: ${PLATFORM_WALLET}`);
  console.log(`🔑 Firmando con: ${account.address}\n`);

  // Los tokens de artista están minteados al contrato, necesitamos transferirlos
  // Pero el contrato usa un modelo de custodia donde el contrato es dueño
  
  // Vamos a intentar transferir un token de canción desde el contrato
  // Primero verificamos el balance del contrato
  
  const songTokenId = BigInt(TOKEN_PREFIXES.SONG + 1); // First song
  
  // Check contract's balance (where tokens are held in custody)
  const contractBalance = await publicClient.readContract({
    address: BTF2300_CONTRACT,
    abi: ABI,
    functionName: 'balanceOf',
    args: [BTF2300_CONTRACT, songTokenId],
  });
  
  console.log(`📦 Balance del contrato para Song #1: ${contractBalance}`);
  
  // Check user's balance
  const userBalance = await publicClient.readContract({
    address: BTF2300_CONTRACT,
    abi: ABI,
    functionName: 'balanceOf',
    args: [PLATFORM_WALLET, songTokenId],
  });
  
  console.log(`👤 Tu balance para Song #1: ${userBalance}`);

  if (contractBalance === 0n) {
    console.log('\n⚠️ El contrato no tiene tokens para transferir.');
    console.log('Los tokens están en el contrato pero la transferencia');
    console.log('debe hacerse a través de la función purchaseTokens().\n');
    
    console.log('💡 Para obtener tokens en tu wallet:');
    console.log('1. Usa la función purchaseTokens() del DEX para comprar tokens');
    console.log('2. O modifica el contrato para permitir withdrawals del owner\n');
    
    // Let's check if there's a withdraw function
    console.log('Intentando buscar función de retiro...');
    
    return;
  }

  // Si hay balance, intentar transferir
  console.log('\n🚀 Transfiriendo 10 tokens a tu wallet...');
  
  try {
    const hash = await walletClient.writeContract({
      address: BTF2300_CONTRACT,
      abi: ABI,
      functionName: 'safeTransferFrom',
      args: [BTF2300_CONTRACT, PLATFORM_WALLET, songTokenId, 10n, '0x'],
    });
    
    console.log(`✅ TX enviada: ${hash}`);
    console.log(`🔗 Ver en PolygonScan: https://polygonscan.com/tx/${hash}`);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Confirmada en bloque: ${receipt.blockNumber}`);
    
  } catch (error: any) {
    console.log(`\n❌ Error: ${error.message}`);
    console.log('\n💡 Esto es esperado - el contrato usa modelo de custodia.');
    console.log('Los tokens solo pueden salir via purchaseTokens() en el DEX.\n');
  }
}

main().catch(console.error);
