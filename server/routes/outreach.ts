/**
 * Outreach API Routes
 * Handles music industry contacts, templates, campaigns and email sending
 */

import { Request, Response, Express } from 'express';
import { db } from '@db';
import { 
  musicIndustryContacts, 
  outreachTemplates, 
  outreachCampaigns, 
  outreachEmailLog,
  outreachDailyQuota,
  users
} from '@db/schema';
import { eq, and, or, ilike, desc, asc, sql, inArray, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { 
  sendOutreachEmail, 
  replaceTemplateVariables,
  getDefaultArtistIntroTemplate,
  getSyncOpportunityTemplate,
  getFollowUpTemplate
} from '../services/outreach-email-service';
import { isAuthenticated } from '../middleware/clerk-auth';

// Daily email limit
const DEFAULT_DAILY_LIMIT = 20;

// Base URL for artist landing pages
const BASE_URL = process.env.BASE_URL || 'https://boostifymusic.com';

/**
 * Resolve the authenticated user's numeric Postgres id from the request.
 * clerkAuthMiddleware normally resolves req.user.id to the integer pg id; we
 * fall back to a clerkId lookup if only the Clerk string is present. Returns
 * null when the user cannot be resolved so callers can respond with 401.
 * NEVER trust a client-supplied userId for quota/sending/ownership.
 */
async function resolveOutreachUserId(req: Request): Promise<number | null> {
  const u = (req as any).user;
  if (!u) return null;
  if (typeof u.id === 'number' && Number.isFinite(u.id)) return u.id;
  const asNum = parseInt(String(u.id), 10);
  if (Number.isFinite(asNum) && String(asNum) === String(u.id)) return asNum;
  const clerkId = u.clerkUserId || u.uid || u.id;
  if (clerkId) {
    try {
      const [dbUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, String(clerkId)))
        .limit(1);
      if (dbUser) return dbUser.id;
    } catch { /* ignore — fall through to null */ }
  }
  return null;
}

/**
 * Generate a beautiful HTML email template for a specific artist
 * This creates a professional email that mirrors the artist's landing page
 */
