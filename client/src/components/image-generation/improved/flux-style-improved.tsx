/**
 * Componente mejorado para la selección de estilo artístico
 * 
 * Este componente permite a los usuarios definir su estilo artístico
 * seleccionando opciones como género musical, vibra, estética y paleta de colores.
 */

import React, { useState } from 'react';
import { useArtistImageWorkflow } from '../../../services/artist-image-workflow-service';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Card, CardContent } from '../../ui/card';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Brush, Music, Palette, HelpCircle } from 'lucide-react';

interface FluxStyleImprovedProps {
  onComplete?: () => void;
}

// Opciones para los selectores
const genreOptions = [
  { value: 'pop', label: 'Pop' },
  { value: 'rock', label: 'Rock' },
  { value: 'electronic', label: 'Electrónica' },
  { value: 'hip-hop', label: 'Hip Hop' },
  { value: 'r&b', label: 'R&B' },
  { value: 'classical', label: 'Clásica' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'indie', label: 'Indie' },
  { value: 'folk', label: 'Folk' },
  { value: 'metal', label: 'Metal' },
];

const vibeOptions = [
  { value: 'energetic', label: 'Energético' },
  { value: 'chill', label: 'Relajado' },
  { value: 'melancholic', label: 'Melancólico' },
  { value: 'playful', label: 'Juguetón' },
  { value: 'intense', label: 'Intenso' },
  { value: 'elegant', label: 'Elegante' },
  { value: 'dreamy', label: 'Soñador' },
  { value: 'rebellious', label: 'Rebelde' },
];

const aestheticOptions = [
  { value: 'minimalist', label: 'Minimalista' },
  { value: 'retro', label: 'Retro' },
  { value: 'futuristic', label: 'Futurista' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'edgy', label: 'Vanguardista' },
  { value: 'bohemian', label: 'Bohemio' },
  { value: 'artistic', label: 'Artístico' },
  { value: 'professional', label: 'Profesional' },
];

