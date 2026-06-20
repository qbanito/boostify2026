/**
 * Utilidades para procesamiento y conversión de imágenes
 * 
 * Este módulo proporciona funciones para validar, convertir y optimizar imágenes
 * para cumplir con los requisitos específicos de APIs como Kling.
 * 
 * Versión 2.0 - Mejorada con:
 * - Mejor manejo de errores
 * - Limitación de tamaño para prevenir problemas de memoria
 * - Verificación de dimensiones avanzada
 * - Compatibilidad total con la API de Kling
 */

/**
 * Interfaz para el resultado del procesamiento de imagen
 * 
 * Esta interfaz define la estructura del resultado de las operaciones
 * de procesamiento de imágenes, especialmente para Kling API.
 */
export interface ImageProcessingResult {
  isValid: boolean;               // Indica si la imagen pasa todas las validaciones
  processedImage?: string;        // URL de datos de la imagen procesada
  width?: number;                 // Ancho de la imagen en píxeles
  height?: number;                // Alto de la imagen en píxeles
  errorMessage?: string;          // Mensaje de error si isValid es false
  originalFormat?: string;        // Formato original de la imagen
  sizeInMB?: number;              // Tamaño de la imagen en megabytes
  bytesCount?: number;            // Número de bytes (para análisis detallado)
}

/**
 * Verifica si una imagen cumple con los requisitos básicos de la API de Kling (versión síncrona)
 * Esta función se mantiene por compatibilidad con código existente.
 * Se recomienda usar la versión asíncrona processImageForKling para nuevas implementaciones.
 * 
 * @deprecated Use processImageForKling en su lugar
 * @param imageDataUrl URL de datos de la imagen (data URL)
 * @returns Objeto con resultado de validación
 */
export function validateImageForKling(imageDataUrl: string): ImageProcessingResult {
  console.warn('validateImageForKling está obsoleta, use processImageForKling que es asíncrona');
  
  // Verificar si tenemos una imagen
  if (!imageDataUrl) {
    return { 
      isValid: false, 
      errorMessage: 'No se proporcionó imagen' 
    };
  }
  
  // Verificar si es una data URL de imagen
  if (!imageDataUrl.startsWith('data:image/')) {
    return { 
      isValid: false, 
      errorMessage: 'Formato inválido: la imagen debe estar en formato data:image/...' 
    };
  }
  
  // Verificar si es JPEG
  const isJpeg = imageDataUrl.startsWith('data:image/jpeg') || imageDataUrl.startsWith('data:image/jpg');
  if (!isJpeg) {
    return {
      isValid: false,
      errorMessage: 'Solo se aceptan imágenes JPEG. Por favor, convierte la imagen antes de subirla.'
    };
  }
  
  // Si ya tiene el formato correcto
  return {
    isValid: true,
    processedImage: imageDataUrl
  };
}

/**
 * Procesa y verifica si una imagen cumple con los requisitos de la API de Kling
 * 
 * Esta implementación utiliza convertToKlingFormatJpeg internamente para asegurar
 * una conversión completa y validación estricta según los requisitos de Kling:
 * - Formato JPEG puro sin metadatos extra
 * - Encabezado exacto: data:image/jpeg;base64,
 * - Dimensiones: lado corto >= 512px, lado largo <= 4096px
 * - Tamaño máximo: 50MB
 * 
 * @param imageDataUrl URL de datos de la imagen (data URL)
 * @returns Promesa con objeto de resultado de validación y procesamiento
 */
export async function processImageForKling(imageDataUrl: string): Promise<ImageProcessingResult> {
  // Verificación preliminar sin procesar la imagen
  if (!imageDataUrl) {
    return {
      isValid: false,
      errorMessage: 'No se proporcionó imagen'
    };
  }

  if (!imageDataUrl.startsWith('data:image/')) {
    return {
      isValid: false,
      errorMessage: 'Formato inválido: la imagen debe estar en formato data:image/...'
    };
  }

  // Utilizar la función especializada para procesar la imagen para Kling
  // Esta función realiza una conversión completa y validación exhaustiva
  try {
    console.log('Procesando imagen con convertToKlingFormatJpeg para requisitos estrictos de Kling...');
    return await convertToKlingFormatJpeg(imageDataUrl);
  } catch (error: any) {
    console.error('Error en processImageForKling:', error);
    return {
      isValid: false,
      errorMessage: `Error procesando imagen: ${error?.message || 'Error desconocido'}`
    };
  }
}

