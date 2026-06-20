import React, { useState, useRef, ChangeEvent } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from '../../components/ui/card';
import {
  Button
} from '../../components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../components/ui/tabs';
import {
  FileIcon,
  FilmIcon,
  UploadIcon,
  DownloadIcon,
  MusicIcon,
  ImageIcon,
  InfoIcon,
  FolderIcon,
  FileType2Icon,
  Trash2Icon,
  CloudUploadIcon,
  EyeIcon,
  XIcon,
  CheckIcon,
  AlertCircleIcon
} from 'lucide-react';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../components/ui/table';

import {
  Separator
} from '../../components/ui/separator';

import {
  Progress
} from '../../components/ui/progress';

interface MediaFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnail?: string;
  duration?: number;
  lastModified: number;
  uploadProgress?: number;
  status: 'uploaded' | 'uploading' | 'processing' | 'error';
  error?: string;
  metadata?: {
    resolution?: string;
    codec?: string;
    bitrate?: string;
    frameRate?: number;
    audioChannels?: number;
    sampleRate?: number;
    [key: string]: any;
  };
}

interface FileUploaderProps {
  onFileSelected: (file: MediaFile) => void;
  onFileDeleted?: (fileId: string) => void;
  maxFileSize?: number; // In MB
  allowedFileTypes?: string[];
  files?: MediaFile[];
  uploadEndpoint?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelected,
  onFileDeleted,
  maxFileSize = 500, // 500MB default
  allowedFileTypes = ['video/*', 'audio/*', 'image/*'],
  files = [],
  uploadEndpoint = '/api/upload'
}) => {
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadingFiles, setUploadingFiles] = useState<MediaFile[]>([]);
  const [localFiles, setLocalFiles] = useState<MediaFile[]>(files);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Combinar archivos subidos con archivos locales para mostrar
  const allFiles = [...localFiles, ...uploadingFiles].sort((a, b) => b.lastModified - a.lastModified);
  
  // Aceptar archivos según tipos permitidos
  const acceptTypes = allowedFileTypes.join(',');
  
  // Formatear tamaño de archivo
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Formatear duración
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Manejar clic en el botón de selección de archivo
  const handleSelectFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Manejar drag & drop
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  // Procesar archivos
  const processFiles = async (fileList: FileList) => {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      
      // Verificar tipo de archivo
      const isAllowedType = allowedFileTypes.some(type => {
        if (type.endsWith('/*')) {
          const mainType = type.split('/')[0];
          return file.type.startsWith(mainType);
        }
        return file.type === type;
      });
      
      if (!isAllowedType) {
        console.error(`Tipo de archivo no permitido: ${file.type}`);
        continue;
      }
      
      // Verificar tamaño de archivo
      if (file.size > maxFileSize * 1024 * 1024) {
        console.error(`Archivo demasiado grande: ${formatFileSize(file.size)}`);
        continue;
      }
      
      // Crear objeto URL para el archivo
      const url = URL.createObjectURL(file);
      
      // Crear una entrada de archivo
      const mediaFile: MediaFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url,
        lastModified: file.lastModified,
        uploadProgress: 0,
        status: 'uploading'
      };
      
      // Añadir a la lista de archivos en carga
      setUploadingFiles(prev => [...prev, mediaFile]);
      
      // Si es un archivo de audio o video, obtener duración
      if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
        try {
          const duration = await getMediaDuration(url);
          mediaFile.duration = duration;
        } catch (error) {
          console.error('Error al obtener duración:', error);
        }
      }
      
      // Si es un video o imagen, generar miniatura
      if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
        try {
          const thumbnail = await generateThumbnail(url, file.type);
          mediaFile.thumbnail = thumbnail;
        } catch (error) {
          console.error('Error al generar miniatura:', error);
        }
      }
      
      // Simular carga
      simulateUpload(mediaFile);
    }
  };
  
  // Manejar carga de archivos
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };
  
  // Manejar selección de archivos
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };
  
  // Obtener duración de archivos de audio/video
  const getMediaDuration = (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const element = document.createElement(url.includes('video') ? 'video' : 'audio');
      element.src = url;
      
      element.onloadedmetadata = () => {
        resolve(element.duration);
      };
      
      element.onerror = () => {
        reject(new Error('Error al cargar los metadatos del medio'));
      };
    });
  };
  
  // Generar miniatura para imágenes y videos
  const generateThumbnail = (url: string, type: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (type.startsWith('image/')) {
        // Para imágenes, usar la imagen original como miniatura
        resolve(url);
      } else if (type.startsWith('video/')) {
        // Para videos, generar una miniatura
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        video.src = url;
        video.crossOrigin = 'anonymous';
        
        video.onloadeddata = () => {
          // Configurar el tamaño del canvas
          canvas.width = 160;
          canvas.height = 90;
          
          // Buscar un fotograma en el 25% del video
          video.currentTime = video.duration * 0.25;
        };
        
        video.onseeked = () => {
          if (context) {
            // Dibujar el fotograma en el canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convertir a data URL
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
            resolve(thumbnailUrl);
          } else {
            reject(new Error('No se pudo obtener el contexto del canvas'));
          }
        };
        
        video.onerror = () => {
          reject(new Error('Error al cargar el video'));
        };
      } else {
        reject(new Error('Tipo de archivo no compatible para generar miniatura'));
      }
    });
  };
  
  // Simular carga de archivo
  const simulateUpload = (file: MediaFile) => {
    let progress = 0;
    
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Actualizar estado de carga
        setUploadingFiles(prev => prev.filter(f => f.id !== file.id));
        
        // Añadir a archivos locales
        const completedFile = {
          ...file,
          status: 'uploaded' as const,
          uploadProgress: 100
        };
        
        setLocalFiles(prev => [...prev, completedFile]);
        
        // Notificar selección de archivo
        onFileSelected(completedFile);
      } else {
        // Actualizar progreso
        setUploadingFiles(prev => 
          prev.map(f => f.id === file.id ? { ...f, uploadProgress: progress } : f)
        );
      }
    }, 300);
  };
  
  // Eliminar archivo
  const handleDeleteFile = (fileId: string) => {
    // Eliminar de archivos locales
    setLocalFiles(prev => prev.filter(f => f.id !== fileId));
    
    // Eliminar de archivos en carga
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
    
    // Notificar eliminación
    if (onFileDeleted) {
      onFileDeleted(fileId);
    }
    
    // Si el archivo seleccionado es el que se ha eliminado, resetearlo
    if (selectedFile && selectedFile.id === fileId) {
      setSelectedFile(null);
    }
  };
  
  // Seleccionar archivo
  const handleSelectFile = (file: MediaFile) => {
    setSelectedFile(file);
    onFileSelected(file);
  };
  
  // Renderizar icono según tipo de archivo
  const renderFileIcon = (fileType: string) => {
    if (fileType.startsWith('video/')) {
      return <FilmIcon className="h-5 w-5" />;
    } else if (fileType.startsWith('audio/')) {
      return <MusicIcon className="h-5 w-5" />;
    } else if (fileType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5" />;
    } else {
      return <FileIcon className="h-5 w-5" />;
    }
  };
  
  // Renderizar componente de carga
  const renderUploader = () => {
    return (
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          isDragging ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-gray-300 dark:border-gray-700'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleFileDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <CloudUploadIcon className={`h-16 w-16 ${isDragging ? 'text-orange-500' : 'text-gray-400'}`} />
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Arrastra y suelta archivos</h3>
            <p className="text-sm text-gray-500">
              Acepta archivos de tipo audio, video e imagen
            </p>
            <p className="text-xs text-gray-400">
              Tamaño máximo: {maxFileSize}MB
            </p>
          </div>
          
          <Button
            variant="default"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={handleSelectFileClick}
          >
            <UploadIcon className="h-4 w-4 mr-1.5" />
            Seleccionar archivos
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptTypes}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    );
  };
  
  // Renderizar lista de archivos
  const renderFilesList = () => {
    if (allFiles.length === 0) {
      return (
        <div className="text-center py-10">
          <FileIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500">No hay archivos subidos</p>
          <p className="text-sm text-gray-400 mt-1">
            Sube archivos desde la pestaña de carga
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm text-gray-500">{allFiles.length} archivos</p>
          <Button variant="outline" size="sm" onClick={() => setActiveTab('upload')}>
            <UploadIcon className="h-4 w-4 mr-1.5" />
            Subir más
          </Button>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Tamaño</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allFiles.map((file) => (
              <TableRow 
                key={file.id}
                className={selectedFile?.id === file.id ? 'bg-orange-50 dark:bg-orange-950/20' : ''}
              >
                <TableCell>
                  {file.thumbnail ? (
                    <img
                      src={file.thumbnail}
                      alt="Miniatura"
                      className="h-10 w-10 object-cover rounded"
                    />
                  ) : (
                    <div className="h-10 w-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
                      {renderFileIcon(file.type)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    {file.status === 'uploading' && (
                      <div className="w-full mt-1">
                        <Progress value={file.uploadProgress} className="h-1 w-full" />
                      </div>
                    )}
                    {file.status === 'error' && (
                      <span className="text-xs text-red-500">{file.error}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{file.type.split('/')[1]}</TableCell>
                <TableCell>{formatFileSize(file.size)}</TableCell>
                <TableCell>{formatDuration(file.duration)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleSelectFile(file)}
                      disabled={file.status === 'uploading'}
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:text-red-500"
                      onClick={() => handleDeleteFile(file.id)}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  // Renderizar detalles del archivo seleccionado
  const renderFileDetails = () => {
    if (!selectedFile) {
      return (
        <div className="text-center py-10">
          <InfoIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500">Ningún archivo seleccionado</p>
          <p className="text-sm text-gray-400 mt-1">
            Selecciona un archivo para ver sus detalles
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          {selectedFile.thumbnail ? (
            <img
              src={selectedFile.thumbnail}
              alt="Vista previa"
              className="h-32 w-32 object-cover rounded"
            />
          ) : (
            <div className="h-32 w-32 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
              {renderFileIcon(selectedFile.type)}
            </div>
          )}
          
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{selectedFile.name}</h3>
            <p className="text-sm text-gray-500">
              {selectedFile.type} • {formatFileSize(selectedFile.size)}
            </p>
            
            {selectedFile.duration && (
              <p className="text-sm text-gray-500 mt-1">
                Duración: {formatDuration(selectedFile.duration)}
              </p>
            )}
            
            {selectedFile.metadata?.resolution && (
              <p className="text-sm text-gray-500 mt-1">
                Resolución: {selectedFile.metadata.resolution}
              </p>
            )}
            
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => window.open(selectedFile.url, '_blank')}
              >
                <EyeIcon className="h-4 w-4 mr-1.5" />
                Vista previa
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = selectedFile.url;
                  a.download = selectedFile.name;
                  a.click();
                }}
              >
                <DownloadIcon className="h-4 w-4 mr-1.5" />
                Descargar
              </Button>
            </div>
          </div>
        </div>
        
        <Separator />
        
        <div>
          <h4 className="text-sm font-semibold mb-2">Detalles técnicos</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
              <span className="text-gray-500">Tipo:</span> {selectedFile.type}
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
              <span className="text-gray-500">Tamaño:</span> {formatFileSize(selectedFile.size)}
            </div>
            {selectedFile.duration && (
              <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
                <span className="text-gray-500">Duración:</span> {formatDuration(selectedFile.duration)}
              </div>
            )}
            {selectedFile.metadata?.codec && (
              <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
                <span className="text-gray-500">Códec:</span> {selectedFile.metadata.codec}
              </div>
            )}
            {selectedFile.metadata?.frameRate && (
              <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
                <span className="text-gray-500">FPS:</span> {selectedFile.metadata.frameRate}
              </div>
            )}
            {selectedFile.metadata?.bitrate && (
              <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
                <span className="text-gray-500">Bitrate:</span> {selectedFile.metadata.bitrate}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Gestor de Archivos</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="upload">
              <UploadIcon className="h-4 w-4 mr-1.5" />
              Subir
            </TabsTrigger>
            <TabsTrigger value="files">
              <FolderIcon className="h-4 w-4 mr-1.5" />
              Archivos
            </TabsTrigger>
            <TabsTrigger value="details">
              <InfoIcon className="h-4 w-4 mr-1.5" />
              Detalles
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            {renderUploader()}
          </TabsContent>
          
          <TabsContent value="files">
            {renderFilesList()}
          </TabsContent>
          
          <TabsContent value="details">
            {renderFileDetails()}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="text-xs text-gray-500">
        {allFiles.length === 0 ? (
          <span>No hay archivos subidos</span>
        ) : (
          <span>
            {allFiles.length} archivos • 
            {allFiles.filter(f => f.type.startsWith('video/')).length} videos •
            {allFiles.filter(f => f.type.startsWith('audio/')).length} audios •
            {allFiles.filter(f => f.type.startsWith('image/')).length} imágenes
          </span>
        )}
      </CardFooter>
    </Card>
  );
};

export default FileUploader;