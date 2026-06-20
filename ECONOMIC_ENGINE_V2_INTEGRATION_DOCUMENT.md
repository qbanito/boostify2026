# ECONOMIC ENGINE V2 — INTEGRATION DOCUMENT

**Project**: Boostify Music — Economic Engine Enhancement  
**Version**: 2.0  
**Date**: 2025  
**Status**: FULLY IMPLEMENTED ✅

---

## EXECUTIVE SUMMARY

The Boostify Music Economic Engine has been upgraded from a basic 5-agent DeFi automation system into an **institutional-grade quantitative finance platform**. Four open-source repositories were analyzed, their core algorithms extracted to TypeScript, and integrated as 6 new service modules with 5 targeted modifications to existing services.

The upgrade delivers:

1. **Multi-indicator technical analysis** replacing naive 24h-change signal logic
2. **Institutional-grade portfolio analytics** with Sharpe, Sortino, Calmar, Monte Carlo
3. **Real macro-economic intelligence** from FRED API + Yahoo Finance VIX
4. **Multi-source sentiment aggregation** from Reddit + news + Fear & Greed
5. **Historical strategy backtesting** with walk-forward optimization to detect overfitting
6. **FSI domain expertise injection** via `anthropics/financial-services` skills submodule

---

## SOURCE REPOSITORIES ANALYZED

| Repository | Stars | Language | Integration Method |
|---|---|---|---|
| `anthropics/financial-services` | 26.7k ⭐ | Markdown | Git submodule → skills injector |
| `atilaahmettaner/tradingview-mcp` | 2.8k ⭐ | Python/MCP | Algorithms extracted to TypeScript |
| `Trade-With-Claude/cbt-framework` | 23 ⭐ | Node.js | FRED API pattern + walk-forward methodology |
| `wshobson/maverick-mcp` | 560 ⭐ | Python/MCP | Financial formulas extracted to TypeScript |

**Key decision**: None of the Python MCP servers run as separate microservices. All algorithms were extracted as pure TypeScript functions to avoid infrastructure complexity.

---

## ARCHITECTURE OVERVIEW

