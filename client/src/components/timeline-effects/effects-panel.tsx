import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Palette, Sparkles, Volume as VolumeIcon, Gauge } from "lucide-react";
import Blur from "./blur";
import Brightness from "./brightness";
import Opacity from "./opacity";
import Flip from "./flip";
import Radius from "./radius";
import Shadow, { type BoxShadow } from "./shadow";
import Transform, { type TransformValue } from "./transform";
import PlaybackRate from "./playback-rate";
import Volume from "./volume";
import { TimelineClip } from "../music-video/TimelineEditor";

export interface ClipEffects {
  blur?: number;
  brightness?: number;
  opacity?: number;
  flip?: { horizontal: boolean; vertical: boolean };
  radius?: number;
  shadow?: BoxShadow;
  transform?: TransformValue;
  playbackRate?: number;
  volume?: number;
}

interface EffectsPanelProps {
  clip: TimelineClip;
  onChange: (clipId: number, effects: ClipEffects) => void;
  className?: string;
}

export function EffectsPanel({ clip, onChange, className }: EffectsPanelProps) {
  const effects: ClipEffects = clip.metadata?.effects || {
    blur: 0,
    brightness: 50,
    opacity: 100,
    flip: { horizontal: false, vertical: false },
    radius: 0,
    shadow: { x: 0, y: 0, blur: 0, color: '#000000' },
    transform: { scale: 1, x: 0, y: 0, rotation: 0 },
    playbackRate: 1,
    volume: 100
  };

  const updateEffect = <K extends keyof ClipEffects>(key: K, value: ClipEffects[K]) => {
    const newEffects = { ...effects, [key]: value };
    onChange(clip.id, newEffects);
  };

  const resetAllEffects = () => {
    const defaultEffects: ClipEffects = {
      blur: 0,
      brightness: 50,
      opacity: 100,
      flip: { horizontal: false, vertical: false },
      radius: 0,
      shadow: { x: 0, y: 0, blur: 0, color: '#000000' },
      transform: { scale: 1, x: 0, y: 0, rotation: 0 },
      playbackRate: 1,
      volume: 100
    };
    onChange(clip.id, defaultEffects);
  };

  const hasActiveEffects = () => {
    return (
      effects.blur !== 0 ||
      effects.brightness !== 50 ||
      effects.opacity !== 100 ||
      effects.flip?.horizontal ||
      effects.flip?.vertical ||
      effects.radius !== 0 ||
      (effects.shadow && (effects.shadow.blur !== 0 || effects.shadow.x !== 0 || effects.shadow.y !== 0)) ||
      (effects.transform && (effects.transform.scale !== 1 || effects.transform.x !== 0 || effects.transform.y !== 0 || effects.transform.rotation !== 0)) ||
      effects.playbackRate !== 1 ||
      effects.volume !== 100
    );
  };

  return (
    <Card className={className} data-testid="card-effects-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Effects
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {clip.title} • {clip.type}
              {hasActiveEffects() && (
                <Badge variant="secondary" className="ml-2">Active</Badge>
              )}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetAllEffects}
            disabled={!hasActiveEffects()}
            className="min-h-[44px] min-w-[44px]"
            data-testid="button-reset-effects"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <Tabs defaultValue="visual" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 min-h-[44px]">
            <TabsTrigger value="visual" className="gap-1 min-h-[44px]" data-testid="tab-visual">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Visual</span>
            </TabsTrigger>
            <TabsTrigger value="transform" className="gap-1 min-h-[44px]" data-testid="tab-transform">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Transform</span>
            </TabsTrigger>
            <TabsTrigger value="playback" className="gap-1 min-h-[44px]" data-testid="tab-playback">
              <Gauge className="h-4 w-4" />
              <span className="hidden sm:inline">Playback</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visual" className="space-y-2 mt-0">
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="blur">
                <AccordionTrigger className="min-h-[44px]">
                  Blur {effects.blur !== 0 && <Badge variant="secondary" className="ml-2">{effects.blur}</Badge>}
                </AccordionTrigger>
                <AccordionContent>
                  <Blur
                    value={effects.blur || 0}
                    onChange={(v) => updateEffect('blur', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="brightness">
                <AccordionTrigger className="min-h-[44px]">
                  Brightness {effects.brightness !== 50 && <Badge variant="secondary" className="ml-2">{effects.brightness}</Badge>}
                </AccordionTrigger>
                <AccordionContent>
                  <Brightness
                    value={effects.brightness || 50}
                    onChange={(v) => updateEffect('brightness', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="opacity">
                <AccordionTrigger className="min-h-[44px]">
                  Opacity {effects.opacity !== 100 && <Badge variant="secondary" className="ml-2">{effects.opacity}%</Badge>}
                </AccordionTrigger>
                <AccordionContent>
                  <Opacity
                    value={effects.opacity || 100}
                    onChange={(v) => updateEffect('opacity', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="radius">
                <AccordionTrigger className="min-h-[44px]">
                  Border Radius {effects.radius !== 0 && <Badge variant="secondary" className="ml-2">{effects.radius}</Badge>}
                </AccordionTrigger>
                <AccordionContent>
                  <Radius
                    value={effects.radius || 0}
                    onChange={(v) => updateEffect('radius', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="shadow">
                <AccordionTrigger className="min-h-[44px]">
                  Shadow {effects.shadow && effects.shadow.blur > 0 && <Badge variant="secondary" className="ml-2">Active</Badge>}
                </AccordionTrigger>
                <AccordionContent>
                  <Shadow
                    label="Shadow"
                    value={effects.shadow || { x: 0, y: 0, blur: 0, color: '#000000' }}
                    onChange={(v) => updateEffect('shadow', v)}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="transform" className="space-y-2 mt-0">
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="flip">
                <AccordionTrigger className="min-h-[44px]">
                  Flip {(effects.flip?.horizontal || effects.flip?.vertical) && <Badge variant="secondary" className="ml-2">Active</Badge>}
                </AccordionTrigger>
                <AccordionContent>
                  <Flip
                    value={effects.flip || { horizontal: false, vertical: false }}
                    onChange={(v) => updateEffect('flip', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="transform">
                <AccordionTrigger className="min-h-[44px]">
                  Transform {effects.transform && (effects.transform.scale !== 1 || effects.transform.rotation !== 0) && <Badge variant="secondary" className="ml-2">Active</Badge>}
                </AccordionTrigger>
                <AccordionContent>
                  <Transform
                    value={effects.transform || { scale: 1, x: 0, y: 0, rotation: 0 }}
                    onChange={(v) => updateEffect('transform', v)}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="playback" className="space-y-2 mt-0">
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="playback-rate">
                <AccordionTrigger className="min-h-[44px]">
                  Playback Speed {effects.playbackRate !== 1 && <Badge variant="secondary" className="ml-2">x{effects.playbackRate}</Badge>}
                </AccordionTrigger>
                <AccordionContent>
                  <PlaybackRate
                    value={effects.playbackRate || 1}
                    onChange={(v) => updateEffect('playbackRate', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              {(clip.type === 'audio' || clip.type === 'video') && (
                <AccordionItem value="volume">
                  <AccordionTrigger className="min-h-[44px]">
                    <div className="flex items-center gap-2">
                      <VolumeIcon className="h-4 w-4" />
                      Volume {effects.volume !== 100 && <Badge variant="secondary" className="ml-2">{effects.volume}%</Badge>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Volume
                      value={effects.volume || 100}
                      onChange={(v) => updateEffect('volume', v)}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
