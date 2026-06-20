/**
import { logger } from "../../lib/logger";
 * Lip-Sync Controls Component
 * Permite regenerar y previsualizar videos de lip-sync
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { RefreshCw, Eye, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from '../../hooks/use-toast';

interface LipsyncControlsProps {
  clipId: number;
  clipTitle: string;
  currentLipsyncUrl?: string;
  artistImageUrl?: string;
  audioSegmentUrl?: string;
  onRegenerate: () => Promise<void>;
}

export function LipsyncControls({
  clipId,
  clipTitle,
  currentLipsyncUrl,
  artistImageUrl,
  audioSegmentUrl,
  onRegenerate
}: LipsyncControlsProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate();
      toast({
        title: "✅ Lip-sync regenerado",
        description: `El video para "${clipTitle}" ha sido regenerado exitosamente`,
      });
    } catch (error) {
      logger.error('Error regenerating lip-sync:', error);
      toast({
        title: "❌ Error",
        description: "No se pudo regenerar el lip-sync",
        variant: "destructive"
      });
    } finally {
      setIsRegenerating(false);
    }
  };
  
  return (
    <div className="flex gap-2 items-center" data-testid={`lipsync-controls-${clipId}`}>
      {/* Botón Regenerar */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRegenerate}
        disabled={isRegenerating || !artistImageUrl || !audioSegmentUrl}
        className="gap-2"
        data-testid={`regenerate-lipsync-${clipId}`}
      >
        {isRegenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Regenerando...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            Regenerar
          </>
        )}
      </Button>
      
      {/* Botón Preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={!currentLipsyncUrl}
            className="gap-2"
            data-testid={`preview-lipsync-${clipId}`}
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>🎤 Preview Lip-Sync</span>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                {clipTitle}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Vista previa del video con sincronización labial
            </DialogDescription>
          </DialogHeader>
          
          <Card>
            <CardContent className="p-6">
              {currentLipsyncUrl ? (
                <div className="space-y-4">
                  <video
                    src={currentLipsyncUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full rounded-lg shadow-lg"
                    data-testid={`lipsync-video-preview-${clipId}`}
                  />
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-semibold">Estado</p>
                        <p className="text-muted-foreground">Completado</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-semibold">Calidad</p>
                        <p className="text-muted-foreground">Alta definición</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
                    <p className="text-purple-900">
                      💡 <strong>Tip:</strong> Puedes regenerar el lip-sync si no estás satisfecho con el resultado.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay video de lip-sync disponible</p>
                </div>
              )}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
}
