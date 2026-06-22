/**
 * HoloSuit Investor Outreach Engine
 * - Daily cron: send up to 20 emails per day
 * - Add contacts manually or via CSV/Apify
 * - Track sequence steps 1-5
 * - Admin endpoints for management
 */

import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { shouldRunSchedulers } from "../bootstrap/role";
import {
  sendOutreachEmail,
  notifyOwnerOfLead,
  sendLeadConfirmationEmail,
  sendSequencePreview,
} from "../services/holosuit-investor-email";

const router = Router();
const sql = neon(process.env.DATABASE_URL!);

// Step delays in days
const STEP_DELAYS = [0, 3, 7, 14, 21]; // step 1 = day 0, step 2 = day 3, etc.

// ─── GET /api/holosuit-outreach/stats ────────────────────────────────────────
router.get("/stats", async (_req, res) => {
  try {
    const rows = await sql`
      SELECT status, COUNT(*) as count
      FROM holosuit_investor_contacts
      GROUP BY status
    `;
    const total = await sql`SELECT COUNT(*) as count FROM holosuit_investor_contacts`;
    const sent_today = await sql`
      SELECT COUNT(*) as count FROM holosuit_email_log
      WHERE sent_at >= NOW() - INTERVAL '24 hours'
    `;
    const leads = await sql`SELECT COUNT(*) as count FROM holosuit_leads`;
    res.json({
      contacts: rows,
      total: Number(total[0]?.count ?? 0),
      sent_today: Number(sent_today[0]?.count ?? 0),
      leads: Number(leads[0]?.count ?? 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/holosuit-outreach/contacts ─────────────────────────────────────
router.get("/contacts", async (req, res) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query as any;
    const contacts = status
      ? await sql`SELECT * FROM holosuit_investor_contacts WHERE status=${status} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
      : await sql`SELECT * FROM holosuit_investor_contacts ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    res.json({ contacts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/holosuit-outreach/contacts ────────────────────────────────────
// Add a contact (single or batch)
router.post("/contacts", async (req, res) => {
  try {
    const contacts: Array<{
      name: string; email: string; company?: string; title?: string;
      source?: string; tierInterest?: string; notes?: string;
    }> = Array.isArray(req.body) ? req.body : [req.body];

    const inserted: any[] = [];
    const skipped: string[] = [];

    for (const c of contacts) {
      if (!c.name || !c.email) { skipped.push(c.email || "unknown"); continue; }
      try {
        const row = await sql`
          INSERT INTO holosuit_investor_contacts
            (name, email, company, title, source, tier_interest, notes, next_send_at)
          VALUES
            (${c.name}, ${c.email}, ${c.company || null}, ${c.title || null},
             ${c.source || "manual"}, ${c.tierInterest || "seed"},
             ${c.notes || null}, NOW())
          ON CONFLICT (email) DO NOTHING
          RETURNING *
        `;
        if (row[0]) inserted.push(row[0]);
        else skipped.push(c.email);
      } catch { skipped.push(c.email); }
    }

    res.json({ inserted: inserted.length, skipped, contacts: inserted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/holosuit-outreach/contacts/:id ───────────────────────────────
router.delete("/contacts/:id", async (req, res) => {
  try {
    await sql`DELETE FROM holosuit_investor_contacts WHERE id=${parseInt(req.params.id)}`;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/holosuit-outreach/contacts/:id ───────────────────────────────
router.patch("/contacts/:id", async (req, res) => {
  try {
    const { status, notes, tierInterest } = req.body;
    await sql`
      UPDATE holosuit_investor_contacts
      SET status=${status || null}, notes=${notes || null},
          tier_interest=${tierInterest || null}, updated_at=NOW()
      WHERE id=${parseInt(req.params.id)}
    `;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/holosuit-outreach/run ─────────────────────────────────────────
// Main engine: send up to 20 emails for today's batch
router.post("/run", async (req, res) => {
  const dryRun = req.body?.dryRun === true;
  const dailyLimit = req.body?.limit ?? 20;

  try {
    // Find contacts due for email (pending/queued) OR due for next sequence step
    const due = await sql`
      SELECT * FROM holosuit_investor_contacts
      WHERE status NOT IN ('replied','invested','opted_out','bounced','sent_5')
        AND (next_send_at IS NULL OR next_send_at <= NOW())
        AND sequence_step < 5
      ORDER BY next_send_at ASC NULLS FIRST
      LIMIT ${dailyLimit}
    `;

    const results: any[] = [];

    for (const contact of due) {
      const nextStep = (contact.sequence_step || 0) + 1;
      if (dryRun) {
        results.push({ contact: contact.email, step: nextStep, dryRun: true });
        continue;
      }

      const result = await sendOutreachEmail(
        { id: contact.id, name: contact.name, email: contact.email },
        nextStep
      );

      if (result.success) {
        const nextDelay = STEP_DELAYS[nextStep] ?? 21; // days until next step
        const newStatus = nextStep >= 5 ? "sent_5" : `sent_${nextStep}`;
        await sql`
          UPDATE holosuit_investor_contacts
          SET sequence_step=${nextStep},
              status=${newStatus},
              last_sent_at=NOW(),
              next_send_at=NOW() + INTERVAL '${sql.unsafe(String(nextDelay))} days',
              updated_at=NOW()
          WHERE id=${contact.id}
        `;
        await sql`
          INSERT INTO holosuit_email_log
            (contact_id, step, email_type, resend_id, subject, sent_at)
          VALUES
            (${contact.id}, ${nextStep}, 'outreach', ${result.id || null},
             ${'Email step ' + nextStep}, NOW())
        `;
        results.push({ contact: contact.email, step: nextStep, id: result.id, success: true });
      } else {
        results.push({ contact: contact.email, step: nextStep, success: false, error: result.error });
      }

      await new Promise(r => setTimeout(r, 300)); // rate limit guard
    }

    res.json({ processed: results.length, dryRun, results });
  } catch (err: any) {
    console.error("Outreach engine error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/holosuit-outreach/preview ─────────────────────────────────────
// Send all 5 email previews to owner for approval
router.post("/preview", async (req, res) => {
  try {
    const email = req.body?.email || "convoycubano@gmail.com";
    await sendSequencePreview(email);
    res.json({ success: true, message: `5-email preview sequence sent to ${email}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/holosuit-outreach/lead ─────────────────────────────────────────
// Called when a form is submitted or Stripe checkout completed
router.post("/lead", async (req, res) => {
  try {
    const { name, email, company, tier, message, phone, source, stripeSessionId, amountCents } = req.body;
    if (!name || !email || !tier) return res.status(400).json({ error: "name, email, tier required" });

    // Save lead
    await sql`
      INSERT INTO holosuit_leads
        (name, email, company, tier, message, phone, source, stripe_session_id, amount_cents)
      VALUES
        (${name}, ${email}, ${company || null}, ${tier}, ${message || null},
         ${phone || null}, ${source || "form"}, ${stripeSessionId || null}, ${amountCents || null})
    `;

    // Notify owner
    await notifyOwnerOfLead({ name, email, company, tier, message, source: source || "form" });

    // Send confirmation to investor
    await sendLeadConfirmationEmail({ name, email, tier });

    // Mark existing outreach contact as invested/filled if exists
    await sql`
      UPDATE holosuit_investor_contacts
      SET status='invested', form_filled_at=NOW(), invested_at=${source === "stripe" ? "NOW()" : null}, updated_at=NOW()
      WHERE email=${email}
    `;

    res.json({ success: true });
  } catch (err: any) {
    console.error("Lead save error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/holosuit-outreach/log ──────────────────────────────────────────
router.get("/log", async (_req, res) => {
  try {
    const log = await sql`
      SELECT l.*, c.name, c.email, c.company
      FROM holosuit_email_log l
      LEFT JOIN holosuit_investor_contacts c ON c.id = l.contact_id
      ORDER BY l.sent_at DESC
      LIMIT 100
    `;
    res.json({ log });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

// ─── Daily Outreach Scheduler ─────────────────────────────────────────────────
// Fires once per day at 09:00 AM server time, sends up to 20 emails
const DAILY_SEND_HOUR = 9; // 9:00 AM
const DAILY_LIMIT = 20;
let lastOutreachDate = ""; // tracks last calendar day we ran

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(DAILY_SEND_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1); // already past today's window
  return next.getTime() - now.getTime();
}

async function runDailyOutreach() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastOutreachDate === today) return; // already ran today
  lastOutreachDate = today;

  console.log(`[HoloSuit Outreach] ⏰ Daily campaign starting — ${today} (limit: ${DAILY_LIMIT})`);

  try {
    const sqlLocal = neon(process.env.DATABASE_URL!);
    const due = await sqlLocal`
      SELECT * FROM holosuit_investor_contacts
      WHERE status NOT IN ('replied','invested','opted_out','bounced','sent_5')
        AND (next_send_at IS NULL OR next_send_at <= NOW())
        AND sequence_step < 5
      ORDER BY next_send_at ASC NULLS FIRST
      LIMIT ${DAILY_LIMIT}
    `;

    if (due.length === 0) {
      console.log("[HoloSuit Outreach] ✅ No contacts due today — all caught up.");
      return;
    }

    let sent = 0, failed = 0;
    const STEP_DELAYS_LOCAL = [0, 3, 7, 14, 21];

    for (const contact of due) {
      const nextStep = (contact.sequence_step || 0) + 1;
      const result = await sendOutreachEmail(
        { id: contact.id, name: contact.name, email: contact.email },
        nextStep
      );
      if (result.success) {
        const nextDelay = STEP_DELAYS_LOCAL[nextStep] ?? 21;
        const newStatus = nextStep >= 5 ? "sent_5" : `sent_${nextStep}`;
        await sqlLocal`
          UPDATE holosuit_investor_contacts
          SET sequence_step=${nextStep}, status=${newStatus},
              last_sent_at=NOW(),
              next_send_at=NOW() + INTERVAL '${sqlLocal.unsafe(String(nextDelay))} days',
              updated_at=NOW()
          WHERE id=${contact.id}
        `;
        await sqlLocal`
          INSERT INTO holosuit_email_log
            (contact_id, step, email_type, resend_id, subject, sent_at)
          VALUES (${contact.id}, ${nextStep}, 'outreach', ${result.id || null},
                  ${'Email step ' + nextStep}, NOW())
        `;
        sent++;
      } else {
        failed++;
      }
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[HoloSuit Outreach] ✅ Campaign done — ${sent} sent, ${failed} failed`);
  } catch (err: any) {
    console.error("[HoloSuit Outreach] ❌ Scheduler error:", err.message);
  }

  // Schedule next day's run
  setTimeout(runDailyOutreach, msUntilNextRun());
}

// Kick off — wait until 9 AM today (or tomorrow if already past)
if (shouldRunSchedulers()) {
  setTimeout(runDailyOutreach, msUntilNextRun());
  console.log(`[HoloSuit Outreach] 📅 Daily campaign scheduler active — next run at 09:00 AM (in ${Math.round(msUntilNextRun() / 60000)} min)`);
}
