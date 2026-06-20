import { z } from "zod";
import { logger } from "../logger";
import { db, auth } from "../../firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp, DocumentData } from "firebase/firestore";
import { User } from "firebase/auth";
import { getAuthToken } from "../../lib/auth";
// MOVED TO SERVER: ApifyClient is now called via /api/apify endpoints
// This prevents bundling Node.js-only packages in the browser

/**
 * Extract an email address from a text string
 * @param text Text to search for an email address
 * @returns First found email address or undefined if none found
 */
function extractEmailFromText(text: string): string | undefined {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  const match = text.match(emailRegex);
  return match ? match[0] : undefined;
}

/**
 * Extract social media handles from text
 * @param network Social network to extract (twitter, instagram, linkedin)
 * @param text Text to search for social media handles
 * @returns Handle for the specified network or undefined if none found
 */
function extractSocialFromText(network: string, text: string): string | undefined {
  let regex;
  let prefix;
  
  switch (network.toLowerCase()) {
    case 'twitter':
      // Look for twitter.com/username or @username
      regex = /(?:twitter\.com\/|^|[^\w@])@?(\w{1,15})(?!\w)/i;
      prefix = 'https://twitter.com/';
      break;
    case 'instagram':
      // Look for instagram.com/username or @username
      regex = /(?:instagram\.com\/|^|[^\w@])@?(\w{1,30})(?!\w)/i;
      prefix = 'https://instagram.com/';
      break;
    case 'linkedin':
      // Look for linkedin.com/in/username
      regex = /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i;
      prefix = 'https://linkedin.com/in/';
      break;
    default:
      return undefined;
  }
  
  const match = text.match(regex);
  return match ? `${prefix}${match[1]}` : undefined;
}

// Define contact schema
export const contactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  website: z.string().url().optional().or(z.string()),
  address: z.string().optional(),
  notes: z.string().optional(),
  category: z.enum(["radio", "tv", "movie", "publishing", "other"]).default("other"),
  instagram: z.string().optional(),
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  locality: z.string().optional(),
  extractedAt: z.date().default(() => new Date()),
});

export type Contact = z.infer<typeof contactSchema>;

export const contactCategories = [
  { value: "radio", label: "Radio" },
  { value: "tv", label: "TV" },
  { value: "movie", label: "Movie" },
  { value: "publishing", label: "Publishing" },
  { value: "other", label: "Other" }
];

/**
 * Retrieves extraction limits for the current user
 * @returns Promise containing remaining extractions and limit status
 */
export async function getExtractionLimits(): Promise<{ 
  remaining: number; 
  limitReached: boolean; 
  isAdmin: boolean 
}> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Not authenticated");
    }
    
    const response = await fetch('/api/contacts/limits', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching extraction limits: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      remaining: data.remaining || 0,
      limitReached: data.remaining <= 0,
      isAdmin: data.isAdmin || false
    };
  } catch (error) {
    logger.error("Error getting extraction limits:", error);
    return {
      remaining: 0,
      limitReached: true,
      isAdmin: false
    };
  }
}

/**
 * Extract contacts through the Apify API 
 * @param searchTerm Term to search for
 * @param locality Geographic location to search in
 * @param category Category of contacts to search for
 * @param maxPages Maximum number of pages to crawl (admin only)
 * @returns Promise with extracted contacts
 */
// NOTE: ApifyClient functionality has been moved to server-side at server/routes/apify.ts
// This prevents bundling Node.js-only modules in the client bundle
// All Apify operations now go through API endpoints only

/**
 * Extract contacts through the server API route
 * @param searchTerm Term to search for
 * @param locality Geographic location to search in
 * @param category Category of contacts to search for
 * @param maxPages Maximum number of pages to crawl (admin only)
 * @returns Promise with extracted contacts
 */
