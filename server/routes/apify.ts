import { Request, Response } from 'express';
import { Express } from 'express';
import { ApifyClient } from 'apify-client';
import { authenticate } from '../middleware/auth';
import { db } from '@db';
import { z } from 'zod';
import { auth, db as firebaseDb } from '../firebase';
import { Timestamp } from 'firebase-admin/firestore';

// Define validation schema for request body
const contactExtractionSchema = z.object({
  searchTerm: z.string().min(1),
  locality: z.string().min(1),
  maxPages: z.number().int().min(1).max(5).default(1),
  category: z.enum(['radio', 'tv', 'movie', 'publishing', 'other']).default('other')
});

// Define the schema for industry contacts
export const industryContactSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.string()),
  title: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  category: z.enum(['radio', 'tv', 'movie', 'publishing', 'other']).default('other'),
  locality: z.string().optional(),
  notes: z.string().optional(),
  extractedAt: z.date().default(() => new Date()),
  userId: z.string()
});

export type IndustryContact = z.infer<typeof industryContactSchema>;

// Extraction limits configuration
const DAILY_EXTRACTION_LIMIT = 5;

/**
 * Setup Apify related API routes
 */
export function setupApifyRoutes(app: Express) {
  // Get Apify token from environment
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY;
  
  if (!APIFY_TOKEN) {
    console.error('APIFY_API_TOKEN is not configured in environment variables');
  } else {
    console.log('APIFY_API_TOKEN is configured and ready for use');
  }
  
  // Initialize the ApifyClient with token from environment variables
  const getApifyClient = () => {
    // Always get a fresh token from environment to ensure we have the latest
    return new ApifyClient({
      token: process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY,
    });
  };

  /**
   * Check user's extraction limits
   * Handles daily extraction limits with admin override
   */
  async function checkExtractionLimits(userId: string): Promise<{ 
    canExtract: boolean; 
    remaining: number; 
    isAdmin: boolean;
  }> {
    try {
      // Check if the user is an admin
      const userDoc = await firebaseDb.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const isAdmin = userData?.role === 'admin' || userData?.isAdmin === true;
      
      // Admins always get extraction access
      if (isAdmin) {
        return { canExtract: true, remaining: 999, isAdmin: true };
      }
      
      // For regular users, check their daily limits
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Query extraction logs for the current day
      const extractionLogsRef = firebaseDb.collection('extraction_logs');
      const snapshot = await extractionLogsRef
        .where('userId', '==', userId)
        .where('timestamp', '>=', today)
        .get();
      
      const extractionsToday = snapshot.size;
      const remaining = Math.max(0, DAILY_EXTRACTION_LIMIT - extractionsToday);
      
      return {
        canExtract: remaining > 0,
        remaining,
        isAdmin: false
      };
    } catch (error) {
      console.error('Error checking extraction limits:', error);
      // Default to allowing extraction if we can't check (with limit)
      return { canExtract: true, remaining: 1, isAdmin: false };
    }
  }

  /**
   * Log an extraction attempt
   */
  async function logExtraction(userId: string, category: string, searchTerm: string, locality: string, maxPages: number): Promise<void> {
    try {
      await firebaseDb.collection('extraction_logs').add({
        userId,
        category,
        searchTerm,
        locality,
        maxPages,
        timestamp: new Date(),
        success: true
      });
    } catch (error) {
      console.error('Error logging extraction:', error);
    }
  }

  /**
   * Get extraction limits for the authenticated user
   */
  app.get('/api/contacts/limits', authenticate, async (req: Request, res: Response) => {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.uid) {
        console.log('User not authenticated in /api/contacts/limits');
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      const userId = req.user.uid;
      const { canExtract, remaining, isAdmin } = await checkExtractionLimits(userId);
      
      return res.status(200).json({
        success: true,
        remaining,
        isAdmin,
        canExtract
      });
    } catch (error) {
      console.error('Error getting extraction limits:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get extraction limits',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Reset extraction limits for a user (admin only)
   */
  app.post('/api/contacts/reset-limits', authenticate, async (req: Request, res: Response) => {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.uid) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      // Check if the user is an admin
      const userDoc = await firebaseDb.collection('users').doc(req.user.uid).get();
      const userData = userDoc.data();
      const isAdmin = userData?.role === 'admin' || userData?.isAdmin === true;
      
      if (!isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: 'Only administrators can reset extraction limits' 
        });
      }
      
      // Get the target user ID from request body
      const targetUserId = req.body.userId || null;
      
      if (!targetUserId) {
        return res.status(400).json({ 
          success: false, 
          message: 'User ID is required' 
        });
      }
      
      // Delete all extraction logs for the target user
      const extractionLogsRef = firebaseDb.collection('extraction_logs');
      const snapshot = await extractionLogsRef.where('userId', '==', targetUserId).get();
      
      const batch = firebaseDb.batch();
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      return res.status(200).json({
        success: true,
        message: `Extraction limits reset for user ${targetUserId}`
      });
    } catch (error) {
      console.error('Error resetting extraction limits:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reset extraction limits',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Extract contacts using Apify and save to database
   * Protected route - requires authentication
   */
  app.post('/api/contacts/extract', authenticate, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = contactExtractionSchema.parse(req.body);
      const { searchTerm, locality, maxPages, category } = validatedData;
      
      // Ensure user is authenticated
      if (!req.user || !req.user.uid) {
        console.error('User not authenticated in /api/contacts/extract');
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      const userId = req.user.uid;
      console.log(`Processing contact extraction for user ${userId}`);
      
      // Check extraction limits
      const { canExtract, remaining, isAdmin } = await checkExtractionLimits(userId);
      
      // Regular users get max page restriction
      const actualMaxPages = isAdmin ? maxPages : Math.min(1, maxPages);
      
      // Check if the user has reached their extraction limit
      if (!canExtract && !isAdmin) {
        return res.status(429).json({
          success: false,
          message: 'Daily extraction limit reached',
          remaining: 0
        });
      }
      
      // Check if Apify token is available
      if (!process.env.APIFY_API_TOKEN && !process.env.APIFY_API_KEY) {
        console.error('Apify API token not found in environment');
        return res.status(500).json({ 
          success: false, 
          message: 'Apify API token not configured. Please contact administrator.' 
        });
      }
      
      // Get the apify client
      const apifyClient = getApifyClient();
      
      // For movie contacts, we use yellow-pages-scraper to get better data
      // Yellow Pages has more structured business data than general Google search
      // Formulate an actor-appropriate search query based on category
      let actorToRun = "krish_patel~yellow-pages-scraper-withemail";
      
      // Prepare Actor input based on category
      let input;
      if (category === 'movie') {
        input = {
          "search": `${searchTerm} film production`,
          "location": locality,
          "pageLimit": actualMaxPages,
          "includeEmail": true,
          "extractWebsite": true
        };
      } else if (category === 'tv') {
        input = {
          "search": `${searchTerm} tv network`,
          "location": locality,
          "pageLimit": actualMaxPages,
          "includeEmail": true,
          "extractWebsite": true
        };
      } else if (category === 'radio') {
        input = {
          "search": `${searchTerm} radio station`,
          "location": locality,
          "pageLimit": actualMaxPages,
          "includeEmail": true,
          "extractWebsite": true
        };
      } else {
        // For other categories, fall back to general Google Search
        actorToRun = "apify/google-search-scraper";
        input = {
          "queries": [`${searchTerm} in ${locality}`],
          "maxPagesPerQuery": actualMaxPages,
          "resultsPerPage": 10,
          "mobileResults": false,
          "languageCode": "en",
          "countryCode": "us",
          "maxConcurrency": 1,
          "saveHtml": false,
          "saveHtmlToKeyValueStore": false
        };
      }

      // Run the Actor and wait for it to finish
      console.log(`Starting Apify actor run for search: ${searchTerm} in ${locality}`);
      const run = await apifyClient.actor(actorToRun).call(input);
      console.log(`Apify run completed, dataset ID: ${run.defaultDatasetId}`);

      // Fetch results from the run's dataset
      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
      console.log(`Retrieved ${items.length} contacts from Apify`);
      
      // Log the extraction attempt
      await logExtraction(userId, category, searchTerm, locality, actualMaxPages);
      
      // Process and save the results
      const savedContacts = [];
      
      for (const item of items) {
        try {
          // Each scraper returns data in a different format
          // We need to map the fields correctly
          let processedContact: IndustryContact;
          
          if (actorToRun === "krish_patel~yellow-pages-scraper-withemail") {
            // Yellow Pages scraper data format
            processedContact = {
              name: typeof item.name === 'string' ? item.name : 
                    typeof item.businessName === 'string' ? item.businessName : 'Unknown',
              email: typeof item.email === 'string' ? item.email : undefined,
              phone: typeof item.phone === 'string' ? item.phone : undefined,
              website: typeof item.website === 'string' ? item.website : undefined,
              title: undefined, // Yellow Pages doesn't provide individual titles
              company: typeof item.name === 'string' ? item.name : 
                      typeof item.businessName === 'string' ? item.businessName : undefined,
              address: typeof item.address === 'string' ? item.address : locality,
              category,
              locality,
              notes: `Extracted from Yellow Pages search: ${searchTerm} in ${locality}`,
              extractedAt: new Date(),
              userId
            };
          } else {
            // Google Search scraper data format
            processedContact = {
              name: typeof item.title === 'string' ? item.title : 'Unknown',
              email: undefined, // Google Search doesn't provide emails directly
              phone: undefined, // Google Search doesn't provide phones directly
              website: typeof item.url === 'string' ? item.url : undefined,
              title: undefined, // Google Search doesn't provide individual titles
              company: typeof item.title === 'string' ? item.title : undefined,
              address: locality, // Google Search doesn't provide addresses directly
              category,
              locality,
              notes: `Extracted from Google search: ${searchTerm} in ${locality}`,
              extractedAt: new Date(),
              userId
            };
          }
        
          // Validate the contact before saving
          const validatedContact = industryContactSchema.parse(processedContact);
        
          // Save to Firebase Firestore
          await firebaseDb.collection('contacts').add({
            ...validatedContact,
            extractedAt: new Date(),  // Convert Date to Firestore Timestamp
            createdAt: Timestamp.now() // Using Firebase Admin SDK Timestamp
          });
          
          // Add to response array
          savedContacts.push(validatedContact);
        } catch (error) {
          console.error('Error processing contact:', error);
        }
      }
      
      return res.status(200).json({ 
        success: true, 
        message: `Successfully extracted ${savedContacts.length} contacts`, 
        contacts: savedContacts,
        remaining: remaining - 1
      });
    } catch (error) {
      console.error('Error in contact extraction:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to extract contacts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * Check the status of an Apify run
   */
  app.post('/api/contacts/run-status', authenticate, async (req: Request, res: Response) => {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.uid) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      const runId = req.body.runId;
      
      if (!runId) {
        return res.status(400).json({ success: false, message: 'Run ID is required' });
      }
      
      // Get the apify client
      const apifyClient = getApifyClient();
      
      // Get the run status
      const run = await apifyClient.run(runId).get();
      
      // Check if run exists
      if (!run) {
        return res.status(404).json({
          success: false,
          message: 'Run not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        status: run.status || 'UNKNOWN',
        finishedAt: run.finishedAt || null
      });
    } catch (error) {
      console.error('Error checking run status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check run status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * Get saved contacts for the authenticated user
   * Optionally filter by category
   */
  app.get('/api/contacts', authenticate, async (req: Request, res: Response) => {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.uid) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      const userId = req.user.uid;
      const category = req.query.category as string;
      
      // Validate category if provided
      if (category && !['radio', 'tv', 'movie', 'publishing', 'other'].includes(category)) {
        return res.status(400).json({ success: false, message: 'Invalid category' });
      }
      
      // Query Firebase for contacts
      let contactsQuery = firebaseDb.collection('contacts').where('userId', '==', userId);
      
      // Add category filter if provided
      if (category) {
        contactsQuery = contactsQuery.where('category', '==', category);
      }
      
      // Execute query
      const snapshot = await contactsQuery.get();
      
      // Format the results
      const contacts: IndustryContact[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Cast the firestore document to our type
        const contact: IndustryContact = {
          name: data.name,
          email: data.email,
          phone: data.phone,
          website: data.website,
          title: data.title,
          company: data.company,
          address: data.address,
          category: data.category,
          locality: data.locality,
          notes: data.notes,
          extractedAt: data.extractedAt?.toDate() || new Date(),
          userId: data.userId,
          id: doc.id // Add doc ID for reference
        };
        
        contacts.push(contact);
      });
      
      return res.status(200).json({ 
        success: true, 
        contacts 
      });
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch contacts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Simulated contact search for immediate results
   */
  app.get('/api/contacts/search', authenticate, async (req: Request, res: Response) => {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.uid) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      const category = req.query.category as string || 'movie';
      const query = req.query.query as string || '';
      
      if (!query || query.length < 2) {
        return res.status(200).json({ success: true, contacts: [] });
      }
      
      // Generate simulated contact search results
      const mockContacts: IndustryContact[] = [];
      
      const mockData: Record<string, Array<Partial<IndustryContact>>> = {
        movie: [
          {
            name: "Universal Pictures",
            email: "licensing@universalpictures.com",
            phone: "+1 (323) 555-1234",
            title: "Music Licensing Department",
            company: "Universal Pictures",
            website: "https://www.universalpictures.com",
            address: "100 Universal City Plaza, Universal City, CA",
            category: "movie"
          },
          {
            name: "Paramount Pictures",
            email: "music@paramount.com",
            phone: "+1 (323) 555-5678",
            title: "Music Supervisor",
            company: "Paramount Pictures",
            website: "https://www.paramount.com",
            address: "5555 Melrose Ave, Los Angeles, CA",
            category: "movie"
          },
          {
            name: "Walt Disney Studios",
            email: "music.licensing@disney.com",
            phone: "+1 (818) 555-9012",
            title: "Music Rights Department",
            company: "Walt Disney Studios",
            website: "https://www.disneystudios.com",
            address: "500 S Buena Vista St, Burbank, CA",
            category: "movie"
          }
        ],
        tv: [
          {
            name: "NBC Universal",
            email: "licensing@nbcuni.com",
            phone: "+1 (212) 555-3456",
            title: "Music Licensing",
            company: "NBC Universal",
            website: "https://www.nbcuniversal.com",
            address: "30 Rockefeller Plaza, New York, NY",
            category: "tv"
          },
          {
            name: "HBO",
            email: "music@hbo.com",
            phone: "+1 (212) 555-7890",
            title: "Music Department",
            company: "Home Box Office",
            website: "https://www.hbo.com",
            address: "30 Hudson Yards, New York, NY",
            category: "tv"
          },
          {
            name: "Netflix",
            email: "music.licensing@netflix.com",
            phone: "+1 (310) 555-2345",
            title: "Music Supervision",
            company: "Netflix",
            website: "https://www.netflix.com",
            address: "5808 W Sunset Blvd, Los Angeles, CA",
            category: "tv"
          }
        ],
        radio: [
          {
            name: "iHeartMedia",
            email: "music@iheartmedia.com",
            phone: "+1 (212) 555-6789",
            title: "Music Director",
            company: "iHeartMedia",
            website: "https://www.iheartmedia.com",
            address: "125 W 55th St, New York, NY",
            category: "radio"
          },
          {
            name: "Sirius XM",
            email: "music@siriusxm.com",
            phone: "+1 (212) 555-0123",
            title: "Music Programming",
            company: "Sirius XM Radio",
            website: "https://www.siriusxm.com",
            address: "1221 Avenue of the Americas, New York, NY",
            category: "radio"
          },
          {
            name: "NPR Music",
            email: "music@npr.org",
            phone: "+1 (202) 555-4567",
            title: "Music Acquisitions",
            company: "National Public Radio",
            website: "https://www.npr.org/music",
            address: "1111 North Capitol St NE, Washington, DC",
            category: "radio"
          }
        ]
      };
      
      // Filter contacts based on search query and category
      const categoryContacts = mockData[category] || [];
      
      for (const contact of categoryContacts) {
        const matchName = contact.name?.toLowerCase().includes(query.toLowerCase());
        const matchCompany = contact.company?.toLowerCase().includes(query.toLowerCase());
        
        if (matchName || matchCompany) {
          mockContacts.push({
            ...contact,
            id: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            locality: "Los Angeles",
            notes: "Demo contact for search functionality",
            extractedAt: new Date(),
            userId: req.user.uid
          } as IndustryContact);
        }
      }
      
      return res.status(200).json({
        success: true,
        contacts: mockContacts
      });
    } catch (error) {
      console.error('Error searching contacts:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to search contacts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}