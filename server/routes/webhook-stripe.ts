/**
 * Stripe Webhook Handler
 * 
 * Maneja eventos de Stripe para sincronizar suscripciones automáticamente
 * Eventos soportados:
 * - checkout.session.completed: Nueva suscripción creada
 * - customer.subscription.updated: Suscripción actualizada
 * - customer.subscription.deleted: Suscripción cancelada
 * - invoice.payment_succeeded: Pago exitoso
 * - invoice.payment_failed: Pago fallido
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from '../db';
import { explicitSubscriptions, subscriptions, users, notifications, platformRevenue } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { PRICE_ID_TO_PLAN, isAdminEmail } from '../../shared/constants';
import { handleAgeStripeEvent } from './artist-growth-engine';

const router = Router();

// Inicializar Stripe
const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeKey!, {
  apiVersion: '2025-01-27.acacia' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Make webhook URL para enviar eventos de suscripción
const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/ow1m732j9t4mjmnod9cyahk6im7w6uet';

/**
 * Enviar evento a Make para que maneje los emails
 */
async function sendToMake(eventType: string, data: any) {
  try {
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: data
      })
    });

    if (!response.ok) {
      console.error(`❌ Error sending to Make: ${response.statusText}`);
    } else {
      console.log(`✅ Event sent to Make: ${eventType}`);
    }
  } catch (error) {
    console.error('❌ Error connecting to Make:', error);
  }
}

/**
 * Endpoint para recibir webhooks de Stripe
 * IMPORTANTE: Este endpoint debe usar raw body (no JSON parsed)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  
  if (!sig) {
    console.error('❌ Webhook Error: No signature provided');
    return res.status(400).send('Webhook Error: No signature');
  }
  
  if (!webhookSecret) {
    console.error('❌ Webhook Error: STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook Error: Server configuration error');
  }
  
  let event: Stripe.Event;
  
  try {
    // Verificar firma del webhook
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  
  console.log(`✅ Received webhook event: ${event.type}`);
  
  // Manejar diferentes tipos de eventos
  try {
    // AGE: intercepta primero si el evento tiene metadata.age='1'
    try {
      const handled = await handleAgeStripeEvent(event);
      if (handled) {
        console.log(`✅ AGE handled event: ${event.type}`);
      }
    } catch (ageErr) {
      console.error('❌ AGE webhook handler error:', ageErr);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
        
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
        
      case 'charge.refunded':
        await handleConcertRefundOrDispute((event.data.object as Stripe.Charge).payment_intent);
        break;

      case 'charge.dispute.created':
        await handleConcertRefundOrDispute((event.data.object as Stripe.Dispute).payment_intent);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('Webhook processing error');
  }
});

/**
 * Mapear bundle tier a plan tier
 */
function mapBundleToPlan(bundleTier: string): 'free' | 'creator' | 'professional' | 'enterprise' {
  const mapping: Record<string, 'free' | 'creator' | 'professional' | 'enterprise'> = {
    'essential': 'creator',
    'gold': 'professional',
    'platinum': 'enterprise',
    'diamond': 'enterprise'
  };
  return mapping[bundleTier] || 'free';
}

/**
 * Fan Monetization — handle an artist catalog unlock payment.
 * Delegates to recordArtistUnlock (idempotent insert + 85/15 wallet credit).
 */
async function handleArtistUnlock(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const artistId = parseInt(metadata.artistId || '', 10);
  if (!artistId || isNaN(artistId)) {
    console.error('❌ artist_unlock: missing/invalid artistId in metadata');
    return;
  }

  const fanUserIdRaw = metadata.fanUserId ? parseInt(metadata.fanUserId, 10) : null;
  const fanUserId = fanUserIdRaw && !isNaN(fanUserIdRaw) ? fanUserIdRaw : null;
  const fanEmail = metadata.fanEmail || session.customer_details?.email || null;
  const amount = (session.amount_total ?? 0) / 100; // dollars

  const { recordArtistUnlock } = await import('../services/artist-unlock-service');
  await recordArtistUnlock({
    stripeSessionId: session.id,
    artistId,
    fanUserId,
    fanEmail,
    amount,
    currency: session.currency || 'usd',
  });
}

function mapArtistCatalogSubscriptionStatus(
  status: Stripe.Subscription.Status,
): 'active' | 'cancelled' | 'expired' | 'past_due' {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete' || status === 'incomplete_expired') return 'past_due';
  if (status === 'canceled') return 'cancelled';
  return 'expired';
}

/**
 * Fan Monetization — handle artist monthly catalog subscription checkout.
 * Stores/upserts entitlement in explicit_subscriptions.
 */
async function handleArtistCatalogSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const artistId = parseInt(metadata.artistId || '', 10);
  const subscriberId = parseInt(metadata.fanUserId || '', 10);
  const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;

  if (!artistId || isNaN(artistId) || !subscriberId || isNaN(subscriberId) || !stripeSubscriptionId) {
    console.error('❌ artist_catalog_subscription: missing metadata or subscription id');
    return;
  }

  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  await db.insert(explicitSubscriptions).values({
    subscriberId,
    artistId,
    plan: 'monthly',
    status: mapArtistCatalogSubscriptionStatus(sub.status),
    stripeSubscriptionId,
    stripeCustomerId: stripeCustomerId || undefined,
    currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  }).onConflictDoUpdate({
    target: explicitSubscriptions.stripeSubscriptionId,
    set: {
      status: mapArtistCatalogSubscriptionStatus(sub.status),
      currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      updatedAt: new Date(),
    },
  });

  console.log(`✅ artist_catalog_subscription active: sub=${stripeSubscriptionId} artist=${artistId} fan=${subscriberId}`);
}

/**
 * Fan Monetization — handle a one-time platform module unlock payment.
 * Delegates to recordModuleUnlock (idempotent, 100% platform — no artist split).
 */
async function handleModuleUnlock(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const userId = parseInt(metadata.userId || '', 10);
  const moduleKey = metadata.moduleKey || '';
  if (!userId || isNaN(userId) || !moduleKey) {
    console.error('❌ module_unlock: missing/invalid userId or moduleKey in metadata');
    return;
  }

  const amount = (session.amount_total ?? 0) / 100; // dollars

  try {
    const { recordModuleUnlock } = await import('../services/module-unlock-service');
    await recordModuleUnlock({
      stripeSessionId: session.id,
      userId,
      moduleKey,
      amount,
      currency: session.currency || 'usd',
    });
  } catch (err) {
    console.error('❌ Failed to record module unlock:', err);
  }
}

