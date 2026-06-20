/**
 * NODE FLOW AGENT — AI command router for the Artist Node Flow canvas.
 * POST /api/node-flow-agent/command
 *
 * Parses a natural-language instruction, routes it to the right module action,
 * and sends a confirmation email to the artist owner via Brevo.
 */

import { Router, Request, Response } from 'express';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { generateArtistNews } from '../services/news-generator';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// ── Email helper (Brevo) ──────────────────────────────────────────────────────
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = 'info@boostifymusic.com';
const FROM_NAME = 'Boostify Music — Agent';
const NOTIFY_EMAIL = 'convoycubano@gmail.com';

async function sendNotificationEmail(subject: string, html: string): Promise<void> {
  if (!BREVO_API_KEY) {
    console.warn('[NodeFlowAgent] BREVO_API_KEY not set — skipping email');
    return;
  }
  try {
    await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: NOTIFY_EMAIL }],
        subject,
        htmlContent: html,
      }),
    });
  } catch (e) {
    console.error('[NodeFlowAgent] Email send error:', e);
  }
}

// ── Intent detection via OpenRouter ──────────────────────────────────────────
type Intent =
  | 'create_news'
  | 'create_song'
  | 'create_promo'
  | 'create_social_post'
  | 'create_video'
  | 'activate_module'
  | 'deactivate_module'
  | 'unknown';

interface ParsedCommand {
  intent: Intent;
  title?: string;
  topic?: string;
  genre?: string;
  angle?: string;
  module?: string;
  summary: string;         // Human-readable explanation of what was understood
}

async function parseCommand(command: string, artistName: string): Promise<ParsedCommand> {
  const ai = createTrackedOpenAI();
  const systemPrompt = `You are an AI coordinator for the Boostify Music artist management platform.
Your job is to parse artist management commands and return structured JSON.

Artist context: "${artistName}" — a music artist on Boostify Music.

Return ONLY valid JSON with this exact shape:
{
  "intent": one of: "create_news" | "create_song" | "create_promo" | "create_social_post" | "create_video" | "activate_module" | "deactivate_module" | "unknown",
  "title": optional string — a suggested title/name for the content,
  "topic": optional string — the subject/topic for news articles or songs,
  "genre": optional string — music genre if relevant,
  "angle": optional string — editorial angle for news ("announcement", "achievement", "story", "update"),
  "module": optional string — module id to activate/deactivate (songs, videos, news, merchandise, social-hub, karaoke, promo-clips, downloads, social-posts, analytics, tokenization, earnings),
  "summary": string — a short Spanish sentence explaining what you understood and will do
}

Intent mapping rules:
- "canción", "tema", "track", "music", "song", "beat" → create_song
- "noticia", "news", "artículo", "article", "blog" → create_news
- "promo", "clip promocional", "promo clip" → create_promo
- "post", "redes sociales", "social post", "instagram", "twitter" → create_social_post
- "video", "videoclip", "video musical" → create_video
- "activa", "activar", "habilitar", "enable" → activate_module
- "desactiva", "desactivar", "deshabilitar", "disable" → deactivate_module
`;

  try {
    const res = await ai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: command },
      ],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });
    const raw = res.choices[0]?.message?.content || '{}';
    return JSON.parse(raw) as ParsedCommand;
  } catch (e) {
    console.error('[NodeFlowAgent] parseCommand error:', e);
    return { intent: 'unknown', summary: 'No pude entender el comando.' };
  }
}

