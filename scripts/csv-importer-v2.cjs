/**
 * CSV Importer V2 - Solo listas nuevas (IGEmailExtractor-all-*)
 * No importa duplicados (ON CONFLICT DO NOTHING)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

// Carpeta con los CSVs
const CSV_FOLDER = 'C:\\Users\\convo\\OneDrive\\Escritorio\\CONTACTO LISTAS-20260130T211132Z-3-001\\CONTACTO LISTAS';

// Archivos ya importados anteriormente (para evitar re-importar)
const ALREADY_IMPORTED = [
  'IGEmailExtractor-email-476',
  'IGEmailExtractor-email-18', 
  'IGEmailExtractor-email-242',
  'Music_Industry',
  'Neiver Alvarez'
];

async function importCSVs() {
  const client = new Client({ connectionString: SUPABASE_URL });
  await client.connect();
  console.log('✅ Conectado a Supabase\n');

  // Obtener todos los CSVs de la carpeta
  const files = fs.readdirSync(CSV_FOLDER).filter(f => f.endsWith('.csv'));
  console.log(`📁 Encontrados ${files.length} archivos CSV\n`);

  let totalNew = 0;
  let totalDuplicates = 0;
  let filesProcessed = 0;

  for (const file of files) {
    // Verificar si ya fue importado
    const wasImported = ALREADY_IMPORTED.some(pattern => file.includes(pattern));
    if (wasImported) {
      console.log(`⏭️  SKIP: ${file} (ya importado anteriormente)`);
      continue;
    }

    const filePath = path.join(CSV_FOLDER, file);
    console.log(`\n📄 Procesando: ${file}`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      if (lines.length < 2) {
        console.log(`   ⚠️ Archivo vacío o sin datos`);
        continue;
      }

      const headers = lines[0].toLowerCase();
      let emails = [];
      let source = 'INSTAGRAM_ALL';

      // Detectar formato Instagram (tiene Public Email)
      if (headers.includes('public email') || headers.includes('user name')) {
        const headerParts = lines[0].split(',');
        const emailIndex = headerParts.findIndex(h => 
          h.toLowerCase().includes('public email') || h.toLowerCase() === 'email'
        );
        const nameIndex = headerParts.findIndex(h => 
          h.toLowerCase().includes('full name') || h.toLowerCase() === 'name'
        );
        const usernameIndex = headerParts.findIndex(h => 
          h.toLowerCase().includes('user name') || h.toLowerCase() === 'username'
        );

        for (let i = 1; i < lines.length; i++) {
          const parts = parseCSVLine(lines[i]);
          if (parts.length > emailIndex && emailIndex >= 0) {
            const email = parts[emailIndex]?.trim().toLowerCase();
            if (email && isValidEmail(email)) {
              emails.push({
                email,
                name: parts[nameIndex]?.trim() || parts[usernameIndex]?.trim() || '',
                source
              });
            }
          }
        }
      } else {
        // Formato genérico - buscar emails con regex
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        for (let i = 1; i < lines.length; i++) {
          const matches = lines[i].match(emailRegex);
          if (matches) {
            for (const email of matches) {
              if (isValidEmail(email.toLowerCase())) {
                emails.push({
                  email: email.toLowerCase(),
                  name: '',
                  source
                });
              }
            }
          }
        }
      }

      // Eliminar duplicados dentro del archivo
      const uniqueEmails = [...new Map(emails.map(e => [e.email, e])).values()];
      console.log(`   📧 Emails únicos encontrados: ${uniqueEmails.length}`);

      if (uniqueEmails.length === 0) {
        console.log(`   ⚠️ Sin emails válidos`);
        continue;
      }

      // Insertar en batch
      let newCount = 0;
      let dupCount = 0;

      for (const lead of uniqueEmails) {
        try {
          const result = await client.query(`
            INSERT INTO leads (email, name, source, status, created_at)
            VALUES ($1, $2, $3, 'pending', NOW())
            ON CONFLICT (email) DO NOTHING
            RETURNING id
          `, [lead.email, lead.name, lead.source]);

          if (result.rowCount > 0) {
            newCount++;
          } else {
            dupCount++;
          }
        } catch (err) {
          // Ignorar errores individuales
        }
      }

      console.log(`   ✅ Nuevos: ${newCount} | Duplicados: ${dupCount}`);
      totalNew += newCount;
      totalDuplicates += dupCount;
      filesProcessed++;

    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE IMPORTACIÓN');
  console.log('='.repeat(60));
  console.log(`📁 Archivos procesados: ${filesProcessed}`);
  console.log(`✅ Total leads nuevos: ${totalNew}`);
  console.log(`🔄 Total duplicados: ${totalDuplicates}`);

  // Contar total en BD
  const countResult = await client.query('SELECT COUNT(*) FROM leads');
  console.log(`\n📈 TOTAL LEADS EN BASE DE DATOS: ${countResult.rows[0].count}`);

  // Desglose por source
  const sourceResult = await client.query(`
    SELECT source, COUNT(*) as count 
    FROM leads 
    GROUP BY source 
    ORDER BY count DESC
  `);
  console.log('\n📊 Desglose por fuente:');
  for (const row of sourceResult.rows) {
    console.log(`   ${row.source}: ${row.count}`);
  }

  await client.end();
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function isValidEmail(email) {
  if (!email || email.length < 5) return false;
  if (!email.includes('@')) return false;
  if (!email.includes('.')) return false;
  
  // Excluir emails genéricos/spam
  const blacklist = ['noreply', 'no-reply', 'mailer-daemon', 'postmaster', 'example.com', 'test.com'];
  if (blacklist.some(b => email.includes(b))) return false;
  
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

importCSVs().catch(console.error);
