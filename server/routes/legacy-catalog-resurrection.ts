import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/clerk-auth';
import { getUserId } from '../middleware/clerk-auth';
import { db } from '../db';
import { legacyCatalogResearch } from '../../db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { matchSongAcrossPlatforms, type CrossPlatformResult, type PlatformMatch } from '../services/cross-platform-matching';

const router = Router();
// This engine contains private catalog research and generated rights materials.
// Enforce auth here as well as at the page gate; global Clerk middleware only
// attaches the current user and does not reject anonymous API requests.
router.use(isAuthenticated);

let researchTableReady: Promise<void> | null = null;

async function ensureResearchTable(): Promise<void> {
  if (!researchTableReady) {
    researchTableReady = db.execute(sql`
      CREATE TABLE IF NOT EXISTS legacy_catalog_research (
        id SERIAL PRIMARY KEY,
        clerk_user_id VARCHAR(255) NOT NULL,
        kind VARCHAR(32) NOT NULL,
        query JSONB,
        analysis JSONB,
        artifact JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `).then(async () => {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS legacy_catalog_research_user_created_idx ON legacy_catalog_research (clerk_user_id, created_at)`);
    }).catch(error => {
      researchTableReady = null;
      throw error;
    });
  }
  await researchTableReady;
}

function yearFromRelease(releaseDate?: string): number {
  const parsed = Number(String(releaseDate || '').slice(0, 4));
  return Number.isFinite(parsed) && parsed > 1900 ? parsed : 0;
}

function decadeLabel(releaseDate?: string): string {
  const year = yearFromRelease(releaseDate);
  return year ? `${Math.floor(year / 10) * 10}s catalog` : 'Release date unknown';
}


function buildTrackFromMatch(match: PlatformMatch) {
  return {
    id: `${match.platform}-${match.trackId}`,
    title: match.title,
    artistName: match.artistName,
    albumName: match.albumName,
    era: decadeLabel(match.releaseDate),
    releaseDate: match.releaseDate || 'Unknown release date',
    rightsStatus: 'Public platform metadata only; ownership and clearance are unverified',
    imageUrl: match.imageUrl,
    platform: match.platformLabel,
    confidence: match.confidence,
    streamUrl: match.streamUrl,
    previewUrl: match.previewUrl,
    isrc: match.isrc,
  };
}

function buildCommandArtifact(action: string, selectedTrack: any, researchId: number) {
  const actionMap: Record<string, { title: string; status: string; summary: string; cta: string }> = {
    'sync-pitch': { title: 'Sync Pitch Draft', status: 'Saved draft - not sent', summary: `Prepared a research outline for ${selectedTrack.title} by ${selectedTrack.artistName}. No music supervisor or buyer has been contacted.`, cta: 'Open track brief' },
    'estate-outreach': { title: 'Rights Research Checklist', status: 'Saved checklist - not sent', summary: `Prepared a checklist for verifying the master owner, publishing shares, provenance, and authorized contact for ${selectedTrack.artistName}. No rights holder has been contacted.`, cta: 'Open track brief' },
    'package-offer': { title: 'Catalog Discussion Outline', status: 'Saved working draft', summary: `Prepared a non-binding discussion outline for ${selectedTrack.title}. It contains no valuation, offer terms, or verified ownership information.`, cta: 'Open track brief' },
    'archive-reference': { title: 'Recording Metadata Summary', status: 'Saved summary', summary: `Saved public platform metadata for ${selectedTrack.title} by ${selectedTrack.artistName}.`, cta: 'Open track brief' },
  };
  const selected = actionMap[action] || actionMap['archive-reference'];
  return {
    id: `${action}-${Date.now()}`,
    action,
    researchId,
    ...selected,
    createdAt: new Date().toISOString(),
    sections: [
      { label: 'Recording', value: `${selectedTrack.title} - ${selectedTrack.artistName}` },
      { label: 'Platform', value: selectedTrack.platform || 'Not provided' },
      { label: 'ISRC', value: selectedTrack.isrc || 'Not provided by source' },
      { label: 'Rights status', value: 'Unverified - public metadata does not establish ownership or clearance' },
    ],
    nextSteps: ['Verify master ownership and publishing shares', 'Confirm the authorized contact and permission to pitch', 'Review the draft before sending it externally'],
  };
}

function buildAnalysis(matchResult: CrossPlatformResult | null, query: { title: string; artistName: string; isrc?: string }) {
  const tracks = matchResult?.matches?.length
    ? matchResult.matches.map(buildTrackFromMatch)
    : [];
  const hasMatches = tracks.length > 0;
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
      canonicalTitle: matchResult?.canonicalTitle || query.title,
      canonicalArtist: matchResult?.canonicalArtist || query.artistName,
      canonicalIsrc: matchResult?.canonicalIsrc || query.isrc || null,
      matchCount: matchResult?.matches?.length || 0,
      revivedTracks: tracks,
    },
    rightsStack: hasMatches ? [
      { label: 'Master owner', status: 'unverified' },
      { label: 'Publishing split', status: 'unverified' },
      { label: 'Estate contact', status: 'not researched' },
      { label: 'Sync clearance', status: 'not cleared' },
    ] : [],
  };
}

function pdfEscape(value: string): string {
  return value.normalize('NFKD').replace(/[^\x20-\x7E]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildBriefPdf(analysis: ReturnType<typeof buildAnalysis>): Buffer {
  const sources = analysis.source.platformsChecked.map(source => source.replace(/_/g, ' ')).join(', ') || 'No sources reported';
  const lines = [
    ['F2', 20, 'Boostify Catalog Research Brief'],
    ['F1', 11, `Recording: ${analysis.catalog.canonicalTitle || analysis.query.title || 'Not selected'}`],
    ['F1', 11, `Artist: ${analysis.catalog.canonicalArtist || analysis.query.artistName || 'Not selected'}`],
    ['F1', 11, `ISRC: ${analysis.catalog.canonicalIsrc || analysis.query.isrc || 'Not provided'}`],
    ['F1', 11, `Sources checked: ${sources}`],
    ['F1', 11, `Public platform matches found: ${analysis.catalog.matchCount}`],
    ['F1', 11, 'Public platform metadata does not establish ownership, rights, clearance, demand, or commercial value.'],
    ['F2', 14, 'Platform matches'],
    ...analysis.catalog.revivedTracks.slice(0, 8).map(track => ['F1', 10, `${track.platform || 'Source'}: ${track.title} / ${track.artistName}${track.isrc ? ` / ISRC ${track.isrc}` : ''}`] as [string, number, string]),
    ['F2', 14, 'Rights verification'],
    ['F1', 10, 'Master ownership, publishing shares, authority to represent, and permissions remain unverified.'],
  ] as Array<[string, number, string]>;
  const streamLines = ['BT', '72 750 Td'];
  for (const [font, size, text] of lines) {
    streamLines.push(`/${font} ${size} Tf`, `(${pdfEscape(text.slice(0, 110))}) Tj`, '0 -24 Td');
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

function buildBriefHtml(analysis: ReturnType<typeof buildAnalysis>, researchId: number, trackId?: string) {
  const leadTrack = analysis.catalog.revivedTracks[0];
  const pdfParams = new URLSearchParams({ researchId: String(researchId), download: '1' });
  if (trackId) pdfParams.set('trackId', trackId);
  const pdfUrl = `/api/legacy-catalog-resurrection/brief.pdf?${pdfParams.toString()}`;
  const sourceText = analysis.source.platformsChecked.map(source => source.replace(/_/g, ' ')).join(' / ');
  const matches = analysis.catalog.revivedTracks.length
    ? analysis.catalog.revivedTracks.map(track => `<div class="row"><span>${htmlEscape(track.platform || 'Source')} - ${htmlEscape(track.title)} / ${htmlEscape(track.artistName)}</span><span class="value">${htmlEscape(track.confidence || 'match')}${track.streamUrl ? ` - <a href="${htmlEscape(track.streamUrl)}">Open source</a>` : ''}</span></div>`).join('')
    : '<p>No matches were returned by the sources checked for this query.</p>';
  const rights = analysis.rightsStack.length
    ? analysis.rightsStack.map(item => `<div class="row"><span>${htmlEscape(item.label)}</span><span class="value">${htmlEscape(item.status)}</span></div>`).join('')
    : '<p>Run a search with a matched recording to create this checklist.</p>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Boostify Catalog Research Brief</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, Arial, sans-serif; background: #070a0e; color: #f7f7f8; }
    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(circle at 15% 10%, rgba(249,115,22,.20), transparent 34%), #070a0e; }
    main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0 56px; }
    header, section { border: 1px solid rgba(255,255,255,.12); background: rgba(16,21,27,.92); border-radius: 10px; padding: 22px; }
    .eyebrow { color: #fdba74; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 10px 0; font-size: clamp(34px, 5vw, 58px); line-height: .98; }
    p { color: #b8c0cc; line-height: 1.7; }
    .grid { display: grid; gap: 14px; }
    .two { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin-top: 14px; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    .row { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid rgba(255,255,255,.10); padding: 12px 0; }
    .row:first-child { border-top: 0; }
    .value { color: #fff; font-weight: 800; text-align: right; }
    a.button { display: inline-flex; height: 40px; align-items: center; padding: 0 14px; border-radius: 7px; background: #fff; color: #080b0f; text-decoration: none; font-weight: 900; font-size: 12px; text-transform: uppercase; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    .outline { background: transparent !important; color: #f7f7f8 !important; border: 1px solid rgba(255,255,255,.18); }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">Catalog research brief</div>
      <h1>Boostify Catalog Research</h1>
      <p>Public platform match records for ${htmlEscape(analysis.catalog.canonicalArtist)} - ${htmlEscape(analysis.catalog.canonicalTitle)}. This report does not verify ownership, rights, demand, or commercial value.</p>
      <div class="actions">
        <a class="button" href="/legacy-catalog-resurrection">Open engine</a>
        <a class="button outline" href="${htmlEscape(pdfUrl)}">Download PDF</a>
      </div>
    </header>
    <div class="grid two">
      <section>
        <h2>Recording</h2>
        <div class="row"><span>Track</span><span class="value">${htmlEscape(analysis.catalog.canonicalTitle)}</span></div>
        <div class="row"><span>Artist</span><span class="value">${htmlEscape(analysis.catalog.canonicalArtist)}</span></div>
        <div class="row"><span>ISRC</span><span class="value">${htmlEscape(analysis.catalog.canonicalIsrc || leadTrack?.isrc || 'Not provided')}</span></div>
        <div class="row"><span>Sources checked</span><span class="value">${htmlEscape(sourceText)}</span></div>
      </section>
      <section><h2>Platform matches</h2>${matches}</section>
      <section>
        <h2>Rights verification</h2>
        ${rights}
        <p>Verify the rights holder, permissions, and authority to represent the recording before sharing it with partners or buyers.</p>
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

async function loadSavedAnalysis(req: Request, researchId: number) {
  const clerkUserId = getUserId(req);
  if (!clerkUserId) return null;
  await ensureResearchTable();
  const [record] = await db.select({ analysis: legacyCatalogResearch.analysis })
    .from(legacyCatalogResearch)
    .where(and(
      eq(legacyCatalogResearch.id, researchId),
      eq(legacyCatalogResearch.clerkUserId, clerkUserId),
      eq(legacyCatalogResearch.kind, 'search'),
    )).limit(1);
  return record?.analysis as ReturnType<typeof buildAnalysis> | null | undefined;
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


router.post('/action', async (req: Request, res: Response) => {
  const action = String(req.body?.action || '').trim();
  const requestedTrack = req.body?.track;
  const researchId = Number(req.body?.researchId);
  const allowedActions = new Set(['sync-pitch', 'estate-outreach', 'package-offer', 'archive-reference']);
  if (!allowedActions.has(action)) return res.status(400).json({ error: 'Unsupported catalog action.' });
  if (!Number.isSafeInteger(researchId) || researchId <= 0 || !requestedTrack?.id) return res.status(400).json({ error: 'Select a saved catalog match before generating a document.' });
  try {
    const clerkUserId = getUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Authentication required' });
    await ensureResearchTable();
    const [sourceResearch] = await db.select({ analysis: legacyCatalogResearch.analysis })
      .from(legacyCatalogResearch)
      .where(and(
        eq(legacyCatalogResearch.id, researchId),
        eq(legacyCatalogResearch.clerkUserId, clerkUserId),
        eq(legacyCatalogResearch.kind, 'search'),
      )).limit(1);
    const trustedAnalysis = sourceResearch?.analysis as ReturnType<typeof buildAnalysis> | null | undefined;
    const track = trustedAnalysis?.catalog?.revivedTracks?.find(item => item.id === requestedTrack.id);
    if (!track) return res.status(404).json({ error: 'The selected recording is not part of your saved search. Run a new catalog search.' });
    const artifact = buildCommandArtifact(action, track, researchId);
    const [saved] = await db.insert(legacyCatalogResearch).values({
      clerkUserId,
      kind: 'artifact',
      query: { title: String(track.title).slice(0, 180), artistName: String(track.artistName).slice(0, 180) },
      analysis: trustedAnalysis,
      artifact,
    }).returning({ id: legacyCatalogResearch.id, createdAt: legacyCatalogResearch.createdAt });
    return res.json({ success: true, artifact: { ...artifact, recordId: saved.id, createdAt: saved.createdAt } });
  } catch (error) {
    console.error('[LegacyCatalogResurrection] action persistence failed:', error);
    return res.status(503).json({ error: 'The document could not be saved. Please retry.' });
  }
});

router.get('/brief.html', async (req: Request, res: Response) => {
  const researchId = Number(req.query.researchId);
  if (!Number.isSafeInteger(researchId) || researchId <= 0) return res.status(400).send('A saved catalog search is required to create this brief.');
  try {
    const analysis = await loadSavedAnalysis(req, researchId);
    if (!analysis) return res.status(404).send('Saved catalog research was not found for this account.');
    const trackId = String(req.query.trackId || '');
    if (trackId && !analysis.catalog.revivedTracks.some(track => track.id === trackId)) {
      return res.status(404).send('This recording is not part of the saved search.');
    }
    const briefAnalysis = trackId
      ? { ...analysis, catalog: { ...analysis.catalog, revivedTracks: analysis.catalog.revivedTracks.filter(track => track.id === trackId) } }
      : analysis;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buildBriefHtml(briefAnalysis, researchId, trackId));
  } catch (error) {
    console.error('[LegacyCatalogResurrection] HTML brief failed:', error);
    return res.status(503).send('Saved catalog research is temporarily unavailable.');
  }
});

router.get('/brief.pdf', async (req: Request, res: Response) => {
  const wantDownload = req.query.download === '1' || req.query.download === 'true';
  const researchId = Number(req.query.researchId);
  if (!Number.isSafeInteger(researchId) || researchId <= 0) return res.status(400).send('A saved catalog search is required to create this brief.');
  try {
    const analysis = await loadSavedAnalysis(req, researchId);
    if (!analysis) return res.status(404).send('Saved catalog research was not found for this account.');
    const trackId = String(req.query.trackId || '');
    if (trackId && !analysis.catalog.revivedTracks.some(track => track.id === trackId)) {
      return res.status(404).send('This recording is not part of the saved search.');
    }
    const briefAnalysis = trackId
      ? { ...analysis, catalog: { ...analysis.catalog, revivedTracks: analysis.catalog.revivedTracks.filter(track => track.id === trackId) } }
      : analysis;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `${wantDownload ? 'attachment' : 'inline'}; filename="Boostify_Catalog_Research.pdf"`);
    res.send(buildBriefPdf(briefAnalysis));
  } catch (error) {
    console.error('[LegacyCatalogResurrection] PDF brief failed:', error);
    return res.status(503).send('Saved catalog research is temporarily unavailable.');
  }
});

export default router;
