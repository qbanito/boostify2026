/**
 * Rutas para Artist Wallet - Sistema de ganancias y créditos
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { artistWallet, artistPayouts, salesTransactions, walletTransactions } from '../../db/schema';
import { eq, desc, and, sql, gte, isNull, inArray } from 'drizzle-orm';
import { isAdminEmail } from '../../shared/constants';

const router = Router();

const MIN_PAYOUT = 20; // $20 minimum withdrawal

function isAdmin(user: any): boolean {
  if (!user) return false;
  return user.isAdmin === true || (user.email && isAdminEmail(user.email));
}

/** Friendly label for a wallet-transaction source type. */
function sourceLabel(type?: string | null): string {
  switch (type) {
    case 'artist_unlock': return 'Desbloqueo de catálogo';
    case 'artist_catalog_subscription': return 'Membresía mensual';
    case 'merch': return 'Merch';
    case 'ticket': return 'Tickets / Shows';
    case 'fanclub': return 'Fan Club';
    case 'vinyl': return 'Vinilos';
    case 'course': return 'Cursos';
    default: return 'Otros';
  }
}

/** Get-or-create the artist's wallet row. */
async function getWallet(userId: number) {
  let wallet = await db.query.artistWallet.findFirst({ where: eq(artistWallet.userId, userId) });
  if (!wallet) {
    const [created] = await db.insert(artistWallet).values({
      userId, balance: '0', totalEarnings: '0', totalSpent: '0', currency: 'usd',
    }).returning();
    wallet = created;
  }
  return wallet;
}

/** Compute the artist's payout summary: balance, pending, available, paid. */
async function getPayoutSummary(userId: number) {
  const wallet = await getWallet(userId);
  const pendingRows = await db.select({ amount: artistPayouts.amount })
    .from(artistPayouts)
    .where(and(
      eq(artistPayouts.artistId, userId),
      inArray(artistPayouts.status, ['requested', 'approved']),
    ));
  const pending = pendingRows.reduce((s, r) => s + parseFloat(r.amount), 0);
  const balance = parseFloat(wallet.balance);
  const available = Math.max(0, Math.round((balance - pending) * 100) / 100);
  return {
    balance,
    pending: Math.round(pending * 100) / 100,
    available,
    totalEarnings: parseFloat(wallet.totalEarnings),
    totalPaidOut: parseFloat(wallet.totalPaidOut || '0'),
    currency: wallet.currency,
    payoutMethod: wallet.payoutMethod || null,
    payoutAccount: wallet.payoutAccount || null,
    minPayout: MIN_PAYOUT,
  };
}

/**
 * Obtener balance actual del wallet del usuario autenticado
 */
router.get('/balance', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.id) {
      return res.json({ success: true, wallet: { balance: 0, totalEarnings: 0, totalSpent: 0, currency: 'usd' } });
    }

    let wallet = await db.query.artistWallet.findFirst({
      where: eq(artistWallet.userId, user.id)
    });

    if (!wallet) {
      const [newWallet] = await db.insert(artistWallet).values({
        userId: user.id,
        balance: '0',
        totalEarnings: '0',
        totalSpent: '0',
        currency: 'usd'
      }).returning();
      wallet = newWallet;
    }

    return res.json({
      success: true,
      wallet: {
        balance: parseFloat(wallet.balance),
        totalEarnings: parseFloat(wallet.totalEarnings),
        totalSpent: parseFloat(wallet.totalSpent),
        currency: wallet.currency,
        updatedAt: wallet.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error fetching wallet balance for user:', error);
    return res.json({ success: true, wallet: { balance: 0, totalEarnings: 0, totalSpent: 0, currency: 'usd' } });
  }
});

/**
 * Obtener historial de ganancias del usuario autenticado
 */
router.get('/earnings-history', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.id) {
      return res.json({ success: true, earnings: [], dailyEarnings: [] });
    }

    const days = parseInt(req.query.days as string) || 30;
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - days);

    const sales = await db.select()
      .from(salesTransactions)
      .where(
        and(
          eq(salesTransactions.artistId, user.id),
          eq(salesTransactions.status, 'completed'),
          gte(salesTransactions.createdAt, limitDate)
        )
      )
      .orderBy(desc(salesTransactions.createdAt));

    return res.json({
      success: true,
      earnings: sales,
      dailyEarnings: []
    });
  } catch (error: any) {
    console.error('Error fetching earnings history for user:', error);
    return res.json({ success: true, earnings: [], dailyEarnings: [] });
  }
});

