import { useEffect, useState } from "react";
import { logger } from "../lib/logger";
import { useLocation } from "wouter";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { CheckCircle2, ArrowLeft, Video } from "lucide-react";
import { useAuth } from "../hooks/use-auth";

export default function MusicVideoSuccess() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [purchaseVerified, setPurchaseVerified] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);

  // Extraer session_id y video_id de la URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");
    const vidId = urlParams.get("video_id");
    
    if (!sessionId || !vidId) {
      toast({
        title: "Error",
        description: "Parámetros de sesión inválidos",
        variant: "destructive",
      });
      
      // Redirigir a la página principal después de un breve retraso
      setTimeout(() => {
        setLocation("/");
      }, 3000);
      return;
    }
    
    setVideoId(vidId);
    
    // Verificar el estado de la compra en el servidor
    async function verifyPurchase() {
      try {
        setLoading(true);
        
        // Verificar el estado de la compra
        const response = await apiRequest(`/api/stripe/video-purchase-status/${vidId}`, "GET");
        
        if (response.success && response.isPurchased) {
          setPurchaseVerified(true);
          toast({
            title: "¡Compra exitosa!",
            description: "Tu video musical ya está disponible en tu biblioteca",
          });
        } else {
          // La compra no se completó o hubo un error
          setPurchaseVerified(false);
          toast({
            title: "Estado pendiente",
            description: "Tu compra está siendo procesada. Puede tomar unos momentos.",
            variant: "default",
          });
        }
      } catch (error) {
        logger.error("Error verificando la compra:", error);
        toast({
          title: "Error",
          description: "No pudimos verificar el estado de tu compra",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    
    if (user) {
      verifyPurchase();
    }
  }, [user, toast, setLocation]);

  return (
    <div className="container max-w-3xl py-10">
      <Card className="border-green-200 bg-gradient-to-b from-white to-green-50 dark:from-gray-950 dark:to-gray-900">
        <CardHeader className="pb-4">
          <CardTitle className="text-center text-2xl font-bold text-green-600 dark:text-green-400">
            ¡Gracias por tu compra!
          </CardTitle>
          <CardDescription className="text-center text-gray-600 dark:text-gray-400">
            Tu pago ha sido procesado exitosamente
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center">
          <div className="mb-6 flex justify-center">
            <CheckCircle2 className="h-24 w-24 text-green-500" />
          </div>
          
          <h3 className="mb-2 text-xl font-semibold">
            {purchaseVerified 
              ? "¡Tu video musical está listo!" 
              : "Procesando tu compra..."}
          </h3>
          
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            {purchaseVerified
              ? "Ya puedes disfrutar de tu video musical completo en alta calidad."
              : "Tu pago ha sido recibido. Estamos procesando tu compra, esto puede tomar unos momentos."}
          </p>
          
          {purchaseVerified && (
            <div className="my-8 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
              <h4 className="mb-2 font-medium">Tu compra incluye:</h4>
              <ul className="space-y-2 text-left text-sm">
                <li className="flex items-center">
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  Acceso completo al video musical
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  Alta calidad sin restricciones
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  Opción para descargar el video
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  Acceso permanente al contenido
                </li>
              </ul>
            </div>
          )}
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
          
          {purchaseVerified && videoId && (
            <Button 
              onClick={() => setLocation(`/my-videos/${videoId}`)}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              <Video className="mr-2 h-4 w-4" />
              Ver Mi Video
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}