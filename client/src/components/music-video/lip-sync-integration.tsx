import React, { useState } from 'react';
import { logger } from "../../lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Input } from '../ui/input';
import { toast } from '../../hooks/use-toast';
import { Loader2, Ear, Mic, Bot, Upload, Music2 } from 'lucide-react';

interface LipSyncIntegrationProps {
  onApplyLipSync: (settings: LipSyncSettings) => void;
  isLoading?: boolean;
}

export interface LipSyncSettings {
  sourceType: 'text' | 'audio';
  voiceId?: string;
  text?: string;
  audioFile?: File;
  intensity: number;
  isEnabled: boolean;
}

const voiceOptions = [
  { id: 'male-1', name: 'Daniel (Hombre)' },
  { id: 'female-1', name: 'Sofía (Mujer)' },
  { id: 'male-2', name: 'Carlos (Hombre)' },
  { id: 'female-2', name: 'María (Mujer)' },
  { id: 'neutral-1', name: 'Alex (Neutral)' }
];

export function LipSyncIntegration({ onApplyLipSync, isLoading = false }: LipSyncIntegrationProps) {
  const [settings, setSettings] = useState<LipSyncSettings>({
    sourceType: 'text',
    voiceId: 'male-1',
    text: '',
    intensity: 70,
    isEnabled: true
  });
  
  const [audioFileName, setAudioFileName] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFileName(file.name);
      setSettings({...settings, audioFile: file});
    }
  };

  const handleApply = () => {
    if (settings.sourceType === 'text' && !settings.text) {
      toast({
        title: "Error",
        description: "Por favor, ingresa el texto para la sincronización",
        variant: "destructive"
      });
      return;
    }
    
    if (settings.sourceType === 'audio' && !settings.audioFile) {
      toast({
        title: "Error",
        description: "Por favor, sube un archivo de audio",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Sincronización aplicada",
      description: "La sincronización de labios se ha configurado correctamente"
    });
    
    onApplyLipSync(settings);
  };

  return (
    <Card className="border border-purple-200 bg-purple-50/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Ear className="h-5 w-5 mr-2 text-purple-600" />
          Sincronización de Labios
        </CardTitle>
        <CardDescription>
          Sincroniza los labios de los personajes con audio o texto
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="lip-sync-enable" className="font-medium">Activar Sincronización</Label>
          <Switch 
            id="lip-sync-enable" 
            checked={settings.isEnabled} 
            onCheckedChange={(checked) => setSettings({...settings, isEnabled: checked})}
          />
        </div>
        
        {settings.isEnabled && (
          <>
            <div className="space-y-2">
              <Label>Fuente de Audio</Label>
              <RadioGroup 
                value={settings.sourceType} 
                onValueChange={(value: 'text' | 'audio') => setSettings({...settings, sourceType: value})}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="text" id="source-text" />
                  <Label htmlFor="source-text" className="flex items-center cursor-pointer">
                    <Bot className="h-4 w-4 mr-2 text-purple-500" />
                    Generar voz desde texto
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="audio" id="source-audio" />
                  <Label htmlFor="source-audio" className="flex items-center cursor-pointer">
                    <Music2 className="h-4 w-4 mr-2 text-purple-500" />
                    Subir archivo de audio
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            {settings.sourceType === 'text' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="voice-select">Seleccionar Voz</Label>
                  <Select 
                    value={settings.voiceId} 
                    onValueChange={(value) => setSettings({...settings, voiceId: value})}
                  >
                    <SelectTrigger id="voice-select">
                      <SelectValue placeholder="Seleccionar voz" />
                    </SelectTrigger>
                    <SelectContent>
                      {voiceOptions.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>{voice.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lip-sync-text">Texto para Sincronizar</Label>
                  <textarea 
                    id="lip-sync-text" 
                    className="w-full h-24 min-h-[6rem] p-2 border rounded-md"
                    placeholder="Escribe o pega el texto para sincronizar con los labios..."
                    value={settings.text}
                    onChange={(e) => setSettings({...settings, text: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    El texto se convertirá en voz y se sincronizará con los labios de los personajes.
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="audio-file">Subir Archivo de Audio</Label>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      id="audio-file"
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.webm"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => document.getElementById('audio-file')?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Seleccionar Archivo
                    </Button>
                  </div>
                  {audioFileName && (
                    <div className="text-sm flex items-center gap-2 text-muted-foreground">
                      <Mic className="h-4 w-4 text-purple-500" />
                      {audioFileName}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        
        <div className="pt-4">
          <Button 
            onClick={handleApply} 
            className="w-full bg-purple-600 hover:bg-purple-700"
            disabled={isLoading || !settings.isEnabled}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aplicando Sincronización...
              </>
            ) : (
              <>
                <Ear className="mr-2 h-4 w-4" />
                Aplicar Sincronización de Labios
              </>
            )}
          </Button>
        </div>
        
        {!settings.isEnabled && (
          <div className="bg-purple-100 p-3 rounded-md text-sm">
            <p>La sincronización de labios está desactivada. Actívala para configurar esta función.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}