// ============================================================================
// LEGAL / DMCA / COPYRIGHT SYSTEM ROUTES
// Mounted at /api/legal
//   Public:   POST /dmca                  (file an infringement notice)
//             POST /counter-notice        (counter-notification)
//             GET  /verify/:uuid          (look up a fingerprint by UUID)
//   Auth:     POST /consent               (record mandatory upload consent)
//             GET  /my/claims             (artist's own claims + strike score)
//             GET  /my/verification       (artist verification status)
//             POST /verification/request  (request a verification level)
//   Admin:    GET  /admin/queue           (takedown queue + filters)
//             GET  /admin/case/:id        (full case dossier)
//             POST /admin/case/:id/action (disable / reinstate / resolve / reject / assign)
//             GET  /admin/verifications   (verification review queue)
//             POST /admin/verification/:id (approve/reject + set level)
//             GET  /admin/audit           (audit log export)
// ============================================================================
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import {
  dmcaTakedowns,
  dmcaCounterNotices,
  uploadConsents,
  fileFingerprints,
  artistStrikes,
  artistVerifications,
  legalAuditLog,
  users,
} from '../../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { legalAudit } from '../services/file-fingerprint';

const router = Router();

const STRIKE_SUSPEND_THRESHOLD = 3;

function clientIp(req: Request): string {
  const fwd = (req.headers['x-forwarded-for'] as string) || '';
  return (fwd.split(',')[0] || '').trim() || req.ip || req.socket?.remoteAddress || 'unknown';
}
function clientUa(req: Request): string {
  return (req.headers['user-agent'] as string) || 'unknown';
}

// Recompute and persist a user's claim/strike aggregates.
async function recomputeStrikes(userId: number) {
  const claims = await db
    .select({ status: dmcaTakedowns.status })
    .from(dmcaTakedowns)
    .where(eq(dmcaTakedowns.targetUserId, userId));

  const total = claims.length;
  const resolved = claims.filter((c) => c.status === 'resolved' || c.status === 'reinstated' || c.status === 'rejected').length;
  const pending = claims.filter((c) => ['received', 'under_review', 'content_disabled', 'counter_received'].includes(c.status as string)).length;
  // A strike = a takedown that ended with content disabled/resolved against the user
  const strikeCount = claims.filter((c) => c.status === 'content_disabled' || c.status === 'resolved').length;

  const counters = await db
    .select({ id: dmcaCounterNotices.id })
    .from(dmcaCounterNotices)
    .where(eq(dmcaCounterNotices.userId, userId));

  const suspended = strikeCount >= STRIKE_SUSPEND_THRESHOLD;

  const existing = await db.select().from(artistStrikes).where(eq(artistStrikes.userId, userId)).limit(1);
  const values = {
    userId,
    strikeCount,
    totalClaims: total,
    counterClaims: counters.length,
    resolvedClaims: resolved,
    pendingClaims: pending,
    suspended,
    suspendedAt: suspended ? new Date() : null,
    lastStrikeAt: strikeCount > 0 ? new Date() : null,
    updatedAt: new Date(),
  };
  if (existing.length) {
    await db.update(artistStrikes).set(values).where(eq(artistStrikes.userId, userId));
  } else {
    await db.insert(artistStrikes).values(values);
  }
  return values;
}

