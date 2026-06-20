/**
 * EpisodePublisher — Post-recording flow to publish a podcast episode
 * Allows editing title, description, show notes, chapters, and publishing
 */
import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import {
  Upload, ArrowLeft, Globe, Tag, Clock, FileText,
  Plus, Trash2, Play, Check, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';

interface EpisodePublisherProps {
  sessionTitle: string;
  sessionDescription?: string;
  recordingDuration: number;
  recordingSize: number;
  onPublish: (episodeData: EpisodeData) => Promise<void>;
  onBack: () => void;
  isUploading: boolean;
}

export interface EpisodeData {
  title: string;
  description: string;
  showNotes: string;
  tags: string[];
  category: string;
  episodeNumber?: number;
  seasonNumber?: number;
  language: string;
  explicit: boolean;
  chapters: Array<{ title: string; startTime: number; endTime?: number }>;
  publishNow: boolean;
}

const CATEGORIES = [
  'Technology', 'Music', 'Business', 'Education', 'Comedy',
  'Health', 'Science', 'Culture', 'News', 'Sports',
  'Entertainment', 'Arts', 'Society', 'True Crime', 'Other',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
];

export function EpisodePublisher({
  sessionTitle,
  sessionDescription,
  recordingDuration,
  recordingSize,
  onPublish,
  onBack,
  isUploading,
}: EpisodePublisherProps) {
  const [title, setTitle] = useState(sessionTitle || '');
  const [description, setDescription] = useState(sessionDescription || '');
  const [showNotes, setShowNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [category, setCategory] = useState('Technology');
  const [episodeNumber, setEpisodeNumber] = useState<number | undefined>();
  const [seasonNumber, setSeasonNumber] = useState<number | undefined>();
  const [language, setLanguage] = useState('en');
  const [explicit, setExplicit] = useState(false);
  const [chapters, setChapters] = useState<Array<{ title: string; startTime: number }>>([]);
  const [publishNow, setPublishNow] = useState(true);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterTime, setNewChapterTime] = useState('');

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const addChapter = () => {
    if (!newChapterTitle.trim()) return;
    const parts = newChapterTime.split(':').map(Number);
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else seconds = parts[0] || 0;

    if (seconds >= 0 && seconds < recordingDuration) {
      setChapters([...chapters, { title: newChapterTitle.trim(), startTime: seconds }].sort((a, b) => a.startTime - b.startTime));
      setNewChapterTitle('');
      setNewChapterTime('');
    }
  };

  const handlePublish = () => {
    if (!title.trim()) return;
    onPublish({
      title,
      description,
      showNotes,
      tags,
      category,
      episodeNumber,
      seasonNumber,
      language,
      explicit,
      chapters,
      publishNow,
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-400">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-white">Publish Episode</h2>
          <p className="text-sm text-gray-400">Fill in the details and publish your podcast episode</p>
        </div>
      </div>

      {/* Recording Info Bar */}
      <Card className="p-3 mb-6 bg-gray-900/50 border-gray-700 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Play className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Recording</p>
            <p className="text-sm text-white font-semibold">{fmt(recordingDuration)} · {formatBytes(recordingSize)}</p>
          </div>
        </div>
        {isUploading && (
          <Badge className="bg-purple-600 text-white ml-auto">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading...
          </Badge>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 bg-gray-900/50 border-gray-700 space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Episode Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Episode title" className="bg-gray-800 border-gray-600 text-white" />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this episode about?" className="bg-gray-800 border-gray-600 text-white" rows={3} />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Show Notes</Label>
              <Textarea value={showNotes} onChange={e => setShowNotes(e.target.value)} placeholder="Links, references, credits..." className="bg-gray-800 border-gray-600 text-white" rows={4} />
            </div>
          </Card>

          {/* Chapters */}
          <Card className="p-4 bg-gray-900/50 border-gray-700 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" /> Chapters
            </h3>
            {chapters.length > 0 && (
              <div className="space-y-1">
                {chapters.map((ch, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">{fmt(ch.startTime)}</Badge>
                      <span className="text-xs text-white">{ch.title}</span>
                    </div>
                    <button onClick={() => setChapters(chapters.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input value={newChapterTime} onChange={e => setNewChapterTime(e.target.value)} placeholder="0:00" className="bg-gray-800 border-gray-600 w-20 text-xs" />
              <Input value={newChapterTitle} onChange={e => setNewChapterTitle(e.target.value)} placeholder="Chapter title" className="bg-gray-800 border-gray-600 flex-1 text-xs" onKeyDown={e => e.key === 'Enter' && addChapter()} />
              <Button size="sm" variant="outline" onClick={addChapter} className="border-gray-600 text-xs">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Sidebar — Metadata */}
        <div className="space-y-4">
          <Card className="p-4 bg-gray-900/50 border-gray-700 space-y-4">
            <h3 className="text-sm font-semibold text-white">Metadata</h3>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">Episode #</Label>
                <Input type="number" value={episodeNumber || ''} onChange={e => setEpisodeNumber(e.target.value ? parseInt(e.target.value) : undefined)} className="bg-gray-800 border-gray-600 text-xs h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">Season #</Label>
                <Input type="number" value={seasonNumber || ''} onChange={e => setSeasonNumber(e.target.value ? parseInt(e.target.value) : undefined)} className="bg-gray-800 border-gray-600 text-xs h-8" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Category</Label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-md text-xs text-white h-8 px-2">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Language</Label>
              <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-md text-xs text-white h-8 px-2">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" checked={explicit} onChange={e => setExplicit(e.target.checked)} className="rounded border-gray-600" id="explicit" />
              <Label htmlFor="explicit" className="text-xs text-gray-400 cursor-pointer">Explicit content</Label>
            </div>
          </Card>

          {/* Tags */}
          <Card className="p-4 bg-gray-900/50 border-gray-700 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1">
              <Tag className="w-4 h-4 text-purple-400" /> Tags
            </h3>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs cursor-pointer hover:bg-red-500/20" onClick={() => removeTag(tag)}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add tag..." className="bg-gray-800 border-gray-600 text-xs h-7" onKeyDown={e => e.key === 'Enter' && addTag()} />
              <Button size="sm" variant="outline" onClick={addTag} className="border-gray-600 h-7 px-2 text-xs">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </Card>

          {/* Publish Options */}
          <Card className="p-4 bg-gray-900/50 border-gray-700 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1">
              <Globe className="w-4 h-4 text-purple-400" /> Publishing
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={publishNow} onChange={() => setPublishNow(true)} className="text-purple-600" name="publish" />
                <span className="text-xs text-gray-300">Publish now</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!publishNow} onChange={() => setPublishNow(false)} className="text-purple-600" name="publish" />
                <span className="text-xs text-gray-300">Save as draft</span>
              </label>
            </div>
          </Card>

          <Button
            onClick={handlePublish}
            disabled={!title.trim() || isUploading}
            className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold"
          >
            {isUploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
            ) : publishNow ? (
              <><Upload className="w-4 h-4 mr-2" /> Publish Episode</>
            ) : (
              <><FileText className="w-4 h-4 mr-2" /> Save Draft</>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
