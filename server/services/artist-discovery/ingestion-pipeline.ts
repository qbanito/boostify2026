/**
 * Artist Discovery — Ingestion Pipeline
 * Normalizes, validates, deduplicates, and inserts discovered artists into music_industry_contacts.
 */

import { db } from '../../db';
import { musicIndustryContacts } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';

export interface RawArtistLead {
  fullName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  mobileNumber?: string;
  jobTitle?: string;
  headline?: string;
  industry?: string;
  companyName?: string;
  companyWebsite?: string;
  companyDescription?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedin?: string;
  genre?: string;
  spotifyUrl?: string;
  soundcloudUrl?: string;
  bandcampUrl?: string;
  instagramHandle?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  tiktokHandle?: string;
  monthlyListeners?: number;
  followers?: number;
  // Visual reference image from the source platform (Spotify artist image,
  // YouTube channel thumbnail, etc.). Used later to generate a Boostify-styled
  // variant for the landing page.
  profileImageUrl?: string;
}

export interface IngestionResult {
  total: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  errors: string[];
}

// ─── Email validation ────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JUNK_DOMAINS = new Set([
  'example.com', 'test.com', 'email.com', 'none.com', 'na.com',
  'noemail.com', 'fake.com', 'placeholder.com', 'nomail.com',
  'sentry.io', 'wixpress.com', 'sentry-next.wixpress.com',
  'tiktok.com', 'youtube.com', 'google.com', 'facebook.com',
  'instagram.com', 'twitter.com', 'spotify.com', 'soundcloud.com',
  'bandcamp.com', 'apple.com', 'amazon.com',
]);

function isValidEmail(email: string | undefined): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  if (!EMAIL_REGEX.test(clean)) return false;
  const domain = clean.split('@')[1];
  if (JUNK_DOMAINS.has(domain)) return false;
  if (clean.length > 254) return false;
  return true;
}

