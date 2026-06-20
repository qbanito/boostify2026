import { auth } from './firebase';
import { type Express, type Request, type Response, type NextFunction } from "express";
import cookieSession from 'cookie-session';
import passport from 'passport';
import { clerkClient, verifyToken as verifyClerkToken } from '@clerk/express';

// Define User interface para resolver problemas de tipado
interface User {
  uid: string;
  id: string;
  email?: string | null;
  role: string;
}

/**
 * Decode a JWT payload without verifying the signature — used only to route a
 * bearer token to the correct verifier (Firebase vs Clerk). The token is always
 * cryptographically verified afterwards by the chosen path.
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

/** A Clerk JWT has no Firebase `aud` claim (issuer is Clerk, subject is `user_…`). */
function looksLikeClerkToken(payload: Record<string, any> | null): boolean {
  if (!payload) return false;
  const iss = typeof payload.iss === 'string' ? payload.iss : '';
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (iss.includes('clerk')) return true;
  if (sub.startsWith('user_')) return true;
  if (!payload.aud && !iss.includes('securetoken.google.com')) return true;
  return false;
}

// Middleware to check if the request is authenticated
async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  // First check if user is authenticated through session
  if (req.isAuthenticated()) {
    return next();
  }

  // If no session, check for Firebase token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    // Si Firebase Admin no está disponible, decodificar el token JWT sin verificación del servidor
    if (!auth) {
      console.log('⚠️ Firebase Admin no disponible en auth.ts, decodificando token JWT');
      
      // Decodificar el token JWT (sin verificar la firma)
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
      const uid = decodedToken.user_id || decodedToken.uid;
      const email = decodedToken.email || null;
      
      req.user = {
        id: uid,
        uid: uid,
        email: email,
        role: 'artist'
      };
      return next();
    }
    
    // Si Firebase Admin está disponible, usar verificación normal
    // A Clerk session JWT may arrive as a Bearer header (clients call Clerk's
    // getToken()); it has no Firebase `aud` claim and would make verifyIdToken
    // throw "incorrect aud … got undefined". Detect and verify it via Clerk.
    const peeked = peekJwtPayload(token);
    if (looksLikeClerkToken(peeked)) {
      const verified = await verifyClerkToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        // Tolerate clock drift between this server and Clerk so a session token
        // that just expired (Clerk tokens live ~60s) isn't rejected outright.
        clockSkewInMs: 60_000,
      });
      const clerkUserId = verified.sub;
      let email: string | null = (verified as any).email || null;
      if (!email) {
        try {
          const clerkUser = await clerkClient.users.getUser(clerkUserId);
          email = clerkUser?.emailAddresses?.[0]?.emailAddress || null;
        } catch { /* ignore lookup failure */ }
      }
      req.user = { id: clerkUserId, uid: clerkUserId, email, role: 'artist' };
      return next();
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      id: decodedToken.uid,
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      role: 'artist'
    };
    next();
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

export function setupAuth(app: Express) {
  // Use cookie-session for stateless session storage compatible with Cloud Run
  // All session data is stored in encrypted cookies, no server-side storage needed
  // Optimized for cross-platform compatibility (iOS Safari, Chrome, etc.)
  const isProduction = process.env.NODE_ENV === 'production';
  
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || process.env.REPL_ID || 'fallback-secret-key'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: isProduction, // Solo HTTPS en producción
    httpOnly: true,
    sameSite: 'lax', // 'lax' es más compatible con iOS que 'strict'
    // Agregar configuración adicional para mejor compatibilidad
    signed: true,
    overwrite: true,
    path: '/'
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // Apply authentication middleware to all /api routes except webhook and chat completions
  app.use('/api', (req, res, next) => {
    console.log('DEBUG - Middleware Auth - Path:', req.path);
    // Lista de rutas públicas que no requieren autenticación
    // Nota: req.path no incluye '/api' porque eso está en el app.use('/api')
    const publicRoutes = [
      '/stripe-webhook',
      '/webhook',
      '/chat/completions',    // Ruta de chat para permitir el acceso sin autenticación
      '/task/status',         // Ruta para verificar el estado de tareas asíncronas
      '/video/generate',      // Ruta para generar videos
      '/video/status',        // Ruta para verificar el estado de videos
      '/stripe/publishable-key', // Ruta pública para obtener la clave publicable de Stripe
      '/stripe/activate-subscription', // Ruta para activar suscripción después del pago
      '/subscription-plans',  // Ruta pública para obtener información sobre planes de suscripción
      '/stripe/create-product-payment', // Ruta pública para crear sesiones de pago de productos
      '/stripe/create-tool-checkout', // Ruta pública para checkout de herramientas individuales (à la carte)
      '/stripe/test-guest-checkout', // Ruta de prueba para verificar la integración de compras sin autenticación
      '/affiliate/register',  // Ruta para registrarse como afiliado (temporal para desarrollo)
      '/affiliate/me',        // Ruta para obtener información del afiliado (temporal para desarrollo)
      '/gemini-image/generate-batch-with-multiple-faces', // Ruta para generar imágenes con Gemini
      '/early-access/signup', // Ruta pública para registro de acceso temprano
      '/artist-profile/create-checkout-session', // Ruta pública para checkout de productos de artistas (guest checkout)
      '/investors/stats',     // Ruta pública para estadísticas de inversores
    ];
    
    // Patrones de rutas públicas que se verifican con startsWith
    const publicRoutePatterns = [
      '/stripe/product-purchase-status', // Rutas para verificar estado de compra de productos (sin / al final)
      '/musicians',                      // Rutas de músicos (GET, POST, PATCH, DELETE)
      '/profile/',                       // Rutas de perfiles de artistas (GET /api/profile/:slug es público)
    ];
    
    // Añadir soporte para coincidencia parcial de rutas públicas
    // Verificar si la ruta actual está en la lista de rutas públicas
    // o comienza con alguna de las rutas públicas parciales definidas
    console.log('DEBUG - Ruta solicitada:', req.path, 'Está en publicRoutes:', publicRoutes.includes(req.path));
    // Verificar si la ruta está en la lista de rutas públicas exactas
    // o si comienza con alguno de los patrones de rutas públicas
    const isPublicExactRoute = publicRoutes.includes(req.path);
    const isPublicPatternRoute = publicRoutePatterns.some(pattern => req.path.startsWith(pattern));
    const isProxyRoute = req.path.startsWith('/proxy/');
    
    if (isPublicExactRoute || isPublicPatternRoute || isProxyRoute) {
      console.log('Ruta pública accedida sin autenticación:', req.path);
      return next();
    }
    
    return isAuthenticated(req, res, next);
  });

  // Serialize user for the session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const userRecord = await auth.getUser(id);
      done(null, { id: userRecord.uid, uid: userRecord.uid, role: 'artist' });
    } catch (error) {
      // Gracefully handle Firebase Admin errors — don't crash the request
      // Public routes should still work even if session deserialization fails
      done(null, false);
    }
  });
}