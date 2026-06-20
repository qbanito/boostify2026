/**
 * Mapa de productos Boostify → Printful
 * 
 * Cada producto en la tienda de Boostify se mapea a un producto real
 * del catálogo de Printful con sus variantes, dimensiones de impresión
 * y precios base de producción.
 * 
 * Esto garantiza que:
 * 1. Los diseños se generan al tamaño correcto para impresión
 * 2. Los mockups usan los product IDs reales
 * 3. Las órdenes de producción se crean con variantes correctas
 * 4. Los precios de venta cubren el costo de producción + margen
 */

export interface PrintfileSpec {
  /** Printful printfile ID (placement) */
  printfileId: number;
  /** Ancho en pixels */
  width: number;
  /** Alto en pixels */
  height: number;
  /** DPI requerido */
  dpi: number;
  /** Modo de llenado: 'fit' | 'cover' */
  fillMode: 'fit' | 'cover';
  /** Placement name para la API de mockups */
  placement: string;
}

export interface ProductVariantMap {
  /** Printful variant ID */
  variantId: number;
  /** Size label que se muestra al usuario */
  size: string;
  /** Color (si aplica) */
  color?: string;
  /** Costo base de producción en USD */
  productionCost: number;
}

export interface BoostifyProductMapping {
  /** Tipo de producto interno de Boostify */
  boostifyType: string;
  /** Nombre que se muestra al usuario */
  displayName: string;
  /** ID del producto en el catálogo de Printful */
  printfulCatalogId: number;
  /** Categoría para la tienda */
  category: 'Apparel' | 'Accessories' | 'Art' | 'Music';
  /** Descripción template ({artistName} se reemplaza) */
  descriptionTemplate: string;
  /** Precio de venta sugerido (USD) */
  retailPrice: number;
  /** Especificaciones del archivo de impresión */
  printfileSpec: PrintfileSpec;
  /** Variantes disponibles con costos de producción */
  variants: ProductVariantMap[];
  /** Tallas que se muestran al usuario */
  availableSizes: string[];
  /** Requiere diseño embroidery (bordado) vs DTG (impresión directa) */
  technique: 'dtg' | 'embroidery' | 'sublimation' | 'poster';
  /** Notas de calidad para mostrar al artista */
  qualityNotes: string;
  /** Tipo de diseño del design pack que este producto usa */
  designType: DesignType;
}

// ─── Design Pack System ──────────────────────────────────────────────────────
/**
 * 6 tipos de diseño artístico print-ready, cada uno optimizado
 * para un aspect ratio y estilo que encaja con los productos Printful.
 */
export type DesignType =
  | 'logo_emblem'      // Icono/emblema del artista — T-Shirt, Stickers
  | 'album_art'        // Arte estilo portada de álbum — Hoodie
  | 'typography'       // Nombre bold del artista — Cap
  | 'abstract_vibe'    // Arte abstracto genre-driven — Poster
  | 'iconic_portrait'  // Retrato estilizado — T-Shirt alt / Poster
  | 'pattern_motif';   // Patrón repetitivo panorámico — Mug

export interface DesignSpec {
  type: DesignType;
  /** Label visible al usuario */
  displayName: string;
  /** Aspect ratio para la generación AI */
  aspectRatio: '1:1' | '3:4' | '4:3' | '16:9' | '2:3' | '9:16' | '21:9';
  /** Ancho ideal en px (referencia para el prompt) */
  idealWidth: number;
  /** Alto ideal en px */
  idealHeight: number;
  /** Carpeta de almacenamiento en Firebase */
  storageFolder: string;
  /** Productos que usan este diseño */
  usedByProducts: string[];
}

/**
 * Especificaciones de los 6 diseños del Design Pack
 */
