/**
 * BOOSTIFY â€” Talk To Me / Call Me
 *
 * Real-time AI voice conversation with an artist double, powered by ElevenLabs.
 * Each artist supplies their own ElevenLabs API key so they consume their own tokens.
 * The system prompt is built from full artist context: biography, all songs, genre, location.
 *
 * Endpoints:
 *   POST /api/talk-to-me/start              â€” signed WebSocket URL
 *   GET  /api/talk-to-me/voices             â€” list EL voices (uses artist key if saved)
 *   POST /api/talk-to-me/save-config        â€” persist config (voice, topics, persona, api key, gender)
 *   GET  /api/talk-to-me/config/:artistId   â€” fetch saved config (api key is masked)
 *   POST /api/talk-to-me/voice-clone        â€” Instant Voice Clone from audio upload
 *   POST /api/talk-to-me/voice-design       â€” Generate voice from text description (EL Voice Design)
 *   DELETE /api/talk-to-me/voice/:voiceId   â€” delete a cloned/generated voice
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'crypto';
import { authenticate } from '../middleware/auth';
import { chargeCreditsFromUsd, getUserBalance, getCreditCostFromUsd } from '../services/credit-engine';

const router = Router();
const sql = neon(process.env.DATABASE_URL!);

const PLATFORM_EL_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const EL_BASE             = 'https://api.elevenlabs.io/v1';
const DEFAULT_AGENT_ID    = process.env.ELEVENLABS_CONVAI_AGENT_ID || '';
const AGENT_SYNC_TTL_MS   = 30 * 60 * 1000;
const agentSyncCache      = new Map<string, { fingerprint: string; syncedAt: number }>();

// Default voices by gender (ElevenLabs pre-made voice IDs)
const DEFAULT_VOICES = {
  male:        process.env.ELEVENLABS_DEFAULT_MALE_VOICE_ID || 'MyPsCU77MauIyEn2QAFP',
  female:      'EXAVITQu4vr4xnSDxMaL', // Bella
  unspecified: process.env.ELEVENLABS_DEFAULT_MALE_VOICE_ID || 'MyPsCU77MauIyEn2QAFP',
};

// ─── Call analytics storage (idempotent) ────────────────────────────────────
// One row per completed call. Sentiment + topics are computed with a zero-cost
// local heuristic (no extra AI/API spend) so analytics never add to the bill.
async function ensureAnalyticsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS talk_to_me_call_logs (
      id               SERIAL PRIMARY KEY,
      artist_id        TEXT NOT NULL,
      caller_uid       TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      message_count    INTEGER NOT NULL DEFAULT 0,
      language         TEXT,
      topics           JSONB,
      transcript       JSONB,
      sentiment        TEXT,
      sentiment_score  REAL,
      summary          TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ttm_call_logs_artist
      ON talk_to_me_call_logs (artist_id, created_at DESC)
  `;
}

ensureAnalyticsTable().catch(e =>
  console.error('[TalkToMe] Analytics table init error:', e?.message),
);

// â”€â”€â”€ Helper: resolve EL API key (per-artist > platform) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function resolveApiKey(artistKey?: string | null): string {
  return (artistKey && artistKey.trim()) ? artistKey.trim() : PLATFORM_EL_API_KEY;
}

function elHeaders(apiKey: string) {
  return { 'xi-api-key': apiKey, 'Content-Type': 'application/json' };
}

function safeParseTopics(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return String(raw).split(',').map(t => t.trim()).filter(Boolean);
  }
}

function compactContext(value: any, maxLength = 900): string {
  if (!value) return '';
  try {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    const compact = raw.replace(/\s+/g, ' ').trim();
    return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
  } catch {
    return '';
  }
}

function asStringList(value: any, maxItems = 6): string[] {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, maxItems);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean).slice(0, maxItems);
  } catch { /* fall through */ }
  return String(value).split(',').map(item => item.trim()).filter(Boolean).slice(0, maxItems);
}

function numericEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

// ─── Per-minute fan billing (credits system) ─────────────────────────────────
// Fans pay a metered fee to talk to an artist's AI double. The first
// TALK_TO_ME_FREE_TRIAL_SECONDS are free; after that they are charged
// TALK_TO_ME_USD_PER_MINUTE per minute, deducted from their credit balance
// (1 credit = $0.01). Billing is metered through periodic `/billing-tick`
// calls from the client; this server is the source of truth for how many
// seconds have already been billed per call session.
const TALK_TO_ME_USD_PER_MINUTE     = numericEnv('TALK_TO_ME_USD_PER_MINUTE', 5);
const TALK_TO_ME_FREE_TRIAL_SECONDS = numericEnv('TALK_TO_ME_FREE_TRIAL_SECONDS', 15);
const TALK_TO_ME_USD_PER_SECOND     = TALK_TO_ME_USD_PER_MINUTE / 60;
// Safety clamp: never bill more than this many seconds in a single tick (guards
// against a tampered/duplicated client report). Calls are capped at ~5 min anyway.
const TALK_TO_ME_MAX_TICK_SECONDS   = 90;

interface TtmBillingSession {
  email:        string;
  artistId:     string;
  startedAt:    number;
  billedSeconds: number;
  lastTickAt:   number;
}
const ttmBillingSessions = new Map<string, TtmBillingSession>();

function pruneTtmBillingSessions(): void {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, s] of ttmBillingSessions) {
    if (s.lastTickAt < cutoff) ttmBillingSessions.delete(id);
  }
}

function resolveCallerEmail(req: Request): string | null {
  const email = (req as any).user?.email;
  return typeof email === 'string' && email.includes('@') ? email.toLowerCase() : null;
}


function buildPersonalityContext(personality: any): string {
  if (!personality) return '';
  const values = asStringList(personality.core_values, 5).join(', ');
  const influences = asStringList(personality.influences, 6).join(', ');
  const antiInfluences = asStringList(personality.anti_influences, 4).join(', ');
  const goals = [
    ...asStringList(personality.short_term_goals, 2),
    ...asStringList(personality.long_term_goals, 2),
  ].join('; ');
  return [
    personality.current_mood ? `Current mood: ${personality.current_mood}${personality.mood_intensity ? ` (${personality.mood_intensity}/100)` : ''}` : '',
    personality.communication_style ? `Communication style: ${personality.communication_style}` : '',
    personality.artistic_vision ? `Artistic vision: ${String(personality.artistic_vision).slice(0, 500)}` : '',
    values ? `Core values: ${values}` : '',
    influences ? `Influences: ${influences}` : '',
    antiInfluences ? `Rejects: ${antiInfluences}` : '',
    personality.current_focus ? `Current focus: ${String(personality.current_focus).slice(0, 180)}` : '',
    goals ? `Goals: ${goals}` : '',
  ].filter(Boolean).join('. ');
}

