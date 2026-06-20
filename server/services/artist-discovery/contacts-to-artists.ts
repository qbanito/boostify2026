/**
 * Boostify Contacts → Artist Pages Pipeline
 * 
 * Bulk-converts scored music_industry_contacts into artist pages (users table).
 * Only processes contacts with activation score ≥ minScore that don't already
 * have a corresponding user record.
 * 
 * Flow:
 *  1. Query scored contacts not yet converted (LEFT JOIN users ON email)
 *  2. Generate unique slug per artist
 *  3. Build AI biography from contact metadata (optional, uses OpenAI)
 *  4. Insert into users table with role='artist'
 *  5. Link activation_scores.userId to the new user
 *  6. Update contact status to 'deal_in_progress'
 *  7. Generate placeholder images (UI Avatars + Picsum)
 * 
 * Target: 50k artist pages by end of 2026
 */

import { db } from '../../db';
import { users, musicIndustryContacts, activationScores } from '../../../db/schema';
import { eq, sql, and, isNotNull, isNull, gt, desc, inArray, not } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────

export interface PipelineConfig {
  minScore: number;        // Minimum activation score to convert (default: 30)
  batchSize: number;       // Max contacts to process per run (default: 500)
  generateBios: boolean;   // Use AI to generate bios (default: false for speed)
  dryRun: boolean;         // Preview without inserting (default: false)
}

export interface PipelineResult {
  processed: number;
  created: number;
  skipped: number;
  errors: number;
  duplicateSlugs: number;
  details: { contactId: number; userId?: number; slug?: string; error?: string }[];
  durationMs: number;
}

export interface PipelineStats {
  totalContacts: number;
  totalArtistPages: number;
  convertedContacts: number;
  pendingConversion: number;
  conversionRate: number;
  byTier: { tier: string; total: number; converted: number }[];
  recentConversions: { id: number; artistName: string; slug: string; createdAt: Date }[];
  goalProgress: { current: number; target: number; percent: number };
}

// ─── Slug Generator ──────────────────────────────────────────────

function generateSlug(name: string, attempt = 0): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!base) return `artist-${Date.now()}`;
  return attempt > 0 ? `${base}-${attempt}` : base;
}

async function findUniqueSlug(name: string): Promise<string> {
  let slug = generateSlug(name);
  let attempt = 0;

  while (attempt < 100) {
    const existing = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.slug, slug))
      .limit(1);

    if (existing.length === 0) return slug;
    attempt++;
    slug = generateSlug(name, attempt);
  }

  // Fallback: append timestamp
  return `${generateSlug(name)}-${Date.now()}`;
}

// ─── Entity Type Detection ───────────────────────────────────────

type EntityType = 'record-label' | 'band' | 'producer' | 'dj' | 'podcast' | 'media' | 'venue' | 'festival' | 'management' | 'distributor' | 'solo-artist';

interface EntityClassification {
  type: EntityType;
  title: string;        // e.g. "Record Label", "Music Producer"
  pageMode: 'artist' | 'business';
}

/**
 * Classify a contact into the correct entity type based on name, company,
 * keywords, job title, and description. Prevents record labels, podcasts,
 * venues etc. from being labelled "Independent Artist".
 */
