import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { 
  ExternalLink, 
  Search, 
  Film, 
  Music, 
  Clapperboard,
  Building2, 
  TrendingUp,
  MoveRight,
  Award,
  Globe,
  AlertCircle,
  MapPin,
  Mail,
  Phone,
  Building,
  Link as LinkIcon,
  Shield,
  AlertTriangle,
  Info,
  Save,
  RefreshCw
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../../hooks/use-toast";
import { getAuthToken } from "../../lib/auth";
import { useAuth } from "../../hooks/use-auth";
import { 
  extractContacts, 
  getExtractionLimits,
  saveContact 
} from "../../lib/api/apify-contacts-service";

const movieNetworks = [
  {
    category: "Film Production Companies",
    icon: <Clapperboard className="h-5 w-5 text-orange-500" />,
    networks: [
      { 
        name: "Universal Pictures", 
        url: "https://www.universalpictures.com",
        description: "Major Hollywood studio with global distribution",
        genres: ["Blockbuster", "Franchise", "Animation", "Horror"],
        licensingFees: "Premium"
      },
      { 
        name: "Paramount Pictures", 
        url: "https://www.paramount.com",
        description: "Historic Hollywood studio with diverse film productions",
        genres: ["Action", "Drama", "Comedy", "Sci-Fi"],
        licensingFees: "Premium"
      },
      { 
        name: "Warner Bros.", 
        url: "https://www.warnerbros.com",
        description: "Major film and entertainment studio",
        genres: ["Superheroes", "Fantasy", "Drama", "Animation"],
        licensingFees: "Premium"
      },
      { 
        name: "Sony Pictures", 
        url: "https://www.sonypictures.com",
        description: "Global entertainment company producing films",
        genres: ["Action", "Animation", "Horror", "Drama"],
        licensingFees: "Premium"
      }
    ]
  },
  {
    category: "Music Licensing for Film",
    icon: <Music className="h-5 w-5 text-orange-500" />,
    networks: [
      { 
        name: "INDART MUSIC", 
        url: "https://www.indartmusic.com",
        description: "Specialized in independent artists and music for film",
        genres: ["Indie", "Latin", "World Music", "Alternative"],
        licensingFees: "Moderate"
      },
      { 
        name: "Musicbed", 
        url: "https://www.musicbed.com",
        description: "High-quality music licensing platform for filmmakers",
        genres: ["Cinematic", "Instrumental", "Indie", "Electronic"],
        licensingFees: "Variable"
      },
      { 
        name: "Music Supervisor", 
        url: "https://www.musicsupervisor.com",
        description: "Connecting filmmakers with music industry professionals",
        genres: ["All Genres", "Film Score", "Theme Music"],
        licensingFees: "Custom"
      },
      { 
        name: "Epidemic Sound", 
        url: "https://www.epidemicsound.com",
        description: "Subscription-based music licensing for content creators",
        genres: ["Production Music", "Mood-based", "Instrumental"],
        licensingFees: "Subscription-based"
      }
    ]
  },
  {
    category: "Independent Film Distributors",
    icon: <Award className="h-5 w-5 text-orange-500" />,
    networks: [
      { 
        name: "A24", 
        url: "https://a24films.com",
        description: "Independent entertainment company for groundbreaking films",
        genres: ["Art House", "Horror", "Drama", "Indie"],
        licensingFees: "Moderate to High"
      },
      { 
        name: "Neon", 
        url: "https://neonrated.com",
        description: "Boutique film distributor focused on innovative content",
        genres: ["Art House", "Foreign", "Documentary", "Experimental"],
        licensingFees: "Moderate"
      },
      { 
        name: "IFC Films", 
        url: "https://www.ifcfilms.com",
        description: "Leading distributor of independent and foreign films",
        genres: ["Indie Drama", "Foreign", "Documentary", "Comedy"],
        licensingFees: "Moderate"
      },
      { 
        name: "Magnolia Pictures", 
        url: "https://www.magnoliapictures.com",
        description: "Distributor of independent and international films",
        genres: ["Documentary", "Foreign", "Drama", "Genre Films"],
        licensingFees: "Moderate"
      }
    ]
  }
];

interface MovieContact {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  title?: string;
  company?: string;
  address?: string;
  extractedAt: Date;
  id?: string;
  category?: string;
  twitter?: string;
  linkedin?: string;
  instagram?: string;
  locality?: string;
  notes?: string;
}

interface MovieNetworksDialogProps {
  children: React.ReactNode;
}

export function MovieNetworksDialog({ children }: MovieNetworksDialogProps) {
  const { toast } = useToast();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [apifyResults, setApifyResults] = useState<MovieContact[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [locality, setLocality] = useState("Los Angeles");
  const [extractingContacts, setExtractingContacts] = useState(false);
  const [loadedDynamicContacts, setLoadedDynamicContacts] = useState(false);
  const [maxPages, setMaxPages] = useState(1);
  const [extractionLimitReached, setExtractionLimitReached] = useState(false);
  const [remainingExtractions, setRemainingExtractions] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Simulated search animation
  useEffect(() => {
    if (open && isSearching) {
      const timer = setTimeout(() => {
        // Filter networks based on search query
        const results = movieNetworks.flatMap(category => 
          category.networks
            .filter(network => 
              network.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              network.genres.some(genre => genre.toLowerCase().includes(searchQuery.toLowerCase())) ||
              network.description.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(network => ({
              ...network,
              category: category.category
            }))
        );
        
        setSearchResults(results);
        setIsSearching(false);
      }, 1500); // Simulate search delay
      
      return () => clearTimeout(timer);
    }
  }, [isSearching, searchQuery, open]);

  // Focus search input when dialog opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSearch = () => {
    setIsSearching(true);
  };
  
  // Check user role when component mounts
  useEffect(() => {
    const checkUserRole = async () => {
      if (auth?.user) {
        // Check if user is admin via custom claim or role
        try {
          const token = await auth.user.getIdTokenResult(true);
          setIsAdmin(token.claims.admin === true || token.claims.role === 'admin');
        } catch (error) {
          console.error("Error checking admin status:", error);
        }
      }
    };

    if (open) {
      checkUserRole();
      
      // Check remaining extractions
      if (auth?.user) {
        fetch('/api/contacts/limits', {
          headers: {
            'Authorization': `Bearer ${auth.user.getIdToken()}`
          }
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setRemainingExtractions(data.remaining);
            setExtractionLimitReached(data.remaining <= 0);
          }
        })
        .catch(err => {
          console.error("Error fetching extraction limits:", err);
        });
      }
    }
  }, [open, auth?.user]);

  // Extract contacts using Apify with direct client integration
  const handleExtractContacts = async () => {
    if (!auth?.user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para usar esta función",
        variant: "destructive"
      });
      return;
    }

    if (extractionLimitReached && !isAdmin) {
      toast({
        title: "Límite alcanzado",
        description: "Has alcanzado el límite de extracciones diarias. Prueba mañana o actualiza tu cuenta.",
        variant: "destructive"
      });
      return;
    }

    setExtractingContacts(true);
    try {
      // First try direct client integration
      try {
        // Import the extractContactsWithApify function from our service
        const { extractContactsWithApify } = await import("../../lib/api/apify-contacts-service");
        
        // Prepare search term based on the user input or use a default value
        const searchTerm = searchQuery || "Movie Production";
        
        // Extract contacts directly using Apify client
        const contacts = await extractContactsWithApify(
          searchTerm,
          locality,
          "movie",
          isAdmin ? (maxPages * 20) : 10 // Only admins can use larger result counts (conversion for new actor)
        );
        
        // Update UI with the results
        setApifyResults(contacts);
        setLoadedDynamicContacts(true);
        
        // We don't have remaining extractions data when using direct API
        // so we'll decrement the local counter
        if (remainingExtractions !== null) {
          const newRemaining = Math.max(0, remainingExtractions - 1);
          setRemainingExtractions(newRemaining);
          setExtractionLimitReached(newRemaining <= 0 && !isAdmin);
        }
        
        toast({
          title: "Contactos extraídos con éxito",
          description: `Se han encontrado ${contacts.length} contactos de cine en ${locality}`,
        });
        
        // Return early as we successfully extracted contacts
        setExtractingContacts(false);
        return;
      } catch (directApiError) {
        // Log the error but continue to try server-side method
        console.warn("Direct Apify API call failed, falling back to server API:", directApiError);
      }
      
      // Fall back to server API if direct integration fails
      // Get a fresh token before each request
      const token = await auth.user.getIdToken(true);
      console.log("Got fresh token for Apify request");
      
      const response = await fetch('/api/contacts/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          searchTerm: searchQuery || "Movie Production",
          locality: locality,
          maxPages: isAdmin ? maxPages : 1, // Only admins can use larger page values
          category: "movie"
        })
      });

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}): ${errorText}`);
        
        // Handle specific error cases
        if (response.status === 429) {
          setExtractionLimitReached(true);
          throw new Error("Has alcanzado el límite de extracciones diarias");
        }
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      // Extract data from the response
      const data = await response.json() as { 
        success: boolean; 
        contacts: MovieContact[]; 
        message?: string;
        error?: string;
        remaining?: number;
      };

      if (data.success) {
        setApifyResults(data.contacts || []);
        setLoadedDynamicContacts(true);
        
        // Update remaining extractions if provided
        if (data.remaining !== undefined) {
          setRemainingExtractions(data.remaining);
          setExtractionLimitReached(data.remaining <= 0);
        }
        
        toast({
          title: "Contactos extraídos",
          description: `Se han encontrado ${data.contacts?.length || 0} contactos de cine en ${locality}`,
        });
      } else {
        throw new Error(data.message || "Error extracting contacts");
      }
    } catch (error) {
      console.error("Error extracting contacts:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No pudimos extraer los contactos. Inténtalo más tarde.",
        variant: "destructive"
      });

      // Provide sample data for demonstration purposes if extraction fails
      const sampleData: MovieContact[] = [
        {
          name: "Film Producer Contact",
          email: "producer@filmstudio.com",
          phone: "+1 (555) 321-7890",
          title: "Music Supervisor",
          company: "Hollywood Films",
          website: "https://hollywoodfilms.com",
          address: `789 Studio Way, ${locality}, CA`,
          locality: locality,
          extractedAt: new Date(),
          category: "movie"
        },
        {
          name: "Film Licensing Manager",
          email: "licensing@moviecompany.com",
          phone: "+1 (555) 456-7890",
          title: "Licensing Director",
          company: "Silver Screen Productions",
          website: "https://silverscreen.com",
          address: `456 Cinema Blvd, ${locality}, CA`,
          locality: locality,
          extractedAt: new Date(),
          category: "movie"
        }
      ];
      
      setApifyResults(sampleData);
      setLoadedDynamicContacts(true);
    } finally {
      setExtractingContacts(false);
    }
  };

  // Reset search when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        setSearchQuery("");
        setSearchResults([]);
        setIsSearching(false);
        setSelectedCategory(null);
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Movie Sync Licensing Directory</DialogTitle>
          <DialogDescription>
            License your music for films, documentaries, and other visual media
          </DialogDescription>
        </DialogHeader>

        {/* Animated Search Bar */}
        <div className="relative my-4">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all duration-300 ${isSearching ? 'text-orange-500 animate-pulse' : ''}`} />
            <Input
              ref={searchInputRef}
              className="pl-10 pr-16 py-6 bg-background border-orange-500/30 focus:border-orange-500 transition-all"
              placeholder="Buscar productoras, géneros..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 px-2 text-xs bg-orange-500/10 hover:bg-orange-500/20 text-orange-500"
                    onClick={handleSearch}
                    disabled={isSearching}
                  >
                    {isSearching ? 'Buscando...' : 'Buscar'}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Search Animation */}
          {isSearching && (
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.5 }}
              className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-orange-500 to-purple-500 w-full origin-left"
            />
          )}
        </div>
        
        {/* Apify Contact Extraction Section */}
        <div className="mb-6 mt-2 border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-5 w-5 text-orange-500" />
            <h3 className="font-semibold">Extraer contactos de cine en tiempo real</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Usa nuestra tecnología de AI para extraer contactos de estudios de cine y productoras en cualquier localidad
          </p>
          
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="location" className="mb-1.5 block">Localidad</Label>
              <Select 
                value={locality} 
                onValueChange={setLocality}
              >
                <SelectTrigger id="location" className="w-full">
                  <SelectValue placeholder="Selecciona una localidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Los Angeles">Los Angeles</SelectItem>
                  <SelectItem value="New York">New York</SelectItem>
                  <SelectItem value="Nashville">Nashville</SelectItem>
                  <SelectItem value="Miami">Miami</SelectItem>
                  <SelectItem value="Chicago">Chicago</SelectItem>
                  <SelectItem value="Austin">Austin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                disabled={extractingContacts || (extractionLimitReached && !isAdmin)}
                onClick={handleExtractContacts}
              >
                {extractingContacts ? (
                  <>
                    <span className="animate-pulse mr-2">Extrayendo...</span>
                  </>
                ) : (
                  <>Extraer contactos de cine</>
                )}
              </Button>
            </div>
          </div>
          
          {/* Admin controls */}
          {isAdmin && (
            <div className="mb-4 p-3 bg-blue-500/10 rounded border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm">Panel de administración</span>
                </div>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 text-xs border-blue-500/20">
                  Admin
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label htmlFor="maxPages" className="text-xs mb-1 block">Páginas a extraer</Label>
                  <Select 
                    value={maxPages.toString()} 
                    onValueChange={(value) => setMaxPages(parseInt(value))}
                  >
                    <SelectTrigger id="maxPages" className="h-8 text-sm">
                      <SelectValue placeholder="Páginas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 página</SelectItem>
                      <SelectItem value="2">2 páginas</SelectItem>
                      <SelectItem value="3">3 páginas</SelectItem>
                      <SelectItem value="5">5 páginas</SelectItem>
                      <SelectItem value="10">10 páginas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col">
                  <Label className="text-xs mb-1">Estado de límites</Label>
                  <div className="flex gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-8 border-blue-500/20 hover:bg-blue-500/10 w-full"
                      onClick={() => setExtractionLimitReached(false)}
                    >
                      Reiniciar límites
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Extraction limit warning */}
          {remainingExtractions !== null && !isAdmin && (
            <div className={`p-3 rounded border flex items-center gap-2 text-sm mb-4 ${
              extractionLimitReached 
                ? 'bg-red-500/10 border-red-500/20 text-red-700' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-700'
            }`}>
              {extractionLimitReached ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  <span>Has alcanzado el límite de extracciones diarias. Actualiza tu cuenta para continuar.</span>
                </>
              ) : (
                <>
                  <Info className="h-4 w-4" />
                  <span>
                    Te quedan <strong>{remainingExtractions}</strong> extracciones hoy.
                  </span>
                </>
              )}
            </div>
          )}
          
          {auth?.user ? null : (
            <div className="p-3 bg-orange-500/10 rounded border border-orange-500/20 flex items-center gap-2 text-sm mb-4">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span>Debes iniciar sesión para poder extraer contactos de estudios de cine</span>
            </div>
          )}
        </div>

        {/* Content with scroll area */}
        <ScrollArea className="max-h-[60vh] pr-4">
          {searchQuery && searchResults.length > 0 ? (
            <div className="py-2">
              <div className="flex items-center gap-2 mb-4">
                <Film className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold text-lg">Resultados de búsqueda</h3>
              </div>
              
              <div className="grid gap-3">
                {searchResults.map((network, idx) => (
                  <motion.div
                    key={`${network.name}-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex flex-col p-4 rounded-lg border border-orange-500/20 hover:bg-orange-500/5 hover:border-orange-500/40 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{network.name}</span>
                        <span className="bg-orange-500/10 text-orange-700 dark:text-orange-300 text-xs px-2 py-0.5 rounded-full">
                          {network.category}
                        </span>
                      </div>
                      <a 
                        href={network.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-500 hover:text-orange-600"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p className="mb-1">{network.description}</p>
                      <div className="flex justify-between mt-2">
                        <div className="flex flex-wrap gap-1">
                          {network.genres.slice(0, 3).map((genre: string) => (
                            <span key={genre} className="bg-background/80 border border-border px-2 py-0.5 rounded text-xs">
                              {genre}
                            </span>
                          ))}
                          {network.genres.length > 3 && (
                            <span className="bg-background/80 border border-border px-2 py-0.5 rounded text-xs">
                              +{network.genres.length - 3} más
                            </span>
                          )}
                        </div>
                        <span className="text-xs px-2 py-0.5 border border-orange-500/20 rounded ml-2">
                          {network.licensingFees}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : searchQuery && isSearching ? (
            <div className="py-8 flex flex-col items-center justify-center">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="mb-4"
              >
                <Film className="h-10 w-10 text-orange-500" />
              </motion.div>
              <p className="text-muted-foreground">Buscando productoras de cine...</p>
            </div>
          ) : searchQuery && !isSearching && searchResults.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <Building2 className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">No se encontraron resultados</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                No encontramos productoras o géneros que coincidan con tu búsqueda. Intenta con otros términos.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 py-2">
              {movieNetworks.map((category) => (
                <motion.div 
                  key={category.category}
                  initial={false}
                  animate={selectedCategory === category.category ? { height: 'auto' } : { height: 'auto' }}
                >
                  <div 
                    className="flex items-center gap-2 mb-3 cursor-pointer"
                    onClick={() => setSelectedCategory(
                      selectedCategory === category.category ? null : category.category
                    )}
                  >
                    {category.icon}
                    <h3 className="font-semibold text-lg">{category.category}</h3>
                    <MoveRight className={`h-4 w-4 ml-auto transition-transform duration-300 ${
                      selectedCategory === category.category ? 'rotate-90' : 'rotate-0'
                    }`} />
                  </div>
                  
                  <AnimatePresence>
                    <motion.div 
                      initial={{ opacity: 1, height: 'auto' }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid gap-3 overflow-hidden"
                    >
                      {category.networks.map((network, idx) => (
                        <motion.div
                          key={network.name}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex flex-col p-4 rounded-lg border border-orange-500/20 hover:bg-orange-500/5 hover:border-orange-500/40 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{network.name}</span>
                            <a 
                              href={network.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-500 hover:text-orange-600"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            <p className="mb-1">{network.description}</p>
                            <div className="flex justify-between mt-2">
                              <div className="flex flex-wrap gap-1">
                                {network.genres.slice(0, 3).map((genre) => (
                                  <span key={genre} className="bg-background/80 border border-border px-2 py-0.5 rounded text-xs">
                                    {genre}
                                  </span>
                                ))}
                                {network.genres.length > 3 && (
                                  <span className="bg-background/80 border border-border px-2 py-0.5 rounded text-xs">
                                    +{network.genres.length - 3} más
                                  </span>
                                )}
                              </div>
                              <span className="text-xs px-2 py-0.5 border border-orange-500/20 rounded ml-2">
                                {network.licensingFees}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
