import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/clerk-auth';
import { auth } from '../firebase';

const router = Router();

/**
 * Genera un Custom Token de Firebase para el usuario autenticado con Replit Auth
 * Esto permite que el cliente se autentique en Firebase usando el ID de usuario de Replit
 */
router.get('/api/firebase-token', isAuthenticated, async (req: Request, res: Response) => {
  try {
    console.log('🔑 [Firebase Token] Endpoint called');
    
    if (!auth) {
      console.error('❌ [Firebase Token] Firebase Admin not initialized');
      return res.status(500).json({
        success: false,
        error: 'Firebase Admin not initialized'
      });
    }

    const user = (req as any).user;
    console.log('👤 [Firebase Token] User data:', { id: user?.id, email: user?.email, firstName: user?.firstName });
    
    if (!user || !user.id) {
      console.error('❌ [Firebase Token] User not authenticated or missing ID');
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Usar el ID de PostgreSQL/Clerk como UID de Firebase
    let firebaseUid = String(user.id);
    console.log('🔐 [Firebase Token] Creating token for UID:', firebaseUid);

    // Crear o reutilizar el usuario en Firebase Auth
    try {
      await auth.getUser(firebaseUid);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        try {
          // Crear nuevo usuario en Firebase Auth
          await auth.createUser({
            uid: firebaseUid,
            email: user.email || `user${user.id}@boostify.app`,
            displayName: user.username || user.name || `User ${user.id}`,
          });
          console.log(`✅ Created Firebase user for user ${user.id}`);
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-exists' && user.email) {
            // El email ya pertenece a otro UID de Firebase: reutilizarlo
            console.warn(`⚠️ [Firebase Token] Email ${user.email} already exists in Firebase, reusing existing UID`);
            const existing = await auth.getUserByEmail(user.email);
            firebaseUid = existing.uid;
            console.log(`🔁 [Firebase Token] Reusing existing Firebase UID: ${firebaseUid}`);
          } else {
            throw createErr;
          }
        }
      } else {
        throw error;
      }
    }

    // Generar Custom Token
    const customToken = await auth.createCustomToken(firebaseUid, {
      email: user.email,
      username: user.firstName || user.lastName || 'User',
      replitId: user.id
    });

    console.log('✅ [Firebase Token] Token generated successfully for UID:', firebaseUid);
    
    res.json({
      success: true,
      token: customToken,
      uid: firebaseUid
    });

  } catch (error: any) {
    console.error('❌ [Firebase Token] Error generating Firebase token:', error);
    console.error('❌ [Firebase Token] Error code:', error.code);
    console.error('❌ [Firebase Token] Error message:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate Firebase token',
      details: error.message
    });
  }
});

export default router;
