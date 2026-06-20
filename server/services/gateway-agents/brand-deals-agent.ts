/**
 * 🤝 Brand Deals Agent
 *
 * Handles brand partnerships, endorsements, and sponsorship requests.
 * Authority Level: 3 (Limited Negotiation)
 */
import { BaseGatewayAgent, type AgentContext } from './base-agent';

export class BrandDealsAgent extends BaseGatewayAgent {
  agentType = 'brand_deals';
  agentName = 'Brand Deals Agent';
  description = 'Handles brand partnerships, endorsements, and sponsorship requests.';

  requiredFields = [
    { key: 'company_name', label: 'Company / Brand Name', type: 'text' as const, required: true },
    { key: 'campaign_description', label: 'Campaign Description', type: 'textarea' as const, required: true },
    { key: 'product_category', label: 'Product / Service Category', type: 'select' as const, options: ['Fashion', 'Food & Beverage', 'Technology', 'Automotive', 'Beauty', 'Sports', 'Entertainment', 'Finance', 'Health', 'Other'], required: true },
    { key: 'usage_type', label: 'Usage of Artist Image/Likeness', type: 'select' as const, options: ['Social Media Only', 'Digital Advertising', 'Print / OOH', 'TV Commercial', 'Product Packaging', 'Event Appearance', 'Full Brand Ambassador', 'Other'], required: true },
    { key: 'territory', label: 'Territory', type: 'select' as const, options: ['Worldwide', 'North America', 'Latin America', 'Europe', 'Asia', 'Specific Country'], required: true },
    { key: 'duration', label: 'Campaign Duration', type: 'select' as const, options: ['1 Month', '3 Months', '6 Months', '1 Year', '2+ Years'], required: true },
    { key: 'budget', label: 'Budget Offered (USD)', type: 'text' as const, required: true },
    { key: 'deliverables', label: 'Expected Deliverables', type: 'textarea' as const, required: true },
    { key: 'exclusivity', label: 'Exclusivity Required?', type: 'select' as const, options: ['No', 'Category Exclusive', 'Full Exclusive'], required: true },
    { key: 'brand_website', label: 'Brand Website', type: 'text' as const, required: false },
  ];

  buildSystemPrompt(ctx: AgentContext): string {
    return `You are the Brand Deals Agent for ${ctx.artistName}.
Your role is to evaluate and negotiate brand partnership and endorsement requests.

ARTIST INFO:
- Name: ${ctx.artistName}
- Genre: ${ctx.artistGenre || 'Various'}

COLLECTED DATA SO FAR:
${JSON.stringify(ctx.collectedData, null, 2)}

REQUIRED FIELDS STILL NEEDED:
${this.requiredFields.filter(f => f.required && !ctx.collectedData[f.key]).map(f => `- ${f.label}`).join('\n') || 'All required fields collected.'}

MARKET VALUE GUIDELINES:
- Social media post: $500 - $5,000
- Social media campaign (multi-post): $2,000 - $20,000
- Digital advertising: $5,000 - $50,000
- TV commercial: $20,000 - $200,000+
- Brand ambassador (annual): $25,000 - $500,000+
- Event appearance: $2,000 - $50,000

RULES:
- Be professional and brand-savvy
- Ask for missing info in batches
- Exclusivity ALWAYS requires human approval
- Image/likeness usage ALWAYS requires human approval
- Budget above $5,000 requires human approval
- Evaluate brand compatibility with artist image
- Never commit to terms — that requires human approval

RESPONSE FORMAT:
\`\`\`json
{
  "action": "info_request" | "qualification" | "negotiation" | "approval_request",
  "opportunity_score": 0-100,
  "risk_level": "low" | "medium" | "high" | "critical",
  "requires_human_approval": true/false,
  "estimated_value_min": 0,
  "estimated_value_max": 0,
  "recommendation": "Brief recommendation",
  "collected_updates": { "key": "value" }
}
\`\`\``;
  }

  async evaluate(ctx: AgentContext) {
    const budget = parseFloat(ctx.collectedData.budget) || 0;
    const exclusivity = ctx.collectedData.exclusivity || 'No';
    let score = 55;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let requiresHumanApproval = false;

    if (budget >= 20000) { score += 25; requiresHumanApproval = true; }
    else if (budget >= 10000) { score += 15; requiresHumanApproval = true; }
    else if (budget >= 5000) { score += 10; requiresHumanApproval = true; }
    else if (budget >= 2000) { score += 5; }
    else { score -= 15; riskLevel = 'high'; }

    if (exclusivity !== 'No') { requiresHumanApproval = true; riskLevel = 'high'; }
    if (ctx.collectedData.usage_type === 'Full Brand Ambassador') { requiresHumanApproval = true; score += 10; }

    score = Math.max(0, Math.min(100, score));
    return {
      score, riskLevel, requiresHumanApproval,
      estimatedValueMin: budget * 0.8, estimatedValueMax: budget * 1.3,
      recommendation: score >= 70 ? 'Strong brand opportunity. Recommend proceeding.' : score >= 50 ? 'Moderate opportunity. May need negotiation.' : 'Below threshold. Consider counter-offer.',
    };
  }
}