/**
 * Obtener estadísticas de ventas del usuario autenticado
 */
router.get('/sales-stats', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.id) {
      return res.json({ 
        success: true, 
        stats: { totalSales: 0, totalRevenue: 0, averageOrder: 0, topProducts: [] } 
      });
    }

    const sales = await db.select()
      .from(salesTransactions)
      .where(
        and(
          eq(salesTransactions.artistId, user.id),
          eq(salesTransactions.status, 'completed')
        )
      );

    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.amount || '0'), 0);

    return res.json({
      success: true,
      stats: {
        totalSales: sales.length,
        totalRevenue,
        averageOrder: sales.length > 0 ? totalRevenue / sales.length : 0,
        topProducts: []
      }
    });
  } catch (error: any) {
    console.error('Error fetching sales stats for user:', error);
    return res.json({ 
      success: true, 
      stats: { totalSales: 0, totalRevenue: 0, averageOrder: 0, topProducts: [] } 
    });
  }
});

/**
 * Obtener balance actual del wallet del artista
 */
router.get('/balance/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);

    // Buscar o crear wallet del artista
    let wallet = await db.query.artistWallet.findFirst({
      where: eq(artistWallet.userId, userId)
    });

    // Si no existe, crearlo
    if (!wallet) {
      const [newWallet] = await db.insert(artistWallet).values({
        userId,
        balance: '0',
        totalEarnings: '0',
        totalSpent: '0',
        currency: 'usd'
      }).returning();
      wallet = newWallet;
    }

    return res.json({
      success: true,
      wallet: {
        balance: parseFloat(wallet.balance),
        totalEarnings: parseFloat(wallet.totalEarnings),
        totalSpent: parseFloat(wallet.totalSpent),
        currency: wallet.currency,
        updatedAt: wallet.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error fetching wallet balance:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch wallet balance'
    });
  }
});

/**
 * Obtener historial de ganancias (últimos 30 días)
 */
router.get('/earnings-history/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const days = parseInt(req.query.days as string) || 30;
    
    // Calcular fecha límite
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - days);

    // Obtener ventas completadas
    const sales = await db.select()
      .from(salesTransactions)
      .where(
        and(
          eq(salesTransactions.artistId, userId),
          eq(salesTransactions.status, 'completed'),
          gte(salesTransactions.createdAt, limitDate)
        )
      )
      .orderBy(desc(salesTransactions.createdAt));

    // Agrupar por día para el gráfico
    const dailyEarnings = sales.reduce((acc: any[], sale) => {
      const date = sale.createdAt.toISOString().split('T')[0];
      const existing = acc.find(item => item.date === date);
      
      if (existing) {
        existing.earnings += parseFloat(sale.artistEarning);
        existing.sales += 1;
      } else {
        acc.push({
          date,
          earnings: parseFloat(sale.artistEarning),
          sales: 1
        });
      }
      
      return acc;
    }, []);

    // Also include non-merchandise wallet earnings (crowdfunding, etc.)
    const walletEarnings = await db.select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.userId, userId),
          eq(walletTransactions.type, 'earning'),
          isNull(walletTransactions.relatedSaleId),
          gte(walletTransactions.createdAt, limitDate)
        )
      )
      .orderBy(desc(walletTransactions.createdAt));

    for (const wt of walletEarnings) {
      const date = wt.createdAt.toISOString().split('T')[0];
      const existing = dailyEarnings.find(item => item.date === date);
      if (existing) {
        existing.earnings += parseFloat(wt.amount);
        existing.sales += 1;
      } else {
        dailyEarnings.push({ date, earnings: parseFloat(wt.amount), sales: 1 });
      }
    }

    // Calcular totales
    const totalEarnings = sales.reduce((sum, sale) => sum + parseFloat(sale.artistEarning), 0)
      + walletEarnings.reduce((sum, wt) => sum + parseFloat(wt.amount), 0);
    const totalSales = sales.length + walletEarnings.length;

    return res.json({
      success: true,
      data: {
        dailyEarnings: dailyEarnings.reverse(), // Orden cronológico
        totalEarnings,
        totalSales,
        period: `${days} días`
      }
    });
  } catch (error: any) {
    console.error('Error fetching earnings history:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch earnings history'
    });
  }
});

/**
 * Obtener transacciones del wallet
 */
router.get('/transactions/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit as string) || 50;

    const transactions = await db.select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit);

    return res.json({
      success: true,
      transactions: transactions.map(t => ({
        ...t,
        amount: parseFloat(t.amount),
        balanceBefore: parseFloat(t.balanceBefore),
        balanceAfter: parseFloat(t.balanceAfter)
      }))
    });
  } catch (error: any) {
    console.error('Error fetching wallet transactions:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch transactions'
    });
  }
});

