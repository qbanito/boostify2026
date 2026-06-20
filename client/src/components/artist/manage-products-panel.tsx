/**
 * ManageProductsPanel â€” Owner-only inline product management for Official Store.
 *
 * Capabilities:
 *  - Generate 6 AI products in parallel
 *  - Add custom product (image upload + form)
 *  - Full inline edit: name, description, price, category, sizes, images
 *  - Multiple images per product (upload more, set primary, remove)
 *  - Availability toggle & delete
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Wand2, Plus, Loader2, ShoppingBag, Upload,
  Image as ImageIcon, Trash2, Check, ChevronDown, ChevronUp, Shirt,
  Pencil, X, Star,
} from 'lucide-react';
import { collection, doc, setDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { ensureFirebaseAuth } from '@/lib/firebase-auth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface ManageProductsPanelProps {
  artistPgId: number;
  artistName: string;
  artistSlug?: string;
  brandImage: string;
  colors: { hexAccent: string };
}

interface ProductRow {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  images?: string[];          // multiple images
  description?: string;
  category: string;
  sizes?: string[];
  aiGenerated?: boolean;
  isCustom?: boolean;
  isAvailable?: boolean;
}

interface EditState {
  name: string;
  description: string;
  price: string;
  category: string;
  sizes: string;
  imageUrl: string;
  images: string[];
}

const CATEGORIES = ['Apparel', 'Accessories', 'Art', 'Music', 'Other'];

export function ManageProductsPanel({
  artistPgId, artistName, artistSlug, brandImage, colors,
}: ManageProductsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [batchingMockups, setBatchingMockups] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);

  const [customProduct, setCustomProduct] = useState({
    name: '', description: '', price: '', category: 'Apparel', sizes: '', imageUrl: '', images: [] as string[],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const customExtraImageRef = useRef<HTMLInputElement>(null);

  const notifyChanged = () => {
    queryClient.invalidateQueries({ queryKey: ['merchandise'] });
    queryClient.invalidateQueries({ queryKey: ['merchandise', artistPgId] });
    queryClient.invalidateQueries({ queryKey: ['/api/merch/by-artist', artistPgId] });
  };

  const reload = async () => {
    setLoadingProducts(true);
    try {
      const merchRef = collection(db, 'merchandise');
      const ids = [artistPgId, String(artistPgId)];
      const found: Map<string, any> = new Map();
      for (const id of ids) {
        const snap = await getDocs(query(merchRef, where('userId', '==', id as any)));
        snap.docs.forEach(d => {
          if (!found.has(d.id)) found.set(d.id, { id: d.id, ...(d.data() as any) });
        });
      }
      setProducts(Array.from(found.values()));
    } catch (e) {
      console.error('reload merch failed', e);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => { if (expanded) reload(); /* eslint-disable-next-line */ }, [expanded, artistPgId]);

  // â”€â”€ Upload helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const uploadFile = async (file: File, folder = 'merchandise'): Promise<string> => {
    await ensureFirebaseAuth();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const sref = ref(storage, `${folder}/${artistPgId}/img_${Date.now()}_${safeName}`);
    await uploadBytes(sref, file);
    return getDownloadURL(sref);
  };

  // â”€â”€ Generate AI products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const generateOne = async (productType: string): Promise<string> => {
    const r = await fetch('/api/artist-profile/generate-product-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ productType, artistName, artistId: artistPgId, brandImage, useArtistAsModel: true }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j.success || !j.imageUrl) throw new Error(j.error || 'No image');
    let img = j.imageUrl as string;
    if (img.startsWith('data:')) {
      const blob = await (await fetch(img)).blob();
      const path = `merchandise/${artistPgId}/${productType.toLowerCase().replace(/\s+/g, '-')}_${Date.now()}.png`;
      const sref = ref(storage, path);
      await uploadBytes(sref, blob);
      img = await getDownloadURL(sref);
    }
    return img;
  };

  const handleGenerate = async () => {
    if (!brandImage) {
      toast({ title: 'Sube primero una foto de perfil', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      toast({ title: 'Generando 6 productos en paraleloâ€¦', description: 'Tarda 30â€“60s.' });
      const types = [
        { type: 'T-Shirt', name: `${artistName} T-Shirt`, description: `Official ${artistName} t-shirt`, price: 29.99, category: 'Apparel', sizes: ['S','M','L','XL','XXL'] },
        { type: 'Hoodie', name: `${artistName} Hoodie`, description: `Premium ${artistName} hoodie`, price: 49.99, category: 'Apparel', sizes: ['S','M','L','XL','XXL'] },
        { type: 'Cap', name: `${artistName} Cap`, description: `Embroidered ${artistName} snapback cap`, price: 24.99, category: 'Accessories', sizes: ['One Size'] },
        { type: 'Poster', name: `${artistName} Poster`, description: `Limited edition ${artistName} poster`, price: 19.99, category: 'Art', sizes: ['18x24"','24x36"'] },
        { type: 'Sticker Pack', name: `${artistName} Sticker Pack`, description: `Vinyl sticker pack with ${artistName} designs`, price: 9.99, category: 'Accessories', sizes: ['Standard'] },
        { type: 'Mug', name: `${artistName} Mug`, description: `Ceramic mug with full-wrap ${artistName} design`, price: 14.99, category: 'Accessories', sizes: ['11oz','15oz'] },
      ];
      const results = await Promise.allSettled(types.map(t => generateOne(t.type)));
      const generated: { def: typeof types[number]; imageUrl: string }[] = [];
      const failures: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') generated.push({ def: types[i], imageUrl: r.value });
        else failures.push(`${types[i].type}: ${r.reason?.message || r.reason}`);
      });
      if (generated.length < types.length) {
        toast({ title: `GeneraciÃ³n incompleta (${generated.length}/${types.length})`, description: failures.join(' Â· '), variant: 'destructive' });
        return;
      }
      const merchRef = collection(db, 'merchandise');
      for (const id of [artistPgId, String(artistPgId)]) {
        const snap = await getDocs(query(merchRef, where('userId', '==', id as any)));
        await Promise.all(snap.docs.filter(d => d.data().aiGenerated !== false && d.data().isCustom !== true).map(d => deleteDoc(d.ref)));
      }
      await Promise.all(generated.map(async ({ def, imageUrl }) => {
        const newRef = doc(collection(db, 'merchandise'));
        const pgCategory = def.category === 'Apparel' ? 'apparel' : def.category === 'Accessories' ? 'accessories' : def.category === 'Music' ? 'music' : 'other';
        let pgId: number | null = null;
        try {
          const r = await fetch('/api/merch/sync-pg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: artistPgId, name: def.name, description: def.description, price: def.price, imageUrl, category: pgCategory, isCustomDesign: false, aiGeneratedDesign: true, productionCost: Math.round(def.price * 0.4 * 100) / 100 }) });
          const j = await r.json();
          if (j?.success && j?.pgId) pgId = j.pgId;
        } catch {}
        return setDoc(newRef, { name: def.name, description: def.description, price: def.price, imageUrl, images: [imageUrl], category: def.category, sizes: def.sizes, productType: def.type, userId: artistPgId, aiGenerated: true, isAvailable: true, pgId, createdAt: new Date() });
      }));
      notifyChanged();
      await reload();
      toast({ title: 'âœ… 6 productos generados' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Reintenta', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // â”€â”€ Batch Printful mockups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleBatchMockups = async (force = false) => {
    if (!artistSlug || !brandImage) { toast({ title: 'Falta slug o imagen de perfil', variant: 'destructive' }); return; }
    setBatchingMockups(true);
    setBatchProgress('Llamando a Printful Mockup Generatorâ€¦ puede tardar varios minutos.');
    try {
      const r = await fetch(`/api/artist-store/${artistSlug}/mockups/generate-all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }) });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.message || 'FallÃ³ la generaciÃ³n');
      const msg = `${j.generated} nuevos Â· ${j.skipped} ya en cache Â· ${j.failed} fallidos`;
      setBatchProgress(msg);
      toast({ title: 'âœ… Mockups Printful generados', description: msg });
      queryClient.invalidateQueries({ queryKey: ['artist-store'] });
    } catch (e: any) {
      setBatchProgress('');
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally {
      setBatchingMockups(false);
    }
  };

  // â”€â”€ Custom product upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const url = await uploadFile(file);
      setCustomProduct(p => ({ ...p, imageUrl: url, images: [url, ...p.images.filter(i => i !== url)] }));
      toast({ title: 'Imagen subida' });
    } catch (e: any) {
      toast({ title: 'Error subiendo imagen', description: e?.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddExtraImageToCustom = async (file: File) => {
    setUploadingImage(true);
    try {
      const url = await uploadFile(file);
      setCustomProduct(p => ({ ...p, images: [...p.images, url] }));
      toast({ title: 'Imagen adicional subida' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveCustom = async () => {
    const priceNum = parseFloat(customProduct.price);
    if (!customProduct.name.trim() || !customProduct.imageUrl || !Number.isFinite(priceNum) || priceNum <= 0) {
      toast({ title: 'Faltan datos', description: 'Nombre, imagen y precio son obligatorios', variant: 'destructive' });
      return;
    }
    setSavingCustom(true);
    try {
      const sizesArr = customProduct.sizes.split(',').map(s => s.trim()).filter(Boolean);
      const newRef = doc(collection(db, 'merchandise'));
      const pgCategory = customProduct.category === 'Apparel' ? 'apparel' : customProduct.category === 'Accessories' ? 'accessories' : customProduct.category === 'Music' ? 'music' : 'other';
      let pgId: number | null = null;
      try {
        const r = await fetch('/api/merch/sync-pg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: artistPgId, name: customProduct.name.trim(), description: customProduct.description.trim() || `${customProduct.name.trim()} by ${artistName}`, price: priceNum, imageUrl: customProduct.imageUrl, category: pgCategory, isCustomDesign: true, aiGeneratedDesign: false }) });
        const j = await r.json();
        if (j?.success && j?.pgId) pgId = j.pgId;
      } catch {}
      const allImages = customProduct.images.length ? customProduct.images : [customProduct.imageUrl];
      await setDoc(newRef, { name: customProduct.name.trim(), description: customProduct.description.trim() || `${customProduct.name.trim()} by ${artistName}`, price: priceNum, imageUrl: customProduct.imageUrl, images: allImages, category: customProduct.category, sizes: sizesArr.length ? sizesArr : ['Standard'], productType: customProduct.category, userId: artistPgId, aiGenerated: false, isCustom: true, isAvailable: true, pgId, createdAt: new Date() });
      setCustomProduct({ name: '', description: '', price: '', category: 'Apparel', sizes: '', imageUrl: '', images: [] });
      setShowCustomForm(false);
      notifyChanged();
      await reload();
      toast({ title: 'âœ… Producto agregado' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingCustom(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Â¿Eliminar este producto?')) return;
    try {
      await deleteDoc(doc(db, 'merchandise', id));
      notifyChanged();
      setProducts(prev => prev.filter(p => p.id !== id));
      if (editingId === id) { setEditingId(null); setEditState(null); }
      toast({ title: 'Producto eliminado' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    }
  };

  const handleToggleAvail = async (id: string, isAvailable: boolean) => {
    try {
      await setDoc(doc(db, 'merchandise', id), { isAvailable }, { merge: true });
      notifyChanged();
      setProducts(prev => prev.map(p => p.id === id ? { ...p, isAvailable } : p));
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    }
  };

  // â”€â”€ Edit product â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startEdit = (p: ProductRow) => {
    setEditingId(p.id);
    setEditState({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      category: p.category,
      sizes: (p.sizes || []).join(', '),
      imageUrl: p.imageUrl,
      images: p.images?.length ? p.images : [p.imageUrl],
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditState(null); };

  const handleSaveEdit = async (id: string) => {
    if (!editState) return;
    const priceNum = parseFloat(editState.price);
    if (!editState.name.trim() || !Number.isFinite(priceNum) || priceNum <= 0) {
      toast({ title: 'Nombre y precio son obligatorios', variant: 'destructive' });
      return;
    }
    setSavingEdit(true);
    try {
      const sizesArr = editState.sizes.split(',').map(s => s.trim()).filter(Boolean);
      const allImages = editState.images.length ? editState.images : [editState.imageUrl];
      await setDoc(doc(db, 'merchandise', id), {
        name: editState.name.trim(),
        description: editState.description.trim(),
        price: priceNum,
        category: editState.category,
        sizes: sizesArr.length ? sizesArr : ['Standard'],
        imageUrl: editState.imageUrl,
        images: allImages,
      }, { merge: true });
      notifyChanged();
      setProducts(prev => prev.map(p => p.id === id ? { ...p, name: editState.name.trim(), description: editState.description.trim(), price: priceNum, category: editState.category, sizes: sizesArr.length ? sizesArr : ['Standard'], imageUrl: editState.imageUrl, images: allImages } : p));
      setEditingId(null);
      setEditState(null);
      toast({ title: 'âœ… Producto actualizado' });
    } catch (e: any) {
      toast({ title: 'Error guardando', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleEditImageUpload = async (file: File) => {
    if (!editState) return;
    setUploadingEditImage(true);
    try {
      const url = await uploadFile(file);
      setEditState(s => s ? { ...s, imageUrl: url, images: [url, ...s.images.filter(i => i !== url)] } : s);
      toast({ title: 'Imagen principal actualizada' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally {
      setUploadingEditImage(false);
    }
  };

  const handleAddExtraImageToEdit = async (file: File) => {
    if (!editState) return;
    setUploadingEditImage(true);
    try {
      const url = await uploadFile(file);
      setEditState(s => s ? { ...s, images: [...s.images, url] } : s);
      toast({ title: 'Imagen adicional subida' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally {
      setUploadingEditImage(false);
    }
  };

  const handleSetPrimaryImage = (url: string) => {
    setEditState(s => s ? { ...s, imageUrl: url } : s);
  };

  const handleRemoveImage = (url: string) => {
    if (!editState) return;
    const newImages = editState.images.filter(i => i !== url);
    const newPrimary = editState.imageUrl === url ? (newImages[0] || '') : editState.imageUrl;
    setEditState(s => s ? { ...s, images: newImages, imageUrl: newPrimary } : s);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-2xl border bg-white/[0.02] overflow-hidden"
      style={{ borderColor: `${colors.hexAccent}30` }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${colors.hexAccent}20`, color: colors.hexAccent }}>
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-white font-bold text-sm">Manage Products</p>
            <p className="text-[11px] text-white/40">Generate AI Â· Upload custom Â· Edit Â· Multiple images Â· Availability</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="border-t border-white/5">
            <div className="p-3 space-y-3">

              {/* AI Generation */}
              <div className="p-3 rounded-lg border" style={{ borderColor: `${colors.hexAccent}30`, background: `${colors.hexAccent}08` }}>
                <div className="flex items-start gap-2 mb-2">
                  <Sparkles className="w-4 h-4 mt-0.5" style={{ color: colors.hexAccent }} />
                  <div className="flex-1">
                    <p className="text-white text-xs font-semibold">Automatic Generation with AI</p>
                    <p className="text-[11px] text-white/50 leading-relaxed mt-0.5">6 productos (T-Shirt, Hoodie, Cap, Poster, Stickers, Mug) con tu identidad visual.</p>
                  </div>
                </div>
                <Button type="button" onClick={handleGenerate} disabled={generating} size="sm" className="w-full" style={{ background: colors.hexAccent, color: '#000' }}>
                  {generating ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Generando 6 productosâ€¦</> : products.some(p => p.aiGenerated) ? <><Wand2 className="mr-2 h-3 w-3" /> Regenerate AI products</> : <><Sparkles className="mr-2 h-3 w-3" /> Generate Products with AI</>}
                </Button>
              </div>

              {/* Printful batch */}
              <div className="p-3 rounded-lg border" style={{ borderColor: `${colors.hexAccent}30`, background: `${colors.hexAccent}05` }}>
                <div className="flex items-start gap-2 mb-2">
                  <Shirt className="w-4 h-4 mt-0.5" style={{ color: colors.hexAccent }} />
                  <div className="flex-1">
                    <p className="text-white text-xs font-semibold">Apply design to full Printful catalog</p>
                    <p className="text-[11px] text-white/50 leading-relaxed mt-0.5">Renderiza tu diseÃ±o sobre los 91 productos del catÃ¡logo. Tarda 5â€“15 min.</p>
                    {batchProgress && <p className="text-[10px] text-white/70 mt-1 italic">{batchProgress}</p>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button type="button" onClick={() => handleBatchMockups(false)} disabled={batchingMockups || !artistSlug} size="sm" variant="outline" className="flex-1">
                    {batchingMockups ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Generandoâ€¦</> : <><Shirt className="mr-2 h-3 w-3" /> Apply design to all products</>}
                  </Button>
                  <Button type="button" onClick={() => handleBatchMockups(true)} disabled={batchingMockups || !artistSlug} size="sm" variant="ghost" title="Regenerate even if cached">
                    <Wand2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Product list */}
              <div className="rounded-lg border border-white/5 p-3 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white text-xs font-semibold flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" style={{ color: colors.hexAccent }} />
                    My products ({products.length})
                  </p>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setShowCustomForm(v => !v)}>
                    <Plus className="h-3 w-3 mr-1" />
                    {showCustomForm ? 'Cancel' : 'Add custom'}
                  </Button>
                </div>

                {/* Custom product form */}
                {showCustomForm && (
                  <div className="mb-3 p-3 rounded border border-white/10 bg-black/40 space-y-2">
                    <p className="text-white text-xs font-semibold mb-1">New custom product</p>
                    {/* Images */}
                    <div>
                      <Label className="text-[11px] text-white/60">Images *</Label>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {customProduct.images.map((img, idx) => (
                          <div key={idx} className="relative">
                            <img src={img} alt="" className={`w-12 h-12 object-cover rounded border-2 ${img === customProduct.imageUrl ? 'border-purple-400' : 'border-white/10'}`} />
                            {img !== customProduct.imageUrl && (
                              <button onClick={() => setCustomProduct(p => ({ ...p, imageUrl: img }))} className="absolute -top-1.5 -right-1.5 bg-purple-600 rounded-full w-4 h-4 flex items-center justify-center" title="Set as primary">
                                <Star className="w-2.5 h-2.5 text-white" />
                              </button>
                            )}
                            <button onClick={() => setCustomProduct(p => ({ ...p, images: p.images.filter(i => i !== img), imageUrl: p.imageUrl === img ? p.images.find(i => i !== img) || '' : p.imageUrl }))} className="absolute -top-1.5 -left-1.5 bg-red-600 rounded-full w-4 h-4 flex items-center justify-center">
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        ))}
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); if (fileInputRef.current) fileInputRef.current.value = ''; }} />
                        <input ref={customExtraImageRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddExtraImageToCustom(f); if (customExtraImageRef.current) customExtraImageRef.current.value = ''; }} />
                        <div className="flex flex-col gap-1">
                          <Button type="button" size="sm" variant="outline" disabled={uploadingImage} onClick={() => fileInputRef.current?.click()} className="h-7 text-[10px]">
                            {uploadingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3 mr-1" /> {customProduct.imageUrl ? 'Replace primary' : 'Upload primary'}</>}
                          </Button>
                          {customProduct.imageUrl && (
                            <Button type="button" size="sm" variant="ghost" disabled={uploadingImage} onClick={() => customExtraImageRef.current?.click()} className="h-7 text-[10px] border border-white/10">
                              <Plus className="h-3 w-3 mr-1" /> Add image
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-white/60">Nombre *</Label>
                        <Input value={customProduct.name} onChange={e => setCustomProduct(p => ({ ...p, name: e.target.value }))} placeholder="Tour T-Shirt 2026" className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[11px] text-white/60">Precio (USD) *</Label>
                        <Input type="number" step="0.01" min="0" value={customProduct.price} onChange={e => setCustomProduct(p => ({ ...p, price: e.target.value }))} placeholder="29.99" className="h-8 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-white/60">CategorÃ­a</Label>
                        <select value={customProduct.category} onChange={e => setCustomProduct(p => ({ ...p, category: e.target.value }))} className="w-full h-8 px-2 rounded bg-zinc-900 border border-white/10 text-xs text-white">
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[11px] text-white/60">Tallas</Label>
                        <Input value={customProduct.sizes} onChange={e => setCustomProduct(p => ({ ...p, sizes: e.target.value }))} placeholder="S, M, L, XL" className="h-8 text-xs" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-white/60">DescripciÃ³n</Label>
                      <Textarea value={customProduct.description} onChange={e => setCustomProduct(p => ({ ...p, description: e.target.value }))} placeholder="DescripciÃ³n breveâ€¦" rows={2} className="text-xs" />
                    </div>
                    <Button type="button" size="sm" onClick={handleSaveCustom} disabled={savingCustom || !customProduct.imageUrl || !customProduct.name || !customProduct.price} className="w-full" style={{ background: '#10b981', color: '#fff' }}>
                      {savingCustom ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Check className="h-3 w-3 mr-2" />}
                      Guardar producto
                    </Button>
                  </div>
                )}

                {/* Products list */}
                {loadingProducts ? (
                  <div className="flex items-center justify-center py-4 text-white/40 text-xs"><Loader2 className="h-3 w-3 animate-spin mr-2" /> Cargandoâ€¦</div>
                ) : products.length === 0 ? (
                  <p className="text-[11px] text-white/40 italic py-2 text-center">No products yet. Generate with AI or add a custom one.</p>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {products.map(p => {
                      const isEditing = editingId === p.id;
                      return (
                        <div key={p.id} className="rounded-lg border border-white/8 bg-black/30 overflow-hidden">
                          {/* Row header */}
                          <div className="flex items-center gap-2 p-2">
                            {/* Thumbnail + image count badge */}
                            <div className="relative flex-shrink-0">
                              <img src={p.imageUrl || 'https://placehold.co/64x64/1a1a2e/f97316?text=?'} alt={p.name} className="w-12 h-12 object-cover rounded" />
                              {(p.images?.length ?? 1) > 1 && (
                                <span className="absolute -bottom-1 -right-1 bg-black/80 text-white text-[8px] rounded px-1 border border-white/20">
                                  {p.images!.length} imgs
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <p className="text-[12px] font-semibold text-white truncate">{p.name}</p>
                                {p.aiGenerated && <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-orange-500/40 text-orange-400">AI</Badge>}
                                {p.isCustom && <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-emerald-500/40 text-emerald-400">Custom</Badge>}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-white/50">{p.category}</span>
                                <span className="text-[11px] font-bold text-white">${p.price?.toFixed(2)}</span>
                                <label className="flex items-center gap-1 text-[9px] text-white/50 cursor-pointer">
                                  <input type="checkbox" defaultChecked={p.isAvailable !== false} onChange={(e) => handleToggleAvail(p.id, e.target.checked)} />
                                  available
                                </label>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10" onClick={() => isEditing ? cancelEdit() : startEdit(p)} title={isEditing ? 'Cancel edit' : 'Edit product'}>
                                {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(p.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Inline edit form */}
                          {isEditing && editState && (
                            <div className="border-t border-white/8 p-3 bg-black/40 space-y-3">
                              {/* Image gallery */}
                              <div>
                                <Label className="text-[11px] text-white/60 mb-1 block">Images <span className="text-white/30">(click â˜… to set primary Â· click Ã— to remove)</span></Label>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {editState.images.map((img, idx) => (
                                    <div key={idx} className="relative">
                                      <img src={img} alt="" className={`w-14 h-14 object-cover rounded border-2 cursor-pointer ${img === editState.imageUrl ? 'border-purple-400 ring-1 ring-purple-400' : 'border-white/10 hover:border-white/30'}`} onClick={() => handleSetPrimaryImage(img)} title="Click to set as primary" />
                                      {img === editState.imageUrl && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-purple-600 rounded-full w-4 h-4 flex items-center justify-center">
                                          <Star className="w-2.5 h-2.5 text-white fill-white" />
                                        </span>
                                      )}
                                      {editState.images.length > 1 && (
                                        <button onClick={() => handleRemoveImage(img)} className="absolute -top-1.5 -left-1.5 bg-red-600 rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-500" title="Remove image">
                                          <X className="w-2.5 h-2.5 text-white" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {/* Upload buttons */}
                                  <input ref={editImageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEditImageUpload(f); if (editImageInputRef.current) editImageInputRef.current.value = ''; }} />
                                  <div className="flex flex-col gap-1">
                                    <Button type="button" size="sm" variant="outline" disabled={uploadingEditImage} onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = (ev: any) => { const f = ev.target.files?.[0]; if (f) handleAddExtraImageToEdit(f); }; inp.click(); }} className="h-8 text-[10px] whitespace-nowrap">
                                      {uploadingEditImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3 mr-1" /> Add image</>}
                                    </Button>
                                    <Button type="button" size="sm" variant="ghost" disabled={uploadingEditImage} onClick={() => editImageInputRef.current?.click()} className="h-8 text-[10px] whitespace-nowrap border border-white/10">
                                      {uploadingEditImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3 mr-1" /> Replace primary</>}
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* Fields */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px] text-white/60">Nombre *</Label>
                                  <Input value={editState.name} onChange={e => setEditState(s => s ? { ...s, name: e.target.value } : s)} className="h-8 text-xs mt-0.5" />
                                </div>
                                <div>
                                  <Label className="text-[11px] text-white/60">Precio (USD) *</Label>
                                  <Input type="number" step="0.01" min="0" value={editState.price} onChange={e => setEditState(s => s ? { ...s, price: e.target.value } : s)} className="h-8 text-xs mt-0.5" />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px] text-white/60">CategorÃ­a</Label>
                                  <select value={editState.category} onChange={e => setEditState(s => s ? { ...s, category: e.target.value } : s)} className="w-full h-8 px-2 rounded bg-zinc-900 border border-white/10 text-xs text-white mt-0.5">
                                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <Label className="text-[11px] text-white/60">Tallas</Label>
                                  <Input value={editState.sizes} onChange={e => setEditState(s => s ? { ...s, sizes: e.target.value } : s)} placeholder="S, M, L, XL" className="h-8 text-xs mt-0.5" />
                                </div>
                              </div>
                              <div>
                                <Label className="text-[11px] text-white/60">DescripciÃ³n</Label>
                                <Textarea value={editState.description} onChange={e => setEditState(s => s ? { ...s, description: e.target.value } : s)} rows={2} className="text-xs mt-0.5" />
                              </div>

                              <div className="flex gap-2">
                                <Button type="button" size="sm" onClick={() => handleSaveEdit(p.id)} disabled={savingEdit} className="flex-1" style={{ background: colors.hexAccent, color: '#000' }}>
                                  {savingEdit ? <><Loader2 className="h-3 w-3 animate-spin mr-2" /> Guardandoâ€¦</> : <><Check className="h-3 w-3 mr-2" /> Save changes</>}
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} className="border border-white/10">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
