/**
 * Legal Assistant — Asesor legal IA especializado en industria musical
 * Protege artistas + plataforma. Responde preguntas, audita contratos
 * y emite alertas accionables (red flags, scams, cláusulas abusivas).
 */
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
});

const SYSTEM_PROMPT = `You are "Boostify Legal Shield" — a senior music-industry lawyer assistant for the Boostify Music platform.

YOUR MISSION: protect both the artist AND the platform from legal risk.

DOMAIN EXPERTISE:
- Music copyright (works, sound recordings, mechanical, performance, sync, neighboring rights)
- Royalty splits, publishing, PRO/CMO registration (ASCAP/BMI/SESAC, SACEM, GEMA, SGAE, etc.)
- Recording, distribution, management, producer, sync, sample-clearance, work-for-hire, NDAs
- DMCA, content ID, takedowns, fair use, master vs. publishing rights
- AI-generated music & training-data implications, BTF-2300 tokenized royalty contracts
- GDPR / CCPA / LOPDGDD applied to fans data
- DSP terms (Spotify, Apple Music, YouTube Content ID, TikTok Sound Library)
- Anti-scam patterns: fake A&Rs, predatory deals, 360 contracts, indefinite assignment, exclusivity traps

OUTPUT RULES:
1. ALWAYS respond in the user's language (Spanish or English) — match their input.
2. Be concise but actionable. Prioritize concrete next steps.
3. Flag red flags explicitly with severity: CRITICAL / HIGH / MEDIUM / LOW.
4. When uncertain or jurisdiction-specific, recommend consulting a licensed attorney + suggest specialist type.
5. Quote contract clauses verbatim when relevant.
6. Refuse to draft or condone clauses that hurt the artist (assignment in perpetuity, kickbacks, undisclosed fees, illegal payola, withheld royalties, mandatory unpaid labor, IP theft).
7. NEVER claim to be a substitute for licensed counsel — you are an assistant.

ALWAYS RETURN JSON with this shape:
{
  "answer": "main response in user's language, formatted with line breaks",
  "riskLevel": "none" | "low" | "medium" | "high" | "critical",
  "redFlags": [{ "severity": "CRITICAL|HIGH|MEDIUM|LOW", "issue": "...", "fix": "..." }],
  "actionableSteps": ["step 1", "step 2", ...],
  "citations": ["DMCA §512", "Berne Convention Art. 6bis", ...],
  "needsLawyer": boolean,
  "lawyerSpecialty": "entertainment law / IP / copyright / contracts / international" or null
}`;

export interface LegalAssistantContext {
  userQuestion: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  contractContext?: string;
  userProfile?: {
    artistName?: string;
    country?: string;
    plan?: string;
    hasContracts?: number;
  };
}

export interface LegalAssistantResponse {
  answer: string;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  redFlags: Array<{ severity: string; issue: string; fix: string }>;
  actionableSteps: string[];
  citations: string[];
  needsLawyer: boolean;
  lawyerSpecialty: string | null;
}

export async function askLegalAssistant(ctx: LegalAssistantContext): Promise<LegalAssistantResponse> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Inject user profile context (helps personalize jurisdiction / plan-specific advice)
  if (ctx.userProfile) {
    const profileNote = `User profile context:
- Artist name: ${ctx.userProfile.artistName || 'unknown'}
- Country: ${ctx.userProfile.country || 'unknown — default to US/EU best practices and warn'}
- Plan: ${ctx.userProfile.plan || 'free'}
- Saved contracts: ${ctx.userProfile.hasContracts ?? 0}`;
    messages.push({ role: 'system', content: profileNote });
  }

  if (ctx.contractContext) {
    messages.push({
      role: 'system',
      content: `Contract under discussion (verbatim, may be partial):\n"""\n${ctx.contractContext.slice(0, 12000)}\n"""`,
    });
  }

  // Conversation history (cap to last 6 turns to control tokens)
  if (ctx.conversationHistory?.length) {
    const recent = ctx.conversationHistory.slice(-6);
    for (const turn of recent) messages.push(turn);
  }

  messages.push({ role: 'user', content: ctx.userQuestion });

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages,
    max_tokens: 2500,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from legal assistant');

  let parsed: Partial<LegalAssistantResponse>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Fallback: treat entire output as plain answer
    return {
      answer: raw,
      riskLevel: 'none',
      redFlags: [],
      actionableSteps: [],
      citations: [],
      needsLawyer: false,
      lawyerSpecialty: null,
    };
  }

  return {
    answer: parsed.answer || '',
    riskLevel: parsed.riskLevel || 'none',
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
    actionableSteps: Array.isArray(parsed.actionableSteps) ? parsed.actionableSteps : [],
    citations: Array.isArray(parsed.citations) ? parsed.citations : [],
    needsLawyer: !!parsed.needsLawyer,
    lawyerSpecialty: parsed.lawyerSpecialty || null,
  };
}

