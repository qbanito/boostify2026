import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { 
  affiliates, 
  affiliateLinks, 
  affiliateClicks, 
  affiliateConversions,
  affiliateEarnings,
  affiliateCoupons,
  affiliatePromotions,
  affiliateBadges,
  affiliateReferrals,
  affiliateMarketingMaterials,
  insertAffiliateSchema,
  insertAffiliateLinkSchema,
  insertAffiliateCouponSchema,
  insertAffiliatePromotionSchema,
  insertAffiliateReferralSchema,
  users
} from '../../db/schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';

const router = express.Router();

// Helper function to generate unique code
function generateUniqueCode(length: number = 8): string {
  return crypto.randomBytes(length).toString('hex').substring(0, length).toUpperCase();
}

/**
 * Resolves a raw auth user ID (Clerk string like 'user_XXX', Firebase UID, or numeric)
 * to the integer primary key in the `users` table.
 * Returns null if no matching user is found.
 */
async function resolveDbUserId(rawId: string | number | undefined): Promise<number | null> {
  if (!rawId) return null;
  if (typeof rawId === 'number') return rawId;
  const raw = String(rawId);
  // Plain integer string (legacy numeric ID)
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  // Clerk ID (user_XXX), Firebase UID, or username — look up in users table
  const [row] = await db.select({ id: users.id }).from(users)
    .where(or(
      eq(users.clerkId, raw),
      eq(users.firestoreId, raw),
      eq(users.username, raw)
    ))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Gets or creates a DB user for the given auth ID (Clerk, Firebase, etc.).
 * Used during affiliate registration to ensure a users table row exists.
 * Returns the integer user ID.
 */
async function getOrCreateDbUser(
  rawId: string,
  email: string | null,
  fullName?: string
): Promise<number> {
  const existing = await resolveDbUserId(rawId);
  if (existing) return existing;
  const artistName = fullName || email?.split('@')[0] || 'Artist';
  const [newUser] = await db.insert(users).values({
    clerkId: rawId.startsWith('user_') ? rawId : undefined,
    firestoreId: !rawId.startsWith('user_') ? rawId : undefined,
    username: rawId,
    email,
    artistName,
    role: 'artist'
  }).returning({ id: users.id });
  return newUser.id;
}

/**
 * GET /api/affiliate/me
 * Obtiene la información del afiliado actual
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'No estás registrado como afiliado. Por favor registrate primero.' });
    }

    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    
    if (!affiliate) {
      return res.status(404).json({ 
        success: false, 
        message: 'No estás registrado como afiliado. Por favor registrate primero.' 
      });
    }

    // Get links
    const links = await db.select().from(affiliateLinks)
      .where(eq(affiliateLinks.affiliateId, affiliate.id));

    // Get recent conversions
    const conversions = await db.select().from(affiliateConversions)
      .where(eq(affiliateConversions.affiliateId, affiliate.id))
      .orderBy(desc(affiliateConversions.convertedAt))
      .limit(10);

    // Get badges
    const badges = await db.select().from(affiliateBadges)
      .where(eq(affiliateBadges.affiliateId, affiliate.id));

    res.json({
      success: true,
      affiliate: {
        ...affiliate,
        stats: {
          totalClicks: affiliate.totalClicks,
          conversions: affiliate.totalConversions,
          earnings: Number(affiliate.totalEarnings),
          pendingPayment: Number(affiliate.pendingPayment),
        },
        links,
        conversions,
        badges
      }
    });
  } catch (error) {
    console.error('[AFFILIATE ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener información del afiliado' });
  }
});

/**
 * POST /api/affiliate/register
 * Registra un nuevo afiliado con código de referido opcional
 */
router.post('/register', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    // Resolve Clerk/Firebase UID to integer users.id (creates user record if needed)
    const dbUserId = await getOrCreateDbUser(
      req.user.id,
      req.user.email || req.body.email || null,
      req.body.fullName
    );

    // Check if already registered
    const [existing] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ya estás registrado como afiliado' });
    }

    // Check for referral code
    let referrerId: number | null = null;
    if (req.body.referralCode) {
      const referralCode = req.body.referralCode.toUpperCase();
      
      // Find affiliate by referral code (using their first link as referral code)
      const referrerAffiliate = await db.query.affiliates.findFirst({
        where: (affiliates, { eq }) => eq(affiliates.referralCode, referralCode)
      });

      if (referrerAffiliate) {
        referrerId = referrerAffiliate.id;
      }
    }

    // Generate unique referral code for new affiliate
    let referralCode = generateUniqueCode(8);
    let codeExists = true;
    
    while (codeExists) {
      const existing = await db.query.affiliates.findFirst({
        where: (affiliates, { eq }) => eq(affiliates.referralCode, referralCode)
      });
      if (!existing) {
        codeExists = false;
      } else {
        referralCode = generateUniqueCode(8);
      }
    }

    // Validate input
    const validatedData = insertAffiliateSchema.parse({
      userId: dbUserId,
      fullName: req.body.fullName,
      email: req.body.email,
      website: req.body.website || null,
      socialMedia: req.body.socialMedia || null,
      audienceSize: req.body.audienceSize,
      marketingExperience: req.body.marketingExperience,
      promotionStrategy: req.body.promotionStrategy,
      level: 'Básico',
      status: 'pending',
      referralCode
    });

    const [newAffiliate] = await db.insert(affiliates).values(validatedData).returning();

    // Create referral relationship if referrer exists
    if (referrerId) {
      await db.insert(affiliateReferrals).values({
        referrerId,
        referredId: newAffiliate.id,
        status: 'active'
      });
    }

    res.json({
      success: true,
      message: 'Registro exitoso! Tu solicitud está siendo revisada.',
      affiliate: {
        ...newAffiliate,
        wasReferred: !!referrerId
      }
    });
  } catch (error: any) {
    console.error('[AFFILIATE REGISTER ERROR]', error);
    res.status(400).json({ success: false, message: error.message || 'Error al registrar afiliado' });
  }
});

