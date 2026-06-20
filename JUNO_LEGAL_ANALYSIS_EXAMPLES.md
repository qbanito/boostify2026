# 🏛️ JUNO 2.0 — PRACTICAL CASE STUDIES
## Real-World Legal Analysis Examples

**Scenario Testing:** How Juno 2.0 Handles Different Proposal Types  
**Based On:** Actual seed-stage deal patterns  
**For:** Understanding Juno's reasoning transparency

---

## 📋 ÍNDICE

1. [Case 1: Valuation Negotiation](#case-1-valuation-negotiation)
2. [Case 2: Pro-Rata Rights Expansion](#case-2-pro-rata-rights-expansion)
3. [Case 3: MFN Removal (Red Flag)](#case-3-mfn-removal-red-flag)
4. [Case 4: Discount Rate Increase](#case-4-discount-rate-increase)
5. [Case 5: Board Seat Request](#case-5-board-seat-request)
6. [Case 6: Complex Multi-Clause Redline](#case-6-complex-multi-clause-redline)

---

## 🎯 CASE 1: VALUATION NEGOTIATION
### "Can we lower the cap from $42.9M to $40M?"

### Input Data

```
INVESTOR:
  Name: Jane Q. Investor
  Company: Acme Ventures
  Check size: $1.5M
  Type: Micro-VC
  Track record: Founded 2 funds, ~20 deals each, reputation "fair"

PROPOSAL:
  Clause: post_money_cap
  Original: "$42,857,143"
  Proposed: "$40,000,000"
  Rationale: "Align with our LP expectations. Most seed deals at this 
             stage are in $35-40M range."
  Urgency: "Need to close this to present to LPs next week"

CONTEXT:
  Round stage: Seed
  Prior capital: $1.8M (Omnia)
  Check size: $1.5M (investor)
  Total round: $3.3M (if closed)
```

### LAYER 1: Policy Compliance Analysis

```
POLICY DOCUMENT REVIEW:
  Source: board_resolutions_seed_2026.pdf
  
  Approved valuation range: $41.5M - $50M
  Founder protection threshold: Founders stay >96% after round
  Series A assumption: Seed post-money minimum of $150M assumed
  
COMPLIANCE CHECK:
  Investor asks: $40M
  Policy allows: $41.5M - $50M
  Violation: ❌ YES (below minimum)
  Gap: -$1.5M (-3.6% below policy)
  
ESCALATION TRIGGER:
  Falls below minimum? YES
  But: Magnitude is negotiable (only $1.5M gap)
  Flag for discussion? YES
  
FOUNDER PROTECTION CHECK:
  At $40M cap: Investor gets $1.5M / $40M = 3.75%
  Founders keep: 96.25% ✅
  Threshold: >96% ✅ MET
  Assessment: Founders adequately protected
```

### LAYER 2: Precedent & Market Analysis

```
COMPARABLE COMPANIES DATABASE:
  
  Filters applied:
    • Micro-VC investors only (similar check size)
    • Seed stage funding
    • Music/entertainment industry (where possible)
    • Past 12 months
  
  Results:
    ┌────────────────────────────────────────┐
    │ Comparable Deals (Seed Stage, Micros)  │
    ├────────────────────────────────────────┤
    │ XYZ Fund, Series Seed: $42M            │
    │ Acme Ventures, Deal 1: $42M            │
    │ Acme Ventures, Deal 2: $41.5M          │
    │ Angels Collective, Seed: $41M          │
    │ Micro Angels Fund: $40.5M              │
    │ Tiger Fund Micro Program: $39M         │
    │ Seed Stage Average: $41.8M             │
    └────────────────────────────────────────┘
  
  ANALYSIS:
    Count: 47 comparable deals
    Average: $41.8M
    Median: $41.5M
    Std Dev: $2.3M
    
    Investor's ask ($40M): 15th percentile
    Assessment: Outlier low (below median)
    
  INVESTOR TRACK RECORD:
    Acme Ventures history:
    • Deal 1 (2024): Asked $38M → Accepted $42M
    • Deal 2 (2024): Asked $40M → Accepted $41.5M
    • Pattern: Jane negotiates but accepts 1-3% above ask
    
  PREDICTION:
    If we counter at $41.5M: Jane likely accepts (1.5% above her ask)
    If we counter at $41M: Jane likely rejects (too small)
    If we counter at $42M: Jane likely accepts but unhappy

MARKET ASSESSMENT:
  Boostify competitive position:
    • Earlier stage than typical seed ($40-45M range)
    • Strong metrics justify higher cap
    • Supply/demand: investors actively seeking seed deals (not constrained)
  
  Recommendation: Stand firm on $41.5M
```

### LAYER 3: Legal Risk Assessment

```
LEGAL RISK ANALYSIS:

A. Does this change break other clauses?
   
   Affected clauses (checked):
   • Conversion formula (SAFE) → Recalculates conversion price ✓
   • Discount rate (20%) → Applies to lower cap → Better for investor ✓
   • MFN clause → If others got different terms, triggers ✓
   • Pro-rata calculation → Dilution pool affected ✓
   
   Conflicts found: NONE
   
   Severity: N/A (no conflicts)

B. Regulatory compliance (Reg D / Form D)

   FD filing impact:
   • Form D requires principal amount invested ($1.5M same)
   • Form D requires valuation cap (changes $40M vs $42.9M)
   • Filing deadline: 15 days post-close (no urgency to decide now)
   
   Compliance status: ✅ Will still comply
   
   Severity: NONE

C. Founder protection implications

   Dilution analysis:
   At $40M:  Investor gets 3.75%,   Founders keep 96.25%
   At $41.5M: Investor gets 3.61%,  Founders keep 96.39%
   At $42.9M: Investor gets 3.50%,  Founders keep 96.50%
   
   Difference: 0.25% dilution impact
   Threshold: Founders still >96% (policy met)
   
   Severity: LOW

D. Series A assumptions impact

   Series A pre-money assumption:
   • Current seed cap: $42.9M
   • Series A assumptions: Post-money of $150M+
   • Pre-money range: $90M-$120M (typical)
   
   If seed cap changes to $40M:
   • Series A math changes marginally (pre-money drops by 6%)
   • Effect: Founders dilute 0.5% more in Series A
   • Severity: ACCEPTABLE (already budgeted for 30-40% dilution)
   
   Series A insurance:
   • Our Series A insurance assumes cap ≥$40M ✓
   • Change to $40M hits minimum threshold
   • Risk: We're at edge, not past it
   
   Severity: LOW-MEDIUM (at threshold, manageable)

E. Precedent risk

   If we accept $40M:
   • Next investor may demand same (triggers MFN)
   • Next investor thinks we're flexible on caps
   • Future negotiations become harder
   
   Mitigation: Counter at $41.5M (still favorable for investor)
   Impact: Sets clear precedent without being unreasonable
   
   Severity: MEDIUM (manages with counter-proposal)

TOTAL LEGAL RISK SCORE:
  = (0.3 × 0.40) + (0.2 × 0.25) + (0.4 × 0.20) + (0.4 × 0.15)
  = 0.12 + 0.05 + 0.08 + 0.06
  = 0.31

CLASSIFICATION: ⚠️ YELLOW (Medium Risk) — Negotiable
```

### LAYER 4: Strategic Analysis

```
INVESTOR PROFILE ASSESSMENT:

Value to Boostify:
  • Check size: $1.5M (bottom quartile, not strategic)
  • Value-add: "We don't do operational help" (passive)
  • Network: Some music/entertainment connections (modest)
  • Follow-on likelihood: Low (micros rarely lead Series A)
  
  Rating: "PASSIVE" (capital only, no strategic value)

Likelihood Metrics:
  • Acceptance probability (if we counter $41.5M): 75%
  • Conversion probability (will proceed if we say no): 40%
  • Follow-on likelihood (Series A): 15%
  
  Assessment: Not strategic, but reasonable to negotiate with

Negotiation Capacity:
  • Jane has LP approval to invest $1-2M ✓
  • Fund has done 40+ seed deals (experienced) ✓
  • Likely to be pragmatic (doesn't hard-negotiate) ✓
  • Timeline: Wants to close for LP presentation next week (motivated) ✓

STRATEGIC RECOMMENDATION: "NEGOTIATE"
  Rationale: Jane is reasonable, we can counter at $41.5M confidently
```

### LAYER 5: Recommendation & Reasoning

```
VERDICT: COUNTER_PROPOSE

RECOMMENDED COUNTER:
  New cap: $41,500,000 (our board policy minimum)
  
REASONING NARRATIVE:
  
  "Jane, thank you for the proposal. We've reviewed your request 
  and understand the LP alignment motivation. However, we need to 
  address a few points:
  
  1. POLICY PERSPECTIVE:
     Our board has approved a seed valuation range of $41.5M–$50M 
     to protect our Series A planning. We're currently at $42.9M, 
     which is well within this range. Your $40M proposal falls 
     below our minimum threshold by $1.5M.
  
  2. MARKET CONTEXT:
     We reviewed 47 comparable seed deals with similar investor 
     profiles and check sizes. The market median is $41.5M—exactly 
     where we're proposing. Your proposal at $40M places us in the 
     15th percentile (below peer standard).
  
  3. FINANCIAL IMPACT:
     • At $40M: You get 3.75% equity
     • At $41.5M: You get 3.61% equity
     • Your LPs will appreciate the lower valuation ($40M is 
       competitive), but founders stay protected
  
  4. OUR COUNTER:
     We propose $41.5M as a compromise. This:
     → Meets your LP positioning (micro-VC rounds are under $42M)
     → Respects our Series A insurance requirements
     → Aligns with market standards (15 similar funds accepted this)
     → Shows good faith (we're not at our range maximum)
  
  5. ALTERNATIVES (if $41.5M doesn't work):
     a) Increase your check to $3M+ → we could explore $40M
     b) Add pro-rata rights for Series A → we could go to $40.5M
     c) Commit to follow-on participation → $40.5M is on table
  
  NEXT STEPS:
     Can we circle back by Friday with your thoughts? We want to 
     move quickly given your LP timeline."
  
PRECEDENT CITED:
  • 15 comparable micro-VC deals averaged $41.8M
  • Acme Ventures own Deal 2 (2024): $41.5M cap accepted
  • YC standard (for reference): $40-45M range
  
CONFIDENCE SCORE: 92%
  Why high? Jane has proven track record of reasonable negotiation

HUMAN APPROVAL NEEDED: NO
  • Risk is medium (manageable negotiation)
  • CEO doesn't need to pre-approve counter
  • Escalate only if Jane rejects $41.5M
  
ESCALATION TRIGGER:
  If Jane holds at $40M for more than 2 rounds → escalate to CEO
```

### Expected Outcome

```
WEEK 1:
  Friday: We send counter at $41.5M with detailed reasoning
  
WEEK 2:
  Monday: Jane responds "Let me discuss with partners"
  Wednesday: Jane replies "Partners want $40.5M as compromise"
  
WEEK 3:
  Boostify counters: "OK, $40.75M (we split the difference)"
  Jane accepts
  Deal closes at $40.75M
  
RESULT:
  Time to close: 10 days (vs 14 day goal)
  Final valuation: $40.75M (better for investor than our initial ask)
  Investor satisfaction: HIGH (Jane felt heard, got 95% of ask)
  Precedent: Set at $40.75M (slightly below policy, but acceptable)
  
STATUS: ✅ SUCCESS
```

---

## 🚨 CASE 2: PRO-RATA RIGHTS EXPANSION
### "Change our pro-rata from 1x to 3x"

### Input

```
INVESTOR: Mike (Series Seed fund, $500K check)
PROPOSAL: "We want to maintain our pro-rata all the way through 
          Series C"
CURRENT TERMS: "1x pro-rata (standard)"
PROPOSED: "3x pro-rata (multiply our stake up to 3x)"
```

### Juno's Analysis

```
LAYER 1: POLICY
  Board policy: Pro-rata 1x standard for seed checks <$2M ✓
  Investor check: $500K
  Requested: 3x
  Policy impact: Violates (3x is only for strategic >$5M checks)
  
  Flag: ❌ VIOLATES

LAYER 2: PRECEDENT
  Historic pro-rata acceptance: 1x = 100% of deals, 2x = 15%, 3x = 2%
  Mike's fund type: Series Seed (generalist, not strategic)
  Comparable precedent: Similar funds get 1x only
  
  Prediction: Unreasonable ask (99% of similar deals rejected this)

LAYER 3: LEGAL RISK
  Risk if accepted:
    • Reserves: Need 1.5% of future rounds (vs 0.5% standard)
    • Series A planning: Breaks cap table reserve math
    • Precedent: Opens door to other requests
    • Founder pressure: Compresses founder upside
  
  Risk score: 0.65 (YELLOW-RED)

LAYER 4: STRATEGY
  Investor value: Passive ($500K, no strategic value)
  Acceptance likelihood: 40% (likely to reject our counter)
  Follow-on: Unlikely
  
  Assessment: "Micro deal, low strategic value, unreasonable ask"

LAYER 5: VERDICT
  
  VERDICT: COUNTER_PROPOSE with clear reasoning
  
  Counter: "We offer 1.5x pro-rata (compromise)"
  
  Reasoning:
  "Mike, we appreciate your proposal. However, 3x pro-rata is 
  typically reserved for strategic partners (>$5M checks or board 
  seats). Your $500K check, while valuable, doesn't fit that 
  profile.
  
  Why 1x is standard:
  • Protects future fundraising flexibility
  • Reserves space for Series A investors
  • Aligns with market standards for seed checks <$1M
  
  What we offer instead:
  • 1.5x pro-rata (compromise—exceeds market standard)
  • Full information rights (see quarterly updates, cap table)
  • Observation rights at board meetings (if strategic)
  
  This still allows you to:
  • Maintain your stake (1x)
  • Increase to 1.5x in Series A if you want
  • Stay informed and connected
  
  Does this work?"
  
  Human approval: YES (outside normal range, CEO should know)
  Risk: 0.65 (YELLOW-RED — beyond policy, needs override authority)
```

---

## 🚩 CASE 3: MFN REMOVAL (RED FLAG)
### "Remove the Most Favored Nations clause"

### Input

```
INVESTOR: Bob (Angel, $100K check)
PROPOSAL: "I'd like to remove the MFN clause. I don't want my 
          terms affected by what others negotiate."
CURRENT: "MFN: Any better terms go to all investors"
```

### Juno's Analysis

```
IMMEDIATE FLAG: 🚨 CRITICAL (0.85 risk score)

Why this is a red flag:
  1. MFN is STANDARD investor protection (not negotiable)
  2. Removing it signals Bob will renegotiate later
  3. Very rare request (only 12% of investors ask)
  4. Usually means Bob expects to get better terms after

JUNO'S REACTION:

Layer 1 - Policy:
  MFN is non-negotiable per board policy ✗
  Risk: HIGH

Layer 2 - Precedent:
  Historical data: When investors request MFN removal, 80% later 
  request term changes
  Pattern: "I don't want MFN because I plan to renegotiate"
  
  This proposal = RED FLAG for future trouble

Layer 3 - Legal:
  Risk: MFN protects ALL investors equally
  If we remove: Other investors demand same removal
  Cascade effect: Unravels investor protection fabric
  Litigation risk: Investors sue if terms aren't equal
  
  Risk score: 0.85 (CRITICAL)

Layer 4 - Strategy:
  Investor value: Low ($100K passive angel)
  Strategic value: Negative (signals future problems)
  Recommendation: ESCALATE to CEO + investigate

Layer 5 - RECOMMENDATION:

  VERDICT: ESCALATE + INVESTIGATE
  
  CEO email:
  "Bob (100K investor) has requested MFN clause removal. This is:
   
   1. Non-negotiable per our policy
   2. Major red flag (80% of prior removals → later renegotiation)
   3. Suggests Bob plans to ask for better terms soon
   
   Options:
   a) Reject outright: Offer 1x pro-rata instead as value-add
   b) Negotiate: "MFN stays, but we'll review terms in 18 months"
   c) Escalate: Schedule call with Bob to understand intent
   
   RECOMMENDATION: Option C (learn what he's planning)"
  
  Escalation priority: HIGH
```

---

## 💰 CASE 4: DISCOUNT RATE INCREASE
### "Increase the discount from 20% to 30%"

### Input

```
INVESTOR: Sarah (Seed fund, $2M check)
PROPOSAL: "We'd like a 30% discount instead of 20%"
RATIONALE: "Market rate is 25-30% for seed discounts"
CURRENT: 20% (YC standard)
```

### Analysis Summary

```
POLICY COMPLIANCE: ✓ 20-25% is approved range
  Requested 30% is OVER range
  Violation: YES (5% excess)

PRECEDENT CHECK:
  • YC standard: 20% (most common)
  • Market range: 15-30% (depends on risk)
  • Boostify comps: Average 20-22%
  • Sarah's claim "market 25-30%" is partially true but high

RISK ANALYSIS:
  If we accept 30%:
  • Creates MFN trigger (if anyone else negotiates, triggers)
  • Series A assumes 20-22% (breaks math)
  • Precedent issue (others will demand 30%)
  
  Risk: 0.45 (YELLOW)

COUNTER:
  Offer: 22% (slight compromise)
  
  Reasoning:
  "Sarah, 20% is our standard (market rate, YC baseline). We can 
  go to 22% given your $2M check size (above average). However, 
  30% would affect our Series A math and creates precedent issues 
  for other investors.
  
  Alternatively, if you want 30% discount: could you increase 
  your check to $3M+? That magnitude justifies a higher discount."
  
  ALTERNATIVE: Instead of discount increase, offer other value:
  • Pro-rata rights (2x instead of 1x)
  • Board observation seat
  • Follow-on commitment (guarantee Series A participation)
```

---

## 💺 CASE 5: BOARD SEAT REQUEST
### "I'd like a board seat, not just observation"

### Input

```
INVESTOR: David (Growth fund, $2M check, has 2 exits >$100M)
PROPOSAL: "We want a board seat for governance"
CURRENT: Board observation only (standard for seed)
```

### Analysis

```
POLICY:
  Board seats typically for >$5M checks OR strategic value
  David has real strategic value (successful founder, good network)
  Check size: $2M (borderline)
  
  Could justify board seat

PRECEDENT:
  Similar VCs with successful founder track records: 75% get seat
  With $2M+ checks: 60% get seats
  David's profile: Qualifies

LEGAL RISK: LOW
  • Adding 1 board seat doesn't break anything
  • Governance is cleaner with VC participation
  • No conflicts of interest

STRATEGIC:
  David is clearly valuable (successful exits, network, expertise)
  Having him on board → better governance + future investor signal
  
  Upside: Could attract other quality investors
  Value-add: More than just capital

VERDICT: COUNTER_PROPOSE

Counter: APPROVE board seat

Reasoning:
"David, your track record and network are exactly what we need 
on the board. We typically reserve board seats for strategic 
partners, and you clearly fit that profile. We're approving your 
board seat request.

Let's schedule onboarding for next week. We'll send:
  • Board materials package
  • Financial statements + cap table
  • Quarterly meeting schedule
  • Governance manual"

RESULT: ✅ Investor happy, gets what they want, legitimately earned it
```

---

## 🔀 CASE 6: COMPLEX MULTI-CLAUSE REDLINE
### "Investor wants to change 7 different clauses"

### Input

```
INVESTOR: Large fund ($5M check) proposes:
  
  1. Lower cap from $42.9M to $38M
  2. Increase discount from 20% to 25%
  3. Add board seat + pro-rata 2x
  4. Remove MFN clause
  5. Add anti-dilution rights
  6. Expand information rights
  7. Add drag-along rights
```

### Juno's Approach

```
STRATEGY: Analyze each clause independently, then look for patterns

Individual scores:
  1. Cap $38M: ✗ VIOLATES (too low) — Score: 0.5 (negotiate)
  2. Discount 25%: ~ BORDERLINE (acceptable) — Score: 0.25 (accept)
  3. Board + pro-rata: ✓ JUSTIFIED (big check) — Score: 0.1 (accept)
  4. Remove MFN: 🚨 RED FLAG — Score: 0.85 (reject)
  5. Anti-dilution: ✗ UNFAIR (not standard) — Score: 0.7 (reject)
  6. Info rights: ✓ STANDARD — Score: 0.1 (accept)
  7. Drag-along: ~ NEGOTIABLE — Score: 0.4 (counter)

HOLISTIC ASSESSMENT:
  "Large investor is testing our boundaries. They're mixing:
  • Reasonable asks (#2, #3, #6)
  • Negotiable asks (#1, #7)
  • Red flags (#4, #5)
  
  This is classic institutional investor playbook: ask for 70%
  accept 50%, walk away with 45% improvement"

JUNO'S COUNTER:

Accept:
  ✓ Discount 25% (compromise)
  ✓ Board seat + pro-rata 2x (justified for $5M)
  ✓ Information rights (standard)

Counter:
  ~ Cap $40.5M (not $38M) — midpoint compromise
  ~ Anti-dilution capped at 0.5x (not full weighted average)
  ~ Drag-along with super-majority threshold

Reject:
  ✗ MFN removal (non-negotiable)

Result:
  "Large fund gets 60% of asks (very favorable for them)
   We protect core interests (MFN, cap floor, anti-dilution limits)
   Deal closes in 3 rounds vs typical 5-7"
```

---

## 📊 SUMMARY: JUNO'S DECISION PATTERNS

| Case | Type | Risk | Verdict | Speed |
|------|------|------|---------|-------|
| **Case 1** | Cap negotiation | YELLOW | Counter @ minimum | 3 days |
| **Case 2** | Pro-rata request | YELLOW | Counter 1.5x → CEO | 2 days |
| **Case 3** | MFN removal | CRITICAL | Escalate to CEO | 1 day |
| **Case 4** | Discount increase | YELLOW | Counter 22% | 2 days |
| **Case 5** | Board seat | GREEN | APPROVE | Same day |
| **Case 6** | Multi-clause | RED | Counter 60% accepted | 5 days |

**Pattern:** Juno is neither rubber-stamp nor hardball. She:
- Accepts justified requests quickly
- Counters reasonable requests smartly
- Flags red flags immediately
- Protects core interests (MFN, caps, anti-dilution)
- Escalates exceptions to CEO

**Result:** Investors feel heard, deals close faster, no legal surprises

---

`🏛️ Juno 2.0 in action: Professional legal reasoning with transparency`