// ---------------------------------------------------------------------------
// PUBLIC: File a DMCA takedown notice (17 U.S.C. §512(c)(3))
// ---------------------------------------------------------------------------
router.post('/dmca', async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    const required = ['claimantName', 'claimantEmail', 'workDescription', 'infringementDescription', 'authorizedSignature'];
    for (const f of required) {
      if (!b[f] || String(b[f]).trim() === '') {
        return res.status(400).json({ success: false, error: `Campo obligatorio faltante: ${f}` });
      }
    }
    if (!b.goodFaithStatement || !b.accuracyStatement) {
      return res.status(400).json({ success: false, error: 'Debe aceptar las declaraciones juradas de buena fe y exactitud.' });
    }

    // Resolve target user from URL/fingerprint if provided
    let targetUserId: number | null = b.targetUserId ? Number(b.targetUserId) : null;
    let fingerprintId: number | null = b.fingerprintId ? Number(b.fingerprintId) : null;
    if (!targetUserId && fingerprintId) {
      const fp = await db.select().from(fileFingerprints).where(eq(fileFingerprints.id, fingerprintId)).limit(1);
      if (fp.length) targetUserId = fp[0].ownerId ?? null;
    }

    const [row] = await db
      .insert(dmcaTakedowns)
      .values({
        claimantName: String(b.claimantName).trim(),
        claimantEmail: String(b.claimantEmail).trim(),
        claimantOrg: b.claimantOrg || null,
        claimantAddress: b.claimantAddress || null,
        claimantPhone: b.claimantPhone || null,
        targetUserId,
        targetUrl: b.targetUrl || null,
        fingerprintId,
        workDescription: String(b.workDescription).trim(),
        infringementDescription: String(b.infringementDescription).trim(),
        goodFaithStatement: !!b.goodFaithStatement,
        accuracyStatement: !!b.accuracyStatement,
        authorizedSignature: String(b.authorizedSignature).trim(),
        evidenceUrls: Array.isArray(b.evidenceUrls) ? b.evidenceUrls : [],
        status: 'received',
        submitterIp: clientIp(req),
        userAgent: clientUa(req),
      })
      .returning();

    await legalAudit({
      actorEmail: row.claimantEmail,
      action: 'takedown.received',
      entityType: 'dmca',
      entityId: row.id,
      detail: { caseUuid: row.uuid, targetUserId, targetUrl: row.targetUrl },
      ip: clientIp(req),
      userAgent: clientUa(req),
    });

    if (targetUserId) await recomputeStrikes(targetUserId);

    return res.json({
      success: true,
      caseNumber: row.uuid,
      id: row.id,
      message: 'Su notificación DMCA ha sido recibida y registrada. Recibirá una respuesta del equipo legal.',
    });
  } catch (err) {
    console.error('[legal] dmca submit error:', err);
    return res.status(500).json({ success: false, error: 'No se pudo registrar la notificación.' });
  }
});

// ---------------------------------------------------------------------------
// PUBLIC: Counter-notification (17 U.S.C. §512(g))
// ---------------------------------------------------------------------------
router.post('/counter-notice', async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    const required = ['takedownId', 'fullName', 'email', 'address', 'explanation', 'signature'];
    for (const f of required) {
      if (!b[f] || String(b[f]).trim() === '') {
        return res.status(400).json({ success: false, error: `Campo obligatorio faltante: ${f}` });
      }
    }
    if (!b.statementUnderPenalty || !b.consentToJurisdiction) {
      return res.status(400).json({ success: false, error: 'Debe aceptar la declaración bajo pena de perjurio y el consentimiento de jurisdicción.' });
    }

    const tk = await db.select().from(dmcaTakedowns).where(eq(dmcaTakedowns.id, Number(b.takedownId))).limit(1);
    if (!tk.length) return res.status(404).json({ success: false, error: 'Caso DMCA no encontrado.' });

    const [row] = await db
      .insert(dmcaCounterNotices)
      .values({
        takedownId: Number(b.takedownId),
        userId: tk[0].targetUserId ?? null,
        fullName: String(b.fullName).trim(),
        email: String(b.email).trim(),
        address: String(b.address).trim(),
        phone: b.phone || null,
        statementUnderPenalty: !!b.statementUnderPenalty,
        consentToJurisdiction: !!b.consentToJurisdiction,
        explanation: String(b.explanation).trim(),
        signature: String(b.signature).trim(),
        status: 'received',
        submitterIp: clientIp(req),
        userAgent: clientUa(req),
      })
      .returning();

    await db.update(dmcaTakedowns).set({ status: 'counter_received', updatedAt: new Date() }).where(eq(dmcaTakedowns.id, Number(b.takedownId)));

    await legalAudit({
      actorEmail: row.email,
      action: 'counter.received',
      entityType: 'counter',
      entityId: row.id,
      detail: { takedownId: row.takedownId, counterUuid: row.uuid },
      ip: clientIp(req),
      userAgent: clientUa(req),
    });

    if (tk[0].targetUserId) await recomputeStrikes(tk[0].targetUserId);

    return res.json({ success: true, id: row.id, caseNumber: row.uuid, message: 'Contranotificación recibida. Será reenviada al reclamante.' });
  } catch (err) {
    console.error('[legal] counter-notice error:', err);
    return res.status(500).json({ success: false, error: 'No se pudo registrar la contranotificación.' });
  }
});

