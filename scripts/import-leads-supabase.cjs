/**
 * 🔄 IMPORT LEADS TO SUPABASE - Importar leads desde datos existentes
 * Para testing y carga inicial
 */

const { Pool } = require('pg');

// Supabase connection
const pool = new Pool({
  connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

// Leads de ejemplo (del dataset de Apify que ya teníamos)
const sampleLeads = [
  {
    email: 'alex@loudkult.com',
    personal_email: 'ajalex44@msn.com',
    first_name: 'Alex',
    last_name: 'Alexander',
    full_name: 'Alex Alexander',
    job_title: 'Co-owner (founder)',
    linkedin: 'https://www.linkedin.com/in/alex-alexander-13379853',
    company_name: 'Loudkult',
    company_website: 'https://www.loudkult.com',
    industry: 'Music',
    company_size: 25,
    city: 'Los Angeles',
    state: 'California',
    country: 'United States',
    company_description: '"By Artists For Artists" - We are an artist-friendly record label based in Stockholm',
    keywords: 'artist-friendly, music distribution, spotify playlists, demo submission, label management'
  },
  {
    email: 'adam@thecotillion.net',
    first_name: 'Adam',
    last_name: 'Hartke',
    full_name: 'Adam Hartke',
    job_title: 'Talent Buyer',
    company_name: 'The Cotillion',
    industry: 'Music',
    city: 'Wichita',
    state: 'Kansas',
    country: 'United States',
    company_description: 'Live music venue and event space'
  },
  {
    email: 'mathias@sorum.no',
    first_name: 'Mathias',
    last_name: 'Sorum',
    full_name: 'Mathias Sorum',
    job_title: 'Manager',
    company_name: 'Sorum',
    industry: 'Music',
    city: 'Oslo',
    country: 'Norway',
    company_description: 'Artist management and music consulting'
  },
  {
    email: 'booking@musicvenue.com',
    first_name: 'Sarah',
    last_name: 'Johnson',
    full_name: 'Sarah Johnson',
    job_title: 'Booking Manager',
    company_name: 'The Music Hall',
    industry: 'Music',
    city: 'Nashville',
    state: 'Tennessee',
    country: 'United States',
    company_description: 'Premier live music venue in Nashville'
  },
  {
    email: 'james@indielabel.com',
    first_name: 'James',
    last_name: 'Wilson',
    full_name: 'James Wilson',
    job_title: 'A&R Director',
    company_name: 'Indie Records',
    industry: 'Music',
    city: 'Brooklyn',
    state: 'New York',
    country: 'United States',
    company_description: 'Independent record label focused on emerging artists'
  }
];

async function importLeads() {
  console.log('\n' + '='.repeat(60));
  console.log('📦 IMPORTANDO LEADS A SUPABASE');
  console.log('='.repeat(60));

  const client = await pool.connect();
  
  try {
    let inserted = 0;
    let duplicates = 0;

    for (const lead of sampleLeads) {
      try {
        const result = await client.query(`
          INSERT INTO leads (
            email, personal_email, first_name, last_name, full_name,
            job_title, company_name, company_website, company_description,
            industry, company_size, city, state, country, linkedin, keywords, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'manual')
          ON CONFLICT (email) DO NOTHING
          RETURNING id
        `, [
          lead.email,
          lead.personal_email || null,
          lead.first_name,
          lead.last_name,
          lead.full_name,
          lead.job_title || null,
          lead.company_name || null,
          lead.company_website || null,
          lead.company_description || null,
          lead.industry || null,
          lead.company_size || null,
          lead.city || null,
          lead.state || null,
          lead.country || 'United States',
          lead.linkedin || null,
          lead.keywords || null
        ]);

        if (result.rows.length > 0) {
          // Crear status para nuevo lead
          await client.query(`
            INSERT INTO lead_status (lead_id, status, warmup_stage)
            VALUES ($1, 'new', 0)
          `, [result.rows[0].id]);
          
          inserted++;
          console.log(`✅ ${lead.first_name} ${lead.last_name} - ${lead.company_name}`);
        } else {
          duplicates++;
          console.log(`⏭️  ${lead.email} (ya existe)`);
        }
      } catch (err) {
        console.log(`❌ Error: ${err.message}`);
      }
    }

    // Stats
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN');
    console.log('='.repeat(60));
    console.log(`✅ Nuevos: ${inserted}`);
    console.log(`⏭️  Duplicados: ${duplicates}`);

    // Ver leads en BD
    const leads = await client.query(`
      SELECT l.first_name, l.last_name, l.company_name, l.email, ls.status, ls.warmup_stage
      FROM leads l
      JOIN lead_status ls ON l.id = ls.lead_id
      ORDER BY l.created_at DESC
    `);

    console.log('\n📋 LEADS EN SUPABASE:');
    console.log('─'.repeat(60));
    leads.rows.forEach((lead, i) => {
      console.log(`${i+1}. ${lead.first_name} ${lead.last_name} (${lead.company_name})`);
      console.log(`   📧 ${lead.email}`);
      console.log(`   📊 Status: ${lead.status} | Warmup: ${lead.warmup_stage}/3`);
    });

  } finally {
    client.release();
    await pool.end();
  }
}

importLeads();
