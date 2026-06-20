import { useState } from "react";
import { logger } from "../../lib/logger";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Video,
  Check,
  Star,
  Eye,
  Clapperboard,
} from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "../../hooks/use-toast";
import { DirectorDetailsModal } from "./DirectorDetailsModal";
import { DIRECTORS, type DirectorProfile } from "../../data/directors";
import { cn } from "@/lib/utils";

interface DirectorsListProps {
  onDirectorSelected?: (director: DirectorProfile) => void;
}

interface Director {
  id: string;
  name: string;
  specialty: string;
  experience: string;
  rating: number;
  imageUrl?: string;
}

// Director image mapping - same as director-selection-modal
const DIRECTOR_IMAGE_MAP: { [key: string]: string } = {
  "sofia-ramirez": "/assets/generated_images/sofia_ramirez_director_headshot_portrait.png",
  "david-kim": "/assets/generated_images/david_kim_director_professional_headshot.png",
  "james-wilson": "/assets/generated_images/james_wilson_director_headshot_portrait.png",
  "isabella-moretti": "/assets/generated_images/isabella_moretti_director_professional_portrait.png",
  "marcus-chen": "/assets/generated_images/marcus_chen_director_professional_headshot.png",
  "elena-rodriguez": "/assets/generated_images/elena_rodriguez_director_professional_portrait.png",
  "carlos-rodriguez": "/assets/generated_images/carlos_rodriguez_director_headshot_portrait.png",
  "nina-patel": "/assets/generated_images/nina_patel_director_professional_portrait.png",
  "david-oconnor": "/assets/generated_images/david_oconnor_director_professional_headshot.png",
  "elena-petrov": "/assets/generated_images/elena_petrov_director_professional_portrait.png",
  "yuki-tanaka": "/assets/generated_images/yuki_tanaka_director_professional_headshot.png",
  "amara-johnson": "/assets/generated_images/amara_johnson_director_professional_portrait.png",
  "michael-brooks": "/assets/generated_images/michael_brooks_director_professional_headshot.png",
  "alex-thompson": "/assets/generated_images/alex_thompson_director_professional_portrait.png",
};

export function DirectorsList({ onDirectorSelected }: DirectorsListProps = {}) {
  const { toast } = useToast();
  const [selectedDirector, setSelectedDirector] = useState<Director | null>(null);
  const [selectedDirectorForDetails, setSelectedDirectorForDetails] = useState<DirectorProfile | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Transform DIRECTORS to include imageUrl - same pattern as director-selection-modal
  const directors: Director[] = DIRECTORS.map(d => ({
    id: d.id,
    name: d.name,
    specialty: d.specialty,
    experience: d.experience || "Professional Director",
    rating: d.rating,
    imageUrl: DIRECTOR_IMAGE_MAP[d.id] || undefined
  }));

  const handleViewDetails = (director: Director) => {
    const fullDirector = DIRECTORS.find(d => d.id === director.id);
    if (fullDirector) {
      setSelectedDirectorForDetails(fullDirector);
      setShowDetailsModal(true);
      logger.info(`✅ Detalles del director cargados:`, fullDirector.name);
    }
  };

  const handleCreateVideo = (director: DirectorProfile) => {
    setShowDetailsModal(false);
    if (onDirectorSelected) {
      onDirectorSelected(director);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <Card className="p-4 md:p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Video className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Featured Directors</h2>
              <p className="text-sm text-muted-foreground">
                Connect with talented music video directors
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 overflow-y-auto max-h-[calc(100vh-200px)]">
            {directors.map((director, index) => (
              <motion.div
                key={director.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={cn(
                    "p-2 sm:p-4 md:p-5 cursor-pointer transition-all hover:border-orange-500/50 hover:shadow-2xl hover:scale-[1.02] relative overflow-hidden group bg-gradient-to-br from-background to-background/80",
                    selectedDirector?.id === director.id && "border-2 border-orange-500 bg-gradient-to-br from-orange-500/25 to-orange-600/15 shadow-2xl shadow-orange-500/40"
                  )}
                  onClick={() => setSelectedDirector(director)}
                  data-testid={`director-${director.id}`}
                >
                  {/* Animated Background Accent */}
                  <div className="absolute top-0 right-0 w-16 sm:w-32 h-16 sm:h-32 bg-gradient-to-br from-orange-500/20 to-orange-600/0 rounded-full -mr-6 sm:-mr-12 -mt-6 sm:-mt-12 group-hover:scale-150 transition-transform duration-500" />
                  
                  {/* Mobile: horizontal compact | Desktop: vertical with large image */}
                  <div className="flex flex-row sm:flex-col gap-2.5 sm:gap-4 relative z-10">
                    {/* Avatar — circle on mobile, large image on desktop */}
                    <div className={cn(
                      "w-14 h-14 sm:w-full sm:h-auto sm:aspect-square rounded-full sm:rounded-xl flex-shrink-0 overflow-hidden bg-gradient-to-br from-orange-500/30 to-orange-600/20 flex items-center justify-center transition-all border-2 border-orange-500/40 shadow-md sm:shadow-lg",
                      selectedDirector?.id === director.id && "ring-2 sm:ring-4 ring-orange-500/50 border-orange-500/70 shadow-xl shadow-orange-500/40"
                    )}>
                      {director.imageUrl ? (
                        <img
                          src={director.imageUrl}
                          alt={`${director.name} - ${director.specialty}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "https://api.dicebear.com/7.x/avatar/svg?seed=" + encodeURIComponent(director.name) + "&scale=80";
                          }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-orange-600 via-orange-700 to-red-800">
                          <Clapperboard className="h-6 w-6 sm:h-12 sm:w-12 text-white/80" />
                        </div>
                      )}
                    </div>
                    
                    {/* Director Info Section */}
                    <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-3">
                      <div className="flex items-start justify-between gap-1 sm:gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-xs sm:text-lg line-clamp-1">{director.name}</h4>
                          <p className="text-[10px] sm:text-sm font-semibold text-orange-500 mb-0 sm:mb-1 line-clamp-1">
                            {director.specialty}
                          </p>
                        </div>
                        {selectedDirector?.id === director.id && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="h-4 w-4 sm:h-6 sm:w-6 rounded-full bg-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg"
                          >
                            <Check className="h-2.5 w-2.5 sm:h-4 sm:w-4" />
                          </motion.div>
                        )}
                      </div>
                      
                      {/* Rating Badge — always visible, compact on mobile */}
                      <div className="flex items-center gap-1 sm:gap-2 bg-orange-500/15 px-1.5 sm:px-3 py-0.5 sm:py-2 rounded-md sm:rounded-lg border border-orange-500/30 w-fit">
                        <Star className="h-2.5 w-2.5 sm:h-4 sm:w-4 fill-orange-500 text-orange-500" />
                        <span className="text-[9px] sm:text-sm font-bold text-orange-600 dark:text-orange-400">{director.rating || 4.5}/5</span>
                      </div>
                      
                      <p className="hidden sm:block text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {director.experience}
                      </p>

                      <Button
                        className="mt-1 sm:mt-4 w-full transition-all duration-200 bg-orange-500 hover:bg-orange-600 text-white h-6 sm:h-10 text-[9px] sm:text-sm"
                        onClick={() => handleViewDetails(director)}
                        data-testid={`button-view-details-${director.id}`}
                      >
                        <Eye className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Ver Detalles</span>
                        <span className="sm:hidden">Ver</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      <DirectorDetailsModal
        director={selectedDirectorForDetails}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        onCreateVideo={handleCreateVideo}
      />
    </>
  );
}
