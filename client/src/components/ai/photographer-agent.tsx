import { Camera, Upload, Download, Image as ImageIcon } from "lucide-react";
import { logger } from "@/lib/logger";
import { BaseAgent, type AgentAction, type AgentTheme } from "./base-agent";
import { useState } from "react";
import { ProgressIndicator } from "./progress-indicator";
import { geminiAgentsService } from "../../lib/api/gemini-agents-service";
import { aiAgentsFirestore } from "../../lib/services/ai-agents-firestore";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface Step {
  message: string;
  timestamp: Date;
}

export function PhotographerAgent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isThinking, setIsThinking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);

  const theme: AgentTheme = {
    gradient: "from-cyan-500 to-blue-600",
    iconColor: "text-white",
    accentColor: "#06B6D4",
    personality: "📸 Studio Photographer",
  };

  const simulateThinking = async (customSteps?: string[]) => {
    setIsThinking(true);
    setProgress(0);
    setSteps([]);

    const simulatedSteps = customSteps || [
      "Analyzing reference image with AI...",
      "Understanding artistic direction...",
      "Composing professional shot...",
      "Applying studio lighting techniques...",
      "Finalizing high-quality image...",
    ];

    for (let i = 0; i < simulatedSteps.length; i++) {
      setSteps((prev) => [...prev, { message: simulatedSteps[i], timestamp: new Date() }]);
      setProgress((i + 1) * 20);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    setIsThinking(false);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setReferenceFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      toast({
        title: "Reference Image Uploaded",
        description: "Your reference image has been loaded successfully.",
      });
    }
  };

  const convertImageToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix to get just the base64 data
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const saveToFirestore = async (data: {
    imageUrl: string;
    params: any;
  }) => {
    if (!user) return;

    try {
      await aiAgentsFirestore.saveResult({
        userId: user.uid,
        agentType: 'photographer' as any,
        content: data.imageUrl,
        params: data.params,
        timestamp: null,
        resultType: 'cover_art',
        style: data.params.style,
        mood: data.params.mood
      } as any);

      logger.info('✅ Photographer image saved to Firestore with Gemini integration');
    } catch (error) {
      logger.error('Error saving to Firestore:', error);
      // Don't throw - continue even if save fails
    }
  };

  const actions: AgentAction[] = [
    {
      name: "Generate Cover Art",
      description: "Create professional album/single cover art with AI",
      parameters: [
        {
          name: "artistName",
          type: "text",
          label: "Artist Name",
          description: "Name of the artist or band",
          defaultValue: "My Artist",
        },
        {
          name: "albumTitle",
          type: "text",
          label: "Album/Single Title",
          description: "Title of the album or single",
          defaultValue: "New Release",
        },
        {
          name: "style",
          type: "select",
          label: "Photography Style",
          description: "Professional photography style for the cover",
          options: [
            { value: "studio-professional", label: "Studio Professional" },
            { value: "editorial-fashion", label: "Editorial Fashion" },
            { value: "vintage-film", label: "Vintage Film" },
            { value: "modern-minimalist", label: "Modern Minimalist" },
            { value: "artistic-conceptual", label: "Artistic Conceptual" },
            { value: "street-urban", label: "Street Urban" },
            { value: "dramatic-noir", label: "Dramatic Noir" },
            { value: "colorful-vibrant", label: "Colorful Vibrant" },
          ],
          defaultValue: "studio-professional",
        },
        {
          name: "mood",
          type: "select",
          label: "Mood/Atmosphere",
          description: "Emotional atmosphere of the image",
          options: [
            { value: "powerful", label: "Powerful & Bold" },
            { value: "elegant", label: "Elegant & Sophisticated" },
            { value: "mysterious", label: "Mysterious & Moody" },
            { value: "energetic", label: "Energetic & Dynamic" },
            { value: "peaceful", label: "Peaceful & Serene" },
            { value: "edgy", label: "Edgy & Alternative" },
          ],
          defaultValue: "powerful",
        },
        {
          name: "colorScheme",
          type: "select",
          label: "Color Scheme",
          description: "Dominant color palette",
          options: [
            { value: "monochrome", label: "Black & White" },
            { value: "warm", label: "Warm Tones" },
            { value: "cool", label: "Cool Tones" },
            { value: "neon", label: "Neon & Vibrant" },
            { value: "pastel", label: "Soft Pastels" },
            { value: "natural", label: "Natural Colors" },
          ],
          defaultValue: "natural",
        },
      ],
      action: async (params) => {
        if (!user) {
          toast({
            title: "Authentication Required",
            description: "Please log in to use the Photographer AI.",
            variant: "destructive",
          });
          return;
        }

        try {
          setGeneratedImage(null);

          await simulateThinking([
            "Analyzing creative brief...",
            "Setting up virtual studio...",
            "Composing the perfect shot with AI...",
            "Applying professional lighting and effects...",
            "Rendering high-quality cover art...",
          ]);

          // Create detailed prompt for image generation
          let prompt = `Professional album cover photography for "${params.albumTitle}" by ${params.artistName}. `;
          
          // Add style description
          const styleDescriptions: Record<string, string> = {
            "studio-professional": "Studio portrait with professional lighting, clean background, magazine quality",
            "editorial-fashion": "High-fashion editorial style, dramatic poses, runway-inspired composition",
            "vintage-film": "Vintage film photography aesthetic, grain texture, retro colors, nostalgic feel",
            "modern-minimalist": "Minimalist modern design, clean lines, negative space, sophisticated simplicity",
            "artistic-conceptual": "Artistic conceptual photography, creative vision, unique perspective, thought-provoking",
            "street-urban": "Urban street photography, gritty atmosphere, authentic city vibes, documentary style",
            "dramatic-noir": "Film noir aesthetic, dramatic shadows, high contrast, cinematic mood",
            "colorful-vibrant": "Vibrant colors, energetic composition, bold visual impact, saturated tones",
          };

          prompt += styleDescriptions[params.style] + ". ";

          // Add mood description
          const moodDescriptions: Record<string, string> = {
            "powerful": "Powerful and bold atmosphere, commanding presence, strong impact",
            "elegant": "Elegant and sophisticated mood, refined aesthetics, graceful composition",
            "mysterious": "Mysterious and moody ambiance, enigmatic feel, atmospheric depth",
            "energetic": "Energetic and dynamic vibe, movement and action, alive with energy",
            "peaceful": "Peaceful and serene atmosphere, calm tranquility, harmonious balance",
            "edgy": "Edgy and alternative style, rebellious spirit, unconventional approach",
          };

          prompt += moodDescriptions[params.mood] + ". ";

          // Add color scheme
          const colorDescriptions: Record<string, string> = {
            "monochrome": "Black and white color scheme, timeless monochrome aesthetic",
            "warm": "Warm color tones, golden hour lighting, cozy atmosphere",
            "cool": "Cool color palette, blue and teal tones, calm coolness",
            "neon": "Neon colors, vibrant electric hues, cyberpunk inspired",
            "pastel": "Soft pastel colors, gentle tones, dreamy aesthetic",
            "natural": "Natural color palette, authentic tones, organic feel",
          };

          prompt += colorDescriptions[params.colorScheme] + ". ";

          // Add reference image context if available
          if (referenceFile) {
            prompt += "Using reference image as inspiration for composition and style. ";
          }

          prompt += "High resolution, professional quality, album cover worthy, suitable for music industry standards.";

          logger.info('Image generation prompt:', prompt);

          // Generate image using Gemini 2.5 Flash Image (Nano Banana)
          const imageUrl = await geminiAgentsService.generateImage({
            prompt,
            referenceImage: referenceFile ? await convertImageToBase64(referenceFile) : undefined,
            style: params.style,
            mood: params.mood,
          });

          if (imageUrl) {
            setGeneratedImage(imageUrl);

            // Save to Firestore
            await saveToFirestore({
              imageUrl,
              params: {
                artistName: params.artistName,
                albumTitle: params.albumTitle,
                style: params.style,
                mood: params.mood,
                colorScheme: params.colorScheme,
                hasReference: !!referenceFile,
              },
            });

            toast({
              title: "Cover Art Generated & Saved",
              description: "Your professional album cover has been created successfully.",
            });
          } else {
            throw new Error('No image generated');
          }
        } catch (error) {
          logger.error("Error generating cover art:", error);
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to generate cover art. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsThinking(false);
        }
      },
    },
  ];

  return (
    <BaseAgent
      name="AI Photographer"
      description="Professional cover art and promotional images for your music"
      icon={Camera}
      actions={actions}
      theme={theme}
      helpText="I'm your Studio Photographer. With expertise in professional photography and AI-powered image generation, I'll create stunning album covers and promotional images that capture your artistic vision."
    >
      {/* Reference Image Upload Section */}
      <Card className="mb-6 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border-cyan-500/20">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Upload className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">Reference Image (Optional)</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Upload a reference image to inspire the style and composition of your cover art
          </p>
          
          <div className="flex flex-col gap-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="reference-upload"
              data-testid="input-reference-image"
            />
            <label htmlFor="reference-upload">
              <Button
                type="button"
                variant="outline"
                className="w-full cursor-pointer border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-500/10"
                onClick={() => document.getElementById('reference-upload')?.click()}
                data-testid="button-upload-reference"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Choose Reference Image
              </Button>
            </label>

            {referenceImage && (
              <div className="relative rounded-lg overflow-hidden border-2 border-cyan-500/30">
                <img
                  src={referenceImage}
                  alt="Reference"
                  className="w-full h-48 object-cover"
                  data-testid="img-reference-preview"
                />
                <div className="absolute top-2 right-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setReferenceImage(null);
                      setReferenceFile(null);
                    }}
                    data-testid="button-remove-reference"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Progress Indicator */}
      {(isThinking || steps.length > 0) && (
        <ProgressIndicator
          steps={steps}
          progress={progress}
          isThinking={isThinking}
          isComplete={progress === 100}
        />
      )}

      {/* Generated Image Display */}
      {generatedImage && (
        <Card className="mt-6 bg-black/40 backdrop-blur border-cyan-500/20">
          <div className="p-6">
            <h3 className="text-xl font-semibold mb-4 text-cyan-400">Generated Cover Art</h3>
            <div className="relative rounded-lg overflow-hidden border-2 border-cyan-500/30 mb-4">
              <img
                src={generatedImage}
                alt="Generated Cover Art"
                className="w-full h-auto"
                data-testid="img-generated-cover"
              />
            </div>
            <div className="flex gap-2">
              <a
                href={generatedImage}
                download="album-cover.png"
                className="flex-1"
              >
                <Button
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                  data-testid="button-download-cover"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Cover Art
                </Button>
              </a>
            </div>
          </div>
        </Card>
      )}
    </BaseAgent>
  );
}
