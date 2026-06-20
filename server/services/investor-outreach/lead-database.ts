/**
 * Investor Lead Database Service
 * Manages lead storage, retrieval, and deduplication
 */

import { db, FieldValue } from '../../firebase';
import { InvestorLead, ApifyLeadSearchParams } from './types';

const LEADS_COLLECTION = 'investor_leads';
const CAMPAIGNS_COLLECTION = 'outreach_campaigns';

// ============================================
// SAVE LEADS
// ============================================
export async function saveLeads(leads: Partial<InvestorLead>[]): Promise<{ saved: number; duplicates: number }> {
  if (!db) {
    console.error('Firebase not initialized');
    return { saved: 0, duplicates: 0 };
  }
  
  let saved = 0;
  let duplicates = 0;
  
  const batch = db.batch();
  
  for (const lead of leads) {
    if (!lead.email) continue;
    
    // Check for duplicate by email
    const existing = await findLeadByEmail(lead.email);
    
    if (existing) {
      duplicates++;
      console.log(`⏭️ Duplicate: ${lead.email}`);
      continue;
    }
    
    // Create new lead
    const leadRef = db.collection(LEADS_COLLECTION).doc();
    batch.set(leadRef, {
      ...lead,
      id: leadRef.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'new',
      emailsSent: 0,
      source: lead.source || 'apify',
    });
    
    saved++;
  }
  
  await batch.commit();
  console.log(`💾 Saved ${saved} leads, ${duplicates} duplicates skipped`);
  
  return { saved, duplicates };
}

// ============================================
// FIND LEAD BY EMAIL
// ============================================
export async function findLeadByEmail(email: string): Promise<InvestorLead | null> {
  if (!email || !db) return null;
  
  const snapshot = await db.collection(LEADS_COLLECTION)
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as InvestorLead;
}

// ============================================
// GET LEADS BY STATUS
// ============================================
export async function getLeadsByStatus(
  status: InvestorLead['status'],
  limit: number = 100
): Promise<InvestorLead[]> {
  if (!db) return [];
  const snapshot = await db.collection(LEADS_COLLECTION)
    .where('status', '==', status)
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  } as InvestorLead));
}

// ============================================
// GET NEW LEADS FOR OUTREACH
// ============================================
export async function getNewLeadsForOutreach(limit: number = 100): Promise<InvestorLead[]> {
  if (!db) return [];
  
  // Simplified query - just get 'new' status leads, filter in memory
  const snapshot = await db.collection(LEADS_COLLECTION)
    .where('status', '==', 'new')
    .limit(limit * 2) // Get more to filter
    .get();
  
  const leads = snapshot.docs
    .map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    } as InvestorLead))
    .filter((lead: InvestorLead) => (lead.emailsSent || 0) < 3)
    .sort((a: InvestorLead, b: InvestorLead) => {
      // Sort by emailsSent first, then by createdAt
      const emailDiff = (a.emailsSent || 0) - (b.emailsSent || 0);
      if (emailDiff !== 0) return emailDiff;
      const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return aDate.getTime() - bDate.getTime();
    })
    .slice(0, limit);
  
  return leads;
}

// ============================================
// GET LEADS FOR FOLLOW-UP
// ============================================
export async function getLeadsForFollowUp(daysAfterInitial: number): Promise<InvestorLead[]> {
  if (!db) return [];
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAfterInitial);
  
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const snapshot = await db.collection(LEADS_COLLECTION)
    .where('status', '==', 'contacted')
    .where('lastContactedAt', '>=', startOfDay)
    .where('lastContactedAt', '<=', endOfDay)
    .get();
  
  return snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  } as InvestorLead));
}

// ============================================
// UPDATE LEAD STATUS
// ============================================
export async function updateLeadStatus(
  leadId: string,
  status: InvestorLead['status'],
  additionalData?: Partial<InvestorLead>
): Promise<void> {
  if (!db) return;
  await db.collection(LEADS_COLLECTION).doc(leadId).update({
    status,
    updatedAt: new Date(),
    ...additionalData,
  });
}

// ============================================
// MARK LEAD AS RESPONDED
// ============================================
export async function markLeadAsResponded(leadId: string): Promise<void> {
  await updateLeadStatus(leadId, 'responded', {
    respondedAt: new Date(),
  });
}

// ============================================
// MARK LEAD AS CONVERTED
// ============================================
export async function markLeadAsConverted(leadId: string, investmentAmount?: number): Promise<void> {
  await updateLeadStatus(leadId, 'converted', {
    convertedAt: new Date(),
    investmentAmount,
  });
}