/**
 * Manejar checkout completado (nueva suscripción O bundle)
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('💳 Processing checkout.session.completed:', session.id);
  const metadata = session.metadata || {};
  const customer = session.customer as string | null;
  const client_reference_id = session.client_reference_id;
  
  // ── Sponsor Deal Payment ────────────────────────────────────────────────
  if (metadata?.type === 'sponsor_deal') {
    console.log(`🤝 Processing sponsor deal payment: deal #${metadata.dealId}`);
    const { handleSponsorPaymentReceived } = await import('../services/sponsor-payment-service');
    await handleSponsorPaymentReceived(session.id);
    return;
  }

  // ── Merchandise Purchase → Create Printful Production Order ─────────────
  if (metadata?.type === 'merchandise') {
    console.log(`🛍️ Processing merchandise purchase: ${metadata.productType} (${metadata.size})`);
    await handleMerchandisePurchase(session);
    return;
  }

  // ── Multi-product Cart Purchase (Tanda 7) ───────────────────────────────
  if (metadata?.type === 'cart') {
    console.log(`🛒 Processing multi-product cart purchase: ${metadata.itemCount} items`);
    await handleCartPurchase(session);
    return;
  }

  // ── Artist Catalog Unlock (Fan Monetization, pay-what-you-want) ─────────
  if (metadata?.type === 'artist_unlock') {
    console.log(`🔓 Processing artist catalog unlock: artist #${metadata.artistId}`);
    await handleArtistUnlock(session);
    return;
  }

  // ── Artist Monthly Catalog Subscription ($20/month) ─────────────────────
  if (metadata?.type === 'artist_catalog_subscription') {
    console.log(`🎵 Processing artist monthly catalog subscription: artist #${metadata.artistId}`);
    await handleArtistCatalogSubscriptionCheckout(session);
    return;
  }

  // ── Module Unlock (one-time platform module purchase) ───────────────────
  if (metadata?.type === 'module_unlock') {
    console.log(`🧩 Processing module unlock: '${metadata.moduleKey}' for user #${metadata.userId}`);
    await handleModuleUnlock(session);
    return;
  }

  // ── Concert Ticket Purchase (Concert Command Center) ─────────────────────
  if (session.metadata?.type === 'concert_ticket') {
    console.log(`🎫 Processing concert ticket purchase: order #${session.metadata.orderId}, event #${session.metadata.eventId}`);
    await handleConcertTicketPurchase(session);
    return;
  }

  // ── Vault Deposit (Economic Engine) ─────────────────────────────────────
  if (metadata?.type === 'vault_deposit') {
    console.log(`💰 Processing vault deposit: artist #${metadata.artistId}, $${metadata.amount}`);
    try {
      const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/economic-engine/wallet/confirm-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await response.json();
      console.log(`💰 Vault deposit ${data.success ? 'confirmed' : 'failed'}:`, data.message || '');
    } catch (err) {
      console.error('❌ Failed to confirm vault deposit:', err);
    }
    return;
  }

  // Verificar si es un bundle de music video (metadata.type = 'music_video_bundle')
  const isMusicVideoBundle = metadata?.type === 'music_video_bundle';
  const bundleTier = metadata?.tier;
  
  if (isMusicVideoBundle && bundleTier) {
    console.log(`🎵 Processing music video bundle purchase: ${bundleTier}`);
    
    // Buscar usuario
    const userEmail = session.customer_details?.email;
    const userId = client_reference_id ? parseInt(client_reference_id) : null;
    
    let user;
    if (userId) {
      const users_result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      user = users_result[0];
    } else if (userEmail) {
      const users_result = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);
      user = users_result[0];
    }
    
    if (!user) {
      console.error('❌ User not found for bundle purchase:', userEmail || userId);
      return;
    }
    
    // Activar suscripción trial automáticamente según el bundle
    const planTier = mapBundleToPlan(bundleTier);
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 días
    
    await db.insert(subscriptions).values({
      userId: user.id,
      plan: planTier,
      status: 'trialing',
      currentPeriodStart: now,
      currentPeriodEnd: trialEndDate,
      cancelAtPeriodEnd: false,
      interval: 'monthly',
      isTrial: true,
      trialEndsAt: trialEndDate,
      grantedByBundle: `${bundleTier}_bundle_${session.id}`,
      stripeCustomerId: customer as string
    });
    
    console.log(`✅ Music video bundle ${bundleTier} purchased! Trial subscription activated for user ${user.email}: ${planTier} (30 days)`);
    
    // Enviar notificación IN-APP
    await db.insert(notifications).values({
      userId: user.id,
      type: 'subscription_activated',
      title: `🎉 Welcome to ${planTier.charAt(0).toUpperCase() + planTier.slice(1)}!`,
      message: `Your ${bundleTier} bundle trial has been activated. You now have access to all features for 30 days.`,
      read: false,
      createdAt: new Date()
    }).catch(err => console.error('Error creating notification:', err));
    
    // Enviar a Make para email
    await sendToMake('subscription_activated', {
      userEmail: user.email,
      userName: user.artistName || user.email,
      planTier: planTier,
      bundleTier: bundleTier,
      trialDays: 30,
      type: 'bundle_trial'
    });
    
    return;
  }
  
  // Flujo normal de suscripción
  if (!subscriptionId || !customer) {
    console.log('⚠️ Checkout session without subscription or customer');
    return;
  }
  
  // Obtener datos completos de la suscripción
  const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
  
  // Determinar el tier del plan
  const priceId = subscription.items.data[0]?.price.id;
  const planTier = determinePlanTier(priceId);
  
  // Buscar usuario por email o client_reference_id
  const userEmail = session.customer_details?.email;
  const userId = client_reference_id ? parseInt(client_reference_id) : null;
  
  let user;
  if (userId) {
    const users_result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    user = users_result[0];
  } else if (userEmail) {
    const users_result = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);
    user = users_result[0];
  }
  
  if (!user) {
    console.error('❌ User not found for subscription:', userEmail || userId);
    return;
  }
  
  // Determinar intervalo (monthly o yearly)
  const interval = subscription.items.data[0]?.price.recurring?.interval || 'monthly';
  
  // Crear o actualizar suscripción en la base de datos
  await db.insert(subscriptions).values({
    userId: user.id,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customer as string,
    plan: planTier,
    status: subscription.status as any,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    interval: interval as 'monthly' | 'yearly',
    price: (subscription.items.data[0]?.price.unit_amount || 0) / 100,
    currency: subscription.currency,
    isTrial: subscription.status === 'trialing'
  }).onConflictDoUpdate({
    target: subscriptions.stripeSubscriptionId,
    set: {
      status: subscription.status as any,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: new Date()
    }
  });
  
  console.log(`✅ Subscription created/updated for user ${user.email}: ${planTier}`);
  
  // Enviar notificación IN-APP
  await db.insert(notifications).values({
    userId: user.id,
    type: 'subscription_created',
    title: `✅ Payment Successful - Welcome to ${planTier.charAt(0).toUpperCase() + planTier.slice(1)}!`,
    message: `Your subscription has been activated. You now have access to all ${planTier} features until ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}.`,
    read: false,
    createdAt: new Date()
  }).catch(err => console.error('Error creating notification:', err));

  // Enviar a Make para email
  await sendToMake('subscription_created', {
    userEmail: user.email,
    userName: user.artistName || user.email,
    planTier: planTier,
    priceAmount: (subscription.items.data[0]?.price.unit_amount || 0) / 100,
    currency: subscription.currency,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toLocaleDateString(),
    interval: interval
  });
}

/**
 * Tanda 7 — Multi-product cart purchase.
 *
 * Reads the compact cart JSON from session.metadata.cart (or fetches from
 * Firestore via cartRef) and processes each item by synthesizing a per-item
 * "merchandise" pseudo-session that runs through handleMerchandisePurchase
 * logic (we duplicate the order/sale recording here to avoid mutating the
 * original session metadata).
 */
