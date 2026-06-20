import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Radio,
  Users,
  MessageCircle,
  Send,
  Mic,
  MicOff,
  X,
  Flame,
  Music,
  Sparkles,
  Crown,
} from 'lucide-react';

interface LiveRoom {
  id: number;
  hostArtistId: number;
  title: string;
  topic: string;
  roomType: string;
  status: string;
  listenerCount: number;
  peakListeners: number;
  coHosts: any;
  createdAt: string;
}

interface ChatMessage {
  id: number;
  roomId: number;
  userId: number | null;
  message: string;
  messageType: string;
  isAI: boolean;
  reactions: any;
  createdAt: string;
}

const ROOM_TYPE_INFO: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  discussion: { icon: <MessageCircle className="w-4 h-4" />, color: 'bg-blue-500', label: 'Discussion' },
  listening_party: { icon: <Music className="w-4 h-4" />, color: 'bg-purple-500', label: 'Listening Party' },
  beef_battle: { icon: <Flame className="w-4 h-4" />, color: 'bg-red-500', label: 'Beef Battle' },
  ama: { icon: <Sparkles className="w-4 h-4" />, color: 'bg-yellow-500', label: 'AMA' },
  freestyle: { icon: <Mic className="w-4 h-4" />, color: 'bg-green-500', label: 'Freestyle' },
  collaboration: { icon: <Crown className="w-4 h-4" />, color: 'bg-pink-500', label: 'Collab' },
};

export function LiveSpaces({ userId }: { userId?: number }) {
  const queryClient = useQueryClient();
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fetch active rooms
  const { data: roomsData } = useQuery({
    queryKey: ['/api/ai-social/live/rooms'],
    refetchInterval: 10000,
  });

  // Fetch messages for active room
  const { data: messagesData } = useQuery({
    queryKey: ['/api/ai-social/live/room', activeRoom, 'messages'],
    queryFn: async () => {
      if (!activeRoom) return null;
      const res = await fetch(`/api/ai-social/live/room/${activeRoom}/messages`);
      return res.json();
    },
    enabled: !!activeRoom,
    refetchInterval: activeRoom ? 3000 : false,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ roomId, msg }: { roomId: number; msg: string }) => {
      const res = await fetch(`/api/ai-social/live/room/${roomId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: msg }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-social/live/room', activeRoom, 'messages'] });
    },
  });

  const rooms: LiveRoom[] = (roomsData as any)?.data || [];
  const messages_list: ChatMessage[] = (messagesData as any)?.data || [];
  const currentRoom = rooms.find((r) => r.id === activeRoom);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages_list.length]);

  const handleSend = () => {
    if (!message.trim() || !activeRoom || !userId) return;
    sendMessage.mutate({ roomId: activeRoom, msg: message });
    setMessage('');
  };

  // === ROOM LIST VIEW ===
  if (!activeRoom) {
    return (
      <Card className="bg-black/40 border-purple-500/20 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
              <Radio className="w-4 h-4 text-red-400 animate-pulse" />
            </div>
            Live Spaces
            {rooms.length > 0 && (
              <Badge variant="outline" className="ml-auto bg-red-500/20 text-red-300 border-red-500/30">
                {rooms.length} LIVE
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rooms.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <Radio className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No live spaces right now</p>
              <p className="text-xs text-gray-500 mt-1">AI artists will start one soon...</p>
            </div>
          ) : (
            <AnimatePresence>
              {rooms.map((room) => {
                const typeInfo = ROOM_TYPE_INFO[room.roomType] || ROOM_TYPE_INFO.discussion;
                return (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="cursor-pointer"
                    onClick={() => setActiveRoom(room.id)}
                  >
                    <div className="p-3 rounded-lg bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/20 hover:border-purple-400/40 transition-all group">
                      {/* LIVE indicator + Room type */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        <Badge className={`${typeInfo.color} text-white text-[10px] px-1.5 py-0`}>
                          {typeInfo.icon}
                          <span className="ml-1">{typeInfo.label}</span>
                        </Badge>
                        <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                          <Users className="w-3 h-3" />
                          {room.listenerCount}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                        {room.title}
                      </h4>

                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{room.topic}</p>

                      {/* Waveform animation */}
                      <div className="flex items-end gap-0.5 mt-2 h-3">
                        {Array.from({ length: 16 }).map((_, i) => (
                          <motion.div
                            key={i}
                            className="w-1 bg-gradient-to-t from-purple-500 to-pink-400 rounded-full"
                            animate={{
                              height: [4, Math.random() * 12 + 4, 4],
                            }}
                            transition={{
                              duration: 0.8 + Math.random() * 0.5,
                              repeat: Infinity,
                              delay: i * 0.05,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </CardContent>
      </Card>
    );
  }

  // === ACTIVE ROOM / CHAT VIEW ===
  return (
    <Card className="bg-black/40 border-purple-500/20 backdrop-blur-sm flex flex-col" style={{ height: '480px' }}>
      {/* Room header */}
      <CardHeader className="pb-2 border-b border-purple-500/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setActiveRoom(null)}
          >
            <X className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <h3 className="text-sm font-bold text-white truncate">{currentRoom?.title}</h3>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
              <Users className="w-3 h-3" /> {currentRoom?.listenerCount} listening
            </p>
          </div>
          <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">LIVE</Badge>
        </div>
      </CardHeader>

      {/* Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        <AnimatePresence>
          {messages_list.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: msg.isAI ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex gap-2 ${msg.messageType === 'system' ? 'justify-center' : ''}`}
            >
              {msg.messageType === 'system' ? (
                <span className="text-[10px] text-gray-500 italic bg-gray-800/50 px-2 py-0.5 rounded-full">
                  {msg.message}
                </span>
              ) : (
                <>
                  <Avatar className="w-6 h-6 flex-shrink-0 mt-0.5">
                    <AvatarFallback
                      className={`text-[10px] ${msg.isAI ? 'bg-purple-600' : 'bg-blue-600'}`}
                    >
                      {msg.isAI ? '🤖' : '👤'}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`rounded-lg px-2.5 py-1.5 max-w-[80%] ${
                      msg.isAI
                        ? 'bg-purple-900/40 border border-purple-500/20'
                        : 'bg-blue-900/40 border border-blue-500/20'
                    }`}
                  >
                    <p className="text-xs text-gray-200 leading-relaxed">{msg.message}</p>
                    {msg.messageType === 'highlight' && (
                      <span className="text-[10px] text-yellow-400">⭐ Highlight</span>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-purple-500/10 flex-shrink-0">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={userId ? 'Say something...' : 'Login to chat'}
            className="h-8 text-xs bg-black/40 border-purple-500/20"
            disabled={!userId}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button
            size="icon"
            className="h-8 w-8 bg-purple-600 hover:bg-purple-500"
            onClick={handleSend}
            disabled={!userId || !message.trim()}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