// ---------------------------------------------------------------------------
// PUBLIC: Look up a fingerprint by its UUID (proof-of-record)
// ---------------------------------------------------------------------------
router.get('/verify/:uuid', async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(fileFingerprints).where(eq(fileFingerprints.uuid, req.params.uuid)).limit(1);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Huella no encontrada.' });
    const fp = rows[0];
    return res.json({
      success: true,
      fingerprint: {
        uuid: fp.uuid,
        fileName: fp.fileName,
        fileType: fp.fileType,
        sizeBytes: fp.sizeBytes,
        sha256: fp.sha256,
        md5: fp.md5,
        status: fp.status,
        scanStatus: fp.scanStatus,
        createdAt: fp.createdAt,
      },
    });
  } catch (err) {
    console.error('[legal] verify error:', err);
    return res.status(500).json({ success: false, error: 'Error al verificar.' });
  }
});

// ---------------------------------------------------------------------------
// AUTH: Record mandatory upload consent (returns consentId to attach to upload)
// ---------------------------------------------------------------------------
router.post('/consent', authenticate, async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    const ownsRights = !!b.ownsRights;
    const noFalseDeclaration = !!b.noFalseDeclaration;
    const authorizesStorageDistribution = !!b.authorizesStorageDistribution;
    const acceptsDmcaTos = !!b.acceptsDmcaTos;
    if (!ownsRights || !noFalseDeclaration || !authorizesStorageDistribution || !acceptsDmcaTos) {
      return res.status(400).json({ success: false, error: 'Debe aceptar las cuatro declaraciones obligatorias para continuar.' });
    }
    const userId = Number(req.user!.id);
    const [row] = await db
      .insert(uploadConsents)
      .values({
        userId: Number.isFinite(userId) ? userId : null,
        userEmail: req.user!.email || null,
        ownsRights,
        noFalseDeclaration,
        authorizesStorageDistribution,
        acceptsDmcaTos,
        contentType: b.contentType || null,
        contextRef: b.contextRef || null,
        consentIp: clientIp(req),
        userAgent: clientUa(req),
        consentVersion: b.consentVersion || '1.0',
      })
      .returning();

    await legalAudit({
      actorId: Number.isFinite(userId) ? userId : null,
      actorEmail: req.user!.email || null,
      action: 'consent.recorded',
      entityType: 'consent',
      entityId: row.id,
      detail: { contentType: row.contentType },
      ip: clientIp(req),
      userAgent: clientUa(req),
    });

    return res.json({ success: true, consentId: row.id });
  } catch (err) {
    console.error('[legal] consent error:', err);
    return res.status(500).json({ success: false, error: 'No se pudo registrar el consentimiento.' });
  }
});