export const DESIGN_SPECS: Record<DesignType, DesignSpec> = {
  logo_emblem: {
    type: 'logo_emblem',
    displayName: 'Logo Emblem',
    aspectRatio: '1:1',
    idealWidth: 2400,
    idealHeight: 2400,
    storageFolder: 'design-packs/logo',
    usedByProducts: ['T-Shirt', 'Sticker Pack'],
  },
  album_art: {
    type: 'album_art',
    displayName: 'Album Art',
    aspectRatio: '3:4',
    idealWidth: 1800,
    idealHeight: 2400,
    storageFolder: 'design-packs/album',
    usedByProducts: ['Hoodie'],
  },
  typography: {
    type: 'typography',
    displayName: 'Bold Typography',
    aspectRatio: '16:9',
    idealWidth: 2400,
    idealHeight: 1200,
    storageFolder: 'design-packs/typography',
    usedByProducts: ['Cap'],
  },
  abstract_vibe: {
    type: 'abstract_vibe',
    displayName: 'Abstract Vibe',
    aspectRatio: '1:1',
    idealWidth: 3600,
    idealHeight: 3600,
    storageFolder: 'design-packs/abstract',
    usedByProducts: ['Poster'],
  },
  iconic_portrait: {
    type: 'iconic_portrait',
    displayName: 'Iconic Portrait',
    aspectRatio: '3:4',
    idealWidth: 1800,
    idealHeight: 2400,
    storageFolder: 'design-packs/portrait',
    usedByProducts: ['T-Shirt', 'Poster'],
  },
  pattern_motif: {
    type: 'pattern_motif',
    displayName: 'Pattern Motif',
    aspectRatio: '16:9',
    idealWidth: 2700,
    idealHeight: 1050,
    storageFolder: 'design-packs/pattern',
    usedByProducts: ['Mug'],
  },
};

export const DESIGN_TYPES = Object.keys(DESIGN_SPECS) as DesignType[];

/**
 * Mapa completo de productos Boostify → Printful
 * 
 * Productos seleccionados por calidad, compatibilidad y margen:
 * - T-Shirt: Bella + Canvas 3001 (la más popular, algodón premium)
 * - Hoodie: Cotton Heritage M2580 (heavyweight, calidad premium)
 * - Cap: Otto Cap Foam Trucker (ajuste clásico, bordado frontal)
 * - Poster: Enhanced Matte Paper (acabado profesional 300 DPI)
 * - Stickers: Kiss-Cut (máxima flexibilidad de forma)
 * - Mug: White Glossy (clásico, cerámica premium)
 */
