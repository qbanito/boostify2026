// ─── Boostify AI Character Forge — Backend API ────────────────────────────────
// REST endpoints for character management, analysis pipeline and StageOS export.
// Uses lazy-init pattern (same as holostage.ts) for DB tables.

import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

// ─── Lazy table init ──────────────────────────────────────────────────────────

let tablesReady = false;

async function withTables(): Promise<void> {
  if (tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS base_characters (
      id                    TEXT PRIMARY KEY,
      name                  TEXT NOT NULL,
      gender_presentation   TEXT NOT NULL DEFAULT 'male',
      body_type             TEXT NOT NULL,
      age_range             TEXT NOT NULL,
      skeleton_type         TEXT NOT NULL DEFAULT 'character_creator_humanoid',
      rig_type              TEXT NOT NULL DEFAULT 'cc4_standard',
      blendshape_set        TEXT NOT NULL DEFAULT 'cc4_facial_extended',
      polygon_count         INTEGER NOT NULL DEFAULT 65000,
      texture_resolution    TEXT NOT NULL DEFAULT '4K',
      compatible_with_rokoko  BOOLEAN NOT NULL DEFAULT TRUE,
      compatible_with_stageos BOOLEAN NOT NULL DEFAULT TRUE,
      base_fbx_url          TEXT,
      base_glb_url          TEXT,
      thumbnail_url         TEXT,
      tags                  JSONB DEFAULT '[]',
      created_at            TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS artist_reference_images (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      artist_id        TEXT NOT NULL,
      image_type       TEXT NOT NULL,
      image_url        TEXT NOT NULL,
      analysis_status  TEXT NOT NULL DEFAULT 'pending',
      analysis_result  JSONB,
      uploaded_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS character_identities (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      artist_id        TEXT NOT NULL,
      identity_json    JSONB NOT NULL,
      confidence_score FLOAT DEFAULT 0,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS generated_characters (
      id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      artist_id          TEXT NOT NULL,
      base_character_id  TEXT NOT NULL,
      name               TEXT NOT NULL DEFAULT 'AI Character',
      status             TEXT NOT NULL DEFAULT 'analyzing',
      current_version    TEXT NOT NULL DEFAULT '1.0.0',
      quality_score      INTEGER DEFAULT 0,
      stageos_ready      BOOLEAN DEFAULT FALSE,
      rokoko_ready       BOOLEAN DEFAULT FALSE,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      updated_at         TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS character_morph_profiles (
      id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      character_id      TEXT NOT NULL,
      base_character_id TEXT NOT NULL,
      morph_json        JSONB NOT NULL,
      protected_zones   JSONB NOT NULL DEFAULT '{}',
      editable_zones    JSONB NOT NULL DEFAULT '{}',
      created_at        TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS character_rig_profiles (
      id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      character_id        TEXT NOT NULL UNIQUE,
      skeleton_map        JSONB DEFAULT '{}',
      skin_weights_status TEXT DEFAULT 'valid',
      blendshape_map      JSONB DEFAULT '{}',
      face_map            JSONB DEFAULT '{}',
      hand_map            JSONB DEFAULT '{}',
      rig_status          TEXT DEFAULT 'valid',
      created_at          TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rokoko_profiles (
      id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      character_id      TEXT NOT NULL UNIQUE,
      body_map          JSONB NOT NULL DEFAULT '{}',
      hand_map          JSONB NOT NULL DEFAULT '{}',
      face_map          JSONB NOT NULL DEFAULT '{}',
      calibration_profile JSONB DEFAULT '{}',
      latency_profile   JSONB DEFAULT '{}',
      fallback_profile  JSONB DEFAULT '{}',
      created_at        TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS character_quality_reports (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      character_id TEXT NOT NULL UNIQUE,
      score        INTEGER NOT NULL DEFAULT 0,
      report_json  JSONB NOT NULL DEFAULT '{}',
      issues       JSONB DEFAULT '[]',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS stageos_character_packages (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      character_id  TEXT NOT NULL UNIQUE,
      artist_id     TEXT NOT NULL,
      package_json  JSONB NOT NULL DEFAULT '{}',
      version       TEXT NOT NULL DEFAULT '1.0.0',
      stageos_ready BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Seed base characters if empty
  const { rows } = await pool.query('SELECT COUNT(*) FROM base_characters');
  if (parseInt(rows[0].count) === 0) {
    const bases = [
      { id: 'cc4_male_slim_athletic_001',  name: 'CC4 Male Slim Athletic',  gender: 'male',    body: 'slim_athletic', age: 'young_adult' },
      { id: 'cc4_male_average_001',        name: 'CC4 Male Average',        gender: 'male',    body: 'average',       age: 'adult' },
      { id: 'cc4_male_muscular_001',       name: 'CC4 Male Muscular',       gender: 'male',    body: 'muscular',      age: 'adult' },
      { id: 'cc4_female_slim_001',         name: 'CC4 Female Slim',         gender: 'female',  body: 'slim',          age: 'young_adult' },
      { id: 'cc4_female_athletic_001',     name: 'CC4 Female Athletic',     gender: 'female',  body: 'slim_athletic', age: 'adult' },
      { id: 'cc4_neutral_slim_001',        name: 'CC4 Neutral Slim',        gender: 'neutral', body: 'slim',          age: 'young_adult' },
    ];
    for (const b of bases) {
      await pool.query(
        `INSERT INTO base_characters (id, name, gender_presentation, body_type, age_range, tags)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        [b.id, b.name, b.gender, b.body, b.age, JSON.stringify([b.gender, b.body, 'stage_ready', 'rokoko_ready', 'cc4'])],
      );
    }
  }

  tablesReady = true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(res: Response, data: unknown) {
  res.json({ success: true, data });
}
function fail(res: Response, status: number, message: string) {
  res.status(status).json({ success: false, error: message });
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

// GET /api/character-forge/base-characters
router.get('/base-characters', async (_req: Request, res: Response) => {
  try {
    await withTables();
    const { rows } = await pool.query('SELECT * FROM base_characters ORDER BY created_at ASC');
    ok(res, rows);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// POST /api/character-forge/reference-images/upload
router.post('/reference-images/upload', async (req: Request, res: Response) => {
  try {
    await withTables();
    const { artist_id, image_type, image_url } = req.body;
    if (!artist_id || !image_type || !image_url) return fail(res, 400, 'artist_id, image_type and image_url required');
    const { rows } = await pool.query(
      `INSERT INTO artist_reference_images (artist_id, image_type, image_url, analysis_status)
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [artist_id, image_type, image_url],
    );
    ok(res, rows[0]);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// POST /api/character-forge/analyze-images
// In MVP 1 this stores the identity JSON from the frontend mock analysis.
router.post('/analyze-images', async (req: Request, res: Response) => {
  try {
    await withTables();
    const { artist_id, identity_json, confidence_score } = req.body;
    if (!artist_id || !identity_json) return fail(res, 400, 'artist_id and identity_json required');
    const { rows } = await pool.query(
      `INSERT INTO character_identities (artist_id, identity_json, confidence_score)
       VALUES ($1, $2, $3) RETURNING *`,
      [artist_id, JSON.stringify(identity_json), confidence_score ?? 0.7],
    );
    ok(res, rows[0]);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// POST /api/character-forge/match-base-character
router.post('/match-base-character', async (req: Request, res: Response) => {
  try {
    await withTables();
    const { body_type, gender_presentation } = req.body;
    const { rows } = await pool.query(
      `SELECT * FROM base_characters
       WHERE body_type = $1 AND (gender_presentation = $2 OR gender_presentation = 'neutral')
       ORDER BY CASE WHEN gender_presentation = $2 THEN 0 ELSE 1 END
       LIMIT 3`,
      [body_type ?? 'slim_athletic', gender_presentation ?? 'male'],
    );
    ok(res, { recommended: rows[0] ?? null, alternatives: rows.slice(1) });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// POST /api/character-forge/generate-morph-profile
router.post('/generate-morph-profile', async (req: Request, res: Response) => {
  try {
    await withTables();
    const { character_id, base_character_id, morph_json, protected_zones, editable_zones } = req.body;
    if (!character_id || !base_character_id || !morph_json) return fail(res, 400, 'character_id, base_character_id and morph_json required');
    const { rows } = await pool.query(
      `INSERT INTO character_morph_profiles (character_id, base_character_id, morph_json, protected_zones, editable_zones)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [character_id, base_character_id, JSON.stringify(morph_json), JSON.stringify(protected_zones ?? {}), JSON.stringify(editable_zones ?? {})],
    );
    ok(res, rows[0]);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// POST /api/character-forge/apply-morph
// MVP 1: Stores the applied morph state — no actual geometry mutation yet.
router.post('/apply-morph', async (req: Request, res: Response) => {
  try {
    await withTables();
    const { character_id, morph_profile_id } = req.body;
    if (!character_id) return fail(res, 400, 'character_id required');
    await pool.query(
      `UPDATE generated_characters SET status = 'morphing', updated_at = NOW() WHERE id = $1`,
      [character_id],
    );
    // Simulate processing — in MVP2+ this calls the geometry engine
    await pool.query(
      `UPDATE generated_characters SET status = 'texturing', updated_at = NOW() WHERE id = $1`,
      [character_id],
    );
    ok(res, { character_id, morph_profile_id, status: 'morph_applied' });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// POST /api/character-forge/validate-rig
router.post('/validate-rig', async (req: Request, res: Response) => {
  try {
    await withTables();
    const { character_id, validation_result } = req.body;
    if (!character_id || !validation_result) return fail(res, 400, 'character_id and validation_result required');
    await pool.query(
      `INSERT INTO character_rig_profiles (character_id, rig_status, face_map, hand_map)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (character_id) DO UPDATE
       SET rig_status = EXCLUDED.rig_status, face_map = EXCLUDED.face_map, hand_map = EXCLUDED.hand_map`,
      [character_id, validation_result.rig_status, JSON.stringify({}), JSON.stringify({})],
    );
    ok(res, { character_id, rig_status: validation_result.rig_status });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// POST /api/character-forge/build-rokoko-profile
router.post('/build-rokoko-profile', async (req: Request, res: Response) => {
  try {
    await withTables();
    const { character_id, body_map, hand_map, face_map, calibration } = req.body;
    if (!character_id) return fail(res, 400, 'character_id required');
    const { rows } = await pool.query(
      `INSERT INTO rokoko_profiles (character_id, body_map, hand_map, face_map, calibration_profile)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (character_id) DO UPDATE
       SET body_map = EXCLUDED.body_map, hand_map = EXCLUDED.hand_map, face_map = EXCLUDED.face_map, calibration_profile = EXCLUDED.calibration_profile
       RETURNING *`,
      [character_id, JSON.stringify(body_map ?? {}), JSON.stringify(hand_map ?? {}), JSON.stringify(face_map ?? {}), JSON.stringify(calibration ?? {})],
    );
    ok(res, rows[0]);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// POST /api/character-forge/generate-quality-report
router.post('/generate-quality-report', async (req: Request, res: Response) => {
  try {
    await withTables();
    const { character_id, report } = req.body;
    if (!character_id || !report) return fail(res, 400, 'character_id and report required');
    const { rows } = await pool.query(
      `INSERT INTO character_quality_reports (character_id, score, report_json, issues)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (character_id) DO UPDATE SET score = EXCLUDED.score, report_json = EXCLUDED.report_json, issues = EXCLUDED.issues
       RETURNING *`,
      [character_id, report.character_quality_score ?? 0, JSON.stringify(report), JSON.stringify(report.issues ?? [])],
    );
    // Update character status
    const ready = (report.character_quality_score ?? 0) >= 70;
    await pool.query(
      `UPDATE generated_characters SET quality_score = $1, stageos_ready = $2, status = $3, updated_at = NOW() WHERE id = $4`,
      [report.character_quality_score, ready, ready ? 'ready' : 'validating', character_id],
    );
    ok(res, rows[0]);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// POST /api/character-forge/export-stageos-package
router.post('/export-stageos-package', async (req: Request, res: Response) => {
  try {
    await withTables();
    const { character_id, artist_id, package_json } = req.body;
    if (!character_id || !artist_id || !package_json) return fail(res, 400, 'character_id, artist_id and package_json required');
    // Enforce quality gate
    const { rows: qRows } = await pool.query('SELECT score FROM character_quality_reports WHERE character_id = $1', [character_id]);
    if (qRows.length > 0 && qRows[0].score < 70) {
      return fail(res, 422, `Quality score ${qRows[0].score} is below minimum threshold of 70. Cannot export to StageOS.`);
    }
    const { rows } = await pool.query(
      `INSERT INTO stageos_character_packages (character_id, artist_id, package_json, stageos_ready)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (character_id) DO UPDATE SET package_json = EXCLUDED.package_json, stageos_ready = TRUE
       RETURNING *`,
      [character_id, artist_id, JSON.stringify(package_json)],
    );
    await pool.query(`UPDATE generated_characters SET status = 'exported', updated_at = NOW() WHERE id = $1`, [character_id]);
    ok(res, rows[0]);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// GET /api/character-forge/characters/:artistId
router.get('/characters/:artistId', async (req: Request, res: Response) => {
  try {
    await withTables();
    const { rows } = await pool.query(
      `SELECT * FROM generated_characters WHERE artist_id = $1 ORDER BY created_at DESC`,
      [req.params.artistId],
    );
    ok(res, rows);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// POST /api/character-forge/characters
router.post('/characters', async (req: Request, res: Response) => {
  try {
    await withTables();
    const { artist_id, base_character_id, name } = req.body;
    if (!artist_id || !base_character_id) return fail(res, 400, 'artist_id and base_character_id required');
    const { rows } = await pool.query(
      `INSERT INTO generated_characters (artist_id, base_character_id, name, status)
       VALUES ($1, $2, $3, 'analyzing') RETURNING *`,
      [artist_id, base_character_id, name ?? 'AI Character'],
    );
    ok(res, rows[0]);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// GET /api/character-forge/health
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await withTables();
    ok(res, { status: 'ok', tables: 'ready', module: 'character-forge' });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// POST /api/character-forge/generate-preview
// Generates a 3D character preview image via Flux Pro (fal-ai/flux-pro/kontext/text-to-image).
router.post('/generate-preview', async (req: Request, res: Response) => {
  try {
    const { character_description, skin_tone, hair_style, wardrobe, gender } = req.body;

    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_AI_KEY || process.env.FAL_API_KEY || '';
    if (!FAL_KEY) return fail(res, 500, 'FAL_KEY not configured');

    const genderLabel = gender === 'female' ? 'female' : gender === 'neutral' ? 'androgynous' : 'male';
    const desc = character_description || 'athletic build, confident performer';
    const prompt = `Photorealistic 3D CGI character render, Character Creator 4 game avatar, ${genderLabel} music artist, ${desc}, ${skin_tone ? `${skin_tone.replace('_', ' ')} skin tone,` : ''} ${hair_style ? `${hair_style} hairstyle,` : ''} ${wardrobe ? `wearing ${wardrobe} stage outfit,` : 'futuristic stage outfit,'} professional studio lighting, dark black background, ultra-detailed, high quality 3D render, holographic performer, game-ready character`;

    const falResponse = await fetch('https://fal.run/fal-ai/flux-pro/kontext/text-to-image', {
      method: 'POST',
      headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, image_size: 'portrait_4_3', num_images: 1, num_inference_steps: 28, guidance_scale: 3.5 }),
    });

    if (!falResponse.ok) {
      const err = await falResponse.text();
      return fail(res, 502, `FAL error: ${err}`);
    }

    const falData = await falResponse.json() as { images?: Array<{ url: string }> };
    const imageUrl = falData?.images?.[0]?.url;
    if (!imageUrl) return fail(res, 502, 'No image returned from FAL');

    ok(res, { image_url: imageUrl, prompt });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

export default router;