// ---------------------------------------------------------------------------
// AUTH: My claims + strike score
// ---------------------------------------------------------------------------
router.get('/my/claims', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.id);
    if (!Number.isFinite(userId)) return res.json({ success: true, strikes: null, claims: [] });
    const strikes = await recomputeStrikes(userId);
    const claims = await db
      .select()
      .from(dmcaTakedowns)
      .where(eq(dmcaTakedowns.targetUserId, userId))
      .orderBy(desc(dmcaTakedowns.createdAt))
      .limit(100);
    return res.json({
      success: true,
      strikes,
      maxStrikes: STRIKE_SUSPEND_THRESHOLD,
      claims: claims.map((c) => ({
        id: c.id,
        caseNumber: c.uuid,
        status: c.status,
        workDescription: c.workDescription,
        targetUrl: c.targetUrl,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    console.error('[legal] my/claims error:', err);
    return res.status(500).json({ success: false, error: 'Error al cargar reclamaciones.' });
  }
});

// ---------------------------------------------------------------------------
// PUBLIC: Verification level of any artist (for badges on public profiles)
// ---------------------------------------------------------------------------
router.get('/verification/:userId', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) return res.json({ success: true, level: 'none', status: 'none' });
    const rows = await db
      .select({ level: artistVerifications.level, status: artistVerifications.status })
      .from(artistVerifications)
      .where(eq(artistVerifications.userId, userId))
      .limit(1);
    const v = rows[0];
    // Only expose an active level when the request was approved.
    const level = v && v.status === 'approved' ? v.level : 'none';
    return res.json({ success: true, level, status: v?.status || 'none' });
  } catch (err) {
    console.error('[legal] public verification error:', err);
    return res.json({ success: true, level: 'none', status: 'none' });
  }
});

// ---------------------------------------------------------------------------
// AUTH: Verification status + request
// ---------------------------------------------------------------------------
router.get('/my/verification', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user!.id);
    if (!Number.isFinite(userId)) return res.json({ success: true, verification: null });
    const rows = await db.select().from(artistVerifications).where(eq(artistVerifications.userId, userId)).limit(1);
    return res.json({ success: true, verification: rows[0] || null });
  } catch (err) {
    console.error('[legal] my/verification error:', err);
    return res.status(500).json({ success: false, error: 'Error al cargar verificación.' });
  }
});

router.post('/verification/request', authenticate, async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    const userId = Number(req.user!.id);
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, error: 'Usuario inválido.' });
    const level = ['verified', 'label', 'distributor', 'company', 'rights_admin'].includes(b.level) ? b.level : 'verified';
    const existing = await db.select().from(artistVerifications).where(eq(artistVerifications.userId, userId)).limit(1);
    const values = {
      userId,
      level,
      legalName: b.legalName || null,
      organization: b.organization || null,
      taxId: b.taxId || null,
      documentsUrls: Array.isArray(b.documentsUrls) ? b.documentsUrls : [],
      status: 'pending' as const,
      updatedAt: new Date(),
    };
    let row;
    if (existing.length) {
      [row] = await db.update(artistVerifications).set(values).where(eq(artistVerifications.userId, userId)).returning();
    } else {
      [row] = await db.insert(artistVerifications).values(values).returning();
    }
    await legalAudit({
      actorId: userId,
      actorEmail: req.user!.email || null,
      action: 'verification.requested',
      entityType: 'verification',
      entityId: row.id,
      detail: { level },
    });
    return res.json({ success: true, verification: row });
  } catch (err) {
    console.error('[legal] verification request error:', err);
    return res.status(500).json({ success: false, error: 'No se pudo enviar la solicitud.' });
  }
});

// ===========================================================================
// ADMIN (legal team)
// ===========================================================================
function requireAdmin(req: Request, res: Response): boolean {
  if (!req.user?.isAdmin) {
    res.status(403).json({ success: false, error: 'Acceso restringido al equipo legal.' });
    return false;
  }
  return true;
}

router.get('/admin/queue', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const status = req.query.status as string | undefined;
    const base = db.select().from(dmcaTakedowns);
    const rows = status
      ? await base.where(eq(dmcaTakedowns.status, status as any)).orderBy(desc(dmcaTakedowns.createdAt)).limit(200)
      : await base.orderBy(desc(dmcaTakedowns.createdAt)).limit(200);

    const counts = await db
      .select({ status: dmcaTakedowns.status, n: sql<number>`count(*)::int` })
      .from(dmcaTakedowns)
      .groupBy(dmcaTakedowns.status);

    return res.json({ success: true, cases: rows, counts });
  } catch (err) {
    console.error('[legal] admin queue error:', err);
    return res.status(500).json({ success: false, error: 'Error al cargar la cola.' });
  }
});