/**
 * GET /api/affiliate/links
 * Obtiene todos los enlaces del afiliado
 */
router.get('/links', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const links = await db.select().from(affiliateLinks)
      .where(eq(affiliateLinks.affiliateId, affiliate.id))
      .orderBy(desc(affiliateLinks.createdAt));

    res.json({ success: true, links });
  } catch (error) {
    console.error('[AFFILIATE LINKS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener enlaces' });
  }
});

/**
 * POST /api/affiliate/links
 * Crea un nuevo enlace de afiliado
 */
router.post('/links', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    if (affiliate.status !== 'approved') {
      return res.status(403).json({ success: false, message: 'Tu cuenta de afiliado debe estar aprobada para crear enlaces' });
    }

    const uniqueCode = generateUniqueCode();
    const validatedData = insertAffiliateLinkSchema.parse({
      affiliateId: affiliate.id,
      uniqueCode,
      title: req.body.title,
      description: req.body.description || null,
      productType: req.body.productType || 'general',
      productId: req.body.productId || null,
      customPath: req.body.customPath || null
    });

    const [newLink] = await db.insert(affiliateLinks).values(validatedData).returning();

    const trackingUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://yourdomain.com'}/ref/${uniqueCode}`;

    res.json({
      success: true,
      link: {
        ...newLink,
        fullUrl: trackingUrl
      }
    });
  } catch (error: any) {
    console.error('[AFFILIATE CREATE LINK ERROR]', error);
    res.status(400).json({ success: false, message: error.message || 'Error al crear enlace' });
  }
});

/**
 * GET /api/affiliate/coupons
 * Obtiene todos los cupones del afiliado
 */
router.get('/coupons', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const coupons = await db.select().from(affiliateCoupons)
      .where(eq(affiliateCoupons.affiliateId, affiliate.id))
      .orderBy(desc(affiliateCoupons.createdAt));

    res.json({ success: true, coupons });
  } catch (error) {
    console.error('[AFFILIATE COUPONS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener cupones' });
  }
});

/**
 * POST /api/affiliate/coupons
 * Crea un nuevo cupón
 */
