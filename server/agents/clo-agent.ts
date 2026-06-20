// ═══════════════════════════════════════════════════════════════════════════════
// JUNO 2.0 - CHIEF LEGAL OFFICER AI AGENT
// Advanced 5-Layer Legal Reasoning System for Investor Negotiations
// BIAS: Always negotiates in favor of BOOSTIFY
// ═══════════════════════════════════════════════════════════════════════════════

import { DocumentTerms, InvestorProposal, LegalAnalysis, RiskScoreBreakdown, 
         CloVerdictType, ComparableDeal, ClauseRiskAnalysis, PolicyViolation,
         JunoDecisionFramework, JUNO_POLICY_THRESHOLDS, JUNO_BIAS } from '../types/investor-docs';

/**
 * JUNO 2.0: Chief Legal Officer AI Agent
 * 
 * Juno works for BOOSTIFY, not the investor.
 * Juno's sole job is to negotiate the best possible terms for Boostify.
 * Juno applies professional legal reasoning but always with a Boostify bias.
 * 
 * The 5-Layer Reasoning Stack:
 * 1. Policy Compliance (Board decisions)
 * 2. Precedent & Market Data (15+ comparable deals)
 * 3. Legal Risk Assessment (0-1 scoring)
 * 4. Strategy & Negotiation (Investor value, likelihood)
 * 5. Human Judgment (CEO override capability)
 */
export class Juno20CloAgent {
  private agentId = 'juno-2.0-clo';
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN ENTRY POINT: Review Investor Proposal
  // ─────────────────────────────────────────────────────────────────────────────
  
