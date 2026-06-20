/**
 * Style Template Picker
 * Selector de templates de estilos visuales
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '../../hooks/use-toast';
import { Palette, Check, Sparkles } from 'lucide-react';
import type { TimelineClip } from './EnhancedTimeline';
import { VISUAL_TEMPLATES, applyTemplateToClips, type VisualStyleTemplate } from '../../lib/services/visual-style-templates';

interface StyleTemplatePickerProps {
  clips: TimelineClip[];
  duration: number;
  onTemplateApplied?: (styledClips: TimelineClip[], template: VisualStyleTemplate) => void;
}

export function StyleTemplatePicker({ clips, duration, onTemplateApplied }: StyleTemplatePickerProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleApplyTemplate = (template: VisualStyleTemplate) => {
    setSelectedTemplate(template.id);

    // Aplicar template a los clips
    const styledClips = applyTemplateToClips(clips, template, duration);
    onTemplateApplied?.(styledClips, template);

    toast({
      title: `${template.name} aplicado`,
      description: template.description,
    });
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-purple-500" />
          Templates de Estilo
        </CardTitle>
        <CardDescription>
          Aplica estilos profesionales con 1 click
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Template Grid */}
        <div className="grid grid-cols-1 gap-3">
          {VISUAL_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => handleApplyTemplate(template)}
              className={`
                relative group text-left p-4 rounded-lg border-2 transition-all
                ${selectedTemplate === template.id
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700'
                }
              `}
              data-testid={`button-template-${template.id}`}
            >
              {/* Selected Indicator */}
              {selectedTemplate === template.id && (
                <div className="absolute top-2 right-2">
                  <div className="bg-orange-500 rounded-full p-1">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                </div>
              )}

              {/* Template Info */}
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="text-3xl flex-shrink-0">
                  {template.thumbnail}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white mb-1">
                    {template.name}
                  </h3>
                  <p className="text-sm text-zinc-400 mb-2">
                    {template.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {/* Pacing */}
                    <Badge
                      variant="outline"
                      className="text-xs border-zinc-700 text-zinc-400"
                    >
                      {template.settings.pacing}
                    </Badge>

                    {/* Clip Duration */}
                    <Badge
                      variant="outline"
                      className="text-xs border-zinc-700 text-zinc-400"
                    >
                      {template.settings.clipDuration.min}-{template.settings.clipDuration.max}s
                    </Badge>

                    {/* Examples */}
                    {template.examples.slice(0, 2).map((example) => (
                      <Badge
                        key={example}
                        variant="secondary"
                        className="text-xs bg-zinc-800 text-zinc-300"
                      >
                        {example}
                      </Badge>
                    ))}
                  </div>

                  {/* Effects Preview */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                    <Sparkles className="h-3 w-3" />
                    <span>
                      {template.settings.transitions.length} transiciones,{' '}
                      {template.settings.effects.length} efectos
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-800">
          <p className="text-sm text-zinc-400">
            💡 Los templates ajustan automáticamente transiciones, colores, ritmo
            y efectos para crear videos profesionales.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default StyleTemplatePicker;
