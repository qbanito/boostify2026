/**
 * Script para verificar e importar datasets de artistas
 * (Spotify, SoundCloud, Instagram, Bandcamp, YouTube Music)
 */

import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { promisify } from 'util';
import { parse } from 'csv-parse/sync';

const resolveMx = promisify(dns.resolveMx);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// CLI args
const args = process.argv.slice(2);
const IMPORT_MODE = args.includes('--import');

// Cache MX
const mxCache = new Map<string, boolean>();

// Dominios desechables
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'temp-mail.org', 'guerrillamail.com', 'mailinator.com',
  '10minutemail.com', 'throwawaymail.com', 'yopmail.com', 'sharklasers.com'
]);

function validateSyntax(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
  return regex.test(email.trim());
}

function getDomain(email: string): string {
  const parts = email.toLowerCase().trim().split('@');
  return parts.length === 2 ? parts[1] : '';
}

function isDisposable(email: string): boolean {
  return DISPOSABLE_DOMAINS.has(getDomain(email));
}

async function verifyMxRecords(domain: string): Promise<boolean> {
  if (mxCache.has(domain)) return mxCache.get(domain)!;
  try {
    const mxRecords = await resolveMx(domain);
    const valid = mxRecords && mxRecords.length > 0;
    mxCache.set(domain, valid);
    return valid;
  } catch {
    mxCache.set(domain, false);
    return false;
  }
}

async function verifyEmail(email: string | null): Promise<{ valid: boolean; reason: string }> {
  if (!email) return { valid: false, reason: 'No email' };
  
  const normalized = email.toLowerCase().trim();
  if (!validateSyntax(normalized)) return { valid: false, reason: 'Invalid syntax' };
  if (isDisposable(normalized)) return { valid: false, reason: 'Disposable' };
  
  const domain = getDomain(normalized);
  const hasMx = await verifyMxRecords(domain);
  if (!hasMx) return { valid: false, reason: `No MX: ${domain}` };
  
  return { valid: true, reason: 'Valid' };
}

async function getExistingEmails(): Promise<Set<string>> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT LOWER(email) as email FROM music_industry_contacts WHERE email IS NOT NULL
    `);
    return new Set(result.rows.map(r => r.email).filter(Boolean));
  } finally {
    client.release();
  }
}

async function importContact(email: string, name: string, source: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO music_industry_contacts (
        email, full_name, first_name, last_name, 
        category, import_source, email_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'valid', NOW())
    `, [
      email.toLowerCase().trim(),
      name || 'Unknown Artist',
      name?.split(' ')[0] || '',
      name?.split(' ').slice(1).join(' ') || '',
      'artist',
      source
    ]);
    return true;
  } catch {
    return false;
  } finally {
    client.release();
  }
}

interface DatasetResult {
  name: string;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  imported: number;
}

async function processCSV(filePath: string, emailColumn: string, nameColumn: string, existingEmails: Set<string>): Promise<DatasetResult> {
  const fileName = path.basename(filePath);
  console.log(`\n📂 Processing: ${fileName}`);
  
  let content = fs.readFileSync(filePath, 'utf-8');
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  // Also handle UTF-8 BOM bytes
  content = content.replace(/^\uFEFF/, '');
  
  const records = parse(content, { 
    columns: true, 
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true,
    relax_column_count: true
  });
  
  let valid = 0;
  let invalid = 0;
  let duplicates = 0;
  let imported = 0;
  
  for (const record of records) {
    const email = record[emailColumn]?.trim();
    const name = record[nameColumn]?.replace(/@\w+/g, '').replace(/[•·].*$/g, '').trim() || '';
    
    if (!email) continue;
    
    const normalized = email.toLowerCase().trim();
    
    if (existingEmails.has(normalized)) {
      duplicates++;
      continue;
    }
    
    const result = await verifyEmail(email);
    
    if (result.valid) {
      valid++;
      if (IMPORT_MODE) {
        const success = await importContact(normalized, name, fileName);
        if (success) {
          imported++;
          existingEmails.add(normalized);
        }
      }
    } else {
      invalid++;
    }
  }
  
  console.log(`   ✅ Valid: ${valid} | ❌ Invalid: ${invalid} | 🔄 Duplicates: ${duplicates}`);
  
  return { name: fileName, total: records.length, valid, invalid, duplicates, imported };
}