router.post('/coupons', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const code = req.body.code || `${affiliate.fullName.substring(0, 3).toUpperCase()}${generateUniqueCode(6)}`;
    
    const validatedData = insertAffiliateCouponSchema.parse({
      affiliateId: affiliate.id,
      code,
      description: req.body.description,
      discountType: req.body.discountType,
      discountValue: req.body.discountValue,
      minimumPurchase: req.body.minimumPurchase || null,
      maxUses: req.body.maxUses || null,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      applicableProducts: req.body.applicableProducts || null
    });

    const [newCoupon] = await db.insert(affiliateCoupons).values(validatedData).returning();

    res.json({ success: true, coupon: newCoupon });
  } catch (error: any) {
    console.error('[AFFILIATE CREATE COUPON ERROR]', error);
    res.status(400).json({ success: false, message: error.message || 'Error al crear cupón' });
  }
});

/**
 * GET /api/affiliate/promotions
 * Obtiene todas las promociones del afiliado
 */
router.get('/promotions', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const promotions = await db.select().from(affiliatePromotions)
      .where(eq(affiliatePromotions.affiliateId, affiliate.id))
      .orderBy(desc(affiliatePromotions.createdAt));

    res.json({ success: true, promotions });
  } catch (error) {
    console.error('[AFFILIATE PROMOTIONS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener promociones' });
  }
});

/**
 * POST /api/affiliate/promotions
 * Crea una nueva promoción
 */
router.post('/promotions', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const validatedData = insertAffiliatePromotionSchema.parse({
      affiliateId: affiliate.id,
      title: req.body.title,
      description: req.body.description,
      bannerUrl: req.body.bannerUrl || null,
      landingPageUrl: req.body.landingPageUrl,
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate)
    });

    const [newPromotion] = await db.insert(affiliatePromotions).values(validatedData).returning();

    res.json({ success: true, promotion: newPromotion });
  } catch (error: any) {
    console.error('[AFFILIATE CREATE PROMOTION ERROR]', error);
    res.status(400).json({ success: false, message: error.message || 'Error al crear promoción' });
  }
});

/**
 * GET /api/affiliate/badges
 * Obtiene todas las insignias del afiliado
 */
router.get('/badges', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const badges = await db.select().from(affiliateBadges)
      .where(eq(affiliateBadges.affiliateId, affiliate.id))
      .orderBy(desc(affiliateBadges.earnedAt));

    res.json({ success: true, badges });
  } catch (error) {
    console.error('[AFFILIATE BADGES ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener insignias' });
  }
});

/**
 * GET /api/affiliate/referrals
 * Obtiene todos los referidos del afiliado
 */
router.get('/referrals', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const referrals = await db.select().from(affiliateReferrals)
      .where(eq(affiliateReferrals.referrerId, affiliate.id))
      .orderBy(desc(affiliateReferrals.createdAt));

    res.json({ success: true, referrals });
  } catch (error) {
    console.error('[AFFILIATE REFERRALS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener referidos' });
  }
});

/**
 * POST /api/affiliate/referrals
 * Invita un nuevo referido
 */
router.post('/referrals', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const validatedData = insertAffiliateReferralSchema.parse({
      referrerId: affiliate.id,
      referredEmail: req.body.email,
      status: 'pending'
    });

    const [newReferral] = await db.insert(affiliateReferrals).values(validatedData).returning();

    // TODO: Send invitation email

    res.json({ 
      success: true, 
      referral: newReferral,
      message: 'Invitación enviada exitosamente'
    });
  } catch (error: any) {
    console.error('[AFFILIATE CREATE REFERRAL ERROR]', error);
    res.status(400).json({ success: false, message: error.message || 'Error al crear referido' });
  }
});

/**
 * GET /api/affiliate/materials
 * Obtiene todos los materiales de marketing
 */
router.get('/materials', authenticate, async (req: Request, res: Response) => {
  try {
    const materials = await db.select().from(affiliateMarketingMaterials)
      .where(eq(affiliateMarketingMaterials.isActive, true))
      .orderBy(desc(affiliateMarketingMaterials.createdAt));

    res.json({ success: true, materials });
  } catch (error) {
    console.error('[AFFILIATE MATERIALS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener materiales' });
  }
});

