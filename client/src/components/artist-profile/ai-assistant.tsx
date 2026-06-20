import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Wand2, Image as ImageIcon, Loader2, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface AIAssistantProps {
  profileSlug: string | null;
  artistName: string;
  onProfileUpdate?: () => void;
}

interface CoverPrompt {
  id: string;
  name: string;
  prompt: string;
}

export function AIAssistant({ profileSlug, artistName, onProfileUpdate }: AIAssistantProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState(artistName || '');
  const [isEnriching, setIsEnriching] = useState(false);
  const [showEnrichedData, setShowEnrichedData] = useState(false);
  const [enrichedData, setEnrichedData] = useState<any>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [coverPrompts, setCoverPrompts] = useState<CoverPrompt[]>([]);
  const [showCoverDialog, setShowCoverDialog] = useState(false);

  // Load cover prompts
  const loadCoverPrompts = async () => {
    try {
      const response = await apiRequest('/api/ai/cover-prompts');
      setCoverPrompts(response.prompts);
    } catch (error: any) {
      console.error('Error loading prompts:', error);
    }
  };

  const handleEnrichProfile = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Error",
        description: "Please enter an artist name to search",
        variant: "destructive",
      });
      return;
    }

    setIsEnriching(true);
    try {
      const response = await apiRequest('/api/ai/enrich-profile', {
        method: 'POST',
        body: JSON.stringify({ artistName: searchQuery }),
        headers: { 'Content-Type': 'application/json' },
      });

      setEnrichedData(response.data);
      setShowEnrichedData(true);
      
      toast({
        title: "Success",
        description: "Profile information found! Review and apply changes.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to enrich profile",
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  const handleApplyEnrichedData = () => {
    if (profileSlug) {
      queryClient.invalidateQueries({ queryKey: [`/api/profile/${profileSlug}`] });
    }
    setShowEnrichedData(false);
    onProfileUpdate?.();
    toast({
      title: "Success",
      description: "Profile updated with AI-generated information",
    });
  };

  const handleGenerateCover = async () => {
    if (!selectedPrompt) {
      toast({
        title: "Error",
        description: "Please select a cover style",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append('promptId', selectedPrompt);
      formData.append('artistName', artistName);
      
      if (referenceImage) {
        formData.append('referenceImage', referenceImage);
      }

      const response = await apiRequest('/api/ai/generate-cover', {
        method: 'POST',
        body: formData,
        headers: {},
      });

      setGeneratedImageUrl(response.imageUrl);
      
      toast({
        title: "Success",
        description: "Cover image generated! You can now use it as your profile or cover image.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate cover",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenCoverGenerator = async () => {
    setShowCoverDialog(true);
    if (coverPrompts.length === 0) {
      await loadCoverPrompts();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Assistant
          </CardTitle>
          <CardDescription>
            Use AI to auto-fill your profile and generate artistic cover images
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Profile Enrichment Section */}
          <div className="space-y-3">
            <Label>Auto-Fill Profile Information</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Search artist name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEnrichProfile()}
                data-testid="input-artist-search"
              />
              <Button
                onClick={handleEnrichProfile}
                disabled={isEnriching}
                data-testid="button-search-artist"
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              AI will search the web and fill in your profile with information about the artist
            </p>
          </div>

          {/* Cover Generation Section */}
          <div className="space-y-3 pt-4 border-t">
            <Label>Generate Artistic Cover Image</Label>
            <Button
              onClick={handleOpenCoverGenerator}
              variant="outline"
              className="w-full"
              data-testid="button-open-cover-generator"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Generate Cover with Nano Banana
            </Button>
            <p className="text-sm text-muted-foreground">
              Create professional cover art using AI image generation with preset styles
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Enriched Data Preview Dialog */}
      <Dialog open={showEnrichedData} onOpenChange={setShowEnrichedData}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI-Generated Profile Information</DialogTitle>
            <DialogDescription>
              Review the information found and click Apply to update your profile
            </DialogDescription>
          </DialogHeader>
          
          {enrichedData && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                {enrichedData.realName && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Real Name</Label>
                    <p className="text-sm">{enrichedData.realName}</p>
                  </div>
                )}
                {enrichedData.country && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Country</Label>
                    <p className="text-sm">{enrichedData.country}</p>
                  </div>
                )}
              </div>
              
              {enrichedData.genres && enrichedData.genres.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Genres</Label>
                  <p className="text-sm">{enrichedData.genres.join(', ')}</p>
                </div>
              )}
              
              {enrichedData.biography && (
                <div>
                  <Label className="text-xs text-muted-foreground">Biography</Label>
                  <p className="text-sm">{enrichedData.biography}</p>
                </div>
              )}
              
              {enrichedData.topYoutubeVideos && enrichedData.topYoutubeVideos.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Top Videos ({enrichedData.topYoutubeVideos.length})</Label>
                  <div className="text-sm space-y-1">
                    {enrichedData.topYoutubeVideos.slice(0, 3).map((video: any, idx: number) => (
                      <p key={idx}>• {video.title}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrichedData(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyEnrichedData} data-testid="button-apply-enriched-data">
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cover Generation Dialog */}
      <Dialog open={showCoverDialog} onOpenChange={setShowCoverDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Generate Artistic Cover
            </DialogTitle>
            <DialogDescription>
              Choose a style and optionally upload a reference image
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cover Style</Label>
              <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                <SelectTrigger data-testid="select-cover-style">
                  <SelectValue placeholder="Select a style" />
                </SelectTrigger>
                <SelectContent>
                  {coverPrompts.map((prompt) => (
                    <SelectItem key={prompt.id} value={prompt.id}>
                      {prompt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reference Image (Optional)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setReferenceImage(e.target.files?.[0] || null)}
                data-testid="input-reference-image"
              />
              <p className="text-xs text-muted-foreground">
                Upload a photo to use as reference for the AI-generated cover
              </p>
            </div>

            {generatedImageUrl && (
              <div className="space-y-2">
                <Label>Generated Image</Label>
                <div className="border rounded-lg overflow-hidden">
                  <img 
                    src={generatedImageUrl} 
                    alt="Generated cover" 
                    className="w-full h-auto"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You can now use this image as your profile or cover image
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCoverDialog(false)}
            >
              Close
            </Button>
            <Button
              onClick={handleGenerateCover}
              disabled={isGenerating || !selectedPrompt}
              data-testid="button-generate-cover"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
