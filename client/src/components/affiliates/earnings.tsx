import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { BarChart, LineChart, PieChart, ChevronDown, Download, Calendar, ArrowUpDown, Share2 } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface AffiliateEarningsProps {
  affiliateData: {
    id: string;
    level?: string;
    stats?: {
      totalClicks?: number;
      conversions?: number;
      earnings?: number;
      pendingPayment?: number;
    };
    paymentHistory?: any[];
  } | null;
}

export function AffiliateEarnings({ affiliateData }: AffiliateEarningsProps) {
  const { user } = useAuth() || {};
  // Datos de ejemplo para ganancias
  const earningsOverview = {
    total: affiliateData?.stats?.earnings || 0,
    pending: affiliateData?.stats?.pendingPayment || 0,
    thisMonth: 342.50,
    lastMonth: 287.75,
    monthlyGrowth: 19.02,
  };

  // Datos de ejemplo para historial de pagos
  const paymentHistory = [
    { id: "PAY-2025-02-15", date: "15/02/2025", amount: 287.75, status: "paid", method: "paypal" },
    { id: "PAY-2025-01-15", date: "15/01/2025", amount: 203.25, status: "paid", method: "paypal" },
    { id: "PAY-2024-12-15", date: "15/12/2024", amount: 156.50, status: "paid", method: "paypal" },
    { id: "PAY-2024-11-15", date: "15/11/2024", amount: 122.00, status: "paid", method: "paypal" },
  ];

  // Datos de ejemplo para productos
  const productEarnings = [
    { id: "prod1", name: "Curso de Producción Musical", sales: 12, earnings: 450.00, commission: "25%" },
    { id: "prod2", name: "Plugin de Masterización", sales: 10, earnings: 297.00, commission: "20%" },
    { id: "prod3", name: "Paquete de Distribución Musical", sales: 8, earnings: 396.00, commission: "30%" },
    { id: "prod4", name: "Curso de Marketing Musical", sales: 5, earnings: 187.50, commission: "25%" },
  ];

  // Datos de ejemplo para tendencias
  const monthlyTrends = [
    { month: "Oct", earnings: 122.00 },
    { month: "Nov", earnings: 156.50 },
    { month: "Dic", earnings: 203.25 },
    { month: "Ene", earnings: 287.75 },
    { month: "Feb", earnings: 342.50 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ganancias de Afiliado</h2>
          <p className="text-muted-foreground">
            Monitorea tus ingresos y rendimiento de campañas
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select defaultValue="thisMonth">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Seleccionar período" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="thisMonth">Este mes</SelectItem>
                <SelectItem value="lastMonth">Mes pasado</SelectItem>
                <SelectItem value="last3Months">Últimos 3 meses</SelectItem>
                <SelectItem value="thisYear">Este año</SelectItem>
                <SelectItem value="allTime">Todo el tiempo</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ganancias totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${earningsOverview.total.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Desde que te uniste como afiliado
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Este mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${earningsOverview.thisMonth.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">+{earningsOverview.monthlyGrowth}%</span> vs. mes anterior
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendiente de pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${earningsOverview.pending.toFixed(2)}</div>
            <div className="mt-2">
              <Progress value={Math.min((earningsOverview.pending / 100) * 100, 100)} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {earningsOverview.pending >= 100 
                ? "Umbral alcanzado para próximo pago" 
                : `$${(100 - earningsOverview.pending).toFixed(2)} para alcanzar umbral`}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tasa de conversión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7.3%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">+0.5%</span> vs. mes anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos y tablas */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Tendencia mensual</CardTitle>
                <CardDescription>
                  Evolución de tus ganancias en los últimos meses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center">
                  <LineChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Gráfico de tendencia mensual (UI placeholder)
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2 mt-4">
                  {monthlyTrends.map((item) => (
                    <div key={item.month} className="flex flex-col items-center">
                      <div className="text-sm font-medium">{item.month}</div>
                      <div className="text-muted-foreground text-xs">${item.earnings}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribución por producto</CardTitle>
                <CardDescription>
                  Ganancias por categoría de producto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] flex items-center justify-center mb-4">
                  <PieChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Gráfico de distribución (UI placeholder)
                  </span>
                </div>
                <div className="space-y-2">
                  {productEarnings.map((product) => (
                    <div key={product.id} className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                        <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                          {product.name}
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        ${product.earnings.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Detalles de rendimiento</CardTitle>
              <CardDescription>
                Estadísticas completas de rendimiento de tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Clics totales</h4>
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">2,487</span>
                      <Badge variant="outline" className="text-green-500">+15%</Badge>
                    </div>
                    <Progress value={75} />
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">CTR promedio</h4>
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">3.2%</span>
                      <Badge variant="outline" className="text-green-500">+0.5%</Badge>
                    </div>
                    <Progress value={65} />
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Visitas a enlaces</h4>
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">1,842</span>
                      <Badge variant="outline" className="text-green-500">+12%</Badge>
                    </div>
                    <Progress value={80} />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Conversiones</h4>
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">135</span>
                      <Badge variant="outline" className="text-green-500">+18%</Badge>
                    </div>
                    <Progress value={70} />
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Tasa de conversión</h4>
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">7.3%</span>
                      <Badge variant="outline" className="text-green-500">+0.5%</Badge>
                    </div>
                    <Progress value={85} />
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Valor promedio por orden</h4>
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">$47.35</span>
                      <Badge variant="outline" className="text-amber-500">-2.1%</Badge>
                    </div>
                    <Progress value={60} />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Enlaces activos</h4>
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">12</span>
                      <Badge variant="outline" className="text-green-500">+2</Badge>
                    </div>
                    <Progress value={60} />
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Productos promocionados</h4>
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">8</span>
                      <Badge variant="outline" className="text-green-500">+1</Badge>
                    </div>
                    <Progress value={50} />
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Comisión promedio</h4>
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">24.5%</span>
                      <Badge variant="outline" className="text-green-500">+0.5%</Badge>
                    </div>
                    <Progress value={75} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="products" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <CardTitle>Rendimiento por producto</CardTitle>
                  <CardDescription>
                    Análisis detallado de tus ganancias por producto
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select defaultValue="earnings">
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="earnings">Ganancias</SelectItem>
                        <SelectItem value="sales">Ventas</SelectItem>
                        <SelectItem value="commission">Comisión</SelectItem>
                        <SelectItem value="name">Nombre</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                    <TableHead className="text-right">Ganancias</TableHead>
                    <TableHead className="text-right">Conversión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productEarnings.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right">{product.sales}</TableCell>
                      <TableCell className="text-right">{product.commission}</TableCell>
                      <TableCell className="text-right">${product.earnings.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-green-500">8.2%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Comparativa de rendimiento</CardTitle>
              <CardDescription>
                Comparación de rendimiento entre productos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center">
                <BarChart className="h-8 w-8 text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Gráfico de comparativa (UI placeholder)
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="payments" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <CardTitle>Historial de pagos</CardTitle>
                  <CardDescription>
                    Registro de todos los pagos recibidos
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Filtrar por fecha
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Pago</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.id}</TableCell>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell className="capitalize">{payment.method}</TableCell>
                      <TableCell className="text-right">${payment.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={payment.status === "paid" ? "secondary" : "outline"}>
                          {payment.status === "paid" ? "Pagado" : "Pendiente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <div className="flex justify-between items-center w-full">
                <div className="text-sm text-muted-foreground">
                  Mostrando {paymentHistory.length} pagos recientes
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Próximo pago</CardTitle>
              <CardDescription>
                Detalles del próximo pago programado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-md p-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-medium">Monto estimado</h3>
                    <p className="text-3xl font-bold">${earningsOverview.pending.toFixed(2)}</p>
                  </div>
                  <Badge variant={earningsOverview.pending >= 100 ? "secondary" : "outline"}>
                    {earningsOverview.pending >= 100 ? "Aprobado" : "Pendiente"}
                  </Badge>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Fecha estimada</h4>
                      <p>15/03/2025</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Método de pago</h4>
                      <p>PayPal</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progreso del umbral de pago</span>
                      <span>${earningsOverview.pending.toFixed(2)} / $100.00</span>
                    </div>
                    <Progress value={Math.min((earningsOverview.pending / 100) * 100, 100)} />
                    <p className="text-xs text-muted-foreground">
                      {earningsOverview.pending >= 100 
                        ? "¡Has alcanzado el umbral! El pago será procesado en la próxima fecha de pago."
                        : `Necesitas $${(100 - earningsOverview.pending).toFixed(2)} más para alcanzar el umbral mínimo de pago.`}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-md p-4 space-y-4">
                <h3 className="font-medium">Configuración de pagos</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Método de pago predeterminado</h4>
                    <p>PayPal</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Email de pago</h4>
                    <p>{user?.email || "usuario@ejemplo.com"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Ciclo de pago</h4>
                    <p>Mensual (día 15)</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Umbral mínimo</h4>
                    <p>$100.00</p>
                  </div>
                </div>
                <div className="pt-2">
                  <Button variant="outline" size="sm">
                    Cambiar configuración
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}