export const PRODUCT_MAP: Record<string, BoostifyProductMapping> = {
  'T-Shirt': {
    boostifyType: 'T-Shirt',
    displayName: 'Premium T-Shirt',
    printfulCatalogId: 71,
    designType: 'logo_emblem', // Bella + Canvas 3001
    category: 'Apparel',
    descriptionTemplate: 'Official {artistName} premium t-shirt. Bella + Canvas 3001, 100% combed ring-spun cotton, side-seamed with shoulder-to-shoulder taping. Soft hand-feel, retail fit.',
    retailPrice: 29.99,
    printfileSpec: {
      printfileId: 1,
      width: 1800,
      height: 2400,
      dpi: 150,
      fillMode: 'fit',
      placement: 'front',
    },
    variants: [
      { variantId: 4017, size: 'S', color: 'Black', productionCost: 11.69 },
      { variantId: 4018, size: 'M', color: 'Black', productionCost: 11.69 },
      { variantId: 4019, size: 'L', color: 'Black', productionCost: 11.69 },
      { variantId: 4020, size: 'XL', color: 'Black', productionCost: 11.69 },
      { variantId: 4025, size: '2XL', color: 'Black', productionCost: 13.69 },
    ],
    availableSizes: ['S', 'M', 'L', 'XL', '2XL'],
    technique: 'dtg',
    qualityNotes: '100% combed ring-spun cotton. DTG printed with eco-friendly water-based inks. Pre-shrunk. Retail fit.',
  },

  'Hoodie': {
    boostifyType: 'Hoodie',
    displayName: 'Premium Hoodie',
    printfulCatalogId: 380,
    designType: 'album_art', // Cotton Heritage M2580
    category: 'Apparel',
    descriptionTemplate: 'Official {artistName} premium hoodie. Cotton Heritage M2580, 80% cotton / 20% polyester, heavyweight 13oz fleece, kangaroo pocket, double-lined hood.',
    retailPrice: 54.99,
    printfileSpec: {
      printfileId: 1,
      width: 1800,
      height: 2400,
      dpi: 150,
      fillMode: 'fit',
      placement: 'front',
    },
    variants: [
      { variantId: 24985, size: 'S', color: 'Black', productionCost: 27.29 },
      { variantId: 24986, size: 'M', color: 'Black', productionCost: 27.29 },
      { variantId: 24987, size: 'L', color: 'Black', productionCost: 27.29 },
      { variantId: 24988, size: 'XL', color: 'Black', productionCost: 27.29 },
      { variantId: 24991, size: '2XL', color: 'Black', productionCost: 29.29 },
    ],
    availableSizes: ['S', 'M', 'L', 'XL', '2XL'],
    technique: 'dtg',
    qualityNotes: '80/20 cotton-poly heavyweight fleece (13oz). DTG printed. Kangaroo pocket, double-lined hood, ribbed cuffs.',
  },

  'Cap': {
    boostifyType: 'Cap',
    displayName: 'Trucker Cap',
    printfulCatalogId: 627,
    designType: 'typography', // Otto Cap Foam Trucker 39-165
    category: 'Accessories',
    descriptionTemplate: 'Official {artistName} trucker cap. Otto Cap 39-165, foam front with mesh back, snapback closure. Embroidered logo.',
    retailPrice: 27.99,
    printfileSpec: {
      // Embroidery uses different spec - logo area
      printfileId: 196,
      width: 2400,
      height: 1200,
      dpi: 300,
      fillMode: 'fit',
      // Printful uses 'embroidery_front' as the placement key for caps
      placement: 'embroidery_front',
    },
    variants: [
      { variantId: 15904, size: 'One size', color: 'Black', productionCost: 11.95 },
      { variantId: 15908, size: 'One size', color: 'Black/White/Black', productionCost: 11.95 },
    ],
    availableSizes: ['One size'],
    technique: 'embroidery',
    qualityNotes: 'Structured foam front, mesh back. Machine-embroidered design. Snapback closure fits most.',
  },

  'Poster': {
    boostifyType: 'Poster',
    displayName: 'Art Poster',
    printfulCatalogId: 1,
    designType: 'abstract_vibe', // Enhanced Matte Paper Poster (in)
    category: 'Art',
    descriptionTemplate: 'Official {artistName} art poster. Museum-quality enhanced matte paper, 200gsm, durable and vibrant colors. Perfect for framing.',
    retailPrice: 19.99,
    printfileSpec: {
      printfileId: 12,
      width: 3600,
      height: 3600,
      dpi: 300,
      fillMode: 'cover',
      placement: 'default',
    },
    variants: [
      { variantId: 19528, size: '16.5×23.4″ (A2)', color: 'White', productionCost: 12.64 },
      { variantId: 19527, size: '23.4×33.1″ (A1)', color: 'White', productionCost: 16.89 },
    ],
    availableSizes: ['16.5×23.4″ (A2)', '23.4×33.1″ (A1)'],
    technique: 'poster',
    qualityNotes: 'Enhanced matte paper 200gsm. Giclée quality printing at 300 DPI. Acid-free, archival grade.',
  },

  'Sticker Pack': {
    boostifyType: 'Sticker Pack',
    displayName: 'Kiss-Cut Stickers',
    printfulCatalogId: 358,
    designType: 'logo_emblem', // Kiss-Cut Stickers
    category: 'Accessories',
    descriptionTemplate: 'Official {artistName} kiss-cut stickers. Premium vinyl, weather-resistant, dishwasher safe. Perfect for laptops, bottles, and phone cases.',
    retailPrice: 4.99,
    printfileSpec: {
      printfileId: 184,
      width: 1200,
      height: 1200,
      dpi: 300,
      fillMode: 'fit',
      placement: 'default',
    },
    variants: [
      { variantId: 10163, size: '3×3″', color: 'White', productionCost: 2.29 },
      { variantId: 10164, size: '4×4″', color: 'White', productionCost: 2.49 },
      { variantId: 10165, size: '5.5×5.5″', color: 'White', productionCost: 2.99 },
    ],
    availableSizes: ['3×3″', '4×4″', '5.5×5.5″'],
    technique: 'sublimation',
    qualityNotes: 'Premium vinyl with protective laminate. Waterproof, UV-resistant. Easy peel-and-stick.',
  },

  'Mug': {
    boostifyType: 'Mug',
    displayName: 'Ceramic Mug',
    printfulCatalogId: 19,
    designType: 'pattern_motif', // White Glossy Mug
    category: 'Accessories',
    descriptionTemplate: 'Official {artistName} ceramic mug. White glossy ceramic, microwave & dishwasher safe. Vibrant full-wrap print.',
    retailPrice: 16.99,
    printfileSpec: {
      printfileId: 43,
      width: 2700,
      height: 1050,
      dpi: 300,
      fillMode: 'fit',
      placement: 'default',
    },
    variants: [
      { variantId: 1320, size: '11 oz', color: 'White', productionCost: 5.95 },
      { variantId: 4830, size: '15 oz', color: 'White', productionCost: 7.95 },
    ],
    availableSizes: ['11 oz', '15 oz'],
    technique: 'sublimation',
    qualityNotes: 'AAA grade ceramic. Sublimation printed full-wrap design. Microwave & dishwasher safe.',
  },
};

