/**
 * Email Bounce Webhook Handler
 * Procesa webhooks de bounces de Brevo/Resend para mantener la lista limpia
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { registerBounce } from '../services/email-verification-service.js';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface BrevoWebhookEvent {
  event: 'hard_bounce' | 'soft_bounce' | 'blocked' | 'spam' | 'unsubscribed' | 'delivered' | 'opened' | 'click';
  email: string;
  'message-id'?: string;
  date?: string;
  reason?: string;
  tag?: string;
}

interface ResendWebhookEvent {
  type: 'email.bounced' | 'email.complained' | 'email.delivered' | 'email.opened' | 'email.clicked';
  created_at: string;
  data: {
    email_id: string;
    to: string[];
    from: string;
    subject: string;
    bounce?: {
      type: 'hard' | 'soft';
      message: string;
    };
  };
}

/**
 * Webhook de Brevo (Sendinblue)
 * Configura en: https://app.brevo.com/settings/webhooks
 */
router.post('/brevo', async (req, res) => {
  try {
    const event: BrevoWebhookEvent = req.body;
    
    console.log(`📨 Brevo webhook: ${event.event} for ${event.email}`);
    
    // Procesar según tipo de evento
    switch (event.event) {
      case 'hard_bounce':
        await handleHardBounce(event.email, event.reason || 'Hard bounce');
        break;
        
      case 'soft_bounce':
        await handleSoftBounce(event.email, event.reason || 'Soft bounce');
        break;
        
      case 'blocked':
        await handleBlocked(event.email, event.reason || 'Blocked');
        break;
        
      case 'spam':
        await handleSpamComplaint(event.email);
        break;
        
      case 'unsubscribed':
        await handleUnsubscribe(event.email);
        break;
        
      default:
        // delivered, opened, click - solo log
        console.log(`   📊 Event logged: ${event.event}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Brevo webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Webhook de Resend
 * Configura en: https://resend.com/webhooks
 */
router.post('/resend', async (req, res) => {
  try {
    const event: ResendWebhookEvent = req.body;
    
    // Resend envía a múltiples destinatarios potencialmente
    const email = event.data.to[0];
    
    console.log(`📨 Resend webhook: ${event.type} for ${email}`);
    
    switch (event.type) {
      case 'email.bounced':
        if (event.data.bounce?.type === 'hard') {
          await handleHardBounce(email, event.data.bounce.message);
        } else {
          await handleSoftBounce(email, event.data.bounce?.message || 'Soft bounce');
        }
        break;
        
      case 'email.complained':
        await handleSpamComplaint(email);
        break;
        
      default:
        console.log(`   📊 Event logged: ${event.type}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Resend webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handler para hard bounces (email no existe)
 */
async function handleHardBounce(email: string, reason: string): Promise<void> {
  console.log(`📛 HARD BOUNCE: ${email}`);
  console.log(`   Reason: ${reason}`);
  
  // 1. Registrar en memoria para futuras verificaciones
  registerBounce(email);
  
  // 2. Actualizar en todas las tablas relevantes
  const client = await pool.connect();
  try {
    // artist_leads
    await client.query(`
      UPDATE artist_leads 
      SET lead_status = 'bounced',
          bounce_reason = $2,
          bounced_at = NOW(),
          email_verified = false
      WHERE LOWER(email) = LOWER($1)
    `, [email, reason]);
    
    // investor_leads
    await client.query(`
      UPDATE investor_leads 
      SET status = 'bounced',
          bounce_reason = $2,
          bounced_at = NOW(),
          email_verified = false
      WHERE LOWER(email) = LOWER($1)
    `, [email, reason]);
    
    // Log del bounce
    await client.query(`
      INSERT INTO email_bounces (email, bounce_type, reason, created_at)
      VALUES ($1, 'hard', $2, NOW())
      ON CONFLICT (email) DO UPDATE SET
        bounce_count = email_bounces.bounce_count + 1,
        last_bounce_at = NOW(),
        bounce_type = 'hard'
    `, [email, reason]);
    
    console.log(`   ✅ Database updated`);
  } catch (error) {
    console.log(`   ⚠️ Some tables may not exist, partial update`);
  } finally {
    client.release();
  }
}

/**
 * Handler para soft bounces (buzón lleno, servidor no disponible)
 */
async function handleSoftBounce(email: string, reason: string): Promise<void> {
  console.log(`⚠️ SOFT BOUNCE: ${email}`);
  console.log(`   Reason: ${reason}`);
  
  const client = await pool.connect();
  try {
    // Contar soft bounces previos
    const result = await client.query(`
      SELECT bounce_count FROM email_bounces WHERE email = $1
    `, [email]);
    
    const previousCount = result.rows[0]?.bounce_count || 0;
    
    // Si tiene 3+ soft bounces, tratar como hard bounce
    if (previousCount >= 2) {
      console.log(`   ⚠️ 3rd soft bounce, treating as hard bounce`);
      await handleHardBounce(email, '3 consecutive soft bounces');
      return;
    }
    
    // Registrar soft bounce
    await client.query(`
      INSERT INTO email_bounces (email, bounce_type, reason, created_at, bounce_count)
      VALUES ($1, 'soft', $2, NOW(), 1)
      ON CONFLICT (email) DO UPDATE SET
        bounce_count = email_bounces.bounce_count + 1,
        last_bounce_at = NOW()
    `, [email, reason]);
    
    console.log(`   📊 Soft bounce recorded (${previousCount + 1}/3)`);
  } catch (error) {
    console.log(`   ⚠️ Could not log soft bounce`);
  } finally {
    client.release();
  }
}

/**
 * Handler para emails bloqueados
 */
async function handleBlocked(email: string, reason: string): Promise<void> {
  console.log(`🚫 BLOCKED: ${email}`);
  console.log(`   Reason: ${reason}`);
  
  // Tratar como hard bounce
  await handleHardBounce(email, `Blocked: ${reason}`);
}

/**
 * Handler para spam complaints
 */
async function handleSpamComplaint(email: string): Promise<void> {
  console.log(`🔴 SPAM COMPLAINT: ${email}`);
  
  const client = await pool.connect();
  try {
    // Marcar como spam complaint (nunca más enviar)
    await client.query(`
      UPDATE artist_leads 
      SET lead_status = 'spam_complaint',
          do_not_email = true,
          spam_complaint_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]);
    
    await client.query(`
      UPDATE investor_leads 
      SET status = 'spam_complaint',
          do_not_email = true,
          spam_complaint_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]);
    
    // Agregar a lista negra
    await client.query(`
      INSERT INTO email_blacklist (email, reason, created_at)
      VALUES ($1, 'spam_complaint', NOW())
      ON CONFLICT (email) DO NOTHING
    `, [email]);
    
    console.log(`   ✅ Added to blacklist`);
  } catch (error) {
    console.log(`   ⚠️ Partial update`);
  } finally {
    client.release();
  }
  
  // También registrar como bounce para el servicio
  registerBounce(email);
}

/**
 * Handler para unsubscribes
 */
async function handleUnsubscribe(email: string): Promise<void> {
  console.log(`📭 UNSUBSCRIBE: ${email}`);
  
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE artist_leads 
      SET lead_status = 'unsubscribed',
          unsubscribed_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]);
    
    await client.query(`
      UPDATE investor_leads 
      SET status = 'unsubscribed',
          unsubscribed_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]);
    
    console.log(`   ✅ Marked as unsubscribed`);
  } catch (error) {
    console.log(`   ⚠️ Partial update`);
  } finally {
    client.release();
  }
}

/**
 * Endpoint para obtener estadísticas de bounces
 */
router.get('/stats', async (req, res) => {
  const client = await pool.connect();
  try {
    const [bounceStats, recentBounces] = await Promise.all([
      client.query(`
        SELECT 
          bounce_type,
          COUNT(*) as count
        FROM email_bounces
        GROUP BY bounce_type
      `),
      client.query(`
        SELECT email, bounce_type, reason, created_at
        FROM email_bounces
        ORDER BY created_at DESC
        LIMIT 20
      `)
    ]);
    
    // Calcular bounce rate de últimos 7 días
    const weekStats = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
        COUNT(*) as total
      FROM email_logs
      WHERE sent_at > NOW() - INTERVAL '7 days'
    `);
    
    const bounceRate = weekStats.rows[0].total > 0 
      ? ((weekStats.rows[0].bounced / weekStats.rows[0].total) * 100).toFixed(2)
      : '0';
    
    res.json({
      bounceRate: `${bounceRate}%`,
      totalsByType: bounceStats.rows,
      recentBounces: recentBounces.rows
    });
  } catch (error) {
    res.json({
      error: 'Could not fetch stats',
      message: 'Some tables may not exist'
    });
  } finally {
    client.release();
  }
});

/**
 * Endpoint para verificar si un email está en blacklist
 */
router.get('/check/:email', async (req, res) => {
  const { email } = req.params;
  const client = await pool.connect();
  
  try {
    const [bounceCheck, blacklistCheck] = await Promise.all([
      client.query(`
        SELECT bounce_type, bounce_count, last_bounce_at
        FROM email_bounces
        WHERE LOWER(email) = LOWER($1)
      `, [email]),
      client.query(`
        SELECT reason, created_at
        FROM email_blacklist
        WHERE LOWER(email) = LOWER($1)
      `, [email])
    ]);
    
    const isBounced = bounceCheck.rows.length > 0;
    const isBlacklisted = blacklistCheck.rows.length > 0;
    
    res.json({
      email,
      canSend: !isBounced && !isBlacklisted,
      bounceInfo: bounceCheck.rows[0] || null,
      blacklistInfo: blacklistCheck.rows[0] || null
    });
  } catch (error) {
    res.json({
      email,
      canSend: true, // Asumir que se puede si no hay data
      error: 'Could not check - tables may not exist'
    });
  } finally {
    client.release();
  }
});

export default router;
