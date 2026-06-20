/**
 * Copyright Certification API
 * 
 * - POST /certify          — Hash document, store in DB, optionally publish on Polygon
 * - GET  /verify/:hash     — Verify a document hash (checks DB + on-chain)
 * - GET  /certificate/:id  — Get full certification record
 * - GET  /my               — List user's certifications
 */

import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { createPublicClient, createWalletClient, http, fallback, parseAbi, type Hex } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { copyrightCertifications, lyricsProjects } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// ═══════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════

// Contract address — set after deployment via env var
const COPYRIGHT_REGISTRY_ADDRESS = process.env.COPYRIGHT_REGISTRY_ADDRESS || '';

const POLYGON_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://rpc.ankr.com/polygon',
  'https://1rpc.io/matic',
  'https://polygon-rpc.com',
];

const publicClient = createPublicClient({
  chain: polygon,
  transport: fallback(
    POLYGON_RPCS.map(url => http(url, { timeout: 10000, retryCount: 2 })),
    { rank: true }
  ),
});

const CONTRACT_ABI = parseAbi([
  'function certify(bytes32 _documentHash, string _songTitle, uint16 _authorshipScore) external returns (uint256)',
  'function verify(bytes32 _documentHash) external view returns (bool exists, address author, uint256 timestamp, string songTitle, uint16 authorshipScore)',
  'function totalRecords() external view returns (uint256)',
  'event CopyrightCertified(uint256 indexed recordId, bytes32 indexed documentHash, address indexed author, string songTitle, uint16 authorshipScore, uint256 timestamp)',
]);

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function hashDocument(data: object): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function getWalletClient() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY || process.env.PLATFORM_PRIVATE_KEY;
  if (!pk) return null;
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}` as Hex);
  return createWalletClient({
    account,
    chain: polygon,
    transport: fallback(
      POLYGON_RPCS.map(url => http(url, { timeout: 15000, retryCount: 2 })),
      { rank: true }
    ),
  });
}

function buildEvidencePacket(project: any) {
  return {
    title: project.songTitle,
    language: project.language,
    genre: project.genre,
    theme: project.theme,
    emotion: project.emotion,
    messageCore: project.messageCore,
    personalStory: project.personalStory,
    humanOriginalPhrases: project.humanOriginalPhrases,
    humanIdeas: project.humanIdeas,
    keywords: project.keywords,
    styleReferences: project.styleReferences,
    freeWritingBlock: project.freeWritingBlock,
    looseLines: project.looseLines,
    metaphorBank: project.metaphorBank,
    hookBank: project.hookBank,
    narrativeImages: project.narrativeImages,
    structureMap: project.structureMap,
    verseCount: project.verseCount,
    chorusLength: project.chorusLength,
    hookRepetition: project.hookRepetition,
    draftVersions: project.draftVersions,
    authorshipMetrics: project.authorshipMetrics,
    finalLyrics: project.finalLyrics,
    authorDeclaration: project.authorDeclaration,
    createdAt: project.createdAt,
    platform: 'Boostify Music — AI-Assisted Human Creation',
    version: '1.0',
  };
}

// ═══════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════

/**
 * POST /certify
 * Body: { lyricsProjectId, walletAddress? }
 * 
 * 1. Loads the lyrics project
 * 2. Builds evidence packet & computes SHA-256
 * 3. Saves to DB
 * 4. If blockchain is configured, publishes hash on Polygon
 */
router.post('/certify', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { lyricsProjectId, walletAddress } = req.body;
    if (!lyricsProjectId) return res.status(400).json({ error: 'lyricsProjectId required' });

    // Load the project (verify ownership)
    const [project] = await db
      .select()
      .from(lyricsProjects)
      .where(and(eq(lyricsProjects.id, lyricsProjectId), eq(lyricsProjects.userId, userId)));

    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Build evidence packet and hash it
    const packet = buildEvidencePacket(project);
    const docHash = hashDocument(packet);
    const authorshipScore = project.authorshipMetrics?.rewritePercentage || 0;

    // Create DB record (pending)
    const [cert] = await db
      .insert(copyrightCertifications)
      .values({
        lyricsProjectId,
        userId,
        documentHash: docHash,
        songTitle: project.songTitle,
        authorshipScore,
        walletAddress: walletAddress || null,
        packetJson: packet,
        status: 'pending',
      })
      .returning();

    // Attempt blockchain certification
    let txHash: string | null = null;
    let blockNumber: number | null = null;
    let blockTimestamp: Date | null = null;
    let contractRecordId: number | null = null;

    const wallet = getWalletClient();
    if (wallet && COPYRIGHT_REGISTRY_ADDRESS) {
      try {
        const hashBytes = `0x${docHash}` as Hex;

        const tx = await wallet.writeContract({
          address: COPYRIGHT_REGISTRY_ADDRESS as Hex,
          abi: CONTRACT_ABI,
          functionName: 'certify',
          args: [hashBytes, project.songTitle, authorshipScore],
        });

        txHash = tx;

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
          confirmations: 2,
          timeout: 60_000,
        });

        blockNumber = Number(receipt.blockNumber);

        // Get block timestamp
        const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
        blockTimestamp = new Date(Number(block.timestamp) * 1000);

        // Parse event to get recordId
        for (const log of receipt.logs) {
          try {
            if (log.topics[0] === '0x' + createHash('sha256').update('CopyrightCertified(uint256,bytes32,address,string,uint16,uint256)').digest('hex').slice(0, 64)) {
              // Fallback: read totalRecords
            }
          } catch { /* ignore */ }
        }

        // Get the record ID by reading totalRecords
        const total = await publicClient.readContract({
          address: COPYRIGHT_REGISTRY_ADDRESS as Hex,
          abi: CONTRACT_ABI,
          functionName: 'totalRecords',
        });
        contractRecordId = Number(total);

        // Update DB with blockchain data
        await db.update(copyrightCertifications)
          .set({
            txHash,
            blockNumber,
            blockTimestamp,
            contractRecordId,
            status: 'certified',
            certifiedAt: new Date(),
          })
          .where(eq(copyrightCertifications.id, cert.id));

        console.log(`[copyright] ✅ Certified on Polygon: tx=${txHash}, record=${contractRecordId}`);
      } catch (chainErr: any) {
        console.error('[copyright] ⚠️ Blockchain certification failed:', chainErr.message);
        // Still saved in DB as pending — can retry later
      }
    } else {
      // No blockchain configured — certify off-chain only (hash + DB)
      await db.update(copyrightCertifications)
        .set({ status: 'certified', certifiedAt: new Date() })
        .where(eq(copyrightCertifications.id, cert.id));
    }

    // Return full certification data
    const [updated] = await db
      .select()
      .from(copyrightCertifications)
      .where(eq(copyrightCertifications.id, cert.id));

    res.json({
      certification: updated,
      documentHash: docHash,
      txHash,
      blockNumber,
      contractRecordId,
      polygonscanUrl: txHash ? `https://polygonscan.com/tx/${txHash}` : null,
      verifyUrl: `/api/copyright/verify/${docHash}`,
    });
  } catch (err: any) {
    console.error('[copyright] POST /certify error:', err);
    res.status(500).json({ error: 'Certification failed' });
  }
});