function generateArtistEmailTemplate(artist: {
  name: string;
  slug: string;
  biography?: string | null;
  profileImage?: string | null;
  coverImage?: string | null;
  genres?: string[] | null;
  country?: string | null;
  instagram?: string | null;
  spotify?: string | null;
  youtube?: string | null;
}): { subject: string; bodyHtml: string; bodyText: string } {
  
  const landingUrl = `${BASE_URL}/artist/${artist.slug}`;
  const genreText = artist.genres?.join(' / ') || 'Music';
  const bio = artist.biography || `${artist.name} is an exciting artist making waves in the music industry.`;
  const shortBio = bio.length > 200 ? bio.substring(0, 200) + '...' : bio;
  
  // Use profile image or a default gradient placeholder
  const artistImage = artist.profileImage || artist.coverImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&size=300&background=8B5CF6&color=fff&bold=true`;
  const coverImage = artist.coverImage || artist.profileImage || '';
  
  return {
    subject: `🎵 Meet ${artist.name} - ${genreText} Artist Ready for Industry Opportunities`,
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 25px 80px rgba(139, 92, 246, 0.15);">
          
          <!-- Hero Banner with Artist Cover -->
          <tr>
            <td style="position: relative;">
              ${coverImage ? `
              <div style="height: 200px; background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(15,15,26,1) 100%), url('${coverImage}') center/cover no-repeat; background-size: cover;">
              </div>
              ` : `
              <div style="height: 200px; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #F59E0B 100%);">
              </div>
              `}
            </td>
          </tr>
          
          <!-- Artist Profile Section -->
          <tr>
            <td style="padding: 0 40px; margin-top: -80px; position: relative;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding-top: 0;">
                    <!-- Artist Photo -->
                    <div style="margin-top: -80px; position: relative; z-index: 10;">
                      <img src="${artistImage}" alt="${artist.name}" 
                           style="width: 140px; height: 140px; border-radius: 50%; border: 4px solid #8B5CF6; object-fit: cover; box-shadow: 0 10px 40px rgba(139, 92, 246, 0.4);">
                    </div>
                    
                    <!-- Artist Name & Genre -->
                    <h1 style="margin: 20px 0 8px 0; color: #ffffff; font-size: 32px; font-weight: bold; text-align: center;">
                      ${artist.name}
                    </h1>
                    <div style="color: #EC4899; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; text-align: center;">
                      ${genreText}
                    </div>
                    ${artist.country ? `
                    <div style="color: #9ca3af; font-size: 13px; margin-top: 8px; text-align: center;">
                      📍 ${artist.country}
                    </div>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Greeting & Bio -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi {{contact_name}},
              </p>
              
              <p style="color: #ffffff; font-size: 16px; line-height: 1.7; margin: 0 0 25px 0;">
                I wanted to personally introduce you to <strong style="color: #EC4899;">${artist.name}</strong>, an exceptional ${genreText.toLowerCase()} artist who I believe would be a perfect fit for ${artist.country ? `your projects involving ${artist.country} talent` : 'your roster'}.
              </p>
              
              <!-- Bio Card -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: rgba(139, 92, 246, 0.08); border-radius: 16px; border-left: 4px solid #8B5CF6;">
                <tr>
                  <td style="padding: 25px;">
                    <div style="color: #8B5CF6; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; font-weight: 600;">
                      About the Artist
                    </div>
                    <p style="color: #e5e5e5; font-size: 15px; line-height: 1.7; margin: 0;">
                      ${shortBio}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Stats / Social Proof -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  ${artist.spotify ? `
                  <td width="33%" align="center" style="padding: 15px;">
                    <div style="background: rgba(30, 215, 96, 0.1); border-radius: 12px; padding: 20px;">
                      <div style="font-size: 24px;">🎧</div>
                      <div style="color: #1DB954; font-size: 12px; font-weight: 600; margin-top: 8px;">SPOTIFY</div>
                    </div>
                  </td>
                  ` : ''}
                  ${artist.instagram ? `
                  <td width="33%" align="center" style="padding: 15px;">
                    <div style="background: rgba(225, 48, 108, 0.1); border-radius: 12px; padding: 20px;">
                      <div style="font-size: 24px;">📸</div>
                      <div style="color: #E1306C; font-size: 12px; font-weight: 600; margin-top: 8px;">INSTAGRAM</div>
                    </div>
                  </td>
                  ` : ''}
                  ${artist.youtube ? `
                  <td width="33%" align="center" style="padding: 15px;">
                    <div style="background: rgba(255, 0, 0, 0.1); border-radius: 12px; padding: 20px;">
                      <div style="font-size: 24px;">▶️</div>
                      <div style="color: #FF0000; font-size: 12px; font-weight: 600; margin-top: 8px;">YOUTUBE</div>
                    </div>
                  </td>
                  ` : ''}
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 40px 40px;" align="center">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background: linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%); border-radius: 12px; box-shadow: 0 8px 30px rgba(139, 92, 246, 0.4);">
                    <a href="${landingUrl}" target="_blank" 
                       style="display: inline-block; padding: 18px 48px; color: white; text-decoration: none; font-weight: bold; font-size: 16px; letter-spacing: 0.5px;">
                      🎵 View Full Artist Profile →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
                Listen to music, view photos, and connect directly
              </p>
            </td>
          </tr>
          
          <!-- What We Offer -->
          <tr>
            <td style="padding: 30px 40px; background: rgba(255,255,255,0.02); border-top: 1px solid rgba(255,255,255,0.05);">
              <div style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px;">
                What We're Looking For
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="50%" style="padding: 8px 0;">
                    <span style="color: #10b981;">✓</span>
                    <span style="color: #e5e5e5; font-size: 14px; margin-left: 8px;">Sync Licensing</span>
                  </td>
                  <td width="50%" style="padding: 8px 0;">
                    <span style="color: #10b981;">✓</span>
                    <span style="color: #e5e5e5; font-size: 14px; margin-left: 8px;">Label Partnerships</span>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 8px 0;">
                    <span style="color: #10b981;">✓</span>
                    <span style="color: #e5e5e5; font-size: 14px; margin-left: 8px;">Playlist Placements</span>
                  </td>
                  <td width="50%" style="padding: 8px 0;">
                    <span style="color: #10b981;">✓</span>
                    <span style="color: #e5e5e5; font-size: 14px; margin-left: 8px;">Brand Collaborations</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Signature -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">
                I'd love to discuss how ${artist.name} could be a great fit for your projects. Feel free to reply directly or visit the profile to learn more.
              </p>
              <p style="color: #a0a0a0; font-size: 14px; margin: 0;">
                Best regards,<br>
                <strong style="color: #ffffff;">{{sender_name}}</strong><br>
                <span style="color: #8B5CF6;">Boostify Music</span>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #0a0a0f; padding: 25px 40px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05);">
              <img src="https://boostifymusic.com/logo-white.png" alt="Boostify Music" style="height: 24px; margin-bottom: 15px; opacity: 0.7;" onerror="this.style.display='none'">
              <p style="color: #4b5563; font-size: 12px; margin: 0 0 10px 0;">
                © 2026 Boostify Music. Empowering independent artists worldwide.
              </p>
              <a href="{{unsubscribe_url}}" style="color: #6b7280; text-decoration: underline; font-size: 11px;">
                Unsubscribe from future emails
              </a>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    bodyText: `
Hi {{contact_name}},

I wanted to personally introduce you to ${artist.name}, an exceptional ${genreText.toLowerCase()} artist.

${shortBio}

View the full artist profile: ${landingUrl}

What we're looking for:
- Sync Licensing opportunities
- Label Partnerships  
- Playlist Placements
- Brand Collaborations

I'd love to discuss how ${artist.name} could be a great fit for your projects.

Best regards,
{{sender_name}}
Boostify Music

---
Unsubscribe: {{unsubscribe_url}}
    `
  };
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check and get remaining quota for user
 */
