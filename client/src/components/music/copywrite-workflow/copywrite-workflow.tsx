import { useState, useCallback } from "react";
import { Badge } from "../../ui/badge";
import { useToast } from "../../../hooks/use-toast";
import type { LyricsProject } from "../../../../../shared/lyrics-workflow-types";
import { EMPTY_LYRICS_PROJECT } from "../../../../../shared/lyrics-workflow-types";
import { Phase1Origin } from "./phase1-origin";
import { Phase2HumanLines } from "./phase2-human-lines";
import { Phase3Structure } from "./phase3-structure";
import { Phase4AIDraft } from "./phase4-ai-draft";
import { Phase5Rewrite } from "./phase5-rewrite";
import { Phase6VersionControl } from "./phase6-version-control";
import { Phase7AuthorshipPacket } from "./phase7-authorship-packet";
import { apiRequest } from "../../../lib/queryClient";
import { 
  Lightbulb, PenLine, LayoutList, Wand2, PenTool, GitBranch, Shield 
} from "lucide-react";

const PHASE_ICONS = [Lightbulb, PenLine, LayoutList, Wand2, PenTool, GitBranch, Shield];
const PHASE_LABELS = [
  "Origin", "Human Input", "Structure", "AI Draft", "Rewrite", "Versioning", "Authorship"
];

interface CopywriteWorkflowProps {
  userId?: number;
  onLyricsReady?: (lyrics: string) => void;
}

export function CopywriteWorkflow({ userId, onLyricsReady }: CopywriteWorkflowProps) {
  const [project, setProject] = useState<LyricsProject>({ ...EMPTY_LYRICS_PROJECT });
  const [currentPhase, setCurrentPhase] = useState(1);
  const [projectId, setProjectId] = useState<number | null>(null);
  const { toast } = useToast();

  const updateProject = useCallback((updates: Partial<LyricsProject>) => {
    setProject(prev => ({ ...prev, ...updates }));
  }, []);

  const goToPhase = (phase: number) => {
    setCurrentPhase(phase);
    updateProject({ currentPhase: phase });
    autoSave({ ...project, currentPhase: phase });
  };

  const autoSave = async (data: LyricsProject) => {
    if (!userId) return;
    try {
      if (projectId) {
        await apiRequest("PUT", `/api/lyrics-workflow/projects/${projectId}`, data);
      } else {
        const res = await apiRequest("POST", "/api/lyrics-workflow/projects", data);
        const saved = await res.json();
        if (saved.id) setProjectId(saved.id);
      }
    } catch {
      // Silent save — don't block the user
    }
  };

  const handleComplete = async () => {
    updateProject({ status: "completed" });
    await autoSave({ ...project, status: "completed" });
    
    toast({
      title: "Copywrite Workflow Complete",
      description: "Your lyrics authorship evidence has been documented.",
    });

    if (onLyricsReady && project.finalLyrics) {
      onLyricsReady(project.finalLyrics);
    }
  };

  return (
    <div className="space-y-6">
      {/* Phase Progress Bar */}
      <div className="flex items-center justify-between overflow-x-auto pb-2 gap-1">
        {PHASE_LABELS.map((label, i) => {
          const phase = i + 1;
          const Icon = PHASE_ICONS[i];
          const isActive = currentPhase === phase;
          const isCompleted = currentPhase > phase;
          return (
            <button
              key={phase}
              className={`flex flex-col items-center gap-1 min-w-[72px] p-2 rounded-lg transition-colors ${
                isActive ? "bg-primary/10 text-primary" :
                isCompleted ? "text-green-600 cursor-pointer hover:bg-green-50/50" :
                "text-muted-foreground"
              }`}
              onClick={() => isCompleted && goToPhase(phase)}
              disabled={!isCompleted && !isActive}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive ? "bg-primary text-primary-foreground" :
                isCompleted ? "bg-green-500 text-white" :
                "bg-muted text-muted-foreground"
              }`}>
                {isCompleted ? "✓" : <Icon className="h-4 w-4" />}
              </div>
              <span className="text-[10px] leading-tight text-center">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Current Phase Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          Phase {currentPhase} of 7
        </Badge>
        <span className="text-sm font-medium">{PHASE_LABELS[currentPhase - 1]}</span>
      </div>

      {/* Phase Content */}
      {currentPhase === 1 && (
        <Phase1Origin 
          project={project} 
          onUpdate={updateProject} 
          onNext={() => goToPhase(2)} 
        />
      )}
      {currentPhase === 2 && (
        <Phase2HumanLines 
          project={project} 
          onUpdate={updateProject} 
          onNext={() => goToPhase(3)} 
          onBack={() => goToPhase(1)} 
        />
      )}
      {currentPhase === 3 && (
        <Phase3Structure 
          project={project} 
          onUpdate={updateProject} 
          onNext={() => goToPhase(4)} 
          onBack={() => goToPhase(2)} 
        />
      )}
      {currentPhase === 4 && (
        <Phase4AIDraft 
          project={project} 
          onUpdate={updateProject} 
          onNext={() => goToPhase(5)} 
          onBack={() => goToPhase(3)} 
        />
      )}
      {currentPhase === 5 && (
        <Phase5Rewrite 
          project={project} 
          onUpdate={updateProject} 
          onNext={() => goToPhase(6)} 
          onBack={() => goToPhase(4)} 
        />
      )}
      {currentPhase === 6 && (
        <Phase6VersionControl 
          project={project} 
          onUpdate={updateProject} 
          onNext={() => goToPhase(7)} 
          onBack={() => goToPhase(5)} 
        />
      )}
      {currentPhase === 7 && (
        <Phase7AuthorshipPacket 
          project={project} 
          onUpdate={updateProject} 
          onBack={() => goToPhase(6)} 
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
