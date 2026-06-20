/**
 * CSV Importer V4 - Procesa un archivo a la vez
 * Uso: node csv-importer-v4.cjs [archivo.csv]
 * Sin argumentos: procesa todos los nuevos
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
const CSV_FOLDER = 'C:\\Users\\convo\\OneDrive\\Escritorio\\CONTACTO LISTAS-20260130T211132Z-3-001\\CONTACTO LISTAS';

// Patrones ya importados
const SKIP_PATTERNS = ['IGEmailExtractor-email-', 'Music_Industry', 'Neiver Alvarez'];

async function processFile(client, filePath, fileName) {
  console.log(`\n📄 ${fileName}`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const emails = new Set();
  
  const matches = content.match(emailRegex);
  if (matches) {
    for (const email of matches) {
      const clean = email.toLowerCase().trim();
      if (isValidEmail(clean)) {
        emails.add(clean);
      }
    }
  }
  
  console.log(`   📧 Emails únicos: ${emails.size}`);
  if (emails.size === 0) return { newCount: 0, dupCount: 0 };
  
  let newCount = 0;
  let dupCount = 0;
  const emailArray = [...emails];
  
  // Procesar de 20 en 20
  for (let i = 0; i < emailArray.length; i += 20) {
    const batch = emailArray.slice(i, i + 20);
    
    for (const email of batch) {
      try {
        const r = await client.query(`
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
    
    if (i % 100 === 0 && i > 0) {
      process.stdout.write(`   ${i}/${emailArray.length}...\r`);
    }
  }
  
  console.log(`   ✅ Nuevos: ${newCount} | Dups: ${dupCount}`);
  return { newCount, dupCount };
}

function isValidEmail(email) {
  if (!email || email.length < 5) return false;
  const blacklist = ['noreply', 'no-reply', 'mailer-daemon', 'postmaster', 'example.com', 'test.com', 'sentry'];
  if (blacklist.some(b => email.includes(b))) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

async function main() {
  const client = new Client({ connectionString: SUPABASE_URL });
  await client.connect();
  console.log('✅ Conectado a Supabase');
  
  const files = fs.readdirSync(CSV_FOLDER)
    .filter(f => f.endsWith('.csv'))
    .filter(f => !SKIP_PATTERNS.some(p => f.includes(p)));
  
  console.log(`📁 Archivos nuevos a procesar: ${files.length}`);
  
  let totalNew = 0;
  let totalDup = 0;
  
  for (const file of files) {
    try {
      const result = await processFile(client, path.join(CSV_FOLDER, file), file);
      totalNew += result.newCount;
      totalDup += result.dupCount;
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 TOTAL: +${totalNew} nuevos, ${totalDup} duplicados`);
  
  const count = await client.query('SELECT COUNT(*) FROM leads');
  console.log(`📈 Total en BD: ${count.rows[0].count}`);
  
  await client.end();
}

main().catch(console.error);