router.get('/admin/case/:id', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(req.params.id);
    const tk = await db.select().from(dmcaTakedowns).where(eq(dmcaTakedowns.id, id)).limit(1);
    if (!tk.length) return res.status(404).json({ success: false, error: 'Caso no encontrado.' });
    const counters = await db.select().from(dmcaCounterNotices).where(eq(dmcaCounterNotices.takedownId, id)).orderBy(desc(dmcaCounterNotices.createdAt));
    const audit = await db
      .select()
      .from(legalAuditLog)
      .where(and(eq(legalAuditLog.entityType, 'dmca'), eq(legalAuditLog.entityId, id)))
      .orderBy(desc(legalAuditLog.createdAt))
      .limit(100);

    let targetUser: any = null;
    let targetStrikes: any = null;
    let fingerprint: any = null;
    if (tk[0].targetUserId) {
      const u = await db.select({ id: users.id, email: users.email, username: users.username, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, tk[0].targetUserId)).limit(1);
      targetUser = u[0] || null;
      targetStrikes = await recomputeStrikes(tk[0].targetUserId);
    }
    if (tk[0].fingerprintId) {
      const fp = await db.select().from(fileFingerprints).where(eq(fileFingerprints.id, tk[0].fingerprintId)).limit(1);
      fingerprint = fp[0] || null;
    }

    return res.json({ success: true, case: tk[0], counterNotices: counters, audit, targetUser, targetStrikes, fingerprint });
  } catch (err) {
    console.error('[legal] admin case error:', err);
    return res.status(500).json({ success: false, error: 'Error al cargar el caso.' });
  }
});

router.post('/admin/case/:id/action', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(req.params.id);
    const action = String(req.body?.action || '');
    const note = req.body?.note || null;
    const tk = await db.select().from(dmcaTakedowns).where(eq(dmcaTakedowns.id, id)).limit(1);
    if (!tk.length) return res.status(404).json({ success: false, error: 'Caso no encontrado.' });

    const adminId = Number(req.user!.id);
    let newStatus = tk[0].status as string;
    const patch: any = { updatedAt: new Date(), assignedTo: Number.isFinite(adminId) ? adminId : null };

    switch (action) {
      case 'disable_content':
        newStatus = 'content_disabled';
        patch.contentDisabledAt = new Date();
        // disable the fingerprinted file if present
        if (tk[0].fingerprintId) {
          await db.update(fileFingerprints).set({ status: 'disabled' }).where(eq(fileFingerprints.id, tk[0].fingerprintId));
        }
        break;
      case 'reinstate':
        newStatus = 'reinstated';
        if (tk[0].fingerprintId) {
          await db.update(fileFingerprints).set({ status: 'active' }).where(eq(fileFingerprints.id, tk[0].fingerprintId));
        }
        break;
      case 'resolve':
        newStatus = 'resolved';
        break;
      case 'reject':
        newStatus = 'rejected';
        break;
      case 'under_review':
        newStatus = 'under_review';
        break;
      case 'assign':
        // keep status, just assign
        break;
      default:
        return res.status(400).json({ success: false, error: `Acción no reconocida: ${action}` });
    }
    patch.status = newStatus;
    if (note) patch.resolutionNote = note;

    const [updated] = await db.update(dmcaTakedowns).set(patch).where(eq(dmcaTakedowns.id, id)).returning();

    await legalAudit({
      actorId: Number.isFinite(adminId) ? adminId : null,
      actorEmail: req.user!.email || null,
      action: `case.${action}`,
      entityType: 'dmca',
      entityId: id,
      detail: { newStatus, note },
      ip: clientIp(req),
      userAgent: clientUa(req),
    });

    if (updated.targetUserId) await recomputeStrikes(updated.targetUserId);

    return res.json({ success: true, case: updated });
  } catch (err) {
    console.error('[legal] admin action error:', err);
    return res.status(500).json({ success: false, error: 'No se pudo ejecutar la acción.' });
  }
});

