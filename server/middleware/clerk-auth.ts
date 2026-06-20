import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { clerkClient, getAuth, requireAuth as clerkRequireAuth } from '@clerk/express';
import { isAdminEmail } from '../../shared/constants';
import { db } from '../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

export interface ClerkAuthUser {
  clerkUserId: string;
  id: string | number; // integer pgUserId when resolved, Clerk string as fallback
  email?: string;
}

/**
 * Middleware that attaches Clerk user info to req.user if present.
 * Does NOT block unauthenticated requests (use isAuthenticated for that).
 */
export async function clerkAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Use req.auth() as a function (new API in @clerk/express v1.x)
    const authData = typeof (req as any).auth === 'function' ? (req as any).auth() : getAuth(req);
    
    if (!authData || !authData.userId) {
      // No auth – continue without user
      return next();
    }

    const userId = authData.userId;
    let email: string | undefined = undefined;
    try {
      const user = await clerkClient.users.getUser(userId);
      email = user?.emailAddresses?.[0]?.emailAddress;
    } catch (_) {}

    // Resolve Clerk userId string → integer Postgres user id so routes that
    // use req.user.id in integer DB columns work correctly.
    let pgId: string | number = userId;
    try {
      const [dbUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1);
      if (dbUser) pgId = dbUser.id;
    } catch (_) {
      // DB unavailable — fall back to Clerk string
    }

    // Attach user info to request (id = integer pgUserId, uid = Clerk string)
    (req as any).user = { clerkUserId: userId, id: pgId, uid: userId, email } as ClerkAuthUser;
    return next();
  } catch (err) {
    console.error('Clerk auth middleware error:', err);
    return next();
  }
}

/**
 * Guard middleware: rejects request with 401 if no valid Clerk user.
 * Use after clerkAuthMiddleware or standalone.
 */
export const isAuthenticated: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  // Use req.auth() as a function (new API in @clerk/express v1.x)
  const authData = typeof (req as any).auth === 'function' ? (req as any).auth() : getAuth(req);
  
  if (!authData || !authData.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Ensure req.user is set (without DB lookup — guard only)
  if (!(req as any).user) {
    (req as any).user = { clerkUserId: authData.userId, id: authData.userId, uid: authData.userId } as ClerkAuthUser;
  }
  
  return next();
};

/**
 * Alias for isAuthenticated (drop-in replacement for old replitAuth export).
 */
export const requireAuth = isAuthenticated;

/**
 * Helper to get current user id from request (returns clerkUserId).
 */
export function getUserId(req: Request): string | null {
  const user = (req as any).user as ClerkAuthUser | undefined;
  return user?.clerkUserId ?? null;
}

/**
 * Check if the current user is an admin (by email).
 */
export function isAdmin(req: Request): boolean {
  const user = (req as any).user as ClerkAuthUser | undefined;
  return isAdminEmail(user?.email);
}
