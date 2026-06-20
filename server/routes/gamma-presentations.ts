/**
 * Gamma Presentations API
 * Generates professional slide decks using the Gamma AI API,
 * fueled by the artist's full context (bio, genre, songs, social links, achievements).
 *
 * Endpoints:
 *   GET  /:artistId/decks              — list all saved decks
 *   POST /:artistId/generate           — generate a new deck via Gamma API
 *   DELETE /:artistId/decks/:deckId    — delete a deck
 *   GET  /:artistId/credentials        — check if API key is connected
 *   POST /:artistId/credentials        — save Gamma API key
 */

import { Router, Request, Response } from 'express';
import { db as firestoreDb } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { buildSkillsOnlyPrompt } from '../utils/ai-skills-injector';

const router = Router();

// ─── Types ──────────────────────────────────────────────────────────────────

type DeckType =
  | 'artist_bio'
  | 'press_kit'
  | 'pitch_deck'
  | 'tour_deck'
  | 'album_launch'
  | 'brand_deck'
  | 'fan_story'
  | 'sponsor_deck'
  | 'label_pitch'
  | 'event_proposal';

interface GammaDeck {
  id: string;
  artistId: string;
  type: DeckType;
  title: string;
  description: string;
  prompt: string;
  gammaId?: string;
  gammaUrl?: string;
  thumbnailUrl?: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  theme?: string;
  slideCount?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pull artist context from Firestore + Postgres (via profile route) to enrich prompts
 */
async function getArtistContext(artistId: string): Promise<Record<string, any>> {
  try {
    // Attempt to read from Firestore generated_artists or users
    const [genSnap, userSnap] = await Promise.all([
      firestoreDb.collection('generated_artists').doc(artistId).get().catch(() => null),
      firestoreDb.collection('users').where('uid', '==', artistId).limit(1).get().catch(() => null),
    ]);

    let ctx: Record<string, any> = {};

    if (genSnap?.exists) {
      const d = genSnap.data()!;
      ctx = {
        name: d.canonical?.artist_name || d.name || d.artistName || 'Artist',
        genre: d.canonical?.genre || d.genres?.[0] || d.genre || 'Music',
        biography: d.canonical?.biography_long || d.canonical?.biography_short || d.biography || '',
        tagline: d.canonical?.tagline || '',
        location: d.canonical?.city_of_origin || d.location || '',
        achievements: d.achievements || [],
        influences: d.influences || [],
        songs: (d.songs || []).slice(0, 5).map((s: any) => s.title || s.name),
        instagram: d.social_media?.instagram?.url || d.instagram || '',
        spotify: d.social_media?.spotify?.url || d.spotify || '',
        youtube: d.social_media?.youtube?.url || d.youtube || '',
        profileImage: d.profileImage || d.canonical?.image_url || '',
      };
    } else if (userSnap && !userSnap.empty) {
      const d = userSnap.docs[0].data();
      ctx = {
        name: d.artistName || d.name || d.displayName || 'Artist',
        genre: d.genres?.[0] || d.genre || 'Music',
        biography: d.biography || '',
        tagline: '',
        location: d.location || '',
        achievements: [],
        influences: [],
        songs: [],
        instagram: d.instagram || '',
        spotify: d.spotify || '',
        youtube: d.youtube || '',
        profileImage: d.profileImage || d.photoURL || '',
      };
    }

    // Also fetch songs from Firestore songs collection
    if (ctx.name) {
      try {
        const songsSnap = await firestoreDb
          .collection('songs')
          .where('artistId', '==', artistId)
          .limit(5)
          .get();
        if (!songsSnap.empty) {
          ctx.songs = songsSnap.docs.map((d) => d.data().name || d.data().title).filter(Boolean);
        }
      } catch { /* ignore */ }
    }

    return ctx;
  } catch {
    return {};
  }
}

/**
 * Build a rich GPT-quality prompt for a given deck type using the artist context
 */
function buildDeckPrompt(type: DeckType, ctx: Record<string, any>, customPrompt?: string): string {
  const name = ctx.name || 'Artist';
  const genre = ctx.genre || 'music';
  const bio = ctx.biography ? ctx.biography.slice(0, 400) : '';
  const songs = (ctx.songs || []).join(', ');
  const location = ctx.location ? ` based in ${ctx.location}` : '';
  const tagline = ctx.tagline ? ` — "${ctx.tagline}"` : '';

  if (customPrompt) return customPrompt;

  const templates: Record<DeckType, string> = {
    artist_bio: `Create a visually stunning artist biography presentation for ${name}, a ${genre} artist${location}${tagline}.
Include: Artist story and journey, musical style and influences, notable songs${songs ? `: ${songs}` : ''}, artistic vision, milestones and achievements, and a compelling call-to-action for fans and industry.
Biography: ${bio}
Style: Dark elegant aesthetic, cinematic typography, music industry premium feel.`,

    press_kit: `Create a professional Electronic Press Kit (EPK) presentation for ${name}, a ${genre} artist${location}.
Include: Artist overview and headline, short bio, key achievements, discography highlights${songs ? ` (${songs})` : ''}, press quotes, booking and contact information, and social media stats.
Biography: ${bio}
Style: Clean, professional, magazine-quality layout suitable for industry contacts, booking agents, and journalists.`,

    pitch_deck: `Create a compelling investor pitch deck for ${name}, a ${genre} artist${location}.
Include: Artist vision and mission, market opportunity in the ${genre} genre, unique value proposition, current traction and milestones, revenue streams (streaming, merch, licensing, live), growth roadmap, team, and investment ask.
Biography: ${bio}
Style: Bold, modern, startup-meets-music-industry aesthetic.`,

    tour_deck: `Create a professional tour pitch deck for ${name}, a ${genre} artist${location}.
Include: Tour concept and vision, artist profile, target markets and venues, tour dates proposal template, tech rider highlights, audience demographics, social media reach, past performance highlights, and booking contact.
Style: Dynamic, energetic, tour promotional aesthetic.`,

    album_launch: `Create an album launch campaign presentation for ${name}, a ${genre} artist${location}.
Include: Album concept and storyline, track listing${songs ? ` featuring: ${songs}` : ''}, release strategy and timeline, marketing plan (social, playlists, press), visual identity and artwork direction, promotional assets, and key metrics to track.
Biography: ${bio}
Style: Immersive, album-art inspired aesthetic.`,

    brand_deck: `Create a brand partnership proposal for ${name}, a ${genre} artist${location}.
Include: Artist brand identity and values, audience demographics and size, engagement metrics, past brand synergies, partnership opportunities (co-creation, social, events), case studies, and partnership tiers with pricing.
Biography: ${bio}
Style: Professional, luxury brand meets music industry aesthetic.`,

    fan_story: `Create an engaging fan story / community presentation for ${name}, a ${genre} artist${location}.
Include: Artist's journey and backstory, connection with fans, community milestones, fan-created content highlights, upcoming releases and events, how to join the inner circle, and exclusive benefits.
Biography: ${bio}
Style: Warm, authentic, community-driven aesthetic.`,

    sponsor_deck: `Create a sponsorship proposal deck for ${name}, a ${genre} artist${location}.
Include: Artist profile and reach, audience demographics, content performance metrics, sponsorship packages (title, co-branding, product integration), ROI projections, deliverables and timeline, and contact info.
Biography: ${bio}
Style: Business professional, data-driven aesthetic.`,

    label_pitch: `Create a record label pitch deck for ${name}, a ${genre} artist${location}.
Include: Artist vision and unique sound, market positioning in ${genre}, streaming traction and growth curves, live performance record, social media following, planned releases${songs ? ` including ${songs}` : ''}, long-term roadmap, and deal structure proposal.
Biography: ${bio}
Style: Bold, industry-savvy, A&R meeting ready aesthetic.`,

    event_proposal: `Create an event / concert proposal presentation for ${name}, a ${genre} artist${location}.
Include: Event concept and theme, artist profile and draw, technical requirements, stage setup, setlist overview${songs ? ` (${songs})` : ''}, promotional plan, ticket pricing strategy, sponsorship integration, and production timeline.
Style: Exciting, event-ready, concert promotional aesthetic.`,
  };

  return templates[type] || templates.artist_bio;
}

/**
 * Call Gamma API to generate a presentation
 * Gamma API Reference: POST https://api.gamma.app/generate
 * Headers: Authorization: Bearer {apiKey}
 * Body: { prompt, theme, numberOfCards, language }
 * Returns: { id, url, title, ... }
 */
async function callGammaAPI(
  apiKey: string,
  prompt: string,
  options: { theme?: string; slideCount?: number; language?: string } = {},
): Promise<{ gammaId: string; gammaUrl: string; title?: string; thumbnailUrl?: string }> {
  const { theme = 'dark', slideCount = 10, language = 'en' } = options;

  // Gamma API endpoint (will be activated once the key is provided)
  const response = await axios.post(
    'https://api.gamma.app/generate',
    {
      prompt,
      theme,
      numberOfCards: slideCount,
      language,
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120_000, // Gamma can take up to 2 minutes
    },
  );

  const data = response.data;

  return {
    gammaId: data.id || data.deckId || uuidv4(),
    gammaUrl: data.url || data.viewUrl || data.shareUrl || '',
    title: data.title || undefined,
    thumbnailUrl: data.thumbnail || data.thumbnailUrl || undefined,
  };
}

/**
 * Use GPT to enrich the prompt before sending to Gamma
 */
async function enrichPromptWithGPT(rawPrompt: string, artistContext: Record<string, any>): Promise<string> {
  try {
    const openai = createTrackedOpenAI('gamma-presentations');
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        {
          role: 'system',
          content: buildSkillsOnlyPrompt(
            'gamma-presentations',
            'You are a creative director for music artists. Enrich presentation prompts to be visually compelling, specific, and impactful. Keep the output concise (under 500 words). Focus on storytelling, visual flow, and professional aesthetics.',
          ),
        },
        {
          role: 'user',
          content: `Enrich this presentation prompt for a Gamma AI slide deck generator. Add specific details about visual style, slide structure, and content flow. Artist context: Name=${artistContext.name}, Genre=${artistContext.genre}, Location=${artistContext.location || 'N/A'}.\n\nOriginal prompt:\n${rawPrompt}`,
        },
      ],
      max_tokens: 600,
    });
    return response.choices[0]?.message?.content?.trim() || rawPrompt;
  } catch {
    return rawPrompt; // fallback to original if GPT fails
  }
}

