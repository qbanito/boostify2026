import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { userCredits, creditTransactions } from '../../db/schema';
import { getCreditCostFromUsd, getUserBalance } from './credit-engine';
import { recordProviderSpend } from './treasury-engine';

/** Same platform pricing, balance and ledger; the stage key prevents duplicate charges/refunds. */
export async function settleTourCredits(email: string, operationId: string, costUsd: number, refund = false) {
  const balance = await getUserBalance(email);
  if (balance.isAdmin) return { credits: 0, remaining: balance.credits };
  const cost = await getCreditCostFromUsd(costUsd);
  const chargeDescription = `World Tour stage [${operationId}]`;
  const refundDescription = `World Tour refund [${operationId}]`;
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`world-tour:${email}:${operationId}`}))`);
    const [charged] = await tx.select().from(creditTransactions).where(and(
      eq(creditTransactions.userEmail, email), eq(creditTransactions.description, chargeDescription),
      eq(creditTransactions.type, 'deduction'),
    )).limit(1);
    if (refund) {
      const [refunded] = await tx.select().from(creditTransactions).where(and(
        eq(creditTransactions.userEmail, email), eq(creditTransactions.description, refundDescription),
        eq(creditTransactions.type, 'refund'),
      )).limit(1);
      if (!charged || refunded) return { credits: 0, remaining: balance.credits };
      const amount = Math.abs(charged.amount);
      const [updated] = await tx.update(userCredits).set({ credits: sql`${userCredits.credits} + ${amount}`, updatedAt: new Date() })
        .where(eq(userCredits.userEmail, email)).returning();
      if (!updated) throw new Error('Credit account unavailable.');
      await tx.insert(creditTransactions).values({ userEmail: email, amount, type: 'refund', description: refundDescription });
      return { credits: amount, remaining: updated.credits };
    }
    if (charged) return { credits: Math.abs(charged.amount), remaining: balance.credits };
    const [updated] = await tx.update(userCredits).set({ credits: sql`${userCredits.credits} - ${cost}`, updatedAt: new Date() })
      .where(sql`${userCredits.userEmail} = ${email} AND ${userCredits.credits} >= ${cost}`).returning();
    if (!updated) throw new Error(`Insufficient credits. This stage needs ${cost} credits.`);
    const [ledger] = await tx.insert(creditTransactions).values({ userEmail: email, amount: -cost, type: 'deduction', description: chargeDescription }).returning();
    return { credits: cost, remaining: updated.credits, newChargeId: ledger.id };
  });
  if ('newChargeId' in result) void recordProviderSpend(costUsd, { provider: 'fal', source: 'World Tour Studio', refId: String(result.newChargeId) });
  return result;
}
