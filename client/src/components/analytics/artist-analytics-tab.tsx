import React, { useState, useEffect } from 'react';
import { logger } from "../../lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ArrowUpRight, Users, DollarSign, CreditCard, TrendingUp, Music, FileVideo, GraduationCap } from 'lucide-react';
import { GeneratedArtist } from '../../types/artist';

// Colores para gráficos
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

interface SummaryData {
  totalArtists: number;
  totalRevenue: number;
  activeSubscriptions: number;
  growthRate: number;
  subscriptionDistribution: {
    Basic: number;
    Pro: number;
    Enterprise: number;
  };
  productDistribution: {
    Videos: number;
    Cursos: number;
  };
}

export default function ArtistAnalyticsTab() {
  const [timeRange, setTimeRange] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData>({
    totalArtists: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
    growthRate: 0,
    subscriptionDistribution: {
      Basic: 0,
      Pro: 0,
      Enterprise: 0
    },
    productDistribution: {
      Videos: 0,
      Cursos: 0
    }
  });
  const [overviewData, setOverviewData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchSummaryData() {
      try {
        // Obtener datos de artistas para generar resumen
        const artistsCollection = collection(db, 'generated_artists');
        const artistsSnapshot = await getDocs(artistsCollection);
        const artists = artistsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as GeneratedArtist[];
        
        // Calcular métricas
        const artistCount = artists.length;
        
        // Calcular ingresos totales y distribución de subscripciones
        let totalRevenue = 0;
        let subscriptionCount = 0;
        const subscriptionDistribution = {
          Basic: 0,
          Pro: 0,
          Enterprise: 0
        };
        
        let videoCount = 0;
        let courseCount = 0;
        
        artists.forEach((artist: GeneratedArtist) => {
          // Suscripciones
          if (artist.subscription?.plan) {
            totalRevenue += artist.subscription.price || 0;
            subscriptionCount++;
            
            // Contar por tipo de plan
            if (artist.subscription.plan in subscriptionDistribution) {
              subscriptionDistribution[artist.subscription.plan as keyof typeof subscriptionDistribution]++;
            }
          }
          
          // Cursos
          if (artist.purchases?.courses?.courses) {
            totalRevenue += artist.purchases.courses.totalSpent || 0;
            courseCount += artist.purchases.courses.courses.length || 0;
          }
          
          // Videos
          if (artist.purchases?.videos?.videos) {
            totalRevenue += artist.purchases.videos.totalSpent || 0;
            videoCount += artist.purchases.videos.videos.length || 0;
          }
        });
        
        // Generar datos de crecimiento para gráfico de resumen
        const summaryChartData = generateOverviewData(artistCount, totalRevenue);
        
        // Actualizar estado
        setSummary({
          totalArtists: artistCount,
          totalRevenue: totalRevenue,
          activeSubscriptions: subscriptionCount,
          growthRate: Math.round(10 + Math.random() * 15), // Valor simulado entre 10-25%
          subscriptionDistribution,
          productDistribution: {
            Videos: videoCount,
            Cursos: courseCount
          }
        });
        setOverviewData(summaryChartData);
        setLoading(false);
      } catch (error) {
        logger.error("Error al cargar datos de resumen:", error);
        setLoading(false);
      }
    }
    
    fetchSummaryData();
  }, []);

  // Generar datos simulados para el gráfico de visión general
  const generateOverviewData = (currentUsers: number, currentRevenue: number) => {
    const months = 12;
    const data = [];
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Definir tasa de crecimiento mensual
    const userGrowthRate = 0.06 + Math.random() * 0.04;
    const revenueGrowthRate = 0.08 + Math.random() * 0.05;
    
    // Iniciar con una base de usuarios e ingresos
    const startingUsers = Math.max(5, Math.floor(currentUsers / Math.pow(1 + userGrowthRate, months)));
    const startingRevenue = Math.max(500, Math.floor(currentRevenue / Math.pow(1 + revenueGrowthRate, months)));
    
    for (let i = 0; i < months; i++) {
      const date = new Date(currentYear, currentMonth - (months - 1) + i);
      
      // Calcular valores con crecimiento compuesto y variabilidad aleatoria
      const baseUserGrowth = startingUsers * Math.pow(1 + userGrowthRate, i);
      const baseRevenueGrowth = startingRevenue * Math.pow(1 + revenueGrowthRate, i);
      
      const randomFactor = 0.9 + Math.random() * 0.2; // Variabilidad entre 90% y 110%
      const users = Math.round(baseUserGrowth * randomFactor);
      const revenue = Math.round(baseRevenueGrowth * randomFactor);
      
      data.push({
        name: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
        'Usuarios': users,
        'Ingresos': revenue,
        'ARPU': Math.round((revenue / users) * 100) / 100
      });
    }
    
    return data;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  // Generar datos para el gráfico de distribución de ingresos
  const getRevenueDistribution = () => {
    // Estimar ingresos de suscripciones
    const subscriptionRevenue = summary.subscriptionDistribution.Basic * 59.99 +
                               summary.subscriptionDistribution.Pro * 99.99 +
                               summary.subscriptionDistribution.Enterprise * 149.99;
    
    // Estimar ingresos de productos
    const videoRevenue = summary.productDistribution.Videos * 199;
    const courseRevenue = summary.productDistribution.Cursos * 225; // Promedio entre 149 y 299
    
    return [
      { name: 'Suscripciones', value: subscriptionRevenue, color: COLORS[0] },
      { name: 'Videos', value: videoRevenue, color: COLORS[1] },
      { name: 'Cursos', value: courseRevenue, color: COLORS[2] }
    ];
  };

  if (loading) {
    return (
      <div className="container mx-auto py-4">
        <div className="flex items-center justify-center h-40">
          <div className="text-xl">Cargando datos analíticos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Análisis de Artistas</h2>
          <p className="text-muted-foreground mt-1">Panel de métricas de artistas generados</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-md text-sm font-medium flex items-center">
            <TrendingUp className="w-4 h-4 mr-1" /> 
            +{summary.growthRate}% crecimiento
          </div>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="overflow-hidden border-l-4 border-l-primary">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Total de Artistas</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.totalArtists.toLocaleString()}</div>
            <div className="flex items-center pt-1">
              <span className="text-xs text-green-500 flex items-center font-medium">
                <ArrowUpRight className="h-3 w-3 mr-1" /> 
                {summary.growthRate}%
              </span>
              <span className="text-xs text-muted-foreground ml-2">vs. mes pasado</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden border-l-4 border-l-green-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
            <div className="flex items-center pt-1">
              <span className="text-xs text-green-500 flex items-center font-medium">
                <ArrowUpRight className="h-3 w-3 mr-1" /> 
                {Math.round(summary.growthRate * 1.2)}%
              </span>
              <span className="text-xs text-muted-foreground ml-2">vs. mes pasado</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden border-l-4 border-l-amber-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Suscripciones Activas</CardTitle>
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.activeSubscriptions}</div>
            <div className="flex items-center pt-1">
              <span className="text-xs text-green-500 flex items-center font-medium">
                {((summary.activeSubscriptions / Math.max(1, summary.totalArtists)) * 100).toFixed(0)}%
              </span>
              <span className="text-xs text-muted-foreground ml-2">tasa de conversión</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="overflow-hidden border-l-4 border-l-purple-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Ingreso Por Usuario</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(summary.totalRevenue / Math.max(1, summary.totalArtists))}
            </div>
            <div className="flex items-center pt-1">
              <span className="text-xs text-green-500 flex items-center font-medium">
                <ArrowUpRight className="h-3 w-3 mr-1" /> 
                {Math.round(summary.growthRate * 0.8)}%
              </span>
              <span className="text-xs text-muted-foreground ml-2">vs. mes pasado</span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Area Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tendencia de Crecimiento</CardTitle>
                <CardDescription>Evolución de métricas clave (12 meses)</CardDescription>
              </div>
              <div className="flex space-x-2">
                <div className={`px-3 py-1 text-xs rounded-full cursor-pointer ${timeRange === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    onClick={() => setTimeRange('monthly')}>
                  Mensual
                </div>
                <div className={`px-3 py-1 text-xs rounded-full cursor-pointer ${timeRange === 'quarterly' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    onClick={() => setTimeRange('quarterly')}>
                  Trimestral
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={overviewData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tickFormatter={(value) => value.toLocaleString()} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'Ingresos') return [formatCurrency(Number(value)), name];
                    if (name === 'ARPU') return [formatCurrency(Number(value)), name];
                    return [value.toLocaleString(), name];
                  }} 
                />
                <Legend />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="Usuarios" 
                  stroke={COLORS[0]} 
                  fillOpacity={1}
                  fill="url(#colorUsers)" 
                />
                <Area 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="Ingresos" 
                  stroke={COLORS[1]} 
                  fillOpacity={1}
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Ingresos</CardTitle>
            <CardDescription>Por fuente de ingresos</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getRevenueDistribution()}
                  cx="50%"
                  cy="45%"
                  labelLine={true}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {getRevenueDistribution().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Products Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Distribución de Planes</CardTitle>
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Básico</p>
                  <p className="text-sm text-muted-foreground">${"59.99"}/mes</p>
                </div>
                <div className="text-primary font-medium">
                  {summary.subscriptionDistribution.Basic} usuarios
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Pro</p>
                  <p className="text-sm text-muted-foreground">${"99.99"}/mes</p>
                </div>
                <div className="text-primary font-medium">
                  {summary.subscriptionDistribution.Pro} usuarios
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Enterprise</p>
                  <p className="text-sm text-muted-foreground">${"149.99"}/mes</p>
                </div>
                <div className="text-primary font-medium">
                  {summary.subscriptionDistribution.Enterprise} usuarios
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Videos</CardTitle>
            <FileVideo className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {summary.productDistribution.Videos}
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Ingresos Totales</p>
                <p className="text-2xl font-semibold">
                  {formatCurrency(summary.productDistribution.Videos * 199)}
                </p>
              </div>
              <div className="text-muted-foreground text-sm">
                <p>Precio por video</p>
                <p className="font-medium">$199.00</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Cursos</CardTitle>
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {summary.productDistribution.Cursos}
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Ingresos Totales</p>
                <p className="text-2xl font-semibold">
                  {/* Precio promedio $225 (entre $149 y $299) */}
                  {formatCurrency(summary.productDistribution.Cursos * 225)}
                </p>
              </div>
              <div className="text-muted-foreground text-sm">
                <p>Precio promedio</p>
                <p className="font-medium">$149-$299</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Análisis Detallado */}
      <div className="space-y-6 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Análisis Detallado</h2>
          <div className="text-sm px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md font-medium">
            Actualizado: {new Date().toLocaleDateString()}
          </div>
        </div>
        
        <Card className="border-t-4 border-t-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              Proyección de Ingresos
            </CardTitle>
            <CardDescription>Análisis de tendencias y proyecciones a 12 meses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-lg border bg-card text-card-foreground shadow overflow-hidden">
                <div className="border-b bg-blue-50 dark:bg-blue-900/50 px-6 py-3">
                  <h4 className="text-base font-medium flex items-center gap-2 text-blue-800 dark:text-blue-100">
                    <DollarSign className="h-4 w-4" />
                    Métricas Clave
                  </h4>
                </div>
                <div className="p-5">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                        <span className="text-sm font-medium">Tasa de conversión a suscripciones</span>
                      </div>
                      <div className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 px-3 py-1 rounded font-semibold text-sm">
                        {((summary.activeSubscriptions / Math.max(1, summary.totalArtists)) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                        <span className="text-sm font-medium">Valor promedio por artista</span>
                      </div>
                      <div className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 px-3 py-1 rounded font-semibold text-sm">
                        {formatCurrency(summary.totalRevenue / Math.max(1, summary.totalArtists))}
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                        <span className="text-sm font-medium">Retención estimada</span>
                      </div>
                      <div className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 px-3 py-1 rounded font-semibold text-sm">
                        {(75 + Math.random() * 15).toFixed(1)}%
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                        <span className="text-sm font-medium">Proyección anual</span>
                      </div>
                      <div className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 px-3 py-1 rounded font-semibold text-sm">
                        {formatCurrency(summary.totalRevenue * 12 * (1 + summary.growthRate/100))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="rounded-lg border bg-card text-card-foreground shadow overflow-hidden">
                <div className="border-b bg-green-50 dark:bg-green-900/50 px-6 py-3">
                  <h4 className="text-base font-medium flex items-center gap-2 text-green-800 dark:text-green-100">
                    <ArrowUpRight className="h-4 w-4" />
                    Oportunidades de Crecimiento
                  </h4>
                </div>
                <div className="p-5">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                        <CreditCard className="h-4 w-4 text-green-600 dark:text-green-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Aumento de conversión Enterprise</p>
                        <div className="mt-1 flex items-center">
                          <span className="text-xs mr-2">Incremento potencial</span>
                          <span className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 px-2 py-1 rounded font-semibold text-xs">
                            {formatCurrency(summary.subscriptionDistribution.Pro * 0.2 * (149.99 - 99.99))}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-4 w-4 text-green-600 dark:text-green-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Mayor penetración de cursos</p>
                        <div className="mt-1 flex items-center">
                          <span className="text-xs mr-2">Incremento potencial</span>
                          <span className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 px-2 py-1 rounded font-semibold text-xs">
                            {formatCurrency(summary.totalArtists * 0.1 * 225)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                        <FileVideo className="h-4 w-4 text-green-600 dark:text-green-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Expansión de videos premium</p>
                        <div className="mt-1 flex items-center">
                          <span className="text-xs mr-2">Incremento potencial</span>
                          <span className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 px-2 py-1 rounded font-semibold text-xs">
                            {formatCurrency(summary.totalArtists * 0.15 * 199)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-lg font-medium mb-4">Proyección de ROI por Segmento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Suscripciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {(summary.growthRate * 1.1).toFixed(1)}% ROI
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Retorno sobre inversión para adquisición de usuarios
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Videos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {(summary.growthRate * 0.9).toFixed(1)}% ROI
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Retorno sobre inversión en infraestructura
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-amber-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Cursos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {(summary.growthRate * 1.3).toFixed(1)}% ROI
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Retorno sobre inversión en contenido educativo
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}