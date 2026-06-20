import { logger } from "./logger";
/**
 * Firebase Auth with Replit Auth Integration
 * 
 * Este módulo permite que usuarios autenticados con Replit Auth
 * también se autentiquen en Firebase para usar Firestore y Storage
 * manteniendo las reglas de seguridad actuales.
 */

import { auth } from '../firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { apiRequest } from './queryClient';

let authInitialized = false;

/**
 * Autentica al usuario en Firebase usando su sesión de Clerk Auth
 * Esto genera un Custom Token en el servidor y lo usa para autenticar en Firebase
 */
export async function authenticateWithFirebase(): Promise<boolean> {
  try {
    // Si ya está autenticado en Firebase, no hacer nada
    if (auth.currentUser && authInitialized) {
      return true;
    }

    // apiRequest auto-attaches the Clerk Bearer token + cookies
    let data: any;
    try {
      data = await apiRequest('/api/firebase-token', { method: 'GET' });
    } catch (e: any) {
      logger.error('Failed to get Firebase token:', e?.message || e);
      return false;
    }

    if (!data || !data.success || !data.token) {
      logger.error('Invalid token response:', data);
      return false;
    }

    // Autenticar en Firebase con el Custom Token
    await signInWithCustomToken(auth, data.token);
    authInitialized = true;

    logger.info('✅ Authenticated with Firebase using Clerk Auth');
    return true;

  } catch (error) {
    logger.error('Error authenticating with Firebase:', error);
    return false;
  }
}

/**
 * Hook para usar en componentes que requieren autenticación de Firebase
 * Llama a esta función cuando el componente se monte
 * Retorna true si la autenticación fue exitosa, false en caso contrario
 */
export async function ensureFirebaseAuth(): Promise<boolean> {
  if (authInitialized && auth.currentUser) {
    logger.info('✅ Firebase ya autenticado');
    return true;
  }

  const success = await authenticateWithFirebase();
  
  if (!success) {
    logger.error('❌ Firebase authentication failed - some features may not work');
  }
  
  return success;
}