export async function extractContacts(
  searchTerm: string,
  locality: string,
  category: "radio" | "tv" | "movie" | "publishing" | "other",
  maxPages: number = 1
): Promise<Contact[]> {
  try {
    // Always use server API for Apify operations to avoid bundling Node.js modules
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Not authenticated");
    }
    
    const response = await fetch('/api/contacts/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        searchTerm,
        locality,
        maxPages,
        category
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`API error (${response.status}): ${errorText}`);
      throw new Error(response.status === 429 
        ? "Extraction limit reached" 
        : `Error extracting contacts: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || "Error extracting contacts");
    }
    
    return data.contacts.map((contact: any) => ({
      ...contact,
      extractedAt: new Date(contact.extractedAt)
    }));
  } catch (error) {
    logger.error("Error extracting contacts:", error);
    throw error;
  }
}

/**
 * Gets search suggestions based on partial query
 */
export async function searchContacts(category: string, query: string): Promise<Contact[]> {
  if (!query || query.length < 2) return [];
  
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Not authenticated");
    }
    
    const response = await fetch(`/api/contacts/search?category=${category}&query=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error searching contacts: ${response.status}`);
    }
    
    const data = await response.json();
    return data.contacts.map((contact: any) => ({
      ...contact,
      extractedAt: new Date(contact.extractedAt)
    }));
  } catch (error) {
    logger.error("Error searching contacts:", error);
    
    // Fallback to local mock data if the API fails
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockContacts: Contact[] = [
      {
        name: "John Smith",
        email: "john@example.com",
        phone: "+1 555-123-4567",
        title: "Music Director",
        company: "KEXP Radio",
        category: "radio" as const,
        extractedAt: new Date()
      },
      {
        name: "Sarah Johnson",
        email: "sarah@example.com",
        phone: "+1 555-234-5678",
        title: "Licensing Manager",
        company: "Universal Pictures",
        category: "movie" as const,
        extractedAt: new Date()
      }
    ];
    
    return mockContacts.filter(contact => 
      contact.category === category && 
      (contact.name.toLowerCase().includes(query.toLowerCase()) || 
       contact.company?.toLowerCase().includes(query.toLowerCase()) ||
       contact.title?.toLowerCase().includes(query.toLowerCase()))
    );
  }
}

/**
 * Saves a contact to the user's database
 * @param user Current Firebase user
 * @param contact Contact to save
 */
export async function saveContact(user: User, contact: Contact): Promise<void> {
  try {
    await addDoc(collection(db, "contacts"), {
      ...contact,
      userId: user.uid,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    logger.error("Error saving contact:", error);
    throw new Error("Failed to save contact");
  }
}

/**
 * Gets all contacts saved by the current user
 * @param user Current Firebase user
 * @param category Optional category filter
 */
export async function getSavedContacts(user: User, category?: string): Promise<Contact[]> {
  try {
    let q = query(collection(db, "contacts"), where("userId", "==", user.uid));
    
    if (category) {
      q = query(q, where("category", "==", category));
    }
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Make sure we have all required fields and convert Firebase Timestamp to Date
      const contact: Contact = {
        name: data.name,
        category: data.category || 'other',
        extractedAt: data.extractedAt?.toDate() || new Date(),
        // Optional fields
        email: data.email,
        phone: data.phone,
        title: data.title,
        company: data.company,
        website: data.website,
        address: data.address,
        notes: data.notes,
        instagram: data.instagram,
        twitter: data.twitter,
        linkedin: data.linkedin,
        locality: data.locality,
        // Add ID for reference
        id: doc.id as any
      };
      return contact;
    });
  } catch (error) {
    logger.error("Error getting saved contacts:", error);
    throw new Error("Failed to get saved contacts");
  }
}

/**
 * Check the status of an Apify web scraping run
 * @param runId ID of the Apify run to check
 */
export async function checkApifyRun(runId: string): Promise<any> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Not authenticated");
    }
    
    const response = await fetch('/api/contacts/run-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ runId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to check run status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error("Error checking Apify run:", error);
    throw error;
  }
}

/**
 * Reset extraction limits (admin only)
 */
export async function resetExtractionLimits(userId?: string): Promise<boolean> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Not authenticated");
    }
    
    const response = await fetch('/api/contacts/reset-limits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to reset limits: ${response.status}`);
    }
    
    const data = await response.json();
    return data.success || false;
  } catch (error) {
    logger.error("Error resetting extraction limits:", error);
    return false;
  }
}