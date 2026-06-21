// ───────────────────────────────────────────────────────────────────────────
// Reddit Artist Intelligence Center — AI Strategy Layer
// ---------------------------------------------------------------------------
// Turns raw Reddit intelligence (trends, communities, sentiment, competitors)
// into ACTIONABLE growth strategy for an artist: daily plans, content ideas,
// community-targeting recommendations and natural-language summaries.
//
// Uses createTrackedOpenAI + PRIMARY_MODEL with a deterministic heuristic
// fallback so a report is ALWAYS produced even without an API key.
//
// COMPLIANCE: every suggestion is engineered for authentic, value-first
// participation (Reddit's self-promotion 9:1 rule). The model is instructed to
// NEVER recommend spam, vote manipulation, ban evasion or fake accounts.
// ───────────────────────────────────────────────────────────────────────────
import { createTrackedOpenAI } from '../../utils/tracked-openai';
import { PRIMARY_MODEL } from '../../utils/ai-config';
import { logger } from '../../utils/logger';

export interface StrategyContext {
  artistName: string;
  genre?: string;
  keywords?: string[];
  topCommunities?: Array<{ name: string; matchScore?: number; subscribers?: number; competitionLevel?: string }>;
  trendingTitles?: string[];
  sentiment?: { score: number; label: string };
  competitors?: Array<{ artistName: string; mentions?: number; growth?: number }>;
}

export interface ContentIdea {
  title: string;
  subreddit: string;
  angle: string;
  format: string;
}

export interface AIStrategyReport {
  summary: string;
  recommendations: string[];
  contentIdeas: ContentIdea[];
  targetCommunities: string[];
  dailyPlan: string[];
  source: 'llm' | 'heuristic';
}

const SYSTEM_PROMPT = `Eres el estratega de Reddit del "Reddit Artist Intelligence Center" de Boostify Music.
Conviertes inteligencia de mercado de Reddit en una estrategia de crecimiento ÉTICA y accionable para un artista musical.
REGLAS DE CUMPLIMIENTO (obligatorias): nunca recomiendes spam, manipulación de votos, cuentas falsas, evasión de baneos ni autopromoción agresiva. Respeta la regla 9:1 de Reddit (aporta valor antes de promocionar). Las recomendaciones deben ser participación auténtica: comentar, aportar, compartir contexto, responder threads de descubrimiento.
Devuelve SOLO JSON con esta forma exacta:
{
  "summary": "2-3 frases sobre la oportunidad del artista en Reddit ahora mismo",
  "recommendations": ["acción concreta 1", "..."],
  "contentIdeas": [{"title":"...","subreddit":"r/...","angle":"por qué funciona","format":"text|link|image|discussion"}],
  "targetCommunities": ["r/...", "..."],
  "dailyPlan": ["paso del día 1", "..."]
}`;

