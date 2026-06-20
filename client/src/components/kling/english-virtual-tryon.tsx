import { useState, useRef, useEffect } from 'react';
import { logger } from "@/lib/logger";
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Separator } from "../ui/separator";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import { useToast } from "../../hooks/use-toast";
import {
  Camera,
  Upload,
  Sparkles,
  History,
  Image as ImageIcon,
  Shirt,
  Download,
  Save,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Tally3,
  Settings,
  Sliders,
  AlignVerticalJustifyCenter,
  ChevronDown,
  ChevronUp,
  Undo2,
  Ghost,
  FileWarning,
  Expand,
  ExternalLink,
  RefreshCw,
  Dices
} from "lucide-react";

/**
 * Types for the component
 */
interface TryOnResult {
  success: boolean;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  taskId?: string;
  resultImage?: string;
  createdAt?: string;
  errorMessage?: string;
  progress?: number;
  id?: string;
}

import { klingService } from '../../services/kling/kling-service';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

/**
 * EnglishVirtualTryOn Component
 * A complete Virtual Try-On component with improved JPEG handling and English interface
 */
export function EnglishVirtualTryOn() {
  const [modelImage, setModelImage] = useState<string>('');
  const [clothingImage, setClothingImage] = useState<string>('');
  const [modelFileInput, setModelFileInput] = useState<File | null>(null);
  const [clothingFileInput, setClothingFileInput] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TryOnResult | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [savedResults, setSavedResults] = useState<TryOnResult[]>([]);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const { toast } = useToast();

  // Advanced configuration
  const [preserveModelDetails, setPreserveModelDetails] = useState<boolean>(true);
  const [preserveClothingDetails, setPreserveClothingDetails] = useState<boolean>(true);
  const [enhanceFace, setEnhanceFace] = useState<boolean>(true);
  const [alignment, setAlignment] = useState<'auto' | 'manual'>('auto');
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);

  // Load saved results on mount
  useEffect(() => {
    loadSavedResults();
  }, []);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  // Fetch saved results from localStorage
  const loadSavedResults = async () => {
    try {
      const results = JSON.parse(localStorage.getItem('tryonResults') || '[]');
      setSavedResults(results);
    } catch (error) {
      logger.error('Error loading saved results:', error);
    }
  };

  // Handle file upload for model or clothing
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    setImage: React.Dispatch<React.SetStateAction<string>>,
    setFile: React.Dispatch<React.SetStateAction<File | null>>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset previous results
    setResult(null);
    setTaskId(null);
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }

    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload only image files (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    setFile(file);
    
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

      // Clean up existing polling
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }

      const startResult = await klingService.startTryOn(modelImage, clothingImage);
      
      if (!startResult.success) {
        throw new Error(startResult.errorMessage || 'Failed to start try-on process');
      }

      setTaskId(startResult.taskId || null);
      setTaskStatus(startResult);

      // Start polling for status updates
      if (startResult.taskId) {
        const intervalId = setInterval(async () => {
          try {
            const statusResult = await klingService.checkTryOnStatus(startResult.taskId!);
            setTaskStatus(statusResult);

            // When process is completed or failed, stop polling
            if (statusResult.status === 'completed' || statusResult.status === 'failed') {
              clearInterval(intervalId);
              setPollInterval(null);
              setIsLoading(false);

              if (statusResult.status === 'completed') {
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
            logger.error('Error in polling interval:', error);
          }
        }, 2000); // Check every 2 seconds

        setPollInterval(intervalId);
      }
    } catch (error: any) {
      setIsLoading(false);
      toast({
        title: "Error",
        description: error.message || "An error occurred while starting the process",
        variant: "destructive",
      });
    }
  };

  // Reset all inputs and results
  const handleReset = () => {
    setModelImage('');
    setClothingImage('');
    setModelFileInput(null);
    setClothingFileInput(null);
    setResult(null);
    setTaskId(null);
    setTaskStatus(null);
    
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    
    setIsLoading(false);
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
        id: Date.now().toString(),
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
      
      // Refresh the saved results list
      loadSavedResults();
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Could not save the result. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Delete a saved result
  const handleDeleteResult = async (id: string) => {
    try {
      await axios.delete(`/api/kling/results/${id}`);
      
      toast({
        title: "Deleted successfully",
        description: "The saved result has been removed",
      });
      
      // Update the saved results list
      setSavedResults(savedResults.filter(item => item.id !== id));
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Could not delete the result. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Download a try-on result image
  const handleDownloadImage = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `virtual-tryon-${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Select a sample model or clothing image
  const handleUseSampleImage = (imageType: 'model' | 'clothing', index: number) => {
    const sampleImages = {
      model: [
        '/assets/sample-images/model-1.jpg',
        '/assets/sample-images/model-2.jpg'
      ],
      clothing: [
        '/assets/sample-images/clothing-1.jpg',
        '/assets/sample-images/clothing-2.jpg'
      ]
    };
    
    // If sample images are available, use them directly
    if (imageType === 'model') {
      fetch(sampleImages.model[index] || `/assets/sample-model-${index + 1}.jpg`)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              setModelImage(e.target.result as string);
              setModelFileInput(null);
            }
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          logger.error('Error loading sample image:', error);
          toast({
            title: "Error",
            description: "Failed to load sample image. Please try uploading your own image.",
            variant: "destructive",
          });
        });
    } else {
      fetch(sampleImages.clothing[index] || `/assets/sample-clothing-${index + 1}.jpg`)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              setClothingImage(e.target.result as string);
              setClothingFileInput(null);
            }
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          logger.error('Error loading sample image:', error);
          toast({
            title: "Error",
            description: "Failed to load sample clothing image. Please try uploading your own image.",
            variant: "destructive",
          });
        });
    }
  };

  // Generate a random look
  const handleGenerateRandomLook = () => {
    // Simulate selecting random samples
    const randomModelIndex = Math.floor(Math.random() * 2);
    const randomClothingIndex = Math.floor(Math.random() * 2);
    
    handleUseSampleImage('model', randomModelIndex);
    handleUseSampleImage('clothing', randomClothingIndex);
  };

  return (
    <div className="space-y-6 px-1 py-2">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-1">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Images</span>
            <span className="inline sm:hidden">Upload</span>
          </TabsTrigger>
          <TabsTrigger value="result" className="flex items-center gap-1">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Results</span>
            <span className="inline sm:hidden">Result</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
            <span className="inline sm:hidden">History</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Model Image Card */}
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-primary/10">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Model Image
                  </CardTitle>
                  <CardDescription>
                    Upload a full-body photo to see how clothes will look on you
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="aspect-square rounded-md overflow-hidden border border-primary/20 bg-muted/30 relative">
                    {modelImage ? (
                      <>
                        <img src={modelImage} alt="Model" className="w-full h-full object-cover" />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-90"
                          onClick={() => setModelImage('')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4">
                        <ImageIcon className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
                        <p className="text-center text-muted-foreground text-sm">
                          Upload a full body photo
                        </p>
                        <p className="text-center text-muted-foreground text-xs mt-1">
                          Front facing, neutral pose works best
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center mt-4">
                    <div>
                      <Label
                        htmlFor="modelImage"
                        className="cursor-pointer inline-flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Model
                      </Label>
                      <input
                        id="modelImage"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, setModelImage, setModelFileInput)}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleUseSampleImage('model', 0)}
                      >
                        Sample 1
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleUseSampleImage('model', 1)}
                      >
                        Sample 2
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            {/* Clothing Image Card */}
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-primary/10">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shirt className="h-5 w-5" />
                    Clothing Image
                  </CardTitle>
                  <CardDescription>
                    Upload a clothing item to try it on virtually
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="aspect-square rounded-md overflow-hidden border border-primary/20 bg-muted/30 relative">
                    {clothingImage ? (
                      <>
                        <img src={clothingImage} alt="Clothing" className="w-full h-full object-cover" />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-90"
                          onClick={() => setClothingImage('')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4">
                        <Shirt className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
                        <p className="text-center text-muted-foreground text-sm">
                          Upload a clothing image
                        </p>
                        <p className="text-center text-muted-foreground text-xs mt-1">
                          Clean background, front view recommended
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center mt-4">
                    <div>
                      <Label
                        htmlFor="clothingImage"
                        className="cursor-pointer inline-flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Clothing
                      </Label>
                      <input
                        id="clothingImage"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, setClothingImage, setClothingFileInput)}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleUseSampleImage('clothing', 0)}
                      >
                        Sample 1
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleUseSampleImage('clothing', 1)}
                      >
                        Sample 2
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
          
          {/* Advanced Options */}
          <div className="border border-primary/10 rounded-md overflow-hidden">
            <div 
              className="p-3 flex justify-between items-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            >
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                <span className="font-medium">Advanced Options</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                {showAdvancedOptions ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {showAdvancedOptions && (
              <div className="p-4 pt-0 border-t border-primary/10 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="preserveModelDetails" className="text-sm">
                        Preserve Model Details
                      </Label>
                      <Switch
                        id="preserveModelDetails"
                        checked={preserveModelDetails}
                        onCheckedChange={setPreserveModelDetails}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Keep facial features and body characteristics of the model
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="preserveClothingDetails" className="text-sm">
                        Preserve Clothing Details
                      </Label>
                      <Switch
                        id="preserveClothingDetails"
                        checked={preserveClothingDetails}
                        onCheckedChange={setPreserveClothingDetails}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Keep pattern details and texture of the clothing item
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enhanceFace" className="text-sm">
                        Enhance Face
                      </Label>
                      <Switch
                        id="enhanceFace"
                        checked={enhanceFace}
                        onCheckedChange={setEnhanceFace}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Improve facial details in the final result
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="alignment" className="text-sm">
                        Alignment Mode
                      </Label>
                      <Select>
                        <option value="auto">Auto</option>
                        <option value="manual">Manual</option>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Choose how to align the clothing on the model
                    </p>
                  </div>
                </div>
                
                {alignment === 'manual' && (
                  <div className="space-y-4 pt-2">
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="offsetX" className="text-sm">
                          Horizontal Offset
                        </Label>
                        <span className="text-xs text-muted-foreground">{offsetX}%</span>
                      </div>
                      <Slider
                        id="offsetX"
                        min={-50}
                        max={50}
                        step={1}
                        value={[offsetX]}
                        onValueChange={(value) => setOffsetX(value[0])}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="offsetY" className="text-sm">
                          Vertical Offset
                        </Label>
                        <span className="text-xs text-muted-foreground">{offsetY}%</span>
                      </div>
                      <Slider
                        id="offsetY"
                        min={-50}
                        max={50}
                        step={1}
                        value={[offsetY]}
                        onValueChange={(value) => setOffsetY(value[0])}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Button
              className="gap-2"
              onClick={handleStartTryOn}
              disabled={!modelImage || !clothingImage || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
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
              className="gap-2"
              onClick={handleReset}
            >
              <Undo2 className="h-4 w-4" />
              Reset
            </Button>
            
            <Button
              variant="ghost"
              className="gap-2"
              onClick={handleGenerateRandomLook}
            >
              <Dices className="h-4 w-4" />
              Random Look
            </Button>
          </div>
          
          {/* Progress Status */}
          {isLoading && taskStatus && (
            <div className="border border-primary/10 rounded-md p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <h3 className="font-medium">Processing Your Request</h3>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Status: {taskStatus.status}</span>
                  <span>{taskStatus.progress || 0}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-300 ease-out"
                    style={{ width: `${taskStatus.progress || 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This usually takes 10-20 seconds to complete
                </p>
              </div>
            </div>
          )}
          
          {/* Error Display */}
          {!isLoading && taskStatus?.status === 'failed' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Process Failed</AlertTitle>
              <AlertDescription>
                {taskStatus.errorMessage || "An error occurred during processing. Please try again."}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        {/* Result Tab */}
        <TabsContent value="result">
          {result && result.resultImage ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <Card className="overflow-hidden border-primary/10">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Generated Result
                  </CardTitle>
                  <CardDescription>
                    Your virtual try-on has been successfully generated
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="rounded-md overflow-hidden border border-primary/20 relative group">
                    <img 
                      src={result.resultImage} 
                      alt="Try-On Result" 
                      className="w-full h-auto"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200"></div>
                    <Button 
                      variant="secondary"
                      size="icon"
                      className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      onClick={() => window.open(result.resultImage, '_blank')}
                    >
                      <Expand className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    <Button
                      variant="default"
                      className="gap-2"
                      onClick={handleSaveResult}
                    >
                      <Save className="h-4 w-4" />
                      Save Result
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => result.resultImage && handleDownloadImage(result.resultImage)}
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    
                    <Button
                      variant="ghost"
                      className="gap-2"
                      onClick={() => setResult(null)}
                    >
                      <Undo2 className="h-4 w-4" />
                      New Try-On
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="overflow-hidden border-primary/10">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tally3 className="h-5 w-5" />
                    Comparison
                  </CardTitle>
                  <CardDescription>
                    Compare the original images with the generated result
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <div className="aspect-square rounded-md overflow-hidden border border-primary/20">
                        <img src={modelImage} alt="Model" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-center text-muted-foreground">Model</p>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="aspect-square rounded-md overflow-hidden border border-primary/20">
                        <img src={clothingImage} alt="Clothing" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-center text-muted-foreground">Clothing</p>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="aspect-square rounded-md overflow-hidden border border-primary/20">
                        <img src={result.resultImage} alt="Result" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-center text-muted-foreground">Result</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <Ghost className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
              <h3 className="text-lg font-medium">No Result Available</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Generate a virtual try-on first using the Upload tab.
                Upload a model image and clothing to see how they look together.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  const uploadTab = document.querySelector('[data-value="upload"]') as HTMLElement;
                  uploadTab?.click();
                }}
              >
                Go to Upload
              </Button>
            </div>
          )}
        </TabsContent>
        
        {/* History Tab */}
        <TabsContent value="history">
          {savedResults.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {savedResults.map((item, index) => (
                  <Card key={item.id || index} className="overflow-hidden border-primary/10">
                    <CardContent className="p-0">
                      <div className="aspect-square relative">
                        <img 
                          src={item.resultImage} 
                          alt={`Saved result ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50"></div>
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                          <p className="text-sm font-medium truncate">
                            Try-On Result {index + 1}
                          </p>
                          <p className="text-xs opacity-80">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Date not available'}
                          </p>
                        </div>
                        
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full opacity-90"
                            onClick={() => handleDownloadImage(item.resultImage!)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-8 w-8 rounded-full opacity-90"
                            onClick={() => handleDeleteResult(item.id!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <History className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
              <h3 className="text-lg font-medium">No Saved Results</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your saved try-on results will appear here.
                Generate and save results to build your history.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Tips Card */}
      <Card className="bg-primary/5 border-primary/10">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileWarning className="h-4 w-4" />
            Tips for Best Results
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ul className="text-xs space-y-1 text-muted-foreground">
            <li>• Use front-facing photos with neutral poses</li>
            <li>• Ensure good lighting and clear visibility</li>
            <li>• Clothing images work best with minimal background</li>
            <li>• Full body shots provide the most accurate results</li>
            <li>• If you encounter issues, try different images or angles</li>
          </ul>
        </CardContent>
      </Card>
      
      {/* Help Link */}
      <div className="text-center">
        <a 
          href="/help/virtual-tryon" 
          target="_blank"
          className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Learn more about Virtual Try-On technology
        </a>
      </div>
    </div>
  );
}

// Placeholder Selection component
function Select({ children }: { children: React.ReactNode }) {
  return (
    <select className="h-9 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
      {children}
    </select>
  );
}