```
Economic Engine V2 Architecture
────────────────────────────────────────────────────────────────────

  DATA LAYER (external)
  ┌─────────────────────────────────────────────────────┐
  │  CoinGecko Free API   │  FRED API (optional key)    │
  │  Yahoo Finance (VIX)  │  Reddit Public API (no key) │
  │  Cryptopanic RSS      │  Alternative.me Fear/Greed  │
  └─────────────────────────────────────────────────────┘
          │                           │
          ▼                           ▼
  INTELLIGENCE LAYER (NEW V2)
  ┌──────────────────────┐  ┌──────────────────────┐
  │ technical-analysis   │  │ macro-intelligence   │
  │ RSI / MACD / BB      │  │ FRED + VIX + S&P500  │
  │ EMA Cross / ATR      │  │ Yield curve / CPI    │
  │ Confluent Signal     │  │ MacroRiskSignal       │
  └──────────┬───────────┘  └──────────┬───────────┘
             │                          │
  ┌──────────▼───────────┐  ┌──────────▼───────────┐
  │ sentiment-tracker    │  │ portfolio-analytics  │
  │ Reddit + RSS + F&G   │  │ Sharpe/Sortino/Calmar│
  │ CombinedSentiment    │  │ Monte Carlo / KPIs   │
  └──────────┬───────────┘  └──────────┬───────────┘
             │                          │
             └──────────┬───────────────┘
                        │
  ┌──────────────────────▼───────────────────────────────┐
  │ strategy-backtester                                  │
  │ 6 strategies: momentum/mean_reversion/rsi/macd/      │
  │ bollinger/ema_cross                                  │
  │ Walk-forward optimization (IS/OOS split)             │
  └──────────────────────────────────────────────────────┘
          │
  AGENT LAYER (MODIFIED)
  ┌───────────────────────────────────────────────────────────┐
  │ agent-brain.ts (MODIFIED)                                │
  │  + FSI skills injected via economic-skills-injector      │
  │  + market_hunter agent prompt added                      │
  │                                                          │
  │ risk-engine.ts (MODIFIED)                                │
  │  + getMacroRiskSignal() → override evaluateRisk()        │
  │  + VIX >= 35 → force defense mode                        │
  │  + macroSignal.level >= 75 + drawdown > 5% → defense    │
  │                                                          │
  │ market-hunter.ts (MODIFIED)                              │
  │  + getConfluentSignal() replaces change24h simple logic  │
  │  + shouldAvoidTradeEntry() sentiment gate before entry   │
  │                                                          │
  │ market-intelligence.ts (MODIFIED)                        │
  │  + getCombinedSentimentSignal() added to report          │
  └───────────────────────────────────────────────────────────┘
          │
  FSI LAYER (NEW)
  ┌───────────────────────────────────────────────────────────┐
  │ .agents/financial-services/ (git submodule)              │
  │  └─ plugins/vertical-plugins/                           │
  │     ├─ equity-research/skills/   (capital_keeper)       │
  │     ├─ financial-analysis/skills/(flow_maker)           │
  │     ├─ private-equity/skills/    (alpha_hunter)         │
  │     ├─ wealth-management/skills/ (shield_node)          │
  │     ├─ fund-admin/skills/        (token_operations)     │
  │     └─ investment-banking/skills/(market_analyst)       │
  │                                                          │
  │ server/utils/economic-skills-injector.ts                 │
  │  buildFinancialAgentPrompt(agentType, basePrompt)        │
  └───────────────────────────────────────────────────────────┘
          │
  API LAYER (NEW V2 ENDPOINTS)
  ┌───────────────────────────────────────────────────────────┐
  │ GET  /:artistId/analytics       → KPI report             │
  │ GET  /:artistId/backtest        → param validation       │
  │ POST /:artistId/backtest        → custom backtest        │
  │ GET  /:artistId/macro           → macro risk signal      │
  │ POST /:artistId/optimize        → walk-forward optimizer │
  │ GET  /:artistId/compare-strategies → strategy ranking   │
  └───────────────────────────────────────────────────────────┘
```

---

## NEW FILES CREATED

### 1. `server/services/economic-engine/portfolio-analytics.ts`
**Purpose**: Institutional-grade risk & performance metrics  
**Source**: Adapted from `wshobson/maverick-mcp` financial formulas  
**Key exports**:

| Function | Description |
|---|---|
| `calculateSharpeRatio(returns, periodDays)` | (Return - RFR) / StdDev, annualized |
| `calculateSortinoRatio(returns, periodDays)` | Like Sharpe, only penalizes downside volatility |
| `calculateCalmarRatio(annualReturn, maxDD)` | Annual return / max drawdown |
| `calculateMaxDrawdown(equityCurve)` | Peak-to-trough analysis with duration |
| `calculateTradeMetrics(trades)` | Win rate, expectancy, profit factor |
| `runMonteCarloSimulation(trades, capital, n, iter)` | N-iteration bootstrapped simulation |
| `buildInstitutionalKPIReport(artistId)` | Full KPI report from DB data |
| `summarizeKPIs(kpis)` | One-line dashboard summary string |

**Risk-free rate**: 4.5% (US T-bill approximation)  
**Monte Carlo**: Resampling with replacement from historical trades, 1000 iterations default

---

### 2. `server/utils/economic-skills-injector.ts`
**Purpose**: Inject FSI domain expertise into agent system prompts  
**Source**: `anthropics/financial-services` skill files (git submodule)  
**Key exports**:

| Function | Description |
|---|---|
| `buildFinancialAgentPrompt(agentType, base)` | Returns enriched prompt with FSI skills appended |
| `buildMasterAnalystPrompt(base)` | Loads all 3 major FSI verticals for master analyst |
| `isFSISubmoduleInstalled()` | Returns true if `.agents/financial-services/` exists |
| `listAvailableFSIVerticals()` | Lists installed FSI verticals |
| `clearFSISkillCache()` | Clears in-memory SKILL.md cache |