/**
 * Convierte una imagen a formato JPEG con encabezado específico para Kling
 * 
 * @param imageDataUrl URL de datos de la imagen original (cualquier formato)
 * @returns Promesa con el resultado del procesamiento
 */
/**
 * Nueva implementación para crear una imagen compatible con Kling
 * Esta implementación sigue EXACTAMENTE los requisitos de Kling API:
 * - Formato JPEG puro sin metadatos extra
 * - Encabezado exacto: data:image/jpeg;base64,
 * - Dimensiones: lado corto >= 512px, lado largo <= 4096px
 * - Tamaño máximo: 50MB
 * 
 * @param imageDataUrl URL de datos de la imagen (cualquier formato)
 * @returns Promesa con el resultado del procesamiento
 */
export function convertToKlingFormatJpeg(imageDataUrl: string): Promise<ImageProcessingResult> {
  return new Promise((resolve) => {
    // Si no hay imagen o no es una data URL, rechazar
    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
      resolve({
        isValid: false,
        errorMessage: 'Imagen inválida'
      });
      return;
    }

    // Vamos a convertir todas las imágenes a un nuevo JPEG "limpio", incluso si ya son JPEG
    // para asegurar que el formato sea 100% compatible con las exigencias de Kling API
    console.log('Procesando imagen para máxima compatibilidad con Kling API...');
    
    // Cargar la imagen para obtener sus dimensiones y reconvertirla
    const img = new Image();
    img.onload = () => {
      try {
        // Obtener dimensiones
        const { width, height } = img;
        console.log(`Dimensiones de la imagen: ${width}x${height}`);
        
        // Verificar dimensiones según requisitos de Kling
        const shortSide = Math.min(width, height);
        const longSide = Math.max(width, height);
        
        if (shortSide < 512) {
          resolve({
            isValid: false,
            width,
            height,
            errorMessage: `Imagen demasiado pequeña: lado corto ${shortSide}px (mínimo: 512px)`
          });
          return;
        }
        
        if (longSide > 4096) {
          resolve({
            isValid: false,
            width,
            height,
            errorMessage: `Imagen demasiado grande: lado largo ${longSide}px (máximo: 4096px)`
          });
          return;
        }

        // Crear un canvas para limpiar y reconvertir la imagen
        // Usamos exactamente las mismas dimensiones para mantener la calidad
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        // Obtener contexto y verificar que se creó correctamente
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            isValid: false,
            errorMessage: 'Error al crear contexto de canvas para conversión'
          });
          return;
        }
        
        // PASO 1: Limpiar el canvas con fondo blanco
        // (Esto elimina transparencias y asegura un JPEG válido)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        
        // PASO 2: Dibujar la imagen en el canvas
        ctx.drawImage(img, 0, 0);
        
        // PASO 3: Convertir a JPEG con una calidad específica
        // La calidad 0.9 produce JPEGs más pequeños y limpios
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        // PASO 4: Extraer solo los datos base64, eliminando el encabezado
        const base64Data = jpegDataUrl.split(',')[1] || '';
        if (!base64Data) {
          resolve({
            isValid: false,
            errorMessage: 'Error al extraer datos base64 de la imagen convertida'
          });
          return;
        }
        
        // PASO 5: Crear un nuevo data URL con el encabezado EXACTO que requiere Kling
        // Sin espacios adicionales, sin caracteres extra, exactamente como lo pide la API
        const klingCompatibleUrl = 'data:image/jpeg;base64,' + base64Data;
        
        // PASO 6: Verificar tamaño
        const approximateSizeInBytes = (base64Data.length * 3) / 4;
        const approximateSizeInMB = approximateSizeInBytes / (1024 * 1024);
        
        console.log(`Tamaño de la imagen procesada: ${approximateSizeInMB.toFixed(2)}MB`);
        
        if (approximateSizeInMB > 50) {
          resolve({
            isValid: false,
            errorMessage: `Imagen demasiado grande: ~${approximateSizeInMB.toFixed(2)}MB (máximo: 50MB)`
          });
          return;
        }
        
        // PASO 7: Retornar la imagen procesada
        console.log('✅ Imagen procesada correctamente para Kling API');
        resolve({
          isValid: true,
          processedImage: klingCompatibleUrl,
          width,
          height,
          sizeInMB: approximateSizeInMB
        });
        
      } catch (error: any) {
        console.error('Error en procesamiento de imagen para Kling:', error);
        resolve({
          isValid: false,
          errorMessage: `Error procesando imagen: ${error.message || 'Error desconocido'}`
        });
      }
    };
    
    img.onerror = () => {
      resolve({
        isValid: false,
        errorMessage: 'Error al cargar la imagen para procesamiento'
      });
    };
    
    // Cargar la imagen
    img.src = imageDataUrl;
  });
}

