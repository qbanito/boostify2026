import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function checkImages() {
  console.log('Verificando imágenes de Luis Gomes (ID 42)...\n');
  
  const results = await sql`
    SELECT id, artist_name as name, profile_image, cover_image 
    FROM users 
    WHERE id = 42
  `;
  
  console.log(`Total artistas encontrados: ${results.length}\n`);
  
  for (const artist of results) {
    console.log(`ID: ${artist.id} - ${artist.name}`);
    console.log(`  Profile: ${artist.profile_image || 'NULL'}`);
    console.log(`  Cover: ${artist.cover_image || 'NULL'}`);
    console.log('');
  }
}

checkImages().catch(console.error);
