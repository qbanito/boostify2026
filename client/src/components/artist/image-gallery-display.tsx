import { useState, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { db, storage } from "../../firebase";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, arrayUnion, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, Download, Trash2, RotateCw, Upload, Plus, ChevronLeft, ChevronRight, Maximize2, X, ZoomIn, Grid3X3 } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
  isVideo?: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
}

interface ImageGallery {
  id: string;
  userId: string;
  singleName: string;
  artistName: string;
  basePrompt: string;
  styleInstructions: string;
  referenceImageUrls: string[];
  generatedImages: GeneratedImage[];
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
}

interface ImageGalleryDisplayProps {
  artistId: string | number;
  pgId?: string | number;
  isOwner?: boolean;
  refreshKey?: number;
  /** Primary accent color (hex). Defaults to violet. */
  accentColor?: string;
  /** Optional secondary color used for gradient ends. Defaults to fuchsia. */
  secondaryColor?: string;
  /** When true the inner header (counts + view toggle + upload) is hidden because the parent already renders one. */
  hideHeader?: boolean;
}

export function ImageGalleryDisplay({ artistId, pgId, isOwner = false, refreshKey = 0, accentColor = '#A78BFA', secondaryColor = '#E879F9', hideHeader = false }: ImageGalleryDisplayProps) {
  // Pre-compute color helpers so the gallery follows the artist's palette
  // instead of always being violet/fuchsia.
  const accent = accentColor;
  const secondary = secondaryColor;
  const accentSoft = `${accent}33`; // ~20% alpha
  const accentFaint = `${accent}1a`; // ~10% alpha
  const accentRing = `${accent}80`; // ~50% alpha
  const gradientHeader = `linear-gradient(135deg, ${accent}, ${secondary})`;
  const gradientSoft = `linear-gradient(135deg, ${accent}33, ${secondary}33)`;
  const [galleries, setGalleries] = useState<ImageGallery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showAddToGalleryDialog, setShowAddToGalleryDialog] = useState(false);
  const [selectedGalleryToAddImages, setSelectedGalleryToAddImages] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryToDelete, setGalleryToDelete] = useState<string | null>(null);
  const [imageToDelete, setImageToDelete] = useState<{ galleryId: string; imageId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [viewMode, setViewMode] = useState<'carousel' | 'grid'>('carousel');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFilesInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Consistent userId: always use String for Firestore matching
  const consistentUserId = String(pgId || artistId);

  useEffect(() => {
    logger.info('🖼️ ImageGalleryDisplay montado para artistId:', consistentUserId, 'refreshKey:', refreshKey);
    loadGalleries();
  }, [artistId, pgId, refreshKey]);

  // Auto-rotación de imágenes cada 5 segundos
  useEffect(() => {
    if (galleries.length === 0 || isPaused || viewMode === 'grid') return;

    const allImages = galleries.flatMap(g => g.generatedImages);
    if (allImages.length === 0) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [galleries, isPaused, viewMode]);

  const loadGalleries = async () => {
    try {
      setIsLoading(true);
      logger.info('📥 Cargando galerías para userId:', consistentUserId);
      
      const galleriesRef = collection(db, "image_galleries");

      // Build all possible userId values to search (handles legacy data saved with different ID formats)
      const possibleIds = new Set<string | number>();
      possibleIds.add(consistentUserId); // String version of pgId || artistId
      possibleIds.add(String(artistId)); // String version of raw artistId
      if (pgId !== undefined && pgId !== null) {
        possibleIds.add(String(pgId));
        // Also try numeric pgId (Firestore distinguishes types)
        const numPgId = Number(pgId);
        if (!isNaN(numPgId)) possibleIds.add(numPgId);
      }
      // Also try numeric artistId
      const numArtistId = Number(artistId);
      if (!isNaN(numArtistId)) possibleIds.add(numArtistId);

      const allDocs = new Map<string, any>();
      
      for (const uid of possibleIds) {
        const q = query(galleriesRef, where("userId", "==", uid));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(d => {
          if (!allDocs.has(d.id)) {
            allDocs.set(d.id, { id: d.id, ...d.data() } as ImageGallery);
          }
        });
      }
      
      const galleriesData = Array.from(allDocs.values()) as ImageGallery[];
      logger.info('📊 Documentos encontrados:', galleriesData.length);
      
      galleriesData.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      logger.info('✅ Galerías cargadas:', galleriesData.length);
      setGalleries(galleriesData);
    } catch (error) {
      logger.error("❌ Error loading galleries:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las galerías",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      logger.error("Error downloading image:", error);
      toast({
        title: "Error",
        description: "No se pudo descargar la imagen",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadImages = async () => {
    if (!galleryTitle.trim()) {
      toast({
        title: "Error",
        description: "Por favor proporciona un título para la galería",
        variant: "destructive",
      });
      return;
    }

    if (uploadedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Por favor selecciona al menos una imagen",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const uploadedImages: GeneratedImage[] = [];
      
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const storagePath = `image_galleries/${consistentUserId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        
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
        userId: consistentUserId,
        singleName: galleryTitle,
        artistName: galleryTitle,
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

      setShowUploadDialog(false);
      setGalleryTitle('');
      setUploadedFiles([]);
      loadGalleries();
    } catch (error) {
      logger.error("Error uploading images:", error);
      toast({
        title: "Error al subir",
        description: "No se pudieron subir las imágenes. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteGallery = async () => {
    if (!galleryToDelete) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "image_galleries", galleryToDelete));
      
      toast({
        title: "Galería eliminada",
        description: "La galería ha sido eliminada exitosamente.",
      });

      setGalleryToDelete(null);
      loadGalleries();
    } catch (error) {
      logger.error("Error deleting gallery:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la galería. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!imageToDelete) return;
    
    try {
      setIsDeleting(true);
      const { galleryId, imageId } = imageToDelete;
      
      // Obtener la galería actual
      const gallery = galleries.find(g => g.id === galleryId);
      if (!gallery) {
        throw new Error("Galería no encontrada");
      }
      
      // Filtrar la imagen a eliminar
      const updatedImages = gallery.generatedImages.filter(img => img.id !== imageId);
      
      // Si no quedan imágenes, eliminar toda la galería
      if (updatedImages.length === 0) {
        await deleteDoc(doc(db, "image_galleries", galleryId));
        toast({
          title: "Galería eliminada",
          description: "Se eliminó la última imagen, por lo que se eliminó toda la galería",
        });
      } else {
        // Actualizar la galería con las imágenes restantes
        await updateDoc(doc(db, "image_galleries", galleryId), {
          generatedImages: updatedImages,
          updatedAt: new Date().toISOString()
        });
        
        toast({
          title: "Imagen eliminada",
          description: "La imagen ha sido eliminada correctamente",
        });
      }
      
      setImageToDelete(null);
      await loadGalleries();
    } catch (error) {
      logger.error("Error deleting image:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la imagen",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddImagesToGallery = async () => {
    if (!selectedGalleryToAddImages || additionalFiles.length === 0) {
      toast({
        title: "Error",
        description: "Por favor selecciona al menos una imagen",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      const gallery = galleries.find(g => g.id === selectedGalleryToAddImages);
      if (!gallery) {
        throw new Error("Galería no encontrada");
      }

      // Subir imágenes a Cloudinary
      const uploadedImages: GeneratedImage[] = [];
      for (const file of additionalFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'boostify_preset');
        
        const response = await fetch(
          'https://api.cloudinary.com/v1_1/dq3chxk1v/image/upload',
          { method: 'POST', body: formData }
        );
        
        const data = await response.json();
        uploadedImages.push({
          id: crypto.randomUUID(),
          url: data.secure_url,
          prompt: `Agregado a ${gallery.singleName}`,
          createdAt: new Date().toISOString(),
        });
      }

      // Actualizar la galería con las nuevas imágenes
      const updatedImages = [...gallery.generatedImages, ...uploadedImages];
      await updateDoc(doc(db, "image_galleries", selectedGalleryToAddImages), {
        generatedImages: updatedImages,
        updatedAt: new Date().toISOString()
      });

      toast({
        title: "¡Imágenes agregadas!",
        description: `Se han agregado ${uploadedImages.length} imágenes a la galería.`,
      });

      setShowAddToGalleryDialog(false);
      setAdditionalFiles([]);
      setSelectedGalleryToAddImages(null);
      await loadGalleries();
    } catch (error) {
      logger.error("Error adding images to gallery:", error);
      toast({
        title: "Error al agregar",
        description: "No se pudieron agregar las imágenes. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAdditionalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAdditionalFiles(files);
  };

  const allImages = galleries.flatMap(g => g.generatedImages.map(img => ({
    ...img,
    galleryName: g.singleName,
    galleryId: g.id
  })));

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 10000);
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 10000);
  };

  // Lightbox helpers (index-based, enables prev/next + keyboard nav)
  const lightboxImage = selectedIndex !== null ? allImages[selectedIndex] : null;
  const goLightboxPrev = () => setSelectedIndex(i => (i === null ? i : (i - 1 + allImages.length) % allImages.length));
  const goLightboxNext = () => setSelectedIndex(i => (i === null ? i : (i + 1) % allImages.length));

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goLightboxPrev();
      else if (e.key === 'ArrowRight') goLightboxNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndex === null, allImages.length]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (galleries.length === 0 && !isOwner) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* ========== TOOLBAR (slim, no duplicated title) ========== */}
      {!hideHeader && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-white/60">
            {allImages.length > 0 ? (
              <>
                <span className="font-semibold" style={{ color: accent }}>{allImages.length}</span> imagen{allImages.length !== 1 ? 'es' : ''}
                <span className="mx-1.5 opacity-50">·</span>
                <span className="font-semibold" style={{ color: accent }}>{galleries.length}</span> galería{galleries.length !== 1 ? 's' : ''}
              </>
            ) : (
              <span>Sin imágenes todavía</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {allImages.length > 0 && (
              <div
                className="flex items-center rounded-lg p-0.5"
                style={{ backgroundColor: accentFaint, border: `1px solid ${accentSoft}` }}
              >
                <button
                  onClick={() => setViewMode('carousel')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'carousel' ? 'shadow-sm' : 'opacity-60 hover:opacity-100'}`}
                  style={viewMode === 'carousel' ? { backgroundColor: accent, color: '#fff' } : { color: accent, background: 'transparent' }}
                  aria-label="Vista carrusel"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'shadow-sm' : 'opacity-60 hover:opacity-100'}`}
                  style={viewMode === 'grid' ? { backgroundColor: accent, color: '#fff' } : { color: accent, background: 'transparent' }}
                  aria-label="Vista cuadrícula"
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {isOwner && (
              <Button
                onClick={() => setShowUploadDialog(true)}
                size="sm"
                className="text-white border-0 shadow-md hover:opacity-90 transition-opacity"
                style={{ background: gradientHeader, boxShadow: `0 4px 14px -4px ${accent}80` }}
                data-testid="button-upload-images-header"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Nueva Galería
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ========== EMPTY STATE ========== */}
      {galleries.length === 0 && isOwner && (
        <div
          className="relative overflow-hidden rounded-3xl border border-dashed p-10 sm:p-12 text-center"
          style={{
            borderColor: accentSoft,
            background: `radial-gradient(circle at 30% 20%, ${accent}20 0%, transparent 60%), radial-gradient(circle at 80% 80%, ${secondary}18 0%, transparent 55%)`,
          }}
        >
          <div className="relative">
            <motion.div
              className="mx-auto h-20 w-20 rounded-2xl flex items-center justify-center mb-6"
              style={{ background: gradientSoft, boxShadow: `0 8px 24px -8px ${accent}50` }}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ImageIcon className="h-10 w-10" style={{ color: accent }} />
            </motion.div>
            <h4 className="text-lg font-semibold mb-2 text-white">Tu galería está vacía</h4>
            <p className="text-white/60 mb-6 max-w-md mx-auto text-sm">
              Sube tus mejores fotos, artwork y contenido visual para mostrar a tus fans
            </p>
            <Button
              onClick={() => setShowUploadDialog(true)}
              className="text-white px-8 border-0 hover:opacity-90 transition-opacity"
              style={{ background: gradientHeader, boxShadow: `0 8px 24px -6px ${accent}70` }}
              data-testid="button-create-first-gallery"
            >
              <Upload className="h-4 w-4 mr-2" />
              Crear Primera Galería
            </Button>
          </div>
        </div>
      )}

      {/* ========== CAROUSEL VIEW ========== */}
      {allImages.length > 0 && viewMode === 'carousel' && (
        <div className="space-y-4">
          {/* Main featured image */}
          <div className="relative rounded-3xl overflow-hidden group cursor-pointer"
               style={{
                 aspectRatio: '16/9',
                 border: `1px solid ${accent}33`,
                 boxShadow: `0 24px 60px -24px ${accent}66, 0 8px 24px -12px rgba(0,0,0,0.6)`,
               }}
               onClick={() => setSelectedIndex(currentImageIndex)}
          >
            {/* Background blur effect */}
            <div className="absolute inset-0 scale-110 blur-3xl opacity-60">
              <img
                src={allImages[currentImageIndex]?.url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            {/* Subtle vignette to make the photo pop */}
            <div
              className="absolute inset-0 pointer-events-none z-[1]"
              style={{ background: 'radial-gradient(circle at 50% 45%, transparent 55%, rgba(0,0,0,0.45) 100%)' }}
            />

            {/* Main image with crossfade + slow Ken Burns zoom */}
            <div className="absolute inset-0 flex items-center justify-center">
              {allImages.map((image, index) => (
                <motion.img
                  key={image.id}
                  src={image.url}
                  alt={image.galleryName}
                  className="absolute max-w-full max-h-full object-contain"
                  initial={false}
                  animate={index === currentImageIndex
                    ? { opacity: 1, scale: 1.06 }
                    : { opacity: 0, scale: 1 }}
                  transition={{
                    opacity: { duration: 0.8, ease: 'easeOut' },
                    scale: index === currentImageIndex
                      ? { duration: 7, ease: 'linear' }
                      : { duration: 0.4 },
                  }}
                />
              ))}
            </div>

            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex items-center justify-between z-10">
              <Badge
                className="backdrop-blur-xl bg-black/50 text-white font-medium px-3 py-1 border"
                style={{ borderColor: accentSoft }}
              >
                <ImageIcon className="h-3.5 w-3.5 mr-1.5" style={{ color: accent }} />
                {currentImageIndex + 1} / {allImages.length}
              </Badge>
              {isOwner && (
                <Button
                  onClick={(e) => { e.stopPropagation(); setShowUploadDialog(true); }}
                  size="sm"
                  className="backdrop-blur-xl bg-white/20 hover:bg-white/30 text-white border border-white/20 shadow-lg"
                  data-testid="button-upload-images"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Subir
                </Button>
              )}
            </div>

            {/* Bottom info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 z-10 pointer-events-none">
              <p className="text-white/90 text-sm font-medium mb-3 line-clamp-1">
                {allImages[currentImageIndex]?.galleryName}
              </p>
              {/* Progress bar */}
              <div className="flex gap-1.5">
                {allImages.length <= 20 ? allImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(index);
                      setIsPaused(true);
                      setTimeout(() => setIsPaused(false), 10000);
                    }}
                    className={`h-1 rounded-full transition-all duration-500 pointer-events-auto ${
                      index === currentImageIndex
                        ? 'flex-[3]'
                        : index < currentImageIndex
                          ? 'flex-1 bg-white/50'
                          : 'flex-1 bg-white/25'
                    }`}
                    style={index === currentImageIndex ? { background: accent, boxShadow: `0 0 10px ${accent}aa` } : undefined}
                    aria-label={`Ir a imagen ${index + 1}`}
                  />
                )) : (
                  <div className="w-full bg-white/20 rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${((currentImageIndex + 1) / allImages.length) * 100}%`, background: accent, boxShadow: `0 0 10px ${accent}aa` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Navigation arrows */}
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-12 w-12 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 shadow-lg"
              aria-label="Anterior"
              data-testid="button-prev-image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-12 w-12 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 shadow-lg"
              aria-label="Siguiente"
              data-testid="button-next-image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>

            {/* Zoom hint */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              <div className="backdrop-blur-xl bg-black/40 rounded-full p-3">
                <ZoomIn className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          {/* Thumbnail strip */}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent">
              {allImages.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => {
                    setCurrentImageIndex(index);
                    setIsPaused(true);
                    setTimeout(() => setIsPaused(false), 10000);
                  }}
                  className={`relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden transition-all duration-300 ${
                    index === currentImageIndex
                      ? 'scale-105'
                      : 'opacity-60 hover:opacity-100 hover:scale-105'
                  }`}
                  style={
                    index === currentImageIndex
                      ? { boxShadow: `0 0 0 2px ${accent}, 0 8px 20px -6px ${accent}80` }
                      : undefined
                  }
                >
                  <img
                    src={image.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Quick action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => setSelectedIndex(currentImageIndex)}
              variant="outline"
              size="sm"
              className="rounded-xl"
              data-testid="button-view-full"
            >
              <Maximize2 className="h-4 w-4 mr-1.5" />
              Ver Completa
            </Button>
            <Button
              onClick={() => downloadImage(
                allImages[currentImageIndex]?.url,
                `${allImages[currentImageIndex]?.galleryName}-${currentImageIndex + 1}.jpg`
              )}
              variant="outline"
              size="sm"
              className="rounded-xl"
              data-testid="button-download-current"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Descargar
            </Button>
          </div>
        </div>
      )}

      {/* ========== GRID VIEW ========== */}
      {allImages.length > 0 && viewMode === 'grid' && (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
          {allImages.map((image, index) => (
            <motion.div
              key={image.id}
              className="relative group cursor-pointer break-inside-avoid rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 4px 16px -6px rgba(0,0,0,0.5)' }}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: (index % 8) * 0.05, ease: [0.21, 0.65, 0.36, 1] }}
              whileHover={{ y: -4 }}
              onClick={() => setSelectedIndex(index)}
            >
              <img
                src={image.url}
                alt={image.galleryName}
                className="w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                loading="lazy"
              />
              {/* Accent edge glow on hover */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ boxShadow: `inset 0 0 0 1.5px ${accentRing}, 0 8px 30px -8px ${accent}60` }}
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  <p className="text-white text-xs font-medium truncate mb-2">{image.galleryName}</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadImage(image.url, `${image.galleryName}-${index + 1}.jpg`);
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/30 backdrop-blur-md text-white transition-colors"
                      aria-label="Descargar"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIndex(index);
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/30 backdrop-blur-md text-white transition-colors"
                      aria-label="Ampliar"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                    {isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageToDelete({ galleryId: image.galleryId, imageId: image.id });
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-red-500/60 hover:bg-red-500/80 backdrop-blur-md text-white transition-colors ml-auto"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ========== OWNER GALLERY MANAGEMENT ========== */}
      {isOwner && galleries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${accent}40)` }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>Gestionar Galerías</span>
            <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${accent}40, transparent)` }} />
          </div>

          <div className="grid gap-3">
            {galleries.map((gallery) => (
              <div
                key={gallery.id}
                className="rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${accentSoft}`, background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(8px)' }}
                data-testid={`gallery-${gallery.id}`}
              >
                <div
                  className="flex items-center justify-between p-3 sm:p-4"
                  style={{ borderBottom: `1px solid ${accentFaint}`, background: `linear-gradient(90deg, ${accent}10, transparent)` }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: gradientSoft }}
                    >
                      <ImageIcon className="h-4 w-4" style={{ color: accent }} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-white truncate">{gallery.singleName}</h4>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <span>{gallery.generatedImages.length} imagen{gallery.generatedImages.length !== 1 ? 'es' : ''}</span>
                        <span>·</span>
                        <span>{new Date(gallery.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      style={{ color: accent }}
                      onClick={() => {
                        setSelectedGalleryToAddImages(gallery.id);
                        setShowAddToGalleryDialog(true);
                      }}
                      data-testid={`button-add-images-${gallery.id}`}
                      title="Agregar más imágenes"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-red-400/80"
                      onClick={() => setGalleryToDelete(gallery.id)}
                      data-testid={`button-delete-gallery-${gallery.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {gallery.generatedImages.map((image, index) => (
                      <div
                        key={image.id}
                        className="relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
                        style={{ boxShadow: `0 0 0 1px ${accentFaint}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 0 2px ${accentRing}`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 0 0 1px ${accentFaint}`; }}
                        onClick={() => {
                          const globalIdx = allImages.findIndex(ai => ai.id === image.id);
                          if (globalIdx >= 0) setSelectedIndex(globalIdx);
                        }}
                        data-testid={`image-${gallery.id}-${index}`}
                      >
                        <img
                          src={image.url}
                          alt={`${gallery.singleName} - ${index + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <button
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadImage(image.url, `${gallery.singleName}-${index + 1}.jpg`);
                            }}
                            data-testid={`button-download-${index}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-500/60 text-white hover:bg-red-500/80 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageToDelete({ galleryId: gallery.id, imageId: image.id });
                            }}
                            data-testid={`button-delete-image-${index}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diálogo para subir imágenes */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: gradientHeader }}>
                <Upload className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg">Nueva Galería</DialogTitle>
                <DialogDescription className="text-xs">
                  Sube imágenes desde tu dispositivo
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="gallery-title" className="text-sm font-medium">Título de la Galería</Label>
              <Input
                id="gallery-title"
                value={galleryTitle}
                onChange={(e) => setGalleryTitle(e.target.value)}
                placeholder="Ej: Fotos de Concierto 2024"
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Imágenes</Label>
              <div
                className="border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer"
                style={{
                  borderColor: isDragOver ? accent : accentSoft,
                  background: isDragOver ? `${accent}1f` : accentFaint,
                  transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                  if (files.length) setUploadedFiles(prev => [...prev, ...files]);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: gradientSoft }}
                >
                  <Upload className="h-7 w-7" style={{ color: accent }} />
                </div>
                <p className="text-sm font-medium mb-1">{isDragOver ? '¡Suelta tus imágenes!' : 'Arrastra o haz clic para seleccionar'}</p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, GIF, WEBP
                </p>
              </div>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{uploadedFiles.length} imagen{uploadedFiles.length !== 1 ? 'es' : ''} seleccionada{uploadedFiles.length !== 1 ? 's' : ''}</Label>
                  <button
                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                    onClick={() => setUploadedFiles([])}
                  >
                    Limpiar todo
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto rounded-xl">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="relative group rounded-xl overflow-hidden ring-1 ring-border"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          className="h-8 w-8 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowUploadDialog(false);
                setGalleryTitle('');
                setUploadedFiles([]);
              }}
              disabled={isUploading}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUploadImages}
              disabled={isUploading || uploadedFiles.length === 0 || !galleryTitle.trim()}
              className="rounded-xl text-white border-0 px-6 hover:opacity-90 transition-opacity"
              style={{ background: gradientHeader, boxShadow: `0 4px 14px -4px ${accent}80` }}
            >
              {isUploading ? (
                <>
                  <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Crear Galería
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para agregar imágenes a galería existente */}
      <Dialog open={showAddToGalleryDialog} onOpenChange={setShowAddToGalleryDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Imágenes a la Galería</DialogTitle>
            <DialogDescription>
              {selectedGalleryToAddImages && 
                `Agrega más imágenes a "${galleries.find(g => g.id === selectedGalleryToAddImages)?.singleName}"`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Seleccionar Imágenes</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  ref={additionalFilesInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAdditionalFileSelect}
                  className="hidden"
                />
                <Upload className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground mb-3">
                  Arrastra imágenes aquí o haz clic para seleccionar
                </p>
                <Button
                  variant="outline"
                  onClick={() => additionalFilesInputRef.current?.click()}
                  type="button"
                >
                  Seleccionar Archivos
                </Button>
              </div>
            </div>

            {additionalFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Imágenes seleccionadas ({additionalFiles.length})</Label>
                <div className="grid grid-cols-3 gap-3">
                  {additionalFiles.map((file, index) => (
                    <div
                      key={index}
                      className="relative group rounded-lg border overflow-hidden"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setAdditionalFiles(additionalFiles.filter((_, i) => i !== index));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                        <p className="text-xs text-white truncate">{file.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddToGalleryDialog(false);
                setAdditionalFiles([]);
                setSelectedGalleryToAddImages(null);
              }}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddImagesToGallery}
              disabled={isUploading || additionalFiles.length === 0}
            >
              {isUploading ? 'Agregando...' : `Agregar ${additionalFiles.length} imagen${additionalFiles.length !== 1 ? 'es' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox — full image viewer with navigation */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-6xl p-0 overflow-hidden rounded-2xl border-0 bg-black/95">
          <DialogHeader className="sr-only">
            <DialogTitle>Imagen</DialogTitle>
          </DialogHeader>
          {lightboxImage && (
            <div className="relative">
              {/* Ambient blurred backdrop */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <img src={lightboxImage.url} alt="" className="w-full h-full object-cover scale-125 blur-3xl opacity-30" />
                <div className="absolute inset-0 bg-black/60" />
              </div>

              {/* Top bar */}
              <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
                <Badge
                  className="backdrop-blur-xl bg-black/50 text-white font-medium px-3 py-1 border"
                  style={{ borderColor: accentSoft }}
                >
                  {(selectedIndex ?? 0) + 1} / {allImages.length}
                  {lightboxImage.galleryName && (
                    <span className="ml-2 opacity-60 font-normal hidden sm:inline">· {lightboxImage.galleryName}</span>
                  )}
                </Badge>
                <button
                  onClick={() => setSelectedIndex(null)}
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-xl transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Image with crossfade */}
              <div className="relative flex items-center justify-center min-h-[50vh] max-h-[85vh] p-4 sm:p-8">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={lightboxImage.id}
                    src={lightboxImage.url}
                    alt={lightboxImage.galleryName || 'Imagen'}
                    className="max-w-full max-h-[78vh] object-contain rounded-xl relative z-10"
                    style={{ boxShadow: `0 24px 80px -20px ${accent}50` }}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  />
                </AnimatePresence>
              </div>

              {/* Prev / Next */}
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); goLightboxPrev(); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-30 h-11 w-11 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-xl transition-all hover:scale-105"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); goLightboxNext(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-30 h-11 w-11 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-xl transition-all hover:scale-105"
                    aria-label="Siguiente"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}

              {/* Bottom bar */}
              <div className="absolute bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between gap-3">
                  {lightboxImage.prompt && lightboxImage.prompt !== 'N/A' ? (
                    <p className="text-white/70 text-xs truncate flex-1">{lightboxImage.prompt}</p>
                  ) : <span className="flex-1" />}
                  <Button
                    onClick={() => downloadImage(lightboxImage.url, `${lightboxImage.galleryName || 'boostify'}-${(selectedIndex ?? 0) + 1}.jpg`)}
                    size="sm"
                    className="rounded-xl text-white border-0 flex-shrink-0 hover:opacity-90 transition-opacity"
                    style={{ background: gradientHeader, boxShadow: `0 4px 14px -4px ${accent}80` }}
                    data-testid="button-download-full"
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    Descargar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar galería */}
      <AlertDialog open={!!galleryToDelete} onOpenChange={() => setGalleryToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center mb-2">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>
            <AlertDialogTitle className="text-center">¿Eliminar galería?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Esta acción no se puede deshacer. Se eliminará permanentemente esta galería y todas sus imágenes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGallery}
              disabled={isDeleting}
              className="bg-red-500 text-white hover:bg-red-600 rounded-xl"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar galería'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación para eliminar imagen individual */}
      <AlertDialog open={!!imageToDelete} onOpenChange={() => setImageToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center mb-2">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>
            <AlertDialogTitle className="text-center">¿Eliminar imagen?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Esta acción no se puede deshacer.
              {imageToDelete && galleries.find(g => g.id === imageToDelete.galleryId)?.generatedImages.length === 1 && (
                <span className="block mt-2 font-semibold text-amber-600">
                  Esta es la última imagen. Al eliminarla, se eliminará toda la galería.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteImage}
              className="bg-red-500 text-white hover:bg-red-600 rounded-xl"
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar imagen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
