/**
 * 🎵 BOOSTIFY MUSIC - ARTIST LEAD SCRAPER
 * 
 * Usa Apify actor: code_crafter/leads-finder
 * Para extraer leads de artistas y músicos
 * 
 * Separado del sistema de inversores
 */

import { ApifyClient } from 'apify-client';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { ArtistLead, ARTIST_COLLECTION_NAME } from './artist-email-templates';

// Initialize Apify client
const APIFY_API_KEY = process.env.APIFY_API_KEY || 'apify_api_nrudThRO1hQ9XCTFzUZkRI0VKCcSkv2h3mYq';
const apifyClient = new ApifyClient({ token: APIFY_API_KEY });

// Initialize Firebase Admin
function initFirebaseAdmin() {
  if (getApps().length === 0) {
    // Try to load service account from file
    const serviceAccountPath = path.join(process.cwd(), 'attached_assets', 'artist-boost-firebase-adminsdk-fbsvc-c4227e7d7b_1763184143691.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized with service account');
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized from environment variable');
    } else {
      throw new Error('No Firebase service account found');
    }
  }
  return getFirestore();
}

// Apify actor configuration for artist lead finding
interface ArtistLeadFinderInput {
  searchQueries: string[];
  sources?: string[];
  maxResults?: number;
  includeEmails?: boolean;
  includeSocialProfiles?: boolean;
  filters?: {
    hasEmail?: boolean;
    minFollowers?: number;
    platforms?: string[];
  };
}

// Raw lead from Apify
interface RawArtistLead {
  email?: string;
  name?: string;
  artistName?: string;
  genre?: string;
  platform?: string;
  followers?: number;
  instagram?: string;
  spotify?: string;
  youtube?: string;
  website?: string;
  bio?: string;
  location?: string;
  [key: string]: any;
}

/**
 * Run Apify actor to scrape artist leads
 */
export async function scrapeArtistLeads(input: ArtistLeadFinderInput): Promise<RawArtistLead[]> {
  console.log('🎵 Starting Apify actor: code_crafter/leads-finder');
  console.log('📋 Search queries:', input.searchQueries);

  const run = await apifyClient.actor('code_crafter/leads-finder').call({
    searchQueries: input.searchQueries,
    maxResults: input.maxResults || 100,
    includeEmails: input.includeEmails ?? true,
    includeSocialProfiles: input.includeSocialProfiles ?? true,
    sources: input.sources || ['instagram', 'spotify', 'youtube', 'soundcloud'],
    filters: input.filters || {
      hasEmail: true,
      minFollowers: 100,
    },
  });

  console.log(`✅ Actor run completed. Run ID: ${run.id}`);

  // Get dataset items
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
  console.log(`📊 Retrieved ${items.length} artist leads from Apify`);

  return items as RawArtistLead[];
}

/**
 * Import artist leads from Apify dataset to Firestore
 */
