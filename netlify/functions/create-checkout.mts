/**
 * Netlify Function: create-checkout.mts
 *
 * Creates a Stripe Checkout session for Boostify Print merchandise.
 * Collects shipping address + payment, passes all merch metadata.
 *
 * POST body:
 *   { productName, productPrice, productImage, artistName, productId, productType, size }
 *
 * Returns: { success, sessionId, url }
 */

import type { Context } from "@netlify/functions";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;

// Product variant lookup (same map as webhook)
const VARIANT_MAP: Record<string, Record<string, number>> = {
  "T-Shirt": { S: 4017, M: 4018, L: 4019, XL: 4020, "2XL": 4025 },
  Hoodie: { S: 24985, M: 24986, L: 24987, XL: 24988, "2XL": 24991 },
  Cap: { "One size": 15904 },
  Poster: { '16.5×23.4″ (A2)': 19528, '23.4×33.1″ (A1)': 19527 },
  "Sticker Pack": { '3×3″': 10163, '4×4″': 10164, '5.5×5.5″': 10165 },
  Mug: { "11 oz": 1320, "15 oz": 4830 },
  ArtistCard: { "5 cards": 10164, "10 cards": 10164, "25 cards": 10164 },
};

function resolvePrintfulVariantId(productType: string, size: string): number | null {
  const typeMap = VARIANT_MAP[productType];
  if (!typeMap) return null;
  return typeMap[size] ?? Object.values(typeMap)[0] ?? null;
}

export default async (req: Request, _context: Context) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await req.json();
    const {
      productName,
      productPrice,
      productImage,
      artistName,
      productId,
      productType,
      size,
      quantity,
      profileUrl,
    } = body;

    if (!productName || !productPrice) {
      return Response.json(
        { success: false, error: "productName and productPrice are required" },
        { status: 400 }
      );
    }

    const printfulVariantId = resolvePrintfulVariantId(productType, size);
    const priceInCents = Math.round(Number(productPrice) * 100);

    const BASE_URL = process.env.PRODUCTION_URL || "https://boostifymusic.com";

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-01-27.acacia" as any,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${productName}${size ? ` — Size: ${size}` : ""}`,
              description: `${artistName} Official Merchandise`,
              images: productImage ? [productImage] : undefined,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      shipping_address_collection: {
        allowed_countries: [
          "US", "CA", "GB", "DE", "FR", "ES", "IT", "AU", "MX", "BR", "JP",
          "NL", "PT", "BE", "AT", "CH", "SE", "NO", "DK", "FI", "IE", "PL",
          "CZ", "RO", "HU", "GR", "CL", "CO", "AR", "PE",
        ],
      },
      // ── metadata that the webhook will consume ──
      metadata: {
        type: "merchandise",
        productId: productId || "",
        productType: productType || "",
        productImage: productImage || "",
        artistName: artistName || "",
        size: size || "",
        price: String(productPrice),
        printfulVariantId: printfulVariantId ? String(printfulVariantId) : "",
        quantity: quantity ? String(quantity) : "1",
        profileUrl: profileUrl || "",
      },
      success_url: `${BASE_URL}/artist/${encodeURIComponent(artistName)}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/artist/${encodeURIComponent(artistName)}?canceled=true`,
    });

    console.log(`✅ Checkout session created: ${session.id} | ${productType} (${size}) for ${artistName}`);

    return Response.json(
      { success: true, sessionId: session.id, url: session.url },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Error creating checkout session:", error);
    return Response.json(
      { success: false, error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
};
