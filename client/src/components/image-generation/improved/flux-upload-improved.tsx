/**
 * Componente mejorado para subir imágenes de referencia
 * 
 * Este componente permite a los usuarios subir una imagen de referencia
 * para iniciar el proceso de asesoría de imagen.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useArtistImageWorkflow } from '../../../services/artist-image-workflow-service';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Label } from '../../ui/label';
import { cn } from '../../../lib/utils';
import { UploadCloud, Image, AlertCircle } from 'lucide-react';

interface FluxUploadImprovedProps {
  onComplete?: () => void;
}

export function FluxUploadImproved({ onComplete }: FluxUploadImprovedProps) {
  const { referenceImage, setReferenceImage } = useArtistImageWorkflow();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manejador para cuando se suelta una imagen
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  // Manejador para cuando se selecciona una imagen
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  // Función para procesar la imagen
  const handleFile = (file: File) => {
    // Reiniciar el error
    setError(null);
    
    // Verificar si es una imagen
    if (!file.type.match('image.*')) {
      setError('Por favor, sube un archivo de imagen válido.');
      return;
    }
    
    // Verificar el tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen es demasiado grande. Por favor, sube una imagen menor a 10MB.');
      return;
    }
    
    // Leer y convertir a base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setReferenceImage(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleContinue = () => {
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Sube una foto de referencia</h2>
        <p className="text-muted-foreground mb-4">
          Para comenzar, sube una foto tuya que usaremos como referencia para crear tu imagen artística.
        </p>
      </div>

      {/* Área de drop */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all hover:bg-muted/50",
          isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25",
          error ? "border-destructive/50" : ""
        )}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleChange}
        />
        
        {referenceImage ? (
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-sm mx-auto mb-4 rounded-lg overflow-hidden">
              <img
                src={referenceImage}
                alt="Imagen de referencia"
                className="w-full h-auto object-cover rounded-lg"
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-2 right-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setReferenceImage(null);
                }}
              >
                Cambiar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Imagen subida correctamente. Haz clic para cambiarla.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-muted mb-4">
              {error ? (
                <AlertCircle className="h-6 w-6 text-destructive" />
              ) : (
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <p className="font-medium mb-1">
              {error ? 'Error al subir la imagen' : 'Arrastra y suelta o haz clic para subir'}
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              {error ? error : 'JPG, PNG o GIF (máx. 10MB)'}
            </p>
          </div>
        )}
      </div>

      {/* Consejos para fotos óptimas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card className="p-4">
          <div className="flex gap-2 items-center mb-2">
            <div className="bg-primary/10 p-2 rounded-full">
              <Image className="h-5 w-5 text-primary" />
            </div>
            <Label>Iluminación</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Usa fotos con buena iluminación, preferiblemente natural.
          </p>
        </Card>
        
        <Card className="p-4">
          <div className="flex gap-2 items-center mb-2">
            <div className="bg-primary/10 p-2 rounded-full">
              <Image className="h-5 w-5 text-primary" />
            </div>
            <Label>Postura</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Elige fotos con una postura natural que refleje tu estilo.
          </p>
        </Card>
        
        <Card className="p-4">
          <div className="flex gap-2 items-center mb-2">
            <div className="bg-primary/10 p-2 rounded-full">
              <Image className="h-5 w-5 text-primary" />
            </div>
            <Label>Expresión</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            La expresión facial debe ser coherente con tu imagen artística.
          </p>
        </Card>
      </div>

      {/* Botón para continuar */}
      <div className="flex justify-end mt-6">
        <Button
          onClick={handleContinue}
          disabled={!referenceImage}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}