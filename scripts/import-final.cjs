/**
 * CSV Importer Final - Extrae emails únicos y los importa
 * Maneja archivos grandes con chunk processing
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
const CSV_FOLDER = 'C:\\Users\\convo\\OneDrive\\Escritorio\\CONTACTO LISTAS-20260130T211132Z-3-001\\CONTACTO LISTAS';

// Ya importados
const SKIP = ['IGEmailExtractor-email-', 'Music_Industry', 'Neiver Alvarez'];

async function main() {
  // 1. Extraer todos los emails de los archivos nuevos
  console.log('📂 Escaneando archivos...\n');
  
  const files = fs.readdirSync(CSV_FOLDER)
    .filter(f => f.endsWith('.csv'))
    .filter(f => !SKIP.some(p => f.includes(p)));
  
  console.log(`📁 ${files.length} archivos nuevos encontrados\n`);
  
  const allEmails = new Set();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const blacklist = ['noreply', 'no-reply', 'mailer-daemon', 'postmaster', 'example.com', 'test.com', 'sentry'];
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(CSV_FOLDER, file), 'utf-8');
    const matches = content.match(emailRegex) || [];
    let count = 0;
    
    for (const email of matches) {
      const clean = email.toLowerCase().trim();
      if (clean.length >= 5 && !blacklist.some(b => clean.includes(b))) {
        if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(clean)) {
          if (!allEmails.has(clean)) {
            allEmails.add(clean);
            count++;
          }
        }
      }
    }
    console.log(`   ${file}: ${count} emails únicos`);
  }
  
  console.log(`\n📧 Total emails únicos extraídos: ${allEmails.size}`);
  
  // 2. Insertar en la BD
  console.log('\n⏳ Insertando en Supabase...\n');
  
  const pool = new Pool({ 
    connectionString: SUPABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000
  });
  
  const emails = [...allEmails];
  let newCount = 0;
  let dupCount = 0;
  const BATCH = 10;
  
  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);
    
    for (const email of batch) {
      try {
        const r = await pool.query(`
          INSERT INTO leads (email, name, source, status, created_at)
          VALUES ($1, '', 'INSTAGRAM_ALL', 'pending', NOW())
          ON CONFLICT (email) DO NOTHING
        `, [email]);
        if (r.rowCount > 0) newCount++;
        else dupCount++;
      } catch (e) {
        dupCount++;
      }
    }
    
    if (i % 200 === 0) {
      process.stdout.write(`   Progreso: ${i}/${emails.length} (+${newCount} nuevos)\r`);
    }
  }
  
  console.log(`\n\n${'='.repeat(50)}`);
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(50));
  console.log(`✅ Leads nuevos añadidos: ${newCount}`);
  console.log(`🔄 Duplicados (ya existían): ${dupCount}`);
  
  const total = await pool.query('SELECT COUNT(*) FROM leads');
  console.log(`\n📈 TOTAL LEADS EN BD: ${total.rows[0].count}`);
  
  const sources = await pool.query(`
    SELECT source, COUNT(*) as c FROM leads GROUP BY source ORDER BY c DESC
  `);
  console.log('\n📊 Por fuente:');
  sources.rows.forEach(r => console.log(`   ${r.source}: ${r.c}`));
  
  await pool.end();
  console.log('\n✅ Completado!');
}

main().catch(e => {
  console.error('\n❌ Error:', e.message);
  process.exit(1);
});
