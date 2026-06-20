/**
 * ============================================================
 *  PRINTFUL PRINTFILES — REAL GEOMETRY CACHE
 * ============================================================
 *
 * Reemplaza las geometrías "adivinadas" por categoría con las
 * dimensiones REALES que Printful publica en
 *   GET /mockup-generator/printfiles/{productId}
 *
 * Los printfiles definen el área de impresión EXACTA por
 * placement (front, back, sleeve_left, embroidery_chest_left,
 * default, etc.) para cada variante de un producto.
 *
 * Cache:
 *   - Memoria: Map por productId (TTL 24 h)
 *   - Firestore: `printfulPrintfiles/{productId}` (TTL 7 d)
 *   - El API de Printful raramente cambia estas specs.
 *
 * Geometría devuelta lista para `createMockupTask`:
 *   { area_width, area_height, width, height, top, left }
 * con auto-fit (90 % del área manteniendo aspect ratio).
 */

import { getPrintfulService } from './printful-service';

// ─────────────────────────────────────────────────────────────
// TYPES (subset of Printful response we use)
// ─────────────────────────────────────────────────────────────

interface PrintfileSpec {
  printfile_id: number;
  width: number;          // px at the listed DPI
  height: number;
  dpi: number;
  fill_mode?: string;     // 'cover' | 'contain' | ...
  can_rotate?: boolean;
}

interface VariantPrintfileMap {
  variant_id: number;
  placements: Record<string, number>; // placement -> printfile_id
}

export interface PrintfulPrintfilesResponse {
  product_id: number;
  available_placements?: Record<string, string>;
  printfiles: PrintfileSpec[];
  variant_printfiles: VariantPrintfileMap[];
  fetchedAt?: string;
}

export interface RealPlacementGeometry {
  area_width: number;
  area_height: number;
  width: number;
  height: number;
  top: number;
  left: number;
  /** kept for diagnostics */
  printfile_id?: number;
  dpi?: number;
  source: 'printful-real' | 'fallback';
}

// ─────────────────────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────────────────────

const MEMORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const FIRESTORE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 d
const memoryCache = new Map<number, { fetchedAt: number; data: PrintfulPrintfilesResponse }>();

async function loadFromFirestore(productId: number): Promise<PrintfulPrintfilesResponse | null> {
  try {
    const { db } = await import('../firebase');
    if (!db) return null;
    const snap = await db.collection('printfulPrintfiles').doc(String(productId)).get();
    if (!snap.exists) return null;
    const data = snap.data() as PrintfulPrintfilesResponse | undefined;
    if (!data || !data.fetchedAt) return null;
    const age = Date.now() - new Date(data.fetchedAt).getTime();
    if (age > FIRESTORE_TTL_MS) return null;
    return data;
  } catch (err: any) {
    console.warn(`[printfiles] Firestore load failed for ${productId}:`, err?.message);
    return null;
  }
}

async function saveToFirestore(productId: number, data: PrintfulPrintfilesResponse): Promise<void> {
  try {
    const { db } = await import('../firebase');
    if (!db) return;
    await db.collection('printfulPrintfiles').doc(String(productId)).set(data, { merge: true });
  } catch (err: any) {
    console.warn(`[printfiles] Firestore save failed for ${productId}:`, err?.message);
  }
}

// ─────────────────────────────────────────────────────────────
// FETCH + CACHE
// ─────────────────────────────────────────────────────────────

