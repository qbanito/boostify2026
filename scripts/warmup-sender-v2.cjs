/**
 * 🚀 WARMUP SENDER - Multi-Campaign Version
 * 
 * Uso: 
 *   node warmup-sender-v2.cjs INDUSTRY     -> Usa BREVO (info@boostifymusic.com)
 *   node warmup-sender-v2.cjs ARTISTS_1    -> Usa RESEND (boostifymusic.site)
 *   node warmup-sender-v2.cjs ARTISTS_2    -> Usa RESEND (boostifymusic.space)
 *   node warmup-sender-v2.cjs ARTISTS_3    -> Usa RESEND (boostifymusic.sbs)
 *   node warmup-sender-v2.cjs ARTISTS_4    -> Usa RESEND (boostifymusic.online)
 * 
 * Listar campañas: node -e "require('./scripts/campaigns/campaign-loader.cjs').list()"
 */

// Cargar variables de entorno desde .env (para ejecución local)
try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
} catch (e) {
  // dotenv no disponible - usar variables de entorno directas
}

const { Pool } = require('pg');
const OpenAI = require('openai');
const { Resend } = require('resend');
const loadCampaign = require('./campaigns/campaign-loader.cjs');

// Obtener campaña desde argumentos
const campaignArg = process.argv[2] || 'ARTISTS_1';
const config = loadCampaign(campaignArg);

// Determinar proveedor de email según la campaña
const USE_BREVO = config.id === 'INDUSTRY';

// Conexiones con APIs de la campaña
const pool = new Pool({
  connectionString: config.supabase.connectionString,
  ssl: { rejectUnauthorized: false }
});

const openai = new OpenAI({
  apiKey: config.apis.openai
});

// Configurar APIs de Email según campaña
let brevoApiInstance = null;
let resendClient = null;

if (USE_BREVO) {
  // BREVO para INDUSTRY (info@boostifymusic.com)
  const SibApiV3Sdk = require('@getbrevo/brevo');
  brevoApiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const brevoApiKey = brevoApiInstance.authentications['apiKey'];
  brevoApiKey.apiKey = config.apis.brevo || process.env.BREVO_API_KEY;
  
  if (!brevoApiKey.apiKey) {
    console.error('❌ ERROR: BREVO_API_KEY no configurada');
    process.exit(1);
  }
} else {
  // RESEND para ARTISTS campaigns
  const resendApiKey = config.apis.resend;
  if (!resendApiKey) {
    console.error(`❌ ERROR: RESEND API KEY no configurada para ${config.id}`);
    console.error(`   Variable esperada: RESEND_API_${config.id}`);
    process.exit(1);
  }
  resendClient = new Resend(resendApiKey);
}

// Configuración - PREVIEW_MODE controlado por variable de entorno o argumento
// Por defecto FALSE para producción real
const PREVIEW_MODE = process.env.PREVIEW_MODE === 'true' || process.argv.includes('--preview');
const PREVIEW_EMAIL = process.env.PREVIEW_EMAIL || 'convoycubano@gmail.com';

const emailProvider = USE_BREVO ? 'BREVO' : 'RESEND';
console.log(`\n🔧 MODO: ${PREVIEW_MODE ? '⚠️ PREVIEW (emails a ' + PREVIEW_EMAIL + ')' : '✅ PRODUCCIÓN (emails reales)'}`);
console.log(`📧 Usando: ${emailProvider} para ${config.domain}`);

