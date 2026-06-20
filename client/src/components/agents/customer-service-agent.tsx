import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Mic, MicOff, Send, Minimize as MinimizeIcon, Bot, Phone, Headphones, UserRound, ExternalLink, Info } from 'lucide-react';
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Textarea } from "../ui/textarea";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useToast } from "../../hooks/use-toast";
import { useAuth } from "../../hooks/use-auth";
import { useIsMobile } from "../../hooks/use-mobile";
import { openRouterService } from "../../lib/api/openrouter-service";
import { elevenLabsService } from "../../lib/api/elevenlabs-service";
import { motion, AnimatePresence } from 'framer-motion';

// Custom icon component for music question
const IconMusicQuestion: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path 
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" 
        stroke="currentColor" 
        fill="none"
      />
      <path 
        d="M12 16v-1" 
        stroke="currentColor" 
        strokeWidth="2" 
      />
      <path 
        d="M12 13.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5" 
        stroke="currentColor" 
        strokeWidth="1.5" 
      />
      <path 
        d="M15 8a3 3 0 00-3-3 3 3 0 00-3 3" 
        stroke="currentColor" 
        strokeWidth="2" 
      />
      <path 
        d="M9 12V8" 
        stroke="currentColor" 
        strokeWidth="2" 
      />
      <path 
        d="M9 12l-2 1" 
        stroke="currentColor" 
        strokeWidth="1.5" 
      />
      <path 
        d="M9 8c0-1.5 1-2 2-2" 
        stroke="currentColor" 
        strokeWidth="1.5" 
      />
      <path 
        d="M15 8c1-1 2.5-.5 3 .5" 
        stroke="currentColor" 
        strokeWidth="1.5" 
      />
    </svg>
  );
};

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  audio?: string; // Base64 encoded audio
};

// Define ElevenLabs agent types
type ElevenLabsAgent = {
  id: string;
  name: string;
  description: string;
  agentId: string; // ID from ElevenLabs
  icon: React.ReactNode;
};

// ElevenLabs agent definitions
const ELEVENLABS_AGENTS: ElevenLabsAgent[] = [
  {
    id: 'business-relations',
    name: 'Business Relations',
    description: 'Speak with our business relations specialist about partnerships and collaborations.',
    agentId: '+1 315 784 4758',
    icon: <UserRound className="h-5 w-5" />
  },
  {
    id: 'sales-agent',
    name: 'Sales Agent',
    description: 'Get information about pricing, subscriptions, and premium features.',
    agentId: '+1 941 315 9237',
    icon: <Bot className="h-5 w-5" />
  },
  {
    id: 'support-agent',
    name: 'Support Agent',
    description: 'Technical support for platform features and troubleshooting.',
    agentId: '+1 470 798 3684',
    icon: <Headphones className="h-5 w-5" />
  }
];

const SYSTEM_PROMPT = `You are a helpful, friendly, and knowledgeable customer service agent for an advanced AI-powered music platform. Your name is Melody, and you're specialized in helping users navigate our platform.

You should assist users with questions about:
1. Music discovery and recommendation features - how our AI suggests new artists and tracks
2. Streaming capabilities and audio quality - details about our high-fidelity streaming options
3. Artist collaboration tools and features - how artists can connect and work together
4. External service integration - connecting with Spotify, Apple Music, Boostify Radio, etc.
5. Account management and subscription details - pricing, tiers, benefits, account settings
6. Social sharing and promotional features - how to share music and playlists on social media
7. Technical support - troubleshooting playback issues, device compatibility, app functionality
8. Music rights and licensing information - how we handle royalties and copyright

Platform-specific features you should be familiar with:
- Boostify Radio: Our personalized streaming radio feature
- Artist Boost: Tools for artists to promote their music
- AI Music Analysis: How we analyze listening patterns
- Collaborative Playlists: How users can build playlists together
- Music Video Creator: Our AI-powered music video tool
- EchoMatch: Our song recommendation algorithm

Always be courteous, precise, and helpful. Keep responses concise but complete, with a friendly and professional tone. If asked about something outside your knowledge scope, acknowledge that and offer to connect them with a human representative.`;

