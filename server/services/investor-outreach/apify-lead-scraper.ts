/**
 * Apify Lead Scraper Service
 * Extracts investor leads using PipelineLabs Lead Scraper (Apollo/ZoomInfo/Lusha)
 * 
 * Actor: pipelinelabs/lead-scraper-apollo-zoominfo-lusha-ppe
 * Dataset: ebsl5vr8G0Y7lDBEV
 */

import { ApifyClient } from 'apify-client';
import { InvestorLead, ApifyLeadSearchParams } from './types';
import { v4 as uuidv4 } from 'uuid';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_KEY,
});

// The working actor for lead scraping
const LEAD_SCRAPER_ACTOR = 'pipelinelabs/lead-scraper-apollo-zoominfo-lusha-ppe';

// Your existing dataset with leads
const DEFAULT_DATASET_ID = 'ebsl5vr8G0Y7lDBEV';

// Target profiles for music industry investors
export const MUSIC_INDUSTRY_SEARCH_CONFIGS: ApifyLeadSearchParams[] = [
  {
    keywords: ['music tech investor', 'music startup investor', 'entertainment VC'],
    industries: ['Venture Capital', 'Music', 'Entertainment'],
    titles: ['Partner', 'Managing Director', 'Principal', 'Investor', 'CEO', 'Founder'],
    maxResults: 50,
  },
  {
    keywords: ['record label executive', 'music publisher', 'A&R director'],
    industries: ['Music', 'Entertainment', 'Media'],
    titles: ['CEO', 'President', 'VP', 'Director', 'Head of', 'SVP', 'EVP'],
    maxResults: 50,
  },
  {
    keywords: ['music technology', 'audio streaming', 'music distribution'],
    industries: ['Technology', 'Music', 'Software'],
    titles: ['CEO', 'Founder', 'CTO', 'VP Business Development', 'Chief Strategy Officer'],
    maxResults: 50,
  },
  {
    keywords: ['angel investor music', 'entertainment angel', 'media investor'],
    industries: ['Angel Investment', 'Entertainment', 'Media'],
    titles: ['Angel Investor', 'Investor', 'Advisor', 'Board Member'],
    maxResults: 50,
  },
  {
    keywords: ['music industry consultant', 'entertainment advisor', 'music business'],
    industries: ['Consulting', 'Music', 'Entertainment'],
    titles: ['Consultant', 'Advisor', 'Principal', 'Managing Partner'],
    maxResults: 50,
  },
];

