/**
 * Admin routes for managing BoostiSwap artists
 * These are the 20 static artists displayed in the BoostiSwap marketplace
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { users, tokenizedSongs } from "../db/schema";
import { eq, isNull, desc, ilike, or, and, isNotNull, sql } from "drizzle-orm";

const router = Router();

// Static BoostiSwap artist slugs (the 20 marketplace artists)
const BOOSTISWAP_SLUGS = [
  'luna-echo', 'urban-flow', 'electric-dreams', 'soul-harmony', 'maya-rivers',
  'jah-vibes', 'david-chen', 'sophia-kim', 'marcus-stone', 'isabella-santos',
  'luke-bradley', 'aria-nova', 'alex-thunder', 'victoria-cross', 'prince-diesel',
  'ryan-phoenix', 'pablo-fuego', 'emma-white', 'chris-void', 'james-grant'
];

/**
 * GET /api/admin/boostiswap-artists
 * Get all BoostiSwap artists: static marketplace artists + any with tokenized songs
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    
    // Strategy: Get artists that appear on the BoostiSwap marketplace
    // 1. Artists with known BoostiSwap slugs (the static 20)
    // 2. Artists that have tokenized songs (dynamically added to marketplace)
    
    // Get IDs of artists with tokenized songs
    const tokenizedArtistIds = await db.selectDistinct({ artistId: tokenizedSongs.artistId })
      .from(tokenizedSongs)
      .where(isNotNull(tokenizedSongs.artistId));
    
    const tokenArtistIdSet = new Set(tokenizedArtistIds.map(r => r.artistId).filter(Boolean));

    // Build conditions: known BoostiSwap slugs OR has tokenized songs
    const baseConditions = or(
      sql`${users.slug} = ANY(${BOOSTISWAP_SLUGS})`,
      tokenArtistIdSet.size > 0
        ? sql`${users.id} = ANY(${Array.from(tokenArtistIdSet)})`
        : sql`false`
    );
    
    let whereClause = baseConditions;
    
    // Apply search filter if provided
    if (search && typeof search === 'string') {
      whereClause = and(
        baseConditions,
        or(
          ilike(users.artistName, `%${search}%`),
          ilike(users.slug, `%${search}%`)
        )
      );
    }
    
    const artists = await db.select({
      id: users.id,
      artistName: users.artistName,
      slug: users.slug,
      biography: users.biography,
      profileImage: users.profileImage,
      coverImage: users.coverImage,
      genres: users.genres,
      country: users.country,
      location: users.location,
      instagramHandle: users.instagramHandle,
      twitterHandle: users.twitterHandle,
      youtubeHandle: users.youtubeChannel,
      spotifyUrl: users.spotifyUrl,
      isAIGenerated: users.isAIGenerated,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereClause!)
    .orderBy(desc(users.createdAt));
    
    console.log(`📊 [ADMIN] Found ${artists.length} BoostiSwap artists`);
    
    res.json({ 
      success: true, 
      artists,
      count: artists.length 
    });
  } catch (error) {
    console.error("❌ [ADMIN] Error fetching BoostiSwap artists:", error);
    res.status(500).json({ 
      success: false, 
      error: "Error fetching BoostiSwap artists" 
    });
  }
});

/**
 * GET /api/admin/boostiswap-artists/:id
 * Get a single BoostiSwap artist by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const artist = await db.select()
      .from(users)
      .where(eq(users.id, parseInt(id)))
      .limit(1);
    
    if (!artist.length) {
      return res.status(404).json({ 
        success: false, 
        error: "Artist not found" 
      });
    }
    
    res.json({ success: true, artist: artist[0] });
  } catch (error) {
    console.error("❌ [ADMIN] Error fetching artist:", error);
    res.status(500).json({ 
      success: false, 
      error: "Error fetching artist" 
    });
  }
});

/**
 * PATCH /api/admin/boostiswap-artists/:id
 * Update a BoostiSwap artist
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      artistName, 
      slug, 
      biography, 
      profileImage, 
      coverImage, 
      genres, 
      country, 
      location,
      instagramHandle,
      twitterHandle,
      youtubeHandle,
      spotifyUrl
    } = req.body;
    
    const updateData: any = { updatedAt: new Date() };
    
    if (artistName !== undefined) updateData.artistName = artistName;
    if (slug !== undefined) updateData.slug = slug;
    if (biography !== undefined) updateData.biography = biography;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (genres !== undefined) updateData.genres = genres;
    if (country !== undefined) updateData.country = country;
    if (location !== undefined) updateData.location = location;
    if (instagramHandle !== undefined) updateData.instagramHandle = instagramHandle;
    if (twitterHandle !== undefined) updateData.twitterHandle = twitterHandle;
    if (youtubeHandle !== undefined) updateData.youtubeChannel = youtubeHandle;
    if (spotifyUrl !== undefined) updateData.spotifyUrl = spotifyUrl;
    
    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, parseInt(id)))
      .returning();
    
    if (!result.length) {
      return res.status(404).json({ 
        success: false, 
        error: "Artist not found" 
      });
    }
    
    console.log(`✅ [ADMIN] Updated BoostiSwap artist: ${result[0].artistName} (ID: ${id})`);
    
    res.json({ success: true, artist: result[0] });
  } catch (error) {
    console.error("❌ [ADMIN] Error updating artist:", error);
    res.status(500).json({ 
      success: false, 
      error: "Error updating artist" 
    });
  }
});

/**
 * DELETE /api/admin/boostiswap-artists/:id
 * Delete a BoostiSwap artist
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await db
      .delete(users)
      .where(eq(users.id, parseInt(id)))
      .returning() as any[];
    
    if (!result.length) {
      return res.status(404).json({ 
        success: false, 
        error: "Artist not found" 
      });
    }
    
    console.log(`🗑️ [ADMIN] Deleted BoostiSwap artist: ${result[0].artistName} (ID: ${id})`);
    
    res.json({ 
      success: true, 
      message: "Artist deleted successfully" 
    });
  } catch (error) {
    console.error("❌ [ADMIN] Error deleting artist:", error);
    res.status(500).json({ 
      success: false, 
      error: "Error deleting artist" 
    });
  }
});

/**
 * POST /api/admin/boostiswap-artists/sync
 * Ensure the 20 static BoostiSwap artists exist in the database with proper slugs.
 * Creates missing artists and updates existing ones with correct slug/image.
 */