/**
 * Obtener estadísticas de ventas
 */
router.get('/sales-stats/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);

    // Ventas totales
    const allSales = await db.select()
      .from(salesTransactions)
      .where(eq(salesTransactions.artistId, userId));

    const completedSales = allSales.filter(s => s.status === 'completed');
    const pendingSales = allSales.filter(s => s.status === 'pending');

    // Also count non-merchandise wallet earnings (crowdfunding, etc.)
    const walletEarningsTx = await db.select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.userId, userId),
          eq(walletTransactions.type, 'earning'),
          isNull(walletTransactions.relatedSaleId)
        )
      );
    const crowdfundingTotal = walletEarningsTx.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Producto más vendido
    const productSales = completedSales.reduce((acc: any, sale) => {
      const product = sale.productName;
      if (!acc[product]) {
        acc[product] = { count: 0, earnings: 0 };
      }
      acc[product].count += sale.quantity;
      acc[product].earnings += parseFloat(sale.artistEarning);
      return acc;
    }, {});

    const topProduct = Object.entries(productSales)
      .sort((a: any, b: any) => b[1].count - a[1].count)[0];

    const merchRevenue = completedSales.reduce((sum, s) => sum + parseFloat(s.saleAmount), 0);
    const merchEarnings = completedSales.reduce((sum, s) => sum + parseFloat(s.artistEarning), 0);

    return res.json({
      success: true,
      stats: {
        totalSales: completedSales.length + walletEarningsTx.length,
        pendingSales: pendingSales.length,
        totalRevenue: merchRevenue + crowdfundingTotal,
        totalEarnings: merchEarnings + crowdfundingTotal,
        topProduct: topProduct ? {
          name: topProduct[0],
          sales: (topProduct[1] as any).count,
          earnings: (topProduct[1] as any).earnings
        } : null
      }
    });
  } catch (error: any) {
    console.error('Error fetching sales stats:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sales stats'
    });
  }
});

/**
 * GET /api/artist-wallet/overview
 * Owner-only unified earnings dashboard data (KPIs + breakdown + chart + recent).
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const userId = Number(user.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - days);

    const summary = await getPayoutSummary(userId);

    // Earnings (all credits) — wallet is the source of truth for credited money.
    const earningsTx = await db.select()
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.userId, userId),
        eq(walletTransactions.type, 'earning'),
      ))
      .orderBy(desc(walletTransactions.createdAt));

    // Breakdown by source + daily chart (windowed).
    const bySourceMap: Record<string, { source: string; label: string; amount: number; count: number }> = {};
    const dailyMap: Record<string, { date: string; earnings: number; sales: number }> = {};
    for (const tx of earningsTx) {
      const type = (tx.metadata as any)?.type || 'other';
      const amount = parseFloat(tx.amount);
      if (!bySourceMap[type]) bySourceMap[type] = { source: type, label: sourceLabel(type), amount: 0, count: 0 };
      bySourceMap[type].amount = Math.round((bySourceMap[type].amount + amount) * 100) / 100;
      bySourceMap[type].count += 1;
      if (tx.createdAt >= limitDate) {
        const date = tx.createdAt.toISOString().split('T')[0];
        if (!dailyMap[date]) dailyMap[date] = { date, earnings: 0, sales: 0 };
        dailyMap[date].earnings = Math.round((dailyMap[date].earnings + amount) * 100) / 100;
        dailyMap[date].sales += 1;
      }
    }
    const bySource = Object.values(bySourceMap).sort((a, b) => b.amount - a.amount);
    const dailyEarnings = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Recent product sales (merch + memberships etc.).
    const recentSales = await db.select()
      .from(salesTransactions)
      .where(eq(salesTransactions.artistId, userId))
      .orderBy(desc(salesTransactions.createdAt))
      .limit(20);

    // Recent payouts.
    const payouts = await db.select()
      .from(artistPayouts)
      .where(eq(artistPayouts.artistId, userId))
      .orderBy(desc(artistPayouts.requestedAt))
      .limit(20);

    const windowEarnings = dailyEarnings.reduce((s, d) => s + d.earnings, 0);

    return res.json({
      success: true,
      overview: {
        kpis: {
          availableBalance: summary.available,
          pendingPayouts: summary.pending,
          totalEarnings: summary.totalEarnings,
          totalPaidOut: summary.totalPaidOut,
          salesCount: earningsTx.length,
          windowEarnings: Math.round(windowEarnings * 100) / 100,
          windowDays: days,
          currency: summary.currency,
        },
        payoutMethod: summary.payoutMethod,
        payoutAccount: summary.payoutAccount,
        minPayout: summary.minPayout,
        bySource,
        dailyEarnings,
        recentSales: recentSales.map(s => ({
          id: s.id,
          productName: s.productName,
          amount: parseFloat(s.saleAmount),
          earning: parseFloat(s.artistEarning),
          quantity: s.quantity,
          status: s.status,
          buyerEmail: s.buyerEmail,
          createdAt: s.createdAt,
        })),
        payouts: payouts.map(p => ({
          id: p.id,
          amount: parseFloat(p.amount),
          currency: p.currency,
          method: p.method,
          status: p.status,
          reference: p.reference,
          requestedAt: p.requestedAt,
          paidAt: p.paidAt,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error building wallet overview:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to build overview' });
  }
});

/**
 * GET /api/artist-wallet/payouts
 * Owner-only: payout summary + the artist's payout history.
 */
