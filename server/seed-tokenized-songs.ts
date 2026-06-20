/**
 * Seed data for 20 tokenized songs from artist profiles
 * Run this to populate initial data for BoostiSwap marketplace
 */
import { db } from './db';
import { tokenizedSongs, users } from './db/schema';
import { eq, sql } from 'drizzle-orm';

// Use direct URLs instead of client-side function
const BOOSTIFY_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

// Demo artists for BTF-2300 marketplace
const DEMO_ARTISTS = [
  { username: "luna_echo", email: "luna@boostify.demo", displayName: "Luna Echo", bio: "Pop singer with ethereal vocals", profileImageUrl: "/artist-images/luna_echo_-_female_pop_singer.png", songName: "Moonlight Dreams", tokenSymbol: "LUNA" },
  { username: "urban_flow", email: "urban@boostify.demo", displayName: "Urban Flow", bio: "Hip-hop artist and lyricist", profileImageUrl: "/artist-images/urban_flow_-_hip-hop_artist.png", songName: "Urban Rhythm", tokenSymbol: "URBAN" },
  { username: "electric_dreams", email: "electric@boostify.demo", displayName: "Electric Dreams", bio: "Electronic music producer", profileImageUrl: "/artist-images/electric_dreams_-_electronic_artist.png", songName: "Electric Pulse", tokenSymbol: "ELDREAM" },
  { username: "soul_harmony", email: "soul@boostify.demo", displayName: "Soul Harmony", bio: "R&B vocalist with timeless soul", profileImageUrl: "/artist-images/soul_harmony_-_r&b_artist.png", songName: "Soul Connection", tokenSymbol: "SOUL" },
  { username: "maya_rivers", email: "maya@boostify.demo", displayName: "Maya Rivers", bio: "Indie folk singer-songwriter", profileImageUrl: "/artist-images/maya_rivers_-_indie_folk.png", songName: "River Road", tokenSymbol: "MAYA" },
  { username: "jah_vibes", email: "jah@boostify.demo", displayName: "Jah Vibes", bio: "Reggae artist spreading good vibes", profileImageUrl: "/artist-images/jah_vibes_-_reggae_artist.png", songName: "Reggae Sunset", tokenSymbol: "JAH" },
  { username: "david_chen", email: "david@boostify.demo", displayName: "David Chen", bio: "Classical pianist and composer", profileImageUrl: "/artist-images/david_chen_-_classical_pianist.png", songName: "Classical Symphony", tokenSymbol: "CHEN" },
  { username: "sophia_kim", email: "sophia@boostify.demo", displayName: "Sophia Kim", bio: "K-pop sensation", profileImageUrl: "/artist-images/sophia_kim_-_k-pop_star.png", songName: "K-Pop Dream", tokenSymbol: "SOPHIA" },
  { username: "marcus_stone", email: "marcus@boostify.demo", displayName: "Marcus Stone", bio: "Jazz saxophonist", profileImageUrl: "/artist-images/marcus_stone_-_jazz_saxophonist.png", songName: "Jazz Nights", tokenSymbol: "MARCUS" },
  { username: "isabella_santos", email: "isabella@boostify.demo", displayName: "Isabella Santos", bio: "Reggaeton star", profileImageUrl: "/artist-images/isabella_santos_-_reggaeton.png", songName: "Reggaeton Fire", tokenSymbol: "BELLA" },
  { username: "luke_bradley", email: "luke@boostify.demo", displayName: "Luke Bradley", bio: "Country music artist", profileImageUrl: "/artist-images/luke_bradley_-_country_artist.png", songName: "Country Roads", tokenSymbol: "LUKE" },
  { username: "aria_nova", email: "aria@boostify.demo", displayName: "Aria Nova", bio: "Ambient electronic artist", profileImageUrl: "/artist-images/aria_nova_-_ambient_electronic.png", songName: "Ambient Cosmos", tokenSymbol: "ARIA" },
  { username: "alex_thunder", email: "alex@boostify.demo", displayName: "Alex Thunder", bio: "Trap producer", profileImageUrl: "/artist-images/alex_thunder_-_trap_producer.png", songName: "Trap Beats", tokenSymbol: "ALEX" },
  { username: "victoria_cross", email: "victoria@boostify.demo", displayName: "Victoria Cross", bio: "Opera singer", profileImageUrl: "/artist-images/victoria_cross_-_opera_singer.png", songName: "Opera Aria", tokenSymbol: "VICTORIA" },
  { username: "prince_diesel", email: "prince@boostify.demo", displayName: "Prince Diesel", bio: "Funk artist", profileImageUrl: "/artist-images/prince_diesel_-_funk_artist.png", songName: "Funk Groove", tokenSymbol: "DIESEL" },
  { username: "ryan_phoenix", email: "ryan@boostify.demo", displayName: "Ryan Phoenix", bio: "Indie rock musician", profileImageUrl: "/artist-images/ryan_phoenix_-_indie_rock.png", songName: "Rock Anthem", tokenSymbol: "RYAN" },
  { username: "pablo_fuego", email: "pablo@boostify.demo", displayName: "Pablo Fuego", bio: "Latin music artist", profileImageUrl: "/artist-images/pablo_fuego_-_latin_artist.png", songName: "Latin Fire", tokenSymbol: "PABLO" },
  { username: "emma_white", email: "emma@boostify.demo", displayName: "Emma White", bio: "Pop princess", profileImageUrl: "/artist-images/emma_white_-_pop_princess.png", songName: "Pop Perfection", tokenSymbol: "EMMA" },
  { username: "chris_void", email: "chris@boostify.demo", displayName: "Chris Void", bio: "Dubstep producer", profileImageUrl: "/artist-images/chris_void_-_dubstep_producer.png", songName: "Dubstep Drop", tokenSymbol: "VOID" },
  { username: "james_grant", email: "james@boostify.demo", displayName: "James Grant", bio: "Soul singer", profileImageUrl: "/artist-images/james_grant_-_soul_singer.png", songName: "Soul Serenade", tokenSymbol: "JAMES" },
];