**Skill mapping per agent**:

| Agent | FSI Verticals |
|---|---|
| `capital_keeper` | wealth-management + fund-admin |
| `flow_maker` | financial-analysis + fund-admin |
| `alpha_hunter` | equity-research + private-equity |
| `shield_node` | private-equity + wealth-management |
| `market_hunter` | equity-research + financial-analysis |
| `market_analyst` | equity-research + financial-analysis + wealth-management |
| `token_operations` | financial-analysis + private-equity |

**Fail-silent**: returns base prompt if submodule not installed

---

### 3. `server/services/economic-engine/macro-intelligence.ts`
**Purpose**: Real macro-economic signals for risk mode override  
**Sources**: FRED API (optional key) + Yahoo Finance (free, no key) + EconDB fallback  
**Key exports**:

| Function | Description |
|---|---|
| `getFedFundsRate()` | Fed funds rate + trend |
| `getYieldCurveSpreads()` | 10Y-2Y spread, inversion flag |
| `getCPI()` | Consumer Price Index YoY% + trend |
| `getVIXLevel()` | VIX current + regime (low/normal/high/extreme) |
| `getMarketRegime()` | S&P500-based bull/bear/sideways + confidence |
| `getMacroRiskSignal()` | Composite 0-100 signal + recommendedMode |

**Risk score calculation**:
- VIX contribution: up to 35 pts (extreme VIX ≥35 → +35)
- Yield curve: up to 20 pts (inversion severity-weighted)
- CPI: up to 15 pts (inflation > 6% → +15)
- Market regime: up to 20 pts (bear → +20, bull → -10)
- Baseline: 30 pts

**Environment variable**: `FRED_API_KEY` (optional — falls back to EconDB if not set)  
**All functions fail silently** — never throw to callers

---

### 4. `server/services/economic-engine/technical-analysis.ts`
**Purpose**: Multi-indicator TA signal confluence  
**Source**: Adapted from `atilaahmettaner/tradingview-mcp` indicator algorithms  
**Key exports**:

| Function | Description |
|---|---|
| `calculateRSI(prices, period=14)` | RSI with oversold/overbought/neutral signal |
| `calculateMACD(prices, 12, 26, 9)` | MACD with golden/death cross detection |
| `calculateBollingerBands(prices, 20, 2)` | BB with squeeze detection + position |
| `calculateEMACross(prices)` | EMA 20/50/200 with cross detection |
| `calculateATR(ohlcv, period=14)` | Average True Range (Wilder smoothing) |
| `getSupportResistance(prices, lookback)` | Swing high/low clustering |
| `getMultiTimeframeAlignment(id)` | Weekly/Daily/4H/1H alignment score |
| `getConfluentSignal(coingeckoId, price?)` | **Main entry**: composite BUY/SELL/HOLD + confidence |

**Confluence scoring**:
| Signal | Points |
|---|---|
| RSI oversold strong | +30 |
| RSI oversold moderate | +20 |
| MACD golden cross | +25 |
| MACD bullish momentum | +10 |
| BB below lower band | +20 |
| BB squeeze | +8 |
| EMA golden cross | +25 |
| EMA bullish trend | +10 |
| Near support | +15 |
| Near resistance | -10 |

**BUY threshold**: score ≥ 65 with ≥2 non-overbought signals  
**Data source**: CoinGecko OHLCV free endpoint (30-day daily)

---

### 5. `server/services/economic-engine/sentiment-tracker.ts`
**Purpose**: Multi-source crypto sentiment aggregation  
**Sources**: Reddit public API (no key) + Cryptopanic RSS + existing Fear & Greed  
**Key exports**:

| Function | Description |
|---|---|
| `getCryptoRedditSentiment(coins)` | r/CryptoCurrency, r/Bitcoin, r/ethereum, r/maticnetwork |
| `getFinancialNewsFeed()` | Cryptopanic RSS → keyword scoring |
| `getCombinedSentimentSignal()` | Composite signal (F&G 60% + Reddit 25% + News 15%) |
| `shouldAvoidTradeEntry(sentiment)` | True if extreme_fear OR extreme_greed |
| `summarizeSentiment(signal)` | Human-readable one-liner |

