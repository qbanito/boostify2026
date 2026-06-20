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
import { 
  ExternalLink, 
  Search, 
  Tv, 
  Film,
  Music, 
  Globe, 
  PlayCircle, 
  TrendingUp,
  MoveRight,
  Video
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const tvNetworks = [
  {
    category: "Music Licensing Companies",
    icon: <Music className="h-5 w-5 text-orange-500" />,
    networks: [
      { 
        name: "INDART MUSIC", 
        url: "https://www.indartmusic.com",
        description: "Specialized in indie and Latin music licensing",
        genres: ["Latin", "Indie", "Folk", "Alternative"],
        licensingFees: "Moderate"
      },
      { 
        name: "Universal Production Music", 
        url: "https://www.universalproductionmusic.com",
        description: "Extensive library of high-quality production music",
        genres: ["Pop", "Rock", "Electronic", "Classical", "Urban"],
        licensingFees: "Premium"
      },
      { 
        name: "Warner Chappell Production Music", 
        url: "https://www.warnerchappellpm.com",
        description: "Production music from one of the biggest publishers",
        genres: ["All Major Genres", "Film Scores", "TV Themes"],
        licensingFees: "Premium"
      },
      { 
        name: "BMG Production Music", 
        url: "https://www.bmgproductionmusic.com",
        description: "Global music publisher with extensive catalog",
        genres: ["All Genres", "Trailer Music", "Advertising"],
        licensingFees: "Premium"
      }
    ]
  },
  {
    category: "TV Networks",
    icon: <Tv className="h-5 w-5 text-orange-500" />,
    networks: [
      { 
        name: "NBC Universal", 
        url: "https://www.nbcuniversal.com",
        description: "Major American television network",
        genres: ["Drama", "Comedy", "News", "Reality"],
        licensingFees: "High"
      },
      { 
        name: "CBS", 
        url: "https://www.paramount.com",
        description: "Popular American broadcast television network",
        genres: ["Procedurals", "News", "Reality", "Drama"],
        licensingFees: "High"
      },
      { 
        name: "ABC", 
        url: "https://www.abc.com",
        description: "American commercial broadcast television network",
        genres: ["Drama", "Comedy", "Reality", "Family"],
        licensingFees: "High"
      },
      { 
        name: "FOX", 
        url: "https://www.fox.com",
        description: "American television network with diverse programming",
        genres: ["Animation", "Reality", "Drama", "Comedy"],
        licensingFees: "High"
      }
    ]
  },
  {
    category: "Streaming Platforms",
    icon: <PlayCircle className="h-5 w-5 text-orange-500" />,
    networks: [
      { 
        name: "Netflix", 
        url: "https://www.netflix.com",
        description: "Leading subscription streaming service",
        genres: ["Original Series", "Movies", "Documentaries"],
        licensingFees: "Variable (High)"
      },
      { 
        name: "Amazon Prime", 
        url: "https://www.primevideo.com",
        description: "Streaming service with original productions",
        genres: ["Original Series", "Movies", "International"],
        licensingFees: "Variable (Moderate to High)"
      },
      { 
        name: "Disney+", 
        url: "https://www.disneyplus.com",
        description: "Family-friendly streaming service",
        genres: ["Family", "Animation", "Marvel", "Star Wars"],
        licensingFees: "High"
      },
      { 
        name: "HBO Max", 
        url: "https://www.max.com",
        description: "Premium streaming platform with exclusive content",
        genres: ["Prestige Drama", "Documentaries", "Comedy"],
        licensingFees: "Premium"
      }
    ]
  }
];

interface TVNetworksDialogProps {
  children: React.ReactNode;
}

export function TVNetworksDialog({ children }: TVNetworksDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Simulated search animation
  useEffect(() => {
    if (open && isSearching) {
      const timer = setTimeout(() => {
        // Filter networks based on search query
        const results = tvNetworks.flatMap(category => 
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
          <DialogTitle>TV Licensing Directory</DialogTitle>
          <DialogDescription>
            License your music to leading TV networks and streaming platforms
          </DialogDescription>
        </DialogHeader>

        {/* Animated Search Bar */}
        <div className="relative my-4">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all duration-300 ${isSearching ? 'text-orange-500 animate-pulse' : ''}`} />
            <Input
              ref={searchInputRef}
              className="pl-10 pr-16 py-6 bg-background border-orange-500/30 focus:border-orange-500 transition-all"
              placeholder="Buscar plataformas, géneros..."
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

        {/* Content with scroll area */}
        <ScrollArea className="max-h-[60vh] pr-4">
          {searchQuery && searchResults.length > 0 ? (
            <div className="py-2">
              <div className="flex items-center gap-2 mb-4">
                <Video className="h-5 w-5 text-orange-500" />
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
                <Tv className="h-10 w-10 text-orange-500" />
              </motion.div>
              <p className="text-muted-foreground">Buscando plataformas de TV...</p>
            </div>
          ) : searchQuery && !isSearching && searchResults.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <Film className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">No se encontraron resultados</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                No encontramos plataformas o géneros que coincidan con tu búsqueda. Intenta con otros términos.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 py-2">
              {tvNetworks.map((category) => (
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
