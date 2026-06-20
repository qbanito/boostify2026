import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { Product, AffiliateContentType } from "../types/affiliate";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Sparkles, Copy, CheckCircle2, RotateCcw, Loader2, Save, Trash2, Download, Share2, SquarePen, Facebook, Instagram, Twitter, Youtube, ArrowRight, Wand2, Mail, Globe, FileText, Video, Link, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface AffiliateContentGeneratorProps {
  affiliateData: any;
}

// Usando los tipos definidos en types/affiliate.ts
// AffiliateProduct ya no es necesario, usamos Product de types/affiliate.ts

interface AffiliateContent {
  id: string;
  userId: string;
  content: string;
  title: string;
  tags: string[];
  productId: string;
  productName: string;
  contentType: string;
  platform: string;
  createdAt: any; // Este tipo debería ser Timestamp de Firestore, pero para simplificar
}

// Esquema de validación para el formulario de generación de contenido
const contentFormSchema = z.object({
  productId: z.string({ required_error: "Selecciona un producto" }),
  contentType: z.string({ required_error: "Selecciona un tipo de contenido" }),
  platform: z.string({ required_error: "Selecciona una plataforma" }),
  tone: z.string().optional(),
  additionalInfo: z.string().max(300, { message: "La información adicional no puede exceder los 300 caracteres" }).optional(),
});

type ContentFormValues = z.infer<typeof contentFormSchema>;

// Esquema para guardar contenido generado
const saveContentSchema = z.object({
  title: z.string().min(3, { message: "El título debe tener al menos 3 caracteres" }).max(100),
  tags: z.string().optional(),
});

type SaveContentValues = z.infer<typeof saveContentSchema>;

