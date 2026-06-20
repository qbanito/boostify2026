import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  Play, Pause, SkipBack, SkipForward,
  ThumbsUp, ThumbsDown, MessageSquare, Clock,
  Download, Upload, MoreVertical, XCircle, Plus,
  Volume2, VolumeX, History, Folder,
  CheckCircle2, AlertCircle, Loader2, Music
} from "lucide-react";
import { Slider } from "../ui/slider";
import { Textarea } from "../ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";

interface Version {
  id: number;
  name: string;
  trackName: string;
  audioUrl: string;
  status: "pending" | "approved" | "rejected";
  duration: number | null;
  fileSize: number | null;
  format: string | null;
  uploadedByName: string | null;
  notes: string | null;
  projectId: number;
  userId: string;
  createdAt: string;
}

interface Project {
  id: number;
  name: string;
  tracks: string[];
  status: string;
  genre: string | null;
  bpm: number | null;
  key: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Feedback {
  id: number;
  content: string;
  userName: string | null;
  timestamp: string | null;
  createdAt: string;
}

export function VersionControl() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<Version | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newVersionName, setNewVersionName] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectTracks, setNewProjectTracks] = useState("");
  const [expandedFeedback, setExpandedFeedback] = useState<number | null>(null);

  // === API Queries ===
  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ['/api/studio/projects'],
    queryFn: () => apiRequest('GET', '/api/studio/projects').then(r => r.json()),
  });

  const projects: Project[] = projectsData?.data || [];

  const { data: versionsData, isLoading: loadingVersions } = useQuery({
    queryKey: ['/api/studio/projects', selectedProject, 'versions'],
    queryFn: () => apiRequest('GET', `/api/studio/projects/${selectedProject}/versions`).then(r => r.json()),
    enabled: !!selectedProject,
  });

  const versions: Version[] = versionsData?.data || [];

  const { data: feedbackData } = useQuery({
    queryKey: ['/api/studio/versions', expandedFeedback, 'feedback'],
    queryFn: () => apiRequest('GET', `/api/studio/versions/${expandedFeedback}/feedback`).then(r => r.json()),
    enabled: !!expandedFeedback,
  });

  const versionFeedback: Feedback[] = feedbackData?.data || [];

  // === Mutations ===
  const createProjectMut = useMutation({
    mutationFn: (data: { name: string; tracks: string[] }) =>
      apiRequest('POST', '/api/studio/projects', data).then(r => r.json()),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/studio/projects'] });
      setSelectedProject(String(result.data.id));
      setShowNewProjectDialog(false);
      setNewProjectName("");
      setNewProjectTracks("");
      toast({ title: "Project Created", description: `"${result.data.name}" is ready.` });
    },
  });

  const createVersionMut = useMutation({
    mutationFn: (data: any) =>
      apiRequest('POST', `/api/studio/projects/${selectedProject}/versions`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/studio/projects', selectedProject, 'versions'] });
      setShowUploadDialog(false);
      setNewVersionName("");
      setSelectedTrack("");
      toast({ title: "Version Uploaded", description: "Your track version is ready for review." });
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ versionId, status }: { versionId: number; status: string }) =>
      apiRequest('PATCH', `/api/studio/versions/${versionId}/status`, { status }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/studio/projects', selectedProject, 'versions'] });
    },
  });

  const addFeedbackMut = useMutation({
    mutationFn: ({ versionId, content }: { versionId: number; content: string }) =>
      apiRequest('POST', `/api/studio/versions/${versionId}/feedback`, { content }).then(r => r.json()),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/studio/versions', vars.versionId, 'feedback'] });
      setFeedback("");
      toast({ title: "Feedback Sent" });
    },
  });

  const deleteVersionMut = useMutation({
    mutationFn: (versionId: number) =>
      apiRequest('DELETE', `/api/studio/versions/${versionId}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/studio/projects', selectedProject, 'versions'] });
      setCurrentVersion(null);
      setIsPlaying(false);
      toast({ title: "Version Deleted" });
    },
  });

  // Auto-select first project
  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(String(projects[0].id));
    }
  }, [projects, selectedProject]);

  // === Audio Controls ===
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => { setCurrentTime(audio.currentTime); setDuration(audio.duration || 0); };
    const onEnd = () => { setIsPlaying(false); audio.currentTime = 0; setCurrentTime(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("loadedmetadata", onTime);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("loadedmetadata", onTime);
    };
  }, [currentVersion]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
        toast({ title: "Playback Error", description: "Could not play audio.", variant: "destructive" });
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, toast]);

  const formatTime = (t: number) => {
    if (!t || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const selectVersion = (v: Version) => {
    setCurrentVersion(v);
    setIsPlaying(false);
    setCurrentTime(0);
    setExpandedFeedback(v.id);
  };

  // File upload to Firebase + DB
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject || !selectedTrack || !newVersionName) {
      toast({ title: "Missing fields", description: "Fill all fields before uploading.", variant: "destructive" });
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext)) {
      toast({ title: "Unsupported format", description: "Upload MP3, WAV, OGG, AAC, M4A, or FLAC.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const path = `studio-versions/${selectedProject}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => { console.error(err); setIsUploading(false); toast({ title: "Upload Failed", variant: "destructive" }); },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          let dur = 0;
          try {
            const audio = new Audio(url);
            await new Promise<void>((resolve) => {
              audio.onloadedmetadata = () => { dur = Math.round(audio.duration); resolve(); };
              audio.onerror = () => resolve();
              setTimeout(resolve, 5000);
            });
          } catch { /* ignore */ }

          await createVersionMut.mutateAsync({
            name: newVersionName,
            trackName: selectedTrack,
            audioUrl: url,
            duration: dur || null,
            fileSize: file.size,
            format: ext,
          });
          setIsUploading(false);
          setUploadProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      );
    } catch {
      setIsUploading(false);
      toast({ title: "Upload Failed", variant: "destructive" });
    }
  }, [selectedProject, selectedTrack, newVersionName, createVersionMut, toast]);

  const statusConfig = {
    approved: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Approved" },
    rejected: { color: "bg-red-500/15 text-red-400 border-red-500/30", label: "Rejected" },
    pending: { color: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Pending" },
  };

  const currentProject = projects.find(p => String(p.id) === selectedProject);
  const isLoading = loadingProjects || loadingVersions;

  return (
    <Card className="overflow-hidden border-slate-700/50 bg-gradient-to-b from-slate-800/80 to-slate-900/80 backdrop-blur">
      {/* Header */}
      <div className="p-3 sm:p-4 md:p-5 border-b border-slate-700/50">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <History className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-white truncate">Version Control</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Track, compare & approve mixes</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewProjectDialog(true)}
                className="h-7 sm:h-8 text-[11px] sm:text-xs border-slate-600 hover:bg-slate-700 px-2 sm:px-3"
              >
                <Plus className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Project</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setShowUploadDialog(true)}
                disabled={!selectedProject}
                className="h-7 sm:h-8 text-[11px] sm:text-xs bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 px-2 sm:px-3"
              >
                <Upload className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            </div>
          </div>

          {/* Project selector */}
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-full h-8 sm:h-9 text-xs sm:text-sm bg-slate-800/60 border-slate-700">
              <div className="flex items-center gap-2 min-w-0">
                <Folder className="h-3 w-3 text-slate-400 flex-shrink-0" />
                <SelectValue placeholder="Select a project" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>
                  <div className="flex items-center gap-2">
                    <span>{p.name}</span>
                    {p.genre && <Badge variant="outline" className="text-[10px] h-4 px-1">{p.genre}</Badge>}
                  </div>
                </SelectItem>
              ))}
              {projects.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-500">No projects yet</div>
              )}
            </SelectContent>
          </Select>

          {/* Project meta */}
          {currentProject && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {currentProject.tracks?.map((track: string, i: number) => (
                <Badge key={i} variant="outline" className="text-[10px] sm:text-[11px] h-5 bg-slate-800/50 border-slate-700 text-slate-300">
                  <Music className="h-2.5 w-2.5 mr-1" />{track}
                </Badge>
              ))}
              {currentProject.bpm && (
                <Badge variant="outline" className="text-[10px] sm:text-[11px] h-5 bg-slate-800/50 border-slate-700 text-slate-400">
                  {currentProject.bpm} BPM
                </Badge>
              )}
              {currentProject.key && (
                <Badge variant="outline" className="text-[10px] sm:text-[11px] h-5 bg-slate-800/50 border-slate-700 text-slate-400">
                  Key: {currentProject.key}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Audio Player */}
      <AnimatePresence>
        {currentVersion && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-slate-700/50 overflow-hidden"
          >
            <div className="p-3 sm:p-4 bg-gradient-to-r from-purple-900/20 to-indigo-900/20">
              {/* Track info + controls */}
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <Button
                  size="icon"
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/10 hover:bg-white/20 flex-shrink-0"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying
                    ? <Pause className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    : <Play className="h-4 w-4 sm:h-5 sm:w-5 text-white ml-0.5" />
                  }
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-white truncate">
                    {currentVersion.name}
                    <span className="text-slate-400 font-normal"> — {currentVersion.trackName}</span>
                  </p>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-400 flex-wrap">
                    {currentVersion.format && <span className="uppercase">{currentVersion.format}</span>}
                    {currentVersion.fileSize && <><span>•</span><span>{formatFileSize(currentVersion.fileSize)}</span></>}
                    <span>•</span>
                    <Badge variant="outline" className={`text-[10px] h-4 px-1.5 border ${statusConfig[currentVersion.status].color}`}>
                      {statusConfig[currentVersion.status].label}
                    </Badge>
                  </div>
                </div>
                {/* Volume - hidden on mobile */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMuted(!isMuted)}>
                    {isMuted ? <VolumeX className="h-3.5 w-3.5 text-slate-400" /> : <Volume2 className="h-3.5 w-3.5 text-slate-400" />}
                  </Button>
                  <Slider value={[volume]} max={100} step={1} className="w-16 md:w-20" onValueChange={([v]) => setVolume(v)} />
                </div>
              </div>

              {/* Seek bar */}
              <div className="flex items-center gap-2 sm:gap-3">
                <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0"
                  onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}>
                  <SkipBack className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />
                </Button>
                <span className="text-[10px] sm:text-xs text-slate-400 w-8 sm:w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  className="flex-1"
                  onValueChange={([v]) => { setCurrentTime(v); if (audioRef.current) audioRef.current.currentTime = v; }}
                />
                <span className="text-[10px] sm:text-xs text-slate-400 w-8 sm:w-10 tabular-nums">{formatTime(duration)}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0"
                  onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 10); }}>
                  <SkipForward className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />
                </Button>
              </div>

              {/* Mobile volume */}
              <div className="flex sm:hidden items-center gap-2 mt-2">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX className="h-3 w-3 text-slate-400" /> : <Volume2 className="h-3 w-3 text-slate-400" />}
                </Button>
                <Slider value={[volume]} max={100} step={1} className="flex-1" onValueChange={([v]) => setVolume(v)} />
              </div>

              <audio ref={audioRef} src={currentVersion.audioUrl} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Versions List */}
      <div className="p-3 sm:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
          </div>
        ) : !selectedProject ? (
          <div className="text-center py-10 sm:py-12">
            <Folder className="h-10 w-10 mx-auto text-slate-600 mb-3" />
            <p className="text-sm text-slate-400 mb-3">Create a project to get started</p>
            <Button variant="outline" size="sm" onClick={() => setShowNewProjectDialog(true)} className="border-slate-600">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Project
            </Button>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-10 sm:py-12">
            <Upload className="h-10 w-10 mx-auto text-slate-600 mb-3" />
            <p className="text-sm text-slate-400 mb-1">No versions yet</p>
            <p className="text-xs text-slate-500 mb-4">Upload your first track version for review</p>
            <Button size="sm" onClick={() => setShowUploadDialog(true)}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700">
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Version
            </Button>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {versions.map((v) => {
              const sc = statusConfig[v.status];
              const isActive = currentVersion?.id === v.id;
              const showFb = expandedFeedback === v.id;
              return (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg border transition-all ${
                    isActive
                      ? 'border-purple-500/50 bg-purple-500/5 shadow-lg shadow-purple-500/10'
                      : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="p-3 sm:p-4">
                    {/* Version header */}
                    <div className="flex items-start gap-2 sm:gap-3">
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex-shrink-0 ${
                          isActive && isPlaying ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700/50 text-slate-300'
                        }`}
                        onClick={() => {
                          if (isActive && isPlaying) {
                            setIsPlaying(false);
                          } else {
                            selectVersion(v);
                            setIsPlaying(true);
                          }
                        }}
                      >
                        {isActive && isPlaying
                          ? <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          : <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-0.5" />
                        }
                      </Button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-medium text-white truncate">{v.name}</span>
                          <Badge variant="outline" className={`text-[10px] h-4 px-1.5 border ${sc.color}`}>
                            {sc.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-500 mt-0.5 flex-wrap">
                          <span>{v.trackName}</span>
                          <span>•</span>
                          <span>{v.duration ? formatTime(v.duration) : '--:--'}</span>
                          {v.format && <><span>•</span><span className="uppercase">{v.format}</span></>}
                          <span>•</span>
                          <span>{new Date(v.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                        <Button
                          variant="ghost" size="icon"
                          className={`h-7 w-7 ${v.status === 'approved' ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400'}`}
                          onClick={() => updateStatusMut.mutate({ versionId: v.id, status: v.status === 'approved' ? 'pending' : 'approved' })}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className={`h-7 w-7 ${v.status === 'rejected' ? 'text-red-400' : 'text-slate-500 hover:text-red-400'}`}
                          onClick={() => updateStatusMut.mutate({ versionId: v.id, status: v.status === 'rejected' ? 'pending' : 'rejected' })}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-slate-300"
                          onClick={() => setExpandedFeedback(showFb ? null : v.id)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => selectVersion(v)}>
                              <Play className="h-3.5 w-3.5 mr-2" /> Play
                            </DropdownMenuItem>
                            {v.audioUrl && (
                              <DropdownMenuItem onClick={() => window.open(v.audioUrl, '_blank')}>
                                <Download className="h-3.5 w-3.5 mr-2" /> Download
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-400"
                              onClick={() => deleteVersionMut.mutate(v.id)}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Feedback section */}
                    <AnimatePresence>
                      {showFb && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-slate-700/50">
                            {versionFeedback.length > 0 && (
                              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                                {versionFeedback.map(fb => (
                                  <div key={fb.id} className="flex gap-2 text-xs">
                                    <div className="h-5 w-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <MessageSquare className="h-2.5 w-2.5 text-slate-400" />
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-slate-300 font-medium">{fb.userName || 'User'}</span>
                                      <p className="text-slate-400 mt-0.5 break-words">{fb.content}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Textarea
                                placeholder="Add feedback..."
                                value={expandedFeedback === v.id ? feedback : ""}
                                onChange={(e) => setFeedback(e.target.value)}
                                className="h-16 sm:h-20 text-xs bg-slate-800/60 border-slate-700 resize-none flex-1"
                              />
                              <Button
                                size="sm"
                                disabled={!feedback.trim() || addFeedbackMut.isPending}
                                className="self-end h-8 px-3 bg-purple-600 hover:bg-purple-700"
                                onClick={() => addFeedbackMut.mutate({ versionId: v.id, content: feedback })}
                              >
                                {addFeedbackMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* === New Project Dialog === */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent className="max-w-[92vw] sm:max-w-md bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">New Project</DialogTitle>
            <DialogDescription className="text-slate-400">Create a project to organize your track versions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Project Name</label>
              <Input
                placeholder="e.g., Summer EP"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                className="bg-slate-800 border-slate-700 h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Tracks (comma-separated)</label>
              <Input
                placeholder="e.g., Summer Breeze, Ocean Waves, Sunset Dreams"
                value={newProjectTracks}
                onChange={e => setNewProjectTracks(e.target.value)}
                className="bg-slate-800 border-slate-700 h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowNewProjectDialog(false)} className="border-slate-700 w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              disabled={!newProjectName.trim() || createProjectMut.isPending}
              onClick={() => createProjectMut.mutate({
                name: newProjectName.trim(),
                tracks: newProjectTracks.split(',').map(t => t.trim()).filter(Boolean),
              })}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 w-full sm:w-auto"
            >
              {createProjectMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Upload Dialog === */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-[92vw] sm:max-w-md bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Upload Version</DialogTitle>
            <DialogDescription className="text-slate-400">Upload a new audio version for review and feedback.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Version Name</label>
              <Input
                placeholder="e.g., Mix v1, Final Master"
                value={newVersionName}
                onChange={e => setNewVersionName(e.target.value)}
                className="bg-slate-800 border-slate-700 h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Track</label>
              <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                <SelectTrigger className="bg-slate-800 border-slate-700 h-9 text-sm">
                  <SelectValue placeholder="Select track" />
                </SelectTrigger>
                <SelectContent>
                  {currentProject?.tracks?.map((track: string) => (
                    <SelectItem key={track} value={track}>{track}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Audio File</label>
              <Input
                type="file"
                accept="audio/*"
                ref={fileInputRef}
                disabled={isUploading}
                onChange={handleFileUpload}
                className="bg-slate-800 border-slate-700 text-sm file:bg-slate-700 file:text-slate-300 file:border-0 file:mr-3 file:px-3 file:py-1 file:rounded"
              />
              <p className="text-[10px] text-slate-500 mt-1">MP3, WAV, OGG, AAC, M4A, FLAC — max 200MB</p>
            </div>
            {isUploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Uploading...</span>
                  <span className="text-purple-400 font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={isUploading} className="border-slate-700 w-full sm:w-auto">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
