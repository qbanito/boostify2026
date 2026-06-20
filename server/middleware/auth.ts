import { Request, Response, NextFunction } from 'express';
import { auth } from '../firebase';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getAuth as getClerkAuth, clerkClient, verifyToken as verifyClerkToken } from '@clerk/express';
import { isAdminEmail } from '../../shared/constants';
import { db } from '../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Decode a JWT payload WITHOUT verifying its signature.
 * Used only to route a bearer token to the correct verifier (Firebase vs Clerk);
 * the token is always cryptographically verified afterwards by the chosen path.
 */
function peekJwtPayload(token: string): Record<string, any> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * A Clerk-issued JWT has no Firebase `aud` claim (issuer is the Clerk frontend API
 * and the subject is a `user_…` id). Firebase ID tokens, in contrast, carry
 * `aud === <firebaseProjectId>` and `iss === https://securetoken.google.com/<projectId>`.
 */
function looksLikeClerkToken(payload: Record<string, any> | null): boolean {
  if (!payload) return false;
  const iss = typeof payload.iss === 'string' ? payload.iss : '';
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (iss.includes('clerk')) return true;
  if (sub.startsWith('user_')) return true;
  // No Firebase audience and not a securetoken issuer → not a Firebase ID token.
  if (!payload.aud && !iss.includes('securetoken.google.com')) return true;
  return false;
}

/**
 * Niveles de suscripción disponibles, ordenados por jerarquía
 * - free: Acceso básico sin pago
 * - basic: Plan básico ($59.99/mes)
 * - pro: Plan profesional ($99.99/mes)
 * - premium: Plan premium ($149.99/mes)
 */
export type SubscriptionPlan = 'free' | 'basic' | 'pro' | 'premium';

/**
 * Jerarquía de niveles de suscripción para comparaciones de acceso
 * Un nivel mayor incluye todos los permisos de los niveles inferiores
 */
export const SUBSCRIPTION_LEVELS: Record<SubscriptionPlan, number> = {
  'free': 0,
  'basic': 1,
  'pro': 2,
  'premium': 3
};

