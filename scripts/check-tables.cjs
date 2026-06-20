// Verificar tablas y conteos
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
  });
  
  await client.connect();
  
  // Ver tablas
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log('📋 Tablas disponibles:');
  console.log(tables.rows.map(r => r.table_name).join(', '));
  
  // Buscar tablas con "artist" o "user"
  const artistTables = tables.rows.filter(r => 
    r.table_name.includes('artist') || r.table_name.includes('user')
  );
  
  console.log('\n📊 Conteos:');
  for (const t of artistTables) {
    try {
      const count = await client.query(`SELECT COUNT(*) FROM "${t.table_name}"`);
      console.log(`   ${t.table_name}: ${count.rows[0].count}`);
    } catch (e) {
      console.log(`   ${t.table_name}: Error - ${e.message}`);
    }
  }
  
  await client.end();
}

main();
