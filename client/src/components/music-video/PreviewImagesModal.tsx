import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles } from "lucide-react";

interface PreviewImagesModalProps {
  open: boolean;
  images: Array<{ id: string; url: string; prompt: string }>;
  onApprove: () => void;
  onReject: () => void;
}

export function PreviewImagesModal({ open, images, onApprove, onReject }: PreviewImagesModalProps) {
  return (
    <Dialog open={open} modal={true}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-background via-background to-green-950/10">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-green-500 animate-pulse" />
            Preview: First 10 Images Generated
          </DialogTitle>
          <DialogDescription className="text-lg text-muted-foreground">
            Review the style and quality of these images. Are you happy with the results?
          </DialogDescription>
        </DialogHeader>

        {/* Image Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 py-6">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="relative group rounded-lg overflow-hidden border-2 border-green-500/30 bg-card shadow-lg hover:shadow-2xl transition-all hover:scale-105"
            >
              <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded-md text-xs font-bold z-10">
                #{index + 1}
              </div>
              <img
                src={image.url}
                alt={`Preview ${index + 1}`}
                className="w-full h-40 object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs line-clamp-2">{image.prompt}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Approval Message */}
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border-2 border-green-500/30 rounded-lg p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="bg-green-500/20 p-3 rounded-full">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold">First 10 Images Complete!</h3>
              <p className="text-muted-foreground">
                These images were generated with <span className="text-green-500 font-semibold">Gemini nano banana</span>. 
                If you're happy with the style and quality, we'll continue generating the remaining images.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <DialogFooter className="gap-3 sm:gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={onReject}
            className="h-14 text-base border-2"
            data-testid="button-reject-preview"
          >
            <X className="h-5 w-5 mr-2" />
            Stop & Adjust Settings
          </Button>
          <Button
            size="lg"
            onClick={onApprove}
            className="h-14 text-base bg-green-600 hover:bg-green-700"
            data-testid="button-approve-preview"
          >
            <Check className="h-5 w-5 mr-2" />
            Continue Generating All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
