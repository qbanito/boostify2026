import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { DollarSign, FileText, ArrowUpRight, Download, CreditCard, Calendar as CalendarIcon, Clock, Filter, ChevronDown, BarChart, LineChart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
// @radix-ui/react-icons mock
import { ArrowUpIcon, ArrowDownIcon, CheckIcon, Cross1Icon, QuestionMarkCircledIcon } from '../mocks/radix-icons-mock';
import { Calendar as CalendarComponent } from "./ui/calendar";

interface AffiliateEarningsProps {
  affiliateData: any;
}

interface AffiliateEarning {
  id: string;
  amount: number;
  orderId: string;
  productId: string;
  productName: string;
  status: string;
  createdAt: any;
}

interface AffiliatePayment {
  id: string;
  paymentId?: string;
  amount: number;
  status: string;
  method?: string;
  processedAt: any;
  createdAt: any;
}

export function AffiliateEarnings({ affiliateData }: AffiliateEarningsProps) {
  const { user } = useAuth() || {};
  const [activeTab, setActiveTab] = useState("overview");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [date, setDate] = useState<Date | undefined>(undefined);
  
  // Consulta para obtener las transacciones de ganancias
  const { data: earnings, isLoading: isLoadingEarnings } = useQuery<AffiliateEarning[]>({
    queryKey: ["affiliate-earnings", user?.uid, filterPeriod],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      const earningsRef = collection(db, "affiliateEarnings");
      let q = query(earningsRef, where("affiliateId", "==", user.uid));
      
      // Aplicar filtros según el período seleccionado
      if (filterPeriod !== "all") {
        const now = new Date();
        let startDate = new Date();
        
        switch (filterPeriod) {
          case "today":
            startDate.setHours(0, 0, 0, 0);
            break;
          case "week":
            startDate.setDate(now.getDate() - 7);
            break;
          case "month":
            startDate.setMonth(now.getMonth() - 1);
            break;
          case "year":
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        }
        
        q = query(q, where("createdAt", ">=", Timestamp.fromDate(startDate)));
      }
      
      q = query(q, orderBy("createdAt", "desc"));
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        amount: doc.data().amount || 0,
        orderId: doc.data().orderId || '',
        productId: doc.data().productId || '',
        productName: doc.data().productName || 'Desconocido',
        status: doc.data().status || 'Procesado'
      })) as AffiliateEarning[];
    },
    enabled: !!user?.uid,
  });

  // Consulta para obtener los pagos procesados
  const { data: payments, isLoading: isLoadingPayments } = useQuery<AffiliatePayment[]>({
    queryKey: ["affiliate-payments", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      const paymentsRef = collection(db, "affiliatePayments");
      const q = query(paymentsRef, where("affiliateId", "==", user.uid), orderBy("createdAt", "desc"));
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        processedAt: doc.data().processedAt?.toDate?.() || null,
        amount: doc.data().amount || 0,
        paymentId: doc.data().paymentId || doc.id.substring(0, 8),
        method: doc.data().method || 'bank_transfer',
        status: doc.data().status || 'pending'
      })) as AffiliatePayment[];
    },
    enabled: !!user?.uid,
  });

  // Calcular las ganancias totales y pendientes
  const totalEarnings = earnings?.reduce((sum, earning) => sum + (earning.amount || 0), 0) || 0;
  const pendingPayoutAmount = affiliateData?.stats?.pendingPayment || 0;
  const minimumPayoutThreshold = 50; // Umbral mínimo para solicitar pago
  const payoutProgress = (pendingPayoutAmount / minimumPayoutThreshold) * 100;

  // Estadísticas de resumen
  const earningStats = [
    {
      title: "Ganancias totales",
      value: `$${totalEarnings.toFixed(2)}`,
      icon: <DollarSign className="h-4 w-4 text-muted-foreground" />,
      change: "+23.1%",
    },
    {
      title: "Pedidos generados",
      value: earnings?.length || 0,
      icon: <FileText className="h-4 w-4 text-muted-foreground" />,
      change: "+12.5%",
    },
    {
      title: "Comisión promedio",
      value: `$${earnings && earnings.length > 0 ? (totalEarnings / earnings.length).toFixed(2) : "0.00"}`,
      icon: <ArrowUpRight className="h-4 w-4 text-muted-foreground" />,
      change: "+4.2%",
    },
    {
      title: "Pagos recibidos",
      value: `$${payments?.reduce((sum, payment) => sum + (payment.amount || 0), 0).toFixed(2) || "0.00"}`,
      icon: <CreditCard className="h-4 w-4 text-muted-foreground" />,
      change: "+18.7%",
    }
  ];

  // Definición de tipos para productos agrupados
  interface ProductSummary {
    productId: string;
    productName: string;
    count: number;
    total: number;
  }

  // Agrupar ganancias por producto
  const earningsByProduct = earnings?.reduce<Record<string, ProductSummary>>((acc, earning) => {
    const productId = earning.productId;
    if (!acc[productId]) {
      acc[productId] = {
        productId,
        productName: earning.productName || "Desconocido",
        count: 0,
        total: 0,
      };
    }
    acc[productId].count += 1;
    acc[productId].total += earning.amount || 0;
    return acc;
  }, {});

  // Convertir a array y ordenar por total
  const topProducts: ProductSummary[] = earningsByProduct ? 
    Object.values(earningsByProduct)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5) : 
    [];

  // Estados para simular datos de gráficos
  const chartPeriods = ["7D", "30D", "3M", "6M", "1A", "MAX"];
  const [chartPeriod, setChartPeriod] = useState("30D");

  // Función para descargar el informe de ganancias
  const downloadEarningsReport = () => {
    if (!earnings || earnings.length === 0) return;
    
    // Crear contenido CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Encabezados
    csvContent += "Fecha,Pedido,Producto,Comisión,Estado\n";
    
    // Filas de datos
    earnings.forEach(earning => {
      const date = format(new Date(earning.createdAt), "dd/MM/yyyy");
      const order = earning.orderId || "-";
      const product = earning.productName || "Desconocido";
      const amount = `$${earning.amount?.toFixed(2) || "0.00"}`;
      const status = earning.status || "Procesado";
      
      csvContent += `${date},${order},${product},${amount},${status}\n`;
    });
    
    // Crear enlace y activar descarga
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ganancias_afiliado_${format(new Date(), "dd-MM-yyyy")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ganancias</h2>
          <p className="text-muted-foreground">
            Realiza un seguimiento de tus comisiones y pagos como afiliado
          </p>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtrar
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="end">
              <div className="p-4 pb-0">
                <h4 className="font-medium text-sm">Filtrar por período</h4>
              </div>
              <div className="grid gap-2 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant={filterPeriod === "today" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setFilterPeriod("today")}
                  >
                    Hoy
                  </Button>
                  <Button 
                    variant={filterPeriod === "week" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setFilterPeriod("week")}
                  >
                    Últimos 7 días
                  </Button>
                  <Button 
                    variant={filterPeriod === "month" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setFilterPeriod("month")}
                  >
                    Último mes
                  </Button>
                  <Button 
                    variant={filterPeriod === "year" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setFilterPeriod("year")}
                  >
                    Último año
                  </Button>
                </div>
                <div className="grid gap-2 mt-2">
                  <Button 
                    variant={filterPeriod === "all" ? "default" : "outline"}
                    onClick={() => setFilterPeriod("all")}
                  >
                    Todo el historial
                  </Button>
                </div>
                <div className="grid gap-2 mt-2">
                  <div className="flex flex-col space-y-1.5">
                    <Label htmlFor="date">Fecha específica</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="date"
                          variant={"outline"}
                          className={`w-full justify-start text-left font-normal ${!date && "text-muted-foreground"}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "PPP", { locale: es }) : "Seleccionar fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={date}
                          onSelect={setDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button 
            variant="outline"
            onClick={downloadEarningsReport}
            disabled={!earnings || earnings.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Descargar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {earningStats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-500">{stat.change}</span>{" "}
                desde el mes pasado
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Saldo de ganancias</CardTitle>
              <CardDescription>
                El umbral mínimo para solicitar un pago es de ${minimumPayoutThreshold}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">${pendingPayoutAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Disponible para pago</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso hacia el próximo pago</span>
                <span>${pendingPayoutAmount.toFixed(2)} / ${minimumPayoutThreshold}</span>
              </div>
              <Progress value={payoutProgress} />
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {pendingPayoutAmount >= minimumPayoutThreshold
                    ? "¡Pago disponible! Puedes solicitar tu pago ahora."
                    : `Necesitas $${(minimumPayoutThreshold - pendingPayoutAmount).toFixed(2)} más para solicitar un pago.`}
                </span>
              </div>
              <Button 
                size="sm" 
                disabled={pendingPayoutAmount < minimumPayoutThreshold}
              >
                Solicitar pago
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Rendimiento de ganancias</CardTitle>
                <CardDescription>
                  Historial de tus comisiones a lo largo del tiempo
                </CardDescription>
              </div>
              <div className="flex border rounded-md p-1 gap-1">
                {chartPeriods.map(period => (
                  <Button 
                    key={period}
                    variant={chartPeriod === period ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setChartPeriod(period)}
                  >
                    {period}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Aquí iría el componente de gráfico en una implementación real */}
            <div className="h-[300px] w-full flex flex-col items-center justify-center">
              <LineChart className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Gráfico de rendimiento de ganancias (UI placeholder)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos más rentables</CardTitle>
            <CardDescription>
              Productos que generan más comisiones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {isLoadingEarnings ? (
                <div className="flex items-center justify-center h-[240px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : topProducts.length > 0 ? (
                topProducts.map((product, index: number) => (
                  <div key={product.productId} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="font-medium text-sm truncate max-w-[180px]">
                        {product.productName}
                      </div>
                      <div className="font-medium">${product.total.toFixed(2)}</div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ 
                          width: `${(product.total / (topProducts[0]?.total || 1)) * 100}%` 
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{product.count} ventas</span>
                      <span>${(product.total / product.count).toFixed(2)} prom.</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-[240px] text-center">
                  <BarChart className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Sin datos de productos</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tus estadísticas de productos aparecerán aquí cuando generes ventas
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid grid-cols-2 w-[400px]">
          <TabsTrigger value="transactions">Historial de Comisiones</TabsTrigger>
          <TabsTrigger value="payments">Pagos Recibidos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Historial de comisiones</CardTitle>
              <CardDescription>
                Detalle de todas las comisiones generadas por tus enlaces de afiliado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Fecha</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                      <TableHead className="text-right">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingEarnings ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          <div className="flex justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : earnings && earnings.length > 0 ? (
                      earnings.map((earning) => (
                        <TableRow key={earning.id}>
                          <TableCell className="font-medium">
                            {format(new Date(earning.createdAt), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            {earning.orderId || "-"}
                          </TableCell>
                          <TableCell>
                            {earning.productName || "Desconocido"}
                          </TableCell>
                          <TableCell className="text-right">
                            ${earning.amount?.toFixed(2) || "0.00"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant={earning.status === "pending" ? "outline" : "default"}
                              className={earning.status === "pending" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" : ""}
                            >
                              {earning.status === "pending" ? "Pendiente" : "Procesado"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No hay comisiones registradas
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Pagos recibidos</CardTitle>
              <CardDescription>
                Historial de pagos procesados a tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Fecha</TableHead>
                      <TableHead>ID de Pago</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingPayments ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          <div className="flex justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : payments && payments.length > 0 ? (
                      payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">
                            {format(new Date(payment.createdAt), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            {payment.paymentId || payment.id.substring(0, 8)}
                          </TableCell>
                          <TableCell>
                            {payment.method === "paypal" ? "PayPal" : 
                             payment.method === "bank_transfer" ? "Transferencia bancaria" : 
                             payment.method === "crypto" ? "Criptomoneda" : payment.method}
                          </TableCell>
                          <TableCell className="text-right">
                            ${payment.amount?.toFixed(2) || "0.00"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant={payment.status === "pending" ? "outline" : "default"}
                              className={
                                payment.status === "pending" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" : 
                                payment.status === "completed" ? "bg-green-500/10 text-green-600 border-green-500/20" : ""
                              }
                            >
                              {payment.status === "pending" ? "Pendiente" : 
                               payment.status === "processing" ? "Procesando" :
                               payment.status === "completed" ? "Completado" : payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No hay pagos registrados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}