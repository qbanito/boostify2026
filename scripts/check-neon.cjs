// Verificar conteo de artistas en Neon DB (la principal de la app)
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_BiY1wlQ4mpgR@ep-silent-silence-ad6swgqg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
  });
  
  await client.connect();
  
  console.log('📋 Conteos en Neon DB (app principal):');
  
  // Contar artistas de diferentes tablas
  const queries = [
    { name: 'users', sql: 'SELECT COUNT(*) FROM users' },
    { name: 'artist_profiles', sql: 'SELECT COUNT(*) FROM artist_profiles' },
    { name: 'btf_2300_tokens', sql: 'SELECT COUNT(*) FROM btf_2300_tokens' },
    { name: 'songs', sql: 'SELECT COUNT(*) FROM songs' },
  ];
  
  for (const q of queries) {
    try {
      const result = await client.query(q.sql);
      console.log(`   ${q.name}: ${result.rows[0].count}`);
    } catch (e) {
      console.log(`   ${q.name}: No existe`);
    }
  }
  
  // Ver todas las tablas
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log('\n📋 Todas las tablas:');
  console.log(tables.rows.map(r => r.table_name).join(', '));
  
  await client.end();
}

main();
