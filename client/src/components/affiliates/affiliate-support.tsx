import { useState } from "react";
import { logger } from "@/lib/logger";
import { useAuth } from "../../hooks/use-auth";
import { db } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { LifeBuoy, Mail, MessageSquare, Phone, HelpCircle, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

// Esquema de validación para el formulario de contacto
const contactFormSchema = z.object({
  subject: z.string().min(5, { message: "El asunto debe tener al menos 5 caracteres" }).max(100),
  category: z.string({ required_error: "Selecciona una categoría" }),
  message: z.string().min(20, { message: "El mensaje debe tener al menos 20 caracteres" }).max(1000),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export function AffiliateSupport() {
  const { user } = useAuth() || {};
  const [activeTab, setActiveTab] = useState("contact");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Inicializar useForm con el esquema de validación
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      subject: "",
      category: "",
      message: "",
    },
  });

  // Manejar el envío del formulario
  const onSubmit = async (data: ContactFormValues) => {
    if (!user?.uid) {
      setSubmitError("Debes iniciar sesión para enviar un mensaje");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      // Crear el documento de ticket en Firestore
      await addDoc(collection(db, "affiliateTickets"), {
        userId: user.uid,
        email: user.email,
        name: user.displayName || "",
        subject: data.subject,
        category: data.category,
        message: data.message,
        status: "open", // open, in_progress, resolved, closed
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSubmitSuccess(true);
      form.reset();
      
      // Restablecer después de un tiempo
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 5000);
    } catch (err) {
      logger.error("Error al enviar ticket:", err);
      setSubmitError("Ha ocurrido un error al enviar tu mensaje. Por favor, intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preguntas frecuentes
  const faqs = [
    {
      question: "¿Cómo funciona el programa de afiliados?",
      answer: "El programa de afiliados de Boostify te permite ganar comisiones por cada venta que generes a través de tus enlaces únicos. Recibirás un porcentaje de cada compra completada, con tasas que varían según el producto y tu nivel de afiliado."
    },
    {
      question: "¿Cuándo se procesan los pagos?",
      answer: "Los pagos se procesan mensualmente, siempre que hayas alcanzado el umbral mínimo de $50. Los pagos se realizan entre el día 1 y 5 de cada mes por las ganancias del mes anterior."
    },
    {
      question: "¿Qué métodos de pago están disponibles?",
      answer: "Actualmente ofrecemos pagos vía PayPal, transferencia bancaria y criptomonedas (Bitcoin, Ethereum). Puedes seleccionar tu método preferido en la configuración de tu cuenta de afiliado."
    },
    {
      question: "¿Cómo se rastrean las ventas y comisiones?",
      answer: "Utilizamos cookies con una duración de 30 días para rastrear las visitas y conversiones generadas por tus enlaces. Esto significa que recibirás comisión por cualquier compra realizada dentro de los 30 días posteriores a que un usuario haga clic en tu enlace."
    },
    {
      question: "¿Puedo promocionar los productos en redes sociales?",
      answer: "¡Absolutamente! Te animamos a promocionar nuestros productos en todas tus redes sociales, blog, YouTube, emails y cualquier otro canal digital. Sin embargo, no está permitido el spam ni la publicidad engañosa."
    },
    {
      question: "¿Hay restricciones sobre dónde puedo promocionar los productos?",
      answer: "No puedes promocionar productos a través de sistemas de spam, publicidad engañosa, sitios con contenido ilegal o inapropiado, ni puedes usar el nombre de Boostify en campañas de búsqueda pagada (SEM) sin autorización previa."
    },
    {
      question: "¿Puedo solicitar un aumento en mi tasa de comisión?",
      answer: "Los afiliados que demuestren un rendimiento consistente son elegibles para tasas de comisión mejoradas. Cuando alcances ciertos umbrales de ventas, serás promovido automáticamente a niveles superiores con mejores comisiones."
    },
    {
      question: "¿Cómo puedo obtener soporte si tengo problemas?",
      answer: "Puedes contactarnos a través del formulario en esta página o enviando un email a affiliates@boostify.com. Nuestro tiempo de respuesta habitual es de 24-48 horas en días laborables."
    },
  ];

  // Recursos de contacto
  const contactResources = [
    {
      title: "Correo electrónico",
      description: "Envíanos un correo con tus preguntas",
      contact: "affiliates@boostify.com",
      icon: <Mail className="h-6 w-6" />,
    },
    {
      title: "Chat en vivo",
      description: "Habla con nuestro equipo en tiempo real",
      contact: "Disponible de Lun-Vie: 9:00-17:00 CET",
      icon: <MessageSquare className="h-6 w-6" />,
    },
    {
      title: "Teléfono",
      description: "Línea de atención exclusiva para afiliados",
      contact: "+1 (555) 123-4567",
      icon: <Phone className="h-6 w-6" />,
    },
    {
      title: "Centro de ayuda",
      description: "Explora nuestra base de conocimientos",
      contact: "help.boostify.com/affiliates",
      icon: <HelpCircle className="h-6 w-6" />,
    },
  ];

  // Información sobre el acuerdo de afiliados
  const agreementInfo = [
    {
      title: "Términos y condiciones",
      description: "Lee nuestros términos completos del programa de afiliados",
      link: "/terms/affiliates",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: "Política de cookies",
      description: "Información sobre el uso de cookies para el seguimiento",
      link: "/privacy/cookies",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: "Guía de buenas prácticas",
      description: "Lineamientos para promoción ética y efectiva",
      link: "/affiliates/best-practices",
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    {
      title: "Restricciones y prohibiciones",
      description: "Actividades no permitidas en el programa",
      link: "/affiliates/prohibited",
      icon: <AlertCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Soporte para Afiliados</h2>
        <p className="text-muted-foreground">
          Obtén ayuda, respuestas a preguntas frecuentes y contacta con nuestro equipo
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full mb-6">
          <TabsTrigger value="contact">Contacto</TabsTrigger>
          <TabsTrigger value="faq">Preguntas Frecuentes</TabsTrigger>
          <TabsTrigger value="resources">Recursos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enviar mensaje al equipo de afiliados</CardTitle>
              <CardDescription>
                Nuestro equipo responderá a tu consulta en un plazo de 24-48 horas laborables
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitSuccess ? (
                <Alert className="bg-green-500/10 border-green-500/50 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Mensaje enviado correctamente</AlertTitle>
                  <AlertDescription>
                    Hemos recibido tu mensaje y te responderemos lo antes posible.
                  </AlertDescription>
                </Alert>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asunto</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Consulta sobre comisiones" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoría</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona una categoría" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="account">Cuenta de afiliado</SelectItem>
                              <SelectItem value="payments">Pagos y comisiones</SelectItem>
                              <SelectItem value="links">Enlaces y tracking</SelectItem>
                              <SelectItem value="resources">Materiales y recursos</SelectItem>
                              <SelectItem value="technical">Problemas técnicos</SelectItem>
                              <SelectItem value="other">Otros</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mensaje</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe tu consulta en detalle..." 
                              className="min-h-[150px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Sé lo más específico posible para que podamos ayudarte mejor
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {submitError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{submitError}</AlertDescription>
                      </Alert>
                    )}
                    
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        "Enviar mensaje"
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contactResources.map((resource, index) => (
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
                <CardContent>
                  <p className="font-medium text-sm">{resource.contact}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="faq" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preguntas frecuentes</CardTitle>
              <CardDescription>
                Respuestas a las dudas más comunes sobre el programa de afiliados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-muted-foreground">{faq.answer}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
            <CardFooter className="flex justify-center border-t px-6 py-4">
              <p className="text-sm text-muted-foreground text-center">
                ¿No encuentras la respuesta que buscas? Contáctanos a través del formulario.
              </p>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Documentos importantes</CardTitle>
              <CardDescription>
                Información legal y guías sobre el programa de afiliados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agreementInfo.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="mt-0.5 text-primary">
                      {item.icon}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                      <Button variant="link" size="sm" className="h-auto p-0" asChild>
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          Ver documento
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recursos útiles</CardTitle>
              <CardDescription>
                Enlaces y herramientas para maximizar tu éxito como afiliado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Centro de conocimiento</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="space-y-2">
                      <h4 className="font-medium">Guías para principiantes</h4>
                      <p className="text-sm text-muted-foreground">
                        Guías paso a paso para nuevos afiliados
                      </p>
                      <Button variant="link" className="p-0 h-auto" asChild>
                        <a href="/knowledge/beginners" target="_blank">Explorar guías</a>
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="space-y-2">
                      <h4 className="font-medium">Tutoriales en video</h4>
                      <p className="text-sm text-muted-foreground">
                        Aprende visualmente con nuestros tutoriales
                      </p>
                      <Button variant="link" className="p-0 h-auto" asChild>
                        <a href="/knowledge/videos" target="_blank">Ver tutoriales</a>
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="space-y-2">
                      <h4 className="font-medium">Blog de afiliados</h4>
                      <p className="text-sm text-muted-foreground">
                        Consejos, estrategias y casos de éxito
                      </p>
                      <Button variant="link" className="p-0 h-auto" asChild>
                        <a href="/blog/affiliates" target="_blank">Leer artículos</a>
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="space-y-2">
                      <h4 className="font-medium">Comunidad de afiliados</h4>
                      <p className="text-sm text-muted-foreground">
                        Conecta y aprende de otros afiliados
                      </p>
                      <Button variant="link" className="p-0 h-auto" asChild>
                        <a href="/community" target="_blank">Unirse a la comunidad</a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Webinars y eventos</h3>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="font-medium">Webinar: Estrategias avanzadas de promoción</h4>
                        <p className="text-sm text-muted-foreground">
                          15 de abril, 2025 • 18:00 CET
                        </p>
                      </div>
                      <Button variant="outline">Registrarse</Button>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="font-medium">Sesión Q&A con afiliados Top</h4>
                        <p className="text-sm text-muted-foreground">
                          28 de abril, 2025 • 17:00 CET
                        </p>
                      </div>
                      <Button variant="outline">Registrarse</Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>¿Necesitas ayuda personal?</CardTitle>
                <CardDescription>
                  Agenda una llamada con nuestro equipo para resolver tus dudas
                </CardDescription>
              </div>
              <div className="hidden sm:flex items-center justify-center p-2 rounded-full bg-primary/10">
                <LifeBuoy className="h-6 w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" placeholder="Tu nombre" defaultValue={user?.displayName || ""} />
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="tu@email.com" defaultValue={user?.email || ""} />
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <Label htmlFor="topic">Tema de la consulta</Label>
                <Select>
                  <SelectTrigger id="topic">
                    <SelectValue placeholder="Selecciona un tema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strategy">Estrategia de promoción</SelectItem>
                    <SelectItem value="technical">Ayuda técnica</SelectItem>
                    <SelectItem value="payments">Pagos y comisiones</SelectItem>
                    <SelectItem value="other">Otro tema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-4">
                <Button className="w-full">Agendar llamada</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}