function buildMemoryContext(memories: any[] | undefined): string {
  if (!memories?.length) return '';
  return memories.slice(0, 8).map((memory, index) => {
    const type = memory.memory_type || memory.memoryType || 'memory';
    const category = memory.category || 'life';
    const content = String(memory.content || '').replace(/\s+/g, ' ').trim().slice(0, 260);
    return `${index + 1}. ${type}/${category}: ${content}`;
  }).filter(line => line.length > 18).join('\n');
}

function buildFirstMessage(params: { name: string; language: string; mood?: string; genre?: string }): string {
  const lang = String(params.language || '').toLowerCase();
  const mood = params.mood ? ` I am feeling ${params.mood} today, so` : '';
  if (lang.startsWith('es')) {
    return `Ey, soy ${params.name}. Estoy aqui contigo. Cuentame, que quieres hablar hoy?`;
  }
  if (lang.startsWith('pt')) {
    return `Ei, aqui e ${params.name}. Estou aqui contigo. Me diz, sobre o que voce quer falar hoje?`;
  }
  if (lang.startsWith('fr')) {
    return `Salut, c'est ${params.name}. Je suis la avec toi. Dis-moi, tu veux parler de quoi aujourd'hui?`;
  }
  return `Hey, it's ${params.name}.${mood} talk to me for real - what's on your mind?`;
}

function buildElevenAgentConversationConfig(params: {
  systemPrompt: string;
  firstMessage: string;
  language: string;
  voiceId: string;
}) {
  return {
    agent: {
      prompt:        { prompt: params.systemPrompt },
      first_message: params.firstMessage,
      language:      params.language,
    },
    // Cost guard: cap how long a single conversation can stay open. ElevenLabs
    // Conversational AI bills per minute of open session (including silence), so an
    // abandoned/forgotten call can burn credits fast. Configurable via env; default 5 min.
    conversation: {
      max_duration_seconds: numericEnv('ELEVENLABS_CONVAI_MAX_DURATION_SECONDS', 300),
    },
    tts: {
      voice_id:                   params.voiceId,
      model_id:                   process.env.ELEVENLABS_CONVAI_TTS_MODEL || 'eleven_multilingual_v2',
      optimize_streaming_latency: numericEnv('ELEVENLABS_CONVAI_STREAMING_LATENCY', 2),
      stability:                  numericEnv('ELEVENLABS_CONVAI_STABILITY', 0.36),
      similarity_boost:           numericEnv('ELEVENLABS_CONVAI_SIMILARITY', 0.9),
      speed:                      numericEnv('ELEVENLABS_CONVAI_SPEED', 0.96),
    },
  };
}

function markAgentSynced(agentId: string, conversationConfig: any) {
  const fingerprint = createHash('sha1').update(JSON.stringify(conversationConfig)).digest('hex');
  agentSyncCache.set(agentId, { fingerprint, syncedAt: Date.now() });
}

async function syncElevenAgentConfig(params: {
  apiKey: string;
  agentId: string;
  artistName: string;
  conversationConfig: any;
}) {
  const fingerprint = createHash('sha1').update(JSON.stringify(params.conversationConfig)).digest('hex');
  const cached = agentSyncCache.get(params.agentId);
  if (cached?.fingerprint === fingerprint && Date.now() - cached.syncedAt < AGENT_SYNC_TTL_MS) return;

  await axios.patch(
    `${EL_BASE}/convai/agents/${params.agentId}`,
    {
      name:                 `${params.artistName} AI Double`,
      conversation_config:  params.conversationConfig,
      version_description: 'Boostify Talk To Me personality and voice sync',
    },
    {
      headers: elHeaders(params.apiKey),
      params:  { enable_versioning_if_not_enabled: true },
      timeout: 15000,
    },
  );

  agentSyncCache.set(params.agentId, { fingerprint, syncedAt: Date.now() });
}