// Token metadata for songs
const TOKEN_METADATA = [
  { totalSupply: 10000, availableSupply: 3500, priceUsd: "2.45", priceEth: "0.005", description: "A haunting synthwave track with ethereal vocals", benefits: ["Royalty rights", "VIP access", "Exclusive content"] },
  { totalSupply: 15000, availableSupply: 5000, priceUsd: "1.85", priceEth: "0.003", description: "Hard-hitting hip-hop with conscious lyrics", benefits: ["Royalty rights", "Backstage passes", "Exclusive drops"] },
  { totalSupply: 8000, availableSupply: 1200, priceUsd: "4.22", priceEth: "0.008", description: "Electropop sensation breaking charts worldwide", benefits: ["Royalty rights", "Concert invitations", "Merchandise"] },
  { totalSupply: 12000, availableSupply: 4100, priceUsd: "2.88", priceEth: "0.005", description: "Deep R&B with timeless soul vibes", benefits: ["Royalty rights", "Exclusive demos", "Fan club access"] },
  { totalSupply: 9000, availableSupply: 3200, priceUsd: "1.99", priceEth: "0.004", description: "Indie folk masterpiece with acoustic instrumentation", benefits: ["Royalty rights", "Album preorder", "Meet & greet"] },
  { totalSupply: 11000, availableSupply: 4100, priceUsd: "2.15", priceEth: "0.004", description: "Relaxing reggae vibes for the soul", benefits: ["Royalty rights", "Studio sessions", "Collaboration"] },
  { totalSupply: 5000, availableSupply: 800, priceUsd: "5.50", priceEth: "0.010", description: "A virtuosic classical composition", benefits: ["Royalty rights", "Private concerts", "Sheet music"] },
  { totalSupply: 12000, availableSupply: 2500, priceUsd: "3.80", priceEth: "0.007", description: "Chart-topping K-pop sensation", benefits: ["Royalty rights", "Tour passes", "Limited edition"] },
  { totalSupply: 7000, availableSupply: 1500, priceUsd: "4.15", priceEth: "0.008", description: "Smooth jazz saxophone performance", benefits: ["Royalty rights", "Jazz club events", "Recording sessions"] },
  { totalSupply: 13000, availableSupply: 3800, priceUsd: "3.45", priceEth: "0.006", description: "Hot reggaeton track with infectious rhythm", benefits: ["Royalty rights", "Festival appearances", "Streaming boost"] },
  { totalSupply: 10000, availableSupply: 3900, priceUsd: "2.65", priceEth: "0.005", description: "Classic country ballad", benefits: ["Royalty rights", "Country tour", "Album credits"] },
  { totalSupply: 8500, availableSupply: 4200, priceUsd: "2.20", priceEth: "0.004", description: "Ethereal ambient electronic soundscape", benefits: ["Royalty rights", "Meditation sessions", "Sound design"] },
  { totalSupply: 11000, availableSupply: 2800, priceUsd: "3.55", priceEth: "0.007", description: "Heavy trap production masterpiece", benefits: ["Royalty rights", "Producer credits", "Beat packs"] },
  { totalSupply: 4000, availableSupply: 600, priceUsd: "6.10", priceEth: "0.012", description: "Classical opera performance", benefits: ["Royalty rights", "Opera house events", "Performance rights"] },
  { totalSupply: 9500, availableSupply: 2200, priceUsd: "3.90", priceEth: "0.008", description: "Funky rhythmic groove", benefits: ["Royalty rights", "Funk festivals", "Dancing events"] },
  { totalSupply: 10500, availableSupply: 3600, priceUsd: "3.25", priceEth: "0.006", description: "Indie rock anthem", benefits: ["Royalty rights", "Rock shows", "Band merchandise"] },
  { totalSupply: 12000, availableSupply: 4500, priceUsd: "2.99", priceEth: "0.006", description: "Energetic Latin music", benefits: ["Royalty rights", "Latin festivals", "Dance classes"] },
  { totalSupply: 13500, availableSupply: 3200, priceUsd: "3.55", priceEth: "0.007", description: "Catchy pop hit", benefits: ["Royalty rights", "Fan club", "Meet & greet"] },
  { totalSupply: 9000, availableSupply: 1800, priceUsd: "4.05", priceEth: "0.008", description: "Massive dubstep bass drop", benefits: ["Royalty rights", "Rave events", "Remix packs"] },
  { totalSupply: 11000, availableSupply: 3400, priceUsd: "3.35", priceEth: "0.006", description: "Soulful R&B ballad", benefits: ["Royalty rights", "Soul nights", "Studio collab"] },
];

