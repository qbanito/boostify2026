/**
 * 🚀 WARMUP SENDER - Envía emails de warmup respetando límites diarios
 * Lee de Supabase, genera con OpenAI, envía con Resend, actualiza status
 */

const { Pool } = require('pg');
const OpenAI = require('openai');
const { Resend } = require('resend');

// Conexiones
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.secrets') }); // overrides .env // overrides .env // overrides .env // overrides .env

const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const resend = new Resend(process.env.RESEND_API_INDUSTRY);

// Configuración - PREVIEW_MODE controlado por variable de entorno o argumento
// Por defecto FALSE para producción real
const FROM_EMAIL = 'carlos@boostifymusic.site';
const PREVIEW_MODE = process.env.PREVIEW_MODE === 'true' || process.argv.includes('--preview');
const PREVIEW_EMAIL = process.env.PREVIEW_EMAIL || 'convoycubano@gmail.com';

console.log(`\n🔧 MODO: ${PREVIEW_MODE ? '⚠️ PREVIEW (emails a ' + PREVIEW_EMAIL + ')' : '✅ PRODUCCIÓN (emails reales)'}`);

// 🎲 SUBJECT TEMPLATES aleatorios
const subjectTemplates = [
  (lead) => `${lead.first_name}, been following ${lead.company_name} - wow`,
  (lead) => `${lead.first_name}, finally reaching out`,
  (lead) => `man ${lead.first_name}, what you're building is 🔥`,
  (lead) => `${lead.first_name} - your approach is different`,
  (lead) => `${lead.first_name}, huge fan of what you do`,
  (lead) => `been meaning to reach out ${lead.first_name}`,
  (lead) => `${lead.first_name} - respect what you're doing`,
  (lead) => `${lead.first_name}, had to say something`,
  (lead) => `${lead.first_name} - can't believe we haven't connected`,
  (lead) => `what you've built with ${lead.company_name} 🔥`,
  (lead) => `${lead.first_name}, quick thought`,
  (lead) => `${lead.first_name} - been watching your work`,
  (lead) => `hey ${lead.first_name}, finally writing`,
  (lead) => `${lead.first_name}, this is overdue`,
  (lead) => `${lead.first_name} - huge respect`
];