router.get('/payouts', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.id) return res.status(401).json({ success: false, error: 'Authentication required' });
    const userId = Number(user.id);
    if (!Number.isInteger(userId)) return res.status(400).json({ success: false, error: 'Invalid user' });

    const summary = await getPayoutSummary(userId);
    const history = await db.select()
      .from(artistPayouts)
      .where(eq(artistPayouts.artistId, userId))
      .orderBy(desc(artistPayouts.requestedAt))
      .limit(50);

    return res.json({
      success: true,
      summary,
      payouts: history.map(p => ({ ...p, amount: parseFloat(p.amount) })),
    });
  } catch (error: any) {
    console.error('Error fetching payouts:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch payouts' });
  }
});

/**
 * PUT /api/artist-wallet/payout-method
 * Owner-only: set/update the artist's withdrawal method.
 * Body: { method: 'paypal'|'bank'|'wise'|'stripe', account: string, details?: object }
 */
router.put('/payout-method', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.id) return res.status(401).json({ success: false, error: 'Authentication required' });
    const userId = Number(user.id);
    if (!Number.isInteger(userId)) return res.status(400).json({ success: false, error: 'Invalid user' });

    const method = String(req.body?.method || '').toLowerCase();
    const account = String(req.body?.account || '').trim();
    const allowed = ['paypal', 'bank', 'wise', 'stripe'];
    if (!allowed.includes(method)) {
      return res.status(400).json({ success: false, error: `method must be one of ${allowed.join(', ')}` });
    }
    if (!account) return res.status(400).json({ success: false, error: 'account is required' });

    await getWallet(userId);
    await db.update(artistWallet).set({
      payoutMethod: method,
      payoutAccount: account,
      payoutDetails: req.body?.details && typeof req.body.details === 'object' ? req.body.details : null,
      updatedAt: new Date(),
    }).where(eq(artistWallet.userId, userId));

    return res.json({ success: true, payoutMethod: method, payoutAccount: account });
  } catch (error: any) {
    console.error('Error updating payout method:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update payout method' });
  }
});

/**
 * POST /api/artist-wallet/payouts/request
 * Owner-only: request a withdrawal of available balance (min $20).
 * Body: { amount?: number }  (defaults to full available balance)
 */
router.post('/payouts/request', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.id) return res.status(401).json({ success: false, error: 'Authentication required' });
    const userId = Number(user.id);
    if (!Number.isInteger(userId)) return res.status(400).json({ success: false, error: 'Invalid user' });

    const summary = await getPayoutSummary(userId);
    if (!summary.payoutMethod || !summary.payoutAccount) {
      return res.status(400).json({ success: false, error: 'Configura tu método de pago antes de solicitar un retiro', needsMethod: true });
    }

    let amount = req.body?.amount != null ? Math.round(Number(req.body.amount) * 100) / 100 : summary.available;
    if (!Number.isFinite(amount) || amount <= 0) amount = summary.available;

    if (amount < MIN_PAYOUT) {
      return res.status(400).json({ success: false, error: `El retiro mínimo es $${MIN_PAYOUT}` });
    }
    if (amount > summary.available) {
      return res.status(400).json({ success: false, error: `Saldo disponible insuficiente ($${summary.available})`, available: summary.available });
    }

    const [payout] = await db.insert(artistPayouts).values({
      artistId: userId,
      amount: amount.toFixed(2),
      currency: summary.currency,
      method: summary.payoutMethod,
      account: summary.payoutAccount,
      status: 'requested',
      requestedBy: userId,
    }).returning();

    return res.json({ success: true, payout: { ...payout, amount: parseFloat(payout.amount) }, summary: await getPayoutSummary(userId) });
  } catch (error: any) {
    console.error('Error requesting payout:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to request payout' });
  }
});

