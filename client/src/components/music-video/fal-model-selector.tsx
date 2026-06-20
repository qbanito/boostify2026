import { useState } from "react";
import { logger } from "../../lib/logger";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { FAL_VIDEO_MODELS } from "../../lib/api/fal-video-service";
import { Film, Sparkles, Zap } from "lucide-react";

interface FalModelSelectorProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

export function FalModelSelector({ selectedModelId, onModelChange, disabled = false }: FalModelSelectorProps) {
  // Ordenar modelos por calidad (premium primero)
  const models = Object.entries(FAL_VIDEO_MODELS);
  
  const premiumModels = models.filter(([_, model]) => 
    model.pricing.includes('Premium') || model.id.includes('veo') || model.id.includes('sora')
  );
  
  const klingModels = models.filter(([_, model]) => 
    model.id.includes('kling')
  );
  
  const otherModels = models.filter(([key, model]) => 
    !model.pricing.includes('Premium') && 
    !model.id.includes('veo') && 
    !model.id.includes('sora') &&
    !model.id.includes('kling')
  );

  const selectedModel = Object.values(FAL_VIDEO_MODELS).find(m => m.id === selectedModelId);

  return (
    <div className="space-y-4" data-testid="fal-model-selector">
      <div>
        <Label htmlFor="fal-model" className="text-base font-semibold flex items-center gap-2">
          <Film className="w-5 h-5" />
          Video Generation Model
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          Select the AI model to generate your music videos
        </p>
      </div>

      <Select value={selectedModelId} onValueChange={onModelChange} disabled={disabled}>
        <SelectTrigger 
          id="fal-model" 
          className="w-full"
          data-testid="select-fal-model"
        >
          <SelectValue placeholder="Select a video model" />
        </SelectTrigger>
        <SelectContent className="max-h-[400px]">
          {/* Modelos Premium */}
          {premiumModels.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Maximum Quality - Premium
              </div>
              {premiumModels.map(([key, model]) => (
                <SelectItem 
                  key={key} 
                  value={model.id}
                  data-testid={`model-${key.toLowerCase()}`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="font-medium">{model.name}</span>
                    <Badge variant="default" className="ml-2 bg-gradient-to-r from-purple-500 to-pink-500">
                      Premium
                    </Badge>
                  </div>
                </SelectItem>
              ))}
              <div className="my-1 border-t" />
            </>
          )}

          {/* Modelos KLING */}
          {klingModels.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" />
                KLING Series - Cinematic
              </div>
              {klingModels.map(([key, model]) => (
                <SelectItem 
                  key={key} 
                  value={model.id}
                  data-testid={`model-${key.toLowerCase()}`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="font-medium">{model.name}</span>
                    <Badge variant="secondary" className="ml-2">
                      {model.pricing}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
              <div className="my-1 border-t" />
            </>
          )}

          {/* Otros modelos */}
          {otherModels.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Film className="w-3 h-3" />
                Other Advanced Models
              </div>
              {otherModels.map(([key, model]) => (
                <SelectItem 
                  key={key} 
                  value={model.id}
                  data-testid={`model-${key.toLowerCase()}`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="font-medium">{model.name}</span>
                    <Badge variant="outline" className="ml-2">
                      {model.pricing}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>

      {/* Información del modelo seleccionado */}
      {selectedModel && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {selectedModel.name}
            </CardTitle>
            <CardDescription className="text-xs">
              {selectedModel.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <Badge variant="outline" className="text-xs">
                {selectedModel.type}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max duration:</span>
              <span className="font-medium">{selectedModel.maxDuration}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pricing:</span>
              <span className="font-medium">{selectedModel.pricing}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
