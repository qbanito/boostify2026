import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Download, Image, FileText, Video, Mail, Smartphone, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export function AffiliateMarketingMaterials() {
  // Obtener materiales de marketing
  const { data: materialsData, isLoading } = useQuery({
    queryKey: ['/api/affiliate/marketing-materials'],
  });

  const materials = materialsData?.data || [];

  // Agrupar materiales por tipo
  const materialsByType = {
    banner: materials.filter((m: any) => m.type === 'banner'),
    social: materials.filter((m: any) => m.type === 'social'),
    template: materials.filter((m: any) => m.type === 'template'),
    video: materials.filter((m: any) => m.type === 'video'),
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      banner: Image,
      social: Smartphone,
      template: FileText,
      video: Video
    };
    return icons[type as keyof typeof icons] || FileText;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      banner: "text-blue-500",
      social: "text-pink-500",
      template: "text-green-500",
      video: "text-purple-500"
    };
    return colors[type as keyof typeof colors] || "text-gray-500";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" />
          Materiales de Marketing
        </h2>
        <p className="text-muted-foreground mt-1">
          Descarga recursos profesionales para promocionar productos efectivamente
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Image className="h-4 w-4 text-blue-500" />
              Banners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{materialsByType.banner.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-pink-500" />
              Redes Sociales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{materialsByType.social.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-500" />
              Plantillas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{materialsByType.template.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Video className="h-4 w-4 text-purple-500" />
              Videos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{materialsByType.video.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs por categoría */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">Todos ({materials.length})</TabsTrigger>
          <TabsTrigger value="banner">Banners</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="template">Plantillas</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <MaterialGrid materials={materials} />
        </TabsContent>

        <TabsContent value="banner" className="space-y-4">
          <MaterialGrid materials={materialsByType.banner} />
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <MaterialGrid materials={materialsByType.social} />
        </TabsContent>

        <TabsContent value="template" className="space-y-4">
          <MaterialGrid materials={materialsByType.template} />
        </TabsContent>

        <TabsContent value="video" className="space-y-4">
          <MaterialGrid materials={materialsByType.video} />
        </TabsContent>
      </Tabs>

      {/* Consejos de uso */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Consejos para Usar los Materiales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">1</span>
            </div>
            <div>
              <p className="font-medium">Personaliza los mensajes</p>
              <p className="text-sm text-muted-foreground">
                Aunque los materiales están listos para usar, agregar tu toque personal aumenta las conversiones
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">2</span>
            </div>
            <div>
              <p className="font-medium">Usa tus enlaces de afiliado</p>
              <p className="text-sm text-muted-foreground">
                Reemplaza las URLs en las plantillas con tus enlaces de tracking personalizados
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">3</span>
            </div>
            <div>
              <p className="font-medium">Prueba diferentes formatos</p>
              <p className="text-sm text-muted-foreground">
                Experimenta con banners, videos y posts sociales para encontrar qué funciona mejor para tu audiencia
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente auxiliar para mostrar grid de materiales
function MaterialGrid({ materials }: { materials: any[] }) {
  if (materials.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No hay materiales en esta categoría
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {materials.map((material: any) => {
        const Icon = getTypeIcon(material.type);
        const typeColor = getTypeColor(material.type);

        return (
          <Card 
            key={material.id} 
            className="hover:shadow-lg transition-shadow group"
            data-testid={`material-${material.id}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-lg bg-muted/50 ${typeColor}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <Badge variant="secondary">{material.type}</Badge>
              </div>
              <CardTitle className="text-lg mt-3">{material.name}</CardTitle>
              <CardDescription>{material.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {material.dimensions && (
                <div className="bg-muted/30 rounded-md p-2 text-sm">
                  <span className="text-muted-foreground">Dimensiones:</span>{' '}
                  <span className="font-medium">{material.dimensions}</span>
                </div>
              )}
              {material.format && (
                <div className="bg-muted/30 rounded-md p-2 text-sm">
                  <span className="text-muted-foreground">Formato:</span>{' '}
                  <span className="font-medium">{material.format}</span>
                </div>
              )}
              {material.duration && (
                <div className="bg-muted/30 rounded-md p-2 text-sm">
                  <span className="text-muted-foreground">Duración:</span>{' '}
                  <span className="font-medium">{material.duration}</span>
                </div>
              )}
              <Button 
                className="w-full gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                variant="outline"
                onClick={() => {
                  // En producción, esto descargaría el archivo
                  window.open(material.downloadUrl, '_blank');
                }}
                data-testid={`button-download-${material.id}`}
              >
                <Download className="h-4 w-4" />
                Descargar
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function getTypeIcon(type: string) {
  const icons = {
    banner: Image,
    social: Smartphone,
    template: FileText,
    video: Video
  };
  return icons[type as keyof typeof icons] || FileText;
}

function getTypeColor(type: string) {
  const colors = {
    banner: "text-blue-500",
    social: "text-pink-500",
    template: "text-green-500",
    video: "text-purple-500"
  };
  return colors[type as keyof typeof colors] || "text-gray-500";
}