function classifyEntity(contact: any): EntityClassification {
  const name = (contact.full_name || '').toLowerCase();
  const company = (contact.company_name || '').toLowerCase();
  const kw = (contact.keywords || '').toLowerCase();
  const jobTitle = (contact.job_title || '').toLowerCase();
  const desc = (contact.company_description || '').toLowerCase();
  const all = `${name} ${company} ${kw} ${jobTitle} ${desc}`;

  // Record Labels / Labels
  const labelPatterns = [
    /\brecords?\b/, /\blabel\b/, /\brecording[s]?\b/, /\bmusic\s*group\b/,
    /\bentertainment\b/, /\bmusic\s*entertainment\b/, /\bdistribution\b/,
    /\bwarner\b/, /\buniversal\b/, /\bsony\s*music\b/, /\bemi\b/, /\bbmg\b/,
    /\bdef\s*jam\b/, /\batlantic\b/, /\binterscope\b/, /\bcapitol\b/,
    /\brepublic\s*records\b/, /\bisland\s*records\b/, /\bcolumbia\s*records\b/,
    /\brca\b/, /\bepic\s*records\b/, /\bvirgin\b/, /\bparlophone\b/,
  ];
  if (labelPatterns.some(p => p.test(all))) {
    return { type: 'record-label', title: 'Record Label', pageMode: 'business' };
  }

  // Distribution companies
  if (/\bdistribut(or|ion)\b/.test(all) || /\baggregat(or|ion)\b/.test(all)) {
    return { type: 'distributor', title: 'Music Distributor', pageMode: 'business' };
  }

  // Management / Agency
  if (/\bmanagement\b/.test(all) || /\bagency\b/.test(all) || /\bmanager\b/.test(all) || /\btalent\s*agency\b/.test(all)) {
    return { type: 'management', title: 'Artist Management', pageMode: 'business' };
  }

  // Venues
  if (/\bvenue\b/.test(all) || /\bclub\b/.test(all) || /\btheater\b/.test(all) || /\btheatre\b/.test(all) || /\barena\b/.test(all) || /\bstadium\b/.test(all) || /\bconcert\s*hall\b/.test(all)) {
    return { type: 'venue', title: 'Music Venue', pageMode: 'business' };
  }

  // Festivals
  if (/\bfestival\b/.test(all) || /\bfest\b/.test(all) || /\bcoachella\b/.test(all) || /\blollapalooza\b/.test(all)) {
    return { type: 'festival', title: 'Music Festival', pageMode: 'business' };
  }

  // Podcasts
  if (/\bpodcast\b/.test(all) || /\bradio\b/.test(all) || /\bshow\s*host\b/.test(all) || /\bbroadcast\b/.test(all)) {
    return { type: 'podcast', title: 'Music Podcast', pageMode: 'business' };
  }

  // Media / Magazine / Blog
  if (/\bmagazine\b/.test(all) || /\bmedia\b/.test(all) || /\bblog\b/.test(all) || /\bpress\b/.test(all) || /\bnews\b/.test(all) || /\bpublicat\b/.test(all)) {
    return { type: 'media', title: 'Music Media', pageMode: 'business' };
  }

  // Producers
  if (/\bproducer\b/.test(all) || /\bproduction\b/.test(all) || /\bbeats?\b/.test(all) || /\bbeatmaker\b/.test(all)) {
    return { type: 'producer', title: 'Music Producer', pageMode: 'artist' };
  }

  // DJs
  if (/\bdj\b/.test(all) || /\bdisc\s*jockey\b/.test(all) || /\bturntablist\b/.test(all)) {
    return { type: 'dj', title: 'DJ', pageMode: 'artist' };
  }

  // Bands / Groups
  if (/\bband\b/.test(all) || /\bcollective\b/.test(all) || /\bensemble\b/.test(all) || /\borchestra\b/.test(all) || /\bquartet\b/.test(all) || /\btrio\b/.test(all) || /\bduo\b/.test(all) || /\bgroup\b/.test(all)) {
    return { type: 'band', title: 'Music Group', pageMode: 'artist' };
  }

  // Default: solo artist
  return { type: 'solo-artist', title: 'Independent Artist', pageMode: 'artist' };
}

/**
 * Generate an appropriate biography based on entity classification.
 */
function buildBiography(
  name: string,
  entity: EntityClassification,
  genres: string[],
  location: string | null,
  contact: any,
): string {
  const loc = location || contact.country || 'worldwide';
  const genreStr = genres.filter(g => g !== 'Independent').join(', ') || 'various genres';
  const companyDesc = (contact.company_description || '').trim();
  const founded = contact.founded_year || null;

  switch (entity.type) {
    case 'record-label':
      return companyDesc
        ? `${name} is a record label${founded ? ` founded in ${founded}` : ''} based in ${loc}. ${companyDesc.slice(0, 200)}`
        : `${name} is a record label${founded ? ` established in ${founded}` : ''} based in ${loc}, working across ${genreStr}. Discovered through the Boostify network.`;

    case 'distributor':
      return companyDesc
        ? `${name} is a music distribution company based in ${loc}. ${companyDesc.slice(0, 200)}`
        : `${name} is a music distribution company based in ${loc}, serving artists across ${genreStr}.`;

    case 'management':
      return `${name} is an artist management company based in ${loc}, representing talent across ${genreStr}.`;

    case 'venue':
      return `${name} is a music venue based in ${loc}, hosting live performances and events across ${genreStr}.`;

    case 'festival':
      return `${name} is a music festival based in ${loc}, celebrating ${genreStr} music and culture.`;

    case 'podcast':
      return companyDesc
        ? `${name} is a music podcast${loc !== 'worldwide' ? ` based in ${loc}` : ''}. ${companyDesc.slice(0, 200)}`
        : `${name} is a music podcast covering ${genreStr}${loc !== 'worldwide' ? `, based in ${loc}` : ''}.`;

    case 'media':
      return `${name} is a music media outlet${loc !== 'worldwide' ? ` based in ${loc}` : ''}, covering ${genreStr} and the music industry.`;

    case 'producer':
      return `${name} is a music producer${loc !== 'worldwide' ? ` based in ${loc}` : ''}, specializing in ${genreStr}. Discovered through the Boostify Artist Hunter network.`;

    case 'dj':
      return `${name} is a DJ${loc !== 'worldwide' ? ` based in ${loc}` : ''}, specializing in ${genreStr}. Discovered through the Boostify Artist Hunter network.`;

    case 'band':
      return `${name} is a ${genreStr} group${loc !== 'worldwide' ? ` from ${loc}` : ''}. Discovered through the Boostify Artist Hunter network.`;

    default:
      return `${name} is an independent ${genreStr} artist from ${loc}. Discovered through the Boostify Artist Hunter network.`;
  }
}