**Sentiment scale**: 0-100 (Alternative.me compatible)
- 0-20: `extreme_fear` → avoid entry
- 21-40: `fear`
- 41-60: `neutral`
- 61-80: `greed`
- 81-100: `extreme_greed` → avoid entry

**Keyword scoring**: 85 bullish keywords, 85+ bearish keywords — weighted by Reddit upvotes

---

### 6. `server/services/economic-engine/strategy-backtester.ts`
**Purpose**: Historical strategy validation + walk-forward optimization  
**Source**: Adapted from `Trade-With-Claude/cbt-framework` walk-forward methodology  
**Key exports**:

| Function | Description |
|---|---|
| `backtestStrategy(config)` | Full backtest: returns, Sharpe, drawdown, equity curve |
| `compareStrategies(id, symbol, period)` | Rank all 6 strategies by composite score |
| `walkForwardOptimize(config)` | IS/OOS split → detect overfitting via ratio |
| `validateMarketHunterParams(artistId)` | Validates current stop/take-profit settings |

**Strategies**: `momentum` | `mean_reversion` | `rsi` | `macd` | `bollinger` | `ema_cross`

**Walk-forward split**: 70% in-sample, 30% out-of-sample (configurable)  
**Overfit detection**: `overfitRatio = OOS_Sharpe / IS_Sharpe` — if < 0.5, params are overfit  
**Statistical significance**: requires ≥ 30 trades

**Composite ranking score**:
- Sharpe (40%) + Win Rate (20%) + Profit Factor (20%) + Low Drawdown (20%)

---

## MODIFIED FILES

### 1. `server/services/economic-engine/agent-brain.ts`
**Change**: All 6 `AGENT_SYSTEM_PROMPTS` entries now wrapped with `buildFinancialAgentPrompt()`  
**Added prompt**: `market_hunter` agent now has a dedicated system prompt  
**Impact**: When `.agents/financial-services/` is installed, all agents receive institutional financial expertise prepended to their system prompts

```typescript
// BEFORE:
capital_keeper: `You are the Capital Keeper...`

// AFTER:
capital_keeper: buildFinancialAgentPrompt('capital_keeper', `You are the Capital Keeper...`)
```

---

### 2. `server/services/economic-engine/risk-engine.ts`
**Change**: Added `getMacroRiskSignal()` call in `evaluateRisk()` with 2 override rules  
**Impact**: `evaluation.marketCondition` is no longer hardcoded `'neutral'` — reflects real macro

**New override rules**:
```
IF macroSignal.level >= 75 AND currentDrawdown > 5%
  → Force 'defense' mode with macro override reason

IF macroSignal.vixLevel >= 35 AND macroSignal.recommendedMode === 'defense'
  → Force 'defense' mode with VIX extreme reason
```

---

### 3. `server/services/economic-engine/market-hunter.ts`
**Change**: `findEntrySignal()` completely replaced with TA-powered logic  
**Impact**: No longer uses `change24h >= 1 && change24h <= 6` simple math — uses full RSI+MACD+BB+EMA confluence

**New flow**:
```
1. Fetch current prices (unchanged)
2. NEW: Sentiment gate → getCombinedSentimentSignal()
        → if shouldAvoidTradeEntry() → return null (no entry)
3. NEW: For each asset → getConfluentSignal(coingeckoId, currentPrice)
        → if action === 'BUY' AND confidence >= minConfidence → candidate
4. Return best candidate (by confidence)
```

---

### 4. `server/services/economic-engine/market-intelligence.ts`
**Change**: Added `CombinedSentimentSignal` import and field to `MarketIntelligenceReport`  
**Change**: `generateReport()` now calls `getCombinedSentimentSignal()` and includes it in report  
**Impact**: Frontend dashboards receive full sentiment data with market reports

---

