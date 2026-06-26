/**
 * Email Ops Analyst — AI agent that reviews automated-email performance
 * ════════════════════════════════════════════════════════════════════
 * Takes the live email metrics (daily sends per provider, the global ceiling,
 * deliverability funnel, reply counts, sending-domain health) and returns a
 * structured set of recommendations to improve volume, inbox placement and
 * reply rate. Used by the admin Email Command Center.
 */

import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY2 || '';

export interface EmailOpsMetrics {
  ceiling: { target: number; sentToday: number; remaining: number };
  providersToday: { provider: string; sent: number }[];
  last7Days: { date: string; sent: number }[];
  funnel: { sent: number; opened: number; clicked: number; replied: number; bounced: number };
  pool: { activeAccounts: number; activeDomains: number; pendingDomains: number };
  replies: { total: number; new: number; replied: number; won: number; lost: number };
  leads: { total: number; ready: number; sent: number; claimed: number };
  paused: { global: boolean; channels: string[] };
}

export interface EmailOpsRecommendation {
  title: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
  category: 'deliverability' | 'volume' | 'engagement' | 'replies' | 'reputation' | 'ops';
}

export interface EmailOpsAnalysis {
  healthScore: number;            // 0-100
  headline: string;               // one-line status
  summary: string;                // 2-3 sentence narrative
  strengths: string[];
  risks: string[];
  recommendations: EmailOpsRecommendation[];
  generatedAt: string;
  model: string;
  source: 'openai' | 'heuristic';
}

/** Deterministic fallback so the panel always returns something useful. */
function heuristicAnalysis(m: EmailOpsMetrics): EmailOpsAnalysis {
  const openRate = m.funnel.sent > 0 ? m.funnel.opened / m.funnel.sent : 0;
  const replyRate = m.funnel.sent > 0 ? m.funnel.replied / m.funnel.sent : 0;
  const bounceRate = m.funnel.sent > 0 ? m.funnel.bounced / m.funnel.sent : 0;
  const utilization = m.ceiling.target > 0 ? m.ceiling.sentToday / m.ceiling.target : 0;

  let score = 70;
  if (bounceRate > 0.05) score -= 20;
  if (openRate > 0.2) score += 10;
  if (replyRate > 0.01) score += 8;
  if (utilization > 0.4 && utilization < 0.95) score += 6;
  if (m.pool.activeDomains + m.pool.activeAccounts >= 5) score += 6;
  if (m.paused.global) score -= 15;
  score = Math.max(0, Math.min(100, score));

  const recs: EmailOpsRecommendation[] = [];
  if (bounceRate > 0.04) recs.push({ title: 'Limpia rebotes', detail: `Tasa de rebote ${(bounceRate * 100).toFixed(1)}%. Depura emails inválidos antes de enviar para proteger la reputación del dominio.`, impact: 'high', category: 'reputation' });
  if (openRate < 0.15 && m.funnel.sent > 50) recs.push({ title: 'Mejora líneas de asunto', detail: `Apertura ${(openRate * 100).toFixed(1)}%. Prueba A/B de asuntos más cortos y personalizados con el nombre del artista.`, impact: 'high', category: 'engagement' });
  if (utilization < 0.4) recs.push({ title: 'Aprovecha el cupo diario', detail: `Solo usas ${Math.round(utilization * 100)}% del tope (${m.ceiling.sentToday}/${m.ceiling.target}). Aumenta el volumen gradualmente para acelerar el crecimiento.`, impact: 'medium', category: 'volume' });
  if (m.pool.activeDomains + m.pool.activeAccounts < 5) recs.push({ title: 'Diversifica dominios de envío', detail: 'Provisiona más dominios de envío para repartir el volumen y mejorar la colocación en bandeja de entrada.', impact: 'medium', category: 'deliverability' });
  if (m.replies.new > 0) recs.push({ title: `Responde ${m.replies.new} leads`, detail: 'Tienes respuestas sin atender. Responder en <24h dispara la conversión.', impact: 'high', category: 'replies' });
  if (!recs.length) recs.push({ title: 'Mantén el ritmo', detail: 'Las métricas se ven sanas. Sigue calentando dominios y midiendo respuestas.', impact: 'low', category: 'ops' });

  return {
    healthScore: score,
    headline: m.paused.global ? 'Envíos PAUSADOS globalmente' : `Salud de email ${score}/100`,
    summary: `Hoy: ${m.ceiling.sentToday}/${m.ceiling.target} enviados · apertura ${(openRate * 100).toFixed(1)}% · respuestas ${m.replies.new} nuevas. ${m.pool.activeDomains} dominios y ${m.pool.activeAccounts} cuentas activas en rotación.`,
    strengths: [
      openRate > 0.2 ? 'Buena tasa de apertura' : 'Infraestructura multi-proveedor activa',
      m.pool.activeDomains >= 3 ? 'Buena diversificación de dominios' : 'Rotación de cuentas configurada',
    ],
    risks: [
      bounceRate > 0.04 ? 'Rebotes elevados' : 'Volumen por debajo del potencial',
      m.replies.new > 0 ? 'Respuestas sin atender' : 'Sin captura automática de respuestas',
    ],
    recommendations: recs,
    generatedAt: new Date().toISOString(),
    model: 'heuristic',
    source: 'heuristic',
  };
}

