import { useState, useRef } from "react";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { Loader2, Image as ImageIcon, Upload, X, Sparkles } from "lucide-react";
import { db, storage } from "../../firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Card } from "../ui/card";

interface ImageGalleryGeneratorProps {
  artistId: string;
  artistName: string;
  onGalleryCreated?: () => void;
}

export function ImageGalleryGenerator({ 
  artistId, 
  artistName,
  onGalleryCreated 
}: ImageGalleryGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [singleName, setSingleName] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [styleInstructions, setStyleInstructions] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Máximo 3 imágenes de referencia
    if (referenceImages.length + files.length > 3) {
      toast({
        title: "Límite de imágenes",
        description: "Puedes subir máximo 3 imágenes de referencia.",
        variant: "destructive",
      });
      return;
    }

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push(reader.result as string);
        if (newImages.length === files.length) {
          setReferenceImages([...referenceImages, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(referenceImages.filter((_, i) => i !== index));
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
    const storageRef = ref(storage, `reference-images/${artistId}/${fileName}`);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    
    logger.info('☁️ Imagen de referencia subida a Storage:', downloadURL);
    return downloadURL;
  };

  const handleGenerateGallery = async () => {
    if (!singleName.trim()) {
      toast({
        title: "Campo requerido",
        description: "Por favor ingresa el nombre del sencillo.",
        variant: "destructive",
      });
      return;
    }

    if (referenceImages.length === 0) {
      toast({
        title: "Imágenes requeridas",
        description: "Sube al menos 1 imagen de referencia del artista.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGenerationStatus("Generando 6 imágenes profesionales con IA... (esto puede tardar 2-3 minutos)");
    
    try {
      // NO subir a Firebase Storage - enviar directamente en base64
      logger.info('🎨 Iniciando generación de galería con imágenes en base64...');
      logger.info('📸 Número de imágenes de referencia:', referenceImages.length);
      
      // Crear AbortController con timeout de 10 minutos (600 segundos)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);
      
      try {
        const response = await fetch('/api/image-gallery/create-and-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            singleName,
            artistName,
            basePrompt: basePrompt || `Professional promotional photos of ${artistName} for "${singleName}"`,
            styleInstructions: styleInstructions || "Modern, high-quality, professional artist photography with creative lighting and composition",
            referenceImages: referenceImages // Enviar base64 directamente
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        logger.info('✅ Respuesta del servidor:', data);

        if (!data.success) {
          throw new Error(data.error || 'Error al generar galería');
        }

        logger.info('✅ Galería generada con éxito:', data.gallery.generatedImages.length, 'imágenes');
        
        // Primero: Subir imágenes de referencia a Firebase Storage
        setGenerationStatus("Subiendo imágenes de referencia a Firebase Storage...");
        const uploadedReferenceUrls: string[] = [];
        
        for (let i = 0; i < referenceImages.length; i++) {
          try {
            logger.info(`📤 Subiendo imagen de referencia ${i + 1}/${referenceImages.length} a Storage...`);
            const url = await uploadBase64ToStorage(
              referenceImages[i],
              `ref-${Date.now()}-${i}.jpg`
            );
            uploadedReferenceUrls.push(url);
            logger.info(`✅ Imagen de referencia ${i + 1} subida: ${url}`);
          } catch (uploadError: any) {
            logger.error(`❌ Error subiendo imagen de referencia ${i + 1}:`, uploadError);
            throw new Error(`No se pudo subir la imagen de referencia ${i + 1}`);
          }
        }
        
        // Segundo: Subir las imágenes generadas (data URLs) a Firebase Storage
        setGenerationStatus("Subiendo imágenes generadas a Firebase Storage...");
        const uploadedImageUrls: string[] = [];
        
        for (let i = 0; i < data.gallery.generatedImages.length; i++) {
          const img = data.gallery.generatedImages[i];
          try {
            logger.info(`📤 Subiendo imagen generada ${i + 1}/${data.gallery.generatedImages.length} a Storage...`);
            
            const imagePath = `galleries/${artistId}/${Date.now()}-gen-${i}.jpg`;
            const imageRef = ref(storage, imagePath);
            
            // Convertir data URL a blob
            const base64Data = img.url.split(',')[1];
            const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(r => r.blob());
            
            await uploadBytes(imageRef, blob);
            const url = await getDownloadURL(imageRef);
            
            uploadedImageUrls.push(url);
            logger.info(`✅ Imagen generada ${i + 1} subida: ${url}`);
          } catch (uploadError: any) {
            logger.error(`❌ Error subiendo imagen generada ${i + 1}:`, uploadError);
            // Si falla, usar la data URL original como fallback
            uploadedImageUrls.push(img.url);
          }
        }

        // Guardar la galería en Firestore con las URLs de Storage
        try {
          logger.info('🔍 [DEBUG] Iniciando guardado en Firestore');
          logger.info('🔍 [DEBUG] DB config:', db);
          
          const galleryRef = doc(collection(db, "image_galleries"));
          logger.info('✅ [DEBUG] Referencia creada con ID:', galleryRef.id);
          
          // Actualizar las URLs en las imágenes generadas
          const generatedImagesWithUrls = data.gallery.generatedImages.map((img: any, index: number) => ({
            ...img,
            url: uploadedImageUrls[index]
          }));
          
          const galleryData = {
            id: galleryRef.id,
            userId: artistId,
            singleName,
            artistName,
            basePrompt: basePrompt || `Professional promotional photos of ${artistName} for "${singleName}"`,
            styleInstructions: styleInstructions || "Modern, high-quality, professional artist photography with creative lighting and composition",
            referenceImageUrls: uploadedReferenceUrls, // URLs de Firebase Storage (no base64)
            generatedImages: generatedImagesWithUrls,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: true
          };
          
          setGenerationStatus("Guardando galería en tu perfil...");
          logger.info('💾 [DEBUG] Guardando en Firestore:', galleryData);
          logger.info('💾 [DEBUG] Collection: image_galleries, Doc ID:', galleryRef.id);
          
          await setDoc(galleryRef, galleryData);
          logger.info('✅ [DEBUG] setDoc completado exitosamente');
          logger.info('✅ Galería guardada en Firestore con ID:', galleryRef.id);
        } catch (firestoreError: any) {
          logger.error('❌ [FIRESTORE ERROR] Error guardando galería:', firestoreError);
          logger.error('❌ [FIRESTORE ERROR] Código:', firestoreError.code);
          logger.error('❌ [FIRESTORE ERROR] Mensaje:', firestoreError.message);
          logger.error('❌ [FIRESTORE ERROR] Stack:', firestoreError.stack);
          throw new Error(`Error al guardar en Firestore: ${firestoreError.message}`);
        }

        toast({
          title: "¡Galería creada!",
          description: data.message || `Se generaron ${data.successCount || 0} imágenes exitosamente`,
        });

        // Limpiar formulario y cerrar
        setSingleName("");
        setBasePrompt("");
        setStyleInstructions("");
        setReferenceImages([]);
        setGenerationStatus("");
        setIsOpen(false);
        
        // Esperar un poco antes de recargar para que Firestore se sincronice
        setTimeout(() => {
          if (onGalleryCreated) {
            logger.info('🔄 Llamando a onGalleryCreated callback');
            onGalleryCreated();
          }
        }, 1000);

      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('La generación tomó demasiado tiempo. Por favor intenta de nuevo.');
        }
        throw fetchError;
      }

    } catch (error: any) {
      logger.error('Error generating gallery:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo generar la galería",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-create-gallery">
          <Sparkles className="h-4 w-4" />
          Crear Galería de Imágenes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Galería de Imágenes</DialogTitle>
          <DialogDescription>
            Genera 6 imágenes profesionales del artista manteniendo su identidad facial
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Nombre del sencillo */}
          <div className="space-y-2">
            <Label htmlFor="singleName">Nombre del Sencillo *</Label>
            <Input
              id="singleName"
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              placeholder="Mi Nuevo Sencillo"
              data-testid="input-single-name"
            />
          </div>

          {/* Imágenes de referencia */}
          <div className="space-y-2">
            <Label>Imágenes de Referencia (1-3) *</Label>
            <p className="text-sm text-muted-foreground">
              Sube 1 a 3 fotos claras del artista para mantener su identidad facial en todas las imágenes generadas.
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              {referenceImages.map((img, index) => (
                <Card key={index} className="relative p-2">
                  <img 
                    src={img} 
                    alt={`Referencia ${index + 1}`} 
                    className="w-full h-32 object-cover rounded"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => removeReferenceImage(index)}
                    data-testid={`button-remove-ref-${index}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Card>
              ))}
              
              {referenceImages.length < 3 && (
                <Card 
                  className="p-2 border-dashed cursor-pointer hover:border-primary transition-colors flex items-center justify-center h-32"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Subir imagen</p>
                  </div>
                </Card>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Prompt base (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="basePrompt">Descripción Base (Opcional)</Label>
            <Textarea
              id="basePrompt"
              value={basePrompt}
              onChange={(e) => setBasePrompt(e.target.value)}
              placeholder={`Professional promotional photos of ${artistName} for "${singleName || 'this single'}"`}
              rows={2}
              data-testid="input-base-prompt"
            />
          </div>

          {/* Instrucciones de estilo (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="styleInstructions">Instrucciones de Estilo (Opcional)</Label>
            <Textarea
              id="styleInstructions"
              value={styleInstructions}
              onChange={(e) => setStyleInstructions(e.target.value)}
              placeholder="Modern, high-quality, professional artist photography..."
              rows={2}
              data-testid="input-style-instructions"
            />
          </div>

          {/* Indicador de progreso */}
          {isGenerating && generationStatus && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-400">{generationStatus}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Por favor espera, este proceso puede tardar 2-3 minutos...
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleGenerateGallery}
            disabled={isGenerating || referenceImages.length === 0 || !singleName.trim()}
            className="w-full gap-2"
            data-testid="button-generate-gallery"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4" />
                Generar Galería (6 Imágenes)
              </>
            )}
          </Button>

          {!isGenerating && (
            <p className="text-xs text-muted-foreground text-center">
              La generación puede tardar 2-3 minutos. Las imágenes mantendrán la identidad facial del artista.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