/**
 * POST /api/affiliate/materials/:id/download
 * Incrementa el contador de descargas de un material
 */
router.post('/materials/:id/download', authenticate, async (req: Request, res: Response) => {
  try {
    const materialId = parseInt(req.params.id);
    
    await db.update(affiliateMarketingMaterials)
      .set({ downloadCount: sql`${affiliateMarketingMaterials.downloadCount} + 1` })
      .where(eq(affiliateMarketingMaterials.id, materialId));

    res.json({ success: true, message: 'Descarga registrada' });
  } catch (error) {
    console.error('[AFFILIATE DOWNLOAD MATERIAL ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al registrar descarga' });
  }
});

/**
 * GET /api/affiliate/earnings
 * Obtiene el historial de ganancias
 */
router.get('/earnings', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const earnings = await db.select().from(affiliateEarnings)
      .where(eq(affiliateEarnings.affiliateId, affiliate.id))
      .orderBy(desc(affiliateEarnings.createdAt));

    res.json({ success: true, earnings });
  } catch (error) {
    console.error('[AFFILIATE EARNINGS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener ganancias' });
  }
});

/**
 * GET /api/affiliate/stats
 * Obtiene estadísticas detalladas del afiliado
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    // Get last 30 days clicks by day
    const last30DaysClicks = await db.execute(sql`
      SELECT 
        DATE(clicked_at) as date, 
        COUNT(*) as clicks
      FROM affiliate_clicks
      WHERE affiliate_id = ${affiliate.id}
        AND clicked_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(clicked_at)
      ORDER BY date ASC
    `);

    // Get conversion rate
    const conversionRate = affiliate.totalClicks > 0 
      ? (affiliate.totalConversions / affiliate.totalClicks * 100).toFixed(2)
      : '0.00';

    res.json({
      success: true,
      stats: {
        totalClicks: affiliate.totalClicks,
        totalConversions: affiliate.totalConversions,
        totalEarnings: Number(affiliate.totalEarnings),
        pendingPayment: Number(affiliate.pendingPayment),
        paidAmount: Number(affiliate.paidAmount),
        conversionRate: Number(conversionRate),
        clicksLast30Days: last30DaysClicks.rows
      }
    });
  } catch (error) {
    console.error('[AFFILIATE STATS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
});

/**
 * PUT /api/affiliate/settings
 * Actualiza la configuración del afiliado
 */
router.put('/settings', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const updates: any = {};
    if (req.body.paymentMethod) updates.paymentMethod = req.body.paymentMethod;
    if (req.body.paymentEmail) updates.paymentEmail = req.body.paymentEmail;
    if (req.body.bankDetails) updates.bankDetails = req.body.bankDetails;
    if (req.body.website) updates.website = req.body.website;
    if (req.body.socialMedia) updates.socialMedia = req.body.socialMedia;
    
    updates.updatedAt = new Date();

    const [updated] = await db.update(affiliates)
      .set(updates)
      .where(eq(affiliates.id, affiliate.id))
      .returning();

    res.json({ success: true, affiliate: updated });
  } catch (error: any) {
    console.error('[AFFILIATE UPDATE SETTINGS ERROR]', error);
    res.status(400).json({ success: false, message: error.message || 'Error al actualizar configuración' });
  }
});

/**
 * GET /api/affiliate/referrals
 * Obtiene todos los referidos del afiliado (sistema multinivel)
 */
