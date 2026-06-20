import { useState, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Checkbox } from "../ui/checkbox";
import { Progress } from "../ui/progress";
import { useToast } from "../../hooks/use-toast";
import { User, Loader2, Check, AlertCircle } from "lucide-react";
import { getAuthToken } from "../../lib/auth";

// Tipos para el Face Swap
export interface FaceSwapResult {
  id: string;
  sourceImageUrl: string;
  targetImageUrl: string;
  resultImageUrl: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

interface ShotType {
  id: string;
  name: string;
  description: string;
  selected: boolean;
}

export interface FaceSwapProps {
  videoId?: string;
  onComplete?: (results: FaceSwapResult[], uploadedImage?: string | null) => void;
  isPurchased?: boolean;
  hideVideo?: boolean;
}

/**
 * Componente para la funcionalidad de Face Swap
 * 
 * Este componente permite a los usuarios subir una imagen de su rostro
 * y aplicarla a ciertos planos del video musical generado.
 */
export function FaceSwap({ 
  videoId,
  onComplete,
  isPurchased = false,
  hideVideo = false
}: FaceSwapProps) {
  const [artistImage, setArtistImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<FaceSwapResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shotTypes, setShotTypes] = useState<ShotType[]>([
    { id: 'close-up', name: 'Primer plano', description: 'Rostro del artista', selected: true },
    { id: 'extreme-close-up', name: 'Primerísimo primer plano', description: 'Detalles del rostro', selected: true },
    { id: 'medium-shot', name: 'Plano medio', description: 'De cintura para arriba', selected: false },
  ]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Manejar selección de foto del artista
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validaciones básicas
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecciona un archivo de imagen válido.');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB
      setError('La imagen es demasiado grande. El tamaño máximo es 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setArtistImage(event.target.result);
        setPreviewImage(event.target.result);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Función para iniciar el proceso de Face Swap
  const handleStartFaceSwap = async () => {
    if (!artistImage) {
      setError('Por favor, sube una foto del artista primero.');
      return;
    }

    // Restricción premium temporalmente deshabilitada para pruebas
    /*
    if (!isPurchased) {
      toast({
        title: "Funcionalidad premium",
        description: "Necesitas comprar el video completo para utilizar la función de Face Swap.",
        variant: "destructive"
      });
      return;
    }
    */

    try {
      setIsProcessing(true);
      setProgress(0);
      setError(null);
      
      // Filtrar los tipos de planos seleccionados
      const selectedShotTypes = shotTypes
        .filter(shot => shot.selected)
        .map(shot => shot.id);
      
      if (selectedShotTypes.length === 0) {
        throw new Error('Por favor, selecciona al menos un tipo de plano para aplicar Face Swap.');
      }

      // Simular la llamada a la API y el progreso
      const token = await getAuthToken();
      const totalSteps = 5;
      
      // Paso 1: Procesar la imagen del artista
      setProgress((1 / totalSteps) * 100);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Paso 2: Identificar planos en el video
      setProgress((2 / totalSteps) * 100);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Paso 3: Aplicar Face Swap a los planos seleccionados
      setProgress((3 / totalSteps) * 100);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Paso 4: Procesar resultados
      setProgress((4 / totalSteps) * 100);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Paso 5: Finalizar proceso
      setProgress(100);
      
      // Simular resultados
      const mockResults: FaceSwapResult[] = [
        {
          id: '1',
          sourceImageUrl: artistImage,
          targetImageUrl: 'https://via.placeholder.com/300',
          resultImageUrl: artistImage,
          status: 'completed',
          createdAt: new Date()
        },
        {
          id: '2',
          sourceImageUrl: artistImage,
          targetImageUrl: 'https://via.placeholder.com/300',
          resultImageUrl: artistImage,
          status: 'completed',
          createdAt: new Date()
        }
      ];
      
      setResults(mockResults);
      
      if (onComplete) {
        onComplete(mockResults, artistImage);
      }
      
      toast({
        title: "¡Face Swap completado!",
        description: "Se han aplicado los cambios a los planos seleccionados.",
        variant: "default"
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el Face Swap.');
      toast({
        title: "Error en Face Swap",
        description: err instanceof Error ? err.message : 'Ocurrió un error al procesar la imagen.',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Cambiar estado de selección para un tipo de plano
  const toggleShotType = (id: string) => {
    setShotTypes(prev => 
      prev.map(shot => 
        shot.id === id ? { ...shot, selected: !shot.selected } : shot
      )
    );
  };

  // Borrar imagen
  const handleDeleteImage = () => {
    setArtistImage(null);
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <Label className="text-lg font-semibold mb-4 block">Face Swap con IA</Label>
      <div className="space-y-4">
        {/* Mensaje premium temporalmente deshabilitado para pruebas */}
        {false && !isPurchased && (
          <Alert className="bg-orange-500/10 border-orange-500/50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-600">Función Premium</AlertTitle>
            <AlertDescription className="text-sm text-orange-600">
              Esta función está disponible al comprar el video completo.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Foto del Artista</Label>
          <div className="grid gap-4">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              disabled={isProcessing}
              className=""
            />
            <div className="flex space-x-4">
              <div className={`aspect-square w-32 rounded-lg border-2 ${artistImage ? 'border-solid' : 'border-dashed'} border-muted-foreground/25 flex items-center justify-center overflow-hidden`}>
                {previewImage ? (
                  <img src={previewImage} alt="Artista" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground/25" />
                )}
              </div>
              
              {previewImage && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDeleteImage}
                  disabled={isProcessing}
                >
                  Borrar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Aplicar Face Swap en:</Label>
          <div className="grid gap-2">
            {shotTypes.map((shotType) => (
              <div key={shotType.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`faceswap-${shotType.id}`}
                  checked={shotType.selected}
                  onCheckedChange={() => toggleShotType(shotType.id)}
                  disabled={isProcessing}
                />
                <div className="grid gap-0.5">
                  <Label htmlFor={`faceswap-${shotType.id}`} className="text-sm">
                    {shotType.name}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {shotType.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {isProcessing && (
          <div className="space-y-2">
            <Label className="text-sm">Procesando Face Swap...</Label>
            <Progress value={progress} className="w-full h-2" />
            <p className="text-xs text-muted-foreground">
              Esto puede tardar unos minutos. Por favor, no cierres esta ventana.
            </p>
          </div>
        )}

        <Button 
          onClick={handleStartFaceSwap} 
          disabled={!artistImage || isProcessing} 
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : results.length > 0 ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Face Swap Aplicado
            </>
          ) : (
            <>
              <User className="mr-2 h-4 w-4" />
              Aplicar Face Swap
            </>
          )}
        </Button>

        {results.length > 0 && !hideVideo && (
          <div className="space-y-2">
            <Label className="text-sm">Resultados:</Label>
            <div className="grid grid-cols-2 gap-2">
              {results.map((result) => (
                <div key={result.id} className="border rounded p-2">
                  <img src={result.resultImageUrl} alt="Face Swap Result" className="w-full h-auto rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!results.length && (
          <div className="text-xs text-muted-foreground mt-2">
            <p>Esta función permite:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Subir una foto del artista</li>
              <li>Seleccionar en qué tipos de planos aplicar el Face Swap</li>
              <li>Integrar perfectamente tu imagen en el video</li>
              <li>Mantener la calidad y coherencia visual</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// API de servicio para Face Swap
export const faceSwapService = {
  /**
   * Iniciar el proceso de Face Swap
   * @param sourceImage Imagen del rostro de origen (base64)
   * @param videoId ID del video al que aplicar el face swap
   * @param shotTypes Tipos de planos seleccionados
   * @returns Resultados del proceso
   */
  startFaceSwap: async (
    sourceImage: string, 
    videoId: string, 
    shotTypes: string[]
  ): Promise<FaceSwapResult[]> => {
    // En una implementación real, aquí se realizaría la llamada al backend
    // Usando la API de face-swap que ya tenemos implementada
    
    // Simulamos un retraso para el procesamiento
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Simulamos unos resultados
    return [
      {
        id: '1',
        sourceImageUrl: sourceImage,
        targetImageUrl: 'https://via.placeholder.com/300',
        resultImageUrl: sourceImage,
        status: 'completed',
        createdAt: new Date()
      }
    ];
  },
  
  /**
   * Obtener historial de face swaps
   * @param userId ID del usuario
   * @returns Lista de resultados de face swap
   */
  getFaceSwapHistory: async (userId: string): Promise<FaceSwapResult[]> => {
    // En una implementación real, consultaríamos el historial desde el backend
    
    return [];
  }
};

// Exportación por defecto para resolver el problema de importación
export default FaceSwap;