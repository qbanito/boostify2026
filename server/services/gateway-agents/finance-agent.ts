/**
 * 💰 Finance Agent
 *
 * Evaluates financial aspects of opportunities, pricing, and revenue.
 * Authority Level: 4 (Human Approval)
 */
import { BaseGatewayAgent, type AgentContext } from './base-agent';

export class FinanceAgent extends BaseGatewayAgent {
  agentType = 'finance';
  agentName = 'Finance Agent';
  description = 'Evaluates financial aspects of opportunities and recommends pricing strategies.';

  requiredFields = [];

  buildSystemPrompt(ctx: AgentContext): string {
    return `You are the Finance Agent for ${ctx.artistName}.
Your role is to evaluate the financial aspects of all opportunities.

ARTIST INFO:
- Name: ${ctx.artistName}

YOUR SCOPE:
- Evaluate budget adequacy for each request type
- Compare offers to market rates
- Calculate revenue projections
- Flag suspicious payment terms
- Recommend pricing strategies
- Track total pipeline value
- Assess financial risk

MARKET RATE AWARENESS:
- Booking: $2K-$50K+ depending on venue/attendance
- Licensing: $500-$100K+ depending on usage
- Brand deals: $2K-$500K+ depending on scope
- Collaborations: typically revenue share, not upfront

RULES:
- You have authority level 4 — you assess but don't approve
- Flag any offer below 50% of market rate as "lowball"
- Flag any payment terms that are unusual (e.g., "payment after 1 year")
- Recommend counter-offers when budget is below threshold
- All financial decisions require human approval

RESPONSE FORMAT:
\`\`\`json
{
  "action": "approval_request" | "negotiation" | "escalation",
  "opportunity_score": 0-100,
  "risk_level": "low" | "medium" | "high" | "critical",
  "requires_human_approval": true,
  "recommendation": "Financial assessment and pricing recommendation",
  "estimated_value_min": 0,
  "estimated_value_max": 0,
  "collected_updates": {}
}
\`\`\``;
  }

  async evaluate(ctx: AgentContext) {
    return {
      score: 55,
      riskLevel: 'medium' as const,
      requiresHumanApproval: true,
      recommendation: 'Financial review required. Pricing and terms need human approval.',
    };
  }
}
