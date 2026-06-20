/**
 * Apify Venue Scraper Service
 * Scrapes venues (bars, nightclubs, restaurants, event spaces) from Google Maps
 * using the lukaskrivka/google-maps-with-contact-details Apify actor.
 */

import { ApifyClient } from 'apify-client';
import { db } from '../db';
import { venueContacts, type InsertVenueContact } from '../db/schema';
import { eq } from 'drizzle-orm';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || '';
const apifyClient = new ApifyClient({ token: APIFY_TOKEN });

const ACTOR_ID = 'lukaskrivka/google-maps-with-contact-details';
const DEFAULT_DATASET_ID = 'OakLyvnfYcgaOYDgv';

export interface VenueSearchParams {
  locationQuery: string;
  searchStringsArray: string[];
  maxCrawledPlacesPerSearch?: number;
  language?: string;
  skipClosedPlaces?: boolean;
}

export interface ScrapedVenue {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  googleRating?: number;
  totalReviews?: number;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  categories?: string[];
  openingHours?: string[];
  imageUrl?: string;
}

/** Map Google categories to our enum */
function detectCategory(categories: string[]): InsertVenueContact['category'] {
  const joined = categories.join(' ').toLowerCase();
  if (/night\s?club|disco|discoteca|club nocturno/.test(joined)) return 'nightclub';
  if (/bar|pub|cocktail|cervecería|tavern/.test(joined)) return 'bar';
  if (/restaurant|restaurante|bistro|café|diner|pizz|grill|sushi/.test(joined)) return 'restaurant';
  if (/lounge|rooftop/.test(joined)) return 'lounge';
  if (/hotel|resort|hostel/.test(joined)) return 'hotel';
  if (/event|venue|convention|banquet|sala|concert|theater|teatro|festival/.test(joined)) return 'event_venue';
  if (/theater|teatro|amphitheater/.test(joined)) return 'theater';
  return 'other';
}

