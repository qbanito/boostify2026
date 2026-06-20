import express, { Request, Response } from 'express';
import { db } from '../db';
import { 
  affiliateLinks, 
  affiliateClicks,
  affiliateConversions,
  affiliateEarnings,
  affiliates
} from '../../db/schema';
import { eq, sql, and } from 'drizzle-orm';

const router = express.Router();

/**
 * GET /ref/:code
 * Tracks a click and redirects to the destination
 */
router.get('/ref/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referrer = req.headers['referer'] || req.headers['referrer'] || null;
    
    // Get client IP (handles proxy/load balancer scenarios)
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.headers['x-real-ip'] as string
      || req.socket.remoteAddress
      || 'unknown';

    // Find the affiliate link
    const [link] = await db.select().from(affiliateLinks)
      .where(and(
        eq(affiliateLinks.uniqueCode, code.toUpperCase()),
        eq(affiliateLinks.isActive, true)
      ))
      .limit(1);

    if (!link) {
      // Link not found, redirect to home
      return res.redirect('/');
    }

    // Determine device type from user agent
    let device: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'unknown';
    if (userAgent) {
      if (/mobile/i.test(userAgent) && !/tablet/i.test(userAgent)) {
        device = 'mobile';
      } else if (/tablet|ipad/i.test(userAgent)) {
        device = 'tablet';
      } else if (/desktop|windows|mac|linux/i.test(userAgent)) {
        device = 'desktop';
      }
    }

    // Record the click
    await db.insert(affiliateClicks).values({
      linkId: link.id,
      affiliateId: link.affiliateId,
      ipAddress,
      userAgent,
      referrer: referrer ? referrer.substring(0, 500) : null,
      device
    });

    // Update link clicks count
    await db.update(affiliateLinks)
      .set({ clicks: sql`${affiliateLinks.clicks} + 1` })
      .where(eq(affiliateLinks.id, link.id));

    // Update affiliate total clicks
    await db.update(affiliates)
      .set({ 
        totalClicks: sql`${affiliates.totalClicks} + 1`,
        updatedAt: new Date()
      })
      .where(eq(affiliates.id, link.affiliateId));

    // Store affiliate link ID in session for conversion tracking
    if (req.session) {
      req.session.affiliateLinkId = link.id;
      req.session.affiliateId = link.affiliateId;
    }

    // Determine redirect URL based on product type
    let redirectUrl = '/';
    
    switch (link.productType) {
      case 'subscription':
        redirectUrl = '/pricing';
        break;
      case 'bundle':
        redirectUrl = '/music-video-pricing';
        break;
      case 'course':
        redirectUrl = '/education';
        break;
      case 'merchandise':
        redirectUrl = '/store';
        break;
      default:
        // Use custom path if provided
        redirectUrl = link.customPath || '/';
    }

    // Add UTM parameters to track the source
    const url = new URL(redirectUrl, `${req.protocol}://${req.get('host')}`);
    url.searchParams.set('ref', code);
    url.searchParams.set('utm_source', 'affiliate');
    url.searchParams.set('utm_medium', 'referral');
    url.searchParams.set('utm_campaign', link.title.toLowerCase().replace(/\s+/g, '_'));

    res.redirect(url.toString());
  } catch (error) {
    console.error('[TRACKING ERROR]', error);
    res.redirect('/');
  }
});

/**
 * POST /api/affiliate/track/conversion
 * Records a conversion when a sale is made
 */
