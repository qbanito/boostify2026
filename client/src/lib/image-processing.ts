import { logger } from "./logger";
/**
 * Utilidades para procesamiento de imágenes específicamente para la API de Kling
 * Versión para el lado del cliente (browser)
 */

export interface ImageConversionResult {
  isValid: boolean;
  processedImage?: string;
  errorMessage?: string;
  width?: number;
  height?: number;
  sizeInMB?: number;
  originalFormat?: string;
}

/**
 * Convierte una imagen al formato estricto requerido por Kling API
 * 
 * @param dataUrl URL de datos de la imagen original (data URL)
 * @returns Promesa con resultado de conversión incluyendo URL normalizada si es válida
 */
export async function convertToKlingFormatJpeg(dataUrl: string): Promise<ImageConversionResult> {
  try {
    logger.info('Procesando imagen para máxima compatibilidad con Kling API');
    
    // Si no hay imagen, no es válido
    if (!dataUrl) {
      return { 
        isValid: false, 
        errorMessage: 'No se proporcionó imagen' 
      };
    }

    // Verificar si es una URL de datos válida
    if (!dataUrl.startsWith('data:')) {
      return { 
        isValid: false, 
        errorMessage: 'Formato inválido: la imagen debe ser una data URL (data:)' 
      };
    }

    // Extraer partes de la data URL
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return {
        isValid: false,
        errorMessage: 'Formato inválido: la data URL no tiene el formato esperado'
      };
    }
    
    const [, mimeType, base64Data] = matches;
    
    // Verificar si es una imagen
    if (!mimeType.startsWith('image/')) {
      return {
        isValid: false,
        errorMessage: 'El archivo no es una imagen'
      };
    }
    
    // Registrar el formato original
    const originalFormat = mimeType.split('/')[1] || 'desconocido';
    logger.info(`Formato original: ${originalFormat}`);
    
    // Estimación aproximada del tamaño
    const estimatedSizeInBytes = (base64Data.length * 3) / 4;
    const fileSizeInMB = estimatedSizeInBytes / (1024 * 1024);
    
    // Validación de tamaño máximo (50MB)
    if (fileSizeInMB > 50) {
      return {
        isValid: false,
        errorMessage: `Imagen demasiado grande: ${fileSizeInMB.toFixed(2)}MB (máximo permitido: 50MB)`,
        originalFormat,
        sizeInMB: fileSizeInMB
      };
    }
    
    // Crear imagen para conversión y validación de dimensiones
    const img = new Image();
    const imagePromise = new Promise<ImageConversionResult>((resolve) => {
      img.onload = () => {
        try {
          const { width, height } = img;
          logger.info(`Dimensiones de imagen: ${width}x${height}`);
          
          // Validación de dimensiones según requisitos de Kling
          const shortSide = Math.min(width, height);
          const longSide = Math.max(width, height);
          
          if (shortSide < 512) {
            resolve({
              isValid: false,
              errorMessage: `Imagen demasiado pequeña: lado corto ${shortSide}px (mínimo: 512px)`,
              width,
              height,
              originalFormat,
              sizeInMB: fileSizeInMB
            });
            return;
          }
          
          if (longSide > 4096) {
            resolve({
              isValid: false,
              errorMessage: `Imagen demasiado grande: lado largo ${longSide}px (máximo: 4096px)`,
              width,
              height,
              originalFormat,
              sizeInMB: fileSizeInMB
            });
            return;
          }
          
          // PROCESO DE CONVERSIÓN A JPEG PURO
          try {
            // Creamos un canvas para convertir la imagen a JPEG
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            // Obtener contexto y dibujar la imagen
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('No se pudo obtener contexto 2D del canvas');
            }
            
            // Dibujar con fondo blanco si es PNG para eliminar transparencia
            if (originalFormat.toLowerCase() === 'png') {
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, width, height);
            }
            
            // Dibujar la imagen
            ctx.drawImage(img, 0, 0);
            
            // Convertir a JPEG con calidad óptima (0.92)
            // Calidad suficientemente alta para preservar detalles pero no excesiva
            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
            
            // Verificar que tenga el formato exacto requerido por Kling API
            // El encabezado debe ser exactamente 'data:image/jpeg;base64,'
            if (!jpegDataUrl.startsWith('data:image/jpeg;base64,')) {
              throw new Error('La conversión no generó el encabezado JPEG exacto requerido');
            }
            
            // Verificamos que el resultado sea un JPEG válido (debe comenzar con FF D8)
            const jpegBase64 = jpegDataUrl.split(',')[1];
            const firstBytes = atob(jpegBase64.substring(0, 4));
            
            if (firstBytes.charCodeAt(0) !== 0xFF || firstBytes.charCodeAt(1) !== 0xD8) {
              throw new Error('La imagen convertida no tiene una firma JPEG válida');
            }
            
            // Actualizar tamaño después de la conversión
            const newSizeInBytes = (jpegBase64.length * 3) / 4;
            const newSizeInMB = newSizeInBytes / (1024 * 1024);
            
            logger.info(`✅ Conversión exitosa a JPEG puro: ${width}x${height}, ${newSizeInMB.toFixed(2)}MB`);
            
            // Éxito - devolver la imagen convertida
            resolve({
              isValid: true,
              processedImage: jpegDataUrl,
              width,
              height,
              sizeInMB: newSizeInMB,
              originalFormat
            });
          } catch (conversionError: any) {
            logger.error('Error durante la conversión a JPEG:', conversionError);
            resolve({
              isValid: false,
              errorMessage: `Error al convertir a JPEG: ${conversionError.message}`,
              width,
              height,
              originalFormat,
              sizeInMB: fileSizeInMB
            });
          }
        } catch (imgError: any) {
          logger.error('Error al procesar la imagen cargada:', imgError);
          resolve({
            isValid: false,
            errorMessage: `Error al procesar la imagen: ${imgError.message}`,
            originalFormat,
            sizeInMB: fileSizeInMB
          });
        }
      };
      
      img.onerror = (error) => {
        logger.error('Error al cargar la imagen:', error);
        resolve({
          isValid: false,
          errorMessage: 'Error al cargar la imagen. Podría estar dañada o ser un formato no soportado.',
          originalFormat,
          sizeInMB: fileSizeInMB
        });
      };
    });
    
    // Iniciar carga de la imagen
    img.src = dataUrl;
    
    // Esperar y devolver resultado
    return await imagePromise;
  } catch (error: any) {
    logger.error('Error general en procesamiento de imagen:', error);
    return {
      isValid: false,
      errorMessage: `Error general en procesamiento: ${error.message}`
    };
  }
}

