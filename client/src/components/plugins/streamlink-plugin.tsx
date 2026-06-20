import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Radio,
  Music,
  Headphones,
  Search,
  Play,
  Share,
  BarChart,
  RefreshCcw,
  Download,
  ChevronRight,
  Users
} from "lucide-react";

// Definir tipos para los datos de streaming
interface StreamingTrack {
  id: string;
  title: string;
  artist: string;
  albumName?: string;
  platform: string;
  streams: number;
  releaseDate: string;
  imageUrl?: string;
  previewUrl?: string;
  externalUrl?: string;
  popularity?: number;
  isPlaying?: boolean;
}

interface StreamingStats {
  platform: string;
  totalStreams: number;
  listeners: number;
  trend: 'up' | 'down' | 'stable';
  percentage: number;
  earnings: number;
}

export function StreamLinkPlugin() {
  const [searchQuery, setSearchQuery] = useState("");
  const [trackId, setTrackId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("tracks");
  const [activeTrack, setActiveTrack] = useState<StreamingTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<StreamingTrack[]>([]);
  const [streamingStats, setStreamingStats] = useState<StreamingStats[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  
  // Datos de ejemplo para simular la conexión a plataformas de streaming
  const mockTracks: StreamingTrack[] = [
    {
      id: "1",
      title: "Dreamscape",
      artist: "Aurora Lights",
      albumName: "Midnight Journey",
      platform: "spotify",
      streams: 2456789,
      releaseDate: "2024-01-15",
      imageUrl: "https://picsum.photos/200/200?random=1",
      popularity: 78,
      previewUrl: "https://p.scdn.co/mp3-preview/sample1"
    },
    {
      id: "2",
      title: "Electric Pulse",
      artist: "Neon Waves",
      albumName: "Digital Era",
      platform: "spotify",
      streams: 1854321,
      releaseDate: "2024-02-22",
      imageUrl: "https://picsum.photos/200/200?random=2",
      popularity: 82,
      previewUrl: "https://p.scdn.co/mp3-preview/sample2"
    },
    {
      id: "3",
      title: "Sunset Boulevard",
      artist: "Ocean Echoes",
      albumName: "Coastal Dreams",
      platform: "apple",
      streams: 978654,
      releaseDate: "2023-11-10",
      imageUrl: "https://picsum.photos/200/200?random=3",
      popularity: 65,
      previewUrl: "https://audio-ssl.itunes.apple.com/sample1"
    },
    {
      id: "4",
      title: "Rainforest",
      artist: "Aurora Lights",
      albumName: "Natural Rhythms",
      platform: "youtube",
      streams: 3254789,
      releaseDate: "2023-12-05",
      imageUrl: "https://picsum.photos/200/200?random=4",
      popularity: 91,
      previewUrl: "https://music.youtube.com/sample1"
    },
    {
      id: "5",
      title: "Urban Dreams",
      artist: "Neon Waves",
      albumName: "City Lights",
      platform: "amazon",
      streams: 877456,
      releaseDate: "2024-03-01",
      imageUrl: "https://picsum.photos/200/200?random=5",
      popularity: 72,
      previewUrl: "https://music.amazon.com/sample1"
    },
    {
      id: "6",
      title: "Cosmic Journey",
      artist: "Astral Project",
      albumName: "Space Odyssey",
      platform: "spotify",
      streams: 1357924,
      releaseDate: "2023-10-18",
      imageUrl: "https://picsum.photos/200/200?random=6",
      popularity: 76,
      previewUrl: "https://p.scdn.co/mp3-preview/sample3"
    },
    {
      id: "7",
      title: "Mountain High",
      artist: "Nature Sounds",
      albumName: "Elevation",
      platform: "apple",
      streams: 532876,
      releaseDate: "2024-01-30",
      imageUrl: "https://picsum.photos/200/200?random=7",
      popularity: 58,
      previewUrl: "https://audio-ssl.itunes.apple.com/sample2"
    }
  ];
  
  const mockStats: StreamingStats[] = [
    {
      platform: "spotify",
      totalStreams: 5669034,
      listeners: 346721,
      trend: "up",
      percentage: 12,
      earnings: 22676.14
    },
    {
      platform: "apple",
      totalStreams: 1511530,
      listeners: 93470,
      trend: "up",
      percentage: 8,
      earnings: 7255.34
    },
    {
      platform: "youtube",
      totalStreams: 3254789,
      listeners: 198543,
      trend: "down",
      percentage: 3,
      earnings: 9764.37
    },
    {
      platform: "amazon",
      totalStreams: 877456,
      listeners: 58954,
      trend: "stable",
      percentage: 0,
      earnings: 3509.82
    },
    {
      platform: "deezer",
      totalStreams: 456721,
      listeners: 29876,
      trend: "up",
      percentage: 5,
      earnings: 1826.88
    }
  ];
  
  // Función para cargar datos de streaming (simulada)
  const fetchStreamingData = async () => {
    setIsLoading(true);
    
    // Simular tiempo de carga
    setTimeout(() => {
      // Filtrar tracks según la plataforma seleccionada
      const filteredTracks = selectedPlatform === "all" 
        ? mockTracks 
        : mockTracks.filter(track => track.platform === selectedPlatform);
      
      // Filtrar por búsqueda si existe
      const searchedTracks = searchQuery 
        ? filteredTracks.filter(track => 
            track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            track.artist.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : filteredTracks;
      
      setTracks(searchedTracks);
      setStreamingStats(mockStats);
      setIsLoading(false);
    }, 1000);
  };
  
  // Obtener datos al montar el componente o cambiar filtros
  useEffect(() => {
    fetchStreamingData();
  }, [selectedPlatform]);
  
  // Función para buscar tracks
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStreamingData();
  };
  
  // Función para formatear números grandes
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };
  
  // Función para formatear fechas
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Función para reproducir preview
  const togglePlayTrack = (track: StreamingTrack) => {
    if (activeTrack && activeTrack.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setActiveTrack(track);
      setIsPlaying(true);
    }
  };
  
  // Obtener color según plataforma
  const getPlatformColor = (platform: string): string => {
    switch (platform) {
      case 'spotify': return 'bg-green-100 text-green-800';
      case 'apple': return 'bg-pink-100 text-pink-800';
      case 'youtube': return 'bg-red-100 text-red-800';
      case 'amazon': return 'bg-blue-100 text-blue-800';
      case 'deezer': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Obtener icono según plataforma
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'spotify': return <Music className="h-4 w-4" />;
      case 'apple': return <Music className="h-4 w-4" />;
      case 'youtube': return <Radio className="h-4 w-4" />;
      case 'amazon': return <Headphones className="h-4 w-4" />;
      case 'deezer': return <Headphones className="h-4 w-4" />;
      default: return <Music className="h-4 w-4" />;
    }
  };
  
  // Obtener color según tendencia
  const getTrendColor = (trend: 'up' | 'down' | 'stable'): string => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      case 'stable': return 'text-amber-600';
    }
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Radio className="w-5 h-5 mr-2 text-orange-500" />
            Streaming Services
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="platform">Select Platform</Label>
              <Select 
                value={selectedPlatform}
                onValueChange={setSelectedPlatform}
              >
                <SelectTrigger id="platform">
                  <SelectValue placeholder="All Platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="spotify">Spotify</SelectItem>
                  <SelectItem value="apple">Apple Music</SelectItem>
                  <SelectItem value="youtube">YouTube Music</SelectItem>
                  <SelectItem value="amazon">Amazon Music</SelectItem>
                  <SelectItem value="deezer">Deezer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <form onSubmit={handleSearch} className="space-y-2">
              <Label htmlFor="track-search">Search Tracks</Label>
              <div className="flex gap-2">
                <Input 
                  id="track-search" 
                  placeholder="Search by title or artist"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button type="submit" variant="default" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </form>
            
            <div>
              <Label htmlFor="track-id">Track ID Lookup</Label>
              <div className="flex gap-2">
                <Input 
                  id="track-id" 
                  placeholder="Enter track ID"
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                />
                <Button variant="default" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Enter a specific track ID to fetch detailed performance data
              </p>
            </div>
            
            <div className="pt-2">
              <Button 
                variant="default" 
                className="w-full"
                onClick={fetchStreamingData}
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
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <BarChart className="w-5 h-5 mr-2 text-orange-500" />
            Quick Stats
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Total Streams</p>
                <p className="text-2xl font-bold">
                  {formatNumber(streamingStats.reduce((sum, stat) => sum + stat.totalStreams, 0))}
                </p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">Est. Earnings</p>
                <p className="text-2xl font-bold">
                  ${streamingStats.reduce((sum, stat) => sum + stat.earnings, 0).toFixed(2)}
                </p>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Top Platform</h4>
              {streamingStats.length > 0 ? (
                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(streamingStats.sort((a, b) => b.totalStreams - a.totalStreams)[0].platform)}
                    <span className="font-medium capitalize">
                      {streamingStats.sort((a, b) => b.totalStreams - a.totalStreams)[0].platform}
                    </span>
                  </div>
                  <span className="font-bold">
                    {formatNumber(streamingStats.sort((a, b) => b.totalStreams - a.totalStreams)[0].totalStreams)}
                  </span>
                </div>
              ) : (
                <div className="text-center p-3 text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Audience Reach</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Listeners</span>
                  <span className="font-medium">
                    {formatNumber(streamingStats.reduce((sum, stat) => sum + stat.listeners, 0))}
                  </span>
                </div>
                <Progress value={75} />
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      <div className="lg:col-span-2 space-y-6">
        <Tabs defaultValue="tracks" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-6">
            <TabsTrigger value="tracks" className="flex-1">Tracks</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1">Analytics</TabsTrigger>
            <TabsTrigger value="audience" className="flex-1">Audience</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tracks" className="m-0">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Track Data</h3>
              
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : tracks.length > 0 ? (
                <div className="space-y-4">
                  {tracks.map(track => (
                    <div key={track.id} className="flex items-center border rounded-lg p-3 hover:bg-muted transition-colors">
                      <div className="flex-shrink-0 mr-4">
                        <div className="relative bg-muted rounded-md overflow-hidden" style={{ width: '60px', height: '60px' }}>
                          {track.imageUrl ? (
                            <img src={track.imageUrl} alt={track.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <Music className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                            onClick={() => togglePlayTrack(track)}
                          >
                            <Play className="h-8 w-8 text-white" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between">
                          <h4 className="font-medium truncate">{track.title}</h4>
                          <Badge
                            variant="outline"
                            className={`${getPlatformColor(track.platform)} flex items-center gap-1`}
                          >
                            {getPlatformIcon(track.platform)}
                            <span className="capitalize">{track.platform}</span>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{track.artist}</p>
                        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                          <span>{formatDate(track.releaseDate)}</span>
                          <span>{formatNumber(track.streams)} streams</span>
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 ml-4">
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost">
                            <Share className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost">
                            <BarChart className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No tracks found. Try adjusting your search or filters.</p>
                </div>
              )}
            </Card>
          </TabsContent>
          
          <TabsContent value="analytics" className="m-0">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Streaming Analytics</h3>
              
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Most Popular Platform</p>
                        <p className="text-xl font-bold capitalize">{
                          streamingStats.sort((a, b) => b.totalStreams - a.totalStreams)[0]?.platform || 'N/A'
                        }</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(streamingStats.sort((a, b) => b.totalStreams - a.totalStreams)[0]?.totalStreams || 0)} streams
                        </p>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Fastest Growing</p>
                        <p className="text-xl font-bold capitalize">
                          {streamingStats.sort((a, b) => b.percentage - a.percentage)[0]?.platform || 'N/A'}
                        </p>
                        <p className="text-xs text-green-600">
                          +{streamingStats.sort((a, b) => b.percentage - a.percentage)[0]?.percentage || 0}% growth
                        </p>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Highest Earning</p>
                        <p className="text-xl font-bold capitalize">
                          {streamingStats.sort((a, b) => b.earnings - a.earnings)[0]?.platform || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${streamingStats.sort((a, b) => b.earnings - a.earnings)[0]?.earnings.toFixed(2) || 0}
                        </p>
                      </div>
                    </Card>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-3">Platform Performance</h4>
                    <div className="space-y-3">
                      {streamingStats
                        .sort((a, b) => b.totalStreams - a.totalStreams)
                        .map((platform) => {
                          const maxStreams = streamingStats.sort((a, b) => b.totalStreams - a.totalStreams)[0].totalStreams;
                          return (
                            <div key={platform.platform} className="flex items-center gap-2">
                              <div className="flex-grow">
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-medium capitalize flex items-center gap-1">
                                    {getPlatformIcon(platform.platform)}
                                    {platform.platform}
                                  </span>
                                  <span className="text-sm flex items-center gap-1">
                                    {formatNumber(platform.totalStreams)}
                                    <span className={`text-xs ${getTrendColor(platform.trend)}`}>
                                      {platform.trend === 'up' ? '+' : platform.trend === 'down' ? '-' : ''}
                                      {platform.percentage}%
                                    </span>
                                  </span>
                                </div>
                                <Progress value={(platform.totalStreams / maxStreams) * 100} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-3">Earnings Breakdown</h4>
                    <div className="h-[200px] bg-muted rounded-lg flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Earnings visualization would appear here</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
          
          <TabsContent value="audience" className="m-0">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Audience Demographics</h3>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Listeners by Platform</h4>
                    <div className="space-y-3">
                      {streamingStats
                        .sort((a, b) => b.listeners - a.listeners)
                        .map((platform) => {
                          const maxListeners = streamingStats.sort((a, b) => b.listeners - a.listeners)[0].listeners;
                          return (
                            <div key={platform.platform} className="flex items-center gap-2">
                              <div className="flex-grow">
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-medium capitalize flex items-center gap-1">
                                    {getPlatformIcon(platform.platform)}
                                    {platform.platform}
                                  </span>
                                  <span className="text-sm">
                                    {formatNumber(platform.listeners)} <Users className="h-3 w-3 inline" />
                                  </span>
                                </div>
                                <Progress value={(platform.listeners / maxListeners) * 100} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-3">Geographic Distribution</h4>
                    <div className="h-[200px] bg-muted rounded-lg flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Geographic map would appear here</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Age Demographics</h4>
                    <div className="h-[200px] bg-muted rounded-lg flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Age chart would appear here</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-3">Listening Activity</h4>
                    <div className="h-[200px] bg-muted rounded-lg flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Activity chart would appear here</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-3">Audience Engagement Insights</h4>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center mb-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">Audience Insight</Badge>
                      </div>
                      <p className="text-sm">
                        Your audience engagement is strongest on Spotify, with the highest retention rate. 
                        Consider focusing promotion efforts there.
                      </p>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center mb-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700">Growth Opportunity</Badge>
                      </div>
                      <p className="text-sm">
                        YouTube Music shows strong growth potential with a younger demographic.
                        Your visual content performs well on this platform.
                      </p>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center mb-2">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700">Action Needed</Badge>
                      </div>
                      <p className="text-sm">
                        Your Amazon Music presence needs attention, as it's 
                        showing lower engagement compared to other platforms.
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