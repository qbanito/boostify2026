import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { 
  ExternalLink, 
  Search, 
  Radio, 
  Music, 
  Wifi, 
  Globe, 
  TrendingUp,
  MoveRight,
  MapPin,
  Mail,
  Phone,
  Building,
  Link,
  AlertCircle
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../../hooks/use-toast";
import { getAuthToken } from "../../lib/auth";
import { useAuth } from "../../hooks/use-auth";

// Initial data as fallback
const radioNetworks = [
  {
    category: "National Networks",
    icon: <Globe className="h-5 w-5 text-orange-500" />,
    networks: [
      { 
        name: "iHeartRadio", 
        url: "https://www.iheartradio.com", 
        audience: "250M+ monthly listeners",
        genres: ["Pop", "Rock", "Hip-Hop", "Country"]
      },
      { 
        name: "Cumulus Media", 
        url: "https://www.cumulus.com",
        audience: "180M+ weekly listeners",
        genres: ["Talk Radio", "Sports", "News", "Adult Contemporary"] 
      },
      { 
        name: "Entercom", 
        url: "https://www.audacy.com",
        audience: "170M+ monthly listeners",
        genres: ["Alternative", "Country", "News", "Sports"] 
      },
      { 
        name: "NPR", 
        url: "https://www.npr.org",
        audience: "60M+ weekly listeners",
        genres: ["News", "Talk", "Culture", "Education"]
      }
    ]
  },
  {
    category: "Local Stations",
    icon: <Radio className="h-5 w-5 text-orange-500" />,
    networks: [
      { 
        name: "CBS Radio", 
        url: "https://www.audacy.com/stations",
        audience: "80M+ weekly listeners",
        genres: ["News", "Sports", "Classic Hits", "Contemporary"] 
      },
      { 
        name: "Cox Radio", 
        url: "https://www.coxmedia.com/radio",
        audience: "30M+ weekly listeners",
        genres: ["Urban", "Country", "Top 40", "Adult Hits"] 
      },
      { 
        name: "Salem Media Group", 
        url: "https://salemmedia.com",
        audience: "20M+ weekly listeners",
        genres: ["Christian", "Conservative Talk", "News"]
      },
      { 
        name: "Townsquare Media", 
        url: "https://www.townsquaremedia.com",
        audience: "65M+ monthly listeners",
        genres: ["Country", "Rock", "Alternative", "Talk"]
      }
    ]
  },
  {
    category: "Internet Radio",
    icon: <Wifi className="h-5 w-5 text-orange-500" />,
    networks: [
      { 
        name: "Pandora", 
        url: "https://www.pandora.com",
        audience: "55M+ active users",
        genres: ["All Major Genres", "Custom Stations", "Podcasts"]
      },
      { 
        name: "TuneIn", 
        url: "https://tunein.com",
        audience: "75M+ active users",
        genres: ["Sports", "News", "Music", "Podcasts", "Audiobooks"]
      },
      { 
        name: "Live365", 
        url: "https://live365.com",
        audience: "5M+ monthly listeners",
        genres: ["Independent", "Niche", "Community Radio"]
      },
      { 
        name: "Radio.com", 
        url: "https://www.radio.com",
        audience: "40M+ monthly users",
        genres: ["Top 40", "Sports", "News", "Classic Hits"]
      }
    ]
  }
];

interface RadioContact {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  title?: string;
  company?: string;
  address?: string;
  extractedAt: Date;
}

interface RadioNetworksDialogProps {
  children: React.ReactNode;
}

export function RadioNetworksDialog({ children }: RadioNetworksDialogProps) {
  const { toast } = useToast();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [apifyResults, setApifyResults] = useState<RadioContact[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [locality, setLocality] = useState("Los Angeles");
  const [extractingContacts, setExtractingContacts] = useState(false);
  const [loadedDynamicContacts, setLoadedDynamicContacts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Simulated search animation
  useEffect(() => {
    if (open && isSearching) {
      const timer = setTimeout(() => {
        // Filter networks based on search query
        const results = radioNetworks.flatMap(category => 
          category.networks
            .filter(network => 
              network.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              network.genres.some(genre => genre.toLowerCase().includes(searchQuery.toLowerCase()))
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

  // Extract contacts using Apify
  const handleExtractContacts = async () => {
    if (!auth?.user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para usar esta función",
        variant: "destructive"
      });
      return;
    }

    setExtractingContacts(true);
    try {
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
          searchTerm: "Radio Publishing",
          locality: locality,
          maxPages: 1,
          category: "radio"
        })
      });

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}): ${errorText}`);
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      // Extract data from the response
      const data = await response.json() as { 
        success: boolean; 
        contacts: RadioContact[]; 
        message?: string,
        error?: string
      };

      if (data.success) {
        setApifyResults(data.contacts || []);
        setLoadedDynamicContacts(true);
        toast({
          title: "Contactos extraídos",
          description: `Se han encontrado ${data.contacts?.length || 0} contactos de radio en ${locality}`,
        });
      } else {
        throw new Error(data.message || "Error extracting contacts");
      }
    } catch (error) {
      console.error("Error extracting contacts:", error);
      toast({
        title: "Error",
        description: "No pudimos extraer los contactos. Inténtalo más tarde.",
        variant: "destructive"
      });

      // Provide sample data for demonstration purposes if extraction fails
      const sampleData: RadioContact[] = [
        {
          name: "Radio Example Contact",
          email: "contact@radiostation.com",
          phone: "+1 (555) 123-4567",
          title: "Music Director",
          company: "KXYZ Radio",
          website: "https://radiostation.com",
          address: `123 Broadcasting Ave, ${locality}, CA`,
          extractedAt: new Date()
        },
        {
          name: "Music Publishing Pro",
          email: "licensing@musicpro.com",
          phone: "+1 (555) 987-6543",
          title: "Licensing Manager",
          company: "Music Publishing Group",
          website: "https://musicpro.com",
          address: `456 Industry Blvd, ${locality}, CA`,
          extractedAt: new Date()
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
          <DialogTitle>Radio Networks Directory</DialogTitle>
          <DialogDescription>
            Connect with leading radio networks and expand your music's reach
          </DialogDescription>
        </DialogHeader>

        {/* Animated Search Bar */}
        <div className="relative my-4">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all duration-300 ${isSearching ? 'text-orange-500 animate-pulse' : ''}`} />
            <Input
              ref={searchInputRef}
              className="pl-10 pr-16 py-6 bg-background border-orange-500/30 focus:border-orange-500 transition-all"
              placeholder="Buscar redes de radio, géneros..."
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
            <h3 className="font-semibold">Extraer contactos de radio en tiempo real</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Usa nuestra tecnología de AI para extraer contactos de radio relevantes en cualquier localidad
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
                disabled={extractingContacts}
                onClick={handleExtractContacts}
              >
                {extractingContacts ? (
                  <>
                    <span className="animate-pulse mr-2">Extrayendo...</span>
                  </>
                ) : (
                  <>Extraer contactos de radio</>
                )}
              </Button>
            </div>
          </div>
          
          {auth?.user ? null : (
            <div className="p-3 bg-orange-500/10 rounded border border-orange-500/20 flex items-center gap-2 text-sm mb-4">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span>Debes iniciar sesión para poder extraer contactos de radio</span>
            </div>
          )}
        </div>

        {/* Content with scroll area */}
        <ScrollArea className="max-h-[60vh] pr-4">
          {searchQuery && searchResults.length > 0 ? (
            <div className="py-2">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-orange-500" />
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
                      <p className="mb-1">{network.audience}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {network.genres.map((genre: string) => (
                          <span key={genre} className="bg-background/80 border border-border px-2 py-0.5 rounded text-xs">
                            {genre}
                          </span>
                        ))}
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
                <Radio className="h-10 w-10 text-orange-500" />
              </motion.div>
              <p className="text-muted-foreground">Buscando redes de radio...</p>
            </div>
          ) : searchQuery && !isSearching && searchResults.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <Music className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">No se encontraron resultados</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                No encontramos redes o géneros que coincidan con tu búsqueda. Intenta con otros términos.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 py-2">
              {loadedDynamicContacts && apifyResults.length > 0 ? (
                <motion.div
                  initial={false}
                  animate={{ height: 'auto' }}
                  className="mb-6"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Radio className="h-5 w-5 text-orange-500" />
                    <h3 className="font-semibold text-lg">Contactos extraídos de {locality}</h3>
                    <span className="bg-orange-500/10 text-orange-500 text-xs px-2 py-0.5 rounded-full ml-2">
                      {apifyResults.length} contactos
                    </span>
                  </div>
                  
                  <div className="grid gap-3 overflow-hidden">
                    {apifyResults.map((contact, idx) => (
                      <motion.div
                        key={`contact-${idx}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex flex-col p-4 rounded-lg border border-orange-500/20 hover:bg-orange-500/5 hover:border-orange-500/40 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{contact.name}</span>
                          {contact.website && (
                            <a 
                              href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-500 hover:text-orange-600"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        
                        <div className="mt-2 text-sm text-muted-foreground space-y-1.5">
                          {contact.title && (
                            <div className="flex items-center gap-1.5">
                              <Building className="h-3.5 w-3.5 text-orange-500/70" />
                              <span>{contact.title}</span>
                              {contact.company && (
                                <span className="bg-orange-500/10 text-orange-700 dark:text-orange-300 text-xs px-2 py-0.5 rounded-full">
                                  {contact.company}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {contact.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-orange-500/70" />
                              <a 
                                href={`mailto:${contact.email}`} 
                                className="hover:text-orange-500 transition-colors"
                              >
                                {contact.email}
                              </a>
                            </div>
                          )}
                          
                          {contact.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-orange-500/70" />
                              <a 
                                href={`tel:${contact.phone}`}
                                className="hover:text-orange-500 transition-colors"
                              >
                                {contact.phone}
                              </a>
                            </div>
                          )}
                          
                          {contact.website && (
                            <div className="flex items-center gap-1.5">
                              <Link className="h-3.5 w-3.5 text-orange-500/70" />
                              <span className="truncate">{contact.website}</span>
                            </div>
                          )}
                          
                          {contact.address && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="h-3.5 w-3.5 mt-0.5 text-orange-500/70" />
                              <span>{contact.address}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ) : null}
              
              {radioNetworks.map((category) => (
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
                            <p className="mb-1">{network.audience}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {network.genres.map((genre) => (
                                <span key={genre} className="bg-background/80 border border-border px-2 py-0.5 rounded text-xs">
                                  {genre}
                                </span>
                              ))}
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
