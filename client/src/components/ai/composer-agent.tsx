// src/components/ai/composer-agent.tsx
import { logger } from "@/lib/logger";
import { Music2, Download, Save } from "lucide-react";
import { BaseAgent, type AgentAction, type AgentTheme } from "./base-agent";
import { falService } from "../../lib/api/fal-service";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";
import { useState } from "react";
import { ProgressIndicator } from "./progress-indicator";
import { geminiAgentsService } from "../../lib/api/gemini-agents-service";
import { aiAgentsFirestore } from "../../lib/services/ai-agents-firestore";
import { Button } from "../ui/button";

interface Step {
  message: string;
  timestamp: Date;
}

export function ComposerAgent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generatedMusicUrl, setGeneratedMusicUrl] = useState<string | null>(null);
  const [generatedLyrics, setGeneratedLyrics] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);

  const theme: AgentTheme = {
    gradient: "from-purple-600 to-blue-600",
    iconColor: "text-white",
    accentColor: "#7C3AED",
    personality: "🎵 Creative Maestro",
  };

  const simulateThinking = async (customSteps?: string[]) => {
    setIsThinking(true);
    setProgress(0);
    setSteps([]);

    const simulatedSteps = customSteps || [
      "Analyzing musical parameters...",
      "Generating composition structure...",
      "Applying musical theory...",
      "Finalizing arrangement...",
      "Preparing response...",
    ];

    for (let i = 0; i < simulatedSteps.length; i++) {
      setSteps(prev => [...prev, { message: simulatedSteps[i], timestamp: new Date() }]);
      setProgress((i + 1) * 20);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsThinking(false);
  };

  const generateLyrics = async (params: any): Promise<string> => {
    await simulateThinking([
      "Understanding theme and mood...",
      "Crafting lyrical structure...",
      "Generating verses with Gemini AI...",
      "Adding chorus and bridges...",
      "Finalizing professional lyrics..."
    ]);

    try {
      const lyrics = await geminiAgentsService.generateMusicLyrics({
        genre: params.genre,
        mood: params.mood,
        theme: params.theme,
        language: params.language,
        structure: params.structure
      });

      if (!lyrics) {
        throw new Error('No lyrics generated');
      }
      
      return lyrics;
    } catch (error) {
      logger.error('Error generating lyrics:', error);
      throw new Error('No se pudo generar la letra. Por favor, intenta de nuevo.');
    }
  };

  const saveToFirestore = async (data: {
    lyrics: string;
    musicUrl?: string;
    params: any;
  }) => {
    if (!user) return;

    try {
      // Save lyrics using centralized service
      await aiAgentsFirestore.saveComposerLyrics(
        user.uid,
        data.lyrics,
        {
          genre: data.params.genre,
          mood: data.params.mood,
          theme: data.params.theme,
          language: data.params.language,
          structure: data.params.structure
        }
      );

      logger.info('✅ Composer lyrics saved to Firestore with Gemini integration');
    } catch (error) {
      logger.error('Error saving to Firestore:', error);
      // Don't throw - allow the music generation to continue even if save fails
    }
  };

  const createMusicPrompt = (params: any, lyrics: string) => {
    // Extraer solo la primera estrofa y el coro para mantener el prompt corto
    const firstVerseAndChorus = lyrics.split('\n\n').slice(0, 2).join('\n\n');

    return `##
Genre: ${params.genre}
Mood: ${params.mood}
Tempo: ${params.tempo}
${firstVerseAndChorus}
##`;
  };

  const actions: AgentAction[] = [
    {
      name: "Generate musical composition",
      description: "Create a new composition using AI",
      parameters: [
        {
          name: "genre",
          type: "select",
          label: "Musical Genre",
          description: "Select the base musical genre for the composition",
          options: [
            { value: "pop", label: "Pop" },
            { value: "rock", label: "Rock" },
            { value: "hiphop", label: "Hip Hop" },
            { value: "electronic", label: "Electronic" },
            { value: "classical", label: "Classical" },
            { value: "jazz", label: "Jazz" },
          ],
          defaultValue: "pop",
        },
        {
          name: "tempo",
          type: "number",
          label: "Tempo (BPM)",
          description: "Speed of the composition in beats per minute",
          defaultValue: "120",
        },
        {
          name: "mood",
          type: "select",
          label: "Mood",
          description: "Define the emotional character of the composition",
          options: [
            { value: "happy", label: "Happy" },
            { value: "sad", label: "Melancholic" },
            { value: "energetic", label: "Energetic" },
            { value: "calm", label: "Calm" },
            { value: "dark", label: "Dark" },
          ],
          defaultValue: "energetic",
        },
        {
          name: "theme",
          type: "text",
          label: "Theme/Topic",
          description: "Main theme or topic for the lyrics",
          defaultValue: "love",
        },
        {
          name: "language",
          type: "select",
          label: "Language",
          description: "Language for the lyrics",
          options: [
            { value: "english", label: "English" },
            { value: "spanish", label: "Spanish" },
          ],
          defaultValue: "english",
        },
        {
          name: "structure",
          type: "select",
          label: "Song Structure",
          description: "Structure of the composition",
          options: [
            { value: "verse-chorus", label: "Verse-Chorus" },
            { value: "aaba", label: "AABA" },
            { value: "through-composed", label: "Through-composed" },
          ],
          defaultValue: "verse-chorus",
        },
      ],
      action: async (params) => {
        if (!user) {
          toast({
            title: "Authentication Required",
            description: "Please log in to use the AI Composer.",
            variant: "destructive",
          });
          return;
        }

        try {
          setGeneratedMusicUrl(null);
          setGeneratedLyrics(null);

          // Verificar parámetros
          if (!params.genre || !params.tempo || !params.mood || !params.theme || !params.language || !params.structure) {
            throw new Error('Missing required parameters');
          }

          // Primero generamos la letra
          logger.info('Generando letras...');
          const lyrics = await generateLyrics(params);
          setGeneratedLyrics(lyrics);

          // Luego generamos la música basada en la letra
          await simulateThinking([
            "Analyzing generated lyrics...",
            "Composing melody to match lyrics...",
            "Adding harmonies and arrangement...",
            "Processing final audio..."
          ]);

          const musicPrompt = createMusicPrompt(params, lyrics);
          logger.info('Prompt para música:', musicPrompt);

          const response = await falService.generateMusic(
            {
              genre: params.genre,
              tempo: parseInt(params.tempo.toString()),
              mood: params.mood,
              theme: params.theme,
              language: params.language,
              structure: params.structure
            },
            user?.uid || 'anonymous',
            musicPrompt
          );

          logger.info('Respuesta de FAL.AI:', response);

          if (response?.musicUrl) {
            setGeneratedMusicUrl(response.musicUrl);
            
            // Guardar automáticamente en Firestore
            await saveToFirestore({
              lyrics,
              musicUrl: response.musicUrl,
              params
            });
            
            toast({
              title: "Content Generated & Saved",
              description: "Your lyrics and musical composition have been created and saved successfully.",
            });
          } else {
            throw new Error('No music URL received in response');
          }

        } catch (error) {
          logger.error("Error in composition process:", error);
          toast({
            title: "Error",
            description: "Failed to complete the composition process. Please try again.",
            variant: "destructive"
          });

          setIsThinking(false);
          setProgress(0);
          setSteps([]);
        }
      }
    }
  ];

  return (
    <BaseAgent
      name="AI Music Composer"
      description="Your creative companion for musical composition"
      icon={Music2}
      actions={actions}
      theme={theme}
      helpText="I'm your Creative Maestro. With years of experience in composition and arrangements, I'll help bring your musical ideas to life using my advanced artificial intelligence. Together, we'll create masterpieces!"
    >
      {(isThinking || steps.length > 0) && (
        <ProgressIndicator
          steps={steps}
          progress={progress}
          isThinking={isThinking}
          isComplete={progress === 100}
        />
      )}
      {generatedLyrics && (
        <div className="mt-4 p-6 bg-black/20 backdrop-blur rounded-lg border border-purple-500/20">
          <h3 className="text-xl font-semibold mb-4 text-purple-400">Generated Lyrics</h3>
          <div className="prose prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm font-mono bg-transparent">{generatedLyrics}</pre>
          </div>
        </div>
      )}
      {generatedMusicUrl && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Generated Music</h3>
          <audio controls src={generatedMusicUrl} className="w-full mb-2">
            Your browser does not support the audio element.
          </audio>
          <a
            href={generatedMusicUrl}
            download="generated_music.mp3"
            className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Download Music
          </a>
        </div>
      )}
    </BaseAgent>
  );
}