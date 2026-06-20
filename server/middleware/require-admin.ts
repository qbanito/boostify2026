/**
 * Shared admin middleware — verifies Clerk session email is in ADMIN_EMAILS.
 * Returns 401 if unauthenticated, 403 if not an admin.
 *
 * Mount as: `router.use(requireAdmin)` or `app.use('/api/admin/x', requireAdmin, xRouter)`.
 */

import { Request, Response, NextFunction } from 'express';
import { isAdminEmail } from '../../shared/constants';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // Dev-only header bypass: in non-production, allow `x-admin-email` header
    // when paired with ALLOW_DEV_ADMIN_HEADER=1. This enables local QA via curl
    // without a Clerk session. NEVER trust this in production.
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_DEV_ADMIN_HEADER === '1'
    ) {
      const devEmail = (req.header('x-admin-email') || '').toLowerCase();
      if (devEmail && isAdminEmail(devEmail)) {
        (req as any).adminEmail = devEmail;
        return next();
      }
    }

    const userEmail =
      (req as any).auth?.sessionClaims?.email ||
      (req as any).user?.email ||
      (req as any).auth?.email;

    if (!userEmail) {
      return res.status(401).json({
        ok: false,
        error: 'Authentication required',
      });
    }

    if (!isAdminEmail(userEmail)) {
      return res.status(403).json({
        ok: false,
        error: 'Admin access required',
      });
    }

    (req as any).adminEmail = userEmail;
    next();
  } catch (err) {
    console.error('[requireAdmin] error:', err);
    res.status(500).json({ ok: false, error: 'Authentication error' });
  }
}
