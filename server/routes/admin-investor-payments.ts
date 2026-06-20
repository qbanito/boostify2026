import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { investorPayments } from '../../db/schema';
import { eq, desc, sql } from 'drizzle-orm';

const router = express.Router();

// Admin check helper
function isAdmin(req: Request): boolean {
  return !!req.user?.isAdmin;
}

/**
 * GET /api/admin/investor-payments
 * Lista todos los pagos/inversiones de inversores
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    const payments = await db.select().from(investorPayments).orderBy(desc(investorPayments.createdAt));

    res.json({ success: true, payments });
  } catch (error) {
    console.error('[ADMIN INVESTOR PAYMENTS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener pagos de inversores' });
  }
});

/**
 * GET /api/admin/investor-payments/stats
 * Estadísticas agregadas de inversiones
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    const payments = await db.select().from(investorPayments);

    const totalInvested = payments.reduce((sum, p) => sum + Number(p.investmentAmount), 0);
    const totalPaidOut = payments.reduce((sum, p) => sum + Number(p.totalPaidOut), 0);
    const totalPending = payments.reduce((sum, p) => sum + Number(p.pendingPayment), 0);
    const expectedReturns = payments.reduce((sum, p) => sum + Number(p.expectedReturnAmount), 0);
    const activeCount = payments.filter(p => p.status === 'active').length;
    const completedCount = payments.filter(p => p.status === 'completed').length;

    // Build monthly chart data from actual payments
    const chartData: Record<string, { invested: number; paid: number; earned: number }> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Track cumulative invested over time
    const sortedByDate = [...payments].sort((a, b) => 
      new Date(a.investmentDate).getTime() - new Date(b.investmentDate).getTime()
    );

    let cumulativeInvested = 0;
    for (const payment of sortedByDate) {
      const date = new Date(payment.investmentDate);
      const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
      cumulativeInvested += Number(payment.investmentAmount);

      if (!chartData[monthKey]) {
        chartData[monthKey] = { invested: 0, paid: 0, earned: 0 };
      }
      chartData[monthKey].invested = cumulativeInvested;
      chartData[monthKey].paid += Number(payment.totalPaidOut);
      chartData[monthKey].earned += Number(payment.expectedReturnAmount);
    }

    const chartArray = Object.entries(chartData).map(([month, data]) => ({
      month: month.split(' ')[0], // Just month abbreviation
      ...data,
    }));

    res.json({
      success: true,
      stats: {
        totalInvested,
        totalPaidOut,
        totalPending,
        expectedReturns,
        activeCount,
        completedCount,
        totalInvestors: payments.length,
      },
      chartData: chartArray,
    });
  } catch (error) {
    console.error('[ADMIN INVESTOR STATS ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
});

/**
 * POST /api/admin/investor-payments
 * Crear un nuevo registro de inversión/pago
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    const {
      investorName, investorEmail, investmentType, investmentAmount, investmentDate,
      expectedReturn, expectedReturnAmount, interestRate, paymentMethod,
      paymentFrequency, notes, totalPaidOut, pendingPayment, paymentStatus, status
    } = req.body;

    if (!investorName || !investmentType || !investmentAmount || !investmentDate || expectedReturn === undefined) {
      return res.status(400).json({ success: false, message: 'Campos requeridos: investorName, investmentType, investmentAmount, investmentDate, expectedReturn' });
    }

    const [payment] = await db.insert(investorPayments).values({
      investorName,
      investorEmail: investorEmail || null,
      investmentType,
      investmentAmount: String(investmentAmount),
      investmentDate: new Date(investmentDate),
      expectedReturn: String(expectedReturn),
      expectedReturnAmount: String(expectedReturnAmount || 0),
      interestRate: String(interestRate || 0),
      totalPaidOut: String(totalPaidOut || 0),
      pendingPayment: String(pendingPayment || 0),
      paymentMethod: paymentMethod || null,
      paymentStatus: paymentStatus || 'pending',
      paymentFrequency: paymentFrequency || 'quarterly',
      status: status || 'active',
      notes: notes || null,
    }).returning();

    res.json({ success: true, payment });
  } catch (error) {
    console.error('[ADMIN CREATE INVESTOR PAYMENT ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al crear registro de inversión' });
  }
});

/**
 * POST /api/admin/investor-payments/seed
 * Seed initial $1M investment from founder
 */
router.post('/seed', authenticate, async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    // Check if seed already exists
    const existing = await db.select().from(investorPayments);
    const hasFounderInvestment = existing.some(
      p => p.investorName === 'Founder Investment' && Number(p.investmentAmount) === 1000000
    );

    if (hasFounderInvestment) {
      return res.json({ success: true, message: 'Seed data already exists', seeded: false });
    }

    const [payment] = await db.insert(investorPayments).values({
      investorName: 'Founder Investment',
      investorEmail: 'founder@boostify.com',
      investmentType: 'equity',
      investmentAmount: '1000000',
      investmentDate: new Date('2024-01-15'),
      expectedReturn: '0',
      expectedReturnAmount: '0',
      interestRate: '0',
      totalPaidOut: '0',
      pendingPayment: '0',
      paymentMethod: 'wire',
      paymentStatus: 'paid',
      paymentFrequency: 'milestone',
      status: 'active',
      notes: 'Initial $1M founder investment in building Boostify platform',
    }).returning();

    res.json({ success: true, message: 'Seed data created', seeded: true, payment });
  } catch (error) {
    console.error('[ADMIN SEED INVESTOR ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al crear seed data' });
  }
});

export default router;
