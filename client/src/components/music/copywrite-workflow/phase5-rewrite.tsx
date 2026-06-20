import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Progress } from "../../ui/progress";
import { 
  PenTool, ArrowRight, ArrowLeft, FileText, Check, RotateCcw 
} from "lucide-react";
import type { LyricsProject, DraftVersion, DraftLine, AuthorshipMetrics } from "../../../../../shared/lyrics-workflow-types";

interface Phase5RewriteProps {
  project: LyricsProject;
  onUpdate: (updates: Partial<LyricsProject>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface EditingLine extends DraftLine {
  editedText: string;
  editComment: string;
  isEditing: boolean;
}

export function Phase5Rewrite({ project, onUpdate, onNext, onBack }: Phase5RewriteProps) {
  const aiDraft = project.draftVersions?.find(d => d.type === "ai-draft");
  
  const [editingLines, setEditingLines] = useState<EditingLine[]>(() => 
    (aiDraft?.lines || []).map(line => ({
      ...line,
      editedText: line.text,
      editComment: "",
      isEditing: false,
    }))
  );

  const startEditing = (index: number) => {
    setEditingLines(prev => prev.map((l, i) => 
      i === index ? { ...l, isEditing: true } : l
    ));
  };

  const saveEdit = (index: number) => {
    setEditingLines(prev => prev.map((l, i) => {
      if (i !== index) return l;
      const wasChanged = l.editedText.trim() !== l.text.trim();
      return {
        ...l,
        isEditing: false,
        source: wasChanged 
          ? (l.source === "ai-generated" ? "human-rewritten" : "human-edited")
          : l.source === "ai-generated" ? "human-approved" : l.source,
        originalAiText: l.source === "ai-generated" ? l.text : l.originalAiText,
        text: l.editedText.trim(),
      };
    }));
  };

  const approveUnchanged = (index: number) => {
    setEditingLines(prev => prev.map((l, i) => 
      i === index ? { ...l, source: l.source === "ai-generated" ? "human-approved" : l.source } : l
    ));
  };

  const revertEdit = (index: number) => {
    setEditingLines(prev => prev.map((l, i) => {
      if (i !== index) return l;
      const original = aiDraft?.lines[i];
      return {
        ...l,
        editedText: original?.text || l.text,
        text: original?.text || l.text,
        source: original?.source || "ai-generated",
        isEditing: false,
        editComment: "",
      };
    }));
  };

  // Compute metrics
  const metrics = computeMetrics(editingLines);
  const allReviewed = editingLines.every(l => l.source !== "ai-generated");

  const saveRewrite = () => {
    const humanEditDraft: DraftVersion = {
      version: (project.draftVersions?.length || 0) + 1,
      type: "human-edit",
      content: editingLines.map(l => l.text).join("\n"),
      lines: editingLines.map(l => ({
        text: l.text,
        section: l.section,
        source: l.source,
        originalAiText: l.originalAiText,
        editComment: l.editComment || undefined,
      })),
      timestamp: new Date().toISOString(),
    };

    const existingVersions = project.draftVersions || [];
    onUpdate({
      draftVersions: [...existingVersions.filter(d => d.type !== "human-edit"), humanEditDraft],
      authorshipMetrics: metrics,
    });
    onNext();
  };

  const sourceColor: Record<string, string> = {
    "human-original": "bg-green-500",
    "human-rewritten": "bg-emerald-500",
    "human-edited": "bg-teal-500",
    "human-approved": "bg-blue-500",
    "ai-generated": "bg-orange-500",
  };

  const sourceLabel: Record<string, string> = {
    "human-original": "Human Original",
    "human-rewritten": "Rewritten",
    "human-edited": "Edited",
    "human-approved": "Approved",
    "ai-generated": "AI (Pending)",
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md">
              <PenTool className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl">Phase 5: Rewrite Layer</CardTitle>
              <CardDescription>
                Review each line. Rewrite, approve, or edit. Every decision is tracked for authorship evidence.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">

          {/* Metrics Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Human Original" value={metrics.humanOriginalLines} color="text-green-600" />
            <MetricCard label="Human Edited" value={metrics.humanEditedLines + metrics.humanRewrittenLines} color="text-teal-600" />
            <MetricCard label="AI Accepted" value={metrics.aiAcceptedLines} color="text-blue-600" />
            <MetricCard label="Pending Review" value={editingLines.filter(l => l.source === "ai-generated").length} color="text-orange-600" />
          </div>

          {/* Human Intervention Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Human Intervention Score</span>
              <span className="font-bold text-primary">{metrics.rewritePercentage}%</span>
            </div>
            <Progress value={metrics.rewritePercentage} className="h-3" />
            <p className="text-xs text-muted-foreground">
              Higher percentages strengthen your authorship claim.
            </p>
          </div>

          {/* Line-by-line Editor */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Line-by-Line Review</Label>
            <div className="space-y-1">
              {editingLines.map((line, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0 mt-1">{line.section}</Badge>
                    
                    {line.isEditing ? (
                      <div className="flex-1 space-y-2">
                        <Input 
                          value={line.editedText}
                          onChange={(e) => setEditingLines(prev => 
                            prev.map((l, idx) => idx === i ? { ...l, editedText: e.target.value } : l)
                          )}
                          className="text-sm"
                        />
                        <Input 
                          placeholder="Why did you change this line? (optional comment)"
                          value={line.editComment}
                          onChange={(e) => setEditingLines(prev => 
                            prev.map((l, idx) => idx === i ? { ...l, editComment: e.target.value } : l)
                          )}
                          className="text-xs"
                        />
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={() => saveEdit(i)} className="text-xs gap-1">
                            <Check className="h-3 w-3" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => revertEdit(i)} className="text-xs gap-1">
                            <RotateCcw className="h-3 w-3" /> Revert
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-sm flex-1">{line.text}</span>
                        {line.originalAiText && line.originalAiText !== line.text && (
                          <span className="text-xs text-muted-foreground line-through">{line.originalAiText}</span>
                        )}
                      </div>
                    )}

                    <Badge className={`text-[10px] shrink-0 ${sourceColor[line.source]}`}>
                      {sourceLabel[line.source]}
                    </Badge>
                  </div>

                  {!line.isEditing && line.source === "ai-generated" && (
                    <div className="flex gap-1 pl-16">
                      <Button size="sm" variant="outline" onClick={() => startEditing(i)} className="text-xs">
                        ✏️ Rewrite
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => approveUnchanged(i)} className="text-xs">
                        ✅ Approve
                      </Button>
                    </div>
                  )}
                  {!line.isEditing && line.source !== "ai-generated" && (
                    <div className="flex gap-1 pl-16">
                      <Button size="sm" variant="ghost" onClick={() => startEditing(i)} className="text-xs">
                        ✏️ Edit
                      </Button>
                    </div>
                  )}

                  {line.editComment && !line.isEditing && (
                    <p className="text-xs text-muted-foreground pl-16 italic">💬 {line.editComment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Human Revision Report */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium">Human Revision Report</span>
              <span className="text-muted-foreground">— {allReviewed ? "Complete" : "In Progress"}</span>
            </div>
            <Badge variant={allReviewed ? "default" : "secondary"}>
              {metrics.totalDecisions} decisions
            </Badge>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to AI Draft
            </Button>
            <Button onClick={saveRewrite} disabled={!allReviewed} className="gap-2">
              Continue to Versioning
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-3 rounded-lg border text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function computeMetrics(lines: EditingLine[]): AuthorshipMetrics {
  const total = lines.length || 1;
  const humanOriginal = lines.filter(l => l.source === "human-original").length;
  const humanEdited = lines.filter(l => l.source === "human-edited").length;
  const humanRewritten = lines.filter(l => l.source === "human-rewritten").length;
  const aiAccepted = lines.filter(l => l.source === "human-approved").length;
  const decisions = lines.filter(l => l.source !== "ai-generated").length;
  const humanPercentage = Math.round(((humanOriginal + humanEdited + humanRewritten) / total) * 100);

  return {
    humanOriginalLines: humanOriginal,
    humanEditedLines: humanEdited,
    aiAcceptedLines: aiAccepted,
    humanRewrittenLines: humanRewritten,
    rewritePercentage: humanPercentage,
    totalDecisions: decisions,
  };
}