// ─── Name cleaning ───────────────────────────────────────────────
function cleanName(name: string): string {
  return name
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.split(' ').filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// ─── Country normalization ───────────────────────────────────────
const COUNTRY_MAP: Record<string, string> = {
  'us': 'United States', 'usa': 'United States', 'united states of america': 'United States',
  'uk': 'United Kingdom', 'gb': 'United Kingdom', 'england': 'United Kingdom',
  'mx': 'Mexico', 'méxico': 'Mexico', 'es': 'Spain', 'españa': 'Spain',
  'fr': 'France', 'de': 'Germany', 'br': 'Brazil', 'brasil': 'Brazil',
  'co': 'Colombia', 'ar': 'Argentina', 'cl': 'Chile', 'pe': 'Peru', 'perú': 'Peru',
  'ca': 'Canada', 'au': 'Australia', 'jp': 'Japan', 'kr': 'South Korea',
  'it': 'Italy', 'pt': 'Portugal', 'nl': 'Netherlands', 'se': 'Sweden',
  'no': 'Norway', 'dk': 'Denmark', 'fi': 'Finland', 'ng': 'Nigeria',
  'gh': 'Ghana', 'ke': 'Kenya', 'za': 'South Africa', 'in': 'India',
};

function normalizeCountry(country: string | undefined): string | undefined {
  if (!country) return undefined;
  const clean = country.toLowerCase().trim();
  return COUNTRY_MAP[clean] || country.trim();
}

// ─── Build keywords from artist data ─────────────────────────────
function buildKeywords(lead: RawArtistLead): string {
  const parts: string[] = [];
  if (lead.genre) parts.push(lead.genre);
  if (lead.monthlyListeners) parts.push(`listeners:${lead.monthlyListeners}`);
  if (lead.followers) parts.push(`followers:${lead.followers}`);
  if (lead.spotifyUrl) parts.push('spotify');
  if (lead.soundcloudUrl) parts.push('soundcloud');
  if (lead.bandcampUrl) parts.push('bandcamp');
  if (lead.instagramHandle) parts.push(`ig:${lead.instagramHandle}`);
  if (lead.youtubeUrl) parts.push('youtube');
  if (lead.tiktokUrl || lead.tiktokHandle) parts.push('tiktok');
  return parts.join(', ');
}

/**
 * Infer job title from name and lead metadata.
 * Prevents record labels, podcasts, venues etc. from being labelled "Independent Artist".
 */
function inferJobTitle(name: string, lead: RawArtistLead): string {
  const all = `${name} ${lead.companyName || ''} ${lead.companyDescription || ''} ${lead.headline || ''}`.toLowerCase();

  if (/\brecords?\b|\blabel\b|\brecording\b|\bmusic\s*entertainment\b/.test(all)) return 'Record Label';
  if (/\bdistribut(or|ion)\b|\baggregat(or|ion)\b/.test(all)) return 'Music Distributor';
  if (/\bmanagement\b|\bagency\b|\bmanager\b/.test(all)) return 'Artist Manager';
  if (/\bvenue\b|\bclub\b|\btheater\b|\btheatre\b|\barena\b/.test(all)) return 'Music Venue';
  if (/\bfestival\b|\bfest\b/.test(all)) return 'Festival Organizer';
  if (/\bpodcast\b|\bradio\b|\bbroadcast\b/.test(all)) return 'Podcast Host';
  if (/\bmagazine\b|\bmedia\b|\bblog\b|\bpress\b/.test(all)) return 'Music Media';
  if (/\bproducer\b|\bproduction\b|\bbeatmaker\b/.test(all)) return 'Music Producer';
  if (/\bdj\b|\bdisc\s*jockey\b/.test(all)) return 'DJ';
  if (/\bband\b|\bcollective\b|\bensemble\b|\borchestra\b|\btrio\b|\bduo\b/.test(all)) return 'Music Group';

  return 'Independent Artist';
}

// ─── Main ingestion function ─────────────────────────────────────
export async function ingestArtists(
  leads: RawArtistLead[],
  source: string,
  batchId: string
): Promise<IngestionResult> {
  const result: IngestionResult = {
    total: leads.length,
    inserted: 0,
    duplicates: 0,
    invalid: 0,
    errors: [],
  };

  // Pre-fetch existing emails for dedup (batch check)
  const validLeads = leads.filter(l => {
    if (!l.fullName || l.fullName.trim().length < 2) {
      result.invalid++;
      return false;
    }
    if (!isValidEmail(l.email) && !isValidEmail(l.personalEmail)) {
      result.invalid++;
      return false;
    }
    return true;
  });

  const emailsToCheck = validLeads
    .map(l => (l.email || l.personalEmail || '').toLowerCase().trim())
    .filter(Boolean);

  // Batch dedup check
  let existingEmails = new Set<string>();
  if (emailsToCheck.length > 0) {
    const chunks = chunkArray(emailsToCheck, 500);
    for (const chunk of chunks) {
      const existing = await db
        .select({ email: musicIndustryContacts.email })
        .from(musicIndustryContacts)
        .where(sql`LOWER(${musicIndustryContacts.email}) IN (${sql.join(chunk.map(e => sql`${e}`), sql`, `)})`);
      existing.forEach(r => {
        if (r.email) existingEmails.add(r.email.toLowerCase().trim());
      });
    }
  }

  // Insert in batches
  const toInsert = [];
  for (const lead of validLeads) {
    const email = (lead.email || lead.personalEmail || '').toLowerCase().trim();
    if (existingEmails.has(email)) {
      result.duplicates++;
      continue;
    }
    // Mark as seen to prevent intra-batch dupes
    existingEmails.add(email);

    const cleaned = cleanName(lead.fullName);
    const email_ = email || lead.personalEmail?.toLowerCase().trim() || '';

    // If the cleaned name looks bad (gibberish, hex, no vowels), derive from email prefix
    let finalName = cleaned;
    const lower = cleaned.toLowerCase().replace(/[^a-z]/g, '');
    const vowelRatio = lower.length > 0 ? lower.replace(/[^aeiou]/g, '').length / lower.length : 0;
    const isBadName = lower.length < 2
      || vowelRatio < 0.15
      || (cleaned.trim().length > 25 && !cleaned.includes(' '))
      || /^\d+$/.test(cleaned.trim())
      || /^[a-f0-9]{8,}$/i.test(cleaned.trim());

    if (isBadName && email_) {
      const prefix = email_.split('@')[0] || '';
      const emailParts = prefix.replace(/\d+$/, '')
        .split(/[._\-+]+/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
      if (emailParts.length > 0) {
        finalName = emailParts.join(' ');
      }
    }

    const { firstName, lastName } = splitName(finalName);

    toInsert.push({
      fullName: finalName,
      firstName: lead.firstName || firstName,
      lastName: lead.lastName || lastName,
      email: email || null,
      personalEmail: lead.personalEmail?.toLowerCase().trim() || null,
      phone: lead.phone || null,
      mobileNumber: lead.mobileNumber || null,
      jobTitle: lead.jobTitle || inferJobTitle(finalName, lead),
      headline: lead.headline || null,
      industry: lead.industry || 'Music',
      companyName: lead.companyName || null,
      companyWebsite: lead.companyWebsite || lead.spotifyUrl || lead.bandcampUrl || null,
      companyDescription: lead.companyDescription || null,
      city: lead.city || null,
      state: lead.state || null,
      country: normalizeCountry(lead.country) || null,
      linkedin: lead.linkedin || null,
      category: 'artist' as any,
      status: 'new' as any,
      keywords: buildKeywords(lead) || null,
      importSource: source,
      importBatchId: batchId,
      profileImageUrl: lead.profileImageUrl || null,
    });
  }

  // Batch insert in groups of 100
  const insertChunks = chunkArray(toInsert, 100);
  for (const chunk of insertChunks) {
    try {
      await db.insert(musicIndustryContacts).values(chunk as any);
      result.inserted += chunk.length;
    } catch (err: any) {
      // If batch fails, try one by one
      for (const single of chunk) {
        try {
          await db.insert(musicIndustryContacts).values(single as any);
          result.inserted++;
        } catch (e: any) {
          result.errors.push(`${single.fullName}: ${e.message?.slice(0, 100)}`);
        }
      }
    }
  }

  return result;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
