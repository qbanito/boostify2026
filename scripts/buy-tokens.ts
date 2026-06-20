/**
 * Comprar tokens de canción para que aparezcan en tu wallet
 * El contrato requiere compra con MATIC para transferir tokens
 */

import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

const BTF2300_CONTRACT = '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027' as `0x${string}`;

const TOKEN_PREFIXES = {
  SONG: 2_000_000_000,
};

const ABI = parseAbi([
  'function buyTokens(uint256 tokenId, uint256 amount, uint256 maxPricePerToken, uint256 deadline) payable returns (bool)',
  'function songs(uint256) view returns (uint256 tokenId, uint256 artistId, string title, string metadataURI, uint256 totalSupply, uint256 availableSupply, uint256 pricePerToken, bool isActive, uint256 totalEarnings, uint256 createdAt)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function lastPurchaseBlock(address) view returns (uint256)',
]);

async function main() {
  let privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PLATFORM_PRIVATE_KEY no encontrada en .env');
  }
  
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

  console.log('\n🛒 === COMPRAR TOKENS PARA TU WALLET ===\n');
  console.log(`👛 Wallet: ${account.address}`);
  
  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${formatEther(balance)} MATIC\n`);

  // Get song info
  const songTokenId = BigInt(TOKEN_PREFIXES.SONG + 1);
  
  const song = await publicClient.readContract({
    address: BTF2300_CONTRACT,
    abi: ABI,
    functionName: 'songs',
    args: [songTokenId],
  }) as any;
  
  const title = song[2];
  const availableSupply = song[5];
  const pricePerToken = song[6];
  
  console.log(`🎵 Canción: "${title}"`);
  console.log(`   Token ID: ${songTokenId}`);
  console.log(`   Disponibles: ${availableSupply}`);
  console.log(`   Precio: ${formatEther(pricePerToken)} MATIC por token`);
  
  // How many to buy
  const amountToBuy = 5n;
  const totalCost = pricePerToken * amountToBuy;
  
  console.log(`\n🛒 Comprando ${amountToBuy} tokens...`);
  console.log(`   Costo total: ${formatEther(totalCost)} MATIC`);
  
  if (balance < totalCost) {
    console.log('\n❌ No tienes suficiente MATIC');
    return;
  }

  // Check last purchase block
  const lastBlock = await publicClient.readContract({
    address: BTF2300_CONTRACT,
    abi: ABI,
    functionName: 'lastPurchaseBlock',
    args: [account.address],
  }) as bigint;
  
  const currentBlock = await publicClient.getBlockNumber();
  console.log(`\n📦 Último bloque de compra: ${lastBlock}`);
  console.log(`📦 Bloque actual: ${currentBlock}`);
  
  if (currentBlock <= lastBlock) {
    console.log('⏳ Esperando 1 bloque...');
    await new Promise(r => setTimeout(r, 3000));
  }

  // Set deadline 5 minutes from now
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

  try {
    const hash = await walletClient.writeContract({
      address: BTF2300_CONTRACT,
      abi: ABI,
      functionName: 'buyTokens',
      args: [songTokenId, amountToBuy, pricePerToken, deadline],
      value: totalCost,
    });
    
    console.log(`\n✅ TX enviada: ${hash}`);
    console.log(`🔗 Ver: https://polygonscan.com/tx/${hash}`);
    
    console.log('\n⏳ Esperando confirmación...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Confirmada en bloque: ${receipt.blockNumber}`);
    
    // Check new balance
    const newBalance = await publicClient.readContract({
      address: BTF2300_CONTRACT,
      abi: ABI,
      functionName: 'balanceOf',
      args: [account.address, songTokenId],
    }) as bigint;
    
    console.log(`\n🎉 ¡COMPRA EXITOSA!`);
    console.log(`   Tu nuevo balance: ${newBalance} tokens de Song #1`);
    console.log(`\n📱 Ahora puedes importar el NFT en MetaMask Mobile:`);
    console.log(`   Address: ${BTF2300_CONTRACT}`);
    console.log(`   Token ID: ${songTokenId}`);
    console.log(`\n🔗 Ver en OpenSea: https://opensea.io/assets/matic/${BTF2300_CONTRACT}/${songTokenId}`);
    
  } catch (error: any) {
    console.log(`\n❌ Error: ${error.message}`);
    
    if (error.message.includes('insufficient funds')) {
      console.log('\n💡 No tienes suficiente MATIC. Envía MATIC a tu wallet:');
      console.log(`   ${account.address}`);
    }
  }
}

main().catch(console.error);
