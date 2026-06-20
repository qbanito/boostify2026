/**
 * StudioSetup — Setup wizard before going live
 * Configure session title, type, devices, layout, and stream destinations
 */
import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Mic, MicOff, Video, VideoOff, Monitor, Settings, Radio, Users, MessageSquare } from 'lucide-react';
import type { LayoutMode } from '../../lib/canvas-compositor';

interface StudioSetupProps {
  videoDevices: { deviceId: string; label: string }[];
  audioDevices: { deviceId: string; label: string }[];
  selectedVideoDevice: string;
  selectedAudioDevice: string;
  onSelectVideoDevice: (id: string) => void;
  onSelectAudioDevice: (id: string) => void;
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  localStream: MediaStream | null;
  onStartSession: (config: SessionConfig) => void;
}

export interface SessionConfig {
  title: string;
  description: string;
  sessionType: 'podcast' | 'interview' | 'panel' | 'ama' | 'music_session';
  layout: LayoutMode;
  maxParticipants: number;
  settings: {
    allowChat: boolean;
    allowQuestions: boolean;
    allowReactions: boolean;
    autoRecord: boolean;
    showLowerThirds: boolean;
  };
}

export function StudioSetup({
  videoDevices,
  audioDevices,
  selectedVideoDevice,
  selectedAudioDevice,
  onSelectVideoDevice,
  onSelectAudioDevice,
  isMuted,
  isCameraOff,
  onToggleMute,
  onToggleCamera,
  localStream,
  onStartSession,
}: StudioSetupProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sessionType, setSessionType] = useState<SessionConfig['sessionType']>('podcast');
  const [layout, setLayout] = useState<LayoutMode>('solo');
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [settings, setSettings] = useState({
    allowChat: true,
    allowQuestions: true,
    allowReactions: true,
    autoRecord: false,
    showLowerThirds: true,
  });

  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleStart = () => {
    if (!title.trim()) return;
    onStartSession({ title, description, sessionType, layout, maxParticipants, settings });
  };

  const sessionTypes = [
    { value: 'podcast', label: 'Podcast', icon: '🎙️' },
    { value: 'interview', label: 'Interview', icon: '🎤' },
    { value: 'panel', label: 'Panel Discussion', icon: '👥' },
    { value: 'ama', label: 'AMA / Q&A', icon: '❓' },
    { value: 'music_session', label: 'Music Session', icon: '🎵' },
  ];

  const layouts: { value: LayoutMode; label: string; desc: string }[] = [
    { value: 'solo', label: 'Solo', desc: 'Single speaker fullscreen' },
    { value: 'split', label: 'Split', desc: 'Side by side (2 speakers)' },
    { value: 'grid', label: 'Grid', desc: 'Equal grid layout' },
    { value: 'pip', label: 'Picture-in-Picture', desc: 'Main + small overlay' },
    { value: 'interview', label: 'Interview', desc: 'Host 60% + Guest 40%' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Camera Preview + Device Controls */}
      <div className="space-y-4">
        <Card className="overflow-hidden bg-black/50 border-purple-500/30">
          <div className="aspect-video relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {isCameraOff && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <VideoOff className="w-12 h-12 text-gray-500" />
              </div>
            )}
            {/* Camera/Mic controls overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <Button
                size="sm"
                variant={isMuted ? 'destructive' : 'secondary'}
                onClick={onToggleMute}
                className="rounded-full w-10 h-10 p-0"
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                size="sm"
                variant={isCameraOff ? 'destructive' : 'secondary'}
                onClick={onToggleCamera}
                className="rounded-full w-10 h-10 p-0"
              >
                {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </Card>

        {/* Device Selection */}
        <Card className="p-4 bg-gray-900/50 border-gray-700 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Device Settings
          </h3>
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Camera</Label>
            <Select value={selectedVideoDevice} onValueChange={onSelectVideoDevice}>
              <SelectTrigger className="bg-gray-800 border-gray-600">
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {videoDevices.map(d => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Microphone</Label>
            <Select value={selectedAudioDevice} onValueChange={onSelectAudioDevice}>
              <SelectTrigger className="bg-gray-800 border-gray-600">
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {audioDevices.map(d => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      </div>

      {/* Right: Session Configuration */}
      <div className="space-y-4">
        <Card className="p-4 bg-gray-900/50 border-gray-700 space-y-4">
          <h3 className="text-lg font-bold text-white">Session Details</h3>
          
          <div className="space-y-2">
            <Label className="text-gray-300">Title *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="My Awesome Podcast Episode"
              className="bg-gray-800 border-gray-600"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this session about?"
              className="bg-gray-800 border-gray-600"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Session Type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sessionTypes.map(st => (
                <button
                  key={st.value}
                  onClick={() => setSessionType(st.value as SessionConfig['sessionType'])}
                  className={`p-2 rounded-lg border text-sm text-left transition-all ${
                    sessionType === st.value
                      ? 'border-purple-500 bg-purple-500/20 text-white'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <span className="mr-1">{st.icon}</span> {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Layout</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {layouts.map(l => (
                <button
                  key={l.value}
                  onClick={() => setLayout(l.value)}
                  className={`p-2 rounded-lg border text-xs transition-all ${
                    layout === l.value
                      ? 'border-purple-500 bg-purple-500/20 text-white'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <div className="font-semibold">{l.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{l.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick settings toggles */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'allowChat', label: 'Chat', icon: <MessageSquare className="w-3 h-3" /> },
              { key: 'allowReactions', label: 'Reactions', icon: <span>🎉</span> },
              { key: 'autoRecord', label: 'Auto Record', icon: <Radio className="w-3 h-3" /> },
            ].map(({ key, label, icon }) => (
              <Badge
                key={key}
                variant={settings[key as keyof typeof settings] ? 'default' : 'outline'}
                className={`cursor-pointer transition-all ${
                  settings[key as keyof typeof settings]
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'hover:bg-gray-700'
                }`}
                onClick={() => setSettings(s => ({ ...s, [key]: !s[key as keyof typeof settings] }))}
              >
                {icon} {label}
              </Badge>
            ))}
          </div>
        </Card>

        <Button
          onClick={handleStart}
          disabled={!title.trim()}
          className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-lg"
        >
          <Radio className="w-5 h-5 mr-2" />
          Create Studio Room
        </Button>
      </div>
    </div>
  );
}
