import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { isAuthenticated } from '../middleware/clerk-auth';
import { getUserId } from '../middleware/clerk-auth';
import { db } from '../db';
import { legacyCatalogResearch } from '../../db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { matchSongAcrossPlatforms, type CrossPlatformResult, type PlatformMatch } from '../services/cross-platform-matching';

const router = Router();
// This engine contains private catalog research and generated rights materials.
// Enforce auth here as well as at the page gate; global Clerk middleware only
// attaches the current user and does not reject anonymous API requests.
router.use(isAuthenticated);

const briefPdfPath = path.resolve(process.cwd(), 'public/assets/Boostify_Catalog_Resurrection.pdf');
// Persistent file cache — survives server restarts; images are uploaded to Firebase so URLs never expire
const VISUALS_CACHE_PATH = path.resolve(process.cwd(), 'public/assets/catalog-resurrection-visuals.json');
let visualsGenerationInProgress = false;
let researchTableReady: Promise<void> | null = null;

async function ensureResearchTable() {
  if (!researchTableReady) {
    researchTableReady = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS legacy_catalog_research (
        id SERIAL PRIMARY KEY,
        clerk_user_id VARCHAR(255) NOT NULL,
        kind VARCHAR(32) NOT NULL,
        query JSONB,
        analysis JSONB,
        artifact JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS legacy_catalog_research_user_created_idx ON legacy_catalog_research (clerk_user_id, created_at DESC)`);
    })().catch((error) => {
      researchTableReady = null;
      throw error;
    });
  }
  await researchTableReady;
}

function readPersistedVisuals(): { background: any; visuals: any[] } | null {
  try {
    if (fs.existsSync(VISUALS_CACHE_PATH)) {
      const data = JSON.parse(fs.readFileSync(VISUALS_CACHE_PATH, 'utf8'));
      if (data?.visuals?.length > 0 && data?.background?.imageUrl) return data;
    }
  } catch {}
  return null;
}

function writePersistedVisuals(data: { background: any; visuals: any[] }) {
  try {
    fs.mkdirSync(path.dirname(VISUALS_CACHE_PATH), { recursive: true });
    fs.writeFileSync(VISUALS_CACHE_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log('[LegacyCatalogResurrection] Visuals saved to disk:', VISUALS_CACHE_PATH);
  } catch (e) {
    console.warn('[LegacyCatalogResurrection] Could not write visuals cache:', e);
  }
}

// Kick off generation in background if cache is missing — called once on server start
async function ensureVisualsGenerated() {
  if (readPersistedVisuals()) return; // already cached
  if (visualsGenerationInProgress) return;
  visualsGenerationInProgress = true;
  console.log('[LegacyCatalogResurrection] No cached visuals found — starting background generation with Flux Pro Kontext...');
  try {
    const response = await buildVisualGenerationResponse('legacy soul catalog', 'archive artist');
    if (!response?.fallback && response?.visuals?.length > 0) {
      writePersistedVisuals({ background: response.background, visuals: response.visuals });
    } else {
      console.warn('[LegacyCatalogResurrection] Generation returned fallback, will retry on next request.');
    }
  } catch (e) {
    console.error('[LegacyCatalogResurrection] Background generation failed:', e);
  } finally {
    visualsGenerationInProgress = false;
  }
}

// Start generation after a short delay so the server finishes booting first
setTimeout(ensureVisualsGenerated, 5000);

const archiveBackground = {
  id: 'catalog-ready-hero-background',
  title: 'Archive Resurrection Background',
  prompt: 'Full-bleed cinematic music catalog resurrection archive, vintage master tapes, vinyl lacquer discs, museum catalog drawers',
  imageUrl: '/restoraction/lGIKCxZ0YRg_erD6tJGbi_56e9766019154d34923306ebfc756e82.jpg',
  provider: 'curated-archive-fallback',
};

const archiveVisuals = [
  {
    id: 'vault-console',
    title: 'Vault Console',
    prompt: 'Premium music archive control room with analog tape reels, catalog cards, amber glass, cinematic editorial lighting',
    imageUrl: '/restoraction/FLwRoyboP40R-A6q46NbH_11d6fe955148489d97a89d6ac6a6367b.jpg',
    provider: 'curated-archive-visual',
  },
  {
    id: 'lacquer-room',
    title: 'Lacquer Room',
    prompt: 'Close-up of vintage vinyl masters and handwritten metadata cards in a luxury restoration lab',
    imageUrl: '/restoraction/j976BmLltlMcbb-cPScOW_6599e86a4b794d549ebce7ea24eb06b7.jpg',
    provider: 'curated-archive-visual',
  },
  {
    id: 'rights-ledger',
    title: 'Rights Ledger',
    prompt: 'Museum-grade music catalog archive with rights ledgers, gold dividers, and digital scan overlays',
    imageUrl: '/restoraction/lMajT7_qGBXNZaHTWulg5_a30e087828ee4aa89c1a9defb1945f59.jpg',
    provider: 'curated-archive-visual',
  },
];

const fallbackTracks = [
  {
    id: 'demo-a1',
    title: 'My Girl',
    artistName: 'The Temptations',
    era: '1960s soul',
    releaseDate: '1964-12-21',
    archiveId: 'BCR-DEMO-064',
    rightsStatus: 'Needs master + publishing verification',
    revivalScore: 94,
    syncFit: 'Family film, luxury nostalgia campaign, sports documentary',
    imageUrl: '/restoraction/FLwRoyboP40R-A6q46NbH_11d6fe955148489d97a89d6ac6a6367b.jpg',
  },
  {
    id: 'demo-b2',
    title: 'Basement Tape No. 7',
    artistName: 'Unattributed house band',
    era: '1970s funk vault',
    releaseDate: '1973-05-14',
    archiveId: 'VAULT-FUNK-073',
    rightsStatus: 'Estate outreach required',
    revivalScore: 87,
    syncFit: 'Streetwear drop, car launch, limited vinyl pressing',
    imageUrl: '/restoraction/j976BmLltlMcbb-cPScOW_6599e86a4b794d549ebce7ea24eb06b7.jpg',
  },
  {
    id: 'demo-c3',
    title: 'Midnight Side B',
    artistName: 'Legacy vocal group',
    era: '1980s quiet storm',
    releaseDate: '1982-10-02',
    archiveId: 'CAT-RNB-182',
    rightsStatus: 'Cleared for research pitch',
    revivalScore: 81,
    syncFit: 'Streaming playlist revival, boutique hotel licensing',
    imageUrl: '/restoraction/lMajT7_qGBXNZaHTWulg5_a30e087828ee4aa89c1a9defb1945f59.jpg',
  },
];

function yearFromRelease(releaseDate?: string): number {
  const parsed = Number(String(releaseDate || '').slice(0, 4));
  return Number.isFinite(parsed) && parsed > 1900 ? parsed : 1972;
}

function decadeLabel(releaseDate?: string): string {
  const year = yearFromRelease(releaseDate);
  return `${Math.floor(year / 10) * 10}s catalog`;
}

function confidenceWeight(match: PlatformMatch): number {
  if (match.confidence === 'exact') return 24;
  if (match.confidence === 'high') return 18;
  if (match.confidence === 'medium') return 11;
  return 5;
}

function buildArchiveId(title: string, artistName: string): string {
  const seed = `${artistName}-${title}`.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'CATALOG';
  return `BCE-${seed}-${new Date().getFullYear()}`;
}

function buildTrackFromMatch(match: PlatformMatch, index: number) {
  const ageBonus = Math.min(22, Math.max(4, Math.round((new Date().getFullYear() - yearFromRelease(match.releaseDate)) / 3)));
  const revivalScore = Math.min(98, 54 + ageBonus + confidenceWeight(match));
  return {
    id: `${match.platform}-${match.trackId}`,
    title: match.title,
    artistName: match.artistName,
    albumName: match.albumName || 'Catalog source pending',
    era: decadeLabel(match.releaseDate),
    releaseDate: match.releaseDate || 'Unknown release date',
    archiveId: buildArchiveId(match.title, match.artistName),
    rightsStatus: 'Platform metadata matched; ownership and clearance remain unverified',
    revivalScore,
    syncFit: index === 0 ? 'Premium brand campaign, film trailer, collector vinyl' : 'Streaming revival, editorial playlist, social campaign',
    imageUrl: match.imageUrl || fallbackTracks[index % fallbackTracks.length].imageUrl,
    platform: match.platformLabel,
    confidence: match.confidence,
    streamUrl: match.streamUrl,
    previewUrl: match.previewUrl,
    isrc: match.isrc,
  };
}

function buildOpenAIVisualPrompts(title: string, artistName: string) {
  const subject = `${artistName} — "${title}"`;
  return {
    background: `Ultra-wide cinematic editorial photograph, hero background for Boostify Catalog Resurrection Engine featuring ${subject}. A futuristic obsidian archive vault: rotating analog 2-inch master tape reels, glowing amber VU meters, holographic rights-data overlays in emerald and cyan, vinyl lacquer suspended in glass, volumetric warm orange key light cutting through dust haze, deep cinematic depth of field, anamorphic lens flare, 35mm film grain, luxury product photography, magazine-cover quality, no words, no logos, no text.`,
    poster: `Vertical premium concept poster for the legacy catalog resurrection of ${subject}. A restored gold-foil vinyl record floating over a handwritten archive metadata card with publishing notes, surrounded by master tape reels and a warm tungsten studio lamp; deep navy background with accent orange and emerald light, fine paper texture, art-directed editorial still life, Vogue-meets-Rolling-Stone aesthetic, ultra detailed, no text, no typography.`,
    rights: `Top-down macro flat-lay of a music publishing rights ledger for ${subject}: leather-bound publishing book, ISRC barcode strips, signed copyright slips, tape boxes labeled with handwritten dates, brass key, polished black glass surface reflecting amber and cyan signal lights, photorealistic editorial product photography, ultra detailed, cinematic, no text in image.`,
    vault: `Cinematic close-up of an analog studio tape machine playing the master of ${subject}: spinning Studer-style reels, illuminated VU meters peaking in warm orange, splice tape and grease pencil annotations, dust motes in volumetric backlight, shallow depth of field, photorealistic music studio editorial photography, no text.`,
    lacquer: `Macro photograph of a freshly cut vinyl lacquer master of ${subject} on a precision lathe, micro-grooves catching emerald and orange rim light, diamond stylus poised above, glossy obsidian platter, science-meets-craft aesthetic, ultra sharp, photorealistic, no text.`,
    syncBoard: `Boardroom mood image for sync licensing pitch of ${subject}: dark walnut conference table, projected holographic timeline of film, TV and luxury brand placements, leather chairs, ambient orange and cyan rim lighting, cinematic atmosphere, editorial photography, no text, no logos.`,
  };
}

async function generateOpenAIVisual(id: string, title: string, prompt: string, size: '1024x1024' | '1536x1024' | '1024x1536') {
  const { generateImageWithFluxKontextPro, generateImageWithNanoBanana } = await import('../services/fal-service');

  // Map pixel size to aspect ratio for Flux Pro Kontext
  const aspectRatio = size === '1536x1024' ? '16:9' : size === '1024x1536' ? '9:16' : '1:1';

  // Try Flux Pro Kontext (fal-ai/flux-pro/kontext/text-to-image) first
  const generated = await generateImageWithFluxKontextPro(prompt, { aspectRatio: aspectRatio as any, outputFolder: 'artist-images' });
  if (generated.success && generated.imageUrl) {
    return {
      id,
      title,
      prompt,
      imageUrl: generated.imageUrl,
      provider: 'fal-flux-kontext-pro',
    };
  }

  // Fallback to Nano Banana 2 if Flux Pro Kontext fails
  console.warn(`[LegacyCatalogResurrection] Flux Pro Kontext failed for "${id}", falling back to FAL Nano Banana 2:`, generated.error);
  const falResult = await generateImageWithNanoBanana(prompt, { aspectRatio: aspectRatio as any, outputFormat: 'png' });
  if (falResult.success && falResult.imageUrl) {
    return {
      id,
      title,
      prompt,
      imageUrl: falResult.imageUrl,
      provider: 'fal:nano-banana-2',
    };
  }

  throw new Error(generated.error || falResult.error || 'Image generation failed');
}

async function buildVisualGenerationResponse(title: string, artistName: string) {
  const prompts = buildOpenAIVisualPrompts(title, artistName);
  const jobs: Array<{ id: string; title: string; prompt: string; size: '1024x1024' | '1536x1024' | '1024x1536'; role: 'background' | 'visual' }> = [
    { id: 'catalog-hero-background', title: 'Hero Background', prompt: prompts.background, size: '1536x1024', role: 'background' },
    { id: 'archive-poster', title: 'Archive Poster', prompt: prompts.poster, size: '1024x1536', role: 'visual' },
    { id: 'rights-ledger', title: 'Rights Ledger', prompt: prompts.rights, size: '1024x1024', role: 'visual' },
    { id: 'master-tape-vault', title: 'Master Tape Vault', prompt: prompts.vault, size: '1536x1024', role: 'visual' },
    { id: 'vinyl-lacquer-macro', title: 'Vinyl Lacquer Macro', prompt: prompts.lacquer, size: '1024x1024', role: 'visual' },
    { id: 'sync-pitch-boardroom', title: 'Sync Pitch Boardroom', prompt: prompts.syncBoard, size: '1536x1024', role: 'visual' },
  ];

  console.log(`[LegacyCatalogResurrection] generating ${jobs.length} OpenAI gpt-image-1 visuals for "${artistName} - ${title}"`);
  const results = await Promise.allSettled(
    jobs.map((j) => generateOpenAIVisual(j.id, j.title, j.prompt, j.size).then((v) => ({ ...v, role: j.role })))
  );

  const fulfilled = results
    .map((r, i) => (r.status === 'fulfilled' ? r.value : (console.warn(`[LegacyCatalogResurrection] visual "${jobs[i].id}" failed:`, (r as PromiseRejectedResult).reason?.message || r.reason), null)))
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (fulfilled.length === 0) {
    console.warn('[LegacyCatalogResurrection] All OpenAI visuals failed, using curated archive fallback');
    return { success: true, model: 'image-generation', background: archiveBackground, visuals: archiveVisuals, fallback: true };
  }

  const background = fulfilled.find((v) => v.role === 'background') || fulfilled[0];
  const visuals = fulfilled.filter((v) => v.id !== background.id).map(({ role, ...rest }) => rest);

  return {
    success: true,
    model: 'gpt-image-1',
    background: (({ role, ...rest }) => rest)(background),
    visuals,
    generatedCount: fulfilled.length,
    requestedCount: jobs.length,
  };
}

function buildCommandArtifact(action: string, track: any, analysis: any) {
  const selectedTrack = track || fallbackTracks[0];
  const catalog = analysis?.catalog || {};
  const metrics = analysis?.metrics || {};
  const actionMap: Record<string, { title: string; status: string; summary: string; cta: string }> = {
    'sync-pitch': {
      title: 'Sync Pitch Packet',
      status: 'Pitch draft prepared — not sent',
      summary: `${selectedTrack.title} by ${selectedTrack.artistName} has a draft pitch outline for film, television, sports documentary, and nostalgia campaign research. No buyer has been contacted.`,
      cta: 'Open track brief',
    },
    'estate-outreach': {
      title: 'Estate Outreach Memo',
      status: 'Rights outreach draft prepared — not sent',
      summary: `Prepared a review checklist for ${selectedTrack.artistName}, including provenance questions, split verification, and master owner research. No rights holder has been contacted.`,
      cta: 'Open track brief',
    },
    'package-offer': {
      title: 'Catalog Revival Offer',
      status: 'Offer terms drafted',
      summary: `Drafted a preliminary revival offer outline for ${selectedTrack.title}. Any opportunity estimate is modeled from catalog signals and requires rights and commercial review.`,
      cta: 'Prepare deal memo',
    },
    'archive-reference': {
      title: 'Archive Reference Packet',
      status: 'Catalog metadata path mapped',
      summary: `Mapped ${catalog.canonicalTitle || selectedTrack.title} to the Boostify archive workflow: recording metadata, visual assets, rights ledger, source platforms, and accession notes.`,
      cta: 'Open HTML brief',
    },
    'ai-memo': {
      title: 'AI Catalog Memo',
      status: 'Catalog memo draft prepared',
      summary: `Prepared a structured memo for ${selectedTrack.title} using matched platform metadata and Boostify catalog scoring. Rights and market assumptions still need independent verification.`,
      cta: 'Open track brief',
    },
    preview: {
      title: 'Preview Routing',
      status: selectedTrack.previewUrl || selectedTrack.streamUrl ? 'Playable source located' : 'No public preview found',
      summary: selectedTrack.previewUrl ? `Preview audio is available for ${selectedTrack.title}.` : selectedTrack.streamUrl ? `A streaming source is available for ${selectedTrack.title}.` : `No public preview URL was found, but the track remains in the revival queue.`,
      cta: selectedTrack.previewUrl ? 'Play preview' : 'Open stream source',
    },
  };
  const selected = actionMap[action] || actionMap['ai-memo'];
  return {
    id: `${action}-${Date.now()}`,
    action,
    ...selected,
    createdAt: new Date().toISOString(),
    sections: [
      { label: 'Track', value: `${selectedTrack.title} - ${selectedTrack.artistName}` },
      { label: 'Archive ID', value: selectedTrack.archiveId || 'BCE-AUTO-GENERATED' },
      { label: 'Rights status', value: selectedTrack.rightsStatus || 'Priority clearance review' },
      { label: 'Commercial fit', value: selectedTrack.syncFit || 'Sync, vinyl, editorial, brand campaign' },
    ],
    nextSteps: [
      'Verify master owner and publishing split',
      'Attach audio preview and catalog reference images',
      'Package HTML brief with revival score and buyer list',
    ],
  };
}

function buildAnalysis(matchResult: CrossPlatformResult | null, query: { title: string; artistName: string; isrc?: string }) {
  const tracks = matchResult?.matches?.length
    ? matchResult.matches.map(buildTrackFromMatch)
    : [];
  const hasMatches = tracks.length > 0;
  const topScore = hasMatches ? Math.max(...tracks.map(track => Number(track.revivalScore || 0))) : 0;
  const platformsMatched = matchResult?.platformsMatched || [];

  return {
    query,
    source: {
      spotifyConfigured: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
      appleMusicPublicSearch: true,
      deezerPublicSearch: true,
      musicBrainzRegistry: true,
      platformsMatched,
      platformsChecked: matchResult?.platformsChecked || ['apple_music', 'deezer', 'musicbrainz'],
      platformsSkipped: matchResult?.platformsSkipped || [],
    },
    catalog: {
      name: 'Boostify Catalog Resurrection Engine',
      archiveReference: 'Boostify archive metadata discovery workflow',
      referenceUrl: '/api/legacy-catalog-resurrection/brief.html',
      canonicalTitle: matchResult?.canonicalTitle || query.title,
      canonicalArtist: matchResult?.canonicalArtist || query.artistName,
      canonicalIsrc: matchResult?.canonicalIsrc || query.isrc || null,
      matchCount: matchResult?.matches?.length || 0,
      revivedTracks: tracks,
    },
    metrics: {
      resurrectionScore: topScore,
      rightsReadiness: 0,
      // External discovery data does not include rights verification, catalog
      // completeness, or reported revenue. Keep those unscored until connected.
      syncDemand: 0,
      archiveCompleteness: 0,
      projectedAnnualValue: 0,
      clearanceDays: 0,
    },
    rightsStack: hasMatches ? [
      { label: 'Master owner', status: 'unverified', confidence: 0 },
      { label: 'Publishing split', status: 'unverified', confidence: 0 },
      { label: 'Estate contact', status: 'not researched', confidence: 0 },
      { label: 'Sync clearance', status: 'not cleared', confidence: 0 },
    ] : [],
    opportunities: [],
    timeline: [],
    visuals: archiveVisuals,
    matchResult,
  };
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildBriefPdf(): Buffer {
  const lines = [
    ['F2', 22, 'Boostify Catalog Resurrection Engine'],
    ['F1', 11, 'Enterprise catalog intelligence for dormant recordings and archive-era IP.'],
    ['F1', 11, 'Find old catalog signals, rights gaps, streaming demand, and revival offers.'],
    ['F1', 11, 'Inspired by museum catalog workflows for archive browsing and metadata review.'],
    ['F1', 11, 'Connected sources: Spotify when configured, Apple Music public search, Deezer, MusicBrainz.'],
    ['F1', 11, 'Core outputs: catalog-match research, scoring, archive visuals, and draft outreach materials. Rights status requires independent verification.'],
    ['F1', 11, 'Commercial use case: labels, estates, publishers, artists, brands, and sync teams.'],
    ['F1', 11, 'Route: /legacy-catalog-resurrection'],
    ['F1', 11, 'Contact: info@boostifymusic.com'],
  ] as Array<[string, number, string]>;
  const streamLines = ['BT', '/F2 22 Tf', '72 730 Td', `(${pdfEscape(lines[0][2])}) Tj`];
  for (const [font, size, text] of lines.slice(1)) {
    streamLines.push(`/${font} ${size} Tf`, '0 -24 Td', `(${pdfEscape(text)}) Tj`);
  }
  streamLines.push('ET');
  const stream = `${streamLines.join('\n')}\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((objectBody, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildBriefHtml(analysis: ReturnType<typeof buildAnalysis>) {
  const leadTrack = analysis.catalog.revivedTracks[0] || {
    archiveId: 'Pending live catalog match',
    syncFit: 'No matched recording is available yet. Run a catalog search to create a track-specific brief.',
  };
  const metricCards = [
    ['Resurrection score', analysis.metrics.resurrectionScore],
    ['Rights readiness', analysis.metrics.rightsReadiness],
    ['Sync demand', analysis.metrics.syncDemand],
    ['Archive completeness', analysis.metrics.archiveCompleteness],
  ];
  const sourceText = analysis.source.platformsChecked.map(source => source.replace(/_/g, ' ')).join(' / ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Boostify Catalog Resurrection Brief</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, Arial, sans-serif; background: #070a0e; color: #f7f7f8; }
    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(circle at 15% 10%, rgba(249,115,22,.20), transparent 34%), #070a0e; }
    main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0 56px; }
    header { border: 1px solid rgba(255,255,255,.12); background: rgba(16,21,27,.92); border-radius: 10px; padding: 28px; }
    .eyebrow, .label { color: #fdba74; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 10px 0 10px; font-size: clamp(34px, 5vw, 58px); line-height: .98; }
    p { color: #b8c0cc; line-height: 1.7; }
    .grid { display: grid; gap: 14px; }
    .metrics { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin: 18px 0; }
    .card, section { border: 1px solid rgba(255,255,255,.12); background: rgba(16,21,27,.86); border-radius: 8px; padding: 18px; }
    .metric { font-size: 34px; font-weight: 900; color: #fdba74; margin-top: 8px; }
    .two { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    h2 { margin: 0 0 12px; font-size: 20px; }
    .row { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid rgba(255,255,255,.10); padding: 12px 0; }
    .row:first-child { border-top: 0; }
    .value { color: #fff; font-weight: 800; }
    a.button { display: inline-flex; height: 40px; align-items: center; padding: 0 14px; border-radius: 7px; background: #fff; color: #080b0f; text-decoration: none; font-weight: 900; font-size: 12px; text-transform: uppercase; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    .outline { background: transparent !important; color: #f7f7f8 !important; border: 1px solid rgba(255,255,255,.18); }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">HTML Brief</div>
      <h1>Boostify Catalog Resurrection Brief</h1>
      <p>${htmlEscape(analysis.catalog.archiveReference)} for ${htmlEscape(analysis.catalog.canonicalArtist)} - ${htmlEscape(analysis.catalog.canonicalTitle)}. This page replaces the browser PDF viewer while preserving the original PDF file as a download.</p>
      <div class="actions">
        <a class="button" href="/legacy-catalog-resurrection">Open engine</a>
        <a class="button outline" href="/api/legacy-catalog-resurrection/brief.pdf?download=1">Download original PDF</a>
      </div>
    </header>

    <div class="grid metrics">
      ${metricCards.map(([label, value]) => `<div class="card"><div class="label">${htmlEscape(String(label))}</div><div class="metric">${value}</div></div>`).join('')}
    </div>

    <div class="grid two">
      <section>
        <h2>Catalog Target</h2>
        <div class="row"><span>Track</span><span class="value">${htmlEscape(analysis.catalog.canonicalTitle)}</span></div>
        <div class="row"><span>Artist</span><span class="value">${htmlEscape(analysis.catalog.canonicalArtist)}</span></div>
        <div class="row"><span>Archive ID</span><span class="value">${htmlEscape(leadTrack.archiveId)}</span></div>
        <div class="row"><span>Sources</span><span class="value">${htmlEscape(sourceText)}</span></div>
      </section>
      <section>
        <h2>Commercial Thesis</h2>
        <p>${htmlEscape(leadTrack.syncFit)}. The workflow packages streaming evidence, rights readiness, buyer angles, and revival economics into a deal-ready archive packet.</p>
        <p>Revenue data is not connected, so this brief does not estimate catalog value.</p>
        <div class="row"><span>Clearance timing</span><span class="value">Not estimated — rights research required</span></div>
      </section>
    </div>

    <div class="grid two" style="margin-top:14px">
      <section>
        <h2>Rights Path</h2>
        ${analysis.rightsStack.map(item => `<div class="row"><span>${htmlEscape(item.label)}</span><span class="value">${htmlEscape(item.status)} / ${item.confidence}%</span></div>`).join('')}
      </section>
      <section>
        <h2>Buyer Angles</h2>
        ${analysis.opportunities.map(item => `<div class="row"><span>${htmlEscape(item.channel)}</span><span class="value">${htmlEscape(item.value)}</span></div>`).join('')}
      </section>
    </div>
  </main>
</body>
</html>`;
}

async function safeMatch(query: { title: string; artistName: string; isrc?: string }) {
  try {
    return await matchSongAcrossPlatforms(query);
  } catch (error) {
    console.warn('[LegacyCatalogResurrection] match fallback:', error instanceof Error ? error.message : error);
    return null;
  }
}

router.get('/bootstrap', async (_req: Request, res: Response) => {
  const query = { title: '', artistName: '' };
  res.json({ success: true, data: buildAnalysis(null, query) });
});

// Every user's searches and generated working documents are stored in the
// shared PostgreSQL database and can only be read by their owner.
router.get('/history', async (req: Request, res: Response) => {
  try {
    const clerkUserId = getUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Authentication required' });
    await ensureResearchTable();
    const records = await db.select().from(legacyCatalogResearch)
      .where(eq(legacyCatalogResearch.clerkUserId, clerkUserId))
      .orderBy(desc(legacyCatalogResearch.createdAt)).limit(50);
    return res.json({ success: true, records });
  } catch (error) {
    console.error('[LegacyCatalogResurrection] history read failed:', error);
    return res.status(503).json({ error: 'Saved catalog research is temporarily unavailable.' });
  }
});

router.post('/search', async (req: Request, res: Response) => {
  const title = String(req.body?.title || '').trim().slice(0, 180);
  const artistName = String(req.body?.artistName || '').trim().slice(0, 180);
  const isrc = String(req.body?.isrc || '').trim().slice(0, 24) || undefined;
  if (!isrc && (!title || !artistName)) {
    return res.status(400).json({ error: 'Enter a title and artist, or search directly by ISRC.' });
  }
  const query = { title, artistName, isrc };
  try {
    const clerkUserId = getUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Authentication required' });
    await ensureResearchTable();
    const matchResult = await safeMatch(query);
    if (!matchResult) {
      return res.status(502).json({ error: 'Catalog search providers are unavailable. No result was saved.' });
    }
    const data = buildAnalysis(matchResult, query);
    const [saved] = await db.insert(legacyCatalogResearch).values({
      clerkUserId, kind: 'search', query, analysis: data,
    }).returning({ id: legacyCatalogResearch.id, createdAt: legacyCatalogResearch.createdAt });
    return res.json({ success: true, data, researchId: saved.id, savedAt: saved.createdAt });
  } catch (error) {
    console.error('[LegacyCatalogResurrection] search persistence failed:', error);
    return res.status(503).json({ error: 'Search completed but could not be saved. Please retry.' });
  }
});

// GET /visuals — returns cached AI visuals or { pending: true } while generating
router.get('/visuals', (_req: Request, res: Response) => {
  const persisted = readPersistedVisuals();
  if (persisted) {
    return res.json({ success: true, ...persisted, cached: true });
  }
  // Not ready yet — trigger generation if not already running
  if (!visualsGenerationInProgress) {
    ensureVisualsGenerated();
  }
  return res.json({ success: true, pending: true, generating: visualsGenerationInProgress });
});

router.post('/generate-visuals', async (req: Request, res: Response) => {
  // Check persistent file cache first — permanent Firebase Storage URLs
  const persisted = readPersistedVisuals();
  if (persisted) {
    return res.json({ success: true, ...persisted, cached: true });
  }
  // If generation already running, return pending
  if (visualsGenerationInProgress) {
    return res.json({ success: true, pending: true, generating: true });
  }
  // Trigger and wait
  visualsGenerationInProgress = true;
  try {
    const title = String(req.body?.title || 'legacy soul catalog').trim();
    const artistName = String(req.body?.artistName || 'archive artist').trim();
    const response = await buildVisualGenerationResponse(title, artistName);
    if (!response?.fallback && response?.visuals?.length > 0) {
      writePersistedVisuals({ background: response.background, visuals: response.visuals });
    }
    return res.json(response);
  } finally {
    visualsGenerationInProgress = false;
  }
});

router.post('/action', async (req: Request, res: Response) => {
  const action = String(req.body?.action || '').trim();
  const track = req.body?.track;
  const allowedActions = new Set(['sync-pitch', 'estate-outreach', 'package-offer', 'archive-reference', 'ai-memo', 'preview']);
  if (!allowedActions.has(action)) return res.status(400).json({ error: 'Unsupported catalog action.' });
  if (!track?.title || !track?.artistName) return res.status(400).json({ error: 'Select a matched recording before generating an artifact.' });
  try {
    const clerkUserId = getUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Authentication required' });
    await ensureResearchTable();
    const artifact = buildCommandArtifact(action, track, req.body?.analysis);
    const [saved] = await db.insert(legacyCatalogResearch).values({
      clerkUserId,
      kind: 'artifact',
      query: { title: String(track.title).slice(0, 180), artistName: String(track.artistName).slice(0, 180) },
      analysis: req.body?.analysis || null,
      artifact,
    }).returning({ id: legacyCatalogResearch.id, createdAt: legacyCatalogResearch.createdAt });
    return res.json({ success: true, artifact: { ...artifact, recordId: saved.id, createdAt: saved.createdAt } });
  } catch (error) {
    console.error('[LegacyCatalogResurrection] action persistence failed:', error);
    return res.status(503).json({ error: 'The document could not be saved. Please retry.' });
  }
});

router.get('/brief.html', async (req: Request, res: Response) => {
  const query = {
    title: String(req.query.title || '').trim().slice(0, 180),
    artistName: String(req.query.artistName || '').trim().slice(0, 180),
    isrc: String(req.query.isrc || '').trim().slice(0, 24) || undefined,
  };
  const validQuery = query.isrc || (query.title && query.artistName);
  const matchResult = validQuery ? await safeMatch(query) : null;
  const analysis = buildAnalysis(matchResult, query);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buildBriefHtml(analysis));
});

router.get('/brief.pdf', (req: Request, res: Response) => {
  const wantDownload = req.query.download === '1' || req.query.download === 'true';
  if (fs.existsSync(briefPdfPath)) {
    const stat = fs.statSync(briefPdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader(
      'Content-Disposition',
      `${wantDownload ? 'attachment' : 'inline'}; filename="Boostify_Catalog_Resurrection.pdf"`
    );
    return fs.createReadStream(briefPdfPath).pipe(res);
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="Boostify_Catalog_Resurrection.pdf"');
  res.send(buildBriefPdf());
});

export default router;
