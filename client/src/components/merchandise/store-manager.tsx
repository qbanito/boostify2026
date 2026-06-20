/**
 * Store Manager — Panel de gestión de la tienda de merch
 * 
 * Funcionalidades:
 * 1. Pricing Engine — Multiplicador global y por categoría
 * 2. Product Visibility — Mostrar/ocultar productos
 * 3. Featured Selector — Elegir los 6 productos destacados
 * 4. Stats Dashboard — Métricas de la tienda
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign, Eye, EyeOff, Star, BarChart3,
  Save, RotateCcw, Search, ChevronDown, ChevronUp,
  Loader2, TrendingUp, Package, ShoppingBag, Percent,
  Check, X, Sparkles, Filter, Image,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface StoreConfig {
  globalMultiplier: number;
  categoryMultipliers: Record<string, number>;
  hiddenProducts: number[];
  featuredProducts: number[];
  imageOverrides: Record<number, string>;
  priceOverrides: Record<number, number>;
  updatedAt: string;
}

interface ProductPreview {
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
  config: StoreConfig;
  products: ProductPreview[];
  stats: {
    total: number;
    visible: number;
    hidden: number;
    featured: number;
    avgMargin: string;
    priceRange: { min: number; max: number };
  };
}

const CATEGORIES = [
  'Apparel', 'Hoodies & Sweatshirts', 'Hats & Beanies', 'Accessories',
  'Phone Cases', 'Bags', 'Shoes', 'Home & Living', 'Wall Art',
  'Drinkware', 'Stickers & Pins', 'Kids & Baby',
];

const CATEGORY_ICONS: Record<string, string> = {
  'Apparel': '👕', 'Hoodies & Sweatshirts': '🧥', 'Hats & Beanies': '🧢',
  'Accessories': '🧣', 'Phone Cases': '📱', 'Bags': '🎒', 'Shoes': '👟',
  'Home & Living': '🏠', 'Wall Art': '🖼️', 'Drinkware': '☕',
  'Stickers & Pins': '✨', 'Kids & Baby': '👶',
};

const PRESETS = [
  { label: 'Economy', value: 1.8, color: 'text-green-400' },
  { label: 'Standard', value: 2.2, color: 'text-blue-400' },
  { label: 'Premium', value: 3.0, color: 'text-purple-400' },
  { label: 'Luxury', value: 4.0, color: 'text-amber-400' },
];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function StoreManager() {
  const [activeTab, setActiveTab] = useState('pricing');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current config + preview
  const { data: preview, isLoading } = useQuery<PreviewData>({
    queryKey: ['/api/merch-config/preview'],
    queryFn: async () => {
      const res = await fetch('/api/merch-config/preview');
      if (!res.ok) throw new Error('Failed to load config');
      const data = await res.json();
      return data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/merch-config/preview'] });
    queryClient.invalidateQueries({ queryKey: ['/api/merch-config'] });
  };

  if (isLoading) {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-500" />
        <p className="text-muted-foreground">Loading store configuration...</p>
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card className="p-12 text-center">
        <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Could not load store configuration</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <StatsBar stats={preview.stats} config={preview.config} />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pricing">
            <DollarSign className="h-4 w-4 mr-2" /> Pricing
          </TabsTrigger>
          <TabsTrigger value="visibility">
            <Eye className="h-4 w-4 mr-2" /> Products
          </TabsTrigger>
          <TabsTrigger value="featured">
            <Star className="h-4 w-4 mr-2" /> Featured
          </TabsTrigger>
          <TabsTrigger value="images">
            <Image className="h-4 w-4 mr-2" /> Images
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="mt-6">
          <PricingEngine config={preview.config} products={preview.products} onSave={invalidate} />
        </TabsContent>

        <TabsContent value="visibility" className="mt-6">
          <VisibilityManager products={preview.products} config={preview.config} onUpdate={invalidate} />
        </TabsContent>

        <TabsContent value="featured" className="mt-6">
          <FeaturedSelector products={preview.products} config={preview.config} onUpdate={invalidate} />
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <ImageManager products={preview.products} config={preview.config} onUpdate={invalidate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STATS BAR
// ═══════════════════════════════════════════════════════════════

function StatsBar({ stats, config }: { stats: PreviewData['stats']; config: StoreConfig }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card className="p-3 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-muted-foreground">Visible</span>
        </div>
        <p className="text-xl font-bold">{stats.visible}<span className="text-sm text-muted-foreground font-normal">/{stats.total}</span></p>
      </Card>
      <Card className="p-3 bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-4 h-4 text-orange-400" />
          <span className="text-xs text-muted-foreground">Featured</span>
        </div>
        <p className="text-xl font-bold">{stats.featured}</p>
      </Card>
      <Card className="p-3 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-xs text-muted-foreground">Avg Margin</span>
        </div>
        <p className="text-xl font-bold">{stats.avgMargin}%</p>
      </Card>
      <Card className="p-3 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
        <div className="flex items-center gap-2 mb-1">
          <Percent className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-muted-foreground">Multiplier</span>
        </div>
        <p className="text-xl font-bold">x{config.globalMultiplier || '—'}</p>
      </Card>
      <Card className="p-3 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-muted-foreground">Price Range</span>
        </div>
        <p className="text-lg font-bold">${stats.priceRange.min.toFixed(0)}–${stats.priceRange.max.toFixed(0)}</p>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PRICING ENGINE
// ═══════════════════════════════════════════════════════════════

function PricingEngine({ config, products, onSave }: {
  config: StoreConfig;
  products: ProductPreview[];
  onSave: () => void;
}) {
  const [globalMult, setGlobalMult] = useState(config.globalMultiplier || 2.2);
  const [catMults, setCatMults] = useState<Record<string, number>>(config.categoryMultipliers || {});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Live preview calculation
  const liveProducts = useMemo(() => {
    return products.map(p => {
      const mult = catMults[p.category] || globalMult;
      const newPrice = Math.ceil(p.baseCost * mult) - 0.01;
      const margin = ((newPrice - p.baseCost) / newPrice * 100).toFixed(1);
      return { ...p, livePrice: newPrice, liveMargin: margin };
    });
  }, [products, globalMult, catMults]);

  const avgMargin = useMemo(() => {
    const visible = liveProducts.filter(p => !p.isHidden);
    if (visible.length === 0) return '0';
    return (visible.reduce((s, p) => s + parseFloat(p.liveMargin), 0) / visible.length).toFixed(1);
  }, [liveProducts]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/merch-config/multiplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ globalMultiplier: globalMult, categoryMultipliers: catMults }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast({ title: 'Pricing saved', description: `Global multiplier: x${globalMult}` });
      onSave();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setGlobalMult(2.2);
    setCatMults({});
  };

  // Group products by category for the preview table
  const byCategory = useMemo(() => {
    const map = new Map<string, typeof liveProducts>();
    for (const p of liveProducts) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    return map;
  }, [liveProducts]);

  return (
    <div className="space-y-6">
      {/* Global Multiplier */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Global Price Multiplier</h3>
            <p className="text-sm text-muted-foreground">
              Retail price = Base cost × multiplier. Applies to all products unless category override is set.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save Pricing
            </Button>
          </div>
        </div>

        {/* Slider + Value */}
        <div className="flex items-center gap-4 mb-4">
          <input
            type="range"
            min="1.0"
            max="5.0"
            step="0.1"
            value={globalMult}
            onChange={e => setGlobalMult(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
          <div className="text-center min-w-[80px]">
            <span className="text-2xl font-black text-orange-400">x{globalMult.toFixed(1)}</span>
            <p className="text-[10px] text-muted-foreground">Avg margin: {avgMargin}%</p>
          </div>
        </div>

        {/* Presets */}
        <div className="flex gap-2">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => setGlobalMult(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                globalMult === p.value
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                  : 'bg-zinc-800/50 border-zinc-700 text-muted-foreground hover:border-zinc-500'
              }`}
            >
              {p.label} (x{p.value})
            </button>
          ))}
        </div>
      </Card>

      {/* Per-Category Multipliers */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Category Multipliers (optional overrides)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {CATEGORIES.map(cat => {
            const catProducts = byCategory.get(cat) || [];
            if (catProducts.length === 0) return null;
            const hasCatMult = catMults[cat] !== undefined;
            const effectiveMult = catMults[cat] || globalMult;

            return (
              <div
                key={cat}
                className={`p-3 rounded-xl border transition-all ${
                  hasCatMult ? 'border-orange-500/40 bg-orange-500/5' : 'border-zinc-700/50 bg-zinc-800/30'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span className="text-xs font-medium truncate">{cat}</span>
                  <Badge variant="outline" className="ml-auto text-[10px] px-1">{catProducts.length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1.0"
                    max="10.0"
                    step="0.1"
                    value={hasCatMult ? catMults[cat] : ''}
                    placeholder={globalMult.toFixed(1)}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        const next = { ...catMults };
                        delete next[cat];
                        setCatMults(next);
                      } else {
                        setCatMults(prev => ({ ...prev, [cat]: parseFloat(val) }));
                      }
                    }}
                    className="h-8 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">x{effectiveMult.toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Live Price Preview */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Live Price Preview</h3>
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          <div className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 text-[11px] text-muted-foreground font-medium sticky top-0 bg-card pb-2 border-b border-zinc-800">
            <span>Product</span>
            <span className="text-right">Base</span>
            <span className="text-right">Old Price</span>
            <span className="text-right">New Price</span>
            <span className="text-right">Margin</span>
          </div>
          {liveProducts.filter(p => !p.isHidden).map(p => (
            <div key={p.printfulId} className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 text-xs py-1.5 border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">{CATEGORY_ICONS[p.category]}</span>
                <span className="truncate">{p.name}</span>
              </div>
              <span className="text-right text-muted-foreground">${p.baseCost.toFixed(2)}</span>
              <span className="text-right text-muted-foreground line-through">${p.originalRetailPrice.toFixed(2)}</span>
              <span className={`text-right font-semibold ${p.livePrice !== p.originalRetailPrice ? 'text-orange-400' : ''}`}>
                ${p.livePrice.toFixed(2)}
              </span>
              <span className={`text-right ${parseFloat(p.liveMargin) > 60 ? 'text-green-400' : parseFloat(p.liveMargin) > 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {p.liveMargin}%
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VISIBILITY MANAGER
// ═══════════════════════════════════════════════════════════════

function VisibilityManager({ products, config, onUpdate }: {
  products: ProductPreview[];
  config: StoreConfig;
  onUpdate: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'visible' | 'hidden'>('all');
  const { toast } = useToast();

  const filtered = useMemo(() => {
    let result = products;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    if (filterCat) {
      result = result.filter(p => p.category === filterCat);
    }
    if (filterVisibility === 'visible') result = result.filter(p => !p.isHidden);
    if (filterVisibility === 'hidden') result = result.filter(p => p.isHidden);
    return result;
  }, [products, search, filterCat, filterVisibility]);

  const toggleProduct = async (printfulId: number, visible: boolean) => {
    try {
      const res = await fetch('/api/merch-config/visibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printfulId, visible }),
      });
      if (!res.ok) throw new Error('Failed');
      onUpdate();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const bulkToggle = async (printfulIds: number[], visible: boolean) => {
    try {
      const res = await fetch('/api/merch-config/visibility/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printfulIds, visible }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: visible ? 'Products shown' : 'Products hidden', description: `${printfulIds.length} products updated` });
      onUpdate();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const hiddenCount = products.filter(p => p.isHidden).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
          </select>

          <div className="flex rounded-md border border-input overflow-hidden">
            {(['all', 'visible', 'hidden'] as const).map(v => (
              <button
                key={v}
                onClick={() => setFilterVisibility(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterVisibility === v ? 'bg-orange-500 text-white' : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {v === 'all' ? `All (${products.length})` : v === 'visible' ? `Visible (${products.length - hiddenCount})` : `Hidden (${hiddenCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Actions */}
        {filterCat && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800">
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkToggle(filtered.map(p => p.printfulId), false)}
              className="text-xs"
            >
              <EyeOff className="w-3 h-3 mr-1" /> Hide All "{filterCat}"
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkToggle(filtered.map(p => p.printfulId), true)}
              className="text-xs"
            >
              <Eye className="w-3 h-3 mr-1" /> Show All "{filterCat}"
            </Button>
          </div>
        )}
      </Card>

      {/* Product List */}
      <Card className="divide-y divide-zinc-800">
        {filtered.map(p => (
          <div
            key={p.printfulId}
            className={`flex items-center gap-3 p-3 hover:bg-zinc-800/30 transition-colors ${
              p.isHidden ? 'opacity-50' : ''
            }`}
          >
            {/* Image */}
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
              ) : (
                <div className="flex items-center justify-center h-full text-lg">
                  {CATEGORY_ICONS[p.category]}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{CATEGORY_ICONS[p.category]} {p.category}</span>
                <span>•</span>
                <span>${p.calculatedPrice.toFixed(2)}</span>
                <span>•</span>
                <span>{p.margin}% margin</span>
              </div>
            </div>

            {/* Tags */}
            <div className="hidden md:flex items-center gap-1">
              {p.isFeatured && (
                <Badge className="bg-orange-500/20 text-orange-400 border-0 text-[10px]">
                  <Star className="w-2.5 h-2.5 mr-0.5" /> Featured
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">{p.gender}</Badge>
            </div>

            {/* Toggle */}
            <button
              onClick={() => toggleProduct(p.printfulId, p.isHidden)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                p.isHidden
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
              }`}
              title={p.isHidden ? 'Show product' : 'Hide product'}
            >
              {p.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FEATURED SELECTOR
// ═══════════════════════════════════════════════════════════════

function FeaturedSelector({ products, config, onUpdate }: {
  products: ProductPreview[];
  config: StoreConfig;
  onUpdate: () => void;
}) {
  const [selected, setSelected] = useState<number[]>(
    config.featuredProducts.length > 0 ? config.featuredProducts : products.filter(p => p.isFeatured).map(p => p.printfulId)
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const toggleFeatured = (id: number) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 6) {
        toast({ title: 'Maximum 6', description: 'Remove one before adding another', variant: 'destructive' });
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/merch-config/featured', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featuredProducts: selected }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Featured products saved', description: `${selected.length} products selected` });
      onUpdate();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const visibleProducts = products.filter(p => !p.isHidden);

  return (
    <div className="space-y-4">
      {/* Selected Featured */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Featured Products ({selected.length}/6)</h3>
            <p className="text-sm text-muted-foreground">These appear highlighted in the artist store hero section</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save Featured
          </Button>
        </div>

        {/* Selected Grid */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
          {Array.from({ length: 6 }).map((_, idx) => {
            const productId = selected[idx];
            const product = productId ? products.find(p => p.printfulId === productId) : null;

            return (
              <div
                key={idx}
                className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-2 transition-all ${
                  product ? 'border-orange-500/50 bg-orange-500/5' : 'border-zinc-700 bg-zinc-900/50'
                }`}
              >
                {product ? (
                  <>
                    <div className="w-full flex-1 rounded-lg overflow-hidden bg-zinc-800 mb-1">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-xl">
                          {CATEGORY_ICONS[product.category]}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-center leading-tight truncate w-full">{product.name}</p>
                    <button
                      onClick={() => toggleFeatured(product.printfulId)}
                      className="text-[10px] text-red-400 hover:text-red-300 mt-0.5"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-zinc-600 mb-1" />
                    <span className="text-[10px] text-zinc-600">Slot {idx + 1}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* All products to pick from */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Select Products</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-[500px] overflow-y-auto">
          {visibleProducts.map(p => {
            const isSelected = selected.includes(p.printfulId);
            return (
              <button
                key={p.printfulId}
                onClick={() => toggleFeatured(p.printfulId)}
                className={`relative p-2 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                  isSelected ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-500'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className="aspect-square rounded-lg overflow-hidden bg-zinc-800 mb-1">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xl">
                      {CATEGORY_ICONS[p.category]}
                    </div>
                  )}
                </div>
                <p className="text-[10px] font-medium truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">${p.calculatedPrice.toFixed(2)}</p>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// IMAGE MANAGER
// ═══════════════════════════════════════════════════════════════

function ImageManager({ products, config, onUpdate }: {
  products: ProductPreview[];
  config: StoreConfig;
  onUpdate: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const { toast } = useToast();

  const handleSaveImage = async (printfulId: number) => {
    try {
      const newOverrides = { ...config.imageOverrides };
      if (imageUrl.trim()) {
        newOverrides[printfulId] = imageUrl.trim();
      } else {
        delete newOverrides[printfulId];
      }

      const res = await fetch('/api/merch-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageOverrides: newOverrides }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Image updated' });
      setEditingId(null);
      setImageUrl('');
      onUpdate();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const overrideCount = Object.keys(config.imageOverrides).length;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Product Image Overrides</h3>
            <p className="text-sm text-muted-foreground">
              Replace default Printful catalog images with custom ones. {overrideCount > 0 && `${overrideCount} custom images set.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[600px] overflow-y-auto">
          {products.filter(p => !p.isHidden).map(p => {
            const hasOverride = config.imageOverrides[p.printfulId];
            const isEditing = editingId === p.printfulId;

            return (
              <div
                key={p.printfulId}
                className={`rounded-xl border p-2 transition-all ${
                  hasOverride ? 'border-purple-500/40 bg-purple-500/5' : 'border-zinc-700 bg-zinc-800/30'
                }`}
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-zinc-800 mb-2 relative group">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-2xl">
                      {CATEGORY_ICONS[p.category]}
                    </div>
                  )}
                  {hasOverride && (
                    <div className="absolute top-1 right-1">
                      <Badge className="bg-purple-500 text-white text-[8px] px-1">Custom</Badge>
                    </div>
                  )}
                  <button
                    onClick={() => { setEditingId(p.printfulId); setImageUrl(config.imageOverrides[p.printfulId] || ''); }}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <Image className="w-5 h-5 text-white" />
                  </button>
                </div>

                <p className="text-[10px] font-medium truncate">{p.name}</p>

                {isEditing && (
                  <div className="mt-2 space-y-1.5">
                    <Input
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      placeholder="Paste image URL..."
                      className="h-7 text-[10px]"
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveImage(p.printfulId)}
                        className="h-6 text-[10px] flex-1"
                      >
                        <Check className="w-2.5 h-2.5 mr-0.5" /> Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingId(null); setImageUrl(''); }}
                        className="h-6 text-[10px]"
                      >
                        <X className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