async function getRemainingQuota(userId: number): Promise<{ remaining: number; sent: number; limit: number }> {
  const today = getTodayDate();
  
  const [quota] = await db
    .select()
    .from(outreachDailyQuota)
    .where(and(
      eq(outreachDailyQuota.userId, userId),
      eq(outreachDailyQuota.date, today)
    ));
  
  if (!quota) {
    return { remaining: DEFAULT_DAILY_LIMIT, sent: 0, limit: DEFAULT_DAILY_LIMIT };
  }
  
  return { 
    remaining: Math.max(0, quota.dailyLimit - quota.emailsSent), 
    sent: quota.emailsSent,
    limit: quota.dailyLimit
  };
}

/**
 * Increment daily quota usage
 */
async function incrementQuota(userId: number): Promise<void> {
  const today = getTodayDate();
  
  const [existing] = await db
    .select()
    .from(outreachDailyQuota)
    .where(and(
      eq(outreachDailyQuota.userId, userId),
      eq(outreachDailyQuota.date, today)
    ));
  
  if (existing) {
    await db
      .update(outreachDailyQuota)
      .set({ emailsSent: existing.emailsSent + 1 })
      .where(eq(outreachDailyQuota.id, existing.id));
  } else {
    await db.insert(outreachDailyQuota).values({
      userId,
      date: today,
      emailsSent: 1,
      dailyLimit: DEFAULT_DAILY_LIMIT
    });
  }
}

// CSV Parser helper functions
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n');
  if (lines.length < 2) return [];
  
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  const records: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const record: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    records.push(record);
  }
  
  return records;
}

function determineCategory(record: Record<string, string>): string {
  const industry = (record.industry || '').toLowerCase();
  const keywords = (record.keywords || '').toLowerCase();
  const companyName = (record.company_name || '').toLowerCase();
  const description = (record.company_description || '').toLowerCase();
  
  const combined = `${industry} ${keywords} ${companyName} ${description}`;
  
  if (combined.includes('record label') || combined.includes('warner') || combined.includes('universal') || combined.includes('sony music') || combined.includes('atlantic') || combined.includes('elektra')) {
    return 'record_label';
  }
  if (combined.includes('publishing') || combined.includes('ascap') || combined.includes('bmi') || combined.includes('sesac') || combined.includes('songwriter')) {
    return 'publishing';
  }
  if (combined.includes('sync') || combined.includes('licensing') || combined.includes('film') || combined.includes('tv') || combined.includes('advertising') || combined.includes('commercial')) {
    return 'sync';
  }
  if (combined.includes('management') || combined.includes('manager') || combined.includes('talent')) {
    return 'management';
  }
  if (combined.includes('booking') || combined.includes('agent') || combined.includes('tour') || combined.includes('live')) {
    return 'booking';
  }
  if (combined.includes('pr') || combined.includes('public relation') || combined.includes('publicity') || combined.includes('press')) {
    return 'pr';
  }
  if (combined.includes('streaming') || combined.includes('spotify') || combined.includes('apple music') || combined.includes('deezer') || combined.includes('beatport')) {
    return 'streaming';
  }
  if (combined.includes('playlist') || combined.includes('curator')) {
    return 'playlist';
  }
  if (combined.includes('radio') || combined.includes('dj') || combined.includes('broadcast')) {
    return 'radio';
  }
  if (combined.includes('blog') || combined.includes('magazine') || combined.includes('media') || combined.includes('journalist') || combined.includes('press')) {
    return 'media';
  }
  if (combined.includes('distribution') || combined.includes('distributor') || combined.includes('tunecore') || combined.includes('distrokid')) {
    return 'distribution';
  }
  
  return 'other';
}

