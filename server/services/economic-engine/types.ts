/**
 * BOOSTIFY ECONOMIC ENGINE — Type Definitions
 * Layer 3: Hidden Economic Motor beneath Artist Entity
 */

// ============================================
// OPERATING MODES
// ============================================

export type OperatingMode = 'survival' | 'stable' | 'expansion' | 'aggressive' | 'defense';
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';
export type DefiAgentType = 'capital_keeper' | 'flow_maker' | 'alpha_hunter' | 'shield_node' | 'market_hunter';
export type VaultBucket = 'operation' | 'reserve' | 'growth' | 'defi' | 'boostify_fee';

// ============================================
// DISTRIBUTION MATRICES
// ============================================

export interface DistributionMatrix {
  operation: number;   // % to operations
  reserve: number;     // % to emergency reserve
  growth: number;      // % to marketing/growth
  defi: number;        // % to DeFi motor
  boostifyFee: number; // % platform fee
}

export interface DefiSplit {
  capitalKeeper: number;   // Conservative parking
  flowMaker: number;       // Yield farming
  alphaHunter: number;     // Tactical alpha
  shieldNode: number;      // Risk/hedge margin
  marketHunter?: number;   // Day-trading directional bets (opt-in, default 0%)
}

export interface ProfitCascade {
  reserve: number;         // % to reserve
  growth: number;          // % to growth
  reinvestDefi: number;    // % back to DeFi
  performanceFee: number;  // % Boostify performance fee
}

// Mode-specific distribution overrides
export const MODE_DISTRIBUTIONS: Record<OperatingMode, DistributionMatrix> = {
  survival:   { operation: 45, reserve: 30, growth: 15, defi: 5,  boostifyFee: 5 },
  stable:     { operation: 35, reserve: 20, growth: 20, defi: 20, boostifyFee: 5 },
  expansion:  { operation: 25, reserve: 15, growth: 30, defi: 25, boostifyFee: 5 },
  aggressive: { operation: 25, reserve: 10, growth: 15, defi: 45, boostifyFee: 5 },
  defense:    { operation: 40, reserve: 40, growth: 15, defi: 0,  boostifyFee: 5 },
};

export const DEFAULT_DEFI_SPLIT: DefiSplit = {
  capitalKeeper: 40,
  flowMaker: 30,
  alphaHunter: 10,
  shieldNode: 20,
  marketHunter: 0, // off by default — artist must opt-in via dayTradingEnabled
};

// When dayTrading is enabled, slice is taken proportionally from other agents
export const DEFAULT_DEFI_SPLIT_WITH_DAYTRADING: DefiSplit = {
  capitalKeeper: 35,
  flowMaker: 25,
  alphaHunter: 10,
  shieldNode: 20,
  marketHunter: 10, // ~10% of defi balance — capped at high risk
};

export const DEFAULT_PROFIT_CASCADE: ProfitCascade = {
  reserve: 40,
  growth: 30,
  reinvestDefi: 20,
  performanceFee: 10,
};

// ============================================
// VAULT STATE
// ============================================

export interface VaultState {
  artistId: number;
  operationBalance: number;
  reserveBalance: number;
  growthBalance: number;
  defiBalance: number;
  boostifyFeeBalance: number;
  totalDeposited: number;
  totalDefiProfit: number;
  totalDefiLoss: number;
  peakDefiValue: number;
  currentDrawdown: number;
}

export interface VaultBalances {
  operation: number;
  reserve: number;
  growth: number;
  defi: number;
  boostifyFee: number;
}

// ============================================
// RISK ENGINE
// ============================================

export interface RiskEvaluation {
  incomeVsCosts: number;        // ratio: monthly income / monthly costs
  reserveAdequacy: 'critical' | 'low' | 'adequate' | 'strong' | 'excess';
  defiPerformance: number;      // net ROI % of DeFi motor
  audienceGrowth: number;       // % monthly audience growth
  marketCondition: 'bear' | 'neutral' | 'bull';
}

export interface ModeTransition {
  from: OperatingMode;
  to: OperatingMode;
  reason: string;
  timestamp: Date;
}

// ============================================
// AGENT ACTIONS
// ============================================

export type AgentActionType = 
  | 'open_position' | 'close_position' | 'rebalance' | 'take_profit' | 'stop_loss'
  | 'increase_position' | 'decrease_position' | 'hedge' | 'circuit_break' | 'audit'
  | 'yield_harvest' | 'compound' | 'emergency_exit'
  | 'enter_long' | 'enter_short' | 'exit_trade';

export type PositionType = 
  | 'stablecoin_parking' | 'lending' | 'liquidity_pool' | 'yield_farm'
  | 'arbitrage' | 'flash_loan' | 'hedge' | 'insurance' | 'directional_trade';

export interface AgentAction {
  agentType: DefiAgentType;
  actionType: AgentActionType;
  positionId?: number;
  amount?: number;
  reason: string;
  riskAssessment?: RiskAssessment;
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  drawdownPct: number;
  exposurePct: number;
  recommendation: string;
}

// ============================================
// KPIs
// ============================================

export interface EconomicKPIs {
  operatingCoverage: number;    // (income + reserve) / monthly costs
  treasuryRatio: number;        // productive capital / reserve capital
  defiROI: number;              // net DeFi return %
  maxDrawdown: number;          // worst peak-to-trough %
  reserveMonths: number;        // months of runway
  totalVaultValue: number;      // sum of all buckets
  netDefiPnl: number;           // profit - loss
}

// ============================================
// CYCLE RESULTS
// ============================================

export interface CycleResult {
  artistId: number;
  mode: OperatingMode;
  incomeProcessed: number;
  distribution: VaultBalances;
  defiAllocations: Record<DefiAgentType, number>;
  agentActions: AgentAction[];
  modeTransition?: ModeTransition;
  kpis: EconomicKPIs;
  timestamp: Date;
}

export interface SimulationResult {
  inputAmount: number;
  mode: OperatingMode;
  distribution: VaultBalances;
  defiAllocations: Record<DefiAgentType, number>;
  projectedMonthlyYield: number;
  projectedAnnualROI: number;
}
