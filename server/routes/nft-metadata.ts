/**
 * NFT Metadata API for BTF-2300 Tokens
 * Serves metadata JSON for artists, songs, catalogs, and licenses
 * Following ERC-1155 and OpenSea metadata standards
 * 
 * INTEGRADO CON BASE DE DATOS DE BOOSTIFY
 * Los metadatos se generan desde los artistas/canciones reales de la plataforma
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, songs } from '../../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Token type prefixes (must match smart contract)
const ARTIST_TOKEN_PREFIX = 1_000_000_000;
const SONG_TOKEN_PREFIX = 2_000_000_000;
const CATALOG_TOKEN_PREFIX = 3_000_000_000;
const LICENSE_TOKEN_PREFIX = 4_000_000_000;

// Base URL for assets
const BASE_URL = process.env.BASE_URL || 'https://boostifymusic.com';

// Default images for tokens without custom images
const DEFAULT_ARTIST_IMAGE = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&h=500&fit=crop';
const DEFAULT_SONG_IMAGE = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop';
const DEFAULT_CATALOG_IMAGE = 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=500&h=500&fit=crop';
const DEFAULT_LICENSE_IMAGE = 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&h=500&fit=crop';

/**
 * Artist Token Metadata - FROM DATABASE
 * GET /api/metadata/artist/:artistId
 */
