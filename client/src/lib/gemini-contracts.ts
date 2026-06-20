import axios from 'axios';

export interface ContractTemplate {
  title: string;
  description: string;
  type: string;
}

export interface ContractAnalysis {
  summary: string;
  risks: string[];
  recommendations: string[];
  keyTerms: { term: string; description: string }[];
}

export interface Contract {
  id: string;
  title: string;
  content: string;
  contractType?: string;
  status: 'draft' | 'active' | 'signed' | 'expired';
  createdAt: any;
  updatedAt: any;
  userId: string;
}

// Variable to store the Clerk getToken function
let clerkGetToken: (() => Promise<string | null>) | null = null;

/**
 * Set the Clerk getToken function for authenticated requests
 */
export function setContractsAuthToken(getToken: () => Promise<string | null>) {
  clerkGetToken = getToken;
}

/**
 * Get axios config with auth headers
 */
async function getAuthConfig() {
  const config: { headers: Record<string, string> } = { headers: {} };
  
  if (clerkGetToken) {
    try {
      const token = await clerkGetToken();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to get Clerk token for contracts:', error);
    }
  }
  
  return config;
}

export async function generateContract(params: {
  contractType: string;
  artistName: string;
  clientName?: string;
  projectDetails?: string;
  paymentTerms?: string;
  duration?: string;
  additionalClauses?: string;
}): Promise<string> {
  const config = await getAuthConfig();
  const response = await axios.post('/api/contracts/generate', params, config);
  return response.data.content;
}

export async function analyzeContract(contractText: string): Promise<ContractAnalysis> {
  const config = await getAuthConfig();
  const response = await axios.post('/api/contracts/analyze', { contractText }, config);
  return response.data.analysis;
}

export async function getContractTemplates(): Promise<Record<string, ContractTemplate>> {
  const config = await getAuthConfig();
  const response = await axios.get('/api/contracts/templates', config);
  return response.data.templates;
}

export async function generateFromTemplate(
  templateType: string,
  customParams: Record<string, string>
): Promise<string> {
  const config = await getAuthConfig();
  const response = await axios.post('/api/contracts/generate-template', {
    templateType,
    customParams
  }, config);
  return response.data.content;
}

export async function saveContract(data: {
  title: string;
  content: string;
  contractType?: string;
  status?: 'draft' | 'active' | 'signed' | 'expired';
}): Promise<{ id: string }> {
  const config = await getAuthConfig();
  const response = await axios.post('/api/contracts', data, config);
  return { id: response.data.id };
}

export async function getUserContracts(): Promise<Contract[]> {
  const config = await getAuthConfig();
  const response = await axios.get('/api/contracts', config);
  return response.data.contracts;
}

export async function getContract(id: string): Promise<Contract> {
  const config = await getAuthConfig();
  const response = await axios.get(`/api/contracts/${id}`, config);
  return response.data.contract;
}

export async function updateContract(id: string, data: Partial<Contract>): Promise<void> {
  const config = await getAuthConfig();
  await axios.patch(`/api/contracts/${id}`, data, config);
}

export async function deleteContract(id: string): Promise<void> {
  const config = await getAuthConfig();
  await axios.delete(`/api/contracts/${id}`, config);
}

// =====================================================================
// Legal Shield AI — chat assistant + risk audit
// =====================================================================

export interface LegalRedFlag {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  issue: string;
  fix: string;
}

export interface LegalAssistantResponse {
  answer: string;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  redFlags: LegalRedFlag[];
  actionableSteps: string[];
  citations: string[];
  needsLawyer: boolean;
  lawyerSpecialty: string | null;
}

export interface RiskShieldReport {
  protectionScore: number;
  totalContracts: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  perContract: Array<{
    contractId: string;
    contractTitle: string;
    score: number;
    topIssues: LegalRedFlag[];
  }>;
  platformWideRecommendations: string[];
}

export async function askLegalAssistant(payload: {
  question: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  contractContext?: string;
  userProfile?: { artistName?: string; country?: string; plan?: string; hasContracts?: number };
}): Promise<LegalAssistantResponse> {
  const config = await getAuthConfig();
  const response = await axios.post('/api/contracts/legal-assistant', payload, config);
  return response.data;
}

export async function getRiskShieldReport(): Promise<RiskShieldReport> {
  const config = await getAuthConfig();
  const response = await axios.get('/api/contracts/risk-shield', config);
  return response.data;
}
