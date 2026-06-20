#!/usr/bin/env node
/**
 * Backfill: ensure every Firestore /merchandise doc has a matching row in PG `merchandise`.
 *
 * Iterates Firestore merchandise where pgId is missing (or doc lacks pgId field),
 * POSTs to local /api/merch/sync-pg, and writes the returned pgId back to Firestore.
 *
 * Usage:
 *   node scripts/backfill-firestore-merch-to-pg.mjs
 *
 * Env required: GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT
 */
import 'dotenv/config';
import admin from 'firebase-admin';

const API_BASE = process.env.API_BASE || 'http://localhost:5000';

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

function categoryFromType(productType) {
  if (!productType) return 'other';
  const t = String(productType).toLowerCase();
  if (['t-shirt', 'hoodie', 'tank', 'sweatshirt'].some(k => t.includes(k))) return 'apparel';
  if (['cap', 'hat', 'sticker', 'poster'].some(k => t.includes(k))) return 'accessories';
  if (['vinyl', 'cd', 'mug'].some(k => t.includes(k))) return 'music';
  return 'other';
}

async function main() {
  console.log('🔍 Scanning Firestore /merchandise collection...');
  const snap = await db.collection('merchandise').get();
  console.log(`Found ${snap.size} docs total`);

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const d = doc.data();

    if (d.pgId) {
      skipped++;
      continue;
    }

    const userId = Number(d.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      console.warn(`⚠️ Skipping ${doc.id}: invalid userId (${d.userId})`);
      failed++;
      continue;
    }

    if (!d.name || !Number.isFinite(Number(d.price)) || !d.imageUrl) {
      console.warn(`⚠️ Skipping ${doc.id}: missing required fields`);
      failed++;
      continue;
    }

    try {
      const res = await fetch(`${API_BASE}/api/merch/sync-pg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: d.name,
          description: d.description || '',
          price: Number(d.price),
          imageUrl: d.imageUrl,
          productionCost: d.productionCost ?? Number(d.price) * 0.4,
          category: categoryFromType(d.productType || d.type),
          isAvailable: d.isAvailable !== false,
          firestoreDocId: doc.id,
        }),
      });
      const json = await res.json();
      if (json.success && json.pgId) {
        await doc.ref.update({ pgId: json.pgId });
        console.log(`✅ ${doc.id} → pgId ${json.pgId} (${json.action})`);
        synced++;
      } else {
        console.error(`❌ ${doc.id} sync failed:`, json.error);
        failed++;
      }
    } catch (err) {
      console.error(`❌ ${doc.id} error:`, err.message);
      failed++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Done. Synced: ${synced} · Skipped: ${skipped} · Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
