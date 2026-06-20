import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useToast } from "../../hooks/use-toast";
import { RefreshCw, Upload, Camera, Sparkles, Wand2, X } from "lucide-react";

/**
 * EffectsComponent
 * A simple placeholder component for Kling Effects
 */
export function EffectsComponent() {
  const [image, setImage] = useState<string>("");
  const [effect, setEffect] = useState<"squish" | "expansion">("squish");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file is an image
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Tipo de archivo inválido",
        description: "Por favor, sube solo archivos de imagen (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Read and convert to data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateEffect = () => {
    if (!image) {
      toast({
        title: "Imagen requerida",
        description: "Por favor, sube una imagen para continuar",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      toast({
        title: "Funcionalidad en desarrollo",
        description: "La generación de efectos estará disponible próximamente",
      });
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="effectImage" className="text-sm font-medium">
          Imagen para aplicar efecto
        </Label>
        
        <div className="aspect-square relative bg-muted/40 rounded-md overflow-hidden border border-input flex items-center justify-center">
          {image ? (
            <>
              <img 
                src={image} 
                alt="Imagen para efecto" 
                className="w-full h-full object-cover"
              />
              <Button 
                variant="destructive" 
                size="icon" 
                className="absolute top-2 right-2 h-8 w-8 opacity-80 hover:opacity-100"
                onClick={() => setImage("")}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="text-center p-4">
              <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Sube una imagen para aplicar el efecto</p>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <Label 
            htmlFor="effectImage" 
            className="cursor-pointer inline-flex items-center justify-center gap-1 text-sm text-primary py-1 px-2 rounded hover:bg-primary/10"
          >
            <Upload className="h-3 w-3" />
            {image ? "Cambiar" : "Subir"} imagen
          </Label>
          <Input 
            id="effectImage" 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Selecciona el efecto
        </Label>
        
        <RadioGroup value={effect} onValueChange={(value: any) => setEffect(value)} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Label
            htmlFor="effect-squish"
            className={`flex items-center justify-between rounded-md border-2 p-4 ${
              effect === "squish" ? "border-primary bg-primary/5" : "border-muted"
            } cursor-pointer`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className={`h-5 w-5 ${effect === "squish" ? "text-primary" : "text-muted-foreground"}`} />
              <div className="space-y-1">
                <p className={`text-sm font-medium ${effect === "squish" ? "text-primary" : ""}`}>Efecto Squish</p>
                <p className="text-xs text-muted-foreground">Compresión y expansión con rebote</p>
              </div>
            </div>
            <RadioGroupItem value="squish" id="effect-squish" className="sr-only" />
          </Label>
          
          <Label
            htmlFor="effect-expansion"
            className={`flex items-center justify-between rounded-md border-2 p-4 ${
              effect === "expansion" ? "border-primary bg-primary/5" : "border-muted"
            } cursor-pointer`}
          >
            <div className="flex items-center gap-3">
              <Wand2 className={`h-5 w-5 ${effect === "expansion" ? "text-primary" : "text-muted-foreground"}`} />
              <div className="space-y-1">
                <p className={`text-sm font-medium ${effect === "expansion" ? "text-primary" : ""}`}>Efecto Expansion</p>
                <p className="text-xs text-muted-foreground">Animación de expansión desde el centro</p>
              </div>
            </div>
            <RadioGroupItem value="expansion" id="effect-expansion" className="sr-only" />
          </Label>
        </RadioGroup>
      </div>

      <div className="flex justify-center mt-6">
        <Button 
          onClick={handleGenerateEffect} 
          disabled={!image || isProcessing}
          className="w-full md:w-auto"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generar efecto
            </>
          )}
        </Button>
      </div>

      <div className="text-center text-sm text-muted-foreground mt-4 border-t pt-4 border-dashed">
        <p>Esta función está actualmente en desarrollo.</p>
        <p>Pronto podrás convertir tus imágenes en fascinantes videos animados.</p>
      </div>
    </div>
  );
}