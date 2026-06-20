/**
 * Printful Catalog — Dual-mode catalog browser
 * 
 * Mode 1: "My Store" (default) — Shows your curated ~97 products from the expanded catalog
 *   with store config status (visible/hidden, featured, pricing with multipliers, margins)
 * 
 * Mode 2: "Browse Printful" — Raw Printful API browser for discovering new products to add
 */

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Package, Eye, EyeOff, Star, TrendingUp,
  DollarSign, Percent, ArrowUpDown, Grid3X3,
  List, ShoppingBag, ExternalLink, Loader2,
} from "lucide-react";
import { CreateSyncProductDialog } from "./create-sync-product-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

// ══════ TYPES ══════

interface StoreProduct {
  printfulId: number;
  name: string;
  category: string;
  subcategory: string;
  baseCost: number;
  originalRetailPrice: number;
  calculatedPrice: number;
  margin: string;
  isHidden: boolean;
  isFeatured: boolean;
  imageUrl: string;
  tags: string[];
  gender: string;
}

interface PreviewData {
  config: {
    globalMultiplier: number;
    categoryMultipliers: Record<string, number>;
    hiddenProducts: number[];
    featuredProducts: number[];
    imageOverrides: Record<number, string>;
    priceOverrides: Record<number, number>;
    updatedAt: string;
  };
  products: StoreProduct[];
  stats: {
    total: number;
    visible: number;
    hidden: number;
    featured: number;
    avgMargin: string;
    priceRange: { min: number; max: number };
  };
}

interface PrintfulProduct {
  id: number;
  type: string;
  type_name: string;
  title: string;
  brand: string;
  image: string;
  variant_count: number;
  currency: string;
  description: string;
}

interface PrintfulVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code?: string;
  image: string;
  price: string;
  in_stock: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Apparel': '👕', 'Hoodies & Sweatshirts': '🧥', 'Hats & Beanies': '🧢',
  'Accessories': '🧣', 'Phone Cases': '📱', 'Bags': '🎒', 'Shoes': '👟',
  'Home & Living': '🏠', 'Wall Art': '🖼️', 'Drinkware': '☕',
  'Stickers & Pins': '✨', 'Kids & Baby': '👶',
};

type SortKey = 'name' | 'price-asc' | 'price-desc' | 'margin-asc' | 'margin-desc' | 'category';

// ══════ MAIN COMPONENT ══════

