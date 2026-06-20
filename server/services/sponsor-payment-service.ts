/**
 * Sponsor Payment Service
 * Handles Stripe payments for sponsor deals.
 * Boostify takes a 20% commission; 80% goes to the artist wallet.
 */

import Stripe from 'stripe';
import { db } from '../db';
import { sponsorDeals, sponsorContacts, salesTransactions, artistWallet, walletTransactions, users } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-11-20.acacia' as any });
const PLATFORM_URL = process.env.SPONSOR_PROPOSAL_BASE_URL || 'https://boostifymusic.com';
const COMMISSION_RATE = parseInt(process.env.SPONSOR_COMMISSION_RATE || '20', 10); // 20%

/**
 * Create a Stripe Payment Intent for a sponsor deal
 * Returns the client_secret and payment URL for the sponsor
 */
export async function createSponsorInvoice(dealId: number): Promise<{
  success: boolean;
  paymentUrl?: string;
  paymentIntentId?: string;
  error?: string;
}> {
  const deal = await db.select().from(sponsorDeals).where(eq(sponsorDeals.id, dealId)).limit(1);
  if (!deal[0]) return { success: false, error: 'Deal not found' };
  if (!deal[0].agreedAmount) return { success: false, error: 'No agreed amount set' };

  const contact = await db.select().from(sponsorContacts).where(eq(sponsorContacts.id, deal[0].sponsorContactId)).limit(1);
  const artist = await db.select().from(users).where(eq(users.id, deal[0].artistId)).limit(1);

  const amountCents = Math.round(parseFloat(deal[0].agreedAmount) * 100);
  const artistName = artist[0]?.artistName || artist[0]?.username || 'Artist';
  const brandName = contact[0]?.brandName || 'Sponsor';

  try {
    // Create a Checkout Session so the sponsor can pay via hosted page
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: deal[0].currency || 'usd',
          product_data: {
            name: `Sponsorship: ${artistName} x ${brandName}`,
            description: deal[0].title || `${deal[0].dealType} deal`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      metadata: {
        type: 'sponsor_deal',
        dealId: String(dealId),
        artistId: String(deal[0].artistId),
        sponsorContactId: String(deal[0].sponsorContactId),
        commissionRate: String(COMMISSION_RATE),
      },
      success_url: `${PLATFORM_URL}/sponsor/proposal/${dealId}?payment=success`,
      cancel_url: `${PLATFORM_URL}/sponsor/proposal/${dealId}?payment=cancelled`,
      customer_email: contact[0]?.contactEmail || undefined,
    });

    // Update deal with payment info
    await db.update(sponsorDeals).set({
      stripePaymentIntentId: session.payment_intent as string || session.id,
      stripePaymentUrl: session.url || undefined,
      status: 'payment_pending',
      updatedAt: new Date(),
    }).where(eq(sponsorDeals.id, dealId));

    return {
      success: true,
      paymentUrl: session.url || undefined,
      paymentIntentId: session.payment_intent as string || session.id,
    };
  } catch (error: any) {
    console.error('❌ Error creating sponsor payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle a successful sponsor payment (called from Stripe webhook)
 * Splits funds: 20% platform, 80% artist
 */
export async function handleSponsorPaymentReceived(sessionOrPaymentIntentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  // Find the deal by Stripe ID
  const deals = await db.select().from(sponsorDeals)
    .where(eq(sponsorDeals.stripePaymentIntentId, sessionOrPaymentIntentId))
    .limit(1);

  if (!deals[0]) return { success: false, error: 'Deal not found for payment' };
  const deal = deals[0];

  if (deal.status === 'active' || deal.status === 'completed') {
    return { success: true }; // Already processed
  }

  const totalAmount = parseFloat(deal.agreedAmount || '0');
  if (totalAmount <= 0) return { success: false, error: 'Invalid amount' };

  const platformFee = Math.round(totalAmount * (COMMISSION_RATE / 100) * 100) / 100;
  const artistEarning = Math.round((totalAmount - platformFee) * 100) / 100;

  const contact = await db.select().from(sponsorContacts).where(eq(sponsorContacts.id, deal.sponsorContactId)).limit(1);
  const brandName = contact[0]?.brandName || 'Sponsor';

  try {
    // 1. Update the deal status
    await db.update(sponsorDeals).set({
      status: 'active',
      platformFee: String(platformFee),
      artistEarning: String(artistEarning),
      paymentReceivedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(sponsorDeals.id, deal.id));

    // 2. Record in sales transactions
    await db.insert(salesTransactions).values({
      artistId: deal.artistId,
      productName: `Sponsor Deal: ${deal.title} (${brandName})`,
      saleAmount: String(totalAmount),
      productionCost: '0',
      artistEarning: String(artistEarning),
      platformFee: String(platformFee),
      commissionRate: COMMISSION_RATE,
      quantity: 1,
      currency: deal.currency || 'usd',
      stripePaymentId: sessionOrPaymentIntentId,
      status: 'completed',
    });

    // 3. Update artist wallet
    const wallet = await db.select().from(artistWallet).where(eq(artistWallet.userId, deal.artistId)).limit(1);
    
    if (wallet[0]) {
      const currentBalance = parseFloat(wallet[0].balance || '0');
      const currentEarnings = parseFloat(wallet[0].totalEarnings || '0');
      const newBalance = currentBalance + artistEarning;
      const newEarnings = currentEarnings + artistEarning;

      await db.update(artistWallet).set({
        balance: String(newBalance),
        totalEarnings: String(newEarnings),
        updatedAt: new Date(),
      }).where(eq(artistWallet.id, wallet[0].id));

      // 4. Record wallet transaction
      await db.insert(walletTransactions).values({
        userId: deal.artistId,
        type: 'earning',
        amount: String(artistEarning),
        balanceBefore: String(currentBalance),
        balanceAfter: String(newBalance),
        description: `Sponsor payment: ${deal.title} (${brandName}) — $${totalAmount} total, ${COMMISSION_RATE}% platform fee`,
        metadata: { dealId: deal.id, brandName, totalAmount, platformFee },
      });
    } else {
      // Create wallet if it doesn't exist
      await db.insert(artistWallet).values({
        userId: deal.artistId,
        balance: String(artistEarning),
        totalEarnings: String(artistEarning),
        totalSpent: '0',
        currency: deal.currency || 'usd',
      });

      await db.insert(walletTransactions).values({
        userId: deal.artistId,
        type: 'earning',
        amount: String(artistEarning),
        balanceBefore: '0',
        balanceAfter: String(artistEarning),
        description: `Sponsor payment: ${deal.title} (${brandName}) — $${totalAmount} total, ${COMMISSION_RATE}% platform fee`,
        metadata: { dealId: deal.id, brandName, totalAmount, platformFee },
      });
    }

    // 5. Update sponsor contact status
    await db.update(sponsorContacts).set({
      status: 'deal_in_progress',
      updatedAt: new Date(),
    }).where(eq(sponsorContacts.id, deal.sponsorContactId));

    console.log(`✅ Sponsor payment processed: Deal #${deal.id} — $${totalAmount} ($${artistEarning} artist / $${platformFee} platform)`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error processing sponsor payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get deal payment status
 */
export async function getDealPaymentStatus(dealId: number): Promise<{
  status: string;
  paymentUrl?: string | null;
  amount?: string | null;
  platformFee?: string | null;
  artistEarning?: string | null;
}> {
  const deal = await db.select().from(sponsorDeals).where(eq(sponsorDeals.id, dealId)).limit(1);
  if (!deal[0]) return { status: 'not_found' };

  return {
    status: deal[0].status || 'unknown',
    paymentUrl: deal[0].stripePaymentUrl,
    amount: deal[0].agreedAmount,
    platformFee: deal[0].platformFee,
    artistEarning: deal[0].artistEarning,
  };
}
