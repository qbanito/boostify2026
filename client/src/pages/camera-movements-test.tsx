/**
 * Página de prueba para los movimientos de cámara cinematográficos
 * 
 * Esta página permite probar la generación de videos con movimientos de cámara
 * usando el modelo t2v-01-director de Hailuo API, con soporte para:
 * - Generación automática de movimientos basados en el prompt
 * - Combinaciones cinematográficas predefinidas
 * - Selección manual de movimientos de cámara
 */
import { Video, MoveHorizontal, Camera } from 'lucide-react';
import VideoGenerationTest from '../components/video-generation-test';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';

export default function CameraMovementsTestPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="bg-orange-100 dark:bg-orange-950 p-2 rounded-full">
              <MoveHorizontal className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <CardTitle>Movimientos de Cámara Cinematográficos</CardTitle>
              <CardDescription>
                Prueba la generación de videos con movimientos de cámara inteligentes
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Esta herramienta te permite generar videos con movimientos de cámara automáticos 
            que se adaptan al contenido de tu prompt. El modelo Director (t2v-01-director) 
            soporta hasta 3 movimientos de cámara por video, que pueden ser seleccionados 
            manualmente o generados automáticamente.
          </p>
          
          {/* Componente principal de generación de video */}
          <VideoGenerationTest />
        </CardContent>
      </Card>
    </div>
  );
}