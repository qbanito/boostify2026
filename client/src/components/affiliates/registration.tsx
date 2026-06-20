import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { useToast } from "../../hooks/use-toast";

// Define the form schema with validations
const affiliateFormSchema = z.object({
  fullName: z.string().min(3, {
    message: "Name must be at least 3 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  phone: z.string().optional(),
  website: z.string().url({
    message: "Please enter a valid URL.",
  }).optional().or(z.literal("")),
  socialMedia: z.object({
    instagram: z.string().optional(),
    youtube: z.string().optional(),
    tiktok: z.string().optional(),
    twitter: z.string().optional(),
  }),
  audienceSize: z.string().min(1, {
    message: "Please select your audience size.",
  }),
  marketingExperience: z.string().min(1, {
    message: "Please describe your marketing experience.",
  }),
  promotionStrategy: z.string().min(1, {
    message: "Please describe how you plan to promote our products.",
  }),
  language: z.enum(["en", "es"]),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the terms and conditions." }),
  }),
});

// Extract the inferred type from the schema
type AffiliateFormValues = z.infer<typeof affiliateFormSchema>;

export function AffiliateRegistration() {
  const [language, setLanguage] = useState<"en" | "es">("en");
  const { toast } = useToast();
  const [_, navigate] = useLocation();

  // Initialize form with default values
  const form = useForm<AffiliateFormValues>({
    resolver: zodResolver(affiliateFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      website: "",
      socialMedia: {
        instagram: "",
        youtube: "",
        tiktok: "",
        twitter: "",
      },
      audienceSize: "",
      marketingExperience: "",
      promotionStrategy: "",
      language: "en",
      agreeTerms: false,
    },
  });

  // Setup the mutation for form submission
  const mutation = useMutation({
    mutationFn: async (data: AffiliateFormValues) => {
      // Update language from the form tab selection
      data.language = language;
      
      // Send data to API with auth headers via apiRequest
      const result = await apiRequest({
        url: "/api/affiliate/register",
        method: "POST",
        data,
      });
      
      if (!result?.success) {
        throw new Error(result?.message || "Failed to register as affiliate");
      }
      
      return result;
    },
    onSuccess: () => {
      toast({
        title: language === "en" ? "Registration Successful" : "Registro Exitoso",
        description: language === "en" 
          ? "Your affiliate application has been submitted. We'll review it and get back to you soon."
          : "Tu solicitud de afiliado ha sido enviada. La revisaremos y te contactaremos pronto.",
        variant: "default",
      });
      
      // Redirect to affiliate dashboard or confirmation page
      navigate("/affiliates/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: language === "en" ? "Registration Failed" : "Error de Registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = async (data: AffiliateFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Tabs defaultValue="en" className="w-full max-w-4xl mx-auto" onValueChange={(value) => setLanguage(value as "en" | "es")}>
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="en">English</TabsTrigger>
        <TabsTrigger value="es">Español</TabsTrigger>
      </TabsList>

      {/* English Content */}
      <TabsContent value="en">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Affiliate Program Registration</CardTitle>
            <CardDescription>
              Join our affiliate program and earn commissions by promoting our financial products and services.
            </CardDescription>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">4% Standard Plan</Badge>
              <Badge variant="secondary">5% Premium Plan</Badge>
              <Badge variant="secondary">6% Elite Plan</Badge>
            </div>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://yourwebsite.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Social Media Profiles (optional)</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="socialMedia.instagram"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instagram</FormLabel>
                          <FormControl>
                            <Input placeholder="@username" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="socialMedia.youtube"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>YouTube</FormLabel>
                          <FormControl>
                            <Input placeholder="Channel URL or name" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="socialMedia.tiktok"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TikTok</FormLabel>
                          <FormControl>
                            <Input placeholder="@username" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="socialMedia.twitter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twitter</FormLabel>
                          <FormControl>
                            <Input placeholder="@username" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="audienceSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Audience Size</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your audience size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="less-1k">Less than 1,000</SelectItem>
                          <SelectItem value="1k-5k">1,000 - 5,000</SelectItem>
                          <SelectItem value="5k-10k">5,000 - 10,000</SelectItem>
                          <SelectItem value="10k-50k">10,000 - 50,000</SelectItem>
                          <SelectItem value="50k-100k">50,000 - 100,000</SelectItem>
                          <SelectItem value="100k-1m">100,000 - 1 million</SelectItem>
                          <SelectItem value="more-1m">More than 1 million</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="marketingExperience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marketing Experience</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe your experience with affiliate or digital marketing"
                          className="min-h-[100px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="promotionStrategy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Promotion Strategy</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="How do you plan to promote our investment plans? What channels and methods will you use?"
                          className="min-h-[100px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agreeTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="w-4 h-4 mt-1"
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I agree to the terms and conditions
                        </FormLabel>
                        <FormDescription>
                          By submitting this form, you agree to our <a href="/terms" className="text-primary underline">Terms of Service</a> and <a href="/privacy" className="text-primary underline">Privacy Policy</a>.
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Spanish Content */}
      <TabsContent value="es">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Registro de Programa de Afiliados</CardTitle>
            <CardDescription>
              Únete a nuestro programa de afiliados y gana comisiones promocionando nuestros productos y servicios financieros.
            </CardDescription>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">Plan Estándar 4%</Badge>
              <Badge variant="secondary">Plan Premium 5%</Badge>
              <Badge variant="secondary">Plan Élite 6%</Badge>
            </div>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan Pérez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="juan@ejemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Teléfono (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+34 123 456 789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sitio Web (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://tusitio.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Perfiles de Redes Sociales (opcional)</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="socialMedia.instagram"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instagram</FormLabel>
                          <FormControl>
                            <Input placeholder="@usuario" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="socialMedia.youtube"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>YouTube</FormLabel>
                          <FormControl>
                            <Input placeholder="URL del canal o nombre" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="socialMedia.tiktok"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TikTok</FormLabel>
                          <FormControl>
                            <Input placeholder="@usuario" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="socialMedia.twitter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twitter</FormLabel>
                          <FormControl>
                            <Input placeholder="@usuario" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="audienceSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tamaño de Audiencia</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el tamaño de tu audiencia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="less-1k">Menos de 1.000</SelectItem>
                          <SelectItem value="1k-5k">1.000 - 5.000</SelectItem>
                          <SelectItem value="5k-10k">5.000 - 10.000</SelectItem>
                          <SelectItem value="10k-50k">10.000 - 50.000</SelectItem>
                          <SelectItem value="50k-100k">50.000 - 100.000</SelectItem>
                          <SelectItem value="100k-1m">100.000 - 1 millón</SelectItem>
                          <SelectItem value="more-1m">Más de 1 millón</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="marketingExperience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experiencia en Marketing</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe tu experiencia con marketing de afiliados o marketing digital"
                          className="min-h-[100px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="promotionStrategy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estrategia de Promoción</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="¿Cómo planeas promocionar nuestros planes de inversión? ¿Qué canales y métodos utilizarás?"
                          className="min-h-[100px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agreeTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="w-4 h-4 mt-1"
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Acepto los términos y condiciones
                        </FormLabel>
                        <FormDescription>
                          Al enviar este formulario, aceptas nuestros <a href="/terms" className="text-primary underline">Términos de Servicio</a> y <a href="/privacy" className="text-primary underline">Política de Privacidad</a>.
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Enviando..." : "Enviar Solicitud"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}