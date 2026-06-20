import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../ui/card";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { 
  Lightbulb, Plus, X, ArrowRight, FileText, Sparkles 
} from "lucide-react";
import type { LyricsProject } from "../../../../../shared/lyrics-workflow-types";
import { 
  EMOTION_OPTIONS, TONE_OPTIONS, GENRE_OPTIONS, LANGUAGE_OPTIONS 
} from "../../../../../shared/lyrics-workflow-types";

interface Phase1OriginProps {
  project: LyricsProject;
  onUpdate: (updates: Partial<LyricsProject>) => void;
  onNext: () => void;
}

export function Phase1Origin({ project, onUpdate, onNext }: Phase1OriginProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [newPhrase, setNewPhrase] = useState("");
  const [newIdea, setNewIdea] = useState("");
  const [newReference, setNewReference] = useState("");

  const addToArray = (field: keyof LyricsProject, value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    const current = (project[field] as string[]) || [];
    if (!current.includes(value.trim())) {
      onUpdate({ [field]: [...current, value.trim()] });
    }
    setter("");
  };

  const removeFromArray = (field: keyof LyricsProject, index: number) => {
    const current = (project[field] as string[]) || [];
    onUpdate({ [field]: current.filter((_, i) => i !== index) });
  };

  const ideasCount = project.humanIdeas?.length || 0;
  const phrasesCount = project.humanOriginalPhrases?.length || 0;
  const hasMinRequirements = ideasCount >= 5 && phrasesCount >= 3 && project.songTitle.trim() !== "" && project.theme.trim() !== "";

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md">
              <Lightbulb className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl">Phase 1: Idea Origin</CardTitle>
              <CardDescription>
                Define the seed of your song. This step proves your work starts from a real human intention.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Title & Language */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="songTitle">Provisional Title *</Label>
              <Input 
                id="songTitle" 
                placeholder="E.g.: Midnight in the City" 
                value={project.songTitle}
                onChange={(e) => onUpdate({ songTitle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={project.language} onValueChange={(v) => onUpdate({ language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map(l => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Genre & Emotion */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Genre</Label>
              <Select value={project.genre} onValueChange={(v) => onUpdate({ genre: v })}>
                <SelectTrigger><SelectValue placeholder="Select genre" /></SelectTrigger>
                <SelectContent>
                  {GENRE_OPTIONS.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dominant Emotion</Label>
              <Select value={project.emotion} onValueChange={(v) => onUpdate({ emotion: v })}>
                <SelectTrigger><SelectValue placeholder="Select emotion" /></SelectTrigger>
                <SelectContent>
                  {EMOTION_OPTIONS.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Theme & Core Message */}
          <div className="space-y-2">
            <Label htmlFor="theme">Main Theme *</Label>
            <Input 
              id="theme" 
              placeholder="E.g.: Breaking free from a toxic relationship" 
              value={project.theme}
              onChange={(e) => onUpdate({ theme: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="messageCore">Core Message</Label>
            <Textarea 
              id="messageCore" 
              placeholder="What is the main message or takeaway of this song?" 
              value={project.messageCore}
              onChange={(e) => onUpdate({ messageCore: e.target.value })}
              className="min-h-[80px]"
            />
          </div>

          {/* Personal Story */}
          <div className="space-y-2">
            <Label htmlFor="personalStory">Personal Story or Experience</Label>
            <Textarea 
              id="personalStory" 
              placeholder="What personal experience or story inspires this song? This strengthens your authorship claim." 
              value={project.personalStory}
              onChange={(e) => onUpdate({ personalStory: e.target.value })}
              className="min-h-[100px]"
            />
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <Label>Desired Tone</Label>
            <Select value={project.desiredTone} onValueChange={(v) => onUpdate({ desiredTone: v })}>
              <SelectTrigger><SelectValue placeholder="Select tone" /></SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Human Seed Input Section */}
          <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 space-y-4 bg-primary/5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Human Seed Input</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              You must provide at least <strong>5 original ideas</strong> and <strong>3 original phrases</strong>. 
              This proves the creative origin is human.
            </p>

            {/* Ideas */}
            <div className="space-y-2">
              <Label>Your Original Ideas ({ideasCount}/5 minimum)</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Enter an idea, concept, or thought..." 
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addToArray("humanIdeas", newIdea, setNewIdea)}
                />
                <Button size="icon" variant="outline" onClick={() => addToArray("humanIdeas", newIdea, setNewIdea)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {project.humanIdeas?.map((idea, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 py-1 px-3">
                    {idea}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray("humanIdeas", i)} />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Original Phrases */}
            <div className="space-y-2">
              <Label>Your Original Phrases ({phrasesCount}/3 minimum)</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Write a phrase or line you'd like in the song..." 
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addToArray("humanOriginalPhrases", newPhrase, setNewPhrase)}
                />
                <Button size="icon" variant="outline" onClick={() => addToArray("humanOriginalPhrases", newPhrase, setNewPhrase)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {project.humanOriginalPhrases?.map((phrase, i) => (
                  <Badge key={i} variant="outline" className="gap-1 py-1 px-3 text-xs">
                    "{phrase}"
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray("humanOriginalPhrases", i)} />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label>Mandatory Keywords</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Add a keyword..." 
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addToArray("keywords", newKeyword, setNewKeyword)}
                />
                <Button size="icon" variant="outline" onClick={() => addToArray("keywords", newKeyword, setNewKeyword)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {project.keywords?.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {kw}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray("keywords", i)} />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Style References */}
            <div className="space-y-2">
              <Label>Style References (artists, songs)</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="E.g.: The Weeknd, Billie Eilish, ..." 
                  value={newReference}
                  onChange={(e) => setNewReference(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addToArray("styleReferences", newReference, setNewReference)}
                />
                <Button size="icon" variant="outline" onClick={() => addToArray("styleReferences", newReference, setNewReference)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {project.styleReferences?.map((ref, i) => (
                  <Badge key={i} variant="outline" className="gap-1">
                    {ref}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray("styleReferences", i)} />
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Output: Lyrics Origin Sheet */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium">Lyrics Origin Sheet</span>
              <span className="text-muted-foreground">— {hasMinRequirements ? "Ready" : "Incomplete"}</span>
            </div>
            <Badge variant={hasMinRequirements ? "default" : "secondary"}>
              {ideasCount}/5 ideas • {phrasesCount}/3 phrases
            </Badge>
          </div>

          {/* Next button */}
          <div className="flex justify-end">
            <Button 
              onClick={onNext} 
              disabled={!hasMinRequirements}
              className="gap-2"
            >
              Continue to Human Lines
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
