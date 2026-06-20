import { Router, Request, Response } from "express";
import { db } from "../db";
import { musicIndustryContacts, users } from "../db/schema";
import { eq, ilike, desc, sql, or, and, inArray } from "drizzle-orm";
import { sendNotificationEmail } from "../services/brevo-email-service";

const router = Router();

// GET all artist leads with search, filtering, pagination
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, status, category, limit = "50", offset = "0" } = req.query;
    
    const conditions: any[] = [];
    
    if (search) {
      conditions.push(
        or(
          ilike(musicIndustryContacts.fullName, `%${search}%`),
          ilike(musicIndustryContacts.email, `%${search}%`),
          ilike(musicIndustryContacts.companyName, `%${search}%`),
          ilike(musicIndustryContacts.jobTitle, `%${search}%`)
        )
      );
    }
    
    if (status && status !== 'all') {
      conditions.push(sql`${musicIndustryContacts.status} = ${status as string}`);
    }
    
    if (category && category !== 'all') {
      conditions.push(sql`${musicIndustryContacts.category} = ${category as string}`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [leads, countResult] = await Promise.all([
      db.select()
        .from(musicIndustryContacts)
        .where(whereClause)
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string))
        .orderBy(desc(musicIndustryContacts.createdAt)),
      db.select({ count: sql<number>`count(*)` })
        .from(musicIndustryContacts)
        .where(whereClause)
    ]);
    
    const total = countResult[0]?.count || 0;
    
    res.json({ success: true, leads, total });
  } catch (error) {
    console.error("Error fetching artist leads:", error);
    res.status(500).json({ error: "Error fetching artist leads" });
  }
});

// GET stats summary
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const [total, byStatus, byCategory] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(musicIndustryContacts),
      db.select({
        status: musicIndustryContacts.status,
        count: sql<number>`count(*)`
      }).from(musicIndustryContacts).groupBy(musicIndustryContacts.status),
      db.select({
        category: musicIndustryContacts.category,
        count: sql<number>`count(*)`
      }).from(musicIndustryContacts).groupBy(musicIndustryContacts.category)
    ]);
    
    res.json({
      success: true,
      stats: {
        total: total[0]?.count || 0,
        byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status || 'unknown']: s.count }), {}),
        byCategory: byCategory.reduce((acc, c) => ({ ...acc, [c.category || 'unknown']: c.count }), {})
      }
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Error fetching stats" });
  }
});

// POST send invite email to a single artist lead
router.post("/:id/invite", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [lead] = await db.select()
      .from(musicIndustryContacts)
      .where(eq(musicIndustryContacts.id, parseInt(id)))
      .limit(1);
    
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    if (!lead.email) {
      return res.status(400).json({ error: "Lead has no email address" });
    }
    
    const firstName = lead.firstName || lead.fullName?.split(' ')[0] || 'Artist';
    
    const result = await sendNotificationEmail(
      lead.email,
      `🎵 ${firstName}, You're Invited to Join Boostify Music!`,
      `Welcome to the Future of Music, ${firstName}!`,
      `We've been following your work${lead.companyName ? ` at ${lead.companyName}` : ''} and we'd love to have you on Boostify Music — the AI-powered platform transforming how artists create, distribute, and monetize their music.<br><br>
      <strong>What you get:</strong><br>
      ✅ AI-powered music creation & distribution<br>
      ✅ Smart analytics & audience insights<br>
      ✅ Direct sync licensing opportunities<br>
      ✅ Tokenized royalties on blockchain<br>
      ✅ PR & marketing automation<br><br>
      Join thousands of artists already using Boostify Music to grow their careers.`,
      'Join Boostify Music Now →',
      'https://boostifymusic.com/auth'
    );
    
    if (result.success) {
      // Update the lead status and email tracking
      await db.update(musicIndustryContacts)
        .set({
          status: lead.status === 'new' ? 'contacted' : lead.status,
          emailsSent: (lead.emailsSent || 0) + 1,
          lastContactedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(musicIndustryContacts.id, parseInt(id)));
      
      res.json({ success: true, message: `Invite sent to ${lead.email}` });
    } else {
      res.status(500).json({ error: `Failed to send email: ${result.error}` });
    }
  } catch (error) {
    console.error("Error sending invite:", error);
    res.status(500).json({ error: "Error sending invite email" });
  }
});

// POST bulk invite - send to multiple leads
router.post("/bulk-invite", async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No lead IDs provided" });
    }
    
    if (ids.length > 50) {
      return res.status(400).json({ error: "Maximum 50 invites at once" });
    }
    
    const leads = await db.select()
      .from(musicIndustryContacts)
      .where(inArray(musicIndustryContacts.id, ids));
    
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    
    for (const lead of leads) {
      if (!lead.email) {
        failed++;
        errors.push(`${lead.fullName}: no email`);
        continue;
      }
      
      try {
        const firstName = lead.firstName || lead.fullName?.split(' ')[0] || 'Artist';
        
        const result = await sendNotificationEmail(
          lead.email,
          `🎵 ${firstName}, You're Invited to Join Boostify Music!`,
          `Welcome to the Future of Music, ${firstName}!`,
          `We've been following your work${lead.companyName ? ` at ${lead.companyName}` : ''} and we'd love to have you on Boostify Music — the AI-powered platform transforming how artists create, distribute, and monetize their music.<br><br>
          <strong>What you get:</strong><br>
          ✅ AI-powered music creation & distribution<br>
          ✅ Smart analytics & audience insights<br>
          ✅ Direct sync licensing opportunities<br>
          ✅ Tokenized royalties on blockchain<br>
          ✅ PR & marketing automation<br><br>
          Join thousands of artists already using Boostify Music to grow their careers.`,
          'Join Boostify Music Now →',
          'https://boostifymusic.com/auth'
        );
        
        if (result.success) {
          sent++;
          await db.update(musicIndustryContacts)
            .set({
              status: lead.status === 'new' ? 'contacted' : lead.status,
              emailsSent: (lead.emailsSent || 0) + 1,
              lastContactedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(musicIndustryContacts.id, lead.id));
        } else {
          failed++;
          errors.push(`${lead.fullName}: ${result.error}`);
        }
      } catch (e: any) {
        failed++;
        errors.push(`${lead.fullName}: ${e.message}`);
      }
      
      // Small delay between sends to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    res.json({ success: true, sent, failed, total: leads.length, errors });
  } catch (error) {
    console.error("Error bulk invite:", error);
    res.status(500).json({ error: "Error sending bulk invites" });
  }
});

