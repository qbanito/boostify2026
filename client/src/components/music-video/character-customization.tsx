import { useState } from "react";
import { logger } from "../../lib/logger";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";
import { Loader2, Upload, Trash2 } from "lucide-react";
import * as fal from "@fal-ai/serverless-client";
import { useToast } from "../../hooks/use-toast";

interface CharacterCustomizationProps {
  onCharacterGenerated: (imageUrl: string) => void;
}

export function CharacterCustomization({ onCharacterGenerated }: CharacterCustomizationProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [characterStyle, setCharacterStyle] = useState({
    gender: "",
    age: "25-35",
    style: "Realista",
    ethnicity: "",
    clothing: "Casual",
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "La imagen debe ser menor a 5MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateCharacter = async () => {
    setIsGenerating(true);
    try {
      const prompt = `Professional portrait photo of a ${characterStyle.gender} musician, 
        ${characterStyle.age} years old, ${characterStyle.ethnicity} ethnicity, 
        wearing ${characterStyle.clothing} clothing. ${characterStyle.style} style, 
        high-end DSLR camera shot, studio lighting, 4k quality`;

      const result = await fal.subscribe("fal-ai/nano-banana-2", {
        input: {
          prompt,
          negative_prompt: "deformed, unrealistic, low quality, blurry",
          image_size: "portrait"
        },
      });

      if (result?.images?.[0]?.url) {
        onCharacterGenerated(result.images[0].url);
        toast({
          title: "Éxito",
          description: "Personaje generado correctamente",
        });
      }
    } catch (error) {
      logger.error("Error generating character:", error);
      toast({
        title: "Error",
        description: "Error al generar el personaje",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Personalización del Artista</h2>
            <p className="text-sm text-muted-foreground">
              Define el aspecto del artista principal
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Género</Label>
            <Select
              value={characterStyle.gender}
              onValueChange={(value) => setCharacterStyle(prev => ({ ...prev, gender: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona género" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="female">Femenino</SelectItem>
                <SelectItem value="non-binary">No binario</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Rango de Edad</Label>
            <Select
              value={characterStyle.age}
              onValueChange={(value) => setCharacterStyle(prev => ({ ...prev, age: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona rango de edad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="18-25">18-25</SelectItem>
                <SelectItem value="25-35">25-35</SelectItem>
                <SelectItem value="35-45">35-45</SelectItem>
                <SelectItem value="45+">45+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Estilo Visual</Label>
            <Select
              value={characterStyle.style}
              onValueChange={(value) => setCharacterStyle(prev => ({ ...prev, style: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona estilo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Realista">Realista</SelectItem>
                <SelectItem value="Estilizado">Estilizado</SelectItem>
                <SelectItem value="Artístico">Artístico</SelectItem>
                <SelectItem value="Vintage">Vintage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Vestuario</Label>
            <Select
              value={characterStyle.clothing}
              onValueChange={(value) => setCharacterStyle(prev => ({ ...prev, clothing: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona vestuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Casual">Casual</SelectItem>
                <SelectItem value="Formal">Formal</SelectItem>
                <SelectItem value="Alternativo">Alternativo</SelectItem>
                <SelectItem value="Urbano">Urbano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Imagen de Referencia (Opcional)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            {referenceImage && (
              <div className="relative aspect-square w-full max-w-[200px] rounded-lg overflow-hidden">
                <img
                  src={referenceImage}
                  alt="Reference"
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => setReferenceImage(null)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={generateCharacter}
          disabled={isGenerating || !characterStyle.gender}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando Personaje...
            </>
          ) : (
            "Generar Personaje"
          )}
        </Button>
      </div>
    </Card>
  );
}
