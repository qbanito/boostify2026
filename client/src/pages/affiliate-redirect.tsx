import React, { useEffect, useState } from "react";
import { logger } from "../lib/logger";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { ProgressCircular } from "../components/ui/progress-circular";
import { Link, LinkProps } from "wouter";
import { ArrowRight, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";

/**
 * Página de redirección para enlaces de afiliados
 * Esta página maneja el seguimiento de clics y redirige al usuario al producto/destino
 */
export default function AffiliateRedirectPage() {
  const [location] = useLocation();
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  
  // Extraer el ID del enlace de la URL o slug personalizado
  const linkIdOrSlug = location.split('/').pop() || '';
  
  // Consultar información del enlace
  const {
    data: linkData,
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ["affiliate", "redirect", linkIdOrSlug],
    queryFn: async () => {
      try {
        // Registro del clic y obtención de datos de redirección
        const response = await axios.get(`/api/affiliate/track/${linkIdOrSlug}`);
        return response.data;
      } catch (error: any) {
        logger.error("Error fetching affiliate link:", error);
        if (error?.response?.status === 404) {
          setLinkError("El enlace no existe o ha sido desactivado.");
        } else {
          setLinkError("Ha ocurrido un error al procesar tu solicitud.");
        }
        throw error;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
  
  // Iniciar cuenta regresiva para redirección automática
  useEffect(() => {
    if (linkData && linkData.destinationUrl && !isRedirecting) {
      if (redirectCountdown > 0) {
        const timer = setTimeout(() => {
          setRedirectCountdown(prev => prev - 1);
        }, 1000);
        
        return () => clearTimeout(timer);
      } else {
        setIsRedirecting(true);
        window.location.href = linkData.destinationUrl;
      }
    }
  }, [linkData, redirectCountdown, isRedirecting]);
  
  // Redirección manual inmediata
  const handleRedirectNow = () => {
    if (linkData && linkData.destinationUrl) {
      setIsRedirecting(true);
      window.location.href = linkData.destinationUrl;
    }
  };
  
  // Si está cargando, mostrar indicador de carga
  if (isLoading) {
    return (
      <div className="container py-16">
        <div className="max-w-lg mx-auto flex flex-col items-center justify-center text-center">
          <ProgressCircular size="lg" className="mb-6" value={undefined} />
          <h1 className="text-2xl font-bold mb-2">Preparando redirección</h1>
          <p className="text-muted-foreground mb-4">
            Estamos procesando tu solicitud. Serás redirigido automáticamente en unos segundos.
          </p>
        </div>
      </div>
    );
  }
  
  // Si hay un error o el enlace no existe
  if (isError || linkError) {
    return (
      <div className="container py-16">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>Enlace no encontrado</CardTitle>
            <CardDescription>No pudimos encontrar el enlace solicitado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                {linkError || "El enlace que intentas acceder no existe o ha sido desactivado."}
              </AlertDescription>
            </Alert>
            
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Button variant="outline" asChild>
                <Link href="/">
                  Ir a la página principal
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/affiliates">
                  Programa de afiliados
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Mostrar página de confirmación durante la cuenta regresiva
  return (
    <div className="container py-16">
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Redireccionando</CardTitle>
              <CardDescription>Serás redirigido automáticamente</CardDescription>
            </div>
            <div className="w-12 h-12 flex items-center justify-center rounded-full border-2 border-primary text-primary font-bold">
              {redirectCountdown}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {linkData?.productInfo && (
            <div className="bg-muted/30 p-4 rounded-md">
              <div className="flex items-start gap-3">
                {linkData.productInfo.imageUrl && (
                  <div className="w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                    <img 
                      src={linkData.productInfo.imageUrl} 
                      alt={linkData.productInfo.name || 'Producto'} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <h3 className="font-medium text-lg">{linkData.productInfo.name}</h3>
                  {linkData.productInfo.price && (
                    <p className="text-sm font-medium text-primary">{linkData.productInfo.price}</p>
                  )}
                  {linkData.productInfo.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {linkData.productInfo.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Clic registrado</span>
          </div>
          
          {linkData?.affiliateInfo && (
            <div className="text-sm text-muted-foreground">
              <p>Enlace creado por {linkData.affiliateInfo.name || 'un afiliado'}</p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button 
              onClick={handleRedirectNow} 
              className="sm:flex-1 gap-1"
              disabled={isRedirecting}
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirigiendo...
                </>
              ) : (
                <>
                  Ir ahora
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              asChild
              className="sm:flex-1 gap-1"
            >
              <Link href="/">
                <ExternalLink className="h-4 w-4" />
                Ir a la página principal
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}