export function setupOutreachRoutes(app: Express) {
  
  // ============================================================================
  // INDUSTRY CONTACTS ENDPOINTS
  // ============================================================================
  
  /**
   * POST /api/outreach/contacts/import-from-csv - Import contacts from CSV file
   */
  app.post('/api/outreach/contacts/import-from-csv', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { filePath } = req.body;
      const fs = await import('fs');
      const path = await import('path');
      
      // Default to known CSV location if not specified
      const csvPath = filePath || 'C:\\Users\\convo\\Downloads\\dataset_leads-finder_2026-02-01_01-23-10-745.csv';
      
      if (!fs.existsSync(csvPath)) {
        return res.status(400).json({ error: `CSV file not found: ${csvPath}` });
      }
      
      console.log(`📥 Starting import from: ${csvPath}`);
      
      const content = fs.readFileSync(csvPath, 'utf-8');
      const records = parseCSV(content);
      
      console.log(`📊 Parsed ${records.length} records from CSV`);
      
      let imported = 0;
      let skipped = 0;
      let errors = 0;
      const batchSize = 50;
      
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        for (const record of batch) {
          try {
            const email = record.email || record.Email || '';
            const fullName = record.full_name || record.name || record.Name || '';
            
            if (!email || !fullName) {
              skipped++;
              continue;
            }
            
            // Check if email already exists
            const existing = await db
              .select({ id: musicIndustryContacts.id })
              .from(musicIndustryContacts)
              .where(eq(musicIndustryContacts.email, email.toLowerCase()))
              .limit(1);
            
            if (existing.length > 0) {
              skipped++;
              continue;
            }
            
            const category = determineCategory(record);
            
            await db.insert(musicIndustryContacts).values({
              fullName,
              email: email.toLowerCase(),
              companyName: record.company_name || record.organization || null,
              jobTitle: record.title || record.job_title || null,
              linkedinUrl: record.linkedin_url || record.profile_url || null,
              industry: record.industry || null,
              seniorityLevel: record.seniority_level || record.seniority || null,
              department: record.department || null,
              city: record.city || null,
              state: record.state || null,
              country: record.country || null,
              companySize: record.company_size || record.employees || null,
              companyWebsite: record.company_website || record.website || null,
              companyDescription: record.company_description || null,
              category,
              keywords: record.keywords || null,
              source: 'csv_import',
              sourceDetails: path.basename(csvPath),
              status: 'new'
            });
            
            imported++;
          } catch (err: any) {
            errors++;
            if (errors < 5) {
              console.error(`Error importing record:`, err.message);
            }
          }
        }
        
        console.log(`✅ Progress: ${Math.min(i + batchSize, records.length)}/${records.length} processed`);
      }
      
      console.log(`
🎉 Import Complete!
   ✅ Imported: ${imported}
   ⏭️ Skipped: ${skipped}
   ❌ Errors: ${errors}
      `);
      
      res.json({
        success: true,
        imported,
        skipped,
        errors,
        total: records.length
      });
    } catch (error: any) {
      console.error('Error importing contacts:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/outreach/contacts - List industry contacts with filters
   */
  app.get('/api/outreach/contacts', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { 
        page = '1', 
        limit = '50',
        search,
        category,
        industry,
        seniority,
        country,
        status
      } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100);
      const offset = (pageNum - 1) * limitNum;
      
      let query = db.select().from(musicIndustryContacts);
      
      // Build WHERE conditions
      const conditions = [];
      
      if (search) {
        const searchTerm = `%${search}%`;
        conditions.push(or(
          ilike(musicIndustryContacts.fullName, searchTerm),
          ilike(musicIndustryContacts.companyName, searchTerm),
          ilike(musicIndustryContacts.email, searchTerm),
          ilike(musicIndustryContacts.keywords, searchTerm)
        ));
      }
      
      if (category && category !== 'all') {
        conditions.push(eq(musicIndustryContacts.category, category as string));
      }
      
      if (industry && industry !== 'all') {
        conditions.push(ilike(musicIndustryContacts.industry, `%${industry}%`));
      }
      
      if (seniority && seniority !== 'all') {
        conditions.push(eq(musicIndustryContacts.seniorityLevel, seniority as string));
      }
      
      if (country && country !== 'all') {
        conditions.push(eq(musicIndustryContacts.country, country as string));
      }
      
      if (status && status !== 'all') {
        conditions.push(eq(musicIndustryContacts.status, status as string));
      }
      
      // Count total
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(musicIndustryContacts)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      // Get paginated results
      const contacts = await db
        .select()
        .from(musicIndustryContacts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(musicIndustryContacts.createdAt))
        .limit(limitNum)
        .offset(offset);
      
      res.json({
        contacts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult.count,
          totalPages: Math.ceil(countResult.count / limitNum)
        }
      });
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/outreach/contacts/stats - Get contact statistics
   */
  app.get('/api/outreach/contacts/stats', isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(musicIndustryContacts);
      
      // Get counts by category
      const categoryStats = await db
        .select({
          category: musicIndustryContacts.category,
          count: sql<number>`count(*)`
        })
        .from(musicIndustryContacts)
        .groupBy(musicIndustryContacts.category);
      
      // Get counts by status
      const statusStats = await db
        .select({
          status: musicIndustryContacts.status,
          count: sql<number>`count(*)`
        })
        .from(musicIndustryContacts)
        .groupBy(musicIndustryContacts.status);
      
      // Get counts by country (top 10)
      const countryStats = await db
        .select({
          country: musicIndustryContacts.country,
          count: sql<number>`count(*)`
        })
        .from(musicIndustryContacts)
        .where(sql`${musicIndustryContacts.country} IS NOT NULL`)
        .groupBy(musicIndustryContacts.country)
        .orderBy(desc(sql`count(*)`))
        .limit(10);
      
      res.json({
        total: totalResult.count,
        byCategory: categoryStats,
        byStatus: statusStats,
        byCountry: countryStats
      });
    } catch (error: any) {
      console.error('Error fetching contact stats:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/outreach/contacts/filters - Get available filter options
   */
  app.get('/api/outreach/contacts/filters', isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const categories = await db
        .selectDistinct({ category: musicIndustryContacts.category })
        .from(musicIndustryContacts)
        .where(sql`${musicIndustryContacts.category} IS NOT NULL`);
      
      const industries = await db
        .selectDistinct({ industry: musicIndustryContacts.industry })
        .from(musicIndustryContacts)
        .where(sql`${musicIndustryContacts.industry} IS NOT NULL`)
        .limit(50);
      
      const seniorityLevels = await db
        .selectDistinct({ seniority: musicIndustryContacts.seniorityLevel })
        .from(musicIndustryContacts)
        .where(sql`${musicIndustryContacts.seniorityLevel} IS NOT NULL`);
      
      const countries = await db
        .selectDistinct({ country: musicIndustryContacts.country })
        .from(musicIndustryContacts)
        .where(sql`${musicIndustryContacts.country} IS NOT NULL`);
      
      res.json({
        categories: categories.map(c => c.category).filter(Boolean),
        industries: industries.map(i => i.industry).filter(Boolean),
        seniorityLevels: seniorityLevels.map(s => s.seniority).filter(Boolean),
        countries: countries.map(c => c.country).filter(Boolean)
      });
    } catch (error: any) {
      console.error('Error fetching filters:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * PATCH /api/outreach/contacts/:id/status - Update contact status
   */
  app.patch('/api/outreach/contacts/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const [updated] = await db
        .update(musicIndustryContacts)
        .set({ status, updatedAt: new Date() })
        .where(eq(musicIndustryContacts.id, parseInt(id)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating contact:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================================================================
  // ARTIST EMAIL TEMPLATE ENDPOINTS
  // ============================================================================
  
  /**
   * GET /api/outreach/artist-template/:artistId - Generate email template for a specific artist
   * Returns the HTML template with artist data embedded
   */
  app.get('/api/outreach/artist-template/:artistId', async (req: Request, res: Response) => {
    try {
      const { artistId } = req.params;
      
      // Fetch artist from database
      const [artist] = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(artistId)))
        .limit(1);
      
      if (!artist) {
        return res.status(404).json({ error: 'Artist not found' });
      }
      
      // Generate personalized template
      const template = generateArtistEmailTemplate({
        name: artist.artistName || artist.username || 'Artist',
        slug: artist.slug || `artist-${artist.id}`,
        biography: artist.biography,
        profileImage: artist.profileImage,
        coverImage: artist.coverImage,
        genres: artist.genres,
        country: artist.country,
        instagram: artist.instagramHandle,
        spotify: artist.spotifyUrl,
        youtube: artist.youtubeChannel
      });
      
      res.json({
        artistId: artist.id,
        artistName: artist.artistName,
        template
      });
    } catch (error: any) {
      console.error('Error generating artist template:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/outreach/artist-preview/:artistId - Preview email for artist (rendered HTML)
   * Shows the actual email as it would appear in inbox
   */
  app.get('/api/outreach/artist-preview/:artistId', async (req: Request, res: Response) => {
    try {
      const { artistId } = req.params;
      const { contactName } = req.query;
      
      // Fetch artist from database
      const [artist] = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(artistId)))
        .limit(1);
      
      if (!artist) {
        return res.status(404).send('<h1>Artist not found</h1>');
      }
      
      // Generate personalized template
      const template = generateArtistEmailTemplate({
        name: artist.artistName || artist.username || 'Artist',
        slug: artist.slug || `artist-${artist.id}`,
        biography: artist.biography,
        profileImage: artist.profileImage,
        coverImage: artist.coverImage,
        genres: artist.genres,
        country: artist.country,
        instagram: artist.instagramHandle,
        spotify: artist.spotifyUrl,
        youtube: artist.youtubeChannel
      });
      
      // Replace variables with sample/provided data
      const variables = {
        contact_name: (contactName as string) || 'John Smith',
        sender_name: 'Boostify Music Team',
        unsubscribe_url: `${BASE_URL}/unsubscribe?id=preview`
      };
      
      const renderedHtml = replaceTemplateVariables(template.bodyHtml, variables);
      const renderedSubject = replaceTemplateVariables(template.subject, variables);
      
      // Create preview page with toolbar
      const previewPage = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Preview: ${artist.artistName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111; }
    .preview-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
      border-bottom: 1px solid rgba(139, 92, 246, 0.3);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      font-family: system-ui, sans-serif;
    }
    .preview-toolbar .info h2 {
      color: #fff;
      font-size: 18px;
      margin-bottom: 4px;
    }
    .preview-toolbar .info .subject {
      color: #9ca3af;
      font-size: 14px;
    }
    .preview-toolbar .info .subject strong {
      color: #8B5CF6;
    }
    .preview-toolbar .actions {
      display: flex;
      gap: 12px;
    }
    .preview-toolbar a, .preview-toolbar button {
      background: rgba(139, 92, 246, 0.1);
      border: 1px solid rgba(139, 92, 246, 0.3);
      color: #8B5CF6;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .preview-toolbar a:hover, .preview-toolbar button:hover {
      background: #8B5CF6;
      color: white;
    }
    .preview-toolbar .back-btn {
      background: transparent;
      border-color: #4b5563;
      color: #9ca3af;
    }
    .email-frame {
      max-width: 700px;
      margin: 0 auto;
      background: #0a0a0a;
    }
  </style>
</head>
<body>
  <div class="preview-toolbar">
    <div class="info">
      <h2>📧 ${artist.artistName} - Email Preview</h2>
      <div class="subject"><strong>Subject:</strong> ${renderedSubject}</div>
    </div>
    <div class="actions">
      <a href="/contacts" class="back-btn">← Back to Contacts</a>
      <a href="/artist/${artist.slug}" target="_blank">View Landing Page</a>
    </div>
  </div>
  <div class="email-frame">
    ${renderedHtml}
  </div>
</body>
</html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(previewPage);
    } catch (error: any) {
      console.error('Error previewing artist email:', error);
      res.status(500).send('<h1>Error generating preview</h1>');
    }
  });
  
  /**
   * GET /api/outreach/my-artists - Get all artists belonging to current user for email templates
   */
  app.get('/api/outreach/my-artists', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await resolveOutreachUserId(req);
      if (userId === null) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Get user's own profile if they're an artist, plus any AI-generated artists
      const { or } = await import('drizzle-orm');
      
      const artists = await db
        .select({
          id: users.id,
          name: users.artistName,
          slug: users.slug,
          profileImage: users.profileImage,
          coverImage: users.coverImage,
          genres: users.genres,
          country: users.country,
          isAIGenerated: users.isAIGenerated,
          bio: users.biography
        })
        .from(users)
        .where(
          or(
            eq(users.id, userId),
            eq(users.generatedBy, userId)
          )
        )
        .orderBy(desc(users.createdAt));
      
      res.json(artists);
    } catch (error: any) {
      console.error('Error fetching my artists:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================================================================
  // TEMPLATES ENDPOINTS
  // ============================================================================
  
  /**
   * GET /api/outreach/templates - List all templates
   */
  app.get('/api/outreach/templates', async (req: Request, res: Response) => {
    try {
      const templates = await db
        .select()
        .from(outreachTemplates)
        .where(eq(outreachTemplates.isActive, true))
        .orderBy(desc(outreachTemplates.createdAt));
      
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/outreach/templates/defaults - Get default templates
   */
  app.get('/api/outreach/templates/defaults', async (_req: Request, res: Response) => {
    try {
      res.json({
        artist_intro: getDefaultArtistIntroTemplate(),
        sync_opportunity: getSyncOpportunityTemplate(),
        follow_up: getFollowUpTemplate()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/outreach/templates/preview/:type - Preview email template with sample data
   * Returns rendered HTML for viewing in browser
   */
  app.get('/api/outreach/templates/preview/:type', async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      
      // Sample data for preview
      const sampleData = {
        contact_name: 'John Smith',
        company_name: 'Warner Music Group',
        artist_name: 'Luna Eclipse',
        genre: 'Electronic / Synthwave',
        artist_bio: 'Luna Eclipse is a rising electronic artist from Los Angeles, blending nostalgic synthwave melodies with modern production techniques. With over 500K monthly Spotify listeners and placements in Netflix series, Luna Eclipse is ready for the next level.',
        sender_name: 'Boostify Music Team',
        landing_url: 'https://boostifymusic.com/artist/luna-eclipse',
        unsubscribe_url: 'https://boostifymusic.com/unsubscribe?id=preview'
      };
      
      let template;
      switch (type) {
        case 'artist_intro':
          template = getDefaultArtistIntroTemplate();
          break;
        case 'sync_opportunity':
          template = getSyncOpportunityTemplate();
          break;
        case 'follow_up':
          template = getFollowUpTemplate();
          break;
        default:
          return res.status(400).json({ error: 'Invalid template type. Use: artist_intro, sync_opportunity, follow_up' });
      }
      
      // Replace variables in the template
      const renderedHtml = replaceTemplateVariables(template.bodyHtml, sampleData);
      const renderedSubject = replaceTemplateVariables(template.subject, sampleData);
      
      // Return full HTML page with subject shown
      const fullPage = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Preview: ${renderedSubject}</title>
  <style>
    body { margin: 0; padding: 0; }
    .preview-bar { 
      background: #1f2937; 
      padding: 15px 20px; 
      color: white; 
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    .preview-bar h3 { margin: 0; font-size: 14px; color: #9ca3af; }
    .preview-bar .subject { font-size: 16px; color: #f9fafb; margin-top: 4px; }
    .preview-bar .nav { display: flex; gap: 10px; }
    .preview-bar a { 
      color: #8B5CF6; 
      text-decoration: none; 
      padding: 8px 16px; 
      background: rgba(139, 92, 246, 0.1); 
      border-radius: 6px;
      font-size: 13px;
      transition: background 0.2s;
    }
    .preview-bar a:hover { background: rgba(139, 92, 246, 0.2); }
    .preview-bar a.active { background: #8B5CF6; color: white; }
  </style>
</head>
<body>
  <div class="preview-bar">
    <div>
      <h3>📧 Email Template Preview</h3>
      <div class="subject"><strong>Subject:</strong> ${renderedSubject}</div>
    </div>
    <div class="nav">
      <a href="/api/outreach/templates/preview/artist_intro" ${type === 'artist_intro' ? 'class="active"' : ''}>Artist Intro</a>
      <a href="/api/outreach/templates/preview/sync_opportunity" ${type === 'sync_opportunity' ? 'class="active"' : ''}>Sync Opportunity</a>
      <a href="/api/outreach/templates/preview/follow_up" ${type === 'follow_up' ? 'class="active"' : ''}>Follow Up</a>
    </div>
  </div>
  ${renderedHtml}
</body>
</html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(fullPage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/outreach/templates - Create a new template
   */
  app.post('/api/outreach/templates', async (req: Request, res: Response) => {
    try {
      const { name, subject, bodyHtml, bodyText, type, userId } = req.body;
      
      // Extract variables from template
      const variableRegex = /\{\{\s*(\w+)\s*\}\}/g;
      const variables: string[] = [];
      let match;
      while ((match = variableRegex.exec(bodyHtml)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }
      
      const [template] = await db
        .insert(outreachTemplates)
        .values({
          userId,
          name,
          subject,
          bodyHtml,
          bodyText,
          type: type || 'custom',
          variables
        })
        .returning();
      
      res.json(template);
    } catch (error: any) {
      console.error('Error creating template:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * PUT /api/outreach/templates/:id - Update a template
   */
  app.put('/api/outreach/templates/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, subject, bodyHtml, bodyText, type } = req.body;
      
      const [template] = await db
        .update(outreachTemplates)
        .set({
          name,
          subject,
          bodyHtml,
          bodyText,
          type,
          updatedAt: new Date()
        })
        .where(eq(outreachTemplates.id, parseInt(id)))
        .returning();
      
      res.json(template);
    } catch (error: any) {
      console.error('Error updating template:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * DELETE /api/outreach/templates/:id - Soft delete a template
   */
  app.delete('/api/outreach/templates/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      await db
        .update(outreachTemplates)
        .set({ isActive: false })
        .where(eq(outreachTemplates.id, parseInt(id)));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================================================================
  // CAMPAIGNS ENDPOINTS
  // ============================================================================
  
  /**
   * GET /api/outreach/campaigns - List campaigns
   */
  app.get('/api/outreach/campaigns', async (req: Request, res: Response) => {
    try {
      const campaigns = await db
        .select()
        .from(outreachCampaigns)
        .orderBy(desc(outreachCampaigns.createdAt));
      
      res.json(campaigns);
    } catch (error: any) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/outreach/campaigns - Create a campaign
   */
  app.post('/api/outreach/campaigns', async (req: Request, res: Response) => {
    try {
      const { 
        userId, 
        artistId, 
        templateId, 
        name, 
        description, 
        targetFilters,
        dailyLimit = DEFAULT_DAILY_LIMIT
      } = req.body;
      
      const [campaign] = await db
        .insert(outreachCampaigns)
        .values({
          userId,
          artistId,
          templateId,
          name,
          description,
          targetFilters,
          dailyLimit
        })
        .returning();
      
      res.json(campaign);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================================================================
  // EMAIL SENDING ENDPOINTS
  // ============================================================================
  
  /**
   * GET /api/outreach/quota - Get remaining quota for today
   */
  app.get('/api/outreach/quota', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await resolveOutreachUserId(req);
      if (userId === null) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const quota = await getRemainingQuota(userId);
      res.json(quota);
    } catch (error: any) {
      console.error('Error fetching quota:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/outreach/send-single - Send a single email to one contact
   */
  app.post('/api/outreach/send-single', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await resolveOutreachUserId(req);
      if (userId === null) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { contactId, templateId, artistId, customSubject, customBody } = req.body;
      
      // Check quota
      const quota = await getRemainingQuota(userId);
      if (quota.remaining <= 0) {
        return res.status(429).json({ 
          error: 'Daily email limit reached', 
          remaining: 0,
          limit: quota.limit 
        });
      }
      
      // Get contact
      const [contact] = await db
        .select()
        .from(musicIndustryContacts)
        .where(eq(musicIndustryContacts.id, contactId));
      
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      
      const recipientEmail = contact.email || contact.personalEmail;
      if (!recipientEmail) {
        return res.status(400).json({ error: 'Contact has no email address' });
      }
      
      // Get template
      let subject = customSubject;
      let bodyHtml = customBody;
      
      if (templateId) {
        const [template] = await db
          .select()
          .from(outreachTemplates)
          .where(eq(outreachTemplates.id, templateId));
        
        if (template) {
          subject = template.subject;
          bodyHtml = template.bodyHtml;
        }
      } else if (!subject || !bodyHtml) {
        // Use default template
        const defaultTemplate = getDefaultArtistIntroTemplate();
        subject = subject || defaultTemplate.subject;
        bodyHtml = bodyHtml || defaultTemplate.bodyHtml;
      }
      
      // Get artist info if provided
      let artistName = 'Our Artist';
      let artistSlug = '';
      let artistGenre = 'Music';
      let artistBio = '';
      
      if (artistId) {
        const [artist] = await db
          .select()
          .from(users)
          .where(eq(users.id, artistId));
        
        if (artist) {
          artistName = artist.artistName || artist.firstName || artistName;
          artistSlug = artist.slug || '';
          artistGenre = artist.genres?.[0] || artist.genre || artistGenre;
          artistBio = artist.biography || '';
        }
      }
      
      // Replace variables
      const variables = {
        contact_name: contact.firstName || contact.fullName?.split(' ')[0] || 'there',
        company_name: contact.companyName || 'your company',
        artist_name: artistName,
        genre: artistGenre,
        artist_bio: artistBio.substring(0, 300) + (artistBio.length > 300 ? '...' : ''),
        landing_url: artistSlug ? `https://www.boostifymusic.com/artist/${artistSlug}` : 'https://www.boostifymusic.com',
        sender_name: 'Boostify Music Team',
        unsubscribe_url: `https://boostifymusic.com/unsubscribe?email=${encodeURIComponent(recipientEmail)}`
      };
      
      const finalSubject = replaceTemplateVariables(subject, variables);
      const finalBody = replaceTemplateVariables(bodyHtml, variables);
      
      // Send email
      const result = await sendOutreachEmail({
        to: recipientEmail,
        toName: contact.fullName,
        subject: finalSubject,
        htmlContent: finalBody,
        tags: ['outreach', artistSlug || 'general']
      });
      
      if (result.success) {
        // Log the email
        await db.insert(outreachEmailLog).values({
          contactId,
          templateId,
          toEmail: recipientEmail,
          toName: contact.fullName,
          subject: finalSubject,
          status: 'sent',
          brevoMessageId: result.messageId,
          sentAt: new Date()
        });
        
        // Update contact status
        await db
          .update(musicIndustryContacts)
          .set({
            status: 'contacted',
            lastContactedAt: new Date(),
            emailsSent: (contact.emailsSent || 0) + 1,
            updatedAt: new Date()
          })
          .where(eq(musicIndustryContacts.id, contactId));
        
        // Increment quota
        await incrementQuota(userId);
        
        const newQuota = await getRemainingQuota(userId);
        
        res.json({ 
          success: true, 
          messageId: result.messageId,
          remaining: newQuota.remaining
        });
      } else {
        // Log failed attempt
        await db.insert(outreachEmailLog).values({
          contactId,
          templateId,
          toEmail: recipientEmail,
          toName: contact.fullName,
          subject: finalSubject,
          status: 'failed',
          errorMessage: result.error
        });
        
        res.status(500).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/outreach/send-batch - Queue batch of emails
   */
  app.post('/api/outreach/send-batch', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await resolveOutreachUserId(req);
      if (userId === null) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { contactIds, templateId, artistId } = req.body;
      
      // Check quota
      const quota = await getRemainingQuota(userId);
      const toSend = Math.min(contactIds.length, quota.remaining);
      
      if (toSend === 0) {
        return res.status(429).json({ 
          error: 'Daily email limit reached', 
          remaining: 0 
        });
      }
      
      // Only process up to remaining quota
      const idsToProcess = contactIds.slice(0, toSend);
      
      // Queue emails for sending
      let sent = 0;
      let failed = 0;
      
      for (const contactId of idsToProcess) {
        try {
          // Use the single send endpoint logic
          const singleResult = await fetch(`${req.protocol}://${req.get('host')}/api/outreach/send-single`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Forward caller credentials so the internal call authenticates as the same user
              ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
              ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}),
            },
            body: JSON.stringify({ contactId, templateId, artistId })
          });
          
          if (singleResult.ok) {
            sent++;
          } else {
            failed++;
          }
          
          // Small delay between emails to not overwhelm the API
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          failed++;
        }
      }
      
      const newQuota = await getRemainingQuota(userId);
      
      res.json({
        sent,
        failed,
        remaining: newQuota.remaining,
        queued: contactIds.length - toSend // Contacts that exceeded quota
      });
    } catch (error: any) {
      console.error('Error in batch send:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/outreach/email-log - Get email sending history
   */
  app.get('/api/outreach/email-log', async (req: Request, res: Response) => {
    try {
      const { page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;
      
      const logs = await db
        .select()
        .from(outreachEmailLog)
        .orderBy(desc(outreachEmailLog.createdAt))
        .limit(limitNum)
        .offset(offset);
      
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(outreachEmailLog);
      
      res.json({
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult.count,
          totalPages: Math.ceil(countResult.count / limitNum)
        }
      });
    } catch (error: any) {
      console.error('Error fetching email log:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  console.log('✅ Outreach routes registered');
}