// ============================================
// MAIN SCRAPER - Using PipelineLabs Lead Scraper
// ============================================
export async function scrapeLeadsWithPipelineLabs(params: ApifyLeadSearchParams): Promise<Partial<InvestorLead>[]> {
  try {
    console.log(`📊 Scraping leads for: ${params.keywords.join(', ')}`);
    
    // Build the search input for PipelineLabs actor
    const input = {
      searchQuery: params.keywords.join(' '),
      titles: params.titles || [],
      industries: params.industries || [],
      locations: params.locations || ['United States'],
      maxResults: params.maxResults || 50,
    };
    
    const run = await apifyClient.actor(LEAD_SCRAPER_ACTOR).call(input, {
      timeoutSecs: 300, // 5 minutes timeout
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    console.log(`✅ Found ${items.length} leads`);
    
    return items.map((item: any) => mapLeadFromApify(item, params));
  } catch (error: any) {
    console.error(`❌ Error scraping leads:`, error.message);
    return [];
  }
}

// Legacy aliases for backward compatibility
export const scrapeLinkedInLeads = scrapeLeadsWithPipelineLabs;
export const scrapeCrunchbaseInvestors = async (category: string = 'music'): Promise<Partial<InvestorLead>[]> => {
  return scrapeLeadsWithPipelineLabs({
    keywords: [category, 'investor'],
    industries: ['Venture Capital'],
    titles: ['Partner', 'Managing Director', 'Investor'],
    maxResults: 50,
  });
};

// ============================================
// GET LEADS FROM EXISTING DATASET
// ============================================
export async function getLeadsFromDataset(datasetId: string = DEFAULT_DATASET_ID): Promise<Partial<InvestorLead>[]> {
  try {
    console.log(`📥 Fetching leads from dataset: ${datasetId}`);
    
    const { items } = await apifyClient.dataset(datasetId).listItems();
    
    console.log(`✅ Found ${items.length} leads in dataset`);
    
    return items.map((item: any) => mapLeadFromApify(item));
  } catch (error: any) {
    console.error(`❌ Error fetching dataset:`, error.message);
    return [];
  }
}

// ============================================
// MAP APIFY ITEM TO INVESTOR LEAD
// ============================================
function mapLeadFromApify(item: any, params?: ApifyLeadSearchParams): Partial<InvestorLead> {
  // Handle different field names from various sources (Apollo, ZoomInfo, Lusha, etc.)
  const firstName = item.firstName || item.first_name || item.name?.split(' ')[0] || '';
  const lastName = item.lastName || item.last_name || item.name?.split(' ').slice(1).join(' ') || '';
  const email = item.email || item.emailAddress || item.work_email || item.personal_email || '';
  const company = item.company || item.companyName || item.organization || item.employer || '';
  const title = item.title || item.jobTitle || item.position || item.headline || '';
  const industry = item.industry || (params?.industries?.[0]) || '';
  
  // Determine investor type based on title/industry
  let investorType: InvestorLead['investorType'] = undefined;
  const titleLower = title.toLowerCase();
  const industryLower = industry.toLowerCase();
  
  if (titleLower.includes('partner') || titleLower.includes('vc') || industryLower.includes('venture')) {
    investorType = 'vc_fund';
  } else if (industryLower.includes('music') || titleLower.includes('a&r') || titleLower.includes('label')) {
    investorType = 'record_label';
  } else if (titleLower.includes('angel') || titleLower.includes('investor')) {
    investorType = 'angel_investor';
  } else if (titleLower.includes('consultant') || titleLower.includes('advisor')) {
    investorType = 'industry_consultant';
  }
  
  return {
    id: uuidv4(),
    email: email.toLowerCase().trim(),
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim() || item.name || '',
    company,
    title,
    linkedInUrl: item.linkedInUrl || item.linkedin_url || item.linkedin || item.profile_url || '',
    industry,
    location: item.location || item.city || item.country || '',
    investorType,
    source: 'apify',
    sourceUrl: item.profileUrl || item.url || '',
    createdAt: new Date(),
    emailsSent: 0,
    status: 'new',
    personalizedData: {
      recentNews: item.recentNews || item.bio || item.summary || '',
    },
  };
}

// ============================================
// EMAIL FINDER
// ============================================
export async function findEmail(firstName: string, lastName: string, company: string): Promise<string | null> {
  try {
    const domain = await findCompanyDomain(company);
    if (!domain) return null;

    // Use Hunter.io via Apify if available
    const run = await apifyClient.actor('drobnikj/hunter-email-finder').call({
      firstName,
      lastName,
      domain,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    const firstItem = items[0] as Record<string, any> | undefined;
    return (firstItem?.email as string) || null;
  } catch (error) {
    console.error('Error finding email:', error);
    return null;
  }
}

// Helper to find company domain
async function findCompanyDomain(companyName: string): Promise<string | null> {
  try {
    const run = await apifyClient.actor('apify/google-search-scraper').call({
      queries: [`${companyName} official website`],
      maxPagesPerQuery: 1,
      resultsPerPage: 3,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    const firstItem = items[0] as Record<string, any> | undefined;
    const firstResult = firstItem?.organicResults?.[0];
    
    if (firstResult?.link) {
      const url = new URL(firstResult.link);
      return url.hostname.replace('www.', '');
    }
    return null;
  } catch (error) {
    return null;
  }
}

// ============================================
// COLLECT ALL LEADS - Main function
// ============================================
export async function collectAllLeads(): Promise<Partial<InvestorLead>[]> {
  console.log('🎯 Starting investor lead collection...');
  const allLeads: Partial<InvestorLead>[] = [];

  // First, try to get leads from existing dataset
  console.log('📥 Checking existing dataset...');
  const datasetLeads = await getLeadsFromDataset();
  if (datasetLeads.length > 0) {
    allLeads.push(...datasetLeads);
    console.log(`✅ Loaded ${datasetLeads.length} leads from dataset`);
  }

  // Optionally, scrape new leads from search configs
  for (const config of MUSIC_INDUSTRY_SEARCH_CONFIGS) {
    console.log(`📊 Scraping leads for: ${config.keywords.join(', ')}`);
    const newLeads = await scrapeLeadsWithPipelineLabs(config);
    allLeads.push(...newLeads);
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Deduplicate by email and LinkedIn URL
  const uniqueLeads = deduplicateLeads(allLeads);
  
  console.log(`✅ Collected ${uniqueLeads.length} unique leads`);
  return uniqueLeads;
}

// ============================================
// DEDUPLICATE LEADS
// ============================================
function deduplicateLeads(leads: Partial<InvestorLead>[]): Partial<InvestorLead>[] {
  const seen = new Set<string>();
  return leads.filter(lead => {
    const key = lead.email || lead.linkedInUrl || `${lead.fullName}-${lead.company}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================
// SAMPLE LEADS FOR TESTING
// ============================================
export function getSampleLeads(): Partial<InvestorLead>[] {
  return [
    {
      id: uuidv4(),
      email: 'investor@example.com',
      firstName: 'John',
      lastName: 'Smith',
      fullName: 'John Smith',
      company: 'Music Tech Ventures',
      title: 'Managing Partner',
      industry: 'Venture Capital',
      location: 'Los Angeles, CA',
      investorType: 'vc_fund',
      source: 'manual' as const,
      createdAt: new Date(),
      emailsSent: 0,
      status: 'new' as const,
    },
    {
      id: uuidv4(),
      email: 'ar@examplelabel.com',
      firstName: 'Sarah',
      lastName: 'Johnson',
      fullName: 'Sarah Johnson',
      company: 'Indie Records',
      title: 'A&R Director',
      industry: 'Music',
      location: 'Nashville, TN',
      investorType: 'record_label',
      source: 'manual' as const,
      createdAt: new Date(),
      emailsSent: 0,
      status: 'new' as const,
    },
    {
      id: uuidv4(),
      email: 'angel@example.com',
      firstName: 'Michael',
      lastName: 'Chen',
      fullName: 'Michael Chen',
      company: 'Chen Investments',
      title: 'Angel Investor',
      industry: 'Angel Investment',
      location: 'Miami, FL',
      investorType: 'angel_investor',
      source: 'manual' as const,
      createdAt: new Date(),
      emailsSent: 0,
      status: 'new' as const,
    },
  ];
}

// ============================================
// IMPORT FROM CSV
// ============================================
export function parseCSVLeads(csvContent: string): Partial<InvestorLead>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const leads: Partial<InvestorLead>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const leadData: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      leadData[header] = values[index] || '';
    });
    
    // Map CSV columns to InvestorLead fields
    const email = leadData.email || leadData.emailaddress || leadData['email address'] || '';
    const firstName = leadData.firstname || leadData['first name'] || leadData.first || leadData.name?.split(' ')[0] || '';
    const lastName = leadData.lastname || leadData['last name'] || leadData.last || leadData.name?.split(' ').slice(1).join(' ') || '';
    
    if (!email) continue; // Skip entries without email
    
    leads.push({
      id: uuidv4(),
      email,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim() || leadData.name || '',
      company: leadData.company || leadData.organization || leadData.companyname || '',
      title: leadData.title || leadData.position || leadData.jobtitle || '',
      linkedInUrl: leadData.linkedin || leadData.linkedinurl || '',
      industry: leadData.industry || '',
      location: leadData.location || leadData.city || '',
      source: 'csv_import' as const,
      createdAt: new Date(),
      emailsSent: 0,
      status: 'new' as const,
    });
  }
  
  return leads;
}

// ============================================
// ENRICH LEAD WITH ADDITIONAL DATA
// ============================================
export async function enrichLead(lead: Partial<InvestorLead>): Promise<InvestorLead> {
  // Try to find email if missing
  if (!lead.email && lead.firstName && lead.lastName && lead.company) {
    lead.email = await findEmail(lead.firstName, lead.lastName, lead.company) || '';
  }

  // Search for recent news about the person/company
  try {
    const newsSearch = await apifyClient.actor('apify/google-search-scraper').call({
      queries: [`${lead.fullName} ${lead.company} news 2025 2026`],
      maxPagesPerQuery: 1,
      resultsPerPage: 3,
    });

    const { items } = await apifyClient.dataset(newsSearch.defaultDatasetId).listItems();
    const firstItem = items[0] as Record<string, any> | undefined;
    const recentNews = firstItem?.organicResults?.[0]?.title || null;
    
    if (recentNews) {
      lead.personalizedData = {
        ...lead.personalizedData,
        recentNews,
      };
    }
  } catch (error) {
    // Ignore enrichment errors
  }

  return lead as InvestorLead;
}

// ============================================
// EXPORTS
// ============================================
export default {
  collectAllLeads,
  scrapeLeadsWithPipelineLabs,
  scrapeLinkedInLeads,
  scrapeCrunchbaseInvestors,
  getLeadsFromDataset,
  findEmail,
  enrichLead,
  getSampleLeads,
  parseCSVLeads,
  MUSIC_INDUSTRY_SEARCH_CONFIGS,
  DEFAULT_DATASET_ID,
};
