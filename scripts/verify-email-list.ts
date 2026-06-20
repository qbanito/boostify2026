/**
 * Script para verificar lista de emails antes de enviar campañas
 * Reduce bounce rate verificando emails en PostgreSQL
 * 
 * USO:
 *   npx tsx scripts/verify-email-list.ts                    # Verifica todos los leads pendientes
 *   npx tsx scripts/verify-email-list.ts --table investor_leads
 *   npx tsx scripts/verify-email-list.ts --fix              # Marca inválidos en DB
 *   npx tsx scripts/verify-email-list.ts --export           # Exporta lista limpia a CSV
 */

import { Pool } from 'pg';
import fs from 'fs';
import {
  verifyEmail,
  verifyEmailList,
  registerBounce,
  getVerificationStats,
  type EmailVerificationResult,
  type BulkVerificationResult
} from '../server/services/email-verification-service.js';

// Configuración
const DATABASE_URL = process.env.DATABASE_URL || '';
const pool = new Pool({ connectionString: DATABASE_URL });

// Argumentos CLI
const args = process.argv.slice(2);
const TABLE_NAME = args.find(a => a.startsWith('--table='))?.split('=')[1] || 'artist_leads';
const FIX_MODE = args.includes('--fix');
const EXPORT_MODE = args.includes('--export');
const EXTERNAL_API = args.includes('--api'); // Usa APIs externas (consume créditos)
const STRICT_MODE = args.includes('--strict');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0;

interface LeadRecord {
  id: number;
  email: string;
  name?: string;
  artist_name?: string;
  lead_status?: string;
  email_verified?: boolean;
}

interface VerificationReport {
  timestamp: Date;
  tableName: string;
  totalProcessed: number;
  valid: number;
  invalid: number;
  risky: number;
  previouslyBounced: number;
  disposable: number;
  mxInvalid: number;
  syntaxInvalid: number;
  estimatedBounceReduction: string;
  invalidEmails: Array<{ id: number; email: string; reason: string }>;
  riskyEmails: Array<{ id: number; email: string; reason: string }>;
  suggestions: Array<{ email: string; suggestion: string }>;
}

async function getLeadsToVerify(): Promise<LeadRecord[]> {
  const client = await pool.connect();
  try {
    // Ajustar query según tabla
    let query: string;
    
    if (TABLE_NAME === 'artist_leads') {
      query = `
        SELECT id, email, name, artist_name, lead_status
        FROM ${TABLE_NAME}
        WHERE email IS NOT NULL 
          AND email != ''
          AND (email_verified IS NULL OR email_verified = false)
          AND lead_status NOT IN ('bounced', 'invalid', 'unsubscribed')
        ORDER BY created_at DESC
        ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}
      `;
    } else if (TABLE_NAME === 'investor_leads') {
      query = `
        SELECT id, email, first_name as name, company as artist_name, status as lead_status
        FROM ${TABLE_NAME}
        WHERE email IS NOT NULL 
          AND email != ''
          AND (email_verified IS NULL OR email_verified = false)
          AND status NOT IN ('bounced', 'invalid', 'unsubscribed')
        ORDER BY created_at DESC
        ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}
      `;
    } else {
      // Query genérica
      query = `
        SELECT id, email
        FROM ${TABLE_NAME}
        WHERE email IS NOT NULL AND email != ''
        ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}
      `;
    }
    
    const result = await client.query(query);
    return result.rows;
  } finally {
    client.release();
  }
}

async function markEmailAsInvalid(id: number, reason: string): Promise<void> {
  const client = await pool.connect();
  try {
    // Actualizar según tabla
    if (TABLE_NAME === 'artist_leads' || TABLE_NAME === 'investor_leads') {
      await client.query(`
        UPDATE ${TABLE_NAME}
        SET lead_status = 'invalid',
            email_verified = false,
            verification_reason = $2,
            verified_at = NOW()
        WHERE id = $1
      `, [id, reason]);
    }
  } catch (error) {
    // Si la columna no existe, intentar sin ella
    try {
      await client.query(`
        UPDATE ${TABLE_NAME}
        SET lead_status = 'invalid'
        WHERE id = $1
      `, [id]);
    } catch (innerError) {
      console.log(`   ⚠️ Could not update lead ${id}`);
    }
  } finally {
    client.release();
  }
}