async function handleCartPurchase(session: Stripe.Checkout.Session) {
  const { metadata } = session;
  let cartItems: any[] = [];

  try {
    if (metadata?.cartRef) {
      const { db: firestoreDb } = await import('../firebase');
      if (firestoreDb) {
        const doc = await firestoreDb.collection('cartCheckouts').doc(metadata.cartRef).get();
        if (doc.exists) {
          const d = doc.data();
          if (Array.isArray(d?.items)) cartItems = d!.items;
        }
      }
    } else if (metadata?.cart) {
      cartItems = JSON.parse(metadata.cart);
    }
  } catch (err) {
    console.error('❌ Failed to parse cart metadata:', (err as any)?.message);
    return;
  }

  if (cartItems.length === 0) {
    console.error('❌ Cart purchase has no items');
    return;
  }

  const customerEmail = session.customer_details?.email || '';
  const customerName = session.customer_details?.name || 'Customer';
  const shippingDetails = session.shipping_details || session.customer_details;
  const address = shippingDetails?.address;

  console.log(`🛒 Processing ${cartItems.length} cart items for ${customerEmail}`);

  // Process each item independently. Errors on one item don't block others.
  for (let i = 0; i < cartItems.length; i++) {
    const item = cartItems[i];
    const itemOrderNumber = `BST-${Date.now().toString(36).toUpperCase()}-${i + 1}`;

    try {
      // Resolve artist FK
      let artistUserId: number | null = null;
      if (item.au) {
        const parsed = parseInt(String(item.au), 10);
        if (Number.isFinite(parsed) && parsed > 0) artistUserId = parsed;
      }
      if (!artistUserId && item.a) {
        try {
          const ar = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.artistName, item.a))
            .limit(1);
          if (ar[0]?.id) artistUserId = ar[0].id;
        } catch { /* ignore */ }
      }

      const isCustom = item.c === 1 || item.c === '1';
      const productType = item.pt || 'unknown';
      const size = item.sz || '';
      const artistName = item.a || 'Artist';
      const productId = item.p || '';
      const productImage = item.i || '';
      const printFileUrl = item.fi || productImage;
      const unitPrice = Number(item.pr) || 0;
      const quantity = Number(item.q) || 1;
      const lineTotal = Math.round(unitPrice * quantity * 100); // cents

      // Save Firestore order
      let firestoreOrderId = '';
      try {
        const { db: firestoreDb } = await import('../firebase');
        if (firestoreDb) {
          const { FieldValue } = await import('firebase-admin/firestore');
          const orderRef = await firestoreDb.collection('orders').add({
            orderNumber: itemOrderNumber,
            stripeSessionId: session.id,
            stripePaymentIntent: session.payment_intent,
            customerEmail,
            customerName,
            shippingAddress: address ? {
              line1: address.line1,
              line2: address.line2,
              city: address.city,
              state: address.state,
              postalCode: address.postal_code,
              country: address.country,
            } : null,
            product: {
              productId,
              productType,
              displayName: item.n || `${artistName} ${productType}`,
              size,
              price: unitPrice,
              quantity,
              productImage,
              printFileUrl,
              artistName,
              isCustom,
            },
            printful: isCustom ? null : { variantId: item.pv || null, status: 'pending' },
            status: 'paid',
            fulfillment: isCustom ? 'manual' : 'printful',
            cartSessionId: session.id,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          firestoreOrderId = orderRef.id;
        }
      } catch (err) {
        console.error(`⚠️ Item ${i + 1} Firestore save failed:`, (err as any)?.message);
      }

      // Process Printful order for AI items
      if (!isCustom && productType !== 'unknown') {
        try {
          const { buildOrderData, getProductMapping, calculateProfitSplit } = await import('../config/printful-product-map');
          const { getPrintfulService } = await import('../services/printful-service');
          const mapping = getProductMapping(productType);
          const explicitVariantId = item.pv ? parseInt(String(item.pv), 10) : 0;

          // Build order data — prefer explicit variant_id (modern catalog flow) over legacy productType→variant lookup
          let orderData: any = null;
          if (Number.isFinite(explicitVariantId) && explicitVariantId > 0) {
            const recipient = {
              name: shippingDetails?.name || customerName,
              address1: address?.line1 || '',
              city: address?.city || '',
              state_code: address?.state || '',
              country_code: address?.country || 'US',
              zip: address?.postal_code || '',
              email: customerEmail,
            };
            // Resolve real print-area geometry for proper design positioning
            let explicitPosition: any;
            if (mapping) {
              try {
                const { getRealPlacementGeometry } = await import('../services/printful-printfiles');
                const geo = await getRealPlacementGeometry(
                  mapping.printfulCatalogId, explicitVariantId,
                  mapping.printfileSpec.placement,
                  { designAspectRatio: 1, coverage: 0.85, verticalAlign: mapping.technique === 'dtg' ? 'top' : 'center' }
                );
                explicitPosition = { area_width: geo.area_width, area_height: geo.area_height, width: geo.width, height: geo.height, top: geo.top, left: geo.left };
              } catch (_) { /* fall through */ }
            }
            orderData = {
              external_id: `stripe-${session.id}-${i}`,
              shipping: 'STANDARD',
              recipient,
              items: [{
                variant_id: explicitVariantId,
                quantity,
                retail_price: String(unitPrice.toFixed(2)),
                name: item.n || `${artistName} ${productType}`,
                files: [{ url: printFileUrl, type: mapping?.printfileSpec?.placement || 'default', ...(explicitPosition ? { position: explicitPosition } : {}) }],
              }],
            };
          } else if (mapping) {
            const recipient = {
              name: shippingDetails?.name || customerName,
              address1: address?.line1 || '',
              city: address?.city || '',
              stateCode: address?.state || '',
              countryCode: address?.country || 'US',
              zip: address?.postal_code || '',
              email: customerEmail,
            };
            orderData = await buildOrderData(productType, size, artistName, productImage, recipient, `stripe-${session.id}-${i}`);
            if (orderData?.items?.[0]?.files?.[0]) orderData.items[0].files[0].url = printFileUrl;
            if (orderData?.items?.[0]) orderData.items[0].quantity = quantity;
          }

          if (orderData) {
              const printful = getPrintfulService();
              const printfulOrder = await printful.createOrder(orderData, true);
              console.log(`✅ Cart item ${i + 1} → Printful #${printfulOrder.id}`);
              if (firestoreOrderId) {
                const { db: firestoreDb } = await import('../firebase');
                if (firestoreDb) {
                  const { FieldValue } = await import('firebase-admin/firestore');
                  await firestoreDb.collection('orders').doc(firestoreOrderId).update({
                    'printful.orderId': printfulOrder.id,
                    'printful.status': printfulOrder.status,
                    status: 'in_production',
                    updatedAt: FieldValue.serverTimestamp(),
                  });
                }
              }
            }
            // Record sale — fall back to flat margins when no legacy mapping exists
            const profitSplit = mapping ? calculateProfitSplit(productType, size, true) : null;
            await recordMerchSale({
              artistUserId, productId, artistName, productType, size,
              sessionAmountTotal: lineTotal,
              customerEmail,
              stripePaymentIntentId: session.payment_intent as string,
              productionCost: profitSplit?.productionCost,
              artistEarning: profitSplit?.artistEarning,
              platformFee: profitSplit?.boostifyEarning,
              quantity,
            });
        } catch (err) {
          console.error(`❌ Cart item ${i + 1} Printful failed:`, (err as any)?.message);
        }
      } else {
        // Custom product — record sale only
        await recordMerchSale({
          artistUserId, productId, artistName, productType, size,
          sessionAmountTotal: lineTotal,
          customerEmail,
          stripePaymentIntentId: session.payment_intent as string,
          isCustomProduct: true,
          quantity,
        });
      }

      // Increment salesCount
      if (productId) {
        try {
          const { db: firestoreDb } = await import('../firebase');
          if (firestoreDb) {
            const { FieldValue } = await import('firebase-admin/firestore');
            const merchRef = firestoreDb.collection('merchandise').doc(productId);
            const doc = await merchRef.get();
            if (doc.exists) {
              await merchRef.update({
                salesCount: FieldValue.increment(quantity),
                lastSoldAt: FieldValue.serverTimestamp(),
              });
            }
          }
        } catch { /* best effort */ }
      }
    } catch (itemErr) {
      console.error(`❌ Cart item ${i + 1} top-level error:`, (itemErr as any)?.message);
    }
  }

  // Send single confirmation email summarizing the cart
  if (customerEmail && process.env.RESEND_API_KEY) {
    try {
      const totalUSD = ((session.amount_total || 0) / 100).toFixed(2);
      const itemsHtml = cartItems.map((it: any) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${it.n || 'Product'}${it.sz ? ` (${it.sz})` : ''} × ${it.q || 1}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${(Number(it.pr) * Number(it.q || 1)).toFixed(2)}</td></tr>`
      ).join('');
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Boostify Music <info@boostifymusic.com>',
          to: [customerEmail],
          subject: `🛍️ Order confirmed — ${cartItems.length} items, $${totalUSD}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2>Thank you, ${customerName}! 🎉</h2>
            <p>Your order has been received. Here's your summary:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">${itemsHtml}
              <tr><td style="padding:12px 8px;font-weight:bold;">Total</td><td style="padding:12px 8px;text-align:right;font-weight:bold;color:#f97316;">$${totalUSD}</td></tr>
            </table>
            <p>You'll receive separate shipping notifications as each item is dispatched.</p>
          </div>`,
        }),
      });
    } catch (mailErr) {
      console.error('⚠️ Cart confirmation email failed:', (mailErr as any)?.message);
    }
  }

  // Cleanup cartCheckouts doc (best effort)
  if (metadata?.cartRef) {
    try {
      const { db: firestoreDb } = await import('../firebase');
      if (firestoreDb) await firestoreDb.collection('cartCheckouts').doc(metadata.cartRef).delete();
    } catch { /* ignore */ }
  }

  console.log(`🎉 Cart purchase fully processed: session ${session.id}`);
}

/**
 * Manejar compra de mercancía → Crear orden de producción en Printful
 */
async function handleMerchandisePurchase(session: Stripe.Checkout.Session) {
  const { metadata } = session;
  const productType = metadata?.productType;
  const size = metadata?.size || '';
  const artistName = metadata?.artistName || 'Artist';
  const productImage = metadata?.productImage || '';
  const printFileUrl = metadata?.printFileUrl || productImage;
  const productId = metadata?.productId || '';
  const printfulVariantIdMeta = metadata?.printfulVariantId || '';
  const priceFromMeta = metadata?.price || '';
  const artistUserIdMeta = metadata?.artistUserId || '';
  const isCustomProduct = metadata?.isCustomProduct === '1';

  if (!productType) {
    console.error('❌ Merchandise purchase missing productType in metadata');
  }

  console.log(`🏭 Processing merchandise order: ${productType || '(unknown)'} (${size}) for ${artistName} | custom=${isCustomProduct}`);

  const orderNumber = `BST-${Date.now().toString(36).toUpperCase()}`;
  const customerEmail = session.customer_details?.email || '';
  const customerName = session.customer_details?.name || 'Customer';

  // ── ARTIST LOOKUP (multi-strategy, ROBUSTO) ───────────────────────────────
  // Tanda 4: usar artistUserId del metadata primero. Siempre intentamos resolver
  // un id antes de grabar la venta para que salesTransactions no quede huérfano.
  let artistUserId: number | null = null;
  if (artistUserIdMeta) {
    const parsed = parseInt(artistUserIdMeta, 10);
    if (Number.isFinite(parsed) && parsed > 0) artistUserId = parsed;
  }
  if (!artistUserId && artistName && artistName !== 'Artist') {
    try {
      const artistResult = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.artistName, artistName))
        .limit(1);
      if (artistResult[0]?.id) artistUserId = artistResult[0].id;
    } catch (lookupErr) {
      console.error('⚠️ Artist lookup by name failed:', (lookupErr as any)?.message);
    }
  }
  if (!artistUserId) {
    console.warn(`⚠️ Could not resolve artistUserId for "${artistName}" — sale will be recorded without artist FK`);
  }

  // Productos custom del artista: NO van a Printful — solo Firestore order + email + sale
  if (isCustomProduct) {
      console.log(`📦 Custom product purchase — skipping Printful, recording order only`);

      // Save order in Firestore /orders (custom flow)
      let firestoreOrderId = '';
      try {
        const { db: firestoreDb } = await import('../firebase');
        if (firestoreDb) {
          const { FieldValue } = await import('firebase-admin/firestore');
          const address = (session.shipping_details || session.customer_details)?.address;
          const orderRef = await firestoreDb.collection('orders').add({
            orderNumber,
            stripeSessionId: session.id,
            stripePaymentIntent: session.payment_intent,
            customerEmail,
            customerName,
            shippingAddress: address ? {
              line1: address.line1,
              line2: address.line2,
              city: address.city,
              state: address.state,
              postalCode: address.postal_code,
              country: address.country,
            } : null,
            product: {
              productId,
              productType: productType || 'custom',
              displayName: `${artistName} ${productType || 'Product'}`,
              size,
              price: priceFromMeta ? parseFloat(priceFromMeta) : 0,
              productImage,
              printFileUrl,
              artistName,
              isCustom: true,
            },
            printful: null,
            status: 'paid',
            fulfillment: 'manual',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          firestoreOrderId = orderRef.id;
          console.log(`✅ Custom-product order saved to Firestore: ${firestoreOrderId}`);
        }
      } catch (err) {
        console.error('⚠️ Firestore custom order save failed:', err);
      }

      // ALWAYS record the sale (Tanda 4)
      await recordMerchSale({
        artistUserId,
        productId,
        artistName,
        productType: productType || 'custom',
        size,
        sessionAmountTotal: session.amount_total,
        customerEmail,
        stripePaymentIntentId: session.payment_intent as string,
        isCustomProduct: true,
        quantity: 1,
      });

      // Update salesCount in Firestore for product
      if (productId) {
        try {
          const { db: firestoreDb } = await import('../firebase');
          if (firestoreDb) {
            const { FieldValue } = await import('firebase-admin/firestore');
            const merchRef = firestoreDb.collection('merchandise').doc(productId);
            const doc = await merchRef.get();
            if (doc.exists) {
              await merchRef.update({
                salesCount: FieldValue.increment(1),
                lastSoldAt: FieldValue.serverTimestamp(),
              });
            }
          }
        } catch (err) {
          console.error('⚠️ Failed to update custom product salesCount:', err);
        }
      }

      console.log(`🎉 Custom merchandise order processed: ${orderNumber}`);
      return;
    }

    // ── PRINTFUL FLOW (productos AI / catálogo) ────────────────────────────
    if (!productType) {
      console.error('❌ Cannot process Printful order without productType');
      // aún así grabamos la venta
      await recordMerchSale({
        artistUserId, productId, artistName,
        productType: 'unknown', size,
        sessionAmountTotal: session.amount_total,
        customerEmail,
        stripePaymentIntentId: session.payment_intent as string,
      });
      return;
    }

  try {
    // Import product mapping and Printful service
    const { buildOrderData, getProductMapping, calculateProfitSplit, getVariantForSize } = await import('../config/printful-product-map');
    const { getPrintfulService } = await import('../services/printful-service');

    const mapping = getProductMapping(productType);
    const explicitVariantIdNum = printfulVariantIdMeta ? parseInt(printfulVariantIdMeta, 10) : 0;
    const hasExplicitVariant = Number.isFinite(explicitVariantIdNum) && explicitVariantIdNum > 0;

    // Resolve variant from PRODUCT_MAP only when we have a mapping (legacy path)
    const resolvedVariant = mapping
      ? (printfulVariantIdMeta
          ? mapping.variants.find(v => v.variantId === parseInt(printfulVariantIdMeta, 10)) || getVariantForSize(productType, size)
          : getVariantForSize(productType, size))
      : null;

    if (!mapping && !hasExplicitVariant) {
      console.error(`❌ No Printful mapping AND no explicit variant id for product type: ${productType}`);
      return;
    }

    // Get shipping address from Stripe session
    const shippingDetails = session.shipping_details || session.customer_details;
    const address = shippingDetails?.address;

    if (!address) {
      console.warn('⚠️ No shipping address found in checkout session — order will be created as draft');
    }

    const recipient = {
      name: shippingDetails?.name || customerName,
      address1: address?.line1 || '',
      city: address?.city || '',
      stateCode: address?.state || '',
      countryCode: address?.country || 'US',
      zip: address?.postal_code || '',
      email: customerEmail,
    };

    // Build Printful order payload — prefer explicit variant id (catalog flow) over legacy productType lookup
    let orderData: any = null;
    if (hasExplicitVariant) {
      // Resolve real print-area geometry for proper design positioning
      let explicitPosition: any;
      if (mapping) {
        try {
          const { getRealPlacementGeometry } = await import('../services/printful-printfiles');
          const geo = await getRealPlacementGeometry(
            mapping.printfulCatalogId, explicitVariantIdNum,
            mapping.printfileSpec.placement,
            { designAspectRatio: 1, coverage: 0.85, verticalAlign: mapping.technique === 'dtg' ? 'top' : 'center' }
          );
          explicitPosition = { area_width: geo.area_width, area_height: geo.area_height, width: geo.width, height: geo.height, top: geo.top, left: geo.left };
        } catch (_) { /* fall through */ }
      }
      orderData = {
        external_id: `stripe-${session.id}`,
        shipping: 'STANDARD',
        recipient: {
          name: recipient.name,
          address1: recipient.address1,
          city: recipient.city,
          state_code: recipient.stateCode,
          country_code: recipient.countryCode,
          zip: recipient.zip,
          email: recipient.email,
        },
        items: [{
          variant_id: explicitVariantIdNum,
          quantity: 1,
          retail_price: priceFromMeta || (mapping ? String(mapping.retailPrice) : '0'),
          name: `${artistName} ${productType}`,
          files: [{ url: printFileUrl, type: mapping?.printfileSpec?.placement || 'default', ...(explicitPosition ? { position: explicitPosition } : {}) }],
        }],
      };
    } else {
      orderData = await buildOrderData(
        productType,
        size,
        artistName,
        printFileUrl,
        recipient,
        `stripe-${session.id}`
      );
    }

    if (!orderData) {
      console.error(`❌ Failed to build order data for: ${productType} / ${size}`);
      return;
    }

    // ── 1. Save order in Firestore /orders ──────────────────────────────────
    let firestoreOrderId = '';
    try {
      const { db: firestoreDb } = await import('../firebase');
      if (firestoreDb) {
        const { FieldValue } = await import('firebase-admin/firestore');
        const orderRef = await firestoreDb.collection('orders').add({
          orderNumber,
          stripeSessionId: session.id,
          stripePaymentIntent: session.payment_intent,
          customerEmail,
          customerName,
          shippingAddress: address ? {
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postalCode: address.postal_code,
            country: address.country,
          } : null,
          product: {
            productId,
            productType,
            displayName: `${artistName} ${mapping?.displayName || productType}`,
            size: resolvedVariant?.size || size,
            price: priceFromMeta ? parseFloat(priceFromMeta) : (mapping?.retailPrice ?? 0),
            productImage,
            printFileUrl,
            artistName,
          },
          printful: {
            variantId: resolvedVariant?.variantId || explicitVariantIdNum || null,
            status: 'pending',
          },
          status: 'paid',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        firestoreOrderId = orderRef.id;
        console.log(`✅ Firestore order saved: ${firestoreOrderId}`);
      }
    } catch (err) {
      console.error('⚠️ Firestore order save failed:', err);
    }

    // ── 2. Create Printful order (confirm=true → production starts) ─────────
    const printful = getPrintfulService();
    const printfulOrder = await printful.createOrder(orderData, true); // confirm=true

    console.log(`✅ Printful order created & confirmed: #${printfulOrder.id} (${printfulOrder.status})`);

    // Update Firestore with Printful details
    if (firestoreOrderId) {
      try {
        const { db: firestoreDb } = await import('../firebase');
        if (firestoreDb) {
          const { FieldValue } = await import('firebase-admin/firestore');
          await firestoreDb.collection('orders').doc(firestoreOrderId).update({
            'printful.orderId': printfulOrder.id,
            'printful.status': printfulOrder.status,
            status: 'in_production',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } catch { /* best effort */ }
    }

    // Calculate profit split for records — only legacy mapping has known costs; catalog uses retail-based fallback
    const profitSplit = mapping ? calculateProfitSplit(productType, size, true) : null;
    // Record the sale in the database (Tanda 4: SIEMPRE grabamos)
    await recordMerchSale({
      artistUserId,
      productId,
      artistName,
      productType,
      size,
      sessionAmountTotal: session.amount_total,
      customerEmail,
      stripePaymentIntentId: session.payment_intent as string,
      productionCost: profitSplit?.productionCost,
      artistEarning: profitSplit?.artistEarning,
      platformFee: profitSplit?.boostifyEarning,
      quantity: 1,
    });

    // Update Firestore merchandise salesCount
    if (productId) {
      try {
        const { db: firestoreDb } = await import('../firebase');
        if (firestoreDb) {
          const { FieldValue } = await import('firebase-admin/firestore');
          const merchRef = firestoreDb.collection('merchandise').doc(productId);
          const doc = await merchRef.get();
          if (doc.exists) {
            await merchRef.update({
              salesCount: FieldValue.increment(1),
              lastSoldAt: FieldValue.serverTimestamp(),
            });
          }
        }
      } catch (err) {
        console.error('⚠️ Failed to update merchandise salesCount:', err);
      }
    }

    // ── 3. Send confirmation email via Resend ───────────────────────────────
    if (customerEmail) {
      try {
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (RESEND_API_KEY) {
          const displayProductName = `${artistName} ${mapping?.displayName || productType}`;
          const retailPrice = priceFromMeta || String(mapping?.retailPrice ?? ((session.amount_total || 0) / 100));
          const emailHtml = buildOrderConfirmationHtml({
            customerName,
            orderNumber,
            productName: displayProductName,
            size: resolvedVariant?.size || size,
            price: retailPrice,
            artistName,
            productImage,
          });

          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Boostify Music <info@boostifymusic.com>',
              to: [customerEmail],
              subject: `🛍️ Order Confirmed — ${displayProductName}`,
              html: emailHtml,
            }),
          });

          if (emailRes.ok) {
            console.log(`✅ Confirmation email sent to ${customerEmail}`);
          } else {
            console.error('⚠️ Resend error:', await emailRes.text());
          }
        }
      } catch (err) {
        console.error('⚠️ Failed to send confirmation email:', err);
      }
    }

    console.log(`🎉 Merchandise order fully processed: ${orderNumber} | Printful #${printfulOrder.id}`);

  } catch (error) {
    console.error('❌ Error processing merchandise purchase:', error);
  }
}

/**
 * Tanda 4 — Helper: SIEMPRE registra la venta en salesTransactions.
 * - Si artistUserId es null, intenta resolverlo por nombre como último recurso.
 * - Si productId no es numérico (Firestore docId), lo guarda como null en merchandiseId.
 * - Errores se loguean explícitamente (no silent .catch).
 */
async function recordMerchSale(params: {
  artistUserId: number | null;
  productId: string;
  artistName: string;
  productType: string;
  size: string;
  quantity?: number;
  sessionAmountTotal: number | null;
  customerEmail: string;
  stripePaymentIntentId: string;
  productionCost?: number;
  artistEarning?: number;
  platformFee?: number;
  isCustomProduct?: boolean;
}) {
  try {
    const { salesTransactions } = await import('../db/schema');

    // Last-resort: si seguimos sin artistUserId, fallback al primer admin/owner registrado
    let resolvedArtistId = params.artistUserId;
    if (!resolvedArtistId && params.artistName && params.artistName !== 'Artist') {
      try {
        const result = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.artistName, params.artistName))
          .limit(1);
        if (result[0]?.id) resolvedArtistId = result[0].id;
      } catch (e) {
        console.error('⚠️ recordMerchSale: artist re-lookup failed:', (e as any)?.message);
      }
    }

    // merchandiseId: solo numérico (PG); si es Firestore docId, queda null
    let merchandiseId: number | null = null;
    if (params.productId) {
      const parsed = parseInt(params.productId, 10);
      if (Number.isFinite(parsed) && String(parsed) === params.productId) {
        merchandiseId = parsed;
      }
    }

    const saleAmountUsd = (params.sessionAmountTotal || 0) / 100;
    const isCustom = !!params.isCustomProduct;
    // Productos custom: el artista se queda con todo menos la comisión de plataforma (ej. 20%)
    const customCommissionRate = 20;
    const customPlatformFee = isCustom ? saleAmountUsd * (customCommissionRate / 100) : (params.platformFee ?? 0);
    const customArtistEarning = isCustom ? saleAmountUsd - customPlatformFee : (params.artistEarning ?? 0);

    if (!resolvedArtistId) {
      console.error(`❌ recordMerchSale: NO artistUserId resolved for "${params.artistName}" — sale NOT inserted (FK required)`);
      console.error(`   Stripe payment: ${params.stripePaymentIntentId} | amount: $${saleAmountUsd}`);
      return;
    }

    await db.insert(salesTransactions).values({
      artistId: resolvedArtistId,
      merchandiseId,
      productName: `${params.artistName} ${params.productType}${params.size ? ` - ${params.size}` : ''}`,
      saleAmount: String(saleAmountUsd),
      productionCost: String(isCustom ? 0 : (params.productionCost || 0)),
      artistEarning: String(customArtistEarning),
      platformFee: String(customPlatformFee),
      commissionRate: customCommissionRate,
      quantity: Math.max(1, Number(params.quantity) || 1),
      currency: 'usd',
      buyerEmail: params.customerEmail,
      stripePaymentId: params.stripePaymentIntentId,
      status: isCustom ? 'paid' : 'pending',
    });

    console.log(`✅ Sale recorded in salesTransactions: artistId=${resolvedArtistId} | $${saleAmountUsd} | custom=${isCustom}`);
  } catch (err) {
    console.error('❌ recordMerchSale FAILED:', (err as any)?.message);
    console.error('   Params:', JSON.stringify({ ...params, customerEmail: '[redacted]' }));
  }
}

