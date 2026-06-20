import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useToast } from "../../hooks/use-toast";
import { storage, auth } from "../../firebase"; 
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Loader2, Upload, Film, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "../../lib/auth";
import { Alert, AlertDescription } from "../ui/alert";

interface VideoUploadProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VideoUpload({ isOpen, onClose }: VideoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("featured");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Verificar si el usuario está autenticado
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Simplemente verificar si hay un usuario actual
        const user = auth.currentUser;
        setIsAuthenticated(!!user);
        
        if (!user) {
          setError("Debes iniciar sesión para subir videos");
          console.warn("No user authenticated for video upload");
        }
      } catch (err) {
        console.error("Error checking authentication:", err);
        setError("Error al verificar la autenticación");
      }
    };
    
    checkAuth();
  }, [isOpen]);

  // Mutation para guardar los metadatos del video en la base de datos
  const saveVideoMutation = useMutation({
    mutationFn: async (videoData: {
      title: string;
      description: string;
      category: string;
      filePath: string;
      fileName: string;
    }) => {
      // Obtener el token de autenticación
      const token = await getAuthToken();
      
      if (!token) {
        console.error("No se pudo obtener token de autenticación");
        throw new Error("Error de autenticación. Por favor, vuelve a iniciar sesión.");
      }
      
      console.log("Enviando metadatos de video al servidor", {
        title: videoData.title,
        category: videoData.category,
        fileName: videoData.fileName,
        hasToken: !!token,
      });
      
      // Usando fetch con autenticación
      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(videoData),
      });
      
      // Intentar obtener la respuesta como JSON incluso en caso de error
      const responseData = await response.json().catch(err => {
        console.error("Error al parsear respuesta:", err);
        return { success: false, message: "Error al procesar la respuesta del servidor" };
      });
      
      if (!response.ok) {
        console.error("Error en respuesta del servidor:", responseData);
        throw new Error(responseData?.message || responseData?.error || 'Error al guardar el video');
      }
      
      return responseData;
    },
    onSuccess: (data) => {
      console.log("Video guardado exitosamente:", data);
      toast({
        title: "Video subido con éxito",
        description: "El video ha sido subido y está disponible en Boostify TV",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/files/videos/tv'] });
      resetForm();
      onClose();
    },
    onError: (error: Error) => {
      console.error("Error en la mutación de guardar video:", error);
      toast({
        title: "Error al guardar el video",
        description: `No se pudo guardar la información del video: ${error.message}`,
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validar que sea un archivo de video
      if (!selectedFile.type.startsWith("video/")) {
        toast({
          title: "Formato no válido",
          description: "Por favor, selecciona un archivo de video (mp4, webm, etc.)",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setCategory("featured");
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar si el usuario está autenticado
    if (!isAuthenticated) {
      setError("Debes iniciar sesión para subir videos");
      toast({
        title: "Autenticación requerida",
        description: "Por favor, inicia sesión para subir videos",
        variant: "destructive",
      });
      return;
    }
    
    if (!file) {
      toast({
        title: "Archivo requerido",
        description: "Por favor, selecciona un archivo de video para subir",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Título requerido",
        description: "Por favor, agrega un título para el video",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar el tamaño del archivo (máximo 200MB)
    const maxSizeInBytes = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSizeInBytes) {
      toast({
        title: "Archivo demasiado grande",
        description: `El archivo es demasiado grande (${(file.size / (1024 * 1024)).toFixed(2)}MB). El tamaño máximo permitido es 200MB.`,
        variant: "destructive",
      });
      return;
    }

    // Todo en orden, comenzar la carga
    setIsUploading(true);
    setError(null);

    try {
      // Obtener el usuario actual para metadatos
      const user = auth.currentUser;
      if (!user || !user.uid) {
        throw new Error("Error de autenticación. Por favor, vuelve a iniciar sesión.");
      }
      
      // Crear una referencia única para el archivo en Firebase Storage
      const timestamp = new Date().getTime();
      const fileExtension = file.name.split('.').pop();
      const safeFileName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `${safeFileName}_${timestamp}.${fileExtension}`;
      
      // Incluir el ID del usuario en la ruta para mejorar la organización
      const storageRef = ref(storage, `videos/${category}/${fileName}`);

      // Iniciar el proceso de carga con metadatos adicionales
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
        customMetadata: {
          userId: user.uid,
          category: category,
          title: title
        }
      });

      // Escuchar el progreso de la carga
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setUploadProgress(progress);
        },
        (error) => {
          // Manejar errores comunes de Firebase Storage
          console.error("Error uploading file:", error);
          let errorMessage = "Error al subir el video";
          
          if (error.code === "storage/unauthorized") {
            errorMessage = "No tienes permisos para subir este video. Por favor, inicia sesión nuevamente.";
          } else if (error.code === "storage/canceled") {
            errorMessage = "La carga fue cancelada.";
          } else if (error.code === "storage/unknown") {
            errorMessage = "Ocurrió un error desconocido. Por favor, intenta nuevamente.";
          } else if (error.code === "storage/retry-limit-exceeded") {
            errorMessage = "Se superó el límite de intentos. Por favor, verifica tu conexión a internet.";
          } else if (error.code === "storage/invalid-checksum") {
            errorMessage = "El archivo está dañado. Por favor, intenta con otro archivo.";
          }
          
          toast({
            title: "Error al subir el video",
            description: errorMessage,
            variant: "destructive",
          });
          
          setError(errorMessage);
          setIsUploading(false);
        },
        async () => {
          try {
            // Subida completada, obtener URL de descarga
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log("File uploaded successfully. Download URL:", downloadURL);

            // Guardar los metadatos del video en la base de datos
            saveVideoMutation.mutate({
              title,
              description,
              category,
              filePath: downloadURL,
              fileName: fileName,
            });
          } catch (error) {
            console.error("Error getting download URL:", error);
            toast({
              title: "Error al finalizar la carga",
              description: "El video se subió, pero no se pudo obtener la URL de descarga.",
              variant: "destructive",
            });
            setIsUploading(false);
          }
        }
      );
    } catch (error: any) {
      console.error("Error during upload:", error);
      const errorMessage = error?.message || "Ocurrió un error inesperado durante la carga del video";
      
      toast({
        title: "Error al subir el video",
        description: errorMessage,
        variant: "destructive",
      });
      
      setError(errorMessage);
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Subir nuevo video</DialogTitle>
          <DialogDescription>
            Sube videos para mostrar en Boostify TV. Se admiten formatos MP4, WebM y otros formatos de video comunes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título del video</Label>
              <Input
                id="title"
                placeholder="Ingresa el título del video"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isUploading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Agrega una descripción para el video"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isUploading}
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select 
                value={category} 
                onValueChange={setCategory}
                disabled={isUploading}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Destacados</SelectItem>
                  <SelectItem value="videos">Videos generales</SelectItem>
                  <SelectItem value="live">Transmisiones en vivo</SelectItem>
                  <SelectItem value="music">Música</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="video">Archivo de video</Label>
              <div className="flex items-center gap-4">
                <Label
                  htmlFor="video"
                  className={`relative flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-5 py-5 text-center transition-all hover:bg-gray-50 ${
                    file ? "border-green-500 bg-green-50" : ""
                  }`}
                >
                  {file ? (
                    <div className="flex flex-col items-center">
                      <Film className="h-8 w-8 text-green-500" />
                      <span className="mt-2 block truncate text-sm text-gray-500">
                        {file.name}
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-8 w-8 text-gray-500" />
                      <span className="mt-2 block text-sm font-medium">
                        Selecciona un archivo de video
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        MP4, WebM, hasta 200MB
                      </span>
                    </div>
                  )}
                </Label>
                <Input
                  id="video"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="sr-only"
                />
              </div>
            </div>
          </div>

          {isUploading && (
            <div className="rounded-lg bg-gray-100 p-4">
              <div className="mb-2 flex justify-between text-sm font-medium">
                <span>Subiendo video...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-orange-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isUploading || !file}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                "Subir video"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}