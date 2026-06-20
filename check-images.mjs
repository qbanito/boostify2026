import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://boostimusic_user:m1Tg8HFnCQkdL9V5rFfQg5gZ2ycR4n6u@dpg-cuj6bfdumphs73dtifmg-a.oregon-postgres.render.com/boostimusic',
  ssl: { rejectUnauthorized: false }
});

async function checkImages() {
  try {
    const result = await pool.query(`
      SELECT id, artist_name, profile_image, cover_image, firestore_id 
      FROM users 
      WHERE role = 'artist' OR is_ai_generated = true
      ORDER BY id
      LIMIT 20
    `);
    
    console.log('\n📊 ESTADO DE IMÁGENES DE ARTISTAS EN PRODUCCIÓN:\n');
    console.log('='.repeat(80));
    
    for (const row of result.rows) {
      console.log(`\n🎤 ID: ${row.id} | ${row.artist_name || 'Sin nombre'}`);
      console.log(`   Firestore ID: ${row.firestore_id || 'N/A'}`);
      
      const profileType = analyzeUrl(row.profile_image);
      const coverType = analyzeUrl(row.cover_image);
      
      console.log(`   Profile: ${profileType.icon} ${profileType.type}`);
      if (row.profile_image) console.log(`            ${row.profile_image.substring(0, 70)}...`);
      
      console.log(`   Cover:   ${coverType.icon} ${coverType.type}`);
      if (row.cover_image) console.log(`            ${row.cover_image.substring(0, 70)}...`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('LEYENDA:');
    console.log('  ✅ firebase-storage = URL permanente (funciona)');
    console.log('  ⚠️ fal-temp = URL temporal de FAL (puede expirar)');
    console.log('  ❌ local-upload = /uploads/... (NO funciona en Render)');
    console.log('  ⬜ null = Sin imagen');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

function analyzeUrl(url) {
  if (!url) return { type: 'null', icon: '⬜' };
  if (url.includes('storage.googleapis.com') || url.includes('firebasestorage')) {
    return { type: 'firebase-storage', icon: '✅' };
  }
  if (url.includes('fal.ai') || url.includes('fal.run')) {
    return { type: 'fal-temp', icon: '⚠️' };
  }
  if (url.startsWith('/uploads') || url.includes('/uploads/')) {
    return { type: 'local-upload', icon: '❌' };
  }
  return { type: 'other: ' + url.substring(0, 30), icon: '❓' };
}

checkImages();
