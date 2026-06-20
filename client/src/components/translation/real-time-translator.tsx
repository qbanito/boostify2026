import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { translateText, detectLanguage } from "../../lib/api/translation-service";
import { useToast } from "../../hooks/use-toast";
import { Languages, ArrowRight, Loader2 } from "lucide-react";
import debounce from "lodash/debounce";

const SUPPORTED_LANGUAGES = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "pt", name: "Português" },
  { code: "ru", name: "Русский" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "zh", name: "中文" },
];

export function RealTimeTranslator() {
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const { toast } = useToast();

  const debouncedTranslate = debounce(async (text: string) => {
    if (!text.trim()) {
      setTranslatedText("");
      return;
    }

    try {
      setIsTranslating(true);
      const response = await translateText({
        text,
        targetLanguage,
      });
      setTranslatedText(response.translatedText);
    } catch (error: any) {
      toast({
        title: "Error de traducción",
        description: error.message || "No se pudo traducir el texto",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  }, 500);

  useEffect(() => {
    debouncedTranslate(inputText);
    return () => debouncedTranslate.cancel();
  }, [inputText, targetLanguage]);

  const handleDetectLanguage = async () => {
    if (!inputText.trim()) return;

    try {
      const detected = await detectLanguage(inputText);
      const languageName = SUPPORTED_LANGUAGES.find(lang => lang.code === detected)?.name || detected;
      toast({
        title: "Idioma detectado",
        description: `El texto está en ${languageName}`,
      });
      setDetectedLanguage(detected);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo detectar el idioma",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="space-y-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Texto original</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDetectLanguage}
              disabled={!inputText.trim()}
            >
              <Languages className="w-4 h-4 mr-2" />
              Detectar idioma
            </Button>
          </div>
          <Input
            placeholder="Escribe o pega el texto aquí..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="min-h-[100px]"
            multiline
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Seleccionar idioma" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            {isTranslating && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Traducción</h3>
          <div className="min-h-[100px] p-4 rounded-md bg-muted">
            {translatedText || (
              <span className="text-muted-foreground">
                La traducción aparecerá aquí...
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
