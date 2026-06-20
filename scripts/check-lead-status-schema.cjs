// Check lead_status schema
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
  });
  
  await client.connect();
  
  const result = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'lead_status'
    ORDER BY ordinal_position
  `);
  
  console.log('📋 Columnas de la tabla lead_status:');
  for (const row of result.rows) {
    console.log(`   ${row.column_name}: ${row.data_type}`);
  }
  
  await client.end();
}

main();