/**
 * Lista de tipos de producto disponibles (ordenados para la tienda)
 */
export const AVAILABLE_PRODUCT_TYPES = [
  'T-Shirt',
  'Hoodie',
  'Cap',
  'Poster',
  'Sticker Pack',
  'Mug',
] as const;

export type BoostifyProductType = typeof AVAILABLE_PRODUCT_TYPES[number];

/**
 * Obtiene la configuración de un producto por su tipo
 */
export function getProductMapping(productType: string): BoostifyProductMapping | null {
  return PRODUCT_MAP[productType] || null;
}

/**
 * Obtiene el variant ID de Printful para un tipo + talla específica
 */
export function getVariantForSize(productType: string, size: string): ProductVariantMap | null {
  const mapping = PRODUCT_MAP[productType];
  if (!mapping) return null;
  return mapping.variants.find(v => v.size === size) || mapping.variants[0];
}

/**
 * Calcula el profit de una venta basado en el plan del artista
 */
export function calculateProfitSplit(
  productType: string,
  size: string,
  isFreeUser: boolean
): {
  retailPrice: number;
  productionCost: number;
  netProfit: number;
  artistEarning: number;
  boostifyEarning: number;
  maintenanceFee: number;
} | null {
  const mapping = PRODUCT_MAP[productType];
  if (!mapping) return null;

  const variant = getVariantForSize(productType, size);
  if (!variant) return null;

  const retailPrice = mapping.retailPrice;
  const productionCost = variant.productionCost;
  const netProfit = retailPrice - productionCost;

  if (isFreeUser) {
    // Free: Artist 20% of sale, Boostify 80%
    const artistEarning = retailPrice * 0.20;
    const boostifyEarning = retailPrice - artistEarning;
    return {
      retailPrice,
      productionCost,
      netProfit,
      artistEarning: Math.round(artistEarning * 100) / 100,
      boostifyEarning: Math.round(boostifyEarning * 100) / 100,
      maintenanceFee: 0,
    };
  }

  // Paid: Artist 70% of profit after costs, Boostify 30%, 10% maintenance
  const maintenanceFee = netProfit * 0.10;
  const distributableProfit = netProfit - maintenanceFee;
  const artistEarning = distributableProfit * 0.70;
  const boostifyEarning = distributableProfit * 0.30;

  return {
    retailPrice,
    productionCost,
    netProfit: Math.round(netProfit * 100) / 100,
    artistEarning: Math.round(artistEarning * 100) / 100,
    boostifyEarning: Math.round(boostifyEarning * 100) / 100,
    maintenanceFee: Math.round(maintenanceFee * 100) / 100,
  };
}

/**
 * Resolve the correct Printful file `type` (placement key) for a product.
 * For DTG apparel: 'front' | 'back'. For embroidery caps: 'embroidery_front'.
 * For posters / mugs / stickers: 'default'.
 */
export function getPrintfulFileType(placement: string): string {
  // placement values from printfileSpec are already the Printful API keys
  // e.g. 'front', 'embroidery_front', 'default'
  return placement;
}

/**
 * Genera datos para crear un Printful sync product.
 * Async — fetches real printfile geometry so the design is positioned
 * correctly inside the print area instead of relying on Printful's
 * auto-fit (which often clips or mis-scales the artwork).
 */
