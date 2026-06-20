/**
import { logger } from "../../lib/logger";
 * Componente Uploader
 * 
 * Un componente reutilizable para cargar archivos con arrastrar y soltar
 * basado en la librería react-dropzone
 */

import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection, Accept } from 'react-dropzone';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface UploaderProps {
  onUpload: (file: File) => void;
  accept?: Accept;
  maxSize?: number;
  maxFiles?: number;
  isUploading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Uploader({
  onUpload,
  accept = {
    'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
  },
  maxSize = 5 * 1024 * 1024, // 5MB por defecto
  maxFiles = 1,
  isUploading = false,
  className,
  children,
}: UploaderProps) {
  const [error, setError] = useState<string | null>(null);
  
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Manejar archivos rechazados
      if (rejectedFiles.length > 0) {
        const rejectionErrors = rejectedFiles[0].errors;
        if (rejectionErrors[0]?.code === 'file-too-large') {
          setError(`El archivo es demasiado grande. Máximo ${maxSize / (1024 * 1024)}MB`);
        } else if (rejectionErrors[0]?.code === 'file-invalid-type') {
          setError('Tipo de archivo no soportado');
        } else {
          setError(rejectionErrors[0]?.message || 'Error al cargar el archivo');
        }
        return;
      }
      
      // Limpiar error previo
      setError(null);
      
      // Procesar archivo aceptado
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles[0]);
      }
    },
    [maxSize, onUpload]
  );
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles,
    disabled: isUploading,
  });
  
  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-lg cursor-pointer transition-colors',
          isDragActive 
            ? 'border-primary bg-primary/10' 
            : 'border-muted-foreground/25 hover:border-primary/50',
          isUploading && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <input {...getInputProps()} />
        
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {children}
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

export default Uploader;