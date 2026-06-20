import { GenreTemplateSelector, MusicGenreTemplate } from "./genre-templates/genre-template-selector";
import { MusicGenerationAdvancedParams } from "./genre-templates/advanced-music-params";
import { MusicGenerationSection } from "./genre-templates/music-generation-section";
import { TabsContent } from "../ui/tabs";
import { Card } from "../ui/card";

// Interfaz para las propiedades del wrapper del generador de música
interface MusicGeneratorWrapperProps {
  musicGenreTemplates: MusicGenreTemplate[];
  isGeneratingMusic: boolean;
  musicGenerationProgress: number;
  handleGenerateMusic: () => Promise<void>;
  musicPrompt: string;
  setMusicPrompt: (prompt: string) => void;
  musicTitle: string;
  setMusicTitle: (title: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  showAdvancedParams: boolean;
  setShowAdvancedParams: (show: boolean) => void;
  advancedModeType: 'standard' | 'continuation' | 'lyrics' | 'upload';
  setAdvancedModeType: (type: 'standard' | 'continuation' | 'lyrics' | 'upload') => void;
  selectedGenreTemplate: string;
  setSelectedGenreTemplate: (template: string) => void;
  advancedParams: MusicGenerationAdvancedParams;
  setAdvancedParams: (params: MusicGenerationAdvancedParams) => void;
  applyMusicTemplate: (templateId: string) => void;
  generatedMusicUrl: string | null;
  renderAudioPlayer: () => JSX.Element;
  renderRecentGenerations: () => JSX.Element;
}

/**
 * Componente wrapper para facilitar la integración de los componentes de generación de música
 */
export function MusicGeneratorWrapper({
  musicGenreTemplates,
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
  selectedGenreTemplate,
  setSelectedGenreTemplate,
  advancedParams,
  setAdvancedParams,
  applyMusicTemplate,
  generatedMusicUrl,
  renderAudioPlayer,
  renderRecentGenerations
}: MusicGeneratorWrapperProps) {
  return (
    <TabsContent value="generation">
      <Card className="backdrop-blur-sm border border-orange-500/10 overflow-hidden">
        <div className="p-4 md:p-6">
          <MusicGenerationSection
            musicGenreTemplates={musicGenreTemplates}
            isGeneratingMusic={isGeneratingMusic}
            musicGenerationProgress={musicGenerationProgress}
            handleGenerateMusic={handleGenerateMusic}
            musicPrompt={musicPrompt}
            setMusicPrompt={setMusicPrompt}
            musicTitle={musicTitle}
            setMusicTitle={setMusicTitle}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            showAdvancedParams={showAdvancedParams}
            setShowAdvancedParams={setShowAdvancedParams}
            advancedModeType={advancedModeType}
            setAdvancedModeType={setAdvancedModeType}
            selectedGenreTemplate={selectedGenreTemplate}
            setSelectedGenreTemplate={setSelectedGenreTemplate}
            advancedParams={advancedParams}
            setAdvancedParams={setAdvancedParams}
            applyMusicTemplate={applyMusicTemplate}
          />

          {/* Reproductor de audio si hay música generada */}
          {generatedMusicUrl && renderAudioPlayer()}

          {/* Generaciones recientes */}
          {renderRecentGenerations()}
        </div>
      </Card>
    </TabsContent>
  );
}