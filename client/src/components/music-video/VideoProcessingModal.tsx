/**
 * 🎬 Video Processing Modal
 * Modal que se muestra cuando el usuario completa la generación de imágenes demo
 * Recoge información de contacto y muestra que el video está en proceso
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, User, Music, Link2, CheckCircle2, Loader2, 
  Sparkles, Clock, Bell, ExternalLink, Copy, Check,
  Video, Wand2, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VideoProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: {
    projectId: number;
    artistName: string;
    songName: string;
    thumbnailUrl?: string;
    totalScenes: number;
    audioUrl?: string;
    audioDuration?: number;
  };
  initialEmail?: string;
  onConfirm: (data: ProcessingConfirmation) => Promise<void>;
}

export interface ProcessingConfirmation {
  email: string;
  artistName: string;
  songName: string;
  notifyByEmail: boolean;
  profileUrl: string;
}

type ModalStep = 'form' | 'processing' | 'success';

export function VideoProcessingModal({
  isOpen,
  onClose,
  projectData,
  initialEmail = '',
  onConfirm
}: VideoProcessingModalProps) {
  const { toast } = useToast();
  
  // Form state
  const [email, setEmail] = useState(initialEmail);
  const [artistName, setArtistName] = useState(projectData.artistName || '');
  const [songName, setSongName] = useState(projectData.songName || '');
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  
  // UI state
  const [step, setStep] = useState<ModalStep>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileUrl, setProfileUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState('8-12 minutos');

  // Track if modal was previously open to detect actual open transition
  const [wasOpen, setWasOpen] = useState(false);

  // Reset state only when modal actually opens (transition from closed to open)
  useEffect(() => {
    if (isOpen && !wasOpen) {
      // Modal just opened - initialize state
      setEmail(initialEmail);
      setArtistName(projectData.artistName || '');
      setSongName(projectData.songName || projectData.songName === '' ? '' : 'Tu Canción');
      setStep('form');
      setIsSubmitting(false);
    }
    setWasOpen(isOpen);
  }, [isOpen]); // Only depend on isOpen, not on projectData which changes every render

  // Generate profile slug from artist name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Remove duplicate dashes
      .trim();
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validation
    if (!email || !email.includes('@')) {
      toast({
        title: 'Email requerido',
        description: 'Por favor ingresa un email válido',
        variant: 'destructive'
      });
      return;
    }

    if (!artistName.trim()) {
      toast({
        title: 'Nombre del artista requerido',
        description: 'Por favor ingresa el nombre del artista',
        variant: 'destructive'
      });
      return;
    }

    if (!songName.trim()) {
      toast({
        title: 'Nombre de la canción requerido',
        description: 'Por favor ingresa el nombre de la canción',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    setStep('processing');

    try {
      // Generate profile URL
      const slug = generateSlug(artistName);
      const generatedProfileUrl = `${window.location.origin}/artist/${slug}`;
      setProfileUrl(generatedProfileUrl);

      // Call the confirmation handler
      await onConfirm({
        email,
        artistName,
        songName,
        notifyByEmail,
        profileUrl: generatedProfileUrl
      });

      // Show success
      setStep('success');
      
      // Get estimated queue position (mock for now, will come from API)
      setQueuePosition(1);

    } catch (error) {
      console.error('Error submitting video processing request:', error);
      toast({
        title: 'Error',
        description: 'Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.',
        variant: 'destructive'
      });
      setStep('form');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy profile URL
  const copyProfileUrl = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    toast({
      title: 'Link copiado',
      description: 'El link del perfil ha sido copiado al portapapeles'
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white overflow-hidden">
        <AnimatePresence mode="wait">
          {/* STEP 1: Form */}
          {step === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6"
            >
              <DialogHeader className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">
                      ¡Tus imágenes están listas! 🎉
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Confirma tus datos para generar tu video musical
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Preview Card */}
              <Card className="mb-6 p-4 bg-slate-800/50 border-slate-700">
                <div className="flex items-center gap-4">
                  {projectData.thumbnailUrl ? (
                    <img 
                      src={projectData.thumbnailUrl} 
                      alt="Thumbnail" 
                      className="w-20 h-12 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-20 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <Music className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {projectData.totalScenes} escenas generadas
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Listo para convertir en video musical con lipsync
                    </p>
                  </div>
                </div>
              </Card>

              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm text-slate-300">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email para notificación
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="bg-slate-800 border-slate-600 focus:border-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="artistName" className="text-sm text-slate-300">
                      <User className="w-4 h-4 inline mr-2" />
                      Nombre del artista
                    </Label>
                    <Input
                      id="artistName"
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      placeholder="Ej: DJ Thunder"
                      className="bg-slate-800 border-slate-600 focus:border-orange-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="songName" className="text-sm text-slate-300">
                      <Music className="w-4 h-4 inline mr-2" />
                      Nombre de la canción
                    </Label>
                    <Input
                      id="songName"
                      value={songName}
                      onChange={(e) => setSongName(e.target.value)}
                      placeholder="Ej: Noche Eterna"
                      className="bg-slate-800 border-slate-600 focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Notify checkbox */}
                <div className="flex items-center space-x-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <Checkbox
                    id="notify"
                    checked={notifyByEmail}
                    onCheckedChange={(checked) => setNotifyByEmail(checked as boolean)}
                    className="border-orange-500 data-[state=checked]:bg-orange-500"
                  />
                  <Label htmlFor="notify" className="text-sm text-slate-300 cursor-pointer">
                    <Bell className="w-4 h-4 inline mr-2 text-orange-400" />
                    Notificarme por email cuando el video esté listo
                  </Label>
                </div>
              </div>

              {/* Estimated time */}
              <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-blue-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Tiempo estimado: <strong>{estimatedTime}</strong></span>
                </div>
                <p className="text-xs text-blue-300/70 mt-1">
                  El video se renderizará en segundo plano. Puedes cerrar esta página.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full mt-6 h-12 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 mr-2" />
                    Generar Mi Video Musical
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* STEP 2: Processing */}
          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-8 text-center"
            >
              <div className="mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-orange-500 to-pink-500 p-1"
                >
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-orange-500" />
                  </div>
                </motion.div>
              </div>

              <h3 className="text-xl font-bold mb-2">Creando tu perfil de artista...</h3>
              <p className="text-slate-400 text-sm">
                Esto solo tomará un momento
              </p>

              <div className="mt-6 flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    className="w-2 h-2 rounded-full bg-orange-500"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 3: Success */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6"
            >
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center"
                >
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </motion.div>

                <h3 className="text-2xl font-bold mb-2">¡Video en proceso! 🎬</h3>
                <p className="text-slate-400">
                  Tu video musical se está generando en segundo plano
                </p>
              </div>

              {/* Profile URL */}
              <Card className="mb-4 p-4 bg-slate-800/50 border-slate-700">
                <Label className="text-xs text-slate-400 mb-2 block">
                  Tu perfil de artista:
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={profileUrl}
                    readOnly
                    className="bg-slate-700 border-slate-600 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyProfileUrl}
                    className="border-slate-600 hover:bg-slate-700"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(profileUrl, '_blank')}
                    className="border-slate-600 hover:bg-slate-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </Card>

              {/* Status info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                    <span className="text-sm text-orange-300">Estado: En cola</span>
                  </div>
                  {queuePosition && (
                    <Badge className="bg-orange-500/20 text-orange-400">
                      Posición #{queuePosition}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-300">
                    Tiempo estimado: <strong>{estimatedTime}</strong>
                  </span>
                </div>

                {notifyByEmail && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <Mail className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-300">
                      Te notificaremos a <strong>{email}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 border-slate-600 hover:bg-slate-700"
                >
                  Cerrar
                </Button>
                <Button
                  onClick={() => window.open(profileUrl, '_blank')}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver mi perfil
                </Button>
              </div>

              {/* Footer note */}
              <p className="text-xs text-slate-500 text-center mt-4">
                Puedes cerrar esta ventana. Recibirás un email cuando tu video esté listo.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default VideoProcessingModal;