router.get('/admin/verifications', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await db.select().from(artistVerifications).orderBy(desc(artistVerifications.updatedAt)).limit(200);
    return res.json({ success: true, verifications: rows });
  } catch (err) {
    console.error('[legal] admin verifications error:', err);
    return res.status(500).json({ success: false, error: 'Error al cargar verificaciones.' });
  }
});

router.post('/admin/verification/:id', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(req.params.id);
    const decision = req.body?.decision; // 'approve' | 'reject'
    const level = req.body?.level;
    const note = req.body?.note || null;
    const rows = await db.select().from(artistVerifications).where(eq(artistVerifications.id, id)).limit(1);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Solicitud no encontrada.' });

    const adminId = Number(req.user!.id);
    const patch: any = { updatedAt: new Date(), reviewedBy: Number.isFinite(adminId) ? adminId : null, reviewNote: note };
    if (decision === 'approve') {
      patch.status = 'approved';
      patch.verifiedAt = new Date();
      if (level && ['verified', 'label', 'distributor', 'company', 'rights_admin'].includes(level)) patch.level = level;
    } else if (decision === 'reject') {
      patch.status = 'rejected';
      patch.level = 'none';
    } else {
      return res.status(400).json({ success: false, error: 'Decisión inválida.' });
    }
    const [updated] = await db.update(artistVerifications).set(patch).where(eq(artistVerifications.id, id)).returning();

    await legalAudit({
      actorId: Number.isFinite(adminId) ? adminId : null,
      actorEmail: req.user!.email || null,
      action: `verification.${decision}`,
      entityType: 'verification',
      entityId: id,
      detail: { level: patch.level, note },
    });
    return res.json({ success: true, verification: updated });
  } catch (err) {
    console.error('[legal] admin verification decision error:', err);
    return res.status(500).json({ success: false, error: 'No se pudo procesar la decisión.' });
  }
});

router.get('/admin/audit', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await db.select().from(legalAuditLog).orderBy(desc(legalAuditLog.createdAt)).limit(500);
    return res.json({ success: true, audit: rows });
  } catch (err) {
    console.error('[legal] admin audit error:', err);
    return res.status(500).json({ success: false, error: 'Error al cargar el registro.' });
  }
});

// Export a full case dossier (JSON) for the legal team
router.get('/admin/case/:id/export', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(req.params.id);
    const tk = await db.select().from(dmcaTakedowns).where(eq(dmcaTakedowns.id, id)).limit(1);
    if (!tk.length) return res.status(404).json({ success: false, error: 'Caso no encontrado.' });
    const counters = await db.select().from(dmcaCounterNotices).where(eq(dmcaCounterNotices.takedownId, id));
    const audit = await db.select().from(legalAuditLog).where(and(eq(legalAuditLog.entityType, 'dmca'), eq(legalAuditLog.entityId, id)));
    let fingerprint: any = null;
    if (tk[0].fingerprintId) {
      const fp = await db.select().from(fileFingerprints).where(eq(fileFingerprints.id, tk[0].fingerprintId)).limit(1);
      fingerprint = fp[0] || null;
    }
    const dossier = { exportedAt: new Date().toISOString(), case: tk[0], counterNotices: counters, fingerprint, audit };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="dmca-case-${tk[0].uuid}.json"`);
    return res.send(JSON.stringify(dossier, null, 2));
  } catch (err) {
    console.error('[legal] export error:', err);
    return res.status(500).json({ success: false, error: 'No se pudo exportar el expediente.' });
  }
});

export default router;
