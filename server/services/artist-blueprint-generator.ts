/**
 * Artist Superstar Blueprint Generator
 *
 * Genera el JSON maestro de 13 módulos personalizado para cada artista.
 * Usa todos los datos reales del artista (perfil, canciones, redes, merch)
 * como contexto para producir un blueprint con precisión "Michael Jackson level".
 *
 * Este blueprint alimenta TODOS los sistemas del platform:
 * Campaigns, Monetization, Content, Visual, Distribution, PR, etc.
 */

import { callAI } from '../utils/smart-ai';
import { buildEnrichedSystemPrompt } from '../utils/ai-skills-injector';
import { db as pgDb } from '../../db';
import {
  users, songs, merchandise,
  marketingMetrics, salesTransactions, crowdfundingCampaigns, artistWallet,
  artistBlueprints,
} from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { db as firebaseDb } from '../firebase';
import { loadBrandProfile, type ArtistBrandProfile } from './artist-brand-profile';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArtistBlueprintData {
  // Artist DNA
  artist_dna: {
    artist_id: string;
    artist_name: string;
    real_name: string | null;
    artist_type: string;
    primary_genre: string;
    secondary_genres: string[];
    nationality: string;
    city_of_origin: string;
    age_range: string;
    gender: string;
    career_stage: string;
    career_start_year: number;
    brand_essence: string;
    tagline: string;
  };
  // Identity
  identity: {
    brand_archetype: string;
    personality_traits: string[];
    communication_style: string;
    social_media_voice: string;
    visual_signature: string;
    unique_value_proposition: string;
    audience_connection_style: string;
  };
  // Talent & Training
  talent: {
    primary_talent: string;
    secondary_talents: string[];
    vocal_range: string;
    live_performance_style: string;
    dance_ability: string;
    instrumental_skills: string[];
    production_involvement: string;
    development_focus: string[];
  };
  // Sound
  sound: {
    primary_genre: string;
    sub_genres: string[];
    bpm_range: { min: number; max: number };
    key_signatures: string[];
    vocal_style: string;
    production_style: string;
    sonic_influences: string[];
    mood_keywords: string[];
    lyric_themes: string[];
    signature_sound: string;
    hit_formula: string;
    hit_potential_score: number;
  };
  // Catalog
  catalog: {
    total_tracks: number;
    main_single: string | null;
    tracklist: Array<{ title: string; mood: string; status: string }>;
    unreleased_concepts: string[];
    era_concept: string;
    next_release_strategy: string;
  };
  // Visual Universe
  visual_universe: {
    aesthetic: string;
    color_palette: string[];
    palette_name: string;
    fashion_keywords: string[];
    cinematic_style: string;
    art_direction_brief: string;
    logo_concept: string;
    cover_art_direction: string;
    video_style: string;
    photography_direction: string;
  };
  // Performance
  performance: {
    show_type: string;
    stage_presence: string;
    setlist_strategy: string;
    touring_capacity: string;
    live_production_elements: string[];
    performance_rituals: string[];
    crowd_engagement_tactics: string[];
  };
  // Launch Campaign
  launch_campaign: {
    campaign_name: string;
    campaign_concept: string;
    target_audience: {
      primary: string;
      secondary: string;
      psychographics: string[];
    };
    key_messages: string[];
    platform_strategy: Record<string, string>;
    content_calendar_weeks: number;
    launch_sequence: string[];
    kpis: Record<string, number | string>;
  };
  // Distribution
  distribution: {
    primary_platforms: string[];
    secondary_platforms: string[];
    release_frequency: string;
    playlist_targets: string[];
    sync_licensing_focus: string[];
    international_markets: string[];
    distribution_strategy: string;
  };
  // Fanbase Growth
  fanbase: {
    total_estimated_fans: number;
    fan_segments: Array<{
      name: string;
      percentage: number;
      behavior: string;
    }>;
    engagement_tactics: string[];
    community_name: string;
    fan_activation_sequence: string[];
    crm_strategy: string;
  };
  // PR & Narrative
  pr_narrative: {
    press_headline: string;
    origin_story: string;
    breakthrough_moment: string;
    current_chapter: string;
    media_angles: string[];
    controversy_protection: string[];
    press_contact_strategy: string;
    speaking_points: string[];
  };
  // Monetization
  monetization: {
    revenue_model: string;
    revenue_pillars: string[];
    merch_products: Array<{ name: string; type: string; price_usd: number }>;
    streaming_targets: Record<string, number>;
    brand_partnership_targets: string[];
    ticket_price_range: { min: number; max: number };
    nft_strategy: string;
    projected_year1_revenue_usd: number;
    value_protection_rules: string[];
  };
  // Era Evolution
  era_evolution: {
    current_era: string;
    era_concept: string;
    era_duration_months: number;
    era_milestones: string[];
    next_era_concept: string;
    evolution_triggers: string[];
    legacy_vision: string;
  };
  // System metadata
  _meta: {
    schema_version: string;
    generated_at: string;
    artist_id: number;
    global_artist_score: number;
    next_actions: string[];
    agents: {
      news_brief: string;
      content_brief: string;
      merch_brief: string;
      song_brief: string;
      campaign_brief: string;
      visual_brief: string;
    };
  };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildBlueprintSystemPrompt(): string {
  return `You are the Boostify Superstar Blueprint Architect — an elite music industry AI strategist combining the analytical precision of a top-tier A&R director, the creative vision of a world-class art director, and the strategic mind of a music industry CEO.

Your task is to generate a complete 13-module Superstar Blueprint JSON for a real artist using ALL their actual data (profile, songs, social handles, merch, biography).

Rules:
1. Use ONLY the artist's real data — adapt every field to their actual identity
2. Be hyper-specific — no generic content, every sentence must feel written FOR this specific artist
3. The blueprint feeds every AI system on the platform — precision is critical
4. Set ambitious but realistic targets based on career stage
5. Output ONLY valid JSON — no markdown, no text outside the JSON object`;
}

function buildBlueprintUserPrompt(artistData: {
  id: number;
  name: string;
  biography: string | null;
  genres: string[] | null;
  country: string | null;
  location: string | null;
  realName: string | null;
  instagramHandle: string | null;
  twitterHandle: string | null;
  youtubeChannel: string | null;
  spotifyUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  isAIGenerated: boolean | null;
  existingMasterJson: Record<string, unknown> | null;
  concerts: { upcoming?: Array<{ tourName: string; location: { city: string; country: string; venue: string }; date: string }>; highlights?: Array<{ eventName: string; year: number; note: string }> } | null;
  topYoutubeVideos: Array<{ title: string; url: string; type: string }> | null;
  // Stats
  spotifyFollowers: number;
  instagramFollowers: number;
  youtubeViews: number;
  monthlyListeners: number;
  playlistPlacements: number;
  totalEngagement: number;
  totalEarnings: number;
  crowdfundingTotal: number;
  crowdfundingBackers: number;
  // Catalog
  songs: Array<{ title: string; genre: string | null; mood: string | null; plays: number; analysisReady: boolean; bpm?: number; key?: string; lyricsSnippet?: string | null }>;
  merchItems: Array<{ name: string; category: string | null; price: string | null }>;
  brandProfile?: ArtistBrandProfile | null;
}): string {
  const songsList = artistData.songs.length > 0
    ? artistData.songs.map(s => {
        let line = `- "${s.title}"${s.genre ? ` (${s.genre})` : ''}${s.mood ? ` [${s.mood}]` : ''}`;
        if (s.plays > 0) line += ` — ${s.plays.toLocaleString()} plays`;
        if (s.bpm) line += ` | ${s.bpm} BPM`;
        if (s.key) line += ` | Key: ${s.key}`;
        if (s.lyricsSnippet) line += `\n  Lyrics: "${s.lyricsSnippet}"`;
        return line;
      }).join('\n')
    : '- No songs registered yet';

  const merchList = artistData.merchItems.length > 0
    ? artistData.merchItems.map(m => `- ${m.name} (${m.category || 'general'})${m.price ? ` $${m.price}` : ''}`).join('\n')
    : '- No merch items yet';

  const existingContext = artistData.existingMasterJson
    ? `\nExisting Master JSON context (for continuity):\n${JSON.stringify(artistData.existingMasterJson).substring(0, 600)}...`
    : '';

  // MASTER BRAND DNA — photo-derived visual identity + full persona dossier.
  // This is the SOURCE OF TRUTH; the Blueprint must stay consistent with it.
  const bp = artistData.brandProfile;
  const id = bp?.identity;
  const brandDnaContext = bp
    ? `\n=== MASTER BRAND DNA (SOURCE OF TRUTH — derived from the artist's real profile photo) ===
Brand colors: primary ${bp.brandColors?.primary}, secondary ${bp.brandColors?.secondary}, accent ${bp.brandColors?.accent}
Visual style: ${bp.visualStyle}
Typography: ${bp.typography?.style}, ${bp.typography?.weight}, ${bp.typography?.mood}
Recurring motifs: ${(bp.motifs || []).join(', ')}
Mood keywords: ${(bp.moodKeywords || []).join(', ')}
Signature elements: ${bp.signatureElements}${id ? `
Tagline: ${id.tagline}
Persona: ${id.persona}
Origin: ${id.origin} | Era: ${id.era} | Languages: ${(id.languages || []).join(', ')}
Values: ${(id.values || []).join(', ')}
Primary genre: ${id.primaryGenre} | Sub-genres: ${(id.subGenres || []).join(', ')}
Influences: ${(id.influences || []).join(', ')} | Similar artists: ${(id.similarArtists || []).join(', ')}
Signature sound: ${id.signatureSound} | Instrumentation: ${(id.instrumentation || []).join(', ')} | Tempo: ${id.tempoRange}
Vocal style: ${id.vocalStyle} | Lyrical themes: ${(id.lyricalThemes || []).join(', ')}
Stage presence: ${id.stagePresence} | Performance: ${id.performanceStyle} | Live elements: ${(id.liveShowElements || []).join(', ')}
Fashion: ${id.fashionStyle} | Signature looks: ${(id.signatureLooks || []).join(', ')} | Accessories: ${(id.accessories || []).join(', ')} | Hair & grooming: ${id.hairAndGrooming}
Target audience: ${id.targetAudience} | Fanbase name: ${id.fanbaseName}
Tone of voice: ${id.toneOfVoice} | Content pillars: ${(id.contentPillars || []).join(', ')} | Slogans: ${(id.slogans || []).join(' / ')}` : ''}

IMPORTANT: Align the Blueprint with this Brand DNA. visual_universe.color_palette MUST use these exact brand colors; visual_universe.aesthetic/fashion_keywords/art_direction must match the visual style; identity, sound (vocal_style, bpm_range, sonic_influences, mood_keywords, lyric_themes), talent and audience modules must be CONSISTENT with the persona above. Use it as ground truth, then enrich with deeper strategic detail.`
    : '';

  const concertsContext = artistData.concerts
    ? (() => {
        const lines: string[] = [];
        if (artistData.concerts.upcoming?.length) {
          lines.push('Upcoming tours:');
          artistData.concerts.upcoming.slice(0, 3).forEach(t => lines.push(`  - ${t.tourName} @ ${t.location.venue}, ${t.location.city} (${t.date})`));
        }
        if (artistData.concerts.highlights?.length) {
          lines.push('Career highlights:');
          artistData.concerts.highlights.slice(0, 3).forEach(h => lines.push(`  - ${h.eventName} (${h.year}): ${h.note}`));
        }
        return lines.length ? lines.join('\n') : null;
      })()
    : null;

  const youtubeContext = artistData.topYoutubeVideos?.length
    ? artistData.topYoutubeVideos.slice(0, 5).map(v => `- ${v.title} (${v.type})`).join('\n')
    : null;

  return `Generate a complete Superstar Blueprint for the following REAL artist:

=== ARTIST DATA ===
ID: ${artistData.id}
Name: ${artistData.name}${artistData.realName ? `\nReal Name: ${artistData.realName}` : ''}
Biography: ${artistData.biography || 'No biography provided'}
Primary Genre(s): ${artistData.genres?.join(', ') || 'Unknown'}
Country: ${artistData.country || 'Unknown'}
City: ${artistData.location || 'Unknown'}
Type: ${artistData.isAIGenerated ? 'AI-Generated Artist' : 'Real Artist'}

=== SOCIAL PRESENCE & REAL METRICS ===
Instagram: ${artistData.instagramHandle ? `@${artistData.instagramHandle}` : 'Not set'}${artistData.instagramFollowers > 0 ? ` (${artistData.instagramFollowers.toLocaleString()} followers)` : ''}
Twitter/X: ${artistData.twitterHandle ? `@${artistData.twitterHandle}` : 'Not set'}
TikTok: ${artistData.tiktokUrl || 'Not set'}
Facebook: ${artistData.facebookUrl || 'Not set'}
YouTube: ${artistData.youtubeChannel || 'Not set'}${artistData.youtubeViews > 0 ? ` (${artistData.youtubeViews.toLocaleString()} total views)` : ''}
Spotify: ${artistData.spotifyUrl || 'Not set'}${artistData.spotifyFollowers > 0 ? ` (${artistData.spotifyFollowers.toLocaleString()} followers)` : ''}
Monthly Listeners: ${artistData.monthlyListeners > 0 ? artistData.monthlyListeners.toLocaleString() : 'Unknown'}
Playlist Placements: ${artistData.playlistPlacements > 0 ? artistData.playlistPlacements : 'None tracked'}
Total Engagement: ${artistData.totalEngagement > 0 ? artistData.totalEngagement.toLocaleString() : 'Unknown'}

=== REAL REVENUE DATA ===
Platform Earnings (all-time): $${artistData.totalEarnings.toFixed(2)}
Crowdfunding: ${artistData.crowdfundingBackers > 0 ? `$${artistData.crowdfundingTotal.toFixed(2)} from ${artistData.crowdfundingBackers} backers` : 'No campaigns yet'}
${youtubeContext ? `\n=== TOP YOUTUBE CONTENT ===\n${youtubeContext}` : ''}
${concertsContext ? `\n=== LIVE PERFORMANCE HISTORY ===\n${concertsContext}` : ''}

=== CATALOG (${artistData.songs.length} tracks) ===
${songsList}

=== MERCHANDISE (${artistData.merchItems.length} items) ===
${merchList}
${brandDnaContext}
${existingContext}

Return a JSON object with EXACTLY this structure. Fill ALL fields with rich, specific content tailored to THIS artist:

{
  "artist_dna": {
    "artist_id": "${artistData.id}",
    "artist_name": "${artistData.name}",
    "real_name": ${artistData.realName ? `"${artistData.realName}"` : 'null'},
    "artist_type": "solo",
    "primary_genre": "<primary genre from their catalog/bio>",
    "secondary_genres": ["<2-3 secondary genres>"],
    "nationality": "<country>",
    "city_of_origin": "<city, country>",
    "age_range": "<estimated age range>",
    "gender": "<male|female|non-binary>",
    "career_stage": "<emerging|developing|established|superstar>",
    "career_start_year": <year as integer>,
    "brand_essence": "<10-word brand essence distilled from their data>",
    "tagline": "<memorable 5-8 word tagline for this artist>"
  },
  "identity": {
    "brand_archetype": "<one of: Visionary Creator, Street Poet, Dark Prince, Pop Icon, Genre Defier, Global Connector, Party King, Soul Healer, Rebel Leader, Trap King>",
    "personality_traits": ["<5 specific traits matching their bio/music>"],
    "communication_style": "<casual|poetic|cryptic|energetic|philosophical>",
    "social_media_voice": "<how they sound on social media, 1 sentence>",
    "visual_signature": "<their visual signature — e.g., 'always wears black with gold chains'>",
    "unique_value_proposition": "<what makes them irreplaceable in the industry, 1-2 sentences>",
    "audience_connection_style": "<how they connect with fans emotionally>"
  },
  "talent": {
    "primary_talent": "<singing|rapping|producing|songwriting|multi-instrument>",
    "secondary_talents": ["<2-3 secondary talents>"],
    "vocal_range": "<bass|baritone|tenor|alto|mezzo-soprano|soprano|not applicable>",
    "live_performance_style": "<description of their live show energy>",
    "dance_ability": "<minimal|intermediate|professional|world-class>",
    "instrumental_skills": ["<instruments they play, or empty array>"],
    "production_involvement": "<hands-off|collaborative|co-producer|self-producer>",
    "development_focus": ["<3-4 areas to develop in next 12 months>"]
  },
  "sound": {
    "primary_genre": "<their main genre>",
    "sub_genres": ["<2-3 sub-genres>"],
    "bpm_range": { "min": <integer>, "max": <integer> },
    "key_signatures": ["<2-3 preferred keys like Am, Em, C>"],
    "vocal_style": "<detailed vocal style description>",
    "production_style": "<detailed production aesthetic description>",
    "sonic_influences": ["<4-5 real artist influences matching their genre>"],
    "mood_keywords": ["<5-6 mood keywords for song generation AI>"],
    "lyric_themes": ["<4-6 lyric theme categories>"],
    "signature_sound": "<1-2 sentences describing their unique sonic fingerprint>",
    "hit_formula": "<their proven or potential hit formula, 1 sentence>",
    "hit_potential_score": <integer 0-100>
  },
  "catalog": {
    "total_tracks": ${artistData.songs.length},
    "main_single": "${artistData.songs[0]?.title || null}",
    "tracklist": [${artistData.songs.slice(0, 10).map(s => `{"title": "${s.title.replace(/"/g, '\\"')}", "mood": "${s.mood || 'energetic'}", "status": "released"}`).join(', ')}],
    "unreleased_concepts": ["<2-3 concept track ideas that fit their sound>"],
    "era_concept": "<creative concept name for their current music era>",
    "next_release_strategy": "<recommended release strategy for next single/album>"
  },
  "visual_universe": {
    "aesthetic": "<one-word core aesthetic — e.g., Dark Futurism, Tropical Noir>",
    "color_palette": ["#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB"],
    "palette_name": "<creative palette name>",
    "fashion_keywords": ["<4-5 fashion descriptors>"],
    "cinematic_style": "<reference cinematographers or film directors who match their vibe>",
    "art_direction_brief": "<100-word art direction brief for all visual content>",
    "logo_concept": "<logo design concept description>",
    "cover_art_direction": "<how their album/single covers should look, 2-3 sentences>",
    "video_style": "<music video visual direction>",
    "photography_direction": "<photo shoot direction for press/promo shots>"
  },
  "performance": {
    "show_type": "<intimate|club|arena|festival|stadium>",
    "stage_presence": "<description of how they command a stage>",
    "setlist_strategy": "<how to structure their live set>",
    "touring_capacity": "<local|regional|national|international>",
    "live_production_elements": ["<3-5 production elements: lighting, pyro, dancers, screens, etc.>"],
    "performance_rituals": ["<2-3 signature performance moments>"],
    "crowd_engagement_tactics": ["<3-4 specific tactics to get crowd involved>"]
  },
  "launch_campaign": {
    "campaign_name": "<creative campaign name for their next release>",
    "campaign_concept": "<campaign creative concept, 2-3 sentences>",
    "target_audience": {
      "primary": "<age range + lifestyle description>",
      "secondary": "<secondary audience description>",
      "psychographics": ["<3-4 psychographic descriptors>"]
    },
    "key_messages": ["<3-4 core messages this campaign communicates>"],
    "platform_strategy": {
      "instagram": "<strategy for Instagram>",
      "tiktok": "<strategy for TikTok>",
      "youtube": "<strategy for YouTube>",
      "spotify": "<strategy for Spotify>",
      "twitter": "<strategy for Twitter/X>"
    },
    "content_calendar_weeks": 6,
    "launch_sequence": ["<week-by-week launch sequence, 6 steps>"],
    "kpis": {
      "stream_target_30d": <integer>,
      "follower_growth_target": <integer>,
      "playlist_placements_target": <integer>,
      "press_features_target": <integer>
    }
  },
  "distribution": {
    "primary_platforms": ["<top 3 distribution platforms>"],
    "secondary_platforms": ["<2-3 secondary platforms>"],
    "release_frequency": "<weekly|bi-weekly|monthly|quarterly>",
    "playlist_targets": ["<4-5 specific playlist names to target>"],
    "sync_licensing_focus": ["<3-4 sync licensing categories: TV, ads, film, etc.>"],
    "international_markets": ["<3-5 international markets to target>"],
    "distribution_strategy": "<overall distribution and release strategy, 2 sentences>"
  },
  "fanbase": {
    "total_estimated_fans": <integer>,
    "fan_segments": [
      { "name": "<segment name>", "percentage": <integer 0-100>, "behavior": "<how they engage>" },
      { "name": "<segment name>", "percentage": <integer 0-100>, "behavior": "<how they engage>" },
      { "name": "<segment name>", "percentage": <integer 0-100>, "behavior": "<how they engage>" }
    ],
    "engagement_tactics": ["<4-5 specific tactics to grow engagement>"],
    "community_name": "<name for their fanbase community>",
    "fan_activation_sequence": ["<4-step fan activation plan>"],
    "crm_strategy": "<CRM and fan data collection strategy>"
  },
  "pr_narrative": {
    "press_headline": "<the single most powerful press headline for this artist right now>",
    "origin_story": "<2-3 sentences about their authentic origin story>",
    "breakthrough_moment": "<the defining moment that changed their trajectory>",
    "current_chapter": "<what the press should cover about them NOW>",
    "media_angles": ["<4-5 strong media story angles>"],
    "controversy_protection": ["<2-3 rules to protect their reputation>"],
    "press_contact_strategy": "<who to pitch, what publications, in what order>",
    "speaking_points": ["<4-5 key speaking points for interviews>"]
  },
  "monetization": {
    "revenue_model": "<streaming-first|live-first|merch-first|brand-deals-first|diversified>",
    "revenue_pillars": ["<5-6 revenue streams ranked by priority>"],
    "merch_products": [${artistData.merchItems.slice(0, 5).map(m => `{"name": "${(m.name ?? m.category ?? 'Merch Item').replace(/"/g, '\\"')}", "type": "${m.category || 'apparel'}", "price_usd": ${m.price ? parseFloat(m.price) : 35}}`).join(', ')}${artistData.merchItems.length < 3 ? (artistData.merchItems.length > 0 ? ', ' : '') + '{"name": "Signature Hoodie", "type": "apparel", "price_usd": 65}, {"name": "Limited Edition Poster", "type": "print", "price_usd": 25}' : ''}],
    "streaming_targets": {
      "monthly_listeners_target": <integer>,
      "spotify_followers_target": <integer>,
      "youtube_subscribers_target": <integer>
    },
    "brand_partnership_targets": ["<3-4 specific brand categories or companies to target>"],
    "ticket_price_range": { "min": <integer>, "max": <integer> },
    "nft_strategy": "<NFT/digital collectibles strategy for this artist>",
    "projected_year1_revenue_usd": <integer>,
    "value_protection_rules": ["<3-4 rules to avoid overexposure and protect brand value>"]
  },
  "era_evolution": {
    "current_era": "<creative era name, e.g. 'The Genesis Era', 'Dark Summer Era'>",
    "era_concept": "<2-3 sentences describing the current era's creative concept>",
    "era_duration_months": <integer 6-18>,
    "era_milestones": ["<4-5 specific milestones to achieve in this era>"],
    "next_era_concept": "<brief concept for what comes after this era>",
    "evolution_triggers": ["<2-3 events that would signal it's time to evolve>"],
    "legacy_vision": "<what this artist's legacy looks like in 10 years, 2 sentences>"
  },
  "_meta": {
    "schema_version": "2.0",
    "generated_at": "${new Date().toISOString()}",
    "artist_id": ${artistData.id},
    "global_artist_score": <integer 0-100, honest assessment of current commercial potential>,
    "next_actions": ["<5 most important things to do in the next 30 days>"],
    "agents": {
      "news_brief": "<1-2 sentences briefing the news AI on what news to create>",
      "content_brief": "<1-2 sentences briefing the content AI on social posts>",
      "merch_brief": "<1-2 sentences briefing the merch AI on design direction>",
      "song_brief": "<1-2 sentences briefing the song AI on next track>",
      "campaign_brief": "<1-2 sentences briefing the campaign AI on next push>",
      "visual_brief": "<1-2 sentences briefing the visual AI on images and videos>"
    }
  },
  "iconic_identity": {
    "silhouette_description": "<describe the artist's iconic silhouette in 10-15 words — clothing item, hat, coat, posture that makes them instantly recognizable>",
    "signature_gesture": "<one specific physical gesture or movement the artist always performs — exact and memorable>",
    "dominant_color": "<a specific color or hex code that is this artist's visual signature>",
    "walk_style": "<exactly 3 words describing their walk — e.g. 'deliberate elegant controlled'>",
    "verbal_mark": "<a phrase, word, or sound the artist always uses — their verbal signature>",
    "emotional_wound": "<in one sentence: the core pain or experience that fuels their art>",
    "social_message": "<in one sentence: the deeper cultural or human message behind their music>",
    "tenderness_quotient": <integer 0-100, how human and vulnerable the artist feels to audiences>,
    "universal_emotion": "<one word: the primary universal emotion this artist embodies — longing|ambition|tenderness|defiance|joy|grief|desire|freedom|belonging|rage>",
    "emotional_studio_score": <integer 0-100, overall emotional depth and identity strength score>
  }
}`;
}

// ─── Main generator function ──────────────────────────────────────────────────

export async function generateArtistBlueprint(artistId: number): Promise<ArtistBlueprintData> {
  // 1. Fetch all artist data from PostgreSQL
  const artistRows = await pgDb
    .select()
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);

  if (artistRows.length === 0) {
    throw new Error(`Artist with id ${artistId} not found`);
  }

  const artist = artistRows[0];

  // 2. Fetch songs — full fields including analysis pipeline and plays
  const artistSongs = await pgDb
    .select({
      title: songs.title,
      genre: songs.genre,
      mood: songs.mood,
      plays: songs.plays,
      lyrics: songs.lyrics,
      analysisJson: songs.analysisJson,
      analysisStatus: songs.analysisStatus,
    })
    .from(songs)
    .where(eq(songs.userId, artistId))
    .orderBy(desc(songs.plays))
    .limit(20);

  // 3. Fetch merch
  const artistMerch = await pgDb
    .select({ name: merchandise.name, category: merchandise.category, price: merchandise.price })
    .from(merchandise)
    .where(and(
      eq(merchandise.userId, artistId),
      eq(merchandise.productStatus, 'active')
    ))
    .limit(10);

  // 4. Fetch real marketing metrics (social followers, streams)
  const [metricsRow] = await pgDb
    .select()
    .from(marketingMetrics)
    .where(eq(marketingMetrics.userId, artistId))
    .limit(1);

  // 5. Fetch wallet earnings
  const [walletRow] = await pgDb
    .select({ totalEarnings: artistWallet.totalEarnings })
    .from(artistWallet)
    .where(eq(artistWallet.userId, artistId))
    .limit(1);

  // 6. Fetch crowdfunding data
  const crowdfundingRows = await pgDb
    .select({
      currentAmount: crowdfundingCampaigns.currentAmount,
      contributorsCount: crowdfundingCampaigns.contributorsCount,
      isActive: crowdfundingCampaigns.isActive,
    })
    .from(crowdfundingCampaigns)
    .where(eq(crowdfundingCampaigns.userId, artistId))
    .limit(5);

  const crowdfundingTotal = crowdfundingRows.reduce((sum, r) => sum + parseFloat(r.currentAmount?.toString() || '0'), 0);
  const crowdfundingBackers = crowdfundingRows.reduce((sum, r) => sum + (r.contributorsCount || 0), 0);

  // 6b. Load the artist's MASTER BRAND DNA (photo-derived visual identity + persona).
  // This is the single source of truth that keeps the Blueprint's visual_universe,
  // identity and sound modules consistent with every other module on the platform.
  // READ-ONLY: we never trigger a (slow, vision-based) brand-profile generation
  // inside the blueprint critical path — if it isn't generated yet the blueprint
  // simply proceeds without the DNA block (as it did before this integration).
  let brandProfile: ArtistBrandProfile | null = null;
  try {
    brandProfile = await loadBrandProfile(artistId);
  } catch (err: any) {
    console.warn('[blueprint-generator] Brand profile load failed (continuing without DNA):', err?.message || err);
  }

  // 7. Build enriched prompt context
  const artistContext = {
    id: artist.id,
    name: artist.artistName || 'Unknown Artist',
    biography: artist.biography,
    genres: artist.genres,
    country: artist.country,
    location: artist.location,
    realName: artist.realName,
    instagramHandle: artist.instagramHandle,
    twitterHandle: artist.twitterHandle,
    youtubeChannel: artist.youtubeChannel,
    spotifyUrl: artist.spotifyUrl,
    facebookUrl: artist.facebookUrl,
    tiktokUrl: artist.tiktokUrl,
    isAIGenerated: artist.isAIGenerated,
    existingMasterJson: artist.masterJson as Record<string, unknown> | null,
    concerts: artist.concerts as { upcoming?: Array<{ tourName: string; location: { city: string; country: string; venue: string }; date: string }>; highlights?: Array<{ eventName: string; year: number; note: string }> } | null,
    topYoutubeVideos: artist.topYoutubeVideos as Array<{ title: string; url: string; type: string }> | null,
    // Real stats
    spotifyFollowers: metricsRow?.spotifyFollowers ?? 0,
    instagramFollowers: metricsRow?.instagramFollowers ?? 0,
    youtubeViews: metricsRow?.youtubeViews ?? 0,
    monthlyListeners: metricsRow?.monthlyListeners ?? 0,
    playlistPlacements: metricsRow?.playlistPlacements ?? 0,
    totalEngagement: metricsRow?.totalEngagement ?? 0,
    totalEarnings: parseFloat(walletRow?.totalEarnings?.toString() || '0'),
    crowdfundingTotal,
    crowdfundingBackers,
    // Enriched catalog
    songs: artistSongs.map(s => {
      const analysis = s.analysisJson as Record<string, unknown> | null;
      return {
        title: s.title,
        genre: s.genre,
        mood: s.mood,
        plays: s.plays ?? 0,
        analysisReady: s.analysisStatus === 'ready',
        bpm: analysis?.bpm as number | undefined,
        key: analysis?.key as string | undefined,
        lyricsSnippet: s.lyrics ? s.lyrics.substring(0, 120) : null,
      };
    }),
    merchItems: artistMerch.map(m => ({ name: m.name, category: m.category, price: m.price?.toString() || null })),
    brandProfile,
  };

  // 8. Call AI via smart router (cascade: claude-3.5-sonnet → gemini-2.5-pro → gpt-4o)
  const baseSystemPrompt = buildBlueprintSystemPrompt();
  const systemPrompt = await buildEnrichedSystemPrompt('artist-blueprint', baseSystemPrompt, artistId);
  const userPrompt = buildBlueprintUserPrompt(artistContext);

  let rawJson: string;
  try {
    rawJson = await callAI(
      'blueprint',
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.7, maxTokens: 4000, label: 'artist-blueprint-generator' }
    );
  } catch (err) {
    console.error('[blueprint-generator] All AI models failed:', err);
    rawJson = buildFallbackBlueprint(artistContext);
  }

  // 9. Parse and validate
  let blueprint: ArtistBlueprintData;
  try {
    const parsed = JSON.parse(rawJson);
    blueprint = (parsed && typeof parsed === 'object') ? parsed as ArtistBlueprintData : JSON.parse(buildFallbackBlueprint(artistContext)) as ArtistBlueprintData;
  } catch (parseErr) {
    console.error('[blueprint-generator] JSON parse error, using fallback');
    blueprint = JSON.parse(buildFallbackBlueprint(artistContext)) as ArtistBlueprintData;
  }

  // 10. Ensure _meta is present with minimal required fields
  if (!blueprint._meta) {
    blueprint._meta = {
      schema_version: '2.0',
      generated_at: new Date().toISOString(),
      artist_id: artistId,
      global_artist_score: 50,
      next_actions: ['Set up all social media handles', 'Release first single', 'Build press kit'],
      agents: {
        news_brief: `Cover ${artist.artistName}'s latest moves in the music industry.`,
        content_brief: `Create engaging posts that showcase ${artist.artistName}'s personality and music.`,
        merch_brief: `Design merch that reflects the artist's visual DNA.`,
        song_brief: `Produce tracks that match the artist's signature sound.`,
        campaign_brief: `Launch a campaign to grow the artist's digital presence.`,
        visual_brief: `Create visuals that are consistent with the artist's aesthetic.`,
      },
    };
  }

  // Ensure artist_id is set
  blueprint._meta.artist_id = artistId;

  return blueprint;
}

