/**
 * Seed script to add the 20 static BoostiSwap artists to the PostgreSQL database
 * These artists are displayed in the BoostiSwap marketplace and need proper database entries
 * so their profile pages can be accessed via /artist/{slug}
 */

import dotenv from "dotenv";
dotenv.config();

import { db } from "../server/db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

// Static artists from BoostiSwap marketplace (same data as in boostiswap.ts)
const staticArtists = [
  { 
    name: "Luna Echo", 
    slug: "luna-echo",
    description: "A haunting synthwave artist with ethereal vocals", 
    imageUrl: "/artist-images/luna_echo_-_female_pop_singer.png",
    genre: "Synthwave"
  },
  { 
    name: "Urban Flow", 
    slug: "urban-flow",
    description: "High-energy hip-hop artist with infectious beats", 
    imageUrl: "/artist-images/urban_flow_-_hip-hop_artist.png",
    genre: "Hip-Hop"
  },
  { 
    name: "Electric Dreams", 
    slug: "electric-dreams",
    description: "Electropop sensation breaking charts worldwide", 
    imageUrl: "/artist-images/electric_dreams_-_electronic_artist.png",
    genre: "Electropop"
  },
  { 
    name: "Soul Harmony", 
    slug: "soul-harmony",
    description: "Deep R&B with timeless soul vibes", 
    imageUrl: "/artist-images/soul_harmony_-_r&b_artist.png",
    genre: "R&B"
  },
  { 
    name: "Maya Rivers", 
    slug: "maya-rivers",
    description: "Indie folk masterpiece with acoustic instrumentation", 
    imageUrl: "/artist-images/maya_rivers_-_indie_folk.png",
    genre: "Indie Folk"
  },
  { 
    name: "Jah Vibes", 
    slug: "jah-vibes",
    description: "Relaxing reggae vibes for the soul", 
    imageUrl: "/artist-images/jah_vibes_-_reggae_artist.png",
    genre: "Reggae"
  },
  { 
    name: "David Chen", 
    slug: "david-chen",
    description: "A virtuosic classical pianist", 
    imageUrl: "/artist-images/david_chen_-_classical_pianist.png",
    genre: "Classical"
  },
  { 
    name: "Sophia Kim", 
    slug: "sophia-kim",
    description: "Chart-topping K-pop sensation", 
    imageUrl: "/artist-images/sophia_kim_-_k-pop_star.png",
    genre: "K-Pop"
  },
  { 
    name: "Marcus Stone", 
    slug: "marcus-stone",
    description: "Smooth jazz saxophone performer", 
    imageUrl: "/artist-images/marcus_stone_-_jazz_saxophonist.png",
    genre: "Jazz"
  },
  { 
    name: "Isabella Santos", 
    slug: "isabella-santos",
    description: "Hot reggaeton artist with infectious rhythm", 
    imageUrl: "/artist-images/isabella_santos_-_reggaeton.png",
    genre: "Reggaeton"
  },
  { 
    name: "Luke Bradley", 
    slug: "luke-bradley",
    description: "Classic country artist", 
    imageUrl: "/artist-images/luke_bradley_-_country_artist.png",
    genre: "Country"
  },
  { 
    name: "Aria Nova", 
    slug: "aria-nova",
    description: "Ethereal ambient electronic artist", 
    imageUrl: "/artist-images/aria_nova_-_ambient_electronic.png",
    genre: "Ambient"
  },
  { 
    name: "Alex Thunder", 
    slug: "alex-thunder",
    description: "Heavy trap production master", 
    imageUrl: "/artist-images/alex_thunder_-_trap_producer.png",
    genre: "Trap"
  },
  { 
    name: "Victoria Cross", 
    slug: "victoria-cross",
    description: "Classical opera performer", 
    imageUrl: "/artist-images/victoria_cross_-_opera_singer.png",
    genre: "Opera"
  },
  { 
    name: "Prince Diesel", 
    slug: "prince-diesel",
    description: "Funky rhythmic groove artist", 
    imageUrl: "/artist-images/prince_diesel_-_funk_artist.png",
    genre: "Funk"
  },
  { 
    name: "Ryan Phoenix", 
    slug: "ryan-phoenix",
    description: "Indie rock sensation", 
    imageUrl: "/artist-images/ryan_phoenix_-_indie_rock.png",
    genre: "Indie Rock"
  },
  { 
    name: "Pablo Fuego", 
    slug: "pablo-fuego",
    description: "Energetic Latin music artist", 
    imageUrl: "/artist-images/pablo_fuego_-_latin_artist.png",
    genre: "Latin"
  },
  { 
    name: "Emma White", 
    slug: "emma-white",
    description: "Catchy pop star", 
    imageUrl: "/artist-images/emma_white_-_pop_princess.png",
    genre: "Pop"
  },
  { 
    name: "Chris Void", 
    slug: "chris-void",
    description: "Massive dubstep bass producer", 
    imageUrl: "/artist-images/chris_void_-_dubstep_producer.png",
    genre: "Dubstep"
  },
  { 
    name: "James Grant", 
    slug: "james-grant",
    description: "Soulful R&B vocalist", 
    imageUrl: "/artist-images/james_grant_-_soul_singer.png",
    genre: "Soul"
  }
];

async function seedBoostiSwapArtists() {
  console.log("🌱 Starting BoostiSwap artists seed...\n");
  
  let created = 0;
  let skipped = 0;
  
  for (const artist of staticArtists) {
    try {
      // Check if artist with this slug already exists
      const existing = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.slug, artist.slug))
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`⏭️  Skipping ${artist.name} (slug: ${artist.slug}) - already exists`);
        skipped++;
        continue;
      }
      
      // Insert the new artist
      const [newArtist] = await db.insert(users).values({
        artistName: artist.name,
        slug: artist.slug,
        biography: artist.description,
        profileImage: artist.imageUrl,
        genres: [artist.genre],
        role: "artist",
        isAIGenerated: false, // These are "static" demo artists
      }).returning({ id: users.id });
      
      console.log(`✅ Created ${artist.name} (slug: ${artist.slug}, id: ${newArtist.id})`);
      created++;
      
    } catch (error: any) {
      console.error(`❌ Error creating ${artist.name}:`, error.message);
    }
  }
  
  console.log("\n🎉 Seed completed!");
  console.log(`   📦 ${created} artists created`);
  console.log(`   ⏭️  ${skipped} artists skipped (already exist)`);
  
  process.exit(0);
}

seedBoostiSwapArtists().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
