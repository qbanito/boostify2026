/**
 * Contact Enrichment Service
 * Uses Hunter.io API to find and verify email addresses for sponsor contacts.
 * Fallback: direct website crawl via Apify.
 */

import { db } from '../db';
import { sponsorContacts } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const HUNTER_API_KEY = process.env.HUNTER_API_KEY || '';
const HUNTER_BASE_URL = 'https://api.hunter.io/v2';

interface EnrichmentResult {
  email?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  confidence?: number;
  source?: string;
}

/**
 * Find emails at a domain using Hunter.io Domain Search
 * Returns the most relevant marketing/partnerships contact
 */
async function hunterDomainSearch(domain: string): Promise<EnrichmentResult | null> {
  if (!HUNTER_API_KEY) return null;

  try {
    const url = `${HUNTER_BASE_URL}/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(HUNTER_API_KEY)}&type=personal&limit=5`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const emails = data.data?.emails || [];
    if (emails.length === 0) return null;

    // Prioritize marketing/partnership roles
    const priorityKeywords = ['marketing', 'partner', 'brand', 'sponsor', 'media', 'pr', 'communication', 'business'];
    const priorityContact = emails.find((e: any) =>
      priorityKeywords.some(k =>
        (e.position || '').toLowerCase().includes(k) ||
        (e.department || '').toLowerCase().includes(k)
      )
    );

    const best = priorityContact || emails[0];
    return {
      email: best.value,
      firstName: best.first_name || undefined,
      lastName: best.last_name || undefined,
      position: best.position || undefined,
      confidence: best.confidence || 0,
      source: 'hunter_domain_search',
    };
  } catch (error) {
    console.error('❌ Hunter.io domain search error:', error);
    return null;
  }
}

/**
 * Verify an email address using Hunter.io Email Verifier
 */
async function hunterVerifyEmail(email: string): Promise<{ valid: boolean; score: number }> {
  if (!HUNTER_API_KEY) return { valid: true, score: 0 };

  try {
    const url = `${HUNTER_BASE_URL}/email-verifier?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(HUNTER_API_KEY)}`;
    const response = await fetch(url);
    if (!response.ok) return { valid: true, score: 0 };

    const data = await response.json();
    const result = data.data?.result || 'unknown';
    const score = data.data?.score || 0;

    return {
      valid: result !== 'undeliverable',
      score,
    };
  } catch {
    return { valid: true, score: 0 };
  }
}

/**
 * Enrich a single sponsor contact — find their email if missing, or verify existing
 */
export async function enrichContact(contactId: number): Promise<{
  success: boolean;
  enriched: boolean;
  email?: string;
  contactName?: string;
  contactRole?: string;
}> {
  const contact = await db.select().from(sponsorContacts).where(eq(sponsorContacts.id, contactId)).limit(1);
  if (!contact[0]) return { success: false, enriched: false };

  const c = contact[0];

  // If we already have an email, verify it
  if (c.contactEmail) {
    const verification = await hunterVerifyEmail(c.contactEmail);
    if (!verification.valid) {
      console.log(`⚠️ Email ${c.contactEmail} for ${c.brandName} is undeliverable`);
      await db.update(sponsorContacts).set({
        status: 'blacklisted',
        updatedAt: new Date(),
      }).where(eq(sponsorContacts.id, contactId));
    }
    return { success: true, enriched: false, email: c.contactEmail };
  }

  // Try to find email via Hunter.io from the website domain
  if (c.website) {
    let domain: string;
    try {
      domain = new URL(c.website).hostname.replace('www.', '');
    } catch {
      return { success: false, enriched: false };
    }

    const result = await hunterDomainSearch(domain);
    if (result?.email) {
      const updateData: Record<string, any> = {
        contactEmail: result.email,
        updatedAt: new Date(),
      };
      if (result.firstName || result.lastName) {
        updateData.contactName = [result.firstName, result.lastName].filter(Boolean).join(' ');
      }
      if (result.position) {
        updateData.contactRole = result.position;
      }

      await db.update(sponsorContacts).set(updateData).where(eq(sponsorContacts.id, contactId));

      return {
        success: true,
        enriched: true,
        email: result.email,
        contactName: updateData.contactName,
        contactRole: result.position,
      };
    }
  }

  return { success: true, enriched: false };
}

/**
 * Bulk enrich all contacts that are missing emails
 */
export async function bulkEnrichContacts(userId: number): Promise<{
  total: number;
  enriched: number;
  errors: number;
}> {
  if (!HUNTER_API_KEY) {
    console.warn('⚠️ HUNTER_API_KEY not set — skipping bulk enrichment');
    return { total: 0, enriched: 0, errors: 0 };
  }

  const contacts = await db.select({ id: sponsorContacts.id })
    .from(sponsorContacts)
    .where(and(
      eq(sponsorContacts.addedByUserId, userId),
      isNull(sponsorContacts.contactEmail),
    ));

  let enriched = 0, errors = 0;
  for (const contact of contacts) {
    try {
      const result = await enrichContact(contact.id);
      if (result.enriched) enriched++;
    } catch {
      errors++;
    }
    // Rate limit: 1 request per second for Hunter.io free tier
    await new Promise(resolve => setTimeout(resolve, 1100));
  }

  return { total: contacts.length, enriched, errors };
}

/** Check if Hunter.io enrichment is available */
export function isEnrichmentConfigured(): boolean {
  return !!HUNTER_API_KEY;
}
