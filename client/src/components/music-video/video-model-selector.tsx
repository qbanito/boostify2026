import { useState } from "react";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Film, Play, Loader2, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { FAL_VIDEO_MODELS, getRecommendedModels } from "../../lib/api/fal-video-service";
import { Alert, AlertDescription } from "../ui/alert";

interface VideoModelSelectorProps {
  onGenerateVideo: (modelId: string, sceneId?: number) => Promise<void>;
  onGenerateAllVideos: (modelId: string) => Promise<void>;
  isGenerating: boolean;
  scenesCount: number;
  hasImages: boolean;
  selectedSceneId?: number | null;
}

export function VideoModelSelector({
  onGenerateVideo,
  onGenerateAllVideos,
  isGenerating,
  scenesCount,
  hasImages,
  selectedSceneId
}: VideoModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState(FAL_VIDEO_MODELS.KLING_V3_PRO_I2V.id);
  
  // Get recommended models for image-to-video
  const recommendedModels = getRecommendedModels('image-to-video');
  
  const currentModel = Object.values(FAL_VIDEO_MODELS).find(m => m.id === selectedModel);

  return (
    <Card className="p-6 space-y-4 border-2 border-primary/20 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20">
      <div className="flex items-center gap-2">
        <Film className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Video Generation</h3>
        <Badge variant="secondary" className="ml-auto">
          {scenesCount} scenes
        </Badge>
      </div>

      {hasImages && (
        <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            ✓ All images generated! You can now create videos
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="model-select" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Select Video Model
          </Label>
          <Select 
            value={selectedModel} 
            onValueChange={setSelectedModel}
            disabled={!hasImages}
          >
            <SelectTrigger id="model-select" className="w-full">
              <SelectValue placeholder="Choose a video model" />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              {recommendedModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex flex-col items-start">
                    <div className="font-medium">{model.name}</div>
                    <div className="text-xs text-muted-foreground">{model.description}</div>
                    <div className="text-xs text-primary mt-1">
                      {model.pricing} • {model.maxDuration}s max
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentModel && hasImages && (
          <div className="p-3 bg-white/50 dark:bg-black/20 rounded-md border">
            <p className="text-sm font-medium mb-1">{currentModel.name}</p>
            <p className="text-xs text-muted-foreground mb-2">{currentModel.description}</p>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline">{currentModel.pricing}</Badge>
              <Badge variant="outline">{currentModel.maxDuration}s max</Badge>
              <Badge variant="outline">{currentModel.type}</Badge>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {selectedSceneId !== null && selectedSceneId !== undefined && (
            <Button
              onClick={() => onGenerateVideo(selectedModel, selectedSceneId)}
              disabled={isGenerating || !hasImages}
              className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
              size="lg"
              data-testid="button-generate-selected-video"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Generate Video for Scene #{selectedSceneId}
                </>
              )}
            </Button>
          )}
          <Button
            onClick={() => onGenerateAllVideos(selectedModel)}
            disabled={isGenerating || !hasImages || scenesCount === 0}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
            data-testid="button-generate-all-videos"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Film className="mr-2 h-4 w-4" />
                Generate All Videos ({scenesCount})
              </>
            )}
          </Button>
        </div>

        {!hasImages && (
          <Alert variant="destructive" className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Generate images first before creating videos
            </AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground text-center">
          💡 Click on individual images in the timeline to generate video for that scene only
        </p>
      </div>
    </Card>
  );
}
