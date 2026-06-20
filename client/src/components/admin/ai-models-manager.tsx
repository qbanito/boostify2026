import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Slider } from "../ui/slider";
import { useAIModelsStore } from "../../store/ai-models-store";
import { Brain, Image as ImageIcon } from "lucide-react";
import type { TextModel, ImageModel } from "../../types/ai-models";
import { useIsMobile } from "../../hooks/use-mobile";

export function AIModelsManager() {
  const {
    textModels,
    imageModels,
    defaultTextModel,
    defaultImageModel,
    updateTextModel,
    updateImageModel,
    setDefaultTextModel,
    setDefaultImageModel,
    toggleModelStatus,
  } = useAIModelsStore();
  
  const isMobile = useIsMobile();

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="p-2 md:p-3 bg-orange-500/10 rounded-lg">
          <Brain className="h-5 w-5 md:h-6 md:w-6 text-orange-500" />
        </div>
        <div>
          <h2 className="text-lg md:text-2xl font-semibold">AI Models Configuration</h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Manage and configure AI models for text and image generation
          </p>
        </div>
      </div>

      <Tabs defaultValue="text" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="text">Text Models</TabsTrigger>
          <TabsTrigger value="image">Image Models</TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <div className="space-y-4 md:space-y-6">
            {textModels.map((model) => (
              <Card key={model.id} className="p-3 md:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={model.enabled}
                      onCheckedChange={() => toggleModelStatus(model.id, 'text')}
                    />
                    <div>
                      <h3 className="font-medium text-sm md:text-base">{model.name}</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {model.provider.toUpperCase()} - {model.modelId}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    onClick={() => setDefaultTextModel(model.id)}
                    disabled={!model.enabled}
                    className={defaultTextModel === model.id ? "bg-orange-500/10" : ""}
                  >
                    {defaultTextModel === model.id ? "Default Model" : "Set as Default"}
                  </Button>
                </div>

                <div className="grid gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs md:text-sm">Temperature</Label>
                    <Slider
                      value={[model.temperature]}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={([value]) =>
                        updateTextModel({ ...model, temperature: value })
                      }
                      disabled={!model.enabled}
                    />
                    <p className="text-xs text-right text-muted-foreground">
                      {model.temperature.toFixed(1)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs md:text-sm">Max Tokens</Label>
                    <Input
                      type="number"
                      value={model.maxTokens}
                      onChange={(e) =>
                        updateTextModel({
                          ...model,
                          maxTokens: parseInt(e.target.value),
                        })
                      }
                      disabled={!model.enabled}
                      className="text-xs md:text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs md:text-sm">API Key (Optional)</Label>
                    <Input
                      type="password"
                      value={model.apiKey || ""}
                      onChange={(e) =>
                        updateTextModel({ ...model, apiKey: e.target.value })
                      }
                      placeholder="Enter API key if different from default"
                      disabled={!model.enabled}
                      className="text-xs md:text-sm"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="image">
          <div className="space-y-4 md:space-y-6">
            {imageModels.map((model) => (
              <Card key={model.id} className="p-3 md:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={model.enabled}
                      onCheckedChange={() => toggleModelStatus(model.id, 'image')}
                    />
                    <div>
                      <h3 className="font-medium text-sm md:text-base">{model.name}</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {model.provider.toUpperCase()} - {model.modelId}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    onClick={() => setDefaultImageModel(model.id)}
                    disabled={!model.enabled}
                    className={defaultImageModel === model.id ? "bg-orange-500/10" : ""}
                  >
                    {defaultImageModel === model.id ? "Default Model" : "Set as Default"}
                  </Button>
                </div>

                <div className="grid gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs md:text-sm">Max Resolution</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Width</Label>
                        <Input
                          type="number"
                          value={model.maxResolution.width}
                          onChange={(e) =>
                            updateImageModel({
                              ...model,
                              maxResolution: {
                                ...model.maxResolution,
                                width: parseInt(e.target.value),
                              },
                            })
                          }
                          placeholder="Width"
                          disabled={!model.enabled}
                          className="text-xs md:text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Height</Label>
                        <Input
                          type="number"
                          value={model.maxResolution.height}
                          onChange={(e) =>
                            updateImageModel({
                              ...model,
                              maxResolution: {
                                ...model.maxResolution,
                                height: parseInt(e.target.value),
                              },
                            })
                          }
                          placeholder="Height"
                          disabled={!model.enabled}
                          className="text-xs md:text-sm mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs md:text-sm">API Key (Optional)</Label>
                    <Input
                      type="password"
                      value={model.apiKey || ""}
                      onChange={(e) =>
                        updateImageModel({ ...model, apiKey: e.target.value })
                      }
                      placeholder="Enter API key if different from default"
                      disabled={!model.enabled}
                      className="text-xs md:text-sm"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}