router.get('/referrals', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    // Get direct referrals
    const directReferrals = await db
      .select({
        id: affiliateReferrals.id,
        referredId: affiliateReferrals.referredId,
        createdAt: affiliateReferrals.createdAt,
        status: affiliateReferrals.status,
        totalEarnings: affiliateReferrals.totalEarnings,
        affiliate: {
          id: affiliates.id,
          fullName: affiliates.fullName,
          email: affiliates.email,
          level: affiliates.level,
          totalClicks: affiliates.totalClicks,
          totalConversions: affiliates.totalConversions,
          totalEarnings: affiliates.totalEarnings
        }
      })
      .from(affiliateReferrals)
      .innerJoin(affiliates, eq(affiliates.id, affiliateReferrals.referredId))
      .where(eq(affiliateReferrals.referrerId, affiliate.id));

    // Calculate totals
    const totalReferrals = directReferrals.length;
    const totalReferralEarnings = directReferrals.reduce((sum, ref) => 
      sum + Number(ref.totalEarnings), 0
    );

    res.json({
      success: true,
      referrals: directReferrals,
      summary: {
        totalReferrals,
        totalReferralEarnings,
        activeReferrals: directReferrals.filter(r => r.status === 'active').length
      }
    });
  } catch (error) {
    console.error('[AFFILIATE REFERRALS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener referidos' });
  }
});

/**
 * POST /api/affiliate/referrals/:referredId/track-earning
 * Registra una ganancia de segundo nivel cuando un referido hace una venta
 * (Llamado automáticamente por el sistema de tracking)
 */
router.post('/referrals/:referredId/track-earning', async (req: Request, res: Response) => {
  try {
    const referredId = parseInt(req.params.referredId);
    const { conversionId, saleAmount } = req.body;

    // Find referral relationship
    const [referralRelation] = await db.select()
      .from(affiliateReferrals)
      .where(and(
        eq(affiliateReferrals.referredId, referredId),
        eq(affiliateReferrals.status, 'active')
      ))
      .limit(1);

    if (!referralRelation) {
      return res.json({ success: false, message: 'No referral relationship found' });
    }

    // Get referrer affiliate to check their second-level commission rate
    const [referrer] = await db.select().from(affiliates)
      .where(eq(affiliates.id, referralRelation.referrerId))
      .limit(1);

    if (!referrer) {
      return res.json({ success: false, message: 'Referrer not found' });
    }

    // Calculate second-level commission (typically 5% of the sale or 10% of the first-level commission)
    const secondLevelRate = 5; // 5% of sale amount
    const secondLevelCommission = (Number(saleAmount) * secondLevelRate) / 100;

    // Record the second-level earning
    await db.insert(affiliateEarnings).values({
      affiliateId: referrer.id,
      amount: secondLevelCommission.toString(),
      type: 'referral_commission',
      description: `Comisión de segundo nivel por venta de referido`,
      status: 'pending',
      conversionId,
      metadata: {
        referredAffiliateId: referredId,
        saleAmount,
        secondLevelRate,
        conversionId
      }
    });

    // Update referrer's earnings
    await db.update(affiliates)
      .set({
        totalEarnings: sql`${affiliates.totalEarnings} + ${secondLevelCommission}`,
        pendingPayment: sql`${affiliates.pendingPayment} + ${secondLevelCommission}`,
        updatedAt: new Date()
      })
      .where(eq(affiliates.id, referrer.id));

    // Update referral relationship earnings
    await db.update(affiliateReferrals)
      .set({
        totalEarnings: sql`${affiliateReferrals.totalEarnings} + ${secondLevelCommission}`
      })
      .where(eq(affiliateReferrals.id, referralRelation.id));

    res.json({ 
      success: true, 
      secondLevelCommission,
      message: 'Second-level commission recorded'
    });
  } catch (error) {
    console.error('[TRACK REFERRAL EARNING ERROR]', error);
    res.status(500).json({ success: false, message: 'Error tracking referral earning' });
  }
});

/**
 * POST /api/affiliate/request-payout
 * Solicita un pago de comisiones
 */
