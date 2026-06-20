import { Router } from "express";
import Stripe from "stripe";
import { notifyOwnerOfLead, sendLeadConfirmationEmail } from "../services/holosuit-investor-email";

const router = Router();

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY not set — HoloSuit invest endpoint will not create real checkouts");
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-04-30.basil" })
  : null;

const TIER_NAMES: Record<string, string> = {
  seed: "HoloSuit Seed Backer — $1,000",
  pioneer: "HoloSuit Pioneer — $5,000",
  partner: "HoloSuit Strategic Partner — $25,000",
  lead: "HoloSuit Lead Investor — $100,000",
};

const TIER_AMOUNTS: Record<string, number> = {
  seed: 100000,    // $1,000 in cents
  pioneer: 500000,  // $5,000
  partner: 2500000, // $25,000
  lead: 10000000,   // $100,000
};

// POST /api/holosuit/invest
// Body: { name, email, company, message, tier, amount }
// Returns: { url } — Stripe Checkout session URL, or { success: true } fallback
router.post("/invest", async (req, res) => {
  try {
    const { name, email, company, message, tier } = req.body as {
      name: string;
      email: string;
      company?: string;
      message?: string;
      tier: string;
    };

    if (!name || !email || !tier) {
      return res.status(400).json({ error: "name, email and tier are required" });
    }

    if (!TIER_AMOUNTS[tier]) {
      return res.status(400).json({ error: "Invalid investment tier" });
    }

    // Log the expression of interest regardless of Stripe availability
    console.log(`💎 HoloSuit invest interest: ${name} <${email}> tier=${tier} company=${company ?? "—"}`);

    // Fire-and-forget: notify owner + send confirmation to investor
    notifyOwnerOfLead({ name, email, company, tier, message, source: "form" }).catch(console.error);
    sendLeadConfirmationEmail({ name, email, tier }).catch(console.error);

    if (!stripe) {
      // Stripe not configured — return success so form shows confirmation
      return res.json({ success: true, message: "Interest recorded. Our team will reach out within 48 hours." });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: TIER_NAMES[tier] ?? `HoloSuit Investment — ${tier}`,
              description: `Boostify HoloSuit investment tier. Launching June 2027. ${message ?? ""}`.trim(),
              images: ["https://boostify.com/holosuit/SSPII.webp"],
            },
            unit_amount: TIER_AMOUNTS[tier],
          },
          quantity: 1,
        },
      ],
      metadata: {
        investor_name: name,
        investor_email: email,
        investor_company: company ?? "",
        investor_message: message ?? "",
        investment_tier: tier,
        product: "holosuit",
      },
      success_url: `${process.env.APP_URL ?? "http://localhost:5173"}/holosuit?invested=true`,
      cancel_url: `${process.env.APP_URL ?? "http://localhost:5173"}/holosuit`,
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("HoloSuit invest endpoint error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// GET /api/holosuit/stats — public fundraising stats
router.get("/stats", (_req, res) => {
  res.json({
    raised: 145000,
    goal: 500000,
    investors: 38,
    daysLeft: 127,
    launchDate: "June 2027",
  });
});

export default router;
