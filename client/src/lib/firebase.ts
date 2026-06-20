import { logger } from "./logger";
/**
 * Firebase lib adapter - Redirects to main Firebase configuration
 * This adapter ensures we don't initialize Firebase multiple times
 */
import { getIdToken } from 'firebase/auth';
import { app, db, auth, storage } from '../firebase';

/**
 * Gets the current user's authentication token
 * @returns A promise that resolves to the current user's ID token, or null if not authenticated
 */
export async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  try {
    return await getIdToken(user);
  } catch (error) {
    logger.error('Error getting auth token:', error);
    return null;
  }
}

export { db, auth, storage };
export default app;