## NEW API ENDPOINTS

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/economic-engine/:artistId/analytics` | Institutional KPI report | User |
| `GET` | `/api/economic-engine/:artistId/backtest` | Validate current Market Hunter params | User |
| `POST` | `/api/economic-engine/:artistId/backtest` | Run custom backtest | User |
| `GET` | `/api/economic-engine/:artistId/macro` | Real-time macro risk signal | User |
| `POST` | `/api/economic-engine/:artistId/optimize` | Walk-forward strategy optimizer | User |
| `GET` | `/api/economic-engine/:artistId/compare-strategies` | Compare all strategies ranked | User |

### POST /backtest body:
```json
{
  "coingeckoId": "matic-network",
  "symbol": "MATIC",
  "strategy": "rsi",
  "periodDays": 90,
  "stopLossPct": 0.03,
  "takeProfitPct": 0.05,
  "allocationUsd": 1000
}
```

### GET /macro response:
```json
{
  "success": true,
  "macro": {
    "level": 42,
    "riskLabel": "moderate",
    "factors": ["VIX normal (18.4)", "S&P500 bull market (+8.2% 30d)"],
    "vixLevel": 18.4,
    "yieldCurveInverted": false,
    "marketRegime": "bull",
    "recommendedMode": null
  }
}
```

### POST /optimize body:
```json
{
  "coingeckoId": "ethereum",
  "symbol": "ETH",
  "strategy": "bollinger",
  "periodDays": 180,
  "inSamplePct": 0.7
}
```

---

## ENVIRONMENT VARIABLES

| Variable | Required | Description |
|---|---|---|
| `FRED_API_KEY` | Optional | St. Louis Fed API key — free at `fred.stlouisfed.org`. Falls back to EconDB without it. |
| `OPENAI_API_KEY` | Existing | Used by AgentBrain for LLM decisions |
| `AGENT_LLM_MODEL` | Existing | Model for AgentBrain (default: gpt-4o-mini) |

---

## FSI SUBMODULE

**Location**: `.agents/financial-services/`  
**Repo**: `https://github.com/anthropics/financial-services`  
**License**: Apache 2.0  
**Verticals installed**:
- `equity-research` → 9+ skills (catalyst tracking, model updates, earnings analysis)
- `financial-analysis` → 10+ skills (DCF, LBO, comps, 3-statement)
- `fund-admin` → 8+ skills (NAV, GL reconciliation, variance commentary)
- `private-equity` → 10+ skills (sourcing, diligence, IC memos, portfolio monitoring)
- `wealth-management` → 8+ skills (rebalancing, risk-adjusted reporting)
- `investment-banking` → available
- `operations` → available

**Update submodule**:
```bash
git submodule update --remote .agents/financial-services
```

**Reset skill cache after update**: Call `clearFSISkillCache()` or restart the server

---

## DATA FLOW DIAGRAM: Market Hunter V2

```
economic-brain.ts → executeMarketHunterCycle()
      │
      ▼
  managePositions()  ← mark-to-market existing trades (unchanged)
      │
      ▼
  findEntrySignal() V2
      │
      ├─ getCombinedSentimentSignal()
      │    ├─ getFearGreedIndex() [existing]
      │    ├─ getCryptoRedditSentiment() [new - Reddit API]
      │    └─ getFinancialNewsFeed() [new - Cryptopanic RSS]
      │
      │  IF extreme sentiment → return null (no trade)
      │
      └─ FOR EACH asset (WMATIC, WETH):
           │
           └─ getConfluentSignal(coingeckoId, price)
                ├─ fetchOHLCV() [CoinGecko 30d OHLCV]
                ├─ calculateRSI(prices, 14)
                ├─ calculateMACD(prices, 12, 26, 9)
                ├─ calculateBollingerBands(prices, 20, 2)
                ├─ calculateEMACross(prices)
                ├─ calculateATR(ohlcv, 14)
                └─ getSupportResistance(prices, 10)
                
                → ConfluentSignal { score, action, confidence, stopLoss, takeProfit }
                → IF action === 'BUY' AND confidence >= threshold → trade candidate
```

