/**
 * CSV Importer V5 - Con reconexión automática
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
const CSV_FOLDER = 'C:\\Users\\convo\\OneDrive\\Escritorio\\CONTACTO LISTAS-20260130T211132Z-3-001\\CONTACTO LISTAS';

const SKIP_PATTERNS = ['IGEmailExtractor-email-', 'Music_Industry', 'Neiver Alvarez'];

// Pool con reconexión
const pool = new Pool({ 
  connectionString: SUPABASE_URL,
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

function isValidEmail(email) {
  if (!email || email.length < 5) return false;
  const blacklist = ['noreply', 'no-reply', 'mailer-daemon', 'postmaster', 'example.com', 'test.com', 'sentry'];
  if (blacklist.some(b => email.includes(b))) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

async function insertEmail(email) {
  try {
    const r = await pool.query(`
      INSERT INTO leads (email, name, source, status, created_at)
      VALUES ($1, '', 'INSTAGRAM_ALL', 'pending', NOW())
      ON CONFLICT (email) DO NOTHING
    `, [email]);
    return r.rowCount > 0;
  } catch (e) {
    return false;
  }
}

async function processFile(filePath, fileName) {
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
  
  const count = emails.size;
  console.log(`   📧 Emails: ${count}`);
  if (count === 0) return { newCount: 0, dupCount: 0 };
  
  let newCount = 0;
  let dupCount = 0;
  let processed = 0;
  
  for (const email of emails) {
    const isNew = await insertEmail(email);
    if (isNew) newCount++;
    else dupCount++;
    
    processed++;
    if (processed % 100 === 0) {
      process.stdout.write(`   ${processed}/${count}...\r`);
    }
  }
  
  console.log(`   ✅ +${newCount} nuevos | ${dupCount} dups`);
  return { newCount, dupCount };
}

async function main() {
  console.log('✅ Iniciando importación...\n');
  
  const files = fs.readdirSync(CSV_FOLDER)
    .filter(f => f.endsWith('.csv'))
    .filter(f => !SKIP_PATTERNS.some(p => f.includes(p)));
  
  console.log(`📁 ${files.length} archivos nuevos\n`);
  
  let totalNew = 0;
  let totalDup = 0;
  
  for (const file of files) {
    try {
      const result = await processFile(path.join(CSV_FOLDER, file), file);
      totalNew += result.newCount;
      totalDup += result.dupCount;
    } catch (err) {
      console.log(`   ❌ ${err.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 TOTAL: +${totalNew} nuevos | ${totalDup} duplicados`);
  
  try {
    const count = await pool.query('SELECT COUNT(*) FROM leads');
    console.log(`📈 Total en BD: ${count.rows[0].count}`);
    
    const sources = await pool.query(`
      SELECT source, COUNT(*) as count FROM leads 
      GROUP BY source ORDER BY count DESC
    `);
    console.log('\n📊 Por fuente:');
    for (const row of sources.rows) {
      console.log(`   ${row.source}: ${row.count}`);
    }
  } catch (e) {
    console.log('Error al obtener stats:', e.message);
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
