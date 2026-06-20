import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { useState, useEffect } from "react";
import { 
  BarChart, 
  PieChart, 
  LineChart, 
  RefreshCcw, 
  Download, 
  Share, 
  Filter,
  Search,
  TrendingUp,
  ArrowUpDown,
  Activity,
  Calendar,
  Radio,
  Music,
  Newspaper,
  Zap,
  Clock
} from "lucide-react";

// Definiendo los tipos de datos para las interacciones y tendencias
interface AnalyticsData {
  category: string;
  count: number;
  period?: string;
  trend?: 'up' | 'down' | 'stable';
  percentage?: number;
}

interface CategoryData {
  [key: string]: number;
}

export function TrendTrackerPlugin() {
  // Estado para los datos de análisis
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [trends, setTrends] = useState<CategoryData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [timeFrame, setTimeFrame] = useState("7days");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Datos de muestra para las tendencias
  const sampleAnalyticsData: AnalyticsData[] = [
    { category: 'news', count: 245, period: 'week', trend: 'up', percentage: 12 },
    { category: 'music', count: 352, period: 'week', trend: 'up', percentage: 28 },
    { category: 'videos', count: 187, period: 'week', trend: 'down', percentage: 5 },
    { category: 'courses', count: 98, period: 'week', trend: 'stable', percentage: 0 },
    { category: 'events', count: 156, period: 'week', trend: 'up', percentage: 15 },
    { category: 'artists', count: 223, period: 'week', trend: 'stable', percentage: 2 },
    { category: 'playlists', count: 178, period: 'week', trend: 'up', percentage: 8 },
    { category: 'podcasts', count: 115, period: 'week', trend: 'down', percentage: 10 },
    { category: 'interviews', count: 87, period: 'week', trend: 'up', percentage: 22 },
    { category: 'releases', count: 132, period: 'week', trend: 'up', percentage: 18 }
  ];
  
  // Datos históricos para gráficos de tendencia
  const trendData = {
    news: [120, 145, 165, 190, 210, 230, 245],
    music: [210, 220, 255, 280, 310, 335, 352],
    videos: [220, 205, 198, 195, 190, 182, 187],
    courses: [95, 96, 97, 99, 98, 97, 98],
    events: [110, 115, 125, 130, 142, 150, 156]
  };

  // Analizar tendencias (versión simulada del método en el archivo JS)
  const analyzeTrends = (data: AnalyticsData[]): CategoryData => {
    return data.reduce((acc, cur) => {
      if (cur.category) {
        acc[cur.category] = (acc[cur.category] || 0) + cur.count;
      }
      return acc;
    }, {} as CategoryData);
  };
  
  // Cargar datos y analizar tendencias al montar el componente o cambiar el timeFrame
  useEffect(() => {
    loadAnalyticsData();
  }, [timeFrame]);
  
  // Simulación de carga de datos
  const loadAnalyticsData = () => {
    setIsLoading(true);
    
    // Simular tiempo de carga de datos
    setTimeout(() => {
      // Filtrar datos según el timeFrame seleccionado
      let filteredData = [...sampleAnalyticsData];
      
      // Aplicar diferentes patrones de datos según el timeFrame (simulado)
      if (timeFrame === "30days") {
        filteredData = filteredData.map(item => ({
          ...item,
          count: Math.floor(item.count * 3.2),
          period: 'month'
        }));
      } else if (timeFrame === "90days") {
        filteredData = filteredData.map(item => ({
          ...item,
          count: Math.floor(item.count * 9.5),
          period: 'quarter'
        }));
      }
      
      setAnalyticsData(filteredData);
      
      // Analizar tendencias
      const analyzedTrends = analyzeTrends(filteredData);
      setTrends(analyzedTrends);
      
      setIsLoading(false);
    }, 800);
  };
  
  // Formatear números grandes
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };
  
  // Obtener color según tendencia
  const getTrendColor = (trend: 'up' | 'down' | 'stable' | undefined): string => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      case 'stable': return 'text-amber-600';
      default: return 'text-muted-foreground';
    }
  };
  
  // Obtener icono según tendencia
  const getTrendIcon = (trend: 'up' | 'down' | 'stable' | undefined) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
      case 'stable': return <Activity className="h-4 w-4 text-amber-600" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  // Obtener icono según categoría
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'news': return <Newspaper className="h-4 w-4" />;
      case 'music': return <Music className="h-4 w-4" />;
      case 'videos': return <Radio className="h-4 w-4" />;
      case 'courses': return <Zap className="h-4 w-4" />;
      case 'events': return <Calendar className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };
  
  // Filtrar datos según la búsqueda
  const filteredData = analyticsData.filter(item => 
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <BarChart className="w-5 h-5 mr-2 text-orange-500" />
            Analysis Settings
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="time-frame">Time Frame</Label>
              <Select 
                value={timeFrame}
                onValueChange={setTimeFrame}
              >
                <SelectTrigger id="time-frame">
                  <SelectValue placeholder="Select time period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="data-source">Data Source</Label>
              <Select defaultValue="all">
                <SelectTrigger id="data-source">
                  <SelectValue placeholder="Select data source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Interactions</SelectItem>
                  <SelectItem value="web">Website Only</SelectItem>
                  <SelectItem value="app">App Only</SelectItem>
                  <SelectItem value="social">Social Media</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="segment">User Segment</Label>
              <Select defaultValue="all-users">
                <SelectTrigger id="segment">
                  <SelectValue placeholder="Select user segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-users">All Users</SelectItem>
                  <SelectItem value="new-users">New Users</SelectItem>
                  <SelectItem value="premium">Premium Subscribers</SelectItem>
                  <SelectItem value="active">Active Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-2">
              <Button 
                variant="default" 
                className="w-full"
                onClick={loadAnalyticsData}
                disabled={isLoading}
              >
                <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Refreshing Data...' : 'Refresh Data'}
              </Button>
            </div>
            
            <div className="pt-4 border-t mt-4">
              <h4 className="text-sm font-medium mb-2">Export Options</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
            
            <div className="pt-4 border-t mt-4">
              <h4 className="text-sm font-medium mb-2">Schedule Reports</h4>
              <Button variant="outline" className="w-full" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Configure Schedule
              </Button>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-orange-500" />
            Quick Stats
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Total Interactions</p>
                <p className="text-2xl font-bold">
                  {formatNumber(Object.values(trends).reduce((sum, value) => sum + value, 0))}
                </p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{Object.keys(trends).length}</p>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Top Category</h4>
              {Object.entries(trends).length > 0 ? (
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(Object.entries(trends).sort((a, b) => b[1] - a[1])[0][0])}
                    <span className="font-medium capitalize">
                      {Object.entries(trends).sort((a, b) => b[1] - a[1])[0][0]}
                    </span>
                  </div>
                  <span className="font-bold">
                    {formatNumber(Object.entries(trends).sort((a, b) => b[1] - a[1])[0][1])}
                  </span>
                </div>
              ) : (
                <div className="text-center p-3 text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Growth Rate</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>7-day growth</span>
                  <span className="text-green-600">+15.2%</span>
                </div>
                <Progress value={15} />
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      <div className="lg:col-span-2 space-y-6">
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-6">
            <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
            <TabsTrigger value="detailed" className="flex-1">Detailed Analysis</TabsTrigger>
            <TabsTrigger value="predictions" className="flex-1">Predictions</TabsTrigger>
          </TabsList>
          
          <div className="mb-4 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <ArrowUpDown className="h-4 w-4 mr-1" />
              Sort
            </Button>
          </div>
          
          <TabsContent value="overview" className="m-0">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Trend Overview</h3>
              
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Most Popular</p>
                        <p className="text-xl font-bold capitalize">{
                          Object.entries(trends).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
                        }</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(Object.entries(trends).sort((a, b) => b[1] - a[1])[0]?.[1] || 0)} interactions
                        </p>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Fastest Growing</p>
                        <p className="text-xl font-bold capitalize">
                          {analyticsData.sort((a, b) => (b.percentage || 0) - (a.percentage || 0))[0]?.category || 'N/A'}
                        </p>
                        <p className="text-xs text-green-600">
                          +{analyticsData.sort((a, b) => (b.percentage || 0) - (a.percentage || 0))[0]?.percentage || 0}% growth
                        </p>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Avg. Interaction Time</p>
                        <p className="text-xl font-bold">3.8 min</p>
                        <p className="text-xs text-muted-foreground">
                          +0.5 min from last period
                        </p>
                      </div>
                    </Card>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-3">Top 5 Categories</h4>
                    <div className="space-y-3">
                      {Object.entries(trends)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([category, count], index) => {
                          const categoryData = analyticsData.find(item => item.category === category);
                          return (
                            <div key={category} className="flex items-center gap-2">
                              <span className="w-5 text-sm text-muted-foreground">{index + 1}</span>
                              <div className="flex-grow">
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-medium capitalize">{category}</span>
                                  <span className="text-sm">
                                    {formatNumber(count)} ({Math.round((count / Object.values(trends).reduce((sum, val) => sum + val, 0)) * 100)}%)
                                  </span>
                                </div>
                                <Progress value={(count / Object.values(trends).sort((a, b) => b - a)[0]) * 100} />
                              </div>
                              <div className="flex items-center gap-1">
                                {getTrendIcon(categoryData?.trend)}
                                <span className={`text-xs ${getTrendColor(categoryData?.trend)}`}>
                                  {categoryData?.trend === 'up' ? '+' : categoryData?.trend === 'down' ? '-' : ''}
                                  {categoryData?.percentage || 0}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-3">Trend Chart (Last 7 Days)</h4>
                    <div className="h-[200px] bg-muted rounded-lg flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Interactive chart visualization would appear here</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
          
          <TabsContent value="detailed" className="m-0">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Detailed Analysis</h3>
              
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Category</th>
                          <th className="text-right py-2 px-3">Count</th>
                          <th className="text-right py-2 px-3">% of Total</th>
                          <th className="text-right py-2 px-3">Trend</th>
                          <th className="text-right py-2 px-3">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.length > 0 ? (
                          filteredData
                            .sort((a, b) => b.count - a.count)
                            .map((item) => {
                              const totalCount = Object.values(trends).reduce((sum, val) => sum + val, 0);
                              const percentage = (item.count / totalCount) * 100;
                              
                              return (
                                <tr key={item.category} className="border-b">
                                  <td className="py-2 px-3 capitalize">
                                    <div className="flex items-center gap-2">
                                      {getCategoryIcon(item.category)}
                                      {item.category}
                                    </div>
                                  </td>
                                  <td className="text-right py-2 px-3 font-medium">{formatNumber(item.count)}</td>
                                  <td className="text-right py-2 px-3">{percentage.toFixed(1)}%</td>
                                  <td className="text-right py-2 px-3">{getTrendIcon(item.trend)}</td>
                                  <td className={`text-right py-2 px-3 ${getTrendColor(item.trend)}`}>
                                    {item.trend === 'up' ? '+' : item.trend === 'down' ? '-' : ''}
                                    {item.percentage || 0}%
                                  </td>
                                </tr>
                              );
                            })
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-muted-foreground">
                              No results found. Try adjusting your search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
          
          <TabsContent value="predictions" className="m-0">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Trend Predictions</h3>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <h4 className="text-sm font-medium mb-2">Rising Categories</h4>
                    <div className="space-y-2">
                      {analyticsData
                        .filter(item => item.trend === 'up' && (item.percentage || 0) > 10)
                        .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
                        .slice(0, 3)
                        .map(item => (
                          <div key={item.category} className="flex justify-between items-center p-2 bg-green-50 border-l-4 border-green-500 rounded">
                            <span className="font-medium capitalize">{item.category}</span>
                            <span className="text-green-600">+{item.percentage}%</span>
                          </div>
                        ))}
                    </div>
                  </Card>
                  
                  <Card className="p-4">
                    <h4 className="text-sm font-medium mb-2">Declining Categories</h4>
                    <div className="space-y-2">
                      {analyticsData
                        .filter(item => item.trend === 'down')
                        .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
                        .slice(0, 3)
                        .map(item => (
                          <div key={item.category} className="flex justify-between items-center p-2 bg-red-50 border-l-4 border-red-500 rounded">
                            <span className="font-medium capitalize">{item.category}</span>
                            <span className="text-red-600">-{item.percentage}%</span>
                          </div>
                        ))}
                    </div>
                  </Card>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-3">30-Day Forecast</h4>
                  <div className="h-[200px] bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">AI-powered trend forecast visualization would appear here</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-3">AI Recommendations</h4>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center mb-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">Content Focus</Badge>
                      </div>
                      <p className="text-sm">
                        Focus on creating more music-related content as it shows strong growth (+28%).
                        Consider expanding into playlists and interviews which are trending upward.
                      </p>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center mb-2">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700">Engagement Opportunity</Badge>
                      </div>
                      <p className="text-sm">
                        Video content engagement is declining. Consider refreshing your video strategy
                        or introducing new interactive video formats to increase interest.
                      </p>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center mb-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700">Growth Strategy</Badge>
                      </div>
                      <p className="text-sm">
                        Events category shows consistent growth. Consider expanding your events offerings
                        and promoting them more prominently to capitalize on user interest.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}