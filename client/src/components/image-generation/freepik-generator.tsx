/**
import { logger } from "@/lib/logger";
 * Freepik Image Generator Component
 * 
 * This component provides a dedicated UI for generating images exclusively with Freepik's API,
 * with built-in Firestore integration for storage and retrieval.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Loader2, Image as ImageIcon, Save } from 'lucide-react';
import { FreepikModel } from '../../lib/api/freepik-service';
import { ImageResult } from '../../lib/api/multi-platform-generator';
import { freepikStorageService } from '../../lib/api/freepik-storage-service';
import { multiPlatformGenerator } from '../../lib/api/multi-platform-generator';
import { GenerateImageParams } from '../../lib/types/model-types';
import { useToast } from '../../hooks/use-toast';

interface FreepikGeneratorProps {
  onGeneratedImage?: (image: ImageResult) => void;
  onImageSelected?: (image: ImageResult) => void;
  isGenerating?: boolean;
  setIsGenerating?: (isGenerating: boolean) => void;
}

export function FreepikGenerator({ 
  onGeneratedImage, 
  onImageSelected, 
  isGenerating: externalIsGenerating, 
  setIsGenerating: externalSetIsGenerating 
}: FreepikGeneratorProps) {
  // State for form inputs
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [model, setModel] = useState<FreepikModel>(FreepikModel.MYSTIC);
  const [localIsGenerating, localSetIsGenerating] = useState(false);
  
  // Use the external state if provided, otherwise use local state
  const isGenerating = externalIsGenerating !== undefined ? externalIsGenerating : localIsGenerating;
  const setIsGenerating = externalSetIsGenerating || localSetIsGenerating;
  const [generatedImage, setGeneratedImage] = useState<ImageResult | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [savedImages, setSavedImages] = useState<ImageResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('generate');
  
  const { toast } = useToast();
  
  // Load saved images on component mount
  useEffect(() => {
    async function loadSavedImages() {
      try {
        setIsLoading(true);
        const images = await freepikStorageService.getImages();
        // Filter out images without URLs (pending tasks)
        const completedImages = images.filter(img => img.url && img.url.length > 0);
        logger.info(`Loaded ${completedImages.length} saved Freepik images`);
        setSavedImages(completedImages);
      } catch (error) {
        logger.error('Error loading saved Freepik images:', error);
        toast({
          title: 'Error loading images',
          description: 'Could not load saved images',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    loadSavedImages();
  }, [toast]);
  
  // Poll for task status updates
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (pendingTaskId) {
      interval = setInterval(async () => {
        try {
          const result = await multiPlatformGenerator.checkTaskStatus(pendingTaskId, 'freepik');
          if (result) {
            logger.info('Task status update:', result);
            if (result.status === 'COMPLETED' && result.url) {
              // Task completed, update state and clear interval
              setGeneratedImage(result);
              setPendingTaskId(null);
              setIsGenerating(false);
              if (onGeneratedImage) {
                onGeneratedImage(result);
              }
              toast({
                title: 'Image Generated',
                description: 'Your image has been successfully generated',
              });
              // Add to saved images if not already there
              setSavedImages(prev => {
                if (!prev.some(img => img.url === result.url)) {
                  return [result, ...prev];
                }
                return prev;
              });
            } else if (result.status === 'FAILED') {
              // Task failed
              setPendingTaskId(null);
              setIsGenerating(false);
              toast({
                title: 'Generation Failed',
                description: 'Failed to generate image. Please try again with a different prompt.',
                variant: 'destructive'
              });
            }
          }
        } catch (error) {
          logger.error('Error checking task status:', error);
        }
      }, 3000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [pendingTaskId, onGeneratedImage, toast]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      toast({
        title: 'Input required',
        description: 'Please enter a prompt',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setIsGenerating(true);
      
      // Set up generation parameters
      const params: GenerateImageParams = {
        prompt,
        apiProvider: 'freepik',
        aspectRatio,
        freepikModel: model
      };
      
      // Check for similar existing images first
      const existingImages = await freepikStorageService.getImages();
      const similarImage = existingImages.find(img => 
        img.status === 'COMPLETED' && 
        img.url && 
        img.prompt && 
        img.prompt.toLowerCase().includes(prompt.toLowerCase().slice(0, 10))
      );
      
      if (similarImage) {
        logger.info('Found similar existing image:', similarImage);
        setGeneratedImage(similarImage);
        setIsGenerating(false);
        if (onGeneratedImage) {
          onGeneratedImage(similarImage);
        }
        toast({
          title: 'Similar Image Found',
          description: 'We found a similar image that was previously generated',
        });
        return;
      }
      
      // Generate new image
      const result = await multiPlatformGenerator.generateImage(params);
      
      // If we get back a task ID, store it for polling
      if (result.taskId) {
        setPendingTaskId(result.taskId);
        
        // Store this pending task in Firestore
        if (!result.firestoreId) {
          const firestoreId = await freepikStorageService.saveImage({
            ...result,
            prompt // Make sure prompt is stored
          });
          logger.info('Stored pending task in Firestore:', firestoreId);
        }
      } 
      // If we immediately got back a URL, we're done
      else if (result.url) {
        setGeneratedImage(result);
        setIsGenerating(false);
        if (onGeneratedImage) {
          onGeneratedImage(result);
        }
        
        // Add to saved images if not already there
        setSavedImages(prev => {
          if (!prev.some(img => img.url === result.url)) {
            return [result, ...prev];
          }
          return prev;
        });
      }
    } catch (error) {
      logger.error('Error generating image:', error);
      setIsGenerating(false);
      toast({
        title: 'Generation Error',
        description: error instanceof Error ? error.message : 'Failed to generate image',
        variant: 'destructive'
      });
    }
  };
  
  // Handle image selection from gallery
  const handleImageSelect = (image: ImageResult) => {
    setGeneratedImage(image);
    if (onImageSelected) {
      onImageSelected(image);
    }
    setActiveTab('generate');
  };
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Freepik Image Generator
        </CardTitle>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="gallery">Gallery ({savedImages.length})</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="generate">
          <CardContent className="space-y-4 pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Textarea 
                  placeholder="Describe the image you want to generate in detail..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Aspect Ratio</label>
                  <Select 
                    value={aspectRatio} 
                    onValueChange={setAspectRatio}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select aspect ratio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1:1">Square (1:1)</SelectItem>
                      <SelectItem value="4:3">Classic (4:3)</SelectItem>
                      <SelectItem value="3:4">Portrait (3:4)</SelectItem>
                      <SelectItem value="16:9">Widescreen (16:9)</SelectItem>
                      <SelectItem value="9:16">Mobile (9:16)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Freepik Model</label>
                  <Select 
                    value={model} 
                    onValueChange={(value) => setModel(value as FreepikModel)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FreepikModel.MYSTIC}>Mystic (Best)</SelectItem>
                      <SelectItem value={FreepikModel.IMAGEN3}>Imagen3</SelectItem>
                      <SelectItem value={FreepikModel.CLASSIC}>Classic</SelectItem>
                      <SelectItem value={FreepikModel.FLUX_DEV}>Flux Dev</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : 'Generate Image'}
              </Button>
            </form>
            
            {generatedImage && generatedImage.url && (
              <div className="mt-6 space-y-4">
                <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img 
                    src={generatedImage.url} 
                    alt={generatedImage.prompt || 'Generated image'} 
                    className="w-full h-auto"
                  />
                </div>
                
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {generatedImage.prompt && (
                    <p className="mb-1"><span className="font-medium">Prompt:</span> {generatedImage.prompt}</p>
                  )}
                  <p className="mb-1"><span className="font-medium">Provider:</span> {generatedImage.provider}</p>
                  <p><span className="font-medium">Created:</span> {generatedImage.createdAt.toLocaleString()}</p>
                </div>
              </div>
            )}
          </CardContent>
        </TabsContent>
        
        <TabsContent value="gallery">
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : savedImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {savedImages.map((image) => (
                  <div 
                    key={image.firestoreId || image.url} 
                    className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => handleImageSelect(image)}
                  >
                    <img 
                      src={image.url} 
                      alt={image.prompt || 'Generated image'} 
                      className="w-full h-auto aspect-square object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <ImageIcon className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">No saved images found</p>
                <p className="text-sm text-gray-400 mt-1">Generate some images to see them here</p>
              </div>
            )}
          </CardContent>
        </TabsContent>
      </Tabs>
      
      <CardFooter className="flex justify-between border-t px-6 py-4">
        <div className="text-xs text-gray-500">
          Powered by Freepik AI
        </div>
        {generatedImage && generatedImage.url && (
          <Button variant="outline" size="sm" onClick={() => window.open(generatedImage.url, '_blank')}>
            <Save className="h-4 w-4 mr-2" />
            View Full Image
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}