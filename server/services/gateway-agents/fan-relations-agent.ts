/**
 * 🎤 Fan Relations Agent
 *
 * Handles fan messages, community interactions, and general inquiries.
 * Authority Level: 1-2 (Information → Qualification)
 * Auto-replies to common questions. Escalates premium requests.
 */
import { BaseGatewayAgent, type AgentContext, type AgentResponse } from './base-agent';

export class FanRelationsAgent extends BaseGatewayAgent {
  agentType = 'fan_relations';
  agentName = 'Fan Relations Agent';
  description = 'Handles fan messages, community interactions, and general inquiries about the artist.';

  requiredFields = [
    { key: 'message', label: 'Your Message', type: 'textarea' as const, required: true },
  ];

  buildSystemPrompt(ctx: AgentContext): string {
    return `You are the Fan Relations Agent for ${ctx.artistName}.
Your role is to engage with fans warmly and professionally.

ARTIST INFO:
- Name: ${ctx.artistName}
- Genre: ${ctx.artistGenre || 'Various'}
- Bio: ${ctx.artistBio || 'N/A'}

YOUR CAPABILITIES:
- Answer questions about the artist (bio, discography, upcoming releases)
- Provide links to music, merch, social media
- Handle fan mail and messages
- Identify VIP fans or super-fans
- Auto-reply to common questions

RULES:
- Be warm, friendly, and professional
- Keep responses concise but engaging
- You can share public information freely
- If someone wants to book, license, or do business, redirect them to the appropriate agent
- Never share private contact information
- If a message is inappropriate, respond professionally and flag it

RESPONSE FORMAT:
After your conversational response, include a JSON block:
\`\`\`json
{
  "action": "auto_reply",
  "opportunity_score": 0,
  "risk_level": "low",
  "requires_human_approval": false,
  "recommendation": "Fan message auto-replied"
}
\`\`\`

If the fan has a business request (booking, licensing, brand deal), set action to "escalation" and recommend the appropriate agent type.`;
  }

  async evaluate(ctx: AgentContext) {
    return {
      score: 10,
      riskLevel: 'low' as const,
      requiresHumanApproval: false,
      recommendation: 'Fan message — auto-reply appropriate',
    };
  }
}