// 🎲 SUBJECT TEMPLATES aleatorios
const subjectTemplates = [
  (lead) => `${lead.first_name}, been following ${lead.company_name || 'your work'} - wow`,
  (lead) => `${lead.first_name}, finally reaching out`,
  (lead) => `man ${lead.first_name}, what you're building is 🔥`,
  (lead) => `${lead.first_name} - your approach is different`,
  (lead) => `${lead.first_name}, huge fan of what you do`,
  (lead) => `been meaning to reach out ${lead.first_name}`,
  (lead) => `${lead.first_name} - respect what you're doing`,
  (lead) => `${lead.first_name}, had to say something`,
  (lead) => `${lead.first_name} - can't believe we haven't connected`,
  (lead) => `what you've built ${lead.first_name} 🔥`,
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

Rules:
- NO HTML, just plain text
- NO links
- NO sales pitch ever
- Under 60 words
- Make them FEEL GOOD about themselves

Sign as: Alex

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
  console.log(`🚀 WARMUP SENDER - ${config.name}`);
  console.log('='.repeat(60));
  console.log(`📧 From: ${config.fromEmail}`);
  console.log(`🌐 Dominio: ${config.domain}`);
  console.log(`🔄 Mode: ${PREVIEW_MODE ? 'PREVIEW (a convoycubano)' : '🔴 PRODUCCIÓN'}`);
  console.log('─'.repeat(60));

  const client = await pool.connect();

  try {
    // 1. Verificar/crear config de warmup para este dominio
    let configResult = await client.query(`
      SELECT * FROM warmup_config WHERE domain = $1
    `, [config.domain]);
    
    if (configResult.rows.length === 0) {
      // Crear config para este dominio
      await client.query(`
        INSERT INTO warmup_config (domain, daily_limit, warmup_day, warmup_week)
        VALUES ($1, $2, 1, 1)
      `, [config.domain, config.warmup.currentLimit]);
      
      configResult = await client.query(`
        SELECT * FROM warmup_config WHERE domain = $1
      `, [config.domain]);
    }

    const warmupConfig = configResult.rows[0];
    
    // Reset contador si es nuevo día
    const today = new Date().toISOString().split('T')[0];
    if (warmupConfig.last_reset !== today) {
      await client.query(`
        UPDATE warmup_config 
        SET sent_today = 0, last_reset = $1
        WHERE domain = $2
      `, [today, config.domain]);
      warmupConfig.sent_today = 0;
    }

    const remaining = warmupConfig.daily_limit - warmupConfig.sent_today;
    console.log(`\n📊 LÍMITE DIARIO (${config.domain}):`);
    console.log(`   • Límite: ${warmupConfig.daily_limit}/día`);
    console.log(`   • Enviados hoy: ${warmupConfig.sent_today}`);
    console.log(`   • Disponibles: ${remaining}`);

    if (remaining <= 0) {
      console.log('\n⚠️  Límite diario alcanzado. Intenta mañana.');
      return;
    }

    // 2. Obtener leads pendientes (filtrar por source/campaign si es necesario)
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

    // Función para delay aleatorio (simula comportamiento humano)
    const randomDelay = (min, max) => {
      const ms = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
      console.log(`   ⏱️ Esperando ${Math.round(ms/1000)}s antes del siguiente email...`);
      return new Promise(resolve => setTimeout(resolve, ms));
    };

    // 3. Enviar emails con delays aleatorios
    let sent = 0;
    for (let i = 0; i < leadsResult.rows.length; i++) {
      const lead = leadsResult.rows[i];
      const nextStage = lead.warmup_stage + 1;
      const emailType = `warmup_${nextStage}`;

      console.log(`\n📧 [${i+1}/${leadsResult.rows.length}] ${lead.first_name} ${lead.last_name} (${lead.company_name || 'N/A'})`);
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
        let messageId;
        
        if (USE_BREVO) {
          // ═══════════════════════════════════════════════════════
          // BREVO para INDUSTRY (info@boostifymusic.com)
          // ═══════════════════════════════════════════════════════
          const SibApiV3Sdk = require('@getbrevo/brevo');
          const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
          sendSmtpEmail.sender = { name: config.fromName, email: config.fromEmail };
          sendSmtpEmail.to = [{ email: toEmail, name: `${lead.first_name} ${lead.last_name}` }];
          sendSmtpEmail.replyTo = { email: 'convoycubano@gmail.com', name: 'Boostify Support' };
          sendSmtpEmail.subject = subject;
          sendSmtpEmail.textContent = body;
          
          console.log(`   📤 Enviando via BREVO desde ${config.fromEmail}...`);
          const emailResult = await brevoApiInstance.sendTransacEmail(sendSmtpEmail);
          messageId = emailResult?.messageId || emailResult?.body?.messageId || `brevo_${Date.now()}`;
          console.log(`   📧 Brevo MessageId: ${messageId}`);
          
        } else {
          // ═══════════════════════════════════════════════════════
          // RESEND para ARTISTS (boostifymusic.site/space/sbs/online)
          // ═══════════════════════════════════════════════════════
          console.log(`   📤 Enviando via RESEND desde ${config.fromEmail}...`);
          const emailResult = await resendClient.emails.send({
            from: `${config.fromName} <${config.fromEmail}>`,
            to: [toEmail],
            reply_to: 'convoycubano@gmail.com',
            subject: subject,
            text: body,
          });
          
          if (emailResult.error) {
            throw new Error(emailResult.error.message || 'Resend error');
          }
          messageId = emailResult.data?.id || `resend_${Date.now()}`;
          console.log(`   📧 Resend MessageId: ${messageId}`);
        }

        // Guardar en email_sends
        await client.query(`
          INSERT INTO email_sends (lead_id, resend_id, from_email, to_email, subject, body, email_type, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent')
        `, [lead.id, messageId, config.fromEmail, toEmail, subject, body, emailType]);

        // Actualizar lead_status
        await client.query(`
          UPDATE lead_status
          SET status = 'warming',
              warmup_stage = $1,
              emails_sent = emails_sent + 1,
              last_email_at = NOW(),
              next_email_at = NOW() + INTERVAL '${config.warmup.daysBetweenEmails} days'
          WHERE id = $2
        `, [nextStage, lead.status_id]);

        // Actualizar contador diario
        await client.query(`
          UPDATE warmup_config
          SET sent_today = sent_today + 1
          WHERE domain = $1
        `, [config.domain]);

        sent++;
        console.log(`   ✅ Enviado a ${toEmail}`);

        // Delay aleatorio entre emails (30-90 segundos) para parecer humano
        if (i < leadsResult.rows.length - 1) {
          await randomDelay(30, 90);
        }

      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        // Delay más corto en caso de error
        if (i < leadsResult.rows.length - 1) {
          await randomDelay(5, 15);
        }
      }
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log(`📊 RESUMEN - ${config.name}`);
    console.log('='.repeat(60));
    console.log(`📧 Proveedor: ${USE_BREVO ? 'BREVO' : 'RESEND'}`);
    console.log(`✅ Emails enviados: ${sent}`);
    console.log(`📧 Restantes hoy: ${remaining - sent}`);

  } finally {
    client.release();
    await pool.end();
  }
}

sendWarmupEmails();