/** Extract city from full address */
function extractCity(address: string | undefined, locationQuery: string): string {
  if (!address) return locationQuery.split(',')[0]?.trim() || '';
  const parts = address.split(',').map(p => p.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

/** Extract country from address */
function extractCountry(address: string | undefined): string {
  if (!address) return '';
  const parts = address.split(',').map(p => p.trim());
  return parts.length >= 1 ? parts[parts.length - 1] : '';
}

export class ApifyVenueScraperService {

  isConfigured(): boolean {
    return !!APIFY_TOKEN;
  }

  /**
   * Load venues from an existing Apify dataset (no new scrape needed)
   */
  async loadFromDataset(datasetId?: string): Promise<ScrapedVenue[]> {
    if (!this.isConfigured()) throw new Error('APIFY_API_TOKEN is not configured. Check .env has APIFY_API_TOKEN or APIFY_API_KEY set.');

    const dsId = datasetId || DEFAULT_DATASET_ID;
    console.log(`📦 Loading venues from existing dataset: ${dsId}`);

    const { items } = await apifyClient.dataset(dsId).listItems();
    if (!items?.length) {
      console.log('⚠️ No items in dataset');
      return [];
    }

    console.log(`✅ Loaded ${items.length} venues from dataset`);

    return items.map((item: any) => ({
      name: item.title || item.name || 'Unknown Venue',
      address: item.address || item.street || undefined,
      city: extractCity(item.address, ''),
      country: extractCountry(item.address),
      phone: item.phone || item.phoneUnformatted || undefined,
      email: item.email || item.emails?.[0] || undefined,
      website: item.website || item.url || undefined,
      googleRating: item.totalScore || item.rating || undefined,
      totalReviews: item.reviewsCount || item.reviews || undefined,
      placeId: item.placeId || item.cid || undefined,
      latitude: item.location?.lat || item.latitude || undefined,
      longitude: item.location?.lng || item.longitude || undefined,
      categories: item.categories || item.categoryName ? [item.categoryName] : [],
      openingHours: item.openingHours ? Object.entries(item.openingHours).map(([day, hours]) => `${day}: ${hours}`) : undefined,
      imageUrl: item.imageUrl || item.thumbnailUrl || undefined,
    }));
  }

  /**
   * Search venues on Google Maps via Apify
   */
  async searchVenues(params: VenueSearchParams): Promise<ScrapedVenue[]> {
    if (!this.isConfigured()) throw new Error('APIFY_API_TOKEN is not configured. Check .env has APIFY_API_TOKEN or APIFY_API_KEY set.');

    console.log(`🔍 Searching venues in "${params.locationQuery}" for: ${params.searchStringsArray.join(', ')}`);

    const run = await apifyClient.actor(ACTOR_ID).call({
      language: params.language || 'en',
      locationQuery: params.locationQuery,
      maxCrawledPlacesPerSearch: params.maxCrawledPlacesPerSearch || 100,
      searchStringsArray: params.searchStringsArray,
      skipClosedPlaces: params.skipClosedPlaces ?? false,
    }, { waitSecs: 300 });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    if (!items?.length) {
      console.log('⚠️ No venues found');
      return [];
    }

    console.log(`✅ Found ${items.length} venues from Google Maps`);

    return items.map((item: any) => ({
      name: item.title || item.name || 'Unknown Venue',
      address: item.address || item.street || undefined,
      city: extractCity(item.address, params.locationQuery),
      country: extractCountry(item.address),
      phone: item.phone || item.phoneUnformatted || undefined,
      email: item.email || item.emails?.[0] || undefined,
      website: item.website || item.url || undefined,
      googleRating: item.totalScore || item.rating || undefined,
      totalReviews: item.reviewsCount || item.reviews || undefined,
      placeId: item.placeId || item.cid || undefined,
      latitude: item.location?.lat || item.latitude || undefined,
      longitude: item.location?.lng || item.longitude || undefined,
      categories: item.categories || item.categoryName ? [item.categoryName] : [],
      openingHours: item.openingHours ? Object.entries(item.openingHours).map(([day, hours]) => `${day}: ${hours}`) : undefined,
      imageUrl: item.imageUrl || item.thumbnailUrl || undefined,
    }));
  }

  /**
   * Save scraped venues to database with deduplication by placeId
   */
  async saveVenues(venues: ScrapedVenue[], userId: number, searchQuery: string, apifyRunId?: string): Promise<{
    saved: number;
    duplicates: number;
    errors: number;
  }> {
    let saved = 0, duplicates = 0, errors = 0;

    for (const venue of venues) {
      try {
        // Deduplicate by placeId
        if (venue.placeId) {
          const existing = await db.select({ id: venueContacts.id })
            .from(venueContacts)
            .where(eq(venueContacts.placeId, venue.placeId))
            .limit(1);
          if (existing.length > 0) { duplicates++; continue; }
        }

        await db.insert(venueContacts).values({
          name: venue.name,
          address: venue.address || null,
          city: venue.city || null,
          country: venue.country || null,
          phone: venue.phone || null,
          email: venue.email || null,
          website: venue.website || null,
          googleRating: venue.googleRating || null,
          totalReviews: venue.totalReviews || 0,
          placeId: venue.placeId || null,
          latitude: venue.latitude || null,
          longitude: venue.longitude || null,
          category: detectCategory(venue.categories || []),
          categories: venue.categories || [],
          openingHours: venue.openingHours || null,
          imageUrl: venue.imageUrl || null,
          importSource: 'apify_google_maps',
          apifyRunId: apifyRunId || null,
          searchQuery,
          addedByUserId: userId,
          status: 'new',
        });
        saved++;
      } catch (err: any) {
        if (err?.code === '23505') { duplicates++; } // unique constraint
        else { console.error(`❌ Error saving venue ${venue.name}:`, err.message); errors++; }
      }
    }

    console.log(`✅ Venues saved: ${saved}, duplicates: ${duplicates}, errors: ${errors}`);
    return { saved, duplicates, errors };
  }
}

export const apifyVenueScraper = new ApifyVenueScraperService();
