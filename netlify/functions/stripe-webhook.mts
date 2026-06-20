/**
 * Netlify Function: stripe-webhook.mts
 * 
 * Handles Stripe checkout.session.completed for Boostify Print merchandise:
 * 1. Saves order in Firestore (/orders)
 * 2. Creates order in Printful (confirm=true → production starts immediately)
 * 3. Sends confirmation email via Resend
 * 
 * Metadata from Stripe session:
 *   { printfulVariantId, size, productId, price, productType, artistName, productImage }
 */

import type { Context } from "@netlify/functions";
import Stripe from "stripe";

// ─── Env vars ────────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET_NETLIFY || process.env.STRIPE_WEBHOOK_SECRET!;
const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN!;
const PRINTFUL_STORE_ID = process.env.PRINTFUL_STORE_ID!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;

// Firebase Admin
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID!;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL!;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";

// ─── Firebase Admin (lazy init) ──────────────────────────────────────────────
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getFirestoreDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY,
      }),
    });
  }
  return getFirestore();
}

// ─── Product mapping (inline so the function is self-contained) ──────────────
interface ProductMapping {
  displayName: string;
  printfulCatalogId: number;
  retailPrice: number;
  technique: "dtg" | "embroidery" | "sublimation" | "poster";
  variants: { variantId: number; size: string; color: string; productionCost: number }[];
}

const PRODUCT_MAP: Record<string, ProductMapping> = {
  "T-Shirt": {
    displayName: "Premium T-Shirt",
    printfulCatalogId: 71,
    retailPrice: 29.99,
    technique: "dtg",
    variants: [
      { variantId: 4017, size: "S", color: "Black", productionCost: 11.69 },
      { variantId: 4018, size: "M", color: "Black", productionCost: 11.69 },
      { variantId: 4019, size: "L", color: "Black", productionCost: 11.69 },
      { variantId: 4020, size: "XL", color: "Black", productionCost: 11.69 },
      { variantId: 4025, size: "2XL", color: "Black", productionCost: 13.69 },
    ],
  },
  Hoodie: {
    displayName: "Premium Hoodie",
    printfulCatalogId: 380,
    retailPrice: 54.99,
    technique: "dtg",
    variants: [
      { variantId: 24985, size: "S", color: "Black", productionCost: 27.29 },
      { variantId: 24986, size: "M", color: "Black", productionCost: 27.29 },
      { variantId: 24987, size: "L", color: "Black", productionCost: 27.29 },
      { variantId: 24988, size: "XL", color: "Black", productionCost: 27.29 },
      { variantId: 24991, size: "2XL", color: "Black", productionCost: 29.29 },
    ],
  },
  Cap: {
    displayName: "Trucker Cap",
    printfulCatalogId: 627,
    retailPrice: 27.99,
    technique: "embroidery",
    variants: [
      { variantId: 15904, size: "One size", color: "Black", productionCost: 11.95 },
    ],
  },
  Poster: {
    displayName: "Art Poster",
    printfulCatalogId: 1,
    retailPrice: 19.99,
    technique: "poster",
    variants: [
      { variantId: 19528, size: '16.5×23.4″ (A2)', color: "White", productionCost: 12.64 },
      { variantId: 19527, size: '23.4×33.1″ (A1)', color: "White", productionCost: 16.89 },
    ],
  },
  "Sticker Pack": {
    displayName: "Kiss-Cut Stickers",
    printfulCatalogId: 358,
    retailPrice: 4.99,
    technique: "sublimation",
    variants: [
      { variantId: 10163, size: '3×3″', color: "White", productionCost: 2.29 },
      { variantId: 10164, size: '4×4″', color: "White", productionCost: 2.49 },
      { variantId: 10165, size: '5.5×5.5″', color: "White", productionCost: 2.99 },
    ],
  },
  Mug: {
    displayName: "Ceramic Mug",
    printfulCatalogId: 19,
    retailPrice: 16.99,
    technique: "sublimation",
    variants: [
      { variantId: 1320, size: "11 oz", color: "White", productionCost: 5.95 },
      { variantId: 4830, size: "15 oz", color: "White", productionCost: 7.95 },
    ],
  },
  ArtistCard: {
    displayName: "Artist Card (Premium Vinyl)",
    printfulCatalogId: 358,
    retailPrice: 19.99,
    technique: "sublimation",
    variants: [
      { variantId: 10164, size: "4×4″", color: "White", productionCost: 2.49 },
    ],
  },
};

function getVariant(productType: string, size: string) {
  const mapping = PRODUCT_MAP[productType];
  if (!mapping) return null;
  return mapping.variants.find((v) => v.size === size) ?? mapping.variants[0];
}

