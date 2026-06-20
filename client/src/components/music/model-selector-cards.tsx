import { Zap, Music, Sparkles, Star, Crown } from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface ModelCardProps {
  id: string;
  name: string;
  description: string;
  duration: string;
  speed: "Ultra-fast" | "Fast" | "Normal";
  quality: "Alta" | "Enterprise" | "Premium";
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  features: string[];
  badge?: string;
}

function ModelCard({
  name,
  description,
  duration,
  speed,
  quality,
  icon,
  isSelected,
  onSelect,
  features,
  badge
}: ModelCardProps) {
  return (
    <Card
      className={cn(
        "relative p-4 cursor-pointer transition-all duration-300 hover:shadow-lg",
        isSelected 
          ? "border-2 border-primary bg-primary/5 shadow-md" 
          : "border hover:border-primary/50"
      )}
      onClick={onSelect}
      data-testid={`model-card-${name.toLowerCase().replace(/\s/g, '-')}`}
    >
      {badge && (
        <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground">
          {badge}
        </Badge>
      )}
      
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
        )}>
          {icon}
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">{name}</h3>
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
          
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge variant="outline" className="text-xs">
              ⏱️ {duration}
            </Badge>
            <Badge variant="outline" className="text-xs">
              ⚡ {speed}
            </Badge>
            <Badge variant="outline" className="text-xs">
              ✨ {quality}
            </Badge>
          </div>
          
          <ul className="space-y-1">
            {features.map((feature, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start">
                <span className="mr-1">•</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {isSelected && (
          <div className="absolute top-2 right-2">
            <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-white"></div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

interface ModelSelectorCardsProps {
  selectedModel: string;
  onModelSelect: (model: string) => void;
}

export function ModelSelectorCards({ selectedModel, onModelSelect }: ModelSelectorCardsProps) {
  const models = [
    {
      id: "music-lyria3",
      name: "Google Lyria 3 Pro",
      description: "Google DeepMind's most advanced AI music model — full songs up to 3 min with vocals, lyrics & multi-language",
      duration: "Up to 3 min",
      speed: "Fast" as const,
      quality: "Premium" as const,
      icon: <Crown className="h-5 w-5" />,
      features: [
        "44.1 kHz stereo, studio-grade audio",
        "Natural vocals with custom lyrics",
        "BPM, key, timestamps & structure control",
        "Multi-language vocals & image-to-music"
      ],
      badge: "👑 #1 MODEL"
    },
    {
      id: "music-fal",
      name: "FAL Minimax v2",
      description: "Ultra-fast generation for demos and previews",
      duration: "30 sec",
      speed: "Ultra-fast" as const,
      quality: "Alta" as const,
      icon: <Zap className="h-5 w-5" />,
      features: [
        "Generates in <10 seconds",
        "Perfect for prototypes",
        "Professional quality"
      ],
      badge: "⚡ FAST"
    },
    {
      id: "music-stable",
      name: "Stable Audio 2.5",
      description: "Enterprise quality with complete musical structure",
      duration: "3 min",
      speed: "Fast" as const,
      quality: "Enterprise" as const,
      icon: <Star className="h-5 w-5" />,
      features: [
        "Full songs",
        "Intro, development, outro",
        "Quality comparable to Suno"
      ],
      badge: "🌟 PRO"
    },
    {
      id: "music-s",
      name: "Suno",
      description: "High quality with vocals and lyrics",
      duration: "Variable",
      speed: "Normal" as const,
      quality: "Premium" as const,
      icon: <Music className="h-5 w-5" />,
      features: [
        "Natural vocals",
        "Customizable lyrics",
        "Wide variety of styles"
      ]
    },
    {
      id: "music-u",
      name: "Udio",
      description: "Natural vocals optimized for pop/modern",
      duration: "Variable",
      speed: "Normal" as const,
      quality: "Premium" as const,
      icon: <Sparkles className="h-5 w-5" />,
      features: [
        "Ultra-natural vocals",
        "Ideal for pop and modern",
        "High fidelity"
      ]
    }
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium mb-2 block">
          Select an AI model
        </label>
        <p className="text-xs text-muted-foreground mb-4">
          Each model has different capabilities and generation times
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            {...model}
            isSelected={selectedModel === model.id}
            onSelect={() => onModelSelect(model.id)}
          />
        ))}
      </div>
    </div>
  );
}
