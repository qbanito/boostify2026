/**
 * 🛡️ Agent Gateway Panel — Public section in artist profile
 *
 * Shows the gateway interface for external visitors:
 * - Intent buttons (Book, License, Brand Collab, etc.)
 * - Chat interface with the selected agent
 * - Status tracker for submitted requests
 */
import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Shield, Send, Loader2, Briefcase, Music, Handshake, Users,
  Newspaper, MessageCircle, ArrowLeft, ChevronRight, Clock,
  CheckCircle2, AlertCircle, XCircle, Sparkles, Lock,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface GatewayConfig {
  communicationMode: string;
  gatewayEnabled: boolean;
  welcomeMessage?: string;
  publicEmailVisible: boolean;
}

interface AgentInfo {
  agentType: string;
  name: string;
  description: string;
}

interface RequiredField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea';
  options?: string[];
  required: boolean;
}

interface ConversationState {
  conversationId: string;
  agentType: string;
  agentName: string;
  welcomeMessage: string;
  requiredFields: RequiredField[];
  requestId: number;
}

interface ChatMessage {
  id?: number;
  role: 'user' | 'agent' | 'system';
  content: string;
  action?: string;
  createdAt?: string;
}

// ─── Intent Buttons ────────────────────────────────────────────────────────

const INTENTS = [
  { id: 'booking', label: 'Book This Artist', icon: Briefcase, color: 'from-orange-600 to-amber-600', description: 'Events, shows, appearances' },
  { id: 'licensing', label: 'License Music', icon: Music, color: 'from-purple-600 to-violet-600', description: 'Sync, commercial use' },
  { id: 'brand', label: 'Brand Collaboration', icon: Handshake, color: 'from-blue-600 to-cyan-600', description: 'Partnerships, endorsements' },
  { id: 'collaboration', label: 'Submit Collaboration', icon: Users, color: 'from-emerald-600 to-teal-600', description: 'Producer/artist collabs' },
  { id: 'press', label: 'Press / Interview', icon: Newspaper, color: 'from-pink-600 to-rose-600', description: 'Media requests, features' },
  { id: 'fan', label: 'Fan Message', icon: MessageCircle, color: 'from-sky-600 to-blue-600', description: 'General messages, fan mail' },
];

// ─── Main Component ────────────────────────────────────────────────────────

interface GatewayPanelProps {
  artistId: number;
  artistName: string;
  isOwner: boolean;
  colors: { hexPrimary: string; hexAccent: string; hexBorder: string };
  cardStyles: string;
  cardStyleInline: React.CSSProperties;
  onOpenConsole?: () => void;
}

