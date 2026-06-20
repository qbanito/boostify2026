import React, { useState, useEffect } from "react";
import { logger } from "../lib/logger";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiRequest } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Avatar } from "../components/ui/avatar";
import { Separator } from "../components/ui/separator";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { useToast } from "../hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/use-auth";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpRight, DollarSign, FileVideo, GraduationCap, ChartPieIcon, BarChart2 } from 'lucide-react';
import ArtistAnalyticsTab from '../components/analytics/artist-analytics-tab';
import {
  ImageIcon,
  Music2Icon,
  User2Icon,
  PaletteIcon,
  HashIcon,
  KeyIcon,
  AtSignIcon,
  PhoneIcon,
  Calendar,
  DownloadIcon,
  CopyIcon,
  Loader2,
  RefreshCwIcon,
  SparklesIcon,
  SquareUserIcon,
  UserCircle2Icon,
  Share2Icon,
  BadgeDollarSign,
  CreditCard,
  Video,
  BookOpen,
  CheckCircle2,
  Clock,
  TrendingUp,
  ShoppingBag,
  FileText,
  BarChart3,
  RotateCcw,
  Trash as TrashIcon,
  Trash2 as Trash2Icon
} from "lucide-react";

interface ArtistData {
  id: string;
  name: string;
  biography: string;
  album: {
    id: string;
    name: string;
    release_date: string;
    songs: {
      title: string;
      duration: string;
      composers: string[];
      explicit: boolean;
    }[];
    single: {
      title: string;
      duration: string;
    };
  };
  look: {
    description: string;
    color_scheme: string;
  };
  music_genres: string[];
  image_prompts: {
    artist_look: string;
    album_cover: string;
    promotional: string;
  };
  social_media: {
    twitter: { handle: string; url: string; };
    instagram: { handle: string; url: string; };
    tiktok: { handle: string; url: string; };
    youtube: { handle: string; url: string; };
    spotify: { handle: string; url: string; };
  };
  password: {
    value: string;
    last_updated: string;
  };
  management: {
    email: string;
    phone: string;
  };
  subscription?: {
    plan: string;
    price: number;
    status: 'active' | 'trial' | 'expired';
    startDate: string;
    renewalDate: string;
  };
  purchases?: {
    videos: {
      count: number;
      totalSpent: number;
      lastPurchase: string | null;
      videos: {
        id: string;
        title: string;
        type: string;
        duration: string;
        creationDate: string;
        resolution: string;
        price: number;
      }[];
    };
    courses: {
      count: number;
      totalSpent: number;
      lastPurchase: string | null;
      courses: {
        id: string;
        title: string;
        price: number;
        purchaseDate: string;
        progress: number;
        completed: boolean;
      }[];
    };
  };
  firestoreId?: string;
}