router.post('/request-payout', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const pendingAmount = Number(affiliate.pendingPayment);
    
    // Minimum payout threshold: $50
    if (pendingAmount < 50) {
      return res.status(400).json({ 
        success: false, 
        message: `El monto mínimo para solicitar un pago es $50. Tu saldo actual es $${pendingAmount.toFixed(2)}` 
      });
    }

    // Check payment method
    if (!affiliate.paymentMethod) {
      return res.status(400).json({ 
        success: false, 
        message: 'Por favor configura tu método de pago antes de solicitar un retiro' 
      });
    }

    // Create payout earning record
    const [payoutRequest] = await db.insert(affiliateEarnings).values({
      affiliateId: affiliate.id,
      amount: (-pendingAmount).toString(), // Negative to show withdrawal
      type: 'payout_request',
      description: `Solicitud de pago por $${pendingAmount.toFixed(2)}`,
      status: 'pending',
      metadata: {
        paymentMethod: affiliate.paymentMethod,
        paymentEmail: affiliate.paymentEmail,
        requestedAt: new Date().toISOString()
      }
    }).returning();

    res.json({ 
      success: true, 
      message: 'Solicitud de pago enviada. Procesaremos tu pago en 3-5 días hábiles.',
      payout: payoutRequest
    });
  } catch (error) {
    console.error('[PAYOUT REQUEST ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al solicitar pago' });
  }
});

/**
 * POST /api/affiliate/admin/approve-payout/:id
 * Aprueba y procesa un pago de afiliado (solo admin)
 */
router.post('/admin/approve-payout/:id', authenticate, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    const payoutId = parseInt(req.params.id);
    
    const [payout] = await db.select().from(affiliateEarnings)
      .where(and(
        eq(affiliateEarnings.id, payoutId),
        eq(affiliateEarnings.type, 'payout_request'),
        eq(affiliateEarnings.status, 'pending')
      ))
      .limit(1);

    if (!payout) {
      return res.status(404).json({ success: false, message: 'Solicitud de pago no encontrada' });
    }

    const payoutAmount = Math.abs(Number(payout.amount));

    // Update payout status to approved
    await db.update(affiliateEarnings)
      .set({ 
        status: 'approved',
        metadata: {
          ...payout.metadata,
          approvedAt: new Date().toISOString(),
          approvedBy: req.user.id
        }
      })
      .where(eq(affiliateEarnings.id, payoutId));

    // Update affiliate balances
    await db.update(affiliates)
      .set({
        pendingPayment: sql`${affiliates.pendingPayment} - ${payoutAmount}`,
        paidAmount: sql`${affiliates.paidAmount} + ${payoutAmount}`,
        updatedAt: new Date()
      })
      .where(eq(affiliates.id, payout.affiliateId));

    // Create approved payment record
    await db.insert(affiliateEarnings).values({
      affiliateId: payout.affiliateId,
      amount: payoutAmount.toString(),
      type: 'payout_completed',
      description: `Pago aprobado: $${payoutAmount.toFixed(2)}`,
      status: 'approved',
      metadata: {
        payoutRequestId: payoutId,
        approvedBy: req.user.id,
        approvedAt: new Date().toISOString()
      }
    });

    res.json({ 
      success: true, 
      message: 'Pago aprobado y procesado exitosamente'
    });
  } catch (error) {
    console.error('[APPROVE PAYOUT ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al aprobar pago' });
  }
});

/**
 * GET /api/affiliate/payment-history
 * Obtiene el historial de pagos del afiliado
 */
router.get('/payment-history', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }

    const dbUserId = await resolveDbUserId(req.user.id);
    if (!dbUserId) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en el sistema' });
    }
    const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, dbUserId)).limit(1);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const paymentHistory = await db.select().from(affiliateEarnings)
      .where(and(
        eq(affiliateEarnings.affiliateId, affiliate.id),
        sql`type IN ('payout_request', 'payout_completed')`
      ))
      .orderBy(desc(affiliateEarnings.createdAt));

    res.json({ success: true, payments: paymentHistory });
  } catch (error) {
    console.error('[PAYMENT HISTORY ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener historial de pagos' });
  }
});

/**
 * GET /api/affiliate/admin/all
 * Obtiene todos los afiliados (solo admin)
 */
router.get('/admin/all', authenticate, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    const status = req.query.status as string | undefined;
    
    let query = db.select().from(affiliates);
    
    if (status && ['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      query = query.where(eq(affiliates.status, status as any));
    }
    
    const allAffiliates = await query.orderBy(desc(affiliates.createdAt));

    res.json({ success: true, affiliates: allAffiliates });
  } catch (error) {
    console.error('[ADMIN GET ALL AFFILIATES ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener afiliados' });
  }
});

