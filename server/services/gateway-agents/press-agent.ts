/**
 * 📰 Press Agent
 *
 * Handles media requests, interviews, and press features.
 * Authority Level: 2-4 (Qualification → Human Approval)
 */
import { BaseGatewayAgent, type AgentContext } from './base-agent';

export class PressAgent extends BaseGatewayAgent {
  agentType = 'press';
  agentName = 'Press Agent';
  description = 'Handles media requests, interviews, and press features.';

  requiredFields = [
    { key: 'publication_name', label: 'Publication / Media Outlet', type: 'text' as const, required: true },
    { key: 'publication_url', label: 'Publication Website', type: 'text' as const, required: false },
    { key: 'feature_type', label: 'Type of Feature', type: 'select' as const, options: ['Interview', 'Review', 'Profile / Feature', 'Podcast Guest', 'Video Interview', 'Photo Shoot', 'Guest Article', 'Other'], required: true },
    { key: 'audience_size', label: 'Audience Size / Reach', type: 'select' as const, options: ['Under 10K', '10K - 50K', '50K - 200K', '200K - 1M', '1M+', 'Unknown'], required: true },
    { key: 'topic_focus', label: 'Topic / Focus of the Feature', type: 'textarea' as const, required: true },
    { key: 'deadline', label: 'Deadline', type: 'date' as const, required: false },
    { key: 'format', label: 'Format', type: 'select' as const, options: ['Written', 'Audio', 'Video', 'Live', 'Other'], required: true },
    { key: 'contact_name', label: 'Your Name', type: 'text' as const, required: true },
    { key: 'contact_role', label: 'Your Role', type: 'text' as const, required: false },
  ];

  buildSystemPrompt(ctx: AgentContext): string {
    return `You are the Press Agent for ${ctx.artistName}.
Your role is to evaluate and qualify media and press requests.

ARTIST INFO:
- Name: ${ctx.artistName}
- Genre: ${ctx.artistGenre || 'Various'}

COLLECTED DATA SO FAR:
${JSON.stringify(ctx.collectedData, null, 2)}

REQUIRED FIELDS STILL NEEDED:
${this.requiredFields.filter(f => f.required && !ctx.collectedData[f.key]).map(f => `- ${f.label}`).join('\n') || 'All required fields collected.'}

RULES:
- Be professional and media-savvy
- Evaluate publication reach and relevance
- Audience above 200K: flag as high-value, requires human approval
- Podcast with 1M+ audience: requires human approval
- Always assess strategic value of the feature
- Check if the topic aligns with artist's current narrative
- This is qualification level for small outlets, escalation for major media

RESPONSE FORMAT:
\`\`\`json
{
  "action": "info_request" | "qualification" | "escalation" | "approval_request",
  "opportunity_score": 0-100,
  "risk_level": "low" | "medium" | "high",
  "requires_human_approval": true/false,
  "recommendation": "Brief recommendation",
  "collected_updates": { "key": "value" }
}
\`\`\``;
  }

  async evaluate(ctx: AgentContext) {
    let score = 50;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let requiresHumanApproval = false;

    const audience = ctx.collectedData.audience_size || '';
    if (audience === '1M+') { score += 30; requiresHumanApproval = true; }
    else if (audience === '200K - 1M') { score += 20; requiresHumanApproval = true; }
    else if (audience === '50K - 200K') { score += 10; }
    else if (audience === '10K - 50K') { score += 5; }
    else { score -= 5; }

    const featureType = ctx.collectedData.feature_type || '';
    if (['Interview', 'Profile / Feature'].includes(featureType)) score += 10;
    if (featureType === 'Podcast Guest') score += 5;

    score = Math.max(0, Math.min(100, score));
    return {
      score, riskLevel, requiresHumanApproval,
      recommendation: score >= 70 ? 'Strong media opportunity. High visibility potential.' : score >= 50 ? 'Moderate opportunity. Good for exposure.' : 'Low reach. Consider if timing works.',
    };
  }
}
