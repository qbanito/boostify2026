import { useState } from "react";
import { logger } from "@/lib/logger";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../../hooks/use-auth";
import { db } from "../../lib/firebase";
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Sparkles, Copy, CheckCircle2, RotateCcw, Loader2, Save, Trash2, Download, Share2, SquarePen, Facebook, Instagram, Twitter, Youtube, ArrowRight, Wand2, Mail, Globe, FileText, Video, Link, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "../ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface AffiliateContentGeneratorProps {
  affiliateData: {
    id: string;
    level?: string;
    name?: string;
    savedContent?: any[];
  } | null;
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

// Definición de tipos para productos y contenido
interface AffiliateProduct {
  id: string;
  name: string;
  description?: string;
  url?: string;
  commissionRate: number;
  category?: string;
  imageUrl?: string;
}

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

  // Consulta para obtener los productos disponibles para afiliados (misma fuente que la pestaña de enlaces)
  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["/api/affiliate/products"],
    queryFn: async () => {
      const result = await apiRequest({ url: "/api/affiliate/products", method: "GET" });
      return (result?.products ?? []) as AffiliateProduct[];
    },
  });

  // Consulta para obtener el historial de contenido generado
  const { data: contentHistory, isLoading: isLoadingContentHistory } = useQuery({
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
      })) as AffiliateContent[];
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
      alert("Contenido guardado correctamente");
    },
    onError: (error) => {
      logger.error("Error al guardar contenido:", error);
      setIsSaving(false);
      alert("Error al guardar el contenido");
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
            generatedText = `# Cómo ${selectedProduct.name} Está Revolucionando la Producción Musical\n\n## Introducción\n\nEn el competitivo mundo de la producción musical, mantenerse actualizado con las últimas herramientas y tecnologías es crucial para destacar. Entre las numerosas opciones disponibles, ${selectedProduct.name} ha emergido como un punto de inflexión para productores de todos los niveles. En este artículo, exploraremos por qué ${selectedProduct.name} está generando tanto revuelo en la industria y cómo podría transformar también tu flujo de trabajo.\n\n## ¿Qué es ${selectedProduct.name}?\n\n${selectedProduct.name} es una solución innovadora diseñada específicamente para abordar los desafíos más comunes que enfrentan los productores musicales. Desde la captura inicial de ideas hasta el pulido final de tus pistas, ${selectedProduct.name} ofrece un enfoque integral que optimiza cada etapa del proceso creativo.\n\nA diferencia de otras herramientas que pueden resultar abrumadoras con su complejidad o limitantes con su simplicidad, ${selectedProduct.name} encuentra el equilibrio perfecto entre funcionalidad avanzada y facilidad de uso.\n\n## Características destacadas\n\n### 1. Interfaz intuitiva\n\nUno de los aspectos más valorados de ${selectedProduct.name} es su interfaz centrada en el usuario. Incluso para aquellos nuevos en la producción musical, la curva de aprendizaje es sorprendentemente corta, permitiéndote centrarte en lo que realmente importa: tu creatividad.\n\n### 2. Calidad de sonido excepcional\n\nLa calidad del audio es innegociable en la producción profesional, y aquí es donde ${selectedProduct.name} realmente brilla. Los algoritmos avanzados y los procesadores de señal incorporados garantizan que tus creaciones suenen impecables desde el primer momento.\n\n### 3. Flujo de trabajo optimizado\n\nEl tiempo es un recurso valioso. ${selectedProduct.name} ha sido diseñado pensando en la eficiencia, eliminando los cuellos de botella comunes y automatizando tareas repetitivas para que puedas mantener el impulso creativo.\n\n## Mi experiencia personal con ${selectedProduct.name}\n\nComo productor que ha experimentado con numerosas herramientas a lo largo de los años, puedo decir con confianza que ${selectedProduct.name} ha transformado fundamentalmente mi proceso creativo. Lo que antes me llevaba horas, ahora puedo completarlo en minutos, y la calidad del resultado final ha mejorado notablemente.\n\nUn aspecto que particularmente aprecio es cómo ${selectedProduct.name} me ha permitido experimentar con nuevos sonidos y técnicas que previamente parecían fuera de mi alcance. Esta expansión de posibilidades creativas es invaluable para cualquier artista.\n\n## Conclusión\n\nEn un campo tan dinámico como la producción musical, encontrar herramientas que genuinamente mejoren tu trabajo es una verdadera ventaja competitiva. ${selectedProduct.name} no solo cumple esta promesa, sino que la supera, ofreciendo una combinación única de potencia, accesibilidad y resultados profesionales.\n\nSi estás considerando elevar tu producción musical al siguiente nivel, te recomiendo enfáticamente que pruebes ${selectedProduct.name}. Como lector de mi blog, puedes obtener un 15% de descuento utilizando mi enlace de afiliado: [ENLACE DE AFILIADO].\n\n¿Ya has probado ${selectedProduct.name}? ¡Comparte tu experiencia en los comentarios! Estoy intrigado por saber cómo está transformando el flujo de trabajo de otros productores.`;
          } else if (data.platform === "website") {
            generatedText = `<h1>Transforma Tu Producción Musical con ${selectedProduct.name}</h1>\n\n<p>En el dinámico panorama de la producción musical actual, destacar requiere tanto talento como las herramientas adecuadas. Entre las innumerables opciones disponibles para los productores modernos, <strong>${selectedProduct.name}</strong> emerge como una solución revolucionaria que está redefiniendo los estándares de calidad y eficiencia.</p>\n\n<h2>Una Nueva Era en la Producción Musical</h2>\n\n<p>${selectedProduct.name} representa un avance significativo en la tecnología de producción musical, combinando características avanzadas con una accesibilidad sin precedentes. Diseñado tanto para productores emergentes como para profesionales experimentados, ofrece un conjunto de herramientas que amplifica la creatividad mientras simplifica los aspectos técnicos.</p>\n\n<h2>Ventajas Competitivas</h2>\n\n<ul>\n  <li><strong>Calidad de sonido superior:</strong> Los algoritmos propietarios de ${selectedProduct.name} garantizan una claridad y definición excepcionales en cada proyecto.</li>\n  <li><strong>Flujo de trabajo optimizado:</strong> La interfaz intuitiva elimina obstáculos técnicos, permitiéndote centrarte exclusivamente en el aspecto creativo.</li>\n  <li><strong>Versatilidad incomparable:</strong> Desde la producción de beats hasta la masterización final, ${selectedProduct.name} excede en cada fase del proceso de producción.</li>\n  <li><strong>Actualizaciones regulares:</strong> El equipo detrás de ${selectedProduct.name} mantiene el software a la vanguardia con mejoras constantes basadas en feedback real de usuarios.</li>\n</ul>\n\n<h2>Testimonios de Productores Profesionales</h2>\n\n<blockquote>\n  "Después de incorporar ${selectedProduct.name} a mi estudio, la calidad de mis producciones mejoró instantáneamente. La diferencia es notoria incluso para oyentes casuales." - [Productor Reconocido]\n</blockquote>\n\n<blockquote>\n  "La eficiencia que ${selectedProduct.name} ha aportado a mi flujo de trabajo me permite completar proyectos en la mitad del tiempo que antes requería, sin comprometer la calidad." - [Ingeniero de Mezcla Profesional]\n</blockquote>\n\n<h2>Comienza Tu Transformación Hoy</h2>\n\n<p>Como especialista en tecnología musical que ha evaluado prácticamente todas las herramientas disponibles en el mercado, puedo recomendar ${selectedProduct.name} sin reservas. Ha revolucionado mi propio proceso creativo y continúa sorprendiéndome con cada actualización.</p>\n\n<p>Para mis lectores, he negociado una oferta exclusiva: <strong>15% de descuento</strong> en tu suscripción a ${selectedProduct.name} utilizando el código promocional a continuación.</p>\n\n<div class="promo-box">\n  <p><strong>CÓDIGO PROMOCIONAL:</strong> BOOST15</p>\n  <a href="[ENLACE DE AFILIADO]" class="cta-button">OBTENER 15% DE DESCUENTO</a>\n  <p class="small">Oferta válida por tiempo limitado</p>\n</div>\n\n<p>¿Preguntas sobre cómo integrar ${selectedProduct.name} en tu configuración actual? Déjame un comentario abajo o contáctame directamente. Estoy aquí para ayudarte a maximizar tu potencial creativo con esta herramienta revolucionaria.</p>`;
          }
          break;
        
        case "video_script":
          if (data.platform === "youtube") {
            generatedText = `# Guión: Cómo ${selectedProduct.name} Revolucionó Mi Producción Musical\n\n## INTRO (0:00-0:30)\n\n[Música de fondo energética]\n\n"¡Hey, qué tal músicos y productores! Bienvenidos a un nuevo video. Hoy voy a hablarles sobre una herramienta que ha cambiado completamente mi forma de producir música: ${selectedProduct.name}.\n\nSi alguna vez te has sentido limitado por tu equipo actual o frustrado por lo complicado que puede ser el proceso de producción, este video es para ti. Vamos a ver cómo ${selectedProduct.name} está revolucionando la industria y por qué deberías considerarlo para tu estudio."\n\n## PROBLEMÁTICA (0:30-1:15)\n\n[Mostrar clips de frustración en el estudio]\n\n"Antes de descubrir ${selectedProduct.name}, me enfrentaba constantemente a estos problemas:\n\n1. Pasar horas ajustando parámetros técnicos en lugar de crear música\n2. Acabar con proyectos que sonaban 'caseros' a pesar de todo mi esfuerzo\n3. Sentirme abrumado por la cantidad de herramientas necesarias para cada proyecto\n\nEstoy seguro que muchos de ustedes han experimentado lo mismo. La buena noticia es que existe una solución que aborda todos estos problemas de una vez."\n\n## PRESENTACIÓN DEL PRODUCTO (1:15-2:30)\n\n[Mostrar pantalla del software/producto]\n\n"${selectedProduct.name} es una solución integral diseñada específicamente para productores musicales que buscan maximizar su creatividad sin perder tiempo en cuestiones técnicas.\n\nLo que hace especial a ${selectedProduct.name} es su combinación única de potencia y accesibilidad. No importa si eres un productor principiante o un profesional con años de experiencia, esta herramienta se adapta perfectamente a tu flujo de trabajo.\n\nLas características destacadas incluyen:\n- Interfaz intuitiva que elimina la curva de aprendizaje\n- Calidad de sonido profesional desde el primer uso\n- Flujo de trabajo optimizado que te ahorra horas de trabajo\n- Compatibilidad completa con otras herramientas que ya utilizas"\n\n## DEMOSTRACIÓN (2:30-5:00)\n\n[Demostración práctica del producto]\n\n"Ahora les mostraré cómo utilizo ${selectedProduct.name} en mi día a día. Para este ejemplo, vamos a crear un beat desde cero y verán lo rápido que podemos conseguir resultados profesionales.\n\n[Demostración paso a paso]\n\n¿Vieron lo que acabo de hacer en menos de 3 minutos? Anteriormente, este mismo proceso me habría llevado al menos una hora, y el resultado final no hubiera sido tan bueno."\n\n## RESULTADOS Y TESTIMONIOS (5:00-6:30)\n\n[Mostrar ejemplos de proyectos completados]\n\n"Desde que integré ${selectedProduct.name} en mi estudio hace seis meses, he podido:\n- Duplicar mi producción mensual\n- Mejorar notablemente la calidad de mis pistas\n- Recibir más proyectos de clientes gracias a la mejora en mi sonido\n\nY no soy el único. Miren lo que otros productores están diciendo sobre ${selectedProduct.name}:\n\n[Insertar capturas de pantalla de testimonios/tweets]"\n\n## OFERTA ESPECIAL (6:30-7:15)\n\n"Si estás interesado en probar ${selectedProduct.name}, tengo buenas noticias. Como suscriptor de mi canal, puedes obtener un 15% de descuento utilizando mi enlace en la descripción.\n\nEste descuento es por tiempo limitado, así que te recomiendo aprovecharlo ahora mismo si estás considerando mejorar tu configuración de estudio."\n\n## CIERRE (7:15-8:00)\n\n"Espero que este video te haya dado una buena idea de cómo ${selectedProduct.name} puede transformar tu producción musical. Si tienes alguna pregunta sobre esta herramienta, déjala en los comentarios y estaré encantado de ayudarte.\n\nSi ya utilizas ${selectedProduct.name}, comparte tu experiencia para que otros productores puedan beneficiarse.\n\nNo olvides darle like a este video, suscribirte para más contenido sobre producción musical y activar las notificaciones para no perderte ningún upload.\n\n¡Nos vemos en el próximo video!"\n\n[Música de outro]`;
          } else if (data.platform === "tiktok") {
            generatedText = `# Guión para TikTok: ${selectedProduct.name} en 60 segundos\n\n## 0:00-0:10 [Enganche]\n[Mostrar resultado final impresionante]\n"¿Quieres saber cómo logré este sonido profesional en minutos? Te presento ${selectedProduct.name}, la herramienta que está revolucionando mi estudio."\n\n## 0:10-0:25 [Problema y Solución]\n[Mostrar antes/después con sonido]\n"Antes pasaba horas intentando que mis pistas sonaran profesionales. Con ${selectedProduct.name}, logro resultados increíbles en minutos. Mira la diferencia:"\n[Reproducir comparativa]\n\n## 0:25-0:45 [Demostración rápida]\n"Te muestro lo fácil que es:"\n[Demostración ultra rápida de las 3 funciones principales]\n"1. Seleccionas tu proyecto\n2. Aplicas la configuración\n3. ¡Listo! Sonido profesional instantáneo"\n\n## 0:45-0:55 [Oferta]\n"Si quieres mejorar tu sonido como yo, consigue ${selectedProduct.name} con 15% de descuento usando mi código en la bio."\n\n## 0:55-1:00 [Call to Action]\n"¡Comenta si quieres un tutorial completo! #ProducciónMusical #TipsDeMúsica"`;
          } else if (data.platform === "instagram") {
            generatedText = `# Guión para Instagram Reel: Revoluciona tu sonido con ${selectedProduct.name}\n\n## 0:00-0:07 [Enganche]\n[Texto en pantalla: "El secreto de los productores profesionales"]\n"¿Te has preguntado por qué tus tracks no suenan como los de los profesionales? La respuesta podría ser más simple de lo que piensas."\n\n## 0:07-0:15 [Presentación del problema]\n[Mostrar DAW con muchos plugins]\n"Pasamos horas buscando plugins, ajustando EQs, y aun así... algo falta. Yo estuve ahí. Hasta que descubrí esto..."\n\n## 0:15-0:22 [Solución]\n[Mostrar ${selectedProduct.name} en pantalla]\n"${selectedProduct.name} - la herramienta que está transformando estudios caseros en setups profesionales. No es magia, es tecnología avanzada simplificada."\n\n## 0:22-0:35 [Demostración rápida]\n"Mira lo que puedo hacer en segundos:"\n[Demostración rápida con resultados audibles]\n"¿Escuchas la diferencia? De amateur a profesional con un solo click"\n\n## 0:35-0:45 [Beneficios]\n[Texto en pantalla listando beneficios mientras hablas]\n"Ahorra horas de trabajo, consigue calidad de estudio profesional, y concéntrate en lo que realmente importa: tu creatividad."\n\n## 0:45-0:55 [Social proof]\n[Mostrar mensajes/comentarios de otros usuarios]\n"No solo yo lo digo. Miles de productores están elevando su sonido con ${selectedProduct.name}. La comunidad no para de crecer."\n\n## 0:55-1:00 [CTA]\n"Link en bio para 15% de descuento exclusivo para mis seguidores. ¿Ya lo usas? Dime qué piensas en los comentarios 👇"\n\n[Hashtags sugeridos: #ProducciónMusical #HomeStudio #TipsDeProducción #MúsicaProfesional]`;
          }
          break;
          
        default:
          generatedText = `No se pudo generar contenido para la combinación seleccionada. Por favor, intenta con otro tipo de contenido o plataforma.`;
      }
      
      setGeneratedContent(generatedText);
      
    } catch (error) {
      logger.error("Error al generar contenido:", error);
      setGenerationError("Ha ocurrido un error al generar el contenido. Por favor, intenta nuevamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Función para copiar contenido al portapapeles
  const copyContentToClipboard = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
          alert("Contenido copiado al portapapeles");
        })
        .catch(err => {
          logger.error("Error al copiar:", err);
          alert("Error al copiar el contenido");
        });
    }
  };

  // Función para descargar el contenido como archivo de texto
  const downloadContent = () => {
    if (!generatedContent) return;
    
    const blob = new Blob([generatedContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.download = `contenido-afiliado-${new Date().toISOString().split('T')[0]}.txt`;
    a.href = URL.createObjectURL(blob);
    a.addEventListener('click', () => {
      setTimeout(() => URL.revokeObjectURL(a.href), 100);
    });
    a.click();
  };

  // Función para regenerar contenido
  const regenerateContent = () => {
    const values = form.getValues();
    onSubmit(values);
  };

  // Función para guardar contenido
  const onSaveContent = (data: SaveContentValues) => {
    setIsSaving(true);
    saveContentMutation.mutate(data);
  };

  // Función para formatear fecha
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Renderizar ícono de tipo de contenido
  const renderContentTypeIcon = (type: string) => {
    switch (type) {
      case 'post':
        return <SquarePen className="h-4 w-4" />;
      case 'caption':
        return <FileText className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'article':
        return <FileText className="h-4 w-4" />;
      case 'video_script':
        return <Video className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Renderizar ícono de plataforma
  const renderPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <Facebook className="h-4 w-4" />;
      case 'instagram':
        return <Instagram className="h-4 w-4" />;
      case 'twitter':
        return <Twitter className="h-4 w-4" />;
      case 'youtube':
        return <Youtube className="h-4 w-4" />;
      case 'tiktok':
        return <Video className="h-4 w-4" />;
      case 'newsletter':
      case 'promotional':
        return <Mail className="h-4 w-4" />;
      case 'blog':
      case 'website':
        return <Globe className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> 
            Generador de Contenido para Afiliados
          </h2>
          <p className="text-muted-foreground">
            Crea contenido persuasivo para promocionar productos y maximizar tus comisiones
          </p>
        </div>
        
        <div className="flex items-center gap-3 mt-2 md:mt-0">
          <Badge variant="outline" className="px-3 py-1 flex items-center gap-1.5 border-primary/20 bg-primary/10 text-primary hover:bg-primary/20">
            <Wand2 className="h-3.5 w-3.5" />
            {affiliateData?.level || "Basic"} Level
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10">
                  <AlertCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="max-w-xs">
                  Los afiliados de nivel Premium tienen acceso a tipos de contenido adicionales y personalización avanzada.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <Tabs 
        defaultValue="generate" 
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 mb-2">
          <TabsTrigger value="generate" className="flex items-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Sparkles className="h-4 w-4" />
            <span>Generar Contenido</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileText className="h-4 w-4" />
            <span>Historial Guardado</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="generate" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulario de generación */}
            <Card>
              <CardHeader>
                <CardTitle>Configura tu contenido</CardTitle>
                <CardDescription>
                  Personaliza el contenido que deseas generar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="productId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Producto</FormLabel>
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
                                  products?.map((product) => (
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
                              onContentTypeChange(value);
                              field.onChange(value);
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
                    
                    {form.watch("contentType") && (
                      <FormField
                        control={form.control}
                        name="platform"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plataforma</FormLabel>
                            <Select 
                              onValueChange={(value) => {
                                setCurrentPlatform(value);
                                field.onChange(value);
                              }} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona plataforma" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>Plataformas disponibles</SelectLabel>
                                  {getPlatformsForContentType(form.watch("contentType")).map((platform) => (
                                    <SelectItem key={platform.value} value={platform.value}>
                                      <div className="flex items-center">
                                        {platform.icon}
                                        {platform.label}
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
                    )}
                    
                    <FormField
                      control={form.control}
                      name="tone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tono de voz</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona tono" />
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
                              placeholder="Añade detalles específicos o instrucciones para personalizar el contenido generado"
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Máximo 300 caracteres
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generando contenido...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generar contenido
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            
            {/* Contenido generado */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Contenido generado</CardTitle>
                  <CardDescription>
                    Resultado listo para usar en tus campañas
                  </CardDescription>
                </div>
                {generatedContent && (
                  <div className="flex space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={copyContentToClipboard}
                          >
                            {isCopied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
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
                            onClick={downloadContent}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Descargar como texto</p>
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
                    
                    <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Save className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Guardar contenido</DialogTitle>
                          <DialogDescription>
                            Guarda este contenido en tu biblioteca para usarlo más tarde
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
                                    <Input placeholder="Título para identificar este contenido" {...field} />
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
                                  <FormLabel>Etiquetas (opcional)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Separadas por comas (ej: instagram, verano, música)" {...field} />
                                  </FormControl>
                                  <FormDescription>
                                    Ayudan a organizar y encontrar tu contenido
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <DialogFooter className="mt-4">
                              <Button 
                                type="submit" 
                                disabled={isSaving}
                                className="w-full"
                              >
                                {isSaving ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                  </>
                                ) : (
                                  <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Guardar contenido
                                  </>
                                )}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-4">
                {generationError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{generationError}</AlertDescription>
                  </Alert>
                ) : isGenerating ? (
                  <div className="flex flex-col items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <p className="text-center text-muted-foreground">
                      Generando contenido personalizado...
                    </p>
                    <p className="text-center text-xs text-muted-foreground mt-2">
                      La IA está creando contenido optimizado para tus necesidades
                    </p>
                  </div>
                ) : !generatedContent ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <Wand2 className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Tu contenido aparecerá aquí</h3>
                    <p className="text-muted-foreground mb-4">
                      Configura los parámetros y haz clic en "Generar contenido" para empezar
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 max-w-md">
                      {contentTypes.map((type) => (
                        <Badge key={type.value} variant="outline" className="text-xs">
                          {type.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="border rounded-md p-4 whitespace-pre-wrap" style={{ minHeight: '350px' }}>
                      {generatedContent}
                    </div>
                    {currentContentType && currentPlatform && (
                      <div className="absolute top-2 right-2 flex space-x-1">
                        <Badge variant="outline" className="text-xs">
                          {contentTypes.find(t => t.value === currentContentType)?.label || currentContentType}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {getPlatformsForContentType(currentContentType).find(p => p.value === currentPlatform)?.label || currentPlatform}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between pt-0">
                {generatedContent && (
                  <div className="flex w-full justify-end">
                    <Button
                      variant="outline"
                      className="ml-auto"
                      onClick={() => setShowSaveDialog(true)}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Guardar
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          </div>
          
          {generatedContent && (
            <Card>
              <CardHeader>
                <CardTitle>Consejos para maximizar resultados</CardTitle>
                <CardDescription>
                  Cómo usar este contenido para aumentar tus conversiones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2 flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Personaliza para tu audiencia
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Adapta el contenido generado al lenguaje y estilo que resuena con tu audiencia específica. Añade tu toque personal para aumentar la autenticidad.
                    </p>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2 flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Acompaña con elementos visuales
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Complementa tu texto con imágenes o videos de alta calidad que muestren el producto en acción. El contenido visual aumenta significativamente el engagement.
                    </p>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2 flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Programa publicaciones estratégicamente
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Publica cuando tu audiencia está más activa. Analiza tus estadísticas para determinar los mejores días y horarios para maximizar alcance e interacción.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="history" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de contenido</CardTitle>
              <CardDescription>
                Contenido guardado para reutilizar en tus campañas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingContentHistory ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>Cargando historial...</span>
                </div>
              ) : contentHistory?.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                    <SquarePen className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">No tienes contenido guardado</h3>
                  <p className="text-sm text-muted-foreground mt-2 mb-4 max-w-md mx-auto">
                    Genera y guarda contenido para tus campañas de afiliado para acceder a él en cualquier momento.
                  </p>
                  <Button onClick={() => setActiveTab("generate")}>
                    Crear primer contenido
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contentHistory?.map((item) => (
                    <Card key={item.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">{item.title}</CardTitle>
                            <CardDescription>
                              {formatDate(item.createdAt)}
                            </CardDescription>
                          </div>
                          <div className="flex space-x-1">
                            <Badge variant="outline" className="text-xs flex items-center">
                              {renderContentTypeIcon(item.contentType)}
                              <span className="ml-1">{item.contentType}</span>
                            </Badge>
                            <Badge variant="outline" className="text-xs flex items-center">
                              {renderPlatformIcon(item.platform)}
                              <span className="ml-1">{item.platform}</span>
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <div className="border rounded-md p-2">
                          <p className="text-sm whitespace-pre-wrap line-clamp-4">
                            {item.content}
                          </p>
                        </div>
                        {item.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="pt-0 flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(item.content);
                            alert("Contenido copiado al portapapeles");
                          }}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copiar
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Share2 className="h-4 w-4 mr-1" />
                              Compartir
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Compartir contenido</DialogTitle>
                              <DialogDescription>
                                Comparte este contenido en tus redes sociales o vía email
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 py-4">
                              <Button variant="outline" className="w-full">
                                <Facebook className="h-4 w-4 mr-2" />
                                Facebook
                              </Button>
                              <Button variant="outline" className="w-full">
                                <Twitter className="h-4 w-4 mr-2" />
                                Twitter
                              </Button>
                              <Button variant="outline" className="w-full">
                                <Instagram className="h-4 w-4 mr-2" />
                                Instagram
                              </Button>
                              <Button variant="outline" className="w-full">
                                <Mail className="h-4 w-4 mr-2" />
                                Email
                              </Button>
                            </div>
                            <DialogFooter>
                              <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.content);
                                  alert("Contenido copiado al portapapeles");
                                }}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copiar al portapapeles
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}