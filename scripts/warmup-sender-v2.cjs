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
const { fetchContacts, markContacted, isMissingRelation } = require('./email-smart-router.cjs');

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

// � Identidad del CEO + demo real de la plataforma
const DEMO_ARTISTS = [
  { name: 'REDWINE — "Vino con Sal"', genre: 'Pop / Hip-Hop / Reggaeton / R&B', url: 'https://www.boostifymusic.com/artist/redwine_vinoconsal' },
  { name: 'REDWINE — "Life Vol. II"', genre: 'Pop / R&B / Urban', url: 'https://www.boostifymusic.com/artist/redwine_lifevol2' },
  { name: 'REDWINE — full catalog', genre: 'Multi-genre (Pop, Blues, Hip-Hop, Electronic)', url: 'https://www.boostifymusic.com/artist/redwineli' },
  { name: 'QBANITO — "Nocturnal"', genre: 'Electronic / Dark Pop / Synthwave', url: 'https://www.boostifymusic.com/artist/qbanito-nocturnal' },
  { name: 'QBANITO — "Conciencia"', genre: 'Afrobeat / Deep House / Conscious Hip-Hop', url: 'https://www.boostifymusic.com/artist/qbanito_conciencia' },
  { name: 'QBANITO — "Latin Bollywood"', genre: 'Latin Bollywood / Reggaeton fusion', url: 'https://www.boostifymusic.com/artist/qbanitobollwood' },
];
const PLATFORM_URL = 'https://www.boostifymusic.com';
const pickDemo = () => DEMO_ARTISTS[Math.floor(Math.random() * DEMO_ARTISTS.length)];

// Detecta contactos LATAM / hispanohablantes por país o estado. Si no se detecta → inglés.
function isLatamContact(lead) {
  const c = `${lead.country || ''} ${lead.state || ''}`.trim().toLowerCase();
  if (!c) return false;
  return /(m[eé]xic|colomb|argentin|chile|per[uú]|venezuel|ecuad|guatemal|\bcuba\b|boliv|dominic|hondur|paragu|el salvador|nicaragu|costa rica|panam|urugu|puerto ric|espa[nñ]|\bspain\b|\bmx\b|\bco\b|\bar\b|\bcl\b|\bpe\b|\bve\b|\bec\b|\bgt\b|\bcu\b|\bbo\b|\bdo\b|\bhn\b|\bpy\b|\bsv\b|\bni\b|\bcr\b|\bpa\b|\buy\b|\bpr\b|\bes\b)/.test(c);
}

// 🎲 SUBJECT TEMPLATES — directos, de negocio / alianza (CEO a la industria)
const subjectTemplates = [
  (lead) => `${lead.first_name}, a partnership idea for ${lead.company_name || 'your roster'}`,
  (lead) => `${lead.first_name} — we bring the platform, you bring the artists`,
  (lead) => `${lead.first_name}, CEO to ${lead.job_title ? lead.job_title.split(' ')[0] : 'CEO'} — worth 15 min?`,
  (lead) => `Boostify × ${lead.company_name || 'you'}, ${lead.first_name}?`,
  (lead) => `${lead.first_name}, see it from an artist's side (2-min demo)`,
  (lead) => `${lead.first_name} — an alliance that actually makes sense`,
  (lead) => `let's put your artists on this, ${lead.first_name}`,
  (lead) => `${lead.first_name}, a direct proposal from Boostify`,
  (lead) => `${lead.first_name} — building something ${lead.company_name || 'your artists'} will want`,
  (lead) => `quick one ${lead.first_name}: strategic partnership`,
  (lead) => `${lead.first_name}, the platform side of the deal`,
  (lead) => `${lead.first_name} — ready when you are to talk partnership`,
];

