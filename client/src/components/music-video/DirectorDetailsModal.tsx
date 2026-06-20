/**
import { logger } from "../../lib/logger";
 * Modal de Detalles del Director
 * Muestra toda la información detallada del JSON de cada director
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import { 
  Camera, 
  Palette, 
  Film, 
  Lightbulb, 
  Edit3, 
  BookOpen, 
  Sparkles,
  Star,
  Play,
  Award
} from "lucide-react";
import type { DirectorProfile } from "../../data/directors/director-schema";

interface DirectorDetailsModalProps {
  director: DirectorProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateVideo: (director: DirectorProfile) => void;
}

export function DirectorDetailsModal({
  director,
  isOpen,
  onClose,
  onCreateVideo
}: DirectorDetailsModalProps) {
  if (!director) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
            {director.name}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-sm">
              {director.specialty}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              ⭐ {director.rating}/5.0
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bio y Experiencia */}
          <div>
            <p className="text-muted-foreground leading-relaxed">{director.bio}</p>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Experiencia:</strong> {director.experience}
            </p>
          </div>

          {/* Estilo Visual */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Estilo Visual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{director.visual_style.description}</p>
              
              <div>
                <h4 className="text-sm font-semibold mb-2">Técnicas Características:</h4>
                <div className="flex flex-wrap gap-2">
                  {director.visual_style.signature_techniques.map((tech, idx) => (
                    <Badge key={idx} variant="secondary">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Paleta de Colores:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Colores Primarios:</p>
                    <div className="flex flex-wrap gap-1">
                      {director.visual_style.color_palette.primary_colors.map((color, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {color}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Colores de Acento:</p>
                    <div className="flex flex-wrap gap-1">
                      {director.visual_style.color_palette.accent_colors.map((color, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {color}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>Mood:</strong> {director.visual_style.color_palette.mood}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Influencias:</h4>
                <div className="flex flex-wrap gap-2">
                  {director.visual_style.influences.map((influence, idx) => (
                    <Badge key={idx} variant="outline">
                      {influence}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferencias de Cámara */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Preferencias de Cámara
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Lentes Favoritos:</h4>
                  <div className="flex flex-wrap gap-1">
                    {director.camera_preferences.favorite_lenses.map((lens, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {lens}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Tipos de Toma:</h4>
                  <div className="flex flex-wrap gap-1">
                    {director.camera_preferences.favorite_shot_types.map((shot, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {shot}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Movimientos de Cámara:</h4>
                <div className="flex flex-wrap gap-1">
                  {director.camera_preferences.favorite_movements.map((movement, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {movement}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Composición:</strong> {director.camera_preferences.shot_composition}
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Aspect Ratio:</strong> {director.camera_preferences.aspect_ratio}
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Iluminación */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Iluminación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {director.lighting_style.preferred_lighting.map((light, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {light}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>Temperatura:</strong> {director.lighting_style.color_temperature}
                </p>
              </CardContent>
            </Card>

            {/* Edición */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-primary" />
                  Edición
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  <strong>Ritmo:</strong> {director.editing_style.pace}
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Duración promedio de tomas:</strong> {director.editing_style.average_shot_length}
                </p>
                <div className="flex flex-wrap gap-1">
                  {director.editing_style.transitions.map((transition, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {transition}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Storytelling */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Narrativa y Storytelling
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong>Enfoque:</strong> {director.storytelling.narrative_approach}
              </p>
              <div>
                <h4 className="text-sm font-semibold mb-2">Temas Preferidos:</h4>
                <div className="flex flex-wrap gap-2">
                  {director.storytelling.preferred_themes.map((theme, idx) => (
                    <Badge key={idx} variant="secondary">
                      {theme}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Performance vs B-Roll:</strong> {director.storytelling.performance_vs_broll_ratio}
              </p>
            </CardContent>
          </Card>

          {/* Videos Icónicos */}
          {director.iconic_videos && director.iconic_videos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Videos Icónicos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {director.iconic_videos.map((video, idx) => (
                    <div key={idx} className="border-l-2 border-primary pl-3">
                      <h4 className="font-semibold text-sm">"{video.title}"</h4>
                      <p className="text-xs text-muted-foreground">
                        {video.artist} • {video.year}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {video.key_techniques.map((tech, techIdx) => (
                          <Badge key={techIdx} variant="outline" className="text-xs">
                            {tech}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Botón Principal */}
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              onClick={() => onCreateVideo(director)}
              data-testid="create-video-with-director"
            >
              <Play className="mr-2 h-5 w-5" />
              Crear Video Musical con {director.name}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Te llevaremos al creador de videos AI con este director pre-seleccionado
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