// ============================================
// GET OUTREACH STATISTICS
// ============================================
export async function getOutreachStats(): Promise<{
  totalLeads: number;
  byStatus: Record<string, number>;
  totalEmailsSent: number;
  responseRate: number;
  conversionRate: number;
}> {
  if (!db) {
    return { totalLeads: 0, byStatus: {}, totalEmailsSent: 0, responseRate: 0, conversionRate: 0 };
  }
  const allLeads = await db.collection(LEADS_COLLECTION).get();
  
  const byStatus: Record<string, number> = {
    new: 0,
    contacted: 0,
    responded: 0,
    converted: 0,
    bounced: 0,
    unsubscribed: 0,
  };
  
  let totalEmailsSent = 0;
  let responded = 0;
  let converted = 0;
  
  allLeads.docs.forEach((doc: any) => {
    const data = doc.data();
    byStatus[data.status] = (byStatus[data.status] || 0) + 1;
    totalEmailsSent += data.emailsSent || 0;
    if (data.status === 'responded') responded++;
    if (data.status === 'converted') converted++;
  });
  
  const contacted = byStatus.contacted + byStatus.responded + byStatus.converted;
  
  return {
    totalLeads: allLeads.size,
    byStatus,
    totalEmailsSent,
    responseRate: contacted > 0 ? (responded / contacted) * 100 : 0,
    conversionRate: contacted > 0 ? (converted / contacted) * 100 : 0,
  };
}

// ============================================
// CAMPAIGN MANAGEMENT
// ============================================
export async function createCampaign(name: string, searchParams: ApifyLeadSearchParams): Promise<string> {
  if (!db) return '';
  const campaignRef = db.collection(CAMPAIGNS_COLLECTION).doc();
  
  await campaignRef.set({
    id: campaignRef.id,
    name,
    searchParams,
    status: 'active',
    leadsCollected: 0,
    emailsSent: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  return campaignRef.id;
}

export async function updateCampaignStats(campaignId: string, leadsCollected: number, emailsSent: number): Promise<void> {
  if (!db) return;
  await db.collection(CAMPAIGNS_COLLECTION).doc(campaignId).update({
    leadsCollected: FieldValue.increment(leadsCollected),
    emailsSent: FieldValue.increment(emailsSent),
    updatedAt: new Date(),
  });
}

// ============================================
// BULK IMPORT LEADS
// ============================================
export async function importLeadsFromCSV(leads: Array<{
  fullName: string;
  email: string;
  company?: string;
  title?: string;
  investorType?: string;
}>): Promise<{ imported: number; duplicates: number }> {
  if (!db) return { imported: 0, duplicates: 0 };
  let imported = 0;
  let duplicates = 0;
  
  for (const leadData of leads) {
    const existing = await findLeadByEmail(leadData.email);
    
    if (existing) {
      duplicates++;
      continue;
    }
    
    const lead: Partial<InvestorLead> = {
      fullName: leadData.fullName,
      email: leadData.email.toLowerCase(),
      company: leadData.company,
      title: leadData.title,
      investorType: (leadData.investorType as InvestorLead['investorType']) || 'music_tech_investor',
      source: 'csv_import',
      status: 'new',
      emailsSent: 0,
      createdAt: new Date(),
    };
    
    await db.collection(LEADS_COLLECTION).add(lead);
    imported++;
  }
  
  return { imported, duplicates };
}

// ============================================
// CLEANUP OLD LEADS
// ============================================
export async function archiveOldLeads(daysOld: number = 90): Promise<number> {
  if (!db) return 0;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const snapshot = await db.collection(LEADS_COLLECTION)
    .where('status', 'in', ['bounced', 'unsubscribed'])
    .where('updatedAt', '<', cutoffDate)
    .get();
  
  const batch = db.batch();
  
  snapshot.docs.forEach((doc: any) => {
    const archiveRef = db.collection('archived_leads').doc(doc.id);
    batch.set(archiveRef, { ...doc.data(), archivedAt: new Date() });
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  
  return snapshot.size;
}

export default {
  saveLeads,
  findLeadByEmail,
  getLeadsByStatus,
  getNewLeadsForOutreach,
  getLeadsForFollowUp,
  updateLeadStatus,
  markLeadAsResponded,
  markLeadAsConverted,
  getOutreachStats,
  createCampaign,
  updateCampaignStats,
  importLeadsFromCSV,
  archiveOldLeads,
};
