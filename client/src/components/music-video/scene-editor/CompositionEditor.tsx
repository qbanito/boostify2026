/**
import { logger } from "../../lib/logger";
 * Componente CompositionEditor
 * Editor para configurar aspectos compositivos de la escena
 * Mejorado con sugerencias de AI y categorías visuales
 */
import React, { useState, useEffect } from 'react';
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { PlusCircle, Wand2, RefreshCw, Lightbulb, Palette, Camera, Sun, Moon } from 'lucide-react';
import { Textarea } from "../../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { useToast } from "../../../hooks/use-toast";
import { Badge } from "../../ui/badge";

interface CompositionEditorProps {
  composition: string;
  onUpdate: (composition: string) => void;
}

// Categorías de sugerencias de composición
const COMPOSITION_CATEGORIES = {
  lighting: {
    label: "Iluminación",
    icon: Sun,
    suggestions: [
      "Iluminación dramática con sombras duras y alto contraste",
      "Luz suave y difusa con tonos pastel",
      "Luz de fondo que crea silueta",
      "Iluminación lateral que acentúa texturas",
      "Iluminación cenital que crea ambiente misterioso",
      "Luz ambiental difusa y natural"
    ]
  },
  composition: {
    label: "Composición",
    icon: Camera,
    suggestions: [
      "Composición simétrica con punto focal central",
      "Regla de tercios con sujeto principal desplazado",
      "Líneas diagonales que crean dinamismo",
      "Encuadre natural usando elementos del entorno",
      "Perspectiva forzada con punto de fuga dramático"
    ]
  },
  color: {
    label: "Color",
    icon: Palette,
    suggestions: [
      "Esquema de color cálido con tonos dorados y ámbar",
      "Esquema de color frío con tonos azules y cyan",
      "Paleta monocromática con variaciones tonales",
      "Contraste complementario entre tonos naranja y azul",
      "Colores vibrantes y saturados estilo cinematográfico",
      "Tonalidades desaturadas vintage"
    ]
  },
  mood: {
    label: "Ambiente",
    icon: Moon,
    suggestions: [
      "Atmósfera neblinosa y etérea",
      "Ambiente oscuro con puntos de luz focal",
      "Estética minimalista con espacios negativos",
      "Textura granulada estilo película analógica",
      "Profundidad de campo reducida con fondo desenfocado",
      "Estilo noir con sombras pronunciadas"
    ]
  }
};

// Combinaciones preestablecidas de alta calidad
const AI_COMPOSITION_PRESETS = [
  "Cinematic lighting with dramatic shadows, rule of thirds composition, complementary blue-orange color palette",
  "Soft diffused daylight, symmetrical framing, muted vintage color grading with film grain texture",
  "Moody low-key lighting, Dutch angle composition, desaturated teal and orange color scheme",
  "Golden hour backlighting, shallow depth of field, warm color temperature with lens flare",
  "Atmospheric volumetric lighting, leading lines composition, high contrast monochromatic palette"
];

export function CompositionEditor({ composition, onUpdate }: CompositionEditorProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(Boolean(composition));
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeCategory, setActiveCategory] = useState("lighting");
  
  const handleAddComposition = (suggestion: string) => {
    if (!composition) {
      onUpdate(suggestion);
    } else {
      onUpdate(`${composition}, ${suggestion.toLowerCase()}`);
    }
    setIsEditing(true);
  };

  const generateAIComposition = () => {
    setIsGenerating(true);
    
    // Simulamos la generación AI seleccionando un preset aleatorio
    setTimeout(() => {
      const randomPreset = AI_COMPOSITION_PRESETS[Math.floor(Math.random() * AI_COMPOSITION_PRESETS.length)];
      onUpdate(randomPreset);
      setIsGenerating(false);
      setIsEditing(true);
      
      toast({
        title: "Composición AI generada",
        description: "Se ha aplicado una composición visual optimizada para tus necesidades."
      });
    }, 800);
  };

  // Contamos las categorías usadas para mostrar badges
  const getUsedCategories = () => {
    if (!composition) return [];
    
    const lowerComposition = composition.toLowerCase();
    return Object.entries(COMPOSITION_CATEGORIES)
      .filter(([_, category]) => 
        category.suggestions.some(suggestion => 
          lowerComposition.includes(suggestion.toLowerCase())
        )
      )
      .map(([key, category]) => ({
        key,
        label: category.label
      }));
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium">Composition</Label>
        
        {!isEditing && (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs gap-1" 
            onClick={generateAIComposition}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            AI Sugerencia
          </Button>
        )}
      </div>

      {isEditing ? (
        <>
          <Textarea
            value={composition}
            onChange={(e) => onUpdate(e.target.value)}
            className="resize-none"
            rows={3}
            placeholder="Describe la composición visual de la escena..."
          />
          
          {composition && (
            <div className="flex flex-wrap gap-1">
              {getUsedCategories().map(category => (
                <Badge key={category.key} variant="outline" className="text-xs">
                  {category.label}
                </Badge>
              ))}
            </div>
          )}
        </>
      ) : (
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
          <TabsList className="grid grid-cols-4 mb-2">
            {Object.entries(COMPOSITION_CATEGORIES).map(([key, category]) => {
              const Icon = category.icon;
              return (
                <TabsTrigger key={key} value={key} className="text-xs px-2 py-1">
                  <Icon className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">{category.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {Object.entries(COMPOSITION_CATEGORIES).map(([key, category]) => (
            <TabsContent key={key} value={key} className="mt-0">
              <div className="flex flex-wrap gap-1">
                {category.suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleAddComposition(suggestion)}
                  >
                    <PlusCircle className="h-3 w-3 mr-1" />
                    {suggestion.length > 20 
                      ? suggestion.substring(0, 18) + "..." 
                      : suggestion}
                  </Button>
                ))}
              </div>
            </TabsContent>
          ))}
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsEditing(true)}
            className="w-full justify-center mt-3"
          >
            <Lightbulb className="h-3 w-3 mr-1" />
            Editar composición manualmente
          </Button>
        </Tabs>
      )}

      {/* Sugerencias AI cuando está en modo edición */}
      {isEditing && (
        <div className="mt-2 space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-muted-foreground">Sugerencias profesionales:</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs" 
              onClick={generateAIComposition}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3 mr-1" />
              )}
              Generar nueva
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {AI_COMPOSITION_PRESETS.slice(0, 3).map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => onUpdate(preset)}
              >
                <Wand2 className="h-3 w-3 mr-1" />
                {preset.length > 40
                  ? preset.substring(0, 38) + "..."
                  : preset}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}