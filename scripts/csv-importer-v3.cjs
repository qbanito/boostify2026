/**
 * CSV Importer V3 - Optimizado para archivos grandes
 * Procesa en lotes y con timeout extendido
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

const CSV_FOLDER = 'C:\\Users\\convo\\OneDrive\\Escritorio\\CONTACTO LISTAS-20260130T211132Z-3-001\\CONTACTO LISTAS';

// Archivos ya importados anteriormente
const ALREADY_IMPORTED = [
  'IGEmailExtractor-email-',  // Todos los que tienen "email" ya fueron importados
  'Music_Industry',
  'Neiver Alvarez'
];

async function importCSVs() {
  const client = new Client({ 
    connectionString: SUPABASE_URL,
    connectionTimeoutMillis: 30000,
    query_timeout: 60000
  });
  await client.connect();
  console.log('✅ Conectado a Supabase\n');

  const files = fs.readdirSync(CSV_FOLDER).filter(f => f.endsWith('.csv'));
  console.log(`📁 Encontrados ${files.length} archivos CSV\n`);

  let totalNew = 0;
  let totalDuplicates = 0;
  let filesProcessed = 0;

  for (const file of files) {
    // Verificar si ya fue importado
    const wasImported = ALREADY_IMPORTED.some(pattern => file.includes(pattern));
    if (wasImported) {
      console.log(`⏭️  SKIP: ${file} (ya importado)`);
      continue;
    }

    const filePath = path.join(CSV_FOLDER, file);
    console.log(`\n📄 ${file}`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      if (lines.length < 2) {
        console.log(`   ⚠️ Vacío`);
        continue;
      }

      // Extraer emails con regex simple (más rápido)
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
      const allEmails = new Set();
      
      for (let i = 1; i < lines.length; i++) {
        const matches = lines[i].match(emailRegex);
        if (matches) {
          for (const email of matches) {
            const cleanEmail = email.toLowerCase().trim();
            if (isValidEmail(cleanEmail)) {
              allEmails.add(cleanEmail);
            }
          }
        }
      }

      const uniqueEmails = [...allEmails];
      console.log(`   📧 Emails: ${uniqueEmails.length}`);

      if (uniqueEmails.length === 0) continue;

      // Insertar en lotes de 50 para evitar timeout
      const BATCH_SIZE = 50;
      let newCount = 0;
      let dupCount = 0;

      for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
        const batch = uniqueEmails.slice(i, i + BATCH_SIZE);
        
        // Construir INSERT múltiple
        const values = batch.map((email, idx) => 
          `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3}, 'pending', NOW())`
        ).join(', ');
        
        const params = batch.flatMap(email => [email, '', 'INSTAGRAM_ALL']);
        
        try {
          const result = await client.query(`
            INSERT INTO leads (email, name, source, status, created_at)
            VALUES ${values}
            ON CONFLICT (email) DO NOTHING
          `, params);
          
          newCount += result.rowCount;
          dupCount += batch.length - result.rowCount;
        } catch (err) {
          // Si falla el batch, insertar uno por uno
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
        }
        
        // Mostrar progreso cada 500
        if (i % 500 === 0 && i > 0) {
          process.stdout.write(`   ... ${i}/${uniqueEmails.length}\r`);
        }
      }

      console.log(`   ✅ +${newCount} nuevos, ${dupCount} dups`);
      totalNew += newCount;
      totalDuplicates += dupCount;
      filesProcessed++;

    } catch (err) {
      console.log(`   ❌ ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN');
  console.log('='.repeat(50));
  console.log(`📁 Archivos: ${filesProcessed}`);
  console.log(`✅ Nuevos: ${totalNew}`);
  console.log(`🔄 Duplicados: ${totalDuplicates}`);

  const countResult = await client.query('SELECT COUNT(*) FROM leads');
  console.log(`\n📈 TOTAL EN BD: ${countResult.rows[0].count}`);

  const sourceResult = await client.query(`
    SELECT source, COUNT(*) as count 
    FROM leads GROUP BY source ORDER BY count DESC
  `);
  console.log('\n📊 Por fuente:');
  for (const row of sourceResult.rows) {
    console.log(`   ${row.source}: ${row.count}`);
  }

  await client.end();
}

function isValidEmail(email) {
  if (!email || email.length < 5) return false;
  const blacklist = ['noreply', 'no-reply', 'mailer-daemon', 'postmaster', 'example.com', 'test.com', 'sentry.io'];
  if (blacklist.some(b => email.includes(b))) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

importCSVs().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
