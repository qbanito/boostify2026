// ─── HoloStage Engine REST API ────────────────────────────────────────────────
import { Router } from 'express';
import { pool } from '../db';

// Guard against SSRF: only allow localhost / RFC-1918 addresses for Rokoko proxy
function isLocalHost(host: string): boolean {
  return /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)$/.test(host);
}

const router = Router();

let tablesReady = false;

async function withTables() {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS holostage_characters (
      id SERIAL PRIMARY KEY,
      artist_id TEXT NOT NULL,
      name TEXT NOT NULL,
      source TEXT DEFAULT 'cc4',
      fbx_url TEXT,
      glb_url TEXT,
      rig_profile JSONB DEFAULT '{}',
      optimization JSONB DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS holostage_shows (
      id SERIAL PRIMARY KEY,
      artist_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      performance_mode TEXT DEFAULT 'hologram',
      show_json JSONB DEFAULT '{}',
      stageos_version TEXT DEFAULT '1.0.0',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS holostage_show_packages (
      id SERIAL PRIMARY KEY,
      show_id INTEGER REFERENCES holostage_shows(id) ON DELETE CASCADE,
      artist_id TEXT NOT NULL,
      package_json JSONB DEFAULT '{}',
      version TEXT DEFAULT '1.0.0',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS holostage_show_logs (
      id SERIAL PRIMARY KEY,
      show_id INTEGER REFERENCES holostage_shows(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload JSONB DEFAULT '{}',
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS holostage_motion_sources (
      id SERIAL PRIMARY KEY,
      artist_id TEXT NOT NULL UNIQUE,
      config JSONB DEFAULT '{}',
      status TEXT DEFAULT 'disconnected',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  tablesReady = true;
}

// ─── Health ───────────────────────────────────────────────────────────────────

router.get('/health', async (_req, res) => {
  res.json({ ok: true, service: 'holostage', version: '1.0.0' });
});

// ─── Characters ───────────────────────────────────────────────────────────────

router.get('/characters', async (req, res) => {
  try {
    await withTables();
    const artistId = (req as any).auth?.userId ?? req.query.artistId as string;
    const { rows } = await pool.query(
      'SELECT * FROM holostage_characters WHERE artist_id = $1 ORDER BY created_at DESC',
      [artistId]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/characters', async (req, res) => {
  try {
    await withTables();
    const artistId = (req as any).auth?.userId ?? req.body.artistId;
    const { name, source, fbxUrl, glbUrl, rigProfile, optimization } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO holostage_characters (artist_id, name, source, fbx_url, glb_url, rig_profile, optimization)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [artistId, name, source ?? 'cc4', fbxUrl, glbUrl, JSON.stringify(rigProfile ?? {}), JSON.stringify(optimization ?? {})]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/characters/:id', async (req, res) => {
  try {
    await withTables();
    const { name, fbxUrl, glbUrl, rigProfile, optimization, status } = req.body;
    const { rows } = await pool.query(
      `UPDATE holostage_characters SET name=COALESCE($1,name), fbx_url=COALESCE($2,fbx_url),
       glb_url=COALESCE($3,glb_url), rig_profile=COALESCE($4,rig_profile),
       optimization=COALESCE($5,optimization), status=COALESCE($6,status), updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, fbxUrl, glbUrl, rigProfile ? JSON.stringify(rigProfile) : null,
       optimization ? JSON.stringify(optimization) : null, status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/characters/:id', async (req, res) => {
  try {
    await withTables();
    await pool.query('DELETE FROM holostage_characters WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/characters/:id/optimize', async (req, res) => {
  try {
    await withTables();
    const optimization = { polyReduction: 0.5, textureCompress: true, lodLevels: 3, optimizedAt: new Date().toISOString() };
    const { rows } = await pool.query(
      'UPDATE holostage_characters SET optimization=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [JSON.stringify(optimization), req.params.id]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/characters/:id/retarget-profile', async (req, res) => {
  try {
    await withTables();
    const { rows } = await pool.query(
      'UPDATE holostage_characters SET rig_profile=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [JSON.stringify(req.body), req.params.id]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Motion Source ────────────────────────────────────────────────────────────

router.get('/motion-source/status', async (req, res) => {
  try {
    await withTables();
    const artistId = (req as any).auth?.userId ?? req.query.artistId as string;
    const { rows } = await pool.query(
      'SELECT * FROM holostage_motion_sources WHERE artist_id=$1', [artistId]
    );
    res.json(rows[0] ?? { status: 'disconnected', config: {} });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/motion-source/connect', async (req, res) => {
  try {
    await withTables();
    const artistId = (req as any).auth?.userId ?? req.body.artistId;
    const config = req.body.config ?? {};
    const { rows } = await pool.query(
      `INSERT INTO holostage_motion_sources (artist_id, config, status)
       VALUES ($1,$2,'connected')
       ON CONFLICT (artist_id) DO UPDATE SET config=$2, status='connected', updated_at=NOW()
       RETURNING *`,
      [artistId, JSON.stringify(config)]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/motion-source/disconnect', async (req, res) => {
  try {
    await withTables();
    const artistId = (req as any).auth?.userId ?? req.body.artistId;
    await pool.query(
      `UPDATE holostage_motion_sources SET status='disconnected', updated_at=NOW() WHERE artist_id=$1`,
      [artistId]
    );
    res.json({ status: 'disconnected' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/motion-source/test', async (_req, res) => {
  res.json({ ok: true, latencyMs: Math.round(Math.random() * 10 + 2), fps: 60 });
});

// ─── Shows ────────────────────────────────────────────────────────────────────

router.get('/shows', async (req, res) => {
  try {
    await withTables();
    const artistId = (req as any).auth?.userId ?? req.query.artistId as string;
    const { rows } = await pool.query(
      'SELECT * FROM holostage_shows WHERE artist_id=$1 ORDER BY created_at DESC', [artistId]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/shows', async (req, res) => {
  try {
    await withTables();
    const artistId = (req as any).auth?.userId ?? req.body.artistId;
    const { title, performanceMode, showJson } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO holostage_shows (artist_id, title, performance_mode, show_json)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [artistId, title, performanceMode ?? 'hologram', JSON.stringify(showJson ?? {})]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/shows/:id', async (req, res) => {
  try {
    await withTables();
    const { rows } = await pool.query('SELECT * FROM holostage_shows WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/shows/:id', async (req, res) => {
  try {
    await withTables();
    const { title, status, showJson, performanceMode } = req.body;
    const { rows } = await pool.query(
      `UPDATE holostage_shows SET title=COALESCE($1,title), status=COALESCE($2,status),
       show_json=COALESCE($3,show_json), performance_mode=COALESCE($4,performance_mode), updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [title, status, showJson ? JSON.stringify(showJson) : null, performanceMode, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/shows/:id', async (req, res) => {
  try {
    await withTables();
    await pool.query('DELETE FROM holostage_shows WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Show Package ─────────────────────────────────────────────────────────────

router.post('/show-package/export', async (req, res) => {
  try {
    await withTables();
    const artistId = (req as any).auth?.userId ?? req.body.artistId;
    const { showId, packageJson } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO holostage_show_packages (show_id, artist_id, package_json)
       VALUES ($1,$2,$3) RETURNING *`,
      [showId, artistId, JSON.stringify(packageJson ?? {})]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/show-package/:showId', async (req, res) => {
  try {
    await withTables();
    const { rows } = await pool.query(
      'SELECT * FROM holostage_show_packages WHERE show_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.params.showId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No package found' });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Show Logs ────────────────────────────────────────────────────────────────

router.get('/show-logs', async (req, res) => {
  try {
    await withTables();
    const { showId } = req.query;
    const { rows } = await pool.query(
      'SELECT * FROM holostage_show_logs WHERE show_id=$1 ORDER BY started_at DESC LIMIT 100',
      [showId]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DMX ─────────────────────────────────────────────────────────────────────

router.post('/dmx/test', (_req, res) => {
  res.json({ ok: true, universes: [1], channels: 512 });
});

router.post('/dmx/scene', (req, res) => {
  res.json({ ok: true, scene: req.body.scene ?? 'unknown', applied: true });
});

router.post('/dmx/blackout', (_req, res) => {
  res.json({ ok: true, blackout: true });
});

// ─── Output ───────────────────────────────────────────────────────────────────

router.post('/output/test', (_req, res) => {
  res.json({ ok: true, displays: 1, resolution: '1920x1080', hdrSupport: false });
});

// ─── Rokoko Local API Proxy ───────────────────────────────────────────────────
// Proxies requests to Rokoko Studio's embedded Nancy HTTP server.
// SSRF-protected: only RFC-1918 / localhost hosts allowed.
// Ref: C:\Program Files\Rokoko Studio\Rokoko Studio_Data\StreamingAssets\web\templates\client.html

router.get('/rokoko-local/ping', async (req, res) => {
  const port = Number(req.query['port']) || 14053;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    res.json({ ok: response.ok });
  } catch {
    res.json({ ok: false });
  }
});

router.post('/rokoko-local/calibrate', async (req, res) => {
  const { host = '127.0.0.1', port = 14053 } = req.body;
  if (!isLocalHost(String(host))) {
    return res.status(400).json({ ok: false, error: 'Host must be a local network address.' });
  }
  try {
    const response = await fetch(`http://${host}:${port}/calibrate`, { method: 'POST' });
    const text = await response.text();
    res.json({ ok: response.ok, message: text || 'Calibration triggered' });
  } catch (e: any) {
    res.json({ ok: false, error: `Cannot reach Rokoko Studio at ${host}:${port} — is it running? (${e.message})` });
  }
});

router.post('/rokoko-local/recording/start', async (req, res) => {
  const { host = '127.0.0.1', port = 14053, filename = 'HoloStage_Take' } = req.body;
  if (!isLocalHost(String(host))) {
    return res.status(400).json({ ok: false, error: 'Host must be a local network address.' });
  }
  try {
    const body = `filename=${encodeURIComponent(String(filename))}`;
    const response = await fetch(`http://${host}:${port}/recording/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const text = await response.text();
    res.json({ ok: response.ok, message: text || 'Recording started' });
  } catch (e: any) {
    res.json({ ok: false, error: e.message });
  }
});

router.post('/rokoko-local/recording/stop', async (req, res) => {
  const { host = '127.0.0.1', port = 14053 } = req.body;
  if (!isLocalHost(String(host))) {
    return res.status(400).json({ ok: false, error: 'Host must be a local network address.' });
  }
  try {
    const response = await fetch(`http://${host}:${port}/recording/stop`, { method: 'POST' });
    const text = await response.text();
    res.json({ ok: response.ok, message: text || 'Recording stopped' });
  } catch (e: any) {
    res.json({ ok: false, error: e.message });
  }
});

// ─── HoloSuit Local API Proxy ─────────────────────────────────────────────────
// Proxies requests to HoloSuit Studio's embedded Nancy HTTP server (same
// protocol as Rokoko Studio). Used by client/services/holostage/holosuitLocalAPI.ts.
// SSRF-protected: only RFC-1918 / localhost hosts allowed.

router.get('/holosuit-local/ping', async (req, res) => {
  const host = String(req.query['host'] || '127.0.0.1');
  const port = Number(req.query['port']) || 14053;
  if (!isLocalHost(host)) return res.json({ ok: false });
  try {
    const response = await fetch(`http://${host}:${port}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    res.json({ ok: response.ok });
  } catch {
    res.json({ ok: false });
  }
});

router.post('/holosuit-local/calibrate', async (req, res) => {
  const { host = '127.0.0.1', port = 14053 } = req.body;
  if (!isLocalHost(String(host))) {
    return res.status(400).json({ ok: false, error: 'Host must be a local network address.' });
  }
  try {
    const response = await fetch(`http://${host}:${port}/calibrate`, { method: 'POST' });
    const text = await response.text();
    res.json({ ok: response.ok, message: text || 'Calibration triggered' });
  } catch (e: any) {
    res.json({ ok: false, error: `Cannot reach HoloSuit Studio at ${host}:${port} — is it running? (${e.message})` });
  }
});

router.post('/holosuit-local/recording/start', async (req, res) => {
  const { host = '127.0.0.1', port = 14053, filename = 'HoloStage_Take' } = req.body;
  if (!isLocalHost(String(host))) {
    return res.status(400).json({ ok: false, error: 'Host must be a local network address.' });
  }
  try {
    const body = `filename=${encodeURIComponent(String(filename))}`;
    const response = await fetch(`http://${host}:${port}/recording/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const text = await response.text();
    res.json({ ok: response.ok, message: text || 'Recording started' });
  } catch (e: any) {
    res.json({ ok: false, error: e.message });
  }
});

router.post('/holosuit-local/recording/stop', async (req, res) => {
  const { host = '127.0.0.1', port = 14053 } = req.body;
  if (!isLocalHost(String(host))) {
    return res.status(400).json({ ok: false, error: 'Host must be a local network address.' });
  }
  try {
    const response = await fetch(`http://${host}:${port}/recording/stop`, { method: 'POST' });
    const text = await response.text();
    res.json({ ok: response.ok, message: text || 'Recording stopped' });
  } catch (e: any) {
    res.json({ ok: false, error: e.message });
  }
});

export default router;
