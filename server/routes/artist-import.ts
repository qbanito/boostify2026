import { Router, Request, Response } from "express";
import { parse } from "csv-parse/sync";
import axios from "axios";
import { db } from "../db";
import { musicians, users } from "../db/schema";

const router = Router();

// Interfaz para filas del CSV
interface ArtistCSVRow {
  name: string;
  spotifyId?: string;
  instagramHandle?: string;
  twitterHandle?: string;
  email?: string;
}

/**
 * Obtener token de Spotify para API calls
 */
async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials not configured");
  }

  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
    }
  );

  return response.data.access_token;
}

/**
 * Obtener datos del artista desde Spotify
 */
async function getSpotifyArtistData(spotifyId: string, token: string): Promise<any> {
  try {
    const response = await axios.get(`https://api.spotify.com/v1/artists/${spotifyId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching Spotify data for artist ${spotifyId}:`, error);
    return null;
  }
}

/**
 * Buscar artista en Spotify por nombre
 */
async function searchSpotifyArtist(name: string, token: string): Promise<any> {
  try {
    const response = await axios.get("https://api.spotify.com/v1/search", {
      params: {
        q: name,
        type: "artist",
        limit: 1,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data.artists?.items?.[0] || null;
  } catch (error) {
    console.error(`Error searching Spotify for artist ${name}:`, error);
    return null;
  }
}

/**
 * Trigger webhook de Make.com
 */
async function triggerMakeWebhook(artistData: any): Promise<void> {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.warn("Make webhook URL not configured");
    return;
  }

  try {
    await axios.post(webhookUrl, {
      event: "artist_created",
      data: artistData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error triggering Make webhook:", error);
    // No lanzar error - webhook es secundario
  }
}

/**
 * Importar artistas desde CSV
 */
router.post("/import-csv", async (req: Request, res: Response) => {
  try {
    const { csvContent } = req.body;

    if (!csvContent) {
      return res.status(400).json({ error: "CSV content is required" });
    }

    // Parsear CSV
    const rows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    }) as ArtistCSVRow[];

    if (rows.length === 0) {
      return res.status(400).json({ error: "No data found in CSV" });
    }

    // Obtener token de Spotify una sola vez
    let spotifyToken: string | null = null;
    try {
      spotifyToken = await getSpotifyToken();
    } catch (error) {
      logger.warn("Spotify token not available, proceeding without Spotify data");
    }

    const importedArtists: any[] = [];
    const errors: any[] = [];

    // Procesar cada artista
    for (const row of rows) {
      try {
        const artistData: any = {
          name: row.name,
          email: row.email,
          socialMedia: {
            instagram: row.instagramHandle,
            twitter: row.twitterHandle,
          },
          importedAt: new Date(),
          publishStatus: "draft",
        };

        // Si tenemos Spotify ID o nombre, obtener datos de Spotify
        if (spotifyToken) {
          let spotifyData = null;

          if (row.spotifyId) {
            spotifyData = await getSpotifyArtistData(row.spotifyId, spotifyToken);
          } else if (row.name) {
            spotifyData = await searchSpotifyArtist(row.name, spotifyToken);
          }

          if (spotifyData) {
            artistData.spotifyId = spotifyData.id;
            artistData.spotifyUrl = spotifyData.external_urls?.spotify;
            artistData.spotifyImage = spotifyData.images?.[0]?.url;
            artistData.spotifyGenres = spotifyData.genres;
            artistData.spotifyFollowers = spotifyData.followers?.total;
            artistData.bio = `Artist with ${spotifyData.followers?.total || 0} followers on Spotify`;
            artistData.profileImage = spotifyData.images?.[0]?.url;
          }
        }

        // Guardar en base de datos - tabla musicians
        try {
          const insertedMusician = await db.insert(musicians).values({
            name: row.name,
            photo: artistData.profileImage || "https://via.placeholder.com/200",
            instrument: "Vocalist",
            category: "Artist",
            description: artistData.bio || `Artist: ${row.name}`,
            price: "100.00",
            genres: artistData.spotifyGenres || [],
            isActive: true,
          }).returning();

          if (insertedMusician.length > 0) {
            artistData.dbId = insertedMusician[0].id;
          }
        } catch (dbError) {
          console.warn(`Database insert warning for ${row.name}:`, dbError);
        }

        importedArtists.push(artistData);

        // Trigger webhook de Make para cada artista
        await triggerMakeWebhook(artistData);

      } catch (error) {
        console.error(`Error processing artist ${row.name}:`, error);
        errors.push({
          artist: row.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    res.json({
      success: true,
      imported: importedArtists.length,
      errors: errors.length,
      artists: importedArtists,
      failedArtists: errors,
      message: `${importedArtists.length} artists imported, ${errors.length} errors`,
    });

  } catch (error) {
    console.error("Error importing CSV:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Error importing CSV" 
    });
  }
});

export default router;