export default function ArtistGeneratorPage() {
  const { toast } = useToast();
  const [currentArtist, setCurrentArtist] = useState<ArtistData | null>(null);
  const [savedArtists, setSavedArtists] = useState<ArtistData[]>([]);
  const [totalArtistsCount, setTotalArtistsCount] = useState(0); // Contador total de artistas en Firestore
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null); // Rastrea qué campo está siendo regenerado
  const [isDeleting, setIsDeleting] = useState(false); // Estado para el borrado
  const [isDeletingAll, setIsDeletingAll] = useState(false); // Estado para borrado masivo
  
  // Generation params modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genParams, setGenParams] = useState({
    genre: '',
    style: '',
    gender: '',
    mood: '',
    artistName: '',
  });

  const MUSIC_GENRES = [
    'Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz',
    'Classical', 'Country', 'Folk', 'Reggae', 'Blues',
    'Metal', 'Punk', 'Alternative', 'Indie', 'Latin',
    'K-Pop', 'J-Pop', 'Trap', 'Techno', 'House', 'EDM',
    'Soul', 'Funk', 'Disco', 'Synthwave', 'Lo-Fi', 'Ambient'
  ];

  const STYLE_OPTIONS = [
    'Minimalist', 'Elegant', 'Urban', 'Vintage', 'Futuristic',
    'Avant-garde', 'Retro', 'Classic', 'Alternative', 'Casual',
    'Cyberpunk', 'Bohemian', 'Grunge', 'Eclectic'
  ];

  const MOOD_OPTIONS = [
    'Energetic', 'Melancholic', 'Dark', 'Bright', 'Ethereal',
    'Aggressive', 'Romantic', 'Rebellious', 'Chill', 'Mysterious',
    'Euphoric', 'Nostalgic', 'Empowering', 'Dreamy'
  ];
  
  // Función para crear un artista vacío/placeholder cuando no hay datos
  const createEmptyArtist = (): ArtistData => {
    return {
      id: "placeholder",
      name: "Artista de Ejemplo",
      biography: "Por favor, genera un nuevo artista usando el botón 'Generar Artista Aleatorio'",
      album: {
        id: "placeholder-album",
        name: "Álbum de Ejemplo",
        release_date: "2025",
        songs: [],
        single: {
          title: "Single de Ejemplo",
          duration: "0:00"
        }
      },
      look: {
        description: "Sin descripción disponible",
        color_scheme: "Sin paleta de colores definida"
      },
      music_genres: ["Ejemplo"],
      image_prompts: {
        artist_look: "Genera un artista para ver prompts de imagen",
        album_cover: "Genera un artista para ver prompts de álbum",
        promotional: "Genera un artista para ver prompts promocionales"
      },
      social_media: {
        twitter: { handle: "ejemplo", url: "" },
        instagram: { handle: "ejemplo", url: "" },
        tiktok: { handle: "ejemplo", url: "" },
        youtube: { handle: "ejemplo", url: "" },
        spotify: { handle: "ejemplo", url: "" }
      },
      password: {
        value: "",
        last_updated: ""
      },
      management: {
        email: "",
        phone: ""
      }
    };
  };
  
  // Efecto para cargar los artistas guardados al montar el componente
  useEffect(() => {
    const loadSavedArtists = async () => {
      try {
        logger.info("Cargando artistas desde Firestore...");
        const artistsRef = collection(db, "generated_artists");
        
        // Primero obtenemos el conteo total de artistas en Firestore
        const countQuery = query(artistsRef);
        const countSnapshot = await getDocs(countQuery);
        const totalCount = countSnapshot.size;
        setTotalArtistsCount(totalCount);
        logger.info(`Total de artistas en Firestore: ${totalCount}`);
        
        // Luego obtenemos solo los 10 más recientes para mostrar en la lista
        const q = query(artistsRef, orderBy("createdAt", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        
        logger.info(`Cargados ${querySnapshot.size} artistas recientes de un total de ${totalCount}`);
        
        const artists: ArtistData[] = [];
        querySnapshot.forEach((doc) => {
          try {
            const data = doc.data();
            
            // Asegurarnos de que los datos tienen la estructura correcta
            const artist: ArtistData = {
              id: data.id || `fallback-${doc.id}`,
              name: data.name || "Artista sin nombre",
              biography: data.biography || "Sin biografía disponible",
              album: data.album || { 
                id: `fallback-${Date.now()}`, 
                name: "Álbum sin título", 
                release_date: new Date().getFullYear().toString(),
                songs: [],
                single: { title: "Single sin título", duration: "0:00" }
              },
              look: data.look || {
                description: "Sin descripción disponible",
                color_scheme: "Sin información de colores"
              },
              music_genres: data.music_genres || ["Sin género"],
              image_prompts: data.image_prompts || {
                artist_look: "Imagen de artista no disponible",
                album_cover: "Portada de álbum no disponible",
                promotional: "Imagen promocional no disponible"
              },
              social_media: data.social_media || {
                twitter: { handle: "", url: "" },
                instagram: { handle: "", url: "" },
                tiktok: { handle: "", url: "" },
                youtube: { handle: "", url: "" },
                spotify: { handle: "", url: "" }
              },
              password: data.password || {
                value: "password123",
                last_updated: new Date().toISOString().split('T')[0]
              },
              management: data.management || {
                email: `management@${data.name?.toLowerCase().replace(/\s+/g, '')}.com` || "management@example.com",
                phone: "555-123-4567"
              },
              firestoreId: doc.id
            };
            
            artists.push(artist);
          } catch (err) {
            logger.error(`Error procesando documento ${doc.id}:`, err);
          }
        });
        
        logger.info(`Procesados ${artists.length} artistas correctamente`);
        
        setSavedArtists(artists);
        
        // Si hay artistas, establecer el primero como actual
        if (artists.length > 0) {
          logger.info("Estableciendo artista actual:", artists[0].name);
          setCurrentArtist(artists[0]);
        } else {
          // Si no hay artistas, usar un placeholder
          logger.info("No hay artistas guardados, usando placeholder");
          setCurrentArtist(createEmptyArtist());
        }
      } catch (error) {
        logger.error("Error loading saved artists:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los artistas guardados.",
          variant: "destructive",
        });
        // Si hay error, también creamos un placeholder para evitar errores de UI
        setCurrentArtist(createEmptyArtist());
      }
    };

    loadSavedArtists();
  }, [toast]);

  // Mutación para generar un artista aleatorio
  const generateArtistMutation = useMutation({
    mutationFn: async (params: { genre?: string; style?: string; gender?: string; mood?: string; artistName?: string }) => {
      try {
        const body: Record<string, string> = {};
        if (params.genre) body.genre = params.genre;
        if (params.style) body.style = params.style;
        if (params.gender) body.gender = params.gender;
        if (params.mood) body.mood = params.mood;
        if (params.artistName) body.artistName = params.artistName;

        const response = await fetch('/api/artist-generator/generate-artist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        logger.info("API response:", data);
        return data;
      } catch (error) {
        logger.error("Error en fetch:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      logger.info("Mutation success, data:", data);
      // Asegurarse de que tenemos datos y son del tipo correcto
      if (data && data.name) {
        const newArtist = data as ArtistData;
        
        // Validar estructura mínima requerida
        if (!newArtist.album) newArtist.album = { 
          id: `fallback-${Date.now()}`, 
          name: "Álbum sin título", 
          release_date: new Date().getFullYear().toString(),
          songs: [],
          single: { title: "Single sin título", duration: "0:00" }
        };
        
        if (!newArtist.look) newArtist.look = {
          description: "Sin descripción disponible",
          color_scheme: "Sin información de colores"
        };
        
        if (!newArtist.image_prompts) newArtist.image_prompts = {
          artist_look: "Imagen de artista no disponible",
          album_cover: "Portada de álbum no disponible",
          promotional: "Imagen promocional no disponible"
        };
        
        if (!newArtist.music_genres) newArtist.music_genres = ["Sin género"];
        
        if (!newArtist.social_media) newArtist.social_media = {
          twitter: { handle: "", url: "" },
          instagram: { handle: "", url: "" },
          tiktok: { handle: "", url: "" },
          youtube: { handle: "", url: "" },
          spotify: { handle: "", url: "" }
        };
        
        setCurrentArtist(newArtist);
        
        // Guardar el artista en el arreglo de artistas guardados
        // Solo mantener los 10 más recientes
        setSavedArtists(prev => [newArtist, ...prev.slice(0, 9)]);
        
        // Incrementar el contador total de artistas
        setTotalArtistsCount(prevCount => prevCount + 1);
        
        toast({
          title: "Artista generado con éxito",
          description: `${newArtist.name} ha sido creado y guardado en Firestore con ID: ${newArtist.firestoreId || 'N/A'}.`
        });
      } else {
        logger.error("La respuesta no contiene datos de artista:", data);
        toast({
          title: "Error de datos",
          description: "La respuesta no contiene un artista válido",
          variant: "destructive"
        });
      }
      setIsLoading(false);
    },
    onError: (error) => {
      logger.error("Error al generar artista:", error);
      
      let errorMessage = "No se pudo generar el artista aleatorio. Por favor, intenta nuevamente.";
      
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      
      toast({
        title: "Error de generación",
        description: errorMessage,
        variant: "destructive"
      });
      
      // Si hay error, establecemos un artista vacío para evitar errores en la UI
      const fallbackArtist = createEmptyArtist();
      fallbackArtist.name = "Error de generación";
      fallbackArtist.biography = "Ocurrió un error al generar este artista. Por favor, intenta nuevamente.";
      setCurrentArtist(fallbackArtist);
      
      setIsLoading(false);
    }
  });

  const handleGenerateArtist = () => {
    // Close modal immediately for better UX
    setShowGenerateModal(false);
    setIsLoading(true);
    
    // Build params from state, filtering empty values
    const params: Record<string, string> = {};
    if (genParams.genre) params.genre = genParams.genre;
    if (genParams.style) params.style = genParams.style;
    if (genParams.gender) params.gender = genParams.gender;
    if (genParams.mood) params.mood = genParams.mood;
    if (genParams.artistName) params.artistName = genParams.artistName;
    
    toast({
      title: "Generando artista...",
      description: "El proceso se está ejecutando en segundo plano. Recibirás una notificación cuando esté listo.",
    });
    
    generateArtistMutation.mutate(params);
    
    // Reset params for next generation
    setGenParams({ genre: '', style: '', gender: '', mood: '', artistName: '' });
  };

  // Actualizar el estado de carga cuando la mutación completa
  useEffect(() => {
    if (!generateArtistMutation.isPending) {
      setIsLoading(false);
    }
  }, [generateArtistMutation.isPending]);

  const handleCopyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({
          title: "Copiado al portapapeles",
          description: description
        });
      })
      .catch(err => {
        toast({
          title: "Error",
          description: "No se pudo copiar al portapapeles",
          variant: "destructive"
        });
      });
  };

  // Función para descargar los datos del artista como un archivo JSON
  const handleDownloadJson = () => {
    if (!currentArtist) return;

    const dataStr = JSON.stringify(currentArtist, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `${currentArtist.name.replace(/\s+/g, '_')}_metadata.json`);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);

    toast({
      title: "Archivo descargado",
      description: `Metadatos de ${currentArtist.name} guardados como JSON`
    });
  };

  // Función para regenerar campos específicos del artista
  const regenerateFieldMutation = useMutation({
    mutationFn: async ({ field, artistId }: { field: string, artistId: string }) => {
      setIsRegenerating(field);
      try {
        const response = await fetch('/api/artist-generator/regenerate-artist-field', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ field, artistId }),
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return { field, data };
      } catch (error) {
        logger.error(`Error regenerando ${field}:`, error);
        throw error;
      }
    },
    onSuccess: ({ field, data }) => {
      // Solo implementaremos la regeneración simulada (sin backend real)
      if (!currentArtist) return;
      
      toast({
        title: "Campo actualizado",
        description: `Se ha regenerado el campo ${field} con éxito`,
      });
      
      // Crear una copia del artista actual para modificar
      const updatedArtist = { ...currentArtist };
      
      // Actualizar según el campo
      switch (field) {
        case 'biography':
          updatedArtist.biography = data.biography || `Nueva biografía generada para ${updatedArtist.name}`;
          break;
        case 'look':
          updatedArtist.look = {
            description: data.look?.description || `Nuevo look detallado para ${updatedArtist.name}`,
            color_scheme: data.look?.color_scheme || updatedArtist.look.color_scheme
          };
          break;
        case 'subscription':
          const plans = [
            { name: "Artist", price: 19.99 },
            { name: "Elevate", price: 49.99 },
            { name: "Amplify", price: 89.99 },
            { name: "Dominate", price: 149.99 }
          ];
          const randomPlan = plans[Math.floor(Math.random() * plans.length)];
          
          updatedArtist.subscription = {
            plan: randomPlan.name,
            price: randomPlan.price,
            status: ['active', 'trial', 'expired'][Math.floor(Math.random() * 3)] as 'active' | 'trial' | 'expired',
            startDate: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
            renewalDate: new Date(Date.now() + Math.random() * 10000000000).toISOString().split('T')[0]
          };
          break;
        case 'videos':
          const videoCount = Math.floor(Math.random() * 5) + 1;
          const videos = [];
          const videoPrice = 199;
          
          for (let i = 0; i < videoCount; i++) {
            videos.push({
              id: `VID-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
              title: `Video Musical ${i+1}`,
              type: ["Visualizador de audio", "Video musical completo", "Teaser promocional", "Lyric video", "Behind the scenes"][Math.floor(Math.random() * 5)],
              duration: `${Math.floor(Math.random() * 4) + 1}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
              creationDate: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
              resolution: ["720p", "1080p", "4K"][Math.floor(Math.random() * 3)],
              price: videoPrice
            });
          }
          
          if (!updatedArtist.purchases) {
            updatedArtist.purchases = {
              videos: {
                count: videoCount,
                totalSpent: videoCount * videoPrice,
                lastPurchase: new Date(Date.now() - Math.random() * 1000000000).toISOString().split('T')[0],
                videos: videos
              },
              courses: {
                count: 0,
                totalSpent: 0,
                lastPurchase: null,
                courses: []
              }
            };
          } else {
            updatedArtist.purchases.videos = {
              count: videoCount,
              totalSpent: videoCount * videoPrice,
              lastPurchase: new Date(Date.now() - Math.random() * 1000000000).toISOString().split('T')[0],
              videos: videos
            };
          }
          break;
        case 'courses':
          const courseCount = Math.floor(Math.random() * 3) + 1;
          const courses = [];
          let totalSpent = 0;
          
          const COURSE_TITLES = [
            "Producción Musical Avanzada",
            "Marketing Digital para Músicos",
            "Composición para Bandas Sonoras",
            "Técnicas Vocales Profesionales",
            "Distribución Musical en la Era Digital",
            "Masterización de Audio",
            "Estrategias de Lanzamiento Musical",
            "Armonía y Teoría Musical",
            "Creación de Beats"
          ];
          
          for (let i = 0; i < courseCount; i++) {
            const price = Math.floor(Math.random() * 150) + 149; // 149-299
            totalSpent += price;
            courses.push({
              id: `CRS-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
              title: COURSE_TITLES[Math.floor(Math.random() * COURSE_TITLES.length)],
              price: price,
              purchaseDate: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
              progress: Math.floor(Math.random() * 101),
              completed: Math.random() > 0.6
            });
          }
          
          if (!updatedArtist.purchases) {
            updatedArtist.purchases = {
              videos: {
                count: 0,
                totalSpent: 0,
                lastPurchase: null,
                videos: []
              },
              courses: {
                count: courseCount,
                totalSpent: totalSpent,
                lastPurchase: new Date(Date.now() - Math.random() * 1000000000).toISOString().split('T')[0],
                courses: courses
              }
            };
          } else {
            updatedArtist.purchases.courses = {
              count: courseCount,
              totalSpent: totalSpent,
              lastPurchase: new Date(Date.now() - Math.random() * 1000000000).toISOString().split('T')[0],
              courses: courses
            };
          }
          break;
        default:
          logger.info(`Campo desconocido: ${field}`);
      }
      
      // Actualizar el artista en el estado y en el array de artistas guardados
      setCurrentArtist(updatedArtist);
      setSavedArtists(prev => prev.map(artist => 
        artist.id === updatedArtist.id ? updatedArtist : artist
      ));
      
      toast({
        title: "Campo regenerado",
        description: `Se ha actualizado el campo "${field}" exitosamente`
      });
      
      setIsRegenerating(null);
    },
    onError: (error, variables) => {
      logger.error(`Error en regeneración de campo ${variables.field}:`, error);
      
      let errorMessage = `No se pudo regenerar el campo "${variables.field}". Por favor, intenta nuevamente.`;
      
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      
      toast({
        title: "Error de regeneración",
        description: errorMessage,
        variant: "destructive"
      });
      
      setIsRegenerating(null);
    }
  });

  // Manejador para regenerar un campo específico
  const handleRegenerateField = (field: string) => {
    if (!currentArtist) return;
    
    regenerateFieldMutation.mutate({ 
      field, 
      artistId: currentArtist.firestoreId || currentArtist.id
    });
  };
  
  // Mutación para eliminar un artista específico
  const deleteArtistMutation = useMutation({
    mutationFn: async (artistId: string) => {
      setIsDeleting(true);
      const response = await fetch(`/api/artist-generator/delete-artist/${artistId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      // Eliminar el artista del estado local
      setSavedArtists(prev => prev.filter(artist => artist.firestoreId !== data.deletedId));
      
      // Decrementar el contador total de artistas
      setTotalArtistsCount(prevCount => Math.max(0, prevCount - 1));
      
      // Si el artista actual es el que se eliminó, seleccionar otro
      if (currentArtist?.firestoreId === data.deletedId) {
        if (savedArtists.length > 1) {
          // Seleccionar el siguiente artista disponible
          const nextArtist = savedArtists.find(artist => artist.firestoreId !== data.deletedId);
          setCurrentArtist(nextArtist || createEmptyArtist());
        } else {
          // Si no hay más artistas, mostrar el placeholder
          setCurrentArtist(createEmptyArtist());
        }
      }
      
      toast({
        title: "Artista eliminado",
        description: `El artista ha sido eliminado correctamente.`
      });
      
      setIsDeleting(false);
    },
    onError: (error) => {
      logger.error("Error al eliminar artista:", error);
      
      toast({
        title: "Error",
        description: "No se pudo eliminar el artista. Por favor, intenta nuevamente.",
        variant: "destructive"
      });
      
      setIsDeleting(false);
    }
  });
  
  // Mutación para eliminar todos los artistas
  const deleteAllArtistsMutation = useMutation({
    mutationFn: async () => {
      setIsDeletingAll(true);
      const response = await fetch(`/api/artist-generator/delete-all-artists`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      // Limpiar el estado local
      setSavedArtists([]);
      
      // Resetear el contador total de artistas a cero
      setTotalArtistsCount(0);
      
      // Mostrar un artista placeholder
      setCurrentArtist(createEmptyArtist());
      
      toast({
        title: "Artistas eliminados",
        description: `Se han eliminado ${data.count} artistas correctamente.`
      });
      
      setIsDeletingAll(false);
    },
    onError: (error) => {
      logger.error("Error al eliminar todos los artistas:", error);
      
      toast({
        title: "Error",
        description: "No se pudieron eliminar todos los artistas. Por favor, intenta nuevamente.",
        variant: "destructive"
      });
      
      setIsDeletingAll(false);
    }
  });
  
  // Función para manejar la eliminación de un artista
  const handleDeleteArtist = (artistId: string) => {
    if (!artistId) {
      toast({
        title: "Error",
        description: "No se puede eliminar el artista sin un ID válido",
        variant: "destructive",
      });
      return;
    }
    
    deleteArtistMutation.mutate(artistId);
  };
  
  // Función para manejar la eliminación de todos los artistas
  const handleDeleteAllArtists = () => {
    deleteAllArtistsMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500">
              Generador de Artistas
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Genera perfiles de artistas aleatorios completos con datos de álbum, imagen, redes sociales y más para usar en tus proyectos musicales.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-3 flex justify-center space-x-4">
              <Button 
                size="lg"
                onClick={() => setShowGenerateModal(true)}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:to-red-600 transition-all duration-300 hover:shadow-xl group"
                disabled={generateArtistMutation.isPending}
              >
                {generateArtistMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <SparklesIcon className="h-5 w-5 mr-2 group-hover:rotate-45 transition-transform" />
                )}
                {generateArtistMutation.isPending ? 'Generando...' : 'Generar Artista'}
              </Button>
              
              <Button 
                variant="destructive"
                size="lg"
                onClick={handleDeleteAllArtists}
                className="hover:shadow-xl group"
                disabled={isDeletingAll}
              >
                {isDeletingAll ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <TrashIcon className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                )}
                Borrar Todos
              </Button>
            </div>
          </div>

          {/* Modal de parámetros de generación */}
          <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <SparklesIcon className="h-5 w-5 text-orange-500" />
                  Generar Nuevo Artista
                </DialogTitle>
                <DialogDescription>
                  Configura los parámetros para personalizar tu artista. Todos los campos son opcionales — se generarán aleatoriamente si se dejan vacíos.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                {/* Nombre del artista */}
                <div className="space-y-2">
                  <Label htmlFor="artistName">Nombre del Artista</Label>
                  <Input
                    id="artistName"
                    placeholder="Dejar vacío para nombre aleatorio"
                    value={genParams.artistName}
                    onChange={(e) => setGenParams(p => ({ ...p, artistName: e.target.value }))}
                  />
                </div>

                {/* Género musical */}
                <div className="space-y-2">
                  <Label>Género Musical</Label>
                  <Select value={genParams.genre} onValueChange={(v) => setGenParams(p => ({ ...p, genre: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aleatorio" />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSIC_GENRES.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Género (sexo) */}
                <div className="space-y-2">
                  <Label>Género</Label>
                  <Select value={genParams.gender} onValueChange={(v) => setGenParams(p => ({ ...p, gender: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aleatorio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="female">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Estilo visual */}
                <div className="space-y-2">
                  <Label>Estilo Visual</Label>
                  <Select value={genParams.style} onValueChange={(v) => setGenParams(p => ({ ...p, style: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aleatorio" />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_OPTIONS.map(s => (
                        <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mood / Vibe */}
                <div className="space-y-2">
                  <Label>Mood / Vibra</Label>
                  <Select value={genParams.mood} onValueChange={(v) => setGenParams(p => ({ ...p, mood: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aleatorio" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOOD_OPTIONS.map(m => (
                        <SelectItem key={m} value={m.toLowerCase()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setGenParams({ genre: '', style: '', gender: '', mood: '', artistName: '' })}
                  className="w-full sm:w-auto"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
                <Button
                  onClick={handleGenerateArtist}
                  className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-red-500 hover:to-red-600"
                >
                  <SparklesIcon className="h-4 w-4 mr-2" />
                  Generar Artista
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {currentArtist && (
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="flex flex-wrap justify-center gap-1 w-full max-w-4xl mx-auto mb-8 h-auto p-1">
                <TabsTrigger value="profile" className="text-xs sm:text-sm">Perfil</TabsTrigger>
                <TabsTrigger value="music" className="text-xs sm:text-sm">Music</TabsTrigger>
                <TabsTrigger value="image" className="text-xs sm:text-sm">Imagen</TabsTrigger>
                <TabsTrigger value="social" className="text-xs sm:text-sm">Social</TabsTrigger>
                <TabsTrigger value="subscription" className="text-xs sm:text-sm">Suscripción</TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-1 text-xs sm:text-sm">
                  <BarChart2 className="h-4 w-4" />
                  <span>Análisis</span>
                </TabsTrigger>
              </TabsList>

              {/* PERFIL */}
              <TabsContent value="profile" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  {/* Información general */}
                  <Card className="md:col-span-3">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <UserCircle2Icon className="mr-2 h-5 w-5 text-orange-500" />
                        Información General
                      </CardTitle>
                      <CardDescription>
                        Datos básicos del artista generado
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-20 w-20 rounded-md bg-orange-100 p-2">
                            <User2Icon className="h-10 w-10 text-orange-500" />
                          </Avatar>
                          <div>
                            <h3 className="text-2xl font-bold">{currentArtist?.name || "Nombre no disponible"}</h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {currentArtist?.music_genres?.map((genre, i) => (
                                <Badge key={i} variant="outline" className="bg-orange-100/50">
                                  {genre}
                                </Badge>
                              )) || <span className="text-muted-foreground">Géneros no disponibles</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-shrink-0"
                            onClick={() => handleCopyToClipboard(currentArtist?.name || "", "Nombre copiado")}
                            disabled={!currentArtist?.name}
                          >
                            <CopyIcon className="h-4 w-4 mr-2" />
                            Copiar nombre
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-shrink-0"
                            onClick={handleDownloadJson}
                            disabled={!currentArtist}
                          >
                            <DownloadIcon className="h-4 w-4 mr-2" />
                            Descargar JSON
                          </Button>
                        </div>
                      </div>

                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Biografía:</h4>
                        <p className="text-sm">{currentArtist?.biography || "No hay biografía disponible"}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() => handleCopyToClipboard(currentArtist?.biography || "", "Biografía copiada")}
                          disabled={!currentArtist?.biography}
                        >
                          <CopyIcon className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">
                            <AtSignIcon className="h-4 w-4 inline mr-1" /> Contacto:
                          </h4>
                          <p className="text-sm flex items-center">
                            {currentArtist?.management?.email || "Email no disponible"}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-1"
                              onClick={() => handleCopyToClipboard(currentArtist?.management?.email || "", "Email copiado")}
                              disabled={!currentArtist?.management?.email}
                            >
                              <CopyIcon className="h-3 w-3" />
                            </Button>
                          </p>
                          <p className="text-sm flex items-center">
                            {currentArtist?.management?.phone || "Teléfono no disponible"}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-1"
                              onClick={() => handleCopyToClipboard(currentArtist?.management?.phone || "", "Teléfono copiado")}
                              disabled={!currentArtist?.management?.phone}
                            >
                              <CopyIcon className="h-3 w-3" />
                            </Button>
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">
                            <KeyIcon className="h-4 w-4 inline mr-1" /> Credenciales:
                          </h4>
                          <p className="text-sm flex items-center">
                            <span className="font-mono bg-gray-100 dark:bg-gray-800 p-1 rounded">
                              {currentArtist?.password?.value || "No disponible"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-1"
                              onClick={() => handleCopyToClipboard(currentArtist?.password?.value || "", "Contraseña copiada")}
                              disabled={!currentArtist?.password?.value}
                            >
                              <CopyIcon className="h-3 w-3" />
                            </Button>
                          </p>
                          <p className="text-sm mt-1">
                            Actualizada: {currentArtist?.password?.last_updated || "N/A"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Estilos y Colores */}
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <PaletteIcon className="mr-2 h-5 w-5 text-orange-500" />
                        Estilo Visual
                      </CardTitle>
                      <CardDescription>
                        Descripción estética y paleta de colores
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Descripción del Look:</h4>
                        <p className="text-sm">{currentArtist?.look?.description || "No hay descripción disponible"}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1"
                          onClick={() => handleCopyToClipboard(currentArtist?.look?.description || "", "Descripción copiada")}
                          disabled={!currentArtist?.look?.description}
                        >
                          <CopyIcon className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Paleta de Colores:</h4>
                        <div className="text-sm">
                          {currentArtist?.look?.color_scheme || "Paleta no disponible"}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1"
                          onClick={() => handleCopyToClipboard(currentArtist?.look?.color_scheme || "", "Paleta copiada")}
                          disabled={!currentArtist?.look?.color_scheme}
                        >
                          <CopyIcon className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">ID del Artista:</h4>
                        <p className="text-sm font-mono">{currentArtist?.id || "ID no disponible"}</p>
                        <p className="text-xs text-muted-foreground mt-1">Firestore ID: {currentArtist?.firestoreId || "N/A"}</p>
                        
                        {currentArtist?.firestoreId && currentArtist.id !== "placeholder" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => handleDeleteArtist(currentArtist.firestoreId!)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2Icon className="h-4 w-4 mr-2" />
                            )}
                            Eliminar este artista
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* MÚSICA */}
              <TabsContent value="music" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Music2Icon className="mr-2 h-5 w-5 text-orange-500" />
                      Álbum: {currentArtist?.album?.name || "Álbum sin nombre"}
                    </CardTitle>
                    <CardDescription className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                      Fecha de lanzamiento: {currentArtist?.album?.release_date || "Fecha no disponible"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {currentArtist?.album?.single && (
                        <div>
                          <h3 className="text-lg font-medium mb-2">Single Principal</h3>
                          <div className="bg-orange-100/30 p-4 rounded-md">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-semibold">{currentArtist.album.single.title || "Sin título"}</h4>
                                <p className="text-sm text-muted-foreground">Duración: {currentArtist.album.single.duration || "N/A"}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyToClipboard(currentArtist.album.single.title || "", "Título de single copiado")}
                                disabled={!currentArtist.album.single.title}
                              >
                                <CopyIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {currentArtist?.album?.songs && currentArtist.album.songs.length > 0 ? (
                        <div>
                          <h3 className="text-lg font-medium mb-2">Canciones del Álbum</h3>
                          <div className="space-y-2">
                            {currentArtist.album.songs.map((song, index) => (
                              <div 
                                key={index}
                                className="flex justify-between items-center p-3 rounded-md hover:bg-muted/50 transition-colors"
                              >
                                <div>
                                  <div className="flex items-center">
                                    <span className="text-muted-foreground mr-3 w-6 text-center">{index + 1}</span>
                                    <span className="font-medium">
                                      {song.title || "Sin título"}
                                      {song.explicit && (
                                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded">
                                          E
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex text-xs text-muted-foreground ml-9 mt-0.5">
                                    {song.composers?.join(", ") || "Compositor desconocido"} • {song.duration || "N/A"}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyToClipboard(song.title || "", "Título de canción copiado")}
                                  disabled={!song.title}
                                >
                                  <CopyIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-6">
                          No hay canciones disponibles
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* IMAGEN */}
              <TabsContent value="image" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <ImageIcon className="mr-2 h-5 w-5 text-orange-500" />
                      Prompts de Imagen
                    </CardTitle>
                    <CardDescription>
                      Prompts detallados para generar imágenes del artista
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {currentArtist?.image_prompts ? (
                      <>
                        <div>
                          <h3 className="text-sm font-medium mb-2 flex items-center">
                            <SquareUserIcon className="h-4 w-4 mr-2 text-orange-500" />
                            Look del Artista
                          </h3>
                          <div className="relative bg-muted p-4 rounded-md">
                            <p className="text-sm">{currentArtist.image_prompts.artist_look || "No hay prompt disponible"}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => handleCopyToClipboard(currentArtist.image_prompts.artist_look || "", "Prompt de artista copiado")}
                              disabled={!currentArtist.image_prompts.artist_look}
                            >
                              <CopyIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium mb-2 flex items-center">
                            <Music2Icon className="h-4 w-4 mr-2 text-orange-500" />
                            Portada del Álbum
                          </h3>
                          <div className="relative bg-muted p-4 rounded-md">
                            <p className="text-sm">{currentArtist.image_prompts.album_cover || "No hay prompt disponible"}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => handleCopyToClipboard(currentArtist.image_prompts.album_cover || "", "Prompt de portada copiado")}
                              disabled={!currentArtist.image_prompts.album_cover}
                            >
                              <CopyIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium mb-2 flex items-center">
                            <Share2Icon className="h-4 w-4 mr-2 text-orange-500" />
                            Foto Promocional
                          </h3>
                          <div className="relative bg-muted p-4 rounded-md">
                            <p className="text-sm">{currentArtist.image_prompts.promotional || "No hay prompt disponible"}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => handleCopyToClipboard(currentArtist.image_prompts.promotional || "", "Prompt promocional copiado")}
                              disabled={!currentArtist.image_prompts.promotional}
                            >
                              <CopyIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-muted-foreground py-6">
                        No hay prompts de imagen disponibles
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SOCIAL */}
              <TabsContent value="social" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <HashIcon className="mr-2 h-5 w-5 text-orange-500" />
                      Redes Sociales
                    </CardTitle>
                    <CardDescription>
                      Perfiles y enlaces para plataformas sociales
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {currentArtist?.social_media ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(currentArtist.social_media).map(([platform, data]) => (
                            <div key={platform} className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
                              <div>
                                <div className="font-medium capitalize mb-1">{platform}</div>
                                <div className="text-sm text-muted-foreground">{data.handle || "Sin usuario"}</div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyToClipboard(data.handle || "", `@${data.handle} copiado`)}
                                  disabled={!data.handle}
                                >
                                  <CopyIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyToClipboard(data.url || "", "URL copiada")}
                                  disabled={!data.url}
                                >
                                  URL
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-6">
                          No hay información de redes sociales disponible
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* SUSCRIPCIÓN */}
              <TabsContent value="subscription" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Información del plan de suscripción */}
                  <Card className="md:col-span-1">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <BadgeDollarSign className="mr-2 h-5 w-5 text-orange-500" />
                        Plan de Suscripción
                      </CardTitle>
                      <CardDescription>
                        Detalles del plan contratado
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {currentArtist?.subscription ? (
                        <>
                          <div className="bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-950/50 dark:to-orange-900/30 p-4 rounded-lg text-center mb-4">
                            <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                              {currentArtist.subscription.plan}
                            </span>
                            <span className="block text-sm text-muted-foreground mt-1">
                              ${currentArtist.subscription.price.toFixed(2)} / mes
                            </span>
                          </div>
                          
                          <div className="mt-4 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Estado</span>
                              <Badge 
                                variant={
                                  currentArtist.subscription.status === 'active' ? 'default' : 
                                  currentArtist.subscription.status === 'trial' ? 'outline' : 'destructive'
                                }
                              >
                                {currentArtist.subscription.status === 'active' ? 'Activo' : 
                                 currentArtist.subscription.status === 'trial' ? 'Prueba' : 'Expirado'}
                              </Badge>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Fecha de inicio</span>
                              <span className="text-sm">
                                {currentArtist.subscription.startDate}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Próxima renovación</span>
                              <span className="text-sm">
                                {currentArtist.subscription.renewalDate}
                              </span>
                            </div>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-4"
                            onClick={() => handleRegenerateField('subscription')}
                            disabled={isRegenerating === 'subscription'}
                          >
                            {isRegenerating === 'subscription' ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCwIcon className="h-4 w-4 mr-2" />
                            )}
                            Regenerar Plan
                          </Button>
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                          <p className="text-muted-foreground">No hay información de suscripción disponible.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => handleRegenerateField('subscription')}
                            disabled={isRegenerating === 'subscription'}
                          >
                            {isRegenerating === 'subscription' ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <SparklesIcon className="h-4 w-4 mr-2" />
                            )}
                            Generar Plan
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* Historial de videos generados */}
                  <Card className="md:col-span-1">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Video className="mr-2 h-5 w-5 text-orange-500" />
                        Videos Generados
                      </CardTitle>
                      <CardDescription>
                        Historial de videos creados
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {currentArtist?.purchases?.videos && currentArtist.purchases.videos.count > 0 ? (
                        <>
                          <div className="flex justify-between items-center mb-4">
                            <span className="font-medium">Total Generados</span>
                            <Badge variant="secondary">{currentArtist.purchases.videos.count}</Badge>
                          </div>
                          
                          <div className="flex justify-between items-center mb-4">
                            <span className="font-medium">Inversión Total</span>
                            <span className="font-medium text-orange-600 dark:text-orange-400">
                              ${currentArtist.purchases.videos.totalSpent.toFixed(2)}
                            </span>
                          </div>
                          
                          <div className="mb-4">
                            <span className="text-sm font-medium block mb-2">Último pago</span>
                            <span className="text-sm text-muted-foreground">
                              {currentArtist.purchases.videos.lastPurchase || 'N/A'}
                            </span>
                          </div>
                          
                          <ScrollArea className="h-[200px] rounded-md border p-2">
                            <div className="space-y-3">
                              {currentArtist.purchases.videos.videos.map((video, index) => (
                                <div key={video.id} className="flex items-start gap-2 pb-2 border-b last:border-0">
                                  <div className="bg-orange-100 dark:bg-orange-900/30 p-1 rounded">
                                    <Video className="h-4 w-4 text-orange-500" />
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex justify-between">
                                      <p className="text-sm font-medium">{video.title}</p>
                                      <span className="text-xs font-medium">${video.price}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                      <span>{video.type}</span>
                                      <span>{video.resolution}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                      <span>{video.duration}</span>
                                      <span>{video.creationDate}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-4"
                            onClick={() => handleRegenerateField('videos')}
                            disabled={isRegenerating === 'videos'}
                          >
                            {isRegenerating === 'videos' ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCwIcon className="h-4 w-4 mr-2" />
                            )}
                            Regenerar Videos
                          </Button>
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <Video className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                          <p className="text-muted-foreground">No hay videos generados.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => handleRegenerateField('videos')}
                            disabled={isRegenerating === 'videos'}
                          >
                            {isRegenerating === 'videos' ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <SparklesIcon className="h-4 w-4 mr-2" />
                            )}
                            Generar Videos
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* Cursos comprados */}
                  <Card className="md:col-span-1">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <BookOpen className="mr-2 h-5 w-5 text-orange-500" />
                        Cursos Adquiridos
                      </CardTitle>
                      <CardDescription>
                        Historial educativo
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {currentArtist?.purchases?.courses && currentArtist.purchases.courses.count > 0 ? (
                        <>
                          <div className="flex justify-between items-center mb-4">
                            <span className="font-medium">Total Cursos</span>
                            <Badge variant="secondary">{currentArtist.purchases.courses.count}</Badge>
                          </div>
                          
                          <div className="flex justify-between items-center mb-4">
                            <span className="font-medium">Inversión Total</span>
                            <span className="font-medium text-orange-600 dark:text-orange-400">
                              ${currentArtist.purchases.courses.totalSpent.toFixed(2)}
                            </span>
                          </div>
                          
                          <div className="mb-4">
                            <span className="text-sm font-medium block mb-2">Última compra</span>
                            <span className="text-sm text-muted-foreground">
                              {currentArtist.purchases.courses.lastPurchase || 'N/A'}
                            </span>
                          </div>
                          
                          <ScrollArea className="h-[200px] rounded-md border p-2">
                            <div className="space-y-3">
                              {currentArtist.purchases.courses.courses.map((course) => (
                                <div key={course.id} className="flex items-start gap-2 pb-2 border-b last:border-0">
                                  <div className="bg-orange-100 dark:bg-orange-900/30 p-1 rounded">
                                    {course.completed ? (
                                      <CheckCircle2 className="h-4 w-4 text-orange-500" />
                                    ) : (
                                      <Clock className="h-4 w-4 text-orange-500" />
                                    )}
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex justify-between">
                                      <p className="text-sm font-medium">{course.title}</p>
                                      <span className="text-xs font-medium">${course.price}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      <span>Comprado: {course.purchaseDate}</span>
                                    </div>
                                    <div className="w-full mt-1">
                                      <div className="flex justify-between text-xs mb-1">
                                        <span>Progreso</span>
                                        <span>{course.progress}%</span>
                                      </div>
                                      <Progress value={course.progress} className="h-1.5" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-4"
                            onClick={() => handleRegenerateField('courses')}
                            disabled={isRegenerating === 'courses'}
                          >
                            {isRegenerating === 'courses' ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCwIcon className="h-4 w-4 mr-2" />
                            )}
                            Regenerar Cursos
                          </Button>
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                          <p className="text-muted-foreground">No hay cursos adquiridos.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => handleRegenerateField('courses')}
                            disabled={isRegenerating === 'courses'}
                          >
                            {isRegenerating === 'courses' ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <SparklesIcon className="h-4 w-4 mr-2" />
                            )}
                            Generar Cursos
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ANALÍTICA */}
              <TabsContent value="analytics" className="space-y-6">
                <ArtistAnalyticsTab />
              </TabsContent>
            </Tabs>
          )}

          {savedArtists && savedArtists.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Artistas Generados ({totalArtistsCount})</h2>
              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div className="space-y-6">
                  {savedArtists.map((artist, index) => (
                    <div key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 mb-3 sm:mb-0">
                        <Avatar className="h-10 w-10 rounded-md bg-orange-100 p-1">
                          <User2Icon className="h-6 w-6 text-orange-500" />
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{artist?.name || "Artista sin nombre"}</h3>
                          <div className="text-sm text-muted-foreground flex flex-wrap gap-1 mt-1">
                            {artist?.music_genres?.length ? (
                              artist.music_genres.map((genre, i) => (
                                <span key={i} className="inline-block">
                                  {genre}{i < artist.music_genres.length - 1 ? "," : ""}
                                </span>
                              ))
                            ) : (
                              <span>Sin géneros musicales</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentArtist(artist)}
                        >
                          Ver detalles
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const dataStr = JSON.stringify(artist, null, 2);
                            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                            const linkElement = document.createElement('a');
                            linkElement.setAttribute('href', dataUri);
                            linkElement.setAttribute('download', `${(artist?.name || 'artista').replace(/\s+/g, '_')}_metadata.json`);
                            document.body.appendChild(linkElement);
                            linkElement.click();
                            document.body.removeChild(linkElement);
                          }}
                        >
                          <DownloadIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}