export function PrintfulCatalog() {
  const [mode, setMode] = useState<'store' | 'printful'>('store');

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-input overflow-hidden">
          <button
            onClick={() => setMode('store')}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
              mode === 'store'
                ? 'bg-orange-500 text-white'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            My Store Products
          </button>
          <button
            onClick={() => setMode('printful')}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
              mode === 'printful'
                ? 'bg-blue-500 text-white'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            Browse Printful
          </button>
        </div>
        <span className="text-xs text-muted-foreground ml-2">
          {mode === 'store'
            ? 'Your curated catalog with pricing & status'
            : 'Explore the full Printful library'}
        </span>
      </div>

      {mode === 'store' ? <MyStoreCatalog /> : <BrowsePrintfulCatalog />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODE 1: MY STORE CATALOG (Local catalog + config-aware)
// ══════════════════════════════════════════════════════════════

function MyStoreCatalog() {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'visible' | 'hidden' | 'featured'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('category');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preview, isLoading } = useQuery<PreviewData>({
    queryKey: ['/api/merch-config/preview'],
    queryFn: async () => {
      const res = await fetch('/api/merch-config/preview');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  // Derived data
  const products = preview?.products || [];
  const stats = preview?.stats;
  const config = preview?.config;

  // Categories with counts
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(p.category, (map.get(p.category) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  // Filtered & sorted products
  const filtered = useMemo(() => {
    let result = [...products];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.subcategory.toLowerCase().includes(q) ||
        p.tags.some(t => t.includes(q))
      );
    }
    if (filterCat) result = result.filter(p => p.category === filterCat);
    if (filterStatus === 'visible') result = result.filter(p => !p.isHidden);
    if (filterStatus === 'hidden') result = result.filter(p => p.isHidden);
    if (filterStatus === 'featured') result = result.filter(p => p.isFeatured);

    switch (sortBy) {
      case 'name': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'price-asc': result.sort((a, b) => a.calculatedPrice - b.calculatedPrice); break;
      case 'price-desc': result.sort((a, b) => b.calculatedPrice - a.calculatedPrice); break;
      case 'margin-asc': result.sort((a, b) => parseFloat(a.margin) - parseFloat(b.margin)); break;
      case 'margin-desc': result.sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin)); break;
      case 'category': result.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)); break;
    }

    return result;
  }, [products, search, filterCat, filterStatus, sortBy]);

  // Toggle visibility
  const toggleVisibility = async (printfulId: number, makeVisible: boolean) => {
    try {
      const res = await fetch('/api/merch-config/visibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printfulId, visible: makeVisible }),
      });
      if (!res.ok) throw new Error('Failed');
      queryClient.invalidateQueries({ queryKey: ['/api/merch-config/preview'] });
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle visibility', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="h-40 w-full" />
            <div className="p-3 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Strip */}
      {stats && config && (
        <div className="flex flex-wrap items-center gap-3 px-1 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Package className="w-3 h-3" /> {stats.visible} visible / {stats.total} total
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Star className="w-3 h-3 text-orange-400" /> {stats.featured} featured
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Percent className="w-3 h-3 text-green-400" /> {stats.avgMargin}% avg margin
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <DollarSign className="w-3 h-3" /> ${stats.priceRange.min.toFixed(0)} – ${stats.priceRange.max.toFixed(0)}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="w-3 h-3" /> x{config.globalMultiplier} multiplier
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search your store products..."
            className="pl-9 h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs min-w-[140px]"
          >
            <option value="">All Categories</option>
            {categories.map(([cat, count]) => (
              <option key={cat} value={cat}>{CATEGORY_ICONS[cat] || '📦'} {cat} ({count})</option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="flex rounded-md border border-input overflow-hidden">
            {(['all', 'visible', 'hidden', 'featured'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors capitalize ${
                  filterStatus === s
                    ? s === 'featured' ? 'bg-orange-500 text-white'
                      : s === 'hidden' ? 'bg-red-500/80 text-white'
                      : 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs"
          >
            <option value="category">Sort: Category</option>
            <option value="name">Sort: Name</option>
            <option value="price-asc">Sort: Price ↑</option>
            <option value="price-desc">Sort: Price ↓</option>
            <option value="margin-asc">Sort: Margin ↑</option>
            <option value="margin-desc">Sort: Margin ↓</option>
          </select>

          {/* View Toggle */}
          <div className="flex rounded-md border border-input overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-muted' : 'bg-background'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 ${viewMode === 'table' ? 'bg-muted' : 'bg-background'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Categories Horizontal */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilterCat('')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
            !filterCat
              ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
              : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          🔥 All ({products.length})
        </button>
        {categories.map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => setFilterCat(prev => prev === cat ? '' : cat)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
              filterCat === cat
                ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {CATEGORY_ICONS[cat] || '📦'} {cat} ({count})
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground px-1">
        Showing {filtered.length} product{filtered.length !== 1 ? 's' : ''}
        {search && <> matching "<span className="text-orange-400">{search}</span>"</>}
      </p>

      {/* GRID VIEW */}
      {viewMode === 'grid' ? (
        filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No products match your filters</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map(p => (
              <StoreProductCard key={p.printfulId} product={p} onToggleVisibility={toggleVisibility} />
            ))}
          </div>
        )
      ) : (
        /* TABLE VIEW */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Product</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Category</th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground">Base Cost</th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground">Retail</th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground">Margin</th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.printfulId} className={`border-b hover:bg-muted/20 transition-colors ${p.isHidden ? 'opacity-50' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
                          ) : (
                            <span className="flex items-center justify-center h-full text-lg">{CATEGORY_ICONS[p.category]}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-xs leading-tight">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">{p.subcategory}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      <span className="mr-1">{CATEGORY_ICONS[p.category]}</span>{p.category}
                    </td>
                    <td className="p-3 text-xs text-right text-muted-foreground">${p.baseCost.toFixed(2)}</td>
                    <td className="p-3 text-xs text-right font-semibold text-orange-400">${p.calculatedPrice.toFixed(2)}</td>
                    <td className="p-3 text-xs text-right">
                      <span className={parseFloat(p.margin) > 60 ? 'text-green-400' : parseFloat(p.margin) > 40 ? 'text-amber-400' : 'text-red-400'}>
                        {p.margin}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {p.isFeatured && (
                          <Badge className="bg-orange-500/20 text-orange-400 border-0 text-[9px] px-1 py-0">
                            <Star className="w-2 h-2 mr-0.5" />★
                          </Badge>
                        )}
                        {p.isHidden ? (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Hidden</Badge>
                        ) : (
                          <Badge className="bg-green-500/15 text-green-400 border-0 text-[9px] px-1.5 py-0">Visible</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleVisibility(p.printfulId, p.isHidden)}
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                          p.isHidden ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        }`}
                        title={p.isHidden ? 'Show' : 'Hide'}
                      >
                        {p.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// STORE PRODUCT CARD (Grid view)
// ══════════════════════════════════════════════════════════════

function StoreProductCard({ product: p, onToggleVisibility }: {
  product: StoreProduct;
  onToggleVisibility: (id: number, visible: boolean) => void;
}) {
  const margin = parseFloat(p.margin);

  return (
    <Card className={`overflow-hidden group transition-all duration-200 hover:shadow-lg ${p.isHidden ? 'opacity-50 hover:opacity-80' : 'hover:shadow-orange-500/5'}`}>
      {/* Image */}
      <div className="aspect-square relative overflow-hidden bg-muted/30">
        {p.imageUrl ? (
          <img
            src={p.imageUrl}
            alt={p.name}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-3xl">{CATEGORY_ICONS[p.category]}</div>
        )}

        {/* Status badges */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          {p.isFeatured && (
            <Badge className="bg-orange-500 text-white text-[9px] px-1.5 py-0 shadow-sm">
              <Star className="w-2.5 h-2.5 mr-0.5" /> Featured
            </Badge>
          )}
          {p.isHidden && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shadow-sm">
              <EyeOff className="w-2.5 h-2.5 mr-0.5" /> Hidden
            </Badge>
          )}
        </div>

        {/* Margin badge top-right */}
        <div className="absolute top-1.5 right-1.5">
          <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm ${
            margin > 60 ? 'bg-green-500/80 text-white' : margin > 40 ? 'bg-amber-500/80 text-white' : 'bg-red-500/80 text-white'
          }`}>
            {p.margin}%
          </span>
        </div>

        {/* Hover actions */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
          <button
            onClick={() => onToggleVisibility(p.printfulId, p.isHidden)}
            className={`w-full py-1.5 rounded-md text-[11px] font-medium transition-colors ${
              p.isHidden ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {p.isHidden ? 'Show in Store' : 'Hide from Store'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <div className="flex items-start gap-1 mb-1">
          <span className="text-xs">{CATEGORY_ICONS[p.category]}</span>
          <p className="text-xs font-semibold leading-tight line-clamp-1 flex-1">{p.name}</p>
        </div>
        <p className="text-[10px] text-muted-foreground mb-1.5 line-clamp-1">{p.subcategory}</p>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground line-through mr-1">${p.baseCost.toFixed(2)}</span>
            <span className="text-sm font-bold text-orange-400">${p.calculatedPrice.toFixed(2)}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{p.gender}</span>
        </div>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// MODE 2: BROWSE PRINTFUL (Raw API browser)
// ══════════════════════════════════════════════════════════════

function BrowsePrintfulCatalog() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<PrintfulProduct | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [productToSync, setProductToSync] = useState<PrintfulProduct | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['/api/printful/catalog/products'],
  });

  const { data: variantsData, isLoading: loadingVariants } = useQuery({
    queryKey: ['/api/printful/catalog/products', selectedProduct?.id, 'variants'],
    enabled: !!selectedProduct,
  });

  // Also load store config to show which products are already in the store
  const { data: preview } = useQuery<PreviewData>({
    queryKey: ['/api/merch-config/preview'],
    queryFn: async () => {
      const res = await fetch('/api/merch-config/preview');
      if (!res.ok) return null;
      return res.json();
    },
  });

  const storeProductIds = useMemo(() => {
    return new Set((preview?.products || []).map(p => p.printfulId));
  }, [preview]);

  const products: PrintfulProduct[] = catalogData?.data || [];
  const variants: PrintfulVariant[] = variantsData?.data || [];

  const categories = useMemo(() => {
    return Array.from(new Set(products.map(p => p.type_name))).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let result = products;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.type_name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") {
      result = result.filter(p => p.type_name === categoryFilter);
    }
    return result;
  }, [products, searchTerm, categoryFilter]);

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <Card className="p-3 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-center gap-2 text-xs">
          <ExternalLink className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <p className="text-muted-foreground">
            Browsing the full Printful catalog ({products.length} products). Products already in your store are marked with a <span className="text-green-400 font-medium">green badge</span>.
            Use "Sync" to add products to your Printful sync list.
          </p>
        </div>
      </Card>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search Printful products..."
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs"
          >
            <option value="all">All Types ({products.length})</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(categoryFilter !== "all" || searchTerm) && (
            <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter("all"); setSearchTerm(""); }} className="text-xs">
              Clear
            </Button>
          )}
          <Badge variant="outline" className="px-3 py-1.5 text-xs">
            {filtered.length} products
          </Badge>
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="overflow-hidden"><Skeleton className="h-40 w-full" /><div className="p-3 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{searchTerm ? 'No products match your search' : 'No products available'}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(product => {
            const isInStore = storeProductIds.has(product.id);

            return (
              <Card key={product.id} className="overflow-hidden group hover:shadow-lg transition-all duration-200">
                <div className="aspect-square relative overflow-hidden bg-white">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {/* In-store badge */}
                  {isInStore && (
                    <div className="absolute top-1.5 left-1.5">
                      <Badge className="bg-green-500 text-white text-[9px] px-1.5 py-0 shadow-sm">
                        ✓ In Store
                      </Badge>
                    </div>
                  )}
                  <div className="absolute top-1.5 right-1.5">
                    <Badge className="bg-black/60 text-white text-[9px] px-1.5 py-0 backdrop-blur-sm">
                      {product.variant_count} variants
                    </Badge>
                  </div>
                </div>

                <div className="p-3">
                  <h3 className="text-xs font-semibold line-clamp-1 mb-0.5">{product.title}</h3>
                  <p className="text-[10px] text-muted-foreground mb-2 line-clamp-1">
                    {product.brand} · {product.type_name}
                  </p>

                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-[11px]"
                      onClick={() => { setProductToSync(product); setSyncDialogOpen(true); }}
                    >
                      Sync
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] px-2"
                          onClick={() => setSelectedProduct(product)}
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{product.title}</DialogTitle>
                          <DialogDescription>{product.brand} · {product.type_name}</DialogDescription>
                        </DialogHeader>
                        <div className="grid md:grid-cols-2 gap-6 mt-4">
                          <img src={product.image} alt={product.title} className="w-full rounded-lg bg-white" />
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold text-sm mb-1">Description</h4>
                              <p className="text-xs text-muted-foreground">{product.description || 'No description'}</p>
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between"><span className="text-muted-foreground">Brand</span><span className="font-medium">{product.brand}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{product.type_name}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Variants</span><span className="font-medium">{product.variant_count}</span></div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">In Your Store</span>
                                <span className={`font-medium ${isInStore ? 'text-green-400' : 'text-muted-foreground'}`}>
                                  {isInStore ? '✓ Yes' : 'No'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {loadingVariants ? (
                          <div className="mt-4 grid grid-cols-3 gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28" />)}</div>
                        ) : variants.length > 0 ? (
                          <div className="mt-4">
                            <h4 className="font-semibold text-sm mb-3">Variants ({variants.length})</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
                              {variants.map(v => (
                                <Card key={v.id} className="p-2">
                                  <img src={v.image} alt={v.name} className="w-full aspect-square object-contain rounded mb-1.5" />
                                  <p className="text-[10px] font-medium line-clamp-1">{v.name}</p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    {v.color_code && <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: v.color_code }} />}
                                    <span className="text-[10px] text-muted-foreground">{v.size}</span>
                                    <span className="ml-auto text-[10px] font-bold text-orange-400">${v.price}</span>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {productToSync && (
        <CreateSyncProductDialog
          productId={productToSync.id}
          productName={productToSync.title}
          productImage={productToSync.image}
          open={syncDialogOpen}
          onOpenChange={setSyncDialogOpen}
        />
      )}
    </div>
  );
}
