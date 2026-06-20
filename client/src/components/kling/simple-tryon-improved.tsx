import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Progress } from "../ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useToast } from "../../hooks/use-toast";
import { Upload, Camera, RefreshCw, Sparkles, X, Check, Download, Save } from "lucide-react";
import { klingService, TryOnResult } from "../../services/kling/kling-service";

/**
 * SimpleTryOnComponent
 * An improved version of the Try-On functionality with enhanced JPEG handling and error management
 */
export function SimpleTryOnComponent() {
  const [modelImage, setModelImage] = useState<string>("");
  const [clothingImage, setClothingImage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  // Handle file upload for model or clothing
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    setImage: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset previous results
    setResult(null);
    setTaskId(null);
    setProgress(0);
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }

    // Validate file is an image
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload only image files (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Read and convert to data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Start the try-on process
  const handleStartTryOn = async () => {
    if (!modelImage || !clothingImage) {
      toast({
        title: "Missing images",
        description: "Please upload both a model and clothing image to continue",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      setResult(null);
      setProgress(0);

      // Clean up existing polling
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }

      const startResult = await klingService.startTryOn(modelImage, clothingImage);
      
      if (!startResult.success) {
        throw new Error(startResult.errorMessage || "Failed to start try-on process");
      }

      setTaskId(startResult.taskId || null);
      setProgress(10); // Initial progress

      // Start polling for status updates
      if (startResult.taskId) {
        const intervalId = setInterval(async () => {
          try {
            const statusResult = await klingService.checkTryOnStatus(startResult.taskId!);
            
            // Update progress based on status
            if (statusResult.status === "pending") {
              setProgress((prev) => Math.min(prev + 5, 40));
            } else if (statusResult.status === "processing") {
              setProgress((prev) => Math.min(prev + 10, 80));
            }

            // When process is completed or failed, stop polling
            if (statusResult.status === "completed" || statusResult.status === "failed") {
              clearInterval(intervalId);
              setPollInterval(null);
              setIsLoading(false);
              setProgress(statusResult.status === "completed" ? 100 : 0);

              if (statusResult.status === "completed") {
                setResult(statusResult);
                toast({
                  title: "Success!",
                  description: "Virtual try-on completed successfully",
                });
              } else {
                toast({
                  title: "Process Failed",
                  description: statusResult.errorMessage || "Failed to generate try-on result",
                  variant: "destructive",
                });
              }
            }
          } catch (error) {
            logger.error("Error in polling interval:", error);
          }
        }, 2000); // Check every 2 seconds

        setPollInterval(intervalId);
      }
    } catch (error: any) {
      setIsLoading(false);
      setProgress(0);
      
      toast({
        title: "Error",
        description: error.message || "An error occurred while starting the process",
        variant: "destructive",
      });
    }
  };

  // Reset all inputs and results
  const handleReset = () => {
    setModelImage("");
    setClothingImage("");
    setResult(null);
    setTaskId(null);
    setProgress(0);
    
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    
    setIsLoading(false);
  };

  // Download a try-on result image
  const handleDownloadImage = (imageUrl: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `virtual-tryon-${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save a successful result - saves to localStorage
  const handleSaveResult = async () => {
    if (!result || !result.resultImage) {
      toast({
        title: "No result to save",
        description: "There is no completed try-on result to save",
        variant: "destructive",
      });
      return;
    }

    try {
      // Save to localStorage
      const savedResults = JSON.parse(localStorage.getItem('tryonResults') || '[]');
      savedResults.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        resultImage: result.resultImage,
        modelImage,
        clothingImage
      });
      localStorage.setItem('tryonResults', JSON.stringify(savedResults));
      
      toast({
        title: "Saved successfully",
        description: "The try-on result has been saved to your local history",
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Could not save the result. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Model Image Upload */}
        <div className="space-y-2">
          <Label htmlFor="modelImage" className="text-sm font-medium">
            Model Image
          </Label>
          
          <div className="aspect-square relative bg-muted/40 rounded-md overflow-hidden border border-input flex items-center justify-center">
            {modelImage ? (
              <>
                <img 
                  src={modelImage} 
                  alt="Model" 
                  className="w-full h-full object-cover"
                />
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-2 right-2 h-8 w-8 opacity-80 hover:opacity-100"
                  onClick={() => setModelImage("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="text-center p-4">
                <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Upload a model image</p>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <Label 
              htmlFor="modelImage" 
              className="cursor-pointer inline-flex items-center justify-center gap-1 text-sm text-primary py-1 px-2 rounded hover:bg-primary/10"
            >
              <Upload className="h-3 w-3" />
              {modelImage ? "Change" : "Upload"} model
            </Label>
            <Input 
              id="modelImage" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => handleFileChange(e, setModelImage)}
            />
          </div>
        </div>

        {/* Clothing Image Upload */}
        <div className="space-y-2">
          <Label htmlFor="clothingImage" className="text-sm font-medium">
            Clothing Image
          </Label>
          
          <div className="aspect-square relative bg-muted/40 rounded-md overflow-hidden border border-input flex items-center justify-center">
            {clothingImage ? (
              <>
                <img 
                  src={clothingImage} 
                  alt="Clothing" 
                  className="w-full h-full object-cover"
                />
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-2 right-2 h-8 w-8 opacity-80 hover:opacity-100"
                  onClick={() => setClothingImage("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="text-center p-4">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Upload a clothing image</p>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <Label 
              htmlFor="clothingImage" 
              className="cursor-pointer inline-flex items-center justify-center gap-1 text-sm text-primary py-1 px-2 rounded hover:bg-primary/10"
            >
              <Upload className="h-3 w-3" />
              {clothingImage ? "Change" : "Upload"} clothing
            </Label>
            <Input 
              id="clothingImage" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => handleFileChange(e, setClothingImage)}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6 justify-center">
        <Button 
          onClick={handleStartTryOn} 
          disabled={!modelImage || !clothingImage || isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Try-On
            </>
          )}
        </Button>
        
        <Button 
          variant="outline" 
          onClick={handleReset}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reset
        </Button>

        {result?.resultImage && (
          <>
            <Button 
              variant="secondary" 
              onClick={handleSaveResult}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save Result
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={() => handleDownloadImage(result.resultImage!)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </>
        )}
      </div>

      {/* Progress Indicator */}
      {isLoading && (
        <div className="mb-6 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Processing...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-center text-muted-foreground mt-2">
            This process usually takes 10-20 seconds
          </p>
        </div>
      )}

      {/* Result Display */}
      {result?.resultImage && (
        <div className="mt-4 pt-4 border-t border-primary/10">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Check className="h-5 w-5 text-green-500" />
            Generated Result
          </h3>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <img 
                src={result.resultImage} 
                alt="Virtual try-on result" 
                className="w-full max-h-[500px] object-contain"
              />
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Error Alert */}
      {result?.status === "failed" && result.errorMessage && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle className="flex items-center gap-2">
            <X className="h-4 w-4" />
            Process Failed
          </AlertTitle>
          <AlertDescription>
            {result.errorMessage}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}