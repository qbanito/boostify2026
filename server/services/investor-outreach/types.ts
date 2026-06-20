// Types for Investor Outreach System

export interface InvestorLead {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  company: string;
  title: string;
  linkedInUrl?: string;
  industry: string;
  subIndustry?: string;
  location?: string;
  companySize?: string;
  investmentFocus?: string[];
  portfolioCompanies?: string[];
  investorType?: 'vc_fund' | 'record_label' | 'angel_investor' | 'music_tech_investor' | 'industry_consultant';
  source: 'apify' | 'linkedin' | 'crunchbase' | 'manual' | 'csv_import';
  sourceUrl?: string;
  createdAt: Date;
  lastContactedAt?: Date;
  respondedAt?: Date;
  convertedAt?: Date;
  investmentAmount?: number;
  emailsSent: number;
  status: 'new' | 'contacted' | 'replied' | 'interested' | 'not_interested' | 'bounced' | 'responded' | 'converted' | 'unsubscribed';
  lastError?: string;
  notes?: string;
  personalizedData?: {
    recentNews?: string;
    commonConnections?: string[];
    relevantInvestments?: string[];
    companyMilestones?: string[];
  };
  updatedAt?: Date;
}

export interface EmailCampaign {
  id: string;
  name: string;
  templateId: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  targetAudience: string[];
  dailyLimit: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  preheader?: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  category: 'cold_outreach' | 'follow_up' | 'warm_intro' | 'investor_update';
  abVariant?: 'A' | 'B' | 'C' | 'D' | 'E';
  performance?: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
  };
}

export interface EmailSendResult {
  success: boolean;
  leadId: string;
  email: string;
  messageId?: string;
  error?: string;
  sentAt: Date;
}

export interface OutreachConfig {
  dailyEmailLimit: number;
  sendingHoursStart: number; // UTC hour
  sendingHoursEnd: number;
  delayBetweenEmails: number; // seconds
  maxRetriesPerLead: number;
  followUpDays: number[];
}

export interface ApifyLeadSearchParams {
  keywords: string[];
  industries?: string[];
  titles?: string[];
  locations?: string[];
  companyTypes?: string[];
  maxResults?: number;
}
