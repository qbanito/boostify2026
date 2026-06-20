import { Router } from 'express';
import { db } from '../db';
import { fiverr_services, pending_orders } from '../../shared/fiverr-services-schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
});

const router = Router();

// GET services by category
router.get('/api/services', async (req, res) => {
  try {
    const { category } = req.query;
    
    const query = db
      .select()
      .from(fiverr_services)
      .where(eq(fiverr_services.isActive, true));

    if (category) {
      const services = await query.where(eq(fiverr_services.category, category as string));
      res.json(services);
    } else {
      const services = await query;
      res.json(services);
    }
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// POST create order (requires auth - all users can order)
router.post('/api/services/order', authenticate, async (req, res) => {
  try {
    const { serviceId, quantity, category, serviceName, price } = req.body;
    const userId = req.user?.id || req.user?.uid;

    if (!userId || !serviceId || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Services are available to ALL users (free, basic, pro, premium)
    // They are charged separately via Stripe
    // Service data comes from frontend (fiverr-services-data.ts)
    
    const totalPrice = (price || 0) * quantity;
    const webhookToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create pending order in database
    try {
      await db.insert(pending_orders).values({
        userId: String(userId),
        serviceId: parseInt(String(serviceId)),
        quantity,
        boostifyPrice: totalPrice.toString(),
        status: 'pending',
        webhook_token: webhookToken,
      });
    } catch (dbError) {
      console.error('Database insert error (non-blocking):', dbError);
      // Continue even if DB insert fails - the order will be tracked via Stripe
    }

    // Send order to Make.com webhook
    const webhookUrl = 'https://hook.us2.make.com/mwh176gi62elcbxxinq3jb7x8w9wf8op';
    const orderData = {
      orderId: `order_${Date.now()}`,
      userId: String(userId),
      serviceId: String(serviceId),
      serviceName: serviceName || 'Service',
      serviceCategory: category,
      quantity,
      totalPrice,
      pricePerUnit: price || 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      webhookToken,
    };

    // Send to webhook asynchronously (don't block response)
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    }).catch(error => {
      console.error('Error sending to Make.com webhook:', error);
    });

    res.json({
      success: true,
      orderId: orderData.orderId,
      message: 'Order created successfully',
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET orders for user
router.get('/api/services/orders', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const orders = await db
      .select()
      .from(pending_orders)
      .where(eq(pending_orders.userId, userId));

    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// POST create Stripe checkout session
// Public endpoint: works for both authenticated users and guests.
// If a session/cookie is present, we attach customer_email + userId metadata.
router.post('/api/services/checkout-session', async (req, res) => {
  try {
    const { serviceId, quantity, serviceName, price, category } = req.body;
    const user = (req as any).user || (req as any).session?.user;

    if (!serviceId || !quantity || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!process.env.STRIPE_SECRET_KEY && !process.env.TESTING_STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured', details: 'STRIPE_SECRET_KEY missing on server' });
    }

    const baseUrl = process.env.PRODUCTION_URL || 'https://boostifymusic.com';
    const cat = String(category || '').toLowerCase();
    let returnPath = '/youtube-views';
    if (cat.includes('spotify')) returnPath = '/spotify';
    else if (cat.includes('instagram') || cat.includes('ig_')) returnPath = '/instagram-boost';

    // Create Stripe checkout session with dynamic pricing
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: serviceName || 'Boostify Service',
              description: `Service ID: ${serviceId}`,
            },
            unit_amount: Math.round(Number(price) * 100), // Convert to cents
          },
          quantity: Number(quantity) || 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}${returnPath}?session_id={CHECKOUT_SESSION_ID}&payment=success`,
      cancel_url: `${baseUrl}${returnPath}?payment=cancelled`,
      customer_email: user?.email || undefined,
      allow_promotion_codes: true,
      metadata: {
        serviceId: String(serviceId),
        userId: String(user?.id || user?.uid || 'guest'),
        serviceName: String(serviceName || ''),
        price: String(price),
        category: String(category || ''),
      },
    });

    console.log('Stripe service-checkout session created:', session.id, 'guest:', !user);
    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST webhook from Fiverr (would be called by Fiverr when order completes)
router.post('/api/webhooks/fiverr', async (req, res) => {
  try {
    const { webhook_token, status, fiverr_order_id } = req.body;

    // Validate webhook token
    const order = await db
      .select()
      .from(pending_orders)
      .where(eq(pending_orders.webhook_token, webhook_token))
      .limit(1);

    if (!order || order.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update order status
    await db
      .update(pending_orders)
      .set({
        status,
        fiverr_order_id,
        completedAt: new Date(),
      })
      .where(eq(pending_orders.webhook_token, webhook_token));

    res.json({ success: true, message: 'Order updated' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export const setupFiverServicesRoutes = (app: any) => {
  app.use(router);
};