// ── Main route ────────────────────────────────────────────────────────────────
router.post('/command', async (req: Request, res: Response) => {
  const { command, artistSlug, artistId } = req.body as {
    command: string;
    artistSlug: string;
    artistId: number;
  };

  if (!command || typeof command !== 'string' || command.trim().length === 0) {
    return res.status(400).json({ error: 'command is required' });
  }

  // Get artist name from DB
  let artistName = artistSlug || 'Artist';
  try {
    if (artistId) {
      const [user] = await db
        .select({ artistName: users.artistName, slug: users.slug })
        .from(users)
        .where(eq(users.id, Number(artistId)))
        .limit(1);
      if (user?.artistName) artistName = user.artistName;
    }
  } catch { /* ignore */ }

  // 1. Parse intent
  const parsed = await parseCommand(command.trim(), artistName);
  const { intent, title, topic, genre, angle } = parsed;

  let actionResult: any = null;
  let actionLabel = '';
  let success = true;
  let errorMsg = '';

  // 2. Route to action
  try {
    switch (intent) {
      case 'create_news': {
        actionLabel = 'Noticia generada';
        const newsResult = await generateArtistNews(Number(artistId), {
          topic: topic || title || command,
          angle: (angle as any) || 'announcement',
          category: 'artist',
        });
        actionResult = newsResult;
        break;
      }

      case 'create_song': {
        actionLabel = 'Canción en proceso';
        // Songs require audio generation (FAL/Suno) — we return instructions + activate node
        actionResult = {
          message: `Para crear la canción "${title || topic || 'nueva canción'}", activa el nodo Music y usa el botón "Upload Song" o conecta Suno AI desde el nodo.`,
          suggestedTitle: title || topic,
          genre: genre || 'urban',
          action: 'activate_songs_node',
        };
        break;
      }

      case 'create_promo': {
        actionLabel = 'Promo Clip en proceso';
        actionResult = {
          message: `Para crear el promo clip, activa el nodo Promo Clips y selecciona una canción base. El agente la enviará a renderizar.`,
          action: 'activate_promo_node',
        };
        break;
      }

      case 'create_social_post': {
        actionLabel = 'Social Post en proceso';
        // Use OpenRouter to write the post
        const ai = createTrackedOpenAI();
        const postRes = await ai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [
            {
              role: 'system',
              content: `Eres el community manager del artista ${artistName} en Boostify Music. Escribe posts concisos, auténticos y con hashtags relevantes. Responde SOLO con el texto del post.`,
            },
            { role: 'user', content: `Crea un post sobre: ${topic || command}` },
          ],
          temperature: 0.7,
          max_tokens: 280,
        });
        actionResult = {
          post: postRes.choices[0]?.message?.content || '',
          action: 'activate_social_post_node',
        };
        break;
      }

      case 'create_video': {
        actionLabel = 'Video en proceso';
        actionResult = {
          message: 'Para crear un video musical, activa el nodo Videos y usa Hologram Studio o Renaissance Studio.',
          action: 'activate_video_node',
        };
        break;
      }

      case 'activate_module': {
        actionLabel = `Módulo activado: ${parsed.module || 'N/A'}`;
        actionResult = {
          module: parsed.module,
          action: 'activate_module',
          message: `El módulo "${parsed.module}" será activado en tu Node Flow.`,
        };
        break;
      }

      case 'deactivate_module': {
        actionLabel = `Módulo desactivado: ${parsed.module || 'N/A'}`;
        actionResult = {
          module: parsed.module,
          action: 'deactivate_module',
          message: `El módulo "${parsed.module}" será desactivado en tu Node Flow.`,
        };
        break;
      }

      default: {
        success = false;
        errorMsg = 'No entendí el comando. Prueba: "crea una noticia sobre mi nuevo lanzamiento" o "activa el nodo de merchandise".';
        break;
      }
    }
  } catch (e: any) {
    console.error('[NodeFlowAgent] Action error:', e);
    success = false;
    errorMsg = `Error ejecutando la acción: ${e?.message || 'Unknown error'}`;
  }

  // 3. Send email notification
  const emailSubject = success
    ? `✅ Agente Boostify: ${actionLabel} — ${artistName}`
    : `⚠️ Agente Boostify: Comando no ejecutado — ${artistName}`;

  const emailHtml = `
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f12; color: #e2e8f0; padding: 32px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="background: linear-gradient(135deg, #6366f1, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 22px; font-weight: 700;">BOOSTIFY NODE AGENT</span>
      </div>
      <h2 style="color: #a78bfa; margin: 0 0 8px;">${success ? '✅' : '⚠️'} ${actionLabel || 'Respuesta del Agente'}</h2>
      <p style="color: #94a3b8; font-size: 14px; margin: 0 0 20px;">Artista: <strong style="color: #e2e8f0;">${artistName}</strong></p>
      
      <div style="background: #1e1e2e; border: 1px solid #6366f140; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Tu instrucción</p>
        <p style="margin: 0; color: #e2e8f0; font-style: italic;">"${command}"</p>
      </div>

      <div style="background: #1e1e2e; border: 1px solid #6366f140; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Lo que entendí</p>
        <p style="margin: 0; color: #a78bfa;">${parsed.summary}</p>
      </div>

      ${success && actionResult ? `
      <div style="background: #1e1e2e; border: 1px solid #22c55e40; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Resultado</p>
        <pre style="margin: 0; color: #22c55e; font-size: 12px; white-space: pre-wrap; word-break: break-word;">${
          typeof actionResult === 'string'
            ? actionResult
            : JSON.stringify(actionResult, null, 2).substring(0, 800)
        }</pre>
      </div>` : ''}

      ${!success ? `
      <div style="background: #1e1e2e; border: 1px solid #ef444440; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0; color: #ef4444;">${errorMsg}</p>
      </div>` : ''}

      <a href="http://localhost:5000/artist/${artistSlug}/flow" 
         style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Ver Node Flow →
      </a>
      
      <p style="color: #4b5563; font-size: 11px; margin-top: 24px; text-align: center;">
        Boostify Music — Plataforma de Marketing Musical con IA
      </p>
    </div>
  `;

  await sendNotificationEmail(emailSubject, emailHtml);

  // 4. Return response
  return res.json({
    success,
    intent,
    summary: parsed.summary,
    actionLabel,
    result: success ? actionResult : null,
    error: success ? undefined : errorMsg,
    emailSent: true,
    notifiedTo: NOTIFY_EMAIL,
  });
});

export default router;
