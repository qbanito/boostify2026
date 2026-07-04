/**
 * Servicio de generación de contratos legales de la industria musical.
 * PRINCIPAL: GLM-5.2 (z.ai) — razonamiento jurídico superior.
 * FALLBACK: OpenAI (PRIMARY_MODEL) — siempre disponible.
 */
import { createTrackedOpenAI } from '../utils/tracked-openai';
import OpenAI from 'openai';
import { PRIMARY_MODEL, ZAI_API_KEY, ZAI_BASE_URL, isZaiConfigured } from '../utils/ai-config';

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
});

// ─── GLM-5.2 (z.ai) — modelo principal para contratos ──────────────────────
const _glmContracts: OpenAI | null = isZaiConfigured()
  ? new OpenAI({ apiKey: ZAI_API_KEY, baseURL: ZAI_BASE_URL })
  : null;

/** Genera texto con GLM-5.2; devuelve null si falla (→ fallback OpenAI). */
async function callGlmText(prompt: string, opts: { maxTokens: number; temperature: number }): Promise<string | null> {
  if (!_glmContracts) return null;
  try {
    const res = await _glmContracts.chat.completions.create({
      model: 'glm-5.2',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (text) {
      console.log('[contracts] GLM-5.2 ✅');
      return text;
    }
  } catch (e: any) {
    console.warn('[contracts] GLM-5.2 failed, falling back to OpenAI:', e?.message);
  }
  return null;
}

interface ContractSection {
  title: string;
  content: string;
}

interface GeneratedContract {
  title: string;
  sections: ContractSection[];
  fullText: string;
}

export async function generateContract(params: {
  contractType: string;
  artistName: string;
  clientName?: string;
  projectDetails?: string;
  paymentTerms?: string;
  duration?: string;
  additionalClauses?: string;
}): Promise<string> {
  const prompt = `
Generate a professional music industry contract with the following details:

Contract Type: ${params.contractType}
Artist/Creator: ${params.artistName}
${params.clientName ? `Client/Party B: ${params.clientName}` : ''}
${params.projectDetails ? `Project Details: ${params.projectDetails}` : ''}
${params.paymentTerms ? `Payment Terms: ${params.paymentTerms}` : ''}
${params.duration ? `Duration: ${params.duration}` : ''}
${params.additionalClauses ? `Additional Clauses: ${params.additionalClauses}` : ''}

Please create a comprehensive, legally sound contract with proper sections including:
- Parties involved
- Scope of work/services
- Payment terms
- Rights and ownership
- Confidentiality
- Termination clauses
- Dispute resolution
- Signatures section

Format it professionally with clear sections and legal language appropriate for the music industry.
`;

  try {
    console.log('📄 Generando contrato (GLM-5.2 → OpenAI fallback)...');

    // 1) GLM-5.2 primero
    const glmContent = await callGlmText(prompt, { maxTokens: 8192, temperature: 0.7 });
    if (glmContent) return glmContent;

    // 2) Fallback OpenAI
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No se recibió contenido de OpenAI');
    }

    console.log('✅ Contrato generado exitosamente');
    return content;
  } catch (error) {
    console.error("Error generating contract:", error);
    throw new Error("Failed to generate contract");
  }
}

export async function analyzeContract(contractText: string): Promise<{
  summary: string;
  risks: string[];
  recommendations: string[];
  keyTerms: { term: string; description: string }[];
}> {
  const prompt = `
Analyze the following music industry contract and provide a JSON response with:

1. "summary": A brief summary of the contract (string)
2. "risks": Potential risks or red flags (array of strings)
3. "recommendations": Recommendations for improvements (array of strings)
4. "keyTerms": Key terms and their implications (array of objects with "term" and "description" properties)

Contract:
${contractText}

Provide a thorough legal analysis from an artist protection perspective.
Return ONLY valid JSON, no markdown.
`;

  try {
    console.log('🔍 Analizando contrato (GLM-5.2 → OpenAI fallback)...');

    // 1) GLM-5.2 primero (mejor razonamiento sobre cláusulas)
    const glmRaw = await callGlmText(prompt, { maxTokens: 4096, temperature: 0.5 });
    if (glmRaw) {
      try {
        const jsonText = glmRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        return JSON.parse(jsonText);
      } catch {
        console.warn('[contracts] GLM-5.2 returned non-JSON analysis, falling back to OpenAI');
      }
    }

    // 2) Fallback OpenAI (JSON mode nativo)
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No se recibió contenido de OpenAI');
    }

    console.log('✅ Análisis de contrato completado');
    return JSON.parse(content);
  } catch (error) {
    console.error("Error analyzing contract:", error);
    throw new Error("Failed to analyze contract");
  }
}

export const CONTRACT_TEMPLATES = {
  "music-licensing": {
    title: "Music Licensing Agreement",
    description: "License music for commercial use, sync rights, or publishing",
    type: "music-licensing"
  },
  "performance": {
    title: "Performance Agreement",
    description: "Contract for live performances, concerts, or events",
    type: "performance"
  },
  "production": {
    title: "Music Production Agreement",
    description: "Agreement for producing tracks, albums, or beats",
    type: "production"
  },
  "collaboration": {
    title: "Artist Collaboration Agreement",
    description: "Partnership agreement for joint musical projects",
    type: "collaboration"
  },
  "management": {
    title: "Artist Management Agreement",
    description: "Management services for artists and musicians",
    type: "management"
  },
  "recording": {
    title: "Recording Agreement",
    description: "Studio recording and distribution rights",
    type: "recording"
  },
  "work-for-hire": {
    title: "Work for Hire Agreement",
    description: "Commissioned music creation with rights transfer",
    type: "work-for-hire"
  },
  "nda": {
    title: "Non-Disclosure Agreement (NDA)",
    description: "Protect confidential information and unreleased music",
    type: "nda"
  }
};

export async function generateTemplateContract(
  templateType: string,
  customParams: Record<string, string>
): Promise<string> {
  const template = CONTRACT_TEMPLATES[templateType as keyof typeof CONTRACT_TEMPLATES];
  
  if (!template) {
    throw new Error(`Unknown template type: ${templateType}`);
  }

  const basePrompt = `
Generate a professional ${template.title} for the music industry.

Template Type: ${template.description}
`;

  const customFields = Object.entries(customParams)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const fullPrompt = `${basePrompt}\n\nCustom Details:\n${customFields}\n\nCreate a comprehensive, legally sound contract with all necessary clauses and professional formatting.`;

  try {
    console.log('📄 Generando contrato desde template (GLM-5.2 → OpenAI fallback)...');

    // 1) GLM-5.2 primero
    const glmContent = await callGlmText(fullPrompt, { maxTokens: 8192, temperature: 0.7 });
    if (glmContent) return glmContent;

    // 2) Fallback OpenAI
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: fullPrompt }],
      max_tokens: 8192,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No se recibió contenido de OpenAI');
    }

    console.log('✅ Contrato desde template generado exitosamente');
    return content;
  } catch (error) {
    console.error("Error generating template contract:", error);
    throw new Error("Failed to generate template contract");
  }
}
