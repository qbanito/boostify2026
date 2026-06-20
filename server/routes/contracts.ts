import { Router, Request } from 'express';
import { db } from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { generateContract, analyzeContract, generateTemplateContract, CONTRACT_TEMPLATES } from '../services/openai-contracts';
import { askLegalAssistant, auditContractsForShield } from '../services/legal-assistant';
import { isAuthenticated, ClerkAuthUser } from '../middleware/clerk-auth';

interface AuthRequest extends Request {
  user?: ClerkAuthUser;
}

const router = Router();

const generateContractSchema = z.object({
  contractType: z.string().min(2),
  artistName: z.string().min(2),
  clientName: z.string().optional(),
  projectDetails: z.string().optional(),
  paymentTerms: z.string().optional(),
  duration: z.string().optional(),
  additionalClauses: z.string().optional(),
});

const saveContractSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(10),
  contractType: z.string().optional(),
  status: z.enum(['draft', 'active', 'signed', 'expired']).optional(),
});

const legalAssistantSchema = z.object({
  question: z.string().min(2).max(4000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      })
    )
    .max(20)
    .optional(),
  contractContext: z.string().max(20000).optional(),
  userProfile: z
    .object({
      artistName: z.string().optional(),
      country: z.string().optional(),
      plan: z.string().optional(),
      hasContracts: z.number().optional(),
    })
    .optional(),
});

router.post('/generate', isAuthenticated, async (req: any, res) => {
  try {
    const validationResult = generateContractSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationResult.error.format()
      });
    }

    const contractContent = await generateContract(validationResult.data);

    return res.status(200).json({
      success: true,
      content: contractContent
    });

  } catch (error: any) {
    console.error('Error generating contract:', error);
    return res.status(500).json({ 
      error: 'Failed to generate contract',
      details: error.message 
    });
  }
});

router.post('/analyze', isAuthenticated, async (req: any, res) => {
  try {
    const { contractText } = req.body;

    if (!contractText || typeof contractText !== 'string') {
      return res.status(400).json({ error: 'Contract text is required' });
    }

    const analysis = await analyzeContract(contractText);

    return res.status(200).json({
      success: true,
      analysis
    });

  } catch (error: any) {
    console.error('Error analyzing contract:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze contract',
      details: error.message 
    });
  }
});

router.get('/templates', async (req, res) => {
  return res.status(200).json({
    success: true,
    templates: CONTRACT_TEMPLATES
  });
});

router.post('/generate-template', isAuthenticated, async (req: any, res) => {
  try {
    const { templateType, customParams } = req.body;

    if (!templateType) {
      return res.status(400).json({ error: 'Template type is required' });
    }

    const contractContent = await generateTemplateContract(templateType, customParams || {});

    return res.status(200).json({
      success: true,
      content: contractContent
    });

  } catch (error: any) {
    console.error('Error generating template contract:', error);
    return res.status(500).json({ 
      error: 'Failed to generate template contract',
      details: error.message 
    });
  }
});

router.post('/', isAuthenticated, async (req: any, res) => {
  try {
    const validationResult = saveContractSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationResult.error.format()
      });
    }

    const userId = req.user.clerkUserId;
    const contractData = {
      ...validationResult.data,
      userId,
      status: validationResult.data.status || 'draft',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('contracts').add(contractData);

    return res.status(201).json({
      success: true,
      id: docRef.id,
      message: 'Contract saved successfully'
    });

  } catch (error: any) {
    console.error('Error saving contract:', error);
    return res.status(500).json({ 
      error: 'Failed to save contract',
      details: error.message 
    });
  }
});

router.get('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.clerkUserId;

    const contractsSnapshot = await db.collection('contracts')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const contracts = contractsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.status(200).json({
      success: true,
      contracts
    });

  } catch (error: any) {
    console.error('Error fetching contracts:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch contracts',
      details: error.message 
    });
  }
});

router.get('/:id', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.clerkUserId;
    const { id } = req.params;

    const contractDoc = await db.collection('contracts').doc(id).get();

    if (!contractDoc.exists) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contractData = contractDoc.data();

    if (contractData?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.status(200).json({
      success: true,
      contract: {
        id: contractDoc.id,
        ...contractData
      }
    });

  } catch (error: any) {
    console.error('Error fetching contract:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch contract',
      details: error.message 
    });
  }
});

router.patch('/:id', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.clerkUserId;
    const { id } = req.params;

    const contractDoc = await db.collection('contracts').doc(id).get();

    if (!contractDoc.exists) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contractData = contractDoc.data();

    if (contractData?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = {
      ...req.body,
      updatedAt: FieldValue.serverTimestamp()
    };

    delete updates.userId;
    delete updates.createdAt;

    await contractDoc.ref.update(updates);

    return res.status(200).json({
      success: true,
      message: 'Contract updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating contract:', error);
    return res.status(500).json({ 
      error: 'Failed to update contract',
      details: error.message 
    });
  }
});

router.delete('/:id', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.clerkUserId;
    const { id } = req.params;

    const contractDoc = await db.collection('contracts').doc(id).get();

    if (!contractDoc.exists) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contractData = contractDoc.data();

    if (contractData?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await contractDoc.ref.delete();

    return res.status(200).json({
      success: true,
      message: 'Contract deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting contract:', error);
    return res.status(500).json({ 
      error: 'Failed to delete contract',
      details: error.message 
    });
  }
});

/**
 * POST /api/contracts/legal-assistant
 * Asistente legal IA — chat experto en derecho musical (protege artista + plataforma).
 */
router.post('/legal-assistant', isAuthenticated, async (req: any, res) => {
  try {
    const validation = legalAssistantSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.format(),
      });
    }

    const userId = req.user.clerkUserId;

    // Auto-attach contract count for context
    let hasContracts = validation.data.userProfile?.hasContracts;
    if (hasContracts === undefined) {
      try {
        const snap = await db.collection('contracts').where('userId', '==', userId).get();
        hasContracts = snap.size;
      } catch {
        hasContracts = 0;
      }
    }

    const result = await askLegalAssistant({
      userQuestion: validation.data.question,
      conversationHistory: validation.data.conversationHistory,
      contractContext: validation.data.contractContext,
      userProfile: { ...validation.data.userProfile, hasContracts },
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error in legal-assistant:', error);
    return res.status(500).json({
      error: 'Legal assistant unavailable',
      details: error.message,
    });
  }
});

/**
 * GET /api/contracts/risk-shield
 * Audita TODOS los contratos del usuario y devuelve un score de protección + red flags consolidados.
 */
router.get('/risk-shield', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.clerkUserId;

    const snap = await db
      .collection('contracts')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const contracts = snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Untitled Contract',
        content: data.content || '',
      };
    });

    const report = await auditContractsForShield(contracts);
    return res.status(200).json({ success: true, ...report });
  } catch (error: any) {
    console.error('Error in risk-shield:', error);
    return res.status(500).json({
      error: 'Risk shield unavailable',
      details: error.message,
    });
  }
});

export default router;