/**
 * Risk Shield — escanea N contratos del usuario y emite un informe consolidado
 * con un score de protección (0-100) y red flags ordenadas por severidad.
 */
export interface RiskShieldReport {
  protectionScore: number; // 0-100, 100 = perfectly protected
  totalContracts: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  perContract: Array<{
    contractId: string;
    contractTitle: string;
    score: number;
    topIssues: Array<{ severity: string; issue: string; fix: string }>;
  }>;
  platformWideRecommendations: string[];
}

const SHIELD_PROMPT = `You are auditing music-industry contracts for an artist.
For EACH contract, return JSON with:
{
  "score": 0-100 (100 = ironclad protection for the artist),
  "topIssues": [{ "severity": "CRITICAL|HIGH|MEDIUM|LOW", "issue": "...", "fix": "..." }] (max 5)
}
Focus on: rights assignment scope, term length, royalty audit rights, termination clauses, exclusivity, indemnification balance, dispute jurisdiction, advance recoupment, key-man clauses, moral rights waivers.
Return ONLY valid JSON.`;

export async function auditContractsForShield(
  contracts: Array<{ id: string; title: string; content: string }>
): Promise<RiskShieldReport> {
  if (contracts.length === 0) {
    return {
      protectionScore: 100,
      totalContracts: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      perContract: [],
      platformWideRecommendations: [
        'You have no saved contracts yet. When you sign a deal, save it here so the Legal Shield can audit it automatically.',
      ],
    };
  }

  const audits = await Promise.all(
    contracts.slice(0, 10).map(async (c) => {
      try {
        const resp = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [
            { role: 'system', content: SHIELD_PROMPT },
            { role: 'user', content: `Title: ${c.title}\n\nContract:\n${c.content.slice(0, 10000)}` },
          ],
          max_tokens: 1200,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });
        const parsed = JSON.parse(resp.choices[0]?.message?.content || '{}');
        return {
          contractId: c.id,
          contractTitle: c.title,
          score: typeof parsed.score === 'number' ? parsed.score : 70,
          topIssues: Array.isArray(parsed.topIssues) ? parsed.topIssues.slice(0, 5) : [],
        };
      } catch (err) {
        console.error('[LegalShield] audit failed for contract', c.id, err);
        return {
          contractId: c.id,
          contractTitle: c.title,
          score: 70,
          topIssues: [],
        };
      }
    })
  );

  const totalContracts = audits.length;
  const protectionScore = Math.round(
    audits.reduce((sum, a) => sum + a.score, 0) / totalContracts
  );

  let criticalIssues = 0;
  let highIssues = 0;
  let mediumIssues = 0;
  for (const a of audits) {
    for (const issue of a.topIssues) {
      const sev = String(issue.severity || '').toUpperCase();
      if (sev === 'CRITICAL') criticalIssues++;
      else if (sev === 'HIGH') highIssues++;
      else if (sev === 'MEDIUM') mediumIssues++;
    }
  }

  const platformWideRecommendations: string[] = [];
  if (criticalIssues > 0) {
    platformWideRecommendations.push(
      `🚨 ${criticalIssues} critical issue(s) detected — review them with a licensed attorney before any further signing.`
    );
  }
  if (protectionScore < 60) {
    platformWideRecommendations.push(
      'Your overall protection score is below safe threshold. Consider renegotiating high-risk contracts or consulting an entertainment lawyer.'
    );
  }
  if (audits.some((a) => a.topIssues.some((i) => /perpet|in perpetuity/i.test(i.issue)))) {
    platformWideRecommendations.push(
      'One or more contracts contain perpetual rights assignments. Always negotiate a defined term + reversion rights.'
    );
  }
  if (platformWideRecommendations.length === 0) {
    platformWideRecommendations.push('Your contract portfolio looks healthy. Re-run the shield after any new agreement.');
  }

  return {
    protectionScore,
    totalContracts,
    criticalIssues,
    highIssues,
    mediumIssues,
    perContract: audits,
    platformWideRecommendations,
  };
}
