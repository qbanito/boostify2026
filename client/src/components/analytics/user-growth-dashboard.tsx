import React, { useState, useEffect } from 'react';
import { logger } from "../../lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  BarChart, Bar, 
  LineChart, Line, 
  PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

// Colores para los gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A259FF'];
const GENDER_COLORS = ['#0088FE', '#FF8042'];

export default function UserGrowthDashboard() {
  const [activeTab, setActiveTab] = useState('demographics');
  const [artistsData, setArtistsData] = useState<any[]>([]);
  const [ageDistribution, setAgeDistribution] = useState<any[]>([]);
  const [genderDistribution, setGenderDistribution] = useState<any[]>([]);
  const [userGrowth, setUserGrowth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserData() {
      try {
        // Obtener datos de artistas
        const artistsCollection = collection(db, 'generated_artists');
        const artistsSnapshot = await getDocs(artistsCollection);
        const artists = artistsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setArtistsData(artists);
        
        // Procesar distribución de edades
        const ageGroups = {
          '18-25': 0,
          '26-35': 0,
        };
        
        // Procesar distribución de género
        const genderCounts = {
          'Hombre': 0,
          'Mujer': 0
        };
        
        artists.forEach(artist => {
          // Contar por grupo de edad
          if (artist.look?.description) {
            const description = artist.look.description.toLowerCase();
            
            if (description.includes('joven') || (description.includes('18-25'))) {
              ageGroups['18-25']++;
            } else if (description.includes('adulto') || (description.includes('26-35'))) {
              ageGroups['26-35']++;
            }
          }
          
          // Contar por género
          if (artist.look?.description) {
            const description = artist.look.description.toLowerCase();
            
            if (description.includes('hombre') || description.includes('masculino')) {
              genderCounts['Hombre']++;
            } else if (description.includes('mujer') || description.includes('femenina')) {
              genderCounts['Mujer']++;
            }
          }
        });
        
        // Crear datos para gráficos
        const ageDistributionData = [
          { name: '18-25 años', value: ageGroups['18-25'] },
          { name: '26-35 años', value: ageGroups['26-35'] }
        ];
        
        const genderDistributionData = [
          { name: 'Hombre', value: genderCounts['Hombre'] },
          { name: 'Mujer', value: genderCounts['Mujer'] }
        ];
        
        // Generar datos de crecimiento de usuarios (simulado)
        const userGrowthData = generateUserGrowthData(artists.length);
        
        setAgeDistribution(ageDistributionData);
        setGenderDistribution(genderDistributionData);
        setUserGrowth(userGrowthData);
        setLoading(false);
      } catch (error) {
        logger.error("Error al cargar datos de usuarios:", error);
        setLoading(false);
      }
    }
    
    fetchUserData();
  }, []);

  // Función para generar datos de crecimiento de usuarios (simulados)
  const generateUserGrowthData = (currentUserCount: number) => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Calcular usuario inicial aproximado (asumiendo 20% del total actual en enero)
    const initialUsers = Math.max(1, Math.floor(currentUserCount * 0.20));
    const monthlyGrowthRate = 1.20; // 20% de crecimiento mensual en promedio
    
    const growthData = [];
    let cumulativeUsers = initialUsers;
    
    for (let i = 0; i < months.length; i++) {
      // Variabilidad en la tasa de crecimiento mensual
      const variableGrowthRate = monthlyGrowthRate * (0.9 + Math.random() * 0.2); // Entre 90% y 110% de la tasa base
      
      // Calcular nuevos usuarios este mes
      const newUsers = i === 0 ? cumulativeUsers : Math.round(cumulativeUsers * (variableGrowthRate - 1));
      
      // Último mes debe reflejar el total actual
      const isLastMonth = i === months.length - 1;
      const adjustedNewUsers = isLastMonth 
        ? Math.max(0, currentUserCount - cumulativeUsers)
        : newUsers;
      
      cumulativeUsers += adjustedNewUsers;
      
      growthData.push({
        name: months[i],
        'Nuevos Usuarios': adjustedNewUsers,
        'Total Usuarios': isLastMonth ? currentUserCount : cumulativeUsers,
        'Tasa de Crecimiento': i === 0 ? 0 : Math.round((adjustedNewUsers / (cumulativeUsers - adjustedNewUsers)) * 100)
      });
    }
    
    return growthData;
  };

  // Función para generar datos de proyección de usuarios (simulados)
  const generateUserProjections = () => {
    if (userGrowth.length === 0) return [];
    
    const currentUsers = userGrowth[userGrowth.length - 1]['Total Usuarios'];
    const baseGrowthRate = 1.6; // 60% crecimiento anual base
    
    return [
      { year: '2025', users: currentUsers },
      { year: '2026', users: Math.round(currentUsers * baseGrowthRate) },
      { year: '2027', users: Math.round(currentUsers * baseGrowthRate * 1.4) },
      { year: '2028', users: Math.round(currentUsers * baseGrowthRate * 1.4 * 1.25) },
      { year: '2029', users: Math.round(currentUsers * baseGrowthRate * 1.4 * 1.25 * 1.15) }
    ];
  };

  // Función para generar datos de retención de usuarios (simulados)
  const generateRetentionData = () => {
    const retentionByMonth = [
      { name: 'Mes 1', value: 100 },
      { name: 'Mes 2', value: 65 },
      { name: 'Mes 3', value: 50 },
      { name: 'Mes 6', value: 40 },
      { name: 'Mes 12', value: 30 }
    ];
    
    return retentionByMonth;
  };
  
  // Función para generar datos de retención por tipo de plan (simulados)
  const generateRetentionByPlan = () => {
    return [
      { name: 'Basic', 'Mes 1': 100, 'Mes 3': 40, 'Mes 6': 30, 'Mes 12': 22 },
      { name: 'Pro', 'Mes 1': 100, 'Mes 3': 60, 'Mes 6': 52, 'Mes 12': 45 },
      { name: 'Enterprise', 'Mes 1': 100, 'Mes 3': 80, 'Mes 6': 75, 'Mes 12': 70 }
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Cargando datos de usuarios...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Análisis de Usuarios</h2>
      </div>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="demographics">Demografía</TabsTrigger>
          <TabsTrigger value="growth">Crecimiento</TabsTrigger>
          <TabsTrigger value="retention">Retención</TabsTrigger>
        </TabsList>
        
        <TabsContent value="demographics" className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Género</CardTitle>
                <CardDescription>Porcentaje de artistas por género</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {genderDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Edad</CardTitle>
                <CardDescription>Usuarios por grupo de edad</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ageDistribution}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8">
                      {ageDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Distribución Geográfica</CardTitle>
                <CardDescription>Ubicación de usuarios (Top 5)</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={[
                      { name: 'Estados Unidos', value: Math.round(artistsData.length * 0.35) },
                      { name: 'México', value: Math.round(artistsData.length * 0.20) },
                      { name: 'Argentina', value: Math.round(artistsData.length * 0.15) },
                      { name: 'España', value: Math.round(artistsData.length * 0.12) },
                      { name: 'Colombia', value: Math.round(artistsData.length * 0.08) }
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8">
                      {[0, 1, 2, 3, 4].map((index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Géneros Musicales</CardTitle>
                <CardDescription>Distribución por preferencia musical</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Pop', value: Math.round(artistsData.length * 0.25) },
                        { name: 'Rock', value: Math.round(artistsData.length * 0.20) },
                        { name: 'Hip-Hop', value: Math.round(artistsData.length * 0.18) },
                        { name: 'R&B', value: Math.round(artistsData.length * 0.15) },
                        { name: 'Electrónica', value: Math.round(artistsData.length * 0.12) },
                        { name: 'Otros', value: Math.round(artistsData.length * 0.10) }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="growth" className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Crecimiento Mensual</CardTitle>
                <CardDescription>Nuevos usuarios y total por mes</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={userGrowth}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Nuevos Usuarios" fill="#8884d8" />
                    <Bar dataKey="Total Usuarios" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Tasa de Crecimiento</CardTitle>
                <CardDescription>Porcentaje mensual de crecimiento</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={userGrowth}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="Tasa de Crecimiento" stroke="#8884d8" activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Tendencia Acumulada</CardTitle>
                <CardDescription>Crecimiento acumulado de usuarios</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={userGrowth}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="Total Usuarios" stroke="#8884d8" fillOpacity={1} fill="url(#colorUsers)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Proyección a 5 Años</CardTitle>
                <CardDescription>Crecimiento proyectado de usuarios</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={generateUserProjections()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="users" fill="#8884d8" name="Usuarios">
                      {generateUserProjections().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="retention" className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tasa de Retención</CardTitle>
                <CardDescription>Porcentaje de usuarios que permanecen activos</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={generateRetentionData()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Line type="monotone" dataKey="value" name="Tasa de Retención" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Retención por Plan</CardTitle>
                <CardDescription>Comparativa de retención según plan</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={generateRetentionByPlan()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                    <Bar dataKey="Mes 3" fill="#8884d8" />
                    <Bar dataKey="Mes 6" fill="#82ca9d" />
                    <Bar dataKey="Mes 12" fill="#ffc658" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Análisis de Cohorte</CardTitle>
                <CardDescription>Retención de usuarios por mes de registro (cohorte)</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { name: 'Ene', 'Mes 1': 100, 'Mes 2': 68, 'Mes 3': 54, 'Mes 6': 42 },
                      { name: 'Feb', 'Mes 1': 100, 'Mes 2': 65, 'Mes 3': 52, 'Mes 6': 40 },
                      { name: 'Mar', 'Mes 1': 100, 'Mes 2': 67, 'Mes 3': 55, 'Mes 6': 43 },
                      { name: 'Abr', 'Mes 1': 100, 'Mes 2': 70, 'Mes 3': 58, 'Mes 6': 45 },
                      { name: 'May', 'Mes 1': 100, 'Mes 2': 72, 'Mes 3': 62, 'Mes 6': 48 },
                      { name: 'Jun', 'Mes 1': 100, 'Mes 2': 71, 'Mes 3': 61, 'Mes 6': 47 }
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="Mes 1" stroke="#8884d8" />
                    <Line type="monotone" dataKey="Mes 2" stroke="#82ca9d" />
                    <Line type="monotone" dataKey="Mes 3" stroke="#ffc658" />
                    <Line type="monotone" dataKey="Mes 6" stroke="#ff8042" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}