import { useState, useEffect } from "react";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Save, FolderOpen, Trash2, Loader2, Download, Calendar, Edit3, ExternalLink, Pencil, Film } from "lucide-react";
import { musicVideoProjectService, type MusicVideoProject } from "../../lib/services/music-video-project-service";
import { musicVideoProjectServicePostgres, type MusicVideoProjectPostgres } from "../../lib/services/music-video-project-service-postgres";
import { useToast } from "../../hooks/use-toast";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { VideoRenderingModal } from "./VideoRenderingModal";
import type { TimelineClip } from "./TimelineEditor";

interface ProjectManagerProps {
  userId: string;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onSaveProject: () => Promise<void>;
  onLoadProject: (projectId: string) => void;
  isSaving: boolean;
  currentProjectId?: string;
  hasImages?: boolean;
  clips?: TimelineClip[];
  audioUrl?: string;
  audioDuration?: number;
  hasUserPaid?: boolean;
  onShowPaymentGate?: () => void;
  videoGenerationsCount?: number;
  onVideoRenderComplete?: (videoUrl: string) => void;
}

export function ProjectManager({
  userId,
  projectName,
  onProjectNameChange,
  onSaveProject,
  onLoadProject,
  isSaving,
  currentProjectId,
  hasImages = false,
  clips = [],
  audioUrl,
  audioDuration,
  hasUserPaid = false,
  onShowPaymentGate,
  videoGenerationsCount = 0,
  onVideoRenderComplete
}: ProjectManagerProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [projects, setProjects] = useState<MusicVideoProjectPostgres[]>([]);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameDialogProject, setRenameDialogProject] = useState<MusicVideoProjectPostgres | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [showRenderModal, setShowRenderModal] = useState(false);

  // Load user projects from PostgreSQL
  const loadProjects = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const userProjects = await musicVideoProjectServicePostgres.getUserProjects(userId);
      setProjects(userProjects);
    } catch (error) {
      logger.error('Error loading projects:', error);
      toast({
        title: "Error loading projects",
        description: "Could not load your saved projects",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete project from PostgreSQL
  const handleDeleteProject = async (projectId: number) => {
    setIsDeleting(projectId.toString());
    try {
      await musicVideoProjectServicePostgres.deleteProject(projectId);
      toast({
        title: "Project deleted",
        description: "Project has been successfully deleted"
      });
      await loadProjects();
    } catch (error) {
      logger.error('Error deleting project:', error);
      toast({
        title: "Error deleting project",
        description: "Could not delete the project",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(null);
    }
  };

  // Load project (calls parent handler with projectId)
  const handleLoadProject = (project: MusicVideoProjectPostgres) => {
    onLoadProject(project.id.toString());
    setIsLoadDialogOpen(false);
  };

  // Open load dialog and refresh projects
  const openLoadDialog = () => {
    setIsLoadDialogOpen(true);
    loadProjects();
  };

  // Open rename dialog
  const handleOpenRenameDialog = (project: MusicVideoProjectPostgres) => {
    setRenameDialogProject(project);
    setNewProjectName(project.projectName);
  };

  // Rename project
  const handleRenameProject = async () => {
    if (!renameDialogProject || !newProjectName.trim()) return;

    setIsRenaming(renameDialogProject.id.toString());
    try {
      await musicVideoProjectServicePostgres.renameProject(
        renameDialogProject.id,
        newProjectName,
        userId
      );
      toast({
        title: "Project renamed",
        description: `Project renamed to "${newProjectName}"`,
      });
      
      // Update project in list
      setProjects(prev => 
        prev.map(p => 
          p.id === renameDialogProject.id 
            ? { ...p, projectName: newProjectName } 
            : p
        )
      );
      
      // If renaming current project, update the name
      if (currentProjectId && renameDialogProject.id.toString() === currentProjectId) {
        onProjectNameChange(newProjectName);
      }
      
      setRenameDialogProject(null);
      setNewProjectName("");
    } catch (error: any) {
      logger.error('Error renaming project:', error);
      toast({
        title: "Error renaming project",
        description: error.message || "Could not rename the project",
        variant: "destructive",
      });
    } finally {
      setIsRenaming(null);
    }
  };

  // Open in Professional Editor
  const openInProfessionalEditor = () => {
    if (!currentProjectId) {
      toast({
        title: "Save project first",
        description: "Please save your project before opening it in the editor",
        variant: "destructive"
      });
      return;
    }
    
    setLocation(`/professional-editor?projectId=${currentProjectId}`);
  };

  return (
    <>
      <Card className="p-4 space-y-3 border-2 border-primary/20 bg-gradient-to-br from-orange-50/30 to-red-50/30 dark:from-orange-950/10 dark:to-red-950/10">
        <div className="flex items-center gap-2">
          <Save className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Project Management</h3>
          {currentProjectId && (
            <Badge variant="secondary" className="ml-auto">Saved</Badge>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-name">Project Name</Label>
          <Input
            id="project-name"
            placeholder="My Music Video"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            data-testid="input-project-name"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onSaveProject}
            disabled={isSaving || !projectName.trim()}
            className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
            data-testid="button-save-project"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {currentProjectId ? 'Update' : 'Save'} Project
              </>
            )}
          </Button>

          <Button
            onClick={openLoadDialog}
            variant="outline"
            data-testid="button-load-project"
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Load
          </Button>
        </div>

        {/* Open in Professional Editor - Solo se muestra si el proyecto está guardado y tiene imágenes */}
        {currentProjectId && hasImages && (
          <Button
            onClick={openInProfessionalEditor}
            variant="outline"
            className="w-full border-2 border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-950/20"
            data-testid="button-open-in-editor"
          >
            <Edit3 className="mr-2 h-4 w-4" />
            Open in Professional Editor
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        )}

        {/* Render Final Video - Solo se muestra si hay clips */}
        {clips.length > 0 && (
          <Button
            onClick={() => {
              // Check payment gate before rendering
              const maxFreeGenerations = 1;
              const maxPaidGenerations = 3;
              
              if (!hasUserPaid && videoGenerationsCount >= maxFreeGenerations) {
                // Show payment gate - user needs to pay
                if (onShowPaymentGate) {
                  onShowPaymentGate();
                } else {
                  toast({
                    title: "Payment Required",
                    description: "You've used your free video generation. Upgrade to continue.",
                    variant: "destructive",
                  });
                }
              } else if (hasUserPaid && videoGenerationsCount >= maxPaidGenerations) {
                // User has paid but exceeded limit
                toast({
                  title: "Generation Limit Reached",
                  description: `You've used all ${maxPaidGenerations} video generations. Your video looks great!`,
                  variant: "destructive",
                });
              } else {
                // Allow rendering
                setShowRenderModal(true);
              }
            }}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            data-testid="button-render-video"
          >
            <Film className="mr-2 h-4 w-4" />
            Render Final Video
            {!hasUserPaid && videoGenerationsCount >= 0 && (
              <Badge variant="secondary" className="ml-2">
                {videoGenerationsCount}/{hasUserPaid ? 3 : 1}
              </Badge>
            )}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          💾 {currentProjectId ? 'Project saved!' : 'Save your project first'} 
          {clips.length > 0 && ' | 🎬 Ready to render'}
        </p>
      </Card>

      {/* Load Project Dialog */}
      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Load Project</DialogTitle>
            <DialogDescription>
              Choose a project to load. Your current work will be replaced.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No saved projects found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <Card
                    key={project.id}
                    className="p-4 hover:border-primary transition-colors cursor-pointer"
                    onClick={() => handleLoadProject(project)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-1">{project.projectName}</h4>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant="outline">
                            {project.timelineItems.length} scenes
                          </Badge>
                          <Badge variant="outline">
                            {project.progress?.imagesGenerated || 0} images
                          </Badge>
                          <Badge variant="outline">
                            {project.progress?.videosGenerated || 0} videos
                          </Badge>
                          {project.audioDuration && (
                            <Badge variant="outline">
                              {Math.round(Number(project.audioDuration))}s
                            </Badge>
                          )}
                          <Badge variant={project.status === "completed" ? "default" : "secondary"}>
                            {project.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Updated: {new Date(project.lastModified).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadProject(project);
                          }}
                          data-testid={`button-load-${project.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRenameDialog(project);
                          }}
                          data-testid={`button-rename-${project.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                          disabled={isDeleting === project.id.toString()}
                          data-testid={`button-delete-${project.id}`}
                        >
                          {isDeleting === project.id.toString() ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLoadDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Project Dialog */}
      <Dialog open={renameDialogProject !== null} onOpenChange={(open) => !open && setRenameDialogProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Enter a new name for "{renameDialogProject?.projectName}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-input">New Project Name</Label>
              <Input
                id="rename-input"
                placeholder="Enter new name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameProject();
                  }
                }}
                data-testid="input-rename-project"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setRenameDialogProject(null);
                setNewProjectName("");
              }}
              data-testid="button-cancel-rename"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameProject}
              disabled={!newProjectName.trim() || isRenaming !== null}
              data-testid="button-confirm-rename"
            >
              {isRenaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Renaming...
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Rendering Modal */}
      <VideoRenderingModal
        open={showRenderModal}
        onClose={() => setShowRenderModal(false)}
        onComplete={(videoUrl) => {
          // Increment video generation count when completed
          if (onVideoRenderComplete) {
            onVideoRenderComplete(videoUrl);
          }
          toast({
            title: "Video Ready!",
            description: "Your music video has been rendered successfully",
          });
          setShowRenderModal(false);
        }}
        clips={clips}
        audioUrl={audioUrl}
        audioDuration={audioDuration}
        projectId={currentProjectId}
        projectName={projectName}
      />
    </>
  );
}
