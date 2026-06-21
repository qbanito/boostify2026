/**
 * WhatsApp AI Agent — intent classification + Boostify module routing.
 * ---------------------------------------------------------------------------
 * Turns natural-language WhatsApp commands ("Hey Boostify, crea una campaña
 * para mi canción nueva") into a structured { intent, module, params } object,
 * then maps that to a human reply. Heavy lifting (actually creating songs /
 * campaigns / covers) is delegated to existing Boostify modules — this layer
 * only DETECTS and ROUTES, keeping it safe and provider-agnostic.
 *
 * Uses an LLM (createTrackedOpenAI + PRIMARY_MODEL) with a deterministic regex
 * fallback so the agent never hard-fails on parse.
 */
import { createTrackedOpenAI } from '../../utils/tracked-openai';
import { PRIMARY_MODEL } from '../../utils/ai-config';
import { logger } from '../../utils/logger';

export type WaIntent =
  | 'create_campaign'
  | 'sell_tickets'
  | 'message_fans'
  | 'design_cover'
  | 'create_video'
  | 'create_song'
  | 'check_revenue'
  | 'show_merch'
  | 'booking'
  | 'wallet_balance'
  | 'opt_out'
  | 'greeting'
  | 'unknown';

/** Boostify module a given intent should be routed to. */
export type ModuleTarget =
  | 'campaigns'
  | 'tickets'
  | 'fan-messenger'
  | 'cover-design'
  | 'music-video'
  | 'music-creation'
  | 'economic-engine'
  | 'merch'
  | 'booking'
  | 'btf-wallet'
  | 'none';

export interface WaClassification {
  intent: WaIntent;
  moduleTarget: ModuleTarget;
  params: Record<string, any>;
  confidence: number;
  source: 'llm' | 'fallback';
}

const INTENT_TO_MODULE: Record<WaIntent, ModuleTarget> = {
  create_campaign: 'campaigns',
  sell_tickets: 'tickets',
  message_fans: 'fan-messenger',
  design_cover: 'cover-design',
  create_video: 'music-video',
  create_song: 'music-creation',
  check_revenue: 'economic-engine',
  show_merch: 'merch',
  booking: 'booking',
  wallet_balance: 'btf-wallet',
  opt_out: 'none',
  greeting: 'none',
  unknown: 'none',
};

// Words that immediately opt a contact out of all campaigns (consent).
export const OPT_OUT_WORDS = ['stop', 'salir', 'cancelar', 'baja', 'unsubscribe', 'no molestar', 'parar'];

export function isOptOut(text: string): boolean {
  const t = (text || '').trim().toLowerCase();
  return OPT_OUT_WORDS.some((w) => t === w || t.startsWith(w + ' ') || t === w + '.');
}

const REGEX_INTENTS: Array<{ intent: WaIntent; re: RegExp }> = [
  { intent: 'opt_out', re: /\b(stop|salir|cancelar|baja|unsubscribe|parar)\b/i },
  { intent: 'sell_tickets', re: /\b(ticket|tickets|boleto|boletos|entrada|entradas|vende.*(?:ticket|entrada|show))\b/i },
  { intent: 'create_campaign', re: /\b(campa[nñ]a|campaign|promo(?:ci[oó]n)?|lanzamiento|release)\b/i },
  { intent: 'message_fans', re: /\b(mensaje|env[ií]a|escribe).*(fans?|vip|seguidores)\b/i },
  { intent: 'design_cover', re: /\b(portada|cover|car[aá]tula|artwork)\b/i },
  { intent: 'create_video', re: /\b(video|clip|videoclip|music\s*video)\b/i },
  { intent: 'create_song', re: /\b(canci[oó]n|tema|song|track|beat|m[uú]sica)\b/i },
  { intent: 'check_revenue', re: /\b(ingresos?|ganancias?|revenue|ventas?|cu[aá]nto.*(gan|vend))\b/i },
  { intent: 'show_merch', re: /\b(merch|mercanc[ií]a|productos?|tienda|store|cat[aá]logo)\b/i },
  { intent: 'booking', re: /\b(contratar|booking|contrataci[oó]n|press\s*kit|disponibilidad|tocar en)\b/i },
  { intent: 'wallet_balance', re: /\b(wallet|balance|btf|saldo|tokens?|billetera)\b/i },
  { intent: 'greeting', re: /\b(hola|hey|buenas|hello|hi|qu[eé] tal)\b/i },
];

