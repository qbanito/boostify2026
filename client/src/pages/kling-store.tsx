import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Shirt, Sparkles, Mic, SmartphoneCharging, Smartphone, AppWindow, 
         Download, Star, CloudLightning, ImagePlus, VideoIcon, Crown } from 'lucide-react';
import { useToast } from "../hooks/use-toast";
import { Link } from "wouter";

// Interfaz para una aplicación mobile
interface MobileApp {
  id: string;
  name: string;
  description: string;
  price: number | 'free';
  category: 'tools' | 'photo' | 'video' | 'premium';
  icon: React.ReactNode;
  rating: number;
  downloads: string;
  features: string[];
  screenshots: string[];
  isNew?: boolean;
  isBeta?: boolean;
}

// Interfaz para un servicio de Kling
interface KlingService {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  price: number;
  unit: string;
  features: string[];
  usage: string;
  route: string;
}

export default function KlingStorePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('services');
  
  // Datos para los servicios de Kling
  const klingServices: KlingService[] = [
    {
      id: 'try-on',
      name: 'Virtual Try-On',
      description: 'Prueba virtualmente prendas de vestir en modelos usando IA',
      icon: <Shirt className="h-6 w-6" />,
      price: 0.07,
      unit: 'por imagen',
      features: [
        'Superposición de prendas en modelos',
        'Soporte para prendas completas o por partes',
        'Ajuste automático a la postura y proporciones',
        'Alta calidad de renderizado'
      ],
      usage: 'Tiendas online, diseñadores de moda, creadores de contenido',
      route: '/kling-tools?tab=tryOn'
    },
    {
      id: 'lipsync',
      name: 'Lipsync',
      description: 'Sincroniza labios en videos con audio o texto para diálogos realistas',
      icon: <Mic className="h-6 w-6" />,
      price: 0.10,
      unit: 'por 5 segundos',
      features: [
        'Sincronización de labios con audio o texto',
        'Preservación de expresiones faciales',
        'Soporte para múltiples idiomas',
        'Generación de voz opcional'
      ],
      usage: 'Localización de videos, doblaje, avatares digitales, marketing',
      route: '/kling-tools?tab=lipsync'
    },
    {
      id: 'effects',
      name: 'Effects',
      description: 'Transforma imágenes estáticas en videos animados con efectos especiales',
      icon: <Sparkles className="h-6 w-6" />,
      price: 0.26,
      unit: 'por generación',
      features: [
        'Múltiples efectos (squish, expansion, zoom, etc.)',
        'Control de duración e intensidad',
        'Salida en formato MP4 o GIF',
        'Alta fidelidad visual'
      ],
      usage: 'Marketing en redes sociales, GIFs expresivos, animaciones rápidas',
      route: '/kling-tools?tab=effects'
    }
  ];
  
  // Datos para las aplicaciones móviles
  const mobileApps: MobileApp[] = [
    {
      id: 'kling-ai-camera',
      name: 'Kling AI Camera',
      description: 'Captura fotos y aplica efectos de IA en tiempo real',
      price: 'free',
      category: 'photo',
      icon: <ImagePlus className="h-6 w-6" />,
      rating: 4.7,
      downloads: '2.5M+',
      features: [
        'Filtros en tiempo real basados en IA',
        'Mejora automática de fotos',
        'Detección de escenas',
        'Modo retrato avanzado'
      ],
      screenshots: [
        '/assets/app1-screenshot1.png',
        '/assets/app1-screenshot2.png'
      ],
      isNew: true
    },
    {
      id: 'kling-video-editor',
      name: 'Kling Video Editor',
      description: 'Editor de video con efectos especiales potenciados por IA',
      price: 4.99,
      category: 'video',
      icon: <VideoIcon className="h-6 w-6" />,
      rating: 4.5,
      downloads: '1.2M+',
      features: [
        'Efectos de video generados por IA',
        'Sincronización automática con música',
        'Corrección de color inteligente',
        'Transiciones personalizadas'
      ],
      screenshots: [
        '/assets/app2-screenshot1.png',
        '/assets/app2-screenshot2.png'
      ]
    },
    {
      id: 'kling-image-enhancer',
      name: 'Kling Image Enhancer',
      description: 'Mejora y restaura imágenes con un solo clic',
      price: 2.99,
      category: 'photo',
      icon: <ImagePlus className="h-6 w-6" />,
      rating: 4.3,
      downloads: '800K+',
      features: [
        'Upscaling de imágenes con IA',
        'Eliminación de ruido',
        'Restauración de fotos antiguas',
        'Eliminación de objetos no deseados'
      ],
      screenshots: [
        '/assets/app3-screenshot1.png',
        '/assets/app3-screenshot2.png'
      ]
    },
    {
      id: 'kling-pro-suite',
      name: 'Kling Pro Suite',
      description: 'Suite completa de herramientas creativas para profesionales',
      price: 9.99,
      category: 'premium',
      icon: <Crown className="h-6 w-6" />,
      rating: 4.8,
      downloads: '500K+',
      features: [
        'Todas las funciones premium en una sola app',
        'Actualizaciones prioritarias',
        'Créditos mensuales para servicios en la nube',
        'Soporte técnico dedicado'
      ],
      screenshots: [
        '/assets/app4-screenshot1.png',
        '/assets/app4-screenshot2.png'
      ],
      isBeta: true
    },
    {
      id: 'kling-text-to-video',
      name: 'Kling Text-to-Video',
      description: 'Convierte textos en videos animados automáticamente',
      price: 'free',
      category: 'video',
      icon: <VideoIcon className="h-6 w-6" />,
      rating: 4.1,
      downloads: '300K+',
      features: [
        'Generación de videos a partir de texto',
        'Múltiples estilos visuales',
        'Narración automática de voz',
        'Exportación en múltiples formatos'
      ],
      screenshots: [
        '/assets/app5-screenshot1.png',
        '/assets/app5-screenshot2.png'
      ],
      isBeta: true
    },
    {
      id: 'kling-ar-toolkit',
      name: 'Kling AR Toolkit',
      description: 'Crea experiencias de realidad aumentada con IA',
      price: 6.99,
      category: 'tools',
      icon: <CloudLightning className="h-6 w-6" />,
      rating: 4.6,
      downloads: '250K+',
      features: [
        'Reconocimiento de objetos en tiempo real',
        'Superposición de elementos 3D',
        'Tracking facial avanzado',
        'Integración con cámara del dispositivo'
      ],
      screenshots: [
        '/assets/app6-screenshot1.png',
        '/assets/app6-screenshot2.png'
      ],
      isNew: true
    }
  ];
  
  const handleDownload = (app: MobileApp) => {
    toast({
      title: `Descargando ${app.name}`,
      description: `Esta aplicación está en versión beta hasta el 1 de abril de 2025.`,
    });
  };
  
  const handlePurchase = (app: MobileApp) => {
    toast({
      title: `Comprando ${app.name}`,
      description: `Precio: ${typeof app.price === 'number' ? `$${app.price.toFixed(2)}` : 'Gratis'}`,
    });
  };
  
  const handleTryService = (service: KlingService) => {
    window.location.href = service.route;
  };
  
  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Kling Store</h1>
          <p className="text-muted-foreground">
            Explora aplicaciones móviles y servicios web de IA para impulsar tu creatividad
          </p>
        </div>
        
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-8">
            <TabsTrigger value="services" className="flex items-center">
              <AppWindow className="mr-2 h-4 w-4" />
              <span>Servicios Web</span>
            </TabsTrigger>
            <TabsTrigger value="apps" className="flex items-center">
              <Smartphone className="mr-2 h-4 w-4" />
              <span>Aplicaciones Móviles</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Pestaña de Servicios Web */}
          <TabsContent value="services" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {klingServices.map((service) => (
                <Card key={service.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="bg-primary/10 p-2 rounded-md">{service.icon}</div>
                      <Badge variant="outline">${service.price} {service.unit}</Badge>
                    </div>
                    <CardTitle className="mt-4">{service.name}</CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Características</h4>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                          {service.features.map((feature, idx) => (
                            <li key={idx}>{feature}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Casos de uso:</h4>
                        <p className="text-sm text-muted-foreground">{service.usage}</p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      onClick={() => handleTryService(service)}
                    >
                      Probar Ahora
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-lg mt-8">
              <h3 className="text-xl font-bold mb-2">Información de Precios</h3>
              <p className="mb-4">
                Todos los servicios están en fase beta hasta el 1 de abril de 2025. 
                Durante este período, podrías encontrar algunas limitaciones o cambios en la funcionalidad.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="p-4 bg-white dark:bg-slate-800 rounded-md">
                  <h4 className="font-medium flex items-center">
                    <Shirt className="h-4 w-4 mr-2" />
                    Virtual Try-On
                  </h4>
                  <p className="text-sm mt-1">$0.07 por imagen generada</p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-md">
                  <h4 className="font-medium flex items-center">
                    <Mic className="h-4 w-4 mr-2" />
                    Lipsync
                  </h4>
                  <p className="text-sm mt-1">$0.10 por cada 5 segundos</p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-md">
                  <h4 className="font-medium flex items-center">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Effects
                  </h4>
                  <p className="text-sm mt-1">$0.26 por generación</p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Pestaña de Aplicaciones Móviles */}
          <TabsContent value="apps" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {mobileApps.map((app) => (
                <Card key={app.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="bg-primary/10 p-2 rounded-md">{app.icon}</div>
                      <div className="flex items-center gap-2">
                        {app.isNew && <Badge variant="secondary">Nuevo</Badge>}
                        {app.isBeta && <Badge variant="outline">Beta</Badge>}
                      </div>
                    </div>
                    <CardTitle className="mt-4">{app.name}</CardTitle>
                    <CardDescription>{app.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-500 mr-1" />
                          <span className="text-sm font-medium">{app.rating}</span>
                        </div>
                        <div className="flex items-center">
                          <Download className="h-4 w-4 mr-1" />
                          <span className="text-sm text-muted-foreground">{app.downloads}</span>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-2">Características</h4>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                          {app.features.map((feature, idx) => (
                            <li key={idx}>{feature}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3">
                    <Button 
                      className="w-full" 
                      onClick={() => handleDownload(app)}
                    >
                      <SmartphoneCharging className="mr-2 h-4 w-4" />
                      Descargar
                    </Button>
                    {typeof app.price === 'number' && (
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={() => handlePurchase(app)}
                      >
                        Comprar (${app.price.toFixed(2)})
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-lg mt-8">
              <h3 className="text-xl font-bold mb-2">Información Importante</h3>
              <p className="mb-4">
                Todas las aplicaciones móviles están en fase beta hasta el 1 de abril de 2025. Durante este período, 
                podrías encontrar algunas limitaciones o cambios en la funcionalidad. 
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-white dark:bg-slate-800 rounded-md">
                  <h4 className="font-medium flex items-center">
                    <SmartphoneCharging className="h-4 w-4 mr-2" />
                    Compatibilidad
                  </h4>
                  <p className="text-sm mt-1">
                    Las aplicaciones son compatibles con dispositivos iOS 14+ y Android 8+. 
                    Algunas funciones avanzadas pueden requerir hardware más reciente.
                  </p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-md">
                  <h4 className="font-medium flex items-center">
                    <Crown className="h-4 w-4 mr-2" />
                    Suscripciones
                  </h4>
                  <p className="text-sm mt-1">
                    Las aplicaciones marcadas como "Gratis" pueden ofrecer compras in-app o planes de suscripción 
                    para funciones premium.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}