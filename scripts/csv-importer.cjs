/**
 * 📥 CSV IMPORTER - Importa leads de CSVs a Supabase
 * Soporta múltiples formatos:
 * - Instagram Email Extractor (IGEmailExtractor)
 * - Music Industry lists
 * - Custom lists
 * 
 * Uso:
 *   node csv-importer.cjs "C:\path\to\file.csv"
 *   node csv-importer.cjs all   # Importa todos los CSVs del escritorio
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const SUPABASE_URL = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

// Archivos CSV a importar
const CSV_FILES = [
  'C:\\Users\\convo\\OneDrive\\Escritorio\\IGEmailExtractor-email-476-20260130160553.csv',
  'C:\\Users\\convo\\OneDrive\\Escritorio\\IGEmailExtractor-email-18-20260130160559.csv',
  'C:\\Users\\convo\\OneDrive\\Escritorio\\IGEmailExtractor-email-242-20260130160610.csv',
  'C:\\Users\\convo\\OneDrive\\Escritorio\\IGEmailExtractor-email-197-20260130160419.csv',
  'C:\\Users\\convo\\OneDrive\\Escritorio\\IGEmailExtractor-email-241-20260130160427.csv',
  'C:\\Users\\convo\\OneDrive\\Escritorio\\IGEmailExtractor-email-120-20260130160439.csv',
  'C:\\Users\\convo\\OneDrive\\Escritorio\\Music_Industry#1.csv',
  'C:\\Users\\convo\\OneDrive\\Escritorio\\Music_Industry#2.csv',
  'C:\\Users\\convo\\OneDrive\\Escritorio\\Music_Industry#3.csv',
  'C:\\Users\\convo\\OneDrive\\Escritorio\\Music_Industry#1 (1).csv',
  'C:\\Users\\convo\\OneDrive\\Escritorio\\Neiver Alvarez Clientes.csv'
];

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Parse CSV considerando comillas
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

function detectFormat(headers) {
  const headerStr = headers.join(',').toLowerCase();
  
  if (headerStr.includes('user id') && headerStr.includes('public email')) {
    return 'instagram';
  } else if (headerStr.includes('nombre') && headerStr.includes('email')) {
    return 'music_industry';
  } else if (headerStr.includes('email')) {
    return 'generic';
  }
  return 'unknown';
}

function extractLead(row, format) {
  let email = '';
  let fullName = '';
  let phone = '';
  let instagram = '';
  let followers = 0;
  let bio = '';
  let website = '';
  let city = '';
  
  if (format === 'instagram') {
    email = row['Public Email'] || '';
    fullName = row['Full Name'] || row['User Name'] || '';
    phone = row['Public Phone'] || '';
    instagram = row['Profile Url'] || '';
    followers = parseInt(row['Followers Count']) || 0;
    bio = row['Biography'] || '';
    website = row['External Url'] || '';
    city = row['City'] || '';
  } else if (format === 'music_industry') {
    email = row['Email'] || '';
    fullName = row['Nombre'] || '';
    phone = row['Teléfono'] || row['Telefono'] || '';
  } else if (format === 'generic') {
    email = row['Email'] || row['email'] || '';
    fullName = row['Nombre'] || row['Name'] || row['Full Name'] || '';
    phone = row['Teléfono'] || row['Phone'] || row['Telefono'] || '';
  }
  
  // Limpiar email
  email = email.replace(/"/g, '').trim().toLowerCase();
  
  // Validar email
  if (!email || !email.includes('@') || email.includes(':::')) {
    // Si tiene múltiples emails separados por :::, tomar el primero
    if (email.includes(':::')) {
      email = email.split(':::')[0].trim();
    }
  }
  
  // Filtrar emails inválidos
  if (!email || 
      !email.includes('@') || 
      email.includes('example.com') ||
      email.includes('devaza.id') ||
      email.length < 5) {
    return null;
  }
  
  // Limpiar nombre
  fullName = fullName.replace(/[^\w\s\-áéíóúñÁÉÍÓÚÑ]/g, ' ').trim();
  
  // Extraer first/last name
  const nameParts = fullName.split(' ').filter(p => p.length > 0);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  return {
    email,
    firstName,
    lastName,
    fullName,
    phone,
    instagram,
    followers,
    bio,
    website,
    city
  };
}

async function importCSV(client, filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Procesando: ${fileName}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ Archivo no encontrado`);
    return { inserted: 0, duplicates: 0, errors: 0 };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);
  
  if (rows.length === 0) {
    console.log(`   ⚠️  Sin datos`);
    return { inserted: 0, duplicates: 0, errors: 0 };
  }
  
  const headers = Object.keys(rows[0]);
  const format = detectFormat(headers);
  console.log(`   📋 Formato: ${format} | Filas: ${rows.length}`);
  
  // Determinar source basado en el nombre del archivo
  let source = 'CSV_IMPORT';
  if (fileName.includes('IGEmail')) {
    source = 'INSTAGRAM';
  } else if (fileName.includes('Music_Industry')) {
    source = 'MUSIC_INDUSTRY';
  } else if (fileName.includes('Clientes')) {
    source = 'CLIENTES';
  }
  
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;
  
  for (const row of rows) {
    const lead = extractLead(row, format);
    
    if (!lead) {
      errors++;
      continue;
    }
    
    try {
      const result = await client.query(`
        INSERT INTO leads (
          email, first_name, last_name, full_name,
          city, linkedin, company_description, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `, [
        lead.email,
        lead.firstName,
        lead.lastName,
        lead.fullName,
        lead.city || null,
        lead.instagram || null,
        lead.bio ? lead.bio.substring(0, 500) : null,
        source
      ]);
      
      if (result.rows.length > 0) {
        // Crear lead_status
        await client.query(`
          INSERT INTO lead_status (lead_id, status, warmup_stage)
          VALUES ($1, 'new', 0)
          ON CONFLICT DO NOTHING
        `, [result.rows[0].id]);
        
        inserted++;
      } else {
        duplicates++;
      }
    } catch (err) {
      errors++;
    }
  }
  
  console.log(`   ✅ Nuevos: ${inserted} | ⏭️ Duplicados: ${duplicates} | ❌ Errores: ${errors}`);
  
  return { inserted, duplicates, errors };
}

async function main() {
  console.log('='.repeat(70));
  console.log('📥 CSV IMPORTER - Importando leads a Supabase');
  console.log('='.repeat(70));
  
  const pool = new Pool({
    connectionString: SUPABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  
  try {
    let totalInserted = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;
    
    for (const csvFile of CSV_FILES) {
      const result = await importCSV(client, csvFile);
      totalInserted += result.inserted;
      totalDuplicates += result.duplicates;
      totalErrors += result.errors;
    }
    
    // Stats finales
    const stats = await client.query(`
      SELECT source, COUNT(*) as count 
      FROM leads 
      GROUP BY source 
      ORDER BY count DESC
    `);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN DE IMPORTACIÓN');
    console.log('='.repeat(70));
    console.log(`   ✅ Total insertados: ${totalInserted}`);
    console.log(`   ⏭️  Total duplicados: ${totalDuplicates}`);
    console.log(`   ❌ Total errores: ${totalErrors}`);
    
    console.log('\n📈 LEADS POR FUENTE:');
    stats.rows.forEach(r => {
      console.log(`   ${r.source}: ${r.count} leads`);
    });
    
    const total = await client.query('SELECT COUNT(*) as count FROM leads');
    console.log(`\n🎯 TOTAL EN BASE DE DATOS: ${total.rows[0].count} leads`);
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
