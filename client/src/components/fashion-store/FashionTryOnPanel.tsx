/**
 * FashionTryOnPanel — Virtual try-on + fan scene community gallery
 */
import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, Shirt, Users, Sparkles, Download, Share2 } from 'lucide-react';
import type { FashionBrand } from './FashionVirtualStore';

interface TryOnSession {
  id: number;
  modelImageUrl: string;
  garmentImageUrl?: string;
  resultImageUrl?: string;
  isFanScene: boolean;
  fanName?: string;
  isPublic: boolean;
  status: string;
  createdAt: string;
}

interface Product {
  id: number;
  name: string;
  productImageUrls?: string[];
  category: string;
}

interface Props {
  artistId: number;
  brand: FashionBrand | null;
  isOwner: boolean;
  colors: { hexPrimary: string; hexAccent: string; hexBorder: string };
}

export function FashionTryOnPanel({ artistId, brand, isOwner, colors }: Props) {
  const { toast } = useToast();
  const modelInputRef = useRef<HTMLInputElement>(null);

  const [modelImageUrl, setModelImageUrl] = useState('');
  const [modelPreview, setModelPreview] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isFanScene, setIsFanScene] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [fanName, setFanName] = useState('');
  const [result, setResult] = useState<TryOnSession | null>(null);

  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ['fashion-products', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/products`),
    staleTime: 5 * 60 * 1000,
    enabled: !!brand,
  });

  const { data: galleryData, refetch: refetchGallery } = useQuery<{ scenes: TryOnSession[] }>({
    queryKey: ['fashion-fan-gallery', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/tryon/fan-gallery`),
    staleTime: 2 * 60 * 1000,
    enabled: !!brand,
  });

  const products = productsData?.products || [];
  const fanScenes = galleryData?.scenes || [];

  const tryOnMutation = useMutation({
    mutationFn: () => {
      const garmentUrl = selectedProduct?.productImageUrls?.[0] || '';
      return apiRequest('POST', '/api/fashion-store/tryon', {
        modelImageUrl,
        garmentImageUrl: garmentUrl,
        productId: selectedProduct?.id,
        brandId: brand?.id,
        isFanScene,
        fanName: fanName || undefined,
        isPublic,
      });
    },
    onSuccess: (d: any) => {
      setResult(d.session);
      if (isPublic) refetchGallery();
      toast({ title: '✨ Try-on complete!' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setModelPreview(dataUrl);
      setModelImageUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  if (!brand) {
    return <p className="text-white/30 text-sm py-8 text-center">Create your fashion brand first.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Try-On Studio */}
      <div className="rounded-xl p-4 space-y-4"
        style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${colors.hexBorder}` }}>
        <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">Virtual Try-On Studio</p>

        {/* Upload model photo */}
        <div>
          <p className="text-white/30 text-xs mb-2">Your photo</p>
          <div
            className="relative h-40 rounded-xl overflow-hidden cursor-pointer border-2 border-dashed flex items-center justify-center group transition-all hover:border-white/20"
            style={{ borderColor: modelPreview ? 'transparent' : colors.hexBorder }}
            onClick={() => modelInputRef.current?.click()}>
            {modelPreview ? (
              <img src={modelPreview} alt="Model" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-white/20" />
                <p className="text-white/30 text-xs">Upload your photo</p>
              </div>
            )}
          </div>
          <input ref={modelInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>

        {/* Select garment */}
        {products.length > 0 && (
          <div>
            <p className="text-white/30 text-xs mb-2">Select garment</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {products.filter(p => p.productImageUrls?.length).map(p => (
                <button key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className="shrink-0 rounded-xl overflow-hidden transition-all"
                  style={{
                    border: `2px solid ${selectedProduct?.id === p.id ? colors.hexAccent : 'transparent'}`,
                    outline: `1px solid ${colors.hexBorder}`,
                  }}>
                  <img src={p.productImageUrls![0]} alt={p.name} className="w-16 h-16 object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fan scene options */}
        <div className="flex items-center gap-3">
          <Switch checked={isPublic} onCheckedChange={setIsPublic}
            style={isPublic ? { '--switch-bg': colors.hexPrimary } as any : undefined} />
          <span className="text-white/50 text-xs">Share in fan gallery</span>
        </div>

        {isPublic && (
          <Input value={fanName} onChange={e => setFanName(e.target.value)}
            placeholder="Your name (shown in gallery)"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm" />
        )}

        <Button
          onClick={() => tryOnMutation.mutate()}
          disabled={tryOnMutation.isPending || !modelImageUrl || !selectedProduct}
          className="w-full rounded-xl font-semibold"
          style={{ background: colors.hexPrimary }}>
          {tryOnMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing Try-On…</>
          ) : (
            <><Shirt className="w-4 h-4 mr-2" /> Try It On</>
          )}
        </Button>
      </div>

      {/* Result */}
      {result?.resultImageUrl && (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${colors.hexBorder}` }}>
          <img src={result.resultImageUrl} alt="Try-on result"
            className="w-full object-cover" style={{ maxHeight: 360 }} />
          <div className="p-3 flex gap-2">
            <Button size="sm" variant="outline"
              className="flex-1 rounded-full text-xs border-white/10 text-white/60"
              onClick={() => window.open(result.resultImageUrl!, '_blank')}>
              <Download className="w-3 h-3 mr-1" /> Download
            </Button>
            <Button size="sm" variant="outline"
              className="flex-1 rounded-full text-xs border-white/10 text-white/60"
              onClick={() => { navigator.clipboard.writeText(result.resultImageUrl!); toast({ title: 'Link copied!' }); }}>
              <Share2 className="w-3 h-3 mr-1" /> Share
            </Button>
          </div>
        </div>
      )}

      {/* Fan Gallery */}
      {fanScenes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" style={{ color: colors.hexAccent }} />
            <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">Fan Gallery</p>
            <span className="text-white/25 text-xs">({fanScenes.length})</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {fanScenes.map(scene => (
              <div key={scene.id} className="relative rounded-xl overflow-hidden group"
                style={{ border: `1px solid ${colors.hexBorder}` }}>
                <img src={scene.resultImageUrl!} alt={scene.fanName || 'Fan'}
                  className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-300" />
                {scene.fanName && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 p-1.5">
                    <p className="text-white text-[10px] truncate">{scene.fanName}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
