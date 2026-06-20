/**
 * Artist Domain Manager Routes
 *
 * GET  /api/artist-domain/:artistId              — list domains
 * POST /api/artist-domain/check-availability     — check domain availability
 * GET  /api/artist-domain/catalog                — domain pricing catalog
 * POST /api/artist-domain/:artistId/purchase     — purchase a domain
 * GET  /api/artist-domain/:artistId/:domain/dns  — get DNS records
 * PUT  /api/artist-domain/:artistId/:domain/dns  — update DNS records
 * DELETE /api/artist-domain/:artistId/:domain/dns — delete DNS record
 * PUT  /api/artist-domain/:artistId/:domain/privacy   — toggle privacy
 * PUT  /api/artist-domain/:artistId/:domain/lock      — toggle lock
 * POST /api/artist-domain/:artistId/:domain/forwarding — set forwarding
 * DELETE /api/artist-domain/:artistId/:domain/forwarding — remove forwarding
 */

import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/clerk-auth';
import { db as pgDb } from '../../db';
import { users, artistDomains } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import * as registry from '../services/domain-registry';

const router = Router();

// ─── Helper: verify ownership ─────────────────────────────────────────────────

async function verifyOwnership(
  artistId: number,
  clerkUserId: string
): Promise<{ allowed: boolean; pgUserId?: number; error?: string }> {
  const callerRows = await pgDb
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!callerRows.length) return { allowed: false, error: 'User not found' };
  const { id: pgUserId, email } = callerRows[0];

  const { isAdminEmail } = await import('../../shared/constants');
  if (isAdminEmail(email ?? '')) return { allowed: true, pgUserId };

  const artistRows = await pgDb
    .select({ id: users.id, generatedBy: users.generatedBy })
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);

  if (!artistRows.length) return { allowed: false, error: 'Artist not found' };
  const artist = artistRows[0];
  const isOwner = artist.id === pgUserId || artist.generatedBy === pgUserId;
  return { allowed: isOwner, pgUserId, error: isOwner ? undefined : 'Not authorized' };
}

// ─── GET /catalog — domain pricing ───────────────────────────────────────────

router.get('/catalog', isAuthenticated, async (_req: Request, res: Response) => {
  try {
    const catalog = await registry.getDomainCatalog();
    return res.json({ success: true, catalog });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /check-availability ─────────────────────────────────────────────────

router.post('/check-availability', isAuthenticated, async (req: Request, res: Response) => {
  const { name, tlds } = req.body as { name?: string; tlds?: string[] };
  if (!name || typeof name !== 'string' || name.length < 2) {
    return res.status(400).json({ success: false, error: 'Invalid domain name' });
  }
  // sanitize: allow only alphanumeric and hyphens
  const cleanName = name.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63);
  if (!cleanName) return res.status(400).json({ success: false, error: 'Invalid domain name' });

  try {
    const results = await registry.checkDomainAvailability(
      cleanName,
      Array.isArray(tlds) ? tlds.slice(0, 6) : ['com', 'net', 'org', 'io', 'music', 'band']
    );
    return res.json({ success: true, results });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /:artistId — list domains ────────────────────────────────────────────

router.get('/:artistId', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  if (isNaN(artistId)) return res.status(400).json({ success: false, error: 'Invalid artistId' });

  const clerkUserId = (req as any).userId ?? (req as any).auth?.userId;
  const { allowed, error } = await verifyOwnership(artistId, clerkUserId);
  if (!allowed) return res.status(403).json({ success: false, error });

  const domains = await pgDb
    .select()
    .from(artistDomains)
    .where(eq(artistDomains.artistId, artistId));

  return res.json({ success: true, domains });
});

// ─── POST /:artistId/purchase ─────────────────────────────────────────────────

router.post('/:artistId/purchase', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  if (isNaN(artistId)) return res.status(400).json({ success: false, error: 'Invalid artistId' });

  const clerkUserId = (req as any).userId ?? (req as any).auth?.userId;
  const { allowed, error } = await verifyOwnership(artistId, clerkUserId);
  if (!allowed) return res.status(403).json({ success: false, error });

  const { domain, itemId, pricePerYear, currency } = req.body as {
    domain?: string;
    itemId?: string;
    pricePerYear?: number;
    currency?: string;
  };

  if (!domain || !itemId) {
    return res.status(400).json({ success: false, error: 'domain and itemId are required' });
  }

  // Check if already registered
  const existing = await pgDb
    .select({ id: artistDomains.id })
    .from(artistDomains)
    .where(eq(artistDomains.domain, domain))
    .limit(1);

  if (existing.length) {
    return res.status(409).json({ success: false, error: 'Domain already registered in this platform' });
  }

  // Create pending record first
  const [newDomain] = await pgDb
    .insert(artistDomains)
    .values({
      artistId,
      domain,
      status: 'pending',
      pricePerYear: pricePerYear ?? 0,
      currency: currency ?? 'USD',
      purchasedAt: new Date(),
    })
    .returning();

  // Attempt purchase async (respond immediately)
  setImmediate(async () => {
    try {
      const result = await registry.purchaseDomain(domain, itemId);
      if (result.success) {
        await pgDb.update(artistDomains).set({
          status: 'active',
          hostingerSubscriptionId: result.subscriptionId ?? null,
          updatedAt: new Date(),
        }).where(eq(artistDomains.id, newDomain.id));

        // Auto-enable privacy by default
        await registry.setPrivacyProtection(domain, true);
      } else {
        await pgDb.update(artistDomains).set({
          status: 'failed',
          updatedAt: new Date(),
        }).where(eq(artistDomains.id, newDomain.id));
      }
    } catch (err: any) {
      console.error('[ArtistDomain] Purchase background error:', err.message);
      await pgDb.update(artistDomains).set({ status: 'failed', updatedAt: new Date() })
        .where(eq(artistDomains.id, newDomain.id));
    }
  });

  return res.status(202).json({
    success: true,
    message: 'Domain registration started',
    domain: newDomain,
  });
});

// ─── GET /:artistId/:domain/dns ───────────────────────────────────────────────

router.get('/:artistId/:domain/dns', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const { domain } = req.params;
  if (isNaN(artistId)) return res.status(400).json({ success: false, error: 'Invalid artistId' });

  const clerkUserId = (req as any).userId ?? (req as any).auth?.userId;
  const { allowed, error } = await verifyOwnership(artistId, clerkUserId);
  if (!allowed) return res.status(403).json({ success: false, error });

  const records = await registry.getDNSRecords(domain);
  return res.json({ success: true, records });
});

// ─── PUT /:artistId/:domain/dns ───────────────────────────────────────────────

router.put('/:artistId/:domain/dns', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const { domain } = req.params;
  if (isNaN(artistId)) return res.status(400).json({ success: false, error: 'Invalid artistId' });

  const clerkUserId = (req as any).userId ?? (req as any).auth?.userId;
  const { allowed, error } = await verifyOwnership(artistId, clerkUserId);
  if (!allowed) return res.status(403).json({ success: false, error });

  const { zone, overwrite } = req.body;
  if (!Array.isArray(zone)) return res.status(400).json({ success: false, error: 'zone must be an array' });

  const ok = await registry.updateDNSRecords(domain, zone, overwrite ?? false);
  return res.json({ success: ok });
});

// ─── DELETE /:artistId/:domain/dns ───────────────────────────────────────────

router.delete('/:artistId/:domain/dns', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const { domain } = req.params;

  const clerkUserId = (req as any).userId ?? (req as any).auth?.userId;
  const { allowed, error } = await verifyOwnership(artistId, clerkUserId);
  if (!allowed) return res.status(403).json({ success: false, error });

  const { name, type } = req.body;
  if (!name || !type) return res.status(400).json({ success: false, error: 'name and type required' });

  const ok = await registry.deleteDNSRecord(domain, name, type);
  return res.json({ success: ok });
});

