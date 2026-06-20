import React from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  Video, 
  Image as ImageIcon, 
  Music, 
  Plus, 
  Trash
} from 'lucide-react';

interface MediaLibraryProps {
  videoFiles: File[];
  imageFiles: File[];
  audioFile: File | null;
  onAddToTimeline: (type: string, id: number) => void;
}

export function MediaLibrary({
  videoFiles,
  imageFiles,
  audioFile,
  onAddToTimeline
}: MediaLibraryProps) {
  return (
    <Card className="mt-4 p-2">
      <Tabs defaultValue="videos">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="videos">
            <Video className="h-4 w-4 mr-1.5" /> Videos
          </TabsTrigger>
          <TabsTrigger value="images">
            <ImageIcon className="h-4 w-4 mr-1.5" /> Imágenes
          </TabsTrigger>
          <TabsTrigger value="audio">
            <Music className="h-4 w-4 mr-1.5" /> Audio
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="videos" className="h-[180px]">
          <ScrollArea className="h-full">
            {videoFiles.length === 0 ? (
              <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
                No hay archivos de video
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2">
                {videoFiles.map((file, index) => (
                  <div 
                    key={`video-${index}`}
                    className="relative group cursor-pointer bg-muted rounded-md overflow-hidden"
                  >
                    <div className="aspect-video bg-black flex items-center justify-center">
                      <Video className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(file.size / 1024)} KB
                      </p>
                    </div>
                    
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-white/20 text-white hover:bg-white/40"
                        onClick={() => onAddToTimeline('video', index)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-white/20 text-white hover:bg-white/40"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="images" className="h-[180px]">
          <ScrollArea className="h-full">
            {imageFiles.length === 0 ? (
              <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
                No hay archivos de imagen
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2">
                {imageFiles.map((file, index) => (
                  <div 
                    key={`image-${index}`}
                    className="relative group cursor-pointer bg-muted rounded-md overflow-hidden"
                  >
                    <div className="aspect-square bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="p-1.5">
                      <p className="text-xs font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(file.size / 1024)} KB
                      </p>
                    </div>
                    
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-white/20 text-white hover:bg-white/40"
                        onClick={() => onAddToTimeline('image', index)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-white/20 text-white hover:bg-white/40"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="audio" className="h-[180px]">
          <ScrollArea className="h-full">
            {!audioFile ? (
              <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
                No hay archivos de audio
              </div>
            ) : (
              <div className="p-2">
                <div className="bg-muted rounded-md p-3 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-md bg-orange-100 flex items-center justify-center mr-3">
                      <Music className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-medium">{audioFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {Math.round(audioFile.size / 1024)} KB
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAddToTimeline('audio', 0)}
                    >
                      <Plus className="h-4 w-4 mr-1.5" /> Añadir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                    >
                      <Trash className="h-4 w-4 mr-1.5" /> Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
}