import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Download, FileText, Video, Image, Link, ExternalLink, BookOpen, Lightbulb, TrendingUp, ThumbsUp } from "lucide-react";

export function AffiliateResources() {
  // Recursos de marketing
  const marketingResources = [
    {
      title: "Guía completa de marketing de afiliados",
      description: "Aprende las mejores prácticas para promocionar productos musicales",
      type: "PDF",
      size: "2.4 MB",
      updated: "25 feb 2025",
      downloadUrl: "#",
      icon: <FileText className="h-6 w-6" />,
    },
    {
      title: "Plantillas para redes sociales",
      description: "Pack de 10 publicaciones personalizables para Instagram, Facebook y Twitter",
      type: "ZIP",
      size: "8.7 MB",
      updated: "12 mar 2025",
      downloadUrl: "#",
      icon: <Image className="h-6 w-6" />,
    },
    {
      title: "Video promocional de Boostify",
      description: "Video de alta calidad que puedes compartir en tus canales",
      type: "MP4",
      size: "45 MB",
      updated: "3 mar 2025",
      downloadUrl: "#",
      icon: <Video className="h-6 w-6" />,
    },
    {
      title: "Banners para web y blog",
      description: "Diferentes tamaños y formatos para integrar en tu sitio web",
      type: "ZIP",
      size: "12.3 MB",
      updated: "18 mar 2025",
      downloadUrl: "#",
      icon: <Image className="h-6 w-6" />,
    },
  ];

  // Recursos educativos
  const educationalResources = [
    {
      title: "Curso básico de afiliados",
      description: "Introducción completa al marketing de afiliados",
      duration: "45 min",
      level: "Principiante",
      url: "#",
      icon: <BookOpen className="h-6 w-6" />,
    },
    {
      title: "Webinar: Optimización de conversiones",
      description: "Aprende a mejorar tus tasas de conversión",
      duration: "60 min",
      level: "Intermedio",
      url: "#",
      icon: <Video className="h-6 w-6" />,
    },
    {
      title: "Email marketing para afiliados",
      description: "Estrategias para crear campañas efectivas",
      duration: "30 min",
      level: "Intermedio",
      url: "#",
      icon: <BookOpen className="h-6 w-6" />,
    },
    {
      title: "SEO para páginas de afiliados",
      description: "Optimiza tu contenido para atraer más tráfico",
      duration: "50 min",
      level: "Avanzado",
      url: "#",
      icon: <TrendingUp className="h-6 w-6" />,
    },
  ];

  // Estrategias de promoción
  const promotionStrategies = [
    {
      title: "Guía de promoción en YouTube",
      description: "Cómo crear contenido efectivo para promocionar productos musicales",
      platform: "YouTube",
      effectiveness: "Alta",
      icon: <Lightbulb className="h-6 w-6" />,
    },
    {
      title: "Estrategia para Instagram",
      description: "Tácticas para promocionar a través de posts, historias y reels",
      platform: "Instagram",
      effectiveness: "Alta",
      icon: <Lightbulb className="h-6 w-6" />,
    },
    {
      title: "Optimización para blogs musicales",
      description: "Cómo integrar enlaces de afiliados en tu blog de manera efectiva",
      platform: "Blog",
      effectiveness: "Media",
      icon: <Lightbulb className="h-6 w-6" />,
    },
    {
      title: "Email marketing para músicos",
      description: "Guía para promocionar a tu lista de correo sin ser invasivo",
      platform: "Email",
      effectiveness: "Alta",
      icon: <Lightbulb className="h-6 w-6" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Recursos para Afiliados</h2>
        <p className="text-muted-foreground">
          Descarga materiales promocionales y educativos para optimizar tus campañas
        </p>
      </div>

      <Tabs defaultValue="marketing" className="w-full">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="marketing">Recursos de Marketing</TabsTrigger>
          <TabsTrigger value="educational">Contenido Educativo</TabsTrigger>
          <TabsTrigger value="strategies">Estrategias de Promoción</TabsTrigger>
        </TabsList>
        
        <TabsContent value="marketing" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {marketingResources.map((resource, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="pb-3 flex flex-row items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {resource.icon}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{resource.title}</CardTitle>
                    <CardDescription>{resource.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Badge variant="outline">{resource.type}</Badge>
                    <span>{resource.size}</span>
                    <span>Actualizado: {resource.updated}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="default" 
                    className="w-full gap-2"
                    onClick={() => window.open(resource.downloadUrl, "_blank")}
                  >
                    <Download className="h-4 w-4" />
                    Descargar recurso
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Enlaces y códigos</CardTitle>
              <CardDescription>Códigos HTML listos para usar en tu sitio web</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Banner horizontal 728x90</div>
                  <Button variant="ghost" size="sm" className="h-7 gap-1">
                    <Link className="h-3.5 w-3.5" />
                    Copiar código
                  </Button>
                </div>
                <div className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                  &lt;a href="https://boostify.com?ref=YOUR_ID"&gt;&lt;img src="https://boostify.com/banners/728x90.jpg" alt="Boostify" width="728" height="90" /&gt;&lt;/a&gt;
                </div>
              </div>
              
              <div className="rounded-md border p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Banner lateral 300x250</div>
                  <Button variant="ghost" size="sm" className="h-7 gap-1">
                    <Link className="h-3.5 w-3.5" />
                    Copiar código
                  </Button>
                </div>
                <div className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                  &lt;a href="https://boostify.com?ref=YOUR_ID"&gt;&lt;img src="https://boostify.com/banners/300x250.jpg" alt="Boostify" width="300" height="250" /&gt;&lt;/a&gt;
                </div>
              </div>
              
              <div className="rounded-md border p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Widget de productos destacados</div>
                  <Button variant="ghost" size="sm" className="h-7 gap-1">
                    <Link className="h-3.5 w-3.5" />
                    Copiar código
                  </Button>
                </div>
                <div className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                  &lt;iframe src="https://boostify.com/widgets/featured?ref=YOUR_ID" width="100%" height="400" frameborder="0"&gt;&lt;/iframe&gt;
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="educational" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {educationalResources.map((resource, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="pb-2 flex flex-row items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {resource.icon}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{resource.title}</CardTitle>
                    <CardDescription>{resource.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Badge variant="outline">{resource.level}</Badge>
                    <span>Duración: {resource.duration}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="default" 
                    className="w-full gap-2"
                    onClick={() => window.open(resource.url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver curso
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Certificación de Afiliado Boostify</CardTitle>
              <CardDescription>
                Obtén tu certificación oficial y destaca como afiliado premium
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Programa de Certificación</h4>
                    <p className="text-sm text-muted-foreground">
                      Completa el curso avanzado y recibe un certificado verificable que puedes mostrar en tu perfil.
                      Los afiliados certificados reciben un 3% adicional en comisiones.
                    </p>
                  </div>
                  <Button className="gap-2 whitespace-nowrap">
                    <BookOpen className="h-4 w-4" />
                    Iniciar certificación
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="strategies" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promotionStrategies.map((strategy, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="pb-2 flex flex-row items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {strategy.icon}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{strategy.title}</CardTitle>
                    <CardDescription>{strategy.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge>{strategy.platform}</Badge>
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-2">Efectividad:</span>
                      <Badge variant={
                        strategy.effectiveness === "Alta" ? "default" :
                        strategy.effectiveness === "Media" ? "outline" : "secondary"
                      }>
                        {strategy.effectiveness}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Consejos de expertos</CardTitle>
              <CardDescription>
                Estrategias avanzadas compartidas por nuestros mejores afiliados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex gap-2 items-start">
                  <ThumbsUp className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Personaliza tu enfoque</p>
                    <p className="text-sm text-muted-foreground">
                      No promociones todos los productos de la misma manera. Adapta tu mensaje a cada plataforma y audiencia específica.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 items-start">
                  <ThumbsUp className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Crea contenido de valor</p>
                    <p className="text-sm text-muted-foreground">
                      Los tutoriales, guías y reviews detalladas generan mucha más confianza que simplemente compartir enlaces.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 items-start">
                  <ThumbsUp className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Aprovecha las historias</p>
                    <p className="text-sm text-muted-foreground">
                      Comparte tu experiencia personal usando los productos. La autenticidad aumenta significativamente las conversiones.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 items-start">
                  <ThumbsUp className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Usa múltiples canales</p>
                    <p className="text-sm text-muted-foreground">
                      No te limites a una sola plataforma. Diversifica tu estrategia en diferentes canales para maximizar tu alcance.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}