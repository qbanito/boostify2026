/**
 * Rutas API para contratos de colaboración de merchandising
 * Gestiona la firma y consulta de contratos artista-Boostify
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { merchContracts } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

/**
 * Obtiene el contrato activo de un artista
 */
router.get('/status/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = Number(req.params.artistId);
    if (!artistId || isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Valid artistId required' });
    }

    const [contract] = await db
      .select()
      .from(merchContracts)
      .where(and(
        eq(merchContracts.artistId, artistId),
        eq(merchContracts.status, 'active')
      ))
      .limit(1);

    res.json({ 
      success: true, 
      data: {
        hasContract: !!contract,
        contract: contract || null
      }
    });
  } catch (error: any) {
    console.error('Error fetching merch contract status:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Firma un nuevo contrato de colaboración
 */
router.post('/sign', async (req: Request, res: Response) => {
  try {
    const { 
      artistId, 
      artistLegalName, 
      artistStageName, 
      artistEmail, 
      artistCountry,
      subscriptionPlan 
    } = req.body;

    if (!artistId || !artistLegalName || !artistStageName || !artistEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'artistId, artistLegalName, artistStageName and artistEmail are required' 
      });
    }

    // Check for existing active contract
    const [existing] = await db
      .select()
      .from(merchContracts)
      .where(and(
        eq(merchContracts.artistId, Number(artistId)),
        eq(merchContracts.status, 'active')
      ))
      .limit(1);

    if (existing) {
      return res.status(409).json({ 
        success: false, 
        error: 'Artist already has an active collaboration contract' 
      });
    }

    // Determine revenue split based on plan
    const isFree = !subscriptionPlan || subscriptionPlan === 'free';
    const artistShare = isFree ? '20.00' : '70.00';
    const boostifyShare = isFree ? '80.00' : '30.00';

    // Create signature hash
    const signatureData = `${artistId}:${artistLegalName}:${artistEmail}:${artistShare}:${boostifyShare}:${new Date().toISOString()}`;
    const signatureHash = crypto.createHash('sha256').update(signatureData).digest('hex');

    const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';

    const [contract] = await db
      .insert(merchContracts)
      .values({
        artistId: Number(artistId),
        artistRevenueShare: artistShare,
        boostifyRevenueShare: boostifyShare,
        platformMaintenanceFee: '10.00',
        subscriptionPlanAtSigning: subscriptionPlan || 'free',
        artistLegalName,
        artistStageName,
        artistEmail,
        artistCountry: artistCountry || null,
        status: 'active',
        signatureHash,
        ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : 'unknown',
        printfulSyncEnabled: false,
      })
      .returning();

    res.json({ success: true, data: contract });
  } catch (error: any) {
    console.error('Error signing merch contract:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Termina un contrato activo
 */
router.post('/terminate/:contractId', async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.contractId);
    const { reason } = req.body;

    const [updated] = await db
      .update(merchContracts)
      .set({ 
        status: 'terminated', 
        terminatedAt: new Date(),
        terminationReason: reason || 'Voluntary termination',
        updatedAt: new Date()
      })
      .where(and(
        eq(merchContracts.id, contractId),
        eq(merchContracts.status, 'active')
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Active contract not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error terminating merch contract:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
