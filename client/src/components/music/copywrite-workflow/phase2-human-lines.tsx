import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../ui/card";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { 
  PenLine, Plus, X, ArrowRight, ArrowLeft, FileText, BookOpen 
} from "lucide-react";
import type { LyricsProject } from "../../../../../shared/lyrics-workflow-types";

interface Phase2HumanLinesProps {
  project: LyricsProject;
  onUpdate: (updates: Partial<LyricsProject>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Phase2HumanLines({ project, onUpdate, onNext, onBack }: Phase2HumanLinesProps) {
  const [newLine, setNewLine] = useState("");
  const [newMetaphor, setNewMetaphor] = useState("");
  const [newHook, setNewHook] = useState("");
  const [newImage, setNewImage] = useState("");

  const addToArray = (field: keyof LyricsProject, value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    const current = (project[field] as string[]) || [];
    onUpdate({ [field]: [...current, value.trim()] });
    setter("");
  };

  const removeFromArray = (field: keyof LyricsProject, index: number) => {
    const current = (project[field] as string[]) || [];
    onUpdate({ [field]: current.filter((_, i) => i !== index) });
  };

  const linesCount = project.looseLines?.length || 0;
  const hooksCount = project.hookBank?.length || 0;
  const keywordsCount = project.keywords?.length || 0;

  // Minimum: 4 original lines OR (2 lines + 1 hook + 5 emotional keywords)
  const pathA = linesCount >= 4;
  const pathB = linesCount >= 2 && hooksCount >= 1 && keywordsCount >= 5;
  const hasMinRequirements = pathA || pathB;

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md">
              <PenLine className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl">Phase 2: Human Lines Capture</CardTitle>
              <CardDescription>
                Write your own fragments before AI assists. This builds your Original Human Lines Registry.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">

          {/* Requirements info */}
          <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
            <p className="font-medium">Minimum requirement (choose one):</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li className={pathA ? "text-green-600 font-medium" : ""}>
                Path A: 4 original lines ({linesCount}/4)
              </li>
              <li className={pathB ? "text-green-600 font-medium" : ""}>
                Path B: 2 lines + 1 hook + 5 emotional keywords ({linesCount}/2 lines, {hooksCount}/1 hook, {keywordsCount}/5 keywords)
              </li>
            </ul>
          </div>

          {/* Free Writing Block */}
          <div className="space-y-2">
            <Label htmlFor="freeWriting" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Free Writing Block
            </Label>
            <Textarea 
              id="freeWriting"
              placeholder="Write freely — stream of consciousness, feelings, ideas. No rules here. Just let it flow..."
              value={project.freeWritingBlock}
              onChange={(e) => onUpdate({ freeWritingBlock: e.target.value })}
              className="min-h-[150px] resize-y"
            />
            <p className="text-xs text-muted-foreground">
              This raw text becomes part of your authorship evidence.
            </p>
          </div>

          {/* Loose Lines */}
          <div className="space-y-2">
            <Label>Loose Lines / Phrases ({linesCount})</Label>
            <div className="flex gap-2">
              <Input 
                placeholder="Write a line, phrase, or verse fragment..." 
                value={newLine}
                onChange={(e) => setNewLine(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToArray("looseLines", newLine, setNewLine)}
              />
              <Button size="icon" variant="outline" onClick={() => addToArray("looseLines", newLine, setNewLine)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1 mt-2">
              {project.looseLines?.map((line, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/30 border text-sm group">
                  <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                  <span className="flex-1 italic">"{line}"</span>
                  <Badge variant="outline" className="text-xs">human</Badge>
                  <X 
                    className="h-3 w-3 cursor-pointer opacity-0 group-hover:opacity-100 text-muted-foreground" 
                    onClick={() => removeFromArray("looseLines", i)} 
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Metaphor Bank */}
          <div className="space-y-2">
            <Label>Metaphor Bank</Label>
            <div className="flex gap-2">
              <Input 
                placeholder="E.g.: Love is a fire that consumes everything..." 
                value={newMetaphor}
                onChange={(e) => setNewMetaphor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToArray("metaphorBank", newMetaphor, setNewMetaphor)}
              />
              <Button size="icon" variant="outline" onClick={() => addToArray("metaphorBank", newMetaphor, setNewMetaphor)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {project.metaphorBank?.map((m, i) => (
                <Badge key={i} variant="secondary" className="gap-1 py-1 px-3">
                  🎭 {m}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray("metaphorBank", i)} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Hook Bank */}
          <div className="space-y-2">
            <Label>Hook Bank ({hooksCount})</Label>
            <div className="flex gap-2">
              <Input 
                placeholder="Write a catchy hook or memorable phrase..." 
                value={newHook}
                onChange={(e) => setNewHook(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToArray("hookBank", newHook, setNewHook)}
              />
              <Button size="icon" variant="outline" onClick={() => addToArray("hookBank", newHook, setNewHook)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {project.hookBank?.map((h, i) => (
                <Badge key={i} variant="default" className="gap-1 py-1 px-3">
                  🎤 {h}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray("hookBank", i)} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Narrative Images */}
          <div className="space-y-2">
            <Label>Narrative Images / Memories</Label>
            <div className="flex gap-2">
              <Input 
                placeholder="A visual scene, memory or image you want in the lyrics..." 
                value={newImage}
                onChange={(e) => setNewImage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToArray("narrativeImages", newImage, setNewImage)}
              />
              <Button size="icon" variant="outline" onClick={() => addToArray("narrativeImages", newImage, setNewImage)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {project.narrativeImages?.map((img, i) => (
                <Badge key={i} variant="outline" className="gap-1 py-1 px-3 text-xs">
                  🎬 {img}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray("narrativeImages", i)} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Output: Human Lines Registry */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium">Original Human Lines Registry</span>
              <span className="text-muted-foreground">— {hasMinRequirements ? "Ready" : "Incomplete"}</span>
            </div>
            <Badge variant={hasMinRequirements ? "default" : "secondary"}>
              {linesCount} lines • {hooksCount} hooks
            </Badge>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Origin
            </Button>
            <Button onClick={onNext} disabled={!hasMinRequirements} className="gap-2">
              Continue to Structure
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
