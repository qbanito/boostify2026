/**
 * BTF Legal Acknowledgement Route
 * POST /api/btf/acknowledge-terms
 * 
 * Records that a user has acknowledged the BTF utility token disclaimer.
 * BTF is a utility token used only to access digital services inside Boostify.
 * It is NOT an investment, security, or financial product.
 */

import { Router } from 'express';
import { db } from '../../db';
import { legalAcknowledgements } from '../../db/schema';

const router = Router();

router.post('/acknowledge-terms', async (req, res) => {
  try {
    const { userId, walletAddress, termsVersion } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Sanitize IP — avoid logging real IPs beyond what's needed for audit
    const ipAddress = (req.ip || '').substring(0, 45); // Trim to column max

    await db.insert(legalAcknowledgements).values({
      userId: String(userId).substring(0, 255),
      walletAddress: walletAddress ? String(walletAddress).substring(0, 100) : null,
      termsVersion: termsVersion || 'v1.0',
      utilityDisclaimerAccepted: true,
      acceptedAt: new Date(),
      ipAddress,
    });

    return res.json({ success: true, message: 'Utility disclaimer acknowledged' });
  } catch (err) {
    console.error('[BTF Legal] Error saving acknowledgement:', err);
    return res.status(500).json({ error: 'Failed to save acknowledgement' });
  }
});

export default router;