router.post('/track/conversion', async (req: Request, res: Response) => {
  try {
    const {
      productType,
      productId,
      saleAmount,
      userId,
      stripePaymentId
    } = req.body;

    // Get affiliate link ID from session
    const affiliateLinkId = req.session?.affiliateLinkId;
    const affiliateId = req.session?.affiliateId;

    if (!affiliateLinkId || !affiliateId) {
      return res.json({ success: false, message: 'No affiliate tracking found' });
    }

    // Get the affiliate to determine commission rate
    const [affiliate] = await db.select().from(affiliates)
      .where(eq(affiliates.id, affiliateId))
      .limit(1);

    if (!affiliate) {
      return res.json({ success: false, message: 'Affiliate not found' });
    }

    const commissionRate = Number(affiliate.commissionRate);
    const commissionAmount = (Number(saleAmount) * commissionRate) / 100;

    // Record the conversion
    const [conversion] = await db.insert(affiliateConversions).values({
      linkId: affiliateLinkId,
      affiliateId,
      userId: userId || null,
      productType,
      productId,
      saleAmount: saleAmount.toString(),
      commissionRate: commissionRate.toString(),
      commissionAmount: commissionAmount.toString(),
      status: 'pending',
      stripePaymentId: stripePaymentId || null,
      metadata: {
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      }
    }).returning();

    // Record the earning
    await db.insert(affiliateEarnings).values({
      affiliateId,
      amount: commissionAmount.toString(),
      type: 'commission',
      description: `Commission from ${productType} sale: ${productId}`,
      status: 'pending',
      conversionId: conversion.id
    });

    // Update link stats
    await db.update(affiliateLinks)
      .set({ 
        conversions: sql`${affiliateLinks.conversions} + 1`,
        earnings: sql`${affiliateLinks.earnings} + ${commissionAmount}`
      })
      .where(eq(affiliateLinks.id, affiliateLinkId));

    // Update affiliate stats
    await db.update(affiliates)
      .set({ 
        totalConversions: sql`${affiliates.totalConversions} + 1`,
        totalEarnings: sql`${affiliates.totalEarnings} + ${commissionAmount}`,
        pendingPayment: sql`${affiliates.pendingPayment} + ${commissionAmount}`,
        updatedAt: new Date()
      })
      .where(eq(affiliates.id, affiliateId));

    // Check for second-level commission (referral system)
    const referralRelation = await db.query.affiliateReferrals.findFirst({
      where: (referrals, { eq, and }) => and(
        eq(referrals.referredId, affiliateId),
        eq(referrals.status, 'active')
      )
    });

    if (referralRelation) {
      // Calculate second-level commission (5% of sale amount)
      const secondLevelRate = 5;
      const secondLevelCommission = (Number(saleAmount) * secondLevelRate) / 100;

      // Record second-level earning for the referrer
      await db.insert(affiliateEarnings).values({
        affiliateId: referralRelation.referrerId,
        amount: secondLevelCommission.toString(),
        type: 'referral_commission',
        description: `Comisión de 2do nivel por venta de referido`,
        status: 'pending',
        conversionId: conversion.id,
        metadata: {
          referredAffiliateId: affiliateId,
          saleAmount,
          secondLevelRate
        }
      });

      // Update referrer's earnings
      await db.update(affiliates)
        .set({
          totalEarnings: sql`${affiliates.totalEarnings} + ${secondLevelCommission}`,
          pendingPayment: sql`${affiliates.pendingPayment} + ${secondLevelCommission}`,
          updatedAt: new Date()
        })
        .where(eq(affiliates.id, referralRelation.referrerId));

      // Update referral relationship earnings
      await db.update(affiliateReferrals)
        .set({
          totalEarnings: sql`${affiliateReferrals.totalEarnings} + ${secondLevelCommission}`
        })
        .where(eq(affiliateReferrals.id, referralRelation.id));
    }

    // Clear the affiliate tracking from session
    if (req.session) {
      delete req.session.affiliateLinkId;
      delete req.session.affiliateId;
    }

    res.json({ 
      success: true, 
      conversion: {
        id: conversion.id,
        commissionAmount,
        secondLevelCommission: referralRelation ? (Number(saleAmount) * 5) / 100 : 0
      }
    });
  } catch (error) {
    console.error('[CONVERSION TRACKING ERROR]', error);
    res.status(500).json({ success: false, message: 'Error tracking conversion' });
  }
});

/**
 * POST /api/affiliate/track/coupon-use
 * Tracks when an affiliate coupon is used
 */
router.post('/track/coupon-use', async (req: Request, res: Response) => {
  try {
    const { couponCode, productType, productId, saleAmount, userId, stripePaymentId } = req.body;

    // Find the coupon and associated affiliate
    const coupon = await db.query.affiliateCoupons.findFirst({
      where: (coupons, { eq, and }) => and(
        eq(coupons.code, couponCode.toUpperCase()),
        eq(coupons.isActive, true)
      )
    });

    if (!coupon) {
      return res.json({ success: false, message: 'Coupon not found' });
    }

    // Get the affiliate
    const [affiliate] = await db.select().from(affiliates)
      .where(eq(affiliates.id, coupon.affiliateId))
      .limit(1);

    if (!affiliate) {
      return res.json({ success: false, message: 'Affiliate not found' });
    }

    // Update coupon usage
    await db.update(affiliateCoupons)
      .set({ usedCount: sql`${affiliateCoupons.usedCount} + 1` })
      .where(eq(affiliateCoupons.id, coupon.id));

    // Calculate commission
    const commissionRate = Number(affiliate.commissionRate);
    const commissionAmount = (Number(saleAmount) * commissionRate) / 100;

    // Record as conversion (even though it's via coupon)
    const [conversion] = await db.insert(affiliateConversions).values({
      linkId: null as any, // No link, just coupon
      affiliateId: affiliate.id,
      userId: userId || null,
      productType,
      productId,
      saleAmount: saleAmount.toString(),
      commissionRate: commissionRate.toString(),
      commissionAmount: commissionAmount.toString(),
      status: 'pending',
      stripePaymentId: stripePaymentId || null,
      metadata: {
        couponCode,
        couponId: coupon.id,
        timestamp: new Date().toISOString()
      }
    }).returning();

    // Record earning
    await db.insert(affiliateEarnings).values({
      affiliateId: affiliate.id,
      amount: commissionAmount.toString(),
      type: 'commission',
      description: `Coupon ${couponCode} used for ${productType}: ${productId}`,
      status: 'pending',
      conversionId: conversion.id
    });

    // Update affiliate stats
    await db.update(affiliates)
      .set({ 
        totalConversions: sql`${affiliates.totalConversions} + 1`,
        totalEarnings: sql`${affiliates.totalEarnings} + ${commissionAmount}`,
        pendingPayment: sql`${affiliates.pendingPayment} + ${commissionAmount}`,
        updatedAt: new Date()
      })
      .where(eq(affiliates.id, affiliate.id));

    res.json({ 
      success: true,
      conversion: {
        id: conversion.id,
        commissionAmount
      }
    });
  } catch (error) {
    console.error('[COUPON TRACKING ERROR]', error);
    res.status(500).json({ success: false, message: 'Error tracking coupon use' });
  }
});

export default router;
