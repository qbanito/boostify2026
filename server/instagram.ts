import { Express } from "express";
import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

const INSTAGRAM_API_URL = "https://api.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";

export function setupInstagramRoutes(app: Express) {
  // Initiate Instagram OAuth flow
  app.get("/api/instagram/auth", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const redirectUri = `${req.protocol}://${req.get("host")}/api/instagram/callback`;
    const scope = "user_profile,user_media";
    
    const authUrl = `${INSTAGRAM_API_URL}?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    res.redirect(authUrl);
  });

  // Handle Instagram OAuth callback
  app.get("/api/instagram/callback", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { code } = req.query;
    if (!code) return res.status(400).send("Authorization code not found");

    try {
      const params = new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: `${req.protocol}://${req.get("host")}/api/instagram/callback`,
        code: code as string,
      });

      const response = await fetch(INSTAGRAM_TOKEN_URL, {
        method: "POST",
        body: params,
      });

      if (!response.ok) {
        throw new Error("Failed to get access token");
      }

      const data = await response.json();
      
      // Store the Instagram access token
      await db
        .update(users)
        .set({ instagramToken: data.access_token })
        .where(eq(users.id, req.user.id));

      res.redirect("/dashboard");
    } catch (error) {
      console.error("Instagram auth error:", error);
      res.status(500).send("Failed to connect Instagram account");
    }
  });

  // Get Instagram profile data
  app.get("/api/instagram/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      if (!user?.instagramToken) {
        return res.status(400).send("Instagram account not connected");
      }

      // Here we'll add the logic to fetch Instagram profile data
      // For now, return a placeholder
      res.json({
        followers: 0,
        following: 0,
        posts: 0
      });
    } catch (error) {
      console.error("Error fetching Instagram profile:", error);
      res.status(500).send("Failed to fetch Instagram profile");
    }
  });
}
