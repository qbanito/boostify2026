// ───────────────────────────────────────────────────────────────────────────
// Discord Fan Nation — AI Layer
// Two responsibilities:
//   1) Artist Concierge: turn natural language ("crea una campaña para mi
//      sencillo") or slash commands into a structured intent + params.
//   2) AI Moderator: classify inbound member messages (spam / insult / scam /
//      dangerous link) and recommend an action, keeping the artist's tone.
//
// Both use createTrackedOpenAI + PRIMARY_MODEL with deterministic heuristic
// fallbacks so they ALWAYS return a result, even without an API key.
// ───────────────────────────────────────────────────────────────────────────
import { createTrackedOpenAI } from '../../utils/tracked-openai';
import { PRIMARY_MODEL } from '../../utils/ai-config';
import { logger } from '../../utils/logger';

export type ConciergeIntent =
  | 'create_campaign' | 'create_event' | 'send_announcement' | 'reward_top_fans'
  | 'check_revenue' | 'create_vip_drop' | 'start_live' | 'sell_tickets'
  | 'launch_release' | 'analyze_fans' | 'greeting' | 'unknown';

export interface ConciergeClassification {
  intent: ConciergeIntent;
  moduleTarget: string;
  params: Record<string, any>;
  confidence: number;
  source: 'llm' | 'heuristic';
}

export const INTENT_TO_MODULE: Record<ConciergeIntent, string> = {
  create_campaign: 'campaigns',
  create_event: 'events',
  send_announcement: 'campaigns',
  reward_top_fans: 'rewards',
  check_revenue: 'analytics',
  create_vip_drop: 'vip',
  start_live: 'live',
  sell_tickets: 'tickets',
  launch_release: 'campaigns',
  analyze_fans: 'community',
  greeting: 'none',
  unknown: 'none',
};

const CONCIERGE_SYSTEM = `Eres "Boostify Concierge", el agente IA del módulo Discord Fan Nation de un artista musical.
Clasificas la petición del artista en una intención y extraes parámetros.
Devuelve SOLO JSON: {"intent": one of [create_campaign, create_event, send_announcement, reward_top_fans, check_revenue, create_vip_drop, start_live, sell_tickets, launch_release, analyze_fans, greeting, unknown], "params": {clave: valor}, "confidence": 0..1}.
Ejemplos de params: {"topic":"nuevo sencillo"}, {"count":10}, {"channel":"vip-fans"}, {"title":"watch party"}. Si no estás seguro usa intent "unknown".`;

const HEURISTICS: Array<{ intent: ConciergeIntent; re: RegExp }> = [
  { intent: 'create_campaign', re: /(camp(a|á)ña|campaign|promo|promociona|difunde)/i },
  { intent: 'create_event', re: /(evento|event|watch ?party|q&a|backstage|meet ?(&|and)? ?greet|ensayo)/i },
  { intent: 'send_announcement', re: /(anuncia|anuncio|announce|comunica|publica)/i },
  { intent: 'reward_top_fans', re: /(premia|recompensa|reward|top fans|mejores fans|fans m(a|á)s activos)/i },
  { intent: 'check_revenue', re: /(ingresos|revenue|ventas|cu(a|á)nto.*gan|earnings|facturaci(o|ó)n)/i },
  { intent: 'create_vip_drop', re: /(vip|drop exclusivo|canal privado|exclusiv)/i },
  { intent: 'start_live', re: /(live|en vivo|directo|stream|transmit)/i },
  { intent: 'sell_tickets', re: /(ticket|entrada|boleto|sell tickets|vende.*entrada)/i },
  { intent: 'launch_release', re: /(lanza|lanzamiento|release|estrena|drop.*(canci|tema|video))/i },
  { intent: 'analyze_fans', re: /(analiza|an(a|á)lisis|insights|qui(e|é)n.*fan|fan.*data)/i },
  { intent: 'greeting', re: /^(hola|hey|buenas|hi|hello|hey boostify)/i },
];

export async function classifyConciergeCommand(text: string): Promise<ConciergeClassification> {
  const fallback = heuristicConcierge(text);
  try {
    const openai = createTrackedOpenAI();
    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CONCIERGE_SYSTEM },
        { role: 'user', content: String(text || '').slice(0, 600) },
      ],
    });
    const parsed = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
    const intent = (INTENT_TO_MODULE as any)[parsed.intent] !== undefined ? parsed.intent as ConciergeIntent : fallback.intent;
    return {
      intent,
      moduleTarget: INTENT_TO_MODULE[intent] || 'none',
      params: parsed.params && typeof parsed.params === 'object' ? parsed.params : fallback.params,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : fallback.confidence,
      source: 'llm',
    };
  } catch (e: any) {
    logger.warn('[discord-ai] concierge LLM failed, using heuristic:', e?.message);
    return fallback;
  }
}

function heuristicConcierge(text: string): ConciergeClassification {
  const t = String(text || '');
  for (const h of HEURISTICS) {
    if (h.re.test(t)) {
      const params: Record<string, any> = {};
      const countMatch = t.match(/\b(\d{1,3})\b/);
      if (countMatch) params.count = Number(countMatch[1]);
      return { intent: h.intent, moduleTarget: INTENT_TO_MODULE[h.intent], params, confidence: 0.55, source: 'heuristic' };
    }
  }
  return { intent: 'unknown', moduleTarget: 'none', params: {}, confidence: 0.3, source: 'heuristic' };
}

