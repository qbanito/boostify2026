import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Textarea } from "../ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { useAuth } from "../../hooks/use-auth";
import { apiRequest } from "../../lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Image,
  Music,
  Video,
  Mic,
  MessageCircle,
  Send,
  X,
  Loader2,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface CreatePostFormProps {
  userId?: number | null;
  artistData?: any;
  onPostCreated?: () => void;
}

export function CreatePostForm({
  userId,
  artistData,
  onPostCreated,
}: CreatePostFormProps) {
  const { toast } = useToast();
  const { user } = useAuth() || {};
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [mediaType, setMediaType] = useState<
    "image" | "audio" | "video" | "voice-note" | null
  >(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const createPostMutation = useMutation({
    mutationFn: async (postData: any) => {
      return apiRequest({
        url: "/api/social/posts",
        method: "POST",
        data: postData,
      });
    },
    onSuccess: () => {
      setContent("");
      setMediaType(null);
      setMediaPreview(null);
      setWhatsappPhone("");
      setRecordingTime(0);
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      toast({
        title: "Publicación creada",
        description: "Tu contenido se ha compartido con la comunidad",
      });
      onPostCreated?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo crear la publicación",
        variant: "destructive",
      });
      logger.error(error);
    },
  });

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "audio" | "video"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaType(type);

    const reader = new FileReader();
    reader.onload = (event) => {
      const preview = event.target?.result as string;
      setMediaPreview(preview);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        const reader = new FileReader();
        reader.onload = (e) => {
          setMediaPreview(e.target?.result as string);
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setMediaType("voice-note");
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo acceder al micrófono",
        variant: "destructive",
      });
      logger.error(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !mediaPreview) {
      toast({
        title: "Error",
        description: "Escribe algo o selecciona un archivo multimedia",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Error",
        description: "Debes estar autenticado",
        variant: "destructive",
      });
      return;
    }

    const postData: any = {
      content: content.trim(),
      userId,
    };

    if (mediaType && mediaPreview) {
      postData.mediaType = mediaType;
      postData.mediaData = mediaPreview;
    }

    if (whatsappPhone) {
      postData.whatsappUrl = `https://wa.me/${whatsappPhone.replace(/\D/g, "")}`;
    }

    createPostMutation.mutate(postData);
  };

  return (
    <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-orange-500/20">
      <CardHeader className="pb-3">
        <h3 className="text-lg font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
          ✨ Compartir con Boostify
        </h3>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Usuario y textarea */}
          <div className="flex space-x-4">
            <Avatar className="h-12 w-12 border-2 border-orange-500/30">
              <AvatarImage
                src={artistData?.photoURL || artistData?.profileImage}
              />
              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-red-500 text-white">
                {(artistData?.displayName || user?.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              {artistData?.displayName && (
                <p className="text-sm font-semibold text-orange-400">
                  {artistData.displayName}
                </p>
              )}
              <Textarea
                placeholder="¿Qué estás pensando? / What's on your mind? 🎵"
                className="resize-none bg-slate-800/50 border-slate-700 focus:border-orange-500/50"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Vista previa de media */}
          {mediaPreview && (
            <div className="relative bg-slate-800/50 rounded-lg p-4">
              <button
                type="button"
                onClick={() => {
                  setMediaPreview(null);
                  setMediaType(null);
                  setRecordingTime(0);
                }}
                className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 p-1 rounded"
              >
                <X className="h-4 w-4 text-white" />
              </button>

              {mediaType === "image" && (
                <img
                  src={mediaPreview}
                  alt="preview"
                  className="max-h-64 rounded-lg mx-auto"
                />
              )}
              {mediaType === "video" && (
                <video
                  src={mediaPreview}
                  controls
                  className="max-h-64 rounded-lg mx-auto w-full"
                />
              )}
              {(mediaType === "audio" || mediaType === "voice-note") && (
                <div className="flex items-center justify-center space-x-4">
                  <Music className="h-8 w-8 text-orange-400" />
                  <audio src={mediaPreview} controls className="flex-1" />
                </div>
              )}
            </div>
          )}

          {/* Tabs para tipos de contenido */}
          <Tabs defaultValue="media" className="w-full">
            <TabsList className="grid grid-cols-4 bg-slate-800/50">
              <TabsTrigger value="media" className="gap-1">
                <Image className="h-4 w-4" />
                <span className="hidden sm:inline">Medios</span>
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-1">
                <Mic className="h-4 w-4" />
                <span className="hidden sm:inline">Voz</span>
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-1">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </TabsTrigger>
              <TabsTrigger value="help" className="gap-1">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Ayuda</span>
              </TabsTrigger>
            </TabsList>

            {/* Media Tab */}
            <TabsContent value="media" className="space-y-3 mt-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, "image")}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-orange-500/30 hover:border-orange-500 hover:bg-orange-500/10"
                  onClick={() => {
                    fileInputRef.current?.click();
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) =>
                      handleFileSelect(
                        e as any,
                        "image"
                      );
                    input.click();
                  }}
                >
                  <Image className="h-4 w-4 mr-2" />
                  Imagen
                </Button>

                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleFileSelect(e, "audio")}
                  className="hidden"
                  id="audio-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-orange-500/30 hover:border-orange-500 hover:bg-orange-500/10"
                  onClick={() =>
                    document.getElementById("audio-input")?.click()
                  }
                >
                  <Music className="h-4 w-4 mr-2" />
                  Audio
                </Button>

                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileSelect(e, "video")}
                  className="hidden"
                  id="video-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-orange-500/30 hover:border-orange-500 hover:bg-orange-500/10"
                  onClick={() =>
                    document.getElementById("video-input")?.click()
                  }
                >
                  <Video className="h-4 w-4 mr-2" />
                  Video
                </Button>
              </div>
            </TabsContent>

            {/* Voice Tab */}
            <TabsContent value="voice" className="mt-3">
              {!isRecording ? (
                <Button
                  type="button"
                  onClick={startRecording}
                  className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Grabar nota de voz
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-400">
                      🎙️ {Math.floor(recordingTime / 60)}:
                      {String(recordingTime % 60).padStart(2, "0")}
                    </div>
                    <p className="text-sm text-red-300 mt-2">
                      Grabando en vivo...
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={stopRecording}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    Detener grabación
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* WhatsApp Tab */}
            <TabsContent value="whatsapp" className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Agrega tu número para que puedan contactarte por WhatsApp
              </p>
              <input
                type="tel"
                placeholder="+1234567890"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 focus:border-orange-500 focus:outline-none text-sm"
              />
              {whatsappPhone && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-xs text-green-300">
                  ✓ Número listo para compartir
                </div>
              )}
            </TabsContent>

            {/* Help Tab */}
            <TabsContent value="help" className="mt-3">
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  <strong className="text-orange-400">📝 Texto:</strong> Escribe
                  tu mensaje
                </p>
                <p>
                  <strong className="text-orange-400">🖼️ Imágenes:</strong>{" "}
                  Sube fotos de tus proyectos
                </p>
                <p>
                  <strong className="text-orange-400">🎵 Audio:</strong> Comparte
                  canciones o beats
                </p>
                <p>
                  <strong className="text-orange-400">📹 Video:</strong> Clips,
                  tutorials, behind-the-scenes
                </p>
                <p>
                  <strong className="text-orange-400">🎙️ Voz:</strong> Notas de
                  voz en directo
                </p>
                <p>
                  <strong className="text-orange-400">💬 WhatsApp:</strong>{" "}
                  Conecta con tu audiencia
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                (!content.trim() && !mediaPreview) ||
                createPostMutation.isPending ||
                !userId
              }
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
            >
              {createPostMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Publicar
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
