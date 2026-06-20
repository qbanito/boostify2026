import { Express, Request, Response } from 'express';
import { z } from 'zod';
import pg from 'pg';

const { Client } = pg;

// Validation schema for lead capture
const leadCaptureSchema = z.object({
  email: z.string().email("Invalid email format"),
  artistName: z.string().min(1, "Artist name is required").max(100, "Artist name too long"),
  genre: z.string().max(50).optional(),
  source: z.string().max(50).optional()
});

// Supabase connection string
const SUPABASE_URL = process.env.SUPABASE_DATABASE_URL || 
  'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

/**
 * Setup lead capture routes
 */
export function setupLeadRoutes(app: Express) {
  
  /**
   * POST /api/leads/capture
   * Capture a new artist lead from landing page
   * Public endpoint - no authentication required
   */
  app.post('/api/leads/capture', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validationResult = leadCaptureSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.issues
        });
      }
      
      const { email, artistName, genre, source } = validationResult.data;
      
      // Connect to Supabase
      const client = new Client({ connectionString: SUPABASE_URL });
      await client.connect();
      
      try {
        // Check if email already exists in artist_leads
        const existingLead = await client.query(
          'SELECT id, lead_status FROM artist_leads WHERE email = $1',
          [email.toLowerCase()]
        );
        
        if (existingLead.rows.length > 0) {
          const existingStatus = existingLead.rows[0].lead_status;
          
          // If unsubscribed, don't re-add
          if (existingStatus === 'unsubscribed') {
            return res.status(200).json({
              success: true,
              message: "We respect your preferences",
              isExisting: true
            });
          }
          
          // Update existing lead with new info
          await client.query(
            `UPDATE artist_leads 
             SET artist_name = COALESCE($1, artist_name),
                 genre = COALESCE($2, genre),
                 updated_at = NOW()
             WHERE email = $3`,
            [artistName, genre || null, email.toLowerCase()]
          );
          
          return res.status(200).json({
            success: true,
            message: "Welcome back! Redirecting...",
            isExisting: true,
            leadId: existingLead.rows[0].id
          });
        }
        
        // Insert new lead
        const insertResult = await client.query(
          `INSERT INTO artist_leads (email, name, artist_name, genre, lead_status, created_at, source)
           VALUES ($1, $2, $3, $4, 'new', NOW(), $5)
           RETURNING id`,
          [
            email.toLowerCase(),
            artistName, // Use artist name as name initially
            artistName,
            genre || null,
            source || 'my-artists-landing'
          ]
        );
        
        const newLeadId = insertResult.rows[0]?.id;
        
        console.log(`[Lead Capture] New lead captured: ${email} (${artistName}) - ID: ${newLeadId}`);
        
        return res.status(201).json({
          success: true,
          message: "You're in! Creating your page...",
          leadId: newLeadId,
          isNew: true
        });
        
      } finally {
        await client.end();
      }
      
    } catch (error: any) {
      console.error('[Lead Capture] Error:', error);
      
      // If it's a duplicate key error, handle gracefully
      if (error.code === '23505') {
        return res.status(200).json({
          success: true,
          message: "Welcome back!",
          isExisting: true
        });
      }
      
      return res.status(500).json({
        success: false,
        error: "Failed to capture lead",
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * GET /api/leads/check/:email
   * Check if an email is already registered as a lead
   * Public endpoint
   */
  app.get('/api/leads/check/:email', async (req: Request, res: Response) => {
    try {
      const email = req.params.email;
      
      if (!email || !z.string().email().safeParse(email).success) {
        return res.status(400).json({
          success: false,
          error: "Invalid email"
        });
      }
      
      const client = new Client({ connectionString: SUPABASE_URL });
      await client.connect();
      
      try {
        const result = await client.query(
          'SELECT id, lead_status FROM artist_leads WHERE email = $1',
          [email.toLowerCase()]
        );
        
        return res.json({
          success: true,
          exists: result.rows.length > 0,
          status: result.rows[0]?.lead_status || null
        });
        
      } finally {
        await client.end();
      }
      
    } catch (error: any) {
      console.error('[Lead Check] Error:', error);
      return res.status(500).json({
        success: false,
        error: "Failed to check lead"
      });
    }
  });

  console.log('[Leads] Lead capture routes registered');
}
