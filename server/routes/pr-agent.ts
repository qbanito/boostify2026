import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { prCampaigns, prMediaDatabase, prWebhookEvents, insertPRCampaignSchema, users } from '../../db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

const router = express.Router();

// Helper para obtener el PostgreSQL user ID desde Clerk ID
async function getPostgresUserId(clerkId: string): Promise<number | null> {
  const userRecord = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return userRecord.length > 0 ? userRecord[0].id : null;
}

const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/wwvf4anizf0gc9yr3wyoax6ip1n7rj7w';

/**
 * GET /api/pr/campaigns
 * Lista todas las campañas del usuario
 */
router.get('/campaigns', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const pgUserId = await getPostgresUserId(clerkUserId);
    if (!pgUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const campaigns = await db.select().from(prCampaigns)
      .where(eq(prCampaigns.userId, pgUserId))
      .orderBy(desc(prCampaigns.createdAt));

    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('[PR CAMPAIGNS LIST ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener campañas' });
  }
});

/**
 * GET /api/pr/campaigns/:id
 * Obtiene detalles de una campaña específica
 */
router.get('/campaigns/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const pgUserId = await getPostgresUserId(clerkUserId);
    if (!pgUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const campaignId = parseInt(req.params.id);
    
    const [campaign] = await db.select().from(prCampaigns)
      .where(and(
        eq(prCampaigns.id, campaignId),
        eq(prCampaigns.userId, pgUserId)
      ))
      .limit(1);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaña no encontrada' });
    }

    // Get recent events for this campaign
    const events = await db.select().from(prWebhookEvents)
      .where(eq(prWebhookEvents.campaignId, campaignId))
      .orderBy(desc(prWebhookEvents.createdAt))
      .limit(20);

    res.json({ 
      success: true, 
      campaign,
      events
    });
  } catch (error) {
    console.error('[PR CAMPAIGN DETAILS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener detalles de campaña' });
  }
});

/**
 * POST /api/pr/campaigns
 * Crea una nueva campaña PR
 */
router.post('/campaigns', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const pgUserId = await getPostgresUserId(clerkUserId);
    if (!pgUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const validatedData = insertPRCampaignSchema.parse({
      userId: pgUserId,
      title: req.body.title,
      artistName: req.body.artistName,
      artistProfileUrl: req.body.artistProfileUrl,
      contentType: req.body.contentType,
      contentTitle: req.body.contentTitle,
      contentUrl: req.body.contentUrl,
      targetMediaTypes: req.body.targetMediaTypes,
      targetCountries: req.body.targetCountries,
      targetGenres: req.body.targetGenres,
      pitchMessage: req.body.pitchMessage,
      contactEmail: req.body.contactEmail,
      contactPhone: req.body.contactPhone,
      status: 'draft'
    });

    const [newCampaign] = await db.insert(prCampaigns).values(validatedData).returning();

    res.json({
      success: true,
      message: 'Campaña creada exitosamente',
      campaign: newCampaign
    });
  } catch (error: any) {
    console.error('[PR CREATE CAMPAIGN ERROR]', error);
    res.status(400).json({ success: false, message: error.message || 'Error al crear campaña' });
  }
});

/**
 * PUT /api/pr/campaigns/:id
 * Actualiza una campaña (solo si status = draft)
 */
router.put('/campaigns/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const pgUserId = await getPostgresUserId(clerkUserId);
    if (!pgUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const campaignId = parseInt(req.params.id);
    
    const [campaign] = await db.select().from(prCampaigns)
      .where(and(
        eq(prCampaigns.id, campaignId),
        eq(prCampaigns.userId, pgUserId)
      ))
      .limit(1);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaña no encontrada' });
    }

    if (campaign.status !== 'draft') {
      return res.status(403).json({ success: false, message: 'Solo puedes editar campañas en borrador' });
    }

    const [updatedCampaign] = await db.update(prCampaigns)
      .set({
        ...req.body,
        updatedAt: new Date()
      })
      .where(eq(prCampaigns.id, campaignId))
      .returning();

    res.json({
      success: true,
      message: 'Campaña actualizada',
      campaign: updatedCampaign
    });
  } catch (error: any) {
    console.error('[PR UPDATE CAMPAIGN ERROR]', error);
    res.status(400).json({ success: false, message: error.message || 'Error al actualizar campaña' });
  }
});

/**
 * POST /api/pr/campaigns/:id/activate
 * Activa una campaña y envía webhook a Make.com
 */
