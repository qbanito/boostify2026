/**
 * SongCoverGenerateDialog
 * Lets the artist generate or upload a cover image for a song.
 * Uses /api/songs/generate-cover-art for AI generation and
 * /api/songs/:id/cover to persist.
 *
 * Closing the dialog triggers `onSaved` so the parent can refetch the list.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Loader2, Sparkles, Upload, Wand2, X } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { apiRequest } from "../../lib/queryClient";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songId: string | number;
  songTitle: string;
  songGenre?: string;
  artistName?: string;
  artistProfileImage?: string | null;
  initialCoverArt?: string | null;
  accentColor?: string;
  onSaved?: (newCoverArt: string) => void;
}

export function SongCoverGenerateDialog({
  open,
  onOpenChange,
  songId,
  songTitle,
  songGenre,
  artistName,
  artistProfileImage,
  initialCoverArt,
  accentColor = "#a855f7",
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialCoverArt || null);
  const [prompt, setPrompt] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [useReference, setUseReference] = useState(true);

  useEffect(() => {
    if (open) {
      setPreviewUrl(initialCoverArt || null);
      setProvider(null);
      // Sensible default prompt — gets enriched server-side with title,
      // artist name, genre, mood and the profile-image reference.
      setPrompt(
        `Editorial album cover for "${songTitle}"${
          songGenre ? ` (${songGenre})` : ""
        }${
          artistName ? ` by ${artistName}` : ""
        }. Cinematic studio lighting, premium high-end vinyl LP cover composition, bold visual identity, magazine-cover retouching, 1:1.`,
      );
    }
  }, [open, songTitle, songGenre, artistName, initialCoverArt]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProvider(null);
    try {
      const result: any = await apiRequest("/api/songs/generate-cover-art", {
        method: "POST",
        data: {
          prompt: prompt?.trim() || undefined,
          songId,
          songTitle,
          artistName,
          genre: songGenre,
          referenceImage:
            useReference && artistProfileImage ? artistProfileImage : undefined,
        },
      });
      if (result?.success && result?.coverArtUrl) {
        setPreviewUrl(result.coverArtUrl);
        setProvider(result.provider || null);
        toast({ title: "Cover generated" });
      } else {
        throw new Error(result?.message || "Generation failed");
      }
    } catch (err: any) {
      console.error("[SongCoverGenerateDialog] generate error:", err);
      toast({
        title: "Generation failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    // Sanity-check size client-side so we don't bounce off the 10MB JSON limit.
    if (file.size > 9 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Please pick a file under 9MB (PNG/JPG/WebP).",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      // Convert to base64 (matches /api/upload-image contract)
      const base64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read file"));
        r.readAsDataURL(file);
      });
      const result: any = await apiRequest("/api/upload-image", {
        method: "POST",
        data: {
          imageData: base64,
          fileName: `song-${songId}-${Date.now()}.${file.type.split("/")[1] || "png"}`,
          folder: "song-covers",
        },
      });
      const url = result?.imageUrl;
      if (!url) throw new Error(result?.error || result?.message || "No URL returned");
      setPreviewUrl(url);
      toast({ title: "Image uploaded — click Save cover to apply" });
    } catch (err: any) {
      console.error("[SongCoverGenerateDialog] upload error:", err);
      toast({
        title: "Upload failed",
        description: err?.message || "Try a smaller PNG/JPG.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!previewUrl) {
      toast({
        title: "Nothing to save",
        description: "Generate or upload a cover first.",
        variant: "destructive",
      });
      return;
    }
    if (!songId && songId !== 0) {
      toast({
        title: "Missing song id",
        description: "Reopen the dialog and try again.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const r: any = await apiRequest(`/api/songs/${encodeURIComponent(String(songId))}/cover`, {
        method: "POST",
        data: { coverArt: previewUrl },
      });
      if (!r?.success) throw new Error(r?.message || "Save failed");
      toast({ title: "Cover saved" });
      onSaved?.(previewUrl);
      onOpenChange(false);
    } catch (err: any) {
      console.error("[SongCoverGenerateDialog] save error:", err);
      toast({
        title: "Save failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-950 border-white/10 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5" style={{ color: accentColor }} />
            Cover artwork — {songTitle}
          </DialogTitle>
          <DialogDescription>
            Generate stunning artwork with AI, or upload your own.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
          {/* preview */}
          <div className="space-y-2">
            <div
              className="aspect-square w-full overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10"
              style={{
                backgroundImage: previewUrl ? `url(${previewUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {!previewUrl && (
                <div className="flex h-full items-center justify-center text-xs text-white/40">
                  No cover yet
                </div>
              )}
            </div>
            {provider && (
              <div className="text-[11px] text-white/40">
                Generated with AI
              </div>
            )}
            <label className="block">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
              <span
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                <Upload className="h-4 w-4" />
                Upload image
              </span>
            </label>
          </div>

          {/* controls */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-white/80">Prompt</Label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                className="w-full rounded-md bg-gray-900 border border-white/10 p-2 text-sm text-white outline-none focus:ring-1 focus:ring-white/30"
                placeholder="Describe the artwork (style, mood, colors, references)..."
              />
            </div>

            {artistProfileImage && (
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={useReference}
                  onChange={(e) => setUseReference(e.target.checked)}
                  className="h-4 w-4"
                />
                Use my profile image as visual reference
              </label>
            )}

            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, #6366f1)`,
                color: "white",
              }}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              {previewUrl ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || isGenerating}
            className="text-white/70"
          >
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!previewUrl || isSaving || isGenerating}
            style={{ backgroundColor: accentColor, color: "white" }}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Save cover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
