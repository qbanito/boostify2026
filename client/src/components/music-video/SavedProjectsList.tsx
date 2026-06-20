/**
import { logger } from "../../lib/logger";
 * Componente para visualizar y gestionar proyectos de video guardados
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { 
  FolderOpen, 
  Trash2, 
  Play, 
  Calendar,
  Film,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { useToast } from "../../hooks/use-toast";
import { getUserProjects, deleteVideoProject, type VideoProject } from "../../lib/services/video-project-service";
import { useAuth } from "../../hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";

interface SavedProjectsListProps {
  onSelectProject?: (project: VideoProject) => void;
}

export function SavedProjectsList({ onSelectProject }: SavedProjectsListProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [deleteDialogProject, setDeleteDialogProject] = useState<VideoProject | null>(null);

  useEffect(() => {
    loadProjects();
  }, [user]);

  const loadProjects = async () => {
    if (!user) {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const userProjects = await getUserProjects(user.uid);
      setProjects(userProjects);
    } catch (error: any) {
      logger.error('Error cargando proyectos:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los proyectos",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (project: VideoProject) => {
    setDeleteDialogProject(project);
  };

  const confirmDelete = async () => {
    if (!deleteDialogProject || !user) return;

    setIsDeletingId(deleteDialogProject.id);
    try {
      await deleteVideoProject(deleteDialogProject.id, user.uid);
      
      setProjects(prev => prev.filter(p => p.id !== deleteDialogProject.id));
      
      toast({
        title: "Proyecto eliminado",
        description: `${deleteDialogProject.name} ha sido eliminado exitosamente.`
      });
    } catch (error: any) {
      logger.error('Error eliminando proyecto:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el proyecto. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsDeletingId(null);
      setDeleteDialogProject(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusColor = (status: VideoProject['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'generating':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: VideoProject['status']) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'generating':
        return 'Generando';
      case 'error':
        return 'Error';
      default:
        return 'Borrador';
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Inicia sesión para ver tus proyectos guardados</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Cargando proyectos...</span>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">No hay proyectos guardados</p>
          <p className="text-sm text-muted-foreground">
            Genera y guarda tu primer proyecto de video musical
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Proyectos Guardados</CardTitle>
          <CardDescription>
            {projects.length} {projects.length === 1 ? 'proyecto' : 'proyectos'} guardados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {projects.map((project) => (
                <Card 
                  key={project.id} 
                  className="hover:border-primary transition-colors cursor-pointer"
                  onClick={() => onSelectProject?.(project)}
                  data-testid={`project-card-${project.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg truncate">
                            {project.name}
                          </h3>
                          <Badge 
                            className={getStatusColor(project.status)}
                            variant="secondary"
                          >
                            {getStatusLabel(project.status)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <Film className="h-4 w-4" />
                            <span>{project.script.sceneCount} escenas</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ImageIcon className="h-4 w-4" />
                            <span>{project.images.length} imágenes</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(project.createdAt)}</span>
                          </div>
                        </div>

                        {project.images.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto">
                            {project.images.slice(0, 4).map((img, idx) => (
                              <img
                                key={idx}
                                src={img.publicUrl}
                                alt={`Scene ${idx + 1}`}
                                className="h-16 w-16 rounded object-cover flex-shrink-0"
                                data-testid={`project-thumbnail-${idx}`}
                              />
                            ))}
                            {project.images.length > 4 && (
                              <div className="h-16 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                <span className="text-xs text-muted-foreground">
                                  +{project.images.length - 4}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProject?.(project);
                          }}
                          data-testid={`button-open-${project.id}`}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Abrir
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project);
                          }}
                          disabled={isDeletingId === project.id}
                          data-testid={`button-delete-${project.id}`}
                        >
                          {isDeletingId === project.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog 
        open={deleteDialogProject !== null} 
        onOpenChange={(open) => !open && setDeleteDialogProject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente "{deleteDialogProject?.name}" y todas sus imágenes.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
