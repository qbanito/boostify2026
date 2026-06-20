/**
 * Video Preview Modal
 * Muestra videos generados antes de final render y lip-sync
 * Permite refinar parámetros o confirmar para siguiente paso
 */

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Check, X, RefreshCw, Volume2, Eye, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import type { MusicVideoScene } from "@/types/music-video-scene";

interface VideoPreviewModalProps {
  open: boolean;
  onClose: () => void;
  scene: MusicVideoScene | null;
  videoUrl?: string;
  isGenerating?: boolean;
  onApprove?: (scene: MusicVideoScene) => void;
  onRegenerate?: (scene: MusicVideoScene) => void;
}

export function VideoPreviewModal({
  open,
  onClose,
  scene,
  videoUrl,
  isGenerating,
  onApprove,
  onRegenerate
}: VideoPreviewModalProps) {
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  if (!scene) return null;

  const handleApprove = () => {
    logger.info(`✅ [Preview] Video aprobado para escena ${scene.scene_id}`);
    onApprove?.(scene);
    onClose();
  };

  const handleRegenerate = () => {
    logger.info(`🔄 [Preview] Regenerando video para escena ${scene.scene_id}`);
    onRegenerate?.(scene);
  };

  const handleVolumeChange = (val: number[]) => {
    setVolume(val[0]);
    if (videoRef.current) {
      videoRef.current.volume = val[0];
    }
  };

  const handleSpeedChange = (val: number[]) => {
    setPlaybackSpeed(val[0]);
    if (videoRef.current) {
      videoRef.current.playbackRate = val[0];
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-gradient-to-br from-background via-background to-orange-950/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-orange-500" />
            Video Preview - Scene {scene.scene_id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Video Player */}
          <Card className="bg-black overflow-hidden aspect-video flex items-center justify-center">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-12 w-12 text-orange-500 animate-spin" />
                <p className="text-white text-sm">Generating video with FAL AI...</p>
                <p className="text-white/50 text-xs">Estimated: {Math.round(scene.duration * 2)}s</p>
              </div>
            ) : videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full h-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            ) : (
              <div className="text-center">
                <p className="text-white/70">No video available</p>
                <p className="text-white/50 text-sm mt-2">Click "Regenerate" to create video</p>
              </div>
            )}
          </Card>

          {/* Scene Information */}
          <Card className="p-4 bg-white/5 border-orange-500/20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Shot Type</p>
                <p className="font-semibold text-sm">{scene.shot_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Duration</p>
                <p className="font-semibold text-sm">{scene.duration}s</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Performance</p>
                <Badge variant="outline" className="text-xs">
                  {scene.motion_descriptor?.performance_type || "N/A"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Emotion</p>
                <p className="font-semibold text-sm capitalize">
                  {scene.emotion || "Neutral"}
                </p>
              </div>
            </div>
          </Card>

          {/* Motion Descriptor Details */}
          {scene.motion_descriptor && (
            <Card className="p-4 bg-white/5 border-orange-500/20">
              <h4 className="font-semibold text-sm mb-3">Motion Parameters</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">Movement Intensity</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/10 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${scene.motion_descriptor.movement_intensity * 100}%` }}
                      />
                    </div>
                    <span className="font-semibold">
                      {Math.round(scene.motion_descriptor.movement_intensity * 100)}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Emotion Intensity</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/10 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${scene.motion_descriptor.emotion_intensity * 100}%` }}
                      />
                    </div>
                    <span className="font-semibold">
                      {Math.round(scene.motion_descriptor.emotion_intensity * 100)}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Motion Complexity</p>
                  <Badge variant="secondary" className="text-xs">
                    {scene.motion_descriptor.motion_complexity}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Head Movement</p>
                  <p className="font-semibold capitalize">
                    {scene.motion_descriptor.head_movement}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Body Movement</p>
                  <p className="font-semibold capitalize">
                    {scene.motion_descriptor.body_movement}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Eye Direction</p>
                  <p className="font-semibold capitalize">
                    {scene.motion_descriptor.eye_direction}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Playback Controls */}
          {videoUrl && !isGenerating && (
            <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-orange-500/20">
              {/* Volume */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Volume
                  </label>
                  <span className="text-xs text-muted-foreground">{Math.round(volume * 100)}%</span>
                </div>
                <Slider
                  value={[volume]}
                  onValueChange={handleVolumeChange}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Playback Speed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Playback Speed</label>
                  <span className="text-xs text-muted-foreground">{playbackSpeed}x</span>
                </div>
                <Slider
                  value={[playbackSpeed]}
                  onValueChange={handleSpeedChange}
                  min={0.5}
                  max={2}
                  step={0.25}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Quality Assessment */}
          <Card className="p-4 bg-blue-500/10 border-blue-500/20">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Quality Checklist
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Natural movement synchronized with audio</span>
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Facial expressions match emotional intensity</span>
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>No artifacts or jittering visible</span>
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Consistent with director and cinematographer style</span>
              </li>
            </ul>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button
              variant="outline"
              onClick={handleRegenerate}
              className="gap-2"
              disabled={isGenerating}
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>

            <Button
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white gap-2"
              onClick={handleApprove}
              disabled={!videoUrl || isGenerating}
            >
              <Check className="h-4 w-4" />
              Approve for Lip-Sync
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