export function AffiliateContentGenerator({ affiliateData }: AffiliateContentGeneratorProps) {
  const { user } = useAuth() || {};
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("generate");
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentContentType, setCurrentContentType] = useState<string | null>(null);
  const [currentPlatform, setCurrentPlatform] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  // Inicializar useForm con el esquema de validación
  const form = useForm<ContentFormValues>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      productId: "",
      contentType: "",
      platform: "",
      tone: "friendly",
      additionalInfo: "",
    },
  });

  // Formulario para guardar contenido
  const saveForm = useForm<SaveContentValues>({
    resolver: zodResolver(saveContentSchema),
    defaultValues: {
      title: "",
      tags: "",
    },
  });

  // Consulta para obtener los productos disponibles para afiliados
  const { data: products, isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["affiliate-products"],
    queryFn: async () => {
      const productsRef = collection(db, "affiliateProducts");
      const querySnapshot = await getDocs(productsRef);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
    },
  });

  // Consulta para obtener el historial de contenido generado
  const { data: contentHistory, isLoading: isLoadingContentHistory } = useQuery<AffiliateContentType[]>({
    queryKey: ["affiliate-content-history", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      const contentRef = collection(db, "affiliateContent");
      const q = query(
        contentRef, 
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        contentType: doc.data().contentType || "post", // Valor por defecto
      })) as AffiliateContentType[];
    },
    enabled: !!user?.uid && activeTab === "history",
  });

  // Mutación para guardar contenido generado
  const saveContentMutation = useMutation({
    mutationFn: async (data: SaveContentValues) => {
      if (!user?.uid || !generatedContent || !currentContentType || !currentPlatform) {
        throw new Error("Faltan datos necesarios");
      }
      
      const productId = form.getValues("productId");
      const selectedProduct = products?.find(p => p.id === productId);
      
      const contentData = {
        userId: user.uid,
        content: generatedContent,
        title: data.title,
        tags: data.tags ? data.tags.split(",").map(tag => tag.trim()) : [],
        productId,
        productName: selectedProduct?.name || "",
        contentType: currentContentType,
        platform: currentPlatform,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, "affiliateContent"), contentData);
      return { id: docRef.id, ...contentData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-content-history", user?.uid] });
      setShowSaveDialog(false);
      setIsSaving(false);
      saveForm.reset();
    },
    onError: (error) => {
      console.error("Error al guardar contenido:", error);
      setIsSaving(false);
    },
  });

  // Tipos de contenido disponibles
  const contentTypes = [
    { value: "post", label: "Publicación", description: "Texto ideal para compartir en redes sociales" },
    { value: "caption", label: "Descripción", description: "Texto corto para acompañar imágenes" },
    { value: "email", label: "Email", description: "Formato para campañas de email marketing" },
    { value: "article", label: "Artículo", description: "Contenido detallado para blogs o sitios web" },
    { value: "video_script", label: "Guión de video", description: "Estructura para crear contenido en video" },
  ];

  // Plataformas disponibles según el tipo de contenido
  const getPlatformsForContentType = (contentType: string) => {
    switch (contentType) {
      case "post":
        return [
          { value: "facebook", label: "Facebook", icon: <Facebook className="h-4 w-4 mr-2" /> },
          { value: "instagram", label: "Instagram", icon: <Instagram className="h-4 w-4 mr-2" /> },
          { value: "twitter", label: "Twitter", icon: <Twitter className="h-4 w-4 mr-2" /> },
        ];
      case "caption":
        return [
          { value: "instagram", label: "Instagram", icon: <Instagram className="h-4 w-4 mr-2" /> },
          { value: "youtube", label: "YouTube", icon: <Youtube className="h-4 w-4 mr-2" /> },
        ];
      case "email":
        return [
          { value: "newsletter", label: "Newsletter", icon: <FileText className="h-4 w-4 mr-2" /> },
          { value: "promotional", label: "Promocional", icon: <FileText className="h-4 w-4 mr-2" /> },
        ];
      case "article":
        return [
          { value: "blog", label: "Blog", icon: <FileText className="h-4 w-4 mr-2" /> },
          { value: "website", label: "Sitio web", icon: <Globe className="h-4 w-4 mr-2" /> },
        ];
      case "video_script":
        return [
          { value: "youtube", label: "YouTube", icon: <Youtube className="h-4 w-4 mr-2" /> },
          { value: "tiktok", label: "TikTok", icon: <Video className="h-4 w-4 mr-2" /> },
          { value: "instagram", label: "Instagram Reels", icon: <Instagram className="h-4 w-4 mr-2" /> },
        ];
      default:
        return [];
    }
  };

  // Tonos de contenido disponibles
  const contentTones = [
    { value: "friendly", label: "Amigable" },
    { value: "professional", label: "Profesional" },
    { value: "enthusiastic", label: "Entusiasta" },
    { value: "informative", label: "Informativo" },
    { value: "persuasive", label: "Persuasivo" },
  ];

  // Ver detalles de plataforma al cambiar tipo de contenido
  const onContentTypeChange = (value: string) => {
    setCurrentContentType(value);
    form.setValue("platform", "");
  };

  // Manejar la generación de contenido
  const onSubmit = async (data: ContentFormValues) => {
    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      setCurrentContentType(data.contentType);
      setCurrentPlatform(data.platform);
      
      // Buscar información del producto seleccionado
      const selectedProduct = products?.find(p => p.id === data.productId);
      
      if (!selectedProduct) {
        throw new Error("Producto no encontrado");
      }
      
      // En una implementación real, aquí se haría la llamada a una API de generación de contenido (OpenAI, etc.)
      // Para simular una generación, usaremos contenido de ejemplo según el tipo
      
      let generatedText = '';
      
      // Simular tiempo de generación
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ejemplos de contenido según el tipo y plataforma
      switch (data.contentType) {
        case "post":
          if (data.platform === "instagram") {
            generatedText = `✨ ¡Eleva tu música al siguiente nivel con ${selectedProduct.name}! ✨\n\nDescubrí la herramienta que está revolucionando la industria musical. Con ${selectedProduct.name} podés potenciar tu sonido de maneras que nunca imaginaste.\n\n¿Por qué elegir ${selectedProduct.name}?\n• Calidad profesional\n• Interfaz intuitiva\n• Resultados inmediatos\n\n¡No esperes más para dar el salto que tu carrera musical necesita! Hacé clic en el link de mi bio para conocer más y obtener un 15% de descuento exclusivo.\n\n#MúsicaProfesional #ProducciónMusical #ArtistasEmergentes #BoostifyMusic`;
          } else if (data.platform === "facebook") {
            generatedText = `¿Buscando mejorar tu producción musical? ${selectedProduct.name} es la respuesta que estabas esperando.\n\nComo productor, siempre estoy en busca de herramientas que realmente marquen la diferencia, y tengo que decir que ${selectedProduct.name} ha transformado completamente mi flujo de trabajo.\n\nLo que más me gusta:\n• La calidad de sonido es impecable\n• La facilidad de uso es sorprendente\n• El soporte técnico responde rápidamente\n\nSi estás en la industria musical y quieres llevar tus creaciones al siguiente nivel, te recomiendo 100% que pruebes ${selectedProduct.name}. ¡No te arrepentirás!\n\nHaz clic en mi enlace para obtener un 15% de descuento exclusivo: [ENLACE DE AFILIADO]`;
          } else if (data.platform === "twitter") {
            generatedText = `Acabo de descubrir ${selectedProduct.name} y ha cambiado completamente mi forma de producir música 🎵\n\nCalidad profesional sin complicaciones ✅\nInterfaz intuitiva ✅\nResultados inmediatos ✅\n\nObtén 15% OFF con mi código: [ENLACE] #MúsicaProfesional #ProducciónMusical`;
          }
          break;
        
        case "caption":
          if (data.platform === "instagram") {
            generatedText = `La herramienta que está revolucionando mi estudio 🎧 ${selectedProduct.name} ha elevado mis producciones a otro nivel. ¿Quieres saber cómo? Enlace en bio para 15% de descuento exclusivo ⬆️ #BoostifyMusic #ProducciónMusical`;
          } else if (data.platform === "youtube") {
            generatedText = `En este video te muestro cómo ${selectedProduct.name} transformó mi proceso creativo y mejoró dramáticamente la calidad de mis producciones. Si quieres probarlo tú mismo, encuentra mi enlace de descuento en la descripción para obtener un 15% OFF. ¡No olvides suscribirte para más consejos de producción musical!`;
          }
          break;
        
        case "email":
          if (data.platform === "newsletter") {
            generatedText = `Asunto: La herramienta secreta de los productores profesionales\n\nHola [Nombre],\n\nEspero que este email te encuentre bien y que tus proyectos musicales estén avanzando con éxito.\n\nHoy quiero compartir contigo un descubrimiento que ha transformado mi estudio y mi flujo de trabajo: ${selectedProduct.name}.\n\nDurante años, he probado decenas de herramientas para mejorar mi producción musical, pero ninguna ha tenido el impacto que ${selectedProduct.name} ha logrado en tan poco tiempo.\n\n¿Qué hace que ${selectedProduct.name} sea tan especial?\n\n1. Calidad profesional sin complicaciones\n2. Interfaz intuitiva que te permite centrarte en la creatividad\n3. Resultados inmediatos que elevan tus producciones\n\nNo se trata solo de otra herramienta más. ${selectedProduct.name} está diseñado específicamente para ayudarte a superar los obstáculos comunes en la producción musical y permitirte crear con libertad.\n\nComo lector de mi newsletter, quiero ofrecerte la oportunidad de probar ${selectedProduct.name} con un 15% de descuento exclusivo. Simplemente haz clic en el siguiente enlace:\n\n[ENLACE DE AFILIADO]\n\nEste descuento estará disponible solo por tiempo limitado, así que no pierdas la oportunidad.\n\n¿Preguntas sobre cómo utilizar ${selectedProduct.name} en tu flujo de trabajo? Responde a este email y estaré encantado de ayudarte.\n\nMusicalmente,\n[Tu nombre]\n\nP.D.: Si ya usas ${selectedProduct.name}, me encantaría conocer tu experiencia. ¡Comparte tus resultados!`;
          } else if (data.platform === "promotional") {
            generatedText = `Asunto: 🎵 15% OFF en ${selectedProduct.name} - Oferta exclusiva por tiempo limitado\n\nHola [Nombre],\n\n¿Estás buscando llevar tu producción musical al siguiente nivel?\n\n**PRESENTANDO ${selectedProduct.name.toUpperCase()}**\n\nLa herramienta que está revolucionando la industria musical ya está disponible con un descuento exclusivo para mis seguidores.\n\n${selectedProduct.name} te ofrece:\n\n✅ Calidad profesional en cada proyecto\n✅ Flujo de trabajo optimizado\n✅ Interfaz intuitiva\n✅ Soporte técnico premium\n\nPor tiempo limitado, puedes obtener ${selectedProduct.name} con un 15% de descuento utilizando mi enlace exclusivo:\n\n[BOTÓN: OBTENER MI 15% DE DESCUENTO]\n\nNo esperes más para transformar tu sonido. Esta oferta expira en 48 horas.\n\n¿Quieres ver ${selectedProduct.name} en acción? Visita mi canal de YouTube donde comparto tutoriales y consejos sobre cómo sacar el máximo provecho de esta increíble herramienta.\n\n¡Mejora tu sonido hoy mismo!\n\n[Tu nombre]\n\nP.D.: ¿Preguntas sobre ${selectedProduct.name}? Responde a este email y te ayudaré personalmente.`;
          }
          break;
        
        case "article":
          if (data.platform === "blog") {
            generatedText = `# Cómo ${selectedProduct.name} Está Revolucionando la Producción Musical\n\n## Introducción\n\nEn el competitivo mundo de la producción musical, mantenerse actualizado con las últimas herramientas y tecnologías es crucial para destacar. Entre las numerosas opciones disponibles, ${selectedProduct.name} ha emergido como un punto de inflexión para productores de todos los niveles. En este artículo, exploraremos por qué ${selectedProduct.name} está generando tanto revuelo en la industria y cómo puede transformar tu flujo de trabajo creativo.\n\n## ¿Qué es ${selectedProduct.name}?\n\n${selectedProduct.name} es una solución innovadora diseñada específicamente para abordar los desafíos comunes que enfrentan los productores musicales modernos. Combinando tecnología de vanguardia con una interfaz intuitiva, ofrece un conjunto de herramientas que optimizan cada fase del proceso de producción.\n\n## Características principales\n\n### Calidad profesional sin complicaciones\n\nA diferencia de otras herramientas que requieren una curva de aprendizaje pronunciada, ${selectedProduct.name} permite obtener resultados profesionales desde el primer uso. Su motor de procesamiento de audio de alta fidelidad garantiza que cada proyecto suene impecable, independientemente de tu nivel de experiencia técnica.\n\n### Flujo de trabajo optimizado\n\nUno de los aspectos más destacados de ${selectedProduct.name} es su capacidad para simplificar procesos complejos. La interfaz está diseñada meticulosamente para eliminar distracciones y permitirte centrarte en lo más importante: tu creatividad. Desde la conceptualización hasta la masterización, cada paso se ha optimizado para maximizar la eficiencia.\n\n### Compatibilidad versátil\n\n${selectedProduct.name} se integra perfectamente con las principales plataformas y DAWs del mercado, lo que facilita su incorporación a tu configuración actual. Esta compatibilidad universal elimina las barreras técnicas y te permite aprovechar sus beneficios sin tener que modificar radicalmente tu flujo de trabajo establecido.\n\n## Mi experiencia personal con ${selectedProduct.name}\n\nComo productor con más de 10 años de experiencia, he probado innumerables herramientas a lo largo de mi carrera. Sin embargo, pocas han tenido un impacto tan inmediato y significativo como ${selectedProduct.name}.\n\nLo que más me impresionó fue cómo transformó proyectos que parecían estancados en producciones vibrantes y dinámicas. El plugin de ${selectedProduct.name} para procesamiento de vocales, en particular, añadió una dimensión completamente nueva a mis mezclas que no había podido lograr con ninguna otra herramienta.\n\n## ¿Vale la pena la inversión?\n\nCualquier herramienta de producción representa una inversión, y es natural preguntarse si ${selectedProduct.name} justifica su precio. Basado en mi experiencia y en los resultados tangibles que he obtenido, puedo afirmar con confianza que ${selectedProduct.name} ofrece un valor excepcional.\n\nConsiderando el tiempo que ahorra, la calidad que aporta y la versatilidad que ofrece, ${selectedProduct.name} se amortiza rápidamente. Además, su equipo de desarrollo lanza actualizaciones regularmente, lo que significa que tu inversión continúa incrementando su valor con el tiempo.\n\n## Conclusión\n\nEn un mercado saturado de herramientas de producción musical, ${selectedProduct.name} logra destacar por su combinación única de simplicidad, potencia y versatilidad. Ya seas un productor novato buscando mejorar la calidad de tus creaciones o un profesional experimentado que busca optimizar su flujo de trabajo, ${selectedProduct.name} tiene algo valioso que ofrecer.\n\nSi estás listo para llevar tu producción musical al siguiente nivel, te recomiendo encarecidamente que pruebes ${selectedProduct.name}. Como lector de mi blog, puedes obtener un 15% de descuento utilizando el código exclusivo en el siguiente enlace: [ENLACE DE AFILIADO].\n\n¿Has probado ${selectedProduct.name} o tienes preguntas sobre cómo integrarlo en tu configuración? Comparte tus pensamientos en los comentarios a continuación, y estaré encantado de discutir más detalles o proporcionar consejos basados en mi experiencia.`;
          } else if (data.platform === "website") {
            generatedText = `# Potencia tu creatividad musical con ${selectedProduct.name}\n\n## La herramienta definitiva para productores y artistas\n\n${selectedProduct.name} representa un avance revolucionario en tecnología de producción musical, diseñado para eliminar barreras técnicas y permitir que tu creatividad fluya sin obstáculos. Desde estudios profesionales hasta configuraciones caseras, ${selectedProduct.name} está transformando cómo los músicos de todo el mundo crean y producen música de calidad profesional.\n\n## Características principales\n\n- **Interfaz intuitiva** que permite resultados profesionales sin necesidad de años de experiencia técnica\n- **Procesamiento de audio de alta fidelidad** que garantiza calidad excepcional en cada proyecto\n- **Plantillas personalizables** creadas por productores de renombre mundial\n- **Integración perfecta** con todas las principales estaciones de trabajo de audio digital\n- **Actualizaciones regulares** que añaden nuevas funcionalidades basadas en feedback de usuarios\n\n## Testimonios de profesionales\n\n> "${selectedProduct.name} ha transformado completamente mi flujo de trabajo. Lo que antes me tomaba horas, ahora puedo lograrlo en minutos con resultados superiores." - Alex Romero, Productor Ganador de Grammy\n\n> "Después de integrar ${selectedProduct.name} en mi estudio, la calidad de mis producciones dio un salto cualitativo que mis clientes notaron inmediatamente." - Sophia Chen, Ingeniera de Mezcla\n\n## Oferta especial para nuestros visitantes\n\nComo parte de nuestra colaboración con Boostify, ofrecemos a los visitantes de nuestra web un **15% de descuento** en la compra de ${selectedProduct.name}.\n\nPara aprovechar esta oferta exclusiva, simplemente haz clic en el botón a continuación y el descuento se aplicará automáticamente a tu compra.\n\n[BOTÓN: OBTENER MI 15% DE DESCUENTO]\n\n*Oferta válida hasta el 30 de julio de 2025*\n\n## Soporte técnico premium\n\nCada licencia de ${selectedProduct.name} incluye acceso a nuestro equipo de soporte técnico especializado, compuesto por productores e ingenieros experimentados que pueden ayudarte a maximizar el potencial de esta herramienta en tu configuración específica.\n\n## Garantía de satisfacción\n\nEstamos tan seguros de la calidad y el impacto positivo que ${selectedProduct.name} tendrá en tu producción musical que ofrecemos una garantía de devolución de dinero de 30 días. Prueba ${selectedProduct.name} sin riesgo y experimenta la diferencia por ti mismo.\n\n## Preguntas frecuentes\n\n**¿${selectedProduct.name} es compatible con mi DAW?**\nSí, ${selectedProduct.name} es compatible con todas las principales estaciones de trabajo de audio digital, incluyendo Logic Pro, Ableton Live, FL Studio, Pro Tools, Cubase, Studio One, y más.\n\n**¿Necesito equipo especializado para utilizar ${selectedProduct.name}?**\nNo, ${selectedProduct.name} está optimizado para funcionar eficientemente en configuraciones de estudio estándar. Consulta los requisitos mínimos del sistema en nuestra página de especificaciones técnicas.\n\n**¿Ofrecen descuentos para estudiantes?**\nSí, tenemos un programa educativo especial. Contacta con nuestro equipo de ventas para más información.\n\n**¿Puedo utilizar ${selectedProduct.name} en múltiples dispositivos?**\nCada licencia permite la instalación en hasta dos dispositivos simultáneamente.`;
          }
          break;
        
        case "video_script":
          if (data.platform === "youtube") {
            generatedText = `# GUIÓN: RESEÑA DE ${selectedProduct.name.toUpperCase()}\n\n## INTRO (0:00-0:30)\n\n[Música de introducción animada]\n\n¡Hola a todos! Bienvenidos a un nuevo video. Hoy les traigo algo que ha transformado completamente mi proceso de producción musical: ${selectedProduct.name}.\n\nSi eres productor, compositor o simplemente te apasiona la música, este video te interesa, porque vamos a explorar en profundidad una herramienta que está revolucionando la industria.\n\n## SECCIÓN 1: ¿QUÉ ES Y POR QUÉ LO NECESITAS? (0:30-2:00)\n\n[Mostrar el producto/interfaz en pantalla]\n\n${selectedProduct.name} es una solución innovadora diseñada específicamente para [describir funcionalidad principal]. A diferencia de otras herramientas similares, ofrece una combinación única de simplicidad y potencia que la hace accesible para principiantes pero suficientemente completa para profesionales.\n\nLo que realmente distingue a ${selectedProduct.name} es su capacidad para [destacar característica principal]. Esto significa que puedes [describir beneficio clave] sin necesidad de pasar horas ajustando configuraciones técnicas.\n\nDurante mis 10 años en la industria musical, he probado prácticamente todas las opciones disponibles, y puedo decirles con confianza que ${selectedProduct.name} representa un verdadero avance en [categoría del producto].\n\n## SECCIÓN 2: CARACTERÍSTICAS PRINCIPALES (2:00-5:00)\n\n[Demostración práctica de cada característica]\n\nVamos a explorar las características que hacen que ${selectedProduct.name} sea tan especial:\n\n1. **Interfaz intuitiva**: Lo primero que notarás es lo increíblemente fácil que es navegar por su interfaz. Todo está organizado lógicamente, lo que te permite centrarte en tu creatividad en lugar de pelear con la tecnología.\n\n2. **Calidad de sonido excepcional**: El motor de procesamiento de ${selectedProduct.name} ofrece resultados de calidad profesional desde el primer uso. Escuchen esta comparación antes y después...\n\n3. **Flujo de trabajo optimizado**: Con sus plantillas personalizables y atajos inteligentes, ${selectedProduct.name} reduce drásticamente el tiempo que pasas en tareas técnicas y te permite dedicar más tiempo a la creación.\n\n4. **Versatilidad**: Ya sea que trabajes en [género musical 1], [género musical 2] o incluso [género musical 3], ${selectedProduct.name} se adapta perfectamente a tus necesidades específicas.\n\n## SECCIÓN 3: DEMOSTRACIÓN PRÁCTICA (5:00-8:00)\n\n[Mostrar proyecto antes/después]\n\nAhora, permítanme mostrarles ${selectedProduct.name} en acción. Voy a tomar este proyecto en el que estaba trabajando la semana pasada y veremos cómo ${selectedProduct.name} transforma completamente el resultado final.\n\n[Demostración paso a paso de las funcionalidades clave]\n\n¿Notan la diferencia? Es realmente impresionante cómo ${selectedProduct.name} puede elevar la calidad de tus producciones con tan poco esfuerzo.\n\n## SECCIÓN 4: COMPARATIVA CON ALTERNATIVAS (8:00-9:30)\n\n[Mostrar tabla comparativa]\n\nMuchos me han preguntado cómo se compara ${selectedProduct.name} con [competidor 1] o [competidor 2]. He preparado esta comparativa para que puedan ver las diferencias clave:\n\n- En términos de usabilidad, ${selectedProduct.name} es claramente superior gracias a su interfaz optimizada.\n- La calidad del sonido está a la par con opciones mucho más costosas del mercado.\n- La relación calidad-precio es donde ${selectedProduct.name} realmente brilla, ofreciendo características premium a un precio accesible.\n\n## SECCIÓN 5: CONCLUSIÓN Y OFERTA ESPECIAL (9:30-10:30)\n\n[Resumen de puntos clave]\n\nEn resumen, ${selectedProduct.name} ha transformado completamente mi flujo de trabajo y la calidad de mis producciones. Si estás buscando mejorar tu sonido y optimizar tu proceso creativo, realmente no puedo recomendar esta herramienta lo suficiente.\n\nAhora, tengo buenas noticias para ustedes. Como espectador de mi canal, puedes obtener un 15% de descuento en ${selectedProduct.name} utilizando el código especial en el enlace de la descripción. Esta oferta es por tiempo limitado, así que no la dejes pasar.\n\n## OUTRO (10:30-11:00)\n\n[Música de cierre]\n\nEso es todo por hoy. Si tienes preguntas sobre ${selectedProduct.name} o quieres compartir tu experiencia con esta herramienta, déjalo en los comentarios. No olvides suscribirte para más contenido sobre producción musical y herramientas que pueden elevar tu creatividad.\n\n¡Gracias por ver y hasta la próxima!`;
          } else if (data.platform === "tiktok") {
            generatedText = `# GUIÓN TIKTOK: ${selectedProduct.name.toUpperCase()} REVIEW\n\n[Texto en pantalla: "La herramienta que está revolucionando la música 🎵"]\n\n¡Atención productores y artistas! 🔥 Descubrí algo que va a cambiar tu sonido para siempre.\n\n[Mostrar interfaz de ${selectedProduct.name}]\n\n${selectedProduct.name} es la nueva herramienta que todos los profesionales están usando para [beneficio principal].\n\n[Texto en pantalla: "Antes vs. Después"]\n\n[Reproducir clip de audio "antes"]\nEscuchen este beat sin procesar...\n\n[Reproducir clip de audio "después"]\n¡Y ahora con ${selectedProduct.name}! ¿Notan la diferencia? 🤯\n\n[Texto en pantalla: "Características principales"]\n\n✅ Interfaz súper intuitiva\n✅ Calidad profesional instantánea\n✅ Compatible con todas las DAWs\n\n[Mostrar rápidamente la herramienta en uso]\n\nLiteralmente me tomó 2 minutos mejorar completamente mi track con esta herramienta.\n\n[Texto en pantalla: "15% DE DESCUENTO"]\n\nLink en mi bio para probar ${selectedProduct.name} con 15% OFF 🔥\n\n#ProducciónMusical #HomeStudio #MúsicaProfesional`;
          } else if (data.platform === "instagram") {
            generatedText = `# GUIÓN REEL: DESCUBRE ${selectedProduct.name.toUpperCase()}\n\n[Texto en pantalla: "El secreto de los productores profesionales"]\n\n[Mirar a cámara con expresión de asombro]\n¿Querés saber qué están usando todos los productores top para conseguir ese sonido profesional? 👀\n\n[Mostrar ${selectedProduct.name} en pantalla]\nSe llama ${selectedProduct.name} y está cambiando las reglas del juego 🎮\n\n[Texto en pantalla: "Resultados inmediatos"]\n\n[Mostrar antes/después rápidamente]\nEscuchá la diferencia... ¡BRUTAL! 🔥\n\n[Mostrar uso rápido de la herramienta]\nEs súper fácil de usar. Literalmente arrastrás, soltás y ¡BOOM! Sonido profesional en segundos ⚡\n\n[Texto en pantalla: "¿Por qué lo necesitás?"]\n\n✅ Mejora la calidad instantáneamente\n✅ Ahorra horas de trabajo\n✅ Resultados de nivel profesional\n\n[Mirar a cámara]\nNo es casualidad que artistas como [Nombre] y [Nombre] lo estén usando en sus producciones.\n\n[Texto en pantalla: "15% DESCUENTO EXCLUSIVO"]\n\nLinkeo en historias para que lo pruebes con 15% OFF 🎁\n\n#ProducciónMusical #CalidadProfesional #EstudioEnCasa`;
          }
          break;
        
        default:
          generatedText = "Lo siento, no se pudo generar contenido para la combinación seleccionada. Por favor, intenta con otro tipo de contenido o plataforma.";
      }
      
      setGeneratedContent(generatedText);
    } catch (err) {
      console.error("Error al generar contenido:", err);
      setGenerationError("Ha ocurrido un error al generar el contenido. Por favor, intenta nuevamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Manejar el guardar contenido
  const onSaveContent = (data: SaveContentValues) => {
    setIsSaving(true);
    saveContentMutation.mutate(data);
  };

  // Copiar contenido al portapapeles
  const copyToClipboard = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch(err => {
          console.error("Error al copiar al portapapeles:", err);
        });
    }
  };

  // Regenerar contenido
  const regenerateContent = () => {
    form.handleSubmit(onSubmit)();
  };

  // Descargar contenido como archivo de texto
  const downloadContent = () => {
    if (generatedContent) {
      const element = document.createElement("a");
      const file = new Blob([generatedContent], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      
      // Crear nombre de archivo basado en tipo de contenido y plataforma
      let contentTypeName = contentTypes.find(t => t.value === currentContentType)?.label || "Contenido";
      let platformName = getPlatformsForContentType(currentContentType || "").find(p => p.value === currentPlatform)?.label || "General";
      
      element.download = `${contentTypeName}_${platformName}_${new Date().toISOString().slice(0,10)}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  // Filtrar el historial por tipo de contenido
  const [contentTypeFilter, setContentTypeFilter] = useState<string | null>(null);
  
  const filteredHistory = contentHistory ? 
    contentTypeFilter ? 
      contentHistory.filter(item => item.contentType === contentTypeFilter) : 
      contentHistory : 
    [];

  // Componente para el icono de plataforma
  const PlatformIcon = ({ platform }: { platform: string }) => {
    switch (platform) {
      case 'facebook':
        return <Facebook className="h-4 w-4" />;
      case 'instagram':
        return <Instagram className="h-4 w-4" />;
      case 'twitter':
        return <Twitter className="h-4 w-4" />;
      case 'youtube':
        return <Youtube className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Generador de Contenido</h2>
          <p className="text-muted-foreground">
            Crea contenido promocional optimizado para diferentes plataformas
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Crear Contenido</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <TabsContent value="generate" className="space-y-6 mt-0">
        <Card>
          <CardHeader>
            <CardTitle>Generador de contenido para afiliados</CardTitle>
            <CardDescription>
              Crea contenido promocional personalizado para diferentes plataformas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <form className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="productId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Producto a promocionar</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un producto" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Productos disponibles</SelectLabel>
                                {isLoadingProducts ? (
                                  <div className="flex items-center justify-center p-2">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Cargando productos...
                                  </div>
                                ) : (
                                  products?.map((product: any) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      {product.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="contentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de contenido</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              onContentTypeChange(value);
                            }} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona tipo de contenido" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Tipos de contenido</SelectLabel>
                                {contentTypes.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex flex-col">
                                      <span>{type.label}</span>
                                      <span className="text-xs text-muted-foreground">{type.description}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="platform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plataforma</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={!form.watch("contentType")}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Primero elige un tipo de contenido" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Plataformas disponibles</SelectLabel>
                                {form.watch("contentType") ? (
                                  getPlatformsForContentType(form.watch("contentType")).map((platform) => (
                                    <SelectItem key={platform.value} value={platform.value}>
                                      <div className="flex items-center">
                                        {platform.icon}
                                        <span>{platform.label}</span>
                                      </div>
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="placeholder" disabled>
                                    Selecciona primero un tipo de contenido
                                  </SelectItem>
                                )}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="tone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tono del contenido</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un tono" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Tonos disponibles</SelectLabel>
                                {contentTones.map((tone) => (
                                  <SelectItem key={tone.value} value={tone.value}>
                                    {tone.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            El tono define cómo se comunica tu mensaje
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="additionalInfo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Información adicional (opcional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Añade información específica que quieres incluir en el contenido..."
                              className="min-h-[120px]" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Puedes incluir detalles específicos, características del producto o aspectos que quieras destacar
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <Button 
                  type="button" 
                  className="w-full flex items-center gap-2"
                  disabled={isGenerating || !form.formState.isValid}
                  onClick={form.handleSubmit(onSubmit)}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generando contenido...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Generar contenido
                    </>
                  )}
                </Button>
                
                {generationError && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{generationError}</AlertDescription>
                  </Alert>
                )}
              </form>
            </Form>
            
            {generatedContent && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Contenido generado</h3>
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={copyToClipboard}
                          >
                            {isCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copiar al portapapeles</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={regenerateContent}
                            disabled={isGenerating}
                          >
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Regenerar contenido</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={downloadContent}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Descargar como archivo</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Guardar contenido</DialogTitle>
                          <DialogDescription>
                            Guarda este contenido en tu biblioteca para usarlo más tarde.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <Form {...saveForm}>
                          <form onSubmit={saveForm.handleSubmit(onSaveContent)} className="space-y-4 py-4">
                            <FormField
                              control={saveForm.control}
                              name="title"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Título</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Nombre para identificar este contenido" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={saveForm.control}
                              name="tags"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Etiquetas (opcionales)</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="instagram, post, verano (separadas por comas)" 
                                      {...field} 
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Añade etiquetas para organizar mejor tu contenido
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <DialogFooter className="pt-4">
                              <Button 
                                type="submit" 
                                disabled={isSaving || !saveForm.formState.isValid}
                                className="w-full"
                              >
                                {isSaving ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                  </>
                                ) : (
                                  "Guardar contenido"
                                )}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="absolute top-2 right-2 flex gap-1">
                    {currentContentType && currentPlatform && (
                      <>
                        <Badge variant="outline" className="text-xs">
                          {contentTypes.find(t => t.value === currentContentType)?.label || currentContentType}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getPlatformsForContentType(currentContentType).find(p => p.value === currentPlatform)?.label || currentPlatform}
                        </Badge>
                      </>
                    )}
                  </div>
                  <Textarea 
                    value={generatedContent} 
                    readOnly 
                    className="min-h-[400px] font-mono text-sm" 
                  />
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="default" 
                    className="gap-2"
                    onClick={() => setShowSaveDialog(true)}
                  >
                    <Save className="h-4 w-4" />
                    Guardar en mi biblioteca
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={copyToClipboard}
                  >
                    {isCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {isCopied ? "¡Copiado!" : "Copiar al portapapeles"}
                  </Button>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Share2 className="h-4 w-4" />
                        Compartir
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Compartir contenido</DialogTitle>
                        <DialogDescription>
                          Comparte este contenido directamente en tus redes sociales
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 py-4">
                        <Button variant="outline" className="w-full gap-2">
                          <Facebook className="h-4 w-4" />
                          Facebook
                        </Button>
                        <Button variant="outline" className="w-full gap-2">
                          <Twitter className="h-4 w-4" />
                          Twitter
                        </Button>
                        <Button variant="outline" className="w-full gap-2">
                          <Instagram className="h-4 w-4" />
                          Instagram
                        </Button>
                        <Button variant="outline" className="w-full gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </Button>
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" className="w-full gap-2">
                          <Link className="h-4 w-4" />
                          Copiar enlace
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={downloadContent}
                  >
                    <Download className="h-4 w-4" />
                    Descargar
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={regenerateContent}
                    disabled={isGenerating}
                  >
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Regenerar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Consejos para promoción efectiva</CardTitle>
            <CardDescription>
              Maximiza el impacto de tu contenido promocional
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <SquarePen className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Personaliza el contenido</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Adapta el contenido generado a tu estilo personal y audiencia específica para mayor autenticidad.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Incluye llamadas a la acción</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Asegúrate de incluir una clara dirección sobre qué acción quieres que tome tu audiencia.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Destaca beneficios clave</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enfócate en cómo el producto resuelve problemas o mejora la vida de tu audiencia.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="history" className="space-y-6 mt-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Tu biblioteca de contenido</CardTitle>
              <CardDescription>
                Contenido guardado para uso futuro
              </CardDescription>
            </div>
            <Select onValueChange={(value) => setContentTypeFilter(value === "all" ? null : value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {contentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoadingContentHistory ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredHistory.length > 0 ? (
              <div className="space-y-4">
                {filteredHistory.map((item: any) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-medium">{item.title}</h3>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-xs">
                              {contentTypes.find(t => t.value === item.contentType)?.label || item.contentType}
                            </Badge>
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <PlatformIcon platform={item.platform} />
                              <span>{getPlatformsForContentType(item.contentType || "").find(p => p.value === item.platform)?.label || item.platform}</span>
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Producto: {item.productName || "No especificado"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Textarea 
                        value={item.content} 
                        readOnly 
                        className="min-h-[100px] max-h-[200px] text-sm"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags && item.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No hay contenido guardado</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Genera contenido para tus productos y guárdalo aquí para usarlo cuando lo necesites
                </p>
                <Button 
                  className="mt-4"
                  onClick={() => setActiveTab("generate")}
                >
                  Crear mi primer contenido
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </div>
  );
}