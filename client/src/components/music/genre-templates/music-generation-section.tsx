import { useState } from "react";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Button } from "../../ui/button";
import { Progress } from "../../ui/progress";
import { Alert, AlertDescription } from "../../ui/alert";
import { MusicGenreTemplate } from "./genre-data";
import { GenreTemplateSelector } from "./genre-template-selector";
import { 
  MusicGenerationAdvancedParams,
} from "./advanced-music-params";
import { ModelSelectorCards } from "../model-selector-cards";

import { 
  Sparkles, 
  Music, 
  Settings, 
  Loader2,
  PlusCircle,
  Info,
  AlertCircle,
  Lightbulb
} from "lucide-react";

interface MusicGenerationSectionProps {
  musicGenreTemplates: MusicGenreTemplate[];
  selectedGenreTemplate: string;
  setSelectedGenreTemplate: (id: string) => void;
  isGeneratingMusic: boolean;
  musicGenerationProgress: number;
  handleGenerateMusic: () => void;
  musicPrompt: string;
  setMusicPrompt: (prompt: string) => void;
  musicTitle: string;
  setMusicTitle: (title: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  showAdvancedParams: boolean;
  setShowAdvancedParams: (show: boolean) => void;
  advancedModeType: 'standard' | 'continuation' | 'lyrics' | 'upload';
  setAdvancedModeType: (mode: 'standard' | 'continuation' | 'lyrics' | 'upload') => void;
  advancedParams: MusicGenerationAdvancedParams;
  setAdvancedParams: (params: MusicGenerationAdvancedParams) => void;
  applyMusicTemplate: (templateId: string) => void;
}

/**
 * Componente para la sección principal de generación de música
 * Integra el selector de plantillas de género y los controles de generación
 */
export function MusicGenerationSection({
  musicGenreTemplates,
  selectedGenreTemplate,
  setSelectedGenreTemplate,
  isGeneratingMusic,
  musicGenerationProgress,
  handleGenerateMusic,
  musicPrompt,
  setMusicPrompt,
  musicTitle,
  setMusicTitle,
  selectedModel,
  setSelectedModel,
  showAdvancedParams,
  setShowAdvancedParams,
  advancedModeType,
  setAdvancedModeType,
  advancedParams,
  setAdvancedParams,
  applyMusicTemplate
}: MusicGenerationSectionProps) {
  const [expandTemplates, setExpandTemplates] = useState<boolean>(false);
  
  // Manejador para seleccionar un template de género musical
  const handleTemplateSelect = (templateId: string) => {
    setSelectedGenreTemplate(templateId);
    applyMusicTemplate(templateId);
  };
  
  return (
    <div className="space-y-4">
      {/* Genre selection panel */}
      <div className={`rounded-lg border bg-card ${expandTemplates ? 'p-4' : 'p-0 overflow-hidden'}`}>
        <div 
          className={`flex justify-between items-center cursor-pointer ${expandTemplates ? '' : 'p-4'}`}
          onClick={() => setExpandTemplates(!expandTemplates)}
        >
          <div className="flex items-center">
            <Music className="h-5 w-5 mr-2 text-primary" />
            <h3 className="font-medium">Music Genre Templates</h3>
          </div>
          <Button variant="ghost" size="icon" className="ml-2 h-8 w-8">
            <PlusCircle className={`h-4 w-4 transition-transform ${expandTemplates ? 'rotate-45' : ''}`} />
          </Button>
        </div>
        
        {expandTemplates && (
          <div className="mt-2">
            <GenreTemplateSelector
              templates={musicGenreTemplates}
              selectedTemplate={selectedGenreTemplate}
              onTemplateSelect={handleTemplateSelect}
            />
          </div>
        )}
      </div>
      
      {/* Main generation controls */}
      <div className="space-y-4">
        {/* Prompt text field with examples */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="musicPrompt">Describe your music</Label>
            <button
              type="button"
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={() => {
                const examples = [
                  "Upbeat electronic dance music with synth leads, driving bass, and energetic drums",
                  "Relaxing lo-fi hip hop with smooth piano, soft drums, and atmospheric sounds",
                  "Epic orchestral soundtrack with strings, brass, and powerful percussion",
                  "Acoustic indie folk with gentle guitar, warm vocals, and organic instruments",
                  "Tropical house with steel drums, marimba, and summer beach vibes"
                ];
                const randomExample = examples[Math.floor(Math.random() * examples.length)];
                setMusicPrompt(randomExample);
              }}
            >
              <Lightbulb className="h-3 w-3" />
              Use example
            </button>
          </div>
          <Textarea
            id="musicPrompt"
            placeholder="E.g.: Energetic electronic music with synthesizers, powerful bass, and danceable rhythm..."
            value={musicPrompt}
            onChange={(e) => setMusicPrompt(e.target.value)}
            className="min-h-[100px] resize-none"
            disabled={isGeneratingMusic}
            data-testid="input-music-prompt"
          />
          <p className="text-xs text-muted-foreground">
            💡 Tip: Include the genre, instruments, tempo, and mood for better results
          </p>
        </div>
        
        {/* Title field */}
        <div className="space-y-2">
          <Label htmlFor="musicTitle">Song title (optional)</Label>
          <Input
            id="musicTitle"
            placeholder="E.g.: My Epic Song, Summer Vibes, Midnight Dreams..."
            value={musicTitle}
            onChange={(e) => setMusicTitle(e.target.value)}
            disabled={isGeneratingMusic}
            data-testid="input-music-title"
          />
        </div>
        
        {/* Model selector - New card design */}
        <ModelSelectorCards
          selectedModel={selectedModel}
          onModelSelect={setSelectedModel}
        />
        
        {/* Advanced parameters toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant={showAdvancedParams ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAdvancedParams(!showAdvancedParams)}
              className="flex items-center"
            >
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              {showAdvancedParams ? "Hide Parameters" : "Show Parameters"}
            </Button>
          </div>
        </div>
        
        {/* Advanced parameters section */}
        {showAdvancedParams && (
          <div className="rounded-lg border p-4">
            <MusicGenerationAdvancedParams 
              params={advancedParams}
              setParams={setAdvancedParams}
              advancedModeType={advancedModeType}
              setAdvancedModeType={setAdvancedModeType}
            />
          </div>
        )}
        
        {/* Tips for better results */}
        <Alert variant="default" className="bg-muted/50">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Tips for better results:</strong> Include the musical genre, instruments, tempo, and any reference artists. The more detailed your description, the better results you'll get.
          </AlertDescription>
        </Alert>
        
        {/* Generation button and progress */}
        <div className="pt-4">
          {isGeneratingMusic ? (
            <div className="space-y-4 bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-lg border border-primary/20">
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <Sparkles className="h-6 w-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="font-medium">Generating your music...</p>
                <p className="text-sm text-muted-foreground">
                  {selectedModel === 'music-lyria3' ? 'Lyria 3 Pro — generating full song (~60 seconds)' :
                   selectedModel === 'music-fal' ? 'This will take ~10 seconds' : 
                   selectedModel === 'music-stable' ? 'This will take ~30 seconds' :
                   'This may take up to 2 minutes'}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium text-primary">{musicGenerationProgress}%</span>
                </div>
                <Progress value={musicGenerationProgress} className="h-3" />
              </div>
            </div>
          ) : (
            <Button 
              onClick={handleGenerateMusic} 
              className="w-full py-7 text-lg font-semibold group bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300"
              disabled={!musicPrompt.trim()}
              data-testid="button-generate-music"
            >
              <Sparkles className="h-6 w-6 mr-2 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" />
              Generate Music with AI
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}