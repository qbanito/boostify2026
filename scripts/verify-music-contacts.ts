/**
 * Script para verificar emails en music_industry_contacts
 * Reduce bounce rate verificando emails antes de enviar
 * 
 * USO:
 *   npx tsx scripts/verify-music-contacts.ts                # Verificar todos
 *   npx tsx scripts/verify-music-contacts.ts --fix          # Marcar inválidos en DB
 *   npx tsx scripts/verify-music-contacts.ts --limit=100    # Limitar cantidad
 */

import 'dotenv/config';
import { Pool } from 'pg';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Argumentos CLI
const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0;

// Dominios desechables conocidos
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'temp-mail.org', 'guerrillamail.com', 'mailinator.com',
  '10minutemail.com', 'throwawaymail.com', 'yopmail.com', 'sharklasers.com',
  'trashmail.com', 'fakeinbox.com', 'getnada.com', 'maildrop.cc',
  'dispostable.com', 'mailnesia.com', 'tempr.email', 'tempail.com',
  'nespj.com', 'fxavaj.com', 'abyssmail.com', 'anonbox.net',
  'crazymailing.com', 'dropmail.me', 'emailfake.com', 'getairmail.com'
]);

// Emails role-based (menos confiables)
const ROLE_PREFIXES = new Set([
  'info', 'admin', 'support', 'sales', 'contact', 'help', 'office',
  'mail', 'hello', 'team', 'marketing', 'press', 'media', 'news',
  'noreply', 'no-reply', 'billing', 'hr', 'legal', 'general'
]);

// Cache de MX
const mxCache = new Map<string, boolean>();

interface ContactRecord {
  id: number;
  email: string;
  personal_email?: string;
  name?: string;
  company?: string;
}

