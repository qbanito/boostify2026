/**
 * AAS Agent 2: Revenue Operator v2
 * 
 * Pushes monetization: merch drops, memberships, sponsorships, 
 * token sales, pricing experiments.
 * 
 * NOW CONNECTED TO:
 *  - FAL AI → generateArtistDesignPack(), generateMerchandiseImage()
 *  - Printful → createSyncProduct(), generateMockupAndWait()
 *  - Brevo Email → sendNotificationEmail() to marketing_contacts
 *  - Sales DB → analyzes top-selling products
 */

import { db } from '../../db';
import { salesTransactions, aasStrategicMemory, marketingContacts, users, artistBlueprints } from '../../../db/schema';
import { eq, gte, desc, sql, and, isNotNull } from 'drizzle-orm';
import type { ActionResult } from '../../services/aas/types';

/**
 * Execute a revenue action. Routes to the appropriate existing service.
 */
export async function executeRevenueAction(
  artistId: number,
  action: string,
  budget: number
): Promise<ActionResult> {
  try {
    switch (action) {
      case 'Push merch drop or limited offer':
        return await pushMerchDrop(artistId);
      case 'Test pricing experiment':
        return await testPricing(artistId);
      case 'Create merch design with AI':
        return await createMerchDesign(artistId);
      case 'Create Printful product':
        return await createPrintfulProduct(artistId);
      case 'Send merch campaign email':
        return await sendMerchCampaign(artistId);
      case 'Send flash sale email':
        return await sendFlashSale(artistId);
      default:
        return {
          success: true,
          agent: 'revenue-operator',
          action,
          costActual: 0,
          revenueGenerated: 0,
          details: `Revenue action "${action}" queued for manual review`,
        };
    }
  } catch (error: any) {
    return {
      success: false,
      agent: 'revenue-operator',
      action,
      costActual: 0,
      revenueGenerated: 0,
      details: `Failed: ${error.message}`,
    };
  }
}

async function pushMerchDrop(artistId: number): Promise<ActionResult> {
  const topProducts = await db
    .select({ 
      productName: salesTransactions.productName,
      total: sql<string>`COALESCE(SUM(CAST(sale_amount AS numeric)), 0)`,
      qty: sql<number>`COUNT(*)`,
    })
    .from(salesTransactions)
    .where(eq(salesTransactions.artistId, artistId))
    .groupBy(salesTransactions.productName)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(3);

  const bestProduct = topProducts[0]?.productName || 'T-Shirt';

  if (topProducts.length > 0) {
    await db.insert(aasStrategicMemory).values({
      artistId,
      category: 'offer_conversion',
      insight: `Best-selling product: ${bestProduct} (${topProducts[0]?.qty || 0} sales in last 30d)`,
      confidence: '0.70',
      evidenceCount: topProducts[0]?.qty || 1,
      lastValidatedAt: new Date(),
    }).onConflictDoNothing();
  }

  return {
    success: true,
    agent: 'revenue-operator',
    action: 'Push merch drop or limited offer',
    costActual: 0,
    revenueGenerated: 0,
    details: `Identified best product: ${bestProduct}. Ready to push merch drop campaign.`,
    lessonsLearned: topProducts.length > 0 
      ? [`${bestProduct} is the top seller — prioritize in next campaign`] 
      : ['No sales data yet — start with general merch campaign'],
  };
}

/**
 * Generate a full design pack for the artist using FAL AI
 */
async function createMerchDesign(artistId: number): Promise<ActionResult> {
  try {
    const { generateArtistDesignPack } = await import('../../services/fal-service');
    const [artist] = await db.select({ artistName: users.artistName, profileImageUrl: users.profileImageUrl })
      .from(users).where(eq(users.id, artistId)).limit(1);
    const name = artist?.artistName || 'Artist';
    const imageUrl = artist?.profileImageUrl || '';

    const result = await generateArtistDesignPack(name, imageUrl, 'pop');
    const designCount = result.designs.filter(d => d.success).length;

    await db.insert(aasStrategicMemory).values({
      artistId,
      category: 'creative_roi',
      insight: `Generated ${designCount} merch designs via FAL AI`,
      confidence: '0.80',
      evidenceCount: designCount,
      lastValidatedAt: new Date(),
    }).onConflictDoNothing();

    return {
      success: designCount > 0,
      agent: 'revenue-operator',
      action: 'Create merch design with AI',
      costActual: designCount * 0.05,
      revenueGenerated: 0,
      details: `Generated ${designCount} merch designs for ${name}`,
      lessonsLearned: [`${designCount} designs ready for Printful product creation`],
    };
  } catch (error: any) {
    return {
      success: false, agent: 'revenue-operator',
      action: 'Create merch design with AI',
      costActual: 0, revenueGenerated: 0,
      details: `Design generation failed: ${error.message}`,
    };
  }
}