/**
 * Build HTML email for order confirmation
 */
function buildOrderConfirmationHtml(params: {
  customerName: string;
  orderNumber: string;
  productName: string;
  size: string;
  price: string;
  artistName: string;
  productImage: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#0a0a0a;color:#ffffff;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-size:28px;margin:0;background:linear-gradient(135deg,#FF6B00,#FF8C38);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
        🎉 Order Confirmed!
      </h1>
      <p style="color:#888;margin-top:8px;">Thanks for supporting ${params.artistName}</p>
    </div>
    <div style="background:#1a1a1a;border-radius:16px;border:1px solid #333;overflow:hidden;margin-bottom:24px;">
      ${params.productImage ? `<img src="${params.productImage}" alt="${params.productName}" style="width:100%;height:250px;object-fit:cover;"/>` : ''}
      <div style="padding:24px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#fff;">${params.productName}</h2>
        <p style="margin:0 0 4px;color:#aaa;">Size: <strong style="color:#FF6B00;">${params.size}</strong></p>
        <p style="margin:0;color:#aaa;">Price: <strong style="color:#FF6B00;">$${params.price}</strong></p>
      </div>
    </div>
    <div style="background:#1a1a1a;border-radius:16px;border:1px solid #333;padding:24px;margin-bottom:24px;">
      <h3 style="margin:0 0 16px;color:#FF6B00;">Order Details</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#888;">Order #</td><td style="padding:8px 0;text-align:right;color:#fff;">${params.orderNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#888;">Artist</td><td style="padding:8px 0;text-align:right;color:#fff;">${params.artistName}</td></tr>
        <tr style="border-top:1px solid #333;"><td style="padding:12px 0;color:#888;font-weight:bold;">Total</td><td style="padding:12px 0;text-align:right;color:#FF6B00;font-weight:bold;font-size:18px;">$${params.price}</td></tr>
      </table>
    </div>
    <div style="background:linear-gradient(135deg,#1a2a1a,#0a0a0a);border-radius:16px;border:1px solid #2a4a2a;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;color:#4ade80;">✅ Your order is being produced!</p>
      <p style="margin:8px 0 0;color:#888;font-size:14px;">You'll receive tracking info once it ships.</p>
    </div>
    <div style="text-align:center;color:#666;font-size:12px;">
      <p>Boostify Music — Empowering Artists Worldwide</p>
      <p><a href="https://boostifymusic.com" style="color:#FF6B00;text-decoration:none;">boostifymusic.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Manejar creación de suscripción
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('🆕 Processing customer.subscription.created:', subscription.id);
  
  const priceId = subscription.items.data[0]?.price.id;
  const planTier = determinePlanTier(priceId);
  const customer = subscription.customer as string;
  
  // Buscar usuario por Stripe Customer ID
  const users_result = await db.select().from(users).where(eq(users.stripeCustomerId, customer)).limit(1);
  const user = users_result[0];
  
  if (!user) {
    console.error('❌ User not found for customer:', customer);
    return;
  }
  
  const interval = subscription.items.data[0]?.price.recurring?.interval || 'monthly';
  
  await db.insert(subscriptions).values({
    userId: user.id,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customer,
    plan: planTier,
    status: subscription.status as any,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    interval: interval as 'monthly' | 'yearly',
    price: (subscription.items.data[0]?.price.unit_amount || 0) / 100,
    currency: subscription.currency,
    isTrial: subscription.status === 'trialing'
  }).onConflictDoUpdate({
    target: subscriptions.stripeSubscriptionId,
    set: {
      status: subscription.status as any,
      updatedAt: new Date()
    }
  });
  
  console.log(`✅ Subscription created for user ${user.email}`);
  
  // 💰 Registrar ingreso por suscripción en platformRevenue
  const subscriptionAmount = (subscription.items.data[0]?.price.unit_amount || 0) / 100;
  if (subscriptionAmount > 0) {
    try {
      await db.insert(platformRevenue).values({
        revenueType: 'subscription',
        amount: subscriptionAmount.toString(),
        currency: subscription.currency.toUpperCase(),
        sourceUserId: user.id,
        metadata: {
          stripeSubscriptionId: subscription.id,
          plan: planTier,
          interval: interval,
          priceId: priceId
        }
      });
      console.log(`💰 [REVENUE] Subscription revenue recorded: $${subscriptionAmount} for plan ${planTier}`);
    } catch (revError) {
      console.error('❌ Error recording subscription revenue:', revError);
    }
  }
  
  // Enviar a Make para email
  await sendToMake('subscription_created_webhook', {
    userEmail: user.email,
    userName: user.email,
    planTier: planTier,
    priceAmount: (subscription.items.data[0]?.price.unit_amount || 0) / 100,
    currency: subscription.currency,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toLocaleDateString(),
    interval: interval
  });
}

/**
 * Manejar actualización de suscripción
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 Processing customer.subscription.updated:', subscription.id);

  if (subscription.metadata?.type === 'artist_catalog_subscription') {
    await db.update(explicitSubscriptions)
      .set({
        status: mapArtistCatalogSubscriptionStatus(subscription.status),
        currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
        currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
        cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(eq(explicitSubscriptions.stripeSubscriptionId, subscription.id));
    console.log(`✅ Artist catalog subscription updated: ${subscription.id}`);
    return;
  }
  
  const priceId = subscription.items.data[0]?.price.id;
  const planTier = determinePlanTier(priceId);
  const interval = subscription.items.data[0]?.price.recurring?.interval || 'monthly';
  
  await db.update(subscriptions)
    .set({
      plan: planTier,
      status: subscription.status as any,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      interval: interval as 'monthly' | 'yearly',
      price: (subscription.items.data[0]?.price.unit_amount || 0) / 100,
      isTrial: subscription.status === 'trialing',
      updatedAt: new Date()
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  
  console.log(`✅ Subscription updated: ${subscription.id}`);
  
  // Enviar notificación si es cambio de plan
  const oldSub = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subscription.id)).limit(1);
  if (oldSub.length > 0 && oldSub[0].plan !== planTier) {
    const user_result = await db.select().from(users).where(eq(users.id, oldSub[0].userId)).limit(1);
    if (user_result.length > 0) {
      await db.insert(notifications).values({
        userId: oldSub[0].userId,
        type: 'plan_changed',
        title: `🚀 Plan Updated to ${planTier.charAt(0).toUpperCase() + planTier.slice(1)}!`,
        message: `Your subscription plan has been upgraded. Enjoy all your new features!`,
        read: false,
        createdAt: new Date()
      }).catch(err => console.error('Error creating notification:', err));

      // Enviar a Make para email
      await sendToMake('plan_changed', {
        userEmail: user_result[0].email,
        userName: user_result[0].artistName || user_result[0].email,
        oldPlan: oldSub[0].plan,
        newPlan: planTier,
        priceAmount: (subscription.items.data[0]?.price.unit_amount || 0) / 100,
        currency: subscription.currency
      });
    }
  }
}

/**
 * Manejar cancelación de suscripción
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('❌ Processing customer.subscription.deleted:', subscription.id);

  if (subscription.metadata?.type === 'artist_catalog_subscription') {
    await db.update(explicitSubscriptions)
      .set({
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      })
      .where(eq(explicitSubscriptions.stripeSubscriptionId, subscription.id));
    console.log(`✅ Artist catalog subscription canceled: ${subscription.id}`);
    return;
  }
  
  await db.update(subscriptions)
    .set({
      status: 'canceled',
      cancelAtPeriodEnd: true,
      updatedAt: new Date()
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  
  console.log(`✅ Subscription canceled: ${subscription.id}`);
}

/**
 * Manejar pago exitoso
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('💰 Processing invoice.payment_succeeded:', invoice.id);
  
  if (!invoice.subscription) {
    console.log('⚠️ Invoice without subscription');
    return;
  }

  // Monthly artist catalog subscription invoice.
  const artistCatalogSub = await db
    .select({ id: explicitSubscriptions.id })
    .from(explicitSubscriptions)
    .where(eq(explicitSubscriptions.stripeSubscriptionId, invoice.subscription as string))
    .limit(1);
  if (artistCatalogSub.length > 0) {
    await db.update(explicitSubscriptions)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(explicitSubscriptions.stripeSubscriptionId, invoice.subscription as string));
    console.log(`✅ Artist catalog monthly payment succeeded: ${invoice.subscription}`);
    return;
  }
  
  // Actualizar última fecha de pago
  await db.update(subscriptions)
    .set({
      status: 'active',
      updatedAt: new Date()
    })
    .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string));
  
  console.log(`✅ Payment succeeded for subscription: ${invoice.subscription}`);
  
  // 💰 Registrar ingreso por pago de suscripción (renovaciones)
  const paymentAmount = (invoice.amount_paid || 0) / 100;
  if (paymentAmount > 0) {
    // Obtener la suscripción para el userId
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string)).limit(1);
    if (subs.length > 0) {
      try {
        await db.insert(platformRevenue).values({
          revenueType: 'subscription',
          amount: paymentAmount.toString(),
          currency: invoice.currency.toUpperCase(),
          sourceUserId: subs[0].userId,
          metadata: {
            stripeSubscriptionId: invoice.subscription,
            invoiceId: invoice.id,
            plan: subs[0].plan,
            interval: subs[0].interval,
            isRenewal: true
          }
        });
        console.log(`💰 [REVENUE] Subscription renewal recorded: $${paymentAmount}`);
      } catch (revError) {
        console.error('❌ Error recording subscription revenue:', revError);
      }
    }
  }
  
  // Enviar notificación de pago exitoso
  const subs_notification = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string)).limit(1);
  if (subs_notification.length > 0) {
    await db.insert(notifications).values({
      userId: subs_notification[0].userId,
      type: 'payment_succeeded',
      title: '💰 Payment Received',
      message: `Thank you! Your payment of $${(invoice.amount_paid || 0) / 100} has been processed successfully.`,
      read: false,
      createdAt: new Date()
    }).catch(err => console.error('Error creating notification:', err));

    // Enviar a Make para email
    const user_result = await db.select().from(users).where(eq(users.id, subs_notification[0].userId)).limit(1);
    if (user_result.length > 0) {
      await sendToMake('payment_succeeded', {
        userEmail: user_result[0].email,
        userName: user_result[0].artistName || user_result[0].email,
        amount: (invoice.amount_paid || 0) / 100,
        currency: invoice.currency,
        invoiceId: invoice.id,
        paidDate: new Date(invoice.created * 1000).toLocaleDateString()
      });
    }
  }
}

/**
 * Manejar pago fallido
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('⚠️ Processing invoice.payment_failed:', invoice.id);
  
  if (!invoice.subscription) {
    console.log('⚠️ Invoice without subscription');
    return;
  }

  // Monthly artist catalog subscription invoice.
  const artistCatalogSub = await db
    .select({ id: explicitSubscriptions.id })
    .from(explicitSubscriptions)
    .where(eq(explicitSubscriptions.stripeSubscriptionId, invoice.subscription as string))
    .limit(1);
  if (artistCatalogSub.length > 0) {
    await db.update(explicitSubscriptions)
      .set({ status: 'past_due', updatedAt: new Date() })
      .where(eq(explicitSubscriptions.stripeSubscriptionId, invoice.subscription as string));
    console.log(`⚠️ Artist catalog monthly payment failed: ${invoice.subscription}`);
    return;
  }
  
  // Marcar como past_due
  await db.update(subscriptions)
    .set({
      status: 'past_due',
      updatedAt: new Date()
    })
    .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string));
  
  console.log(`⚠️ Payment failed for subscription: ${invoice.subscription}`);
  
  // Enviar notificación de pago fallido
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string)).limit(1);
  if (subs.length > 0) {
    await db.insert(notifications).values({
      userId: subs[0].userId,
      type: 'payment_failed',
      title: '❌ Payment Failed',
      message: 'Your recent payment could not be processed. Please update your payment method to keep your subscription active.',
      read: false,
      createdAt: new Date()
    }).catch(err => console.error('Error creating notification:', err));

    // Enviar a Make para email
    const user_result = await db.select().from(users).where(eq(users.id, subs[0].userId)).limit(1);
    if (user_result.length > 0) {
      await sendToMake('payment_failed', {
        userEmail: user_result[0].email,
        userName: user_result[0].artistName || user_result[0].email,
        amount: (invoice.amount_due || 0) / 100,
        currency: invoice.currency,
        failedDate: new Date(invoice.created * 1000).toLocaleDateString()
      });
    }
  }
}

/**
 * Determinar tier del plan basado en Price ID
 * Usa constantes centralizadas de shared/constants.ts
 */
function determinePlanTier(priceId: string): 'free' | 'creator' | 'professional' | 'enterprise' {
  const plan = PRICE_ID_TO_PLAN[priceId];
  if (plan === 'creator' || plan === 'professional' || plan === 'enterprise') {
    return plan;
  }
  return 'free';
}

/**
 * TEST ENDPOINTS - Sin firma requerida
 * Usa estos para simular webhooks SIN pagar
 */

// Test: Simular pago exitoso
router.post('/test/simulate-payment-success', async (req: Request, res: Response) => {
  try {
    console.log('🧪 TEST: Simulando pago exitoso...');
    
    // Obtener usuario existente o usar el primero disponible
    let userId = 1;
    try {
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
      }
    } catch (e) {
      console.log('📝 No user found, using userId 1 for test');
    }
    
    // Crear notificación de prueba
    const result = await db.insert(notifications).values({
      userId: userId,
      type: 'PAYMENT_SUCCESS',
      title: '✅ TEST: Pago Exitoso',
      message: 'Este es un evento de prueba - No es un pago real',
      metadata: {
        amount: 99.99,
        currency: 'USD',
        tier: 'professional',
        eventType: 'PAYMENT_SUCCESS'
      },
      read: false,
      createdAt: new Date()
    }).catch(err => {
      console.error('❌ Error creating test notification:', err);
      throw err;
    });

    // Enviar a Make para email
    await sendToMake('PAYMENT_SUCCESS', {
      userEmail: 'test@boostify.dev',
      userName: 'Test User',
      amount: 99.99,
      currency: 'USD',
      tier: 'professional',
      isTest: true
    });

    return res.json({
      success: true,
      message: '✅ Pago de prueba simulado correctamente',
      info: 'Revisa tu DB en notifications y Check Make webhook'
    });
  } catch (error) {
    console.error('❌ Test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error en simulación'
    });
  }
});