async function main(): Promise<void> {
  console.log('═'.repeat(70));
  console.log('║   🎵 ARTISTS DATASETS - VERIFICATION & IMPORT                    ║');
  console.log('═'.repeat(70));
  console.log(`🔧 Import Mode: ${IMPORT_MODE ? 'ON' : 'OFF'}`);
  
  const existingEmails = await getExistingEmails();
  console.log(`📦 Existing emails in DB: ${existingEmails.size}`);
  
  const basePath = "C:\\Users\\convo\\OneDrive\\Escritorio\\DESKTOP ORGANIZADO\\spotify daabase";
  
  const datasets = [
    { file: '1100 artistas.csv', emailCol: 'email', nameCol: 'title' },
    { file: 'boostify_soundcloud_clean.csv', emailCol: 'email', nameCol: 'name' },
    { file: 'dataset_bandcamp-email-scraper---advanced-cheapest-reliable_2025-11-17_01-55-46-139.csv', emailCol: 'email', nameCol: 'name' },
    { file: 'dataset_soundcloud-artists-scraper_2025-11-20_00-07-05-872.csv', emailCol: 'email', nameCol: 'name' },
    { file: 'dataset_spotify-email-scraper_2025-11-17_00-26-31-721.csv', emailCol: 'email', nameCol: 'name' },
    { file: 'dataset_youtube-music-artist-scraper_2025-11-20_00-10-13-907.csv', emailCol: 'email', nameCol: 'name' },
  ];
  
  const results: DatasetResult[] = [];
  
  for (const ds of datasets) {
    const fullPath = path.join(basePath, ds.file);
    if (fs.existsSync(fullPath)) {
      try {
        // Read first line to check column names
        let content = fs.readFileSync(fullPath, 'utf-8');
        // Remove BOM
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
        content = content.replace(/^\uFEFF/, '');
        
        const records = parse(content, { 
          columns: true, 
          skip_empty_lines: true,
          bom: true,
          relax_quotes: true,
          relax_column_count: true
        });
        if (records.length > 0) {
          const cols = Object.keys(records[0]);
          const emailCol = cols.find(c => c.toLowerCase().includes('email')) || ds.emailCol;
          const nameCol = cols.find(c => c.toLowerCase().includes('name') || c.toLowerCase().includes('title')) || ds.nameCol;
          
          const result = await processCSV(fullPath, emailCol, nameCol, existingEmails);
          results.push(result);
        }
      } catch (e) {
        console.log(`   ⚠️ Error processing ${ds.file}: ${(e as Error).message}`);
      }
    } else {
      console.log(`   ⚠️ File not found: ${ds.file}`);
    }
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('║                       📊 SUMMARY                                 ║');
  console.log('═'.repeat(70));
  
  let totalValid = 0;
  let totalInvalid = 0;
  let totalDuplicates = 0;
  let totalImported = 0;
  
  for (const r of results) {
    totalValid += r.valid;
    totalInvalid += r.invalid;
    totalDuplicates += r.duplicates;
    totalImported += r.imported;
    console.log(`📁 ${r.name.slice(0, 40).padEnd(40)} | Valid: ${r.valid.toString().padStart(4)} | Dup: ${r.duplicates.toString().padStart(4)}`);
  }
  
  console.log('─'.repeat(70));
  console.log(`✅ Total Valid (new): ${totalValid}`);
  console.log(`❌ Total Invalid: ${totalInvalid}`);
  console.log(`🔄 Total Duplicates: ${totalDuplicates}`);
  
  if (IMPORT_MODE) {
    console.log(`\n🎉 Imported: ${totalImported} new artist contacts!`);
  } else if (totalValid > 0) {
    console.log(`\n💡 Run with --import to add ${totalValid} new contacts to the DB`);
  }
  
  // Check final DB count
  const client = await pool.connect();
  const finalCount = await client.query('SELECT COUNT(*) as total FROM music_industry_contacts');
  console.log(`\n📊 Total contacts in DB: ${finalCount.rows[0].total}`);
  client.release();
  
  await pool.end();
}

main().catch(error => {
  console.error('Error:', error);
  pool.end();
  process.exit(1);
});
