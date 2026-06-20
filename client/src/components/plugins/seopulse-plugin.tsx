import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Slider } from '../ui/slider';
import { Check, X, Search, Edit, Save, PlusCircle, Tag, Sparkles, BarChart4, ExternalLink } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

// Interfaz para el contenido SEO
interface SEOContent {
  id: string;
  title: string;
  description: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords: string[];
  url?: string;
  score?: number;
  lastUpdated?: Date;
  type: 'article' | 'news' | 'release' | 'event' | 'page';
}

// Servicio SEOPulse adaptado desde el código original
class SEOPulseService {
  private contents: SEOContent[] = [];
  private defaultKeywords: string[];
  private analyticsData: { date: string; score: number }[] = [];

  constructor() {
    // Utilizamos un valor predeterminado en lugar de process.env para el cliente
    this.defaultKeywords = ["Boostify", "música", "noticias", "artistas", "promoción"];
    
    // Inicializamos con contenido de ejemplo
    this.seedDemoContent();
    this.generateMockAnalytics();
  }

  // Optimiza el contenido para SEO
  optimizeContent(content: SEOContent): SEOContent {
    if (!content.title || !content.description) {
      throw new Error("El contenido debe tener 'title' y 'description'.");
    }
    
    const optimizedContent = { ...content };
    optimizedContent.seoTitle = `${content.title} | Boostify`;
    optimizedContent.seoDescription = content.description.substring(0, 160);
    optimizedContent.keywords = Array.from(
      new Set([...this.defaultKeywords, ...(content.keywords || [])])
    );
    
    // Calculamos una puntuación SEO simplificada (en una aplicación real esto sería más complejo)
    optimizedContent.score = this.calculateSEOScore(optimizedContent);
    optimizedContent.lastUpdated = new Date();
    
    return optimizedContent;
  }

  // Calcula una puntuación SEO basada en criterios simples
  private calculateSEOScore(content: SEOContent): number {
    let score = 0;
    
    // Título: 25 puntos máximo
    if (content.seoTitle) {
      const titleLength = content.seoTitle.length;
      if (titleLength >= 30 && titleLength <= 60) {
        score += 25; // Longitud óptima
      } else if (titleLength > 0) {
        score += 15; // Tiene título pero no es óptimo
      }
    }
    
    // Descripción: 25 puntos máximo
    if (content.seoDescription) {
      const descLength = content.seoDescription.length;
      if (descLength >= 120 && descLength <= 160) {
        score += 25; // Longitud óptima
      } else if (descLength > 0) {
        score += 15; // Tiene descripción pero no es óptima
      }
    }
    
    // Palabras clave: 25 puntos máximo
    if (content.keywords && content.keywords.length > 0) {
      const keywordScore = Math.min(25, content.keywords.length * 5);
      score += keywordScore;
    }
    
    // URL: 25 puntos máximo
    if (content.url) {
      if (content.url.includes(content.title.toLowerCase().replace(/\s+/g, '-'))) {
        score += 25; // URL contiene el título
      } else {
        score += 10; // Tiene URL pero no contiene el título
      }
    }
    
    return score;
  }

  // Añade contenido optimizado
  addContent(content: Omit<SEOContent, 'id' | 'seoTitle' | 'seoDescription' | 'score' | 'lastUpdated'>): SEOContent {
    const newContent: SEOContent = {
      ...content,
      id: crypto.randomUUID(),
      keywords: content.keywords || []
    };
    
    const optimizedContent = this.optimizeContent(newContent);
    this.contents.push(optimizedContent);
    return optimizedContent;
  }

  // Actualiza un contenido existente
  updateContent(id: string, updates: Partial<SEOContent>): SEOContent | null {
    const index = this.contents.findIndex(content => content.id === id);
    if (index === -1) return null;
    
    const updatedContent = {
      ...this.contents[index],
      ...updates
    };
    
    const optimizedContent = this.optimizeContent(updatedContent);
    this.contents[index] = optimizedContent;
    return optimizedContent;
  }

  // Obtiene todos los contenidos
  getAllContents(): SEOContent[] {
    return [...this.contents];
  }

  // Obtiene un contenido por ID
  getContentById(id: string): SEOContent | null {
    return this.contents.find(content => content.id === id) || null;
  }

  // Elimina un contenido
  deleteContent(id: string): boolean {
    const initialLength = this.contents.length;
    this.contents = this.contents.filter(content => content.id !== id);
    return this.contents.length < initialLength;
  }