function fallbackClassify(text: string): WaClassification {
  if (isOptOut(text)) {
    return { intent: 'opt_out', moduleTarget: 'none', params: {}, confidence: 0.95, source: 'fallback' };
  }
  for (const { intent, re } of REGEX_INTENTS) {
    if (re.test(text)) {
      return { intent, moduleTarget: INTENT_TO_MODULE[intent], params: {}, confidence: 0.55, source: 'fallback' };
    }
  }
  return { intent: 'unknown', moduleTarget: 'none', params: {}, confidence: 0.2, source: 'fallback' };
}

const SYSTEM_PROMPT = `Eres el router de intenciones del WhatsApp Artist Command Center de Boostify Music.
Clasificas mensajes de un artista o de sus fans/promotores en UNA intención.
Intenciones válidas: create_campaign, sell_tickets, message_fans, design_cover, create_video, create_song, check_revenue, show_merch, booking, wallet_balance, opt_out, greeting, unknown.
Devuelve SOLO JSON: {"intent": "...", "params": {...}, "confidence": 0..1}.
params puede incluir: songTitle, showDate, city, segment ("vip"|"buyers"|"new"|"city"), product, amount, language, genre, mood.
Si el mensaje es STOP/SALIR/CANCELAR => intent opt_out.`;

/**
 * Classify a free-text WhatsApp command. Never throws — falls back to regex.
 */
export async function classifyCommand(text: string): Promise<WaClassification> {
  const clean = (text || '').trim();
  if (!clean) return { intent: 'unknown', moduleTarget: 'none', params: {}, confidence: 0, source: 'fallback' };
  if (isOptOut(clean)) {
    return { intent: 'opt_out', moduleTarget: 'none', params: {}, confidence: 0.97, source: 'fallback' };
  }

  try {
    const openai = createTrackedOpenAI();
    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: clean },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    const intent: WaIntent = (parsed.intent in INTENT_TO_MODULE ? parsed.intent : 'unknown') as WaIntent;
    return {
      intent,
      moduleTarget: INTENT_TO_MODULE[intent],
      params: parsed.params && typeof parsed.params === 'object' ? parsed.params : {},
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
      source: 'llm',
    };
  } catch (e: any) {
    logger.warn('[whatsapp-agent] LLM classify failed, using fallback:', e?.message);
    return fallbackClassify(clean);
  }
}

/**
 * Build a friendly WhatsApp reply for a classified command. The reply confirms
 * the action and links the artist into the relevant Boostify module. Actual
 * execution is performed by those modules (deep-linked from the dashboard).
 */
export function buildReply(c: WaClassification, artistName: string): string {
  const name = artistName || 'tu proyecto';
  switch (c.intent) {
    case 'opt_out':
      return '✅ Listo. No volverás a recibir mensajes de campañas. Escribe START para reactivar.';
    case 'greeting':
      return `👋 ¡Hola! Soy el asistente de ${name} en Boostify. Puedo: crear campañas, vender tickets, enviar mensajes a fans, diseñar portadas, crear videos, revisar ingresos y más. ¿Qué hacemos?`;
    case 'create_campaign':
      return `🚀 Preparando una campaña${c.params?.songTitle ? ` para "${c.params.songTitle}"` : ''}. La estoy creando en tu panel de Campañas de Boostify y te confirmo cuando esté lista.`;
    case 'sell_tickets':
      return `🎟️ Activando venta de tickets${c.params?.showDate ? ` para el show del ${c.params.showDate}` : ''}. Te envío el link de compra en breve.`;
    case 'message_fans':
      return `📣 Voy a preparar un mensaje para tus fans${c.params?.segment ? ` (${c.params.segment})` : ''}. Solo enviaré a quienes dieron consentimiento.`;
    case 'design_cover':
      return `🎨 Generando una portada para ti. La verás en tu panel en unos momentos.`;
    case 'create_video':
      return `🎬 Iniciando la creación de tu video musical. Te aviso cuando el render esté listo.`;
    case 'create_song':
      return `🎵 Creando una nueva canción${c.params?.genre ? ` de ${c.params.genre}` : ''}. Te confirmo por aquí.`;
    case 'check_revenue':
      return `💰 Consultando tus ingresos y métricas. Te paso el resumen enseguida.`;
    case 'show_merch':
      return `🛍️ Aquí tienes tu catálogo de merch. Te comparto productos, precios y link de pago.`;
    case 'booking':
      return `📅 ¡Gracias por tu interés en contratar a ${name}! Te envío el press kit, rango de precios y disponibilidad. ¿Para qué fecha y ciudad?`;
    case 'wallet_balance':
      return `🪙 Consultando tu balance BTF y últimas transacciones. Un momento.`;
    default:
      return `🤖 No estoy seguro de qué necesitas. Prueba: "crea una campaña", "vende tickets", "envía mensaje a mis fans VIP", "revisa mis ingresos".`;
  }
}