export async function seedTokenizedSongs() {
  try {
    console.log("🌱 Iniciando seed de artistas y tokens BTF-2300...");
    
    let artistsCreated = 0;
    let tokensCreated = 0;
    let artistsSkipped = 0;
    
    // Get the max tokenId to avoid conflicts
    const maxTokenResult = await db.select({ maxId: sql<number>`COALESCE(MAX(token_id), 0)` }).from(tokenizedSongs);
    let nextTokenId = (maxTokenResult[0]?.maxId || 0) + 1;
    
    for (let i = 0; i < DEMO_ARTISTS.length; i++) {
      const artist = DEMO_ARTISTS[i];
      const metadata = TOKEN_METADATA[i];
      
      // Check if artist already exists by username or email
      const existingArtist = await db.select().from(users).where(eq(users.username, artist.username));
      const existingByEmail = await db.select().from(users).where(eq(users.email, artist.email));
      
      let artistId: number | null = null;
      
      if (existingArtist.length === 0 && existingByEmail.length === 0) {
        try {
          // Create the artist
          const [newArtist] = await db.insert(users).values({
            username: artist.username,
            email: artist.email,
            artistName: artist.displayName,
            biography: artist.bio,
            profileImageUrl: artist.profileImageUrl,
            role: "artist",
          }).returning({ id: users.id });
          
          artistId = newArtist.id;
          artistsCreated++;
          console.log(`✅ Artista: ${artist.displayName} (ID: ${artistId})`);
        } catch (insertError) {
          // If insert fails due to duplicate, try to find the existing artist
          artistsSkipped++;
        }
      } else {
        artistId = existingArtist.length > 0 ? existingArtist[0].id : existingByEmail[0].id;
        artistsSkipped++;
      }
      
      // If we couldn't get artistId, skip token creation
      if (artistId === null) {
        continue;
      }
      
      // Check if token already exists for this song
      const existingToken = await db.select().from(tokenizedSongs)
        .where(eq(tokenizedSongs.tokenSymbol, artist.tokenSymbol));
      
      if (existingToken.length === 0) {
        try {
          // Create the tokenized song with next available tokenId
          await db.insert(tokenizedSongs).values({
            artistId,
            songName: artist.songName,
            songUrl: null,
            tokenId: nextTokenId,
            tokenSymbol: artist.tokenSymbol,
            totalSupply: metadata.totalSupply,
            availableSupply: metadata.availableSupply,
            pricePerTokenUsd: metadata.priceUsd,
            pricePerTokenEth: metadata.priceEth,
            royaltyPercentageArtist: 80,
            royaltyPercentagePlatform: 20,
            contractAddress: BOOSTIFY_CONTRACT_ADDRESS,
            metadataUri: `ipfs://QmXx${artist.tokenSymbol}001`,
            imageUrl: artist.profileImageUrl,
            description: metadata.description,
            benefits: metadata.benefits,
            isActive: true,
          });
          tokensCreated++;
          nextTokenId++; // Increment for next token
          console.log(`✅ Token BTF-2300: ${artist.songName} ($${artist.tokenSymbol})`);
        } catch (tokenError) {
          // Token creation failed, log and skip
          console.log(`❌ Error creando token ${artist.tokenSymbol}:`, tokenError instanceof Error ? tokenError.message : 'Unknown error');
        }
      }
    }
    
    console.log(`\n🎉 Seed BTF-2300 completado!`);
    console.log(`   📦 ${artistsCreated} artistas nuevos, ${artistsSkipped} existentes`);
    console.log(`   🪙 ${tokensCreated} tokens BTF-2300 creados`);
    
  } catch (error) {
    console.warn("⚠️ Seed BTF-2300 omitido:", error instanceof Error ? error.message : 'Error desconocido');
  }
}

// Legacy export for compatibility (now empty - all data is generated dynamically)
export const TOKENIZED_SONGS_SEED: any[] = [];
