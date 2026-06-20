import { auth } from "../firebase";
import { logger } from "./logger";

/**
 * Implements exponential backoff for retrying network requests
 * @param fn Function to retry
 * @param retries Number of retries
 * @param delay Initial delay in ms
 * @returns Promise with the result of the function
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 300
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    
    // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return withRetry(fn, retries - 1, delay * 2);
  }
}

/**
 * Retrieves the current Firebase authentication token with retry capability
 * @returns Promise with the token string or null if not authenticated
 */
export async function getAuthToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    return null;
  }
  
  try {
    return await withRetry(async () => {
      const token = await currentUser.getIdToken(true);
      return token;
    });
  } catch (error) {
    logger.error("Error getting auth token:", error);
    return null;
  }
}