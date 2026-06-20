import React, { useState, useEffect } from 'react';
import { logger } from "../../lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { GeneratedArtist } from '../../types/artist';

// Colores para los gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A259FF'];

export default function FinanceDashboard() {
  const [activeTab, setActiveTab] = useState('general');
  const [timeframe, setTimeframe] = useState('quarterly');
  const [subscriptionData, setSubscriptionData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [subscriptionDistribution, setSubscriptionDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFinancialData() {
      try {
        // Obtener datos de artistas para generar información financiera
        const artistsCollection = collection(db, 'generated_artists');
        const artistsSnapshot = await getDocs(artistsCollection);
        const artists = artistsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as GeneratedArtist[];
        
        // Procesar datos de suscripciones
        const subscriptionCounts: {[key: string]: number} = {
          'Basic': 0,
          'Pro': 0,
          'Enterprise': 0
        };
        
        let totalBasicRevenue = 0;
        let totalProRevenue = 0;
        let totalEnterpriseRevenue = 0;
        let totalVideoRevenue = 0;
        let totalCourseRevenue = 0;
        
        artists.forEach((artist: GeneratedArtist) => {
          if (artist.subscription?.plan) {
            subscriptionCounts[artist.subscription.plan]++;
            
            if (artist.subscription.plan === 'Basic') {
              totalBasicRevenue += artist.subscription.price || 0;
            } else if (artist.subscription.plan === 'Pro') {
              totalProRevenue += artist.subscription.price || 0;
            } else if (artist.subscription.plan === 'Enterprise') {
              totalEnterpriseRevenue += artist.subscription.price || 0;
            }
          }
          
          // Videos y cursos
          if (artist.purchases?.videos?.totalSpent) {
            totalVideoRevenue += artist.purchases.videos.totalSpent;
          }
          
          if (artist.purchases?.courses?.totalSpent) {
            totalCourseRevenue += artist.purchases.courses.totalSpent;
          }
        });
        
        // Crear datos para el gráfico de suscripciones
        const subscriptionDistributionData = [
          { name: 'Basic', value: subscriptionCounts['Basic'] },
          { name: 'Pro', value: subscriptionCounts['Pro'] },
          { name: 'Enterprise', value: subscriptionCounts['Enterprise'] }
        ];
        
        // Generar datos de ingresos trimestrales (simulados)
        const quarterlyRevenueData = generateQuarterlyRevenueData(
          totalBasicRevenue, 
          totalProRevenue, 
          totalEnterpriseRevenue,
          totalVideoRevenue,
          totalCourseRevenue
        );
        
        // Generar datos de suscripción por tiempo (simulados)
        const subscriptionTimeData = generateSubscriptionTimeData(subscriptionCounts);
        
        setSubscriptionDistribution(subscriptionDistributionData);
        setRevenueData(quarterlyRevenueData);
        setSubscriptionData(subscriptionTimeData);
        setLoading(false);
      } catch (error) {
        logger.error("Error al cargar datos financieros:", error);
        setLoading(false);
      }
    }
    
    fetchFinancialData();
  }, []);

  // Función para generar datos de ingresos trimestrales (simulados)
  const generateQuarterlyRevenueData = (
    basicRevenue: number,
    proRevenue: number,
    enterpriseRevenue: number,
    videoRevenue: number,
    courseRevenue: number
  ) => {
    // Distribución de ingresos por trimestre (simulados con crecimiento)
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const growthFactorSubscriptions = 1.15; // 15% de crecimiento trimestral
    const growthFactorProducts = 1.25; // 25% de crecimiento trimestral
    
    // Distribuir ingresos actuales en el último trimestre (Q4)
    const quarterlyData = [];
    
    for (let i = 0; i < quarters.length; i++) {
      // Factor de reducción para trimestres anteriores
      const subscriptionFactor = Math.pow(1/growthFactorSubscriptions, quarters.length - 1 - i);
      const productFactor = Math.pow(1/growthFactorProducts, quarters.length - 1 - i);
      
      // Aplicar factores de crecimiento/decrecimiento según el trimestre
      const quarterBasicRevenue = Math.round(basicRevenue * subscriptionFactor);
      const quarterProRevenue = Math.round(proRevenue * subscriptionFactor);
      const quarterEnterpriseRevenue = Math.round(enterpriseRevenue * subscriptionFactor);
      const quarterVideoRevenue = Math.round(videoRevenue * productFactor);
      const quarterCourseRevenue = Math.round(courseRevenue * productFactor);
      
      quarterlyData.push({
        name: quarters[i],
        'Suscripción Basic': quarterBasicRevenue,
        'Suscripción Pro': quarterProRevenue,
        'Suscripción Enterprise': quarterEnterpriseRevenue,
        'Videos': quarterVideoRevenue,
        'Cursos': quarterCourseRevenue,
        'Total': quarterBasicRevenue + quarterProRevenue + quarterEnterpriseRevenue + 
                quarterVideoRevenue + quarterCourseRevenue
      });
    }
    
    return quarterlyData;
  };

  // Función para generar datos de suscripción por tiempo (simulados)
  const generateSubscriptionTimeData = (subscriptionCounts: Record<string, number>) => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const totalSubscriptions = subscriptionCounts.Basic + subscriptionCounts.Pro + subscriptionCounts.Enterprise;
    
    // Distribución inicial aproximada
    const initialBasic = Math.max(1, Math.floor(subscriptionCounts.Basic * 0.3));
    const initialPro = Math.max(1, Math.floor(subscriptionCounts.Pro * 0.2));
    const initialEnterprise = Math.max(1, Math.floor(subscriptionCounts.Enterprise * 0.1));
    
    const monthlyData = [];
    
    for (let i = 0; i < months.length; i++) {
      // Factores de crecimiento mensual (ligeramente diferentes para cada plan)
      const basicGrowthFactor = 1.12 + (Math.random() * 0.05);  // ~12-17% mensual
      const proGrowthFactor = 1.15 + (Math.random() * 0.05);    // ~15-20% mensual
      const enterpriseGrowthFactor = 1.08 + (Math.random() * 0.07); // ~8-15% mensual
      
      // Calcular valores mensuales con crecimiento compuesto y algo de variabilidad
      const basicCount = Math.round(initialBasic * Math.pow(basicGrowthFactor, i));
      const proCount = Math.round(initialPro * Math.pow(proGrowthFactor, i));
      const enterpriseCount = Math.round(initialEnterprise * Math.pow(enterpriseGrowthFactor, i));
      
      // Asegurarse de que los valores finales coincidan aproximadamente con los totales actuales
      const isFinalMonth = i === months.length - 1;
      
      monthlyData.push({
        name: months[i],
        'Basic': isFinalMonth ? subscriptionCounts.Basic : basicCount,
        'Pro': isFinalMonth ? subscriptionCounts.Pro : proCount,
        'Enterprise': isFinalMonth ? subscriptionCounts.Enterprise : enterpriseCount,
      });
    }
    
    return monthlyData;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  // Generar proyecciones financieras para los próximos años
  const generateProjections = () => {
    if (revenueData.length === 0) return [];
    
    const currentYearTotal = revenueData.reduce((sum, quarter) => sum + quarter.Total, 0);
    
    return [
      { year: '2025', revenue: currentYearTotal },
      { year: '2026', revenue: Math.round(currentYearTotal * 1.35) }, // Crecimiento del 35%
      { year: '2027', revenue: Math.round(currentYearTotal * 1.35 * 1.30) }, // 30% adicional
      { year: '2028', revenue: Math.round(currentYearTotal * 1.35 * 1.30 * 1.25) }, // 25% adicional
      { year: '2029', revenue: Math.round(currentYearTotal * 1.35 * 1.30 * 1.25 * 1.20) } // 20% adicional
    ];
  };
  
  // Crear ARPU (Average Revenue Per User) por plan
  const calculateARPU = () => {
    if (revenueData.length === 0 || subscriptionDistribution.length === 0) return [];
    
    const totalBasicRevenue = revenueData.reduce((sum, quarter) => sum + quarter['Suscripción Basic'], 0);
    const totalProRevenue = revenueData.reduce((sum, quarter) => sum + quarter['Suscripción Pro'], 0);
    const totalEnterpriseRevenue = revenueData.reduce((sum, quarter) => sum + quarter['Suscripción Enterprise'], 0);
    
    const basicCount = subscriptionDistribution.find(item => item.name === 'Basic')?.value || 1;
    const proCount = subscriptionDistribution.find(item => item.name === 'Pro')?.value || 1;
    const enterpriseCount = subscriptionDistribution.find(item => item.name === 'Enterprise')?.value || 1;
    
    return [
      { name: 'Basic', value: totalBasicRevenue / basicCount },
      { name: 'Pro', value: totalProRevenue / proCount },
      { name: 'Enterprise', value: totalEnterpriseRevenue / enterpriseCount }
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Cargando datos financieros...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Análisis Financiero</h2>
        <Select defaultValue={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Seleccionar periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Mensual</SelectItem>
            <SelectItem value="quarterly">Trimestral</SelectItem>
            <SelectItem value="yearly">Anual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="subscriptions">Suscripciones</TabsTrigger>
          <TabsTrigger value="projections">Proyecciones</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Ingresos por Trimestre</CardTitle>
                <CardDescription>Distribución de ingresos por fuente</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revenueData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Bar dataKey="Suscripción Basic" stackId="a" fill="#8884d8" />
                    <Bar dataKey="Suscripción Pro" stackId="a" fill="#82ca9d" />
                    <Bar dataKey="Suscripción Enterprise" stackId="a" fill="#ffc658" />
                    <Bar dataKey="Videos" stackId="a" fill="#ff8042" />
                    <Bar dataKey="Cursos" stackId="a" fill="#a359ff" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Ingresos</CardTitle>
                <CardDescription>Porcentaje de ingresos por tipo de producto</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Suscripciones', value: revenueData.reduce((sum, q) => 
                          sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0) },
                        { name: 'Videos', value: revenueData.reduce((sum, q) => sum + q['Videos'], 0) },
                        { name: 'Cursos', value: revenueData.reduce((sum, q) => sum + q['Cursos'], 0) }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { name: 'Suscripciones', value: 0 },
                        { name: 'Videos', value: 0 },
                        { name: 'Cursos', value: 0 }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Ingresos por Usuario (ARPU)</CardTitle>
                <CardDescription>Promedio de ingresos por usuario según plan</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={calculateARPU()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Bar dataKey="value" fill="#8884d8">
                      {calculateARPU().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Total de Ingresos Anuales</CardTitle>
                <CardDescription>Ingresos totales agregados (2025)</CardDescription>
              </CardHeader>
              <CardContent className="h-80 flex flex-col justify-center items-center">
                <div className="text-6xl font-bold mb-4">
                  {formatCurrency(revenueData.reduce((sum, q) => sum + q.Total, 0))}
                </div>
                <div className="text-muted-foreground text-lg text-center">
                  Total de ingresos proyectados para el año completo
                </div>
                <div className="mt-6 grid grid-cols-3 gap-4 w-full">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Suscripciones</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(revenueData.reduce((sum, q) => 
                        sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0))}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Videos</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(revenueData.reduce((sum, q) => sum + q['Videos'], 0))}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Cursos</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(revenueData.reduce((sum, q) => sum + q['Cursos'], 0))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="subscriptions" className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Suscripciones</CardTitle>
                <CardDescription>Cantidad de usuarios por plan</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subscriptionDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {subscriptionDistribution.map((entry, index) => (
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
                <CardTitle>Crecimiento de Suscripciones</CardTitle>
                <CardDescription>Evolución mensual por tipo de plan</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={subscriptionData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Basic" stroke="#8884d8" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="Pro" stroke="#82ca9d" />
                    <Line type="monotone" dataKey="Enterprise" stroke="#ffc658" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Valor de Vida del Cliente (LTV)</CardTitle>
                <CardDescription>Estimación del valor de vida por tipo de cliente</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Basic', value: 59.99 * 12 }, // Anual
                      { name: 'Pro', value: 99.99 * 18 },   // 18 meses promedio
                      { name: 'Enterprise', value: 149.99 * 24 } // 24 meses promedio
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Bar dataKey="value" fill="#8884d8">
                      {[
                        { name: 'Basic', value: 0 },
                        { name: 'Pro', value: 0 },
                        { name: 'Enterprise', value: 0 }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="projections" className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Proyección de Ingresos a 5 Años</CardTitle>
                <CardDescription>Previsión de crecimiento de ingresos totales</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={generateProjections()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(value) => `$${(value/1000).toLocaleString()}k`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Bar dataKey="revenue" fill="#8884d8">
                      {generateProjections().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Proyección por Tipo de Producto</CardTitle>
                <CardDescription>Previsión de crecimiento por fuente de ingresos</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={[
                      { 
                        year: '2025',
                        Suscripciones: revenueData.reduce((sum, q) => 
                          sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0),
                        Videos: revenueData.reduce((sum, q) => sum + q['Videos'], 0),
                        Cursos: revenueData.reduce((sum, q) => sum + q['Cursos'], 0)
                      },
                      { 
                        year: '2026',
                        Suscripciones: Math.round(revenueData.reduce((sum, q) => 
                          sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0) * 1.40),
                        Videos: Math.round(revenueData.reduce((sum, q) => sum + q['Videos'], 0) * 1.30),
                        Cursos: Math.round(revenueData.reduce((sum, q) => sum + q['Cursos'], 0) * 1.35)
                      },
                      { 
                        year: '2027',
                        Suscripciones: Math.round(revenueData.reduce((sum, q) => 
                          sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0) * 1.40 * 1.35),
                        Videos: Math.round(revenueData.reduce((sum, q) => sum + q['Videos'], 0) * 1.30 * 1.25),
                        Cursos: Math.round(revenueData.reduce((sum, q) => sum + q['Cursos'], 0) * 1.35 * 1.30)
                      },
                      { 
                        year: '2028',
                        Suscripciones: Math.round(revenueData.reduce((sum, q) => 
                          sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0) * 1.40 * 1.35 * 1.30),
                        Videos: Math.round(revenueData.reduce((sum, q) => sum + q['Videos'], 0) * 1.30 * 1.25 * 1.20),
                        Cursos: Math.round(revenueData.reduce((sum, q) => sum + q['Cursos'], 0) * 1.35 * 1.30 * 1.25)
                      },
                      { 
                        year: '2029',
                        Suscripciones: Math.round(revenueData.reduce((sum, q) => 
                          sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0) * 1.40 * 1.35 * 1.30 * 1.25),
                        Videos: Math.round(revenueData.reduce((sum, q) => sum + q['Videos'], 0) * 1.30 * 1.25 * 1.20 * 1.15),
                        Cursos: Math.round(revenueData.reduce((sum, q) => sum + q['Cursos'], 0) * 1.35 * 1.30 * 1.25 * 1.20)
                      }
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(value) => `$${(value/1000).toLocaleString()}k`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Line type="monotone" dataKey="Suscripciones" stroke="#8884d8" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="Videos" stroke="#ff8042" />
                    <Line type="monotone" dataKey="Cursos" stroke="#a259ff" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Tabla de Proyecciones Financieras</CardTitle>
                <CardDescription>Resumen de ingresos proyectados y crecimiento anual</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left">Año</th>
                        <th className="px-4 py-2 text-right">Ingresos Totales</th>
                        <th className="px-4 py-2 text-right">Crecimiento</th>
                        <th className="px-4 py-2 text-right">Suscripciones</th>
                        <th className="px-4 py-2 text-right">Videos</th>
                        <th className="px-4 py-2 text-right">Cursos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { 
                          year: '2025',
                          revenue: revenueData.reduce((sum, q) => sum + q.Total, 0),
                          growth: '-',
                          subscriptions: revenueData.reduce((sum, q) => 
                            sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0),
                          videos: revenueData.reduce((sum, q) => sum + q['Videos'], 0),
                          courses: revenueData.reduce((sum, q) => sum + q['Cursos'], 0)
                        },
                        { 
                          year: '2026',
                          revenue: Math.round(revenueData.reduce((sum, q) => sum + q.Total, 0) * 1.35),
                          growth: '+35%',
                          subscriptions: Math.round(revenueData.reduce((sum, q) => 
                            sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0) * 1.40),
                          videos: Math.round(revenueData.reduce((sum, q) => sum + q['Videos'], 0) * 1.30),
                          courses: Math.round(revenueData.reduce((sum, q) => sum + q['Cursos'], 0) * 1.35)
                        },
                        { 
                          year: '2027',
                          revenue: Math.round(revenueData.reduce((sum, q) => sum + q.Total, 0) * 1.35 * 1.30),
                          growth: '+30%',
                          subscriptions: Math.round(revenueData.reduce((sum, q) => 
                            sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0) * 1.40 * 1.35),
                          videos: Math.round(revenueData.reduce((sum, q) => sum + q['Videos'], 0) * 1.30 * 1.25),
                          courses: Math.round(revenueData.reduce((sum, q) => sum + q['Cursos'], 0) * 1.35 * 1.30)
                        },
                        { 
                          year: '2028',
                          revenue: Math.round(revenueData.reduce((sum, q) => sum + q.Total, 0) * 1.35 * 1.30 * 1.25),
                          growth: '+25%',
                          subscriptions: Math.round(revenueData.reduce((sum, q) => 
                            sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0) * 1.40 * 1.35 * 1.30),
                          videos: Math.round(revenueData.reduce((sum, q) => sum + q['Videos'], 0) * 1.30 * 1.25 * 1.20),
                          courses: Math.round(revenueData.reduce((sum, q) => sum + q['Cursos'], 0) * 1.35 * 1.30 * 1.25)
                        },
                        { 
                          year: '2029',
                          revenue: Math.round(revenueData.reduce((sum, q) => sum + q.Total, 0) * 1.35 * 1.30 * 1.25 * 1.20),
                          growth: '+20%',
                          subscriptions: Math.round(revenueData.reduce((sum, q) => 
                            sum + q['Suscripción Basic'] + q['Suscripción Pro'] + q['Suscripción Enterprise'], 0) * 1.40 * 1.35 * 1.30 * 1.25),
                          videos: Math.round(revenueData.reduce((sum, q) => sum + q['Videos'], 0) * 1.30 * 1.25 * 1.20 * 1.15),
                          courses: Math.round(revenueData.reduce((sum, q) => sum + q['Cursos'], 0) * 1.35 * 1.30 * 1.25 * 1.20)
                        }
                      ].map((row, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-2 font-medium">{row.year}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(row.revenue)}</td>
                          <td className="px-4 py-2 text-right">{row.growth}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(row.subscriptions)}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(row.videos)}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(row.courses)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}