---

## DATA FLOW DIAGRAM: Risk Engine V2

```
evaluateRisk(artistId)
      │
      ├─ [EXISTING] Load profile + vault + riskState from DB
      ├─ [EXISTING] Calculate reserveMonths, defiROI, incomeVsCosts
      │
      ├─ [NEW V2] getMacroRiskSignal()
      │    ├─ getVIXLevel() [Yahoo Finance ^VIX]
      │    ├─ getYieldCurveSpreads() [FRED DGS10, DGS2]
      │    ├─ getCPI() [FRED CPIAUCSL]
      │    └─ getMarketRegime() [Yahoo Finance ^GSPC]
      │    
      │    → MacroRiskSignal { level, riskLabel, vixLevel, recommendedMode, ... }
      │    → evaluation.marketCondition = REAL value (was hardcoded 'neutral')
      │
      ├─ [NEW RULE] IF macroSignal.level >= 75 AND drawdown > 5% → 'defense'
      ├─ [NEW RULE] IF VIX >= 35 AND macro recommends defense → 'defense'
      │
      └─ [EXISTING] Normal mode logic (survival/defense/aggressive/expansion/stable)
```

---

## PORTFOLIO KPI REPORT STRUCTURE

```typescript
InstitutionalKPIs {
  // Return metrics
  totalReturnPct: number        // e.g. 12.4
  totalReturnUsd: number        // e.g. 124.00
  annualizedReturnPct: number   // extrapolated to 1Y

  // Risk-adjusted (institutional standards)
  sharpeRatio: number           // > 1.0 = good, > 2.0 = excellent
  sortinoRatio: number          // better for crypto (ignores upside vol)
  calmarRatio: number           // annual return / max drawdown

  // Risk
  maxDrawdownPct: number        // worst peak-to-trough
  currentDrawdownPct: number    // current drawdown from peak
  volatilityPct: number         // annualized

  // Trade stats
  totalTrades: number
  winRate: number               // e.g. 58.3
  profitFactor: number          // gross profit / |gross loss|
  expectancy: number            // expected $ per trade
  bestTradePct, worstTradePct

  // Overall grade: A+ | A | B | C | D | F
  grade: string
}
```

---

## WALK-FORWARD OPTIMIZATION METHODOLOGY

Adapted from `Trade-With-Claude/cbt-framework`:

```
Total historical data (e.g. 180 days)
├─ In-Sample (IS): 70% = 126 days
│    Grid search best params on this period
│    Record IS Sharpe for each param set
│
└─ Out-of-Sample (OOS): 30% = 54 days
     Test best params (no adjustment) on unseen data
     Record OOS Sharpe

Overfit Ratio = OOS_Sharpe / IS_Sharpe
  - >= 0.7: Reliable (strategy generalizes well)
  - 0.5-0.7: Acceptable
  - < 0.5: Overfit — params tuned to historical noise
  
isReliable = OOS_Sharpe > 0.5 AND overfitRatio >= 0.5
```

---

## SILENT FAILURE GUARANTEES

All new V2 services are designed to **never break the existing Economic Engine**:

| Service | Fallback behavior |
|---|---|
| `getMacroRiskSignal()` | Returns `null` → `evaluateRisk()` skips macro override |
| `getConfluentSignal()` | Returns `HOLD` signal → no trade entered |
| `getCombinedSentimentSignal()` | Errors caught → `shouldAvoidTradeEntry()` not called |
| `getCryptoRedditSentiment()` | Returns `null` → sentiment check skipped |
| `getFinancialNewsFeed()` | Returns `null` → score contribution = 0 |
| `buildFinancialAgentPrompt()` | Returns base prompt → agent works normally |
| All FRED/Yahoo calls | 5-6s timeout → caught → null returned |

---

## PERFORMANCE IMPACT