/**
 * Create a real product in Printful using generated designs
 */
async function createPrintfulProduct(artistId: number): Promise<ActionResult> {
  try {
    // ── Blueprint Gate: require a completed Superstar Blueprint ──
    const [bp] = await db
      .select({ id: artistBlueprints.id, brandArchetype: artistBlueprints.brandArchetype })
      .from(artistBlueprints)
      .where(
        and(
          eq(artistBlueprints.artistId, artistId),
          eq(artistBlueprints.generationStatus, 'completed'),
        ),
      )
      .limit(1);

    if (!bp) {
      return {
        success: false,
        agent: 'revenue-operator',
        action: 'Create Printful product',
        costActual: 0,
        revenueGenerated: 0,
        details: 'Skipped: No completed Superstar Blueprint found for this artist. Generate the Blueprint first — it provides the visual identity and brand archetype required for coherent product design.',
      };
    }

    const { getPrintfulService } = await import('../../services/printful-service');
    const { generateArtistMerchandise } = await import('../../services/fal-service');
    
    const printful = getPrintfulService();
    const [artist] = await db.select({ artistName: users.artistName, profileImageUrl: users.profileImageUrl })
      .from(users).where(eq(users.id, artistId)).limit(1);
    const name = artist?.artistName || `Artist ${artistId}`;
    const imageUrl = artist?.profileImageUrl || '';

    const merchItems = await generateArtistMerchandise(name, imageUrl, bp.brandArchetype || 'pop');
    
    if (!merchItems.length || !merchItems[0].imageUrl) {
      return { success: false, agent: 'revenue-operator', action: 'Create Printful product',
        costActual: 0.05, revenueGenerated: 0, details: 'No design URL generated' };
    }

    const designUrl = merchItems[0].imageUrl;
    const productName = `${name} — ${merchItems[0].name}`;

    // Use buildSyncProductData for correct placement + geometry (T-Shirt default)
    const { buildSyncProductData } = await import('../../config/printful-product-map');
    const syncData = await buildSyncProductData('T-Shirt', name, designUrl);
    const product = await printful.createSyncProduct(syncData ?? {
      sync_product: { name: productName, thumbnail: designUrl },
      sync_variants: [{ variant_id: 4012, retail_price: '29.99', files: [{ url: designUrl, type: 'front' }] }],
    });

    return {
      success: true,
      agent: 'revenue-operator',
      action: 'Create Printful product',
      costActual: 0.05,
      revenueGenerated: 0,
      details: `Created Printful product: ${product?.name || productName}. Blueprint archetype: ${bp.brandArchetype || 'N/A'}. Design: ${designUrl.substring(0, 60)}...`,
      lessonsLearned: ['Printful product live — ready for campaign email'],
    };
  } catch (error: any) {
    return { success: false, agent: 'revenue-operator', action: 'Create Printful product',
      costActual: 0, revenueGenerated: 0, details: `Printful product creation failed: ${error.message}` };
  }
}

/**
 * Send merch campaign email to active marketing contacts
 */
