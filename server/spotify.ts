import { Express } from "express";
import { db } from './firebase';
import { getFirestore } from 'firebase-admin/firestore';
import { isAuthenticated, ClerkAuthUser } from './middleware/clerk-auth';

const SPOTIFY_API_URL = "https://api.spotify.com/v1";
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

declare global {
  namespace Express {
    interface User extends ClerkAuthUser {}
  }
}

const PLAN_LIMITS = {
  basic: { playlists: 10, emails: 50 },
  pro: { playlists: 50, emails: 250 },
  enterprise: { playlists: Infinity, emails: Infinity }
};

export function setupSpotifyRoutes(app: Express) {
  // Iniciar flujo de OAuth de Spotify
  app.get("/api/spotify/auth", isAuthenticated, (req, res) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'SPOTIFY_CLIENT_ID not configured' });
    }
    const redirectUri = `${req.protocol}://${req.get("host")}/api/spotify/callback`;
    const scope = "user-read-private user-read-email user-library-read user-follow-read user-top-read";

    const authUrl = `${SPOTIFY_AUTH_URL}?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&show_dialog=true`;
    res.redirect(authUrl);
  });

  // Manejar callback de Spotify OAuth
  app.get("/api/spotify/callback", isAuthenticated, async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("Authorization code not found");

    try {
      // Obtener token de acceso
      const params = new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: `${req.protocol}://${req.get("host")}/api/spotify/callback`,
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET!
      });

      const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to get access token");
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;

      // Obtener datos del usuario autenticado
      const userData = await fetch(`${SPOTIFY_API_URL}/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }).then(res => res.json());

      // Guardar datos en Firestore
      const spotifyDataRef = db.collection('spotify_data').doc(req.user!.clerkUserId);
      await spotifyDataRef.set({
        accessToken,
        refreshToken,
        userId: userData.id,
        displayName: userData.display_name,
        email: userData.email,
        followers: userData.followers.total,
        lastUpdated: new Date(),
        monthlyListeners: 0,
        totalStreams: 0,
        playlistPlacements: 0,
        topTracks: [],
        dailyStats: [{
          date: new Date().toISOString().split('T')[0],
          streams: 0,
          followers: userData.followers.total,
          playlistAdds: 0
        }],
        demographics: {
          countries: [],
          ageRanges: []
        }
      }, { merge: true });

      res.redirect("/spotify");
    } catch (error) {
      console.error("Spotify auth error:", error);
      res.status(500).send("Failed to connect Spotify account");
    }
  });

  // Obtener datos del perfil de Spotify del usuario
  app.get("/api/spotify/profile", isAuthenticated, async (req, res) => {
    try {
      const spotifyDataRef = db.collection('spotify_data').doc(req.user!.clerkUserId);
      const spotifyDoc = await spotifyDataRef.get();

      if (!spotifyDoc.exists || !spotifyDoc.data()?.accessToken) {
        return res.status(400).send("Spotify account not connected");
      }

      const response = await fetch(`${SPOTIFY_API_URL}/me`, {
        headers: { 'Authorization': `Bearer ${spotifyDoc.data()?.accessToken}` }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch Spotify profile");
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching Spotify profile:", error);
      res.status(500).send("Failed to fetch Spotify profile");
    }
  });

  // New route for finding playlists
  app.post("/api/spotify/find-playlists", async (req, res) => {
    if (!req.user?.uid) return res.sendStatus(401);

    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }

      // Get user's subscription data
      const userSubscriptionRef = db.collection('subscriptions').doc(req.user.uid);
      const userSubscriptionDoc = await userSubscriptionRef.get();
      const userPlan = userSubscriptionDoc.data()?.planId || 'basic';
      const limits = PLAN_LIMITS[userPlan];

      // Get current usage
      const usageRef = db.collection('spotify_data').doc(req.user.uid);
      const usageDoc = await usageRef.get();
      const currentUsage = usageDoc.data()?.playlistSearches || 0;

      if (currentUsage >= limits.playlists) {
        return res.status(403).json({
          error: "Plan limit reached",
          limit: limits.playlists,
          current: currentUsage
        });
      }

      // Get Spotify access token
      const spotifyDataRef = db.collection('spotify_data').doc(req.user.uid);
      const spotifyDoc = await spotifyDataRef.get();

      if (!spotifyDoc.exists || !spotifyDoc.data()?.accessToken) {
        return res.status(400).send("Spotify account not connected");
      }

      const accessToken = spotifyDoc.data()?.accessToken;

      // Search for playlists
      const response = await fetch(
        `${SPOTIFY_API_URL}/search?type=playlist&q=${encodeURIComponent(query)}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to search playlists");
      }

      const data = await response.json();

      // Update usage count
      await usageRef.update({
        playlistSearches: currentUsage + 1
      });

      res.json(data.playlists.items);
    } catch (error) {
      console.error("Error searching playlists:", error);
      res.status(500).send("Failed to search playlists");
    }
  });

  // New route for scraping curator emails
  app.post("/api/spotify/scrape-emails", async (req, res) => {
    if (!req.user?.uid) return res.sendStatus(401);

    try {
      // Get user's subscription data
      const userSubscriptionRef = db.collection('subscriptions').doc(req.user.uid);
      const userSubscriptionDoc = await userSubscriptionRef.get();
      const userPlan = userSubscriptionDoc.data()?.planId || 'basic';
      const limits = PLAN_LIMITS[userPlan];

      // Get current usage
      const usageRef = db.collection('spotify_data').doc(req.user.uid);
      const usageDoc = await usageRef.get();
      const currentUsage = usageDoc.data()?.emailScrapes || 0;

      if (currentUsage >= limits.emails) {
        return res.status(403).json({
          error: "Plan limit reached",
          limit: limits.emails,
          current: currentUsage
        });
      }

      // Mock email scraping functionality
      // In a real implementation, you would:
      // 1. Get playlist details
      // 2. Extract curator information
      // 3. Find associated contact information
      const mockEmails = [
        "curator1@example.com",
        "playlist.owner@example.com",
        "music.promoter@example.com"
      ];

      // Update usage count
      await usageRef.update({
        emailScrapes: currentUsage + 1
      });

      res.json(mockEmails);
    } catch (error) {
      console.error("Error scraping emails:", error);
      res.status(500).send("Failed to scrape emails");
    }
  });

  // Backend proxy for Spotify client_credentials token (keeps secret server-side)
  app.post("/api/spotify/client-token", async (_req, res) => {
    try {
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Spotify credentials not configured on server' });
      }
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        },
        body: 'grant_type=client_credentials'
      });
      if (!response.ok) {
        throw new Error('Failed to get client token from Spotify');
      }
      const data = await response.json();
      res.json({ access_token: data.access_token, expires_in: data.expires_in });
    } catch (error) {
      console.error("Error getting client token:", error);
      res.status(500).json({ error: 'Failed to get Spotify token' });
    }
  });
}