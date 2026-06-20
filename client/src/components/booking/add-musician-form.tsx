import { useState, useRef } from "react";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { useToast } from "../../hooks/use-toast";
import { generateImageFromPrompt } from "../../lib/api/gemini-image";
import { Loader2, Image as ImageIcon, Upload, ChevronDown, FileText, X } from "lucide-react";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { z } from "zod";
import musicianPrompts from "../../data/musician-prompts.json";
import { ensureArtistProfile, updateProfileImages } from "../../lib/auto-profile-service";

interface AddMusicianFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const musicianFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Price must be a positive number"),
  category: z.string().min(1, "Category is required"),
  instrument: z.string().min(1, "Instrument is required"),
  genres: z.string().min(1, "At least one genre is required"),
});

export function AddMusicianForm({ onClose, onSuccess }: AddMusicianFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    instrument: "",
    genres: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - Accept all image formats including HEIC (iPhone)
    const validImageTypes = ['image/', '.heic', '.heif'];
    const isValidImage = validImageTypes.some(type => 
      file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
    );
    
    if (!isValidImage) {
      toast({
        title: "Invalid File Type",
        description: "Please select a valid image file (JPG, PNG, WEBP, HEIC, etc.)",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 10MB",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setReferenceImageFile(file);
    
    // Read file as base64 data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setReferenceImagePreview(base64String);
      logger.info("✅ Reference image loaded successfully");
      logger.info("   - File size:", (file.size / 1024).toFixed(2), "KB");
      logger.info("   - Base64 length:", base64String.length);
      toast({
        title: "Reference Image Uploaded ✓",
        description: "Ready to generate professional photo with Gemini AI",
      });
    };
    reader.onerror = () => {
      logger.error("❌ Error reading file:", reader.error);
      toast({
        title: "Upload Failed",
        description: "Failed to read the image file. Please try again.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const clearReferenceImage = () => {
    setReferenceImageFile(null);
    setReferenceImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    logger.info("Reference image cleared");
    toast({
      title: "Reference Removed",
      description: "Reference photo has been cleared",
    });
  };

  const handleGenerateImage = async () => {
    if (!formData.category || !formData.instrument) {
      toast({
        title: "Missing Information",
        description: "Please select a category and instrument before generating an image",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingImage(true);
    try {
      // Get professional prompt from JSON based on category
      const categoryPrompts = musicianPrompts[formData.category as keyof typeof musicianPrompts] || musicianPrompts.Other;
      let prompt = categoryPrompts.prompt;
      let negativePrompt = categoryPrompts.negativePrompt;
      
      // Customize prompt with specific instrument
      prompt = prompt.replace(/guitar|drums|piano|vocals|bass/gi, formData.instrument.toLowerCase());
      
      let result;
      
      // Use Gemini with face reference if user uploaded a reference image
      if (referenceImagePreview) {
        toast({
          title: "Processing with Gemini",
          description: "Generating professional photo based on your reference image...",
        });
        
        // Extract base64 from data URL (remove the data:image/xxx;base64, prefix)
        const base64Data = referenceImagePreview.includes(',') 
          ? referenceImagePreview.split(',')[1] 
          : referenceImagePreview;
        
        logger.info("Sending reference image to FAL, base64 length:", base64Data.length);
        
        const response = await fetch('/api/fal/nano-banana/generate-with-face', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            referenceImages: [referenceImagePreview], // FAL accepts full data URL
            aspectRatio: '1:1' // Square for portraits
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        result = await response.json();
        // Convert FAL response format
        if (result.imageUrl) {
          result.success = true;
        }
        logger.info("FAL response received, success:", result.success);
      } else {
        // Generate without reference image using FAL
        toast({
          title: "Generating with FAL AI",
          description: "Creating professional musician portrait...",
        });
        
        const response = await fetch('/api/fal/nano-banana/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            aspectRatio: '1:1'
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        
        result = await response.json();
        if (result.imageUrl) {
          result.success = true;
        }
      }

      if (result.success && (result.imageUrl || result.imageBase64)) {
        // Use imageUrl directly or convert base64 to data URL for display
        const imageDataUrl = result.imageUrl || `data:image/png;base64,${result.imageBase64}`;
        setGeneratedImageUrl(imageDataUrl);
        logger.info("Generated image set successfully");
        toast({
          title: "Success!",
          description: `Professional ${formData.category} photo generated with FAL AI`,
        });
      } else {
        throw new Error(result.error || "No image data in response");
      }
    } catch (error) {
      logger.error("Error generating image with FAL:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate profile image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptedTerms) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms and conditions to continue",
        variant: "destructive",
      });
      return;
    }

    const validation = musicianFormSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }

    if (!generatedImageUrl) {
      toast({
        title: "Missing Image",
        description: "Please generate a profile image first",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const genresList = formData.genres.split(',').map(g => g.trim()).filter(g => g.length > 0);

      // 🎨 AUTO-PERFIL: Crear/verificar perfil de artista antes de guardar músico
      let profileSlug = null;
      try {
        logger.info('🎨 Creando/verificando perfil de artista para músico...');
        
        const profileResult = await ensureArtistProfile(genresList[0] || formData.instrument);
        
        if (profileResult.success && profileResult.profile) {
          profileSlug = profileResult.profile.slug;
          logger.info('✅ Perfil verificado/creado:', profileSlug);
          
          // Actualizar imagen de perfil con foto profesional generada
          const imageUpdateResult = await updateProfileImages({
            profileImageUrl: generatedImageUrl,
            onlyIfEmpty: true // Solo actualizar si no tiene foto de perfil
          });
          
          if (imageUpdateResult.success) {
            logger.info('✅ Imagen de perfil actualizada con foto profesional');
            toast({
              title: "Perfil de Artista Creado",
              description: `Tu perfil público está disponible en /artist/${profileSlug}`,
            });
          }
        }
      } catch (profileError) {
        // No bloqueamos el registro del músico si falla el auto-perfil
        logger.warn('⚠️ Error creando perfil automático (no crítico):', profileError);
      }

      const musicianData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        instrument: formData.instrument,
        genres: genresList,
        photo: generatedImageUrl, // Base64 data URL from Gemini
        referencePhoto: referenceImagePreview || null, // Base64 data URL if uploaded
        rating: "5.0",
        totalReviews: 0,
        isActive: true,
      };

      logger.info("Submitting musician data to database:", {
        ...musicianData,
        photo: `[base64 ${generatedImageUrl?.length} chars]`,
        referencePhoto: referenceImagePreview ? `[base64 ${referenceImagePreview.length} chars]` : null
      });

      const response = await fetch('/api/musicians', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(musicianData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save musician: ${response.status}`);
      }

      const savedMusician = await response.json();

      logger.info("Musician saved to database successfully:", savedMusician);

      await queryClient.invalidateQueries({ queryKey: ['/api/musicians'] });

      toast({
        title: "Success",
        description: profileSlug 
          ? `Musician added successfully! View your profile at /artist/${profileSlug}`
          : "Musician added successfully to the database",
      });

      if (onSuccess) {
        try {
          await onSuccess();
        } catch (callbackError) {
          logger.error("Error in onSuccess callback:", callbackError);
        }
      }
      
      if (onClose) {
        onClose();
      }
    } catch (error) {
      logger.error("Error adding musician:", error instanceof Error ? error.message : error, error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add musician",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const categories = ["Guitar", "Drums", "Piano", "Vocals", "Bass", "Production", "Brass", "Strings", "Other"];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 max-h-[80vh] overflow-y-auto px-1">
      <div>
        <h3 className="text-lg sm:text-xl font-semibold mb-2">Add New Musician</h3>
        <p className="text-sm text-muted-foreground mb-4 sm:mb-6">
          Fill in the details to add a new professional musician to the platform
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6">
        {/* Two-column layout on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-sm">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              required
              data-testid="input-musician-name"
              placeholder="e.g., John Smith"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category" className="text-sm">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select required value={formData.category} onValueChange={(value) => handleChange("category", value)}>
              <SelectTrigger data-testid="select-musician-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="instrument" className="text-sm">
              Instrument <span className="text-destructive">*</span>
            </Label>
            <Input
              id="instrument"
              required
              data-testid="input-musician-instrument"
              placeholder="e.g., Electric Guitar, Drums, Piano"
              value={formData.instrument}
              onChange={(e) => handleChange("instrument", e.target.value)}
              className={errors.instrument ? "border-destructive" : ""}
            />
            {errors.instrument && <p className="text-xs text-destructive">{errors.instrument}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="price" className="text-sm">
              Price per Session ($) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="price"
              type="number"
              required
              data-testid="input-musician-price"
              min="0"
              step="0.01"
              placeholder="e.g., 120"
              value={formData.price}
              onChange={(e) => handleChange("price", e.target.value)}
              className={errors.price ? "border-destructive" : ""}
            />
            {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="genres" className="text-sm">
            Genres (comma-separated) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="genres"
            required
            data-testid="input-musician-genres"
            placeholder="e.g., Rock, Blues, Jazz"
            value={formData.genres}
            onChange={(e) => handleChange("genres", e.target.value)}
            className={errors.genres ? "border-destructive" : ""}
          />
          {errors.genres && <p className="text-xs text-destructive">{errors.genres}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description" className="text-sm">
            Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            required
            data-testid="textarea-musician-description"
            placeholder="Describe the musician's experience, expertise, and notable achievements..."
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            className={`min-h-[100px] ${errors.description ? "border-destructive" : ""}`}
          />
          {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
        </div>

        {/* Reference Image Upload Section */}
        <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
          <div className="flex items-center justify-between">
            <Label htmlFor="reference-image" className="text-sm font-semibold">
              Reference Photo (Optional) - Uses Gemini AI
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              id="reference-image"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={handleReferenceImageUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="button-upload-reference"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Reference
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Upload a reference photo. Gemini Imagen 3 will generate a similar professional musician portrait
          </p>
          {referenceImagePreview && (
            <div className="relative aspect-video rounded-lg overflow-hidden border bg-muted">
              <img
                src={referenceImagePreview}
                alt="Reference"
                className="w-full h-full object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                data-testid="button-clear-reference"
                onClick={clearReferenceImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Image Generation Section */}
        <div className="space-y-4 pt-2">
          <Button
            type="button"
            onClick={handleGenerateImage}
            disabled={isGeneratingImage || !formData.category || !formData.instrument}
            variant="secondary"
            data-testid="button-generate-image"
            className="w-full"
          >
            {isGeneratingImage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Profile Image...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                Generate with Gemini (nano banana)
              </>
            )}
          </Button>

          {generatedImageUrl && (
            <div className="aspect-video relative rounded-lg overflow-hidden border-2 border-primary">
              <img
                src={generatedImageUrl}
                alt="Generated profile"
                data-testid="img-generated-musician"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-xs text-white font-semibold">✓ Profile Photo Generated</p>
              </div>
            </div>
          )}
        </div>

        {/* Terms and Conditions */}
        <div className="border rounded-lg">
          <Collapsible open={isTermsOpen} onOpenChange={setIsTermsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
                data-testid="button-toggle-terms"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Terms & Conditions for Musicians</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isTermsOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              <div className="space-y-4 text-xs text-muted-foreground max-h-[300px] overflow-y-auto border rounded p-4 bg-muted/10">
                
                <div>
                  <h4 className="font-semibold text-foreground mb-2">1. Platform Commission</h4>
                  <p>
                    By registering as a musician, you agree that the platform will retain a 20% commission on all bookings.
                    You will receive 80% of the session price directly to your account.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">2. Professional Standards</h4>
                  <p>
                    All musicians must maintain professional standards in communication, delivery quality, and adherence to project
                    deadlines. Failure to meet these standards may result in account suspension.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">3. Payment Processing</h4>
                  <p>
                    Payments are processed through Stripe. Funds from completed bookings are transferred within 3-5 business days
                    after project completion and client approval.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">4. Profile Accuracy</h4>
                  <p>
                    You agree to provide accurate information about your skills, experience, and availability. Misleading
                    information may result in immediate account termination.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">5. Client Communication</h4>
                  <p>
                    All communication with clients must occur through the platform's messaging system. Direct solicitation
                    outside the platform is prohibited.
                  </p>
                </div>

                <div className="pt-2 border-t">
                  <p className="italic text-foreground">
                    By checking the box below, you acknowledge that you have read and agree to these terms and conditions.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Terms Acceptance Checkbox */}
        <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/20">
          <input
            type="checkbox"
            id="accept-terms"
            checked={acceptedTerms}
            data-testid="checkbox-accept-terms"
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="accept-terms" className="text-sm cursor-pointer">
            I have read and accept the Terms & Conditions for musicians on this platform
            <span className="text-destructive ml-1">*</span>
          </label>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onClose}
          data-testid="button-cancel"
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || !generatedImageUrl || !acceptedTerms} 
          data-testid="button-submit-musician"
          className="w-full sm:w-auto bg-primary"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Musician...
            </>
          ) : (
            "Add Musician to Platform"
          )}
        </Button>
      </div>
    </form>
  );
}
