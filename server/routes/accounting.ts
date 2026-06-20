import { Router, Request, Response } from "express";
import { db } from "../db";
import { transactions, users } from "../db/schema";
import { eq, gte, desc, sql } from "drizzle-orm";
import { requireAdmin } from '../middleware/require-admin';

const router = Router();
router.use(requireAdmin);

// GET accounting statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { days = "30" } = req.query;
    const daysNum = parseInt(days as string);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    // Revenue by type
    const revenueByType = await db
      .select({
        type: transactions.type,
        count: sql<number>`cast(count(*) as integer)`,
        total: sql<string>`coalesce(sum(${transactions.netAmount})::text, '0')`,
        gross: sql<string>`coalesce(sum(${transactions.amount})::text, '0')`,
        tax: sql<string>`coalesce(sum(${transactions.taxAmount})::text, '0')`,
        discount: sql<string>`coalesce(sum(${transactions.discountAmount})::text, '0')`
      })
      .from(transactions)
      .where(gte(transactions.createdAt, startDate))
      .groupBy(transactions.type)
      .catch(() => []);

    // Daily revenue trend
    const dailyTrend = await db
      .select({
        date: sql<string>`date(${transactions.createdAt})`,
        total: sql<string>`coalesce(sum(${transactions.netAmount})::text, '0')`,
        count: sql<number>`cast(count(*) as integer)`
      })
      .from(transactions)
      .where(gte(transactions.createdAt, startDate))
      .groupBy(sql`date(${transactions.createdAt})`)
      .orderBy(sql`date(${transactions.createdAt})`)
      .catch(() => []);

    // Top customers
    const topCustomers = await db
      .select({
        userId: transactions.userId,
        userName: users.firstName,
        userEmail: users.email,
        totalSpent: sql<string>`coalesce(sum(${transactions.netAmount})::text, '0')`,
        transactionCount: sql<number>`cast(count(*) as integer)`
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .where(gte(transactions.createdAt, startDate))
      .groupBy(transactions.userId, users.id)
      .orderBy(sql`sum(${transactions.netAmount}) desc`)
      .limit(10)
      .catch(() => []);

    // Total stats
    const totals = await db
      .select({
        totalRevenue: sql<string>`coalesce(sum(${transactions.netAmount})::text, '0')`,
        totalGross: sql<string>`coalesce(sum(${transactions.amount})::text, '0')`,
        totalTransactions: sql<number>`cast(count(*) as integer)`,
        completedTransactions: sql<number>`cast(sum(case when ${transactions.paymentStatus} = 'completed' then 1 else 0 end) as integer)`,
        totalTax: sql<string>`coalesce(sum(${transactions.taxAmount})::text, '0')`,
        totalDiscount: sql<string>`coalesce(sum(${transactions.discountAmount})::text, '0')`,
        avgTransactionValue: sql<string>`coalesce(avg(${transactions.netAmount})::text, '0')`
      })
      .from(transactions)
      .where(gte(transactions.createdAt, startDate))
      .catch(() => []);

    res.json({
      success: true,
      period: `Last ${daysNum} days`,
      totals: totals[0] || { totalRevenue: '0', totalGross: '0', totalTransactions: 0, completedTransactions: 0, totalTax: '0', totalDiscount: '0', avgTransactionValue: '0' },
      revenueByType,
      dailyTrend,
      topCustomers
    });
  } catch (error) {
    console.error("Error fetching accounting stats:", error);
    res.status(500).json({ error: "Error fetching accounting stats" });
  }
});

// GET recent transactions
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const { limit = "20" } = req.query;

    const recent = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        description: transactions.description,
        amount: transactions.amount,
        netAmount: transactions.netAmount,
        paymentStatus: transactions.paymentStatus,
        paymentMethod: transactions.paymentMethod,
        userName: users.firstName,
        userEmail: users.email,
        createdAt: transactions.createdAt
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .orderBy(desc(transactions.createdAt))
      .limit(parseInt(limit as string))
      .catch(() => []);

    res.json({ success: true, transactions: recent });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Error fetching transactions" });
  }
});

// POST create transaction
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      userId,
      type,
      description,
      amount,
      paymentMethod,
      paymentStatus = "completed",
      taxAmount = 0,
      discountAmount = 0
    } = req.body;

    const netAmount = (parseFloat(amount) + parseFloat(taxAmount) - parseFloat(discountAmount)).toFixed(2);

    const result = await db
      .insert(transactions)
      .values({
        userId: userId || null,
        type,
        description,
        amount,
        netAmount,
        paymentMethod,
        paymentStatus,
        taxAmount,
        discountAmount
      })
      .returning();

    res.json({ success: true, transaction: result[0] });
  } catch (error) {
    console.error("Error creating transaction:", error);
    res.status(500).json({ error: "Error creating transaction" });
  }
});

// GET CSV export
router.get("/export/csv", async (req: Request, res: Response) => {
  try {
    const { days = "30" } = req.query;
    const daysNum = parseInt(days as string);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const data = await db
      .select({
        id: transactions.id,
        date: transactions.createdAt,
        type: transactions.type,
        description: transactions.description,
        amount: transactions.amount,
        tax: transactions.taxAmount,
        discount: transactions.discountAmount,
        netAmount: transactions.netAmount,
        paymentStatus: transactions.paymentStatus,
        paymentMethod: transactions.paymentMethod,
        userName: users.firstName,
        userEmail: users.email
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .where(gte(transactions.createdAt, startDate))
      .orderBy(desc(transactions.createdAt))
      .catch(() => []);

    const csv = [
      ['Date', 'Type', 'Description', 'Amount', 'Tax', 'Discount', 'Net Amount', 'Status', 'Method', 'Customer', 'Email'].join(','),
      ...data.map(row => [
        new Date(row.date).toISOString().split('T')[0],
        row.type,
        `"${row.description}"`,
        row.amount,
        row.tax,
        row.discount,
        row.netAmount,
        row.paymentStatus,
        row.paymentMethod || '',
        row.userName || 'N/A',
        row.userEmail || ''
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="accounting-report-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    res.status(500).json({ error: "Error exporting CSV" });
  }
});

export default router;
