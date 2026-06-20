/**
 * BrandIdentityPanel — Generate & display the artist fashion brand DNA
 */
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Save, Globe, Palette, Type, BookOpen, Eye, EyeOff, Shirt, Wand2 } from 'lucide-react';
import type { FashionBrand } from './FashionVirtualStore';

interface Props {
  artistId: number;
  brand: FashionBrand | null;
  isOwner: boolean;
  colors: { hexPrimary: string; hexAccent: string; hexBorder: string };
  onBrandSaved: () => void;
}

export function BrandIdentityPanel({ artistId, brand, isOwner, colors, onBrandSaved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<Partial<FashionBrand>>(brand || {});
  const [isEditing, setIsEditing] = useState(!brand);

  const accentStyle = { color: colors.hexAccent };
  const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm focus:border-white/30';

  // Generate AI brand identity
  const generateMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/fashion-store/${artistId}/brand/generate`, {}),
    onSuccess: (data: any) => {
      setDraft(data.brand || {});
      setIsEditing(true);
      toast({ title: '✨ Brand identity generated!', description: 'Review and save your brand below.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // Generate the FULL fashion universe in one shot (brand + drop + 10 products + campaign)
  const universeMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/fashion-store/${artistId}/generate-universe`, { productCount: 10 }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['fashion-brand', artistId] });
      qc.invalidateQueries({ queryKey: ['fashion-collections', artistId] });
      qc.invalidateQueries({ queryKey: ['fashion-products', artistId] });
      qc.invalidateQueries({ queryKey: ['fashion-campaigns', artistId] });
      onBrandSaved();
      setIsEditing(false);
      toast({
        title: '🌟 Fashion universe created!',
        description: `${data.productCount || 0} products, 1 drop & a campaign were generated. Check the Drops, Store & Campaigns tabs.`,
      });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // Save brand
  const saveMutation = useMutation({
    mutationFn: (payload: Partial<FashionBrand>) =>
      apiRequest('POST', `/api/fashion-store/${artistId}/brand/save`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fashion-brand', artistId] });
      onBrandSaved();
      setIsEditing(false);
      toast({ title: '✅ Brand saved!' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const togglePublish = () => {
    saveMutation.mutate({ ...draft, isPublished: !draft.isPublished });
  };

  if (!isOwner && !brand) {
    return (
      <div className="py-12 text-center text-white/30 text-sm">
        This artist hasn't launched their fashion brand yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Action bar */}
      {isOwner && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || universeMutation.isPending}
            size="sm"
            className="rounded-full font-semibold text-xs"
            style={{ background: colors.hexPrimary, color: 'white' }}
          >
            {generateMutation.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> {brand ? 'Regenerate Brand' : 'Generate Brand Identity'}</>
            )}
          </Button>

          <Button
            onClick={() => universeMutation.mutate()}
            disabled={universeMutation.isPending || generateMutation.isPending}
            size="sm"
            variant="outline"
            className="rounded-full font-semibold text-xs border-white/15"
            style={{ color: colors.hexAccent, background: `${colors.hexPrimary}12` }}
            title="Generate brand, a drop, 10+ products and a campaign — all at once, using your artist & gallery images"
          >
            {universeMutation.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Building universe…</>
            ) : (
              <><Wand2 className="w-3.5 h-3.5 mr-1.5" /> Generate Full Universe</>
            )}
          </Button>

          {brand && (
            <>
              {!isEditing && (
                <Button size="sm" variant="outline" className="rounded-full text-xs border-white/10 text-white/60"
                  onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
              <Button
                size="sm" variant="outline"
                className="rounded-full text-xs border-white/10 ml-auto"
                style={{ color: draft.isPublished ? '#ef4444' : colors.hexAccent }}
                onClick={togglePublish}
                disabled={saveMutation.isPending}
              >
                {draft.isPublished ? <><EyeOff className="w-3 h-3 mr-1" /> Unpublish</> : <><Globe className="w-3 h-3 mr-1" /> Publish Brand</>}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Brand display / edit */}
      {(draft.brandName || brand) ? (
        <div className="space-y-5">
          {/* Logo + Palette row */}
          <div className="flex gap-4 items-start">
            {draft.logoUrl && (
              <img
                src={draft.logoUrl}
                alt="Brand Logo"
                className="w-20 h-20 object-cover rounded-xl shrink-0"
                style={{ border: `1px solid ${colors.hexBorder}` }}
              />
            )}
            <div className="flex-1 space-y-3">
              {isEditing ? (
                <>
                  <Input
                    value={draft.brandName || ''}
                    onChange={(e) => setDraft(p => ({ ...p, brandName: e.target.value }))}
                    placeholder="Brand Name"
                    className={inputCls + ' text-lg font-bold tracking-widest uppercase'}
                  />
                  <Input
                    value={draft.tagline || ''}
                    onChange={(e) => setDraft(p => ({ ...p, tagline: e.target.value }))}
                    placeholder="Tagline"
                    className={inputCls}
                  />
                </>
              ) : (
                <>
                  <h3 className="text-white font-bold text-xl tracking-widest uppercase">
                    {draft.brandName}
                  </h3>
                  <p className="text-white/50 text-sm italic">{draft.tagline}</p>
                </>
              )}

              {/* Color swatches */}
              {draft.colorPalette && draft.colorPalette.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {draft.colorPalette.map((hex, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md border border-white/10" style={{ background: hex }} />
                      <span className="text-white/30 text-[10px] font-mono">{hex}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Moodboard */}
          {draft.moodboardUrls && draft.moodboardUrls.length > 0 && (
            <div>
              <p className="text-white/30 text-[11px] uppercase tracking-widest mb-2 flex items-center gap-1">
                <Palette className="w-3 h-3" /> Moodboard
              </p>
              <div className="grid grid-cols-2 gap-2">
                {draft.moodboardUrls.map((url, i) => (
                  <img key={i} src={url} alt={`Moodboard ${i + 1}`}
                    className="w-full h-32 object-cover rounded-xl"
                    style={{ border: `1px solid ${colors.hexBorder}` }} />
                ))}
              </div>
            </div>
          )}

          {/* Aesthetic */}
          <div>
            <p className="text-white/30 text-[11px] uppercase tracking-widest mb-2 flex items-center gap-1">
              <Eye className="w-3 h-3" /> Aesthetic
            </p>
            {isEditing ? (
              <Textarea
                value={draft.aesthetic || ''}
                onChange={(e) => setDraft(p => ({ ...p, aesthetic: e.target.value }))}
                placeholder="Visual aesthetic description…"
                className={inputCls}
                rows={2}
              />
            ) : (
              <p className="text-white/60 text-sm leading-relaxed">{draft.aesthetic}</p>
            )}
          </div>

          {/* Manifesto */}
          <div>
            <p className="text-white/30 text-[11px] uppercase tracking-widest mb-2 flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Manifesto
            </p>
            {isEditing ? (
              <Textarea
                value={draft.brandManifesto || ''}
                onChange={(e) => setDraft(p => ({ ...p, brandManifesto: e.target.value }))}
                placeholder="Brand philosophy…"
                className={inputCls}
                rows={3}
              />
            ) : (
              <p className="text-white/70 text-sm leading-relaxed italic">&ldquo;{draft.brandManifesto}&rdquo;</p>
            )}
          </div>

          {/* Brand Story */}
          <div>
            <p className="text-white/30 text-[11px] uppercase tracking-widest mb-2 flex items-center gap-1">
              <Type className="w-3 h-3" /> Brand Story
            </p>
            {isEditing ? (
              <Textarea
                value={draft.brandStory || ''}
                onChange={(e) => setDraft(p => ({ ...p, brandStory: e.target.value }))}
                placeholder="Origin story…"
                className={inputCls}
                rows={3}
              />
            ) : (
              <p className="text-white/60 text-sm leading-relaxed">{draft.brandStory}</p>
            )}
          </div>

          {/* Influences */}
          {draft.influences && draft.influences.length > 0 && (
            <div>
              <p className="text-white/30 text-[11px] uppercase tracking-widest mb-2">Influences</p>
              <div className="flex flex-wrap gap-2">
                {draft.influences.map((inf, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs text-white/60"
                    style={{ background: `${colors.hexPrimary}15`, border: `1px solid ${colors.hexBorder}` }}>
                    {inf}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Save button */}
          {isOwner && isEditing && (
            <Button
              onClick={() => saveMutation.mutate(draft)}
              disabled={saveMutation.isPending || !draft.brandName}
              className="w-full rounded-xl font-semibold"
              style={{ background: colors.hexPrimary }}
            >
              {saveMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save Brand Identity</>
              )}
            </Button>
          )}
        </div>
      ) : (
        /* Empty state */
        isOwner && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ border: `1px dashed ${colors.hexBorder}`, background: `${colors.hexPrimary}08` }}
          >
            <Shirt className="w-10 h-10 mx-auto mb-3 opacity-30" style={accentStyle} />
            <p className="text-white/50 text-sm mb-1">No fashion brand created yet</p>
            <p className="text-white/25 text-xs mb-4">Launch your entire fashion universe in one click — brand, a drop, 10+ products and a campaign.</p>
            <Button
              onClick={() => universeMutation.mutate()}
              disabled={universeMutation.isPending}
              size="sm"
              className="rounded-full font-semibold text-xs"
              style={{ background: colors.hexPrimary, color: 'white' }}
            >
              {universeMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Building universe…</>
              ) : (
                <><Wand2 className="w-3.5 h-3.5 mr-1.5" /> Generate Full Universe</>
              )}
            </Button>
          </div>
        )
      )}
    </div>
  );
}