export const CustomerServiceAgent: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const [audioApiStatus, setAudioApiStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  
  // ElevenLabs agent dialog state
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<ElevenLabsAgent | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi there! I'm Melody, your AI assistant for all things related to our music platform. Whether you need help with Spotify integration, audio quality options, collaboration features, or managing your artist profile, I'm here to assist. How can I help you today?",
      timestamp: new Date(),
    }
  ]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input field when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, isMinimized]);
  
  // Check if APIs are available when component mounts
  useEffect(() => {
    const checkApiAvailability = async () => {
      try {
        // Check for OpenRouter API key
        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
        
        if (!apiKey) {
          console.error('OpenRouter API key not found in environment variables');
          setApiStatus('unavailable');
          return;
        }
        
        // For demo purposes, since we know the key exists, we'll set it as available
        // In a real implementation we would verify with an API call
        console.log('OpenRouter API key found in environment variables');
        setApiStatus('available');
        
        // If you need to actually verify the API key is valid, uncomment this
        /*
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          console.log('OpenRouter API connection successful');
          setApiStatus('available');
        } else {
          console.error('OpenRouter API connection failed:', await response.text());
          setApiStatus('unavailable');
        }
        */
      } catch (error) {
        console.error('Error checking OpenRouter API availability:', error);
        setApiStatus('unavailable');
      }
    };
    
    const checkElevenLabsAvailability = async () => {
      try {
        // Check for VITE_ELEVENLABS_API_KEY
        const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
        
        if (!apiKey) {
          console.log('ElevenLabs API key not found in environment variables - disabling audio features');
          setAudioApiStatus('unavailable');
          setAudioEnabled(false);
          return;
        }
        
        // For demo purposes, assume the key is valid
        console.log('ElevenLabs API key found, audio features available');
        setAudioApiStatus('available');
        
        // If you need to actually verify the API key is valid, uncomment this
        /*
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          console.log('ElevenLabs API connection successful');
          setAudioApiStatus('available');
        } else {
          console.error('ElevenLabs API connection failed:', await response.text());
          setAudioApiStatus('unavailable');
          setAudioEnabled(false);
        }
        */
      } catch (error) {
        console.error('Error checking ElevenLabs API availability:', error);
        setAudioApiStatus('unavailable');
        setAudioEnabled(false);
      }
    };
    
    checkApiAvailability();
    checkElevenLabsAvailability();
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    // Check if API is available
    if (apiStatus === 'unavailable') {
      toast({
        title: "Service Unavailable",
        description: "Our AI chat service is currently unavailable. Please try again later.",
        variant: "destructive"
      });
      return;
    }
    
    // Create a new user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    // Add user message to chat
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get AI response using OpenRouter
      // Check if OpenRouter API key is available
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('OpenRouter API key is not configured');
      }
      
      // Create conversation context by including previous messages
      const conversationContext = messages
        .filter(msg => messages.indexOf(msg) >= Math.max(0, messages.length - 5)) // Include last 5 messages for context
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      const aiResponse = await openRouterService.chatWithAgent(
        input.trim(),
        'customerService', // Using proper agent type
        user?.uid || 'anonymous',
        SYSTEM_PROMPT,
        conversationContext // Pass conversation context
      );
      
      let audioData: string | undefined;
      
      // Generate audio if enabled and ElevenLabs API key is configured
      if (audioEnabled) {
        try {
          // Check if ElevenLabs API key is available
          const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
          if (!apiKey) {
            throw new Error('ElevenLabs API key is not configured');
          }
          
          const audioResponse = await elevenLabsService.textToSpeech(aiResponse.response);
          audioData = audioResponse.audio;
        } catch (error) {
          console.error('Error generating audio:', error);
          
          // More specific error message based on the type of error
          let errorMessage = "Could not generate audio response, but text is available.";
          if (error instanceof Error && error.message.includes('API key')) {
            errorMessage = "Audio generation is not available. API key is missing.";
            // Disable audio for future messages
            setAudioEnabled(false);
          }
          
          toast({
            title: "Audio Generation Failed",
            description: errorMessage,
            variant: "destructive"
          });
        }
      }
      
      // Add assistant message to chat
      const assistantMessage: Message = {
        id: aiResponse.id,
        role: 'assistant',
        content: aiResponse.response,
        timestamp: new Date(aiResponse.timestamp),
        audio: audioData
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Auto-play audio if enabled
      if (audioEnabled && audioData) {
        playAudio(assistantMessage.id, audioData);
      }
    } catch (error) {
      console.error('Error in chat:', error);
      
      // Provide more specific error messages based on the error type
      let errorTitle = "Error";
      let errorMessage = "Failed to generate response. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          errorTitle = "Service Unavailable";
          errorMessage = "Our AI chat service is currently unavailable. Please try again later.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorTitle = "Network Error";
          errorMessage = "Could not connect to our AI service. Please check your internet connection.";
        } else if (error.message.includes('timeout')) {
          errorTitle = "Request Timeout";
          errorMessage = "The request took too long to complete. Please try again.";
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = (messageId: string, audioData: string) => {
    if (currentPlayingId) {
      // Stop any currently playing audio
      audioRef.current?.pause();
    }
    
    setCurrentPlayingId(messageId);
    
    // Create audio source and play
    if (audioRef.current) {
      audioRef.current.src = `data:audio/mpeg;base64,${audioData}`;
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err);
        setCurrentPlayingId(null);
      });
    }
  };

  const handleAudioEnded = () => {
    setCurrentPlayingId(null);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleAudio = () => {
    // Check if ElevenLabs API is available before enabling audio
    if (!audioEnabled && audioApiStatus === 'unavailable') {
      toast({
        title: "Voice Responses Unavailable",
        description: "Audio generation service is currently unavailable. Please try again later.",
        variant: "destructive"
      });
      return;
    }
    
    setAudioEnabled(prev => !prev);
    
    if (!audioRef.current) {
      // Create audio element if it doesn't exist
      audioRef.current = new Audio();
      audioRef.current.addEventListener('ended', handleAudioEnded);
    }
    
    toast({
      title: audioEnabled ? "Voice Responses Disabled" : "Voice Responses Enabled",
      description: audioEnabled 
        ? "AI assistant will respond with text only." 
        : "AI assistant will now respond with voice and text.",
    });
  };

  const toggleMinimize = () => {
    setIsMinimized(prev => !prev);
  };

  const resetChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: "¡Hola! Soy Melody, tu asistente de IA para todo lo relacionado con nuestra plataforma de música. Ya sea que necesites ayuda con la integración de Spotify, opciones de calidad de audio, funciones de colaboración o la gestión de tu perfil de artista, estoy aquí para ayudarte. ¿Cómo puedo asistirte hoy?",
        timestamp: new Date(),
      }
    ]);
    
    if (currentPlayingId) {
      audioRef.current?.pause();
      setCurrentPlayingId(null);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      resetChat();
      setIsMinimized(false);
    }, 300);
  };

  // Handle opening agent selection dialog
  const openAgentDialog = () => {
    setIsAgentDialogOpen(true);
  };

  // Estado para el modal del iframe
  const [isElevenLabsModalOpen, setIsElevenLabsModalOpen] = useState(false);
  
  // Handle selected agent connection
  const connectWithAgent = (agent: ElevenLabsAgent) => {
    setSelectedAgent(agent);
    setIsAgentDialogOpen(false);
    
    // Añadir mensaje al sistema
    const systemMessage: Message = {
      id: crypto.randomUUID(),
      role: 'system',
      content: `You are now being connected with our ${agent.name}. Your phone will initiate a call to ${agent.agentId}.`,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, systemMessage]);
    
    // En lugar de abrir una página de ElevenLabs, ahora iniciamos una llamada telefónica
    const phoneNumber = agent.agentId.replace(/\s+/g, ''); // Eliminar espacios
    const telUrl = `tel:${phoneNumber}`;
    window.open(telUrl);
    
    toast({
      title: `Calling ${agent.name}`,
      description: `Your phone is dialing ${agent.agentId} to connect with our specialist.`,
    });
  };

  return (
    <>
      {/* Audio element for TTS playback */}
      <audio ref={audioRef} style={{ display: 'none' }} onEnded={handleAudioEnded} />
      
      {/* Chat button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-[9999]"
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setIsOpen(true)}
                    size="lg"
                    className="rounded-full h-14 w-14 bg-gradient-to-br from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg"
                  >
                    <IconMusicQuestion className="h-6 w-6 text-white" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Chat with our AI Assistant</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              height: isMinimized ? 'auto' : '500px',
              width: isMinimized ? 'auto' : isMobile ? '92vw' : '380px'
            }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-[9999]"
          >
            <Card className="flex flex-col h-full w-full overflow-hidden rounded-xl border border-orange-500/20 bg-black/80 backdrop-blur-lg shadow-xl">
              {/* Chat header */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-t-xl">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 bg-orange-800">
                    <Bot className="h-5 w-5" />
                  </Avatar>
                  {!isMinimized && (
                    <div>
                      <h3 className="font-semibold text-sm">Melody • Music Assistant</h3>
                      <p className="text-xs opacity-80">
                        {apiStatus === 'loading' && "Connecting..."}
                        {apiStatus === 'available' && "Online • Ready to help"}
                        {apiStatus === 'unavailable' && "Offline • Service unavailable"}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-white hover:bg-orange-700/50"
                    onClick={toggleMinimize}
                  >
                    <MinimizeIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-white hover:bg-orange-700/50"
                    onClick={handleClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Chat body - only show when not minimized */}
              {!isMinimized && (
                <>
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                              message.role === 'user'
                                ? 'bg-orange-600 text-white'
                                : 'bg-zinc-800 text-gray-100'
                            }`}
                          >
                            <div className="whitespace-pre-wrap text-sm">
                              {message.content}
                            </div>
                            
                            {/* Audio controls for assistant messages */}
                            {message.role === 'assistant' && message.audio && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1 h-6 p-0 text-xs text-orange-300 hover:text-orange-200 hover:bg-transparent"
                                onClick={() => playAudio(message.id, message.audio!)}
                                disabled={currentPlayingId === message.id}
                              >
                                {currentPlayingId === message.id ? 'Playing...' : 'Play audio'}
                              </Button>
                            )}
                            
                            <div className="mt-1 text-xs opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Loading indicator */}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-zinc-800 text-gray-100">
                            <div className="flex items-center gap-2">
                              <div className="flex space-x-1">
                                <div className="h-2 w-2 rounded-full bg-orange-400 animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="h-2 w-2 rounded-full bg-orange-400 animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="h-2 w-2 rounded-full bg-orange-400 animate-bounce"></div>
                              </div>
                              <span className="text-sm text-gray-400">Thinking...</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Chat input */}
                  <div className="p-3 border-t border-gray-800">
                    <div className="flex items-center mb-2 px-1">
                      <div className="flex-1 flex justify-start gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-gray-400 hover:text-orange-400 hover:bg-orange-600/10"
                                onClick={openAgentDialog}
                              >
                                <Phone className="h-3.5 w-3.5 mr-1" />
                                Talk to an Agent
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              Connect with a live voice agent
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-8 px-2 text-xs transition-all duration-300 ${
                                  audioEnabled 
                                    ? 'text-orange-400 bg-orange-600/10' 
                                    : 'text-gray-400 hover:text-orange-400 hover:bg-orange-600/10'
                                }`}
                                onClick={toggleAudio}
                                disabled={audioApiStatus === 'unavailable'}
                              >
                                {audioEnabled ? 
                                  <><Headphones className="h-3.5 w-3.5 mr-1" /> Voice enabled</> :
                                  <><Headphones className="h-3.5 w-3.5 mr-1" /> Enable voice</>
                                }
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {audioApiStatus === 'unavailable' 
                                ? "Voice responses unavailable" 
                                : audioEnabled 
                                  ? "Disable voice responses" 
                                  : "Enable voice responses"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      
                      {/* Info button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full text-gray-400 hover:text-orange-400 hover:bg-orange-600/10"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex gap-2">
                      <Textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        placeholder="Ask me anything about our music platform..."
                        className="min-h-10 max-h-32 resize-none bg-zinc-800 border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-orange-600 text-white hover:bg-orange-700"
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isLoading}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick action menu for frequently asked questions */}
      <AnimatePresence>
        {isOpen && !isMinimized && !isMobile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="fixed bottom-20 sm:bottom-6 right-[390px] z-[9999]"
          >
            <div className="flex flex-col gap-2">
              {/* Agent Connection Button */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="bg-black/80 border-orange-500/20 text-orange-500 hover:bg-black/90 hover:text-orange-400 backdrop-blur-lg"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Speak with an Agent
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="left" className="w-80 bg-black/90 border border-orange-500/20 backdrop-blur-lg text-white p-0">
                  <div className="p-2">
                    <h4 className="font-medium text-sm mb-2 text-orange-500">Select an Agent to Call</h4>
                    <p className="text-xs text-gray-300 mb-3">
                      Connect with one of our specialists via phone call for personalized assistance. Your phone will initiate a call to the selected agent.
                    </p>
                    <div className="space-y-2">
                      {ELEVENLABS_AGENTS.map((agent) => (
                        <div 
                          key={agent.id}
                          className="p-2 rounded-lg border border-gray-800 hover:border-orange-500/50 hover:bg-gray-900/50 cursor-pointer transition-all"
                          onClick={() => connectWithAgent(agent)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-orange-600/30 text-orange-500">
                              {agent.icon}
                            </div>
                            <div>
                              <h5 className="font-medium text-sm text-orange-400">{agent.name}</h5>
                              <p className="text-xs text-gray-400">{agent.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Quick Questions */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="bg-black/80 border-orange-500/20 text-orange-500 hover:bg-black/90 hover:text-orange-400 backdrop-blur-lg"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Quick Questions
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="left" className="w-80 bg-black/90 border border-orange-500/20 backdrop-blur-lg text-white p-0">
                  <div className="p-2">
                    <h4 className="font-medium text-sm mb-2 text-orange-500">Frequently Asked Questions</h4>
                    <div className="space-y-1">
                      {[
                        "How do I connect my Spotify account?",
                        "What audio quality do you support?",
                        "How can I collaborate with other artists?",
                        "What are the subscription options?",
                        "How do I share my playlist on social media?"
                      ].map((question, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          className="w-full justify-start text-xs text-left h-auto py-2 hover:bg-orange-600/20 hover:text-orange-300"
                          onClick={() => {
                            setInput(question);
                            inputRef.current?.focus();
                          }}
                        >
                          {question}
                        </Button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Agent Selection Dialog */}
      <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
        <DialogContent className="bg-black/95 border border-orange-500/20 text-white max-w-md z-[10000] fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] sm:w-auto">
          <DialogHeader>
            <DialogTitle className="text-orange-500">Connect with an Agent</DialogTitle>
            <DialogDescription className="text-gray-300">
              {isMobile ? 
                "Toca un especialista para llamar directamente." : 
                "Choose a specialist to call directly about your specific needs. Your phone will initiate a call to the selected agent."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            {ELEVENLABS_AGENTS.map((agent) => (
              <div 
                key={agent.id}
                className={`${isMobile ? 'p-2' : 'p-3'} rounded-lg border border-gray-800 hover:border-orange-500/50 hover:bg-gray-900/50 cursor-pointer transition-all`}
                onClick={() => connectWithAgent(agent)}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`${isMobile ? 'p-1.5' : 'p-2'} rounded-full bg-orange-600/30 text-orange-500`}>
                    {agent.icon}
                  </div>
                  <div>
                    <h5 className="font-medium text-sm text-orange-400">{agent.name}</h5>
                    <p className={`text-xs text-gray-400 ${isMobile ? 'line-clamp-1' : ''}`}>{agent.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <DialogFooter className="flex justify-center sm:justify-end pt-2">
            <Button 
              variant="outline" 
              className={`${isMobile ? 'w-full' : ''} bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30`}
              onClick={() => setIsAgentDialogOpen(false)}
            >
              {isMobile ? 'Cerrar' : 'Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CustomerServiceAgent;