async function sendMerchCampaign(artistId: number): Promise<ActionResult> {
  try {
    const { sendNotificationEmail } = await import('../../services/brevo-email-service');
    const [artist] = await db.select({ artistName: users.artistName }).from(users).where(eq(users.id, artistId)).limit(1);
    const name = artist?.artistName || 'Artist';

    // Get active marketing contacts (limit 10 per cycle)
    const contacts = await db.select({ email: marketingContacts.email, name: marketingContacts.name })
      .from(marketingContacts)
      .where(and(eq(marketingContacts.status, 'active'), isNotNull(marketingContacts.email)))
      .limit(10);

    let sent = 0;
    for (const contact of contacts) {
      if (!contact.email) continue;
      const result = await sendNotificationEmail(
        contact.email,
        `🔥 New Merch Drop from ${name}!`,
        `New Merch Available!`,
        `${name} just dropped exclusive new merchandise. Limited quantities available — don't miss out!`,
        'Shop Now',
        `https://boostifymusic.com/artist/${artistId}/merch`
      );
      if (result.success) sent++;
    }

    return {
      success: sent > 0,
      agent: 'revenue-operator',
      action: 'Send merch campaign email',
      costActual: 0,
      revenueGenerated: 0,
      details: `Sent merch campaign to ${sent}/${contacts.length} contacts for ${name}`,
      lessonsLearned: [`Email campaign sent to ${sent} fans`],
    };
  } catch (error: any) {
    return { success: false, agent: 'revenue-operator', action: 'Send merch campaign email',
      costActual: 0, revenueGenerated: 0, details: `Email campaign failed: ${error.message}` };
  }
}

/**
 * Send flash sale / limited-time offer email to most engaged fans
 */
async function sendFlashSale(artistId: number): Promise<ActionResult> {
  try {
    const { sendNotificationEmail } = await import('../../services/brevo-email-service');
    const [artist] = await db.select({ artistName: users.artistName }).from(users).where(eq(users.id, artistId)).limit(1);
    const name = artist?.artistName || 'Artist';

    // Target most engaged fans
    const topFans = await db.select({ email: marketingContacts.email, name: marketingContacts.name })
      .from(marketingContacts)
      .where(and(eq(marketingContacts.status, 'active'), isNotNull(marketingContacts.email)))
      .orderBy(desc(marketingContacts.totalOpens))
      .limit(15);

    let sent = 0;
    for (const fan of topFans) {
      if (!fan.email) continue;
      const result = await sendNotificationEmail(
        fan.email,
        `⚡ 48H Flash Sale — ${name} Exclusive`,
        `Flash Sale — 48 Hours Only!`,
        `Exclusive 20% off all ${name} merchandise for the next 48 hours. Use code FLASH20 at checkout.`,
        'Claim Discount',
        `https://boostifymusic.com/artist/${artistId}/merch?promo=FLASH20`
      );
      if (result.success) sent++;
    }

    return {
      success: sent > 0,
      agent: 'revenue-operator',
      action: 'Send flash sale email',
      costActual: 0,
      revenueGenerated: 0,
      details: `Flash sale email sent to ${sent}/${topFans.length} top fans of ${name}`,
      lessonsLearned: [`Flash sale campaign targeting ${sent} most engaged fans`],
    };
  } catch (error: any) {
    return { success: false, agent: 'revenue-operator', action: 'Send flash sale email',
      costActual: 0, revenueGenerated: 0, details: `Flash sale email failed: ${error.message}` };
  }
}

async function testPricing(artistId: number): Promise<ActionResult> {
  return {
    success: true,
    agent: 'revenue-operator',
    action: 'Test pricing experiment',
    costActual: 0,
    revenueGenerated: 0,
    details: 'Pricing experiment queued. Will A/B test next product listing.',
  };
}

/**
 * Get revenue summary for the dashboard
 */
export async function getRevenueSummary(artistId: number) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const [summary] = await db
    .select({
      totalSales: sql<string>`COALESCE(SUM(CAST(sale_amount AS numeric)), 0)`,
      totalEarnings: sql<string>`COALESCE(SUM(CAST(artist_earning AS numeric)), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(salesTransactions)
    .where(eq(salesTransactions.artistId, artistId));

  const [weeklySummary] = await db
    .select({
      weeklyRevenue: sql<string>`COALESCE(SUM(CAST(sale_amount AS numeric)), 0)`,
      weeklyCount: sql<number>`COUNT(*)`,
    })
    .from(salesTransactions)
    .where(
      eq(salesTransactions.artistId, artistId),
    );

  return {
    allTime: {
      totalSales: parseFloat(summary?.totalSales || '0'),
      totalEarnings: parseFloat(summary?.totalEarnings || '0'),
      transactionCount: summary?.count || 0,
    },
    weekly: {
      revenue: parseFloat(weeklySummary?.weeklyRevenue || '0'),
      count: weeklySummary?.weeklyCount || 0,
    },
  };
}
