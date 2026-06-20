/**
 * OpenAI Agents SDK - Database Tools
 * Tools that query PostgreSQL for artist, songs, merch, analytics data.
 * Each tool returns JSON strings with try/catch for safe DB access.
 */
import { tool } from "@openai/agents";
import { z } from "zod";
import { db } from "../db";
import { users, songs, merchandise, subscriptions } from "../../db/schema";
import { eq, desc, and } from "drizzle-orm";

function safeJSON(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return JSON.stringify({ error: "Failed to serialize result" });
  }
}

export const getArtistProfile = tool({
  name: "getArtistProfile",
  description: "Get the full profile of an artist by their user ID. Returns name, genre, social links, bio, etc.",
  parameters: z.object({
    artistId: z.number().describe("The artist's user ID in the database"),
  }),
  execute: async ({ artistId }) => {
    try {
      const [artist] = await db
        .select({
          id: users.id,
          artistName: users.artistName,
          realName: users.realName,
          genre: users.genre,
          genres: users.genres,
          biography: users.biography,
          location: users.location,
          country: users.country,
          spotifyUrl: users.spotifyUrl,
          instagramHandle: users.instagramHandle,
          youtubeChannel: users.youtubeChannel,
          tiktokUrl: users.tiktokUrl,
          website: users.website,
        })
        .from(users)
        .where(eq(users.id, artistId))
        .limit(1);

      if (!artist) return safeJSON({ error: "Artist not found" });
      return safeJSON(artist);
    } catch (e: any) {
      return safeJSON({ error: "DB query failed", detail: e.message });
    }
  },
});

export const getArtistSongs = tool({
  name: "getArtistSongs",
  description: "Get songs for an artist. Returns title, genre, mood, plays, release date, whether it was AI-generated.",
  parameters: z.object({
    artistId: z.number().describe("The artist's user ID"),
    limit: z.number().optional().describe("Max songs to return (default 20)"),
  }),
  execute: async ({ artistId, limit }) => {
    try {
      const results = await db
        .select({
          id: songs.id,
          title: songs.title,
          genre: songs.genre,
          mood: songs.mood,
          plays: songs.plays,
          releaseDate: songs.releaseDate,
          generatedWithAI: songs.generatedWithAI,
          duration: songs.duration,
        })
        .from(songs)
        .where(eq(songs.userId, artistId))
        .orderBy(desc(songs.createdAt))
        .limit(limit ?? 20);

      return safeJSON({ count: results.length, songs: results });
    } catch (e: any) {
      return safeJSON({ error: "DB query failed", detail: e.message });
    }
  },
});

export const getArtistMerch = tool({
  name: "getArtistMerch",
  description: "Get merchandise listings for an artist. Returns name, price, category, stock, availability.",
  parameters: z.object({
    artistId: z.number().describe("The artist's user ID"),
  }),
  execute: async ({ artistId }) => {
    try {
      const results = await db
        .select({
          id: merchandise.id,
          name: merchandise.name,
          description: merchandise.description,
          price: merchandise.price,
          category: merchandise.category,
          stock: merchandise.stock,
          isAvailable: merchandise.isAvailable,
        })
        .from(merchandise)
        .where(eq(merchandise.userId, artistId));

      return safeJSON({ count: results.length, merchandise: results });
    } catch (e: any) {
      return safeJSON({ error: "DB query failed", detail: e.message });
    }
  },
});

export const getSubscriptionInfo = tool({
  name: "getSubscriptionInfo",
  description: "Get the current subscription plan and usage limits for a user.",
  parameters: z.object({
    userId: z.number().describe("The user ID"),
  }),
  execute: async ({ userId }) => {
    try {
      const [sub] = await db
        .select({
          plan: subscriptions.plan,
          status: subscriptions.status,
          videosLimit: subscriptions.videosLimit,
          videosUsed: subscriptions.videosUsed,
          songsLimit: subscriptions.songsLimit,
          songsUsed: subscriptions.songsUsed,
          aiGenerationLimit: subscriptions.aiGenerationLimit,
          aiGenerationUsed: subscriptions.aiGenerationUsed,
        })
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
        .limit(1);

      if (!sub) return safeJSON({ plan: "free", status: "none" });
      return safeJSON(sub);
    } catch (e: any) {
      return safeJSON({ error: "DB query failed", detail: e.message });
    }
  },
});

export const getUserArtists = tool({
  name: "getUserArtists",
  description: "Get all AI-generated artists owned by a user. Use this when the user wants to know about their artists.",
  parameters: z.object({
    userId: z.number().describe("The owner user ID"),
  }),
  execute: async ({ userId }) => {
    try {
      const results = await db
        .select({
          id: users.id,
          artistName: users.artistName,
          genre: users.genre,
          genres: users.genres,
          isAIGenerated: users.isAIGenerated,
        })
        .from(users)
        .where(eq(users.generatedBy, userId));

      return safeJSON({ count: results.length, artists: results });
    } catch (e: any) {
      return safeJSON({ error: "DB query failed", detail: e.message });
    }
  },
});