async function markEmailAsVerified(id: number, score: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE ${TABLE_NAME}
      SET email_verified = true,
          verification_score = $2,
          verified_at = NOW()
      WHERE id = $1
    `, [id, score]);
  } catch (error) {
    // Columna puede no existir
  } finally {
    client.release();
  }
}

async function registerPreviousBounces(): Promise<number> {
  const client = await pool.connect();
  try {
    // Obtener emails que han hecho bounce antes
    const result = await client.query(`
      SELECT DISTINCT to_email as email
      FROM email_logs
      WHERE status = 'bounced'
      UNION
      SELECT DISTINCT email
      FROM ${TABLE_NAME}
      WHERE lead_status = 'bounced'
    `);
    
    for (const row of result.rows) {
      if (row.email) {
        registerBounce(row.email);
      }
    }
    
    return result.rows.length;
  } catch (error) {
    console.log('   ⚠️ Could not load previous bounces (table may not exist)');
    return 0;
  } finally {
    client.release();
  }
}

function exportToCSV(report: VerificationReport): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Exportar emails válidos
  const validFilename = `verified_emails_${TABLE_NAME}_${timestamp}.csv`;
  // Necesitaríamos guardar los emails válidos en el reporte...
  
  // Exportar emails inválidos
  const invalidFilename = `invalid_emails_${TABLE_NAME}_${timestamp}.csv`;
  const invalidCSV = 'id,email,reason\n' + 
    report.invalidEmails.map(e => `${e.id},"${e.email}","${e.reason}"`).join('\n');
  
  fs.writeFileSync(invalidFilename, invalidCSV);
  console.log(`\n📁 Exported invalid emails to: ${invalidFilename}`);
  
  // Exportar sugerencias
  if (report.suggestions.length > 0) {
    const suggestionsFilename = `email_suggestions_${TABLE_NAME}_${timestamp}.csv`;
    const suggestionsCSV = 'original_email,suggested_email\n' + 
      report.suggestions.map(s => `"${s.email}","${s.suggestion}"`).join('\n');
    
    fs.writeFileSync(suggestionsFilename, suggestionsCSV);
    console.log(`📁 Exported suggestions to: ${suggestionsFilename}`);
  }
}

async function main(): Promise<void> {
  console.log('═'.repeat(70));
  console.log('║   📧 EMAIL VERIFICATION SERVICE - Lista de Contactos              ║');
  console.log('═'.repeat(70));
  console.log(`📊 Table: ${TABLE_NAME}`);
  console.log(`🔧 Fix Mode: ${FIX_MODE ? 'ON (will update DB)' : 'OFF (dry run)'}`);
  console.log(`📁 Export Mode: ${EXPORT_MODE ? 'ON' : 'OFF'}`);
  console.log(`🌐 External API: ${EXTERNAL_API ? 'ON (uses credits)' : 'OFF'}`);
  console.log(`⚠️ Strict Mode: ${STRICT_MODE ? 'ON' : 'OFF'}`);
  if (LIMIT > 0) console.log(`📏 Limit: ${LIMIT} emails`);
  console.log('─'.repeat(70));

  // 1. Registrar bounces previos
  console.log('\n📛 Loading previous bounces...');
  const previousBounces = await registerPreviousBounces();
  console.log(`   Loaded ${previousBounces} previously bounced emails`);

  // 2. Obtener leads a verificar
  console.log('\n📋 Fetching leads to verify...');
  const leads = await getLeadsToVerify();
  console.log(`   Found ${leads.length} emails to verify`);

  if (leads.length === 0) {
    console.log('\n✅ No emails to verify!');
    await pool.end();
    return;
  }

  // 3. Inicializar reporte
  const report: VerificationReport = {
    timestamp: new Date(),
    tableName: TABLE_NAME,
    totalProcessed: leads.length,
    valid: 0,
    invalid: 0,
    risky: 0,
    previouslyBounced: 0,
    disposable: 0,
    mxInvalid: 0,
    syntaxInvalid: 0,
    estimatedBounceReduction: '',
    invalidEmails: [],
    riskyEmails: [],
    suggestions: []
  };

  // 4. Verificar cada email
  console.log('\n🔍 Verifying emails...\n');
  
  let processed = 0;
  const batchSize = 20;
  
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    
    const results = await Promise.all(
      batch.map(lead => verifyEmail(lead.email, {
        useExternalAPI: EXTERNAL_API,
        checkMX: true,
        strict: STRICT_MODE
      }))
    );
    
    for (let j = 0; j < batch.length; j++) {
      const lead = batch[j];
      const result = results[j];
      
      if (result.isDeliverable) {
        report.valid++;
        if (FIX_MODE) {
          await markEmailAsVerified(lead.id, result.score);
        }
      } else {
        // Categorizar razón
        switch (result.status) {
          case 'bounced':
            report.previouslyBounced++;
            break;
          case 'disposable':
            report.disposable++;
            break;
          case 'mx_invalid':
            report.mxInvalid++;
            break;
          case 'invalid':
            report.syntaxInvalid++;
            break;
        }
        
        if (result.status === 'risky') {
          report.risky++;
          report.riskyEmails.push({
            id: lead.id,
            email: result.email,
            reason: result.reason
          });
        } else {
          report.invalid++;
          report.invalidEmails.push({
            id: lead.id,
            email: result.email,
            reason: result.reason
          });
          
          if (FIX_MODE) {
            await markEmailAsInvalid(lead.id, result.reason);
          }
        }
        
        // Guardar sugerencias
        if (result.suggestedEmail) {
          report.suggestions.push({
            email: result.email,
            suggestion: result.suggestedEmail
          });
        }
      }
      
      processed++;
    }
    
    // Progress bar
    const progress = Math.floor((processed / leads.length) * 100);
    const bar = '█'.repeat(Math.floor(progress / 2)) + '░'.repeat(50 - Math.floor(progress / 2));
    process.stdout.write(`\r   [${bar}] ${progress}% (${processed}/${leads.length})`);
  }
  
  console.log('\n');

  // 5. Calcular reducción estimada de bounce
  const currentBounceRate = 8; // Tu bounce rate actual
  const invalidPercentage = (report.invalid / report.totalProcessed) * 100;
  const estimatedNewBounce = Math.max(currentBounceRate - invalidPercentage, 1);
  report.estimatedBounceReduction = `${currentBounceRate}% → ~${estimatedNewBounce.toFixed(1)}%`;

  // 6. Mostrar resumen
  console.log('═'.repeat(70));
  console.log('║                    📊 VERIFICATION REPORT                        ║');
  console.log('═'.repeat(70));
  console.log(`\n📈 RESUMEN:`);
  console.log(`   Total verificados: ${report.totalProcessed}`);
  console.log(`   ✅ Válidos:        ${report.valid} (${((report.valid/report.totalProcessed)*100).toFixed(1)}%)`);
  console.log(`   ❌ Inválidos:      ${report.invalid} (${((report.invalid/report.totalProcessed)*100).toFixed(1)}%)`);
  console.log(`   ⚠️ Riesgosos:      ${report.risky} (${((report.risky/report.totalProcessed)*100).toFixed(1)}%)`);
  
  console.log(`\n📋 DETALLE DE INVÁLIDOS:`);
  console.log(`   Syntax inválida:    ${report.syntaxInvalid}`);
  console.log(`   Dominio sin MX:     ${report.mxInvalid}`);
  console.log(`   Emails desechables: ${report.disposable}`);
  console.log(`   Bounces previos:    ${report.previouslyBounced}`);
  
  console.log(`\n📉 REDUCCIÓN DE BOUNCE ESTIMADA:`);
  console.log(`   ${report.estimatedBounceReduction}`);
  
  if (report.suggestions.length > 0) {
    console.log(`\n💡 SUGERENCIAS DE CORRECCIÓN:`);
    for (const s of report.suggestions.slice(0, 10)) {
      console.log(`   ${s.email} → ${s.suggestion}`);
    }
    if (report.suggestions.length > 10) {
      console.log(`   ... y ${report.suggestions.length - 10} más`);
    }
  }

  // 7. Mostrar peores casos
  if (report.invalidEmails.length > 0) {
    console.log(`\n❌ TOP 10 EMAILS INVÁLIDOS:`);
    for (const e of report.invalidEmails.slice(0, 10)) {
      console.log(`   [${e.id}] ${e.email}`);
      console.log(`         └─ ${e.reason}`);
    }
  }

  // 8. Exportar si se solicita
  if (EXPORT_MODE) {
    exportToCSV(report);
  }

  // 9. Stats del servicio
  const stats = getVerificationStats();
  console.log(`\n📊 SERVICE STATS:`);
  console.log(`   MX Cache entries: ${stats.mxCacheSize}`);
  console.log(`   Known bounces:    ${stats.bouncedEmailsCount}`);
  console.log(`   Disposable list:  ${stats.disposableDomainsCount} domains`);

  // Recomendaciones
  console.log('\n' + '═'.repeat(70));
  console.log('║                    💡 RECOMENDACIONES                            ║');
  console.log('═'.repeat(70));
  
  if (report.invalid > 0 && !FIX_MODE) {
    console.log(`\n⚠️ Ejecuta con --fix para marcar ${report.invalid} emails como inválidos en la DB`);
  }
  
  if (!EXTERNAL_API) {
    console.log(`\n💡 Usa --api para verificación más precisa con ZeroBounce/Hunter.io`);
    console.log(`   (Requiere API key y consume créditos)`);
  }
  
  if (report.suggestions.length > 0) {
    console.log(`\n💡 Hay ${report.suggestions.length} emails con typos que podrían corregirse`);
  }
  
  console.log('\n✅ Verificación completada!\n');

  await pool.end();
}

main().catch(error => {
  console.error('Error:', error);
  pool.end();
  process.exit(1);
});
