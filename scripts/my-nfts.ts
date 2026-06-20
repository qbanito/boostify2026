/**
 * Script para ver tus NFTs BTF-2300 y cómo importarlos en MetaMask
 */

import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { polygon } from 'viem/chains';

const BTF2300_CONTRACT = '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027';
const PLATFORM_WALLET = '0xa617cC0998c0bC4bf86301003FF2c172d57B506E';

const TOKEN_PREFIXES = {
  ARTIST: 1_000_000_000,
  SONG: 2_000_000_000,
};

const ABI = parseAbi([
  'function getCurrentTokenCounts() view returns (uint256 totalArtists, uint256 totalSongs, uint256 totalCatalogs, uint256 totalLicenses)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function artists(uint256) view returns (uint256 artistId, address walletAddress, string artistName, string profileURI, uint256 totalEarnings, uint256 totalSongs, bool isVerified, bool isActive, uint256 registeredAt)',
  'function songs(uint256) view returns (uint256 tokenId, uint256 artistId, string title, string metadataURI, uint256 totalSupply, uint256 availableSupply, uint256 pricePerToken, bool isActive, uint256 totalEarnings, uint256 createdAt)',
]);

const client = createPublicClient({
  chain: polygon,
  transport: http('https://polygon-rpc.com'),
});

async function main() {
  console.log('\n🎨 === TUS NFTs BTF-2300 EN POLYGON ===\n');
  console.log(`📍 Contrato: ${BTF2300_CONTRACT}`);
  console.log(`👛 Tu Wallet: ${PLATFORM_WALLET}\n`);
  
  // Obtener conteos
  const counts = await client.readContract({
    address: BTF2300_CONTRACT as `0x${string}`,
    abi: ABI,
    functionName: 'getCurrentTokenCounts',
  }) as [bigint, bigint, bigint, bigint];
  
  const [totalArtists, totalSongs] = counts;
  
  console.log('📊 TOKENS EN EL CONTRATO:');
  console.log(`   Artistas registrados: ${totalArtists}`);
  console.log(`   Canciones tokenizadas: ${totalSongs}\n`);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎤 ARTIST IDENTITY TOKENS (ERC-1155)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  for (let i = 1; i <= Number(totalArtists); i++) {
    const tokenId = TOKEN_PREFIXES.ARTIST + i;
    
    try {
      const balance = await client.readContract({
        address: BTF2300_CONTRACT as `0x${string}`,
        abi: ABI,
        functionName: 'balanceOf',
        args: [PLATFORM_WALLET as `0x${string}`, BigInt(tokenId)],
      }) as bigint;
      
      const artist = await client.readContract({
        address: BTF2300_CONTRACT as `0x${string}`,
        abi: ABI,
        functionName: 'artists',
        args: [BigInt(i)],
      }) as any;
      
      if (balance > 0n) {
        console.log(`✅ Artist #${i}: ${artist[2]}`);
        console.log(`   Token ID: ${tokenId}`);
        console.log(`   Balance: ${balance} tokens`);
        console.log(`   Wallet: ${artist[1]}`);
        console.log('');
      }
    } catch (e) {
      // Skip
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎵 SONG TOKENS (ERC-1155)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const songTokens: Array<{tokenId: number, title: string, balance: bigint, supply: bigint, available: bigint}> = [];
  
  for (let i = 1; i <= Number(totalSongs); i++) {
    const tokenId = TOKEN_PREFIXES.SONG + i;
    
    try {
      const balance = await client.readContract({
        address: BTF2300_CONTRACT as `0x${string}`,
        abi: ABI,
        functionName: 'balanceOf',
        args: [PLATFORM_WALLET as `0x${string}`, BigInt(tokenId)],
      }) as bigint;
      
      const song = await client.readContract({
        address: BTF2300_CONTRACT as `0x${string}`,
        abi: ABI,
        functionName: 'songs',
        args: [BigInt(tokenId)],
      }) as any;
      
      const title = song[2];
      const totalSupply = song[4];
      const availableSupply = song[5];
      const pricePerToken = song[6];
      
      console.log(`🎵 Song #${i}: "${title}"`);
      console.log(`   Token ID: ${tokenId}`);
      console.log(`   Total Supply: ${totalSupply.toLocaleString()} tokens`);
      console.log(`   Available (in contract): ${availableSupply.toLocaleString()} tokens`);
      console.log(`   Your balance: ${balance.toLocaleString()} tokens`);
      console.log(`   Price: ${formatEther(pricePerToken)} MATIC per token`);
      console.log('');
      
      if (balance > 0n) {
        songTokens.push({ tokenId, title, balance, supply: totalSupply, available: availableSupply });
      }
    } catch (e) {
      // Skip
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📱 CÓMO VER TUS NFTs EN METAMASK');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('⚠️  MetaMask NO muestra tokens ERC-1155 automáticamente.');
  console.log('    Debes importarlos manualmente:\n');
  
  console.log('OPCIÓN 1: Usar OpenSea (Recomendado)');
  console.log('─────────────────────────────────────');
  console.log(`1. Ve a: https://opensea.io/${PLATFORM_WALLET}`);
  console.log('2. Conecta tu wallet');
  console.log('3. Verás todos tus NFTs automáticamente\n');
  
  console.log('OPCIÓN 2: Usar PolygonScan');
  console.log('─────────────────────────────────────');
  console.log(`1. Ve a: https://polygonscan.com/address/${PLATFORM_WALLET}#tokentxnsErc1155`);
  console.log('2. Verás todas las transacciones ERC-1155\n');
  
  console.log('OPCIÓN 3: Importar en MetaMask Mobile');
  console.log('─────────────────────────────────────');
  console.log('1. Abre MetaMask Mobile (no desktop)');
  console.log('2. Ve a "NFTs" tab');
  console.log('3. Toca "Import NFTs"');
  console.log('4. Ingresa:');
  console.log(`   - Address: ${BTF2300_CONTRACT}`);
  console.log('   - Token ID: (usa los IDs de arriba)');
  console.log('');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔗 LINKS DIRECTOS A TUS NFTs');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Artist tokens
  for (let i = 1; i <= Number(totalArtists); i++) {
    const tokenId = TOKEN_PREFIXES.ARTIST + i;
    console.log(`Artist #${i}: https://opensea.io/assets/matic/${BTF2300_CONTRACT}/${tokenId}`);
  }
  
  console.log('');
  
  // Song tokens
  for (let i = 1; i <= Number(totalSongs); i++) {
    const tokenId = TOKEN_PREFIXES.SONG + i;
    console.log(`Song #${i}: https://opensea.io/assets/matic/${BTF2300_CONTRACT}/${tokenId}`);
  }
  
  console.log('\n✅ Para ver los NFTs, abre cualquiera de estos links en tu navegador.');
}

main().catch(console.error);
