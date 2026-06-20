import { useState } from "react";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Loader2, Calendar, Target, BarChart2, CheckCircle2, X } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { db, auth } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from "firebase/firestore";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface Strategy {
  focus: string[];
  phases: Phase[];
  targetAudience: string;
  priority: string;
  timeline: string;
  status: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Phase {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  dueDate?: Date;
}

const predefinedPhases: Phase[] = [
  {
    id: "1",
    name: "Content Creation",
    description: "Create and prepare high-quality music content",
    completed: false,
  },
  {
    id: "2",
    name: "Platform Setup",
    description: "Optimize presence on streaming platforms",
    completed: false,
  },
  {
    id: "3",
    name: "Marketing Launch",
    description: "Execute initial marketing campaign",
    completed: false,
  },
  {
    id: "4",
    name: "Audience Growth",
    description: "Expand fanbase through targeted promotion",
    completed: false,
  },
  {
    id: "5",
    name: "Monetization",
    description: "Implement revenue streams and partnerships",
    completed: false,
  }
];

const targetAudiences = [
  "Gen Z Music Enthusiasts",
  "Young Urban Professionals",
  "College Students",
  "Global Music Fans",
  "Local Scene Supporters"
];

const priorities = [
  { value: "high", label: "High Priority" },
  { value: "medium", label: "Medium Priority" },
  { value: "low", label: "Low Priority" }
];

const timelines = [
  { value: "1month", label: "1 Month" },
  { value: "3months", label: "3 Months" },
  { value: "6months", label: "6 Months" },
  { value: "1year", label: "1 Year" }
];

interface StrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStrategyUpdate: () => void;
}

interface SavedStrategy {
  id: string;
  focus: string[];
  phases: Phase[];
  targetAudience: string;
  priority: string;
  timeline: string;
  status: string;
  createdAt: Date;
}

