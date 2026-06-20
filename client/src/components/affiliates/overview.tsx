import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import {
  ArrowRight,
  Coins,
  DollarSign,
  TrendingUp,
  Users,
  LineChart,
  MousePointerClick,
  ShoppingCart,
} from "lucide-react";
import { ProgressCircular } from "../ui/progress-circular";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";

// Definir interfaces para los datos
interface AffiliateStats {
  totalClicks: number;
  totalSales: number;
  totalCommission: number;
  conversionRate: number;
  clicksThisMonth: number;
  salesThisMonth: number;
  commissionThisMonth: number;
  pendingCommission: number;
  nextPayment: {
    date: string;
    amount: number;
  };
  levelProgress: {
    currentLevel: string;
    progress: number;
    nextLevel: string | null;
    salesNeeded: number;
  };
  recentClicks: Array<{
    id: string;
    date: string;
    productName: string;
    converted: boolean;
  }>;
  recentSales: Array<{
    id: string;
    date: string;
    productName: string;
    amount: number;
    commission: number;
    status: "pending" | "paid";
  }>;
}

interface AffiliateData {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: "active" | "pending" | "suspended";
  level: "basic" | "pro" | "elite";
  createdAt: string;
  payoutMethod: string;
  payoutDetails?: string;
  avatarUrl?: string;
  stats: AffiliateStats;
}

interface AffiliateOverviewProps {
  affiliateData: AffiliateData;
}

/**
 * Panel de resumen del programa de afiliados
 * Muestra métricas, estadísticas y datos importantes para el afiliado
 */
