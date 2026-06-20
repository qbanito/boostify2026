/**
 * Bulk Importer - Corregido para la estructura real de la tabla
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
const CSV_FOLDER = 'C:\\Users\\convo\\OneDrive\\Escritorio\\CONTACTO LISTAS-20260130T211132Z-3-001\\CONTACTO LISTAS';

const SKIP = ['IGEmailExtractor-email-', 'Music_Industry', 'Neiver Alvarez'];

async function run() {
  // 1. Extraer emails
  console.log('📂 Extrayendo emails de 29 archivos...\n');
  
  const files = fs.readdirSync(CSV_FOLDER)
    .filter(f => f.endsWith('.csv'))
    .filter(f => !SKIP.some(p => f.includes(p)));
  
  const allEmails = new Set();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const blacklist = ['noreply', 'no-reply', 'mailer-daemon', 'postmaster', 'example.', 'test.'];
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(CSV_FOLDER, file), 'utf-8');
    const matches = content.match(emailRegex) || [];
    for (const email of matches) {
      const clean = email.toLowerCase().trim();
      if (clean.length >= 5 && !blacklist.some(b => clean.includes(b))) {
        allEmails.add(clean);
      }
    }
  }
  
  const emails = [...allEmails];
  console.log(`📧 Total emails únicos: ${emails.length}\n`);
  
  // 2. Conectar y procesar en chunks de 500
  const CHUNK = 500;
  let totalNew = 0;
  let totalDup = 0;
  
  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    console.log(`⏳ Procesando chunk ${Math.floor(i/CHUNK)+1}/${Math.ceil(emails.length/CHUNK)} (${chunk.length} emails)...`);
    
    const client = new Client({ connectionString: SUPABASE_URL });
    
    try {
      await client.connect();
      
      // INSERT con estructura correcta de la tabla
      const result = await client.query(`
        INSERT INTO leads (email, source, created_at)
        SELECT e, 'INSTAGRAM_ALL', NOW()
        FROM UNNEST($1::text[]) AS e
        ON CONFLICT (email) DO NOTHING
      `, [chunk]);
      
      const newCount = result.rowCount;
      const dupCount = chunk.length - newCount;
      
      totalNew += newCount;
      totalDup += dupCount;
      
      console.log(`   ✅ +${newCount} nuevos, ${dupCount} dups`);
      
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      // Fallback: insertar uno por uno
      let chunkNew = 0, chunkDup = 0;
      for (const email of chunk) {
        try {
          const r = await client.query(`
            INSERT INTO leads (email, source, created_at)
            VALUES ($1, 'INSTAGRAM_ALL', NOW())
            ON CONFLICT (email) DO NOTHING
          `, [email]);
          if (r.rowCount > 0) chunkNew++;
          else chunkDup++;
        } catch (e) {
          chunkDup++;
        }
      }
      totalNew += chunkNew;
      totalDup += chunkDup;
      console.log(`   ✅ (fallback) +${chunkNew} nuevos, ${chunkDup} dups`);
    }
    
    await client.end();
  }
  
  // 3. Mostrar resumen
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(50));
  console.log(`✅ Leads nuevos: ${totalNew}`);
  console.log(`🔄 Duplicados: ${totalDup}`);
  
  // Obtener total
  const client = new Client({ connectionString: SUPABASE_URL });
  await client.connect();
  const total = await client.query('SELECT COUNT(*) FROM leads');
  const sources = await client.query(`SELECT source, COUNT(*) as c FROM leads GROUP BY source ORDER BY c DESC`);
  
  console.log(`\n📈 TOTAL EN BD: ${total.rows[0].count}`);
  console.log('\n📊 Por fuente:');
  sources.rows.forEach(r => console.log(`   ${r.source}: ${r.c}`));
  
  await client.end();
  console.log('\n✅ ¡Completado!');
}

run().catch(e => console.error('Error:', e.message));