  // Obtiene estadísticas para el panel
  getStatistics() {
    const totalContents = this.contents.length;
    const averageScore = this.contents.length > 0 
      ? this.contents.reduce((sum, content) => sum + (content.score || 0), 0) / totalContents 
      : 0;
    
    const contentByType = this.contents.reduce((acc, content) => {
      acc[content.type] = (acc[content.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const keywordUsage = this.contents.reduce((acc, content) => {
      content.keywords.forEach(keyword => {
        acc[keyword] = (acc[keyword] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
    
    // Ordenamos las palabras clave por frecuencia
    const topKeywords = Object.entries(keywordUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));
    
    return {
      totalContents,
      averageScore,
      contentByType,
      topKeywords,
      analyticsData: this.analyticsData
    };
  }

  // Añade datos de ejemplo para demostración
  private seedDemoContent() {
    // Artículo de música
    this.addContent({
      title: "Los 10 mejores álbumes indie de 2025",
      description: "Descubre nuestra selección de los mejores lanzamientos indie del año hasta ahora, con análisis detallados de cada álbum y entrevistas exclusivas con los artistas.",
      keywords: ["indie", "álbumes", "2025", "música alternativa", "top 10"],
      url: "https://boostify.com/blog/mejores-albumes-indie-2025",
      type: 'article'
    });
    
    // Noticia musical
    this.addContent({
      title: "Echo Valley anuncia gira mundial para 2025",
      description: "La banda revelación Echo Valley ha anunciado las fechas de su primera gira mundial que comenzará en marzo y visitará más de 30 ciudades en 15 países.",
      keywords: ["Echo Valley", "gira mundial", "conciertos", "eventos"],
      url: "https://boostify.com/noticias/echo-valley-gira-mundial-2025",
      type: 'news'
    });
    
    // Lanzamiento musical
    this.addContent({
      title: "Nuevo single de Lunar Tides - 'Midnight Echoes'",
      description: "Lunar Tides lanza su esperado nuevo single 'Midnight Echoes', el primer adelanto de su próximo álbum que se lanzará este verano.",
      keywords: ["Lunar Tides", "single", "lanzamiento", "Midnight Echoes"],
      url: "https://boostify.com/lanzamientos/lunar-tides-midnight-echoes",
      type: 'release'
    });
    
    // Evento musical
    this.addContent({
      title: "Festival SoundWave 2025: Lineup completo",
      description: "El Festival SoundWave ha revelado su lineup completo para la edición 2025, con headliners de renombre internacional y prometedores talentos emergentes.",
      keywords: ["SoundWave", "festival", "lineup", "música en vivo"],
      url: "https://boostify.com/eventos/soundwave-2025-lineup",
      type: 'event'
    });
    
    // Página web
    this.addContent({
      title: "Servicios de promoción musical para artistas independientes",
      description: "Descubre cómo Boostify puede ayudarte a promocionar tu música, aumentar tu base de fans y mejorar tu presencia en plataformas digitales.",
      keywords: ["promoción musical", "artistas independientes", "marketing musical", "distribución"],
      url: "https://boostify.com/servicios",
      type: 'page'
    });
  }

  // Genera datos de análisis simulados para gráficas
  private generateMockAnalytics() {
    // Generamos datos para los últimos 30 días
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Puntuación SEO simulada entre 65-95 con tendencia alcista
      const baseScore = 65 + (30 - i) * 0.3;
      const randomVariation = Math.random() * 10 - 5; // Variación de ±5 puntos
      const score = Math.min(100, Math.max(0, baseScore + randomVariation));
      
      this.analyticsData.push({
        date: date.toISOString().split('T')[0],
        score: Math.round(score)
      });
    }
  }
}

// Inicializamos el servicio
const seoPulseService = new SEOPulseService();

// Componente principal del plugin
export function SEOPulsePlugin() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [contents, setContents] = useState<SEOContent[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentContent, setCurrentContent] = useState<SEOContent | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formType, setFormType] = useState<SEOContent['type']>('article');
  const [formUrl, setFormUrl] = useState('');
  const { toast } = useToast();
  
  // Cargar datos
  useEffect(() => {
    // Simulamos carga asíncrona
    setTimeout(() => {
      setContents(seoPulseService.getAllContents());
      setStatistics(seoPulseService.getStatistics());
      setIsLoading(false);
    }, 800);
  }, []);
  
  // Función para crear o actualizar contenido
  const handleSaveContent = () => {
    if (!formTitle.trim() || !formDescription.trim()) {
      toast({
        title: "Campos requeridos",
        description: "El título y la descripción son obligatorios.",
        variant: "destructive"
      });
      return;
    }
    
    const contentData = {
      title: formTitle,
      description: formDescription,
      keywords: formKeywords.split(',').map(k => k.trim()).filter(k => k),
      type: formType,
      url: formUrl
    };
    
    try {
      if (editMode && currentContent) {
        // Actualizar contenido existente
        const updated = seoPulseService.updateContent(currentContent.id, contentData);
        if (updated) {
          setContents(seoPulseService.getAllContents());
          setStatistics(seoPulseService.getStatistics());
          
          toast({
            title: "Contenido actualizado",
            description: "La optimización SEO se ha aplicado correctamente.",
          });
          
          // Resetear formulario
          resetForm();
        }
      } else {
        // Crear nuevo contenido
        const newContent = seoPulseService.addContent(contentData);
        setContents(prevContents => [...prevContents, newContent]);
        setStatistics(seoPulseService.getStatistics());
        
        toast({
          title: "Contenido añadido",
          description: "El nuevo contenido ha sido optimizado para SEO.",
        });
        
        // Resetear formulario
        resetForm();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Ha ocurrido un error",
        variant: "destructive"
      });
    }
  };
  
  // Función para eliminar contenido
  const handleDeleteContent = (id: string) => {
    const deleted = seoPulseService.deleteContent(id);
    if (deleted) {
      setContents(prevContents => prevContents.filter(content => content.id !== id));
      setStatistics(seoPulseService.getStatistics());
      
      toast({
        title: "Contenido eliminado",
        description: "El contenido ha sido eliminado correctamente.",
      });
      
      if (currentContent?.id === id) {
        resetForm();
      }
    }
  };
  
  // Función para editar contenido
  const handleEditContent = (content: SEOContent) => {
    setCurrentContent(content);
    setFormTitle(content.title);
    setFormDescription(content.description);
    setFormKeywords(content.keywords.join(', '));
    setFormType(content.type);
    setFormUrl(content.url || '');
    setEditMode(true);
    setActiveTab('optimize');
  };
  
  // Resetear formulario
  const resetForm = () => {
    setCurrentContent(null);
    setFormTitle('');
    setFormDescription('');
    setFormKeywords('');
    setFormType('article');
    setFormUrl('');
    setEditMode(false);
  };
  
  // Renderizar badge según la puntuación SEO
  const renderScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500">Excelente</Badge>;
    if (score >= 70) return <Badge className="bg-blue-500">Bueno</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-500">Mejorable</Badge>;
    return <Badge className="bg-red-500">Deficiente</Badge>;
  };
  
  // Renderizar tipo de contenido
  const renderContentType = (type: SEOContent['type']) => {
    const typeLabels: Record<SEOContent['type'], string> = {
      article: 'Artículo',
      news: 'Noticia',
      release: 'Lanzamiento',
      event: 'Evento',
      page: 'Página'
    };
    
    return typeLabels[type] || type;
  };
  
  // Renderizar gráfica simple de puntuación SEO
  const renderSEOChart = () => {
    if (!statistics || !statistics.analyticsData) return null;
    
    const chartHeight = 200;
    const chartWidth = 600;
    const data = statistics.analyticsData;
    const maxScore = 100;
    
    return (
      <div className="relative h-[240px] w-full mt-4">
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-muted-foreground">
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
          <span>0</span>
        </div>
        <div className="absolute left-6 right-6 top-0 bottom-0">
          <div className="relative h-full w-full">
            {/* Líneas horizontales de referencia */}
            <div className="absolute w-full h-[1px] bg-muted top-0"></div>
            <div className="absolute w-full h-[1px] bg-muted top-1/4"></div>
            <div className="absolute w-full h-[1px] bg-muted top-1/2"></div>
            <div className="absolute w-full h-[1px] bg-muted top-3/4"></div>
            <div className="absolute w-full h-[1px] bg-muted bottom-0"></div>
            
            {/* Línea principal */}
            <svg className="absolute inset-0" width="100%" height="100%" viewBox={`0 0 ${data.length} ${maxScore}`} preserveAspectRatio="none">
              <linearGradient id="seo-chart-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(249, 115, 22, 0.8)" />
                <stop offset="100%" stopColor="rgba(249, 115, 22, 0.2)" />
              </linearGradient>
              
              {/* Área bajo la curva */}
              <path
                d={`
                  M0,${maxScore - data[0].score}
                  ${data.map((d: {date: string; score: number}, i: number) => `L${i},${maxScore - d.score}`).join(' ')}
                  L${data.length - 1},${maxScore}
                  L0,${maxScore}
                  Z
                `}
                fill="url(#seo-chart-gradient)"
                strokeWidth="0"
              />
              
              {/* Línea principal */}
              <path
                d={`
                  M0,${maxScore - data[0].score}
                  ${data.map((d: {date: string; score: number}, i: number) => `L${i},${maxScore - d.score}`).join(' ')}
                `}
                fill="none"
                stroke="#f97316"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        
        {/* Etiquetas de fechas */}
        <div className="absolute left-6 right-6 bottom-[-20px] flex justify-between text-xs text-muted-foreground">
          <span>{data[0].date.split('-').slice(1).join('/')}</span>
          <span>{data[Math.floor(data.length / 2)].date.split('-').slice(1).join('/')}</span>
          <span>{data[data.length - 1].date.split('-').slice(1).join('/')}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart4 className="h-4 w-4" />
            <span>Panel SEO</span>
          </TabsTrigger>
          <TabsTrigger value="contents" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>Contenidos</span>
          </TabsTrigger>
          <TabsTrigger value="optimize" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>Optimizar</span>
          </TabsTrigger>
        </TabsList>

        {/* Panel de SEO */}
        <TabsContent value="dashboard" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Puntuación SEO Promedio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center py-4">
                      <div className="relative h-32 w-32 flex items-center justify-center">
                        <svg className="absolute" width="100%" height="100%" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="10"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="#f97316"
                            strokeWidth="10"
                            strokeDasharray={2 * Math.PI * 45}
                            strokeDashoffset={2 * Math.PI * 45 * (1 - statistics.averageScore / 100)}
                            transform="rotate(-90 50 50)"
                          />
                        </svg>
                        <span className="text-3xl font-bold">{Math.round(statistics.averageScore)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Contenidos Optimizados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="pt-2">
                      <div className="text-4xl font-bold">{statistics.totalContents}</div>
                      <div className="text-sm text-muted-foreground mt-1">Contenidos en total</div>
                      
                      <div className="mt-4 space-y-2">
                        {Object.entries(statistics.contentByType).map(([type, count]) => (
                          <div key={type} className="flex justify-between items-center">
                            <span className="text-sm">{renderContentType(type as SEOContent['type'])}</span>
                            <Badge variant="secondary">{count as number}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Palabras Clave Principales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="pt-2 flex flex-wrap gap-2">
                      {statistics.topKeywords.slice(0, 8).map((item: {keyword: string, count: number}) => (
                        <Badge key={item.keyword} variant="outline" className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          <span>{item.keyword}</span>
                          <span className="text-xs opacity-70">({item.count})</span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Evolución de Puntuación SEO</CardTitle>
                  <CardDescription>
                    Mejora de la puntuación SEO durante los últimos 30 días
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderSEOChart()}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Lista de contenidos */}
        <TabsContent value="contents" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Contenidos Optimizados</CardTitle>
                  <Button 
                    onClick={() => {
                      resetForm();
                      setActiveTab('optimize');
                    }}
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Nuevo</span>
                  </Button>
                </div>
                <CardDescription>
                  Gestiona y optimiza tu contenido para mejorar los resultados SEO
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Puntuación</TableHead>
                      <TableHead>Última Actualización</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay contenidos optimizados. ¡Crea tu primer contenido ahora!
                        </TableCell>
                      </TableRow>
                    ) : (
                      contents.map(content => (
                        <TableRow key={content.id}>
                          <TableCell className="font-medium">{content.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{renderContentType(content.type)}</Badge>
                          </TableCell>
                          <TableCell>
                            {content.score !== undefined && renderScoreBadge(content.score)}
                          </TableCell>
                          <TableCell>
                            {content.lastUpdated 
                              ? new Date(content.lastUpdated).toLocaleDateString('es-ES') 
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEditContent(content)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteContent(content.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              {content.url && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => window.open(content.url, '_blank')}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Optimización de contenido */}
        <TabsContent value="optimize" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {editMode ? "Editar Contenido" : "Añadir Nuevo Contenido"}
              </CardTitle>
              <CardDescription>
                Ingresa la información de tu contenido para optimizarlo para SEO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="title">
                  Título
                </label>
                <Input
                  id="title"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Título del contenido"
                />
                {formTitle && (
                  <div className="text-xs text-muted-foreground">
                    <span className={`${formTitle.length > 60 ? 'text-red-500' : formTitle.length < 30 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {formTitle.length} / 60 caracteres
                    </span>
                    <span className="ml-2">
                      {formTitle.length > 60 ? '(Demasiado largo)' : formTitle.length < 30 ? '(Demasiado corto)' : '(Óptimo)'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="description">
                  Descripción
                </label>
                <Textarea
                  id="description"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Descripción del contenido"
                  rows={3}
                />
                {formDescription && (
                  <div className="text-xs text-muted-foreground">
                    <span className={`${formDescription.length > 160 ? 'text-red-500' : formDescription.length < 120 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {formDescription.length} / 160 caracteres
                    </span>
                    <span className="ml-2">
                      {formDescription.length > 160 ? '(Demasiado largo)' : formDescription.length < 120 ? '(Demasiado corto)' : '(Óptimo)'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="keywords">
                  Palabras Clave (separadas por comas)
                </label>
                <Input
                  id="keywords"
                  value={formKeywords}
                  onChange={e => setFormKeywords(e.target.value)}
                  placeholder="música, artistas, indie"
                />
                {formKeywords && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formKeywords.split(',').map(k => k.trim()).filter(k => k).map((keyword, idx) => (
                      <Badge key={idx} variant="outline" className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        <span>{keyword}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="type">
                  Tipo de Contenido
                </label>
                <select
                  id="type"
                  value={formType}
                  onChange={e => setFormType(e.target.value as SEOContent['type'])}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="article">Artículo</option>
                  <option value="news">Noticia</option>
                  <option value="release">Lanzamiento</option>
                  <option value="event">Evento</option>
                  <option value="page">Página</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="url">
                  URL (opcional)
                </label>
                <Input
                  id="url"
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                  placeholder="https://boostify.com/contenido"
                />
                {formUrl && formTitle && (
                  <div className="text-xs text-muted-foreground">
                    <span className={formUrl.includes(formTitle.toLowerCase().replace(/\s+/g, '-')) ? 'text-green-500' : 'text-yellow-500'}>
                      {formUrl.includes(formTitle.toLowerCase().replace(/\s+/g, '-'))
                        ? 'URL contiene palabras del título (Óptimo)'
                        : 'Considera incluir palabras del título en la URL'}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button onClick={handleSaveContent}>
                {editMode ? "Actualizar" : "Optimizar y Guardar"}
              </Button>
            </CardFooter>
          </Card>
          
          {currentContent && currentContent.score !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle>Previsualización SEO</CardTitle>
                <CardDescription>
                  Así se verá tu contenido en los resultados de búsqueda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md p-4 space-y-1">
                  <div className="text-sm text-green-700 truncate">
                    {currentContent.url || 'www.boostify.com/contenido'}
                  </div>
                  <div className="text-blue-600 text-lg font-medium">
                    {currentContent.seoTitle || `${currentContent.title} | Boostify`}
                  </div>
                  <div className="text-sm text-gray-700 line-clamp-2">
                    {currentContent.seoDescription || currentContent.description}
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Puntuación SEO</div>
                    <div>{renderScoreBadge(currentContent.score)}</div>
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs">Título SEO</span>
                        {currentContent.seoTitle && currentContent.seoTitle.length >= 30 && currentContent.seoTitle.length <= 60 ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            currentContent.seoTitle && currentContent.seoTitle.length >= 30 && currentContent.seoTitle.length <= 60
                              ? 'bg-green-500'
                              : 'bg-yellow-500'
                          }`}
                          style={{
                            width: `${Math.min(100, (currentContent.seoTitle?.length || 0) / 0.6)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs">Descripción SEO</span>
                        {currentContent.seoDescription && currentContent.seoDescription.length >= 120 && currentContent.seoDescription.length <= 160 ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            currentContent.seoDescription && currentContent.seoDescription.length >= 120 && currentContent.seoDescription.length <= 160
                              ? 'bg-green-500'
                              : 'bg-yellow-500'
                          }`}
                          style={{
                            width: `${Math.min(100, (currentContent.seoDescription?.length || 0) / 1.6)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs">Palabras Clave</span>
                        {currentContent.keywords.length >= 5 ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            currentContent.keywords.length >= 5
                              ? 'bg-green-500'
                              : 'bg-yellow-500'
                          }`}
                          style={{
                            width: `${Math.min(100, (currentContent.keywords.length || 0) * 10)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}