import { Router, Request, Response } from "express";
import { db } from "../db";
import { notifications, users } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

// GET Stripe events log for admin
router.get("/", async (req: Request, res: Response) => {
  try {
    const events = await db
      .select({
        id: notifications.id,
        userId: users.id,
        userEmail: users.email,
        userName: users.firstName,
        eventType: notifications.type,
        planTier: sql<string>`(${notifications.metadata}->'tier')::text`,
        amount: sql<number>`(${notifications.metadata}->'amount')::numeric`,
        currency: sql<string>`coalesce((${notifications.metadata}->'currency')::text, 'USD')`,
        status: sql<string>`case 
          when ${notifications.type} in ('PAYMENT_SUCCESS', 'SUBSCRIPTION_CREATED') then 'succeeded'
          when ${notifications.type} = 'PAYMENT_FAILED' then 'failed'
          when ${notifications.type} = 'PLAN_CHANGED' then 'pending'
          else 'unknown'
        end`,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.userId, users.id))
      .where(
        sql`${notifications.type} in ('PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'SUBSCRIPTION_CREATED', 'PLAN_CHANGED')`
      )
      .orderBy(desc(notifications.createdAt))
      .limit(500)
      .catch((error) => {
        console.error("Error querying Stripe events:", error);
        return [];
      });

    // Clean up the response - remove null amounts and format properly
    const cleanedEvents = events
      .map((event) => ({
        id: event.id,
        userId: event.userId || "unknown",
        userEmail: event.userEmail || "unknown@example.com",
        userName: event.userName || "Unknown User",
        eventType: event.eventType,
        planTier: event.planTier?.replace(/"/g, "") || "N/A",
        amount: event.amount ? parseFloat(event.amount.toString()) : 0,
        currency: event.currency?.replace(/"/g, "") || "USD",
        status: event.status,
        createdAt: event.createdAt,
      }))
      .filter((e) => e.amount > 0 || e.eventType === "PLAN_CHANGED"); // Filter out events without amounts, except plan changes

    res.json({
      success: true,
      events: cleanedEvents,
      total: cleanedEvents.length,
    });
  } catch (error) {
    console.error("Error fetching Stripe events:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching Stripe events",
    });
  }
});

export default router;
