import { z } from 'zod';
import { logger } from "./logger";
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { User } from 'firebase/auth';

// Define the expected data structure from the Apollo API
interface ApolloResult {
  name?: string;
  email?: string;
  organization?: {
    name?: string;
  };
  title?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
}

const contactSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  category: z.string(),
  socialMedia: z.object({
    linkedin: z.string().optional(),
    twitter: z.string().optional(),
    instagram: z.string().optional()
  }).optional(),
  userId: z.string().optional(),
  savedAt: z.date().optional()
});

export type Contact = z.infer<typeof contactSchema>;

export const contactCategories = [
  'Record Labels',
  'Media',
  'Event Promoters',
  'Managers',
  'PR Agencies',
  'Music Influencers',
  'Music Blogs',
  'Radio',
  'Streaming Platforms'
] as const;

// Preloaded local contacts from CSV
const localContacts: Contact[] = [
  {
    name: "RAULEETO 🇵🇷",
    email: "booking@duars.com",
    phone: "+17876446046",
    category: "Artists"
  },
  {
    name: "Eladio Carrion",
    email: "Eladio@mtbooking.com",
    phone: "+14074011159",
    category: "Artists"
  },
  {
    name: "DIMELO FLOW",
    email: "bookings@richmusicltd.com",
    phone: "+18666072113",
    category: "Managers"
  },
  {
    name: "LOS CHAPUSEROS",
    email: "Loschapuserosoficial@gmail.com",
    phone: "+5351948026",
    category: "Artists"
  },
  {
    name: "Vibra Urbana",
    email: "help@vibraurbanafest.com",
    phone: "+13055752722",
    category: "Event Promoters"
  },
  {
    name: "Trap House Latino 🏚",
    email: "TrapHouseLatino@gmail.com",
    phone: "+17875293480",
    category: "Media"
  },
  {
    name: "GLAD Empire",
    email: "info@gladempire.com",
    phone: "+18337774523",
    category: "Record Labels"
  },
  {
    name: "Radio Moda",
    email: "radiomodatemueve@gmail.com",
    phone: "+51989001211",
    category: "Radio"
  },
  {
    name: "PINA RECORDS 🎼",
    email: "booking@pinarecords.net",
    phone: "+17877431100",
    category: "Record Labels"
  },
  {
    name: "Los Dos Carnales",
    email: "2carnalesoficial@gmail.com",
    phone: "+524431878559",
    category: "Artists"
  }
];

export async function searchContacts(category: string, query: string): Promise<Contact[]> {
  try {
    if (!import.meta.env.VITE_APIFY_API_KEY) {
      // If no API key, return only filtered local results
      return localContacts.filter(contact => 
        (category === 'All' || contact.category === category) &&
        (contact.name.toLowerCase().includes(query.toLowerCase()) ||
         contact.email?.toLowerCase().includes(query.toLowerCase()) ||
         contact.company?.toLowerCase().includes(query.toLowerCase()))
      );
    }

    // If API key exists, combine local results with Apify search
    const response = await fetch('https://api.apify.com/v2/acts/jljBwyyQakqrL1wae/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_APIFY_API_KEY}`
      },
      body: JSON.stringify({
        url: `https://app.apollo.io/#/people?finderViewId=5b8050d050a3893c382e9360&page=1&sortByField=recommendations_score`,
        totalRecords: 100,
        getWorkEmails: true,
        getPersonalEmails: true,
        searchQuery: `${category} ${query} music industry`,
        filters: {
          industryTags: ['Music', 'Entertainment', 'Media']
        }
      })
    });

    if (!response.ok) {
      throw new Error('Error searching contacts');
    }

    const runData = await response.json();
    const datasetId = runData.data.defaultDatasetId;

    const itemsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${import.meta.env.VITE_APIFY_API_KEY}`
    );

    if (!itemsResponse.ok) {
      throw new Error('Error getting results');
    }

    const items = await itemsResponse.json() as ApolloResult[];
    const apifyContacts = items.map(item => ({
      name: item.name || 'Unknown',
      email: item.email,
      company: item.organization?.name,
      role: item.title,
      category: category,
      socialMedia: {
        linkedin: item.linkedin,
        twitter: item.twitter,
        instagram: item.instagram
      }
    }));

    // Combine and filter local and Apify results
    return [...localContacts, ...apifyContacts].filter(contact => 
      (category === 'All' || contact.category === category) &&
      (contact.name.toLowerCase().includes(query.toLowerCase()) ||
       contact.email?.toLowerCase().includes(query.toLowerCase()) ||
       contact.company?.toLowerCase().includes(query.toLowerCase()))
    );

  } catch (error) {
    logger.error('Error searching contacts:', error);
    // In case of error, return only filtered local results
    return localContacts.filter(contact => 
      (category === 'All' || contact.category === category) &&
      (contact.name.toLowerCase().includes(query.toLowerCase()) ||
       contact.email?.toLowerCase().includes(query.toLowerCase()) ||
       contact.company?.toLowerCase().includes(query.toLowerCase()))
    );
  }
}

export async function saveContact(user: User, contact: Contact): Promise<void> {
  if (!user?.uid) {
    throw new Error('User not authenticated');
  }

  const contactData = {
    ...contact,
    userId: user.uid,
    savedAt: new Date()
  };

  const contactRef = doc(collection(db, 'contacts'));
  await setDoc(contactRef, contactData);
}

export async function getSavedContacts(user: User): Promise<Contact[]> {
  if (!user?.uid) {
    throw new Error('User not authenticated');
  }

  const contactsRef = collection(db, 'contacts');
  const q = query(contactsRef, where('userId', '==', user.uid));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => ({
    ...doc.data() as Contact,
    id: doc.id
  }));
}

export async function checkApifyRun(runId: string): Promise<any> {
  const response = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${import.meta.env.VITE_APIFY_API_TOKEN}`
  );

  if (!response.ok) {
    throw new Error('Error checking view process status');
  }

  return response.json();
}