export function AgentGatewayPanel({
  artistId, artistName, isOwner, colors, cardStyles, cardStyleInline, onOpenConsole,
}: GatewayPanelProps) {
  const { toast } = useToast();
  const [view, setView] = useState<'home' | 'form' | 'chat' | 'status'>('home');
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderCompany, setSenderCompany] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch gateway config
  const configQ = useQuery({
    queryKey: ['agent-gateway', 'config', artistId],
    queryFn: async () => (await apiRequest('GET', `/api/agent-gateway/${artistId}/config`)) as { ok: boolean; config: GatewayConfig },
    staleTime: 5 * 60 * 1000,
  });

  const config = configQ.data?.config;

  // Start conversation mutation
  const startM = useMutation({
    mutationFn: async (data: { intent: string; senderName: string; senderEmail: string; senderCompany: string; initialMessage?: string }) => {
      return await apiRequest('POST', `/api/agent-gateway/${artistId}/start`, data) as any;
    },
    onSuccess: (data) => {
      setConversation({
        conversationId: data.conversationId,
        agentType: data.agentType,
        agentName: data.agentName,
        welcomeMessage: data.welcomeMessage,
        requiredFields: data.requiredFields || [],
        requestId: data.requestId,
      });
      setMessages([{ role: 'agent', content: data.welcomeMessage }]);
      setView('chat');
    },
    onError: (err: any) => {
      toast({ title: 'Failed to start conversation', description: err?.message, variant: 'destructive' });
    },
  });

  // Send message mutation
  const sendM = useMutation({
    mutationFn: async (content: string) => {
      if (!conversation) throw new Error('No conversation');
      return await apiRequest('POST', `/api/agent-gateway/${conversation.conversationId}/message`, { content }) as any;
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'agent', content: data.message?.message || 'Response received.', action: data.message?.action }]);
      setIsSending(false);
      setInputText('');
    },
    onError: (err: any) => {
      toast({ title: 'Failed to send message', description: err?.message, variant: 'destructive' });
      setIsSending(false);
    },
  });

  const handleSelectIntent = (intentId: string) => {
    setSelectedIntent(intentId);
    setView('form');
  };

  const handleStartConversation = () => {
    if (!selectedIntent || !senderName.trim()) {
      toast({ title: 'Please enter your name', variant: 'destructive' });
      return;
    }

    // Build initial message from form data
    const parts: string[] = [];
    if (formData.message) parts.push(formData.message);
    for (const [key, value] of Object.entries(formData)) {
      if (key !== 'message' && value) {
        const field = conversation?.requiredFields?.find(f => f.key === key);
        parts.push(`${field?.label || key}: ${value}`);
      }
    }

    startM.mutate({
      intent: selectedIntent,
      senderName,
      senderEmail,
      senderCompany,
      initialMessage: parts.length > 0 ? parts.join('\n') : undefined,
    });
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !conversation) return;
    setMessages(prev => [...prev, { role: 'user', content: inputText }]);
    setIsSending(true);
    sendM.mutate(inputText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="relative overflow-hidden rounded-xl border" style={{ borderColor: colors.hexBorder, background: `linear-gradient(135deg, ${colors.hexPrimary}10 0%, rgba(8,12,24,0.95) 50%, ${colors.hexAccent}08 100%)` }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: colors.hexBorder }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${colors.hexPrimary}25`, border: `1px solid ${colors.hexPrimary}40` }}>
              <Shield className="w-5 h-5" style={{ color: colors.hexPrimary }} />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Agent Gateway</h3>
              <p className="text-white/40 text-xs">Official communication channel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
              <Lock className="w-3 h-3 mr-1" /> Agents Only
            </Badge>
            {isOwner && onOpenConsole && (
              <Button size="sm" variant="outline" className="border-white/20 text-white/70 text-xs h-7" onClick={onOpenConsole}>
                Console
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* HOME VIEW — Intent buttons */}
        {view === 'home' && (
          <div className="space-y-4">
            <p className="text-white/50 text-xs leading-relaxed">
              All communication with {artistName} is managed through their verified AI agent team. Choose your request type to get started.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INTENTS.map(intent => (
                <button
                  key={intent.id}
                  onClick={() => handleSelectIntent(intent.id)}
                  className="group p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-left"
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${intent.color} flex items-center justify-center mb-2`}>
                    <intent.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-white text-xs font-semibold mb-0.5">{intent.label}</div>
                  <div className="text-white/30 text-[10px]">{intent.description}</div>
                </button>
              ))}
            </div>
            <p className="text-white/25 text-[10px] text-center">
              Direct contact is not available. All opportunities are reviewed by {artistName}'s Agent Network.
            </p>
          </div>
        )}

        {/* FORM VIEW — Sender info + form fields */}
        {view === 'form' && (
          <div className="space-y-4">
            <button onClick={() => setView('home')} className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>

            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${INTENTS.find(i => i.id === selectedIntent)?.color || 'from-gray-600 to-gray-700'} flex items-center justify-center`}>
                {(() => { const Icon = INTENTS.find(i => i.id === selectedIntent)?.icon || Shield; return <Icon className="w-4 h-4 text-white" />; })()}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{INTENTS.find(i => i.id === selectedIntent)?.label}</div>
                <div className="text-white/40 text-[10px]">Connecting you to the right agent…</div>
              </div>
            </div>

            {/* Sender info */}
            <div className="space-y-3">
              <div>
                <Label className="text-white/60 text-xs mb-1">Your Name *</Label>
                <Input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="John Doe" className="bg-white/5 border-white/10 text-white text-sm h-9" />
              </div>
              <div>
                <Label className="text-white/60 text-xs mb-1">Email</Label>
                <Input value={senderEmail} onChange={e => setSenderEmail(e.target.value)} placeholder="john@company.com" className="bg-white/5 border-white/10 text-white text-sm h-9" />
              </div>
              <div>
                <Label className="text-white/60 text-xs mb-1">Company / Organization</Label>
                <Input value={senderCompany} onChange={e => setSenderCompany(e.target.value)} placeholder="Company Name" className="bg-white/5 border-white/10 text-white text-sm h-9" />
              </div>
              <div>
                <Label className="text-white/60 text-xs mb-1">Initial Message</Label>
                <Textarea value={formData.message || ''} onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))} placeholder="Briefly describe your request…" className="bg-white/5 border-white/10 text-white text-sm min-h-[80px]" />
              </div>
            </div>

            <Button
              onClick={handleStartConversation}
              disabled={startM.isPending || !senderName.trim()}
              className="w-full text-white font-semibold h-10"
              style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
            >
              {startM.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Connecting…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Start Conversation</>
              )}
            </Button>
          </div>
        )}

        {/* CHAT VIEW — Conversation with agent */}
        {view === 'chat' && conversation && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => { setView('home'); setConversation(null); setMessages([]); }} className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors">
                <ArrowLeft className="w-3 h-3" /> New Request
              </button>
              <Badge variant="outline" className="border-white/20 text-white/50 text-[10px]">
                {conversation.agentName}
              </Badge>
            </div>

            {/* Messages */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md'
                      : msg.role === 'system'
                      ? 'bg-white/5 border border-white/10 text-white/60 text-xs italic'
                      : 'bg-white/10 border border-white/10 text-white/80 rounded-bl-md'
                  }`}>
                    {msg.role === 'agent' && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <Shield className="w-3 h-3" style={{ color: colors.hexPrimary }} />
                        <span className="text-[10px] font-semibold" style={{ color: colors.hexPrimary }}>{conversation.agentName}</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-white/10 border border-white/10 rounded-2xl rounded-bl-md px-4 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2 pt-2 border-t border-white/10">
              <Textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message…"
                className="flex-1 bg-white/5 border-white/10 text-white text-sm min-h-[44px] max-h-[100px] resize-none"
                rows={1}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isSending || !inputText.trim()}
                size="sm"
                className="self-end h-11 px-4 text-white"
                style={{ background: colors.hexPrimary }}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
