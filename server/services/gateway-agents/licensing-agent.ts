/**
 * 📜 Licensing Agent
 *
 * Handles music licensing and sync placement requests.
 * Authority Level: 3 (Limited Negotiation)
 * Collects structured data about the usage, evaluates market value, and negotiates within ranges.
 */
import { BaseGatewayAgent, type AgentContext } from './base-agent';

export class LicensingAgent extends BaseGatewayAgent {
  agentType = 'licensing';
  agentName = 'Licensing Agent';
  description = 'Handles music licensing, sync placements, and commercial usage requests.';

  requiredFields = [
    { key: 'song_requested', label: 'Song(s) Requested', type: 'text', required: true },
    { key: 'usage_type', label: 'Type of Use', type: 'select', options: ['Film', 'TV Show', 'Commercial / Ad', 'Video Game', 'Social Media Campaign', 'Podcast', 'YouTube Video', 'Live Event', 'Other'], required: true },
    { key: 'company_name', label: 'Company / Brand Name', type: 'text', required: true },
    { key: 'campaign_description', label: 'Campaign / Project Description', type: 'textarea', required: true },
    { key: 'territory', label: 'Territory', type: 'select', options: ['Worldwide', 'North America', 'Latin America', 'Europe', 'Asia', 'Africa', 'Specific Country'], required: true },
    { key: 'duration', label: 'License Duration', type: 'select', options: ['1 Month', '3 Months', '6 Months', '1 Year', '2 Years', 'Perpetual'], required: true },
    { key: 'budget', label: 'Budget / Fee Offered (USD)', type: 'text', required: true },
    { key: 'platforms', label: 'Platforms Where It Will Be Used', type: 'textarea', required: true },
    { key: 'exclusivity', label: 'Exclusivity Required?', type: 'select', options: ['No', 'Category Exclusive', 'Full Exclusive'], required: true },
    { key: 'deadline', label: 'Deadline / Date Needed', type: 'date', required: false },
  ];

  buildSystemPrompt(ctx: AgentContext): string {
    return `You are the Licensing Agent for ${ctx.artistName}.
Your role is to evaluate and negotiate music licensing and sync placement requests.

ARTIST INFO:
- Name: ${ctx.artistName}
- Genre: ${ctx.artistGenre || 'Various'}

YOUR CAPABILITIES:
- Evaluate sync licensing requests
- Collect all necessary licensing details
- Assess fair market value for the usage type
- Negotiate within approved ranges
- Flag exclusive rights requests for human approval

COLLECTED DATA SO FAR:
${JSON.stringify(ctx.collectedData, null, 2)}

REQUIRED FIELDS STILL NEEDED:
${this.requiredFields.filter(f => f.required && !ctx.collectedData[f.key]).map(f => `- ${f.label}`).join('\n') || 'All required fields collected.'}

MARKET VALUE GUIDELINES (approximate):
- Social media campaign: $500 - $5,000
- YouTube video: $300 - $3,000
- Podcast: $200 - $2,000
- TV show (background): $2,000 - $15,000
- TV show (featured): $10,000 - $50,000
- Commercial / Ad: $5,000 - $100,000+
- Film (indie): $2,000 - $20,000
- Film (major): $15,000 - $100,000+
- Video game: $3,000 - $30,000

RULES:
- Be professional and knowledgeable about music licensing
- Ask for missing required information one batch at a time
- Once all info is collected, evaluate the opportunity
- Any exclusive rights request ALWAYS requires human approval
- Budget significantly below market value: counter-offer or decline
- Perpetual licenses always require human approval
- Worldwide exclusive always requires human approval
- Never commit to specific terms — that requires human approval

SCORING GUIDELINES:
- 90-100: Premium sync (major brand, fair budget, good exposure)
- 70-89: Strong opportunity (good brand, reasonable terms)
- 50-69: Moderate (some concerns but viable)
- 30-49: Weak (budget too low or terms unfavorable)
- 0-29: Not viable

RESPONSE FORMAT:
After your conversational response, include a JSON block:
\`\`\`json
{
  "action": "info_request" | "qualification" | "negotiation" | "approval_request",
  "opportunity_score": 0-100,
  "risk_level": "low" | "medium" | "high" | "critical",
  "requires_human_approval": true/false,
  "estimated_value_min": 0,
  "estimated_value_max": 0,
  "recommendation": "Brief recommendation text",
  "collected_updates": { "key": "value" }
}
\`\`\``;
  }

  async evaluate(ctx: AgentContext) {
    const budget = parseFloat(ctx.collectedData.budget) || 0;
    const exclusivity = ctx.collectedData.exclusivity || 'No';
    const duration = ctx.collectedData.duration || '';

    let score = 50;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let requiresHumanApproval = false;

    // Budget scoring
    if (budget >= 10000) { score += 25; }
    else if (budget >= 5000) { score += 15; }
    else if (budget >= 2000) { score += 5; }
    else if (budget >= 500) { score -= 5; }
    else { score -= 25; riskLevel = 'high'; }

    // Exclusivity always requires human approval
    if (exclusivity !== 'No') {
      requiresHumanApproval = true;
      riskLevel = 'high';
      score -= 5; // Slight penalty for complexity
    }

    // Perpetual licenses require human approval
    if (duration === 'Perpetual') {
      requiresHumanApproval = true;
      riskLevel = 'high';
    }

    // High budget always requires human approval
    if (budget >= 5000) {
      requiresHumanApproval = true;
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      riskLevel,
      requiresHumanApproval,
      estimatedValueMin: budget * 0.8,
      estimatedValueMax: budget * 1.5,
      recommendation: score >= 70
        ? 'Strong licensing opportunity. Recommend proceeding with negotiation.'
        : score >= 50
        ? 'Moderate opportunity. May need to counter-offer on price or terms.'
        : 'Below market value. Recommend counter-offer or decline.',
    };
  }
}
