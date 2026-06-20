/**
 * Artist Master JSON Builder v2
 *
 * Assembles a marketing-grade profile JSON for every lead from the raw
 * `music_industry_contacts` row (and any per-field enrichment we may add
 * later in separate tables). This JSON is the single source of truth for:
 *
 *   - Landing Forge (hero, headline, palette)
 *   - Outreach Brain (personalization tokens, subject ideas)
 *   - Visual Pitch (boostifyStyled image, palette, mood)
 *   - Potential Scorer (dimensional scores, tier)
 *   - Conversion Agent (opportunities, propensityToConvert)
 *
 * Idempotent: running again overwrites master_json with the latest computed
 * version and bumps master_json_built_at. Partial data is acceptable — the
 * `meta.dataCompleteness` score signals when a profile is "outreach-ready".
 */

import { pool } from '../../db';
import { computeLeadScore } from './hunter-scoring';
import { logger } from '../../utils/logger';

export const MASTER_JSON_VERSION = '2.0.0';
export const MASTER_JSON_SCHEMA = 'artist-master-v2';

// ─── Types ────────────────────────────────────────────────────────

export interface ArtistMasterJSON {
  meta: {
    id: string;
    slug: string;
    version: string;
    schemaVersion: string;
    createdAt: string;
    updatedAt: string;
    lastEnrichedAt: string | null;
    enrichmentStatus: 'partial' | 'complete' | 'stale';
    dataCompleteness: number;
    source: string | null;
    sourceBatchId: string | null;
  };
  identity: {
    fullName: string;
    artistName: string | null;
    aliases: string[];
    languages: string[];
    primaryLanguage: string | null;
    location: {
      country: string | null;
      countryCode: string | null;
      region: string | null;
      city: string | null;
      timezone: string | null;
    };
    bio: {
      short: string | null;
      medium: string | null;
      long: string | null;
      epkOneLiner: string | null;
    };
  };
  visual: {
    referenceImages: Array<{ url: string; source: string }>;
    boostifyStyled: {
      hero: string | null;
      generatedAt: string | null;
    };
    moodKeywords: string[];
  };
  contact: {
    email: string | null;
    emailVerified: boolean;
    phone: string | null;
    linkedin: string | null;
    preferredChannel: 'email' | 'instagram_dm' | 'spotify_pitch' | 'web_form';
    doNotContact: boolean;
  };
  team: {
    manager: { name: string | null; email: string | null };
    label: { name: string | null; type: string | null };
  };
  platforms: {
    spotify:   { url: string | null; handle: string | null };
    youtube:   { url: string | null; handle: string | null };
    instagram: { url: string | null; handle: string | null };
    tiktok:    { url: string | null; handle: string | null };
    soundcloud:{ url: string | null; handle: string | null };
    bandcamp:  { url: string | null; handle: string | null };
    website:   string | null;
  };
  audience: {
    totalReachEstimate: number | null;
    topCountries: string[];
  };
  music: {
    genres: string[];
    moods: string[];
    influences: string[];
    similarTo: string[];
  };
  career: {
    stage: 'bedroom' | 'emerging' | 'developing' | 'established' | 'mainstream' | 'unknown';
    openToCollab: boolean;
  };
  scoring: {
    overall: number;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    dimensions: {
      contactQuality: number;
      digitalPresence: number;
      activitySignals: number;
      commercialPotential: number;
      platformAlignment: number;
    };
    leadTemperature: 'hot' | 'warm' | 'cold';
    lastScoredAt: string;
  };
  opportunities: {
    detected: Array<{ type: string; confidence: number; reason: string }>;
    boostifyServicesFit: string[];
    blockers: string[];
  };
  outreach: {
    status: string;
    messagesSent: number;
    opens: number;
    clicks: number;
    lastContactedAt: string | null;
    personalizationTokens: {
      firstName: string | null;
      topCity: string | null;
      topGenre: string | null;
      hookLine: string | null;
    };
  };
  contentHooks: {
    landingHeadline: string | null;
    landingSubhead: string | null;
    ctaPrimary: string;
    ctaSecondary: string;
    emailSubjectIdeas: string[];
  };
  flags: {
    explicit: boolean;
    signed: boolean;
    vip: boolean;
    blacklist: boolean;
    tags: string[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const COUNTRY_TO_CODE: Record<string, string> = {
  'united states': 'US', usa: 'US', mexico: 'MX', spain: 'ES', argentina: 'AR',
  colombia: 'CO', brazil: 'BR', 'united kingdom': 'GB', uk: 'GB', france: 'FR',
  germany: 'DE', nigeria: 'NG', 'south korea': 'KR', japan: 'JP', canada: 'CA',
  australia: 'AU', chile: 'CL', peru: 'PE', venezuela: 'VE',
};

function countryCode(country: string | null | undefined): string | null {
  if (!country) return null;
  return COUNTRY_TO_CODE[country.trim().toLowerCase()] || null;
}

const URL_RE = /(https?:\/\/[^\s,]+)/gi;
function pickUrl(text: string, host: RegExp): string | null {
  if (!text) return null;
  const urls = text.match(URL_RE) || [];
  const found = urls.find((u) => host.test(u));
  return found || null;
}

function extractHandle(url: string | null, prefix = '@'): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (!parts.length) return null;
    const raw = parts[parts.length - 1].replace(/^@/, '');
    return `${prefix}${raw}`;
  } catch {
    return null;
  }
}

function inferGenres(contact: ContactRow): string[] {
  const out = new Set<string>();
  if (contact.genre) out.add(contact.genre);
  const kw = (contact.keywords || '').toLowerCase();
  const known = ['hip-hop','trap','reggaeton','afrobeats','amapiano','r&b','rnb','pop','indie','rock','edm','house','techno','lofi','phonk','k-pop','drill','dancehall','latin','reggae','hyperpop','bedroom-pop'];
  for (const g of known) if (kw.includes(g)) out.add(g);
  return Array.from(out).slice(0, 5);
}

// ─── Completeness ────────────────────────────────────────────────

function computeCompleteness(mj: ArtistMasterJSON): number {
  const checks: Array<[string, boolean]> = [
    ['email', !!mj.contact.email],
    ['name', !!mj.identity.fullName],
    ['country', !!mj.identity.location.country],
    ['city', !!mj.identity.location.city],
    ['genres', mj.music.genres.length > 0],
    ['hero_image', !!mj.visual.boostifyStyled.hero],
    ['reference_image', mj.visual.referenceImages.length > 0],
    ['any_platform', Object.values(mj.platforms).some((v) => typeof v === 'string' ? !!v : !!v?.url)],
    ['headline', !!mj.contentHooks.landingHeadline],
    ['scored', mj.scoring.overall > 0],
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  return +(passed / checks.length).toFixed(2);
}

// ─── Content hooks ────────────────────────────────────────────────

function buildContentHooks(contact: ContactRow, genres: string[]): ArtistMasterJSON['contentHooks'] {
  const name = contact.full_name;
  const primaryGenre = genres[0] || 'independent';
  const city = contact.city || contact.country || null;

  const headline = city
    ? `${name} — ${primaryGenre} voice from ${city}`
    : `${name} — ${primaryGenre} emerging artist`;

  const subhead = 'One Boostify page away from scale. Landing, EPK, outreach — ready in minutes.';

  const subjects = [
    `${name.split(' ')[0]}, your ${primaryGenre} era deserves more`,
    `A landing page for ${name}`,
    city ? `Saw your ${primaryGenre} from ${city} — quick idea` : `Quick idea for your ${primaryGenre} release`,
  ];

  return {
    landingHeadline: headline,
    landingSubhead: subhead,
    ctaPrimary: 'Claim your artist page',
    ctaSecondary: 'Preview your EPK',
    emailSubjectIdeas: subjects,
  };
}

function buildOpportunities(
  contact: ContactRow,
  score: number,
  tier: string,
): ArtistMasterJSON['opportunities'] {
  const detected: Array<{ type: string; confidence: number; reason: string }> = [];
  const services: string[] = [];
  const blockers: string[] = [];

  if (!contact.email) blockers.push('no-email');
  if (!contact.profile_image_url && !contact.boostify_image_url) blockers.push('no-visual');

  if (score >= 60) {
    services.push('landing-page', 'epk-generator', 'outreach-automation', 'visual-pitch');
    detected.push({
      type: 'high_value_conversion',
      confidence: 0.75,
      reason: `Tier ${tier} lead — full Boostify suite fit`,
    });
  } else if (score >= 40) {
    services.push('landing-page', 'visual-pitch');
    detected.push({
      type: 'medium_prospect',
      confidence: 0.55,
      reason: 'Video + marketing tools recommended',
    });
  } else {
    services.push('landing-page-free-tier');
    detected.push({
      type: 'nurture',
      confidence: 0.35,
      reason: 'Emerging artist — free tier entry point',
    });
  }

  const kw = (contact.keywords || '').toLowerCase();
  if (kw.includes('sync') || kw.includes('licensing')) {
    detected.push({ type: 'sync_placement', confidence: 0.6, reason: 'Sync-related keywords detected' });
  }
  if (!kw.includes('distrokid') && !kw.includes('distribution')) {
    services.push('distribution');
  }

  return { detected, boostifyServicesFit: services, blockers };
}

// ─── Row type (superset of hunter-scoring's ContactRow) ──────────

interface ContactRow {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_number: string | null;
  linkedin: string | null;
  headline: string | null;
  job_title: string | null;
  company_name: string | null;
  company_website: string | null;
  company_description: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  category: string | null;
  keywords: string | null;
  status: string | null;
  last_contacted_at: Date | null;
  emails_sent: number | null;
  opens_count: number | null;
  clicks_count: number | null;
  import_source: string | null;
  import_batch_id: string | null;
  profile_image_url: string | null;
  boostify_image_url: string | null;
  image_stylized_at: Date | null;
  email_status: string | null;
  email_verified_at: Date | null;
  genre: string | null;
  created_at: Date;
  updated_at: Date;
}

// ─── Main builder ────────────────────────────────────────────────

export function buildMasterJson(contact: ContactRow): ArtistMasterJSON {
  const fullName = contact.full_name;
  const kw = contact.keywords || '';
  const genres = inferGenres(contact);

  // Derive platform URLs from keywords blob (ingestion stuffs them there)
  const spotifyUrl = pickUrl(kw, /spotify\.com|open\.spotify/);
  const youtubeUrl = pickUrl(kw, /youtu\.?be/);
  const tiktokUrl  = pickUrl(kw, /tiktok\.com/);
  const igUrl      = pickUrl(kw, /instagram\.com/);
  const scUrl      = pickUrl(kw, /soundcloud\.com/);
  const bcUrl      = pickUrl(kw, /bandcamp\.com/);

  // Score via existing hunter heuristics
  const scoreResult = computeLeadScore({
    fullName: contact.full_name,
    email: contact.email,
    firstName: contact.first_name,
    lastName: contact.last_name,
    phone: contact.phone,
    mobileNumber: contact.mobile_number,
    linkedin: contact.linkedin,
    companyWebsite: contact.company_website,
    genre: contact.genre,
    keywords: contact.keywords,
    country: contact.country,
    city: contact.city,
    importSource: contact.import_source,
    jobTitle: contact.job_title,
  });

  const leadTemp: 'hot' | 'warm' | 'cold' =
    scoreResult.score >= 60 ? 'hot' : scoreResult.score >= 35 ? 'warm' : 'cold';

  const hookLine = genres[0]
    ? `Your ${genres[0]} is exactly what our LATAM/global discovery stack is built for.`
    : `Your sound is exactly what our discovery stack is built for.`;

  const now = new Date().toISOString();

  const mj: ArtistMasterJSON = {
    meta: {
      id: `contact_${contact.id}`,
      slug: slugify(fullName) || `contact-${contact.id}`,
      version: MASTER_JSON_VERSION,
      schemaVersion: MASTER_JSON_SCHEMA,
      createdAt: contact.created_at.toISOString(),
      updatedAt: now,
      lastEnrichedAt: null,
      enrichmentStatus: 'partial',
      dataCompleteness: 0, // filled below
      source: contact.import_source,
      sourceBatchId: contact.import_batch_id,
    },
    identity: {
      fullName,
      artistName: null,
      aliases: [],
      languages: [],
      primaryLanguage: null,
      location: {
        country: contact.country,
        countryCode: countryCode(contact.country),
        region: contact.state,
        city: contact.city,
        timezone: null,
      },
      bio: {
        short: contact.headline?.slice(0, 140) || null,
        medium: contact.company_description?.slice(0, 500) || contact.headline?.slice(0, 500) || null,
        long: contact.company_description || null,
        epkOneLiner: null,
      },
    },
    visual: {
      referenceImages: contact.profile_image_url
        ? [{ url: contact.profile_image_url, source: contact.import_source || 'unknown' }]
        : [],
      boostifyStyled: {
        hero: contact.boostify_image_url,
        generatedAt: contact.image_stylized_at?.toISOString() || null,
      },
      moodKeywords: [],
    },
    contact: {
      email: contact.email,
      emailVerified: contact.email_status === 'verified' || !!contact.email_verified_at,
      phone: contact.phone || contact.mobile_number,
      linkedin: contact.linkedin,
      preferredChannel: scoreResult.recommendedChannel as any,
      doNotContact: contact.status === 'unsubscribed' || contact.status === 'bounced',
    },
    team: {
      manager: { name: null, email: null },
      label: { name: contact.company_name, type: 'unknown' },
    },
    platforms: {
      spotify:    { url: spotifyUrl, handle: null },
      youtube:    { url: youtubeUrl, handle: null },
      instagram:  { url: igUrl,      handle: extractHandle(igUrl) },
      tiktok:     { url: tiktokUrl,  handle: extractHandle(tiktokUrl) },
      soundcloud: { url: scUrl,      handle: null },
      bandcamp:   { url: bcUrl,      handle: null },
      website:    contact.company_website,
    },
    audience: {
      totalReachEstimate: null,
      topCountries: contact.country ? [countryCode(contact.country) || contact.country] : [],
    },
    music: {
      genres,
      moods: [],
      influences: [],
      similarTo: [],
    },
    career: {
      stage: 'unknown',
      openToCollab: true,
    },
    scoring: {
      overall: scoreResult.score,
      tier: scoreResult.tier,
      dimensions: scoreResult.breakdown,
      leadTemperature: leadTemp,
      lastScoredAt: now,
    },
    opportunities: buildOpportunities(contact, scoreResult.score, scoreResult.tier),
    outreach: {
      status: contact.status || 'new',
      messagesSent: contact.emails_sent || 0,
      opens: contact.opens_count || 0,
      clicks: contact.clicks_count || 0,
      lastContactedAt: contact.last_contacted_at?.toISOString() || null,
      personalizationTokens: {
        firstName: contact.first_name || fullName.split(' ')[0] || null,
        topCity: contact.city || contact.country || null,
        topGenre: genres[0] || null,
        hookLine,
      },
    },
    contentHooks: buildContentHooks(contact, genres),
    flags: {
      explicit: false,
      signed: contact.company_name ? !/independent|unsigned|self/i.test(contact.company_name) : false,
      vip: false,
      blacklist: contact.status === 'bounced' || contact.status === 'unsubscribed',
      tags: [
        contact.import_source ? `src:${contact.import_source}` : null,
        contact.country ? `country:${countryCode(contact.country) || contact.country}` : null,
        `tier:${scoreResult.tier}`,
        `temp:${leadTemp}`,
      ].filter(Boolean) as string[],
    },
  };

  mj.meta.dataCompleteness = computeCompleteness(mj);
  mj.meta.enrichmentStatus =
    mj.meta.dataCompleteness >= 0.8 ? 'complete' :
    mj.meta.dataCompleteness >= 0.4 ? 'partial' : 'partial';

  return mj;
}

// ─── Persistence ──────────────────────────────────────────────────

const SELECT_COLS = `
  id, full_name, first_name, last_name, email, phone, mobile_number, linkedin,
  headline, job_title, company_name, company_website, company_description,
  city, state, country, category, keywords, status, last_contacted_at,
  emails_sent, opens_count, clicks_count, import_source, import_batch_id,
  profile_image_url, boostify_image_url, image_stylized_at,
  email_status, email_verified_at,
  NULL::text AS genre,
  created_at, updated_at
`;

export async function buildAndSaveMasterJson(contactId: number): Promise<ArtistMasterJSON | null> {
  const { rows } = await pool.query<ContactRow>(
    `SELECT ${SELECT_COLS} FROM music_industry_contacts WHERE id = $1 LIMIT 1`,
    [contactId],
  );
  if (!rows.length) return null;

  const mj = buildMasterJson(rows[0]);
  await pool.query(
    `UPDATE music_industry_contacts
        SET master_json = $1::jsonb,
            master_json_version = $2,
            master_json_built_at = NOW(),
            data_completeness = $3
      WHERE id = $4`,
    [JSON.stringify(mj), MASTER_JSON_VERSION, mj.meta.dataCompleteness, contactId],
  );
  return mj;
}

export interface MasterJsonBatchResult {
  processed: number;
  rebuilt: number;
  avgCompleteness: number;
  outreachReady: number;
}

/**
 * Rebuilds master_json for a batch of contacts — prioritizes:
 *   1. Contacts with no master_json yet
 *   2. Contacts whose master_json_built_at is older than 7 days
 *   3. Contacts whose profile_image_url or boostify_image_url changed after build
 */
export async function rebuildMasterJsonBatch(limit = 100): Promise<MasterJsonBatchResult> {
  const { rows } = await pool.query<ContactRow>(
    `SELECT ${SELECT_COLS}
       FROM music_industry_contacts
      WHERE master_json IS NULL
         OR master_json_built_at IS NULL
         OR master_json_built_at < NOW() - INTERVAL '7 days'
         OR (image_stylized_at IS NOT NULL AND image_stylized_at > master_json_built_at)
      ORDER BY
        (master_json IS NULL) DESC,
        master_json_built_at NULLS FIRST
      LIMIT $1`,
    [limit],
  );

  let rebuilt = 0;
  let totalCompleteness = 0;
  let outreachReady = 0;

  for (const row of rows) {
    try {
      const mj = buildMasterJson(row);
      await pool.query(
        `UPDATE music_industry_contacts
            SET master_json = $1::jsonb,
                master_json_version = $2,
                master_json_built_at = NOW(),
                data_completeness = $3
          WHERE id = $4`,
        [JSON.stringify(mj), MASTER_JSON_VERSION, mj.meta.dataCompleteness, row.id],
      );
      rebuilt++;
      totalCompleteness += mj.meta.dataCompleteness;
      if (mj.meta.dataCompleteness >= 0.6) outreachReady++;
    } catch (err: any) {
      logger.warn(`[MasterJsonBuilder] contact #${row.id} failed:`, err.message);
    }
  }

  const avg = rebuilt > 0 ? +(totalCompleteness / rebuilt).toFixed(2) : 0;
  logger.log(
    `[MasterJsonBuilder] rebuilt ${rebuilt}/${rows.length} ` +
    `(avgCompleteness=${avg}, outreachReady=${outreachReady})`,
  );
  return {
    processed: rows.length,
    rebuilt,
    avgCompleteness: avg,
    outreachReady,
  };
}