// Test: Simular nueva suscripción
router.post('/test/simulate-subscription', async (req: Request, res: Response) => {
  try {
    console.log('🧪 TEST: Simulando nueva suscripción...');
    
    // Obtener usuario existente
    let userId = 1;
    try {
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
      }
    } catch (e) {
      console.log('📝 No user found, using userId 1 for test');
    }
    
    const result = await db.insert(notifications).values({
      userId: userId,
      type: 'SUBSCRIPTION_CREATED',
      title: '✅ TEST: Suscripción Creada',
      message: 'Este es un evento de prueba - No es una suscripción real',
      metadata: {
        amount: 59.99,
        currency: 'USD',
        tier: 'creator',
        eventType: 'SUBSCRIPTION_CREATED'
      },
      read: false,
      createdAt: new Date()
    }).catch(err => {
      console.error('❌ Error creating test notification:', err);
      throw err;
    });

    await sendToMake('SUBSCRIPTION_CREATED', {
      userEmail: 'test@boostify.dev',
      userName: 'Test User',
      planTier: 'creator',
      amount: 59.99,
      isTest: true
    });

    return res.json({
      success: true,
      message: '✅ Suscripción de prueba simulada correctamente',
      info: 'Revisa tu DB en notifications y Check Make webhook'
    });
  } catch (error) {
    console.error('❌ Test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error en simulación'
    });
  }
});

