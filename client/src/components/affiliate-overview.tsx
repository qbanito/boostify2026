import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { BarChart, LineChart, TrendingUp, Users, DollarSign, Link, Clock } from "lucide-react";

interface AffiliateOverviewProps {
  affiliateData: any;
}

export function AffiliateOverview({ affiliateData }: AffiliateOverviewProps) {
  // Datos de muestra para estadísticas y rendimiento
  const stats = [
    {
      title: "Clics totales",
      value: affiliateData?.stats?.totalClicks || 0,
      change: +15,
      icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Conversiones",
      value: affiliateData?.stats?.conversions || 0,
      change: +12.3,
      icon: <Users className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Ganancias",
      value: `$${(affiliateData?.stats?.earnings || 0).toFixed(2)}`,
      change: +18.1,
      icon: <DollarSign className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Enlaces activos",
      value: affiliateData?.links?.length || 0,
      change: +4,
      icon: <Link className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  // Datos de muestra para el gráfico de rendimiento
  const performanceData = [
    { name: "Lun", clicks: 120, conversions: 8 },
    { name: "Mar", clicks: 145, conversions: 10 },
    { name: "Mié", clicks: 132, conversions: 9 },
    { name: "Jue", clicks: 165, conversions: 12 },
    { name: "Vie", clicks: 187, conversions: 14 },
    { name: "Sáb", clicks: 142, conversions: 9 },
    { name: "Dom", clicks: 130, conversions: 8 },
  ];

  // Datos de muestra para productos populares
  const popularProducts = [
    {
      id: "prod1",
      name: "Curso de Producción Musical",
      clicks: 234,
      conversions: 18,
      commissionRate: 25,
      earnings: 450.0,
    },
    {
      id: "prod2",
      name: "Plugin de Masterización",
      clicks: 187,
      conversions: 15,
      commissionRate: 20,
      earnings: 297.0,
    },
    {
      id: "prod3",
      name: "Paquete de Distribución Musical",
      clicks: 156,
      conversions: 12,
      commissionRate: 30,
      earnings: 396.0,
    },
  ];

  const nextPayment = {
    amount: (affiliateData?.stats?.pendingPayment || 0).toFixed(2),
    date: "15 de marzo, 2025",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
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
                <span className={stat.change > 0 ? "text-green-500" : "text-red-500"}>
                  {stat.change > 0 ? "+" : ""}{stat.change}%
                </span>{" "}
                desde el mes pasado
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rendimiento semanal</CardTitle>
            <CardDescription>
              Vista general de clics y conversiones en los últimos 7 días
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex items-center justify-center">
              <LineChart className="h-8 w-8 text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Gráfico de rendimiento semanal (UI placeholder)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximo pago</CardTitle>
            <CardDescription>
              Resumen de tus ganancias pendientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-2">
              <div className="text-3xl font-bold">${nextPayment.amount}</div>
              <p className="text-xs text-muted-foreground flex items-center">
                <Clock className="mr-1 h-3 w-3" /> Fecha estimada: {nextPayment.date}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso del umbral de pago</span>
                <span>${nextPayment.amount} / $100</span>
              </div>
              <Progress value={Math.min((parseFloat(nextPayment.amount) / 100) * 100, 100)} />
              <p className="text-xs text-muted-foreground">
                {parseFloat(nextPayment.amount) >= 100 
                  ? "¡Umbral alcanzado! El pago se procesará próximamente."
                  : `Necesitas $${(100 - parseFloat(nextPayment.amount)).toFixed(2)} más para alcanzar el umbral de pago.`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos populares</CardTitle>
          <CardDescription>
            Los productos con mejor desempeño en tu cuenta de afiliado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase border-b">
                <tr>
                  <th scope="col" className="px-6 py-3">Producto</th>
                  <th scope="col" className="px-6 py-3 text-right">Clics</th>
                  <th scope="col" className="px-6 py-3 text-right">Conversiones</th>
                  <th scope="col" className="px-6 py-3 text-right">Tasa de comisión</th>
                  <th scope="col" className="px-6 py-3 text-right">Ganancias</th>
                </tr>
              </thead>
              <tbody>
                {popularProducts.map((product) => (
                  <tr key={product.id} className="border-b">
                    <td className="px-6 py-4 font-medium">{product.name}</td>
                    <td className="px-6 py-4 text-right">{product.clicks}</td>
                    <td className="px-6 py-4 text-right">{product.conversions}</td>
                    <td className="px-6 py-4 text-right">{product.commissionRate}%</td>
                    <td className="px-6 py-4 text-right">${product.earnings.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estado de cuenta</CardTitle>
          <CardDescription>
            Información y nivel de tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium">{affiliateData?.name || "Afiliado"}</h4>
              <p className="text-sm text-muted-foreground">{affiliateData?.email}</p>
            </div>
            <Badge variant="outline" className="ml-auto">
              {affiliateData?.level || "Nivel Básico"}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progreso al siguiente nivel</span>
              <span>$1,143 / $2,000</span>
            </div>
            <Progress value={57} />
            <p className="text-xs text-muted-foreground">
              Necesitas $857 más en ventas para alcanzar el nivel "Oro"
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}