// ─── Fallback blueprint ───────────────────────────────────────────────────────

function buildFallbackBlueprint(artist: {
  id: number;
  name: string;
  biography: string | null;
  genres: string[] | null;
  country: string | null;
  songs: Array<{ title: string; genre: string | null; mood: string | null }>;
  merchItems: Array<{ name: string; category: string | null; price: string | null }>;
}): string {
  const genre = artist.genres?.[0] || 'Pop';
  const name = artist.name;
  return JSON.stringify({
    artist_dna: {
      artist_id: String(artist.id),
      artist_name: name,
      real_name: null,
      artist_type: 'solo',
      primary_genre: genre,
      secondary_genres: ['Alternative', 'Electronic'],
      nationality: artist.country || 'International',
      city_of_origin: 'Los Angeles, USA',
      age_range: '22-28',
      gender: 'unspecified',
      career_stage: 'emerging',
      career_start_year: new Date().getFullYear(),
      brand_essence: `${name} redefines ${genre} with authentic storytelling`,
      tagline: `${name} — Sound the World Hasn't Heard Yet`,
    },
    identity: {
      brand_archetype: 'Visionary Creator',
      personality_traits: ['authentic', 'creative', 'driven', 'raw', 'visionary'],
      communication_style: 'casual',
      social_media_voice: 'Unfiltered and direct with a poetic edge',
      visual_signature: 'Clean lines with bold accents',
      unique_value_proposition: `${name} blends authenticity with commercial appeal in a way no one else does.`,
      audience_connection_style: 'Through raw emotion and relatable storytelling',
    },
    talent: {
      primary_talent: 'singing',
      secondary_talents: ['songwriting', 'production'],
      vocal_range: 'tenor',
      live_performance_style: 'High-energy with intimate moments',
      dance_ability: 'intermediate',
      instrumental_skills: [],
      production_involvement: 'collaborative',
      development_focus: ['Live performance', 'Social media presence', 'Studio production', 'Brand building'],
    },
    sound: {
      primary_genre: genre,
      sub_genres: ['Alternative Pop', 'Indie'],
      bpm_range: { min: 85, max: 130 },
      key_signatures: ['Am', 'Em', 'Dm'],
      vocal_style: 'Smooth with emotive delivery and dynamic range',
      production_style: 'Layered synths with live drums and organic elements',
      sonic_influences: ['The Weeknd', 'Frank Ocean', 'Billie Eilish', 'Drake'],
      mood_keywords: ['introspective', 'cinematic', 'vibrant', 'raw', 'euphoric'],
      lyric_themes: ['Love and relationships', 'Self-discovery', 'Success', 'Night life', 'Authenticity'],
      signature_sound: `${name}'s sound is defined by the intersection of emotional depth and sonic boldness`,
      hit_formula: 'Anthemic chorus with a vulnerable verse and a drop that hits like therapy',
      hit_potential_score: 72,
    },
    catalog: {
      total_tracks: artist.songs.length,
      main_single: artist.songs[0]?.title || null,
      tracklist: artist.songs.slice(0, 10).map(s => ({
        title: s.title,
        mood: s.mood || 'energetic',
        status: 'released',
      })),
      unreleased_concepts: ['Night Drive (featuring production collab)', 'Rebirth (acoustic version)', 'No Filter (raw EP)'],
      era_concept: 'The Genesis Era — introducing the world to the real artist',
      next_release_strategy: 'Single-first with 3-week campaign then EP drop',
    },
    visual_universe: {
      aesthetic: 'Urban Minimalism',
      color_palette: ['#0A0A0A', '#1C1C1E', '#F5F5F0', '#C0A080'],
      palette_name: 'Midnight Gold',
      fashion_keywords: ['minimal', 'luxury streetwear', 'monochromatic', 'statement pieces'],
      cinematic_style: 'Roger Deakins meets Hype Williams',
      art_direction_brief: `All visual content for ${name} should feel like a luxury fashion editorial. Dark backgrounds, dramatic lighting, gold accents. Every image should feel like it belongs in a museum or a magazine cover.`,
      logo_concept: 'Clean typographic logo in a custom serif font with gold detail',
      cover_art_direction: 'Stark, high-contrast photography with minimal text — the artist IS the artwork',
      video_style: 'Cinematic single-location videos with exceptional lighting',
      photography_direction: 'Studio controlled with dramatic lighting and strong shadow play',
    },
    performance: {
      show_type: 'club',
      stage_presence: 'Commands attention through stillness and then explosive movement',
      setlist_strategy: 'Open with newest single, build to catalog highlights, close with anthem',
      touring_capacity: 'regional',
      live_production_elements: ['LED backdrop', 'Atmospheric haze', 'Spotlight effects', 'Live drummer'],
      performance_rituals: ['Opening speech to the crowd', 'Signature dance break', 'Fan interaction moment'],
      crowd_engagement_tactics: ['Call and response', 'Dedicated fan songs', 'Social media challenges at shows'],
    },
    launch_campaign: {
      campaign_name: `${name}: The Arrival`,
      campaign_concept: `A multi-platform rollout that builds mystery and anticipation before dropping the single with maximum impact. The campaign uses cryptic teasers, behind-the-scenes content, and a press push to establish ${name} as a major new force.`,
      target_audience: {
        primary: '18-28 year olds, urban/suburban, music-obsessed early adopters',
        secondary: '28-35 year olds, cultural tastemakers, playlist curators',
        psychographics: ['music as identity', 'authenticity seekers', 'trend adopters', 'digital natives'],
      },
      key_messages: [
        `${name} is the artist you've been waiting for`,
        'Authentic music for authentic people',
        'The new sound is here',
        'No compromise, no filter',
      ],
      platform_strategy: {
        instagram: '3 posts per week — editorial photos, reels, story Q&As',
        tiktok: '5 short videos per week — sounds, challenges, BTS moments',
        youtube: '1 music video + 2 short-form per month',
        spotify: 'Pitch to editorial playlists, consistent release schedule',
        twitter: 'Daily engagement, cryptic quotes, retweets of fan content',
      },
      content_calendar_weeks: 6,
      launch_sequence: [
        'Week 1: Cryptic teaser posts + behind-the-scenes snippets',
        'Week 2: Artist introduction content + press release',
        'Week 3: Single artwork reveal + pre-save campaign',
        'Week 4: Single release + music video drop',
        'Week 5: Media interviews + playlist push',
        'Week 6: Fan engagement + announce next release',
      ],
      kpis: {
        stream_target_30d: 100000,
        follower_growth_target: 5000,
        playlist_placements_target: 10,
        press_features_target: 3,
      },
    },
    distribution: {
      primary_platforms: ['Spotify', 'Apple Music', 'YouTube Music'],
      secondary_platforms: ['Tidal', 'Amazon Music', 'SoundCloud'],
      release_frequency: 'monthly',
      playlist_targets: [
        'New Music Friday',
        'Fresh Finds',
        `${genre} Hits`,
        'Emerging Artists',
        'Today\'s Top Hits (long-term goal)',
      ],
      sync_licensing_focus: ['TV Drama', 'Fashion Ads', 'Sports Highlights', 'Film Trailers'],
      international_markets: ['USA', 'UK', 'Mexico', 'Brazil', 'Germany'],
      distribution_strategy: 'Release consistently to build algorithmic momentum, pitch to curators for each release, invest in sync licensing for passive income',
    },
    fanbase: {
      total_estimated_fans: Math.max(100, artist.songs.length * 500),
      fan_segments: [
        { name: 'Core Fans', percentage: 15, behavior: 'Buy merch, attend shows, share all content' },
        { name: 'Active Followers', percentage: 40, behavior: 'Stream regularly, engage on social' },
        { name: 'Casual Listeners', percentage: 45, behavior: 'Stream occasionally, discover through playlists' },
      ],
      engagement_tactics: [
        'Weekly behind-the-scenes stories',
        'Fan art repost campaigns',
        'Exclusive Discord/community for core fans',
        'Personalized birthday messages to top fans',
      ],
      community_name: `The ${name.split(' ')[0]} Fam`,
      fan_activation_sequence: [
        'Follow on all platforms',
        'Join mailing list for exclusive content',
        'Join fan community (Discord/Telegram)',
        'Become a superfan with merch purchase',
      ],
      crm_strategy: 'Collect email addresses through free download or exclusive content gates, segment fans by engagement level',
    },
    pr_narrative: {
      press_headline: `${name} Is the Artist Every Label Should Have Signed Yesterday`,
      origin_story: `${name} grew up surrounded by music but took an unconventional path to the industry. Their story is one of persistence, self-belief, and refusing to compromise on the vision.`,
      breakthrough_moment: 'The viral moment when their raw demo recording spread across the internet, proving the world was ready for something real',
      current_chapter: `${name} is releasing new music and building a following the right way — organically, honestly, and with purpose`,
      media_angles: [
        'The independent artist taking on the machine',
        `How ${name} is redefining ${genre} for a new generation`,
        'Behind the music: the real story of an emerging superstar',
        'Why ${name} is the most important new artist you haven\'t heard yet',
      ],
      controversy_protection: [
        'Avoid political statements that could alienate fans',
        'Protect private life — family and relationships are off-limits',
        'Never speak negatively about other artists publicly',
      ],
      press_contact_strategy: 'Start with music blogs and local press, build to regional media, then pitch to national outlets with a hot story',
      speaking_points: [
        `I make music for people who feel things deeply`,
        'Authenticity is the only sustainable strategy',
        `I want my music to outlive this moment`,
        'The industry needs more truth-tellers',
      ],
    },
    monetization: {
      revenue_model: 'streaming-first',
      revenue_pillars: [
        'Streaming royalties',
        'Live performance fees',
        'Merchandise sales',
        'Brand partnerships',
        'Sync licensing',
        'Fan subscriptions',
      ],
      merch_products: artist.merchItems.length > 0
        ? artist.merchItems.slice(0, 5).map(m => ({
            name: m.name,
            type: m.category || 'apparel',
            price_usd: m.price ? parseFloat(m.price) : 35,
          }))
        : [
            { name: 'Signature Hoodie', type: 'apparel', price_usd: 65 },
            { name: 'Limited Edition Poster', type: 'print', price_usd: 25 },
            { name: 'Logo Cap', type: 'accessories', price_usd: 35 },
          ],
      streaming_targets: {
        monthly_listeners_target: 50000,
        spotify_followers_target: 10000,
        youtube_subscribers_target: 5000,
      },
      brand_partnership_targets: ['Streetwear brands', 'Headphone/audio brands', 'Energy drinks', 'Sneaker companies'],
      ticket_price_range: { min: 15, max: 50 },
      nft_strategy: 'Launch limited edition digital collectibles tied to unreleased content and special access',
      projected_year1_revenue_usd: 15000,
      value_protection_rules: [
        'Never give music away for free on low-value platforms',
        'Limit free social content to 70% — keep 30% exclusive',
        'Do not accept brand deals that conflict with artistic values',
        'Maintain at least 6 weeks between major releases to avoid oversaturation',
      ],
    },
    era_evolution: {
      current_era: 'The Genesis Era',
      era_concept: `The Genesis Era is about introduction and establishment. ${name} is showing the world who they are with no filter. Every release, every post, every show builds the foundation of an undeniable brand.`,
      era_duration_months: 12,
      era_milestones: [
        'Release debut single with 100K streams',
        'Build to 10K followers on primary social platform',
        'Play first headline show',
        'Secure first press feature in major publication',
        'Release debut EP',
      ],
      next_era_concept: 'The Ascension Era — where the world realizes this artist is here to stay',
      evolution_triggers: [
        'First song hits 1M streams',
        'Significant media coverage from major outlets',
        'Album/EP fully ready for release',
      ],
      legacy_vision: `In 10 years, ${name} will be seen as one of the defining artists of their generation — someone who stayed true to their vision and changed the culture because of it.`,
    },
    _meta: {
      schema_version: '2.0',
      generated_at: new Date().toISOString(),
      artist_id: artist.id,
      global_artist_score: 65,
      next_actions: [
        'Complete all social media profiles with consistent branding',
        'Record and release next single with a 6-week campaign',
        'Book first 3 live shows',
        'Send music to 20 playlist curators',
        'Partner with a photographer for a proper press shoot',
      ],
      agents: {
        news_brief: `Create news about ${name}'s latest release, upcoming shows, and artistic vision. Focus on the authenticity and uniqueness of their sound.`,
        content_brief: `Create ${name} social posts that are raw and authentic. Mix personal moments with music promotion. Engage the community with questions and challenges.`,
        merch_brief: `Design ${name} merch that is minimal, luxury-feeling, and rooted in their visual aesthetic. Focus on wearability and premium materials.`,
        song_brief: `Produce tracks for ${name} in the ${genre} genre. Emotional verses, anthemic choruses, production that's polished but not over-produced.`,
        campaign_brief: `Build awareness campaigns for ${name} focused on authenticity and music quality. Let the music speak first, build narrative around real moments.`,
        visual_brief: `All visuals for ${name} should be cinematic, high-contrast, and feel like art. Avoid over-editing — raw beauty is the goal.`,
      },
    },
  });
}

// ─── Agent brief helper ───────────────────────────────────────────────────────
// Use this in downstream routes (news, content, song) to inject blueprint context

type AgentBriefKey = keyof ArtistBlueprintData['_meta']['agents'];

export async function getBlueprintBrief(artistId: number, briefType: AgentBriefKey): Promise<string | null> {
  try {
    const [row] = await pgDb
      .select({ blueprintJson: artistBlueprints.blueprintJson, generationStatus: artistBlueprints.generationStatus })
      .from(artistBlueprints)
      .where(eq(artistBlueprints.artistId, artistId))
      .limit(1);

    if (!row || row.generationStatus !== 'completed') return null;
    const bp = row.blueprintJson as Record<string, unknown> | null;
    if (!bp) return null;
    const meta = bp._meta as Record<string, unknown> | undefined;
    const agents = meta?.agents as Record<string, string> | undefined;
    return agents?.[briefType] ?? null;
  } catch {
    return null;
  }
}