// Test: Simular pago fallido
router.post('/test/simulate-payment-failed', async (req: Request, res: Response) => {
  try {
    console.log('🧪 TEST: Simulando pago fallido...');
    
    // Obtener usuario existente
    let userId = 1;
    try {
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
      }
    } catch (e) {
      console.log('📝 No user found, using userId 1 for test');
    }
    
    const result = await db.insert(notifications).values({
      userId: userId,
      type: 'PAYMENT_FAILED',
      title: '❌ TEST: Pago Fallido',
      message: 'Este es un evento de prueba - No es un pago fallido real',
      metadata: {
        amount: 99.99,
        currency: 'USD',
        tier: 'professional',
        eventType: 'PAYMENT_FAILED'
      },
      read: false,
      createdAt: new Date()
    }).catch(err => {
      console.error('❌ Error creating test notification:', err);
      throw err;
    });

    await sendToMake('PAYMENT_FAILED', {
      userEmail: 'test@boostify.dev',
      userName: 'Test User',
      amount: 99.99,
      failedDate: new Date().toLocaleDateString(),
      isTest: true
    });

    return res.json({
      success: true,
      message: '✅ Pago fallido de prueba simulado correctamente',
      info: 'Revisa tu DB en notifications y Check Make webhook'
    });
  } catch (error) {
    console.error('❌ Test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error en simulación'
    });
  }
});