const colorPaletteOptions = [
  { value: 'vibrant', label: 'Vibrante', colorClass: 'bg-gradient-to-r from-purple-500 via-pink-500 to-red-500' },
  { value: 'moody', label: 'Melancólico', colorClass: 'bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900' },
  { value: 'warm', label: 'Cálido', colorClass: 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500' },
  { value: 'cool', label: 'Frío', colorClass: 'bg-gradient-to-r from-blue-500 via-teal-500 to-cyan-500' },
  { value: 'neutral', label: 'Neutral', colorClass: 'bg-gradient-to-r from-gray-700 via-gray-500 to-gray-400' },
  { value: 'pastel', label: 'Pastel', colorClass: 'bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300' },
];

// Ejemplo de imágenes de estilo (simuladas)
const styleExamples = [
  { id: 1, url: 'https://source.unsplash.com/random/300x400/?musician,artist,portrait', style: 'Retro-Electrónica' },
  { id: 2, url: 'https://source.unsplash.com/random/300x400/?dj,portrait', style: 'Futurista-Electrónica' },
  { id: 3, url: 'https://source.unsplash.com/random/300x400/?rockstar,portrait', style: 'Rockero-Rebelde' },
  { id: 4, url: 'https://source.unsplash.com/random/300x400/?pop,singer', style: 'Pop-Minimalista' },
];

export function FluxStyleImproved({ onComplete }: FluxStyleImprovedProps) {
  const { artistStyle, updateArtistStyle, referenceImage } = useArtistImageWorkflow();
  
  // Estados locales para los valores de los selectores
  const [genre, setGenre] = useState(artistStyle.genre || '');
  const [vibe, setVibe] = useState(artistStyle.vibe || '');
  const [aesthetic, setAesthetic] = useState(artistStyle.aesthetic || '');
  const [colorPalette, setColorPalette] = useState(artistStyle.colorPalette || '');
  
  // Manejar cambios en los selectores
  const handleGenreChange = (value: string) => {
    setGenre(value);
    updateArtistStyle({ genre: value });
  };
  
  const handleVibeChange = (value: string) => {
    setVibe(value);
    updateArtistStyle({ vibe: value });
  };
  
  const handleAestheticChange = (value: string) => {
    setAesthetic(value);
    updateArtistStyle({ aesthetic: value });
  };
  
  const handleColorPaletteChange = (value: string) => {
    setColorPalette(value);
    updateArtistStyle({ colorPalette: value });
  };
  
  // Verificar si todos los campos están completos
  const isStyleComplete = genre && vibe && aesthetic && colorPalette;
  
  // Manejar continuar
  const handleContinue = () => {
    if (isStyleComplete && onComplete) {
      onComplete();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Define tu estilo artístico</h2>
        <p className="text-muted-foreground mb-4">
          Selecciona las características que definirán tu imagen artística personalizada.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Columna izquierda: Selección de opciones */}
        <div className="space-y-6">
          {/* Imagen de referencia */}
          {referenceImage && (
            <div className="mb-6">
              <Label className="mb-2 block">Tu foto de referencia</Label>
              <div className="w-full max-w-[200px] rounded-lg overflow-hidden">
                <img 
                  src={referenceImage} 
                  alt="Referencia" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          )}

          {/* Género musical */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <Label>Género musical</Label>
            </div>
            <Select value={genre} onValueChange={handleGenreChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un género musical" />
              </SelectTrigger>
              <SelectContent>
                {genreOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El género musical influirá en el estilo visual general.
            </p>
          </div>
          
          {/* Vibra/Sentimiento */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brush className="h-4 w-4 text-primary" />
              <Label>Vibra/Sentimiento</Label>
            </div>
            <Select value={vibe} onValueChange={handleVibeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una vibra" />
              </SelectTrigger>
              <SelectContent>
                {vibeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define la emoción que quieres transmitir con tu imagen.
            </p>
          </div>
          
          {/* Estética */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brush className="h-4 w-4 text-primary" />
              <Label>Estética visual</Label>
            </div>
            <Select value={aesthetic} onValueChange={handleAestheticChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una estética" />
              </SelectTrigger>
              <SelectContent>
                {aestheticOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El estilo visual que caracterizará tu imagen artística.
            </p>
          </div>
          
          {/* Paleta de colores */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <Label>Paleta de colores</Label>
            </div>
            <RadioGroup
              value={colorPalette}
              onValueChange={handleColorPaletteChange}
              className="grid grid-cols-2 gap-4"
            >
              {colorPaletteOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`color-${option.value}`} />
                  <Label htmlFor={`color-${option.value}`} className="flex items-center gap-2">
                    <div className={`h-6 w-12 rounded ${option.colorClass}`}></div>
                    <span>{option.label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              La gama de colores predominante en tus imágenes.
            </p>
          </div>
        </div>
        
        {/* Columna derecha: Previsualización y ejemplos */}
        <div className="space-y-6">
          {/* Previsualización del estilo seleccionado */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-muted/50 to-muted p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg mb-1">Tu estilo</h3>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <Music className="h-3 w-3" />
                        <span>Género: {genre ? genreOptions.find(o => o.value === genre)?.label : 'No seleccionado'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Brush className="h-3 w-3" />
                        <span>Vibra: {vibe ? vibeOptions.find(o => o.value === vibe)?.label : 'No seleccionado'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Brush className="h-3 w-3" />
                        <span>Estética: {aesthetic ? aestheticOptions.find(o => o.value === aesthetic)?.label : 'No seleccionado'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Palette className="h-3 w-3" />
                        <span>Colores: {colorPalette ? colorPaletteOptions.find(o => o.value === colorPalette)?.label : 'No seleccionado'}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="flex items-center gap-1 text-xs bg-primary/10 rounded-full py-1 px-3">
                    <HelpCircle className="h-3 w-3" />
                    <span>{isStyleComplete ? 'Estilo completo' : 'Completa tu estilo'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Ejemplos de estilos similares */}
          <div>
            <h3 className="font-bold text-lg mb-3">Ejemplos de estilos similares</h3>
            <div className="grid grid-cols-2 gap-4">
              {styleExamples.map((example) => (
                <div key={example.id} className="rounded-lg overflow-hidden shadow-sm border">
                  <img 
                    src={example.url} 
                    alt={example.style} 
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-2">
                    <p className="text-xs font-medium">{example.style}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Botón para continuar */}
      <div className="flex justify-end mt-8">
        <Button
          onClick={handleContinue}
          disabled={!isStyleComplete}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}