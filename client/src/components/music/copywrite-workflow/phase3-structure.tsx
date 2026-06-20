import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../ui/card";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Switch } from "../../ui/switch";
import { 
  LayoutList, ArrowRight, ArrowLeft, FileText 
} from "lucide-react";
import type { LyricsProject, LyricsStructureMap } from "../../../../../shared/lyrics-workflow-types";
import { SECTION_LABELS } from "../../../../../shared/lyrics-workflow-types";

interface Phase3StructureProps {
  project: LyricsProject;
  onUpdate: (updates: Partial<LyricsProject>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Phase3Structure({ project, onUpdate, onNext, onBack }: Phase3StructureProps) {
  const structure = project.structureMap || {
    intro: false, verse1: true, preChorus: true, chorus: true,
    verse2: true, bridge: true, outro: true,
  };

  const toggleSection = (key: keyof LyricsStructureMap) => {
    onUpdate({ structureMap: { ...structure, [key]: !structure[key] } });
  };

  const activeSections = Object.entries(structure).filter(([_, v]) => v).length;

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md">
              <LayoutList className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl">Phase 3: Structure Builder</CardTitle>
              <CardDescription>
                Define the architecture of your lyrics. You decide the form — not the AI.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">

          {/* Section Toggles */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Song Sections</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(SECTION_LABELS) as (keyof LyricsStructureMap)[]).map((key) => (
                <div 
                  key={key}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    structure[key] ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{SECTION_LABELS[key]}</span>
                    {structure[key] && <Badge variant="outline" className="text-xs">Active</Badge>}
                  </div>
                  <Switch 
                    checked={structure[key]} 
                    onCheckedChange={() => toggleSection(key)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Structure Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Number of Verses</Label>
              <Select 
                value={String(project.verseCount)} 
                onValueChange={(v) => onUpdate({ verseCount: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "verse" : "verses"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Chorus Length</Label>
              <Select 
                value={project.chorusLength} 
                onValueChange={(v) => onUpdate({ chorusLength: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (2-4 lines)</SelectItem>
                  <SelectItem value="medium">Medium (4-6 lines)</SelectItem>
                  <SelectItem value="long">Long (6-8 lines)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hook Repetition</Label>
              <Select 
                value={String(project.hookRepetition)} 
                onValueChange={(v) => onUpdate({ hookRepetition: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} time{n > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bridge Position</Label>
              <Select 
                value={project.bridgePosition} 
                onValueChange={(v) => onUpdate({ bridgePosition: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="after-verse2">After Verse 2</SelectItem>
                  <SelectItem value="after-chorus2">After 2nd Chorus</SelectItem>
                  <SelectItem value="before-outro">Before Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Closing Type</Label>
              <Select 
                value={project.closingType} 
                onValueChange={(v) => onUpdate({ closingType: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fade">Fade Out</SelectItem>
                  <SelectItem value="final-chorus">Final Chorus</SelectItem>
                  <SelectItem value="spoken">Spoken Word</SelectItem>
                  <SelectItem value="instrumental">Instrumental</SelectItem>
                  <SelectItem value="abrupt">Abrupt End</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Structure Preview */}
          <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Lyrics Structure Map</span>
              <Badge variant="default" className="text-xs">{activeSections} sections</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SECTION_LABELS) as (keyof LyricsStructureMap)[])
                .filter(key => structure[key])
                .map((key, i, arr) => (
                  <div key={key} className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">{SECTION_LABELS[key]}</Badge>
                    {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                  </div>
                ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Human Lines
            </Button>
            <Button onClick={onNext} disabled={activeSections < 2} className="gap-2">
              Continue to AI Draft
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
