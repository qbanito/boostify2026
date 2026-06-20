/**
 * DirectorChatOverlay
 * Mini-chat flotante para interactuar con el director sobre un corte específico.
 * El director responde en primera persona con su estilo y personalidad, 
 * ofreciendo acciones aplicables directamente al clip.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { DirectorProfile } from '../../../data/directors/director-schema';
import type { TimelineClip } from '../../../interfaces/timeline';
import {
  chatWithDirector,
  getDirectorImageUrl,
  type DirectorChatMessage,
  type DirectorChatAction,
} from '../../../lib/services/director-ai-service';
import {
  X, Send, Loader2, Camera, Clock, Lightbulb,
  Film, RefreshCw, Sparkles, CornerDownLeft,
} from 'lucide-react';

interface DirectorChatOverlayProps {
  director: DirectorProfile;
  clip: TimelineClip;
  allClips: TimelineClip[];
  clipIndex: number;
  onClose: () => void;
  onApplyAction: (clip: TimelineClip, action: DirectorChatAction) => void;
  scriptContent?: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  shot_type: <Camera size={12} />,
  duration: <Clock size={12} />,
  camera: <Camera size={12} />,
  lens: <Camera size={12} />,
  lighting: <Lightbulb size={12} />,
  regenerate: <RefreshCw size={12} />,
  transition: <Film size={12} />,
};

const DirectorChatOverlay: React.FC<DirectorChatOverlayProps> = ({
  director,
  clip,
  allClips,
  clipIndex,
  onClose,
  onApplyAction,
  scriptContent,
}) => {
  const [messages, setMessages] = useState<DirectorChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send initial greeting on mount
  useEffect(() => {
    const greeting: DirectorChatMessage = {
      role: 'director',
      content: `Hola, soy ${director.name}. Estoy viendo la escena ${clipIndex + 1}${clip.title ? ` — "${clip.title}"` : ''}. ${clip.shotType ? `Actualmente es un plano ${clip.shotType}.` : ''} ¿Qué quieres que revisemos juntos?`,
      timestamp: Date.now(),
      actions: [],
    };
    setMessages([greeting]);
  }, [director.name, clipIndex, clip.title, clip.shotType]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: DirectorChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithDirector(
        director, clip, allClips, [...messages, userMsg], text, scriptContent
      );
      setMessages(prev => [...prev, response]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'director',
        content: 'Perdona, tuve un problema técnico. ¿Podrías repetir?',
        timestamp: Date.now(),
        actions: [],
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, director, clip, allClips, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick prompts
  const quickPrompts = [
    '¿Qué tipo de toma recomiendas?',
    '¿Cambio la iluminación?',
    '¿Cómo mejoro esta escena?',
    'Sugiere un movimiento de cámara',
  ];

  return createPortal(
    <div className="director-chat-overlay" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="dc-header">
        <div className="dc-header-left">
          <img
            src={getDirectorImageUrl(director)}
            alt={director.name}
            className="dc-avatar"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(director.name)}&scale=80`; }}
          />
          <div>
            <div className="dc-name">{director.name}</div>
            <div className="dc-scene">Escena {clipIndex + 1}</div>
          </div>
        </div>
        <button className="dc-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="dc-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`dc-msg ${msg.role}`}>
            {msg.role === 'director' && (
              <img src={getDirectorImageUrl(director)} alt="" className="dc-msg-avatar" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="dc-msg-bubble">
              <p>{msg.content}</p>
              {msg.actions && msg.actions.length > 0 && (
                <div className="dc-actions">
                  {msg.actions.map((action, j) => (
                    <button
                      key={j}
                      className="dc-action-btn"
                      onClick={() => onApplyAction(clip, action)}
                    >
                      {ACTION_ICONS[action.type] || <Sparkles size={12} />}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="dc-msg director">
            <img src={getDirectorImageUrl(director)} alt="" className="dc-msg-avatar" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div className="dc-msg-bubble dc-typing">
              <Loader2 size={14} className="animate-spin" />
              <span>{director.name} está pensando...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="dc-quick-prompts">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              className="dc-quick-btn"
              onClick={() => { setInput(p); inputRef.current?.focus(); }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="dc-input-bar">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Pregúntale a ${director.name}...`}
          disabled={isLoading}
          className="dc-input"
        />
        <button
          className="dc-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="dc-hint">
        <CornerDownLeft size={10} />
        <span>Enter para enviar</span>
      </div>

      {/* Styles */}
      <style>{`
        .director-chat-overlay {
          position: fixed;
          bottom: 80px;
          right: 20px;
          width: 380px;
          max-width: calc(100vw - 40px);
          max-height: 520px;
          background: linear-gradient(180deg, rgba(20,20,24,0.98), rgba(12,12,16,0.98));
          border: 1px solid rgba(249,115,22,0.25);
          border-radius: 16px;
          backdrop-filter: blur(24px);
          box-shadow:
            0 20px 60px rgba(0,0,0,0.6),
            0 4px 20px rgba(0,0,0,0.4);
          display: flex;
          flex-direction: column;
          z-index: 2147483647 !important;
          animation: chatOverlayIn 0.2s cubic-bezier(0.16,1,0.3,1);
          overflow: hidden;
        }
        @keyframes chatOverlayIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .dc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(249,115,22,0.05);
        }
        .dc-header-left { display: flex; align-items: center; gap: 10px; }
        .dc-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(249,115,22,0.5);
          box-shadow: 0 0 10px rgba(249,115,22,0.2);
        }
        .dc-name {
          font-size: 13px; font-weight: 700; color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .dc-scene {
          font-size: 10px; color: rgba(255,255,255,0.4);
          font-family: 'Courier New', monospace;
        }
        .dc-close {
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.5);
          cursor: pointer; transition: all 0.12s;
        }
        .dc-close:hover { background: rgba(239,68,68,0.2); color: #f87171; }

        .dc-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 160px;
          max-height: 280px;
        }

        .dc-msg {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }
        .dc-msg.user { justify-content: flex-end; }
        .dc-msg.director { justify-content: flex-start; }

        .dc-msg-avatar {
          width: 24px; height: 24px;
          border-radius: 50%;
          object-fit: cover;
          border: 1.5px solid rgba(249,115,22,0.4);
          flex-shrink: 0;
        }

        .dc-msg-bubble {
          max-width: 80%;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 12px;
          line-height: 1.5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .dc-msg-bubble p { margin: 0; }

        .dc-msg.director .dc-msg-bubble {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .dc-msg.user .dc-msg-bubble {
          background: rgba(249,115,22,0.15);
          color: rgba(255,255,255,0.9);
          border: 1px solid rgba(249,115,22,0.2);
        }

        .dc-typing {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.4) !important;
          font-style: italic;
        }
        .dc-typing svg { color: #f97316; }

        .dc-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .dc-action-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border-radius: 6px;
          border: 1px solid rgba(249,115,22,0.3);
          background: rgba(249,115,22,0.1);
          color: #fb923c;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .dc-action-btn:hover {
          background: rgba(249,115,22,0.25);
          border-color: rgba(249,115,22,0.5);
        }

        .dc-quick-prompts {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 0 14px 10px;
        }
        .dc-quick-btn {
          padding: 5px 10px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.5);
          font-size: 10px;
          cursor: pointer;
          transition: all 0.12s;
          white-space: nowrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .dc-quick-btn:hover {
          background: rgba(249,115,22,0.08);
          border-color: rgba(249,115,22,0.2);
          color: #fb923c;
        }

        .dc-input-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.15);
        }
        .dc-input {
          flex: 1;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #fff;
          font-size: 12px;
          outline: none;
          transition: border-color 0.15s;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .dc-input:focus { border-color: rgba(249,115,22,0.4); }
        .dc-input::placeholder { color: rgba(255,255,255,0.25); }
        .dc-input:disabled { opacity: 0.5; }

        .dc-send-btn {
          width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px;
          border: 1px solid rgba(249,115,22,0.3);
          background: rgba(249,115,22,0.12);
          color: #f97316;
          cursor: pointer;
          transition: all 0.12s;
        }
        .dc-send-btn:hover:not(:disabled) {
          background: rgba(249,115,22,0.3);
        }
        .dc-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .dc-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 4px;
          font-size: 9px;
          color: rgba(255,255,255,0.2);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
      `}</style>
    </div>,
    document.body
  );
};

export default DirectorChatOverlay;
