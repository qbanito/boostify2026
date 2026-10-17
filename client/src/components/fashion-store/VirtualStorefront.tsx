/**
 * VirtualStorefront — Fan-facing product grid with try-on and buy actions
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, Loader2, ShoppingBag, Shirt, Tag, Filter } from 'lucide-react';
import type { FashionBrand } from './FashionVirtualStore';

interface Product {
  id: number;
  name: string;
  description?: string;
  category: string;
  price: string;
  compareAtPrice?: string;
  productImageUrls?: string[];
  colorways?: string[];
  sizes?: string[];
  isAvailable: boolean;
  collectionId?: number;
  createdAt: string;
}

interface Props {
  artistId: number;
  brand: FashionBrand | null;
  isOwner: boolean;
  colors: { hexPrimary: string; hexAccent: string; hexBorder: string };
  onTryOn: (productId: number) => void;
}

const CATEGORIES = ['all', 'top', 'bottom', 'outerwear', 'footwear', 'accessory', 'headwear', 'bodysuit', 'set'];

export function VirtualStorefront({ artistId, brand, isOwner, colors, onTryOn }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [genResult, setGenResult] = useState<Partial<Product> | null>(null);
  const [genCategory, setGenCategory] = useState('top');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; products: Product[] }>({
    queryKey: ['fashion-products', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/products`),
    staleTime: 2 * 60 * 1000,
  });

  const products = (data?.products || []).filter(p => filter === 'all' || p.category === filter);

  const generateMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/fashion-store/${artistId}/products/generate`, { category: genCategory }),
    onSuccess: (d: any) => setGenResult(d.product),
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', `/api/fashion-store/${artistId}/products`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fashion-products', artistId] });
      setShowModal(false);
      setGenResult(null);
      toast({ title: '✅ Product saved to store!' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (!brand) {
    return <p className="text-white/30 text-sm py-8 text-center">Create your fashion brand first.</p>;
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all"
              style={filter === cat
                ? { background: colors.hexPrimary, color: 'white' }
                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}>
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
        {isOwner && (
          <Button size="sm" onClick={() => setShowModal(true)}
            className="rounded-full font-semibold text-xs shrink-0"
            style={{ background: colors.hexPrimary, color: 'white' }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Product
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl p-8 text-center"
          style={{ border: `1px dashed ${colors.hexBorder}`, background: `${colors.hexPrimary}08` }}>
          <ShoppingBag className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-white/40 text-sm">No products in store yet</p>
          {isOwner && <p className="text-white/25 text-xs mt-1">Click "Add Product" to generate your first item</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              colors={colors}
              onSelect={setSelectedProduct}
            />
          ))}
        </div>
      )}

      {/* Product Detail Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}>
        <DialogContent className="bg-[#08080f] border-white/10 text-white max-w-md">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white tracking-widest">{selectedProduct.name}</DialogTitle>
              </DialogHeader>
              {selectedProduct.productImageUrls?.[0] && (
                <img src={selectedProduct.productImageUrls[0]} alt={selectedProduct.name}
                  className="w-full h-52 object-cover rounded-xl" />
              )}
              <p className="text-white/60 text-sm">{selectedProduct.description}</p>
              <p className="text-white/35 text-[11px]">
                Checkout for digital fashion is not available yet.
              </p>
              <Button className="w-full rounded-xl font-semibold"
                style={{ background: colors.hexPrimary }}
                disabled={!selectedProduct.isAvailable || !selectedProduct.productImageUrls?.[0]}
                onClick={() => {
                  const productId = selectedProduct.id;
                  setSelectedProduct(null);
                  onTryOn(productId);
                }}>
                <Shirt className="w-4 h-4 mr-2" />
                {!selectedProduct.isAvailable
                  ? 'Look Unavailable'
                  : selectedProduct.productImageUrls?.[0] ? 'Try On This Look' : 'Try-on Image Missing'}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Product Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-[#08080f] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Generate Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={genCategory} onValueChange={setGenCategory}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-[#0d0d18] border-white/10 text-white">
                {CATEGORIES.filter(c => c !== 'all').map(c => (
                  <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {genResult ? (
              <div className="rounded-xl p-4 space-y-3"
                style={{ background: `${colors.hexPrimary}10`, border: `1px solid ${colors.hexBorder}` }}>
                {genResult.productImageUrls?.[0] && (
                  <img src={genResult.productImageUrls[0]} alt={genResult.name}
                    className="w-full h-32 object-cover rounded-lg" />
                )}
                <div className="flex items-center justify-between">
                  <p className="text-white font-bold text-sm tracking-widest">{genResult.name}</p>
                  <p className="text-white/60 font-bold">${genResult.price}</p>
                </div>
                <p className="text-white/40 text-xs">{genResult.description}</p>
                <Button size="sm" className="w-full rounded-xl text-xs font-semibold"
                  style={{ background: colors.hexPrimary }}
                  onClick={() => saveMutation.mutate(genResult)}
                  disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Add to Store'}
                </Button>
              </div>
            ) : (
              <Button size="sm" className="w-full rounded-xl text-xs font-semibold"
                style={{ background: colors.hexPrimary }}
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}>
                {generateMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate with AI</>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductCard({ product, colors, onSelect }: { product: Product; colors: any; onSelect: (p: Product) => void }) {
  const img = product.productImageUrls?.[0];
  return (
    <button
      onClick={() => onSelect(product)}
      className="rounded-xl overflow-hidden text-left group transition-all hover:scale-[1.02]"
      style={{ border: `1px solid ${colors.hexBorder}`, background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="relative h-36 bg-zinc-900 overflow-hidden">
        {img ? (
          <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Shirt className="w-8 h-8 text-white/10" />
          </div>
        )}
        {!product.isAvailable && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white/60 text-xs font-bold">Sold Out</span>
          </div>
        )}
      </div>
      <div className="p-2.5 space-y-0.5">
        <p className="text-white text-xs font-bold tracking-wider truncate">{product.name}</p>
        <div className="flex items-center gap-2">
          <p className="text-white/80 text-xs font-bold">${product.price}</p>
          {product.compareAtPrice && (
            <p className="text-white/25 text-[10px] line-through">${product.compareAtPrice}</p>
          )}
        </div>
        <p className="text-white/25 text-[10px] capitalize">{product.category}</p>
      </div>
    </button>
  );
}
