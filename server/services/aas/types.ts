/**
 * AAS Engine — Shared Types v2.1
 * Autonomous Artist Survival System
 * Connected to: FAL AI, Printful, Brevo, Chrome Extensions, Contact DBs,
 *               Music/Album Art Agents, Social Network, Blockchain, Radio
 */

// === Agent Names ===
export type AASAgentName = 
  | 'survival-strategist'
  | 'revenue-operator'
  | 'deal-closer'
  | 'growth-operator'
  | 'community-operator'
  | 'risk-compliance'
  | 'finance-controller'
  | 'content-creator'
  | 'social-operator'
  | 'blockchain-operator';

// === Priority Mode (what the system focuses on today) ===
export type PriorityMode = 
  | 'sell'            // Push revenue NOW
  | 'grow'            // Expand audience  
  | 'close_deal'      // Focus on pipeline
  | 'launch'          // New product/release
  | 'content'         // Build brand/content
  | 'recover_leads'   // Re-engage cold leads
  | 'cut_costs'       // Reduce burn rate
  | 'outreach'        // Heavy email outreach to contacts
  | 'content_blitz'   // Multi-platform content burst
  | 'radio_push'      // Push for radio plays
  | 'blockchain_ops'; // Blockchain registration/tokenization

// === Daily Goal Category ===
export type GoalCategory =
  | 'radio_outreach'
  | 'label_deal'
  | 'social_post'
  | 'social_engage'
  | 'blockchain_register'
  | 'blockchain_tokenize'
  | 'blockchain_trade'
  | 'sponsor_outreach'
  | 'venue_booking'
  | 'content_create'
  | 'fan_engage'
  | 'email_campaign'
  | 'music_release'
  | 'merch_launch';

// === Daily Goal ===
export interface DailyGoal {
  category: GoalCategory;
  title: string;
  description?: string;
  targetCount: number;
  agent: AASAgentName;
  channel: string;
  priority: number;
}

// === Daily Goal Status (from DB) ===
export interface DailyGoalStatus {
  id: number;
  category: GoalCategory;
  title: string;
  description?: string;
  targetCount: number;
  completedCount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  agent?: string;
  channel?: string;
  priority: number;
  result?: string;
  metadata?: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
}

// === Daily Diagnostic Input ===
export interface DailyDiagnosticInput {
  artistId: number;
  artistName: string;
  genre: string;
  isAIGenerated: boolean;

  // Financial snapshot
  cashAvailable: number;
  totalEarnings: number;
  totalSpent: number;
  weeklyRevenue: number;
  weeklyCosts: number;
  runwayDays: number;
  burnRate: number;

  // Pipeline
  activeDeals: number;
  dealsClosedThisWeek: number;
  avgDealValue: number;

  // Audience
  totalFans: number;
  netFanGrowth: number;
  churnRate: number;
  emailsCaptured: number;

  // Content
  contentPublished: number;
  topPerformingChannel: string;
  engagementRate: number;

  // Survival
  currentSurvivalScore: number;
  survivalScoreTrend: 'up' | 'down' | 'stable';

  // Strategic memory (top insights)
  topInsights: string[];
}

// === Daily Plan Output ===
export interface DailyPlan {
  objectives: string[];
  priorityMode: PriorityMode;
  actions: PlannedAction[];
  maxBudget: number;
  reasoning: string;
}

export interface PlannedAction {
  action: string;
  agent: AASAgentName;
  channel: string;
  budgetAllocated: number;
  priority: number; // 1-5, 1 = highest
  expectedOutcome: string;
}

// === Survival Score Calculation ===
export interface SurvivalScoreComponents {
  revenueHealth: number;      // 0-100
  pipelineStrength: number;   // 0-100
  audienceMomentum: number;   // 0-100
  brandRelevance: number;     // 0-100
  dealVelocity: number;       // 0-100
  burnRate: number;           // 0-100 (higher = worse)
  legalRiskScore: number;     // 0-100 (higher = worse)
  churnRate: number;          // 0-100 (higher = worse)
  contentFatigue: number;     // 0-100 (higher = worse)
}

export interface SurvivalScore {
  total: number;  // Net score 0-100
  components: SurvivalScoreComponents;
  status: 'thriving' | 'healthy' | 'surviving' | 'at_risk' | 'critical';
}

// === Financial Snapshot ===
export interface FinancialSnapshot {
  cashAvailable: number;
  totalEarnings: number;
  totalSpent: number;
  dailyBurnRate: number;
  weeklyBurnRate: number;
  runwayDays: number;
  revenueByChannel: Record<string, number>;
  costByCategory: Record<string, number>;
  isAboveSurvivalThreshold: boolean;
}

// === Action Execution Result ===
export interface ActionResult {
  success: boolean;
  agent: AASAgentName;
  action: string;
  costActual: number;
  revenueGenerated: number;
  details: string;
  lessonsLearned?: string[];
}

// === Compliance Validation ===
export interface ComplianceCheck {
  approved: boolean;
  requiresHumanApproval: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
