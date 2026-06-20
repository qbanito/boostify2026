import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';

interface CommandInputProps {
  artistName: string;
  disabled?: boolean;
  isSubmitting?: boolean;
  initialText?: string;
  onSubmit: (command: string, source: 'text' | 'voice') => void;
}

const SUGGESTIONS = (name: string) => [
  `Hey ${name}, crea una canción afrobeat sensual en español y francés con portada y video corto.`,
  `Hey ${name}, diseña una portada cinematográfica para mi nuevo single.`,
  `Hey ${name}, prepara una campaña de lanzamiento para TikTok e Instagram.`,
];

// Minimal typing for the experimental Web Speech API.
type SpeechRecognition = any;

function getRecognition(): SpeechRecognition | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = 'es-ES';
  return rec;
}

export function CommandInput({ artistName, disabled, isSubmitting, initialText, onSubmit }: CommandInputProps) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const sourceRef = useRef<'text' | 'voice'>('text');

  // Allow the parent ("Editar") to pre-fill the box for a quick refine.
  useEffect(() => {
    if (initialText && initialText.trim()) {
      setText(initialText);
      sourceRef.current = 'text';
    }
  }, [initialText]);

  useEffect(() => {
    const w = window as any;
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
    };
  }, []);

  const toggleVoice = () => {
    if (listening) {
      try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
      setListening(false);
      return;
    }
    const rec = getRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    sourceRef.current = 'voice';
    rec.onresult = (e: any) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setText(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };

  const handleSubmit = () => {
    const value = text.trim();
    if (!value || disabled || isSubmitting) return;
    onSubmit(value, sourceRef.current);
    setText('');
    sourceRef.current = 'text';
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-orange-500/40 via-orange-400/20 to-orange-500/40 blur-[2px]" />
        <div className="relative flex items-end gap-2 rounded-2xl border border-orange-500/30 bg-black/70 p-3 backdrop-blur">
          <Sparkles className="mt-2 h-5 w-5 shrink-0 text-orange-400" />
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); sourceRef.current = 'text'; }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder={`Hey ${artistName}, crea una nueva canción…`}
            rows={2}
            disabled={disabled}
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none disabled:opacity-50"
          />
          {voiceSupported && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={toggleVoice}
              disabled={disabled}
              className={`shrink-0 rounded-xl ${listening ? 'bg-orange-500/20 text-orange-300' : 'text-white/60 hover:text-orange-300'}`}
              title={listening ? 'Detener dictado' : 'Hablar'}
            >
              {listening ? <MicOff className="h-5 w-5 animate-pulse" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            onClick={handleSubmit}
            disabled={disabled || isSubmitting || !text.trim()}
            className="shrink-0 rounded-xl bg-orange-500 text-black hover:bg-orange-400"
            title="Ejecutar comando"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {!text && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap gap-2"
          >
            {SUGGESTIONS(artistName).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setText(s); sourceRef.current = 'text'; }}
                className="rounded-full border border-orange-500/20 bg-orange-500/5 px-3 py-1 text-left text-[11px] text-white/60 transition hover:border-orange-500/40 hover:text-orange-200"
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {listening && (
        <div className="flex items-center gap-2 text-xs text-orange-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
          </span>
          Escuchando… habla ahora
        </div>
      )}
    </div>
  );
}
