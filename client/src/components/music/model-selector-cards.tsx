import { Zap, Sparkles, Star, Crown } from "lucide-react";
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
  isAvailable: boolean;
  providerLabel?: string;
  unavailableReason?: string;
  onSelect: () => void;
  features: string[];
  badge?: string;
}

function ModelCard({ name, description, duration, speed, quality, icon, isSelected, isAvailable, providerLabel, unavailableReason, onSelect, features, badge }: ModelCardProps) {
  return (
    <button type="button" disabled={!isAvailable} onClick={onSelect} className="text-left disabled:cursor-not-allowed" aria-pressed={isSelected} aria-label={`${name}${isAvailable ? " available" : " unavailable; provider not configured"}`}>
      <Card className={cn(
        "relative h-full p-4 transition-all duration-300",
        isSelected ? "border-2 border-primary bg-primary/5 shadow-md" : "border hover:border-primary/50",
        !isAvailable && "opacity-50 grayscale",
      )} data-testid={`model-card-${name.toLowerCase().replace(/\s/g, '-')}`}>
        {badge && <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground">{badge}</Badge>}
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg", isSelected ? "bg-primary text-primary-foreground" : "bg-muted")}>{icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">{name}</h3>
            <p className="text-xs text-muted-foreground mb-3">{description}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant="outline" className="text-xs">{duration}</Badge>
              <Badge variant="outline" className="text-xs">{speed}</Badge>
              <Badge variant="outline" className="text-xs">{quality}</Badge>
            </div>
            <ul className="space-y-1">{features.map((feature) => <li key={feature} className="text-xs text-muted-foreground">• {feature}</li>)}</ul>
            <div className={cn("mt-3 text-[11px] font-medium", isAvailable ? "text-emerald-600" : "text-amber-600")}>
              {isAvailable ? (providerLabel || "Ready") : (unavailableReason || "Provider not configured")}
            </div>
          </div>
          {isSelected && <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary ring-2 ring-background" />}
        </div>
      </Card>
    </button>
  );
}

interface ModelSelectorCardsProps {
  selectedModel: string;
  onModelSelect: (model: string) => void;
  availability?: Record<string, { available: boolean; provider?: string; reason?: string }>;
  loading?: boolean;
}

export function ModelSelectorCards({ selectedModel, onModelSelect, availability = {}, loading = false }: ModelSelectorCardsProps) {
  const models = [
    { id: "music-lyria3", name: "Google Lyria 3.5", description: "Full songs with structured sections, lyrics, vocals, and instrumental arrangements", duration: "A few minutes", speed: "Normal" as const, quality: "Premium" as const, icon: <Crown className="h-5 w-5" />, features: ["Text prompts", "Verse, chorus, and bridge structure", "Lyrics in the prompt language"], badge: "FULL SONG" },
    { id: "music-lyria-clip", name: "Google Lyria Clip", description: "A quick clip or loop to test an idea before generating a full song", duration: "30 sec", speed: "Fast" as const, quality: "Premium" as const, icon: <Sparkles className="h-5 w-5" />, features: ["Short preview generation", "Prompt iteration", "30-second MP3 output"], badge: "PREVIEW" },
    { id: "music-fal", name: "MiniMax Music 3", description: "Complete songs with lead vocals, backing harmonies, and full arrangements", duration: "Up to 5 min", speed: "Normal" as const, quality: "Premium" as const, icon: <Zap className="h-5 w-5" />, features: ["Lyrics and style prompts", "Full vocal and instrumental arrangement", "High-quality audio output"], badge: "VOCALS" },
    { id: "music-stable", name: "Stable Audio 2.5", description: "Instrumental music, production beds, and sound design", duration: "Up to 190 sec", speed: "Fast" as const, quality: "Premium" as const, icon: <Star className="h-5 w-5" />, features: ["Text-to-audio generation", "Long instrumental beds", "FAL queue status"], badge: "INSTRUMENTAL" },
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium mb-2 block">Select an AI model</label>
        <p className="text-xs text-muted-foreground mb-4">Only configured providers can be selected. Provider status is checked from the server.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {models.map((model) => {
          const status = availability[model.id];
          const isAvailable = status?.available === true;
          return <ModelCard key={model.id} {...model} isAvailable={isAvailable} providerLabel={status?.provider} unavailableReason={status?.reason} isSelected={selectedModel === model.id} onSelect={() => onModelSelect(model.id)} />;
        })}
      </div>
      <p role="status" className="text-xs text-muted-foreground">{loading ? "Checking configured providers…" : "Unavailable options are disabled until their provider is configured."}</p>
    </div>
  );
}
