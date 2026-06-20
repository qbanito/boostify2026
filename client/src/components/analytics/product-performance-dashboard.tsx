import React, { useState, useEffect } from 'react';
import { logger } from "../../lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  BarChart, Bar, 
  LineChart, Line, 
  PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter,
  ComposedChart
} from 'recharts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { GeneratedArtist } from '../../types/artist';

// Colores para los gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A259FF'];

export default function ProductPerformanceDashboard() {
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [productsData, setProductsData] = useState<GeneratedArtist[]>([]);
  const [subscriptionMetrics, setSubscriptionMetrics] = useState<any>({});
  const [videoMetrics, setVideoMetrics] = useState<any>({});
  const [courseMetrics, setCourseMetrics] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProductData() {
      try {
        // Obtener datos de artistas
        const artistsCollection = collection(db, 'generated_artists');
        const artistsSnapshot = await getDocs(artistsCollection);
        const artists = artistsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as GeneratedArtist[];
        
        setProductsData(artists);
        
        // Procesar métricas de suscripción
        const subscriptionPlans: {[key: string]: number} = {
          'Basic': 0,
          'Pro': 0,
          'Enterprise': 0
        };
        
        // Contador de videos y cursos
        let totalVideoCount = 0;
        let totalVideoPurchaseValue = 0;
        let totalCourseCount = 0;
        let totalCoursePurchaseValue = 0;
        
        artists.forEach((artist: GeneratedArtist) => {
          // Contar por tipo de suscripción
          if (artist.subscription?.plan) {
            subscriptionPlans[artist.subscription.plan]++;
          }
          
          // Contar videos
          if (artist.purchases?.videos?.videos) {
            totalVideoCount += artist.purchases.videos.videos.length;
            totalVideoPurchaseValue += artist.purchases.videos.totalSpent || 0;
          }
          
          // Contar cursos
          if (artist.purchases?.courses?.courses) {
            totalCourseCount += artist.purchases.courses.courses.length;
            totalCoursePurchaseValue += artist.purchases.courses.totalSpent || 0;
          }
        });
        
        // Calcular ratios y métricas
        const totalUsers = artists.length;
        const totalSubscribers = subscriptionPlans.Basic + subscriptionPlans.Pro + subscriptionPlans.Enterprise;
        const subscriberRatio = totalUsers > 0 ? (totalSubscribers / totalUsers) * 100 : 0;
        
        // Métricas de suscripción
        setSubscriptionMetrics({
          totalUsers: totalUsers,
          totalSubscribers: totalSubscribers,
          subscriberRatio: subscriberRatio,
          plans: subscriptionPlans,
          planRatios: {
            'Basic': totalSubscribers > 0 ? (subscriptionPlans.Basic / totalSubscribers) * 100 : 0,
            'Pro': totalSubscribers > 0 ? (subscriptionPlans.Pro / totalSubscribers) * 100 : 0,
            'Enterprise': totalSubscribers > 0 ? (subscriptionPlans.Enterprise / totalSubscribers) * 100 : 0
          }
        });
        
        // Métricas de videos
        setVideoMetrics({
          totalCount: totalVideoCount,
          totalPurchaseValue: totalVideoPurchaseValue,
          avgPrice: totalVideoCount > 0 ? totalVideoPurchaseValue / totalVideoCount : 0,
          purchaseRate: totalUsers > 0 ? (artists.filter(a => (a.purchases?.videos?.videos?.length || 0) > 0).length / totalUsers) * 100 : 0,
          avgVideosPerBuyer: artists.filter(a => (a.purchases?.videos?.videos?.length || 0) > 0).length > 0 
            ? totalVideoCount / artists.filter(a => (a.purchases?.videos?.videos?.length || 0) > 0).length 
            : 0
        });
        
        // Métricas de cursos
        setCourseMetrics({
          totalCount: totalCourseCount,
          totalPurchaseValue: totalCoursePurchaseValue,
          avgPrice: totalCourseCount > 0 ? totalCoursePurchaseValue / totalCourseCount : 0,
          purchaseRate: totalUsers > 0 ? (artists.filter(a => (a.purchases?.courses?.courses?.length || 0) > 0).length / totalUsers) * 100 : 0,
          avgCoursesPerBuyer: artists.filter(a => (a.purchases?.courses?.courses?.length || 0) > 0).length > 0 
            ? totalCourseCount / artists.filter(a => (a.purchases?.courses?.courses?.length || 0) > 0).length 
            : 0
        });
        
        setLoading(false);
      } catch (error) {
        logger.error("Error al cargar datos de productos:", error);
        setLoading(false);
      }
    }
    
    fetchProductData();
  }, []);

  // Función para generar datos históricos de suscripciones (simulados)
  const generateSubscriptionHistoryData = () => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Obtener valores actuales
    const currentBasic = subscriptionMetrics.plans?.Basic || 0;
    const currentPro = subscriptionMetrics.plans?.Pro || 0;
    const currentEnterprise = subscriptionMetrics.plans?.Enterprise || 0;
    
    // Factores de crecimiento mensual aproximados
    const basicGrowthFactor = 1.15;  // 15% mensual para Basic
    const proGrowthFactor = 1.18;    // 18% mensual para Pro
    const enterpriseGrowthFactor = 1.10;  // 10% mensual para Enterprise
    
    // Generar historia simulada con crecimiento progresivo inverso
    const historyData = [];
    
    for (let i = 0; i < months.length; i++) {
      const isLastMonth = i === months.length - 1;
      
      // Calcular valores pasados basados en crecimiento inverso
      const basicCount = isLastMonth 
        ? currentBasic 
        : Math.round(currentBasic / Math.pow(basicGrowthFactor, months.length - 1 - i));
        
      const proCount = isLastMonth 
        ? currentPro 
        : Math.round(currentPro / Math.pow(proGrowthFactor, months.length - 1 - i));
        
      const enterpriseCount = isLastMonth 
        ? currentEnterprise 
        : Math.round(currentEnterprise / Math.pow(enterpriseGrowthFactor, months.length - 1 - i));
      
      historyData.push({
        name: months[i],
        'Basic': basicCount,
        'Pro': proCount,
        'Enterprise': enterpriseCount,
        'Total': basicCount + proCount + enterpriseCount
      });
    }
    
    return historyData;
  };

  // Función para generar datos de ventas de productos por mes (simulados)
  const generateProductSalesData = () => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Obtener valores actuales totales
    const totalVideos = videoMetrics.totalCount || 0;
    const totalCourses = courseMetrics.totalCount || 0;
    
    // Factores de crecimiento mensual aproximados
    const videoGrowthFactor = 1.20;  // 20% mensual para videos
    const courseGrowthFactor = 1.15; // 15% mensual para cursos
    
    // Distribuir ventas a lo largo del año con algo de variabilidad
    const salesData = [];
    
    let cumulativeVideos = 0;
    let cumulativeCourses = 0;
    
    for (let i = 0; i < months.length; i++) {
      // Añadir variabilidad
      const videoVariability = 0.8 + Math.random() * 0.4; // Entre 80% y 120% del crecimiento base
      const courseVariability = 0.8 + Math.random() * 0.4; // Entre 80% y 120% del crecimiento base
      
      // Calcular ventas mensuales con crecimiento progresivo
      const videosInMonth = i === 0 
        ? Math.max(1, Math.round(totalVideos * 0.02)) 
        : Math.round((cumulativeVideos * (videoGrowthFactor - 1)) * videoVariability);
        
      const coursesInMonth = i === 0 
        ? Math.max(1, Math.round(totalCourses * 0.03)) 
        : Math.round((cumulativeCourses * (courseGrowthFactor - 1)) * courseVariability);
      
      // Ajustar último mes para cuadrar con totales actuales
      const isLastMonth = i === months.length - 1;
      const adjustedVideosInMonth = isLastMonth 
        ? Math.max(0, totalVideos - cumulativeVideos) 
        : videosInMonth;
        
      const adjustedCoursesInMonth = isLastMonth 
        ? Math.max(0, totalCourses - cumulativeCourses) 
        : coursesInMonth;
      
      cumulativeVideos += adjustedVideosInMonth;
      cumulativeCourses += adjustedCoursesInMonth;
      
      salesData.push({
        name: months[i],
        'Videos': adjustedVideosInMonth,
        'Cursos': adjustedCoursesInMonth,
        'Total Ventas': adjustedVideosInMonth + adjustedCoursesInMonth
      });
    }
    
    return salesData;
  };

  // Función para generar datos de rendimiento por producto (simulados)
  const generateProductPerformanceData = () => {
    return [
      { name: 'Plan Artist', rating: 4.2, price: 19.99, popularity: 90 },
      { name: 'Plan Elevate', rating: 4.5, price: 49.99, popularity: 85 },
      { name: 'Plan Amplify', rating: 4.6, price: 89.99, popularity: 75 },
      { name: 'Plan Dominate', rating: 4.8, price: 149.99, popularity: 65 },
      { name: 'Videos Musicales', rating: 4.7, price: 199, popularity: 80 },
      { name: 'Cursos Básicos', rating: 4.5, price: 149, popularity: 70 },
      { name: 'Cursos Avanzados', rating: 4.9, price: 299, popularity: 60 }
    ];
  };

  // Función para generar proyecciones de ventas (simuladas)
  const generateSalesProjections = () => {
    // Valores actuales como punto de partida
    const totalSubscriptionValue = 
      (subscriptionMetrics.plans?.Artist || 0) * 19.99 +
      (subscriptionMetrics.plans?.Elevate || 0) * 49.99 +
      (subscriptionMetrics.plans?.Amplify || 0) * 89.99 +
      (subscriptionMetrics.plans?.Dominate || 0) * 149.99;
    
    const totalVideoValue = videoMetrics.totalPurchaseValue || 0;
    const totalCourseValue = courseMetrics.totalPurchaseValue || 0;
    
    // Tasas de crecimiento anuales
    const subscriptionGrowthRate = 1.40; // 40% anual
    const videoGrowthRate = 1.35; // 35% anual
    const courseGrowthRate = 1.50; // 50% anual
    
    return [
      {
        year: '2025',
        Suscripciones: Math.round(totalSubscriptionValue),
        Videos: Math.round(totalVideoValue),
        Cursos: Math.round(totalCourseValue)
      },
      {
        year: '2026',
        Suscripciones: Math.round(totalSubscriptionValue * subscriptionGrowthRate),
        Videos: Math.round(totalVideoValue * videoGrowthRate),
        Cursos: Math.round(totalCourseValue * courseGrowthRate)
      },
      {
        year: '2027',
        Suscripciones: Math.round(totalSubscriptionValue * subscriptionGrowthRate * subscriptionGrowthRate),
        Videos: Math.round(totalVideoValue * videoGrowthRate * videoGrowthRate),
        Cursos: Math.round(totalCourseValue * courseGrowthRate * courseGrowthRate)
      },
      {
        year: '2028',
        Suscripciones: Math.round(totalSubscriptionValue * Math.pow(subscriptionGrowthRate, 3)),
        Videos: Math.round(totalVideoValue * Math.pow(videoGrowthRate, 3)),
        Cursos: Math.round(totalCourseValue * Math.pow(courseGrowthRate, 3))
      },
      {
        year: '2029',
        Suscripciones: Math.round(totalSubscriptionValue * Math.pow(subscriptionGrowthRate, 4)),
        Videos: Math.round(totalVideoValue * Math.pow(videoGrowthRate, 4)),
        Cursos: Math.round(totalCourseValue * Math.pow(courseGrowthRate, 4))
      }
    ];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Cargando datos de productos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Rendimiento de Productos</h2>
      </div>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="subscriptions">Suscripciones</TabsTrigger>
          <TabsTrigger value="products">Videos y Cursos</TabsTrigger>
          <TabsTrigger value="projections">Proyecciones</TabsTrigger>
        </TabsList>
        
        <TabsContent value="subscriptions" className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Suscripciones</CardTitle>
                <CardDescription>Porcentaje por tipo de plan</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Basic', value: subscriptionMetrics.plans?.Basic || 0 },
                        { name: 'Pro', value: subscriptionMetrics.plans?.Pro || 0 },
                        { name: 'Enterprise', value: subscriptionMetrics.plans?.Enterprise || 0 }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value, percent }) => 
                        `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {[
                        { name: 'Basic', value: 0 },
                        { name: 'Pro', value: 0 },
                        { name: 'Enterprise', value: 0 }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Evolución de Suscripciones</CardTitle>
                <CardDescription>Crecimiento mensual por tipo de plan</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={generateSubscriptionHistoryData()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorBasic" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorPro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorEnterprise" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffc658" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ffc658" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="Basic" stroke="#8884d8" fillOpacity={1} fill="url(#colorBasic)" />
                    <Area type="monotone" dataKey="Pro" stroke="#82ca9d" fillOpacity={1} fill="url(#colorPro)" />
                    <Area type="monotone" dataKey="Enterprise" stroke="#ffc658" fillOpacity={1} fill="url(#colorEnterprise)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Conversión</CardTitle>
                <CardDescription>Tasas de adopción de suscripciones</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <div className="h-full flex flex-col justify-center">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-xl text-muted-foreground mb-2">Tasa de Suscripción</div>
                      <div className="text-5xl font-bold">
                        {subscriptionMetrics.subscriberRatio?.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        {subscriptionMetrics.totalSubscribers} de {subscriptionMetrics.totalUsers} usuarios
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-xl text-muted-foreground mb-2">Preferencia de Plan</div>
                      <div className="w-full mt-4">
                        <div className="flex justify-between mb-1">
                          <span>Basic</span>
                          <span>{subscriptionMetrics.planRatios?.Basic.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${subscriptionMetrics.planRatios?.Basic}%` }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between mb-1 mt-4">
                          <span>Pro</span>
                          <span>{subscriptionMetrics.planRatios?.Pro.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${subscriptionMetrics.planRatios?.Pro}%` }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between mb-1 mt-4">
                          <span>Enterprise</span>
                          <span>{subscriptionMetrics.planRatios?.Enterprise.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-yellow-500 h-2 rounded-full" 
                            style={{ width: `${subscriptionMetrics.planRatios?.Enterprise}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Valor Generado</CardTitle>
                <CardDescription>Ingresos totales por suscripciones</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <div className="h-full flex flex-col justify-center">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-xl text-muted-foreground mb-2">Ingresos Mensuales</div>
                      <div className="text-4xl font-bold">
                        {formatCurrency(
                          (subscriptionMetrics.plans?.Basic || 0) * 59.99 +
                          (subscriptionMetrics.plans?.Pro || 0) * 99.99 +
                          (subscriptionMetrics.plans?.Enterprise || 0) * 149.99
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        Actualmente activos
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-xl text-muted-foreground mb-2">Distribución de Ingresos</div>
                      <div className="w-full space-y-4 mt-2">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span>Basic</span>
                            <span>{formatCurrency((subscriptionMetrics.plans?.Basic || 0) * 59.99)}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ 
                                width: `${
                                  ((subscriptionMetrics.plans?.Basic || 0) * 59.99) / 
                                  ((subscriptionMetrics.plans?.Basic || 0) * 59.99 +
                                  (subscriptionMetrics.plans?.Pro || 0) * 99.99 +
                                  (subscriptionMetrics.plans?.Enterprise || 0) * 149.99) * 100
                                }%` 
                              }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span>Pro</span>
                            <span>{formatCurrency((subscriptionMetrics.plans?.Pro || 0) * 99.99)}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ 
                                width: `${
                                  ((subscriptionMetrics.plans?.Pro || 0) * 99.99) / 
                                  ((subscriptionMetrics.plans?.Basic || 0) * 59.99 +
                                  (subscriptionMetrics.plans?.Pro || 0) * 99.99 +
                                  (subscriptionMetrics.plans?.Enterprise || 0) * 149.99) * 100
                                }%` 
                              }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span>Enterprise</span>
                            <span>{formatCurrency((subscriptionMetrics.plans?.Enterprise || 0) * 149.99)}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-yellow-500 h-2 rounded-full" 
                              style={{ 
                                width: `${
                                  ((subscriptionMetrics.plans?.Enterprise || 0) * 149.99) / 
                                  ((subscriptionMetrics.plans?.Basic || 0) * 59.99 +
                                  (subscriptionMetrics.plans?.Pro || 0) * 99.99 +
                                  (subscriptionMetrics.plans?.Enterprise || 0) * 149.99) * 100
                                }%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="products" className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Ventas de Productos</CardTitle>
                <CardDescription>Evolución mensual de ventas</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={generateProductSalesData()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Videos" fill="#8884d8" />
                    <Bar dataKey="Cursos" fill="#82ca9d" />
                    <Line type="monotone" dataKey="Total Ventas" stroke="#ff7300" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Productos</CardTitle>
                <CardDescription>Comparativa entre videos y cursos</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <div className="h-full flex flex-col justify-center space-y-6">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{videoMetrics.totalCount || 0}</div>
                      <div className="text-sm text-muted-foreground">Videos Comprados</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{courseMetrics.totalCount || 0}</div>
                      <div className="text-sm text-muted-foreground">Cursos Comprados</div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Tasa de Compra (Videos)</span>
                        <span>{videoMetrics.purchaseRate?.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${videoMetrics.purchaseRate || 0}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Tasa de Compra (Cursos)</span>
                        <span>{courseMetrics.purchaseRate?.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${courseMetrics.purchaseRate || 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-lg font-semibold mb-1">{formatCurrency(videoMetrics.avgPrice || 0)}</div>
                      <div className="text-xs text-muted-foreground">Precio promedio por video</div>
                    </div>
                    
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-lg font-semibold mb-1">{formatCurrency(courseMetrics.avgPrice || 0)}</div>
                      <div className="text-xs text-muted-foreground">Precio promedio por curso</div>
                    </div>
                    
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-lg font-semibold mb-1">{videoMetrics.avgVideosPerBuyer?.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">Videos por comprador</div>
                    </div>
                    
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-lg font-semibold mb-1">{courseMetrics.avgCoursesPerBuyer?.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">Cursos por comprador</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Rendimiento de Productos</CardTitle>
                <CardDescription>Análisis comparativo de productos</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      dataKey="price" 
                      name="Precio" 
                      unit="$"
                      domain={[0, 350]}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="popularity" 
                      name="Popularidad" 
                      unit="%" 
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }} 
                      formatter={(value, name) => {
                        if (name === 'Precio') return [`${value}$`, name];
                        if (name === 'Popularidad') return [`${value}%`, name];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Scatter 
                      name="Productos" 
                      data={generateProductPerformanceData()} 
                      fill="#8884d8"
                    >
                      {generateProductPerformanceData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Ingresos por Producto</CardTitle>
                <CardDescription>Distribución de ingresos no recurrentes</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { 
                          name: 'Videos', 
                          value: videoMetrics.totalPurchaseValue || 0 
                        },
                        { 
                          name: 'Cursos', 
                          value: courseMetrics.totalPurchaseValue || 0 
                        }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value, percent }) => 
                        `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`}
                    >
                      <Cell fill="#0088FE" />
                      <Cell fill="#00C49F" />
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="projections" className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Proyección de Ingresos</CardTitle>
                <CardDescription>Proyección a 5 años por línea de producto</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={generateSalesProjections()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(value) => `$${(value/1000).toLocaleString()}k`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="Suscripciones" stackId="a" fill="#8884d8" />
                    <Bar dataKey="Videos" stackId="a" fill="#82ca9d" />
                    <Bar dataKey="Cursos" stackId="a" fill="#ffc658" />
                    <Line 
                      type="monotone" 
                      dataKey={(dataPoint) => 
                        dataPoint.Suscripciones + dataPoint.Videos + dataPoint.Cursos} 
                      name="Total" 
                      stroke="#ff7300" 
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Crecimiento por Producto</CardTitle>
                <CardDescription>Tendencia de crecimiento por tipo de producto</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={generateSalesProjections()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(value) => `$${(value/1000).toLocaleString()}k`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Line type="monotone" dataKey="Suscripciones" stroke="#8884d8" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="Videos" stroke="#82ca9d" />
                    <Line type="monotone" dataKey="Cursos" stroke="#ffc658" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Tabla de Proyecciones por Producto</CardTitle>
                <CardDescription>Desglose detallado de ingresos proyectados por año</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-4 py-2">Año</th>
                        <th className="text-right px-4 py-2">Suscripciones</th>
                        <th className="text-right px-4 py-2">Crecimiento</th>
                        <th className="text-right px-4 py-2">Videos</th>
                        <th className="text-right px-4 py-2">Crecimiento</th>
                        <th className="text-right px-4 py-2">Cursos</th>
                        <th className="text-right px-4 py-2">Crecimiento</th>
                        <th className="text-right px-4 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generateSalesProjections().map((projection, index) => {
                        const prevYear = index > 0 ? generateSalesProjections()[index - 1] : null;
                        return (
                          <tr key={index} className="border-b hover:bg-muted/50">
                            <td className="px-4 py-2 font-medium">{projection.year}</td>
                            <td className="text-right px-4 py-2">{formatCurrency(projection.Suscripciones)}</td>
                            <td className="text-right px-4 py-2 text-green-600">
                              {prevYear ? `+${Math.round((projection.Suscripciones / prevYear.Suscripciones - 1) * 100)}%` : '-'}
                            </td>
                            <td className="text-right px-4 py-2">{formatCurrency(projection.Videos)}</td>
                            <td className="text-right px-4 py-2 text-green-600">
                              {prevYear ? `+${Math.round((projection.Videos / prevYear.Videos - 1) * 100)}%` : '-'}
                            </td>
                            <td className="text-right px-4 py-2">{formatCurrency(projection.Cursos)}</td>
                            <td className="text-right px-4 py-2 text-green-600">
                              {prevYear ? `+${Math.round((projection.Cursos / prevYear.Cursos - 1) * 100)}%` : '-'}
                            </td>
                            <td className="text-right px-4 py-2 font-bold">
                              {formatCurrency(projection.Suscripciones + projection.Videos + projection.Cursos)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p>
                    Nota: Estas proyecciones se basan en tasas de crecimiento estimadas de 40% para suscripciones, 
                    35% para videos y 50% para cursos. Los resultados reales pueden variar significativamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}