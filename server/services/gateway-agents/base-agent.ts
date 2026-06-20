/**
 * 🛡️ Base Agent — Abstract class for all Artist Agent Gateway agents
 *
 * Every specialized agent extends this base and provides:
 *  - systemPrompt: the LLM instructions
 *  - requiredFields: what info to collect from the sender
 *  - evaluate(): score & classify the opportunity
 */
import { callAI, type ChatMessage } from '../../utils/smart-ai';
import { logger } from '../../utils/logger';
import { buildGatewayAgentPrompt, type GatewayAgent } from '../../utils/ai-skills-injector';

export interface AgentContext {
  artistId: number;
  artistName: string;
  artistGenre?: string;
  artistBio?: string;
  conversationHistory: ChatMessage[];
  collectedData: Record<string, any>;
  senderInfo: {
    name?: string;
    email?: string;
    company?: string;
    type: string;
  };
}

export interface AgentResponse {
  message: string;
  action: 'info_request' | 'qualification' | 'negotiation' | 'auto_reply' |
          'escalation' | 'approval_request' | 'rejection' | 'counter_offer';
  structuredData?: Record<string, any>;
  opportunityScore?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  requiresHumanApproval?: boolean;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  recommendation?: string;
  missingFields?: string[];
  collectedUpdates?: Record<string, any>;
}

export abstract class BaseGatewayAgent {
  abstract agentType: string;
  abstract agentName: string;
  abstract description: string;
  abstract requiredFields: Array<{ key: string; label: string; type: 'text' | 'number' | 'select' | 'date' | 'textarea'; options?: string[]; required: boolean }>;

  /** Build the system prompt for this agent */
  abstract buildSystemPrompt(ctx: AgentContext): string;

  /** Evaluate the opportunity and return a score + recommendation */
  abstract evaluate(ctx: AgentContext): Promise<{
    score: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    requiresHumanApproval: boolean;
    estimatedValueMin?: number;
    estimatedValueMax?: number;
    recommendation: string;
  }>;

  /** Process an incoming message and generate a response */
  async processMessage(ctx: AgentContext): Promise<AgentResponse> {
    const baseSystemPrompt = this.buildSystemPrompt(ctx);

    // Inject marketing skills specific to this agent type
    const systemPrompt = await buildGatewayAgentPrompt(
      this.agentType as GatewayAgent,
      baseSystemPrompt,
      ctx.artistId,
    );

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...ctx.conversationHistory,
    ];

    try {
      const raw = await callAI('gateway_agent', messages, {
        temperature: 0.7,
        maxTokens: 1500,
      });

      // Parse the agent response
      const response = this.parseAgentResponse(raw, ctx);
      return response;
    } catch (err: any) {
      logger.error(`[GatewayAgent:${this.agentType}] AI call failed`, { error: err?.message });
      return {
        message: `I apologize, but I'm experiencing a technical issue. Please try again in a moment, or leave your details and we'll get back to you shortly.`,
        action: 'auto_reply',
      };
    }
  }

  /** Parse the raw AI response into a structured AgentResponse */
  protected parseAgentResponse(raw: string, ctx: AgentContext): AgentResponse {
    // Try to extract JSON block from the response
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
    let structured: any = null;

    if (jsonMatch) {
      try {
        structured = JSON.parse(jsonMatch[1]);
      } catch { /* ignore parse errors */ }
    }

    // Determine what fields are still missing
    const missingFields = this.requiredFields
      .filter(f => f.required && !ctx.collectedData[f.key])
      .map(f => f.label);

    // Determine action based on missing fields and response content
    let action: AgentResponse['action'] = 'auto_reply';
    if (missingFields.length > 0) {
      action = 'info_request';
    } else if (structured?.action) {
      action = structured.action;
    }

    // Clean the message (remove JSON block if present)
    let message = raw.replace(/```json\s*[\s\S]*?```/g, '').trim();
    if (!message) {
      message = `Thank you for your inquiry. ${missingFields.length > 0 ? `I still need some information: ${missingFields.join(', ')}.` : 'I have all the information I need and will evaluate your request.'}`;
    }

    return {
      message,
      action,
      structuredData: structured?.structured_data || structured?.structuredData,
      opportunityScore: structured?.opportunity_score || structured?.opportunityScore,
      riskLevel: structured?.risk_level || structured?.riskLevel,
      requiresHumanApproval: structured?.requires_human_approval ?? structured?.requiresHumanApproval,
      estimatedValueMin: structured?.estimated_value_min || structured?.estimatedValueMin,
      estimatedValueMax: structured?.estimated_value_max || structured?.estimatedValueMax,
      recommendation: structured?.recommendation,
      missingFields: missingFields.length > 0 ? missingFields : undefined,
      collectedUpdates: structured?.collected_updates || structured?.collectedUpdates,
    };
  }
}