// Subjects en español para contactos LATAM
const subjectTemplatesES = [
  (lead) => `${lead.first_name}, una idea de alianza para ${lead.company_name || 'tu roster'}`,
  (lead) => `${lead.first_name} — nosotros ponemos la plataforma, tú los artistas`,
  (lead) => `${lead.first_name}, ¿15 minutos para hablar de una alianza?`,
  (lead) => `Boostify × ${lead.company_name || 'ustedes'}, ${lead.first_name}?`,
  (lead) => `${lead.first_name}, míralo desde un artista (demo de 2 min)`,
  (lead) => `${lead.first_name} — una alianza que sí tiene sentido`,
  (lead) => `pongamos a tus artistas en esto, ${lead.first_name}`,
  (lead) => `${lead.first_name}, una propuesta directa de Boostify`,
  (lead) => `${lead.first_name}, el lado de la plataforma del trato`,
  (lead) => `${lead.first_name} — listo cuando quieras para hablar de alianza`,
];

function pickSubject(lead) {
  const list = isLatamContact(lead) ? subjectTemplatesES : subjectTemplates;
  return list[Math.floor(Math.random() * list.length)](lead);
}

async function generateBody(lead, stage = 1) {
  const isIndustry = USE_BREVO;
  const spanish = isLatamContact(lead);
  const demo = pickDemo();
  console.log(`   🌎 Idioma: ${spanish ? 'ES (LATAM)' : 'EN'} | Demo: ${demo.name}`);

  const stageGuidance = {
    1: 'TOUCH 1 of 3 — break the ice and invite them to SEE the platform from an artist\'s perspective. Keep the ask tiny: just look at the demo.',
    2: 'TOUCH 2 of 3 — they have seen (or heard of) the demo. Now make the CONCRETE alliance proposal: exactly what each side puts in, and propose a short call.',
    3: 'TOUCH 3 of 3 — direct close. Assume mutual interest, remove friction, ask who handles partnerships on their side or propose a specific 15-min slot.',
  }[stage] || 'TOUCH 1 of 3 — break the ice and invite them to see the demo.';

  const audienceBlock = isIndustry
    ? `You are writing to a DECISION-MAKER in the music industry (label, manager, A&R, publisher, distributor, agency).
THE DEAL: Boostify provides the PLATFORM and technology (immersive artist profiles, AI tools, a 3D merch store, distribution and monetization). The partner brings ARTISTS, catalog and network. A clean win-win strategic alliance.`
    : `You are writing to an ARTIST or their team.
THE DEAL: Boostify provides the PLATFORM (a cinematic immersive profile, a 3D merch store, AI tools, distribution and monetization). They bring the music. Invite them to claim their space on the platform.`;

  const languageRule = spanish
    ? 'Write the ENTIRE email in NATURAL, PROFESSIONAL LATIN-AMERICAN SPANISH (tono cercano pero de negocio, tutea con "tú"). Do NOT translate literally — write like a native Spanish-speaking founder.'
    : 'Write the ENTIRE email in NATURAL, PROFESSIONAL ENGLISH.';

  const prompt = `
You are Neiver Alvarez, CEO and founder of Boostify Music (${PLATFORM_URL}).
You are writing a real, direct, peer-to-peer email. You are a confident negotiator,
not a fan. Be concrete and concise. No empty flattery, no buzzword salad.

${audienceBlock}

WHO YOU'RE WRITING TO:
- Name: ${lead.first_name} ${lead.last_name || ''}
- Role: ${lead.job_title || 'Music Professional'}
- Company: ${lead.company_name || 'their company'}
- Industry: ${lead.industry || 'Music'}
- Location: ${[lead.city, lead.state, lead.country].filter(Boolean).join(', ') || 'N/A'}

LANGUAGE: ${languageRule}

THIS EMAIL IS: ${stageGuidance}

HOW TO WRITE IT:
1. Open with ONE specific line about THEM or their company (not generic praise).
2. State the alliance in ONE concrete line: "we put the platform, you bring the artists" (adapt naturally).
3. ${stage === 1
      ? `Invite them to see a real artist on the platform — point to ${demo.name} (${demo.genre}): ${demo.url}`
      : `Only mention the demo if it flows naturally — ${demo.name}: ${demo.url}`}
4. Close with ONE direct, low-friction question (a 15-min call, or "who handles partnerships on your side?").

RULES:
- Plain text only. NO HTML.
- 60-90 words, short paragraphs.
- At most ONE url in the whole email (the demo link above).
- Sound like a real founder closing a deal — direct and human.
- Sign EXACTLY like this (two lines), in any language:
Neiver Alvarez
CEO, Boostify Music

Return ONLY the email body, no subject line.
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 340,
    temperature: 0.75
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS warmup_config (
        domain TEXT PRIMARY KEY,
        daily_limit INTEGER DEFAULT 20,
        warmup_day INTEGER DEFAULT 1,
        warmup_week INTEGER DEFAULT 1,
        sent_today INTEGER DEFAULT 0,
        last_reset DATE
      )
    `).catch(() => {});
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

    let remaining = warmupConfig.daily_limit - warmupConfig.sent_today;
    // Optional --max=N cap (testing / rate control)
    const maxArg = process.argv.find(a => a.startsWith('--max='));
    if (maxArg) {
      const capped = parseInt(maxArg.split('=')[1], 10);
      if (!Number.isNaN(capped) && capped >= 0) remaining = Math.min(remaining, capped);
    }
    console.log(`\n📊 LÍMITE DIARIO (${config.domain}):`);
    console.log(`   • Límite: ${warmupConfig.daily_limit}/día`);
    console.log(`   • Enviados hoy: ${warmupConfig.sent_today}`);
    console.log(`   • Disponibles: ${remaining}`);

    if (remaining <= 0) {
      console.log('\n⚠️  Límite diario alcanzado. Intenta mañana.');
      return;
    }

    // 2. Obtener leads pendientes (filtrar por source/campaign si es necesario)
    let leadsResult;
    try {
      leadsResult = await client.query(`
      SELECT l.*, ls.warmup_stage, ls.id as status_id
      FROM leads l
      JOIN lead_status ls ON l.id = ls.lead_id
      WHERE ls.status IN ('new', 'warming')
        AND ls.warmup_stage < 3
        AND (ls.next_email_at IS NULL OR ls.next_email_at <= NOW())
      ORDER BY ls.warmup_stage ASC, l.created_at ASC
      LIMIT $1
    `, [remaining]);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      console.log('ℹ️  leads table not found — using music_industry_contacts');
      const audience = config.id === 'INDUSTRY' ? 'industry' : 'artists';
      const rows = (await fetchContacts(pool, {
        audience,
        limit: remaining,
        cooldownDays: config.warmup.daysBetweenEmails || 2,
      })).map(r => ({ ...r, warmup_stage: 0 }));
      leadsResult = { rows };
    }

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

      // Generar subject aleatorio (ES para LATAM, EN si no se detecta)
      const subject = pickSubject(lead);
      console.log(`   Subject: ${subject}`);

      // Generar body con OpenAI
      const body = await generateBody(lead, nextStage);
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
        `, [lead.id, messageId, config.fromEmail, toEmail, subject, body, emailType]).catch(() => {});

        // Actualizar lead_status
        if (lead.status_id) {
          await client.query(`
            UPDATE lead_status
            SET status = 'warming',
                warmup_stage = $1,
                emails_sent = emails_sent + 1,
                last_email_at = NOW(),
                next_email_at = NOW() + INTERVAL '${config.warmup.daysBetweenEmails} days'
            WHERE id = $2
          `, [nextStage, lead.status_id]).catch(() => {});
        }

        // Marcar contacto (music_industry_contacts cooldown + counters)
        if (!PREVIEW_MODE) await markContacted(pool, lead.id);

        // Actualizar contador diario
        await client.query(`
          UPDATE warmup_config
          SET sent_today = sent_today + 1
          WHERE domain = $1
        `, [config.domain]).catch(() => {});

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
