import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { apiRequest } from "../../lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { useToast } from "../../hooks/use-toast";
import { generateAudioWithFal } from "../../lib/api/fal-ai";
import { PlayCircle, PauseCircle, Loader2, RefreshCw, Trash2, ChevronDown, FileText } from "lucide-react";
import type { MusicianService } from "../../pages/producer-tools";
import { createCheckoutSession } from "../../lib/api/stripe-service";
import { auth } from "../../lib/firebase";

interface BookingFormProps {
  musician: MusicianService;
  onClose: () => void;
}

export function MusicianBookingForm({ musician, onClose }: BookingFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [formData, setFormData] = useState({
    tempo: "",
    key: "",
    style: "",
    additionalNotes: "",
    projectDeadline: "",
    linkedSongProjectId: "",
  });

  // Fetch artist's original song projects for linking
  const { data: projectsData } = useQuery<{ projects: any[] }>({
    queryKey: ['/api/music-original/my'],
    queryFn: () => apiRequest('GET', '/api/music-original/my').then(r => r.json()),
  });

  const inProgressProjects = projectsData?.projects?.filter(
    (p: any) => p.status !== 'failed'
  ) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!auth.currentUser) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to book a session",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      logger.info('Starting booking process with data:', {
        musicianId: musician.id,
        price: musician.price,
        formData
      });

      // Comprobar si el usuario es administrador (convoycubano@gmail.com)
      if (auth.currentUser.email === 'convoycubano@gmail.com') {
        // Proceso especial para administrador (sin pago)
        toast({
          title: "Booking Confirmed",
          description: "As an administrator, your booking has been confirmed without payment.",
          variant: "default",
        });
        
        // Cerrar el modal después de confirmar
        setTimeout(() => {
          onClose();
        }, 2000);
        
        return;
      }

      // Obtener token del usuario autenticado
      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        throw new Error("Could not get authentication token");
      }
      
      // Crear booking de músico con el nuevo endpoint
      const response = await fetch('/api/stripe/create-musician-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          musicianId: musician.id,
          musicianName: musician.title,
          price: musician.price,
          tempo: formData.tempo || null,
          musicalKey: formData.key || null,
          style: formData.style || null,
          projectDeadline: formData.projectDeadline || null,
          additionalNotes: formData.additionalNotes || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create booking');
      }

      if (data.success && data.url) {
        // Redirigir a Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }

    } catch (error) {
      logger.error('Error in booking process:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start checkout process. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateDemo = async () => {
    if (!formData.style || !formData.tempo || !formData.key) {
      toast({
        title: "Missing Information",
        description: "Please fill in the style, tempo, and key before generating a demo",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingDemo(true);
    try {
      const prompt = `Create a ${formData.style} music piece at ${formData.tempo} BPM in the key of ${formData.key}. 
        Style should match a professional ${musician.category.toLowerCase()} musician ${
        musician.title ? `like ${musician.title}` : ""
      }. 
        Include typical ${musician.category.toLowerCase()} elements and techniques.
        ${formData.additionalNotes ? `Additional notes: ${formData.additionalNotes}` : ""}`;

      const response = await generateAudioWithFal({
        prompt,
        duration_seconds: 30
      });

      if (response.data?.audio_file?.url) {
        setAudioUrl(response.data.audio_file.url);
        toast({
          title: "Demo Generated",
          description: "Your music demo has been generated successfully",
        });
      } else {
        throw new Error("No audio URL in response");
      }
    } catch (error) {
      logger.error("Error generating demo:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate audio demo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const deleteDemo = () => {
    setAudioUrl(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    toast({
      title: "Demo Deleted",
      description: "The audio demo has been removed",
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const musicalKeys = [
    "C", "G", "D", "A", "E", "B", "F#",
    "F", "Bb", "Eb", "Ab", "Db", "Gb",
    "Am", "Em", "Bm", "F#m", "C#m", "G#m",
    "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"
  ];

  // Calculate platform fee and musician earnings
  const totalPrice = musician.price;
  const platformFee = totalPrice * 0.20;
  const musicianEarnings = totalPrice * 0.80;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-4">Book Session with {musician.title}</h3>
        <p className="text-sm text-muted-foreground mb-4 sm:mb-6">
          Please provide details about your musical requirements
        </p>
      </div>

      {/* Price Breakdown */}
      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <h4 className="text-sm font-semibold mb-3">Price Breakdown</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Service Price:</span>
            <span className="font-semibold">${totalPrice.toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Platform Fee (20%):</span>
              <span className="text-muted-foreground">${platformFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-green-600 dark:text-green-400 font-medium">Musician Receives (80%):</span>
              <span className="text-green-600 dark:text-green-400 font-bold">${musicianEarnings.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4">
        <div className="grid gap-2">
          <Label htmlFor="tempo" className="text-sm">Tempo (BPM)</Label>
          <Input
            id="tempo"
            type="number"
            min="40"
            max="240"
            placeholder="120"
            className="text-sm"
            onChange={(e) => handleChange("tempo", e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="key" className="text-sm">Musical Key</Label>
          <Select onValueChange={(value) => handleChange("key", value)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select key" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {musicalKeys.map((key) => (
                <SelectItem key={key} value={key} className="text-sm">
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="style" className="text-sm">Style/Genre</Label>
          <Input
            id="style"
            placeholder="e.g., Rock, Jazz, Pop"
            className="text-sm"
            onChange={(e) => handleChange("style", e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="projectDeadline" className="text-sm">Project Deadline</Label>
          <Input
            id="projectDeadline"
            type="date"
            className="text-sm"
            onChange={(e) => handleChange("projectDeadline", e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="additionalNotes" className="text-sm">Additional Notes</Label>
          <Textarea
            id="additionalNotes"
            placeholder="Describe any specific requirements or preferences..."
            className="text-sm min-h-[80px] sm:min-h-[100px]"
            onChange={(e) => handleChange("additionalNotes", e.target.value)}
          />
        </div>

        {/* Link to original song project */}
        {inProgressProjects.length > 0 && (
          <div className="grid gap-2">
            <Label htmlFor="linkedProject" className="text-sm">
              ¿Vincular a un proyecto? <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Select onValueChange={(value) => handleChange("linkedSongProjectId", value === 'none' ? '' : value)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecciona un proyecto de canción..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-sm text-muted-foreground">Sin vincular</SelectItem>
                {inProgressProjects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id} className="text-sm">
                    {p.title} <span className="text-muted-foreground ml-1">({p.genre || 'Sin género'})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El músico quedará registrado en el certificado de autoría de esa canción.
            </p>
          </div>
        )}

        {/* Demo Generation Section */}
        <div className="space-y-3 sm:space-y-4 pt-2 sm:pt-4">
          <div className="flex justify-between items-center">
            <Button
              type="button"
              onClick={generateDemo}
              disabled={isGeneratingDemo || !formData.style || !formData.tempo || !formData.key}
              variant="secondary"
              className="gap-2 text-xs sm:text-sm h-9 sm:h-10"
              size="sm"
            >
              {isGeneratingDemo ? (
                <>
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  <span className="hidden xs:inline">Generating...</span>
                  <span className="xs:hidden">...</span>
                </>
              ) : audioUrl ? (
                <>
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">Regenerate Demo</span>
                  <span className="xs:hidden">Regenerate</span>
                </>
              ) : (
                <>
                  <span className="hidden xs:inline">Generate Demo</span>
                  <span className="xs:hidden">Demo</span>
                </>
              )}
            </Button>
          </div>

          {audioUrl && (
            <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-muted rounded-lg">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                {isPlaying ? (
                  <PauseCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  <PlayCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </Button>
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              <span className="flex-grow text-xs sm:text-sm">Preview your demo</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={deleteDemo}
                className="text-destructive hover:text-destructive h-8 w-8 sm:h-10 sm:w-10"
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Terms and Conditions Section */}
      <div className="border-t pt-4 sm:pt-6 mt-4">
        <Collapsible open={isTermsOpen} onOpenChange={setIsTermsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Booking Terms & Conditions</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  isTermsOpen ? "rotate-180" : ""
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 sm:px-4 pb-4">
            <div className="space-y-4 text-xs sm:text-sm text-muted-foreground mt-4 max-h-[300px] overflow-y-auto">
              
              <div>
                <h4 className="font-semibold text-foreground mb-2">1. Service Agreement</h4>
                <p className="leading-relaxed">
                  By booking a session with a musician through our platform, you agree to receive professional music services 
                  as described in the musician's profile. The musician commits to delivering high-quality work according to 
                  the specifications provided in your booking form.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">2. Payment Terms</h4>
                <p className="leading-relaxed mb-2">
                  Payment is processed securely through Stripe. The total amount shown includes:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>80% goes directly to the musician for their services</li>
                  <li>20% platform fee for facilitating the connection and payment processing</li>
                </ul>
                <p className="leading-relaxed mt-2">
                  All payments are processed in USD. You will be redirected to Stripe's secure checkout page to complete your payment.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">3. Cancellation & Refund Policy</h4>
                <p className="leading-relaxed mb-2">
                  <strong>Cancellation by Client:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Cancellations within 24 hours of booking: Full refund</li>
                  <li>Cancellations 24-48 hours after booking: 50% refund</li>
                  <li>Cancellations after 48 hours or after work has begun: No refund</li>
                </ul>
                <p className="leading-relaxed mt-2 mb-2">
                  <strong>Cancellation by Musician:</strong> If a musician cancels, you will receive a full refund within 5-7 business days.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">4. Project Delivery</h4>
                <p className="leading-relaxed">
                  The musician will deliver the completed work according to the deadline specified in your booking. 
                  Delivery times may vary based on project complexity. You will receive the final files in professional-grade 
                  formats suitable for commercial use.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">5. Intellectual Property Rights</h4>
                <p className="leading-relaxed">
                  Upon full payment, you will own the rights to use the delivered music for your specified project. 
                  The musician retains the right to showcase the work in their portfolio unless otherwise agreed upon. 
                  Additional usage rights or exclusive licenses can be negotiated directly with the musician.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">6. Revisions & Modifications</h4>
                <p className="leading-relaxed">
                  Most bookings include up to 2 rounds of reasonable revisions. Additional revisions may incur extra charges 
                  to be agreed upon between you and the musician. Major changes to the project scope after booking may require 
                  a new agreement.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">7. Communication & Collaboration</h4>
                <p className="leading-relaxed">
                  You and the musician will communicate through our platform's messaging system. Response times may vary, 
                  but musicians are expected to reply within 24-48 hours. For urgent matters, please indicate this in your 
                  initial message.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">8. Quality Guarantee</h4>
                <p className="leading-relaxed">
                  All musicians on our platform are verified professionals. If you're not satisfied with the final delivery, 
                  please contact our support team within 7 days of receiving the files. We'll work to resolve the issue or 
                  facilitate a partial refund if warranted.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">9. Confidentiality</h4>
                <p className="leading-relaxed">
                  Musicians agree to keep your project details confidential. If your project requires an NDA, please discuss 
                  this with the musician before booking, and we can facilitate the signing of appropriate legal documents.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">10. Dispute Resolution</h4>
                <p className="leading-relaxed">
                  In case of disputes, our support team will mediate between you and the musician. If a resolution cannot 
                  be reached, we reserve the right to make a final decision based on our platform policies and the evidence 
                  provided by both parties.
                </p>
              </div>

              <div className="pt-2 border-t">
                <p className="leading-relaxed italic">
                  By proceeding with this booking, you acknowledge that you have read, understood, and agree to these terms 
                  and conditions. For questions or concerns, please contact our support team before completing your booking.
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-4 pt-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onClose}
          className="w-full sm:w-auto text-sm h-10"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting} 
          className="bg-primary w-full sm:w-auto text-sm h-10"
        >
          {isSubmitting ? "Processing..." : `Book ($${musician.price})`}
        </Button>
      </div>
    </form>
  );
}