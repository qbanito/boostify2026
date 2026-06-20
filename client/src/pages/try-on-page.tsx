import { SimpleTryOnComponent } from "../components/kling/simple-tryon-improved";
import { Sparkles, ImageIcon, Info } from "lucide-react";

export default function TryOnPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-3xl mx-auto mb-8">
        <h1 className="text-4xl font-bold mb-2 text-center flex items-center justify-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            Virtual Try-On
          </span>
        </h1>
        <p className="text-center mb-4 text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Upload a photo of a person and a garment to see how the clothing would look on the model using artificial intelligence.
        </p>
        <div className="flex justify-center mb-8">
          <div className="flex space-x-1 items-center text-xs text-muted-foreground">
            <span className="inline-block h-3 w-3 rounded-full bg-primary/20"></span>
            <span>Powered by AI - Results in seconds</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <SimpleTryOnComponent />
      </div>

      <div className="mt-12 max-w-2xl mx-auto bg-muted/30 p-6 rounded-lg border border-primary/10">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-primary/70" />
          <h2 className="text-xl font-semibold">Instructions</h2>
        </div>
        <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
          <li>The model image should clearly show the person from the front or at a slightly angled position.</li>
          <li>The garment should be clearly visible and preferably on a white or neutral background.</li>
          <li>Images must be in JPEG format for the best compatibility with our AI system.</li>
          <li>The process may take between 10-20 seconds depending on the image size and complexity.</li>
          <li>For optimal results, ensure images have proper lighting and clear visibility of the model and garment.</li>
        </ul>
        <div className="mt-4 pt-4 border-t border-primary/10 text-sm text-muted-foreground flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary/60" />
          <span>Our AI technology ensures high-quality virtual try-on experiences with realistic garment draping and shadows.</span>
        </div>
      </div>
    </div>
  );
}