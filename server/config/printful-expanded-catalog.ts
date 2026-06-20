/**
 * Catálogo expandido de Printful para Boostify Artist Stores
 * 
 * Estrategia de diseño:
 * ─────────────────────
 * 1. Se genera UN master design de alta resolución (4500×5400 @300dpi) por artista
 * 2. El master design se sube a Firebase Storage
 * 3. Printful's mockup generator renderiza el diseño en cada producto
 * 4. Los productos se organizan por categoría para la tienda
 * 
 * El master design es lo suficientemente grande para cubrir TODOS los productos:
 * - T-Shirts/Hoodies: 1800×2400 (cabe dentro de 4500×5400)
 * - Posters: 3600×3600 (cabe dentro)
 * - Mugs: 2700×1050 (se recorta una franja horizontal)
 * - Phone cases: 1242×2208 (se recorta una franja vertical)
 * - All-over-print: 4500×5400 usa la resolución completa
 */

// ═══════════════════════════════════════════════════════════════
// MASTER DESIGN SPECIFICATIONS
// ═══════════════════════════════════════════════════════════════

export const MASTER_DESIGN_SPEC = {
  /** Ancho del diseño maestro en px */
  width: 4500,
  /** Alto del diseño maestro en px */
  height: 5400,
  /** DPI base */
  dpi: 300,
  /** Formato de salida */
  format: 'png' as const,
  /** Calidad (para JPEG) */
  quality: 95,
};

// ═══════════════════════════════════════════════════════════════
// CATALOG PRODUCT DEFINITION
// ═══════════════════════════════════════════════════════════════

export interface CatalogProduct {
  /** Printful catalog product ID */
  printfulId: number;
  /** Nombre corto para mostrar */
  name: string;
  /** Descripción del producto */
  description: string;
  /** Categoría de la tienda */
  category: StoreCategory;
  /** Subcategoría */
  subcategory: string;
  /** Tipo de impresión */
  technique: 'dtg' | 'embroidery' | 'sublimation' | 'cut-sew' | 'poster' | 'dtfilm';
  /** Precio base de producción (variant más barato) */
  baseCost: number;
  /** Precio de venta sugerido */
  retailPrice: number;
  /** Placement principal para el diseño */
  placement: string;
  /** Si usa all-over-print (diseño cubre todo el producto) */
  isAllOverPrint: boolean;
  /** Tags para búsqueda/filtrado */
  tags: string[];
  /** Género (unisex, men, women, kids) */
  gender: 'unisex' | 'men' | 'women' | 'kids' | 'all';
  /** Si es producto destacado (aparece en los 6 de la tienda principal) */
  featured: boolean;
  /** Orden de prioridad (menor = primero) */
  priority: number;
}

export type StoreCategory = 
  | 'Apparel'
  | 'Hoodies & Sweatshirts'
  | 'Hats & Beanies'
  | 'Accessories'
  | 'Phone Cases'
  | 'Bags'
  | 'Shoes'
  | 'Home & Living'
  | 'Wall Art'
  | 'Drinkware'
  | 'Stickers & Pins'
  | 'Kids & Baby';

// ═══════════════════════════════════════════════════════════════
// FULL CATALOG — ~107 PRODUCTS
// ═══════════════════════════════════════════════════════════════