// PATCH update lead status
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, category, fullName, email, jobTitle, companyName } = req.body;
    
    const updateData: any = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (category !== undefined) updateData.category = category;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
    if (companyName !== undefined) updateData.companyName = companyName;
    
    const result = await db.update(musicIndustryContacts)
      .set(updateData)
      .where(eq(musicIndustryContacts.id, parseInt(id)))
      .returning();
    
    if (!result.length) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    res.json({ success: true, lead: result[0] });
  } catch (error) {
    console.error("Error updating lead:", error);
    res.status(500).json({ error: "Error updating lead" });
  }
});

// DELETE lead
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await db.delete(musicIndustryContacts)
      .where(eq(musicIndustryContacts.id, parseInt(id)))
      .returning();
    
    if (!result.length) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    res.json({ success: true, message: "Lead deleted" });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({ error: "Error deleting lead" });
  }
});

// POST convert lead to user
router.post("/:id/convert", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [lead] = await db.select()
      .from(musicIndustryContacts)
      .where(eq(musicIndustryContacts.id, parseInt(id)))
      .limit(1);
    
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    if (!lead.email) {
      return res.status(400).json({ error: "Lead has no email address — cannot create user" });
    }
    
    // Check if user with this email already exists
    const [existingUser] = await db.select()
      .from(users)
      .where(eq(users.email, lead.email))
      .limit(1);
    
    if (existingUser) {
      return res.status(409).json({ 
        error: `User with email ${lead.email} already exists (ID: ${existingUser.id})` 
      });
    }
    
    const nameParts = (lead.fullName || '').split(' ');
    const firstName = lead.firstName || nameParts[0] || '';
    const lastName = lead.lastName || nameParts.slice(1).join(' ') || '';
    
    // Create user from lead data
    const insertResult = await (db.insert(users).values({
      firstName,
      lastName,
      email: lead.email,
      phone: lead.phone || lead.mobileNumber || null,
      artistName: lead.fullName,
      role: 'artist' as const,
      location: [lead.city, lead.state, lead.country].filter(Boolean).join(', ') || null,
      website: lead.companyWebsite || null,
    }).returning({ id: users.id }) as any);
    const newUser = insertResult[0];
    
    // Update lead status to deal_in_progress
    await db.update(musicIndustryContacts)
      .set({
        status: 'deal_in_progress',
        keywords: `converted_user_${newUser.id}`,
        updatedAt: new Date()
      })
      .where(eq(musicIndustryContacts.id, parseInt(id)));
    
    // Send welcome email
    await sendNotificationEmail(
      lead.email,
      `🎵 Welcome to Boostify Music, ${firstName}!`,
      `Your Account is Ready, ${firstName}!`,
      `Great news! Your Boostify Music account has been created. You can now log in and start exploring all our features:<br><br>
      ✅ AI-powered music creation & distribution<br>
      ✅ Smart analytics & audience insights<br>
      ✅ Direct sync licensing opportunities<br>
      ✅ Tokenized royalties on blockchain<br>
      ✅ PR & marketing automation<br><br>
      Log in now to get started!`,
      'Log In to Boostify Music →',
      'https://boostifymusic.com/auth'
    );
    
    res.json({ 
      success: true, 
      message: `User created for ${lead.fullName} (${lead.email})`,
      userId: newUser.id 
    });
  } catch (error) {
    console.error("Error converting lead to user:", error);
    res.status(500).json({ error: "Error converting lead to user" });
  }
});

// GET export all leads as JSON (frontend converts to CSV)
router.get("/export", async (req: Request, res: Response) => {
  try {
    const leads = await db.select({
      id: musicIndustryContacts.id,
      fullName: musicIndustryContacts.fullName,
      email: musicIndustryContacts.email,
      personalEmail: musicIndustryContacts.personalEmail,
      jobTitle: musicIndustryContacts.jobTitle,
      companyName: musicIndustryContacts.companyName,
      industry: musicIndustryContacts.industry,
      category: musicIndustryContacts.category,
      city: musicIndustryContacts.city,
      country: musicIndustryContacts.country,
      status: musicIndustryContacts.status,
      emailsSent: musicIndustryContacts.emailsSent,
      linkedin: musicIndustryContacts.linkedin,
    }).from(musicIndustryContacts)
      .orderBy(desc(musicIndustryContacts.createdAt));
    
    res.json({ success: true, leads });
  } catch (error) {
    console.error("Error exporting leads:", error);
    res.status(500).json({ error: "Error exporting leads" });
  }
});

export default router;