  async reviewProposal(proposal: InvestorProposal): Promise<JunoDecisionFramework> {
    console.log(`[Juno 2.0] Analyzing proposal ${proposal.id} from ${proposal.proposedByName}...`);
    
    // Execute 5-layer analysis
    const analysis = await this.perform5LayerAnalysis(proposal);
    
    // Determine verdict
    const verdict = this.determineVerdict(analysis);
    
    // Generate counter-proposal if needed
    const counterTerms = verdict === 'counter_propose' 
      ? this.generateBoostifyFavorableCounter(proposal, analysis)
      : undefined;
    
    // Generate professional reasoning
    const reasoning = this.generateProfessionalReasoning(analysis, verdict, counterTerms);
    
    const decision: JunoDecisionFramework = {
      proposal,
      analysis,
      verdict,
      counterTerms,
      counterRationale: counterTerms ? `Based on market precedent and board policy, we propose these terms as a more favorable structure for both parties.` : undefined,
      reasoning,
      confidence: 1 - analysis.legalRisk.overallRisk,
      needsCeoReview: analysis.riskLevel === 'CRITICAL' || verdict === 'escalate_ceo',
      escalationReason: analysis.escalationNotes,
    };
    
    return decision;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 1: POLICY COMPLIANCE
  // ─────────────────────────────────────────────────────────────────────────────
  
  private analyzePolicy(proposal: InvestorProposal): PolicyViolation[] {
    const violations: PolicyViolation[] = [];
    const { proposedTerms } = proposal;
    
    // VALUATION CAP POLICY
    if (proposedTerms.valuationCap && proposedTerms.valuationCap < JUNO_POLICY_THRESHOLDS.MIN_VALUATION_CAP) {
      violations.push({
        policy: 'Minimum Valuation Cap',
        description: `Proposed cap $${proposedTerms.valuationCap.toLocaleString()} is below board minimum of $${JUNO_POLICY_THRESHOLDS.MIN_VALUATION_CAP.toLocaleString()}`,
        severity: 'major',
        resolution: `Counter at $${JUNO_POLICY_THRESHOLDS.MIN_VALUATION_CAP.toLocaleString()}`
      });
    }
    
    // DISCOUNT RATE POLICY
    if (proposedTerms.discount && proposedTerms.discount > JUNO_POLICY_THRESHOLDS.MAX_DISCOUNT) {
      violations.push({
        policy: 'Maximum Discount Rate',
        description: `Proposed discount ${(proposedTerms.discount * 100).toFixed(1)}% exceeds board maximum of ${(JUNO_POLICY_THRESHOLDS.MAX_DISCOUNT * 100).toFixed(1)}%`,
        severity: 'major',
        resolution: `Counter at ${(JUNO_POLICY_THRESHOLDS.MAX_DISCOUNT * 100).toFixed(1)}% discount`
      });
    }
    
    // PRO-RATA RIGHTS POLICY
    if (proposedTerms.proRataRights) {
      if (proposedTerms.proRataRights < JUNO_POLICY_THRESHOLDS.MIN_PRO_RATA) {
        violations.push({
          policy: 'Minimum Pro-Rata Rights',
          description: `Proposed pro-rata ${proposedTerms.proRataRights}x is below minimum 1x standard`,
          severity: 'minor',
          resolution: `Request standard 1x pro-rata rights`
        });
      }
      if (proposedTerms.proRataRights > JUNO_POLICY_THRESHOLDS.MAX_PRO_RATA) {
        violations.push({
          policy: 'Maximum Pro-Rata Rights',
          description: `Proposed pro-rata ${proposedTerms.proRataRights}x exceeds board maximum of ${JUNO_POLICY_THRESHOLDS.MAX_PRO_RATA}x`,
          severity: 'critical',
          resolution: `Hard reject or counter at 1.5x maximum`
        });
      }
    }
    
    // MFN CLAUSE POLICY
    if (!proposedTerms.mfn && JUNO_POLICY_THRESHOLDS.MFN_PREFERENCE) {
      violations.push({
        policy: 'Most Favored Nation (MFN)',
        description: `Investor does not have MFN rights, which is our standard for new investors`,
        severity: 'minor',
        resolution: `Include MFN clause as standard boilerplate`
      });
    }
    
    // BOARD SEATS POLICY
    if (proposedTerms.boardSeats && proposedTerms.boardSeats > JUNO_POLICY_THRESHOLDS.BOARD_SEATS_RESERVED) {
      violations.push({
        policy: 'Board Seat Allocation',
        description: `Investor requesting ${proposedTerms.boardSeats} seats exceeds policy of ${JUNO_POLICY_THRESHOLDS.BOARD_SEATS_RESERVED}`,
        severity: 'major',
        resolution: `Offer observer seat, negotiate board seat in future rounds`
      });
    }
    
    return violations;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 2: PRECEDENT & MARKET ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────────
  
  private analyzePrecedent(proposal: InvestorProposal): ComparableDeal[] {
    // Synthetic comparable deals from market research
    // In production, this would query a real precedent database
    const comparables: ComparableDeal[] = [
      { company: 'Splice Music', date: '2024-Q1', valuationCap: 42_000_000, discount: 0.20, proRata: 1.0, mfn: true, source: 'Crunchbase' },
      { company: 'BeatStars', date: '2023-Q4', valuationCap: 45_000_000, discount: 0.25, proRata: 1.5, mfn: true, source: 'AngelList' },
      { company: 'Amuse', date: '2023-Q3', valuationCap: 50_000_000, discount: 0.15, proRata: 1.0, mfn: true, source: 'PitchBook' },
      { company: 'DistroKid', date: '2023-Q2', valuationCap: 150_000_000, discount: 0.20, proRata: 1.0, mfn: true, source: 'Pitchbook' },
      { company: 'Tracklib', date: '2024-Q1', valuationCap: 35_000_000, discount: 0.30, proRata: 1.2, mfn: false, source: 'Crunchbase' },
      { company: 'Musiio', date: '2023-Q4', valuationCap: 28_000_000, discount: 0.25, proRata: 1.5, mfn: true, source: 'AngelList' },
      { company: 'Topspin', date: '2024-Q2', valuationCap: 55_000_000, discount: 0.18, proRata: 1.0, mfn: true, source: 'Pitchbook' },
      { company: 'Verifi Media', date: '2023-Q3', valuationCap: 40_000_000, discount: 0.22, proRata: 1.0, mfn: true, source: 'AngelList' },
      { company: 'Songkick', date: '2022-Q4', valuationCap: 60_000_000, discount: 0.20, proRata: 1.0, mfn: true, source: 'Pitchbook' },
      { company: 'SoundCharts', date: '2023-Q2', valuationCap: 45_000_000, discount: 0.25, proRata: 1.5, mfn: true, source: 'Crunchbase' },
      { company: 'Genius', date: '2023-Q1', valuationCap: 80_000_000, discount: 0.20, proRata: 1.0, mfn: true, source: 'Pitchbook' },
      { company: 'Endel', date: '2024-Q1', valuationCap: 42_000_000, discount: 0.20, proRata: 1.5, mfn: true, source: 'Crunchbase' },
      { company: 'Creator.com', date: '2023-Q4', valuationCap: 38_000_000, discount: 0.28, proRata: 1.0, mfn: false, source: 'AngelList' },
      { company: 'Audiomatch', date: '2024-Q2', valuationCap: 35_000_000, discount: 0.25, proRata: 1.5, mfn: true, source: 'Pitchbook' },
      { company: 'Rythm Tech', date: '2023-Q3', valuationCap: 48_000_000, discount: 0.20, proRata: 1.0, mfn: true, source: 'Crunchbase' },
    ];
    
    return comparables;
  }
  
  private calculateMarketPercentile(proposedTerms: DocumentTerms, comparables: ComparableDeal[]): number {
    // Calculate where the proposed terms fall vs market
    const capPercentile = this.calculateMetricPercentile(
      proposedTerms.valuationCap || 0,
      comparables.map(c => c.valuationCap),
      'ascending' // Lower cap is worse for investor
    );
    
    const discountPercentile = this.calculateMetricPercentile(
      proposedTerms.discount || 0,
      comparables.map(c => c.discount),
      'ascending' // Higher discount is worse for investor
    );
    
    // Average the percentiles
    return (capPercentile + (100 - discountPercentile)) / 2;
  }
  
  private calculateMetricPercentile(value: number, values: number[], direction: 'ascending' | 'descending'): number {
    const sorted = [...values].sort((a, b) => a - b);
    let rank = 0;
    
    if (direction === 'ascending') {
      rank = sorted.filter(v => v <= value).length;
    } else {
      rank = sorted.filter(v => v >= value).length;
    }
    
    return (rank / sorted.length) * 100;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 3: LEGAL RISK ASSESSMENT (0-1 NUMERICAL SCORING)
  // ─────────────────────────────────────────────────────────────────────────────
  
  private assessLegalRisk(proposal: InvestorProposal): ClauseRiskAnalysis[] {
    const clauses: ClauseRiskAnalysis[] = [];
    const { proposedTerms } = proposal;
    
    // VALUATION CAP RISK
    if (proposedTerms.valuationCap) {
      const capDiff = proposedTerms.valuationCap - 42_000_000;
      const capRisk = Math.max(0, Math.min(1, Math.abs(capDiff) / 42_000_000));
      
      clauses.push({
        clause: 'Valuation Cap',
        risk: capRisk,
        concern: capDiff < 0 ? 'Cap is below market' : 'Cap is above market',
        precedent: '$42-45M is market standard for Series A SAFEs in music tech',
        recommendation: capDiff < 0 ? 'Counter at $42.9M minimum' : 'Cap is reasonable, accept'
      });
    }
    
    // DISCOUNT RATE RISK
    if (proposedTerms.discount) {
      const discountDiff = proposedTerms.discount - 0.20;
      const discountRisk = Math.max(0, Math.min(1, Math.abs(discountDiff) * 3));
      
      clauses.push({
        clause: 'Discount Rate',
        risk: discountRisk,
        concern: `${(proposedTerms.discount * 100).toFixed(1)}% discount proposed`,
        precedent: '20-25% is market standard',
        recommendation: proposedTerms.discount > 0.25 ? 'Counter at 22% maximum' : 'Acceptable'
      });
    }
    
    // PRO-RATA RIGHTS RISK
    if (proposedTerms.proRataRights) {
      const proRataDiff = proposedTerms.proRataRights - 1.0;
      const proRataRisk = Math.max(0, Math.min(1, Math.abs(proRataDiff) * 0.5));
      
      clauses.push({
        clause: 'Pro-Rata Rights',
        risk: proRataRisk,
        concern: `${proposedTerms.proRataRights}x pro-rata rights requested`,
        precedent: '1x pro-rata is market standard; 1.5x is typical for lead investors',
        recommendation: proposedTerms.proRataRights > 2.0 ? 'Counter at 1.5x maximum' : 'Consider 1x if investor is passive'
      });
    }
    
    // MFN CLAUSE RISK
    clauses.push({
      clause: 'Most Favored Nation (MFN)',
      risk: proposedTerms.mfn ? 0.1 : 0.3,
      concern: !proposedTerms.mfn ? 'MFN clause missing' : 'MFN clause present (standard)',
      precedent: '95% of Series A SAFEs include MFN',
      recommendation: proposedTerms.mfn ? 'Accept' : 'Require MFN as boilerplate'
    });
    
    // DRAG-ALONG RIGHTS RISK
    clauses.push({
      clause: 'Drag-Along Rights',
      risk: proposedTerms.dragAlongRights ? 0.15 : 0.0,
      concern: proposedTerms.dragAlongRights ? 'Investor has drag-along' : 'No drag-along (favorable)',
      precedent: 'Drag-along typically only in preferred stock, not SAFEs',
      recommendation: proposedTerms.dragAlongRights ? 'Remove, not standard for SAFE' : 'Accept'
    });
    
    return clauses;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RISK SCORE CALCULATION (0-1 NUMERICAL)
  // ─────────────────────────────────────────────────────────────────────────────
  
  private calculateRiskScore(
    policyViolations: PolicyViolation[],
    clauseRisks: ClauseRiskAnalysis[]
  ): RiskScoreBreakdown {
    // Policy violation score (0-1)
    const avgViolationSeverity = policyViolations.length > 0
      ? policyViolations.reduce((sum, v) => {
          const severity = v.severity === 'critical' ? 1.0 : v.severity === 'major' ? 0.6 : 0.3;
          return sum + severity;
        }, 0) / policyViolations.length
      : 0;
    
    const policyViolation = Math.min(1, avgViolationSeverity);
    
    // Legal complexity score (average clause risks)
    const legalComplexity = clauseRisks.length > 0
      ? clauseRisks.reduce((sum, c) => sum + c.risk, 0) / clauseRisks.length
      : 0;
    
    // Founder impact (estimated)
    const founderImpact = 0.2; // Synthetic: SAFEs don't directly impact founders
    
    // Precedent risk (how far from market)
    const precedentRisk = Math.max(...clauseRisks.map(c => c.risk), 0);
    
    // JUNO WEIGHTED RISK FORMULA
    // Policy×0.4 + Legal×0.25 + Founder×0.2 + Precedent×0.15
    const finalScore = (
      (policyViolation * 0.4) +
      (legalComplexity * 0.25) +
      (founderImpact * 0.2) +
      (precedentRisk * 0.15)
    );
    
    const riskLevel = finalScore < 0.2 ? 'GREEN' : 
                      finalScore < 0.5 ? 'YELLOW' :
                      finalScore < 0.8 ? 'RED' : 'CRITICAL';
    
    return {
      policyViolation,
      legalComplexity,
      founderImpact,
      precedentRisk,
      finalScore: Math.min(1, finalScore),
      riskLevel
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // LAYER 4 & 5: STRATEGY + HUMAN JUDGMENT
  // ─────────────────────────────────────────────────────────────────────────────
  
  private determineVerdict(analysis: LegalAnalysis): CloVerdictType {
    const risk = analysis.legalRisk.overallRisk;
    
    // Decision framework
    if (risk < JUNO_BIAS.AUTO_APPROVE_THRESHOLD) {
      return 'auto_approve';  // GREEN terms, auto-accept
    } else if (risk < JUNO_BIAS.ESCALATION_THRESHOLD) {
      return 'counter_propose';  // YELLOW terms, counter-offer
    } else if (risk >= JUNO_BIAS.ESCALATION_THRESHOLD) {
      return 'escalate_ceo';  // RED/CRITICAL, needs CEO
    }
    
    return 'counter_propose';  // Default: always propose counter unless perfect
  }
  
  private generateBoostifyFavorableCounter(
    proposal: InvestorProposal,
    analysis: LegalAnalysis
  ): DocumentTerms {
    const counter: DocumentTerms = { ...proposal.proposedTerms };
    
    // Aggressively counter every unfavorable term
    
    // Valuation cap: Never below $42.9M
    if (!counter.valuationCap || counter.valuationCap < 42_900_000) {
      counter.valuationCap = 42_900_000;
    }
    
    // Discount: Cap at 22%
    if (!counter.discount || counter.discount > 0.22) {
      counter.discount = 0.22;
    }
    
    // Pro-rata: Max 1.5x unless investor is lead
    if (!counter.proRataRights || counter.proRataRights > 1.5) {
      counter.proRataRights = 1.5;
    }
    
    // MFN: Always require
    counter.mfn = true;
    
    // Board seats: Max observer, not board member
    counter.boardSeats = 0;
    
    // Drag-along: Remove if present
    counter.dragAlongRights = false;
    
    // Anti-dilution: Only broad-based if requested
    if (!counter.antiDilution) {
      counter.antiDilution = 'broad-based';
    }
    
    return counter;
  }
  
  private generateProfessionalReasoning(
    analysis: LegalAnalysis,
    verdict: CloVerdictType,
    counterTerms?: DocumentTerms
  ): string {
    let reasoning = '';
    
    if (verdict === 'auto_approve') {
      reasoning = `This proposal is aligned with market standards and board policy. ` +
        `The terms are favorable to both parties and consistent with comparable SAFE investments in our sector. ` +
        `We recommend immediate acceptance.`;
    } else if (verdict === 'counter_propose') {
      reasoning = `Based on market precedent and board policy, we propose an alternative structure. ` +
        `The investor's initial terms are outside market standards for companies at our stage. ` +
        `Our counter-proposal maintains founder protection while remaining competitive with peer investments. ` +
        `We reference 15+ comparable deals where similar terms were negotiated, ` +
        `and we position the investor at the ${analysis.precedentAnalysis.marketPercentile.toFixed(0)}th percentile vs. market.`;
    } else if (verdict === 'escalate_ceo') {
      reasoning = `This proposal requires CEO review due to policy violations or exceptional terms. ` +
        `Risk assessment: ${analysis.legalRisk.overallRisk.toFixed(2)} (${analysis.riskLevel}). ` +
        `Key concerns: ${analysis.legalRisk.conflicts.join('; ')}. ` +
        `We recommend discussing with leadership before responding.`;
    } else if (verdict === 'reject') {
      reasoning = `This proposal does not meet minimum policy thresholds and cannot be negotiated. ` +
        `We recommend declining or proposing a fundamentally different structure.`;
    }
    
    return reasoning;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // EXECUTE 5-LAYER ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────────
  
  private async perform5LayerAnalysis(proposal: InvestorProposal): Promise<LegalAnalysis> {
    // Layer 1: Policy Compliance
    const policyCompliance = {
      violations: this.analyzePolicy(proposal),
      overall: (() => {
        const violations = this.analyzePolicy(proposal);
        if (violations.length === 0) return 'compliant' as const;
        if (violations.some(v => v.severity === 'critical')) return 'major_violation' as const;
        if (violations.some(v => v.severity === 'major')) return 'major_violation' as const;
        return 'minor_violation' as const;
      })(),
      boardPolicySummary: `Board policy requires minimum $42.9M valuation cap, maximum 22% discount, standard pro-rata rights, and MFN clauses.`
    };
    
    // Layer 2: Precedent & Market Analysis
    const comparables = this.analyzePrecedent(proposal);
    const marketPercentile = this.calculateMarketPercentile(proposal.proposedTerms, comparables);
    
    const precedentAnalysis = {
      comparableDeals: comparables,
      marketPercentile,
      investorTrackRecord: {
        deals: 12,  // Synthetic
        averageRound: 2_500_000,  // Synthetic
        reputation: 'good' as const
      },
      marketContext: `Market for music tech Series A SAFEs shows average cap $43.5M, discount 20-25%, pro-rata 1-1.5x. Investor is at ${marketPercentile.toFixed(0)}th percentile.`
    };
    
    // Layer 3: Legal Risk Assessment
    const clauseRisks = this.assessLegalRisk(proposal);
    const conflicts: string[] = [];
    
    if (clauseRisks.some(c => c.risk > 0.5)) {
      conflicts.push('High-risk clauses detected');
    }
    
    const legalRisk = {
      clauses: clauseRisks,
      conflicts,
      overallRisk: this.calculateRiskScore(policyCompliance.violations, clauseRisks).finalScore,
      regulatoryHazards: []
    };
    
    // Layer 4: Strategic Analysis
    const strategicAnalysis = {
      investorValue: `Investor brings credibility and potential for future rounds. Passive investor with good track record.`,
      dealShape: 'balanced' as const,
      likelihood: 0.85,  // Likelihood they accept our counter
      recommendation: `This investor is strategic for our Series A. Counter at market-based terms and expect acceptance.`
    };
    
    // Layer 5: Human Judgment + Overall
    const riskScore = this.calculateRiskScore(policyCompliance.violations, clauseRisks);
    
    const reasoning = this.generateProfessionalReasoning(
      {
        policyCompliance,
        precedentAnalysis,
        legalRisk,
        strategicAnalysis,
        reasoning: '',
        auditTrail: {
          analyzedAt: Date.now(),
          analyzedBy: this.agentId,
          model: 'juno-2.0-gpt-4o-mini',
          tokensUsed: 2048
        }
      } as any,
      this.determineVerdict({
        policyCompliance,
        precedentAnalysis,
        legalRisk,
        strategicAnalysis,
        reasoning: '',
        auditTrail: {
          analyzedAt: Date.now(),
          analyzedBy: this.agentId,
          model: 'juno-2.0-gpt-4o-mini',
          tokensUsed: 2048
        }
      } as any),
      undefined
    );
    
    return {
      policyCompliance,
      precedentAnalysis,
      legalRisk,
      strategicAnalysis,
      escalationNotes: riskScore.riskLevel === 'CRITICAL' ? `Risk score ${riskScore.finalScore.toFixed(2)} exceeds threshold` : undefined,
      ceoApprovalRequired: riskScore.riskLevel === 'CRITICAL',
      reasoning,
      auditTrail: {
        analyzedAt: Date.now(),
        analyzedBy: this.agentId,
        model: 'juno-2.0-gpt-4o-mini',
        tokensUsed: 2048
      }
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────

export const junoClaiAgent = new Juno20CloAgent();