| Operation | Estimated latency | Notes |
|---|---|---|
| `getConfluentSignal()` | 1-3s | CoinGecko OHLCV request |
| `getCombinedSentimentSignal()` | 2-5s | 4 requests in parallel |
| `getMacroRiskSignal()` | 3-8s | 4 requests in parallel, FRED can be slow |
| `buildInstitutionalKPIReport()` | <100ms | DB queries only |
| `backtestStrategy()` | 2-10s | CoinGecko historical data |
| FSI skill injection | <1ms | In-memory cache after first load |

**Recommendation**: Run macro + sentiment signals on a 15-minute cache interval rather than every engine cycle.

---

## TESTING CHECKLIST

- [ ] `getMacroRiskSignal()` returns valid signal when `FRED_API_KEY` set
- [ ] `getMacroRiskSignal()` returns null gracefully when no key set  
- [ ] `getConfluentSignal('matic-network')` returns valid BUY/SELL/HOLD
- [ ] `getCombinedSentimentSignal()` returns valid signal with Reddit posts
- [ ] `backtestStrategy()` runs 90-day RSI backtest on MATIC
- [ ] `walkForwardOptimize()` returns `isReliable` flag correctly
- [ ] `buildInstitutionalKPIReport(artistId)` computes KPIs from DB
- [ ] `isFSISubmoduleInstalled()` returns `true` after submodule add
- [ ] `buildFinancialAgentPrompt('capital_keeper', base)` appends FSI skills
- [ ] `evaluateRisk()` logs macro override reason when VIX > 35
- [ ] `findEntrySignal()` returns `null` when sentiment is extreme_fear
- [ ] `GET /api/economic-engine/:id/analytics` returns 200 with KPIs
- [ ] `POST /api/economic-engine/:id/backtest` runs backtest from body
- [ ] `GET /api/economic-engine/:id/macro` returns macro signal

---

## UPDATING THE FSI SUBMODULE

When `anthropics/financial-services` is updated with new skills:

```bash
# Pull latest skills
git submodule update --remote .agents/financial-services

# Commit the update
git add .agents/financial-services
git commit -m "chore: update financial-services skills submodule"

# In code: clear cache so new skills are loaded
# The server automatically reloads on restart
```

To add a new skill mapping for a new agent type, edit `AGENT_FSI_SKILLS` in `server/utils/economic-skills-injector.ts`.

---

## FILES CREATED / MODIFIED SUMMARY

### New files (6):
| File | Lines | Purpose |
|---|---|---|
| `server/services/economic-engine/portfolio-analytics.ts` | ~290 | Sharpe/Sortino/Calmar/Monte Carlo/KPI report |
| `server/services/economic-engine/macro-intelligence.ts` | ~230 | FRED + Yahoo Finance macro signals |
| `server/services/economic-engine/technical-analysis.ts` | ~370 | RSI/MACD/BB/EMA/Confluent signal |
| `server/services/economic-engine/sentiment-tracker.ts` | ~230 | Reddit + RSS + F&G sentiment |
| `server/services/economic-engine/strategy-backtester.ts` | ~320 | Backtest + walk-forward optimizer |
| `server/utils/economic-skills-injector.ts` | ~140 | FSI skills injection for AgentBrain |

### Modified files (5):
| File | Change |
|---|---|
| `server/services/economic-engine/agent-brain.ts` | All prompts wrapped with `buildFinancialAgentPrompt()` + `market_hunter` prompt added |
| `server/services/economic-engine/risk-engine.ts` | `getMacroRiskSignal()` + 2 VIX/macro override rules |
| `server/services/economic-engine/market-hunter.ts` | `findEntrySignal()` replaced with TA confluence + sentiment gate |
| `server/services/economic-engine/market-intelligence.ts` | `CombinedSentimentSignal` added to report + import |
| `server/routes/economic-engine.ts` | 6 new V2 endpoints added |

### Git additions:
| Item | Description |
|---|---|
| `.agents/financial-services/` | `anthropics/financial-services` git submodule |
| `.gitmodules` | Submodule registration |

---

*Document generated automatically after full Economic Engine V2 implementation.*  
*All 11 implementation steps completed. All 6 new services and 5 file modifications applied.*