export async function buildSyncProductData(
  productType: string,
  artistName: string,
  designImageUrl: string,
  opts?: { designAspectRatio?: number }
) {
  const mapping = PRODUCT_MAP[productType];
  if (!mapping) return null;

  const fileType = getPrintfulFileType(mapping.printfileSpec.placement);

  // Derive aspect ratio from the design spec if not provided
  const designSpec = DESIGN_SPECS[mapping.designType];
  const designAR = opts?.designAspectRatio ??
    (designSpec ? designSpec.idealWidth / designSpec.idealHeight : 1);

  // Fetch real print-area geometry from Printful's printfiles API
  let position: { area_width: number; area_height: number; width: number; height: number; top: number; left: number } | undefined;
  try {
    const { getRealPlacementGeometry } = await import('../services/printful-printfiles');
    const geo = await getRealPlacementGeometry(
      mapping.printfulCatalogId,
      mapping.variants[0]?.variantId,
      mapping.printfileSpec.placement,
      {
        designAspectRatio: designAR,
        coverage: 0.85,
        verticalAlign: mapping.technique === 'dtg' ? 'top' : 'center',
      }
    );
    position = {
      area_width: geo.area_width,
      area_height: geo.area_height,
      width: geo.width,
      height: geo.height,
      top: geo.top,
      left: geo.left,
    };
    console.log(`[buildSyncProductData] ${productType} geometry (${geo.source}):`, position);
  } catch (err: any) {
    console.warn(`[buildSyncProductData] Could not get real geometry for ${productType}:`, err?.message);
    // Fall through — Printful will use its own default positioning
  }

  return {
    sync_product: {
      name: `${artistName} ${mapping.displayName}`,
      thumbnail: designImageUrl,
    },
    sync_variants: mapping.variants.map(variant => ({
      variant_id: variant.variantId,
      retail_price: String(mapping.retailPrice),
      files: [{
        url: designImageUrl,
        type: fileType,
        ...(position ? { position } : {}),
      }],
    })),
  };
}

/**
 * Genera datos para crear una orden de Printful.
 * Async — fetches real printfile geometry for proper design placement.
 */
export async function buildOrderData(
  productType: string,
  size: string,
  artistName: string,
  designImageUrl: string,
  recipient: {
    name: string;
    address1: string;
    city: string;
    stateCode: string;
    countryCode: string;
    zip: string;
    email: string;
    phone?: string;
  },
  externalId?: string
) {
  const mapping = PRODUCT_MAP[productType];
  if (!mapping) return null;

  const variant = getVariantForSize(productType, size);
  if (!variant) return null;

  const fileType = getPrintfulFileType(mapping.printfileSpec.placement);

  const designSpec = DESIGN_SPECS[mapping.designType];
  const designAR = designSpec ? designSpec.idealWidth / designSpec.idealHeight : 1;

  let position: { area_width: number; area_height: number; width: number; height: number; top: number; left: number } | undefined;
  try {
    const { getRealPlacementGeometry } = await import('../services/printful-printfiles');
    const geo = await getRealPlacementGeometry(
      mapping.printfulCatalogId,
      variant.variantId,
      mapping.printfileSpec.placement,
      {
        designAspectRatio: designAR,
        coverage: 0.85,
        verticalAlign: mapping.technique === 'dtg' ? 'top' : 'center',
      }
    );
    position = {
      area_width: geo.area_width,
      area_height: geo.area_height,
      width: geo.width,
      height: geo.height,
      top: geo.top,
      left: geo.left,
    };
    console.log(`[buildOrderData] ${productType} size=${size} geometry (${geo.source}):`, position);
  } catch (err: any) {
    console.warn(`[buildOrderData] Could not get real geometry for ${productType}:`, err?.message);
  }

  return {
    external_id: externalId || `boostify-${Date.now()}`,
    shipping: 'STANDARD',
    recipient: {
      name: recipient.name,
      address1: recipient.address1,
      city: recipient.city,
      state_code: recipient.stateCode,
      country_code: recipient.countryCode,
      zip: recipient.zip,
      email: recipient.email,
      phone: recipient.phone,
    },
    items: [{
      variant_id: variant.variantId,
      quantity: 1,
      retail_price: String(mapping.retailPrice),
      name: `${artistName} ${mapping.displayName}`,
      files: [{
        url: designImageUrl,
        type: fileType,
        ...(position ? { position } : {}),
      }],
    }],
  };
}