/**
 * GET /api/artist-wallet/admin/payouts
 * Admin-only: list payout requests (optionally filter by ?status=requested).
 */
router.get('/admin/payouts', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!isAdmin(user)) return res.status(403).json({ success: false, error: 'Admin only' });

    const status = req.query.status as string | undefined;
    const rows = status
      ? await db.select().from(artistPayouts).where(eq(artistPayouts.status, status as any)).orderBy(desc(artistPayouts.requestedAt)).limit(200)
      : await db.select().from(artistPayouts).orderBy(desc(artistPayouts.requestedAt)).limit(200);

    return res.json({ success: true, payouts: rows.map(p => ({ ...p, amount: parseFloat(p.amount) })) });
  } catch (error: any) {
    console.error('Error listing admin payouts:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to list payouts' });
  }
});

/**
 * POST /api/artist-wallet/admin/payouts/:id/settle
 * Admin-only: mark a payout as paid/rejected/approved.
 * Body: { action: 'approve'|'paid'|'reject', reference?: string, notes?: string }
 * On 'paid', deducts the amount from the artist wallet balance and records it.
 */
router.post('/admin/payouts/:id/settle', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!isAdmin(user)) return res.status(403).json({ success: false, error: 'Admin only' });

    const payoutId = parseInt(req.params.id, 10);
    if (isNaN(payoutId)) return res.status(400).json({ success: false, error: 'Invalid payout id' });

    const action = String(req.body?.action || '').toLowerCase();
    if (!['approve', 'paid', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: "action must be 'approve', 'paid' or 'reject'" });
    }

    const [payout] = await db.select().from(artistPayouts).where(eq(artistPayouts.id, payoutId)).limit(1);
    if (!payout) return res.status(404).json({ success: false, error: 'Payout not found' });
    if (payout.status === 'paid' || payout.status === 'rejected') {
      return res.status(409).json({ success: false, error: `Payout already ${payout.status}` });
    }

    const adminId = Number(user.id);
    const reference = typeof req.body?.reference === 'string' ? req.body.reference : null;
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : null;

    if (action === 'approve') {
      await db.update(artistPayouts).set({
        status: 'approved', processedBy: adminId, processedAt: new Date(), notes, reference,
      }).where(eq(artistPayouts.id, payoutId));
      return res.json({ success: true, status: 'approved' });
    }

    if (action === 'reject') {
      await db.update(artistPayouts).set({
        status: 'rejected', processedBy: adminId, processedAt: new Date(), notes, reference,
      }).where(eq(artistPayouts.id, payoutId));
      return res.json({ success: true, status: 'rejected' });
    }

    // action === 'paid' → deduct from wallet balance + record ledger entry.
    const amount = parseFloat(payout.amount);
    const wallet = await getWallet(payout.artistId);
    const balanceBefore = parseFloat(wallet.balance);
    if (amount > balanceBefore) {
      return res.status(409).json({ success: false, error: `Wallet balance ($${balanceBefore}) is lower than payout ($${amount})` });
    }
    const balanceAfter = Math.round((balanceBefore - amount) * 100) / 100;
    const totalPaidOut = Math.round((parseFloat(wallet.totalPaidOut || '0') + amount) * 100) / 100;

    await db.update(artistWallet).set({
      balance: balanceAfter.toFixed(2),
      totalPaidOut: totalPaidOut.toFixed(2),
      updatedAt: new Date(),
    }).where(eq(artistWallet.userId, payout.artistId));

    await db.insert(walletTransactions).values({
      userId: payout.artistId,
      type: 'adjustment',
      amount: (-amount).toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      description: `Retiro pagado (${payout.method || 'manual'})${reference ? ` · ref ${reference}` : ''}`,
      metadata: { type: 'payout', payoutId, reference },
    });

    await db.update(artistPayouts).set({
      status: 'paid', processedBy: adminId, processedAt: new Date(), paidAt: new Date(), reference, notes,
    }).where(eq(artistPayouts.id, payoutId));

    return res.json({ success: true, status: 'paid', balanceAfter });
  } catch (error: any) {
    console.error('Error settling payout:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to settle payout' });
  }
});

export default router;