/**
 * Valida si una data URL cumple con los requisitos específicos de Kling API
 * @param dataUrl URL de datos a validar
 * @returns Resultado de validación con misma estructura que ImageConversionResult
 */
export async function validateKlingImageFormat(dataUrl: string): Promise<ImageConversionResult> {
  try {
    // Validación básica para URLs de datos
    if (!dataUrl || typeof dataUrl !== 'string') {
      return { 
        isValid: false, 
        errorMessage: 'La imagen no es una cadena válida'
      };
    }
    
    if (!dataUrl.startsWith('data:image/')) {
      return { 
        isValid: false, 
        errorMessage: 'La imagen no tiene un formato de data URL válido'
      };
    }
    
    // Verificación estricta: DEBE ser JPEG con encabezado EXACTO
    // Kling API rechaza cualquier variación o formato alternativo
    const hasExactJpegFormat = dataUrl.startsWith('data:image/jpeg;base64,');
    
    // Según requisitos exactos de Kling, solo aceptamos JPEG con encabezado específico
    if (!hasExactJpegFormat) {
      return {
        isValid: false,
        errorMessage: 'Formato de imagen no soportado. Solo se acepta JPEG con encabezado exacto: data:image/jpeg;base64,'
      };
    }
    
    // Verificación estricta del formato y contenido
    const parts = dataUrl.split(',');
    if (parts.length !== 2 || !parts[1]) {
      return {
        isValid: false,
        errorMessage: 'La estructura del data URL no es válida'
      };
    }
    
    // Base64 data
    const base64Data = parts[1];
    
    // Verificar que la primera parte contiene la codificación correcta de jpeg
    const headerPart = parts[0].toLowerCase();
    if (headerPart !== 'data:image/jpeg;base64') {
      return {
        isValid: false,
        errorMessage: 'El encabezado de la imagen debe ser exactamente data:image/jpeg;base64'
      };
    }
    
    // Verificar tamaño mínimo para asegurar que no es una imagen vacía
    if (base64Data.length < 100) {
      return {
        isValid: false,
        errorMessage: 'La imagen es demasiado pequeña o está vacía'
      };
    }
    
    // Verificar tamaño máximo (Kling acepta hasta 50MB)
    const maxSizeInBytes = 50 * 1024 * 1024; // 50MB (límite de Kling)
    const estimatedSizeInBytes = (base64Data.length * 3) / 4; // Estimación aproximada
    
    if (estimatedSizeInBytes > maxSizeInBytes) {
      return {
        isValid: false,
        errorMessage: `La imagen es demasiado grande (${(estimatedSizeInBytes / (1024 * 1024)).toFixed(2)}MB > 50MB)`
      };
    }
    
    // Validación avanzada: verificar firma binaria JPEG
    try {
      // Decodificar los primeros bytes para verificar la firma JPEG
      // Un archivo JPEG siempre comienza con la secuencia FF D8
      const binaryStart = atob(base64Data.substring(0, 8));
      const byte1 = binaryStart.charCodeAt(0);
      const byte2 = binaryStart.charCodeAt(1);
      
      if (byte1 !== 0xFF || byte2 !== 0xD8) {
        return {
          isValid: false,
          errorMessage: `Firma JPEG inválida: ${byte1.toString(16)},${byte2.toString(16)} (esperado: FF,D8)`
        };
      }
    } catch (binaryError) {
      logger.warn('Error al verificar firma binaria JPEG:', binaryError);
      // Continuamos porque esta verificación es adicional
    }
    
    // Validación exitosa - devolver la imagen original como processedImage
    const fileSizeInMB = estimatedSizeInBytes / (1024 * 1024);
    
    // Para evitar un error de imagen cargándose, creamos una nueva imagen
    // para obtener sus dimensiones exactas
    return new Promise<ImageConversionResult>((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          isValid: true,
          processedImage: dataUrl,
          width: img.width,
          height: img.height,
          sizeInMB: fileSizeInMB,
          originalFormat: 'jpeg'
        });
      };
      img.onerror = () => {
        // Si hay error al cargar la imagen para dimensiones,
        // devolvemos válido pero sin dimensiones
        resolve({
          isValid: true,
          processedImage: dataUrl,
          sizeInMB: fileSizeInMB,
          originalFormat: 'jpeg'
        });
      };
      img.src = dataUrl;
    });
  } catch (error) {
    logger.error('Error al validar la imagen:', error);
    // Devolver promesa resuelta con error para mantener consistencia en el tipo de retorno
    return Promise.resolve({ 
      isValid: false,
      errorMessage: 'Error inesperado al validar la imagen'
    });
  }
}