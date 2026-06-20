import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Label } from "../../ui/label";
import { ScrollArea } from "../../ui/scroll-area";
import { 
  GitBranch, ArrowRight, ArrowLeft, Clock, FileText 
} from "lucide-react";
import type { LyricsProject, DraftVersion } from "../../../../../shared/lyrics-workflow-types";

interface Phase6VersionControlProps {
  project: LyricsProject;
  onUpdate: (updates: Partial<LyricsProject>) => void;
  onNext: () => void;
  onBack: () => void;
}

const versionTypeLabel: Record<string, string> = {
  "origin": "Origin Draft",
  "ai-draft": "AI Draft",
  "human-edit": "Human Edit Draft",
  "final": "Final Approved Lyrics",
};

const versionTypeColor: Record<string, string> = {
  "origin": "bg-green-500",
  "ai-draft": "bg-blue-500",
  "human-edit": "bg-teal-500",
  "final": "bg-primary",
};

export function Phase6VersionControl({ project, onUpdate, onNext, onBack }: Phase6VersionControlProps) {
  const versions = project.draftVersions || [];

  const promoteToFinal = () => {
    const humanEdit = versions.find(d => d.type === "human-edit");
    if (!humanEdit) return;

    const finalVersion: DraftVersion = {
      ...humanEdit,
      version: versions.length + 1,
      type: "final",
      timestamp: new Date().toISOString(),
    };

    onUpdate({
      draftVersions: [...versions, finalVersion],
      finalLyrics: finalVersion.content,
    });
  };

  const hasFinal = versions.some(d => d.type === "final");
  const hasHumanEdit = versions.some(d => d.type === "human-edit");

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md">
              <GitBranch className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl">Phase 6: Version Control</CardTitle>
              <CardDescription>
                Full timeline of every change. Every version is timestamped and attributed.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">

          {/* Version Timeline */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Lyrics Authorship Timeline</Label>
            <div className="relative pl-8">
              {/* Timeline line */}
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />

              {versions.map((version, i) => (
                <div key={i} className="relative mb-4">
                  {/* Timeline dot */}
                  <div className={`absolute -left-5 top-2 h-3 w-3 rounded-full ${versionTypeColor[version.type]} ring-2 ring-background`} />
                  
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className={versionTypeColor[version.type]}>
                          v{version.version}
                        </Badge>
                        <span className="font-medium text-sm">
                          {versionTypeLabel[version.type]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(version.timestamp).toLocaleString()}
                      </div>
                    </div>

                    {/* Line summary */}
                    <div className="flex flex-wrap gap-1 text-xs">
                      {countSources(version).map(({ source, count }) => (
                        <Badge key={source} variant="outline" className="text-[10px]">
                          {source}: {count}
                        </Badge>
                      ))}
                    </div>

                    {/* Content preview */}
                    <ScrollArea className="max-h-[200px]">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground p-2 rounded bg-muted/30">
                        {version.content}
                      </pre>
                    </ScrollArea>

                    {/* Line diff indicators */}
                    {version.lines.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {version.lines.map((line, li) => (
                          <div 
                            key={li}
                            className={`h-2 w-2 rounded-full ${
                              line.source === "human-original" ? "bg-green-500" :
                              line.source === "human-rewritten" ? "bg-emerald-500" :
                              line.source === "human-edited" ? "bg-teal-500" :
                              line.source === "human-approved" ? "bg-blue-500" :
                              "bg-orange-500"
                            }`}
                            title={`${line.section}: ${line.source}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-green-500" /> Human Original</div>
            <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald-500" /> Rewritten</div>
            <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-teal-500" /> Edited</div>
            <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-blue-500" /> Approved</div>
            <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-orange-500" /> AI Generated</div>
          </div>

          {/* Approve as Final */}
          {hasHumanEdit && !hasFinal && (
            <Button className="w-full gap-2" onClick={promoteToFinal}>
              <FileText className="h-4 w-4" />
              Approve as Final Lyrics
            </Button>
          )}

          {hasFinal && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-center font-medium text-green-700">
              ✅ Final lyrics approved and recorded
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Rewrite
            </Button>
            <Button onClick={onNext} disabled={!hasFinal} className="gap-2">
              Generate Authorship Packet
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function countSources(version: DraftVersion) {
  const counts: Record<string, number> = {};
  for (const line of version.lines) {
    counts[line.source] = (counts[line.source] || 0) + 1;
  }
  return Object.entries(counts).map(([source, count]) => ({ source, count }));
}
