import React, { useState, useEffect } from 'react';
import { useToast } from "../../hooks/use-toast";
import { useFirebaseAuth } from "../../hooks/use-firebase-auth";
import { 
  productionProgressService, 
  ProductionProject, 
  ProductionPhase, 
  ProductionTask, 
  ProductionNote, 
  ProductionCollaborator 
} from "../../lib/services/production-progress-service";
import { Card } from "../ui/card";
import { Progress } from "../ui/progress";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Edit2, 
  Plus, 
  Trash2, 
  Calendar, 
  MessageSquare,
  CheckCircle,
  FilePlus2,
  Play,
  Pause, 
  MoreVertical,
  ArrowDown,
  ArrowUp,
  Save,
  Loader,
  Loader2,
  BarChart3
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Slider } from "../ui/slider";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

export function ProductionProgressContainer() {
  const { toast } = useToast();
  const { user } = useFirebaseAuth();
  
  // States
  const [editMode, setEditMode] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingPhases, setIsLoadingPhases] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [projects, setProjects] = useState<ProductionProject[]>([]);
  const [currentProject, setCurrentProject] = useState<ProductionProject | null>(null);
  const [phases, setPhases] = useState<ProductionPhase[]>([]);
  const [tasks, setTasks] = useState<ProductionTask[]>([]); 
  const [notes, setNotes] = useState<ProductionNote[]>([]);
  const [collaborators, setCollaborators] = useState<ProductionCollaborator[]>([]);
  
  const [showAddPhaseDialog, setShowAddPhaseDialog] = useState(false);
  const [showPhaseDetails, setShowPhaseDetails] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<ProductionPhase | null>(null);
  const [activeTab, setActiveTab] = useState<"tasks" | "notes" | "files">("tasks");
  
  // Form inputs
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseStatus, setNewPhaseStatus] = useState<ProductionPhase["status"]>("pending");
  const [newPhaseProgress, setNewPhaseProgress] = useState(0);
  const [newPhaseEta, setNewPhaseEta] = useState("");
  const [newPhasePriority, setNewPhasePriority] = useState<"low" | "medium" | "high">("medium");
  
  const [noteInput, setNoteInput] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  
  // Load user projects
  useEffect(() => {
    if (user) {
      loadUserProjects();
    }
  }, [user]);
  
  // Load project details when currentProject changes
  useEffect(() => {
    if (currentProject) {
      loadProjectDetails(currentProject.id);
    }
  }, [currentProject?.id]);
  
  // Helper functions
  const loadUserProjects = async () => {
    if (!user) return;
    
    setIsLoadingProjects(true);
    try {
      const userProjects = await productionProgressService.getProjects(user.uid);
      setProjects(userProjects);
      
      // Set current project to the first one if available
      if (userProjects.length > 0 && !currentProject) {
        setCurrentProject(userProjects[0]);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      toast({
        title: "Error",
        description: "Failed to load your projects. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingProjects(false);
    }
  };
  
  const loadProjectDetails = async (projectId: string) => {
    if (!user) return;
    
    try {
      // Load phases
      setIsLoadingPhases(true);
      const projectPhases = await productionProgressService.getPhasesByProjectId(projectId);
      setPhases(projectPhases);
      setIsLoadingPhases(false);
      
      // Load tasks for all phases
      setIsLoadingTasks(true);
      const allTasks: ProductionTask[] = [];
      for (const phase of projectPhases) {
        const phaseTasks = await productionProgressService.getTasksByPhaseId(phase.id);
        allTasks.push(...phaseTasks);
      }
      setTasks(allTasks);
      setIsLoadingTasks(false);
      
      // Load notes for all phases
      setIsLoadingNotes(true);
      const allNotes: ProductionNote[] = [];
      for (const phase of projectPhases) {
        const phaseNotes = await productionProgressService.getNotesByPhaseId(phase.id);
        allNotes.push(...phaseNotes);
      }
      setNotes(allNotes);
      setIsLoadingNotes(false);
      
      // Load collaborators
      const projectCollaborators = await productionProgressService.getCollaboratorsByProjectId(projectId);
      setCollaborators(projectCollaborators);
    } catch (error) {
      console.error("Error loading project details:", error);
      toast({
        title: "Error",
        description: "Failed to load project details. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Project Management
  const createNewProject = async () => {
    if (!user) return;
    if (!newProjectName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a project name",
        variant: "destructive"
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const projectData = {
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
        startDate: new Date(),
        status: "on-track" as const,
        userId: user.uid
      };
      
      const projectId = await productionProgressService.createProject(projectData);
      
      // Refresh projects list
      await loadUserProjects();
      
      // Set the new project as current
      const newProject = await productionProgressService.getProjectById(projectId);
      if (newProject) {
        setCurrentProject(newProject);
      }
      
      // Reset form
      setNewProjectName("");
      setNewProjectDescription("");
      setShowNewProjectDialog(false);
      
      toast({
        title: "Success",
        description: "Project created successfully"
      });
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const deleteProject = async (projectId: string) => {
    if (!user) return;
    
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }
    
    setIsSaving(true);
    
    try {
      await productionProgressService.deleteProject(projectId);
      
      // Refresh projects list
      await loadUserProjects();
      
      // If the deleted project was the current one, reset current project
      if (currentProject?.id === projectId) {
        setCurrentProject(projects.length > 0 ? projects[0] : null);
      }
      
      toast({
        title: "Success",
        description: "Project deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Phase Management
  const addPhase = async () => {
    if (!user || !currentProject) return;
    
    if (!newPhaseName.trim()) {
      toast({
        title: "Error",
        description: "Please provide a name for the phase",
        variant: "destructive"
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const phaseData = {
        name: newPhaseName.trim(),
        projectId: currentProject.id,
        status: newPhaseStatus,
        progress: newPhaseProgress,
        eta: newPhaseEta.trim() || undefined,
        priority: newPhasePriority,
        userId: user.uid
      };
      
      await productionProgressService.createPhase(phaseData);
      
      // Refresh phases
      await loadProjectDetails(currentProject.id);
      
      // Reset form
      setNewPhaseName("");
      setNewPhaseStatus("pending");
      setNewPhaseProgress(0);
      setNewPhaseEta("");
      setNewPhasePriority("medium");
      setShowAddPhaseDialog(false);
      
      toast({
        title: "Success",
        description: `${newPhaseName} has been added to the project`
      });
    } catch (error) {
      console.error("Error adding phase:", error);
      toast({
        title: "Error",
        description: "Failed to add phase. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const updatePhaseProgress = async (phaseId: string, newProgress: number) => {
    if (!user || !currentProject) return;
    
    try {
      await productionProgressService.updatePhase(phaseId, { progress: newProgress });
      
      // Update local state
      setPhases(prev => 
        prev.map(phase => 
          phase.id === phaseId 
            ? { ...phase, progress: newProgress } 
            : phase
        )
      );
      
      toast({
        title: "Success",
        description: "Progress updated"
      });
    } catch (error) {
      console.error("Error updating phase progress:", error);
      toast({
        title: "Error",
        description: "Failed to update progress. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const updatePhaseStatus = async (phaseId: string, newStatus: ProductionPhase["status"]) => {
    if (!user || !currentProject) return;
    
    try {
      const now = new Date();
      const updates: Partial<ProductionPhase> = { 
        status: newStatus
      };
      
      // If completed, set progress to 100% and add completion date
      if (newStatus === "completed") {
        updates.progress = 100;
        updates.completionDate = now;
      }
      
      await productionProgressService.updatePhase(phaseId, updates);
      
      // Update local state
      setPhases(prev => 
        prev.map(phase => 
          phase.id === phaseId 
            ? { 
                ...phase, 
                status: newStatus,
                progress: newStatus === "completed" ? 100 : phase.progress,
                completionDate: newStatus === "completed" ? now : phase.completionDate
              } 
            : phase
        )
      );
      
      toast({
        title: "Status Updated",
        description: `Phase status changed to ${newStatus}`
      });
    } catch (error) {
      console.error("Error updating phase status:", error);
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const deletePhase = async (phaseId: string) => {
    if (!user || !currentProject) return;
    
    if (!confirm("Are you sure you want to delete this phase? All tasks and notes will also be deleted.")) {
      return;
    }
    
    setIsSaving(true);
    
    try {
      await productionProgressService.deletePhase(phaseId);
      
      // Refresh phases
      await loadProjectDetails(currentProject.id);
      
      // Reset phase details if the deleted phase was the current one
      if (showPhaseDetails === phaseId) {
        setShowPhaseDetails(null);
        setCurrentPhase(null);
      }
      
      toast({
        title: "Success",
        description: "Phase deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting phase:", error);
      toast({
        title: "Error",
        description: "Failed to delete phase. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Task Management
  const addTask = async (phaseId: string) => {
    if (!user || !currentProject) return;
    
    if (!newTaskName.trim()) {
      toast({
        title: "Error",
        description: "Please provide a task name",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const taskData = {
        name: newTaskName.trim(),
        phaseId,
        projectId: currentProject.id,
        completed: false,
        userId: user.uid
      };
      
      await productionProgressService.createTask(taskData);
      
      // Refresh tasks
      const phaseTasks = await productionProgressService.getTasksByPhaseId(phaseId);
      setTasks(prev => [...prev.filter(task => task.phaseId !== phaseId), ...phaseTasks]);
      
      // Reset input
      setNewTaskName("");
      
      toast({
        title: "Task Added",
        description: `"${newTaskName}" has been added`
      });
      
      // Update phase progress based on task completion
      updatePhaseProgressBasedOnTasks(phaseId);
    } catch (error) {
      console.error("Error adding task:", error);
      toast({
        title: "Error",
        description: "Failed to add task. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const toggleTaskCompletion = async (taskId: string, phaseId: string) => {
    if (!user) return;
    
    try {
      // Find the task to toggle
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      // Update task in database
      await productionProgressService.updateTask(taskId, { completed: !task.completed });
      
      // Update local state
      setTasks(prev => 
        prev.map(task => 
          task.id === taskId 
            ? { ...task, completed: !task.completed } 
            : task
        )
      );
      
      // Update phase progress based on task completion
      updatePhaseProgressBasedOnTasks(phaseId);
    } catch (error) {
      console.error("Error toggling task completion:", error);
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const deleteTask = async (taskId: string, phaseId: string) => {
    if (!user) return;
    
    try {
      await productionProgressService.deleteTask(taskId);
      
      // Update local state
      setTasks(prev => prev.filter(task => task.id !== taskId));
      
      toast({
        title: "Success",
        description: "Task deleted successfully"
      });
      
      // Update phase progress based on task completion
      updatePhaseProgressBasedOnTasks(phaseId);
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Note Management
  const addNote = async (phaseId: string) => {
    if (!user || !currentProject || !noteInput.trim()) return;
    
    try {
      const noteData = {
        phaseId,
        projectId: currentProject.id,
        content: noteInput.trim(),
        createdBy: user.uid,
        createdByName: user.displayName || "You"
      };
      
      await productionProgressService.createNote(noteData);
      
      // Refresh notes
      const phaseNotes = await productionProgressService.getNotesByPhaseId(phaseId);
      setNotes(prev => [...prev.filter(note => note.phaseId !== phaseId), ...phaseNotes]);
      
      // Reset input
      setNoteInput("");
      
      toast({
        title: "Note Added",
        description: "Your note has been added to the phase"
      });
    } catch (error) {
      console.error("Error adding note:", error);
      toast({
        title: "Error",
        description: "Failed to add note. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const deleteNote = async (noteId: string) => {
    if (!user) return;
    
    try {
      await productionProgressService.deleteNote(noteId);
      
      // Update local state
      setNotes(prev => prev.filter(note => note.id !== noteId));
      
      toast({
        title: "Success",
        description: "Note deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting note:", error);
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Helper functions
  const getTasksForPhase = (phaseId: string): ProductionTask[] => {
    return tasks.filter(task => task.phaseId === phaseId);
  };
  
  const getNotesForPhase = (phaseId: string): ProductionNote[] => {
    return notes
      .filter(note => note.phaseId === phaseId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };
  
  const calculateOverallProgress = (): number => {
    if (phases.length === 0) return 0;
    return productionProgressService.calculateProjectProgress(phases);
  };
  
  const updatePhaseProgressBasedOnTasks = (phaseId: string) => {
    const phaseTasks = getTasksForPhase(phaseId);
    const progress = productionProgressService.calculatePhaseCompletion(phaseTasks);
    updatePhaseProgress(phaseId, progress);
  };
  
  const openPhaseDetails = (phaseId: string) => {
    const phase = phases.find(p => p.id === phaseId);
    if (phase) {
      setCurrentPhase(phase);
      setShowPhaseDetails(phaseId);
      setActiveTab("tasks");
    }
  };
  
  const getStatusIcon = (status: ProductionPhase["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "in-progress":
        return <Clock className="w-4 h-4 text-orange-500" />;
      case "delayed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };
  
  const formatDate = (date?: Date) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };
  
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInDays > 0) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInMinutes > 0) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else {
      return "Just now";
    }
  };
  
  const getPriorityBadge = (priority?: "low" | "medium" | "high") => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "medium":
        return <Badge variant="default">Medium</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return null;
    }
  };
  
  const getStatusBadge = (status: ProductionProject["status"]) => {
    switch (status) {
      case "on-track":
        return <Badge variant="default">{status}</Badge>;
      case "at-risk":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{status}</Badge>;
      case "delayed":
        return <Badge variant="destructive">{status}</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">{status}</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };
  
  return (
    <Card className="p-3 sm:p-4 md:p-6 overflow-hidden border-slate-700/50 bg-gradient-to-b from-slate-800/80 to-slate-900/80 backdrop-blur">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-white truncate">Production Progress</h3>
            <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Track your creative process & timeline</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {!isLoadingProjects && projects.length > 0 && (
            <Select 
              value={currentProject?.id || ""} 
              onValueChange={(value) => {
                const project = projects.find(p => p.id === value);
                if (project) {
                  setCurrentProject(project);
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setEditMode(!editMode)}
              className="flex-1 sm:flex-auto"
            >
              <Edit2 className="w-4 h-4 mr-1" />
              {editMode ? "View Mode" : "Edit Mode"}
            </Button>
            
            <Button 
              size="sm" 
              variant="default"
              onClick={() => setShowNewProjectDialog(true)}
              className="flex-1 sm:flex-auto"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Project
            </Button>
          </div>
        </div>
      </div>

      {isLoadingProjects ? (
        <div className="flex items-center justify-center h-40">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading projects...</p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-4 p-6 border-2 border-dashed rounded-lg">
          <div className="text-center">
            <h3 className="text-lg font-medium">No projects yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first production project to get started
            </p>
          </div>
          <Button onClick={() => setShowNewProjectDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Create New Project
          </Button>
        </div>
      ) : !currentProject ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-center text-muted-foreground">
            Select a project to view its details
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Project info */}
          <div className="bg-muted/30 rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-md font-semibold">{currentProject.name}</h3>
                {getStatusBadge(currentProject.status)}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Project Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Edit Project Details</DropdownMenuItem>
                  <DropdownMenuItem>Share Project</DropdownMenuItem>
                  <DropdownMenuItem>Export Timeline</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-red-500"
                    onClick={() => deleteProject(currentProject.id)}
                  >
                    Delete Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Start Date</p>
                <p className="font-medium">{formatDate(currentProject.startDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Target Completion</p>
                <p className="font-medium">{formatDate(currentProject.targetCompletionDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Progress</p>
                <div className="flex items-center gap-2">
                  <Progress value={calculateOverallProgress()} className="h-2 w-20" />
                  <span className="text-xs font-medium">{calculateOverallProgress()}%</span>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Collaborators</p>
                <p className="font-medium">{collaborators.length} {collaborators.length === 1 ? 'person' : 'people'}</p>
              </div>
            </div>
            {currentProject.description && (
              <p className="text-sm mt-3 text-muted-foreground">{currentProject.description}</p>
            )}
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-medium">Phases</h4>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowAddPhaseDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Phase
            </Button>
          </div>
          
          {isLoadingPhases ? (
            <div className="flex items-center justify-center h-40">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading phases...</p>
              </div>
            </div>
          ) : phases.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 p-6 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <h3 className="text-lg font-medium">No phases yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add phases to break down your project
                </p>
              </div>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowAddPhaseDialog(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add First Phase
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {phases.map((phase) => (
                <div 
                  key={phase.id} 
                  className={`border rounded-lg p-4 ${
                    showPhaseDetails === phase.id ? 'border-primary' : 'border-border'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusIcon(phase.status)}
                        <button 
                          className={`text-sm font-medium hover:text-primary transition-colors ${
                            showPhaseDetails === phase.id ? 'text-primary' : ''
                          }`}
                          onClick={() => openPhaseDetails(phase.id)}
                        >
                          {phase.name}
                        </button>
                        {phase.priority && getPriorityBadge(phase.priority)}
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-2 flex-wrap">
                          {phase.eta && (
                            <span className="text-xs text-muted-foreground">
                              ETA: {phase.eta}
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            <Progress 
                              value={phase.progress} 
                              className="h-2 w-16" 
                            />
                            <span className="text-xs font-medium">
                              {phase.progress}%
                            </span>
                          </div>
                        </div>
                        
                        {editMode && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Phase Options</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => updatePhaseStatus(phase.id, "in-progress")}>
                                <Play className="mr-2 h-4 w-4" />
                                Mark as In Progress
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updatePhaseStatus(phase.id, "completed")}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updatePhaseStatus(phase.id, "delayed")}>
                                <AlertCircle className="mr-2 h-4 w-4" />
                                Mark as Delayed
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openPhaseDetails(phase.id)}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-500"
                                onClick={() => deletePhase(phase.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Phase
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                    
                    {showPhaseDetails === phase.id && (
                      <div className="mt-4 pt-4 border-t">
                        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
                          <TabsList className="mb-4">
                            <TabsTrigger value="tasks">Tasks</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                          </TabsList>
                          <TabsContent value="tasks">
                            <div className="space-y-2">
                              {editMode && (
                                <div className="flex flex-col xs:flex-row gap-2 mb-4">
                                  <Input
                                    placeholder="New task..."
                                    value={newTaskName}
                                    onChange={(e) => setNewTaskName(e.target.value)}
                                    className="flex-1"
                                  />
                                  <Button 
                                    size="sm"
                                    onClick={() => addTask(phase.id)}
                                    disabled={!newTaskName.trim()}
                                    className="w-full xs:w-auto"
                                  >
                                    Add
                                  </Button>
                                </div>
                              )}
                              
                              {isLoadingTasks ? (
                                <div className="flex justify-center py-4">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                </div>
                              ) : getTasksForPhase(phase.id).length === 0 ? (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                  No tasks yet. {editMode && "Add some tasks to track progress."}
                                </div>
                              ) : (
                                <ul className="space-y-2">
                                  {getTasksForPhase(phase.id).map((task) => (
                                    <li key={task.id} className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={task.completed}
                                          onChange={() => toggleTaskCompletion(task.id, phase.id)}
                                          className="rounded text-primary focus:ring-primary"
                                        />
                                        <span className={task.completed ? "line-through text-muted-foreground" : ""}>
                                          {task.name}
                                        </span>
                                      </div>
                                      {editMode && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={() => deleteTask(task.id, phase.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </TabsContent>
                          <TabsContent value="notes">
                            <div className="space-y-4">
                              <div className="flex flex-col xs:flex-row gap-2">
                                <Textarea
                                  placeholder="Add a note..."
                                  value={noteInput}
                                  onChange={(e) => setNoteInput(e.target.value)}
                                  className="flex-1"
                                  rows={2}
                                />
                                <Button 
                                  onClick={() => addNote(phase.id)}
                                  disabled={!noteInput.trim()}
                                  className="self-end w-full xs:w-auto"
                                >
                                  Add
                                </Button>
                              </div>
                              
                              {isLoadingNotes ? (
                                <div className="flex justify-center py-4">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                </div>
                              ) : getNotesForPhase(phase.id).length === 0 ? (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                  No notes yet. Add some notes to document your progress.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {getNotesForPhase(phase.id).map((note) => (
                                    <div key={note.id} className="bg-muted/40 rounded-lg p-3">
                                      <div className="flex justify-between items-start">
                                        <div className="flex items-center text-xs text-muted-foreground mb-1">
                                          <span className="font-medium">{note.createdByName}</span>
                                          <span className="mx-1">•</span>
                                          <span>{formatRelativeTime(note.createdAt)}</span>
                                        </div>
                                        {editMode && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 -mt-1"
                                            onClick={() => deleteNote(note.id)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new production project to track your creative process
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="Album Production, EP Recording, etc."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description (optional)</Label>
              <Textarea
                id="project-description"
                placeholder="Brief description of the project"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProjectDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createNewProject} disabled={isSaving || !newProjectName.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Phase Dialog */}
      <Dialog open={showAddPhaseDialog} onOpenChange={setShowAddPhaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Phase</DialogTitle>
            <DialogDescription>
              Break down your project into manageable phases
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phase-name">Phase Name</Label>
              <Input
                id="phase-name"
                placeholder="Pre-production, Recording, Mixing, etc."
                value={newPhaseName}
                onChange={(e) => setNewPhaseName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase-status">Status</Label>
              <Select 
                value={newPhaseStatus} 
                onValueChange={(value: any) => setNewPhaseStatus(value)}
              >
                <SelectTrigger id="phase-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase-priority">Priority</Label>
              <Select 
                value={newPhasePriority} 
                onValueChange={(value: any) => setNewPhasePriority(value)}
              >
                <SelectTrigger id="phase-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="phase-progress">Initial Progress</Label>
                <span className="text-sm text-muted-foreground">{newPhaseProgress}%</span>
              </div>
              <Slider
                id="phase-progress"
                min={0}
                max={100}
                step={5}
                value={[newPhaseProgress]}
                onValueChange={(value) => setNewPhaseProgress(value[0])}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase-eta">Estimated Time (optional)</Label>
              <Input
                id="phase-eta"
                placeholder="e.g. 2 weeks, 3 days"
                value={newPhaseEta}
                onChange={(e) => setNewPhaseEta(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPhaseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addPhase} disabled={isSaving || !newPhaseName.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Phase"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}