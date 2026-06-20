// Script para verificar merchandise en la base de datos
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkMerch() {
  try {
    // Check artists for user 33
    const artistsResult = await pool.query(`SELECT id, artist_name, is_ai_generated, generated_by FROM users WHERE id = 33 OR generated_by = 33 ORDER BY id`);
    console.log('\n=== ARTISTS FOR USER 33 ===');
    console.log('Count:', artistsResult.rows.length);
    console.log('Data:', JSON.stringify(artistsResult.rows, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkMerch();
