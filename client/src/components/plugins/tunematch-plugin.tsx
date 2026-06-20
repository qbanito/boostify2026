import { Card } from "../ui/card";
import { logger } from "@/lib/logger";
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
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Slider } from "../ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ScrollArea } from "../ui/scroll-area";
import { useState, useEffect } from "react";
import { 
  Music as MusicIcon, 
  Heart, 
  Clock, 
  Star, 
  BarChart, 
  Headphones, 
  User,
  Settings,
  ArrowUpDown,
  Filter,
  Search,
  Radio,
  Play,
  Bookmark,
  RefreshCcw
} from "lucide-react";

// Definimos la interfaz para las recomendaciones
interface Recommendation {
  id: string;
  title: string;
  artist: string;
  albumCover: string;
  genres: string[];
  moods: string[];
  rating: number;
  releaseDate: string;
  matchScore: number;
  type: "song" | "album" | "playlist";
}

export function TuneMatchPlugin() {
  // Estado para las preferencias del usuario
  const [userPreferences, setUserPreferences] = useState({
    genres: ["Pop", "Rock", "Hip-Hop"],
    moods: ["Energetic", "Relaxed"],
    artists: ["Lunar Tides", "Echo Valley"],
    listeningTime: 2, // horas por día
    discoveryRate: 7, // en una escala de 1-10
  });

  // Estado para recomendaciones generadas
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [activeTab, setActiveTab] = useState("for-you");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Datos ficticios para las recomendaciones
  const dummyRecommendations: Recommendation[] = [
    {
      id: "1",
      title: "Neon Dreams",
      artist: "Lunar Tides",
      albumCover: "https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=Lunar+Tides",
      genres: ["Synthwave", "Pop"],
      moods: ["Energetic", "Upbeat"],
      rating: 4.7,
      releaseDate: "2025-02-15",
      matchScore: 95,
      type: "song"
    },
    {
      id: "2",
      title: "Acoustic Sessions Vol. 3",
      artist: "Echo Valley",
      albumCover: "https://ui-avatars.com/api/?background=D34E24&color=fff&name=Echo+Valley",
      genres: ["Folk", "Acoustic"],
      moods: ["Relaxed", "Introspective"],
      rating: 4.5,
      releaseDate: "2025-01-22",
      matchScore: 89,
      type: "album"
    },
    {
      id: "3",
      title: "Digital Horizons",
      artist: "Byte Collective",
      albumCover: "https://ui-avatars.com/api/?background=5D4E8C&color=fff&name=Byte+Collective",
      genres: ["Electronic", "Ambient"],
      moods: ["Focused", "Chill"],
      rating: 4.3,
      releaseDate: "2025-03-01",
      matchScore: 84,
      type: "playlist"
    },
    {
      id: "4",
      title: "Urban Echoes",
      artist: "Rhythm District",
      albumCover: "https://ui-avatars.com/api/?background=3C7D3E&color=fff&name=Rhythm+District",
      genres: ["Hip-Hop", "R&B"],
      moods: ["Energetic", "Confident"],
      rating: 4.6,
      releaseDate: "2024-12-10",
      matchScore: 81,
      type: "song"
    },
    {
      id: "5",
      title: "Sunset Boulevard",
      artist: "Coastal Waves",
      albumCover: "https://ui-avatars.com/api/?background=F7B32B&color=fff&name=Coastal+Waves",
      genres: ["Indie Pop", "Lo-Fi"],
      moods: ["Relaxed", "Nostalgic"],
      rating: 4.4,
      releaseDate: "2025-01-05",
      matchScore: 78,
      type: "album"
    },
    {
      id: "6",
      title: "Jazz Interpretations",
      artist: "The Midnight Quartet",
      albumCover: "https://ui-avatars.com/api/?background=222222&color=fff&name=Midnight+Quartet",
      genres: ["Jazz", "Instrumental"],
      moods: ["Sophisticated", "Relaxed"],
      rating: 4.8,
      releaseDate: "2024-11-20",
      matchScore: 75,
      type: "playlist"
    }
  ];

  // Géneros disponibles para seleccionar
  const availableGenres = [
    "Pop", "Rock", "Hip-Hop", "R&B", "Jazz", "Classical",
    "Electronic", "Indie", "Folk", "Country", "Metal", "Reggae",
    "Synthwave", "Lo-Fi", "Ambient", "House", "Soul", "Blues"
  ];

  // Estados de ánimo disponibles
  const availableMoods = [
    "Energetic", "Relaxed", "Happy", "Melancholic", "Focused",
    "Upbeat", "Chill", "Intense", "Romantic", "Nostalgic",
    "Confident", "Introspective", "Sophisticated", "Dreamy"
  ];

  // Simular carga de recomendaciones
  const loadRecommendations = () => {
    setIsLoading(true);
    // Simular tiempo de carga
    setTimeout(() => {
      setRecommendations(dummyRecommendations);
      setIsLoading(false);
    }, 800);
  };

  // Cargar recomendaciones al montar el componente
  useEffect(() => {
    loadRecommendations();
  }, []);

  // Actualizar recomendaciones cuando cambian las preferencias
  const handleUpdatePreferences = () => {
    setIsLoading(true);
    // Simular tiempo de actualización
    setTimeout(() => {
      const newRecommendations = [...dummyRecommendations]
        .sort(() => Math.random() - 0.5) // Mezclar para simular nuevas recomendaciones
        .map(rec => ({
          ...rec,
          matchScore: Math.floor(Math.random() * 20) + 80 // Nuevas puntuaciones entre 80-99
        }))
        .sort((a, b) => b.matchScore - a.matchScore); // Ordenar por puntuación

      setRecommendations(newRecommendations);
      setIsLoading(false);
    }, 1000);
  };

  // Formatear fecha
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Obtener color para la puntuación de coincidencia
  const getMatchScoreColor = (score: number): string => {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-emerald-500";
    if (score >= 70) return "text-blue-500";
    return "text-gray-500";
  };

  // Obtener color e icono para el tipo de contenido
  const getContentTypeInfo = (type: "song" | "album" | "playlist") => {
    switch (type) {
      case "song":
        return { color: "bg-blue-100 text-blue-800", icon: <MusicIcon className="h-3 w-3 mr-1" /> };
      case "album":
        return { color: "bg-purple-100 text-purple-800", icon: <Headphones className="h-3 w-3 mr-1" /> };
      case "playlist":
        return { color: "bg-amber-100 text-amber-800", icon: <Radio className="h-3 w-3 mr-1" /> };
      default:
        return { color: "bg-gray-100 text-gray-800", icon: <Star className="h-3 w-3 mr-1" /> };
    }
  };

  // Filtrar recomendaciones según la búsqueda
  const filteredRecommendations = recommendations.filter(rec => 
    rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.genres.some(g => g.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-orange-500" />
            Listener Profile
          </h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="genres">Favorite Genres</Label>
                <span className="text-xs text-muted-foreground">{userPreferences.genres.length} selected</span>
              </div>
              <ScrollArea className="h-[120px] border rounded-md p-2">
                <div className="space-y-2">
                  {availableGenres.map(genre => (
                    <div key={genre} className="flex items-center space-x-2">
                      <Switch 
                        id={`genre-${genre}`}
                        checked={userPreferences.genres.includes(genre)}
                        onCheckedChange={(checked) => {
                          setUserPreferences(prev => ({
                            ...prev,
                            genres: checked 
                              ? [...prev.genres, genre] 
                              : prev.genres.filter(g => g !== genre)
                          }));
                        }}
                      />
                      <Label htmlFor={`genre-${genre}`}>{genre}</Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="moods">Preferred Moods</Label>
                <span className="text-xs text-muted-foreground">{userPreferences.moods.length} selected</span>
              </div>
              <ScrollArea className="h-[120px] border rounded-md p-2">
                <div className="space-y-2">
                  {availableMoods.map(mood => (
                    <div key={mood} className="flex items-center space-x-2">
                      <Switch 
                        id={`mood-${mood}`}
                        checked={userPreferences.moods.includes(mood)}
                        onCheckedChange={(checked) => {
                          setUserPreferences(prev => ({
                            ...prev,
                            moods: checked 
                              ? [...prev.moods, mood] 
                              : prev.moods.filter(m => m !== mood)
                          }));
                        }}
                      />
                      <Label htmlFor={`mood-${mood}`}>{mood}</Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            
            <div>
              <Label htmlFor="listening-time">Daily Listening Time (hours)</Label>
              <div className="flex items-center gap-4 mt-2">
                <Slider
                  id="listening-time"
                  min={0}
                  max={5}
                  step={0.5}
                  value={[userPreferences.listeningTime]}
                  onValueChange={(value) => {
                    setUserPreferences(prev => ({
                      ...prev,
                      listeningTime: value[0]
                    }));
                  }}
                />
                <span className="font-medium">{userPreferences.listeningTime}</span>
              </div>
            </div>
            
            <div>
              <Label htmlFor="discovery-rate">Discovery Preference</Label>
              <div className="mt-1 text-sm text-muted-foreground flex justify-between">
                <span>Familiar</span>
                <span>Discover New</span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <Slider
                  id="discovery-rate"
                  min={1}
                  max={10}
                  step={1}
                  value={[userPreferences.discoveryRate]}
                  onValueChange={(value) => {
                    setUserPreferences(prev => ({
                      ...prev,
                      discoveryRate: value[0]
                    }));
                  }}
                />
                <span className="font-medium">{userPreferences.discoveryRate}</span>
              </div>
            </div>
            
            <div className="pt-2">
              <Button 
                variant="default" 
                className="w-full"
                onClick={handleUpdatePreferences}
                disabled={isLoading}
              >
                <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Update Recommendations
              </Button>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-orange-500" />
            Recommendation Settings
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="content-type">Content Type Priority</Label>
              <Select 
                defaultValue="balanced"
                onValueChange={(value) => logger.info("Content type changed:", value)}
              >
                <SelectTrigger id="content-type">
                  <SelectValue placeholder="Select content type priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">Balanced Mix</SelectItem>
                  <SelectItem value="songs">Prioritize Songs</SelectItem>
                  <SelectItem value="albums">Prioritize Albums</SelectItem>
                  <SelectItem value="playlists">Prioritize Playlists</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="algo-mode">Algorithm Mode</Label>
              <Select 
                defaultValue="smart"
                onValueChange={(value) => logger.info("Algorithm mode changed:", value)}
              >
                <SelectTrigger id="algo-mode">
                  <SelectValue placeholder="Select algorithm mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smart">Smart Match (AI-powered)</SelectItem>
                  <SelectItem value="community">Community Recommendations</SelectItem>
                  <SelectItem value="trending">Trending Content</SelectItem>
                  <SelectItem value="pure">Pure Discovery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-4 space-y-2">
              <div className="flex items-center space-x-2">
                <Switch id="explicit" />
                <Label htmlFor="explicit">Include Explicit Content</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="history" defaultChecked />
                <Label htmlFor="history">Use Listening History</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="similar" defaultChecked />
                <Label htmlFor="similar">Include Similar Artists</Label>
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      <div className="lg:col-span-2 space-y-6">
        <Tabs defaultValue="for-you" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-6">
            <TabsTrigger value="for-you" className="flex-1">For You</TabsTrigger>
            <TabsTrigger value="discovery" className="flex-1">Discovery</TabsTrigger>
            <TabsTrigger value="trending" className="flex-1">Trending</TabsTrigger>
          </TabsList>
          
          <div className="mb-4 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search in recommendations..."
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
          
          <TabsContent value="for-you" className="m-0">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Personalized Recommendations</h3>
              
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRecommendations.length > 0 ? (
                    filteredRecommendations.map((rec) => (
                      <Card key={rec.id} className="p-4 hover:bg-accent transition-colors">
                        <div className="flex gap-4">
                          <Avatar className="h-16 w-16 rounded-md">
                            <AvatarImage src={rec.albumCover} alt={rec.title} />
                            <AvatarFallback className="rounded-md">{rec.title.substring(0, 2)}</AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between">
                              <div>
                                <h4 className="font-medium">{rec.title}</h4>
                                <p className="text-sm text-muted-foreground">{rec.artist}</p>
                              </div>
                              <div className={`font-medium ${getMatchScoreColor(rec.matchScore)}`}>
                                {rec.matchScore}% match
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className={`text-xs px-2 py-1 rounded-full flex items-center ${getContentTypeInfo(rec.type).color}`}>
                                {getContentTypeInfo(rec.type).icon}
                                {rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}
                              </span>
                              
                              {rec.genres.map(genre => (
                                <span key={genre} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                                  {genre}
                                </span>
                              ))}
                              
                              {rec.moods.map(mood => (
                                <span key={mood} className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                                  {mood}
                                </span>
                              ))}
                            </div>
                            
                            <div className="flex justify-between items-center pt-2 text-xs text-muted-foreground">
                              <div className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                <span>Released: {formatDate(rec.releaseDate)}</span>
                              </div>
                              <div className="flex items-center">
                                <Star className="h-3 w-3 mr-1" />
                                <span>{rec.rating}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <Button size="sm" variant="default" className="w-9 h-9 p-0">
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="w-9 h-9 p-0">
                              <Heart className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="w-9 h-9 p-0">
                              <Bookmark className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No results found. Try adjusting your search or preferences.</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>
          
          <TabsContent value="discovery" className="m-0">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Discover New Content</h3>
              <p className="text-center text-muted-foreground py-8">
                Switch to the "Discovery" tab to find new content outside your usual preferences,
                but still tailored to your taste profile.
              </p>
            </Card>
          </TabsContent>
          
          <TabsContent value="trending" className="m-0">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Trending Now</h3>
              <p className="text-center text-muted-foreground py-8">
                Switch to the "Trending" tab to see what's popular right now
                across the platform and with similar listeners.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
        
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <BarChart className="w-5 h-5 mr-2 text-orange-500" />
              Recommendation Insights
            </h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Top Genre</p>
                <p className="text-xl font-bold">Pop</p>
                <p className="text-xs text-muted-foreground">42% of recommendations</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Recommended Content</p>
                <p className="text-xl font-bold">27 items</p>
                <p className="text-xs text-muted-foreground">Based on your preferences</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Average Match Score</p>
                <p className="text-xl font-bold">85%</p>
                <p className="text-xs text-muted-foreground">Improving with your feedback</p>
              </div>
            </Card>
          </div>
        </Card>
      </div>
    </div>
  );
}