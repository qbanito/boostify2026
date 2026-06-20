/**
 * API Routes para Suscripciones y Roles de Usuario
 * Conecta el subscription-context con PostgreSQL
 */

import { Router } from 'express';
import { db } from '../db';
import { subscriptions, userRoles } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/subscription/user/:userId
 * Obtener suscripción activa de un usuario
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      // Devolver null en lugar de error para usuarios sin ID válido
      return res.json(null);
    }
    
    // Buscar suscripción activa o en trial
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    
    if (!subscription || subscription.length === 0) {
      // Usuario en plan free - devolver null (no es un error)
      return res.json(null);
    }
    
    return res.json(subscription[0]);
  } catch (error) {
    console.warn('Error fetching subscription (non-critical):', error);
    // Devolver null en lugar de error para no romper la app
    return res.json(null);
  }
});

/**
 * GET /api/user/role/:userId
 * Obtener rol y permisos de un usuario
 */
router.get('/role/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Buscar rol del usuario
    const role = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .limit(1);
    
    if (!role || role.length === 0) {
      // Usuario no tiene rol asignado, retornar rol por defecto
      return res.json({
        userId,
        role: 'user',
        permissions: [],
        grantedAt: new Date()
      });
    }
    
    return res.json(role[0]);
  } catch (error) {
    console.error('Error fetching user role:', error);
    return res.status(500).json({ error: 'Failed to fetch user role' });
  }
});

/**
 * POST /api/subscription/create-trial
 * Crear suscripción trial (usado por bundles)
 */
router.post('/create-trial', async (req, res) => {
  try {
    const { userId, plan, durationDays, grantedByBundle } = req.body;
    
    if (!userId || !plan) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + (durationDays || 30) * 24 * 60 * 60 * 1000);
    
    // Crear suscripción trial
    const newSubscription = await db
      .insert(subscriptions)
      .values({
        userId: parseInt(userId),
        plan,
        status: 'trialing',
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        cancelAtPeriodEnd: false,
        interval: 'monthly',
        isTrial: true,
        trialEndsAt,
        grantedByBundle,
      })
      .returning();
    
    return res.json({
      success: true,
      subscription: newSubscription[0]
    });
  } catch (error) {
    console.error('Error creating trial subscription:', error);
    return res.status(500).json({ error: 'Failed to create trial subscription' });
  }
});

export default router;
