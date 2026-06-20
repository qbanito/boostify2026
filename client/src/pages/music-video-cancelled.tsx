import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { XCircle, ArrowLeft, ShoppingCart } from "lucide-react";

export default function MusicVideoCancelled() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Extraer video_id de la URL para posible reintento
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get("video_id");
    
    if (!videoId) {
      toast({
        title: "Información incompleta",
        description: "No se pudo identificar el video para el proceso de compra",
        variant: "destructive",
      });
    }
    
    // Notificar al usuario que la compra fue cancelada
    toast({
      title: "Compra cancelada",
      description: "Has cancelado el proceso de pago para el video musical",
      variant: "default",
    });
  }, [toast]);

  return (
    <div className="container max-w-3xl py-10">
      <Card className="border-red-200 bg-gradient-to-b from-white to-red-50 dark:from-gray-950 dark:to-gray-900">
        <CardHeader className="pb-4">
          <CardTitle className="text-center text-2xl font-bold text-red-600 dark:text-red-400">
            Compra Cancelada
          </CardTitle>
          <CardDescription className="text-center text-gray-600 dark:text-gray-400">
            Has cancelado el proceso de pago para tu video musical
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center">
          <div className="mb-6 flex justify-center">
            <XCircle className="h-24 w-24 text-red-500" />
          </div>
          
          <h3 className="mb-2 text-xl font-semibold">
            No se ha completado la compra
          </h3>
          
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            Tu cuenta no ha sido cobrada. Puedes volver a intentar la compra en cualquier momento.
          </p>
          
          <div className="my-8 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <h4 className="mb-2 font-medium">Recordatorio de beneficios:</h4>
            <ul className="space-y-2 text-left text-sm">
              <li className="flex items-start">
                <span className="mr-2 mt-0.5 text-red-500">•</span>
                <span>La versión completa del video incluye alta calidad y sin marcas de agua</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 mt-0.5 text-red-500">•</span>
                <span>Acceso permanente al contenido en tu biblioteca</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 mt-0.5 text-red-500">•</span>
                <span>Opción para descargar el video para uso offline</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 mt-0.5 text-red-500">•</span>
                <span>Posibilidad de usar el video en tus redes sociales</span>
              </li>
            </ul>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setLocation("/music-video-ai")}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Creador
          </Button>
          
          <Button 
            onClick={() => {
              // Redirigir a la última página de generación de video
              // En un caso real, podríamos guardar el ID del video y usarlo para volver
              // exactamente al mismo punto
              setLocation("/music-video-ai");
            }}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Reintentar Compra
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}