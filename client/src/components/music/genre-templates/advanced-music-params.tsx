import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Slider } from "../../ui/slider";
import { Switch } from "../../ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";

import { 
  Music, 
  MusicIcon, 
  FileMusic, 
  Upload, 
  Repeat, 
  BrainCircuit, 
  MessageSquare
} from "lucide-react";

/**
 * Structure to define advanced music generation parameters
 */
export interface MusicGenerationAdvancedParams {
  makeInstrumental: boolean;
  negativeTags: string;
  tags: string;
  lyricsType: 'auto' | 'none' | 'custom';
  customLyrics: string;
  seed: number;
  continueClipId: string;
  continueAt: number;
  gptDescriptionPrompt: string;
  prompt: string;
  title: string;
  serviceMode: string;
  generateLyrics: boolean;
  uploadAudio: boolean;
  audioUrl: string;
  tempo: number;
  keySignature: string;
  mainInstruments: string[];
  structure: {
    intro: boolean;
    verse: boolean;
    chorus: boolean;
    bridge: boolean;
    outro: boolean;
  };
  musicTemplate: string;
}

interface MusicGenerationAdvancedParamsProps {
  params: MusicGenerationAdvancedParams;
  setParams: (params: MusicGenerationAdvancedParams) => void;
  advancedModeType: 'standard' | 'continuation' | 'lyrics' | 'upload';
  setAdvancedModeType: (mode: 'standard' | 'continuation' | 'lyrics' | 'upload') => void;
}

/**
 * Component to configure advanced music generation parameters
 * Offers multiple modes and specific options for each one
 */