// ─── Genre Mapping ───────────────────────────────────────────────

function extractGenres(contact: any): string[] {
  const genres: string[] = [];
  const kw = (contact.keywords || '').toLowerCase();
  const category = (contact.category || '').toLowerCase();

  const genreMap: Record<string, string> = {
    'hip hop': 'Hip Hop', 'hip-hop': 'Hip Hop', 'hiphop': 'Hip Hop',
    'rap': 'Rap', 'trap': 'Trap', 'r&b': 'R&B', 'rnb': 'R&B',
    'pop': 'Pop', 'rock': 'Rock', 'indie': 'Indie', 'alternative': 'Alternative',
    'electronic': 'Electronic', 'edm': 'EDM', 'house': 'House', 'techno': 'Techno',
    'reggaeton': 'Reggaeton', 'latin': 'Latin', 'salsa': 'Salsa', 'bachata': 'Bachata',
    'afrobeats': 'Afrobeats', 'afropop': 'Afropop', 'amapiano': 'Amapiano',
    'k-pop': 'K-Pop', 'kpop': 'K-Pop', 'j-pop': 'J-Pop',
    'jazz': 'Jazz', 'blues': 'Blues', 'soul': 'Soul', 'funk': 'Funk',
    'country': 'Country', 'folk': 'Folk', 'metal': 'Metal', 'punk': 'Punk',
    'classical': 'Classical', 'gospel': 'Gospel', 'reggae': 'Reggae',
    'dancehall': 'Dancehall', 'drill': 'Drill', 'lo-fi': 'Lo-Fi',
  };

  for (const [key, label] of Object.entries(genreMap)) {
    if (kw.includes(key) || category.includes(key)) {
      if (!genres.includes(label)) genres.push(label);
    }
  }

  return genres.length > 0 ? genres.slice(0, 3) : ['Independent'];
}

// ─── Location Builder ────────────────────────────────────────────

