/**
 * Página de prueba para la generación de videos con PiAPI
 */

import { Video } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import VideoGenerator from '../components/video-generation-test';

export default function VideoGenerationTestPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="bg-orange-100 dark:bg-orange-950 p-2 rounded-full">
              <Video className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <CardTitle>Generador de Video con PiAPI</CardTitle>
              <CardDescription>
                Prueba la generación de videos a partir de texto usando la API de PiAPI
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Esta herramienta te permite generar videos a partir de descripciones de texto
            usando el modelo Hailuo de PiAPI. La generación puede tardar varios minutos
            dependiendo de la complejidad del prompt y la carga del servicio.
          </p>
          
          {/* Componente principal de generación de video */}
          <VideoGenerator />
        </CardContent>
      </Card>
    </div>
  );
}