export function AffiliateOverview({ affiliateData }: AffiliateOverviewProps) {
  // Consultar estadísticas actualizadas de afiliados
  const { data: earningsData, isLoading: isLoadingEarnings } = useQuery({
    queryKey: ["/api/affiliate/earnings"],
    queryFn: async () => {
      const data = await apiRequest({ url: "/api/affiliate/earnings", method: "GET" });
      return data;
    },
    enabled: !!affiliateData,
    refetchInterval: 60000 * 5, // Actualizar cada 5 minutos
  });

  // Extraer datos relevantes
  const stats = affiliateData?.stats || {
    totalClicks: 0,
    totalSales: 0,
    totalCommission: 0,
    conversionRate: 0,
    clicksThisMonth: 0,
    salesThisMonth: 0,
    commissionThisMonth: 0,
    pendingCommission: 0,
    nextPayment: {
      date: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        15
      ).toISOString(),
      amount: 0,
    },
    levelProgress: {
      currentLevel: "basic",
      progress: 0,
      nextLevel: "pro",
      salesNeeded: 10,
    },
    recentClicks: [],
    recentSales: [],
  };

  // Calcular estadísticas adicionales
  const averageCommissionPerSale =
    stats.totalSales > 0 ? stats.totalCommission / stats.totalSales : 0;

  // Obtener detalles del nivel
  const levelDetails = {
    basic: {
      title: "Básico",
      commission: "15%",
      next: "pro",
      color: "text-blue-500",
      bgColor: "bg-blue-100",
    },
    pro: {
      title: "Pro",
      commission: "25%",
      next: "elite",
      color: "text-purple-500",
      bgColor: "bg-purple-100",
    },
    elite: {
      title: "Elite",
      commission: "30%",
      next: null,
      color: "text-amber-500",
      bgColor: "bg-amber-100",
    },
  };

  const currentLevel = affiliateData?.level || "basic";
  const levelInfo = levelDetails[currentLevel as keyof typeof levelDetails];

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Clics Totales
                </p>
                <div className="text-2xl font-bold">
                  {(stats.totalClicks || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span
                    className={`inline-flex items-center ${
                      stats.clicksThisMonth > 0
                        ? "text-green-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {stats.clicksThisMonth > 0 && (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    )}
                    {stats.clicksThisMonth} este mes
                  </span>
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <MousePointerClick className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Ventas Totales
                </p>
                <div className="text-2xl font-bold">
                  {(stats.totalSales || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span
                    className={`inline-flex items-center ${
                      stats.salesThisMonth > 0
                        ? "text-green-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {stats.salesThisMonth > 0 && (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    )}
                    {stats.salesThisMonth} este mes
                  </span>
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Comisión Total
                </p>
                <div className="text-2xl font-bold">
                  ${(stats.totalCommission || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span
                    className={`inline-flex items-center ${
                      stats.commissionThisMonth > 0
                        ? "text-green-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {stats.commissionThisMonth > 0 && (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    )}
                    ${(stats.commissionThisMonth || 0).toFixed(2)} este mes
                  </span>
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Tasa de Conversión
                </p>
                <div className="text-2xl font-bold">
                  {((stats.conversionRate || 0) * 100).toFixed(1)}%
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs text-muted-foreground mt-1 cursor-help">
                        <span className="underline dotted">¿Qué es esto?</span>
                      </p>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        Porcentaje de clics que resultan en ventas. Una tasa más
                        alta indica mejor efectividad de tus enlaces.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <LineChart className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalles de nivel y progreso */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Nivel de Afiliado</CardTitle>
              <CardDescription>
                Tu nivel determina el porcentaje de comisión
              </CardDescription>
            </div>
            <Badge
              className={`${levelInfo?.bgColor || 'bg-primary'} ${levelInfo?.color || 'text-white'} border-0 hover:${levelInfo?.bgColor || 'bg-primary/90'}`}
            >
              Nivel {levelInfo?.title || 'Básico'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-2">
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {levelInfo?.title || 'Básico'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({levelInfo?.commission || '1%'} comisión)
                    </span>
                  </div>
                  {stats?.levelProgress?.nextLevel && (
                    <div className="text-sm font-medium">
                      {stats?.levelProgress?.nextLevel === "pro"
                        ? "Pro"
                        : "Elite"}
                    </div>
                  )}
                </div>

                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${stats?.levelProgress?.progress || 0}%` }}
                  ></div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {stats?.levelProgress?.nextLevel ? (
                    <span>
                      {stats?.levelProgress?.salesNeeded || 0} ventas más para alcanzar
                      el nivel{" "}
                      {stats?.levelProgress?.nextLevel === "pro"
                        ? "Pro"
                        : "Elite"}
                    </span>
                  ) : (
                    <span className="text-green-500">
                      ¡Has alcanzado el nivel máximo!
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/30 p-2 rounded-md">
                  <div className="text-xl font-semibold">
                    {stats?.totalClicks || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Clics Totales
                  </div>
                </div>
                <div className="bg-muted/30 p-2 rounded-md">
                  <div className="text-xl font-semibold">
                    ${(averageCommissionPerSale || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Comisión Media
                  </div>
                </div>
                <div className="bg-muted/30 p-2 rounded-md">
                  <div className="text-xl font-semibold">
                    ${(stats?.pendingCommission || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Pendiente de Pago
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="flex flex-col items-center justify-center h-full">
                <div className="relative mb-2">
                  <ProgressCircular
                    value={stats?.levelProgress?.progress || 0}
                    size="lg"
                    className="text-primary"
                  >
                    <span className="text-sm font-medium">
                      {(stats?.levelProgress?.progress || 0).toFixed(0)}%
                    </span>
                  </ProgressCircular>
                </div>

                <div className="text-center">
                  <div className="text-sm font-medium">Próximo pago</div>
                  <div className="text-lg font-bold">
                    $
                    {(stats?.nextPayment?.amount || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats?.nextPayment?.date ? 
                      new Date(stats?.nextPayment?.date).toLocaleDateString(
                        "es-ES",
                        {
                          day: "numeric",
                          month: "long",
                        }
                      ) : "No programado"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actividad Reciente */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>
            Últimos clics y ventas de tus enlaces de afiliado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sales">
            <TabsList className="mb-4">
              <TabsTrigger value="sales">Ventas</TabsTrigger>
              <TabsTrigger value="clicks">Clics</TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              {stats?.recentSales && stats?.recentSales.length > 0 ? (
                <div className="space-y-4">
                  {stats?.recentSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-start justify-between py-2 border-b last:border-b-0"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <ShoppingCart className="h-4 w-4 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium">{sale?.productName || "Producto sin nombre"}</p>
                          <p className="text-xs text-muted-foreground">
                            {sale?.date ? new Date(sale.date).toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }) : "Fecha no disponible"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <div className="font-semibold">
                          +${(sale?.commission || 0).toFixed(2)}
                        </div>
                        <Badge
                          variant={
                            sale.status === "paid" ? "default" : "outline"
                          }
                          className="text-xs"
                        >
                          {sale.status === "paid" ? "Pagado" : "Pendiente"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border p-8 flex flex-col items-center justify-center text-center">
                  <Coins className="h-12 w-12 text-muted-foreground/70 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    Aún no hay ventas
                  </h3>
                  <p className="text-muted-foreground max-w-md mb-4">
                    Comparte tus enlaces con clientes potenciales para empezar a
                    generar ventas y comisiones.
                  </p>
                  <Button variant="secondary" className="gap-2">
                    Crear nuevo enlace
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="clicks">
              {stats?.recentClicks && stats?.recentClicks.length > 0 ? (
                <div className="space-y-4">
                  {stats?.recentClicks.map((click) => (
                    <div
                      key={click.id}
                      className="flex items-start justify-between py-2 border-b last:border-b-0"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`h-10 w-10 rounded-full ${
                            click?.converted
                              ? "bg-green-100"
                              : "bg-blue-100"
                          } flex items-center justify-center`}
                        >
                          {click?.converted ? (
                            <ShoppingCart className="h-4 w-4 text-green-500" />
                          ) : (
                            <MousePointerClick className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{click?.productName || "Producto sin nombre"}</p>
                          <p className="text-xs text-muted-foreground">
                            {click?.date ? new Date(click.date).toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }) : "Fecha no disponible"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <Badge
                          variant={click?.converted ? "default" : "outline"}
                          className="text-xs"
                        >
                          {click?.converted ? "Convertido" : "Solo clic"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border p-8 flex flex-col items-center justify-center text-center">
                  <MousePointerClick className="h-12 w-12 text-muted-foreground/70 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    Aún no hay clics registrados
                  </h3>
                  <p className="text-muted-foreground max-w-md mb-4">
                    Comparte tus enlaces con clientes potenciales y comienza a
                    rastrear clics en tus enlaces.
                  </p>
                  <Button variant="secondary" className="gap-2">
                    Crear nuevo enlace
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}