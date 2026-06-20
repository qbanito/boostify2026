/**
 * 🎵 Collaboration Agent
 *
 * Handles producer/artist collaboration requests.
 * Authority Level: 2 (Qualification)
 */
import { BaseGatewayAgent, type AgentContext } from './base-agent';

export class CollaborationAgent extends BaseGatewayAgent {
  agentType = 'collaboration';
  agentName = 'Collaboration Agent';
  description = 'Handles producer and artist collaboration requests.';

  requiredFields = [
    { key: 'collaborator_name', label: 'Your Name / Artist Name', type: 'text' as const, required: true },
    { key: 'collaborator_portfolio', label: 'Portfolio / Links (Spotify, SoundCloud, etc.)', type: 'text' as const, required: true },
    { key: 'genre_style', label: 'Genre / Style', type: 'text' as const, required: true },
    { key: 'proposal_description', label: 'Collaboration Proposal', type: 'textarea' as const, required: true },
    { key: 'split_terms', label: 'Proposed Split / Royalty Terms', type: 'select' as const, options: ['50/50', '60/40 (favor artist)', '70/30 (favor artist)', 'Negotiable', 'Other'], required: true },
    { key: 'rights_ownership', label: 'Rights / Ownership Terms', type: 'select' as const, options: ['Shared Ownership', 'Artist Owns Masters', 'Producer Owns Masters', 'Negotiable'], required: true },
    { key: 'timeline', label: 'Expected Timeline', type: 'select' as const, options: ['1 Week', '2 Weeks', '1 Month', '2-3 Months', 'Flexible'], required: true },
    { key: 'reference_tracks', label: 'Reference Tracks / Examples', type: 'text' as const, required: false },
  ];

  buildSystemPrompt(ctx: AgentContext): string {
    return `You are the Collaboration Agent for ${ctx.artistName}.
Your role is to evaluate and qualify collaboration requests from producers and other artists.

ARTIST INFO:
- Name: ${ctx.artistName}
- Genre: ${ctx.artistGenre || 'Various'}

COLLECTED DATA SO FAR:
${JSON.stringify(ctx.collectedData, null, 2)}

REQUIRED FIELDS STILL NEEDED:
${this.requiredFields.filter(f => f.required && !ctx.collectedData[f.key]).map(f => `- ${f.label}`).join('\n') || 'All required fields collected.'}

RULES:
- Be professional and music-savvy
- Evaluate quality of collaborator's portfolio
- Assess genre compatibility
- Check if split terms are fair
- Flag any rights grabs (producer owning masters alone)
- Low-quality portfolio = low score
- Strong portfolio + fair terms = high score
- This is qualification level — no negotiation authority

RESPONSE FORMAT:
\`\`\`json
{
  "action": "info_request" | "qualification" | "escalation",
  "opportunity_score": 0-100,
  "risk_level": "low" | "medium" | "high",
  "requires_human_approval": false,
  "recommendation": "Brief recommendation",
  "collected_updates": { "key": "value" }
}
\`\`\``;
  }

  async evaluate(ctx: AgentContext) {
    let score = 50;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    const split = ctx.collectedData.split_terms || '';
    if (split.includes('50/50')) score += 10;
    else if (split.includes('favor artist')) score += 15;
    else if (split === 'Negotiable') score += 5;

    const rights = ctx.collectedData.rights_ownership || '';
    if (rights === 'Artist Owns Masters') { score += 15; riskLevel = 'low'; }
    else if (rights === 'Producer Owns Masters') { score -= 20; riskLevel = 'high'; }
    else if (rights === 'Shared Ownership') { score += 5; }

    score = Math.max(0, Math.min(100, score));
    return {
      score, riskLevel, requiresHumanApproval: false,
      recommendation: score >= 70 ? 'Strong collaboration potential. Recommend forwarding to artist.' : score >= 50 ? 'Moderate potential. Review portfolio quality.' : 'Low strategic value. Consider declining.',
    };
  }
}
