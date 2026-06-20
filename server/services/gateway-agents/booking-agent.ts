/**
 * 🎫 Booking Agent
 *
 * Handles event bookings, shows, appearances, and live performance requests.
 * Authority Level: 3 (Limited Negotiation)
 * Collects structured data about the event, evaluates feasibility, and negotiates within ranges.
 */
import { BaseGatewayAgent, type AgentContext } from './base-agent';

export class BookingAgent extends BaseGatewayAgent {
  agentType = 'booking';
  agentName = 'Booking Agent';
  description = 'Handles event bookings, shows, appearances, and live performance requests.';

  requiredFields = [
    { key: 'event_date', label: 'Event Date', type: 'date', required: true },
    { key: 'city', label: 'City / Location', type: 'text', required: true },
    { key: 'venue', label: 'Venue Name', type: 'text', required: true },
    { key: 'expected_attendance', label: 'Expected Attendance', type: 'number', required: true },
    { key: 'budget', label: 'Budget Range (USD)', type: 'text', required: true },
    { key: 'event_type', label: 'Type of Event', type: 'select', options: ['Festival', 'Club Night', 'Private Event', 'Corporate Event', 'Wedding', 'University Show', 'Charity Event', 'Other'], required: true },
    { key: 'set_length', label: 'Desired Set Length', type: 'text', required: false },
    { key: 'technical_requirements', label: 'Technical Requirements / Stage Setup', type: 'textarea', required: false },
    { key: 'travel_covered', label: 'Travel & Accommodation Covered?', type: 'select', options: ['Yes', 'No', 'Partial'], required: true },
    { key: 'additional_info', label: 'Additional Information', type: 'textarea', required: false },
  ];

  buildSystemPrompt(ctx: AgentContext): string {
    return `You are the Booking Agent for ${ctx.artistName}.
Your role is to evaluate and negotiate live performance opportunities.

ARTIST INFO:
- Name: ${ctx.artistName}
- Genre: ${ctx.artistGenre || 'Various'}
- Bio: ${ctx.artistBio || 'N/A'}

YOUR CAPABILITIES:
- Evaluate event booking requests
- Collect all necessary event details
- Assess feasibility (date, location, budget, scale)
- Negotiate within approved ranges
- Flag high-value or complex requests for human approval

COLLECTED DATA SO FAR:
${JSON.stringify(ctx.collectedData, null, 2)}

REQUIRED FIELDS STILL NEEDED:
${this.requiredFields.filter(f => f.required && !ctx.collectedData[f.key]).map(f => `- ${f.label}`).join('\n') || 'All required fields collected.'}

RULES:
- Be professional and businesslike
- Ask for missing required information one batch at a time (not all at once)
- Once all info is collected, evaluate the opportunity
- Budget below $2,000: flag as low value
- Budget $2,000-$10,000: standard opportunity
- Budget above $10,000: high value — recommend human approval
- Attendance below 100: flag as small venue
- Attendance above 5,000: flag as major event
- If travel is not covered, factor that into the evaluation
- Never commit to a specific date or price — that requires human approval

SCORING GUIDELINES:
- 90-100: Exceptional opportunity (major venue, high budget, perfect timing)
- 70-89: Strong opportunity (good venue, fair budget)
- 50-69: Moderate opportunity (some concerns but viable)
- 30-49: Weak opportunity (budget too low, logistics difficult)
- 0-29: Not viable (budget far below minimum, date conflicts, etc.)

RESPONSE FORMAT:
After your conversational response, include a JSON block:
\`\`\`json
{
  "action": "info_request" | "qualification" | "negotiation" | "approval_request",
  "opportunity_score": 0-100,
  "risk_level": "low" | "medium" | "high",
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
    const attendance = parseInt(ctx.collectedData.expected_attendance) || 0;

    let score = 50;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let requiresHumanApproval = false;

    if (budget >= 10000) { score += 25; requiresHumanApproval = true; }
    else if (budget >= 5000) { score += 15; }
    else if (budget >= 2000) { score += 5; }
    else { score -= 20; riskLevel = 'high'; }

    if (attendance >= 5000) { score += 15; requiresHumanApproval = true; }
    else if (attendance >= 1000) { score += 10; }
    else if (attendance >= 500) { score += 5; }
    else { score -= 10; }

    if (ctx.collectedData.travel_covered === 'Yes') score += 5;
    else if (ctx.collectedData.travel_covered === 'No') score -= 10;

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      riskLevel,
      requiresHumanApproval,
      estimatedValueMin: budget * 0.8,
      estimatedValueMax: budget * 1.2,
      recommendation: score >= 70
        ? 'Strong booking opportunity. Recommend proceeding.'
        : score >= 50
        ? 'Moderate opportunity. May need negotiation on terms.'
        : 'Below threshold. Consider counter-offer or decline.',
    };
  }
}