async function generateBody(lead) {
  const prompt = `
You are writing a WARM, PERSONAL email to someone in the music industry.
Sound like you've been following their work and genuinely ADMIRE what they do.

Their info:
- Name: ${lead.first_name} ${lead.last_name}
- Role: ${lead.job_title || 'Music Professional'}
- Company: ${lead.company_name || 'their company'}
- Company Description: ${lead.company_description || 'N/A'}
- Industry: ${lead.industry || 'Music'}
- Location: ${lead.city || ''}, ${lead.state || ''}

🎯 TONE: Like reaching out to someone you've admired from afar

FLATTERY STRATEGY based on role:
- IF ARTIST: Compliment their music, sound, artistic vision, growth
- IF MANAGER/EXEC: Praise their business acumen, how they support artists
- IF FOUNDER: Respect what they've built, their vision for the industry

Write a SHORT email (3-4 sentences max) that:
1. START with a genuine compliment - something specific about them or their company
2. Make them feel RECOGNIZED and SPECIAL
3. Show you understand their world and challenges
4. Ask ONE casual question that invites conversation
5. Sign off like you're already friends

VIBE:
- Like texting an industry friend you respect
- Genuine admiration, not fake flattery
- Casual but respectful
- Brief but warm

Rules:
- NO HTML, just plain text
- NO links
- NO sales pitch ever
- Under 60 words
- Make them FEEL GOOD about themselves

Sign as: Carlos

Return ONLY the email body, no subject line.
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.8
  });

  return completion.choices[0].message.content.trim();
}

async function sendWarmupEmails() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 WARMUP SENDER - Enviando emails de calentamiento');
  console.log('='.repeat(60));
  console.log(`📧 From: ${FROM_EMAIL}`);
  console.log(`🔄 Mode: ${PREVIEW_MODE ? 'PREVIEW (a convoycubano)' : '🔴 PRODUCCIÓN (a leads reales)'}`);
  console.log('─'.repeat(60));

  const client = await pool.connect();

  try {
    // 1. Verificar límite diario
    const configResult = await client.query(`
      SELECT * FROM warmup_config WHERE domain = 'boostifymusic.site'
    `);
    
    if (configResult.rows.length === 0) {
      console.log('❌ No hay configuración de warmup');
      return;
    }

    const config = configResult.rows[0];
    
    // Reset contador si es nuevo día
    const today = new Date().toISOString().split('T')[0];
    if (config.last_reset !== today) {
      await client.query(`
        UPDATE warmup_config 
        SET sent_today = 0, last_reset = $1
        WHERE domain = 'boostifymusic.site'
      `, [today]);
      config.sent_today = 0;
    }

    const remaining = config.daily_limit - config.sent_today;
    console.log(`\n📊 LÍMITE DIARIO:`);
    console.log(`   • Límite: ${config.daily_limit}/día`);
    console.log(`   • Enviados hoy: ${config.sent_today}`);
    console.log(`   • Disponibles: ${remaining}`);
    console.log(`   • Semana de warmup: ${config.warmup_week}`);

    if (remaining <= 0) {
      console.log('\n⚠️  Límite diario alcanzado. Intenta mañana.');
      return;
    }

    // 2. Obtener leads pendientes
    const leadsResult = await client.query(`
      SELECT l.*, ls.warmup_stage, ls.id as status_id
      FROM leads l
      JOIN lead_status ls ON l.id = ls.lead_id
      WHERE ls.status IN ('new', 'warming')
        AND ls.warmup_stage < 3
        AND (ls.next_email_at IS NULL OR ls.next_email_at <= NOW())
      ORDER BY ls.warmup_stage ASC, l.created_at ASC
      LIMIT $1
    `, [remaining]);

    if (leadsResult.rows.length === 0) {
      console.log('\n✅ No hay leads pendientes de warmup');
      return;
    }

    console.log(`\n📋 LEADS A CONTACTAR: ${leadsResult.rows.length}`);
    console.log('─'.repeat(60));

    // 3. Enviar emails
    let sent = 0;
    for (const lead of leadsResult.rows) {
      const nextStage = lead.warmup_stage + 1;
      const emailType = `warmup_${nextStage}`;

      console.log(`\n📧 ${lead.first_name} ${lead.last_name} (${lead.company_name})`);
      console.log(`   Stage: ${nextStage}/3`);

      // Generar subject aleatorio
      const subjectFn = subjectTemplates[Math.floor(Math.random() * subjectTemplates.length)];
      const subject = subjectFn(lead);
      console.log(`   Subject: ${subject}`);

      // Generar body con OpenAI
      const body = await generateBody(lead);
      console.log(`   Body: ${body.substring(0, 50)}...`);

      // Enviar email
      const toEmail = PREVIEW_MODE ? PREVIEW_EMAIL : lead.email;
      
      try {
        const emailResult = await resend.emails.send({
          from: `Carlos <${FROM_EMAIL}>`,
          to: toEmail,
          reply_to: ['convoycubano@gmail.com', FROM_EMAIL], // 📬 Respuestas a Gmail + copia en Resend
          subject: subject,
          text: body
        });

        // Guardar en email_sends
        await client.query(`
          INSERT INTO email_sends (lead_id, resend_id, from_email, to_email, subject, body, email_type, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent')
        `, [lead.id, emailResult.data?.id, FROM_EMAIL, toEmail, subject, body, emailType]);

        // Actualizar lead_status
        await client.query(`
          UPDATE lead_status
          SET status = 'warming',
              warmup_stage = $1,
              emails_sent = emails_sent + 1,
              last_email_at = NOW(),
              next_email_at = NOW() + INTERVAL '2 days'
          WHERE id = $2
        `, [nextStage, lead.status_id]);

        // Actualizar contador diario
        await client.query(`
          UPDATE warmup_config
          SET sent_today = sent_today + 1
          WHERE domain = 'boostifymusic.site'
        `);

        sent++;
        console.log(`   ✅ Enviado a ${toEmail}`);

      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
      }
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN');
    console.log('='.repeat(60));
    console.log(`✅ Emails enviados: ${sent}`);
    console.log(`📧 Restantes hoy: ${remaining - sent}`);

    // Stats actuales
    const stats = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'new') as new_leads,
        COUNT(*) FILTER (WHERE status = 'warming') as warming,
        COUNT(*) FILTER (WHERE warmup_stage = 3) as warmup_complete
      FROM lead_status
    `);
    
    console.log(`\n📈 ESTADO DE LEADS:`);
    console.log(`   • Nuevos: ${stats.rows[0].new_leads}`);
    console.log(`   • En warmup: ${stats.rows[0].warming}`);
    console.log(`   • Warmup completo: ${stats.rows[0].warmup_complete}`);

  } finally {
    client.release();
    await pool.end();
  }
}

sendWarmupEmails();