// ─── PUT /:artistId/:domain/privacy ───────────────────────────────────────────

router.put('/:artistId/:domain/privacy', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const { domain } = req.params;

  const clerkUserId = (req as any).userId ?? (req as any).auth?.userId;
  const { allowed, error } = await verifyOwnership(artistId, clerkUserId);
  if (!allowed) return res.status(403).json({ success: false, error });

  const { enabled } = req.body as { enabled: boolean };
  const ok = await registry.setPrivacyProtection(domain, enabled);

  if (ok) {
    await pgDb.update(artistDomains)
      .set({ privacyEnabled: enabled, updatedAt: new Date() })
      .where(and(eq(artistDomains.artistId, artistId), eq(artistDomains.domain, domain)));
  }

  return res.json({ success: ok });
});

// ─── PUT /:artistId/:domain/lock ─────────────────────────────────────────────

router.put('/:artistId/:domain/lock', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const { domain } = req.params;

  const clerkUserId = (req as any).userId ?? (req as any).auth?.userId;
  const { allowed, error } = await verifyOwnership(artistId, clerkUserId);
  if (!allowed) return res.status(403).json({ success: false, error });

  const { locked } = req.body as { locked: boolean };
  const ok = await registry.setDomainLock(domain, locked);

  if (ok) {
    await pgDb.update(artistDomains)
      .set({ domainLocked: locked, updatedAt: new Date() })
      .where(and(eq(artistDomains.artistId, artistId), eq(artistDomains.domain, domain)));
  }

  return res.json({ success: ok });
});

// ─── POST /:artistId/:domain/forwarding ──────────────────────────────────────

router.post('/:artistId/:domain/forwarding', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const { domain } = req.params;

  const clerkUserId = (req as any).userId ?? (req as any).auth?.userId;
  const { allowed, error } = await verifyOwnership(artistId, clerkUserId);
  if (!allowed) return res.status(403).json({ success: false, error });

  const { url, type } = req.body as { url?: string; type?: '301' | '302' };
  if (!url) return res.status(400).json({ success: false, error: 'url is required' });

  // Validate URL to prevent open redirect abuse
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return res.status(400).json({ success: false, error: 'Only http/https URLs allowed' });
    }
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid URL' });
  }

  const ok = await registry.setForwarding(domain, url, type ?? '301');

  if (ok) {
    await pgDb.update(artistDomains)
      .set({ forwardingUrl: url, forwardingType: type ?? '301', updatedAt: new Date() })
      .where(and(eq(artistDomains.artistId, artistId), eq(artistDomains.domain, domain)));
  }

  return res.json({ success: ok });
});

// ─── DELETE /:artistId/:domain/forwarding ────────────────────────────────────

router.delete('/:artistId/:domain/forwarding', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.artistId, 10);
  const { domain } = req.params;

  const clerkUserId = (req as any).userId ?? (req as any).auth?.userId;
  const { allowed, error } = await verifyOwnership(artistId, clerkUserId);
  if (!allowed) return res.status(403).json({ success: false, error });

  const ok = await registry.deleteForwarding(domain);

  if (ok) {
    await pgDb.update(artistDomains)
      .set({ forwardingUrl: null, updatedAt: new Date() })
      .where(and(eq(artistDomains.artistId, artistId), eq(artistDomains.domain, domain)));
  }

  return res.json({ success: ok });
});

export default router;