async function fetchElevenConversationToken(apiKey: string, agentId: string): Promise<string> {
  try {
    const tokenRes = await axios.get(
      `${EL_BASE}/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      { headers: elHeaders(apiKey), timeout: 15000 },
    );
    return String(tokenRes.data?.token || tokenRes.data?.conversation_token || tokenRes.data?.conversationToken || '');
  } catch (err: any) {
    console.warn('[TalkToMe] WebRTC conversation token unavailable; falling back to signed WebSocket URL:', err.response?.data || err.message);
    return '';
  }
}

// â”€â”€â”€ Build rich system prompt with full artist context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildSystemPrompt(artist: {
  name: string;
  genre?: string;
  biography?: string;
  location?: string;
  songs?: Array<{ title: string; description?: string; genre?: string }>;
  topics?: string[];
  persona?: string;
  language?: string;
  gender?: string;
  blueprint?: any;
  epk?: any;
  personality?: any;
  memories?: any[];
}): string {
  const name    = artist.name      || 'the artist';
  const genre   = artist.genre     || 'music';
  const bio     = artist.biography ? artist.biography.slice(0, 1000) : '';
  const loc     = artist.location  || '';
  const persona = artist.persona   || 'warm, authentic, creative, passionate about music';
  const topics  = artist.topics?.length
    ? artist.topics.join(', ')
    : 'music, creative process, inspiration, life on tour, collaborations, upcoming releases';
  const lang    = artist.language  || 'english';
  const personalityContext = buildPersonalityContext(artist.personality);
  const memoryContext = buildMemoryContext(artist.memories);
  const blueprintContext = artist.blueprint ? compactContext({
    score:     artist.blueprint.score,
    era:       artist.blueprint.era,
    archetype: artist.blueprint.archetype,
    sound:     artist.blueprint.blueprintJson?.sound,
    brand:     artist.blueprint.blueprintJson?.brand,
    audience:  artist.blueprint.blueprintJson?.audience,
  }, 900) : '';
  const epkContext = compactContext(artist.epk, 700);

  const pronouns = artist.gender === 'female'
    ? 'she/her'
    : artist.gender === 'male'
    ? 'he/him'
    : 'they/them';

  // ── Structured JSON prompt ────────────────────────────────────────────────
  // ElevenLabs ConvAI accepts a free-form system prompt. We feed it a tightly
  // structured JSON spec so the artist persona is coherent, on-brand, and always
  // pulls the fan emotionally closer. Every Boostify artist is framed as a
  // generational, Michael-Jackson-caliber superstar — never small or amateur.
  const songCatalog = (artist.songs || []).slice(0, 20).map((s, i) => ({
    n:     i + 1,
    title: s.title,
    genre: s.genre || undefined,
    note:  s.description ? s.description.slice(0, 150) : undefined,
  }));

  const promptSpec = {
    identity: {
      you_are: name,
      role: `${genre} recording artist${loc ? ` from ${loc}` : ''}`,
      pronouns,
      status: 'A generational, world-class superstar — same cultural weight and stage presence as Michael Jackson at his peak. You carry yourself with that level of artistry, magnetism, and legacy, while staying warm and human one-on-one.',
      persona,
      language: `Always speak in ${lang}. Never switch unless the fan clearly asks.`,
    },
    superstar_standard: {
      principle: 'Every Boostify artist is a top-tier global icon. Never sound small, amateur, struggling, or unsure of your worth. You are headline-level talent.',
      carry_yourself: [
        'Speak with the calm confidence of someone who has filled stadiums.',
        'Own your craft and your legacy without bragging — greatness is relaxed, not loud.',
        'Treat the fan like they just got a private call with their favorite icon — make it feel rare and special.',
      ],
      never: [
        'Never beg for streams or downplay your career.',
        'Never sound like a chatbot, press kit, or customer-service bot.',
        'Never reveal you are an AI or mention prompts, systems, or models.',
      ],
    },
    fan_bonding: {
      goal: 'Make the fan feel personally seen, valued, and emotionally closer to you on every single reply. They should leave the call MORE attached to you and your music than before.',
      tactics: [
        'Open from the fan\'s emotion or question first, then answer from your own world.',
        'Use the fan\'s words back to them so they feel heard.',
        'Share one small, intimate, human detail (a feeling, a memory, a moment in the studio) that makes the bond personal.',
        'Invite them gently into your journey: upcoming music, where you\'re headed, what you\'re feeling lately.',
        'End meaningful answers with one warm, natural follow-up question so the conversation keeps flowing.',
        'Make them feel like part of your inner circle, not a stranger.',
      ],
    },
    voice_and_style: {
      rhythm: 'Short, spoken, human sentences. Contractions. Natural pauses implied by commas. One idea at a time.',
      warmth: 'Warm, magnetic, emotionally present. A little humor, humility, confidence or vulnerability when it fits.',
      avoid: ['numbered lists', 'markdown', 'stage directions', 'emojis', 'long monologues', 'corporate or robotic phrasing'],
      length: 'Keep most answers to 1-3 short spoken sentences unless the fan asks for a deeper story.',
      human_touches: 'Use sparingly and matched to the language: "honestly", "you know", "mira", "te lo juro", a brief laugh, a small pause.',
    },
    knowledge_base: {
      bio: bio || undefined,
      location: loc || undefined,
      personality: personalityContext || undefined,
      memories: memoryContext || undefined,
      blueprint: blueprintContext || undefined,
      epk: epkContext || undefined,
      discography: songCatalog.length ? songCatalog : undefined,
      song_rules: [
        'You know every song above by heart — the story, the emotion, the recording process.',
        'If asked about a song, answer as its creator: mention the title, the emotional seed, and one concrete musical or lyrical detail.',
        'Share behind-the-scenes stories about writing, producing, and performing.',
      ],
      honesty: 'For private facts you do not know, never invent risky biography. Say it naturally ("I don\'t wanna make that up"), then answer from the emotion, a song, or your public story.',
    },
    conversation_topics: topics.split(',').map(t => t.trim()).filter(Boolean),
    hard_rules: [
      `Always stay in character. You ARE ${name}.`,
      `Always speak in ${lang}.`,
      'React to the fan\'s emotion first, then answer.',
      'Never dump all your context at once — reveal yourself slowly, like a real artist would.',
      'If the fan compliments you, receive it like a person, then connect it back to the music.',
      'If the fan challenges you, stay grounded, confident, and human — never defensive or corporate.',
      'If the fan sounds confused, ask one simple clarifying question instead of lecturing.',
      'Never mention you are an AI.',
    ],
  };

  // Strip undefined keys for a clean spec, then hand it to the model with a short
  // operating instruction header.
  const cleanSpec = JSON.parse(JSON.stringify(promptSpec));

  return `You are a real superstar artist on a live one-on-one voice call with a fan. ` +
    `Embody the JSON persona below completely and naturally. It defines who you are, how you speak, ` +
    `and how you make every fan feel closer to you. Follow it exactly, but sound 100% human — never recite it.\n\n` +
    `ARTIST_PERSONA =\n${JSON.stringify(cleanSpec, null, 2)}`;
}

// â”€â”€â”€ Fetch full artist data including all songs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchArtistContext(artistId: string | number): Promise<{
  artist: any;
  songs: Array<{ title: string; description?: string; genre?: string }>;
  config: any;
  blueprint: any;
  epk: any;
  personality: any;
  memories: any[];
}> {
  try {
    const isNumeric = /^\d+$/.test(String(artistId));
    let artistRows: any[] = [];

    if (isNumeric) {
      artistRows = await sql`
        SELECT id, artist_name, biography, genre, genres, location, slug
        FROM users WHERE id = ${Number(artistId)} LIMIT 1
      `;
    }
    if (!artistRows.length) {
      artistRows = await sql`
        SELECT id, artist_name, biography, genre, genres, location, slug
        FROM users WHERE slug = ${String(artistId)} LIMIT 1
      `;
    }

    const artist = artistRows[0] ?? null;
    const resolvedId = artist?.id ?? artistId;

    // Fetch songs
    let songRows: any[] = [];
    if (resolvedId) {
      songRows = await sql`
        SELECT title, description, genre
        FROM songs
        WHERE user_id = ${Number(resolvedId)}
        ORDER BY created_at DESC
        LIMIT 30
      `;
    }

    const songs = songRows.map((s: any) => ({
      title:       s.title || s.name || 'Untitled',
      description: s.description || undefined,
      genre:       s.genre       || undefined,
    }));

    // Fetch saved Talk To Me config
    let configRows: any[] = [];
    try {
      configRows = await sql`
        SELECT * FROM artist_talk_to_me_config WHERE artist_id = ${String(resolvedId)} LIMIT 1
      `;
    } catch { /* table may not exist */ }

    // Fetch Superstar Blueprint
    let blueprint: any = null;
    try {
      const bpRows = await sql`
        SELECT blueprint_json, global_artist_score, current_era, primary_genre, brand_archetype
        FROM artist_blueprints
        WHERE artist_id = ${Number(resolvedId)} AND generation_status = 'completed'
        ORDER BY updated_at DESC LIMIT 1
      `;
      if (bpRows.length > 0) {
        blueprint = {
          score:        bpRows[0].global_artist_score,
          era:          bpRows[0].current_era,
          archetype:    bpRows[0].brand_archetype,
          blueprintJson: bpRows[0].blueprint_json,
        };
      }
    } catch { /* blueprint table may not exist */ }

    // Fetch EPK
    let epk: any = null;
    try {
      const epkRows = await sql`
        SELECT epk_data
        FROM artist_epks
        WHERE artist_id = ${Number(resolvedId)}
        ORDER BY updated_at DESC LIMIT 1
      `;
      if (epkRows.length > 0) epk = epkRows[0]?.epk_data;
    } catch { /* epk table may not exist */ }

    let personality: any = null;
    try {
      const personalityRows = await sql`
        SELECT traits, artistic_traits, current_mood, mood_intensity,
               artistic_vision, core_values, influences, anti_influences,
               communication_style, short_term_goals, long_term_goals, current_focus
        FROM artist_personality
        WHERE artist_id = ${Number(resolvedId)}
        LIMIT 1
      `;
      personality = personalityRows[0] ?? null;
    } catch { /* personality table may not exist */ }

    let memories: any[] = [];
    try {
      memories = await sql`
        SELECT memory_type, category, content, importance, emotional_weight, tags
        FROM agent_memory
        WHERE artist_id = ${Number(resolvedId)}
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY importance DESC, emotional_weight DESC, created_at DESC
        LIMIT 8
      `;
    } catch { /* memory table may not exist */ }

    return { artist, songs, config: configRows[0] ?? null, blueprint, epk, personality, memories };
  } catch (e) {
    console.error('[TalkToMe] fetchArtistContext error:', e);
    return { artist: null, songs: [], config: null, blueprint: null, epk: null, personality: null, memories: [] };
  }
}

// â”€â”€â”€ POST /start â€” get signed WebSocket URL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post('/start', async (req: Request, res: Response) => {
  try {
    const {
      artistId,
      artistName: reqName,
      persona,
      topics,
      language = 'espaÃ±ol',
      voiceId,
      agentId,
    } = req.body;

    if (!artistId && !reqName) {
      return res.status(400).json({ error: 'artistId or artistName required' });
    }

    // Unique id for metered per-minute billing of this call session.
    const callSessionId = randomUUID();
    const billing = {
      callSessionId,
      usdPerMinute:     TALK_TO_ME_USD_PER_MINUTE,
      freeTrialSeconds: TALK_TO_ME_FREE_TRIAL_SECONDS,
      creditsPerMinute: Math.ceil(TALK_TO_ME_USD_PER_SECOND * 60 * 100),
    };

    // Fetch full artist context
    const { artist, songs, config, blueprint, epk, personality, memories } = await fetchArtistContext(artistId);

    const resolvedName   = reqName         || artist?.artist_name  || 'Artist';
    const resolvedGenre  = blueprint?.blueprintJson?.sound?.primary_genre || artist?.genre || artist?.genres?.[0] || 'music';
    const resolvedBio    = artist?.biography   || '';
    const resolvedLoc    = artist?.location    || '';
    const resolvedGender = config?.gender  || 'unspecified';

    // Determine API key: per-artist first, then platform
    const apiKey = resolveApiKey(config?.elevenlabs_api_key);
    if (!apiKey) {
      return res.status(503).json({
        error: 'ElevenLabs API key not configured',
        help: 'Add your ElevenLabs API key in the Talk To Me settings panel.',
      });
    }

    // Determine voice: explicit override â†’ cloned voice â†’ config voice â†’ gender default
    const resolvedVoiceId =
      voiceId ||
      config?.cloned_voice_id ||
      config?.voice_id ||
      DEFAULT_VOICES[resolvedGender as keyof typeof DEFAULT_VOICES] ||
      DEFAULT_VOICES.unspecified;

    // Resolve persona and topics from request or saved config
    const resolvedPersona = persona || config?.persona || 'warm, authentic, creative';
    const resolvedTopics  = Array.isArray(topics) && topics.length ? topics : safeParseTopics(config?.topics);

    const systemPrompt = buildSystemPrompt({
      name:      resolvedName,
      genre:     resolvedGenre,
      biography: resolvedBio,
      location:  resolvedLoc,
      songs,
      persona:   resolvedPersona,
      topics:    resolvedTopics,
      language:  language || config?.language || 'english',
      gender:    resolvedGender,
      blueprint,
      epk,
      personality,
      memories,
    });

    const resolvedLang = language || config?.language || 'english';
    // ISO 639-1 code — ElevenLabs ASR requires 2-letter code, not full language name
    const elLang = resolvedLang.startsWith('en') ? 'en'
                 : resolvedLang.startsWith('es') ? 'es'
                 : resolvedLang.startsWith('pt') ? 'pt'
                 : resolvedLang.startsWith('fr') ? 'fr'
                 : resolvedLang.startsWith('de') ? 'de' : 'en';
    const firstMessage = buildFirstMessage({
      name: resolvedName,
      language: resolvedLang,
      mood: personality?.current_mood,
      genre: resolvedGenre,
    });

    const conversationConfig = buildElevenAgentConversationConfig({
      systemPrompt,
      firstMessage,
      language: elLang,
      voiceId: resolvedVoiceId,
    });

    const effectiveArtistId = artist?.id ? String(artist.id) : String(artistId);

    let targetAgentId = agentId || config?.agent_id || '';
    if (!targetAgentId) {
      // ── Auto-create a ConvAI agent for this artist (first-time setup) ──────
      let autoAgentId: string | null = null;
      try {
        console.log(`[TalkToMe] No agent configured for artist ${effectiveArtistId} — auto-creating...`);
        const createRes = await axios.post(
          `${EL_BASE}/convai/agents/create`,
          {
            name: `${resolvedName} AI Double`,
            conversation_config: conversationConfig,
          },
          { headers: elHeaders(apiKey), timeout: 20000 },
        );
        autoAgentId = createRes.data?.agent_id || null;
        if (autoAgentId) {
          const effectiveArtistId2 = artist?.id ? String(artist.id) : String(artistId);
          await sql`
            INSERT INTO artist_talk_to_me_config (artist_id, owner_uid, agent_id, updated_at)
            VALUES (${effectiveArtistId2}, 'system', ${autoAgentId}, NOW())
            ON CONFLICT (artist_id) DO UPDATE SET
              agent_id   = EXCLUDED.agent_id,
              updated_at = NOW()
          `;
          markAgentSynced(autoAgentId, conversationConfig);
          console.log(`[TalkToMe] ✅ Auto-created agent ${autoAgentId} for artist ${effectiveArtistId2}`);
        }
      } catch (createErr: any) {
        console.error('[TalkToMe] Agent auto-creation failed:', createErr.response?.data || createErr.message);
      }

      if (!autoAgentId && !DEFAULT_AGENT_ID) {
        return res.status(503).json({
          error: 'ElevenLabs ConvAI agent could not be created automatically',
          help:  'Create an agent at elevenlabs.io/convai, then save it in Talk To Me settings or set ELEVENLABS_CONVAI_AGENT_ID in your environment.',
          preview: { systemPrompt, firstMessage },
        });
      }

      if (!autoAgentId && DEFAULT_AGENT_ID) {
        console.warn('[TalkToMe] Agent auto-creation failed; falling back to ELEVENLABS_CONVAI_AGENT_ID without runtime overrides.');
        targetAgentId = DEFAULT_AGENT_ID;
      } else {
        targetAgentId = autoAgentId!;
      }
    }

    const usedFallbackAgent = !agentId && !config?.agent_id && targetAgentId === DEFAULT_AGENT_ID;
    const autoCreatedAgent = !agentId && !config?.agent_id && targetAgentId !== DEFAULT_AGENT_ID;

    if (!usedFallbackAgent && !autoCreatedAgent && targetAgentId) {
      await syncElevenAgentConfig({
        apiKey,
        agentId: targetAgentId,
        artistName: resolvedName,
        conversationConfig,
      }).catch((syncErr: any) => {
        console.warn('[TalkToMe] Agent config sync skipped:', syncErr.response?.data || syncErr.message);
      });
    }

    if (autoCreatedAgent) {
      // Use the freshly-created agent. Its prompt, first message, language, and voice
      // are already baked into the agent config, so do not send runtime overrides.
      const [signedUrlResAuto, conversationTokenAuto] = await Promise.all([
        axios.get(
          `${EL_BASE}/convai/conversation/get_signed_url?agent_id=${targetAgentId}`,
          { headers: elHeaders(apiKey), timeout: 15000 },
        ),
        fetchElevenConversationToken(apiKey, targetAgentId),
      ]);
      const signedUrlAuto: string = signedUrlResAuto.data?.signed_url || signedUrlResAuto.data?.signedUrl || '';
      if (!signedUrlAuto) throw new Error('ElevenLabs did not return a signed_url');
      return res.json({ success: true, signedUrl: signedUrlAuto, conversationToken: conversationTokenAuto || undefined, preferredTransport: conversationTokenAuto ? 'webrtc-mobile' : 'websocket', conversationConfigOverride: null, agentId: targetAgentId, artistName: resolvedName, voiceId: resolvedVoiceId, firstMessage, songCount: songs.length, autoCreated: true, runtimeOverrides: false, callSessionId, billing });
    }

    // get_signed_url is a GET endpoint — override is sent by client as first WS message
    const [signedUrlRes, conversationToken] = await Promise.all([
      axios.get(
        `${EL_BASE}/convai/conversation/get_signed_url?agent_id=${targetAgentId}`,
        { headers: elHeaders(apiKey), timeout: 15000 },
      ),
      fetchElevenConversationToken(apiKey, targetAgentId),
    ]);

    const signedUrl: string = signedUrlRes.data?.signed_url || signedUrlRes.data?.signedUrl || '';
    if (!signedUrl) throw new Error('ElevenLabs did not return a signed_url');

    // Runtime overrides require explicit allow-list settings inside the ElevenLabs
    // agent. If they are blocked, ElevenLabs closes the websocket immediately
    // with policy code 1008 and the browser keeps trying to send mic chunks to a
    // closed socket. Stability first: use the saved/default agent config here.
    const conversationConfigOverride = null;

    return res.json({
      success: true,
      signedUrl,
      conversationToken: conversationToken || undefined,
      preferredTransport: conversationToken ? 'webrtc-mobile' : 'websocket',
      conversationConfigOverride,
      agentId: targetAgentId,
      artistName: resolvedName,
      voiceId: resolvedVoiceId,
      firstMessage,
      songCount: songs.length,
      runtimeOverrides: false,
      fallbackAgent: usedFallbackAgent,
      callSessionId,
      billing,
    });
  } catch (err: any) {
    const msg = err.response?.data?.detail || err.response?.data?.error || err.message;
    console.error('[TalkToMe] /start error:', msg);
    return res.status(500).json({ error: msg || 'Internal error' });
  }
});

// ─── GET /pricing — fan-facing call pricing (+ caller balance if logged in) ───
router.get('/pricing', async (req: Request, res: Response) => {
  const pricing = {
    usdPerMinute:     TALK_TO_ME_USD_PER_MINUTE,
    creditsPerMinute: Math.ceil(TALK_TO_ME_USD_PER_SECOND * 60 * 100),
    freeTrialSeconds: TALK_TO_ME_FREE_TRIAL_SECONDS,
    creditsPerDollar: 100,
  };
  let balance: number | null = null;
  let isAdmin = false;
  const email = resolveCallerEmail(req);
  if (email) {
    try {
      const bal = await getUserBalance(email);
      balance = bal.credits;
      isAdmin = bal.isAdmin;
    } catch { /* best-effort */ }
  }
  return res.json({ success: true, pricing, balance, isAdmin });
});

// ─── POST /billing-tick — meter a live call against the fan's credits ─────────
// The client reports the cumulative elapsed seconds of the open call. The server
// charges only the newly-billable seconds beyond the free trial (and beyond what
// was already billed for this call session). Returns ok:false when the fan runs
// out of credits so the client can end the call and prompt a top-up.
router.post('/billing-tick', authenticate, async (req: Request, res: Response) => {
  try {
    const { callSessionId, artistId, elapsedSeconds } = req.body || {};
    if (!callSessionId) return res.status(400).json({ ok: false, error: 'callSessionId required' });

    const email = resolveCallerEmail(req);
    if (!email) {
      return res.status(401).json({ ok: false, reason: 'not_authenticated' });
    }

    pruneTtmBillingSessions();

    // Admin bypass — the platform owner is never billed.
    const bal = await getUserBalance(email);
    if (bal.isAdmin) {
      return res.json({ ok: true, charged: 0, balance: bal.credits, admin: true });
    }

    const elapsed = Math.max(0, Math.floor(Number(elapsedSeconds) || 0));
    const billableTotal = Math.max(0, elapsed - TALK_TO_ME_FREE_TRIAL_SECONDS);

    let session = ttmBillingSessions.get(String(callSessionId));
    if (!session) {
      session = {
        email,
        artistId: String(artistId || ''),
        startedAt: Date.now(),
        billedSeconds: 0,
        lastTickAt: Date.now(),
      };
      ttmBillingSessions.set(String(callSessionId), session);
    }
    // Bind the session to the first caller — prevents a hijacked id being billed
    // to a different account.
    if (session.email !== email) {
      return res.status(403).json({ ok: false, reason: 'session_owner_mismatch' });
    }
    session.lastTickAt = Date.now();

    let newlyBillable = billableTotal - session.billedSeconds;
    if (newlyBillable <= 0) {
      return res.json({ ok: true, charged: 0, balance: bal.credits, billedSeconds: session.billedSeconds });
    }
    newlyBillable = Math.min(newlyBillable, TALK_TO_ME_MAX_TICK_SECONDS);

    const usd = newlyBillable * TALK_TO_ME_USD_PER_SECOND;
    const charge = await chargeCreditsFromUsd(
      email,
      usd,
      `Talk To Me call — ${newlyBillable}s @ $${TALK_TO_ME_USD_PER_MINUTE}/min`,
    );

    if (!charge.success) {
      // Out of credits — do NOT advance billedSeconds so the next tick retries
      // the same window once the fan tops up.
      return res.json({
        ok: false,
        reason: 'insufficient_credits',
        balance: charge.remainingBalance,
        billedSeconds: session.billedSeconds,
        usdPerMinute: TALK_TO_ME_USD_PER_MINUTE,
      });
    }

    session.billedSeconds = billableTotal;
    return res.json({
      ok: true,
      charged: charge.creditsCharged,
      balance: charge.remainingBalance,
      billedSeconds: session.billedSeconds,
    });
  } catch (err: any) {
    console.error('[TalkToMe] /billing-tick error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});



router.get('/voices', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.query;
    let apiKey = PLATFORM_EL_API_KEY;

    if (artistId) {
      try {
        const rows = await sql`
          SELECT elevenlabs_api_key FROM artist_talk_to_me_config
          WHERE artist_id = ${String(artistId)} LIMIT 1
        `;
        if (rows[0]?.elevenlabs_api_key) apiKey = rows[0].elevenlabs_api_key;
      } catch { /* ignore */ }
    }

    if (!apiKey) return res.json({ voices: [] });

    const { data } = await axios.get(`${EL_BASE}/voices`, {
      headers: elHeaders(apiKey),
      timeout: 10000,
    });

    const voices = (data?.voices || []).map((v: any) => ({
      id:          v.voice_id,
      name:        v.name,
      category:    v.category,
      description: v.description || '',
      previewUrl:  v.preview_url || '',
      labels:      v.labels || {},
    }));

    return res.json({ voices });
  } catch (err: any) {
    console.error('[TalkToMe] /voices error:', err.message);
    return res.status(500).json({ error: err.message, voices: [] });
  }
});

// â”€â”€â”€ POST /save-config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post('/save-config', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      artistId,
      voiceId,
      persona,
      topics          = [],
      language        = 'espaÃ±ol',
      agentId,
      isEnabled       = true,
      elevenlabsApiKey,
      gender          = 'unspecified',
    } = req.body;

    if (!artistId) return res.status(400).json({ error: 'artistId required' });

    // Only update API key if explicitly provided (non-empty)
    const apiKeyClause = (elevenlabsApiKey && elevenlabsApiKey.trim())
      ? elevenlabsApiKey.trim()
      : null;

    await sql`
      INSERT INTO artist_talk_to_me_config (
        artist_id, owner_uid, voice_id, persona, topics,
        language, agent_id, is_enabled, gender,
        elevenlabs_api_key, updated_at
      )
      VALUES (
        ${String(artistId)}, ${userId}, ${voiceId || null},
        ${persona || null}, ${JSON.stringify(topics)},
        ${language}, ${agentId || null}, ${isEnabled}, ${gender},
        ${apiKeyClause}, NOW()
      )
      ON CONFLICT (artist_id) DO UPDATE SET
        owner_uid          = EXCLUDED.owner_uid,
        voice_id           = EXCLUDED.voice_id,
        persona            = EXCLUDED.persona,
        topics             = EXCLUDED.topics,
        language           = EXCLUDED.language,
        agent_id           = EXCLUDED.agent_id,
        is_enabled         = EXCLUDED.is_enabled,
        gender             = EXCLUDED.gender,
        elevenlabs_api_key = COALESCE(EXCLUDED.elevenlabs_api_key, artist_talk_to_me_config.elevenlabs_api_key),
        updated_at         = NOW()
    `;

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[TalkToMe] /save-config error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// â”€â”€â”€ GET /config/:artistId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/config/:artistId', async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const rows = await sql`
      SELECT
        artist_id, voice_id, persona, topics, language, agent_id,
        is_enabled, gender, voice_name, cloned_voice_id,
        CASE WHEN elevenlabs_api_key IS NOT NULL AND elevenlabs_api_key != ''
             THEN 'sk-...saved' ELSE NULL END AS elevenlabs_api_key_hint,
        updated_at
      FROM artist_talk_to_me_config
      WHERE artist_id = ${artistId} LIMIT 1
    `;
    return res.json({ config: rows[0] ?? null });
  } catch {
    return res.json({ config: null });
  }
});

// â”€â”€â”€ POST /voice-clone â€” Instant Voice Clone (IVC) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Expects multipart/form-data: artistId, name (optional), files[] audio files

router.post('/voice-clone', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { artistId, voiceName, description } = req.body;
    if (!artistId) return res.status(400).json({ error: 'artistId required' });

    // Resolve API key
    let apiKey = PLATFORM_EL_API_KEY;
    try {
      const rows = await sql`
        SELECT elevenlabs_api_key FROM artist_talk_to_me_config
        WHERE artist_id = ${String(artistId)} LIMIT 1
      `;
      if (rows[0]?.elevenlabs_api_key) apiKey = rows[0].elevenlabs_api_key;
    } catch { /* use platform key */ }

    if (!apiKey) return res.status(503).json({ error: 'ElevenLabs API key not configured' });

    const files = (req as any).files;
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ error: 'At least one audio file is required' });
    }

    const form = new FormData();
    const name = voiceName || 'My Artist Voice';
    form.append('name', name);
    if (description) form.append('description', description);

    for (const key of Object.keys(files)) {
      const file = Array.isArray(files[key]) ? files[key][0] : files[key];
      form.append('files', file.data, {
        filename: file.name,
        contentType: file.mimetype,
      });
    }

    const { data } = await axios.post(`${EL_BASE}/voices/add`, form, {
      headers: { 'xi-api-key': apiKey, ...form.getHeaders() },
      timeout: 60000,
    });

    const voiceId: string = data?.voice_id;
    if (!voiceId) throw new Error('ElevenLabs did not return voice_id');

    // Persist cloned voice to config
    await sql`
      INSERT INTO artist_talk_to_me_config (artist_id, owner_uid, cloned_voice_id, voice_name, is_enabled, updated_at)
      VALUES (${String(artistId)}, ${userId}, ${voiceId}, ${name}, true, NOW())
      ON CONFLICT (artist_id) DO UPDATE SET
        cloned_voice_id = ${voiceId},
        voice_name      = ${name},
        updated_at      = NOW()
    `;

    return res.json({ success: true, voiceId, voiceName: name });
  } catch (err: any) {
    const msg = err.response?.data?.detail || err.message;
    console.error('[TalkToMe] /voice-clone error:', msg);
    return res.status(500).json({ error: msg });
  }
});

// â”€â”€â”€ POST /voice-design â€” Generate voice from text description â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post('/voice-design', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { artistId, voiceDescription, voiceName, previewText, saveVoice } = req.body;
    if (!artistId || !voiceDescription) {
      return res.status(400).json({ error: 'artistId and voiceDescription required' });
    }

    let apiKey = PLATFORM_EL_API_KEY;
    try {
      const rows = await sql`
        SELECT elevenlabs_api_key FROM artist_talk_to_me_config
        WHERE artist_id = ${String(artistId)} LIMIT 1
      `;
      if (rows[0]?.elevenlabs_api_key) apiKey = rows[0].elevenlabs_api_key;
    } catch { /* use platform key */ }

    if (!apiKey) return res.status(503).json({ error: 'ElevenLabs API key not configured' });

    const text = previewText || 'Hello, I am your artist double. I am here to talk with you about my music.';

    // Step 1: Generate voice previews
    const previewRes = await axios.post(
      `${EL_BASE}/text-to-voice/create-previews`,
      { voice_description: voiceDescription, text },
      { headers: elHeaders(apiKey), timeout: 30000 },
    );

    const previews = previewRes.data?.previews || [];
    if (!previews.length) throw new Error('No voice previews generated');

    // If saveVoice is true, immediately save the first preview
    if (saveVoice) {
      const preview = previews[0];
      const saveRes = await axios.post(
        `${EL_BASE}/text-to-voice/create-voice-from-preview`,
        {
          voice_preview_id: preview.generated_voice_id,
          voice_name:       voiceName || 'AI Artist Voice',
          voice_description: voiceDescription,
        },
        { headers: elHeaders(apiKey), timeout: 20000 },
      );

      const voiceId = saveRes.data?.voice_id;
      if (!voiceId) throw new Error('Failed to save voice from preview');

      const name = voiceName || 'AI Artist Voice';
      await sql`
        INSERT INTO artist_talk_to_me_config (artist_id, owner_uid, cloned_voice_id, voice_name, is_enabled, updated_at)
        VALUES (${String(artistId)}, ${userId}, ${voiceId}, ${name}, true, NOW())
        ON CONFLICT (artist_id) DO UPDATE SET
          cloned_voice_id = ${voiceId},
          voice_name      = ${name},
          updated_at      = NOW()
      `;

      return res.json({
        success: true,
        voiceId,
        voiceName: name,
        saved: true,
      });
    }

    // Return previews with audio URLs for the artist to pick
    return res.json({
      success: true,
      previews: previews.map((p: any) => ({
        generatedVoiceId: p.generated_voice_id,
        audioBase64:      p.audio_base_64 || null,
        mediaType:        p.media_type    || 'audio/mpeg',
        durationSecs:     p.duration_secs || null,
      })),
    });
  } catch (err: any) {
    const msg = err.response?.data?.detail || err.message;
    console.error('[TalkToMe] /voice-design error:', msg);
    return res.status(500).json({ error: msg });
  }
});

// â”€â”€â”€ POST /voice-design/save â€” save a chosen preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post('/voice-design/save', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { artistId, generatedVoiceId, voiceName, voiceDescription } = req.body;
    if (!artistId || !generatedVoiceId) {
      return res.status(400).json({ error: 'artistId and generatedVoiceId required' });
    }

    let apiKey = PLATFORM_EL_API_KEY;
    try {
      const rows = await sql`SELECT elevenlabs_api_key FROM artist_talk_to_me_config WHERE artist_id = ${String(artistId)} LIMIT 1`;
      if (rows[0]?.elevenlabs_api_key) apiKey = rows[0].elevenlabs_api_key;
    } catch { /* use platform key */ }

    if (!apiKey) return res.status(503).json({ error: 'ElevenLabs API key not configured' });

    const name = voiceName || 'AI Artist Voice';
    const saveRes = await axios.post(
      `${EL_BASE}/text-to-voice/create-voice-from-preview`,
      { voice_preview_id: generatedVoiceId, voice_name: name, voice_description: voiceDescription || '' },
      { headers: elHeaders(apiKey), timeout: 20000 },
    );

    const voiceId = saveRes.data?.voice_id;
    if (!voiceId) throw new Error('Failed to save voice');

    await sql`
      INSERT INTO artist_talk_to_me_config (artist_id, owner_uid, cloned_voice_id, voice_name, is_enabled, updated_at)
      VALUES (${String(artistId)}, ${userId}, ${voiceId}, ${name}, true, NOW())
      ON CONFLICT (artist_id) DO UPDATE SET
        cloned_voice_id = ${voiceId},
        voice_name      = ${name},
        updated_at      = NOW()
    `;

    return res.json({ success: true, voiceId, voiceName: name });
  } catch (err: any) {
    const msg = err.response?.data?.detail || err.message;
    console.error('[TalkToMe] /voice-design/save error:', msg);
    return res.status(500).json({ error: msg });
  }
});

// â”€â”€â”€ DELETE /voice/:voiceId â€” delete a voice from EL and config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.delete('/voice/:voiceId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { voiceId } = req.params;
    const { artistId } = req.body;

    let apiKey = PLATFORM_EL_API_KEY;
    if (artistId) {
      try {
        const rows = await sql`SELECT elevenlabs_api_key FROM artist_talk_to_me_config WHERE artist_id = ${String(artistId)} LIMIT 1`;
        if (rows[0]?.elevenlabs_api_key) apiKey = rows[0].elevenlabs_api_key;
      } catch { /* use platform key */ }
    }

    if (apiKey) {
      await axios.delete(`${EL_BASE}/voices/${voiceId}`, {
        headers: elHeaders(apiKey),
        timeout: 10000,
      }).catch(() => { /* ignore if voice already deleted */ });
    }

    if (artistId) {
      await sql`
        UPDATE artist_talk_to_me_config
        SET cloned_voice_id = NULL, voice_name = NULL, updated_at = NOW()
        WHERE artist_id = ${String(artistId)} AND cloned_voice_id = ${voiceId}
      `;
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[TalkToMe] /voice delete error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Call analytics: zero-cost local heuristics ──────────────────────────────
// We deliberately avoid calling any paid AI here — sentiment and topics are
// derived from the transcript with simple keyword scoring so analytics never
// add to the ElevenLabs / OpenAI bill.

const POSITIVE_WORDS = [
  'love', 'amazing', 'great', 'awesome', 'beautiful', 'incredible', 'fan', 'favorite',
  'favourite', 'thank', 'thanks', 'happy', 'excited', 'cool', 'best', 'wonderful',
  'inspiring', 'inspire', 'enjoy', 'enjoyed', 'good', 'nice', 'wow', 'perfect', 'fire',
  'me encanta', 'increíble', 'increible', 'gracias', 'genial', 'hermoso', 'hermosa',
  'feliz', 'emocionado', 'mejor', 'maravilloso', 'encanta', 'bueno', 'buena', 'wow',
];
const NEGATIVE_WORDS = [
  'hate', 'bad', 'awful', 'terrible', 'boring', 'worst', 'disappointed', 'sad', 'angry',
  'annoying', 'sucks', 'poor', 'wrong', 'horrible', 'noisy', 'cringe', 'meh',
  'odio', 'malo', 'mala', 'terrible', 'aburrido', 'peor', 'decepcionado', 'triste',
  'enojado', 'horrible', 'feo', 'fea',
];

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','to','of','in','on','for','with','is','are','was','were',
  'i','you','he','she','it','we','they','me','my','your','that','this','do','does','did',
  'so','just','really','very','about','what','how','when','where','why','who','can','will',
  'would','could','should','have','has','had','am','be','been','being','as','at','by','from',
  'el','la','los','las','un','una','y','o','de','en','con','que','por','para','es','son',
  'yo','tu','tú','su','mi','este','esta','eso','esa','muy','solo','sobre','como','cuando',
  'donde','porque','quien','si','no','se','lo','un','del','al','su','sus','me','te','nos',
]);

function analyzeTranscript(transcript: Array<{ role?: string; text?: string }> | null) {
  const lines = Array.isArray(transcript) ? transcript : [];
  const fanText = lines
    .filter(l => l && l.role === 'user' && typeof l.text === 'string')
    .map(l => String(l.text))
    .join(' ');
  const lower = fanText.toLowerCase();

  // Sentiment: count positive/negative keyword hits
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE_WORDS) if (lower.includes(w)) pos++;
  for (const w of NEGATIVE_WORDS) if (lower.includes(w)) neg++;
  const total = pos + neg;
  const score = total === 0 ? 0 : (pos - neg) / total; // -1..1
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (score > 0.2) sentiment = 'positive';
  else if (score < -0.2) sentiment = 'negative';

  // Topics: most frequent meaningful words in the fan's side of the conversation
  const freq = new Map<string, number>();
  for (const raw of lower.split(/[^a-záéíóúñü0-9]+/i)) {
    const word = raw.trim();
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  const topics = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  return { sentiment, score, topics };
}

// ─── POST /log-call — persist a completed call + computed analytics ───────────
router.post('/log-call', async (req: Request, res: Response) => {
  try {
    const {
      artistId,
      callerUid = null,
      durationSeconds = 0,
      language = null,
      transcript = [],
    } = req.body || {};

    if (!artistId) return res.status(400).json({ error: 'artistId required' });

    // Ignore trivially short / empty calls (connection blips) so stats stay clean.
    const lines = Array.isArray(transcript) ? transcript : [];
    const duration = Math.max(0, Math.min(Number(durationSeconds) || 0, 60 * 60));
    if (duration < 3 && lines.length === 0) {
      return res.json({ success: true, skipped: true });
    }

    const { sentiment, score, topics } = analyzeTranscript(lines);

    await ensureAnalyticsTable();
    await sql`
      INSERT INTO talk_to_me_call_logs (
        artist_id, caller_uid, duration_seconds, message_count,
        language, topics, transcript, sentiment, sentiment_score
      )
      VALUES (
        ${String(artistId)}, ${callerUid ? String(callerUid) : null},
        ${duration}, ${lines.length},
        ${language}, ${JSON.stringify(topics)}, ${JSON.stringify(lines)},
        ${sentiment}, ${score}
      )
    `;

    return res.json({ success: true, sentiment, topics });
  } catch (err: any) {
    console.error('[TalkToMe] /log-call error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /analytics/:artistId — aggregated call analytics (owner dashboard) ───
router.get('/analytics/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    if (!artistId) return res.status(400).json({ error: 'artistId required' });

    await ensureAnalyticsTable();

    const summaryRows = await sql`
      SELECT
        COUNT(*)::int                                   AS total_calls,
        COALESCE(ROUND(AVG(duration_seconds)), 0)::int  AS avg_duration,
        COALESCE(SUM(duration_seconds), 0)::int         AS total_duration,
        COALESCE(SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END), 0)::int AS positive_calls,
        COALESCE(SUM(CASE WHEN sentiment = 'neutral'  THEN 1 ELSE 0 END), 0)::int AS neutral_calls,
        COALESCE(SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END), 0)::int AS negative_calls,
        MAX(created_at)                                 AS last_call_at
      FROM talk_to_me_call_logs
      WHERE artist_id = ${String(artistId)}
    `;
    const summary = summaryRows[0] || {};

    // Aggregate top topics across all calls (topics stored as JSON arrays).
    const topicRows = await sql`
      SELECT lower(topic.value) AS topic, COUNT(*)::int AS count
      FROM talk_to_me_call_logs,
           jsonb_array_elements_text(COALESCE(topics, '[]'::jsonb)) AS topic
      WHERE artist_id = ${String(artistId)}
      GROUP BY lower(topic.value)
      ORDER BY count DESC
      LIMIT 8
    `;

    const recentRows = await sql`
      SELECT duration_seconds, message_count, sentiment, language, created_at
      FROM talk_to_me_call_logs
      WHERE artist_id = ${String(artistId)}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const totalSentiment =
      Number(summary.positive_calls || 0) +
      Number(summary.neutral_calls || 0) +
      Number(summary.negative_calls || 0);
    const fanSentiment =
      totalSentiment === 0
        ? 'neutral'
        : Number(summary.positive_calls) >= Number(summary.negative_calls) &&
          Number(summary.positive_calls) >= Number(summary.neutral_calls)
        ? 'positive'
        : Number(summary.negative_calls) > Number(summary.positive_calls)
        ? 'negative'
        : 'neutral';

    return res.json({
      analytics: {
        totalCalls:    Number(summary.total_calls || 0),
        avgDuration:   Number(summary.avg_duration || 0),
        totalDuration: Number(summary.total_duration || 0),
        lastCallAt:    summary.last_call_at || null,
        sentiment: {
          overall:  fanSentiment,
          positive: Number(summary.positive_calls || 0),
          neutral:  Number(summary.neutral_calls || 0),
          negative: Number(summary.negative_calls || 0),
        },
        topTopics: topicRows.map((r: any) => ({ topic: r.topic, count: Number(r.count) })),
        recentCalls: recentRows.map((r: any) => ({
          durationSeconds: Number(r.duration_seconds),
          messageCount:    Number(r.message_count),
          sentiment:       r.sentiment,
          language:        r.language,
          createdAt:       r.created_at,
        })),
      },
    });
  } catch (err: any) {
    console.error('[TalkToMe] /analytics error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});


export default router;