interface VerificationResult {
  email: string;
  valid: boolean;
  reason: string;
  isRoleEmail: boolean;
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

function isRoleEmail(email: string): boolean {
  const localPart = email.toLowerCase().split('@')[0];
  return ROLE_PREFIXES.has(localPart);
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

async function verifyEmail(email: string): Promise<VerificationResult> {
  const normalized = email.toLowerCase().trim();
  
  // 1. Validar sintaxis
  if (!validateSyntax(normalized)) {
    return { email: normalized, valid: false, reason: 'Invalid syntax', isRoleEmail: false };
  }
  
  // 2. Verificar disposable
  if (isDisposable(normalized)) {
    return { email: normalized, valid: false, reason: 'Disposable email domain', isRoleEmail: false };
  }
  
  // 3. Verificar MX records
  const domain = getDomain(normalized);
  const hasMx = await verifyMxRecords(domain);
  if (!hasMx) {
    return { email: normalized, valid: false, reason: `No MX records for ${domain}`, isRoleEmail: false };
  }
  
  // 4. Detectar role-based
  const roleEmail = isRoleEmail(normalized);
  
  return { 
    email: normalized, 
    valid: true, 
    reason: roleEmail ? 'Valid but role-based email' : 'Valid', 
    isRoleEmail: roleEmail 
  };
}

async function getContacts(): Promise<ContactRecord[]> {
  const client = await pool.connect();
  try {
    const query = `
      SELECT id, email, personal_email
      FROM music_industry_contacts
      WHERE email IS NOT NULL AND email != ''
      ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}
    `;
    const result = await client.query(query);
    return result.rows;
  } finally {
    client.release();
  }
}

async function markAsInvalid(id: number, reason: string): Promise<void> {
  const client = await pool.connect();
  try {
    // Añadir columna email_status si no existe
    await client.query(`
      ALTER TABLE music_industry_contacts 
      ADD COLUMN IF NOT EXISTS email_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP
    `);
    
    await client.query(`
      UPDATE music_industry_contacts
      SET email_status = 'invalid',
          email_verified_at = NOW()
      WHERE id = $1
    `, [id]);
  } finally {
    client.release();
  }
}

async function markAsValid(id: number, isRole: boolean): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE music_industry_contacts
      SET email_status = $2,
          email_verified_at = NOW()
      WHERE id = $1
    `, [id, isRole ? 'risky' : 'valid']);
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  console.log('═'.repeat(70));
  console.log('║   📧 MUSIC INDUSTRY CONTACTS - EMAIL VERIFICATION                ║');
  console.log('═'.repeat(70));
  console.log(`🔧 Fix Mode: ${FIX_MODE ? 'ON (will update DB)' : 'OFF (dry run)'}`);
  if (LIMIT > 0) console.log(`📏 Limit: ${LIMIT} emails`);
  console.log('─'.repeat(70));

  const contacts = await getContacts();
  console.log(`\n📋 Found ${contacts.length} contacts to verify\n`);

  if (contacts.length === 0) {
    console.log('✅ No contacts to verify!');
    await pool.end();
    return;
  }

  // Stats
  let valid = 0;
  let invalid = 0;
  let risky = 0;
  const invalidEmails: { id: number; email: string; reason: string }[] = [];
  const riskyEmails: { id: number; email: string }[] = [];

  // Process in batches
  const batchSize = 20;
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    
    const results = await Promise.all(
      batch.map(async (contact) => {
        const result = await verifyEmail(contact.email);
        return { contact, result };
      })
    );
    
    for (const { contact, result } of results) {
      if (result.valid) {
        if (result.isRoleEmail) {
          risky++;
          riskyEmails.push({ id: contact.id, email: result.email });
          if (FIX_MODE) await markAsValid(contact.id, true);
        } else {
          valid++;
          if (FIX_MODE) await markAsValid(contact.id, false);
        }
      } else {
        invalid++;
        invalidEmails.push({ id: contact.id, email: result.email, reason: result.reason });
        if (FIX_MODE) await markAsInvalid(contact.id, result.reason);
      }
    }
    
    // Progress
    const progress = Math.floor(((i + batch.length) / contacts.length) * 100);
    const bar = '█'.repeat(Math.floor(progress / 2)) + '░'.repeat(50 - Math.floor(progress / 2));
    process.stdout.write(`\r   [${bar}] ${progress}% (${i + batch.length}/${contacts.length})`);
  }
  
  console.log('\n');

  // Resumen
  const currentBounce = 8;
  const invalidPercent = (invalid / contacts.length) * 100;
  const estimatedNewBounce = Math.max(currentBounce - invalidPercent, 1);

  console.log('═'.repeat(70));
  console.log('║                    📊 VERIFICATION REPORT                        ║');
  console.log('═'.repeat(70));
  console.log(`\n📈 RESUMEN:`);
  console.log(`   Total verificados: ${contacts.length}`);
  console.log(`   ✅ Válidos:        ${valid} (${((valid/contacts.length)*100).toFixed(1)}%)`);
  console.log(`   ⚠️ Role-based:     ${risky} (${((risky/contacts.length)*100).toFixed(1)}%)`);
  console.log(`   ❌ Inválidos:      ${invalid} (${((invalid/contacts.length)*100).toFixed(1)}%)`);
  
  console.log(`\n📉 REDUCCIÓN DE BOUNCE ESTIMADA:`);
  console.log(`   ${currentBounce}% → ~${estimatedNewBounce.toFixed(1)}%`);

  // Top inválidos
  if (invalidEmails.length > 0) {
    console.log(`\n❌ EMAILS INVÁLIDOS (top 15):`);
    for (const e of invalidEmails.slice(0, 15)) {
      console.log(`   ${e.email}`);
      console.log(`   └─ ${e.reason}`);
    }
    if (invalidEmails.length > 15) {
      console.log(`   ... y ${invalidEmails.length - 15} más`);
    }
  }

  // Role-based
  if (riskyEmails.length > 0) {
    console.log(`\n⚠️ EMAILS ROLE-BASED (top 10):`);
    for (const e of riskyEmails.slice(0, 10)) {
      console.log(`   ${e.email}`);
    }
  }

  console.log('\n');
  
  if (!FIX_MODE && invalid > 0) {
    console.log(`💡 Ejecuta con --fix para marcar ${invalid} emails como inválidos en la DB`);
  }
  
  if (FIX_MODE) {
    console.log(`✅ Base de datos actualizada!`);
  }

  await pool.end();
}

main().catch(error => {
  console.error('Error:', error);
  pool.end();
  process.exit(1);
});