// ─── Printful helper ─────────────────────────────────────────────────────────
async function createPrintfulOrder(payload: {
  externalId: string;
  recipient: {
    name: string;
    address1: string;
    city: string;
    stateCode: string;
    countryCode: string;
    zip: string;
    email: string;
  };
  variantId: number;
  quantity: number;
  retailPrice: string;
  itemName: string;
  designUrl: string;
  fileType: string;
}) {
  const body = {
    external_id: payload.externalId,
    shipping: "STANDARD",
    recipient: {
      name: payload.recipient.name,
      address1: payload.recipient.address1,
      city: payload.recipient.city,
      state_code: payload.recipient.stateCode,
      country_code: payload.recipient.countryCode,
      zip: payload.recipient.zip,
      email: payload.recipient.email,
    },
    items: [
      {
        variant_id: payload.variantId,
        quantity: payload.quantity,
        retail_price: payload.retailPrice,
        name: payload.itemName,
        files: [{ url: payload.designUrl, type: payload.fileType }],
      },
    ],
  };

  // confirm=true → production starts immediately
  const res = await fetch("https://api.printful.com/orders?confirm=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PRINTFUL_API_TOKEN}`,
      "X-PF-Store-Id": PRINTFUL_STORE_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Printful API error ${res.status}: ${errorBody}`);
  }

  const data = await res.json();
  return data.result as { id: number; status: string; external_id: string };
}

// ─── Resend email helper ─────────────────────────────────────────────────────
async function sendOrderConfirmationEmail(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  productName: string;
  size: string;
  price: string;
  artistName: string;
  productImage: string;
}) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#0a0a0a;color:#ffffff;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-size:28px;margin:0;background:linear-gradient(135deg,#FF6B00,#FF8C38);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
        🎉 Order Confirmed!
      </h1>
      <p style="color:#888;margin-top:8px;">Thanks for supporting ${params.artistName}</p>
    </div>

    <!-- Product Card -->
    <div style="background:#1a1a1a;border-radius:16px;border:1px solid #333;overflow:hidden;margin-bottom:24px;">
      ${params.productImage ? `<img src="${params.productImage}" alt="${params.productName}" style="width:100%;height:250px;object-fit:cover;"/>` : ""}
      <div style="padding:24px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#fff;">${params.productName}</h2>
        <p style="margin:0 0 4px;color:#aaa;">Size: <strong style="color:#FF6B00;">${params.size}</strong></p>
        <p style="margin:0;color:#aaa;">Price: <strong style="color:#FF6B00;">$${params.price}</strong></p>
      </div>
    </div>

    <!-- Order Details -->
    <div style="background:#1a1a1a;border-radius:16px;border:1px solid #333;padding:24px;margin-bottom:24px;">
      <h3 style="margin:0 0 16px;color:#FF6B00;">Order Details</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#888;">Order #</td><td style="padding:8px 0;text-align:right;color:#fff;">${params.orderNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#888;">Artist</td><td style="padding:8px 0;text-align:right;color:#fff;">${params.artistName}</td></tr>
        <tr style="border-top:1px solid #333;"><td style="padding:12px 0;color:#888;font-weight:bold;">Total</td><td style="padding:12px 0;text-align:right;color:#FF6B00;font-weight:bold;font-size:18px;">$${params.price}</td></tr>
      </table>
    </div>

    <!-- Status -->
    <div style="background:linear-gradient(135deg,#1a2a1a,#0a0a0a);border-radius:16px;border:1px solid #2a4a2a;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;color:#4ade80;">✅ Your order is being produced!</p>
      <p style="margin:8px 0 0;color:#888;font-size:14px;">You'll receive tracking info once it ships.</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#666;font-size:12px;">
      <p>Boostify Music — Empowering Artists Worldwide</p>
      <p><a href="https://boostifymusic.com" style="color:#FF6B00;text-decoration:none;">boostifymusic.com</a></p>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Boostify Music <info@boostifymusic.com>",
      to: [params.to],
      subject: `🛍️ Order Confirmed — ${params.productName}`,
      html,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Resend error:", errorBody);
  }

  return res.ok;
}

// ─── Main handler ────────────────────────────────────────────────────────────
export default async (req: Request, _context: Context) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, stripe-signature",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  // ── 1. Verify Stripe signature ───────────────────────────────────────────
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" as any });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("⚠️ Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  // ── 2. Only handle checkout.session.completed for merchandise ────────────
  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata ?? {};

  if (metadata.type !== "merchandise") {
    // Not a merch purchase — let it pass through
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  console.log(`🛍️ Processing merch order: ${metadata.productType} (${metadata.size}) for ${metadata.artistName}`);

  const {
    productType = "",
    size = "",
    artistName = "",
    productImage = "",
    productId = "",
    printfulVariantId = "",
    price = "",
    quantity: quantityStr = "1",
    profileUrl = "",
  } = metadata;

  const orderQuantity = parseInt(quantityStr, 10) || 1;

  const mapping = PRODUCT_MAP[productType];
  if (!mapping) {
    console.error(`❌ Unknown product type: ${productType}`);
    return new Response(JSON.stringify({ error: `Unknown product type: ${productType}` }), { status: 400 });
  }

  // Resolve variant — prefer explicit printfulVariantId, fall back to size lookup
  const variantId = printfulVariantId
    ? parseInt(printfulVariantId, 10)
    : getVariant(productType, size)?.variantId;

  if (!variantId) {
    console.error(`❌ No variant found for ${productType} / ${size}`);
    return new Response(JSON.stringify({ error: "No matching variant" }), { status: 400 });
  }

  const variant = mapping.variants.find((v) => v.variantId === variantId) ?? mapping.variants[0];
  const retailPrice = price || String(mapping.retailPrice);
  const customerEmail = session.customer_details?.email ?? "";
  const customerName = session.customer_details?.name ?? "Customer";

  // Shipping from Stripe
  const shipping = session.shipping_details ?? session.customer_details;
  const address = shipping?.address;

  const orderNumber = `BST-${Date.now().toString(36).toUpperCase()}`;

  // ── 3. Save order in Firestore /orders ───────────────────────────────────
  let firestoreOrderId = "";
  try {
    const db = getFirestoreDb();
    const orderRef = await db.collection("orders").add({
      orderNumber,
      stripeSessionId: session.id,
      stripePaymentIntent: session.payment_intent,
      customerEmail,
      customerName,
      shippingAddress: address
        ? {
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postalCode: address.postal_code,
            country: address.country,
          }
        : null,
      product: {
        productId,
        productType,
        displayName: `${artistName} ${mapping.displayName}`,
        size: variant.size,
        quantity: orderQuantity,
        price: parseFloat(retailPrice),
        productImage,
        artistName,
      },
      printful: {
        variantId,
        status: "pending", // will update after Printful call
      },
      status: "paid",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    firestoreOrderId = orderRef.id;
    console.log(`✅ Firestore order saved: ${firestoreOrderId}`);
  } catch (err) {
    console.error("❌ Firestore save failed:", err);
    // Continue — don't block Printful order on Firestore failure
  }

  // ── 4. Create Printful order (confirm=true → production starts) ──────────
  let printfulOrderId: number | null = null;
  try {
    const fileType = mapping.technique === "embroidery" ? "embroidery_front" : "default";

    const printfulOrder = await createPrintfulOrder({
      externalId: `stripe-${session.id}`,
      recipient: {
        name: customerName,
        address1: address?.line1 ?? "",
        city: address?.city ?? "",
        stateCode: address?.state ?? "",
        countryCode: address?.country ?? "US",
        zip: address?.postal_code ?? "",
        email: customerEmail,
      },
      variantId,
      quantity: orderQuantity,
      retailPrice,
      itemName: `${artistName} ${mapping.displayName}`,
      designUrl: productImage,
      fileType,
    });

    printfulOrderId = printfulOrder.id;
    console.log(`✅ Printful order created & confirmed: #${printfulOrderId} (${printfulOrder.status})`);

    // Update Firestore with Printful details
    if (firestoreOrderId) {
      const db = getFirestoreDb();
      await db.collection("orders").doc(firestoreOrderId).update({
        "printful.orderId": printfulOrderId,
        "printful.status": printfulOrder.status,
        status: "in_production",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    console.error("❌ Printful order failed:", err);
    // Update Firestore with error
    if (firestoreOrderId) {
      try {
        const db = getFirestoreDb();
        await db.collection("orders").doc(firestoreOrderId).update({
          "printful.status": "error",
          "printful.error": String(err),
          status: "printful_error",
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch { /* best effort */ }
    }
  }

  // ── 5. Update Firestore merchandise salesCount ───────────────────────────
  if (productId) {
    try {
      const db = getFirestoreDb();
      const merchRef = db.collection("merchandise").doc(productId);
      const doc = await merchRef.get();
      if (doc.exists) {
        await merchRef.update({
          salesCount: FieldValue.increment(1),
          lastSoldAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("⚠️ Failed to update merchandise salesCount:", err);
    }
  }

  // ── 6. Send confirmation email via Resend ────────────────────────────────
  if (customerEmail) {
    try {
      await sendOrderConfirmationEmail({
        to: customerEmail,
        customerName,
        orderNumber,
        productName: `${artistName} ${mapping.displayName}`,
        size: variant.size,
        price: retailPrice,
        artistName,
        productImage,
      });
      console.log(`✅ Confirmation email sent to ${customerEmail}`);
    } catch (err) {
      console.error("⚠️ Failed to send confirmation email:", err);
    }
  }

  console.log(`🎉 Merch order fully processed: ${orderNumber} | Printful #${printfulOrderId ?? "N/A"}`);

  return new Response(
    JSON.stringify({
      received: true,
      orderNumber,
      printfulOrderId,
      firestoreOrderId,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
