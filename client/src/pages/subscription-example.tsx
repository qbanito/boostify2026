import { useState } from "react";
import { SubscriptionFeature } from "../components/subscription/subscription-feature";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useSubscription } from "../lib/context/subscription-context";
import { getPlanFeatures, SubscriptionPlan } from "../lib/api/subscription-service";
import { Sparkles, Music, Video, Share2 } from "lucide-react";

export default function SubscriptionExamplePage() {
  const { subscription, isLoading } = useSubscription();
  const [activeTab, setActiveTab] = useState("features");
  const currentPlan = subscription?.currentPlan || 'free';

  return (
    <div className="container py-10">
      <div className="flex flex-col items-center justify-center mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Funcionalidades por nivel de suscripción</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          Este ejemplo muestra cómo funcionan las restricciones basadas en niveles de suscripción.
          {!isLoading && currentPlan && (
            <span className="font-medium text-primary ml-1">
              Tu plan actual es: <span className="capitalize">{currentPlan}</span>
            </span>
          )}
        </p>
      </div>

      <Tabs defaultValue="features" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-center mb-6">
          <TabsList>
            <TabsTrigger value="features">Funcionalidades por plan</TabsTrigger>
            <TabsTrigger value="examples">Ejemplos de componentes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="features">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
            {/* Plan Gratuito */}
            <PlanFeatureCard 
              title="Plan Gratuito" 
              description="Acceso básico a la plataforma" 
              features={getPlanFeatures().free}
              currentPlan={currentPlan}
              plan="free"
            />

            {/* Plan Artist */}
            <PlanFeatureCard 
              title="Plan Artist" 
              description="$19.99/mes - Para artistas emergentes" 
              features={getPlanFeatures().basic}
              currentPlan={currentPlan}
              plan="artist"
            />

            {/* Plan Elevate */}
            <PlanFeatureCard 
              title="Plan Elevate" 
              description="$49.99/mes - Para artistas en crecimiento" 
              features={getPlanFeatures().pro}
              currentPlan={currentPlan}
              plan="creator"
            />

            {/* Plan Amplify */}
            <PlanFeatureCard 
              title="Plan Amplify" 
              description="$89.99/mes - Para artistas profesionales" 
              features={getPlanFeatures().premium} 
              currentPlan={currentPlan}
              plan="professional"
            />
          </div>
        </TabsContent>

        <TabsContent value="examples">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Ejemplo 1: Contenido Gratuito */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5" />
                  Análisis musical básico
                </CardTitle>
                <CardDescription>
                  Esta funcionalidad está disponible para todos los usuarios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubscriptionFeature requiredPlan="free">
                  <div className="rounded-md bg-primary/10 p-4">
                    <p className="text-sm">
                      Aquí puedes ver análisis básicos de estructura musical de tus canciones.
                    </p>
                    <Button variant="outline" size="sm" className="mt-4 w-full">
                      Analizar canción
                    </Button>
                  </div>
                </SubscriptionFeature>
              </CardContent>
            </Card>

            {/* Ejemplo 2: Contenido Basic */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Distribución musical
                </CardTitle>
                <CardDescription>
                  Requiere plan Basic o superior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubscriptionFeature 
                  requiredPlan="basic"
                  title="Distribución de música"
                  description="Distribuye tu música a plataformas digitales"
                >
                  <div className="rounded-md bg-primary/10 p-4">
                    <p className="text-sm">
                      Configura la distribución de tu música a servicios como Spotify, 
                      Apple Music y más.
                    </p>
                    <Button variant="outline" size="sm" className="mt-4 w-full">
                      Configurar distribución
                    </Button>
                  </div>
                </SubscriptionFeature>
              </CardContent>
            </Card>

            {/* Ejemplo 3: Contenido Pro */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generación de música IA
                </CardTitle>
                <CardDescription>
                  Requiere plan Pro o superior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubscriptionFeature 
                  requiredPlan="pro"
                  title="Generador de música IA"
                  description="Crea música con inteligencia artificial"
                >
                  <div className="rounded-md bg-primary/10 p-4">
                    <p className="text-sm">
                      Genera composiciones musicales con IA basadas
                      en tus preferencias de género y estilo.
                    </p>
                    <Button variant="outline" size="sm" className="mt-4 w-full">
                      Generar música
                    </Button>
                  </div>
                </SubscriptionFeature>
              </CardContent>
            </Card>

            {/* Ejemplo 4: Contenido Premium */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Creador de videos musicales
                </CardTitle>
                <CardDescription>
                  Requiere plan Premium
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubscriptionFeature 
                  requiredPlan="premium"
                  title="Videos musicales con IA"
                  description="Crea videos musicales profesionales"
                >
                  <div className="rounded-md bg-primary/10 p-4">
                    <p className="text-sm">
                      Genera videos musicales profesionales con IA
                      a partir de tu música y una descripción.
                    </p>
                    <Button variant="outline" size="sm" className="mt-4 w-full">
                      Crear video
                    </Button>
                  </div>
                </SubscriptionFeature>
              </CardContent>
            </Card>

            {/* Ejemplo 5: Vista previa */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generación con vista previa
                </CardTitle>
                <CardDescription>
                  Modo de vista previa de funcionalidad
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubscriptionFeature 
                  requiredPlan="premium"
                  title="Analytics avanzados"
                  description="Analiza el rendimiento de tu música con gráficos detallados"
                  preview
                >
                  <div className="rounded-md bg-primary/10 p-4">
                    <div className="h-20 bg-muted/30 rounded flex items-center justify-center">
                      Gráfico de tendencias
                    </div>
                    <div className="h-10 bg-muted/30 rounded mt-2 flex items-center justify-center">
                      Estadísticas
                    </div>
                  </div>
                </SubscriptionFeature>
              </CardContent>
            </Card>

            {/* Ejemplo 6: Modo silencioso */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Modo silencioso
                </CardTitle>
                <CardDescription>
                  No muestra nada si no tienes acceso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">
                  El contenido de abajo solo aparece con plan Premium:
                </p>
                <SubscriptionFeature 
                  requiredPlan="premium"
                  silent
                >
                  <div className="rounded-md bg-primary/10 p-4">
                    <p className="text-sm">
                      Este contenido solo es visible para usuarios Premium.
                    </p>
                    <Button variant="outline" size="sm" className="mt-4 w-full">
                      Acción exclusiva
                    </Button>
                  </div>
                </SubscriptionFeature>
                <p className="text-sm mt-4">
                  Si no tienes plan Premium, no verás nada arriba de este texto.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Componente para mostrar las características de un plan
function PlanFeatureCard({ 
  title, 
  description, 
  features, 
  currentPlan, 
  plan 
}: { 
  title: string;
  description: string;
  features: string[];
  currentPlan: string | null;
  plan: string;
}) {
  const isCurrentPlan = currentPlan === plan;

  return (
    <Card className={
      isCurrentPlan 
        ? "border-primary/50 bg-primary/5 relative overflow-hidden" 
        : ""
    }>
      {isCurrentPlan && (
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs">
          Tu plan actual
        </div>
      )}
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="bg-primary/10 text-primary rounded-full p-1 flex-shrink-0 mt-0.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}