/**
 * POST /api/affiliate/admin/approve/:id
 * Aprueba un afiliado (solo admin)
 */
router.post('/admin/approve/:id', authenticate, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    const affiliateId = parseInt(req.params.id);

    const [affiliate] = await db.select().from(affiliates)
      .where(eq(affiliates.id, affiliateId))
      .limit(1);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    await db.update(affiliates)
      .set({ 
        status: 'approved',
        updatedAt: new Date()
      })
      .where(eq(affiliates.id, affiliateId));

    res.json({ 
      success: true, 
      message: `Afiliado ${affiliate.fullName} aprobado exitosamente`
    });
  } catch (error) {
    console.error('[ADMIN APPROVE AFFILIATE ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al aprobar afiliado' });
  }
});

/**
 * POST /api/affiliate/admin/reject/:id
 * Rechaza un afiliado (solo admin)
 */
router.post('/admin/reject/:id', authenticate, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    const affiliateId = parseInt(req.params.id);
    const { reason } = req.body;

    const [affiliate] = await db.select().from(affiliates)
      .where(eq(affiliates.id, affiliateId))
      .limit(1);

    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    await db.update(affiliates)
      .set({ 
        status: 'rejected',
        updatedAt: new Date()
      })
      .where(eq(affiliates.id, affiliateId));

    res.json({ 
      success: true, 
      message: `Afiliado ${affiliate.fullName} rechazado`
    });
  } catch (error) {
    console.error('[ADMIN REJECT AFFILIATE ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al rechazar afiliado' });
  }
});

/**
 * GET /api/affiliate/admin/pending-payouts
 * Obtiene todas las solicitudes de pago pendientes (solo admin)
 */
router.get('/admin/pending-payouts', authenticate, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    const pendingPayouts = await db.select({
      id: affiliateEarnings.id,
      affiliateId: affiliateEarnings.affiliateId,
      amount: affiliateEarnings.amount,
      description: affiliateEarnings.description,
      status: affiliateEarnings.status,
      metadata: affiliateEarnings.metadata,
      createdAt: affiliateEarnings.createdAt,
      affiliateName: affiliates.fullName,
      affiliateEmail: affiliates.email,
      paymentMethod: affiliates.paymentMethod,
      paymentEmail: affiliates.paymentEmail
    })
    .from(affiliateEarnings)
    .leftJoin(affiliates, eq(affiliateEarnings.affiliateId, affiliates.id))
    .where(and(
      eq(affiliateEarnings.type, 'payout_request'),
      eq(affiliateEarnings.status, 'pending')
    ))
    .orderBy(desc(affiliateEarnings.createdAt));

    res.json({ success: true, payouts: pendingPayouts });
  } catch (error) {
    console.error('[ADMIN GET PENDING PAYOUTS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener solicitudes de pago' });
  }
});

/**
 * GET /api/affiliate/admin/stats
 * Obtiene estadísticas del sistema de afiliados (solo admin)
 */