export async function generateStrategy(ctx: StrategyContext): Promise<AIStrategyReport> {
  const fallback = heuristicStrategy(ctx);
  try {
    const openai = createTrackedOpenAI();
    const user = JSON.stringify({
      artist: ctx.artistName,
      genre: ctx.genre || 'indie',
      monitoredKeywords: ctx.keywords?.slice(0, 12) || [],
      topCommunities: ctx.topCommunities?.slice(0, 10) || [],
      trendingNow: ctx.trendingTitles?.slice(0, 12) || [],
      audienceSentiment: ctx.sentiment || null,
      competitors: ctx.competitors?.slice(0, 8) || [],
    });
    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Datos de inteligencia de Reddit:\n${user}\n\nGenera la estrategia.` },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    return {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : fallback.summary,
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length ? parsed.recommendations.map(String).slice(0, 10) : fallback.recommendations,
      contentIdeas: Array.isArray(parsed.contentIdeas) && parsed.contentIdeas.length
        ? parsed.contentIdeas.slice(0, 8).map((c: any) => ({
            title: String(c?.title ?? '').slice(0, 160),
            subreddit: String(c?.subreddit ?? 'r/Music'),
            angle: String(c?.angle ?? '').slice(0, 200),
            format: String(c?.format ?? 'discussion'),
          }))
        : fallback.contentIdeas,
      targetCommunities: Array.isArray(parsed.targetCommunities) && parsed.targetCommunities.length ? parsed.targetCommunities.map(String).slice(0, 12) : fallback.targetCommunities,
      dailyPlan: Array.isArray(parsed.dailyPlan) && parsed.dailyPlan.length ? parsed.dailyPlan.map(String).slice(0, 8) : fallback.dailyPlan,
      source: 'llm',
    };
  } catch (e: any) {
    logger.warn('[reddit-ai] strategy LLM failed, using heuristic:', e?.message);
    return fallback;
  }
}

function heuristicStrategy(ctx: StrategyContext): AIStrategyReport {
  const genre = ctx.genre || 'indie';
  const subs = (ctx.topCommunities?.map((c) => (c.name.startsWith('r/') ? c.name : `r/${c.name}`)) || [`r/Music`, `r/listentothis`]).slice(0, 6);
  const sentimentNote = ctx.sentiment
    ? ctx.sentiment.score >= 60
      ? 'El sentimiento de la audiencia es positivo — buen momento para aumentar la presencia.'
      : ctx.sentiment.score <= 40
        ? 'El sentimiento es mixto — prioriza aportar valor antes de promocionar.'
        : 'El sentimiento es neutral — hay espacio para construir reputación.'
    : '';
  return {
    summary: `${ctx.artistName} tiene oportunidad real en comunidades de ${genre} en Reddit. ${sentimentNote} Enfócate en descubrimiento auténtico y participación constante en ${subs.slice(0, 3).join(', ')}.`,
    recommendations: [
      `Participa a diario en ${subs[0]} aportando comentarios útiles antes de compartir tu música (regla 9:1).`,
      `Responde threads de "descubrimiento" y "recomendaciones" de ${genre} donde tu sonido encaje.`,
      `Comparte tu proceso creativo en r/WeAreTheMusicMakers para ganar credibilidad.`,
      `Monitorea las keywords ${(ctx.keywords || [genre]).slice(0, 3).join(', ')} y únete a la conversación temprano.`,
      `Construye relación con los moderadores antes de publicar lanzamientos.`,
    ],
    contentIdeas: [
      { title: `The story behind my latest ${genre} track`, subreddit: subs[0] || 'r/Music', angle: 'Las historias personales generan engagement auténtico', format: 'text' },
      { title: `Weekly ${genre} discovery — sharing what I'm working on`, subreddit: 'r/listentothis', angle: 'Aporta a la comunidad de descubrimiento', format: 'discussion' },
      { title: `Breaking down how I produced this ${genre} song`, subreddit: 'r/WeAreTheMusicMakers', angle: 'El contenido educativo construye reputación', format: 'text' },
    ],
    targetCommunities: subs,
    dailyPlan: [
      'Revisa trends y oportunidades virales del día en el panel.',
      'Comenta de forma genuina en 3-5 posts relevantes de tu nicho.',
      'Responde cualquier mención de tu nombre o keywords.',
      'Guarda 1 oportunidad viral para participar con valor.',
    ],
    source: 'heuristic',
  };
}

/** Short natural-language summary of audience for the Audience panel. */
export async function summarizeAudience(ctx: StrategyContext & { totalReach?: number; communityCount?: number }): Promise<string> {
  try {
    const openai = createTrackedOpenAI();
    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.4,
      messages: [
        { role: 'system', content: 'Eres un analista de audiencia. En 2-3 frases en español, describe la audiencia de Reddit de un artista y dónde concentrar esfuerzos. Sin markdown.' },
        { role: 'user', content: JSON.stringify({ artist: ctx.artistName, genre: ctx.genre, communities: ctx.topCommunities?.slice(0, 8), reach: ctx.totalReach, sentiment: ctx.sentiment }) },
      ],
    });
    const txt = completion.choices?.[0]?.message?.content?.trim();
    if (txt) return txt;
  } catch (e: any) {
    logger.warn('[reddit-ai] audience summary failed:', e?.message);
  }
  const reach = ctx.totalReach ? `~${Intl.NumberFormat('en', { notation: 'compact' }).format(ctx.totalReach)} miembros` : 'varias comunidades';
  return `La audiencia de ${ctx.artistName} en Reddit se concentra en comunidades de ${ctx.genre || 'música independiente'}, con un alcance potencial de ${reach}. Prioriza nichos activos donde tu sonido tenga menos competencia.`;
}
