import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { db } from "../lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

// Esquema de validación para el formulario
const affiliateFormSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  bio: z.string().min(10, { message: "La biografía debe tener al menos 10 caracteres" }).max(500, { message: "La biografía no puede exceder los 500 caracteres" }),
  website: z.string().url({ message: "Ingresa una URL válida" }).optional().or(z.literal("")),
  socialMedia: z.object({
    instagram: z.string().optional().or(z.literal("")),
    twitter: z.string().optional().or(z.literal("")),
    youtube: z.string().optional().or(z.literal("")),
    tiktok: z.string().optional().or(z.literal(""))
  }),
  categories: z.array(z.string()).min(1, { message: "Selecciona al menos una categoría" }),
  paymentMethod: z.enum(["paypal", "bank_transfer", "crypto"], { 
    required_error: "Selecciona un método de pago" 
  }),
  paymentEmail: z.string().email({ message: "Ingresa un correo electrónico válido" }),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar los términos y condiciones" }),
  }),
  dataProcessingAccepted: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar el procesamiento de datos" }),
  }),
});

type AffiliateFormValues = z.infer<typeof affiliateFormSchema>;

export function AffiliateRegistration() {
  const { user } = useAuth() || {};
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Inicializar useForm con el esquema de validación
  const form = useForm<AffiliateFormValues>({
    resolver: zodResolver(affiliateFormSchema),
    defaultValues: {
      name: user?.displayName || "",
      bio: "",
      website: "",
      socialMedia: {
        instagram: "",
        twitter: "",
        youtube: "",
        tiktok: ""
      },
      categories: [],
      paymentMethod: "paypal",
      paymentEmail: user?.email || "",
      termsAccepted: false,
      dataProcessingAccepted: false,
    },
  });

  const onSubmit = async (data: AffiliateFormValues) => {
    if (!user?.uid) {
      setError("Debes iniciar sesión para registrarte como afiliado");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      // Crear el documento de afiliado en Firestore
      await setDoc(doc(db, "affiliates", user.uid), {
        ...data,
        userId: user.uid,
        email: user.email,
        status: "pending", // pending, approved, rejected
        createdAt: serverTimestamp(),
        stats: {
          totalClicks: 0,
          conversions: 0,
          earnings: 0,
          pendingPayment: 0,
        },
        level: "Básico", // Básico, Plata, Oro, Platino
      });

      setSuccess(true);
      toast.success("Tu solicitud ha sido enviada correctamente");
      
      // Recargar la página después de un breve retraso para mostrar el panel de afiliado
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error("Error al registrar afiliado:", err);
      setError("Ha ocurrido un error al procesar tu solicitud. Por favor, intenta nuevamente.");
      toast.error("Error al enviar la solicitud");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: "music_production", label: "Producción Musical" },
    { id: "music_distribution", label: "Distribución Musical" },
    { id: "artist_development", label: "Desarrollo Artístico" },
    { id: "music_marketing", label: "Marketing Musical" },
    { id: "plugins_software", label: "Plugins y Software" },
    { id: "merchandise", label: "Mercancía" },
    { id: "courses", label: "Cursos y Educación" },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Solicitud de Afiliado</CardTitle>
        <CardDescription>
          Completa este formulario para unirte al programa de afiliados de Boostify. 
          Revisaremos tu solicitud y te notificaremos cuando sea aprobada.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <Alert className="bg-primary/20 border-primary">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertTitle>¡Solicitud enviada!</AlertTitle>
            <AlertDescription>
              Tu solicitud ha sido recibida y será revisada por nuestro equipo. 
              Te notificaremos por correo electrónico cuando sea aprobada.
            </AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Información Personal</h3>
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Tu nombre y apellido" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Biografía</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Cuéntanos sobre ti, tu experiencia y por qué quieres ser afiliado de Boostify" 
                          className="min-h-[120px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Esta información nos ayudará a entender tu perfil como afiliado
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Presencia en línea</h3>
                
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sitio web o blog (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://tusitio.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="socialMedia.instagram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="@username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="socialMedia.twitter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="@username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="socialMedia.youtube"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Canal de YouTube (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="URL del canal" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="socialMedia.tiktok"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TikTok (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="@username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Categorías de interés</h3>
                <FormField
                  control={form.control}
                  name="categories"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel>Selecciona las categorías que te interesa promocionar</FormLabel>
                        <FormDescription>
                          Esto nos ayudará a recomendarte los productos más relevantes
                        </FormDescription>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {categories.map((category) => (
                          <FormField
                            key={category.id}
                            control={form.control}
                            name="categories"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={category.id}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(category.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, category.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== category.id
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    {category.label}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Información de pago</h3>
                
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Método de pago preferido</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="paypal" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              PayPal
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="bank_transfer" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Transferencia bancaria
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="crypto" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Criptomonedas
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="paymentEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo electrónico para pagos</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormDescription>
                        Usaremos este correo para procesar tus pagos
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Términos y condiciones</h3>
                
                <FormField
                  control={form.control}
                  name="termsAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-normal">
                          Acepto los <a href="/terms" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">términos y condiciones</a> del programa de afiliados
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dataProcessingAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-normal">
                          Acepto el procesamiento de mis datos para la gestión del programa de afiliados
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando solicitud...
                  </>
                ) : (
                  "Enviar solicitud"
                )}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
      {!success && (
        <CardFooter className="flex justify-center border-t px-6 py-4">
          <p className="text-xs text-muted-foreground text-center">
            Al registrarte como afiliado, aceptas nuestros términos y condiciones, incluyendo 
            la política de comisiones y los requisitos de promoción.
          </p>
        </CardFooter>
      )}
    </Card>
  );
}