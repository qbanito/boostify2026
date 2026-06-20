/**
 * Import Music Industry Contacts from CSV
 * Usage: npx tsx scripts/import-industry-contacts.ts <path-to-csv>
 */

// Load environment variables first
import 'dotenv/config';

import { db } from '../db';
import { musicIndustryContacts } from '../db/schema';
import * as fs from 'fs';
import * as path from 'path';

// CSV Parser - Simple implementation for this format
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n');
  if (lines.length < 2) return [];
  
  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  const records: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const record: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    records.push(record);
  }
  
  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Determine category based on industry/keywords
function determineCategory(record: Record<string, string>): string {
  const industry = (record.industry || '').toLowerCase();
  const keywords = (record.keywords || '').toLowerCase();
  const companyName = (record.company_name || '').toLowerCase();
  const description = (record.company_description || '').toLowerCase();
  
  const combined = `${industry} ${keywords} ${companyName} ${description}`;
  
  if (combined.includes('record label') || combined.includes('warner') || combined.includes('universal') || combined.includes('sony music') || combined.includes('atlantic') || combined.includes('elektra')) {
    return 'record_label';
  }
  if (combined.includes('publishing') || combined.includes('ascap') || combined.includes('bmi') || combined.includes('sesac') || combined.includes('songwriter')) {
    return 'publishing';
  }
  if (combined.includes('radio') || combined.includes('broadcast')) {
    return 'radio';
  }
  if (combined.includes('tv') || combined.includes('television') || combined.includes('netflix') || combined.includes('film') || combined.includes('movie')) {
    return 'tv';
  }
  if (combined.includes('sync') || combined.includes('supervision') || combined.includes('licensing')) {
    return 'sync';
  }
  if (combined.includes('studio') || combined.includes('recording') || combined.includes('mastering') || combined.includes('producer')) {
    return 'studio';
  }
  if (combined.includes('streaming') || combined.includes('spotify') || combined.includes('beatport') || combined.includes('deezer') || combined.includes('tidal')) {
    return 'streaming';
  }
  if (combined.includes('live') || combined.includes('concert') || combined.includes('festival') || combined.includes('tour') || combined.includes('venue')) {
    return 'live_events';
  }
  if (combined.includes('pr ') || combined.includes('public relations') || combined.includes('marketing') || combined.includes('promotion')) {
    return 'pr_marketing';
  }
  if (combined.includes('distribution') || combined.includes('distrokid') || combined.includes('tunecore') || combined.includes('cd baby')) {
    return 'distribution';
  }
  
  return 'other';
}

async function importContacts(csvPath: string) {
  console.log('📂 Reading CSV file:', csvPath);
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ File not found:', csvPath);
    process.exit(1);
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parseCSV(content);
  
  console.log(`📊 Found ${records.length} records to import`);
  
  const batchId = `csv_import_${Date.now()}`;
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  // Process in batches of 100
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const contactsToInsert = [];
    
    for (const record of batch) {
      // Skip if no email at all
      const email = record.email || record.personal_email;
      if (!email) {
        skipped++;
        continue;
      }
      
      // Skip if no name
      const fullName = record.full_name || `${record.first_name || ''} ${record.last_name || ''}`.trim();
      if (!fullName) {
        skipped++;
        continue;
      }
      
      try {
        const contact = {
          fullName,
          firstName: record.first_name || null,
          lastName: record.last_name || null,
          email: record.email || null,
          personalEmail: record.personal_email || null,
          phone: record.company_phone || null,
          mobileNumber: record.mobile_number || null,
          
          jobTitle: record.job_title || null,
          headline: record.headline || null,
          seniorityLevel: record.seniority_level || null,
          functionalLevel: record.functional_level || null,
          industry: record.industry || null,
          
          companyName: record.company_name || null,
          companyDomain: record.company_domain || null,
          companyWebsite: record.company_website || null,
          companyLinkedin: record.company_linkedin || null,
          companyPhone: record.company_phone || null,
          companySize: record.company_size || null,
          companyAnnualRevenue: record.company_annual_revenue || null,
          companyFoundedYear: record.company_founded_year ? parseInt(record.company_founded_year) : null,
          companyDescription: record.company_description?.substring(0, 5000) || null, // Limit description length
          companyTechnologies: record.company_technologies || null,
          
          city: record.city || record.company_city || null,
          state: record.state || record.company_state || null,
          country: record.country || record.company_country || null,
          companyFullAddress: record.company_full_address || null,
          
          linkedin: record.linkedin || null,
          
          category: determineCategory(record) as any,
          keywords: record.keywords?.substring(0, 2000) || null, // Limit keywords length
          
          status: 'new' as const,
          importSource: 'csv',
          importBatchId: batchId,
        };
        
        contactsToInsert.push(contact);
      } catch (err) {
        console.error(`Error processing record: ${fullName}`, err);
        errors++;
      }
    }
    
    // Bulk insert batch
    if (contactsToInsert.length > 0) {
      try {
        await db.insert(musicIndustryContacts).values(contactsToInsert);
        imported += contactsToInsert.length;
        console.log(`✅ Imported ${imported}/${records.length} contacts...`);
      } catch (err: any) {
        console.error(`❌ Batch insert error:`, err.message);
        errors += contactsToInsert.length;
      }
    }
  }
  
  console.log('\n========================================');
  console.log('📊 IMPORT SUMMARY');
  console.log('========================================');
  console.log(`✅ Imported: ${imported}`);
  console.log(`⏭️  Skipped: ${skipped} (no email or name)`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📦 Batch ID: ${batchId}`);
  console.log('========================================\n');
  
  process.exit(0);
}

// Run import
const csvPath = process.argv[2];
if (!csvPath) {
  console.log('Usage: npx tsx scripts/import-industry-contacts.ts <path-to-csv>');
  console.log('Example: npx tsx scripts/import-industry-contacts.ts ./contacts.csv');
  process.exit(1);
}

importContacts(path.resolve(csvPath));