function buildLocation(contact: any): string | null {
  const parts = [contact.city, contact.state, contact.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

// ─── Image Placeholders ─────────────────────────────────────────

function getPlaceholderImages(name: string) {
  const encoded = encodeURIComponent(name || 'Artist');
  const seed = name?.replace(/\s/g, '') || 'default';
  return {
    profileImage: `https://ui-avatars.com/api/?name=${encoded}&size=400&background=7c3aed&color=fff&bold=true`,
    coverImage: `https://picsum.photos/seed/${seed}/1200/400`,
  };
}

// ─── Core Pipeline ───────────────────────────────────────────────

export async function convertContactsToArtists(
  config: Partial<PipelineConfig> = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  const {
    minScore = 30,
    batchSize = 500,
    generateBios = false,
    dryRun = false,
  } = config;

  const result: PipelineResult = {
    processed: 0, created: 0, skipped: 0, errors: 0, duplicateSlugs: 0,
    details: [], durationMs: 0,
  };

  try {
    // 1. Find scored contacts that don't already have artist pages
    //    LEFT JOIN users on email match, only take where no user exists
    const candidates = await db.execute(sql`
      SELECT 
        c.id as contact_id,
        c.full_name,
        c.first_name,
        c.last_name,
        c.email,
        c.personal_email,
        c.phone,
        c.mobile_number,
        c.city,
        c.state,
        c.country,
        c.category,
        c.keywords,
        c.company_name,
        c.linkedin,
        c.import_source,
        a.score,
        a.segment,
        a.id as activation_id
      FROM music_industry_contacts c
      INNER JOIN activation_scores a ON a.contact_id = c.id
      WHERE a.score >= ${minScore}
        AND c.email IS NOT NULL
        AND c.full_name IS NOT NULL
        AND c.full_name != ''
        AND NOT EXISTS (
          SELECT 1 FROM users u 
          WHERE LOWER(u.email) = LOWER(c.email)
        )
      ORDER BY a.score DESC
      LIMIT ${batchSize}
    `);

    const rows = (candidates as any).rows || candidates;
    if (!rows || rows.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    console.log(`[Pipeline] Found ${rows.length} contacts to convert (minScore=${minScore})`);

    // 2. Process each contact
    for (const row of rows) {
      result.processed++;

      try {
        const artistName = row.full_name?.trim();
        if (!artistName || artistName.length < 2) {
          result.skipped++;
          result.details.push({ contactId: row.contact_id, error: 'Invalid name' });
          continue;
        }

        const email = (row.email || row.personal_email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) {
          result.skipped++;
          result.details.push({ contactId: row.contact_id, error: 'Invalid email' });
          continue;
        }

        if (dryRun) {
          result.created++;
          result.details.push({
            contactId: row.contact_id,
            slug: generateSlug(artistName),
          });
          continue;
        }

        // Generate unique slug
        const slug = await findUniqueSlug(artistName);

        // Build artist data
        const entity = classifyEntity(row);
        const genres = extractGenres(row);
        const location = buildLocation(row);
        const images = getPlaceholderImages(artistName);
        const firstName = row.first_name || artistName.split(' ')[0] || '';
        const lastName = row.last_name || artistName.split(' ').slice(1).join(' ') || '';

        // Build biography based on entity type
        let biography: string | null = null;
        if (!generateBios) {
          biography = buildBiography(artistName, entity, genres, location, row);
        }

        // For non-artist entities, use a proper genre label instead of "Independent"
        const finalGenre = entity.type !== 'solo-artist' ? entity.title : (genres[0] || null);

        // 3. INSERT into users table
        const [newArtist] = await db.insert(users).values({
          role: 'artist',
          artistName,
          slug,
          email,
          firstName,
          lastName,
          phone: row.phone || row.mobile_number || null,
          biography,
          location,
          country: row.country || null,
          genres,
          genre: finalGenre,
          profileImage: images.profileImage,
          coverImage: images.coverImage,
          website: row.linkedin || null,
          isAIGenerated: true,
          pageMode: entity.pageMode,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning({ id: users.id, slug: users.slug });

        // 4. Link activation_scores.userId to new artist
        if (row.activation_id) {
          await db.update(activationScores)
            .set({
              userId: newArtist.id,
              segment: 'converted',
              convertedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(activationScores.id, row.activation_id));
        }

        // 5. Update contact status
        await db.update(musicIndustryContacts)
          .set({
            status: 'deal_in_progress',
            updatedAt: new Date(),
          })
          .where(eq(musicIndustryContacts.id, row.contact_id));

        result.created++;
        result.details.push({
          contactId: row.contact_id,
          userId: newArtist.id,
          slug: newArtist.slug || slug,
        });

        // 6. Enqueue for enrichment (auto-collect real data from web)
        try {
          const { enqueueArtistEnrichment } = await import('../artist-enrichment');
          await enqueueArtistEnrichment({
            artistId: newArtist.id,
            source: 'discovery',
            priority: Math.min(Math.round((row.score || 50) * 1.2), 100),
          });
        } catch { /* enrichment is non-critical */ }

      } catch (err: any) {
        result.errors++;
        const msg = err.message || 'Unknown error';
        // Handle unique constraint violations gracefully
        if (msg.includes('unique') || msg.includes('duplicate')) {
          result.duplicateSlugs++;
          result.details.push({ contactId: row.contact_id, error: 'Duplicate slug/email' });
        } else {
          result.details.push({ contactId: row.contact_id, error: msg.slice(0, 120) });
        }
      }
    }

  } catch (err: any) {
    console.error('[Pipeline] Fatal error:', err.message);
    result.errors++;
  }

  result.durationMs = Date.now() - startTime;
  console.log(`[Pipeline] Done: ${result.created} created, ${result.skipped} skipped, ${result.errors} errors in ${result.durationMs}ms`);
  return result;
}

// ─── Pipeline Stats ──────────────────────────────────────────────

export async function getPipelineStats(): Promise<PipelineStats> {
  const [
    totalContactsR,
    totalArtistPagesR,
    convertedR,
    pendingR,
    byTierR,
    recentR,
  ] = await Promise.all([
    // Total contacts with email
    db.execute(sql`SELECT COUNT(*) as cnt FROM music_industry_contacts WHERE email IS NOT NULL`),

    // Total artist pages
    db.execute(sql`SELECT COUNT(*) as cnt FROM users WHERE role = 'artist'`),

    // Converted (activation_scores with userId set)
    db.execute(sql`SELECT COUNT(*) as cnt FROM activation_scores WHERE user_id IS NOT NULL`),

    // Pending (scored ≥ 30, no user yet)
    db.execute(sql`
      SELECT COUNT(*) as cnt 
      FROM activation_scores a
      INNER JOIN music_industry_contacts c ON c.id = a.contact_id
      WHERE a.score >= 30
        AND a.user_id IS NULL
        AND c.email IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.email) = LOWER(c.email))
    `),

    // By tier (total and converted)
    db.execute(sql`
      SELECT 
        CASE 
          WHEN a.score >= 80 THEN 'S'
          WHEN a.score >= 60 THEN 'A'
          WHEN a.score >= 40 THEN 'B'
          WHEN a.score >= 20 THEN 'C'
          ELSE 'D'
        END as tier,
        COUNT(*) as total,
        COUNT(a.user_id) as converted
      FROM activation_scores a
      GROUP BY tier
      ORDER BY tier
    `),

    // Recent conversions
    db.execute(sql`
      SELECT u.id, u.artist_name, u.slug, u.created_at
      FROM users u
      WHERE u.is_ai_generated = true AND u.role = 'artist'
      ORDER BY u.created_at DESC
      LIMIT 10
    `),
  ]);

  const totalContacts = Number((totalContactsR as any).rows?.[0]?.cnt || 0);
  const totalArtistPages = Number((totalArtistPagesR as any).rows?.[0]?.cnt || 0);
  const converted = Number((convertedR as any).rows?.[0]?.cnt || 0);
  const pending = Number((pendingR as any).rows?.[0]?.cnt || 0);

  const tierRows = (byTierR as any).rows || [];
  const byTier = (tierRows || []).map((r: any) => ({
    tier: r.tier,
    total: Number(r.total),
    converted: Number(r.converted),
  }));

  const recentRows = (recentR as any).rows || [];
  const recentConversions = (recentRows || []).map((r: any) => ({
    id: r.id,
    artistName: r.artist_name,
    slug: r.slug,
    createdAt: r.created_at,
  }));

  return {
    totalContacts,
    totalArtistPages,
    convertedContacts: converted,
    pendingConversion: pending,
    conversionRate: totalContacts > 0 ? Math.round((totalArtistPages / totalContacts) * 100) : 0,
    byTier,
    recentConversions,
    goalProgress: {
      current: totalArtistPages,
      target: 50000,
      percent: Math.round((totalArtistPages / 50000) * 100),
    },
  };
}

// ─── Auto-Generation Scheduler ───────────────────────────────────

let autoGenInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoGeneration(intervalMs = 4 * 60 * 60 * 1000) {
  if (autoGenInterval) return;
  console.log(`[Pipeline] Auto-generation started (every ${Math.round(intervalMs / 3600000)}h)`);

  autoGenInterval = setInterval(async () => {
    try {
      console.log('[Pipeline] Auto-generation tick...');
      const result = await convertContactsToArtists({
        minScore: 30,
        batchSize: 500,
        generateBios: false,
      });
      console.log(`[Pipeline] Auto-gen: +${result.created} artist pages`);
    } catch (err: any) {
      console.error('[Pipeline] Auto-gen error:', err.message);
    }
  }, intervalMs);
}

export function stopAutoGeneration() {
  if (autoGenInterval) {
    clearInterval(autoGenInterval);
    autoGenInterval = null;
    console.log('[Pipeline] Auto-generation stopped');
  }
}

export function isAutoGenerationRunning(): boolean {
  return autoGenInterval !== null;
}
