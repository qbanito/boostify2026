import { Router, Request, Response } from "express";
import { db } from "../db";
import { musicians } from "../db/schema";
import { eq, ilike, desc, sql } from "drizzle-orm";

const router = Router();

// GET all artists/musicians
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, limit = "50", offset = "0" } = req.query;
    
    let query = db.select().from(musicians);
    
    if (search) {
      query = query.where(ilike(musicians.name, `%${search}%`));
    }
    
    const artists = await query
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string))
      .orderBy(desc(musicians.createdAt));
    
    res.json({ success: true, artists });
  } catch (error) {
    console.error("Error fetching artists:", error);
    res.status(500).json({ error: "Error fetching artists" });
  }
});

// GET total count
router.get("/count", async (req: Request, res: Response) => {
  try {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(musicians);
    const total = result[0]?.count || 0;
    res.json({ success: true, total });
  } catch (error) {
    console.error("Error counting artists:", error);
    res.status(500).json({ error: "Error counting artists" });
  }
});

// GET single artist
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const artist = await db
      .select()
      .from(musicians)
      .where(eq(musicians.id, parseInt(id)))
      .limit(1);
    
    if (!artist.length) {
      return res.status(404).json({ error: "Artist not found" });
    }
    
    res.json({ success: true, artist: artist[0] });
  } catch (error) {
    console.error("Error fetching artist:", error);
    res.status(500).json({ error: "Error fetching artist" });
  }
});

// UPDATE artist
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, price, rating, isActive, genres, category, instrument } = req.body;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (rating !== undefined) updateData.rating = rating;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (genres !== undefined) updateData.genres = genres;
    if (category !== undefined) updateData.category = category;
    if (instrument !== undefined) updateData.instrument = instrument;
    updateData.updatedAt = new Date();
    
    const result = await db
      .update(musicians)
      .set(updateData)
      .where(eq(musicians.id, parseInt(id)))
      .returning();
    
    if (!result.length) {
      return res.status(404).json({ error: "Artist not found" });
    }
    
    res.json({ success: true, artist: result[0] });
  } catch (error) {
    console.error("Error updating artist:", error);
    res.status(500).json({ error: "Error updating artist" });
  }
});

// DELETE artist
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await db
      .delete(musicians)
      .where(eq(musicians.id, parseInt(id)))
      .returning();
    
    if (!result.length) {
      return res.status(404).json({ error: "Artist not found" });
    }
    
    res.json({ success: true, message: "Artist deleted successfully" });
  } catch (error) {
    console.error("Error deleting artist:", error);
    res.status(500).json({ error: "Error deleting artist" });
  }
});

export default router;