/** Simple mask for secrets */
function maskSecret(val: string): string {
  if (!val || val.length < 8) return '••••••••';
  return `${val.slice(0, 4)}${'•'.repeat(Math.max(val.length - 8, 4))}${val.slice(-4)}`;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /:artistId/decks — list all saved decks for this artist
 */
router.get('/:artistId/decks', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    const snap = await firestoreDb
      .collection('gammaDecks')
      .doc(artistId)
      .collection('decks')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const decks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, decks });
  } catch (err: any) {
    console.error('[Gamma] Error listing decks:', err.message);
    res.json({ success: true, decks: [] }); // graceful empty on first use
  }
});

/**
 * POST /:artistId/generate — generate a new presentation
 * Body: { type, title?, customPrompt?, theme?, slideCount?, language? }
 */
router.post('/:artistId/generate', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const {
    type = 'artist_bio' as DeckType,
    title: customTitle,
    customPrompt,
    theme = 'dark',
    slideCount = 10,
    language = 'en',
  } = req.body;

  try {
    // 1. Get artist context
    const ctx = await getArtistContext(artistId);

    // 2. Build prompt
    const rawPrompt = buildDeckPrompt(type as DeckType, ctx, customPrompt);

    // 3. Enrich prompt with GPT
    const enrichedPrompt = await enrichPromptWithGPT(rawPrompt, ctx);

    // 4. Check for Gamma API key
    const credsDoc = await firestoreDb.collection('gammaCredentials').doc(artistId).get();
    const creds = credsDoc.exists ? credsDoc.data()! : {};

    const deckId = uuidv4();
    const now = new Date().toISOString();

    const deckTitle =
      customTitle ||
      `${ctx.name || 'Artist'} — ${type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`;

    // 5. Create deck record (initially pending)
    const deckRecord: GammaDeck = {
      id: deckId,
      artistId,
      type: type as DeckType,
      title: deckTitle,
      description: enrichedPrompt.slice(0, 200),
      prompt: enrichedPrompt,
      status: 'pending',
      theme,
      slideCount,
      createdAt: now,
      updatedAt: now,
    };

    await firestoreDb
      .collection('gammaDecks')
      .doc(artistId)
      .collection('decks')
      .doc(deckId)
      .set(deckRecord);

    // 6. If Gamma API key is set, call API
    if (creds.gammaApiKey) {
      try {
        // Update status to generating
        await firestoreDb
          .collection('gammaDecks')
          .doc(artistId)
          .collection('decks')
          .doc(deckId)
          .update({ status: 'generating', updatedAt: new Date().toISOString() });

        const gammaResult = await callGammaAPI(creds.gammaApiKey, enrichedPrompt, {
          theme,
          slideCount,
          language,
        });

        const update: Partial<GammaDeck> = {
          status: 'ready',
          gammaId: gammaResult.gammaId,
          gammaUrl: gammaResult.gammaUrl,
          thumbnailUrl: gammaResult.thumbnailUrl,
          title: gammaResult.title || deckTitle,
          updatedAt: new Date().toISOString(),
        };

        await firestoreDb
          .collection('gammaDecks')
          .doc(artistId)
          .collection('decks')
          .doc(deckId)
          .update(update);

        const finalDeck = { ...deckRecord, ...update };
        return res.json({ success: true, deck: finalDeck, apiConnected: true });
      } catch (gammaErr: any) {
        console.error('[Gamma] API call failed:', gammaErr.message);
        await firestoreDb
          .collection('gammaDecks')
          .doc(artistId)
          .collection('decks')
          .doc(deckId)
          .update({
            status: 'error',
            errorMessage: gammaErr.message || 'Gamma API call failed',
            updatedAt: new Date().toISOString(),
          });
        return res.json({
          success: true,
          deck: { ...deckRecord, status: 'error', errorMessage: gammaErr.message },
          apiConnected: true,
          error: 'Gamma API call failed — check your API key',
        });
      }
    }

    // No API key — return the saved prompt/draft so user can copy it to gamma.app manually
    return res.json({
      success: true,
      deck: deckRecord,
      apiConnected: false,
      prompt: enrichedPrompt,
      message: 'Deck prompt saved. Connect your Gamma API key to generate automatically, or copy the prompt to gamma.app.',
    });
  } catch (err: any) {
    console.error('[Gamma] Generate error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /:artistId/decks/:deckId — update deck status (e.g. after manual gamma.app generation)
 * Body: { gammaUrl, thumbnailUrl, status, title }
 */
router.put('/:artistId/decks/:deckId', authenticate, async (req: Request, res: Response) => {
  const { artistId, deckId } = req.params;
  const { gammaUrl, thumbnailUrl, status, title } = req.body;
  try {
    const update: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (gammaUrl !== undefined) update.gammaUrl = gammaUrl;
    if (thumbnailUrl !== undefined) update.thumbnailUrl = thumbnailUrl;
    if (status !== undefined) update.status = status;
    if (title !== undefined) update.title = title;
    if (gammaUrl) update.status = 'ready';

    await firestoreDb
      .collection('gammaDecks')
      .doc(artistId)
      .collection('decks')
      .doc(deckId)
      .update(update);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /:artistId/decks/:deckId — delete a deck
 */
router.delete('/:artistId/decks/:deckId', authenticate, async (req: Request, res: Response) => {
  const { artistId, deckId } = req.params;
  try {
    await firestoreDb
      .collection('gammaDecks')
      .doc(artistId)
      .collection('decks')
      .doc(deckId)
      .delete();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /:artistId/credentials — check Gamma API connection status
 */
router.get('/:artistId/credentials', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    const snap = await firestoreDb.collection('gammaCredentials').doc(artistId).get();
    if (!snap.exists) return res.json({ success: true, credentials: {}, connected: false });

    const data = snap.data()!;
    res.json({
      success: true,
      connected: !!data.gammaApiKey,
      credentials: {
        gammaApiKeySet: !!data.gammaApiKey,
        gammaApiKeyMasked: data.gammaApiKey ? maskSecret(data.gammaApiKey) : null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /:artistId/credentials — save Gamma API key
 * Body: { gammaApiKey }
 */
router.post('/:artistId/credentials', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { gammaApiKey } = req.body;

  if (!gammaApiKey) {
    return res.status(400).json({ success: false, error: 'gammaApiKey is required' });
  }

  try {
    await firestoreDb.collection('gammaCredentials').doc(artistId).set(
      {
        gammaApiKey,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    res.json({ success: true, message: 'Gamma API key saved securely' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /:artistId/context — get the artist context used for prompt building (preview)
 */
router.get('/:artistId/context', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    const ctx = await getArtistContext(artistId);
    res.json({ success: true, context: ctx });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
