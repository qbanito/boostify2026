import { useState } from "react";
import { logger } from "../../lib/logger";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Zap, Music, Guitar, Mic2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export interface QuickStartTemplate {
  id: string;
  name: string;
  genre: string;
  description: string;
  icon: React.ReactNode;
  director: {
    name: string;
    style: string;
  };
  editingStyle: {
    id: string;
    name: string;
    duration: { min: number; max: number };
  };
  visualStyle: {
    mood: string;
    colorPalette: string;
    cameraFormat: string;
    visualIntensity: number;
  };
  color: string;
}

const templates: QuickStartTemplate[] = [
  {
    id: "rap-hiphop",
    name: "Rap/Hip-Hop",
    genre: "Urban",
    description: "Estilo urbano dinámico con cortes rápidos y colores vibrantes",
    icon: <Mic2 className="w-8 h-8" />,
    director: {
      name: "Hype Williams",
      style: "Fisheye lens, vibrant colors, surreal landscapes"
    },
    editingStyle: {
      id: "music_video",
      name: "Music Video",
      duration: { min: 2, max: 4 }
    },
    visualStyle: {
      mood: "energetic",
      colorPalette: "vibrant, neon colors",
      cameraFormat: "Anamorphic",
      visualIntensity: 80
    },
    color: "from-purple-600 to-pink-600"
  },
  {
    id: "rock",
    name: "Rock",
    genre: "Rock",
    description: "Energético y raw con estética de concierto en vivo",
    icon: <Guitar className="w-8 h-8" />,
    director: {
      name: "Dave Grohl",
      style: "Raw energy, live concert feel, dramatic lighting"
    },
    editingStyle: {
      id: "dynamic",
      name: "Dynamic",
      duration: { min: 3, max: 5 }
    },
    visualStyle: {
      mood: "intense",
      colorPalette: "dark, high contrast",
      cameraFormat: "35mm",
      visualIntensity: 75
    },
    color: "from-red-600 to-orange-600"
  },
  {
    id: "pop",
    name: "Pop",
    genre: "Pop",
    description: "Colorido y pulido con producción de alta calidad",
    icon: <Sparkles className="w-8 h-8" />,
    director: {
      name: "Joseph Kahn",
      style: "High-gloss, colorful, fast-paced"
    },
    editingStyle: {
      id: "phrases",
      name: "Phrase-based Editing",
      duration: { min: 4, max: 6 }
    },
    visualStyle: {
      mood: "upbeat",
      colorPalette: "bright, pastel colors",
      cameraFormat: "Digital RAW",
      visualIntensity: 70
    },
    color: "from-blue-600 to-cyan-600"
  },
  {
    id: "indie",
    name: "Indie/Alternative",
    genre: "Alternative",
    description: "Estético y artístico con narrativa visual única",
    icon: <Music className="w-8 h-8" />,
    director: {
      name: "Spike Jonze",
      style: "Creative storytelling, artistic visuals"
    },
    editingStyle: {
      id: "narrative",
      name: "Narrative",
      duration: { min: 4, max: 7 }
    },
    visualStyle: {
      mood: "contemplative",
      colorPalette: "muted, earth tones",
      cameraFormat: "Super 8mm",
      visualIntensity: 50
    },
    color: "from-green-600 to-teal-600"
  },
  {
    id: "edm",
    name: "EDM/Electronic",
    genre: "Electronic",
    description: "Futurista y psicodélico con efectos visuales intensos",
    icon: <Zap className="w-8 h-8" />,
    director: {
      name: "Jonas Åkerlund",
      style: "Bold visuals, dramatic effects"
    },
    editingStyle: {
      id: "rhythmic",
      name: "Rhythmic",
      duration: { min: 1, max: 2 }
    },
    visualStyle: {
      mood: "futuristic",
      colorPalette: "neon, fluorescent",
      cameraFormat: "Digital RAW",
      visualIntensity: 90
    },
    color: "from-fuchsia-600 to-purple-600"
  }
];

interface QuickStartTemplatesProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: QuickStartTemplate) => void;
}

export function QuickStartTemplates({ open, onClose, onSelectTemplate }: QuickStartTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<QuickStartTemplate | null>(null);

  const handleSelect = (template: QuickStartTemplate) => {
    setSelectedTemplate(template);
  };

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-black via-zinc-900 to-black border-orange-500/20">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-orange-500" />
            Inicio Rápido - Templates
          </DialogTitle>
          <p className="text-white/70 mt-2">
            Selecciona un template para empezar tu proyecto en segundos con configuración optimizada
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {templates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`cursor-pointer transition-all duration-300 overflow-hidden border-2 ${
                  selectedTemplate?.id === template.id
                    ? 'border-orange-500 shadow-lg shadow-orange-500/20 scale-105'
                    : 'border-zinc-700 hover:border-orange-500/50 hover:scale-102'
                }`}
                onClick={() => handleSelect(template)}
                data-testid={`template-${template.id}`}
              >
                {/* Header con gradiente */}
                <div className={`bg-gradient-to-r ${template.color} p-6 text-white`}>
                  <div className="flex items-center justify-between mb-3">
                    {template.icon}
                    <Badge variant="secondary" className="bg-white/20 text-white border-0">
                      {template.genre}
                    </Badge>
                  </div>
                  <h3 className="text-2xl font-bold">{template.name}</h3>
                  <p className="text-sm text-white/90 mt-2">{template.description}</p>
                </div>

                {/* Detalles */}
                <div className="p-4 bg-zinc-900/50 space-y-3">
                  <div>
                    <p className="text-xs text-orange-400 font-semibold mb-1">Director</p>
                    <p className="text-sm text-white">{template.director.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-orange-400 font-semibold mb-1">Estilo de Edición</p>
                    <p className="text-sm text-white">{template.editingStyle.name}</p>
                    <p className="text-xs text-white/60">
                      Clips: {template.editingStyle.duration.min}-{template.editingStyle.duration.max}s
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-orange-400 font-semibold mb-1">Mood</p>
                    <p className="text-sm text-white capitalize">{template.visualStyle.mood}</p>
                  </div>

                  <div>
                    <p className="text-xs text-orange-400 font-semibold mb-1">Intensidad Visual</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-zinc-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-orange-500 to-orange-600 h-full rounded-full"
                          style={{ width: `${template.visualStyle.visualIntensity}%` }}
                        />
                      </div>
                      <span className="text-xs text-white/70">{template.visualStyle.visualIntensity}%</span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-700">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-white/70 hover:text-white"
            data-testid="button-cancel-template"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTemplate}
            className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 border-0 shadow-md"
            data-testid="button-confirm-template"
          >
            {selectedTemplate ? `Usar Template: ${selectedTemplate.name}` : 'Selecciona un Template'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