router.get('/admin/stats', authenticate, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    // Get total affiliates by status
    const allAffiliates = await db.select().from(affiliates);
    
    const stats = {
      totalAffiliates: allAffiliates.length,
      pending: allAffiliates.filter(a => a.status === 'pending').length,
      approved: allAffiliates.filter(a => a.status === 'approved').length,
      rejected: allAffiliates.filter(a => a.status === 'rejected').length,
      suspended: allAffiliates.filter(a => a.status === 'suspended').length,
      totalClicks: allAffiliates.reduce((sum, a) => sum + a.totalClicks, 0),
      totalConversions: allAffiliates.reduce((sum, a) => sum + a.totalConversions, 0),
      totalEarnings: allAffiliates.reduce((sum, a) => sum + Number(a.totalEarnings), 0),
      totalPendingPayments: allAffiliates.reduce((sum, a) => sum + Number(a.pendingPayment), 0),
      totalPaidOut: allAffiliates.reduce((sum, a) => sum + Number(a.paidAmount), 0),
      conversionRate: allAffiliates.reduce((sum, a) => sum + a.totalClicks, 0) > 0 
        ? (allAffiliates.reduce((sum, a) => sum + a.totalConversions, 0) / allAffiliates.reduce((sum, a) => sum + a.totalClicks, 0) * 100).toFixed(2)
        : '0.00'
    };

    // Get pending payouts count
    const pendingPayouts = await db.select().from(affiliateEarnings)
      .where(and(
        eq(affiliateEarnings.type, 'payout_request'),
        eq(affiliateEarnings.status, 'pending')
      ));

    stats['pendingPayoutsCount'] = pendingPayouts.length;
    stats['pendingPayoutsAmount'] = pendingPayouts.reduce((sum, p) => sum + Math.abs(Number(p.amount)), 0);

    // Top performers
    const topPerformers = allAffiliates
      .filter(a => a.status === 'approved')
      .sort((a, b) => Number(b.totalEarnings) - Number(a.totalEarnings))
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        name: a.fullName,
        email: a.email,
        level: a.level,
        conversions: a.totalConversions,
        earnings: Number(a.totalEarnings)
      }));

    res.json({ success: true, stats: { ...stats, topPerformers } });
  } catch (error) {
    console.error('[ADMIN GET STATS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
});

/**
 * GET /api/affiliate/products
 * Obtiene los productos disponibles para promocionar (planes de Boostify)
 */
router.get('/products', authenticate, async (_req: Request, res: Response) => {
  const products = [
    {
      id: 'plan-basic',
      name: 'Boostify Basic Plan',
      url: '/pricing',
      type: 'subscription',
      price: 59.99,
      commissionRate: 10,
      description: 'Plan básico para artistas emergentes con herramientas esenciales de promoción.'
    },
    {
      id: 'plan-pro',
      name: 'Boostify Pro Plan',
      url: '/pricing',
      type: 'subscription',
      price: 99.99,
      commissionRate: 15,
      description: 'Plan profesional con distribución musical y herramientas avanzadas de crecimiento.'
    },
    {
      id: 'plan-premium',
      name: 'Boostify Premium Plan',
      url: '/pricing',
      type: 'subscription',
      price: 149.99,
      commissionRate: 20,
      description: 'Plan premium con acceso completo a toda la suite de herramientas Boostify.'
    },
    {
      id: 'bundle-music-video',
      name: 'Music Video Bundle',
      url: '/music-video-pricing',
      type: 'bundle',
      price: 299.99,
      commissionRate: 12,
      description: 'Paquete completo de producción y distribución de videoclips musicales.'
    },
    // ─── Boostify Music Academy courses (education) ───
    {
      id: 'course-ai-music-production',
      name: 'AI Music Production Masterclass',
      url: '/course/ai-music-production',
      type: 'course',
      price: 199,
      commissionRate: 25,
      description: 'Professional AI music production from concept to master.'
    },
    {
      id: 'course-ai-music-videos',
      name: 'AI Music Video Creation',
      url: '/course/ai-music-videos',
      type: 'course',
      price: 249,
      commissionRate: 25,
      description: 'Create stunning music videos with AI — no studio needed.'
    },
    {
      id: 'course-music-marketing-mastery',
      name: 'Music Marketing Mastery',
      url: '/course/music-marketing-mastery',
      type: 'course',
      price: 179,
      commissionRate: 25,
      description: 'Promote your music like a pro in the digital age.'
    },
    {
      id: 'education-academy',
      name: 'Boostify Music Academy',
      url: '/education',
      type: 'course',
      price: 0,
      commissionRate: 25,
      description: 'Enlace general a todos los cursos de la academia (incluye cursos premium y gratis).'
    },
    {
      id: 'general',
      name: 'General Boostify Link',
      url: '/',
      type: 'general',
      price: 0,
      commissionRate: 10,
      description: 'Enlace general a la plataforma Boostify para nuevos registros.'
    }
  ];
  res.json({ success: true, products });
});

export default router;