/**
 * Concert Command Center — fulfil a paid ticket order.
 * Delegates to the concerts route's exported helper (idempotent).
 */
async function handleConcertTicketPurchase(session: Stripe.Checkout.Session): Promise<void> {
  try {
    const { fulfilConcertOrder } = await import('./concerts');
    await fulfilConcertOrder(session.id, true);
  } catch (err) {
    console.error('❌ handleConcertTicketPurchase failed:', (err as any)?.message);
  }
}

/**
 * Concert Command Center — void ticket passes after a refund or chargeback.
 * Resolves the originating Checkout Session from the charge's PaymentIntent,
 * then marks the order refunded and voids its passes (anti-fraud: a refunded
 * ticket can never be scanned again). Safe to call for non-concert charges
 * (it simply finds no concert order and returns).
 */
async function handleConcertRefundOrDispute(
  paymentIntent: string | Stripe.PaymentIntent | null | undefined,
): Promise<void> {
  try {
    const piId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id;
    if (!piId) return;
    const sessions = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 });
    const session = sessions.data[0];
    if (!session) return;
    if (session.metadata?.type !== 'concert_ticket') return; // not a concert order — ignore
    const { voidConcertOrderBySession } = await import('./concerts');
    await voidConcertOrderBySession(session.id);
  } catch (err) {
    console.error('❌ handleConcertRefundOrDispute failed:', (err as any)?.message);
  }
}

export default router;