router.post("/sync", async (_req: Request, res: Response) => {
  try {
    const staticArtists = [
      { name: "Luna Echo", slug: "luna-echo", desc: "A haunting synthwave artist with ethereal vocals", img: "/artist-images/luna_echo_-_female_pop_singer.png", genre: "Synthwave" },
      { name: "Urban Flow", slug: "urban-flow", desc: "High-energy hip-hop artist with infectious beats", img: "/artist-images/urban_flow_-_hip-hop_artist.png", genre: "Hip-Hop" },
      { name: "Electric Dreams", slug: "electric-dreams", desc: "Electropop sensation breaking charts worldwide", img: "/artist-images/electric_dreams_-_electronic_artist.png", genre: "Electropop" },
      { name: "Soul Harmony", slug: "soul-harmony", desc: "Deep R&B with timeless soul vibes", img: "/artist-images/soul_harmony_-_r&b_artist.png", genre: "R&B" },
      { name: "Maya Rivers", slug: "maya-rivers", desc: "Indie folk masterpiece with acoustic instrumentation", img: "/artist-images/maya_rivers_-_indie_folk.png", genre: "Indie Folk" },
      { name: "Jah Vibes", slug: "jah-vibes", desc: "Relaxing reggae vibes for the soul", img: "/artist-images/jah_vibes_-_reggae_artist.png", genre: "Reggae" },
      { name: "David Chen", slug: "david-chen", desc: "A virtuosic classical pianist", img: "/artist-images/david_chen_-_classical_pianist.png", genre: "Classical" },
      { name: "Sophia Kim", slug: "sophia-kim", desc: "Chart-topping K-pop sensation", img: "/artist-images/sophia_kim_-_k-pop_star.png", genre: "K-Pop" },
      { name: "Marcus Stone", slug: "marcus-stone", desc: "Smooth jazz saxophone performer", img: "/artist-images/marcus_stone_-_jazz_saxophonist.png", genre: "Jazz" },
      { name: "Isabella Santos", slug: "isabella-santos", desc: "Hot reggaeton artist with infectious rhythm", img: "/artist-images/isabella_santos_-_reggaeton.png", genre: "Reggaeton" },
      { name: "Luke Bradley", slug: "luke-bradley", desc: "Classic country artist", img: "/artist-images/luke_bradley_-_country_artist.png", genre: "Country" },
      { name: "Aria Nova", slug: "aria-nova", desc: "Ethereal ambient electronic artist", img: "/artist-images/aria_nova_-_ambient_electronic.png", genre: "Ambient" },
      { name: "Alex Thunder", slug: "alex-thunder", desc: "Heavy trap production master", img: "/artist-images/alex_thunder_-_trap_producer.png", genre: "Trap" },
      { name: "Victoria Cross", slug: "victoria-cross", desc: "Classical opera performer", img: "/artist-images/victoria_cross_-_opera_singer.png", genre: "Opera" },
      { name: "Prince Diesel", slug: "prince-diesel", desc: "Funky rhythmic groove artist", img: "/artist-images/prince_diesel_-_funk_artist.png", genre: "Funk" },
      { name: "Ryan Phoenix", slug: "ryan-phoenix", desc: "Indie rock sensation", img: "/artist-images/ryan_phoenix_-_indie_rock.png", genre: "Indie Rock" },
      { name: "Pablo Fuego", slug: "pablo-fuego", desc: "Energetic Latin music artist", img: "/artist-images/pablo_fuego_-_latin_artist.png", genre: "Latin" },
      { name: "Emma White", slug: "emma-white", desc: "Catchy pop star", img: "/artist-images/emma_white_-_pop_princess.png", genre: "Pop" },
      { name: "Chris Void", slug: "chris-void", desc: "Massive dubstep bass producer", img: "/artist-images/chris_void_-_dubstep_producer.png", genre: "Dubstep" },
      { name: "James Grant", slug: "james-grant", desc: "Soulful R&B vocalist", img: "/artist-images/james_grant_-_soul_singer.png", genre: "Soul" },
    ];
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const artist of staticArtists) {
      // Check if artist with this slug already exists
      const existing = await db.select({ id: users.id, artistName: users.artistName, profileImage: users.profileImage })
        .from(users)
        .where(eq(users.slug, artist.slug))
        .limit(1);
      
      if (existing.length > 0) {
        // Update if name or image is missing
        const needsUpdate = !existing[0].artistName || !existing[0].profileImage;
        if (needsUpdate) {
          await db.update(users).set({
            artistName: artist.name,
            profileImage: artist.img,
            biography: artist.desc,
            genres: [artist.genre],
            updatedAt: new Date(),
          }).where(eq(users.id, existing[0].id));
          updated++;
        } else {
          skipped++;
        }
        continue;
      }
      
      // Create the artist
      await db.insert(users).values({
        artistName: artist.name,
        slug: artist.slug,
        biography: artist.desc,
        profileImage: artist.img,
        genres: [artist.genre],
        role: "artist",
        isAIGenerated: false,
      });
      created++;
    }
    
    console.log(`🔄 [ADMIN] BoostiSwap sync: ${created} created, ${updated} updated, ${skipped} skipped`);
    
    res.json({ 
      success: true, 
      message: `Sync complete: ${created} created, ${updated} updated, ${skipped} unchanged`,
      created,
      updated,
      skipped,
    });
  } catch (error) {
    console.error("❌ [ADMIN] Error syncing BoostiSwap artists:", error);
    res.status(500).json({ 
      success: false, 
      error: "Error syncing BoostiSwap artists" 
    });
  }
});

export default router;
