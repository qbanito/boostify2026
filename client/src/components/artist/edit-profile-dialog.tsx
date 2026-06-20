import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { useToast } from "../../hooks/use-toast";
import { Loader2, Sparkles, Wand2, Edit2, Upload, Image as ImageIcon, Plus, Calendar, Trash2, ExternalLink, ShoppingBag, Images, Newspaper, FileText, Music, Lock, AlertCircle, Check, Camera, Ticket } from "lucide-react";
import { PAGE_MODES, PAGE_MODE_OPTIONS, type PageMode, getDefaultVisibility } from "../../config/page-modes";
import { ImageGalleryGenerator } from "./image-gallery-generator";
import { EPKGenerator } from "../artist-profile/epk-generator";
import { SponsorPanel } from "../sponsor/sponsor-panel";
import { VenueBookingPanel } from "./venue-booking-panel";
import { db, storage } from "../../firebase";
import { collection, doc, setDoc, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { queryClient, apiRequest } from "../../lib/queryClient";
import { ensureFirebaseAuth } from "../../lib/firebase-auth";

interface Show {
  id: string;
  venue: string;
  date: string;
  location: string;
  ticketUrl?: string;
  /** Ticketing fields when the show is a real, sellable concert event. */
  priceUsd?: number;
  capacity?: number | null;
  ticketsSold?: number;
  status?: string;
  title?: string;
}

// Refund / cancellation policy presets shown to the artist when creating a
// show. The text mirrors the server-side REFUND_POLICY_PRESETS so the preview
// matches exactly what the buyer sees at checkout and in the confirmation email.
const REFUND_POLICY_PRESETS: Record<string, { label: string; text: string }> = {
  flexible: { label: 'Flexible', text: 'Reembolso completo hasta 7 días antes del evento. Después de esa fecha no se admiten reembolsos, pero tu entrada es transferible a otra persona.' },
  moderate: { label: 'Moderada', text: 'Reembolso del 50% hasta 48 horas antes del evento. No se admiten reembolsos en las últimas 48 horas. Tu entrada es transferible.' },
  strict: { label: 'Estricta', text: 'Todas las ventas son finales. No se admiten reembolsos salvo cancelación del evento por parte del artista.' },
  no_refunds: { label: 'Sin reembolsos', text: 'Todas las ventas son finales. No se admiten reembolsos ni cambios bajo ninguna circunstancia.' },
};

interface Subscription {
  plan: string;
  aiGenerationLimit?: number;
  aiGenerationUsed?: number;
  epkLimit?: number;
  epkUsed?: number;
  imageGalleriesLimit?: number;
  imageGalleriesUsed?: number;
}

interface EditProfileDialogProps {
  artistId: string;
  currentData: {
    displayName: string;
    biography: string;
    genre: string;
    location: string;
    profileImage: string;
    bannerImage: string;
    bannerPosition?: string;
    loopVideoUrl?: string;
    slug?: string;
    contactEmail: string;
    contactPhone: string;
    instagram: string;
    twitter: string;
    youtube: string;
    spotify: string;
    pageMode?: PageMode;
  };
  onUpdate: () => void;
  onGalleryCreated?: () => void;
  onProductsChanged?: () => void;
  /** Optional controlled-mode props. When provided, the dialog's open state
   * is driven externally and the built-in trigger button is hidden — useful
   * for opening the editor from a discreet shortcut elsewhere on the page. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function EditProfileDialog({ artistId, currentData, onUpdate, onGalleryCreated, onProductsChanged, open: openProp, onOpenChange: onOpenChangeProp, hideTrigger }: EditProfileDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof openProp === 'boolean';
  const isOpen = isControlled ? openProp! : internalOpen;
  const setIsOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChangeProp?.(next);
  };
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingBiography, setIsGeneratingBiography] = useState(false);
  const [isGeneratingProfileImage, setIsGeneratingProfileImage] = useState(false);
  const [isGeneratingBannerImage, setIsGeneratingBannerImage] = useState(false);
  const [isGeneratingCharacterPack, setIsGeneratingCharacterPack] = useState(false);
  const [characterPackImages, setCharacterPackImages] = useState<{ url: string; angle: string }[]>([]);
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [isUploadingBannerImage, setIsUploadingBannerImage] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const bannerImageInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const { isAdmin } = useAuth();
  
  // Query para obtener datos de suscripción con límites
  const { data: subscription } = useQuery<Subscription>({
    queryKey: ["/api/subscriptions/current"],
  });

  const [formData, setFormData] = useState(currentData);
  const [shows, setShows] = useState<Show[]>([]);
  const [newShow, setNewShow] = useState({ venue: '', date: '', location: '', ticketUrl: '', price: '', capacity: '', refundPolicyType: 'flexible', refundPolicyCustom: '' });
  const [isAddingShow, setIsAddingShow] = useState(false);
  const [isGeneratingProducts, setIsGeneratingProducts] = useState(false);
  const [isGeneratingNews, setIsGeneratingNews] = useState(false);
  const [isGeneratingAlbum, setIsGeneratingAlbum] = useState(false);
  const [imageUpdateKey, setImageUpdateKey] = useState(0);
  
  // Manual gallery upload state
  const [showManualGalleryUpload, setShowManualGalleryUpload] = useState(false);
  const [manualGalleryTitle, setManualGalleryTitle] = useState('');
  const [manualGalleryFiles, setManualGalleryFiles] = useState<File[]>([]);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const manualGalleryInputRef = useRef<HTMLInputElement>(null);

  // Actualizar formData cuando se abre el diálogo
  useEffect(() => {
    if (isOpen) {
      logger.info('🔄 Dialog opened, setting formData from currentData');
      setFormData(currentData);
      setImageUpdateKey(0);
    }
  }, [isOpen]);

  // Cargar shows al abrir el diálogo
  useEffect(() => {
    if (isOpen && artistId) {
      loadShows();
    }
  }, [isOpen, artistId]);

  // Shows are now real, sellable concert events managed by the ticketing
  // module (/api/concerts) — secure Stripe payment, QR passes and the
  // admin-controlled platform commission (20% by default). The old flat
  // Firestore "shows" collection is no longer written from here.
  const loadShows = async () => {
    try {
      const data = await apiRequest('GET', `/api/concerts/${artistId}/events`);
      const events: any[] = Array.isArray(data?.events) ? data.events : [];
      const showsData: Show[] = events.map((e: any) => {
        const tiers: any[] = Array.isArray(e.tiers) ? e.tiers : [];
        const paidTier = tiers.find((t) => Number(t.priceUsd) > 0) || tiers[0];
        const sold = tiers.reduce((s, t) => s + (Number(t.quantitySold) || 0), 0);
        return {
          id: String(e.id),
          title: e.title,
          venue: e.venue || e.title || '',
          date: e.startsAt || '',
          location: e.location || '',
          ticketUrl: e.linkedModules?.externalTicketUrl || '',
          priceUsd: paidTier ? Number(paidTier.priceUsd) : 0,
          capacity: e.capacity ?? null,
          ticketsSold: sold,
          status: e.status,
        };
      });
      showsData.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
      setShows(showsData);
    } catch (error) {
      logger.error("Error loading shows:", error);
    }
  };

  const handleAddShow = async () => {
    if (!newShow.venue.trim() || !newShow.date || !newShow.location.trim()) {
      toast({
        title: "Required Fields",
        description: "Please complete venue, date and location.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingShow(true);
    try {
      const priceNum = Math.max(0, Number(newShow.price) || 0);
      // datetime-local gives a bare wall-clock string ("2026-06-18T14:30") in the
      // artist's local timezone. new Date(...) interprets it in THAT timezone, so
      // toISOString() yields the exact UTC instant — no more drift when stored.
      const parsedDate = new Date(newShow.date);
      const startsAtIso = isNaN(parsedDate.getTime()) ? newShow.date : parsedDate.toISOString();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
      const refundPolicyType = newShow.refundPolicyType || 'flexible';
      const refundPolicy = refundPolicyType === 'custom'
        ? (newShow.refundPolicyCustom.trim() || REFUND_POLICY_PRESETS.flexible.text)
        : (REFUND_POLICY_PRESETS[refundPolicyType]?.text || REFUND_POLICY_PRESETS.flexible.text);
      const data = await apiRequest('POST', `/api/concerts/${artistId}/quick-show`, {
        venue: newShow.venue.trim(),
        location: newShow.location.trim(),
        startsAt: startsAtIso,
        timezone,
        priceUsd: priceNum,
        capacity: newShow.capacity ? parseInt(newShow.capacity, 10) : undefined,
        ticketUrl: newShow.ticketUrl?.trim() || undefined,
        refundPolicyType,
        refundPolicy,
      });
      if (!data?.success) throw new Error(data?.error || 'Could not add show');

      toast({
        title: "Show Added",
        description: priceNum > 0
          ? "On sale now — tickets with QR codes and secure payment."
          : "Show listed. Set a price next time to sell tickets on Boostify.",
      });

      setNewShow({ venue: '', date: '', location: '', ticketUrl: '', price: '', capacity: '', refundPolicyType: 'flexible', refundPolicyCustom: '' });
      await loadShows();
      queryClient.invalidateQueries({ queryKey: ['concert-events'] });
      queryClient.invalidateQueries({ queryKey: ['shows'] });
    } catch (error: any) {
      logger.error("Error adding show:", error);
      toast({
        title: "Error",
        description: error?.message || "Could not add show.",
        variant: "destructive",
      });
    } finally {
      setIsAddingShow(false);
    }
  };

  const handleDeleteShow = async (showId: string) => {
    try {
      const data = await apiRequest('DELETE', `/api/concerts/${artistId}/events/${showId}`);
      if (!data?.success) throw new Error(data?.error || 'Could not delete show');

      toast({
        title: "Show Deleted",
        description: "Show was deleted successfully.",
      });

      await loadShows();
      queryClient.invalidateQueries({ queryKey: ['concert-events'] });
    } catch (error: any) {
      logger.error("Error deleting show:", error);
      toast({
        title: "Error",
        description: error?.message || "Could not delete show.",
        variant: "destructive",
      });
    }
  };

  const checkAIGenerationLimit = () => {
    if (!subscription) return true;
    
    const aiLimit = subscription.aiGenerationLimit || 0;
    const aiUsed = subscription.aiGenerationUsed || 0;
    
    if (aiLimit > 0 && aiUsed >= aiLimit) {
      toast({
        title: "Limit Reached",
        description: `You have used your ${aiLimit} generations this month. Upgrade your plan for more.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const checkEPKLimit = () => {
    if (!subscription) return true;
    
    const epkLimit = subscription.epkLimit || 0;
    const epkUsed = subscription.epkUsed || 0;
    
    if (epkLimit === 0) {
      toast({
        title: "Tool Locked",
        description: "EPK is available only for BASIC, PRO and PREMIUM plans.",
        variant: "destructive",
      });
      return false;
    }
    
    if (epkUsed >= epkLimit) {
      toast({
        title: "Limit Reached",
        description: `Ya has creado ${epkLimit} EPK${epkLimit !== 1 ? 's' : ''}. Upgrade tu plan para más.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const checkImageGalleriesLimit = () => {
    if (!subscription) return true;
    
    const galleriesLimit = subscription.imageGalleriesLimit || 0;
    const galleriesUsed = subscription.imageGalleriesUsed || 0;
    
    if (galleriesLimit === 0) {
      toast({
        title: "Tool Locked",
        description: "Image Galleries is available only for BASIC, PRO and PREMIUM plans.",
        variant: "destructive",
      });
      return false;
    }
    
    if (galleriesUsed >= galleriesLimit) {
      toast({
        title: "Limit Reached",
        description: `Ya has creado ${galleriesLimit} galería${galleriesLimit !== 1 ? 's' : ''}. Upgrade tu plan para más.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // ── Helpers ──────────────────────────────────────────────
  const numericArtistId = (() => {
    const n = Number(artistId);
    return Number.isFinite(n) && n > 0 ? n : artistId;
  })();

  const notifyProductsChanged = () => {
    queryClient.invalidateQueries({ queryKey: ["merchandise"] });
    queryClient.invalidateQueries({ queryKey: ["merchandise", numericArtistId] });
    onProductsChanged?.();
  };

  const generateImageForProduct = async (
    productType: string,
    artistName: string,
    brandImage: string
  ): Promise<string | null> => {
    const imageResponse = await fetch('/api/artist-profile/generate-product-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        productType,
        artistName,
        artistId: numericArtistId,
        brandImage,
        genre: formData.genre || 'pop',
        bio: formData.biography || '',
        useArtistAsModel: true,
      })
    });
    if (!imageResponse.ok) {
      throw new Error(`HTTP ${imageResponse.status}`);
    }
    const imageResult = await imageResponse.json();
    if (!imageResult.success || !imageResult.imageUrl) {
      throw new Error(imageResult.error || 'No image returned');
    }
    let productImage = imageResult.imageUrl as string;
    if (productImage.startsWith('data:')) {
      const base64Response = await fetch(productImage);
      const blob = await base64Response.blob();
      const timestamp = Date.now();
      const storageRef = ref(
        storage,
        `merchandise/${artistId}/${productType.toLowerCase().replace(/\s+/g, '-')}_${timestamp}.png`
      );
      await uploadBytes(storageRef, blob);
      productImage = await getDownloadURL(storageRef);
    }
    return productImage;
  };

  const handleGenerateProducts = async () => {
    if (!formData.displayName) {
      toast({ title: "Error", description: "Please enter your artist name first.", variant: "destructive" });
      return;
    }
    if (!checkAIGenerationLimit()) return;

    setIsGeneratingProducts(true);
    try {
      const artistName = formData.displayName;
      const brandImage = formData.profileImage || '';
      if (!brandImage) {
        toast({
          title: "Sube primero una foto de perfil",
          description: "Necesitamos tu imagen de perfil para que los productos sean coherentes con tu marca.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Generando 6 productos en paralelo...",
        description: "Esto toma 30–60 segundos. Cada producto se genera con tu identidad visual.",
      });

      // Definir tipos de productos
      const productTypes = [
        { type: 'T-Shirt', name: `${artistName} T-Shirt`, description: `Official ${artistName} t-shirt`, price: 29.99, category: 'Apparel', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
        { type: 'Hoodie', name: `${artistName} Hoodie`, description: `Premium ${artistName} hoodie`, price: 49.99, category: 'Apparel', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
        { type: 'Cap', name: `${artistName} Cap`, description: `Embroidered ${artistName} snapback cap`, price: 24.99, category: 'Accessories', sizes: ['One Size'] },
        { type: 'Poster', name: `${artistName} Poster`, description: `Limited edition ${artistName} poster`, price: 19.99, category: 'Art', sizes: ['18x24"', '24x36"'] },
        { type: 'Sticker Pack', name: `${artistName} Sticker Pack`, description: `Vinyl sticker pack with ${artistName} designs`, price: 9.99, category: 'Accessories', sizes: ['Standard'] },
        { type: 'Mug', name: `${artistName} Mug`, description: `Ceramic mug with full-wrap ${artistName} design`, price: 14.99, category: 'Accessories', sizes: ['11oz', '15oz'] },
      ];

      // 1) Generar las 6 imágenes EN PARALELO sin tocar Firestore todavía
      const results = await Promise.allSettled(
        productTypes.map(p => generateImageForProduct(p.type, artistName, brandImage))
      );

      const failures: string[] = [];
      const generated: Array<{ def: typeof productTypes[number]; imageUrl: string }> = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          generated.push({ def: productTypes[i], imageUrl: r.value });
        } else {
          const reason = r.status === 'rejected' ? (r.reason?.message || String(r.reason)) : 'no image';
          failures.push(`${productTypes[i].type}: ${reason}`);
          logger.error(`❌ Failed ${productTypes[i].type}:`, reason);
        }
      });

      // 2) Si falló alguno, NO borrar nada y avisar
      if (generated.length < productTypes.length) {
        toast({
          title: `Generación incompleta (${generated.length}/${productTypes.length})`,
          description: `Fallaron: ${failures.join(' · ')}. No se modificaron tus productos actuales. Reintenta.`,
          variant: "destructive",
        });
        return;
      }

      // 3) Las 6 OK → borrar autogenerados anteriores y guardar los nuevos
      const merchRef = collection(db, "merchandise");
      const oldQ = query(merchRef, where("userId", "==", numericArtistId));
      const oldSnap = await getDocs(oldQ);
      const oldDeletions = oldSnap.docs
        .filter(d => d.data().aiGenerated !== false) // conservar custom uploads
        .map(d => deleteDoc(d.ref));
      // Compatibilidad con docs viejos guardados con userId string
      const oldQStr = query(merchRef, where("userId", "==", String(artistId)));
      const oldSnapStr = await getDocs(oldQStr);
      oldSnapStr.docs
        .filter(d => d.data().aiGenerated !== false)
        .forEach(d => oldDeletions.push(deleteDoc(d.ref)));
      await Promise.all(oldDeletions);

      // 4) Persistir los nuevos (Firestore + Postgres dual-write)
      await Promise.all(generated.map(async ({ def, imageUrl }) => {
        const newDocRef = doc(collection(db, "merchandise"));
        const productionCost = Math.round(def.price * 0.4 * 100) / 100; // ~40% como costo estimado
        const pgCategory = def.category === 'Apparel' ? 'apparel'
          : def.category === 'Accessories' ? 'accessories'
          : def.category === 'Music' ? 'music' : 'other';

        // Postgres mirror (Tanda 6)
        let pgId: number | null = null;
        try {
          const r = await fetch('/api/merch/sync-pg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: numericArtistId,
              name: def.name,
              description: def.description,
              price: def.price,
              imageUrl,
              category: pgCategory,
              isCustomDesign: false,
              aiGeneratedDesign: true,
              productionCost,
            }),
          });
          const j = await r.json();
          if (j?.success && j?.pgId) pgId = j.pgId;
        } catch (syncErr) {
          logger.warn('sync-pg failed for AI product (Firestore-only)', syncErr);
        }

        return setDoc(newDocRef, {
          name: def.name,
          description: def.description,
          price: def.price,
          imageUrl,
          category: def.category,
          sizes: def.sizes,
          productType: def.type,
          userId: numericArtistId,
          aiGenerated: true,
          isAvailable: true,
          pgId,
          createdAt: new Date(),
        });
      }));

      notifyProductsChanged();

      toast({
        title: "✅ 6 productos generados",
        description: `Tu Official Store ya muestra los nuevos productos.`,
      });
    } catch (error: any) {
      logger.error("Error generating products:", error);
      toast({
        title: "Error",
        description: error?.message || "Could not generate products. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingProducts(false);
    }
  };

  // ── Custom product upload (manual) ─────────────────────────
  const [customProduct, setCustomProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Apparel',
    sizes: '',
    imageUrl: '',
  });
  const [isUploadingCustomImage, setIsUploadingCustomImage] = useState(false);
  const [isSavingCustomProduct, setIsSavingCustomProduct] = useState(false);
  const [showCustomProductForm, setShowCustomProductForm] = useState(false);
  const customImageInputRef = useRef<HTMLInputElement>(null);

  const handleCustomImageUpload = async (file: File) => {
    setIsUploadingCustomImage(true);
    try {
      await ensureFirebaseAuth();
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storageRef = ref(storage, `merchandise/${artistId}/custom_${timestamp}_${safeName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setCustomProduct(prev => ({ ...prev, imageUrl: url }));
      toast({ title: "Imagen subida", description: file.name });
    } catch (e: any) {
      logger.error('Custom image upload failed:', e);
      toast({ title: "Error subiendo imagen", description: e?.message || 'Reintenta', variant: "destructive" });
    } finally {
      setIsUploadingCustomImage(false);
    }
  };

  const handleAddCustomProduct = async () => {
    const priceNum = parseFloat(customProduct.price);
    if (!customProduct.name.trim() || !customProduct.imageUrl || !Number.isFinite(priceNum) || priceNum <= 0) {
      toast({
        title: "Faltan datos",
        description: "Necesitas al menos nombre, imagen y precio válido.",
        variant: "destructive",
      });
      return;
    }
    setIsSavingCustomProduct(true);
    try {
      const sizesArr = customProduct.sizes
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const newDocRef = doc(collection(db, "merchandise"));
      const pgCategoryCustom = customProduct.category === 'Apparel' ? 'apparel'
        : customProduct.category === 'Accessories' ? 'accessories'
        : customProduct.category === 'Music' ? 'music' : 'other';

      // Postgres mirror first (Tanda 6) — needed para que salesTransactions linkee
      let pgId: number | null = null;
      try {
        const r = await fetch('/api/merch/sync-pg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: numericArtistId,
            name: customProduct.name.trim(),
            description: customProduct.description.trim() || `${customProduct.name.trim()} by ${formData.displayName}`,
            price: priceNum,
            imageUrl: customProduct.imageUrl,
            category: pgCategoryCustom,
            isCustomDesign: true,
            aiGeneratedDesign: false,
          }),
        });
        const j = await r.json();
        if (j?.success && j?.pgId) pgId = j.pgId;
      } catch (syncErr) {
        logger.warn('sync-pg failed for custom product (Firestore-only)', syncErr);
      }

      await setDoc(newDocRef, {
        name: customProduct.name.trim(),
        description: customProduct.description.trim() || `${customProduct.name.trim()} by ${formData.displayName}`,
        price: priceNum,
        imageUrl: customProduct.imageUrl,
        category: customProduct.category,
        sizes: sizesArr.length ? sizesArr : ['Standard'],
        productType: customProduct.category,
        userId: numericArtistId,
        aiGenerated: false,
        isCustom: true,
        isAvailable: true,
        pgId,
        createdAt: new Date(),
      });
      setCustomProduct({ name: '', description: '', price: '', category: 'Apparel', sizes: '', imageUrl: '' });
      setShowCustomProductForm(false);
      notifyProductsChanged();
      toast({ title: "✅ Producto agregado", description: "Aparece en tu Official Store." });
    } catch (e: any) {
      logger.error('Custom product save failed:', e);
      toast({ title: "Error", description: e?.message || 'No se pudo guardar el producto', variant: "destructive" });
    } finally {
      setIsSavingCustomProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    try {
      await deleteDoc(doc(db, "merchandise", productId));
      notifyProductsChanged();
      toast({ title: "Producto eliminado" });
    } catch (e: any) {
      logger.error('Delete product failed:', e);
      toast({ title: "Error", description: e?.message || 'No se pudo eliminar', variant: "destructive" });
    }
  };

  const handleUpdateProductPrice = async (productId: string, newPrice: number) => {
    if (!Number.isFinite(newPrice) || newPrice <= 0) return;
    try {
      await setDoc(doc(db, "merchandise", productId), { price: newPrice }, { merge: true });
      notifyProductsChanged();
      toast({ title: "Precio actualizado", description: `$${newPrice.toFixed(2)}` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || 'No se pudo actualizar', variant: "destructive" });
    }
  };

  const handleToggleAvailability = async (productId: string, isAvailable: boolean) => {
    try {
      await setDoc(doc(db, "merchandise", productId), { isAvailable }, { merge: true });
      notifyProductsChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || 'No se pudo actualizar', variant: "destructive" });
    }
  };

  // Cargar productos existentes en el dialog (para listar/editar/eliminar)
  const [dialogProducts, setDialogProducts] = useState<Array<{ id: string; name: string; price: number; imageUrl: string; category: string; aiGenerated?: boolean; isCustom?: boolean; isAvailable?: boolean }>>([]);
  const [isLoadingDialogProducts, setIsLoadingDialogProducts] = useState(false);

  const reloadDialogProducts = async () => {
    setIsLoadingDialogProducts(true);
    try {
      const merchRef = collection(db, "merchandise");
      const ids = [numericArtistId, String(artistId)];
      const found: Map<string, any> = new Map();

      const canonicalType = (product: any): string => {
        const raw = String(product?.productType || product?.type || product?.category || product?.name || '').toLowerCase();
        if (raw.includes('t-shirt') || raw.includes('t shirt') || raw.includes('tee')) return 't-shirt';
        if (raw.includes('hoodie')) return 'hoodie';
        if (raw.includes('cap') || raw.includes('hat') || raw.includes('snapback')) return 'cap';
        if (raw.includes('poster') || raw.includes('print')) return 'poster';
        if (raw.includes('sticker')) return 'sticker-pack';
        if (raw.includes('mug') || raw.includes('cup')) return 'mug';
        return raw || 'unknown';
      };

      const rankProduct = (product: any): number => {
        const hasImage = !!product?.imageUrl;
        const isAi = product?.aiGenerated !== false;
        const createdAtMs = product?.createdAt?.toMillis?.() || new Date(product?.createdAt || 0).getTime() || 0;
        return (hasImage ? 1_000_000_000 : 0) + (isAi ? 500_000_000 : 0) + createdAtMs;
      };

      const byType = new Map<string, any>();
      for (const id of ids) {
        const snap = await getDocs(query(merchRef, where("userId", "==", id as any)));
        snap.docs.forEach(d => {
          if (!found.has(d.id)) {
            const product = { id: d.id, ...(d.data() as any) };
            found.set(d.id, product);
            const typeKey = canonicalType(product);
            const existing = byType.get(typeKey);
            if (!existing || rankProduct(product) > rankProduct(existing)) {
              byType.set(typeKey, product);
            }
          }
        });
      }
      setDialogProducts(Array.from(byType.values()));
    } catch (e) {
      logger.error('reloadDialogProducts failed:', e);
    } finally {
      setIsLoadingDialogProducts(false);
    }
  };

  useEffect(() => {
    if (isOpen) reloadDialogProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, numericArtistId]);

  // Refrescar la lista local cuando cambian productos
  useEffect(() => {
    if (!isOpen) return;
    reloadDialogProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGeneratingProducts, isSavingCustomProduct]);


  const handleGenerateNews = async () => {
    if (!formData.displayName) {
      toast({
        title: "Error",
        description: "Please enter your artist name first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingNews(true);
    try {
      toast({
        title: "Generating news...",
        description: "This may take a moment. We're creating 5 unique news articles with AI.",
      });

      const response = await fetch(`/api/artist-generator/generate-news/${artistId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "News Generated!",
          description: `news items with unique images have been created.`,
        });
        
        onUpdate();
      } else {
        throw new Error(result.error || 'Error generating news');
      }
    } catch (error) {
      logger.error("Error generating news:", error);
      toast({
        title: "Error",
        description: "Could not generate news. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingNews(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Generar slug automáticamente desde el nombre del artista
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Eliminar caracteres especiales
      .replace(/\s+/g, '-') // Reemplazar espacios con guiones
      .replace(/-+/g, '-') // Reemplazar múltiples guiones con uno solo
      .replace(/^-+|-+$/g, ''); // Eliminar guiones al inicio y final
  };

  // Actualizar slug automáticamente cuando cambia el nombre
  const handleNameChange = (name: string) => {
    handleChange('displayName', name);
    if (!formData.slug || formData.slug === generateSlug(currentData.displayName)) {
      // Solo auto-generar si no hay slug personalizado o si es el slug original
      handleChange('slug', generateSlug(name));
    }
  };

  // Subir imagen de referencia
  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingReference(true);

    try {
      const storageRef = ref(storage, `artist-references/${artistId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      setReferenceImage(downloadURL);
      toast({
        title: "Image Uploaded",
        description: "Now you can generate tu perfil y banner con esta imagen de referencia.",
      });
    } catch (error) {
      logger.error("Error uploading reference image:", error);
      toast({
        title: "Error",
        description: "Could not load reference image.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingReference(false);
    }
  };

  // Subir imagen de perfil directamente
  const handleUploadProfileImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image (JPG, PNG, etc.).",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingProfileImage(true);

    try {
      const storageRef = ref(storage, `artist-profiles/${artistId}/profile_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      handleChange("profileImage", downloadURL);
      toast({
        title: "Profile image uploaded",
        description: "Your profile image has been uploaded successfully.",
      });
    } catch (error) {
      logger.error("Error uploading profile image:", error);
      toast({
        title: "Error",
        description: "Could not upload profile image.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingProfileImage(false);
    }
  };

  // Subir imagen o video de banner directamente
  const handleUploadBannerImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image (JPG, PNG, etc.) o un video (MP4, WebM, etc.).",
        variant: "destructive",
      });
      return;
    }

    // Advertir si el archivo es .MOV
    const isMovFile = file.name.toLowerCase().endsWith('.mov') || file.type === 'video/quicktime';
    if (isMovFile) {
      toast({
        title: "⚠️ Formato .MOV detectado",
        description: "Los archivos .MOV no funcionan en Chrome/Firefox. Recomendamos convertir a .MP4 para mejor compatibilidad.",
        variant: "destructive",
      });
      // Aún permitimos subir, pero con advertencia
    }

    setIsUploadingBannerImage(true);

    try {
      const storageRef = ref(storage, `artist-profiles/${artistId}/banner_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      handleChange("bannerImage", downloadURL);
      const fileType = file.type.startsWith('image/') ? 'imagen' : 'video';
      toast({
        title: `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} of banner uploada`,
        description: isMovFile 
          ? `Tu ${fileType} fue subido, pero puede no funcionar en todos los navegadores. Considera usar .MP4 en su lugar.`
          : `Your banner has been uploaded successfully.`,
      });
    } catch (error) {
      logger.error("Error uploading banner media:", error);
      toast({
        title: "Error",
        description: "Could not upload banner file.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingBannerImage(false);
    }
  };

  const handleGenerateBiography = async () => {
    if (!formData.displayName) {
      toast({
        title: "Name Required",
        description: "You must enter your artist name first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingBiography(true);

    try {
      const response = await fetch('/api/artist-profile/generate-biography', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.displayName,
          genre: formData.genre,
          location: formData.location,
        }),
      });

      const data = await response.json();

      if (data.success && data.biography) {
        logger.info('✅ Biography generada exitosamente:', data.biography);
        // Actualizar el estado directamente
        setFormData(prev => ({
          ...prev,
          biography: data.biography
        }));
        toast({
          title: "Biography generada",
          description: "Your biography has been automatically generated with AI.",
        });
      } else {
        throw new Error(data.error || 'Failed to generate biography');
      }
    } catch (error: any) {
      logger.error("Error generating biography:", error);
      toast({
        title: "Error",
        description: "Could not generate biography. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBiography(false);
    }
  };

  const handleGenerateAlbum = async () => {
    if (!formData.displayName) {
      toast({
        title: "Name Required",
        description: "You must enter your artist name first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAlbum(true);

    try {
      const response = await fetch('/api/generate-album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: formData.displayName,
          biography: formData.biography,
          profileImage: formData.profileImage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        logger.info('✅ Album Generated exitosamente');
        toast({
          title: "Album Generated",
          description: "3 songs with audio have been created. You can view them in your profile Music section.",
        });
      } else {
        throw new Error(data.message || 'Failed to generate album');
      }
    } catch (error: any) {
      logger.error("Error generating album:", error);
      toast({
        title: "Error",
        description: error.message || "Could not generate album. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAlbum(false);
    }
  };

  const handleGenerateProfileImage = async () => {
    if (!formData.displayName) {
      toast({
        title: "Name Required",
        description: "You must enter your artist name first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingProfileImage(true);

    try {
      const response = await fetch('/api/artist-profile/generate-profile-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: formData.displayName,
          genre: formData.genre,
          style: "Professional portrait, studio lighting, artistic aesthetic",
          referenceImage: referenceImage || undefined,
        }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        logger.info('✅ Profile Image Generated exitosamente');
        logger.info('🖼️ Nueva URL de imagen de perfil:', data.imageUrl.substring(0, 100));
        // Actualizar el estado directamente y forzar re-render
        setFormData(prev => {
          logger.info('📝 Actualizando formData.profileImage');
          return {
            ...prev,
            profileImage: data.imageUrl
          };
        });
        setImageUpdateKey(prev => {
          const newKey = prev + 1;
          logger.info('🔑 Image update key:', prev, '->', newKey);
          return newKey;
        });
        toast({
          title: "Profile Image Generated",
          description: "Your profile image has been generated with AI.",
        });
      } else {
        throw new Error(data.error || 'Failed to generate profile image');
      }
    } catch (error: any) {
      logger.error("Error generating profile image:", error);
      toast({
        title: "Error",
        description: "Could not generate profile image. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingProfileImage(false);
    }
  };

  const handleGenerateBannerImage = async () => {
    if (!formData.displayName) {
      toast({
        title: "Name Required",
        description: "You must enter your artist name first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingBannerImage(true);

    try {
      const response = await fetch('/api/artist-profile/generate-banner-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: formData.displayName,
          genre: formData.genre,
          style: `Professional music artist hero banner for Boostify platform. Wide cinematic 16:9 format perfect for hero section. 
                  Artistic composition featuring ${formData.displayName} with Boostify's signature orange (#FF6B35) and black color palette. 
                  Modern music industry aesthetic with professional lighting and dynamic energy. 
                  ${referenceImage ? 'Incorporate the artist\'s face/identity from reference image naturally into the artistic scene.' : ''}
                  High-end music platform vibe, premium quality, artistic and creative atmosphere.`,
          mood: `Energetic, creative, professional music industry atmosphere with Boostify brand identity (orange and black accents)`,
          referenceImage: referenceImage || undefined,
        }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        logger.info('✅ Banner generado exitosamente');
        logger.info('🖼️ Nueva URL de banner:', data.imageUrl.substring(0, 100));
        // Actualizar el estado directamente y forzar re-render
        setFormData(prev => {
          logger.info('📝 Actualizando formData.bannerImage');
          return {
            ...prev,
            bannerImage: data.imageUrl
          };
        });
        setImageUpdateKey(prev => {
          const newKey = prev + 1;
          logger.info('🔑 Image update key:', prev, '->', newKey);
          return newKey;
        });
        toast({
          title: "Banner Image Generated",
          description: "Your banner image has been generated with AI.",
        });
      } else {
        throw new Error(data.error || 'Failed to generate banner image');
      }
    } catch (error: any) {
      logger.error("Error generating banner image:", error);
      toast({
        title: "Error",
        description: "Could not generate banner image. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBannerImage(false);
    }
  };

  // Convertir base64 a Firebase Storage URL
  const uploadBase64ToStorage = async (base64Data: string, fileName: string): Promise<string> => {
    // Extraer el tipo MIME y los datos base64
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 string');
    }

    const contentType = matches[1];
    const base64Content = matches[2];
    
    // Convertir base64 a blob
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });

    // Subir a Firebase Storage
    const storageRef = ref(storage, `artist-profiles/${artistId}/${fileName}`);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    
    logger.info('☁️ Imagen base64 subida a Storage:', downloadURL);
    return downloadURL;
  };

  // Handler para subir galería manual de imágenes
  const handleManualGalleryUpload = async () => {
    if (!manualGalleryTitle.trim()) {
      toast({
        title: "Error",
        description: "Por favor proporciona un título para la galería",
        variant: "destructive",
      });
      return;
    }

    if (manualGalleryFiles.length === 0) {
      toast({
        title: "Error",
        description: "Por favor selecciona al menos una imagen",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingGallery(true);
    try {
      const uploadedImages: Array<{ id: string; url: string; prompt: string; createdAt: string; isVideo: boolean }> = [];
      
      for (let i = 0; i < manualGalleryFiles.length; i++) {
        const file = manualGalleryFiles[i];
        const storagePath = `image_galleries/${artistId}/${Date.now()}_${file.name}`;
        const storageRefPath = ref(storage, storagePath);
        
        await uploadBytes(storageRefPath, file);
        const downloadURL = await getDownloadURL(storageRefPath);
        
        uploadedImages.push({
          id: `${Date.now()}_${i}`,
          url: downloadURL,
          prompt: `Imagen subida: ${file.name}`,
          createdAt: new Date().toISOString(),
          isVideo: false,
        });
      }

      const newGalleryRef = doc(collection(db, "image_galleries"));
      await setDoc(newGalleryRef, {
        userId: artistId,
        singleName: manualGalleryTitle,
        artistName: manualGalleryTitle,
        basePrompt: "Imágenes subidas manualmente",
        styleInstructions: "N/A",
        referenceImageUrls: [],
        generatedImages: uploadedImages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic: true,
      });

      toast({
        title: "¡Galería creada!",
        description: `Se han subido ${uploadedImages.length} imágenes exitosamente.`,
      });

      setManualGalleryTitle('');
      setManualGalleryFiles([]);
      setShowManualGalleryUpload(false);
      onUpdate();
      if (onGalleryCreated) {
        onGalleryCreated();
      }
    } catch (error) {
      logger.error("Error uploading manual gallery:", error);
      toast({
        title: "Error al subir",
        description: "No se pudieron subir las imágenes. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const handleSave = async () => {
    if (!artistId) {
      toast({
        title: "Error",
        description: "Invalid artist ID.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      logger.info('💾 Guardando perfil del artista', artistId);

      // Llamar al endpoint del backend que actualiza AMBAS bases de datos
      const response = await fetch(`/api/artist-generator/update-artist/${artistId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          displayName: formData.displayName,
          biography: formData.biography || "",
          genre: formData.genre || "",
          location: formData.location || "",
          profileImage: formData.profileImage || "",
          bannerImage: formData.bannerImage || "",
          bannerPosition: formData.bannerPosition || "50",
          loopVideoUrl: formData.loopVideoUrl || "",
          slug: formData.slug || generateSlug(formData.displayName),
          contactEmail: formData.contactEmail || "",
          contactPhone: formData.contactPhone || "",
          instagram: formData.instagram || "",
          twitter: formData.twitter || "",
          youtube: formData.youtube || "",
          spotify: formData.spotify || "",
          pageMode: formData.pageMode || "artist",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error updating profile');
      }

      logger.info('✅ Profile updated successfully en PostgreSQL y Firebase');

      // Invalidar TODAS las queryKeys relevantes para forzar actualización en el UI
      const numericId = parseInt(artistId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["userProfile", artistId] }),
        queryClient.invalidateQueries({ queryKey: ["userProfile", String(artistId)] }),
        queryClient.invalidateQueries({ queryKey: ["userProfile", Number(artistId)] }),
        // Catch-all: the artist profile card may key its userProfile query by slug,
        // firestoreId or pgId — invalidate every "userProfile" cache regardless of id
        // so connect/disconnect of social widgets is always reflected immediately.
        queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'userProfile' }),
        queryClient.invalidateQueries({ queryKey: ["/api/artist-generator/my-artists"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/artist", artistId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/artist-profile", artistId] }),
        queryClient.invalidateQueries({ queryKey: [`/api/songs/user/${numericId}`] }),
        queryClient.invalidateQueries({ queryKey: ["songs"] }),
      ]);
      
      // 🔔 Enviar datos al webhook de Make.com para automatización
      try {
        logger.info('📡 Enviando datos de perfil al webhook de Make.com...');
        const webhookUrl = 'https://hook.us2.make.com/jeo56r778isvcxe4q7ntg3n9f3ykbsnf';
        
        const webhookData = {
          timestamp: new Date().toISOString(),
          event: 'profile_updated',
          artistId: artistId,
          profile: {
            displayName: formData.displayName,
            biography: formData.biography,
            genre: formData.genre,
            location: formData.location,
            profileImage: formData.profileImage,
            bannerImage: formData.bannerImage,
            bannerPosition: formData.bannerPosition,
            loopVideoUrl: formData.loopVideoUrl,
            slug: formData.slug,
            contactEmail: formData.contactEmail,
            contactPhone: formData.contactPhone,
            socialMedia: {
              instagram: formData.instagram,
              twitter: formData.twitter,
              youtube: formData.youtube,
              spotify: formData.spotify,
            },
          }
        };

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookData)
        });

        if (webhookResponse.ok) {
          logger.info('✅ Data successfully sent to Make.com webhook');
        } else {
          logger.warn('⚠️ El webhook respondió con status:', webhookResponse.status);
        }
      } catch (webhookError) {
        // No bloqueamos el flujo si el webhook falla
        logger.error('❌ Error enviando datos al webhook (no crítico):', webhookError);
      }
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });

      setIsOpen(false);
      onUpdate();
    } catch (error) {
      logger.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Could not save profile. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'profile' | 'media' | 'social' | 'shows' | 'tools'>('profile');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="!p-0 !gap-0 !top-auto !bottom-0 !translate-y-0 !h-[95dvh] !w-full !max-w-full !rounded-t-3xl !rounded-b-none border border-white/[0.08] bg-[#0d0d14] sm:!top-[50%] sm:!bottom-auto sm:!translate-y-[-50%] sm:!h-[90vh] sm:!max-w-2xl sm:!rounded-2xl overflow-hidden flex flex-col">

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            {formData.profileImage ? (
              <img
                src={formData.profileImage}
                alt="profile"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-orange-500/40 flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                <Edit2 className="w-4 h-4 text-orange-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-semibold text-white truncate leading-tight">
                {formData.displayName || 'Edit Artist Profile'}
              </h2>
              <p className="text-[11px] text-white/35 mt-0.5">Update your profile &amp; generate content with AI</p>
            </div>
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-semibold text-orange-400">
              <Sparkles className="w-2.5 h-2.5" />
              AI
            </span>
          </div>
        </div>

        {/* ── TAB NAV ──────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-white/[0.06]">
          <div className="flex overflow-x-auto scrollbar-none px-3 pt-1">
            {([
              { id: 'profile', label: 'Profile', emoji: '🎤' },
              { id: 'media',   label: 'Media',   emoji: '🖼️' },
              { id: 'social',  label: 'Social',  emoji: '📱' },
              { id: 'shows',   label: 'Shows',   emoji: '🎵' },
              { id: 'tools',   label: 'Tools',   emoji: '⚡' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-medium rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-orange-400 border-orange-500 bg-orange-500/[0.07]'
                    : 'text-white/40 border-transparent hover:text-white/65 hover:bg-white/[0.03]'
                }`}
              >
                <span className="text-[13px]">{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-5 space-y-4">

          {/* ═══════════════ PROFILE TAB ═══════════════ */}
          {activeTab === 'profile' && (
            <div className="space-y-4">

              {/* Page Mode */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">🎯 Page Type</p>
                <p className="text-[11px] text-white/35 mb-3">Choose the type of landing page — sections and labels adjust automatically.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PAGE_MODE_OPTIONS.map((modeKey) => {
                    const mode = PAGE_MODES[modeKey];
                    const isSelected = (formData.pageMode || 'artist') === modeKey;
                    const ModeIcon = mode.icon;
                    return (
                      <button
                        key={modeKey}
                        type="button"
                        onClick={() => handleChange('pageMode', modeKey)}
                        className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left ${
                          isSelected ? 'scale-[1.01] shadow-lg' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
                        }`}
                        style={isSelected ? { borderColor: mode.color, backgroundColor: `${mode.color}16` } : {}}
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${mode.color}18` }}>
                          <ModeIcon className="w-4 h-4" style={{ color: mode.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[12px] text-white">{mode.emoji} {mode.label}</div>
                          <div className="text-[10px] text-white/35 truncate">{mode.description}</div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: mode.color }}>
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Artist Name */}
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Artist Name *</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Your artist name"
                  className="bg-white/[0.05] border-white/[0.09] focus:border-orange-500/60 text-white placeholder:text-white/20 h-10 rounded-xl"
                />
              </div>

              {/* Slug / Profile URL */}
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">🔗 Profile URL</p>
                <p className="text-[11px] text-white/35">Your personalized shareable link.</p>
                <div className="flex items-center gap-2 bg-white/[0.04] rounded-xl border border-white/[0.08] px-3 py-1 overflow-hidden">
                  <span className="text-[10px] text-white/25 flex-shrink-0 hidden sm:block truncate max-w-[140px]">{window.location.origin}/artist/</span>
                  <input
                    id="slug"
                    value={formData.slug || ''}
                    onChange={(e) => handleChange('slug', generateSlug(e.target.value))}
                    placeholder="your-artist-name"
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/20 text-[12px] py-1.5 min-w-0"
                  />
                </div>
                {formData.slug && (
                  <div className="px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <span className="text-[10px] text-blue-400 font-mono break-all">{window.location.origin}/artist/{formData.slug}</span>
                  </div>
                )}
              </div>

              {/* Biography */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="biography" className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Biography</Label>
                  <div className="flex gap-1.5">
                    <Button type="button" size="sm" onClick={handleGenerateBiography} disabled={isGeneratingBiography}
                      className="h-7 px-2.5 text-[11px] bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 rounded-lg">
                      {isGeneratingBiography ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Sparkles className="h-3 w-3 mr-1" />AI Bio</>}
                    </Button>
                    <Button type="button" size="sm" onClick={handleGenerateAlbum} disabled={isGeneratingAlbum}
                      className="h-7 px-2.5 text-[11px] bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-lg">
                      {isGeneratingAlbum ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Music className="h-3 w-3 mr-1" />Album</>}
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="biography"
                  value={formData.biography}
                  onChange={(e) => handleChange("biography", e.target.value)}
                  placeholder="Tell your story as an artist..."
                  className="min-h-[90px] bg-white/[0.05] border-white/[0.09] focus:border-orange-500/60 text-white placeholder:text-white/20 text-sm resize-none rounded-xl"
                />
              </div>

              {/* Genre + Location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="genre" className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Genre</Label>
                  <Input id="genre" value={formData.genre} onChange={(e) => handleChange("genre", e.target.value)}
                    placeholder="Pop, Rock, Hip-Hop..." className="bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location" className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Location</Label>
                  <Input id="location" value={formData.location} onChange={(e) => handleChange("location", e.target.value)}
                    placeholder="City, Country" className="bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-10 rounded-xl" />
                </div>
              </div>

            </div>
          )}

          {/* ═══════════════ MEDIA TAB ═══════════════ */}
          {activeTab === 'media' && (
            <div className="space-y-4">

              {/* AI Reference Image */}
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400 mb-1">🎨 AI Reference Photo</p>
                <p className="text-[11px] text-white/35 mb-3">Upload your photo so AI can generate personalized profile &amp; banner images.</p>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleReferenceImageUpload} className="hidden" />
                <div className="flex items-center gap-3">
                  <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingReference}
                    className="bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 rounded-xl h-8 px-3 text-[11px]">
                    {isUploadingReference ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Uploading...</> : <><Upload className="mr-1.5 h-3 w-3" />Upload Photo</>}
                  </Button>
                  {referenceImage && <span className="text-[11px] text-green-400 flex items-center gap-1"><Check className="h-3 w-3" />Uploaded</span>}
                </div>
                {referenceImage && (
                  <img src={referenceImage} alt="Reference" className="w-24 h-24 object-cover rounded-2xl mt-3 ring-2 ring-orange-500/30" />
                )}
              </div>

              {/* Profile Image */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Profile Image</p>
                <div className="flex items-start gap-4">
                  {formData.profileImage ? (
                    <img key={`profile-${imageUpdateKey}`} src={formData.profileImage} alt="Preview"
                      className="w-16 h-16 object-cover rounded-full ring-2 ring-orange-500/30 flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white/[0.05] border-2 border-dashed border-white/15 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-5 h-5 text-white/25" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input ref={profileImageInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/heic" onChange={handleUploadProfileImage} className="hidden" />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => profileImageInputRef.current?.click()} disabled={isUploadingProfileImage}
                        className="flex-1 bg-white/[0.05] border border-white/10 text-white/60 hover:bg-white/[0.1] hover:text-white h-8 text-[11px] rounded-lg">
                        {isUploadingProfileImage ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Uploading</> : <><Upload className="mr-1 h-3 w-3" />Upload</>}
                      </Button>
                      <Button type="button" size="sm" onClick={handleGenerateProfileImage} disabled={isGeneratingProfileImage || !formData.displayName}
                        className="flex-1 bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 h-8 text-[11px] rounded-lg">
                        {isGeneratingProfileImage ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Gen...</> : <><Wand2 className="mr-1 h-3 w-3" />AI Gen</>}
                      </Button>
                    </div>
                    {/* Character Pack — generate 4 photos using this profile image as reference */}
                    <Button
                      type="button"
                      size="sm"
                      disabled={isGeneratingCharacterPack || !formData.profileImage}
                      onClick={async () => {
                        if (!formData.profileImage) {
                          toast({ title: 'Sube primero una foto de perfil', description: 'Se necesita una foto de perfil para generar el pack.', variant: 'destructive' });
                          return;
                        }
                        setIsGeneratingCharacterPack(true);
                        setCharacterPackImages([]);
                        try {
                          const res = await fetch('/api/artist-profile/character-pack', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                              artistId,
                              artistName: formData.displayName,
                              genre: formData.genre || 'music',
                              profileImageUrl: formData.profileImage,
                            }),
                          });
                          const data = await res.json();
                          if (data.success && data.images?.length > 0) {
                            setCharacterPackImages(data.images);
                            toast({ title: `✨ ${data.images.length} fotos generadas`, description: 'Tu Character Pack está listo' });
                          } else {
                            toast({ title: 'Error', description: data.error || 'No se pudieron generar las fotos', variant: 'destructive' });
                          }
                        } catch (err: any) {
                          toast({ title: 'Error', description: err.message, variant: 'destructive' });
                        } finally {
                          setIsGeneratingCharacterPack(false);
                        }
                      }}
                      className="w-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 h-8 text-[11px] rounded-lg"
                    >
                      {isGeneratingCharacterPack
                        ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Generando 4 fotos…</>
                        : <><Camera className="mr-1 h-3 w-3" />Generar 4 Fotos (Character Pack)</>}
                    </Button>
                    {/* Character Pack results */}
                    {characterPackImages.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] text-white/40 mb-1.5">Character Pack — click para usar como foto de perfil:</p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {characterPackImages.map((img, i) => (
                            <button
                              key={i}
                              type="button"
                              title={`Usar: ${img.angle || `Foto ${i+1}`}`}
                              onClick={() => {
                                handleChange('profileImage', img.url);
                                toast({ title: 'Foto seleccionada', description: 'Guarda los cambios para aplicarla.' });
                              }}
                              className="relative group rounded-lg overflow-hidden aspect-square border-2 border-transparent hover:border-cyan-400/70 transition-all"
                            >
                              <img src={img.url} alt={img.angle || `${i+1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Check className="w-4 h-4 text-cyan-300" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <Input value={formData.profileImage} onChange={(e) => handleChange("profileImage", e.target.value)}
                      placeholder="Or paste an image URL..." className="bg-white/[0.04] border-white/[0.07] text-white placeholder:text-white/20 h-8 text-[11px] rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Banner Image */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Banner / Hero</p>
                <div className="flex gap-2">
                  <input ref={bannerImageInputRef} type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,video/mp4,video/webm,video/quicktime"
                    onChange={handleUploadBannerImage} className="hidden" />
                  <Button type="button" size="sm" onClick={() => bannerImageInputRef.current?.click()} disabled={isUploadingBannerImage}
                    className="flex-1 bg-white/[0.05] border border-white/10 text-white/60 hover:bg-white/[0.1] hover:text-white h-8 text-[11px] rounded-lg">
                    {isUploadingBannerImage ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Uploading</> : <><Upload className="mr-1 h-3 w-3" />Upload</>}
                  </Button>
                  <Button type="button" size="sm" onClick={handleGenerateBannerImage} disabled={isGeneratingBannerImage || !formData.displayName}
                    className="flex-1 bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 h-8 text-[11px] rounded-lg">
                    {isGeneratingBannerImage ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Gen...</> : <><Wand2 className="mr-1 h-3 w-3" />AI Gen</>}
                  </Button>
                </div>
                <Input id="bannerImage" value={formData.bannerImage} onChange={(e) => handleChange("bannerImage", e.target.value)}
                  placeholder="Banner URL — image or .mp4/.webm video" className="bg-white/[0.04] border-white/[0.07] text-white placeholder:text-white/20 h-9 text-[11px] rounded-xl" />
                <p className="text-[10px] text-white/25">💡 Use MP4/WebM for video banners. MOV may not work in Chrome/Firefox.</p>
                {formData.bannerImage && (
                  <div className="space-y-2">
                    {formData.bannerImage.match(/\.(mp4|mov|avi|webm)$/i) || formData.bannerImage.includes('video') ? (
                      <video key={`banner-${imageUpdateKey}`} src={formData.bannerImage}
                        className="w-full h-28 object-cover rounded-xl" style={{ objectPosition: `center ${formData.bannerPosition || '50'}%` }}
                        autoPlay loop muted playsInline />
                    ) : (
                      <img key={`banner-${imageUpdateKey}`} src={formData.bannerImage} alt="Banner preview"
                        className="w-full h-28 object-cover rounded-xl" style={{ objectPosition: `center ${formData.bannerPosition || '50'}%` }} />
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-white/35 flex-shrink-0">Top</span>
                      <input type="range" min="0" max="100" value={formData.bannerPosition || '50'}
                        onChange={(e) => handleChange('bannerPosition', e.target.value)}
                        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{ background: `linear-gradient(to right, #f97316 0%, #f97316 ${formData.bannerPosition || 50}%, rgba(255,255,255,0.08) ${formData.bannerPosition || 50}%, rgba(255,255,255,0.08) 100%)` }} />
                      <span className="text-[10px] text-white/35 flex-shrink-0">Bottom</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Loop Video */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Background Loop Video</p>
                  <Badge variant="secondary" className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20">Premium</Badge>
                </div>
                <p className="text-[11px] text-white/30">Video that loops as your profile background for a cinematic feel.</p>
                <Input id="loopVideoUrl" value={formData.loopVideoUrl || ''} onChange={(e) => handleChange("loopVideoUrl", e.target.value)}
                  placeholder="https://example.com/video.mp4" className="bg-white/[0.04] border-white/[0.07] text-white placeholder:text-white/20 h-9 text-[11px] rounded-xl" />
                {formData.loopVideoUrl && (
                  <video src={formData.loopVideoUrl} className="w-full h-24 object-cover rounded-xl" autoPlay muted loop playsInline />
                )}
              </div>

            </div>
          )}

          {/* ═══════════════ SOCIAL TAB ═══════════════ */}
          {activeTab === 'social' && (
            <div className="space-y-4">

              {/* Contact Info */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Contact Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="contactEmail" className="text-[11px] text-white/40">Email</Label>
                    <Input id="contactEmail" type="email" value={formData.contactEmail} onChange={(e) => handleChange("contactEmail", e.target.value)}
                      placeholder="contact@example.com" className="bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-9 text-sm rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contactPhone" className="text-[11px] text-white/40">Phone</Label>
                    <Input id="contactPhone" value={formData.contactPhone} onChange={(e) => handleChange("contactPhone", e.target.value)}
                      placeholder="+1 234 567 8900" className="bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-9 text-sm rounded-xl" />
                  </div>
                </div>
              </div>

              {/* Social Platforms */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Social Platforms</p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] w-24 flex-shrink-0 text-white/50">📷 Instagram</span>
                    <Input id="instagram" value={formData.instagram} onChange={(e) => handleChange("instagram", e.target.value)}
                      placeholder="@yourusername" className="flex-1 bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-8 text-[12px] rounded-lg" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] w-24 flex-shrink-0 text-white/50">𝕏 Twitter</span>
                    <Input id="twitter" value={formData.twitter} onChange={(e) => handleChange("twitter", e.target.value)}
                      placeholder="@yourusername" className="flex-1 bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-8 text-[12px] rounded-lg" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] w-24 flex-shrink-0 text-white/50">▶️ YouTube</span>
                    <Input id="youtube" value={formData.youtube} onChange={(e) => handleChange("youtube", e.target.value)}
                      placeholder="https://youtube.com/@channel" className="flex-1 bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-8 text-[12px] rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Spotify */}
              <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.04] p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-green-400">🎵 Spotify</p>
                  <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-400 px-1.5 h-4">Embedded Player</Badge>
                </div>
                <Input id="spotify" value={formData.spotify} onChange={(e) => handleChange("spotify", e.target.value)}
                  placeholder="https://open.spotify.com/artist/..." className="bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-9 text-[11px] rounded-xl" />
                <p className="text-[10px] text-white/30">Paste your Spotify artist URL to embed a player on your page.</p>
              </div>

            </div>
          )}

          {/* ═══════════════ SHOWS TAB ═══════════════ */}
          {activeTab === 'shows' && (
            <div className="space-y-4">

              {/* Add Show Form */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Add New Show</p>
                  <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 whitespace-nowrap">QR tickets · secure payment</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="newShowVenue" className="text-[10px] text-white/40">Venue Name *</Label>
                    <Input id="newShowVenue" value={newShow.venue} onChange={(e) => setNewShow({ ...newShow, venue: e.target.value })}
                      placeholder="Hard Rock Cafe" className="bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-9 text-sm rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="newShowDate" className="text-[10px] text-white/40">Date &amp; Time *</Label>
                    <Input id="newShowDate" type="datetime-local" value={newShow.date} onChange={(e) => setNewShow({ ...newShow, date: e.target.value })}
                      className="bg-white/[0.05] border-white/[0.09] text-white h-9 text-sm rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="newShowLocation" className="text-[10px] text-white/40">Location *</Label>
                    <Input id="newShowLocation" value={newShow.location} onChange={(e) => setNewShow({ ...newShow, location: e.target.value })}
                      placeholder="City, Country" className="bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-9 text-sm rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="newShowPrice" className="text-[10px] text-white/40">Ticket Price (USD)</Label>
                      <Input id="newShowPrice" type="number" min="0" step="0.01" value={newShow.price} onChange={(e) => setNewShow({ ...newShow, price: e.target.value })}
                        placeholder="0.00" className="bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-9 text-sm rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newShowCapacity" className="text-[10px] text-white/40">Capacity</Label>
                      <Input id="newShowCapacity" type="number" min="0" step="1" value={newShow.capacity} onChange={(e) => setNewShow({ ...newShow, capacity: e.target.value })}
                        placeholder="Unlimited" className="bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-9 text-sm rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="newShowTicketUrl" className="text-[10px] text-white/40">External Ticket URL (only for free / off-platform shows)</Label>
                    <Input id="newShowTicketUrl" value={newShow.ticketUrl} onChange={(e) => setNewShow({ ...newShow, ticketUrl: e.target.value })}
                      placeholder="https://..." className="bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 h-9 text-sm rounded-xl" />
                  </div>

                  {/* Refund / cancellation policy — shown to buyers at checkout */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="newShowPolicy" className="text-[10px] text-white/40">Refund Policy (shown to buyers at checkout) *</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {(['flexible', 'moderate', 'strict', 'no_refunds', 'custom'] as const).map((key) => {
                        const active = newShow.refundPolicyType === key;
                        const label = key === 'custom' ? 'Custom' : REFUND_POLICY_PRESETS[key].label;
                        return (
                          <button key={key} type="button" onClick={() => setNewShow({ ...newShow, refundPolicyType: key })}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${active ? 'bg-orange-500/20 border-orange-500/40 text-orange-200' : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70'}`}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {newShow.refundPolicyType === 'custom' ? (
                      <Textarea id="newShowPolicy" value={newShow.refundPolicyCustom} onChange={(e) => setNewShow({ ...newShow, refundPolicyCustom: e.target.value })}
                        placeholder="Describe tu política de reembolso / cancelación…" rows={3}
                        className="bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/20 text-xs rounded-xl resize-none" />
                    ) : (
                      <p className="text-[11px] text-white/35 leading-relaxed rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-2">
                        {REFUND_POLICY_PRESETS[newShow.refundPolicyType]?.text}
                      </p>
                    )}
                  </div>
                </div>
                {newShow.date && !isNaN(new Date(newShow.date).getTime()) && (
                  <p className="text-[10px] text-white/35 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-orange-400/70" />
                    Se guardará en tu zona horaria: <span className="text-white/55">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span> · {new Date(newShow.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                )}
                <p className="text-[10px] text-white/30 leading-relaxed">
                  Set a price to sell tickets on Boostify with secure payment and QR passes. The platform fee (20% by default, controlled by the admin) is applied automatically; the rest is yours. Leave the price at 0 for a free / listed-only show.
                </p>
                <Button type="button" onClick={handleAddShow} disabled={isAddingShow}
                  className="w-full h-9 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium rounded-xl shadow-lg shadow-orange-500/15">
                  {isAddingShow ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Adding...</> : <><Plus className="mr-2 h-3.5 w-3.5" />Add Show</>}
                </Button>
              </div>

              {/* Shows List */}
              {shows.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">Scheduled Shows ({shows.length})</p>
                  {shows.map((show) => {
                    const showDate = new Date(show.date);
                    const validDate = !isNaN(showDate.getTime());
                    const priced = (show.priceUsd ?? 0) > 0;
                    return (
                      <div key={show.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.12] transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-white truncate">{show.venue}</p>
                            {show.status && show.status !== 'published' && (
                              <span className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/40 border border-white/[0.08] flex-shrink-0">{show.status}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-white/40 mt-0.5">
                            {validDate
                              ? `${showDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} · ${showDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
                              : 'Date TBA'}
                          </p>
                          <p className="text-[11px] text-white/25">{show.location}</p>
                          {priced ? (
                            <p className="text-[11px] text-emerald-300/80 mt-0.5 flex items-center gap-1.5">
                              <Ticket className="h-3 w-3" />${(show.priceUsd ?? 0).toFixed(2)}
                              <span className="text-white/30">· {show.ticketsSold ?? 0} sold{show.capacity ? ` / ${show.capacity}` : ''}</span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-white/20 mt-0.5">Free / listed</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {show.ticketUrl && (
                            <a href={show.ticketUrl} target="_blank" rel="noopener noreferrer"
                              className="h-7 w-7 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteShow(show.id)}
                            className="h-7 w-7 p-0 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-white/25">
                  <Calendar className="w-9 h-9 mx-auto mb-2.5 opacity-30" />
                  <p className="text-sm font-medium">No shows scheduled yet</p>
                  <p className="text-[11px] mt-1">Add your first show above</p>
                </div>
              )}

            </div>
          )}

          {/* ═══════════════ TOOLS TAB ═══════════════ */}
          {activeTab === 'tools' && (
            <div className="space-y-4">

              {/* Sponsor Acquisition */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">🎯 Sponsor Acquisition</p>
                    <p className="text-[11px] text-white/35 mt-0.5">Find brands, send proposals, and close sponsorship deals</p>
                  </div>
                  {!isAdmin && subscription && (subscription.plan === 'free' || !subscription.plan) && (
                    <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-500/30 flex-shrink-0">
                      <Lock className="h-3 w-3 mr-1" />PRO
                    </Badge>
                  )}
                </div>
                {isAdmin || (subscription && subscription.plan && subscription.plan !== 'free') ? (
                  <SponsorPanel artistId={artistId} artistName={currentData.displayName} />
                ) : (
                  <div className="p-3 bg-orange-500/5 border border-orange-500/15 rounded-xl flex items-start gap-2.5">
                    <Lock className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-white/45">Upgrade to PRO to find brands, send professional proposals, and manage sponsorship deals.</p>
                  </div>
                )}
              </div>

              {/* Venue Booking */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">🎤 Venue Booking</p>
                    <p className="text-[11px] text-white/35 mt-0.5">Find venues, send booking proposals, manage live shows</p>
                  </div>
                  {!isAdmin && subscription && (subscription.plan === 'free' || !subscription.plan) && (
                    <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-500/30 flex-shrink-0">
                      <Lock className="h-3 w-3 mr-1" />PRO
                    </Badge>
                  )}
                </div>
                {isAdmin || (subscription && subscription.plan && subscription.plan !== 'free') ? (
                  <VenueBookingPanel artistId={artistId} artistName={currentData.displayName} />
                ) : (
                  <div className="p-3 bg-orange-500/5 border border-orange-500/15 rounded-xl flex items-start gap-2.5">
                    <Lock className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-white/45">Upgrade to PRO to search venues, send live show proposals, and manage booking deals.</p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* ── FOOTER ──────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-3.5 border-t border-white/[0.06] bg-[#0d0d14] flex items-center gap-2.5">
          <Button variant="outline" onClick={() => setIsOpen(false)}
            className="flex-1 sm:flex-none sm:min-w-[7rem] h-10 rounded-xl border-white/12 bg-transparent text-white/55 hover:bg-white/[0.07] hover:text-white">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.displayName}
            className="flex-1 sm:flex-none sm:min-w-[9rem] h-10 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-orange-500/20">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

