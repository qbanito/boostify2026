// Futuristic Chat Modal for AI Advisors
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Sparkles,
  Loader2,
  Bot,
  User,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  RefreshCw,
  Music2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { useToast } from '../../hooks/use-toast';
import type { LucideIcon } from 'lucide-react';
import type { ArtistContext } from '../../hooks/use-artist-context';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface AdvisorInfo {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  personality: string;
  expertise: string[];
}

interface AdvisorChatModalProps {
  advisor: AdvisorInfo;
  artist: ArtistContext | null;
  isOpen: boolean;
  onClose: () => void;
}

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <motion.div
        className="w-2 h-2 bg-orange-500 rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
      />
      <motion.div
        className="w-2 h-2 bg-orange-500 rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
      />
      <motion.div
        className="w-2 h-2 bg-orange-500 rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
      />
    </div>
  );
}

// Animated orb background
function AnimatedOrb({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className={cn("absolute w-64 h-64 rounded-full blur-3xl opacity-20", `bg-gradient-to-r ${color}`)}
        animate={{
          x: [0, 100, 50, 0],
          y: [0, 50, 100, 0],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: '-10%', left: '-10%' }}
      />
      <motion.div
        className={cn("absolute w-48 h-48 rounded-full blur-3xl opacity-15", `bg-gradient-to-r ${color}`)}
        animate={{
          x: [0, -80, -40, 0],
          y: [0, 80, 40, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        style={{ bottom: '-5%', right: '-5%' }}
      />
    </div>
  );
}

export function AdvisorChatModal({ advisor, artist, isOpen, onClose }: AdvisorChatModalProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const Icon = advisor.icon;

  // Build artist context for the system prompt
  const artistContext = artist ? `

ARTIST PROFILE YOU'RE ADVISING:
- Artist Name: ${artist.artistName}
- Genre(s): ${artist.genres?.join(', ') || artist.genre || 'Not specified'}
- Biography: ${artist.biography || 'Not provided'}
- Style: ${artist.style || 'Not specified'}
${artist.songs && artist.songs.length > 0 ? `- Songs: ${artist.songs.map(s => s.title).join(', ')}` : ''}

Use this artist's specific information to give personalized, relevant advice. Reference their genre, style, and other details when providing guidance.` : '';

  // System prompt for the advisor
  const systemPrompt = `You are ${advisor.name}, a ${advisor.title} specializing in ${advisor.expertise.join(', ')}. 

Your personality: ${advisor.personality}

Guidelines:
- Be helpful, professional, and encouraging
- Give specific, actionable advice related to your expertise
- Reference real industry practices and trends
- Keep responses concise but valuable (2-4 paragraphs max)
- Use examples from the music industry when relevant
- If asked about something outside your expertise, acknowledge it and redirect to your specialty
- Be conversational but maintain professionalism
${artistContext}

Remember: You're talking to ${artist ? artist.artistName : 'an independent artist or musician'} seeking guidance.`;

  // Initialize with greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const artistGreeting = artist 
        ? `Hey ${artist.artistName}! I'm ${advisor.name}, your ${advisor.title}. I've taken a look at your profile${artist.genres?.length ? ` and I see you're working in ${artist.genres.join(' and ')}` : ''}. I'm here to help you with ${advisor.expertise.slice(0, 2).join(' and ')}. What would you like to discuss today?`
        : `Hey there! I'm ${advisor.name}, your ${advisor.title}. I'm here to help you with ${advisor.expertise.slice(0, 2).join(' and ')}. What would you like to discuss today?`;
      
      const greeting: Message = {
        id: 'greeting',
        role: 'assistant',
        content: artistGreeting,
        timestamp: new Date(),
      };
      setMessages([greeting]);
    }
  }, [isOpen, advisor, artist, messages.length]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message to OpenAI
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          advisorId: advisor.id,
          artistId: artist?.id,
          artistData: artist ? {
            artistName: artist.artistName,
            genre: artist.genre,
            genres: artist.genres,
            biography: artist.biography,
            style: artist.style,
            songs: artist.songs?.map(s => ({ title: s.title, genre: s.genre, mood: s.mood })),
          } : null,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: input.trim() }
          ],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || data.content || 'I apologize, I encountered an issue. Could you please rephrase your question?',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, advisor, artist, systemPrompt, toast]);

  // Handle keyboard shortcut
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Copy message
  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset conversation
  const resetConversation = () => {
    setMessages([]);
    setInput('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative flex flex-col bg-[#0A0A0F] border border-[#1F1F2E] rounded-2xl shadow-2xl overflow-hidden",
            isExpanded ? "w-full h-full max-w-none m-0 rounded-none" : "w-full max-w-2xl h-[85vh] max-h-[700px]"
          )}
        >
          {/* Animated background */}
          <AnimatedOrb color={advisor.color} />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between p-4 border-b border-[#1F1F2E] bg-[#0A0A0F]/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              {/* Animated avatar */}
              <motion.div 
                className={cn("relative p-3 rounded-xl bg-gradient-to-br", advisor.color)}
                animate={{ 
                  boxShadow: [
                    `0 0 20px rgba(249, 115, 22, 0.3)`,
                    `0 0 40px rgba(249, 115, 22, 0.5)`,
                    `0 0 20px rgba(249, 115, 22, 0.3)`,
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Icon className="h-6 w-6 text-white" />
                {/* Online indicator */}
                <motion.div
                  className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0A0A0F]"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </motion.div>
              
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  {advisor.name}
                  <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">
                    Online
                  </Badge>
                </h3>
                <p className="text-sm text-gray-400">{advisor.title}</p>
              </div>
            </div>

            {/* Artist indicator */}
            {artist && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A24] border border-[#27272A] rounded-lg">
                {artist.profileImage ? (
                  <img src={artist.profileImage} alt={artist.artistName} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                    <Music2 className="w-3 h-3 text-white" />
                  </div>
                )}
                <span className="text-xs text-gray-300 hidden sm:block">{artist.artistName}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
                className="text-gray-400 hover:text-white"
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetConversation}
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-400 hover:text-white"
              >
                {isExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex gap-3 group",
                  message.role === 'user' ? "flex-row-reverse" : ""
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                  message.role === 'user' 
                    ? "bg-gradient-to-br from-orange-500 to-orange-600" 
                    : `bg-gradient-to-br ${advisor.color}`
                )}>
                  {message.role === 'user' ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>

                {/* Message bubble */}
                <div className={cn(
                  "relative max-w-[80%] px-4 py-3 rounded-2xl",
                  message.role === 'user'
                    ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-tr-sm"
                    : "bg-[#1A1A24] text-gray-100 border border-[#27272A] rounded-tl-sm"
                )}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Copy button */}
                  <button
                    onClick={() => copyMessage(message.id, message.content)}
                    className={cn(
                      "absolute -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity",
                      message.role === 'user' ? "right-0" : "left-0"
                    )}
                  >
                    {copiedId === message.id ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-gray-500 hover:text-gray-300" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
            
            {/* Typing indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className={cn("shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br", advisor.color)}>
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-[#1A1A24] border border-[#27272A] rounded-2xl rounded-tl-sm">
                  <TypingIndicator />
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="relative z-10 p-4 border-t border-[#1F1F2E] bg-[#0A0A0F]/80 backdrop-blur-md">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask ${advisor.name} anything...`}
                  className="min-h-[50px] max-h-[150px] resize-none bg-[#1A1A24] border-[#27272A] rounded-xl pr-12 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20"
                  rows={1}
                />
                <Button
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  onClick={sendMessage}
                  className={cn(
                    "absolute bottom-2 right-2 h-8 w-8 rounded-lg transition-all",
                    input.trim() && !isLoading
                      ? "bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90"
                      : "bg-[#27272A] text-gray-500"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-2 text-center">
              <Sparkles className="h-3 w-3 inline mr-1 text-orange-500" />
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>

          {/* Decorative corner elements */}
          <div className="absolute top-0 left-0 w-20 h-20 border-l-2 border-t-2 border-orange-500/20 rounded-tl-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-20 h-20 border-r-2 border-b-2 border-orange-500/20 rounded-br-2xl pointer-events-none" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default AdvisorChatModal;