export async function getPrintfilesForProduct(
  productId: number,
  opts?: { force?: boolean }
): Promise<PrintfulPrintfilesResponse | null> {
  // 1. memory
  if (!opts?.force) {
    const mem = memoryCache.get(productId);
    if (mem && Date.now() - mem.fetchedAt < MEMORY_TTL_MS) return mem.data;
  }
  // 2. Firestore
  if (!opts?.force) {
    const fs = await loadFromFirestore(productId);
    if (fs) {
      memoryCache.set(productId, { fetchedAt: Date.now(), data: fs });
      return fs;
    }
  }
  // 3. Printful API (live)
  try {
    const printful = getPrintfulService();
    const raw: any = await printful.getProductPrintfiles(productId);
    if (!raw || !raw.printfiles || !raw.variant_printfiles) {
      console.warn(`[printfiles] Empty response for product ${productId}`);
      return null;
    }
    const data: PrintfulPrintfilesResponse = {
      product_id: raw.product_id ?? productId,
      available_placements: raw.available_placements || {},
      printfiles: raw.printfiles.map((p: any) => ({
        printfile_id: p.printfile_id,
        width: p.width,
        height: p.height,
        dpi: p.dpi,
        fill_mode: p.fill_mode,
        can_rotate: p.can_rotate,
      })),
      variant_printfiles: raw.variant_printfiles.map((v: any) => ({
        variant_id: v.variant_id,
        placements: v.placements || {},
      })),
      fetchedAt: new Date().toISOString(),
    };
    memoryCache.set(productId, { fetchedAt: Date.now(), data });
    void saveToFirestore(productId, data);
    return data;
  } catch (err: any) {
    console.error(`[printfiles] Fetch failed for product ${productId}:`, err?.response?.data || err?.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// GEOMETRY RESOLUTION
// ─────────────────────────────────────────────────────────────

/**
 * Resolve which printfile applies to (variantId, placement).
 * If variant not found, fall back to the first variant's printfile
 * for that placement.
 */
function resolvePrintfileSpec(
  data: PrintfulPrintfilesResponse,
  variantId: number | undefined,
  placement: string,
): PrintfileSpec | null {
  let printfileId: number | undefined;
  if (variantId) {
    const vp = data.variant_printfiles.find((v) => v.variant_id === variantId);
    if (vp) printfileId = vp.placements[placement];
  }
  if (!printfileId) {
    const firstWithPlacement = data.variant_printfiles.find((v) => v.placements[placement]);
    printfileId = firstWithPlacement?.placements[placement];
  }
  if (!printfileId) return null;
  return data.printfiles.find((p) => p.printfile_id === printfileId) || null;
}

/**
 * Auto-fit a design into a print area while preserving aspect ratio.
 * - Default: design = 90 % of the area (10 % margin), centered.
 * - Apparel chest area: design top-aligned in the upper third.
 *
 * Inputs/outputs are in PRINTFUL UNITS (px at the printfile's DPI).
 */
function autoFit(
  area: { width: number; height: number },
  designAspectRatio: number,
  opts: { coverage?: number; verticalAlign?: 'top' | 'center' } = {},
): { width: number; height: number; top: number; left: number } {
  const coverage = opts.coverage ?? 0.9;
  const maxW = area.width * coverage;
  const maxH = area.height * coverage;

  let w = maxW;
  let h = w / designAspectRatio;
  if (h > maxH) {
    h = maxH;
    w = h * designAspectRatio;
  }

  const left = Math.round((area.width - w) / 2);
  const top =
    opts.verticalAlign === 'top'
      ? Math.round(area.height * 0.05)
      : Math.round((area.height - h) / 2);

  return { width: Math.round(w), height: Math.round(h), top, left };
}

/**
 * Returns Printful-real placement geometry for a (productId, variantId, placement).
 * Falls back to a sane default if printfiles can't be loaded.
 */
export async function getRealPlacementGeometry(
  productId: number,
  variantId: number | undefined,
  placement: string,
  opts?: {
    designAspectRatio?: number;
    coverage?: number;
    verticalAlign?: 'top' | 'center';
  }
): Promise<RealPlacementGeometry> {
  const data = await getPrintfilesForProduct(productId);
  if (data) {
    const spec = resolvePrintfileSpec(data, variantId, placement);
    if (spec) {
      const fit = autoFit(
        { width: spec.width, height: spec.height },
        opts?.designAspectRatio ?? 1,
        { coverage: opts?.coverage, verticalAlign: opts?.verticalAlign },
      );
      return {
        area_width: spec.width,
        area_height: spec.height,
        width: fit.width,
        height: fit.height,
        top: fit.top,
        left: fit.left,
        printfile_id: spec.printfile_id,
        dpi: spec.dpi,
        source: 'printful-real',
      };
    }
  }
  const fallbackArea = { width: 1800, height: 2400 };
  const fit = autoFit(fallbackArea, opts?.designAspectRatio ?? 1, {
    coverage: opts?.coverage ?? 0.85,
    verticalAlign: opts?.verticalAlign ?? 'top',
  });
  return {
    area_width: fallbackArea.width,
    area_height: fallbackArea.height,
    width: fit.width,
    height: fit.height,
    top: fit.top,
    left: fit.left,
    source: 'fallback',
  };
}

/**
 * Lists all placements actually available for a product (front, back, sleeve_left, ...).
 */
export async function getAvailablePlacements(productId: number): Promise<string[]> {
  const data = await getPrintfilesForProduct(productId);
  if (!data) return [];
  const set = new Set<string>();
  for (const vp of data.variant_printfiles) {
    for (const p of Object.keys(vp.placements)) set.add(p);
  }
  return Array.from(set);
}

/**
 * Bulk prefetch printfiles for an array of productIds (batches of 5).
 */
export async function prefetchPrintfiles(productIds: number[]): Promise<{
  ok: number[];
  failed: number[];
}> {
  const ok: number[] = [];
  const failed: number[] = [];
  const BATCH = 5;
  for (let i = 0; i < productIds.length; i += BATCH) {
    const slice = productIds.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (id) => {
        const r = await getPrintfilesForProduct(id, { force: true });
        return { id, ok: !!r };
      })
    );
    for (const r of results) {
      if (r.ok) ok.push(r.id);
      else failed.push(r.id);
    }
  }
  return { ok, failed };
}