/**
 * Verifica que un JPEG es válido chequeando su estructura a nivel de bytes
 * @param jpegDataUrl URL de datos de la imagen JPEG
 * @returns Resultado de la validación
 */
function verifyJpegValidity(jpegDataUrl: string): Promise<ImageProcessingResult> {
  return new Promise((resolve) => {
    try {
      // Verificar header
      if (!jpegDataUrl.startsWith('data:image/jpeg;base64,')) {
        resolve({
          isValid: false,
          errorMessage: 'El encabezado no corresponde a un JPEG base64 válido'
        });
        return;
      }
      
      // Extraer los datos base64
      const base64Data = jpegDataUrl.split(',')[1];
      if (!base64Data) {
        resolve({
          isValid: false,
          errorMessage: 'No se pudieron extraer los datos base64'
        });
        return;
      }
      
      // Verificar longitud base64
      if (base64Data.length < 20) { // Un JPEG válido debe tener al menos algunos bytes
        resolve({
          isValid: false,
          errorMessage: 'Datos base64 demasiado cortos para ser un JPEG válido'
        });
        return;
      }
      
      // Convertir base64 a binario (solo los primeros bytes para verificar)
      const binaryHeader = atob(base64Data.substring(0, 24));
      
      // Verificar firma JPEG (SOI - Start of Image marker)
      // Un JPEG válido siempre comienza con los bytes 0xFF 0xD8
      if (binaryHeader.charCodeAt(0) !== 0xFF || binaryHeader.charCodeAt(1) !== 0xD8) {
        resolve({
          isValid: false,
          errorMessage: 'Firma JPEG inválida en los datos binarios'
        });
        return;
      }
      
      // Verificar que termine con EOI (End of Image)
      // No podemos verificar esto fácilmente en el navegador sin cargar toda la imagen
      
      // Calcular tamaño aproximado
      const approximateSizeInBytes = (base64Data.length * 3) / 4;
      const approximateSizeInMB = approximateSizeInBytes / (1024 * 1024);
      
      // Si llegamos aquí, el JPEG parece válido a nivel de estructura
      resolve({
        isValid: true,
        errorMessage: '', 
        sizeInMB: approximateSizeInMB
      });
      
    } catch (error: any) {
      console.error('Error verificando validez JPEG:', error);
      resolve({
        isValid: false,
        errorMessage: `Error verificando JPEG: ${error.message || 'Error desconocido'}`
      });
    }
  });
}

/**
 * Verifica las dimensiones de una imagen
 * 
 * @param imageDataUrl URL de datos de la imagen
 * @returns Promesa con el resultado de la verificación
 */
function checkImageDimensions(imageDataUrl: string): Promise<ImageProcessingResult> {
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      const { width, height } = img;
      
      // Verificar dimensiones según requisitos de Kling
      const shortSide = Math.min(width, height);
      const longSide = Math.max(width, height);
      
      if (shortSide < 512) {
        resolve({
          isValid: false,
          width,
          height,
          errorMessage: `Imagen demasiado pequeña: lado corto ${shortSide}px (mínimo: 512px)`
        });
        return;
      }
      
      if (longSide > 4096) {
        resolve({
          isValid: false,
          width,
          height,
          errorMessage: `Imagen demasiado grande: lado largo ${longSide}px (máximo: 4096px)`
        });
        return;
      }
      
      // Dimensiones válidas
      resolve({
        isValid: true,
        width,
        height
      });
    };
    
    img.onerror = () => {
      resolve({
        isValid: false,
        errorMessage: 'Error al cargar la imagen para verificar dimensiones'
      });
    };
    
    img.src = imageDataUrl;
  });
}