/**
 * GET /verify/:hash
 * Public endpoint — anyone can verify a document hash
 */
router.get('/verify/:hash', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    if (!hash || hash.length !== 64) return res.status(400).json({ error: 'Invalid hash' });

    // Check DB first
    const [dbRecord] = await db
      .select()
      .from(copyrightCertifications)
      .where(eq(copyrightCertifications.documentHash, hash));

    if (!dbRecord) {
      return res.json({ verified: false, message: 'No certification found for this hash' });
    }

    // If we have blockchain data, verify on-chain too
    let onChainVerified = false;
    if (COPYRIGHT_REGISTRY_ADDRESS && dbRecord.txHash) {
      try {
        const hashBytes = `0x${hash}` as Hex;
        const result = await publicClient.readContract({
          address: COPYRIGHT_REGISTRY_ADDRESS as Hex,
          abi: CONTRACT_ABI,
          functionName: 'verify',
          args: [hashBytes],
        }) as [boolean, string, bigint, string, number];

        onChainVerified = result[0];
      } catch {
        // Chain read failed, rely on DB
      }
    }

    res.json({
      verified: true,
      onChainVerified,
      certification: {
        songTitle: dbRecord.songTitle,
        authorshipScore: dbRecord.authorshipScore,
        documentHash: dbRecord.documentHash,
        txHash: dbRecord.txHash,
        blockNumber: dbRecord.blockNumber,
        blockTimestamp: dbRecord.blockTimestamp,
        certifiedAt: dbRecord.certifiedAt,
        walletAddress: dbRecord.walletAddress,
        polygonscanUrl: dbRecord.txHash ? `https://polygonscan.com/tx/${dbRecord.txHash}` : null,
      },
    });
  } catch (err: any) {
    console.error('[copyright] GET /verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * GET /certificate/:id
 * Get full certification record (auth required)
 */
router.get('/certificate/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const certId = parseInt(req.params.id, 10);
    if (isNaN(certId)) return res.status(400).json({ error: 'Invalid id' });

    const [cert] = await db
      .select()
      .from(copyrightCertifications)
      .where(and(eq(copyrightCertifications.id, certId), eq(copyrightCertifications.userId, userId)));

    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    res.json(cert);
  } catch (err: any) {
    console.error('[copyright] GET /certificate/:id error:', err);
    res.status(500).json({ error: 'Failed to get certificate' });
  }
});

/**
 * GET /my
 * List all certifications for the authenticated user
 */
router.get('/my', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const certs = await db
      .select()
      .from(copyrightCertifications)
      .where(eq(copyrightCertifications.userId, userId))
      .orderBy(desc(copyrightCertifications.createdAt));

    res.json(certs);
  } catch (err: any) {
    console.error('[copyright] GET /my error:', err);
    res.status(500).json({ error: 'Failed to list certifications' });
  }
});

export default router;