export function buildConciergeReply(intent: ConciergeIntent, artistName: string): string {
  const map: Record<ConciergeIntent, string> = {
    create_campaign: `🚀 Preparando una campaña para ${artistName}. Define el canal y el mensaje en la pestaña Campaigns.`,
    create_event: `📅 Vamos a crear un evento. Abre la pestaña Events para fijar fecha y acceso.`,
    send_announcement: `📢 Listo para anunciar. Escribe el mensaje en Campaigns y elige #announcements.`,
    reward_top_fans: `🏆 Identificando a tus fans más activos en Fan Community para recompensarlos.`,
    check_revenue: `💰 Aquí tienes el resumen de ingresos en Analytics.`,
    create_vip_drop: `💎 Configurando un drop VIP. Usa BTF Token Gate o Rewards para limitar el acceso.`,
    start_live: `🔴 Sincroniza tu live en la pestaña Live Chat para conectar el chat de Discord.`,
    sell_tickets: `🎟️ Conecta la venta de entradas y asigna el rol Ticket Buyer automáticamente.`,
    launch_release: `🎶 Anunciando tu lanzamiento a #new-releases. Adjunta el enlace en Campaigns.`,
    analyze_fans: `📊 Generando insights de tu comunidad en Fan Community y Analytics.`,
    greeting: `👋 Hola, soy Boostify Concierge. Puedo crear campañas, eventos, premiar fans y más. ¿Qué hacemos hoy?`,
    unknown: `🤔 No estoy seguro de lo que necesitas. Prueba: "crea una campaña para mi nuevo sencillo".`,
  };
  return map[intent] || map.unknown;
}

// ── AI Moderator ─────────────────────────────────────────────────────────────
export type ModerationCategory = 'spam' | 'insult' | 'scam' | 'dangerous_link' | 'clean';
export interface ModerationResult {
  flagged: boolean;
  categories: ModerationCategory[];
  action: 'allow' | 'warn' | 'delete' | 'escalate';
  reason: string;
  source: 'llm' | 'heuristic';
}

const SCAM_RE = /(free nitro|free discord nitro|steam gift|airdrop|claim your|connect.*wallet|seed phrase|double your|crypto giveaway|click here to claim|@everyone.*http)/i;
const DANGEROUS_LINK_RE = /(bit\.ly|tinyurl|discord-gift|dlscord|steamcommunity\.ru|free-nitro|grabify|iplogger)/i;
const INSULT_RE = /(idiot|stupid|est(u|ú)pido|imb(e|é)cil|puta|mierda|f[u\*]ck you|gilipollas|pendejo)/i;
const SPAM_RE = /(.)\1{9,}|(https?:\/\/\S+\s*){4,}|(join my server|sub to my|check my profile){1}/i;

export async function moderateMessage(text: string): Promise<ModerationResult> {
  const heuristic = heuristicModerate(text);
  // Heuristic is enough for obvious cases; only escalate ambiguous ones to LLM.
  if (heuristic.flagged) return heuristic;
  try {
    const openai = createTrackedOpenAI();
    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `Eres el moderador IA de un servidor de Discord de fans. Clasifica el mensaje. Devuelve SOLO JSON: {"categories": subset of ["spam","insult","scam","dangerous_link","clean"], "action": one of ["allow","warn","delete","escalate"], "reason": "breve"}. Sé tolerante con el lenguaje casual de fans; solo marca contenido realmente dañino.` },
        { role: 'user', content: String(text || '').slice(0, 600) },
      ],
    });
    const parsed = JSON.parse(completion.choices?.[0]?.message?.content || '{}');
    const categories: ModerationCategory[] = Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : ['clean'];
    const flagged = !categories.includes('clean') && categories.length > 0;
    return {
      flagged,
      categories,
      action: ['allow', 'warn', 'delete', 'escalate'].includes(parsed.action) ? parsed.action : (flagged ? 'warn' : 'allow'),
      reason: String(parsed.reason || (flagged ? 'Contenido marcado por IA' : 'Limpio')).slice(0, 200),
      source: 'llm',
    };
  } catch {
    return heuristic;
  }
}

function heuristicModerate(text: string): ModerationResult {
  const t = String(text || '');
  const categories: ModerationCategory[] = [];
  if (SCAM_RE.test(t)) categories.push('scam');
  if (DANGEROUS_LINK_RE.test(t)) categories.push('dangerous_link');
  if (INSULT_RE.test(t)) categories.push('insult');
  if (SPAM_RE.test(t)) categories.push('spam');
  if (!categories.length) return { flagged: false, categories: ['clean'], action: 'allow', reason: 'Limpio', source: 'heuristic' };
  const severe = categories.includes('scam') || categories.includes('dangerous_link');
  return {
    flagged: true,
    categories,
    action: severe ? 'delete' : 'warn',
    reason: severe ? 'Posible scam o enlace peligroso' : `Detectado: ${categories.join(', ')}`,
    source: 'heuristic',
  };
}