router.get('/artist/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    
    if (isNaN(artistId) || artistId < 1) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    // Obtener artista REAL de la base de datos de Boostify
    const artist = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
    
    if (artist.length === 0) {
      // Si no existe en BD, devolver metadata genérica
      return res.json({
        name: `Boostify Artist #${artistId}`,
        description: `Artist Identity Token on Boostify Music Platform.`,
        image: DEFAULT_ARTIST_IMAGE,
        external_url: `${BASE_URL}/artist/${artistId}`,
        attributes: [
          { trait_type: "Type", value: "Artist Identity" },
          { trait_type: "Platform", value: "Boostify Music" },
          { trait_type: "Token Standard", value: "BTF-2300" },
          { trait_type: "Network", value: "Polygon" }
        ]
      });
    }

    const artistData = artist[0];
    
    // Usar imagen real del artista de Boostify
    let artistImage = artistData.profileImage || artistData.coverImage || DEFAULT_ARTIST_IMAGE;
    
    // Si la imagen es de Firebase Storage, asegurar URL pública
    if (artistImage && !artistImage.startsWith('http')) {
      artistImage = `${BASE_URL}${artistImage}`;
    }

    const metadata = {
      name: artistData.artistName || artistData.username || `Boostify Artist #${artistId}`,
      description: artistData.biography || `Official Boostify Music Artist Identity Token. This NFT represents verified artist status on the Boostify platform.`,
      image: artistImage,
      external_url: artistData.slug ? `${BASE_URL}/${artistData.slug}` : `${BASE_URL}/artist/${artistId}`,
      background_color: "1a1a2e",
      attributes: [
        {
          trait_type: "Type",
          value: "Artist Identity"
        },
        {
          trait_type: "Platform",
          value: "Boostify Music"
        },
        {
          trait_type: "Token Standard",
          value: "BTF-2300"
        },
        {
          trait_type: "Network",
          value: "Polygon"
        },
        {
          trait_type: "Genre",
          value: artistData.genre || (artistData.genres && artistData.genres[0]) || "Music"
        },
        {
          trait_type: "Country",
          value: artistData.country || artistData.location || "Worldwide"
        },
        {
          trait_type: "Verified",
          value: artistData.role === 'admin' ? 'Yes' : 'No'
        },
        {
          display_type: "number",
          trait_type: "Artist ID",
          value: artistId
        },
        {
          display_type: "number",
          trait_type: "Token ID",
          value: ARTIST_TOKEN_PREFIX + artistId
        },
        {
          display_type: "date",
          trait_type: "Registered",
          value: Math.floor(new Date(artistData.createdAt).getTime() / 1000)
        }
      ]
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache 5 min para actualizaciones
    return res.json(metadata);
  } catch (error) {
    console.error('Error fetching artist metadata:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Song Token Metadata - FROM DATABASE
 * GET /api/metadata/song/:tokenId
 */
router.get('/song/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Calculate song ID from token
    const songId = tokenId >= SONG_TOKEN_PREFIX ? tokenId - SONG_TOKEN_PREFIX : tokenId;

    // Obtener canción REAL de la base de datos
    const song = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    
    if (song.length === 0) {
      // Si no existe, devolver metadata genérica
      return res.json({
        name: `Song Token #${songId}`,
        description: `Fractional ownership token for a song on Boostify Music.`,
        image: DEFAULT_SONG_IMAGE,
        external_url: `${BASE_URL}/song/${songId}`,
        attributes: [
          { trait_type: "Type", value: "Song Ownership" },
          { trait_type: "Platform", value: "Boostify Music" },
          { trait_type: "Token Standard", value: "BTF-2300" }
        ]
      });
    }

    const songData = song[0];
    
    // Obtener datos del artista
    const artist = await db.select().from(users).where(eq(users.id, songData.userId)).limit(1);
    const artistName = artist.length > 0 ? (artist[0].artistName || artist[0].username) : 'Unknown Artist';
    
    // Usar cover art real o default
    let songImage = songData.coverArt || DEFAULT_SONG_IMAGE;
    if (songImage && !songImage.startsWith('http')) {
      songImage = `${BASE_URL}${songImage}`;
    }

    const metadata: any = {
      name: songData.title,
      description: songData.description || `"${songData.title}" by ${artistName}. Fractional ownership token - holders earn royalties from streaming revenue.`,
      image: songImage,
      external_url: `${BASE_URL}/song/${songId}`,
      background_color: "16213e",
      animation_url: songData.audioUrl, // Para que OpenSea muestre el audio
      attributes: [
        {
          trait_type: "Type",
          value: "Song Ownership"
        },
        {
          trait_type: "Artist",
          value: artistName
        },
        {
          trait_type: "Platform",
          value: "Boostify Music"
        },
        {
          trait_type: "Token Standard",
          value: "BTF-2300"
        },
        {
          trait_type: "Genre",
          value: songData.genre || "Music"
        },
        {
          trait_type: "Mood",
          value: songData.mood || "Unknown"
        },
        {
          trait_type: "AI Generated",
          value: songData.generatedWithAI ? "Yes" : "No"
        },
        {
          trait_type: "Royalty Share",
          value: "Proportional"
        },
        {
          display_type: "number",
          trait_type: "Song ID",
          value: songId
        },
        {
          display_type: "number",
          trait_type: "Token ID",
          value: SONG_TOKEN_PREFIX + songId
        },
        {
          display_type: "number",
          trait_type: "Plays",
          value: songData.plays || 0
        }
      ]
    };

    // Agregar fecha de lanzamiento si existe
    if (songData.releaseDate) {
      metadata.attributes.push({
        display_type: "date",
        trait_type: "Release Date",
        value: Math.floor(new Date(songData.releaseDate).getTime() / 1000)
      });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(metadata);
  } catch (error) {
    console.error('Error fetching song metadata:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Catalog Token Metadata
 * GET /api/metadata/catalog/:tokenId
 */
router.get('/catalog/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const catalogId = tokenId >= CATALOG_TOKEN_PREFIX ? tokenId - CATALOG_TOKEN_PREFIX : tokenId;

    const metadata = {
      name: `Catalog Bundle #${catalogId}`,
      description: `A curated collection of songs bundled together. Holders earn royalties from all included tracks.`,
      image: DEFAULT_CATALOG_IMAGE,
      external_url: `${BASE_URL}/catalog/${catalogId}`,
      background_color: "0f3460",
      attributes: [
        {
          trait_type: "Type",
          value: "Catalog Bundle"
        },
        {
          trait_type: "Platform",
          value: "Boostify Music"
        },
        {
          trait_type: "Token Standard",
          value: "BTF-2300"
        },
        {
          display_type: "number",
          trait_type: "Catalog ID",
          value: catalogId
        }
      ]
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json(metadata);
  } catch (error) {
    console.error('Error fetching catalog metadata:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * License Token Metadata
 * GET /api/metadata/license/:tokenId
 */
router.get('/license/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const licenseId = tokenId >= LICENSE_TOKEN_PREFIX ? tokenId - LICENSE_TOKEN_PREFIX : tokenId;

    const metadata = {
      name: `Music License #${licenseId}`,
      description: `On-chain music license granting specific usage rights. Valid for sync, mechanical, performance, or master usage.`,
      image: DEFAULT_LICENSE_IMAGE,
      external_url: `${BASE_URL}/license/${licenseId}`,
      background_color: "533483",
      attributes: [
        {
          trait_type: "Type",
          value: "Music License"
        },
        {
          trait_type: "Platform",
          value: "Boostify Music"
        },
        {
          trait_type: "Token Standard",
          value: "BTF-2300"
        },
        {
          display_type: "number",
          trait_type: "License ID",
          value: licenseId
        }
      ]
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json(metadata);
  } catch (error) {
    console.error('Error fetching license metadata:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Generic Token Metadata (by full token ID)
 * GET /api/metadata/token/:tokenId
 * Automatically routes to correct type based on token ID range
 */
router.get('/token/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Determine token type by ID range
    if (tokenId >= LICENSE_TOKEN_PREFIX) {
      const licenseId = tokenId - LICENSE_TOKEN_PREFIX;
      return res.redirect(`/api/metadata/license/${licenseId}`);
    } else if (tokenId >= CATALOG_TOKEN_PREFIX) {
      const catalogId = tokenId - CATALOG_TOKEN_PREFIX;
      return res.redirect(`/api/metadata/catalog/${catalogId}`);
    } else if (tokenId >= SONG_TOKEN_PREFIX) {
      const songId = tokenId - SONG_TOKEN_PREFIX;
      return res.redirect(`/api/metadata/song/${songId}`);
    } else if (tokenId >= ARTIST_TOKEN_PREFIX) {
      const artistId = tokenId - ARTIST_TOKEN_PREFIX;
      return res.redirect(`/api/metadata/artist/${artistId}`);
    } else {
      return res.status(400).json({ error: 'Unknown token type' });
    }
  } catch (error) {
    console.error('Error routing token metadata:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * ERC-1155 Compatible URI endpoint
 * GET /api/metadata/:tokenId
 * This format is what the smart contract's uri() function returns
 */
router.get('/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Route to appropriate handler
    if (tokenId >= LICENSE_TOKEN_PREFIX) {
      const licenseId = tokenId - LICENSE_TOKEN_PREFIX;
      return res.redirect(301, `/api/metadata/license/${licenseId}`);
    } else if (tokenId >= CATALOG_TOKEN_PREFIX) {
      const catalogId = tokenId - CATALOG_TOKEN_PREFIX;
      return res.redirect(301, `/api/metadata/catalog/${catalogId}`);
    } else if (tokenId >= SONG_TOKEN_PREFIX) {
      const songId = tokenId - SONG_TOKEN_PREFIX;
      return res.redirect(301, `/api/metadata/song/${songId}`);
    } else if (tokenId >= ARTIST_TOKEN_PREFIX) {
      const artistId = tokenId - ARTIST_TOKEN_PREFIX;
      return res.redirect(301, `/api/metadata/artist/${artistId}`);
    } else {
      // For IDs below ARTIST_TOKEN_PREFIX, treat as artist ID directly
      return res.redirect(301, `/api/metadata/artist/${tokenId}`);
    }
  } catch (error) {
    console.error('Error in token metadata router:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Contract-level metadata (for OpenSea)
 * GET /api/metadata/contract
 */
router.get('/contract', async (_req: Request, res: Response) => {
  const metadata = {
    name: "BTF-2300 Artist Token",
    description: "Boostify Music's BTF-2300 standard for tokenizing music artists, songs, catalogs, and licenses on Polygon. Enables fractional ownership and automated royalty distribution.",
    image: `${BASE_URL}/boostify-logo.png`,
    external_link: BASE_URL,
    seller_fee_basis_points: 500, // 5% secondary sale royalty
    fee_recipient: "0xa617cC0998c0bC4bf86301003FF2c172d57B506E"
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.json(metadata);
});

export default router;