export async function importArtistLeadsToFirestore(datasetId?: string, rawLeads?: RawArtistLead[]): Promise<number> {
  const db = initFirebaseAdmin();
  
  let leads: RawArtistLead[] = rawLeads || [];
  
  // If dataset ID provided, fetch from Apify
  if (datasetId && !rawLeads) {
    console.log(`📥 Fetching leads from Apify dataset: ${datasetId}`);
    const { items } = await apifyClient.dataset(datasetId).listItems();
    leads = items as RawArtistLead[];
  }

  if (leads.length === 0) {
    console.log('⚠️ No leads to import');
    return 0;
  }

  console.log(`📤 Importing ${leads.length} artist leads to Firestore...`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches of 500 (Firestore limit)
  const batchSize = 500;
  const batches = [];
  
  for (let i = 0; i < leads.length; i += batchSize) {
    batches.push(leads.slice(i, i + batchSize));
  }

  for (const batchLeads of batches) {
    const batch = db.batch();
    
    for (const rawLead of batchLeads) {
      // Skip if no email
      if (!rawLead.email) {
        skipped++;
        continue;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rawLead.email)) {
        skipped++;
        continue;
      }

      try {
        // Check if lead already exists
        const existingDoc = await db
          .collection(ARTIST_COLLECTION_NAME)
          .where('email', '==', rawLead.email.toLowerCase())
          .limit(1)
          .get();

        if (!existingDoc.empty) {
          skipped++;
          continue;
        }

        // Create artist lead document
        const artistLead: Omit<ArtistLead, 'id'> = {
          email: rawLead.email.toLowerCase(),
          name: rawLead.name || extractNameFromEmail(rawLead.email),
          artistName: rawLead.artistName || rawLead.name,
          genre: rawLead.genre,
          platform: rawLead.platform || detectPlatform(rawLead),
          followers: rawLead.followers,
          source: 'apify_leads_finder',
          status: 'new',
          currentSequence: 0,
          createdAt: new Date(),
          metadata: {
            instagram: rawLead.instagram,
            spotify: rawLead.spotify,
            youtube: rawLead.youtube,
            website: rawLead.website,
            bio: rawLead.bio,
            location: rawLead.location,
            importedAt: new Date().toISOString(),
          },
        };

        const docRef = db.collection(ARTIST_COLLECTION_NAME).doc();
        batch.set(docRef, {
          ...artistLead,
          id: docRef.id,
          createdAt: FieldValue.serverTimestamp(),
        });
        
        imported++;
      } catch (error) {
        errors++;
        console.error(`❌ Error processing lead ${rawLead.email}:`, error);
      }
    }

    await batch.commit();
    console.log(`📦 Batch committed: ${imported} leads imported so far`);
  }

  console.log('\n📊 Import Summary:');
  console.log(`   ✅ Imported: ${imported}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);

  return imported;
}

/**
 * Import artist leads from a local JSON file
 */
export async function importFromJsonFile(filePath: string): Promise<number> {
  console.log(`📂 Reading leads from file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(fileContent);
  
  // Handle different JSON structures
  let leads: RawArtistLead[] = [];
  if (Array.isArray(data)) {
    leads = data;
  } else if (data.items && Array.isArray(data.items)) {
    leads = data.items;
  } else if (data.data && Array.isArray(data.data)) {
    leads = data.data;
  }

  console.log(`📋 Found ${leads.length} leads in file`);
  return importArtistLeadsToFirestore(undefined, leads);
}

// Helper functions
function extractNameFromEmail(email: string): string {
  const localPart = email.split('@')[0];
  return localPart
    .replace(/[._-]/g, ' ')
    .replace(/\d+/g, '')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim() || 'Artista';
}

function detectPlatform(lead: RawArtistLead): string {
  if (lead.spotify) return 'spotify';
  if (lead.instagram) return 'instagram';
  if (lead.youtube) return 'youtube';
  if (lead.website) return 'website';
  return 'unknown';
}

/**
 * Predefined search queries for finding artist leads
 */
export const ARTIST_SEARCH_QUERIES = {
  spanish: [
    'artista musical independiente contacto',
    'músico emergente email',
    'cantante latino spotify',
    'productor musical contacto',
    'banda indie española email',
    'rapero urbano contacto',
    'artista reggaeton email',
    'dj productor latino',
    'cantautor hispano contacto',
    'músico profesional email',
  ],
  english: [
    'independent music artist contact email',
    'emerging musician spotify',
    'indie artist contact',
    'hip hop artist email',
    'electronic producer contact',
    'r&b singer email',
    'pop artist emerging',
    'rock band indie email',
    'music producer contact info',
    'unsigned artist email',
  ],
  genres: [
    'reggaeton artista email',
    'trap latino productor contacto',
    'rock en español banda email',
    'pop latino cantante contacto',
    'hip hop español email',
    'electronic dj contacto',
    'r&b urbano artista email',
    'indie folk músico contacto',
    'metal band contact email',
    'jazz musician emerging email',
  ],
};

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  async function main() {
    switch (command) {
      case 'scrape': {
        const queryType = (args[1] as keyof typeof ARTIST_SEARCH_QUERIES) || 'spanish';
        const queries = ARTIST_SEARCH_QUERIES[queryType] || ARTIST_SEARCH_QUERIES.spanish;
        
        console.log(`🎵 Starting artist lead scraping with ${queryType} queries...`);
        
        const leads = await scrapeArtistLeads({
          searchQueries: queries,
          maxResults: 500,
          includeEmails: true,
          includeSocialProfiles: true,
        });
        
        const imported = await importArtistLeadsToFirestore(undefined, leads);
        console.log(`\n✅ Completed! Imported ${imported} artist leads.`);
        break;
      }
      
      case 'import-dataset': {
        const datasetId = args[1];
        if (!datasetId) {
          console.error('❌ Please provide dataset ID: npm run artist-scraper import-dataset <datasetId>');
          process.exit(1);
        }
        
        const imported = await importArtistLeadsToFirestore(datasetId);
        console.log(`\n✅ Completed! Imported ${imported} artist leads from dataset.`);
        break;
      }
      
      case 'import-file': {
        const filePath = args[1];
        if (!filePath) {
          console.error('❌ Please provide file path: npm run artist-scraper import-file <path>');
          process.exit(1);
        }
        
        const imported = await importFromJsonFile(filePath);
        console.log(`\n✅ Completed! Imported ${imported} artist leads from file.`);
        break;
      }
      
      default:
        console.log(`
🎵 BOOSTIFY MUSIC - Artist Lead Scraper

Usage:
  npx ts-node scripts/artist-outreach/apify-artist-scraper.ts <command> [options]

Commands:
  scrape [queryType]         Run Apify actor to find artist leads
                            queryType: spanish (default), english, genres
  
  import-dataset <id>        Import leads from an existing Apify dataset
  
  import-file <path>         Import leads from a local JSON file

Examples:
  npx ts-node scripts/artist-outreach/apify-artist-scraper.ts scrape spanish
  npx ts-node scripts/artist-outreach/apify-artist-scraper.ts import-dataset abc123xyz
  npx ts-node scripts/artist-outreach/apify-artist-scraper.ts import-file ./leads.json
        `);
    }
  }

  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { apifyClient };