export async function analyzeEmailOps(m: EmailOpsMetrics): Promise<EmailOpsAnalysis> {
  if (!OPENAI_API_KEY) return heuristicAnalysis(m);

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const prompt = `Eres un analista experto en cold-email outreach y deliverability para una plataforma de música (Boostify). Analiza estas métricas REALES del sistema de envíos automáticos (plataforma + GitHub Actions) y devuelve recomendaciones accionables para crecer (meta: 50k usuarios activos) sin dañar la reputación de los dominios.

MÉTRICAS ACTUALES (JSON):
${JSON.stringify(m, null, 2)}

Contexto:
- Tope global diario configurado: ${m.ceiling.target} emails/día, repartido entre Brevo + varias cuentas Resend (dominios dedicados de cold outreach).
- Las respuestas llegan a un inbox y se gestionan en el panel.
- Objetivo: maximizar perfiles reclamados por artistas y respuestas, manteniendo rebotes bajos.

Devuelve SOLO un objeto JSON con esta forma exacta:
{
  "healthScore": <0-100 número>,
  "headline": "<una línea de estado>",
  "summary": "<2-3 frases en español>",
  "strengths": ["<3 máx>"],
  "risks": ["<3 máx>"],
  "recommendations": [
    { "title": "<corto>", "detail": "<específico y accionable, en español>", "impact": "high|medium|low", "category": "deliverability|volume|engagement|replies|reputation|ops" }
  ]
}
Da entre 3 y 6 recomendaciones, prioriza por impacto. Sé concreto con números cuando aporten.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1400,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    const recs: EmailOpsRecommendation[] = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, 6).map((r: any) => ({
          title: String(r.title || '').slice(0, 120),
          detail: String(r.detail || '').slice(0, 500),
          impact: ['high', 'medium', 'low'].includes(r.impact) ? r.impact : 'medium',
          category: ['deliverability', 'volume', 'engagement', 'replies', 'reputation', 'ops'].includes(r.category) ? r.category : 'ops',
        }))
      : [];

    if (!recs.length) return heuristicAnalysis(m);

    return {
      healthScore: Math.max(0, Math.min(100, Number(parsed.healthScore) || 0)),
      headline: String(parsed.headline || '').slice(0, 160) || `Salud de email`,
      summary: String(parsed.summary || '').slice(0, 600),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3).map((s: any) => String(s).slice(0, 160)) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 3).map((s: any) => String(s).slice(0, 160)) : [],
      recommendations: recs,
      generatedAt: new Date().toISOString(),
      model: 'gpt-4o',
      source: 'openai',
    };
  } catch {
    return heuristicAnalysis(m);
  }
}
