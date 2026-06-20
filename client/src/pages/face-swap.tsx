import React from 'react';
import { Separator } from '../components/ui/separator';
import FaceSwap from '../components/face-swap/face-swap';

/**
 * Página principal de Face Swap que muestra el componente de intercambio de rostros
 */
export default function FaceSwapPage() {
  return (
    <div className="container py-6 space-y-6 max-w-4xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Intercambio de Rostros con IA</h1>
        <p className="text-muted-foreground">
          Herramienta para intercambiar rostros entre dos imágenes usando inteligencia artificial avanzada
        </p>
      </div>
      
      <Separator />
      
      <div className="grid gap-6">
        <FaceSwap />
        
        <div className="p-4 border rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-2">Cómo funciona</h3>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Sube la imagen con el rostro que deseas utilizar</li>
            <li>Sube la imagen donde deseas colocar el rostro</li>
            <li>Haz clic en "Intercambiar rostros" y espera mientras la IA procesa las imágenes</li>
            <li>¡Descarga el resultado cuando esté listo!</li>
          </ol>
          
          <div className="mt-4 text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>Nota:</strong> Para obtener los mejores resultados:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Utiliza imágenes con rostros claramente visibles</li>
              <li>Asegúrate de que las caras estén bien iluminadas y nítidas</li>
              <li>Evita ángulos extremos o rostros parcialmente ocultos</li>
              <li>Las imágenes con fondo simple suelen dar mejores resultados</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}