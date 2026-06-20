/**
 * Script para crear tokens reales para todos los artistas AI
 * que no tengan un token en la tabla tokenized_songs
 */

import "dotenv/config";
import { db } from "../server/db";
import { users, tokenizedSongs } from "../db/schema";
import { eq, isNotNull, notInArray, sql } from "drizzle-orm";

// Dirección del contrato BTF2300 (placeholder - actualizar con la real)
const CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890";

// Genera un símbolo de token basado en el nombre del artista
function generateTokenSymbol(artistName: string): string {
  // Tomar las primeras letras de cada palabra y limitar a 4 caracteres
  const words = artistName.split(/\s+/);
  let symbol = "";
  
  if (words.length === 1) {
    symbol = artistName.substring(0, 4).toUpperCase();
  } else {
    symbol = words.map(w => w[0]).join("").substring(0, 4).toUpperCase();
  }
  
  return symbol;
}

// Genera un precio aleatorio entre $0.05 y $2.00
function generateInitialPrice(): string {
  const price = (Math.random() * 1.95 + 0.05).toFixed(2);
  return price;
}

// Genera supply aleatorio
function generateSupply(): { total: number; available: number } {
  const total = Math.floor(Math.random() * 900000) + 100000; // 100k - 1M
  const available = Math.floor(total * (0.5 + Math.random() * 0.4)); // 50-90% disponible
  return { total, available };
}

async function createAIArtistTokens() {
  console.log("🚀 Creando tokens para artistas AI sin token...\n");

  try {
    // Obtener IDs de artistas que ya tienen token
    const existingTokens = await db.select({
      artistId: tokenizedSongs.artistId
    }).from(tokenizedSongs);

    const artistsWithTokens = new Set(existingTokens.map(t => t.artistId));
    console.log(`✅ Artistas con token existente: ${artistsWithTokens.size}`);

    // Obtener TODOS los usuarios con artistName (son artistas)
    const allArtists = await db.select({
      id: users.id,
      artistName: users.artistName,
      profileImage: users.profileImage,
      slug: users.slug
    })
    .from(users)
    .where(isNotNull(users.artistName));

    console.log(`📊 Total de artistas en el sistema: ${allArtists.length}`);

    // Filtrar artistas sin token
    const artistsWithoutTokens = allArtists.filter(a => !artistsWithTokens.has(a.id));
    console.log(`🔧 Artistas sin token: ${artistsWithoutTokens.length}\n`);

    if (artistsWithoutTokens.length === 0) {
      console.log("✨ Todos los artistas ya tienen tokens!");
      return;
    }

    // Obtener el máximo tokenId actual para continuar la secuencia
    const maxTokenIdResult = await db.select({
      maxId: sql<number>`COALESCE(MAX(token_id), 0)`
    }).from(tokenizedSongs);
    
    let nextTokenId = (maxTokenIdResult[0]?.maxId || 0) + 1;

    // Crear tokens para cada artista sin uno
    let created = 0;
    for (const artist of artistsWithoutTokens) {
      const artistName = artist.artistName || `Artist ${artist.id}`;
      const symbol = generateTokenSymbol(artistName);
      const price = generateInitialPrice();
      const { total, available } = generateSupply();

      try {
        await db.insert(tokenizedSongs).values({
          artistId: artist.id,
          songName: `${artistName} Token`, // Nombre del token
          songUrl: null,
          tokenId: nextTokenId,
          tokenSymbol: `$${symbol}`,
          totalSupply: total,
          availableSupply: available,
          pricePerTokenUsd: price,
          pricePerTokenEth: (parseFloat(price) / 2500).toFixed(8), // Estimado ETH
          royaltyPercentageArtist: 80,
          royaltyPercentagePlatform: 20,
          contractAddress: CONTRACT_ADDRESS,
          metadataUri: `https://boostify.io/tokens/${symbol.toLowerCase()}/metadata.json`,
          imageUrl: artist.profileImage || null,
          description: `Official artist token for ${artistName}. Hold to unlock exclusive content, early access, and community perks.`,
          benefits: [
            "Early access to new releases",
            "Exclusive behind-the-scenes content",
            "Priority chat responses",
            "Token holder community access",
            "Revenue share from streaming"
          ],
          isActive: true
        });

        created++;
        nextTokenId++;
        console.log(`✅ Token creado: $${symbol} para ${artistName} (ID: ${artist.id}) - $${price}`);
      } catch (error) {
        console.error(`❌ Error creando token para ${artistName}:`, error);
      }
    }

    console.log(`\n🎉 Tokens creados exitosamente: ${created}/${artistsWithoutTokens.length}`);
    
    // Mostrar resumen
    const totalTokens = await db.select({
      count: sql<number>`COUNT(*)`
    }).from(tokenizedSongs);
    
    console.log(`📊 Total de tokens en el sistema: ${totalTokens[0]?.count || 0}`);

  } catch (error) {
    console.error("❌ Error en el script:", error);
    throw error;
  }
}

// Ejecutar
createAIArtistTokens()
  .then(() => {
    console.log("\n✅ Script completado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script falló:", error);
    process.exit(1);
  });
