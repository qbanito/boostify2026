import { useState } from "react";
import { 
  FileText, Download, BookOpen, PresentationIcon, 
  Image, Video, ShoppingBag, Users
} from "lucide-react";

import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

// Define types for resources
interface Resource {
  id: string;
  title: string;
  description: string;
  type: string;
  format: string;
  url?: string;
  downloadable: boolean;
  language: "en" | "es";
  tags: string[];
}

export function AffiliateResources() {
  const [language, setLanguage] = useState<"en" | "es">("en");
  
  // Sample resource data
  const resources: Resource[] = [
    {
      id: "1",
      title: "Investment Plans Overview",
      description: "Detailed explanation of our investment plans, features, and benefits.",
      type: "marketing",
      format: "pdf",
      url: "/resources/investment-plans-overview.pdf",
      downloadable: true,
      language: "en",
      tags: ["investment", "plans", "overview"]
    },
    {
      id: "2",
      title: "Affiliate Marketing Fundamentals",
      description: "Learn the basics of successful affiliate marketing for financial products.",
      type: "educational",
      format: "pdf",
      url: "/resources/affiliate-marketing-fundamentals.pdf",
      downloadable: true,
      language: "en",
      tags: ["basics", "guide", "tutorial"]
    },
    {
      id: "3",
      title: "Social Media Templates Pack",
      description: "Ready-to-use social media templates for promoting our investment plans.",
      type: "marketing",
      format: "zip",
      url: "/resources/social-media-templates.zip",
      downloadable: true,
      language: "en",
      tags: ["social media", "templates", "graphics"]
    },
    {
      id: "4",
      title: "Email Marketing Sequences",
      description: "Pre-written email sequences to promote our investment plans.",
      type: "marketing",
      format: "pdf",
      url: "/resources/email-sequences.pdf",
      downloadable: true,
      language: "en",
      tags: ["email", "templates", "sequences"]
    },
    {
      id: "5",
      title: "Promotional Banner Set",
      description: "High-quality banner images in multiple sizes for websites and blogs.",
      type: "marketing",
      format: "zip",
      url: "/resources/banner-set.zip",
      downloadable: true,
      language: "en",
      tags: ["banners", "graphics", "website"]
    },
    {
      id: "6",
      title: "Video Testimonials",
      description: "Customer testimonial videos you can use in your marketing.",
      type: "marketing",
      format: "video",
      url: "/resources/testimonials.mp4",
      downloadable: true,
      language: "en",
      tags: ["testimonials", "videos", "social proof"]
    },
    {
      id: "7",
      title: "Investment ROI Calculator",
      description: "Interactive tool to help your audience calculate potential returns.",
      type: "tool",
      format: "web",
      url: "/tools/roi-calculator",
      downloadable: false,
      language: "en",
      tags: ["calculator", "tool", "roi"]
    },
    {
      id: "8",
      title: "Affiliate Success Guide",
      description: "Comprehensive guide with tips and strategies to maximize your earnings.",
      type: "educational",
      format: "pdf",
      url: "/resources/affiliate-success-guide.pdf",
      downloadable: true,
      language: "en",
      tags: ["guide", "strategies", "tips"]
    },
    // Spanish resources
    {
      id: "9",
      title: "Descripción de Planes de Inversión",
      description: "Explicación detallada de nuestros planes de inversión, características y beneficios.",
      type: "marketing",
      format: "pdf",
      url: "/resources/planes-inversion-descripcion.pdf",
      downloadable: true,
      language: "es",
      tags: ["inversión", "planes", "resumen"]
    },
    {
      id: "10",
      title: "Fundamentos de Marketing de Afiliados",
      description: "Aprende los conceptos básicos del marketing de afiliados exitoso para productos financieros.",
      type: "educational",
      format: "pdf",
      url: "/resources/fundamentos-marketing-afiliados.pdf",
      downloadable: true,
      language: "es",
      tags: ["básicos", "guía", "tutorial"]
    },
    {
      id: "11",
      title: "Paquete de Plantillas para Redes Sociales",
      description: "Plantillas listas para usar en redes sociales para promocionar nuestros planes de inversión.",
      type: "marketing",
      format: "zip",
      url: "/resources/plantillas-redes-sociales.zip",
      downloadable: true,
      language: "es",
      tags: ["redes sociales", "plantillas", "gráficos"]
    },
    {
      id: "12",
      title: "Secuencias de Email Marketing",
      description: "Secuencias de correo electrónico preescritas para promocionar nuestros planes de inversión.",
      type: "marketing",
      format: "pdf",
      url: "/resources/secuencias-email.pdf",
      downloadable: true,
      language: "es",
      tags: ["email", "plantillas", "secuencias"]
    },
    {
      id: "13",
      title: "Conjunto de Banners Promocionales",
      description: "Imágenes de banner de alta calidad en múltiples tamaños para sitios web y blogs.",
      type: "marketing",
      format: "zip",
      url: "/resources/conjunto-banners.zip",
      downloadable: true,
      language: "es",
      tags: ["banners", "gráficos", "sitio web"]
    },
    {
      id: "14",
      title: "Testimonios en Video",
      description: "Videos de testimonios de clientes que puedes usar en tu marketing.",
      type: "marketing",
      format: "video",
      url: "/resources/testimonios.mp4",
      downloadable: true,
      language: "es",
      tags: ["testimonios", "videos", "prueba social"]
    },
    {
      id: "15",
      title: "Calculadora de ROI de Inversión",
      description: "Herramienta interactiva para ayudar a tu audiencia a calcular retornos potenciales.",
      type: "tool",
      format: "web",
      url: "/tools/calculadora-roi",
      downloadable: false,
      language: "es",
      tags: ["calculadora", "herramienta", "roi"]
    },
    {
      id: "16",
      title: "Guía para el Éxito de Afiliados",
      description: "Guía completa con consejos y estrategias para maximizar tus ganancias.",
      type: "educational",
      format: "pdf",
      url: "/resources/guia-exito-afiliados.pdf",
      downloadable: true,
      language: "es",
      tags: ["guía", "estrategias", "consejos"]
    },
  ];

  // Filter resources by language
  const filteredResources = resources.filter(resource => resource.language === language);

  // Render format icon based on resource format
  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return <FileText className="h-4 w-4" />;
      case 'zip':
        return <Download className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'web':
        return <BookOpen className="h-4 w-4" />;
      case 'presentation':
        return <PresentationIcon className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Render resource type icon based on resource type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'marketing':
        return <ShoppingBag className="h-4 w-4" />;
      case 'educational':
        return <BookOpen className="h-4 w-4" />;
      case 'tool':
        return <Users className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Group resources by type for tabbed display
  const marketingResources = filteredResources.filter(r => r.type === 'marketing');
  const educationalResources = filteredResources.filter(r => r.type === 'educational');
  const toolResources = filteredResources.filter(r => r.type === 'tool');

  return (
    <div className="w-full max-w-5xl mx-auto">
      <Tabs defaultValue="en" onValueChange={(value) => setLanguage(value as "en" | "es")}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="en">English</TabsTrigger>
          <TabsTrigger value="es">Español</TabsTrigger>
        </TabsList>
      </Tabs>

      <h1 className="text-3xl font-bold mb-6">
        {language === "en" ? "Affiliate Resources" : "Recursos para Afiliados"}
      </h1>
      
      <Tabs defaultValue="marketing" className="mb-8">
        <TabsList className="w-full">
          <TabsTrigger value="marketing">
            <ShoppingBag className="h-4 w-4 mr-2" />
            {language === "en" ? "Marketing Materials" : "Materiales de Marketing"}
          </TabsTrigger>
          <TabsTrigger value="educational">
            <BookOpen className="h-4 w-4 mr-2" />
            {language === "en" ? "Educational Resources" : "Recursos Educativos"}
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Users className="h-4 w-4 mr-2" />
            {language === "en" ? "Tools" : "Herramientas"}
          </TabsTrigger>
        </TabsList>

        {/* Marketing Materials Tab */}
        <TabsContent value="marketing" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketingResources.map(resource => (
              <ResourceCard 
                key={resource.id} 
                resource={resource} 
                language={language} 
                getFormatIcon={getFormatIcon}
                getTypeIcon={getTypeIcon}
              />
            ))}
          </div>
        </TabsContent>

        {/* Educational Resources Tab */}
        <TabsContent value="educational" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {educationalResources.map(resource => (
              <ResourceCard 
                key={resource.id} 
                resource={resource} 
                language={language} 
                getFormatIcon={getFormatIcon}
                getTypeIcon={getTypeIcon}
              />
            ))}
          </div>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {toolResources.map(resource => (
              <ResourceCard 
                key={resource.id} 
                resource={resource} 
                language={language} 
                getFormatIcon={getFormatIcon}
                getTypeIcon={getTypeIcon}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Resource Card Component
interface ResourceCardProps {
  resource: Resource;
  language: "en" | "es";
  getFormatIcon: (format: string) => React.ReactNode;
  getTypeIcon: (type: string) => React.ReactNode;
}

function ResourceCard({ resource, language, getFormatIcon, getTypeIcon }: ResourceCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{resource.title}</CardTitle>
          <Badge variant="secondary" className="flex items-center gap-1">
            {getFormatIcon(resource.format)}
            <span className="uppercase text-xs">{resource.format}</span>
          </Badge>
        </div>
        <CardDescription>{resource.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {resource.tags.map(tag => (
            <Badge key={tag} variant="outline">{tag}</Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Badge variant="outline" className="flex items-center gap-1">
          {getTypeIcon(resource.type)}
          <span>
            {resource.type === 'marketing' && (language === "en" ? "Marketing" : "Marketing")}
            {resource.type === 'educational' && (language === "en" ? "Educational" : "Educativo")}
            {resource.type === 'tool' && (language === "en" ? "Tool" : "Herramienta")}
          </span>
        </Badge>
        {resource.downloadable ? (
          <Button size="sm" variant="default" className="flex items-center gap-1" asChild>
            <a href={resource.url} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              <span>{language === "en" ? "Download" : "Descargar"}</span>
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="default" className="flex items-center gap-1" asChild>
            <a href={resource.url} target="_blank" rel="noopener noreferrer">
              <BookOpen className="h-4 w-4" />
              <span>{language === "en" ? "Open" : "Abrir"}</span>
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}