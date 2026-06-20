import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  Phone, 
  Users, 
  Share, 
  MonitorUp, 
  MessageSquare, 
  MoreVertical,
  Volume2,
  VolumeX,
  Settings,
  Music,
  FileAudio,
  Maximize,
  Minimize
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Slider } from "../ui/slider";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { auth, db, storage } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  onSnapshot,
  updateDoc,
  doc,
  setDoc
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

// Define interfaces
interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  role: 'host' | 'artist' | 'producer' | 'guest';
  stream?: MediaStream | null;
  avatarUrl?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'audio-link' | 'system';
}

interface SharedAudioFile {
  id: string;
  name: string;
  url: string;
  uploaderId: string;
  uploaderName: string;
  timestamp: Date;
  duration?: string;
  size?: string;
}

export function StudioVideoCall() {
  // References
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"participants" | "chat" | "audio">("participants");
  const [sharedAudioFiles, setSharedAudioFiles] = useState<SharedAudioFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionName, setSessionName] = useState("Virtual Studio Session");
  const [currentlyPlaying, setCurrentlyPlaying] = useState<SharedAudioFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinSessionId, setJoinSessionId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);

  const { toast } = useToast();

  // Mock remote participants for demo
  const mockParticipants: Participant[] = [
    {
      id: '1',
      name: 'Alex Rivera',
      isMuted: false,
      isVideoOn: true,
      isScreenSharing: false,
      role: 'producer',
      avatarUrl: '/assets/musicians/guitarist-1.jpg'
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      isMuted: true,
      isVideoOn: true,
      isScreenSharing: false,
      role: 'artist',
      avatarUrl: '/assets/musicians/vocalist-1.jpg'
    },
    {
      id: '3',
      name: 'Michael Davis',
      isMuted: false,
      isVideoOn: false,
      isScreenSharing: false,
      role: 'guest',
      avatarUrl: '/assets/musicians/producer-1.jpg'
    }
  ];

  // Firebase auth state change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  // Initialize media devices when call becomes active
  useEffect(() => {
    if (isCallActive) {
      setParticipants(mockParticipants);
      initializeMediaDevices();
      
      // Add the current user to participants list if authenticated
      if (currentUser) {
        const userAsParticipant: Participant = {
          id: currentUser.uid,
          name: currentUser.displayName || 'You',
          isMuted,
          isVideoOn,
          isScreenSharing: false,
          role: 'host',
          avatarUrl: currentUser.photoURL || undefined
        };
        
        setParticipants(prev => [userAsParticipant, ...prev]);

        // Add system message about joining the session
        addSystemMessage(`${userAsParticipant.name} has joined the session.`);
      }

      // Generate a unique session ID
      const generatedSessionId = generateSessionId();
      setSessionId(generatedSessionId);
    } else {
      // Clean up when call is ended
      stopMediaTracks();
      setParticipants([]);
      setIsChatPanelOpen(false);
    }
  }, [isCallActive, currentUser]);

  // Handle chat panel opening logic
  useEffect(() => {
    if (isChatPanelOpen) {
      setActiveTab("chat");
    }
  }, [isChatPanelOpen]);

  // Update mute status in media tracks
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Update video status in media tracks
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = isVideoOn;
      });
    }
  }, [isVideoOn]);

  // Audio player controls
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      
      if (isPlaying && currentlyPlaying) {
        audioRef.current.play().catch(error => {
          console.error("Error playing audio:", error);
          toast({
            title: "Error playing audio",
            description: "Could not play the audio file. Try again.",
            variant: "destructive"
          });
        });
      } else if (!isPlaying && audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentlyPlaying, volume]);

  // Initialize media devices and get local stream
  const initializeMediaDevices = async () => {
    try {
      const constraints = {
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Update audio/video state based on initial settings
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      stream.getVideoTracks().forEach(track => {
        track.enabled = isVideoOn;
      });

      toast({
        title: "Media devices initialized",
        description: "Camera and microphone are now active."
      });
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast({
        title: "Permission Error",
        description: "Please allow access to camera and microphone.",
        variant: "destructive"
      });
      
      // Fallback to audio-only if video permission is denied
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioStream;
        setIsVideoOn(false);
        
        toast({
          title: "Audio-only mode",
          description: "Camera access was denied. Using microphone only."
        });
      } catch (audioError) {
        console.error("Error accessing audio devices:", audioError);
        toast({
          title: "No Media Access",
          description: "Could not access microphone or camera.",
          variant: "destructive"
        });
        toggleCall(); // End the call if we can't get any media
      }
    }
  };

  // Clean up media tracks when component unmounts or call ends
  const stopMediaTracks = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }
  };

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing and go back to camera
      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getTracks();
        tracks.forEach(track => track.stop());
      }
      
      await initializeMediaDevices();
      setIsScreenSharing(false);
      
      // Update participant status
      updateParticipantStatus(currentUser?.uid || 'local', { isScreenSharing: false });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always'
          },
          audio: true
        });
        
        // Replace local stream with screen sharing stream
        if (localStreamRef.current) {
          const tracks = localStreamRef.current.getTracks();
          tracks.forEach(track => track.stop());
        }
        
        localStreamRef.current = screenStream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        setIsScreenSharing(true);
        
        // Update participant status
        updateParticipantStatus(currentUser?.uid || 'local', { isScreenSharing: true });
        
        // Add event listener for when the user stops screen sharing
        screenStream.getVideoTracks()[0].addEventListener('ended', () => {
          toggleScreenShare(); // This will set isScreenSharing back to false and restore camera
        });
        
        toast({
          title: "Screen sharing active",
          description: "Your screen is now visible to all participants."
        });
      } catch (error) {
        console.error("Error sharing screen:", error);
        toast({
          title: "Screen Sharing Error",
          description: "Failed to start screen sharing. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  // Update participant status
  const updateParticipantStatus = (participantId: string, updates: Partial<Participant>) => {
    setParticipants(prev => prev.map(participant => 
      participant.id === participantId 
        ? { ...participant, ...updates } 
        : participant
    ));
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(prev => !prev);
    updateParticipantStatus(currentUser?.uid || 'local', { isMuted: !isMuted });
  };

  // Toggle video
  const toggleVideo = () => {
    setIsVideoOn(prev => !prev);
    updateParticipantStatus(currentUser?.uid || 'local', { isVideoOn: !isVideoOn });
  };

  // Toggle call
  const toggleCall = () => {
    if (isCallActive) {
      // End call and clean up
      setIsCallActive(false);
      stopMediaTracks();
      setSessionId("");
      setSessionName("Virtual Studio Session");
      
      toast({
        title: "Call ended",
        description: "You've disconnected from the studio session."
      });
    } else {
      // Start call
      setShowJoinDialog(true);
    }
  };

  // Start a new session
  const startNewSession = () => {
    setIsCallActive(true);
    setShowJoinDialog(false);
    
    toast({
      title: "Studio session started",
      description: `Session ID: ${sessionId} - Share this ID with others to join.`
    });
  };

  // Join an existing session
  const joinExistingSession = () => {
    if (!joinSessionId) {
      toast({
        title: "Error",
        description: "Please enter a valid session ID.",
        variant: "destructive"
      });
      return;
    }
    
    // In a real implementation, you would verify that the session exists
    setSessionId(joinSessionId);
    setIsCallActive(true);
    setShowJoinDialog(false);
    
    toast({
      title: "Joined studio session",
      description: `Successfully joined session ${joinSessionId}.`
    });
  };

  // Copy session ID to clipboard
  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    toast({
      title: "Copied to clipboard",
      description: "Session ID has been copied to your clipboard."
    });
  };

  // Generate unique session ID
  const generateSessionId = () => {
    return Math.random().toString(36).substring(2, 9);
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !currentUser) return;

    const file = files[0];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];

    if (!allowedExtensions.includes(fileExtension || '')) {
      toast({
        title: "Unsupported file type",
        description: "Please upload an audio file (MP3, WAV, OGG, AAC, M4A, FLAC)",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB
      toast({
        title: "File too large",
        description: "Audio files must be less than 100MB",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Create a storage reference
      const storageRef = ref(storage, `studio-sessions/${sessionId}/audio/${Date.now()}_${file.name}`);
      
      // Upload file
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      // Listen for state changes, errors, and completion
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload error:", error);
          setIsUploading(false);
          toast({
            title: "Upload failed",
            description: "Failed to upload audio file. Please try again.",
            variant: "destructive"
          });
        },
        async () => {
          try {
            // Get download URL
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Create audio file metadata
            const newAudioFile: SharedAudioFile = {
              id: Date.now().toString(),
              name: file.name,
              url: downloadUrl,
              uploaderId: currentUser.uid,
              uploaderName: currentUser.displayName || "Unknown User",
              timestamp: new Date(),
              size: formatFileSize(file.size),
              duration: await getAudioDuration(file)
            };
            
            // Add to shared audio files state
            setSharedAudioFiles(prev => [newAudioFile, ...prev]);
            
            // Create chat message notification
            const audioMessage: ChatMessage = {
              id: Date.now().toString(),
              senderId: currentUser.uid,
              senderName: currentUser.displayName || "Unknown User",
              content: downloadUrl,
              timestamp: new Date(),
              type: 'audio-link'
            };
            
            setChatMessages(prev => [...prev, audioMessage]);
            
            toast({
              title: "Upload successful",
              description: `${file.name} has been shared with the session.`
            });
            
            // Switch to audio tab
            setActiveTab("audio");
          } catch (error) {
            console.error("Error finalizing upload:", error);
            toast({
              title: "Upload error",
              description: "Failed to process uploaded file.",
              variant: "destructive"
            });
          } finally {
            setIsUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }
        }
      );
    } catch (error) {
      console.error("Upload initialization error:", error);
      setIsUploading(false);
      toast({
        title: "Upload failed",
        description: "Could not start the upload process.",
        variant: "destructive"
      });
    }
  };

  // Get audio duration
  const getAudioDuration = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      
      audio.onloadedmetadata = () => {
        const minutes = Math.floor(audio.duration / 60);
        const seconds = Math.floor(audio.duration % 60);
        resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      };
      
      audio.onerror = () => {
        resolve('Unknown');
      };
      
      audio.src = URL.createObjectURL(file);
    });
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Send chat message
  const sendChatMessage = () => {
    if (!currentMessage.trim() || !currentUser) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: currentUser.uid,
      senderName: currentUser.displayName || "Unknown User",
      content: currentMessage.trim(),
      timestamp: new Date(),
      type: 'text'
    };

    setChatMessages(prev => [...prev, newMessage]);
    setCurrentMessage("");
  };

  // Add system message
  const addSystemMessage = (content: string) => {
    const systemMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: 'system',
      senderName: 'System',
      content,
      timestamp: new Date(),
      type: 'system'
    };

    setChatMessages(prev => [...prev, systemMessage]);
  };

  // Play audio file
  const playAudioFile = (audioFile: SharedAudioFile) => {
    setCurrentlyPlaying(audioFile);
    setIsPlaying(true);
  };

  // Pause audio playback
  const pauseAudio = () => {
    setIsPlaying(false);
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // Fullscreen
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  return (
    <div ref={containerRef} className={isFullscreen ? 'bg-slate-950 h-screen w-screen overflow-auto p-2 sm:p-4' : ''}>
    <Card className={`p-3 sm:p-4 md:p-6 overflow-hidden border-slate-700/50 bg-gradient-to-b from-slate-800/80 to-slate-900/80 backdrop-blur ${isFullscreen ? 'h-full flex flex-col' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
            <Video className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-white truncate">{sessionName}</h3>
            <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Real-time video collaboration</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="h-7 sm:h-8 text-[10px] sm:text-xs border-slate-600 px-2 sm:px-3 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5 sm:mr-1" /> : <Maximize className="w-3.5 h-3.5 sm:mr-1" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </Button>
          {isCallActive && (
            <>
              <Button 
                variant="outline" 
                onClick={copySessionId}
                size="sm"
                className="h-7 sm:h-8 text-[10px] sm:text-xs border-slate-600 px-2 sm:px-3"
              >
                ID: {sessionId}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsChatPanelOpen(!isChatPanelOpen)}
                className="h-7 sm:h-8 text-[10px] sm:text-xs border-slate-600 px-2 sm:px-3">
                <MessageSquare className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Chat</span>
              </Button>
              <Button variant="outline" size="sm"
                className="h-7 sm:h-8 text-[10px] sm:text-xs border-slate-600 px-2 sm:px-3">
                <Users className="w-3.5 h-3.5 sm:mr-1" />
                <span>{participants.length}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={`flex flex-col lg:flex-row gap-3 sm:gap-4 ${isFullscreen ? 'flex-1 min-h-0' : ''}`}>
        <div className={`flex-1 min-w-0 ${isChatPanelOpen ? 'lg:w-2/3' : 'w-full'} ${isFullscreen ? 'flex flex-col' : ''}`}>
          <div className={`bg-zinc-900 rounded-lg mb-3 sm:mb-4 relative overflow-hidden shadow-lg ${isFullscreen ? 'flex-1 min-h-[300px]' : 'aspect-video'}`}>
            {isCallActive ? (
              <div className="absolute inset-0 grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 p-1.5 sm:p-2">
                <div className="bg-zinc-800 rounded-lg relative overflow-hidden shadow-inner">
                  <video 
                    ref={localVideoRef}
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover rounded-lg opacity-90" 
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded-full flex items-center gap-2">
                    <span className="text-xs text-white font-medium">You</span>
                    {isMuted && <MicOff className="w-3 h-3 text-red-500" />}
                    {!isVideoOn && <VideoOff className="w-3 h-3 text-red-500" />}
                    {isScreenSharing && <MonitorUp className="w-3 h-3 text-green-500" />}
                  </div>
                </div>
                <div className="bg-zinc-800 rounded-lg relative overflow-hidden shadow-inner">
                  {participants.length > 0 && participants[0].id !== currentUser?.uid ? (
                    <>
                      {participants[0].isVideoOn ? (
                        <img 
                          src={participants[0].avatarUrl || '/assets/musician-placeholder.jpg'} 
                          alt={participants[0].name}
                          className="w-full h-full object-cover rounded-lg opacity-90" 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <img 
                            src={participants[0].avatarUrl || '/assets/musician-placeholder.jpg'} 
                            alt={participants[0].name}
                            className="w-24 h-24 rounded-full mb-2" 
                          />
                          <span className="text-white/80 text-sm">Camera Off</span>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded-full flex items-center gap-2">
                        <span className="text-xs text-white font-medium">{participants[0].name}</span>
                        {participants[0].isMuted && <MicOff className="w-3 h-3 text-red-500" />}
                        {!participants[0].isVideoOn && <VideoOff className="w-3 h-3 text-red-500" />}
                        {participants[0].isScreenSharing && <MonitorUp className="w-3 h-3 text-green-500" />}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className="text-white/80 text-sm">Waiting for participants...</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full space-y-4 text-white/80">
                <p className="text-sm">Start a virtual studio session to collaborate in real-time</p>
                <Button onClick={() => setShowJoinDialog(true)} variant="default" className="bg-primary">
                  Start Studio Session
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-center flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    size="icon"
                    onClick={toggleMute}
                    className="hover:opacity-90 transition-opacity"
                    disabled={!isCallActive}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isMuted ? "Unmute" : "Mute"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={!isVideoOn ? "destructive" : "secondary"}
                    size="icon"
                    onClick={toggleVideo}
                    className="hover:opacity-90 transition-opacity"
                    disabled={!isCallActive}
                  >
                    {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isVideoOn ? "Turn off camera" : "Turn on camera"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isScreenSharing ? "destructive" : "secondary"}
                    size="icon"
                    onClick={toggleScreenShare}
                    className="hover:opacity-90 transition-opacity"
                    disabled={!isCallActive}
                  >
                    <Share className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isScreenSharing ? "Stop sharing" : "Share screen"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isCallActive ? "destructive" : "default"}
                    size="icon"
                    onClick={toggleCall}
                    className="hover:opacity-90 transition-opacity"
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isCallActive ? "End call" : "Start call"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isCallActive && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className="hover:opacity-90 transition-opacity"
                      >
                        <FileAudio className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Share audio file</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
              </>
            )}
          </div>

          {/* Audio Player */}
          {isCallActive && currentlyPlaying && (
            <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-primary" />
                  <div>
                    <h4 className="text-sm font-medium">{currentlyPlaying.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      Shared by {currentlyPlaying.uploaderName} • {currentlyPlaying.duration}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlayPause}
                  className="hover:bg-zinc-700/50"
                >
                  {isPlaying ? (
                    <span className="h-4 w-4">⏸️</span>
                  ) : (
                    <span className="h-4 w-4">▶️</span>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setVolume(prev => Math.max(0, prev - 10))}
                  className="h-6 w-6"
                >
                  {volume === 0 ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                </Button>
                <Slider
                  value={[volume]}
                  max={100}
                  step={1}
                  className="flex-1"
                  onValueChange={(value) => setVolume(value[0])}
                />
                <span className="text-xs w-8">{volume}%</span>
              </div>
              <audio ref={audioRef} src={currentlyPlaying.url} />
            </div>
          )}
        </div>

        {/* Side Panel for Participants, Chat, Audio Files */}
        {isCallActive && isChatPanelOpen && (
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
            <Card className="p-3 sm:p-4 border-slate-700/50 bg-slate-800/50">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
                <TabsList className="grid grid-cols-3 mb-3 sm:mb-4 h-8 sm:h-9">
                  <TabsTrigger value="participants" className="text-[10px] sm:text-xs gap-1">
                    <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="hidden sm:inline">Participants</span>
                    <span className="sm:hidden">{participants.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="text-[10px] sm:text-xs gap-1">
                    <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Chat</span>
                  </TabsTrigger>
                  <TabsTrigger value="audio" className="text-[10px] sm:text-xs gap-1">
                    <Music className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Audio</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="participants" className="space-y-4">
                  <div className="space-y-2">
                    {participants.map(participant => (
                      <div key={participant.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/30">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={participant.avatarUrl || '/assets/musician-placeholder.jpg'}
                              alt={participant.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <Badge 
                              variant="outline" 
                              className={`absolute -bottom-1 -right-1 text-[10px] ${
                                participant.role === 'host' 
                                  ? 'bg-blue-500' 
                                  : participant.role === 'artist' 
                                  ? 'bg-purple-500' 
                                  : participant.role === 'producer' 
                                  ? 'bg-orange-500' 
                                  : 'bg-gray-500'
                              }`}
                            >
                              {participant.role}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{participant.name}</p>
                            <div className="flex items-center gap-2">
                              {participant.isMuted && <MicOff className="w-3 h-3 text-red-500" />}
                              {!participant.isVideoOn && <VideoOff className="w-3 h-3 text-red-500" />}
                              {participant.isScreenSharing && <MonitorUp className="w-3 h-3 text-green-500" />}
                            </div>
                          </div>
                        </div>
                        {participant.id !== currentUser?.uid && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Options</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>Send Private Message</DropdownMenuItem>
                              <DropdownMenuItem>Make Host</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-500">Remove from Call</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="chat" className="h-[280px] sm:h-[350px] lg:h-[400px] flex flex-col">
                  <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                    {chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <MessageSquare className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No messages yet</p>
                        <p className="text-xs text-muted-foreground">
                          Send a message to start the conversation
                        </p>
                      </div>
                    ) : (
                      chatMessages.map((message) => (
                        <div 
                          key={message.id} 
                          className={`flex ${
                            message.senderId === 'system' 
                              ? 'justify-center' 
                              : message.senderId === currentUser?.uid 
                              ? 'justify-end' 
                              : 'justify-start'
                          }`}
                        >
                          {message.type === 'system' ? (
                            <div className="bg-zinc-800/30 px-3 py-1 rounded-full">
                              <p className="text-xs text-muted-foreground">
                                {message.content}
                              </p>
                            </div>
                          ) : (
                            <div className={`max-w-[80%] ${
                              message.senderId === currentUser?.uid 
                                ? 'bg-primary/20' 
                                : 'bg-zinc-800/50'
                            } p-3 rounded-lg`}>
                              {message.senderId !== currentUser?.uid && (
                                <p className="text-xs font-medium mb-1">{message.senderName}</p>
                              )}
                              {message.type === 'text' ? (
                                <p className="text-sm break-words">{message.content}</p>
                              ) : (
                                <div className="bg-zinc-800 rounded-lg p-2">
                                  <div className="flex items-center gap-2">
                                    <FileAudio className="w-4 h-4 text-primary" />
                                    <span className="text-xs">Audio shared</span>
                                  </div>
                                  <div className="flex justify-center mt-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        const audioFile = sharedAudioFiles.find(file => file.url === message.content);
                                        if (audioFile) {
                                          playAudioFile(audioFile);
                                        }
                                      }}
                                    >
                                      Play Audio
                                    </Button>
                                  </div>
                                </div>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-1 text-right">
                                {new Intl.DateTimeFormat('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }).format(message.timestamp)}
                              </p>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    />
                    <Button onClick={sendChatMessage}>
                      Send
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="audio" className="h-[280px] sm:h-[350px] lg:h-[400px] flex flex-col">
                  <div className="flex-1 overflow-y-auto mb-4">
                    {isUploading && (
                      <div className="mb-4">
                        <p className="text-sm mb-2">Uploading audio file...</p>
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-xs text-right mt-1">{uploadProgress}%</p>
                      </div>
                    )}
                    {sharedAudioFiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <FileAudio className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No audio files shared</p>
                        <p className="text-xs text-muted-foreground">
                          Share audio files using the upload button
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sharedAudioFiles.map((file) => (
                          <div key={file.id} className="bg-zinc-800/30 p-3 rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <FileAudio className="w-4 h-4 text-primary" />
                                <div>
                                  <p className="text-sm font-medium">{file.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {file.duration} • {file.size} • Shared by {file.uploaderName}
                                  </p>
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  if (currentlyPlaying?.id === file.id && isPlaying) {
                                    pauseAudio();
                                  } else {
                                    playAudioFile(file);
                                  }
                                }}
                              >
                                {currentlyPlaying?.id === file.id && isPlaying ? (
                                  <span className="h-4 w-4">⏸️</span>
                                ) : (
                                  <span className="h-4 w-4">▶️</span>
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <FileAudio className="w-4 h-4 mr-2" />
                    Share Audio File
                  </Button>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>

      {/* Join Session Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="max-w-[92vw] sm:max-w-md bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle>Studio Session</DialogTitle>
            <DialogDescription>
              Start a new session or join an existing one.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="flex flex-col space-y-2">
              <h3 className="text-sm font-medium">Session Name</h3>
              <Input
                placeholder="My Studio Session"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col space-y-2">
              <h3 className="text-sm font-medium">Join Existing Session</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter session ID"
                  value={joinSessionId}
                  onChange={(e) => setJoinSessionId(e.target.value)}
                />
                <Button variant="outline" onClick={joinExistingSession}>
                  Join
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={startNewSession}>Start New Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </div>
  );
}