export const EXPANDED_CATALOG: CatalogProduct[] = [
  // ──── APPAREL: T-Shirts & Tops (20 products) ─────────────────
  { printfulId: 71, name: 'Classic T-Shirt', description: 'Bella + Canvas 3001 • 100% combed ring-spun cotton, retail fit', category: 'Apparel', subcategory: 'T-Shirts', technique: 'dtg', baseCost: 11.69, retailPrice: 29.99, placement: 'front', isAllOverPrint: false, tags: ['tshirt', 'essential', 'cotton'], gender: 'unisex', featured: true, priority: 1 },
  { printfulId: 162, name: 'Tri-Blend T-Shirt', description: 'Bella + Canvas 3413 • Tri-blend fabric, ultra-soft hand feel', category: 'Apparel', subcategory: 'T-Shirts', technique: 'dtg', baseCost: 19.95, retailPrice: 34.99, placement: 'front', isAllOverPrint: false, tags: ['tshirt', 'premium', 'triblend'], gender: 'unisex', featured: false, priority: 5 },
  { printfulId: 508, name: 'Heavyweight T-Shirt', description: 'Cotton Heritage MC1086 • Premium heavyweight 6.5oz, boxy fit', category: 'Apparel', subcategory: 'T-Shirts', technique: 'dtg', baseCost: 18.85, retailPrice: 34.99, placement: 'front', isAllOverPrint: false, tags: ['tshirt', 'heavyweight', 'premium'], gender: 'men', featured: false, priority: 6 },
  { printfulId: 586, name: 'Garment-Dyed T-Shirt', description: 'Comfort Colors 1717 • Garment-dyed for vintage look, 6.1oz heavyweight', category: 'Apparel', subcategory: 'T-Shirts', technique: 'dtg', baseCost: 16.50, retailPrice: 32.99, placement: 'front', isAllOverPrint: false, tags: ['tshirt', 'vintage', 'garment-dyed'], gender: 'unisex', featured: false, priority: 8 },
  { printfulId: 356, name: 'Long Sleeve Tee', description: 'Bella + Canvas 3501 • Jersey long sleeve, same quality as 3001', category: 'Apparel', subcategory: 'T-Shirts', technique: 'dtg', baseCost: 20.29, retailPrice: 37.99, placement: 'front', isAllOverPrint: false, tags: ['longsleeve', 'tshirt'], gender: 'unisex', featured: false, priority: 10 },
  { printfulId: 360, name: "Women's Relaxed Tee", description: 'Bella + Canvas 6400 • Relaxed fit designed for women', category: 'Apparel', subcategory: 'T-Shirts', technique: 'dtg', baseCost: 14.50, retailPrice: 29.99, placement: 'front', isAllOverPrint: false, tags: ['tshirt', 'women', 'relaxed'], gender: 'women', featured: false, priority: 12 },
  { printfulId: 365, name: 'Muscle Shirt', description: 'Bella + Canvas 3483 • Dropped armholes, raw edges', category: 'Apparel', subcategory: 'Tanks', technique: 'dtg', baseCost: 18.27, retailPrice: 32.99, placement: 'front', isAllOverPrint: false, tags: ['tank', 'muscle', 'gym'], gender: 'unisex', featured: false, priority: 15 },
  { printfulId: 248, name: "Men's Tank Top", description: 'Bella + Canvas 3480 • Side-seamed, staple fit tank', category: 'Apparel', subcategory: 'Tanks', technique: 'dtg', baseCost: 16.23, retailPrice: 29.99, placement: 'front', isAllOverPrint: false, tags: ['tank', 'men'], gender: 'men', featured: false, priority: 16 },
  { printfulId: 271, name: "Women's Muscle Tank", description: 'Bella + Canvas 8803 • Vintage racerback, ultra-lightweight', category: 'Apparel', subcategory: 'Tanks', technique: 'dtg', baseCost: 20.31, retailPrice: 34.99, placement: 'front', isAllOverPrint: false, tags: ['tank', 'women', 'racerback'], gender: 'women', featured: false, priority: 17 },
  { printfulId: 537, name: "Men's Premium Tank", description: 'Cotton Heritage MC1790 • Heavyweight premium tank', category: 'Apparel', subcategory: 'Tanks', technique: 'dtg', baseCost: 18.29, retailPrice: 32.99, placement: 'front', isAllOverPrint: false, tags: ['tank', 'men', 'premium'], gender: 'men', featured: false, priority: 18 },
  // All-Over Print apparel
  { printfulId: 257, name: 'All-Over Print Tee (Men)', description: 'Full-coverage sublimation print, polyester-feel', category: 'Apparel', subcategory: 'All-Over Print', technique: 'cut-sew', baseCost: 21.50, retailPrice: 44.99, placement: 'front', isAllOverPrint: true, tags: ['tshirt', 'allover', 'sublimation', 'men'], gender: 'men', featured: false, priority: 20 },
  { printfulId: 261, name: 'All-Over Print Tee (Women)', description: 'Full-coverage sublimation print, tailored women fit', category: 'Apparel', subcategory: 'All-Over Print', technique: 'cut-sew', baseCost: 21.50, retailPrice: 44.99, placement: 'front', isAllOverPrint: true, tags: ['tshirt', 'allover', 'women'], gender: 'women', featured: false, priority: 21 },
  { printfulId: 514, name: 'All-Over Print T-Shirt Dress', description: 'Full print dress, comfortable oversized fit', category: 'Apparel', subcategory: 'All-Over Print', technique: 'cut-sew', baseCost: 28.00, retailPrice: 54.99, placement: 'front', isAllOverPrint: true, tags: ['dress', 'allover', 'women'], gender: 'women', featured: false, priority: 22 },
  { printfulId: 303, name: 'All-Over Print Crop Tee', description: 'Cropped all-over print for a bold look', category: 'Apparel', subcategory: 'All-Over Print', technique: 'cut-sew', baseCost: 20.50, retailPrice: 39.99, placement: 'front', isAllOverPrint: true, tags: ['crop', 'allover', 'women'], gender: 'women', featured: false, priority: 23 },

  // ──── HOODIES & SWEATSHIRTS (10 products) ──────────────────
  { printfulId: 380, name: 'Premium Hoodie', description: 'Cotton Heritage M2580 • 13oz heavyweight fleece, kangaroo pocket', category: 'Hoodies & Sweatshirts', subcategory: 'Hoodies', technique: 'dtg', baseCost: 27.29, retailPrice: 54.99, placement: 'front', isAllOverPrint: false, tags: ['hoodie', 'essential', 'heavyweight'], gender: 'unisex', featured: true, priority: 2 },
  { printfulId: 294, name: 'Pullover Hoodie', description: 'Bella + Canvas 3719 • Lightweight sponge fleece, retail fit', category: 'Hoodies & Sweatshirts', subcategory: 'Hoodies', technique: 'dtg', baseCost: 33.06, retailPrice: 59.99, placement: 'front', isAllOverPrint: false, tags: ['hoodie', 'lightweight'], gender: 'unisex', featured: false, priority: 11 },
  { printfulId: 317, name: "Women's Cropped Hoodie", description: 'Bella + Canvas 7502 • Cropped fit, trendy silhouette', category: 'Hoodies & Sweatshirts', subcategory: 'Hoodies', technique: 'dtg', baseCost: 35.15, retailPrice: 64.99, placement: 'front', isAllOverPrint: false, tags: ['hoodie', 'cropped', 'women'], gender: 'women', featured: false, priority: 13 },
  { printfulId: 692, name: 'Zip-Up Hoodie', description: 'Gildan 18600 • Full zip, heavy blend fleece', category: 'Hoodies & Sweatshirts', subcategory: 'Hoodies', technique: 'dtg', baseCost: 26.50, retailPrice: 54.99, placement: 'front', isAllOverPrint: false, tags: ['hoodie', 'zipup'], gender: 'unisex', featured: false, priority: 14 },
  { printfulId: 145, name: 'Crewneck Sweatshirt', description: 'Gildan 18000 • Classic crew neck, heavy blend', category: 'Hoodies & Sweatshirts', subcategory: 'Sweatshirts', technique: 'dtg', baseCost: 20.79, retailPrice: 44.99, placement: 'front', isAllOverPrint: false, tags: ['sweatshirt', 'crew'], gender: 'unisex', featured: false, priority: 9 },
  { printfulId: 411, name: 'Premium Sweatshirt', description: 'Cotton Heritage M2480 • Fleece premium quality', category: 'Hoodies & Sweatshirts', subcategory: 'Sweatshirts', technique: 'dtg', baseCost: 26.05, retailPrice: 49.99, placement: 'front', isAllOverPrint: false, tags: ['sweatshirt', 'premium'], gender: 'unisex', featured: false, priority: 14 },
  { printfulId: 342, name: 'Joggers', description: 'Jerzees 975MPR • NuBlend fleece jogger pants', category: 'Hoodies & Sweatshirts', subcategory: 'Bottoms', technique: 'dtg', baseCost: 24.55, retailPrice: 49.99, placement: 'front', isAllOverPrint: false, tags: ['joggers', 'pants', 'fleece'], gender: 'unisex', featured: false, priority: 19 },
  { printfulId: 412, name: 'Fleece Sweatpants', description: 'Cotton Heritage M7580 • Premium fleece sweatpants', category: 'Hoodies & Sweatshirts', subcategory: 'Bottoms', technique: 'dtg', baseCost: 31.39, retailPrice: 54.99, placement: 'front', isAllOverPrint: false, tags: ['sweatpants', 'premium'], gender: 'unisex', featured: false, priority: 20 },
  { printfulId: 482, name: "Men's Fleece Shorts", description: 'Independent Trading IND20SRT • Midweight fleece shorts', category: 'Hoodies & Sweatshirts', subcategory: 'Bottoms', technique: 'dtg', baseCost: 25.95, retailPrice: 44.99, placement: 'front', isAllOverPrint: false, tags: ['shorts', 'fleece', 'men'], gender: 'men', featured: false, priority: 22 },
  { printfulId: 1419, name: 'All-Over Print Hoodie', description: 'Full sublimation cotton hoodie, all-over print', category: 'Hoodies & Sweatshirts', subcategory: 'All-Over Print', technique: 'cut-sew', baseCost: 38.00, retailPrice: 74.99, placement: 'front', isAllOverPrint: true, tags: ['hoodie', 'allover'], gender: 'unisex', featured: false, priority: 25 },

  // ──── HATS & BEANIES (12 products) ─────────────────────────
  { printfulId: 627, name: 'Trucker Cap', description: 'Otto Cap 39-165 • Foam front, mesh back, snapback', category: 'Hats & Beanies', subcategory: 'Caps', technique: 'embroidery', baseCost: 11.95, retailPrice: 27.99, placement: 'front', isAllOverPrint: false, tags: ['cap', 'trucker', 'essential'], gender: 'unisex', featured: true, priority: 3 },
  { printfulId: 206, name: 'Dad Hat', description: 'Yupoong 6245CM • Unstructured classic dad cap', category: 'Hats & Beanies', subcategory: 'Caps', technique: 'embroidery', baseCost: 14.65, retailPrice: 29.99, placement: 'front', isAllOverPrint: false, tags: ['cap', 'dad', 'classic'], gender: 'unisex', featured: false, priority: 25 },
  { printfulId: 252, name: 'Retro Trucker Hat', description: 'Yupoong 6606 • Retro-style trucker mesh back', category: 'Hats & Beanies', subcategory: 'Caps', technique: 'embroidery', baseCost: 13.29, retailPrice: 27.99, placement: 'front', isAllOverPrint: false, tags: ['cap', 'trucker', 'retro'], gender: 'unisex', featured: false, priority: 26 },
  { printfulId: 422, name: 'Snapback Cap', description: 'Richardson 112 • Premium snapback trucker', category: 'Hats & Beanies', subcategory: 'Caps', technique: 'embroidery', baseCost: 17.89, retailPrice: 32.99, placement: 'front', isAllOverPrint: false, tags: ['cap', 'snapback'], gender: 'unisex', featured: false, priority: 27 },
  { printfulId: 327, name: 'Vintage Cap', description: 'Otto Cap 18-1248 • Distressed vintage washed look', category: 'Hats & Beanies', subcategory: 'Caps', technique: 'embroidery', baseCost: 16.79, retailPrice: 31.99, placement: 'front', isAllOverPrint: false, tags: ['cap', 'vintage', 'distressed'], gender: 'unisex', featured: false, priority: 28 },
  { printfulId: 638, name: 'adidas Dad Hat', description: 'adidas branded • Premium structured dad hat', category: 'Hats & Beanies', subcategory: 'Caps', technique: 'embroidery', baseCost: 28.75, retailPrice: 44.99, placement: 'front', isAllOverPrint: false, tags: ['cap', 'adidas', 'premium'], gender: 'unisex', featured: false, priority: 30 },
  { printfulId: 253, name: 'Bucket Hat', description: 'Flexfit 5003 • Cotton twill bucket hat', category: 'Hats & Beanies', subcategory: 'Hats', technique: 'embroidery', baseCost: 20.25, retailPrice: 34.99, placement: 'front', isAllOverPrint: false, tags: ['bucket', 'hat'], gender: 'unisex', featured: false, priority: 29 },
  { printfulId: 557, name: 'Fashion Bucket Hat', description: 'Newhattan 1500 • Trendy bucket style, many colors', category: 'Hats & Beanies', subcategory: 'Hats', technique: 'embroidery', baseCost: 14.50, retailPrice: 29.99, placement: 'front', isAllOverPrint: false, tags: ['bucket', 'hat', 'fashion'], gender: 'unisex', featured: false, priority: 31 },
  { printfulId: 266, name: 'Cuffed Beanie', description: 'Yupoong 1501KC • Soft-touch cuffed knit beanie', category: 'Hats & Beanies', subcategory: 'Beanies', technique: 'embroidery', baseCost: 12.79, retailPrice: 24.99, placement: 'front', isAllOverPrint: false, tags: ['beanie', 'cuffed', 'winter'], gender: 'unisex', featured: false, priority: 32 },
  { printfulId: 451, name: 'Pom-Pom Beanie', description: 'Beechfield B426 • Knit beanie with pom-pom', category: 'Hats & Beanies', subcategory: 'Beanies', technique: 'embroidery', baseCost: 13.25, retailPrice: 27.99, placement: 'front', isAllOverPrint: false, tags: ['beanie', 'pompom', 'winter'], gender: 'unisex', featured: false, priority: 33 },
  { printfulId: 637, name: 'Waffle Beanie', description: 'Richardson 146R • Waffle knit texture beanie', category: 'Hats & Beanies', subcategory: 'Beanies', technique: 'embroidery', baseCost: 16.50, retailPrice: 29.99, placement: 'front', isAllOverPrint: false, tags: ['beanie', 'waffle'], gender: 'unisex', featured: false, priority: 34 },
  { printfulId: 265, name: 'Visor', description: 'Flexfit 8110 • Embroidered sun visor', category: 'Hats & Beanies', subcategory: 'Accessories', technique: 'embroidery', baseCost: 17.99, retailPrice: 29.99, placement: 'front', isAllOverPrint: false, tags: ['visor', 'summer'], gender: 'unisex', featured: false, priority: 35 },

  // ──── PHONE CASES (5 products) ─────────────────────────────
  { printfulId: 601, name: 'Tough iPhone Case', description: 'Dual-layer protection, matte finish, wireless charging compatible', category: 'Phone Cases', subcategory: 'iPhone', technique: 'sublimation', baseCost: 13.95, retailPrice: 29.99, placement: 'default', isAllOverPrint: false, tags: ['phone', 'iphone', 'case', 'tough'], gender: 'all', featured: false, priority: 40 },
  { printfulId: 181, name: 'Clear iPhone Case', description: 'Transparent flexible case, shows off design + phone color', category: 'Phone Cases', subcategory: 'iPhone', technique: 'sublimation', baseCost: 9.38, retailPrice: 24.99, placement: 'default', isAllOverPrint: false, tags: ['phone', 'iphone', 'case', 'clear'], gender: 'all', featured: false, priority: 41 },
  { printfulId: 686, name: 'Tough Samsung Case', description: 'Dual-layer protection for Samsung Galaxy', category: 'Phone Cases', subcategory: 'Samsung', technique: 'sublimation', baseCost: 13.95, retailPrice: 29.99, placement: 'default', isAllOverPrint: false, tags: ['phone', 'samsung', 'case', 'tough'], gender: 'all', featured: false, priority: 42 },
  { printfulId: 267, name: 'Clear Samsung Case', description: 'Transparent case for Samsung Galaxy', category: 'Phone Cases', subcategory: 'Samsung', technique: 'sublimation', baseCost: 9.38, retailPrice: 24.99, placement: 'default', isAllOverPrint: false, tags: ['phone', 'samsung', 'case', 'clear'], gender: 'all', featured: false, priority: 43 },
  { printfulId: 605, name: 'AirPods Case', description: 'Rubber protective case for AirPods', category: 'Phone Cases', subcategory: 'Accessories', technique: 'sublimation', baseCost: 12.50, retailPrice: 24.99, placement: 'default', isAllOverPrint: false, tags: ['airpods', 'case'], gender: 'all', featured: false, priority: 44 },

  // ──── BAGS (7 products) ────────────────────────────────────
  { printfulId: 367, name: 'Eco Tote Bag', description: 'Econscious EC8000 • Organic cotton tote', category: 'Bags', subcategory: 'Totes', technique: 'dtg', baseCost: 15.56, retailPrice: 27.99, placement: 'front', isAllOverPrint: false, tags: ['tote', 'eco', 'cotton'], gender: 'all', featured: false, priority: 50 },
  { printfulId: 274, name: 'All-Over Print Tote', description: 'Large tote with pocket, full sublimation print', category: 'Bags', subcategory: 'Totes', technique: 'cut-sew', baseCost: 23.41, retailPrice: 39.99, placement: 'front', isAllOverPrint: true, tags: ['tote', 'allover'], gender: 'all', featured: false, priority: 51 },
  { printfulId: 279, name: 'All-Over Print Backpack', description: 'Fully printed backpack, padded straps, laptop pocket', category: 'Bags', subcategory: 'Backpacks', technique: 'cut-sew', baseCost: 36.83, retailPrice: 64.99, placement: 'front', isAllOverPrint: true, tags: ['backpack', 'allover'], gender: 'all', featured: false, priority: 52 },
  { printfulId: 389, name: 'Minimalist Backpack', description: 'Clean design, all-over print recycled material', category: 'Bags', subcategory: 'Backpacks', technique: 'cut-sew', baseCost: 37.08, retailPrice: 64.99, placement: 'front', isAllOverPrint: true, tags: ['backpack', 'minimalist'], gender: 'all', featured: false, priority: 53 },
  { printfulId: 350, name: 'Fanny Pack', description: 'All-over print belt bag, adjustable strap', category: 'Bags', subcategory: 'Bags', technique: 'cut-sew', baseCost: 23.64, retailPrice: 39.99, placement: 'front', isAllOverPrint: true, tags: ['fanny', 'belt', 'bag'], gender: 'all', featured: false, priority: 54 },
  { printfulId: 262, name: 'Drawstring Bag', description: 'All-over print drawstring sports bag', category: 'Bags', subcategory: 'Bags', technique: 'cut-sew', baseCost: 15.25, retailPrice: 29.99, placement: 'front', isAllOverPrint: true, tags: ['drawstring', 'gym', 'bag'], gender: 'all', featured: false, priority: 55 },
  { printfulId: 465, name: 'Duffle Bag', description: 'All-over print duffle bag with shoulder strap', category: 'Bags', subcategory: 'Bags', technique: 'cut-sew', baseCost: 64.99, retailPrice: 99.99, placement: 'front', isAllOverPrint: true, tags: ['duffle', 'travel', 'bag'], gender: 'all', featured: false, priority: 56 },

  // ──── SHOES (8 products) ───────────────────────────────────
  { printfulId: 513, name: "Men's High-Top Shoes", description: 'Canvas high-tops with custom print', category: 'Shoes', subcategory: 'Sneakers', technique: 'sublimation', baseCost: 43.00, retailPrice: 79.99, placement: 'default', isAllOverPrint: true, tags: ['shoes', 'hightop', 'men'], gender: 'men', featured: false, priority: 60 },
  { printfulId: 525, name: "Women's High-Top Shoes", description: 'Canvas high-tops designed for women', category: 'Shoes', subcategory: 'Sneakers', technique: 'sublimation', baseCost: 43.00, retailPrice: 79.99, placement: 'default', isAllOverPrint: true, tags: ['shoes', 'hightop', 'women'], gender: 'women', featured: false, priority: 61 },
  { printfulId: 574, name: "Men's Slip-On Shoes", description: 'Easy slip-on canvas with custom print', category: 'Shoes', subcategory: 'Slip-Ons', technique: 'sublimation', baseCost: 41.00, retailPrice: 74.99, placement: 'default', isAllOverPrint: true, tags: ['shoes', 'slipon', 'men'], gender: 'men', featured: false, priority: 62 },
  { printfulId: 575, name: "Women's Slip-On Shoes", description: 'Slip-on canvas designed for women', category: 'Shoes', subcategory: 'Slip-Ons', technique: 'sublimation', baseCost: 41.00, retailPrice: 74.99, placement: 'default', isAllOverPrint: true, tags: ['shoes', 'slipon', 'women'], gender: 'women', featured: false, priority: 63 },
  { printfulId: 657, name: "Men's Athletic Shoes", description: 'Sporty athletic shoes with full print', category: 'Shoes', subcategory: 'Athletic', technique: 'sublimation', baseCost: 42.00, retailPrice: 84.99, placement: 'default', isAllOverPrint: true, tags: ['shoes', 'athletic', 'men'], gender: 'men', featured: false, priority: 64 },
  { printfulId: 658, name: "Women's Athletic Shoes", description: 'Athletic shoes designed for women', category: 'Shoes', subcategory: 'Athletic', technique: 'sublimation', baseCost: 42.00, retailPrice: 84.99, placement: 'default', isAllOverPrint: true, tags: ['shoes', 'athletic', 'women'], gender: 'women', featured: false, priority: 65 },
  { printfulId: 597, name: "Men's Slides", description: 'Custom printed slide sandals', category: 'Shoes', subcategory: 'Slides', technique: 'sublimation', baseCost: 32.50, retailPrice: 49.99, placement: 'default', isAllOverPrint: true, tags: ['slides', 'sandals', 'men'], gender: 'men', featured: false, priority: 66 },
  { printfulId: 598, name: "Women's Slides", description: 'Custom slide sandals for women', category: 'Shoes', subcategory: 'Slides', technique: 'sublimation', baseCost: 32.50, retailPrice: 49.99, placement: 'default', isAllOverPrint: true, tags: ['slides', 'sandals', 'women'], gender: 'women', featured: false, priority: 67 },

  // ──── HOME & LIVING (12 products) ──────────────────────────
  { printfulId: 214, name: 'Premium Pillow', description: 'All-over print throw pillow, hidden zipper', category: 'Home & Living', subcategory: 'Pillows', technique: 'cut-sew', baseCost: 18.31, retailPrice: 34.99, placement: 'front', isAllOverPrint: true, tags: ['pillow', 'home', 'decor'], gender: 'all', featured: false, priority: 70 },
  { printfulId: 395, name: 'Throw Blanket', description: 'Soft plush throw blanket, vibrant print', category: 'Home & Living', subcategory: 'Blankets', technique: 'sublimation', baseCost: 38.98, retailPrice: 64.99, placement: 'default', isAllOverPrint: true, tags: ['blanket', 'throw', 'home'], gender: 'all', featured: false, priority: 71 },
  { printfulId: 259, name: 'Beach Towel', description: 'Microfiber beach towel, quick-dry, soft touch', category: 'Home & Living', subcategory: 'Towels', technique: 'sublimation', baseCost: 28.82, retailPrice: 44.99, placement: 'default', isAllOverPrint: true, tags: ['towel', 'beach', 'summer'], gender: 'all', featured: false, priority: 72 },
  { printfulId: 534, name: 'Jigsaw Puzzle', description: '252 or 500 pieces, full-color puzzle', category: 'Home & Living', subcategory: 'Games', technique: 'sublimation', baseCost: 14.95, retailPrice: 29.99, placement: 'default', isAllOverPrint: true, tags: ['puzzle', 'game', 'gift'], gender: 'all', featured: false, priority: 73 },
  { printfulId: 518, name: 'Mouse Pad', description: 'Neoprene mouse pad, anti-slip base', category: 'Home & Living', subcategory: 'Office', technique: 'sublimation', baseCost: 9.13, retailPrice: 19.99, placement: 'default', isAllOverPrint: true, tags: ['mousepad', 'office', 'gaming'], gender: 'all', featured: false, priority: 74 },
  { printfulId: 583, name: 'Gaming Mouse Pad', description: 'Extra-large gaming mouse pad, stitched edges', category: 'Home & Living', subcategory: 'Office', technique: 'sublimation', baseCost: 11.17, retailPrice: 24.99, placement: 'default', isAllOverPrint: true, tags: ['mousepad', 'gaming', 'xl'], gender: 'all', featured: false, priority: 75 },
  { printfulId: 474, name: 'Spiral Notebook', description: 'Spiral-bound ruled notebook, matte cover', category: 'Home & Living', subcategory: 'Stationery', technique: 'sublimation', baseCost: 12.19, retailPrice: 22.99, placement: 'default', isAllOverPrint: false, tags: ['notebook', 'journal', 'stationery'], gender: 'all', featured: false, priority: 76 },
  { printfulId: 394, name: 'Laptop Sleeve', description: 'Neoprene laptop sleeve, fits 13" &amp; 15"', category: 'Home & Living', subcategory: 'Tech', technique: 'sublimation', baseCost: 21.16, retailPrice: 34.99, placement: 'default', isAllOverPrint: true, tags: ['laptop', 'sleeve', 'tech'], gender: 'all', featured: false, priority: 77 },
  { printfulId: 675, name: 'Yoga Mat', description: 'Custom print yoga/exercise mat, non-slip', category: 'Home & Living', subcategory: 'Fitness', technique: 'sublimation', baseCost: 42.33, retailPrice: 69.99, placement: 'default', isAllOverPrint: true, tags: ['yoga', 'fitness', 'mat'], gender: 'all', featured: false, priority: 78 },
  { printfulId: 611, name: 'Cork-Back Coaster', description: 'Glossy surface, cork-back, heat resistant', category: 'Home & Living', subcategory: 'Kitchen', technique: 'sublimation', baseCost: 5.44, retailPrice: 12.99, placement: 'default', isAllOverPrint: false, tags: ['coaster', 'cork', 'kitchen'], gender: 'all', featured: false, priority: 79 },
  { printfulId: 645, name: 'Soy Wax Candle', description: 'Glass jar soy wax candle, custom label', category: 'Home & Living', subcategory: 'Decor', technique: 'sublimation', baseCost: 14.00, retailPrice: 29.99, placement: 'default', isAllOverPrint: false, tags: ['candle', 'soy', 'decor', 'gift'], gender: 'all', featured: false, priority: 80 },
  { printfulId: 297, name: 'Embroidered Apron', description: 'Liberty Bags 5502 • Kitchen or artist apron with logo', category: 'Home & Living', subcategory: 'Kitchen', technique: 'embroidery', baseCost: 17.29, retailPrice: 32.99, placement: 'front', isAllOverPrint: false, tags: ['apron', 'kitchen', 'embroidered'], gender: 'all', featured: false, priority: 81 },

  // ──── WALL ART (8 products) ────────────────────────────────
  { printfulId: 1, name: 'Matte Poster', description: 'Enhanced matte paper, 200gsm, museum quality', category: 'Wall Art', subcategory: 'Posters', technique: 'poster', baseCost: 12.64, retailPrice: 19.99, placement: 'default', isAllOverPrint: false, tags: ['poster', 'matte', 'art'], gender: 'all', featured: true, priority: 4 },
  { printfulId: 171, name: 'Luster Poster', description: 'Premium luster photo paper, semi-gloss finish', category: 'Wall Art', subcategory: 'Posters', technique: 'poster', baseCost: 17.60, retailPrice: 24.99, placement: 'default', isAllOverPrint: false, tags: ['poster', 'luster', 'glossy'], gender: 'all', featured: false, priority: 82 },
  { printfulId: 640, name: 'Poster with Hanger', description: 'Enhanced matte poster with wooden hanger frame', category: 'Wall Art', subcategory: 'Posters', technique: 'poster', baseCost: 17.85, retailPrice: 29.99, placement: 'default', isAllOverPrint: false, tags: ['poster', 'hanger', 'frame'], gender: 'all', featured: false, priority: 83 },
  { printfulId: 2, name: 'Framed Poster (Matte)', description: 'Enhanced matte paper in lightweight frame', category: 'Wall Art', subcategory: 'Framed', technique: 'poster', baseCost: 23.41, retailPrice: 44.99, placement: 'default', isAllOverPrint: false, tags: ['poster', 'framed', 'matte'], gender: 'all', featured: false, priority: 84 },
  { printfulId: 172, name: 'Framed Poster (Luster)', description: 'Luster photo paper in premium frame', category: 'Wall Art', subcategory: 'Framed', technique: 'poster', baseCost: 25.50, retailPrice: 49.99, placement: 'default', isAllOverPrint: false, tags: ['poster', 'framed', 'luster'], gender: 'all', featured: false, priority: 85 },
  { printfulId: 3, name: 'Canvas Print', description: 'Gallery-wrapped canvas, solid wood frame', category: 'Wall Art', subcategory: 'Canvas', technique: 'poster', baseCost: 16.83, retailPrice: 39.99, placement: 'default', isAllOverPrint: false, tags: ['canvas', 'gallery', 'art'], gender: 'all', featured: false, priority: 86 },
  { printfulId: 614, name: 'Framed Canvas', description: 'Canvas print in floating frame', category: 'Wall Art', subcategory: 'Canvas', technique: 'poster', baseCost: 46.92, retailPrice: 79.99, placement: 'default', isAllOverPrint: false, tags: ['canvas', 'framed', 'premium'], gender: 'all', featured: false, priority: 87 },
  { printfulId: 588, name: 'Metal Print', description: 'Glossy aluminum metal print, modern look', category: 'Wall Art', subcategory: 'Metal', technique: 'sublimation', baseCost: 25.00, retailPrice: 49.99, placement: 'default', isAllOverPrint: false, tags: ['metal', 'aluminum', 'modern'], gender: 'all', featured: false, priority: 88 },

  // ──── DRINKWARE (10 products) ──────────────────────────────
  { printfulId: 19, name: 'White Glossy Mug', description: 'Classic white ceramic mug, full-wrap print', category: 'Drinkware', subcategory: 'Mugs', technique: 'sublimation', baseCost: 5.95, retailPrice: 16.99, placement: 'default', isAllOverPrint: false, tags: ['mug', 'ceramic', 'essential'], gender: 'all', featured: true, priority: 5 },
  { printfulId: 300, name: 'Black Glossy Mug', description: 'Black ceramic mug with vibrant print', category: 'Drinkware', subcategory: 'Mugs', technique: 'sublimation', baseCost: 7.95, retailPrice: 18.99, placement: 'default', isAllOverPrint: false, tags: ['mug', 'black', 'ceramic'], gender: 'all', featured: false, priority: 89 },
  { printfulId: 403, name: 'Color Inside Mug', description: 'White mug with colored handle &amp; inside', category: 'Drinkware', subcategory: 'Mugs', technique: 'sublimation', baseCost: 7.95, retailPrice: 18.99, placement: 'default', isAllOverPrint: false, tags: ['mug', 'color', 'accent'], gender: 'all', featured: false, priority: 90 },
  { printfulId: 407, name: 'Enamel Mug', description: 'Vintage-style enamel camping mug', category: 'Drinkware', subcategory: 'Mugs', technique: 'sublimation', baseCost: 12.42, retailPrice: 22.99, placement: 'default', isAllOverPrint: false, tags: ['mug', 'enamel', 'vintage', 'camping'], gender: 'all', featured: false, priority: 91 },
  { printfulId: 663, name: 'Travel Mug', description: 'Insulated travel mug with handle &amp; lid', category: 'Drinkware', subcategory: 'Travel', technique: 'sublimation', baseCost: 22.10, retailPrice: 34.99, placement: 'default', isAllOverPrint: false, tags: ['mug', 'travel', 'insulated'], gender: 'all', featured: false, priority: 92 },
  { printfulId: 382, name: 'Water Bottle', description: 'Stainless steel insulated water bottle', category: 'Drinkware', subcategory: 'Bottles', technique: 'sublimation', baseCost: 20.35, retailPrice: 34.99, placement: 'default', isAllOverPrint: false, tags: ['bottle', 'water', 'steel'], gender: 'all', featured: false, priority: 93 },
  { printfulId: 585, name: 'Tumbler', description: 'Stainless steel tumbler with lid', category: 'Drinkware', subcategory: 'Tumblers', technique: 'sublimation', baseCost: 21.37, retailPrice: 34.99, placement: 'default', isAllOverPrint: false, tags: ['tumbler', 'steel', 'insulated'], gender: 'all', featured: false, priority: 94 },
  { printfulId: 742, name: 'Tumbler with Straw', description: 'Insulated tumbler with reusable straw', category: 'Drinkware', subcategory: 'Tumblers', technique: 'sublimation', baseCost: 20.35, retailPrice: 34.99, placement: 'default', isAllOverPrint: false, tags: ['tumbler', 'straw', 'insulated'], gender: 'all', featured: false, priority: 95 },
  { printfulId: 653, name: 'Pint Glass', description: 'Shaker pint glass 16oz, dishwasher safe', category: 'Drinkware', subcategory: 'Glasses', technique: 'sublimation', baseCost: 14.96, retailPrice: 24.99, placement: 'default', isAllOverPrint: false, tags: ['glass', 'pint', 'beer'], gender: 'all', featured: false, priority: 96 },
  { printfulId: 690, name: 'Can-Shaped Glass', description: 'Trendy can-shaped glass 16oz', category: 'Drinkware', subcategory: 'Glasses', technique: 'sublimation', baseCost: 12.19, retailPrice: 22.99, placement: 'default', isAllOverPrint: false, tags: ['glass', 'can', 'trendy'], gender: 'all', featured: false, priority: 97 },

  // ──── STICKERS & PINS (6 products) ─────────────────────────
  { printfulId: 358, name: 'Kiss-Cut Stickers', description: 'Premium vinyl, weather-resistant, dishwasher safe', category: 'Stickers & Pins', subcategory: 'Stickers', technique: 'sublimation', baseCost: 2.29, retailPrice: 4.99, placement: 'default', isAllOverPrint: false, tags: ['sticker', 'vinyl', 'essential'], gender: 'all', featured: true, priority: 6 },
  { printfulId: 505, name: 'Sticker Sheet', description: 'Kiss-cut sticker sheet, multiple designs', category: 'Stickers & Pins', subcategory: 'Stickers', technique: 'sublimation', baseCost: 5.05, retailPrice: 9.99, placement: 'default', isAllOverPrint: false, tags: ['sticker', 'sheet', 'pack'], gender: 'all', featured: false, priority: 98 },
  { printfulId: 673, name: 'Holographic Stickers', description: 'Kiss-cut stickers with holographic metallic effect', category: 'Stickers & Pins', subcategory: 'Stickers', technique: 'sublimation', baseCost: 4.08, retailPrice: 6.99, placement: 'default', isAllOverPrint: false, tags: ['sticker', 'holographic', 'metallic'], gender: 'all', featured: false, priority: 99 },
  { printfulId: 656, name: 'Die-Cut Magnets', description: 'Custom shape fridge magnets', category: 'Stickers & Pins', subcategory: 'Magnets', technique: 'sublimation', baseCost: 3.32, retailPrice: 7.99, placement: 'default', isAllOverPrint: false, tags: ['magnet', 'fridge', 'custom'], gender: 'all', featured: false, priority: 100 },
  { printfulId: 660, name: 'Pin Button Set', description: 'Set of pin buttons with custom designs', category: 'Stickers & Pins', subcategory: 'Pins', technique: 'sublimation', baseCost: 8.42, retailPrice: 14.99, placement: 'default', isAllOverPrint: false, tags: ['pin', 'button', 'set'], gender: 'all', featured: false, priority: 101 },
  { printfulId: 516, name: 'Embroidered Patches', description: 'Iron-on embroidered patches', category: 'Stickers & Pins', subcategory: 'Patches', technique: 'embroidery', baseCost: 8.95, retailPrice: 14.99, placement: 'default', isAllOverPrint: false, tags: ['patch', 'embroidered', 'iron-on'], gender: 'all', featured: false, priority: 102 },

  // ──── ACCESSORIES (9 products) ─────────────────────────────
  { printfulId: 186, name: 'Sublimated Socks', description: 'Black foot socks with all-over print', category: 'Accessories', subcategory: 'Socks', technique: 'sublimation', baseCost: 10.39, retailPrice: 19.99, placement: 'default', isAllOverPrint: true, tags: ['socks', 'sublimation'], gender: 'all', featured: false, priority: 103 },
  { printfulId: 502, name: 'Embroidered Crew Socks', description: 'SOCCO SC200 • Crew socks with embroidered logo', category: 'Accessories', subcategory: 'Socks', technique: 'embroidery', baseCost: 22.90, retailPrice: 34.99, placement: 'front', isAllOverPrint: false, tags: ['socks', 'crew', 'embroidered'], gender: 'all', featured: false, priority: 104 },
  { printfulId: 420, name: 'Neck Gaiter', description: 'Multi-use neck gaiter / face cover', category: 'Accessories', subcategory: 'Face', technique: 'cut-sew', baseCost: 10.50, retailPrice: 19.99, placement: 'front', isAllOverPrint: true, tags: ['gaiter', 'neck', 'face'], gender: 'all', featured: false, priority: 105 },
  { printfulId: 630, name: 'Bandana', description: 'All-over print square bandana', category: 'Accessories', subcategory: 'Accessories', technique: 'cut-sew', baseCost: 11.00, retailPrice: 19.99, placement: 'front', isAllOverPrint: true, tags: ['bandana', 'scarf'], gender: 'all', featured: false, priority: 106 },
  { printfulId: 545, name: 'Headband', description: 'All-over print athletic headband', category: 'Accessories', subcategory: 'Accessories', technique: 'cut-sew', baseCost: 9.50, retailPrice: 17.99, placement: 'front', isAllOverPrint: true, tags: ['headband', 'sport'], gender: 'all', featured: false, priority: 107 },
];

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/** Get all distinct categories with product counts */
export function getStoreCategories(): Array<{ category: StoreCategory; count: number }> {
  const map = new Map<StoreCategory, number>();
  for (const p of EXPANDED_CATALOG) {
    map.set(p.category, (map.get(p.category) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/** Get the 6 featured products that appear in the artist profile */
export function getFeaturedProducts(): CatalogProduct[] {
  return EXPANDED_CATALOG
    .filter(p => p.featured)
    .sort((a, b) => a.priority - b.priority);
}

/** Get all products for the full store, sorted by priority */
export function getFullCatalog(): CatalogProduct[] {
  return [...EXPANDED_CATALOG].sort((a, b) => a.priority - b.priority);
}

/** Get products by category */
export function getProductsByCategory(category: StoreCategory): CatalogProduct[] {
  return EXPANDED_CATALOG
    .filter(p => p.category === category)
    .sort((a, b) => a.priority - b.priority);
}

/** Search products by query (matches name, tags, description) */
export function searchCatalogProducts(query: string): CatalogProduct[] {
  const q = query.toLowerCase();
  return EXPANDED_CATALOG.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.tags.some(t => t.includes(q)) ||
    p.category.toLowerCase().includes(q) ||
    p.subcategory.toLowerCase().includes(q)
  );
}

/** Calculate retail price from base cost with target margin */
export function calculateRetailFromCost(baseCost: number, targetMargin = 0.55): number {
  const raw = baseCost / (1 - targetMargin);
  return Math.ceil(raw) - 0.01; // e.g. $29.99
}

/** Total product count */
export const TOTAL_PRODUCT_COUNT = EXPANDED_CATALOG.length;

// ═══════════════════════════════════════════════════════════════
// PRINTFUL PLACEMENT GEOMETRY
// ═══════════════════════════════════════════════════════════════
// Per-category print area + design size used when calling Printful's
// Mockup Generator and CreateOrder. Units follow Printful's API:
// area_width / area_height = printable area in pixels (≈ inch × 100)
// width / height            = where the design actually sits
// top / left                = offset from top-left of the printable area
//
// Strategy: design occupies the full PRINT area (Printful auto-scales).
// We center it; for items where the printable area itself is small
// (caps, mugs, phone cases) the design naturally renders at the right
// physical scale because we lie about neither area_* nor width/height.
//
// IMPORTANT: these geometries are conservative defaults that work
// across all variants of a given category. For per-product perfect
// alignment, fetch /mockup-generator/printfiles/{productId} and
// override the geometry when caching.

export interface PrintfulPlacementGeometry {
  /** Printful placement string passed to mockup-generator/create-task */
  placement: string;
  /** Print area dimensions (≈ physical inches × 100) */
  area_width: number;
  area_height: number;
  /** Where design sits inside the print area */
  width: number;
  height: number;
  top: number;
  left: number;
}

export const CATEGORY_PLACEMENT_GEOMETRY: Record<string, PrintfulPlacementGeometry> = {
  // T-shirts, tanks, long sleeves — Bella+Canvas standard front area is 12"×16"
  // Logo sized to 10"×12.5" centered in the chest area, top offset ~1.5" below collar
  'Apparel':              { placement: 'front', area_width: 1800, area_height: 2400, width: 1500, height: 1875, top: 200, left: 150 },
  // Hoodies — same area but design positioned to clear the hoodie pocket / hood
  'Hoodies & Sweatshirts':{ placement: 'front', area_width: 1800, area_height: 2400, width: 1500, height: 1875, top: 250, left: 150 },
  // Caps — small embroidery front area ~4.5"×2.25". Center the mark.
  'Hats & Beanies':       { placement: 'embroidery_front', area_width: 450, area_height: 225, width: 350, height: 175, top: 25, left: 50 },
  // Mugs (11oz/15oz) — wrap area ~9.5"×4". Big horizontal area.
  'Drinkware':            { placement: 'default', area_width: 950, area_height: 400, width: 800, height: 333, top: 33, left: 75 },
  // Phone cases — full back ~3"×6". Use full-coverage.
  'Phone Cases':          { placement: 'default', area_width: 600, area_height: 1200, width: 600, height: 1200, top: 0, left: 0 },
  // Bags (totes/backpacks) — large center area ~12"×14".
  'Bags':                 { placement: 'default', area_width: 1200, area_height: 1400, width: 1000, height: 1167, top: 117, left: 100 },
  // Posters — full coverage
  'Wall Art':             { placement: 'default', area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 },
  // Stickers — full coverage square
  'Stickers & Pins':      { placement: 'default', area_width: 600, area_height: 600, width: 600, height: 600, top: 0, left: 0 },
  // Home & Living — generic large
  'Home & Living':        { placement: 'default', area_width: 1800, area_height: 1800, width: 1500, height: 1500, top: 150, left: 150 },
  // Accessories — small front placement
  'Accessories':          { placement: 'default', area_width: 600, area_height: 600, width: 500, height: 500, top: 50, left: 50 },
  // Shoes — front/side panel
  'Shoes':                { placement: 'default', area_width: 600, area_height: 800, width: 500, height: 666, top: 67, left: 50 },
  // Kids & Baby — like Apparel but proportionally smaller
  'Kids & Baby':          { placement: 'front', area_width: 1500, area_height: 2000, width: 1200, height: 1500, top: 167, left: 150 },
};

/**
 * Returns the proper Printful placement geometry for a given product.
 * Falls back to generic apparel front if category not mapped.
 */
export function getPlacementGeometry(product: CatalogProduct): PrintfulPlacementGeometry {
  // All-over print → fill the entire printable area
  if (product.isAllOverPrint) {
    return {
      placement: product.placement || 'front',
      area_width: 1800,
      area_height: 2400,
      width: 1800,
      height: 2400,
      top: 0,
      left: 0,
    };
  }
  const geo = CATEGORY_PLACEMENT_GEOMETRY[product.category];
  if (geo) {
    // Allow per-product placement override (e.g. 'back' for some hoodies)
    return { ...geo, placement: product.placement || geo.placement };
  }
  return CATEGORY_PLACEMENT_GEOMETRY['Apparel'];
}

/** Category icon mapping for UI */
export const CATEGORY_ICONS: Record<StoreCategory, string> = {
  'Apparel': '👕',
  'Hoodies & Sweatshirts': '🧥',
  'Hats & Beanies': '🧢',
  'Accessories': '🧣',
  'Phone Cases': '📱',
  'Bags': '🎒',
  'Shoes': '👟',
  'Home & Living': '🏠',
  'Wall Art': '🖼️',
  'Drinkware': '☕',
  'Stickers & Pins': '✨',
  'Kids & Baby': '👶',
};

// ═══════════════════════════════════════════════════════════════
// PRINTFUL PRODUCT IMAGES — real catalog photos from Printful CDN
// ═══════════════════════════════════════════════════════════════

export const PRINTFUL_PRODUCT_IMAGES: Record<number, string> = {
  71: 'https://files.cdn.printful.com/o/upload/product-catalog-img/20/2079a3ee4cc472ad952fe16654f274cd_l',
  162: 'https://files.cdn.printful.com/o/upload/product-catalog-img/7f/7f84bc900e266780cb31f3d28e41c7c0_l',
  508: 'https://files.cdn.printful.com/o/upload/product-catalog-img/27/27a0e15dcb0e2d6b6ba4a836d05a2d1e_l',
  586: 'https://files.cdn.printful.com/o/upload/product-catalog-img/6d/6d7501c1e4b984392a258054bf0cd145_l',
  356: 'https://files.cdn.printful.com/o/upload/product-catalog-img/81/81f6a07c7d89482446ca87dbd1489dd1_l',
  360: 'https://files.cdn.printful.com/o/upload/product-catalog-img/67/6770d94fd7853f892929cc77fba67f97_l',
  365: 'https://files.cdn.printful.com/o/upload/product-catalog-img/89/89a0300f9bb58b700aad8b4401acfdfb_l',
  248: 'https://files.cdn.printful.com/o/upload/product-catalog-img/f8/f836f923a554381037d8ae779bc64c1d_l',
  271: 'https://files.cdn.printful.com/o/upload/product-catalog-img/bc/bcf2c5bcb299d6399d4a683aba1bd0c9_l',
  537: 'https://files.cdn.printful.com/o/upload/product-catalog-img/f1/f1a2114ae93247d9c839ab55e5300ba5_l',
  411: 'https://files.cdn.printful.com/o/upload/product-catalog-img/ad/ad9ddd4bd72e10797de24da876bb3c6d_l',
  412: 'https://files.cdn.printful.com/o/upload/product-catalog-img/ee/eef7b9dfab618e09e003e116e563611b_l',
  482: 'https://files.cdn.printful.com/o/upload/product-catalog-img/59/59f16245bce6f1f2a29ee86e67eec4b3_l',
  294: 'https://files.cdn.printful.com/o/upload/product-catalog-img/35/352d4f3cc9fbac9ee9173467bc7f200e_l',
  380: 'https://files.cdn.printful.com/o/upload/product-catalog-img/0e/0e62ae87da7d32dfb60d6dadc3744346_l',
  317: 'https://files.cdn.printful.com/o/upload/product-catalog-img/16/16546c8b251eacfbb2c22c5f31ddc557_l',
  378: 'https://files.cdn.printful.com/o/upload/product-catalog-img/65/65d87f00b10ba55f54dc0f11de5b29a2_l',
  145: 'https://files.cdn.printful.com/o/upload/product-catalog-img/c4/c45dccb582df772f84fcafde9b726096_l',
  146: 'https://files.cdn.printful.com/o/upload/product-catalog-img/c6/c650a4604d04de3cedb2694e01920f60_l',
  342: 'https://files.cdn.printful.com/o/upload/product-catalog-img/50/5003f2099e47e2b7b5d9b91959783bcd_l',
  367: 'https://files.cdn.printful.com/o/upload/product-catalog-img/96/965d2ac3d059e6ec8e9a040ba30e97e4_l',
  641: 'https://files.cdn.printful.com/o/upload/product-catalog-img/fa/fa37e474f7c3d027440f63ab51ad7692_l',
  274: 'https://files.cdn.printful.com/o/upload/product-catalog-img/dc/dc9e348381cbeb3db14ae61f926968e9_l',
  262: 'https://files.cdn.printful.com/o/upload/product-catalog-img/0f/0f04d7347428ef01d6f5541c3a63de2_l',
  279: 'https://files.cdn.printful.com/o/upload/product-catalog-img/1c/1cb4394b298d1d9e5d622976d8b89213_l',
  389: 'https://files.cdn.printful.com/o/upload/product-catalog-img/7a/7a042b22c29c6a2449672eec62ec2619_l',
  465: 'https://files.cdn.printful.com/o/upload/product-catalog-img/0c/0c1a5f944c18301aa3b8db21bc5a8bf7_l',
  350: 'https://files.cdn.printful.com/o/upload/product-catalog-img/a5/a5b065fbef259cc4554b04bcad64f006_l',
  594: 'https://files.cdn.printful.com/o/upload/product-catalog-img/ed/ed1e2bcfb0b0e2e680f14f2b50e0ea25_l',
  627: 'https://files.cdn.printful.com/o/upload/product-catalog-img/4e/4e9119649dfbca7f1b1210b9fb3ce368_l',
  206: 'https://files.cdn.printful.com/o/products/206/product_1584101692.jpg',
  252: 'https://files.cdn.printful.com/o/products/252/product_1585041529.jpg',
  253: 'https://files.cdn.printful.com/o/products/253/product_1585059342.jpg',
  266: 'https://files.cdn.printful.com/o/products/266/product_1584696677.jpg',
  327: 'https://files.cdn.printful.com/o/products/327/product_1585747379.jpg',
  396: 'https://files.cdn.printful.com/o/products/396/product_1585044725.jpg',
  422: 'https://files.cdn.printful.com/o/upload/product-catalog-img/80/8040b85be3ca89dd7f8fbc91f80ce385_l',
  449: 'https://files.cdn.printful.com/o/upload/product-catalog-img/a7/a7689fa48bd1fbb903d6ff30f3dfea6d_l',
  451: 'https://files.cdn.printful.com/o/products/451/product_1601555945.jpg',
  519: 'https://files.cdn.printful.com/o/upload/product-catalog-img/c4/c402cbb2c375e9ba922a14855a05cb19_l',
  532: 'https://files.cdn.printful.com/o/upload/product-catalog-img/7a/7a477dc112d1aecab4184e76a4184ac2_l',
  557: 'https://files.cdn.printful.com/o/upload/product-catalog-img/82/824fcb11998160d72c31db8acff49826_l',
  560: 'https://files.cdn.printful.com/o/upload/product-catalog-img/e1/e10aff06db5b66cf3c4d7fa57106df43_l',
  596: 'https://files.cdn.printful.com/o/upload/product-catalog-img/83/83e88e46b9a19c01100645b67db7635f_l',
  637: 'https://files.cdn.printful.com/o/upload/product-catalog-img/24/2482d086816c661d09de1f363e3fdec7_l',
  638: 'https://files.cdn.printful.com/o/upload/product-catalog-img/c4/c45ba3c882b8ecb672b30ac5c1041955_l',
  662: 'https://files.cdn.printful.com/o/upload/product-catalog-img/91/91321d11b8eb841dfc2fe735f9b9d7d7_l',
  680: 'https://files.cdn.printful.com/o/upload/product-catalog-img/35/35a0e118ff275a371e01b92a5d8f46cd_l',
  265: 'https://files.cdn.printful.com/o/products/265/product_1585834588.jpg',
  297: 'https://files.cdn.printful.com/o/upload/product-catalog-img/b1/b1504be1bd986f72acdf3c427e0cce4a_l',
  186: 'https://files.cdn.printful.com/o/upload/product-catalog-img/e9/e9b0b0861f8a72c69d450ecfe8c98635_l',
  502: 'https://files.cdn.printful.com/o/upload/product-catalog-img/50/50e86f0bd2e253fb3466470842cda120_l',
  505: 'https://files.cdn.printful.com/o/upload/product-catalog-img/76/7658fa12bc07c99e823fbc140595bc24_l',
  673: 'https://files.cdn.printful.com/o/upload/product-catalog-img/a9/a962d22dbd03b9ae1cf9e473526ab5d2_l',
  656: 'https://files.cdn.printful.com/o/upload/product-catalog-img/24/24b767af95768718c7a62fcb817d01a4_l',
  660: 'https://files.cdn.printful.com/o/upload/product-catalog-img/10/101733006241d5b615735542f3b7888d_l',
  516: 'https://files.cdn.printful.com/o/upload/product-catalog-img/52/52dda392a73af8e9d253005b3698d571_l',
  395: 'https://files.cdn.printful.com/o/upload/product-catalog-img/7a/7a7486c4b4144d3f02d9484a231242e1_l',
  536: 'https://files.cdn.printful.com/o/upload/product-catalog-img/ae/ae3a7724e35a7f986307ade04c3f4b7b_l',
  611: 'https://files.cdn.printful.com/o/upload/product-catalog-img/d4/d41d6e69b8c865b6a4546ce030775f2f_l',
  181: 'https://files.cdn.printful.com/o/products/181/product_1570615955.jpg',
  267: 'https://files.cdn.printful.com/o/upload/product-catalog-img/7c/7c7a0c9bba1ab7ead3c03753adc262b6_l',
  601: 'https://files.cdn.printful.com/o/upload/product-catalog-img/e8/e8137cb9510f23d9b446cfce126c2f58_l',
  686: 'https://files.cdn.printful.com/o/upload/product-catalog-img/c6/c6d9effd965c5c7e223a01696a96e2a6_l',
  19: 'https://files.cdn.printful.com/o/upload/product-catalog-img/8c/8c4ac4a450b8485bc8a6e041a5a23666_l',
  513: 'https://files.cdn.printful.com/o/upload/product-catalog-img/88/885db0018c7dc97a35fab7e3d182af0c_l',
  525: 'https://files.cdn.printful.com/o/upload/product-catalog-img/53/53882a8d25358ca23019c892cf366de8_l',
  574: 'https://files.cdn.printful.com/o/upload/product-catalog-img/de/de90cebafd7d18cc8d71dfe9b1353104_l',
  575: 'https://files.cdn.printful.com/o/upload/product-catalog-img/8e/8e9e82e7d181d462f96bf7d070904398_l',
  597: 'https://files.cdn.printful.com/o/upload/product-catalog-img/37/37dde92ca8cc638f25cb47e2bc8362ab_l',
  598: 'https://files.cdn.printful.com/o/upload/product-catalog-img/1e/1e7196b8b6ef3d2163d288c7351336dd_l',
  657: 'https://files.cdn.printful.com/o/upload/product-catalog-img/b5/b53d5af8619287035b2135bf48a93b69_l',
  658: 'https://files.cdn.printful.com/o/upload/product-catalog-img/2b/2b9e1780ec734da27c1d69b19676e180_l',
  1: 'https://files.cdn.printful.com/o/products/1/product_1613463122.jpg',
  3: 'https://files.cdn.printful.com/o/products/3/product_1613463725.jpg',
  214: 'https://files.cdn.printful.com/o/products/214/product_1573737284.jpg',
  259: 'https://files.cdn.printful.com/o/products/259/product_1606198364.jpg',
  394: 'https://files.cdn.printful.com/o/upload/product-catalog-img/02/022e7ef918b642b66d60b3ce3cb5e5ee_l',
  518: 'https://files.cdn.printful.com/o/upload/product-catalog-img/83/83dfc4934273f68021ef5d0324168e39_l',
  583: 'https://files.cdn.printful.com/o/upload/product-catalog-img/17/1753cc3ed8f6b1f796c1f86bc140ee37_l',
  675: 'https://files.cdn.printful.com/o/upload/product-catalog-img/7f/7f5b93c735bf44dc657fd20da58dba97_l',
  614: 'https://files.cdn.printful.com/o/upload/product-catalog-img/6e/6ed851bb13949c3f4af7c7a266cc50d1_l',
  534: 'https://files.cdn.printful.com/o/upload/product-catalog-img/2c/2c78bb29cbe923a5db6929adaae267b1_l',
  474: 'https://files.cdn.printful.com/o/upload/product-catalog-img/95/959982bbc26d6ac2c831edbe3207cc6c_l',
  382: 'https://files.cdn.printful.com/o/products/382/product_1614007264.jpg',
  585: 'https://files.cdn.printful.com/o/upload/product-catalog-img/cf/cf742bc2278471fa6e9a74aeb76192d9_l',
  632: 'https://files.cdn.printful.com/o/upload/product-catalog-img/b0/b0158a5b9729e31b0f0a9f64d787081a_l',
  653: 'https://files.cdn.printful.com/o/upload/product-catalog-img/62/6225a66e6c7a4f34734e3ddb668e4a49_l',
  690: 'https://files.cdn.printful.com/o/upload/product-catalog-img/0b/0b46772924715003ebd0ef10e0c9b00b_l',
  691: 'https://files.cdn.printful.com/o/upload/product-catalog-img/06/06555112680307a55f80f781666ec68_l',
  742: 'https://files.cdn.printful.com/o/upload/product-catalog-img/a4/a4bcec2c594defdaf96c4c940ba8c905_l',
  663: 'https://files.cdn.printful.com/o/upload/product-catalog-img/38/38d259e30dff715402ef6b87aac89f5c_l',
  407: 'https://files.cdn.printful.com/o/products/407/product_1580740276.jpg',
  300: 'https://files.cdn.printful.com/o/upload/product-catalog-img/2e/2e374a575d31ab64fa9cb7f1af7db269_l',
  403: 'https://files.cdn.printful.com/o/products/403/product_1595515161.jpg',
  358: 'https://files.cdn.printful.com/o/products/358/product_1553084472.jpg',
  171: 'https://files.cdn.printful.com/o/products/171/product_1613463439.jpg',
  172: 'https://files.cdn.printful.com/o/products/172/product_1614596957.jpg',
  640: 'https://files.cdn.printful.com/o/upload/product-catalog-img/a5/a5b9548dae9fd4df4398fc97adc8d199_l',
  2: 'https://files.cdn.printful.com/o/products/2/product_1613463227.jpg',
  304: 'https://files.cdn.printful.com/o/products/304/product_1613463672.jpg',
};

/** Get the Printful catalog image URL for a product */
export function getProductImageUrl(printfulId: number): string {
  return PRINTFUL_PRODUCT_IMAGES[printfulId] || '';
}
