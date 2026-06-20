import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    // Upsert sofia-quince-2026 demo event
    const result = await client.query(`
      INSERT INTO cinematic_event_landings (
        slug, owner_user_id, event_title, event_subtitle, event_type,
        tier, status, access_mode,
        event_date, event_location, honoree_name,
        feature_rsvp, feature_photo_booth, feature_soundtrack,
        feature_ai_scenes, feature_gallery, feature_memory_book, feature_after_movie,
        primary_color, accent_color, theme_preset, published_at
      ) VALUES (
        'sofia-quince-2026',
        NULL,
        'Los XV de Sofía',
        'Una noche que se convierte en película',
        'quinceanera',
        'gold',
        'published',
        'open',
        '2026-12-20 22:00:00',
        'Gran Salón Imperial, CDMX',
        'Sofía Ramírez',
        true, true, true,
        true, true, true, false,
        '#1a0533', '#c9a84c', 'dark_luxury', NOW()
      )
      ON CONFLICT (slug) DO UPDATE SET
        status = 'published',
        event_title = EXCLUDED.event_title,
        published_at = COALESCE(cinematic_event_landings.published_at, NOW())
      RETURNING id, slug, event_title
    `);

    console.log('✅ Demo event inserted:', result.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