router.post('/campaigns/:id/activate', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const pgUserId = await getPostgresUserId(clerkUserId);
    if (!pgUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const campaignId = parseInt(req.params.id);
    
    const [campaign] = await db.select().from(prCampaigns)
      .where(and(
        eq(prCampaigns.id, campaignId),
        eq(prCampaigns.userId, pgUserId)
      ))
      .limit(1);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaña no encontrada' });
    }

    // Filter media outlets based on campaign targets
    let mediaQuery = db.select().from(prMediaDatabase)
      .where(eq(prMediaDatabase.isActive, true));

    // Apply filters if specified
    const filters: any[] = [eq(prMediaDatabase.isActive, true)];
    
    if (campaign.targetMediaTypes && campaign.targetMediaTypes.length > 0) {
      const mediaList = await db.select().from(prMediaDatabase)
        .where(and(
          eq(prMediaDatabase.isActive, true),
          inArray(prMediaDatabase.type, campaign.targetMediaTypes as any[])
        ));
      
      const targetMedia = mediaList.map(media => ({
        id: media.id,
        name: media.name,
        type: media.type,
        email: media.email,
        country: media.country,
        city: media.city,
        genres: media.genres,
        language: media.language
      }));

      // Prepare payload for Make.com
      const makePayload = {
        campaignId: campaign.id,
        artistName: campaign.artistName,
        artistProfileUrl: campaign.artistProfileUrl || `https://boostify.app/artist/${campaign.artistName.toLowerCase().replace(/\s+/g, '-')}`,
        contentType: campaign.contentType,
        contentTitle: campaign.contentTitle,
        contentUrl: campaign.contentUrl,
        pitchMessage: campaign.pitchMessage,
        contactEmail: campaign.contactEmail,
        contactPhone: campaign.contactPhone,
        targetMedia: targetMedia,
        webhookUrl: `${process.env.REPLIT_DEV_DOMAIN || 'https://boostify.app'}/api/pr/webhooks/event`
      };

      // Send to Make.com
      const makeResponse = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(makePayload)
      });

      if (!makeResponse.ok) {
        throw new Error(`Make.com webhook failed: ${makeResponse.statusText}`);
      }

      // Update campaign status
      const [updatedCampaign] = await db.update(prCampaigns)
        .set({
          status: 'active',
          mediaContacted: targetMedia.length,
          lastSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(prCampaigns.id, campaignId))
        .returning();

      res.json({
        success: true,
        message: `Campaña activada! Se contactarán ${targetMedia.length} medios.`,
        campaign: updatedCampaign,
        mediaCount: targetMedia.length
      });
    } else {
      return res.status(400).json({ success: false, message: 'No hay tipos de medios seleccionados' });
    }
  } catch (error: any) {
    console.error('[PR ACTIVATE CAMPAIGN ERROR]', error);
    res.status(500).json({ success: false, message: error.message || 'Error al activar campaña' });
  }
});

/**
 * POST /api/pr/campaigns/:id/pause
 * Pausa una campaña activa
 */
router.post('/campaigns/:id/pause', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const pgUserId = await getPostgresUserId(clerkUserId);
    if (!pgUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const campaignId = parseInt(req.params.id);
    
    const [campaign] = await db.select().from(prCampaigns)
      .where(and(
        eq(prCampaigns.id, campaignId),
        eq(prCampaigns.userId, pgUserId)
      ))
      .limit(1);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaña no encontrada' });
    }

    const [updatedCampaign] = await db.update(prCampaigns)
      .set({
        status: 'paused',
        updatedAt: new Date()
      })
      .where(eq(prCampaigns.id, campaignId))
      .returning();

    res.json({
      success: true,
      message: 'Campaña pausada',
      campaign: updatedCampaign
    });
  } catch (error) {
    console.error('[PR PAUSE CAMPAIGN ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al pausar campaña' });
  }
});

/**
 * POST /api/pr/webhooks/event
 * Webhook receptor para eventos de Make.com
 */
router.post('/webhooks/event', async (req: Request, res: Response) => {
  try {
    const { campaignId, eventType, mediaName, mediaEmail, notes, ...payload } = req.body;

    if (!campaignId || !eventType) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Save webhook event
    const [event] = await db.insert(prWebhookEvents).values({
      campaignId,
      eventType,
      payload: payload,
      mediaName,
      mediaEmail,
      notes
    }).returning();

    // Update campaign stats based on event type
    const updateData: any = { lastSyncAt: new Date() };
    
    switch (eventType) {
      case 'email_opened':
        updateData.emailsOpened = db.$count(prWebhookEvents, eq(prWebhookEvents.eventType, 'email_opened'));
        break;
      case 'media_replied':
        updateData.mediaReplied = db.$count(prWebhookEvents, eq(prWebhookEvents.eventType, 'media_replied'));
        break;
      case 'interview_booked':
        updateData.interviewsBooked = db.$count(prWebhookEvents, eq(prWebhookEvents.eventType, 'interview_booked'));
        break;
    }

    // Get current campaign stats
    const [campaign] = await db.select().from(prCampaigns)
      .where(eq(prCampaigns.id, campaignId))
      .limit(1);

    if (campaign) {
      const updates: any = { lastSyncAt: new Date() };
      
      if (eventType === 'email_opened') updates.emailsOpened = campaign.emailsOpened + 1;
      if (eventType === 'media_replied') updates.mediaReplied = campaign.mediaReplied + 1;
      if (eventType === 'interview_booked') updates.interviewsBooked = campaign.interviewsBooked + 1;

      await db.update(prCampaigns)
        .set(updates)
        .where(eq(prCampaigns.id, campaignId));
    }

    res.json({ success: true, event });
  } catch (error) {
    console.error('[PR WEBHOOK ERROR]', error);
    res.status(500).json({ success: false, message: 'Error processing webhook' });
  }
});

/**
 * GET /api/pr/media
 * Lista medios disponibles (con filtros opcionales)
 */
router.get('/media', authenticate, async (req: Request, res: Response) => {
  try {
    const { type, country, genre } = req.query;

    let query = db.select().from(prMediaDatabase)
      .where(eq(prMediaDatabase.isActive, true));

    const media = await query;

    res.json({ success: true, media, total: media.length });
  } catch (error) {
    console.error('[PR MEDIA LIST ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener medios' });
  }
});

export default router;