// Subscription interface
export interface Subscription {
  plan: SubscriptionPlan;
  active: boolean;
  customerId?: string;
  subscriptionId?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

// Interface for the authenticated user
export interface AuthUser {
  uid?: string;   // Para autenticación Firebase
  id?: string;    // Para autenticación de sesión
  email?: string | null;
  role?: string;
  isAdmin?: boolean;
  subscription?: Subscription;
}

// Explicitly define the user interface to match our AuthUser
declare global {
  namespace Express {
    // This ensures our user property has the correct shape
    interface User extends AuthUser {}
  }
}

/**
 * Middleware to authenticate users using Firebase Authentication
 * Verifies the token from the Authorization header and attaches user data to the request
 * @param req Express request
 * @param res Express response
 * @param next Next function
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // PRIORITY 0: Check Clerk authentication first (new system)
    try {
      const clerkAuth = getClerkAuth(req);
      if (clerkAuth && clerkAuth.userId) {
        // Resolve email to determine admin privileges.
        // First try sessionClaims (fast, no network), then fall back to Clerk API.
        let email: string | null =
          (clerkAuth as any).sessionClaims?.email ||
          (clerkAuth as any).sessionClaims?.primary_email ||
          null;

        if (!email) {
          try {
            const clerkUser = await clerkClient.users.getUser(clerkAuth.userId);
            email = clerkUser?.emailAddresses?.[0]?.emailAddress || null;
          } catch (lookupErr) {
            console.warn('[auth] Clerk user lookup failed:', (lookupErr as Error).message);
          }
        }

        const isAdmin = isAdminEmail(email);
        console.log(
          `✅ User authenticated via Clerk: ${clerkAuth.userId} (email=${email || 'unknown'}, admin=${isAdmin})`,
        );

        // Resolve Clerk userId string → integer Postgres user id.
        // Many routes use req.user.id in integer DB columns so we must
        // store the numeric PG id, not the Clerk string.
        let pgUserId: number | string = clerkAuth.userId;
        try {
          const [dbUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.clerkId, clerkAuth.userId))
            .limit(1);
          if (dbUser) pgUserId = dbUser.id;
        } catch (dbErr) {
          // DB unavailable — fall back to Clerk string; integer queries will fail
          console.warn('[auth] Could not resolve Clerk userId to integer pgUserId:', (dbErr as Error).message);
        }

        req.user = {
          id: pgUserId as any,
          uid: clerkAuth.userId,
          email,
          role: isAdmin ? 'admin' : 'artist',
          isAdmin,
          subscription: isAdmin ? { plan: 'premium', active: true } : undefined,
        };
        return next();
      }
    } catch (clerkError) {
      // Clerk not configured or no token, continue with other methods
    }
    
    // PRIORITY 1: Check Replit Auth via passport (req.user)
    if (req.user && (req.user as any).id) {
      console.log('✅ User authenticated via Replit Auth (passport):', {
        id: (req.user as any).id,
        replitId: (req.user as any).replitId,
        email: (req.user as any).email
      });
      return next();
    }
    
    // PRIORITY 2: Check if user is already authenticated via session
    if (req.session && req.session.user) {
      console.log('✅ User authenticated via session:', {
        id: req.session.user.id,
        replitId: req.session.user.replitId,
        email: req.session.user.email
      });
      req.user = req.session.user;
      return next();
    }
    
    // PRIORITY 3: Check for authenticated session via isAuthenticated (Replit Auth)
    if (req.isAuthenticated && req.isAuthenticated()) {
      console.log('✅ User authenticated via req.isAuthenticated()');
      return next();
    }
    
    console.log('⚠️ No Replit Auth user found, checking Firebase token...');
    
    // Check Firebase token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      // Handle both "Bearer token" and plain token formats
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;
      
      try {
        // Si Firebase Admin no está disponible, decodificar el token JWT manualmente
        if (!auth) {
          console.log('⚠️ Firebase Admin no disponible, decodificando token JWT sin verificación del servidor');
          
          // Decodificar el token JWT (sin verificar la firma - confiamos en la verificación del cliente)
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            Buffer.from(base64, 'base64')
              .toString('utf-8')
              .split('')
              .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          
          const decodedToken = JSON.parse(jsonPayload);
          console.log('Token decoded (client-side verification only) for UID:', decodedToken.user_id || decodedToken.uid);
          
          const uid = decodedToken.user_id || decodedToken.uid;
          const email = decodedToken.email;
          
          // Check if user is the admin
          const isAdmin = isAdminEmail(email);
          
          // Sin Firestore del servidor, no podemos obtener subscription info
          // El cliente debe manejar esto desde Stripe directamente
          let subscriptionInfo: Subscription | undefined = undefined;
          
          // Admin gets premium subscription by default
          if (isAdmin) {
            subscriptionInfo = {
              plan: 'premium',
              active: true
            };
          }
          
          const user: AuthUser = {
            uid: uid,
            id: uid,  // También incluir id para compatibilidad
            email: email || null,
            role: isAdmin ? 'admin' : 'artist',
            isAdmin: isAdmin,
            subscription: subscriptionInfo
          };
          
          req.user = user;
          
          // Store in session for future requests
          if (req.session) {
            req.session.user = user;
          }
          
          return next();
        }
        
        // Si Firebase Admin está disponible, usar verificación normal
        console.log('Verifying Firebase token with Firebase Admin...');

        // A Clerk session JWT may arrive as a Bearer header (clients call
        // Clerk's getToken()). It has no Firebase `aud` claim, so passing it to
        // verifyIdToken throws "incorrect aud … got undefined". Detect it and
        // verify it with Clerk instead.
        const peeked = peekJwtPayload(token);
        if (looksLikeClerkToken(peeked)) {
          try {
            const verified = await verifyClerkToken(token, {
              secretKey: process.env.CLERK_SECRET_KEY,
              // Tolerate clock drift between this server and Clerk so a session
              // token that just expired (Clerk tokens live ~60s) isn't rejected
              // outright. 60s is generous without accepting genuinely stale tokens.
              clockSkewInMs: 60_000,
            });
            const clerkUserId = verified.sub;

            let email: string | null =
              (verified as any).email || (verified as any).primary_email || null;
            if (!email) {
              try {
                const clerkUser = await clerkClient.users.getUser(clerkUserId);
                email = clerkUser?.emailAddresses?.[0]?.emailAddress || null;
              } catch (lookupErr) {
                console.warn('[auth] Clerk bearer user lookup failed:', (lookupErr as Error).message);
              }
            }

            let pgUserId: number | string = clerkUserId;
            try {
              const [dbUser] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.clerkId, clerkUserId))
                .limit(1);
              if (dbUser) pgUserId = dbUser.id;
            } catch (dbErr) {
              console.warn('[auth] Could not resolve Clerk userId to pgUserId:', (dbErr as Error).message);
            }

            const isAdminClerk = isAdminEmail(email);
            const clerkUser: AuthUser = {
              id: pgUserId as any,
              uid: clerkUserId,
              email,
              role: isAdminClerk ? 'admin' : 'artist',
              isAdmin: isAdminClerk,
              subscription: isAdminClerk ? { plan: 'premium', active: true } : undefined,
            };
            req.user = clerkUser;
            if (req.session) req.session.user = clerkUser;
            console.log('✅ User authenticated via Clerk bearer token:', clerkUserId);
            return next();
          } catch (clerkVerifyErr) {
            console.error('Failed to verify Clerk bearer token:', (clerkVerifyErr as Error).message);
            return res.status(401).json({
              success: false,
              message: 'Invalid authentication token',
              error: (clerkVerifyErr as Error).message,
            });
          }
        }

        const decodedToken: DecodedIdToken = await auth.verifyIdToken(token);
        console.log('Token verified successfully for UID:', decodedToken.uid);
        
        // Check if user is the admin
        const isAdmin = isAdminEmail(decodedToken.email) || decodedToken.admin === true;
        
        // Get subscription info from Firestore
        let subscriptionInfo: Subscription | undefined = undefined;
        
        try {
          // Import here to avoid circular dependency
          const { getDocById } = await import('../utils/firestore-helpers');
          
          // Get user document from Firestore
          const userDoc = await getDocById('users', decodedToken.uid);
          
          // Extract subscription information if available
          if (userDoc && userDoc.subscription) {
            subscriptionInfo = {
              plan: userDoc.subscription.plan || 'free',
              active: userDoc.subscription.active === true,
              customerId: userDoc.subscription.customerId,
              subscriptionId: userDoc.subscription.subscriptionId,
              currentPeriodEnd: userDoc.subscription.currentPeriodEnd,
              cancelAtPeriodEnd: userDoc.subscription.cancelAtPeriodEnd
            };
          }
        } catch (err) {
          console.error('Error fetching subscription data:', err);
          // Continue without subscription data
        }
        
        // Admin gets premium subscription by default
        if (isAdmin && !subscriptionInfo) {
          subscriptionInfo = {
            plan: 'premium',
            active: true
          };
        }
        
        const user: AuthUser = {
          uid: decodedToken.uid,
          id: decodedToken.uid,  // También incluir id para compatibilidad
          email: decodedToken.email || null,
          role: isAdmin ? 'admin' : (decodedToken.role || 'artist'),
          isAdmin: isAdmin,
          subscription: subscriptionInfo
        };
        
        req.user = user;
        
        // Also store in session for future requests
        if (req.session) {
          req.session.user = user;
        }
        
        return next();
      } catch (error) {
        console.error('Failed to verify Firebase token:', error);
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid authentication token', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } else {
      console.error('No authorization header found in request');
    }
    
    // Neither session nor token authentication worked
    return res.status(401).json({ success: false, message: 'User not authenticated' });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error during authentication',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Middleware para verificar que el usuario tenga al menos un nivel de suscripción específico
 * Protege rutas para que solo sean accesibles con la suscripción adecuada o superior
 * 
 * @param requiredPlan Nivel mínimo de suscripción requerido ('basic', 'pro', 'premium')
 * @returns Middleware de Express
 */
export function requireSubscription(requiredPlan: SubscriptionPlan) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Si no hay usuario autenticado, responder con error 401
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // El administrador siempre tiene acceso completo
    if (req.user.isAdmin || isAdminEmail(req.user.email)) {
      return next();
    }

    // Verificar si el usuario tiene una suscripción activa
    const userSubscription = req.user.subscription;
    if (!userSubscription || !userSubscription.active) {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required',
        requiredPlan: requiredPlan
      });
    }

    // Obtener niveles numéricos para comparación
    const userLevel = SUBSCRIPTION_LEVELS[userSubscription.plan as SubscriptionPlan];
    const requiredLevel = SUBSCRIPTION_LEVELS[requiredPlan];

    // Verificar si el nivel de suscripción del usuario es suficiente
    if (userLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        message: `Subscription level ${requiredPlan} or higher required`,
        currentPlan: userSubscription.plan,
        requiredPlan: requiredPlan
      });
    }

    // Usuario tiene el nivel requerido, continuar
    return next();
  };
}