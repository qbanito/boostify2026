// Ver estructura de la tabla leads
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
  });
  
  await client.connect();
  
  const result = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'leads'
    ORDER BY ordinal_position
  `);
  
  console.log('📋 Columnas de la tabla leads:');
  for (const row of result.rows) {
    console.log(`   ${row.column_name}: ${row.data_type}`);
  }
  
  await client.end();
}

main();