export function StrategyDialog({ open, onOpenChange, onStrategyUpdate }: StrategyDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [phases, setPhases] = useState<Phase[]>(predefinedPhases);
  const [targetAudience, setTargetAudience] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [timeline, setTimeline] = useState<string>("");
  const [generatedFocus, setGeneratedFocus] = useState<string[]>([]);
  const [customPhase, setCustomPhase] = useState<string>("");
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<SavedStrategy | null>(null);
  const [isViewingStrategy, setIsViewingStrategy] = useState(false);

  const fetchStrategies = async () => {
    if (!auth.currentUser) return;

    try {
      const strategiesRef = collection(db, "strategies");
      const q = query(
        strategiesRef,
        where("userId", "==", auth.currentUser.uid)
      );

      const querySnapshot = await getDocs(q);
      const strategies = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as SavedStrategy[];

      strategies.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setSavedStrategies(strategies);
    } catch (error) {
      logger.error("Error fetching strategies:", error);
    }
  };

  const generateStrategy = async () => {
    if (!auth.currentUser) {
      toast({
        title: "Error",
        description: "Please log in to generate a strategy.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/generate-strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          targetAudience,
          timeline,
          priority,
          language: 'en'
        })
      });

      if (!response.ok) {
        throw new Error('Error generating strategy');
      }

      const data = await response.json();
      setGeneratedFocus(data.strategy);
    } catch (error) {
      logger.error('Error generating strategy:', error);
      toast({
        title: "Error",
        description: "Could not generate strategy. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveStrategy = async () => {
    if (!auth.currentUser || !generatedFocus.length) {
      toast({
        title: "Error",
        description: "No strategy to save or not logged in.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const strategiesRef = collection(db, "strategies");
      await addDoc(strategiesRef, {
        focus: generatedFocus,
        phases: phases,
        targetAudience,
        priority,
        timeline,
        status: "active",
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast({
        title: "Success",
        description: "Strategy saved successfully",
      });

      onOpenChange(false);
      onStrategyUpdate();
    } catch (error) {
      logger.error('Error saving strategy:', error);
      toast({
        title: "Error",
        description: "Could not save strategy. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePhaseCompletion = (phaseId: string) => {
    setPhases(prevPhases =>
      prevPhases.map(phase =>
        phase.id === phaseId ? { ...phase, completed: !phase.completed } : phase
      )
    );
  };

  const addCustomPhase = () => {
    if (customPhase.trim()) {
      const newPhase: Phase = {
        id: `custom-${Date.now()}`,
        name: customPhase,
        description: "Custom phase",
        completed: false
      };
      setPhases(prev => [...prev, newPhase]);
      setCustomPhase("");
    }
  };

  const ViewStrategyDialog = () => (
    <Dialog open={isViewingStrategy} onOpenChange={setIsViewingStrategy}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Strategy Details</DialogTitle>
              <DialogDescription>
                Created on {selectedStrategy?.createdAt.toLocaleDateString()}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsViewingStrategy(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-grow pr-4">
          <div className="space-y-6 py-4">
            {selectedStrategy && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">Target Audience:</span>
                    <span>{selectedStrategy.targetAudience}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">Priority:</span>
                    <span>{selectedStrategy.priority}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">Timeline:</span>
                    <span>{selectedStrategy.timeline}</span>
                  </div>
                </div>

                <div className="rounded-lg border p-4 bg-orange-500/5">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-orange-500" />
                    Strategic Focus Points
                  </h3>
                  <ul className="space-y-3">
                    {selectedStrategy.focus.map((focus, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                        <span>{focus}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-orange-500" />
                    Implementation Phases
                  </h3>
                  <div className="space-y-3">
                    {selectedStrategy.phases.map((phase) => (
                      <div
                        key={phase.id}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-background/50"
                      >
                        <Checkbox
                          checked={phase.completed}
                          disabled
                          className="mt-1"
                        />
                        <div className="space-y-1 flex-grow">
                          <p className="font-medium">{phase.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {phase.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Growth Strategy Builder</DialogTitle>
                <DialogDescription>
                  Create a comprehensive growth strategy for your music career
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-grow">
            <div className="space-y-6 py-4 px-6">
              {!generatedFocus.length && savedStrategies.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-orange-500" />
                    Previous Strategies
                  </h3>
                  <div className="space-y-3">
                    {savedStrategies.map((strategy) => (
                      <div
                        key={strategy.id}
                        className="p-4 rounded-lg border hover:bg-orange-500/5 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedStrategy(strategy);
                          setIsViewingStrategy(true);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {strategy.targetAudience} - {strategy.timeline}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Created on {strategy.createdAt.toLocaleDateString()}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select value={targetAudience} onValueChange={setTargetAudience}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target audience" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetAudiences.map((audience) => (
                        <SelectItem key={audience} value={audience}>
                          {audience}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Priority Level</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Timeline</Label>
                  <Select value={timeline} onValueChange={setTimeline}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeline" />
                    </SelectTrigger>
                    <SelectContent>
                      {timelines.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!generatedFocus.length && (
                <Button
                  className="w-full"
                  onClick={generateStrategy}
                  disabled={isLoading || !targetAudience || !priority || !timeline}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Strategy'
                  )}
                </Button>
              )}

              {generatedFocus.length > 0 && (
                <div className="space-y-6">
                  <div className="rounded-lg border p-4 bg-orange-500/5">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-500" />
                      Strategic Focus Points
                    </h3>
                    <ul className="space-y-3">
                      {generatedFocus.map((focus, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <span>{focus}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-orange-500" />
                      Implementation Phases
                    </h3>
                    <div className="space-y-3">
                      {phases.map((phase) => (
                        <div
                          key={phase.id}
                          className="flex items-start gap-3 p-3 rounded-lg border bg-background/50"
                        >
                          <Checkbox
                            checked={phase.completed}
                            onCheckedChange={() => togglePhaseCompletion(phase.id)}
                            className="mt-1"
                          />
                          <div className="space-y-1 flex-grow">
                            <p className="font-medium">{phase.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {phase.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Add custom phase"
                        value={customPhase}
                        onChange={(e) => setCustomPhase(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        onClick={addCustomPhase}
                        disabled={!customPhase.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setGeneratedFocus([]);
                        setPhases(predefinedPhases);
                      }}
                      disabled={isLoading}
                    >
                      Reset
                    </Button>
                    <Button
                      onClick={saveStrategy}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Strategy'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {selectedStrategy && <ViewStrategyDialog />}
    </>
  );
}