export function MusicGenerationAdvancedParams({
  params,
  setParams,
  advancedModeType,
  setAdvancedModeType
}: MusicGenerationAdvancedParamsProps) {
  const handleParamChange = (name: string, value: any) => {
    setParams({
      ...params,
      [name]: value
    });
  };
  
  const keySignatureOptions = [
    "C Major", "G Major", "D Major", "A Major", "E Major", "B Major", "F# Major", "Db Major",
    "Ab Major", "Eb Major", "Bb Major", "F Major",
    "A Minor", "E Minor", "B Minor", "F# Minor", "C# Minor", "G# Minor", "Eb Minor",
    "Bb Minor", "F Minor", "C Minor", "G Minor", "D Minor"
  ];
  
  return (
    <div className="space-y-4">
      {/* Advanced mode selector */}
      <Tabs 
        value={advancedModeType} 
        onValueChange={(v) => setAdvancedModeType(v as 'standard' | 'continuation' | 'lyrics' | 'upload')} 
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="standard" className="text-xs px-2 py-1.5">
            <MusicIcon className="w-3.5 h-3.5 mr-1" />
            Standard
          </TabsTrigger>
          <TabsTrigger value="continuation" className="text-xs px-2 py-1.5">
            <Repeat className="w-3.5 h-3.5 mr-1" />
            Continuation
          </TabsTrigger>
          <TabsTrigger value="lyrics" className="text-xs px-2 py-1.5">
            <MessageSquare className="w-3.5 h-3.5 mr-1" />
            Lyrics
          </TabsTrigger>
          <TabsTrigger value="upload" className="text-xs px-2 py-1.5">
            <Upload className="w-3.5 h-3.5 mr-1" />
            Upload Audio
          </TabsTrigger>
        </TabsList>
        
        {/* Parameters for standard mode */}
        <TabsContent value="standard" className="space-y-4 mt-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="music-params">
              <AccordionTrigger className="py-2 text-sm font-medium">
                <div className="flex items-center">
                  <Music className="h-4 w-4 mr-2" />
                  Musical Parameters
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 p-2">
                  {/* Tempo (BPM) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="tempo" className="text-xs">Tempo (BPM)</Label>
                      <span className="text-xs font-mono">{params.tempo} BPM</span>
                    </div>
                    <Slider
                      id="tempo"
                      min={60}
                      max={180}
                      step={1}
                      value={[params.tempo]}
                      onValueChange={(values) => handleParamChange("tempo", values[0])}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Slow</span>
                      <span>Medium</span>
                      <span>Fast</span>
                    </div>
                  </div>
                  
                  {/* Key Signature */}
                  <div className="space-y-2">
                    <Label htmlFor="keySignature" className="text-xs">Key Signature</Label>
                    <Select
                      value={params.keySignature}
                      onValueChange={(value) => handleParamChange("keySignature", value)}
                    >
                      <SelectTrigger id="keySignature">
                        <SelectValue placeholder="Select key signature" />
                      </SelectTrigger>
                      <SelectContent>
                        {keySignatureOptions.map((key) => (
                          <SelectItem key={key} value={key}>
                            {key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Song Structure */}
                  <div className="space-y-2">
                    <Label className="text-xs">Song Structure</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="intro"
                          checked={params.structure.intro}
                          onCheckedChange={(checked) => handleParamChange("structure", { ...params.structure, intro: checked })}
                        />
                        <Label htmlFor="intro" className="text-xs">Intro</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="verse"
                          checked={params.structure.verse}
                          onCheckedChange={(checked) => handleParamChange("structure", { ...params.structure, verse: checked })}
                        />
                        <Label htmlFor="verse" className="text-xs">Verse</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="chorus"
                          checked={params.structure.chorus}
                          onCheckedChange={(checked) => handleParamChange("structure", { ...params.structure, chorus: checked })}
                        />
                        <Label htmlFor="chorus" className="text-xs">Chorus</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="bridge"
                          checked={params.structure.bridge}
                          onCheckedChange={(checked) => handleParamChange("structure", { ...params.structure, bridge: checked })}
                        />
                        <Label htmlFor="bridge" className="text-xs">Bridge</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="outro"
                          checked={params.structure.outro}
                          onCheckedChange={(checked) => handleParamChange("structure", { ...params.structure, outro: checked })}
                        />
                        <Label htmlFor="outro" className="text-xs">Outro</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="advanced-options">
              <AccordionTrigger className="py-2 text-sm font-medium">
                <div className="flex items-center">
                  <BrainCircuit className="h-4 w-4 mr-2" />
                  Advanced Options
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 p-2">
                  {/* Instrumental options */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="makeInstrumental"
                      checked={params.makeInstrumental}
                      onCheckedChange={(checked) => handleParamChange("makeInstrumental", checked)}
                    />
                    <Label htmlFor="makeInstrumental" className="text-xs">Generate instrumental version</Label>
                  </div>
                  
                  {/* Include tags */}
                  <div className="space-y-2">
                    <Label htmlFor="tags" className="text-xs">Tags to include (comma separated)</Label>
                    <Input
                      id="tags"
                      value={params.tags}
                      onChange={(e) => handleParamChange("tags", e.target.value)}
                      placeholder="jazz, piano, smooth, ..."
                    />
                  </div>
                  
                  {/* Exclude tags */}
                  <div className="space-y-2">
                    <Label htmlFor="negativeTags" className="text-xs">Tags to exclude (comma separated)</Label>
                    <Input
                      id="negativeTags"
                      value={params.negativeTags}
                      onChange={(e) => handleParamChange("negativeTags", e.target.value)}
                      placeholder="heavy, distorted, loud, ..."
                    />
                  </div>
                  
                  {/* Random generation seed */}
                  <div className="space-y-2">
                    <Label htmlFor="seed" className="text-xs">Seed (-1 for random)</Label>
                    <Input
                      id="seed"
                      type="number"
                      value={params.seed}
                      onChange={(e) => handleParamChange("seed", parseInt(e.target.value) || -1)}
                      min="-1"
                      max="999999999"
                    />
                    <p className="text-xs text-muted-foreground">
                      A specific seed allows you to reproduce the same generation.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
        
        {/* Parameters for continuation mode */}
        <TabsContent value="continuation" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="continueClipId" className="text-sm font-medium">Clip ID to continue</Label>
              <Input
                id="continueClipId"
                value={params.continueClipId}
                onChange={(e) => handleParamChange("continueClipId", e.target.value)}
                placeholder="E.g. A1B2C3D4"
              />
              <p className="text-xs text-muted-foreground">
                Enter the ID of the music clip you want to continue.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="continueAt" className="text-sm font-medium">Continue at (seconds)</Label>
                <span className="text-xs font-mono">{params.continueAt}s</span>
              </div>
              <Slider
                id="continueAt"
                min={5}
                max={60}
                step={1}
                value={[params.continueAt]}
                onValueChange={(values) => handleParamChange("continueAt", values[0])}
              />
              <p className="text-xs text-muted-foreground">
                Define at which second the new generation will continue the original piece.
              </p>
            </div>
          </div>
        </TabsContent>
        
        {/* Parameters for lyrics mode */}
        <TabsContent value="lyrics" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Lyrics Options</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="generateLyrics"
                  checked={params.generateLyrics}
                  onCheckedChange={(checked) => handleParamChange("generateLyrics", checked)}
                />
                <Label htmlFor="generateLyrics" className="text-xs">
                  Generate lyrics automatically
                </Label>
              </div>
            </div>
            
            {!params.generateLyrics && (
              <div className="space-y-2">
                <Label htmlFor="customLyrics" className="text-sm font-medium">Custom lyrics</Label>
                <Textarea
                  id="customLyrics"
                  value={params.customLyrics}
                  onChange={(e) => handleParamChange("customLyrics", e.target.value)}
                  placeholder="Write your custom lyrics here..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Separate verses and choruses with blank lines for better structure.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
        
        {/* Parameters for upload audio mode */}
        <TabsContent value="upload" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audioUrl" className="text-sm font-medium">Audio URL</Label>
              <Input
                id="audioUrl"
                value={params.audioUrl}
                onChange={(e) => handleParamChange("audioUrl", e.target.value)}
                placeholder="https://example.com/audio.mp3"
              />
              <p className="text-xs text-muted-foreground">
                Provide a public URL to an MP3, WAV, or FLAC audio file.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Upload audio file</Label>
              <div className="border-2 border-dashed rounded-md p-4 text-center">
                <FileMusic className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag your file here or
                </p>
                <Button type="button" size="sm" className="mx-auto">
                  Select file
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported formats: MP3, WAV, FLAC. Maximum 10 MB.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}