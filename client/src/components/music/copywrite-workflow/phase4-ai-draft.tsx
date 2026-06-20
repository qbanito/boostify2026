import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Textarea } from "../../ui/textarea";
import { Label } from "../../ui/label";
import { Alert, AlertDescription } from "../../ui/alert";
import { 
  Wand2, ArrowRight, ArrowLeft, Loader2, Sparkles, Info 
} from "lucide-react";
import type { LyricsProject, DraftVersion, DraftLine, LyricsStructureMap } from "../../../../../shared/lyrics-workflow-types";
import { SECTION_LABELS } from "../../../../../shared/lyrics-workflow-types";
import { apiRequest } from "../../../lib/queryClient";

interface Phase4AIDraftProps {
  project: LyricsProject;
  onUpdate: (updates: Partial<LyricsProject>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Phase4AIDraft({ project, onUpdate, onNext, onBack }: Phase4AIDraftProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>("expand");

  const activeSections = Object.entries(project.structureMap || {})
    .filter(([_, v]) => v)
    .map(([k]) => k) as (keyof LyricsStructureMap)[];

  const currentDraft = project.draftVersions?.find(d => d.type === "ai-draft");

  const generateDraft = async () => {
    setIsGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/lyrics-workflow/generate-draft", {
        project: {
          songTitle: project.songTitle,
          language: project.language,
          genre: project.genre,
          theme: project.theme,
          emotion: project.emotion,
          messageCore: project.messageCore,
          personalStory: project.personalStory,
          desiredTone: project.desiredTone,
          humanOriginalPhrases: project.humanOriginalPhrases,
          humanIdeas: project.humanIdeas,
          looseLines: project.looseLines,
          hookBank: project.hookBank,
          metaphorBank: project.metaphorBank,
          narrativeImages: project.narrativeImages,
          keywords: project.keywords,
          styleReferences: project.styleReferences,
          structureMap: project.structureMap,
          verseCount: project.verseCount,
          chorusLength: project.chorusLength,
        },
        mode: selectedMode,
      });

      const data = await res.json();

      if (data.draft) {
        // Parse the AI response into lines with section markers
        const lines = parseDraftIntoLines(data.draft, activeSections);

        const newDraft: DraftVersion = {
          version: (project.draftVersions?.length || 0) + 1,
          type: "ai-draft",
          content: data.draft,
          lines,
          timestamp: new Date().toISOString(),
        };

        // Also create origin draft from human lines if not exists
        const existingVersions = project.draftVersions || [];
        const hasOrigin = existingVersions.some(d => d.type === "origin");
        const updatedVersions = hasOrigin
          ? [...existingVersions.filter(d => d.type !== "ai-draft"), newDraft]
          : [createOriginDraft(project), newDraft];

        onUpdate({ draftVersions: updatedVersions });
      }
    } catch {
      // If API fails, create a template draft the user can edit
      const templateDraft = createTemplateDraft(project, activeSections);
      const existingVersions = project.draftVersions || [];
      const hasOrigin = existingVersions.some(d => d.type === "origin");
      const updatedVersions = hasOrigin
        ? [...existingVersions.filter(d => d.type !== "ai-draft"), templateDraft]
        : [createOriginDraft(project), templateDraft];
      onUpdate({ draftVersions: updatedVersions });
    } finally {
      setIsGenerating(false);
    }
  };

  const hasDraft = !!currentDraft;

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md">
              <Wand2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl">Phase 4: AI Assisted Drafting</CardTitle>
              <CardDescription>
                AI generates suggestions based on YOUR human input — it assists, not replaces.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">

          <Alert className="bg-muted/50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              The AI works exclusively with your phrases, structure, tone, and limitations.  
              Every suggestion is marked as <strong>AI-generated</strong> until you approve or rewrite it.
            </AlertDescription>
          </Alert>

          {/* Mode Selection */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">AI Assistance Mode</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { id: "expand", label: "Expand Lines", desc: "Extend your human lines into full verses" },
                { id: "rhyme", label: "Suggest Rhymes", desc: "Propose rhyming alternatives" },
                { id: "chorus-variants", label: "Chorus Variants", desc: "Generate chorus variations" },
                { id: "metric", label: "Improve Meter", desc: "Fix syllable count and rhythm" },
                { id: "imagery", label: "Poetic Imagery", desc: "Add poetic images and metaphors" },
                { id: "genre-adapt", label: "Genre Adapt", desc: "Adapt to your chosen genre style" },
              ].map((mode) => (
                <div
                  key={mode.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors text-center ${
                    selectedMode === mode.id 
                      ? "border-primary bg-primary/5" 
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedMode(mode.id)}
                >
                  <p className="font-medium text-sm">{mode.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{mode.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Context Summary */}
          <div className="p-3 rounded-lg bg-muted/30 border space-y-2 text-sm">
            <p className="font-medium">AI will use:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{project.humanOriginalPhrases?.length || 0} phrases</Badge>
              <Badge variant="outline">{project.looseLines?.length || 0} lines</Badge>
              <Badge variant="outline">{project.hookBank?.length || 0} hooks</Badge>
              <Badge variant="outline">{project.metaphorBank?.length || 0} metaphors</Badge>
              <Badge variant="outline">Tone: {project.desiredTone || "—"}</Badge>
              <Badge variant="outline">Genre: {project.genre || "—"}</Badge>
              <Badge variant="outline">{activeSections.length} sections</Badge>
            </div>
          </div>

          {/* Generate Button */}
          <Button 
            className="w-full gap-2 py-6 text-base" 
            onClick={generateDraft}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating AI Draft...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                {hasDraft ? "Regenerate AI Draft" : "Generate AI Draft"}
              </>
            )}
          </Button>

          {/* Draft Display */}
          {currentDraft && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">AI Draft v{currentDraft.version}</Label>
                <Badge variant="secondary" className="text-xs">
                  {new Date(currentDraft.timestamp).toLocaleString()}
                </Badge>
              </div>
              <div className="space-y-1">
                {currentDraft.lines.map((line, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded text-sm border-l-2 border-l-blue-400/50 bg-blue-50/5">
                    <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                      {line.section}
                    </Badge>
                    <span className="flex-1">{line.text}</span>
                    <Badge className="text-[10px] bg-blue-500 shrink-0">AI</Badge>
                  </div>
                ))}
              </div>

              {/* Manual edit area for quick changes */}
              <div className="space-y-2">
                <Label>Quick Edit (copy and modify)</Label>
                <Textarea 
                  value={currentDraft.content}
                  className="min-h-[200px] font-mono text-sm"
                  readOnly
                  placeholder="AI draft will appear here..."
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Structure
            </Button>
            <Button onClick={onNext} disabled={!hasDraft} className="gap-2">
              Continue to Rewrite
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helpers

function parseDraftIntoLines(draft: string, sections: (keyof LyricsStructureMap)[]): DraftLine[] {
  const lines: DraftLine[] = [];
  const textLines = draft.split("\n").filter(l => l.trim());
  let currentSection = sections[0] || "verse1";

  for (const line of textLines) {
    // Detect section headers like [Verse 1], [Chorus], etc.
    const sectionMatch = line.match(/^\[(.+?)\]$/);
    if (sectionMatch) {
      const label = sectionMatch[1].toLowerCase().replace(/\s+/g, "");
      const found = Object.entries(SECTION_LABELS).find(
        ([_, v]) => v.toLowerCase().replace(/\s+/g, "") === label
      );
      if (found) currentSection = found[0];
      continue;
    }
    lines.push({
      text: line.trim(),
      section: SECTION_LABELS[currentSection] || currentSection,
      source: "ai-generated",
    });
  }
  return lines;
}

function createOriginDraft(project: LyricsProject): DraftVersion {
  const lines: DraftLine[] = [
    ...(project.humanOriginalPhrases || []).map(p => ({
      text: p,
      section: "Origin",
      source: "human-original" as const,
    })),
    ...(project.looseLines || []).map(l => ({
      text: l,
      section: "Lines",
      source: "human-original" as const,
    })),
    ...(project.hookBank || []).map(h => ({
      text: h,
      section: "Hook",
      source: "human-original" as const,
    })),
  ];
  return {
    version: 1,
    type: "origin",
    content: lines.map(l => l.text).join("\n"),
    lines,
    timestamp: new Date().toISOString(),
  };
}

function createTemplateDraft(project: LyricsProject, sections: (keyof LyricsStructureMap)[]): DraftVersion {
  const lines: DraftLine[] = [];
  for (const section of sections) {
    const label = SECTION_LABELS[section];
    // Use human lines and hooks as starting points
    const humanLines = project.looseLines || [];
    const hooks = project.hookBank || [];
    lines.push({
      text: `[${label}]`,
      section: label,
      source: "human-original",
    });
    if (section === "chorus" && hooks.length > 0) {
      hooks.forEach(h => lines.push({ text: h, section: label, source: "human-original" }));
    } else if (humanLines.length > 0) {
      const line = humanLines[Math.min(lines.length, humanLines.length - 1)];
      if (line) lines.push({ text: line, section: label, source: "human-original" });
    }
    lines.push({ text: "/* Add your lines here */", section: label, source: "ai-generated" });
  }
  return {
    version: 2,
    type: "ai-draft",
    content: lines.map(l => l.text).join("\n"),
    lines: lines.filter(l => !l.text.startsWith("[")),
    timestamp: new Date().toISOString(),
  };
}
