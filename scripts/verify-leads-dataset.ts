/**
 * Script para verificar el dataset de leads-finder
 * y comparar con los contactos existentes
 */

import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Argumentos CLI
const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const IMPORT_MODE = args.includes('--import');

// Dominios desechables
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'temp-mail.org', 'guerrillamail.com', 'mailinator.com',
  '10minutemail.com', 'throwawaymail.com', 'yopmail.com', 'sharklasers.com',
  'nespj.com', 'fxavaj.com', 'abyssmail.com', 'anonbox.net'
]);

// Cache MX
const mxCache = new Map<string, boolean>();

interface Lead {
  first_name: string;
  last_name: string;
  email: string | null;
  personal_email: string | null;
  full_name: string;
  job_title: string;
  linkedin: string;
  company_name: string;
  company_website: string;
  industry: string;
  company_size: number;
  seniority_level: string;
  country: string;
}

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
  } catch (error) {
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
      UNION
      SELECT LOWER(personal_email) as email FROM music_industry_contacts WHERE personal_email IS NOT NULL
    `);
    return new Set(result.rows.map(r => r.email).filter(Boolean));
  } finally {
    client.release();
  }
}

async function importLead(lead: Lead, email: string): Promise<void> {
  const client = await pool.connect();
  try {
    // Verificar si ya existe
    const exists = await client.query(
      'SELECT 1 FROM music_industry_contacts WHERE email = $1 OR personal_email = $1',
      [email]
    );
    
    if (exists.rows.length > 0) {
      return; // El finally hará el release
    }
    
    // Generar full_name a partir de first_name y last_name
    const fullName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';
    
    await client.query(`
      INSERT INTO music_industry_contacts (
        email, personal_email, first_name, last_name, full_name,
        job_title, linkedin, company_name, company_website,
        industry, company_size, seniority_level, country,
        email_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'valid', NOW())
    `, [
      lead.email || email,
      lead.personal_email,
      lead.first_name || '',
      lead.last_name || '',
      fullName,
      lead.job_title,
      lead.linkedin,
      lead.company_name,
      lead.company_website,
      lead.industry,
      lead.company_size?.toString() || null,
      lead.seniority_level,
      lead.country
    ]);
  } catch (e) {
    // Silenciar errores de duplicados
    const msg = (e as Error).message;
    if (!msg.includes('duplicate') && !msg.includes('already exists')) {
      console.error(`Error importing ${email}:`, msg);
    }
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  console.log('═'.repeat(70));
  console.log('║   📧 LEADS-FINDER DATASET - VERIFICATION & IMPORT                ║');
  console.log('═'.repeat(70));
  console.log(`🔧 Import Mode: ${IMPORT_MODE ? 'ON' : 'OFF'}`);
  console.log('─'.repeat(70));

  // Cargar dataset
  const dataPath = 'C:\\Users\\convo\\Downloads\\dataset_leads-finder_2026-02-01_01-23-10-745.json';
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const leads: Lead[] = JSON.parse(rawData);
  
  console.log(`\n📋 Dataset loaded: ${leads.length} leads`);

  // Obtener emails existentes
  const existingEmails = await getExistingEmails();
  console.log(`📦 Existing emails in DB: ${existingEmails.size}`);

  // Stats
  let totalValid = 0;
  let totalInvalid = 0;
  let duplicates = 0;
  let newLeads = 0;
  let noEmail = 0;
  
  const validNewLeads: { lead: Lead; email: string }[] = [];
  const invalidEmails: { email: string; reason: string }[] = [];

  console.log('\n🔍 Verifying emails...\n');

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    
    // Usar email corporativo primero, luego personal
    const emailToCheck = lead.email || lead.personal_email;
    
    if (!emailToCheck) {
      noEmail++;
      continue;
    }

    const normalized = emailToCheck.toLowerCase().trim();
    
    // Verificar si ya existe
    if (existingEmails.has(normalized)) {
      duplicates++;
      continue;
    }

    // Verificar email
    const result = await verifyEmail(emailToCheck);
    
    if (result.valid) {
      totalValid++;
      validNewLeads.push({ lead, email: normalized });
      
      if (IMPORT_MODE) {
        await importLead(lead, normalized);
      }
    } else {
      totalInvalid++;
      invalidEmails.push({ email: emailToCheck, reason: result.reason });
    }

    // Progress cada 100
    if ((i + 1) % 100 === 0) {
      process.stdout.write(`\r   Processed ${i + 1}/${leads.length}...`);
    }
  }

  console.log('\n');

  // Resumen
  console.log('═'.repeat(70));
  console.log('║                    📊 VERIFICATION REPORT                        ║');
  console.log('═'.repeat(70));
  console.log(`\n📈 RESUMEN:`);
  console.log(`   Total en dataset:     ${leads.length}`);
  console.log(`   Sin email:            ${noEmail}`);
  console.log(`   Ya existentes:        ${duplicates}`);
  console.log(`   ✅ Nuevos válidos:    ${totalValid}`);
  console.log(`   ❌ Inválidos:         ${totalInvalid}`);

  // Desglose por industria de los nuevos
  const byIndustry = new Map<string, number>();
  for (const { lead } of validNewLeads) {
    const ind = lead.industry || 'Unknown';
    byIndustry.set(ind, (byIndustry.get(ind) || 0) + 1);
  }
  
  console.log(`\n📊 NUEVOS LEADS POR INDUSTRIA:`);
  const sortedIndustries = [...byIndustry.entries()].sort((a, b) => b[1] - a[1]);
  for (const [ind, count] of sortedIndustries.slice(0, 10)) {
    console.log(`   ${ind}: ${count}`);
  }

  // Desglose por seniority
  const bySeniority = new Map<string, number>();
  for (const { lead } of validNewLeads) {
    const sen = lead.seniority_level || 'Unknown';
    bySeniority.set(sen, (bySeniority.get(sen) || 0) + 1);
  }
  
  console.log(`\n👔 NUEVOS LEADS POR SENIORITY:`);
  const sortedSeniority = [...bySeniority.entries()].sort((a, b) => b[1] - a[1]);
  for (const [sen, count] of sortedSeniority) {
    console.log(`   ${sen}: ${count}`);
  }

  // Top compañías
  const byCompany = new Map<string, number>();
  for (const { lead } of validNewLeads) {
    const comp = lead.company_name || 'Unknown';
    byCompany.set(comp, (byCompany.get(comp) || 0) + 1);
  }
  
  console.log(`\n🏢 TOP COMPAÑÍAS (nuevos leads):`);
  const sortedCompanies = [...byCompany.entries()].sort((a, b) => b[1] - a[1]);
  for (const [comp, count] of sortedCompanies.slice(0, 15)) {
    console.log(`   ${comp}: ${count}`);
  }

  // Emails inválidos
  if (invalidEmails.length > 0) {
    console.log(`\n❌ EMAILS INVÁLIDOS (top 10):`);
    for (const { email, reason } of invalidEmails.slice(0, 10)) {
      console.log(`   ${email} - ${reason}`);
    }
  }

  console.log('\n');
  
  if (!IMPORT_MODE && totalValid > 0) {
    console.log(`💡 Ejecuta con --import para agregar ${totalValid} nuevos leads a la DB`);
  }
  
  if (IMPORT_MODE) {
    console.log(`✅ ${totalValid} nuevos leads importados a music_industry_contacts!`);
  }

  await pool.end();
}

main().catch(error => {
  console.error('Error:', error);
  pool.end();
  process.exit(1);
});
