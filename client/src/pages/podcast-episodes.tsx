/**
 * Podcast Episodes Dashboard — List, manage, and analyze published podcast episodes
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/layout/header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../hooks/use-toast';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Radio, Play, Trash2, Edit3, Globe,
  Clock, Eye, BarChart3, Search, Plus, FileText,
  Download, ExternalLink, Calendar, Tag
} from 'lucide-react';

interface Episode {
  id: number;
  title: string;
  description?: string;
  status: string;
  audioUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration: number;
  episodeNumber?: number;
  seasonNumber?: number;
  tags: string[];
  category?: string;
  language: string;
  playCount: number;
  downloadCount: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PodcastEpisodesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'deleted'>('all');

  const fetchEpisodes = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/podcast-studio/episodes?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setEpisodes(data);
      }
    } catch {
      toast({ title: 'Failed to load episodes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  const handlePublish = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/podcast-studio/episodes/${id}/publish`, { method: 'POST' });
      if (res.ok) {
        toast({ title: 'Episode published!' });
        fetchEpisodes();
      }
    } catch {
      toast({ title: 'Failed to publish', variant: 'destructive' });
    }
  }, [toast, fetchEpisodes]);

  const handleDelete = useCallback(async (id: number, title: string) => {
    if (!window.confirm(`Delete "${title}"? This action can be undone.`)) return;
    try {
      const res = await fetch(`/api/podcast-studio/episodes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Episode deleted' });
        fetchEpisodes();
      }
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  }, [toast, fetchEpisodes]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  const filtered = episodes
    .filter(e => filter === 'all' || e.status === filter)
    .filter(e => !search || e.title.toLowerCase().includes(search.toLowerCase()));

  const stats = {
    total: episodes.length,
    published: episodes.filter(e => e.status === 'published').length,
    drafts: episodes.filter(e => e.status === 'draft').length,
    totalPlays: episodes.reduce((sum, e) => sum + (e.playCount || 0), 0),
  };

  const statusColor: Record<string, string> = {
    published: 'bg-green-600',
    draft: 'bg-yellow-600',
    deleted: 'bg-red-600',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/live-podcast-studio')} className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" /> Studio
            </Button>
            <div className="h-6 w-px bg-gray-700" />
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radio className="w-6 h-6 text-purple-400" />
              My Episodes
            </h1>
          </div>
          <Button onClick={() => navigate('/live-podcast-studio')} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-1" /> New Episode
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Episodes', value: stats.total, icon: FileText, color: 'text-purple-400' },
            { label: 'Published', value: stats.published, icon: Globe, color: 'text-green-400' },
            { label: 'Drafts', value: stats.drafts, icon: Edit3, color: 'text-yellow-400' },
            { label: 'Total Plays', value: stats.totalPlays, icon: BarChart3, color: 'text-blue-400' },
          ].map(stat => (
            <Card key={stat.label} className="bg-gray-900/50 border-gray-800 p-4">
              <div className="flex items-center gap-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-gray-400">{stat.label}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search episodes..."
              className="pl-9 bg-gray-900/50 border-gray-700"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'published', 'draft'] as const).map(f => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'ghost'}
                onClick={() => setFilter(f)}
                className={`text-xs ${filter === f ? 'bg-purple-600' : ''}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Episodes List */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
            Loading episodes...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-gray-900/50 border-gray-800 p-10 text-center">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-300 mb-1">
              {search ? 'No matching episodes' : 'No episodes yet'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {search ? 'Try a different search term' : 'Record your first podcast episode to see it here'}
            </p>
            {!search && (
              <Button onClick={() => navigate('/live-podcast-studio')} className="bg-purple-600 hover:bg-purple-700">
                <Radio className="w-4 h-4 mr-1" /> Start Recording
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map((ep, i) => (
                <motion.div
                  key={ep.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-all p-4">
                    <div className="flex items-start gap-4">
                      {/* Thumbnail / Placeholder */}
                      <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden">
                        {ep.thumbnailUrl ? (
                          <img src={ep.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Radio className="w-8 h-8 text-gray-600" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-white truncate">{ep.title}</h3>
                          <Badge className={`${statusColor[ep.status] || 'bg-gray-600'} text-white text-[10px] px-1.5`}>
                            {ep.status}
                          </Badge>
                          {ep.episodeNumber && (
                            <span className="text-[10px] text-gray-500">
                              {ep.seasonNumber ? `S${ep.seasonNumber}E${ep.episodeNumber}` : `Ep ${ep.episodeNumber}`}
                            </span>
                          )}
                        </div>
                        {ep.description && (
                          <p className="text-xs text-gray-400 line-clamp-2 mb-2">{ep.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmt(ep.duration)}</span>
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {ep.playCount || 0} plays</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {ep.publishedAt
                              ? new Date(ep.publishedAt).toLocaleDateString()
                              : new Date(ep.createdAt).toLocaleDateString()}
                          </span>
                          {ep.tags?.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3" /> {ep.tags.slice(0, 3).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {ep.audioUrl && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Play" onClick={() => window.open(ep.audioUrl, '_blank')}>
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        {ep.status === 'draft' && (
                          <Button size="sm" onClick={() => handlePublish(ep.id)} className="bg-green-700 hover:bg-green-800 text-white text-xs h-8 px-3">
                            <Globe className="w-3 h-3 mr-1" /> Publish
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(ep.id, ep.title)} className="h-8 w-8 p-0 text-red-400 hover:text-red-300" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
