/**
 * BOOSTIFY NODE FLOW — TalkToMeNode
 *
 * Configures the ElevenLabs Conversational AI session for an artist so
 * downstream nodes (or embeds) can launch live voice conversations.
 *
 * Inputs  : artistId (text) — can receive from ArtistInputNode
 * Outputs : sessionConfig (object) — { agentId, voiceId, persona, topics, language }
 *
 * The node itself does NOT open a call — it prepares and validates the
 * configuration.  The "Test Call" button opens a mini-modal to prove it works.
 */

import { useState, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Settings2, Mic2, Sparkles, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Conversation as ElevenConversation } from '@elevenlabs/client';
import type { Conversation as ElevenConversationSession } from '@elevenlabs/client';
import { getTalkToMeAudioErrorMessage, getTalkToMeSessionTransport, prepareTalkToMeAudioSession } from '@/lib/talk-to-me-audio';
import type { TalkToMeAudioSessionOptions } from '@/lib/talk-to-me-audio';
import type { NodeFlowData } from '../useFlowStore';
import { useFlowStore } from '../useFlowStore';

// ─── Persona presets ───────────────────────────────────────────────────────────

const PERSONA_PRESETS = [
  { label: 'Fan Chat',         emoji: '💬', value: 'warm, funny, spontaneous, authentic' },
  { label: 'Radio Interview',  emoji: '🎙️', value: 'charismatic, eloquent, quotable, authoritative' },
  { label: 'Deep Dive',        emoji: '🎨', value: 'introspective, poetic, creative visionary' },
  { label: 'Hype Mode',        emoji: '🔥', value: 'high energy, confident, building anticipation' },
];

const LANGUAGES = ['español', 'english', 'português', 'français'];

// ─── Animation injection ────────────────────────────────────────────────────────

let _injected = false;
function injectAnim() {
  if (_injected || typeof document === 'undefined') return;
  _injected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes ttmRingRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes ttmGlowPulse  { 0%,100%{opacity:.85} 50%{opacity:.4} }
    @keyframes ttmRing       { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(1.12);opacity:.3} }
    @keyframes ttmWave       { 0%,100%{transform:scaleY(0.3)} 50%{transform:scaleY(1)} }
  `;
  document.head.appendChild(s);
}
injectAnim();

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="nodrag px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all"
      onClick={onClick}
      style={
        active
          ? { borderColor: '#10b981', background: '#10b98122', color: '#10b981' }
          : { borderColor: '#374151', background: '#1f293722', color: '#9ca3af' }
      }
    >
      {children}
    </button>
  );
}

// ─── BorderRing ────────────────────────────────────────────────────────────────

function BorderRing({ active }: { active: boolean }) {
  return active ? (
    <div
      style={{
        position: 'absolute', inset: -1, borderRadius: 18, pointerEvents: 'none', zIndex: 10,
        background: 'linear-gradient(135deg,#10b981,#059669,#10b981)',
        animation: 'ttmRingRotate 3s linear infinite',
        padding: 2,
        maskImage: 'linear-gradient(white,white)', WebkitMaskImage: 'linear-gradient(white,white)',
        opacity: 0,
      }}
    />
  ) : null;
}

// ─── Mini test-call modal ────────────────────────────────────────────────────────

type CallStatus = 'idle' | 'requesting_mic' | 'connecting' | 'active' | 'error' | 'ended';

function TestCallModal({
  artistName, nodeId, data,
  onClose,
}: {
  artistName: string; nodeId: string; data: NodeFlowData; onClose: () => void;
}) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [duration, setDuration]   = useState(0);
  const [errMsg,   setErrMsg]     = useState('');
  const [transcript, setTranscript] = useState<{ role: 'user' | 'artist'; text: string }[]>([]);

  const conversationRef = useRef<ElevenConversationSession | null>(null);
  const endingRef       = useRef(false);
  const startingRef     = useRef(false);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);

  const getDisconnectMessage = (details: unknown) => {
    if (!details || typeof details !== 'object') return '';
    const value = details as any;
    return String(value.message || value.context?.reason || value.context?.message || value.error || '');
  };

  const toElevenOverrides = (override: any) => {
    if (!override) return undefined;
    const agent: Record<string, unknown> = {};
    const tts: Record<string, unknown> = {};

    if (override.agent?.prompt) agent.prompt = override.agent.prompt;
    if (override.agent?.language) agent.language = override.agent.language;
    if (override.tts?.voice_id) tts.voiceId = override.tts.voice_id;

    const next: Record<string, unknown> = {};
    if (Object.keys(agent).length > 0) next.agent = agent;
    if (Object.keys(tts).length > 0) next.tts = tts;
    return Object.keys(next).length > 0 ? next : undefined;
  };

  const startCall = useCallback(async () => {
    if (startingRef.current || conversationRef.current) return;
    startingRef.current = true;
    setErrMsg('');
    setTranscript([]);
    setDuration(0);
    setStatus('requesting_mic');

    let audioSessionOptions: TalkToMeAudioSessionOptions;
    try {
      audioSessionOptions = await prepareTalkToMeAudioSession();
    } catch (e: any) {
      startingRef.current = false;
      setStatus('error');
      setErrMsg(getTalkToMeAudioErrorMessage(e));
      return;
    }

    setStatus('connecting');

    try {
      const res = await fetch('/api/talk-to-me/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          artistId:  data.artistId || undefined,
          artistName,
          persona:   (data as any).persona || 'warm, authentic, passionate about music',
          topics:    (data as any).topics   || [],
          language:  (data as any).language || 'español',
          voiceId:   (data as any).voiceId  || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.signedUrl) throw new Error(json.error || 'Failed to get signed URL');

      endingRef.current = false;
      const transport = getTalkToMeSessionTransport({
        signedUrl: json.signedUrl,
        conversationToken: json.conversationToken,
        preferWebRtcForMobileDevices: audioSessionOptions.preferWebRtcForMobileDevices,
      });
      console.log('[TalkToMeNode] Starting session transport:', transport.connectionType);
      const conversation = await ElevenConversation.startSession({
        ...transport,
        preferHeadphonesForIosDevices: audioSessionOptions.preferHeadphonesForIosDevices,
        useWakeLock: true,
        overrides: toElevenOverrides(json.conversationConfigOverride),
        onDebug: info => console.log('[TalkToMeNode] SDK debug:', info),
        onConnect: () => {
          setStatus('active');
          startingRef.current = false;
          timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        },
        onDisconnect: details => {
          conversationRef.current = null;
          startingRef.current = false;
          if (timerRef.current) clearInterval(timerRef.current);
          if (!endingRef.current) {
            const message = getDisconnectMessage(details) || 'Voice session closed before audio could start. Please try again.';
            setErrMsg(getTalkToMeAudioErrorMessage(message));
            setStatus('error');
          }
        },
        onError: (message) => {
          conversationRef.current = null;
          startingRef.current = false;
          setStatus('error');
          setErrMsg(getTalkToMeAudioErrorMessage(message || 'Connection dropped.'));
          if (timerRef.current) clearInterval(timerRef.current);
        },
        onMessage: message => {
          if (!message?.message) return;
          const role = message.role === 'user' || message.source === 'user' ? 'user' : 'artist';
          setTranscript(prev => [...prev, { role, text: message.message }]);
        },
      });
      conversationRef.current = conversation;
      conversation.setVolume({ volume: 1 });
      startingRef.current = false;
    } catch (e: any) {
      conversationRef.current = null;
      startingRef.current = false;
      setStatus('error');
      setErrMsg(getTalkToMeAudioErrorMessage(e));
    }
  }, [data, artistName]);

  const endCall = useCallback(() => {
    endingRef.current = true;
    startingRef.current = false;
    const conversation = conversationRef.current;
    conversationRef.current = null;
    void conversation?.endSession().catch(err => console.warn('[TalkToMeNode] SDK end failed:', err));
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('ended');
  }, []);

  const fmtDur = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div
      className="nodrag fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="w-80 rounded-2xl p-5 shadow-2xl"
        style={{ background: '#0f1729', border: '1px solid #10b98144' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-[#10b981]" />
            <span className="text-white text-sm font-bold">Test Call</span>
          </div>
          <button
            onClick={() => { endCall(); onClose(); }}
            className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
          >✕</button>
        </div>

        {status === 'idle' && (
          <div className="flex flex-col items-center py-6 gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl relative">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#10b981' }} />
              <div className="relative w-full h-full rounded-full flex items-center justify-center text-3xl" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>🎤</div>
            </div>
            <p className="text-white text-sm">{artistName}</p>
            <button onClick={startCall} className="px-6 py-2 rounded-full text-white text-sm font-bold" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
              📞 Start Test Call
            </button>
          </div>
        )}

        {(status === 'requesting_mic' || status === 'connecting') && (
          <div className="flex flex-col items-center py-6 gap-3">
            <Loader2 size={32} className="text-[#10b981] animate-spin" />
            <p className="text-white text-sm">{status === 'requesting_mic' ? 'Requesting microphone…' : 'Connecting…'}</p>
          </div>
        )}

        {status === 'active' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs px-2">
              <span className="flex items-center gap-1 text-[#10b981]"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />Live</span>
              <span className="font-mono text-gray-400">{fmtDur(duration)}</span>
            </div>
            <div className="flex items-end justify-center gap-0.5 h-8">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div key={i} className="w-1.5 rounded-full bg-[#10b981]"
                  animate={{ height: `${Math.random() * 28 + 4}px` }}
                  transition={{ duration: 0.15, repeat: Infinity, repeatType: 'mirror', delay: i * 0.05 }} />
              ))}
            </div>
            <div className="max-h-32 overflow-y-auto rounded-xl p-2 space-y-1.5" style={{ background: '#ffffff08' }}>
              {transcript.length === 0
                ? <p className="text-xs text-center text-gray-500 py-2">Speak now…</p>
                : transcript.map((l, i) => (
                    <div key={i} className={`flex ${l.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className="px-2 py-1 rounded-xl text-xs max-w-[85%]"
                        style={l.role === 'user' ? { background: '#10b98122', color: '#fff' } : { background: '#ffffff12', color: '#e5e7eb' }}>
                        {l.text}
                      </div>
                    </div>
                  ))
              }
            </div>
            <button onClick={endCall} className="w-full py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}>
              📵 End Call
            </button>
          </div>
        )}

        {status === 'ended' && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 size={36} className="mx-auto text-[#10b981]" />
            <p className="text-white text-sm">Call ended — {fmtDur(duration)}</p>
            <button onClick={() => { setStatus('idle'); setTranscript([]); setDuration(0); }}
              className="px-5 py-1.5 rounded-full text-xs text-white" style={{ background: '#10b981' }}>Call Again</button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-6 space-y-3">
            <XCircle size={36} className="mx-auto text-red-400" />
            <p className="text-red-400 text-sm">{errMsg}</p>
            <button onClick={() => setStatus('idle')} className="px-5 py-1.5 rounded-full text-xs text-white" style={{ background: '#10b981' }}>Retry</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── TalkToMeNode ──────────────────────────────────────────────────────────────

export default function TalkToMeNode({ id, data }: NodeProps<NodeFlowData>) {
  const { updateNodeData, setNodeStatus } = useFlowStore();

  const status  = (data.status ?? 'idle') as string;
  const isActive = status === 'running';

  // ── Local state ────────────────────────────────────────────────────────────
  const [expanded,      setExpanded]      = useState(false);
  const [selectedPersonaIdx, setPersonaIdx] = useState(0);
  const [selectedLang,  setLang]          = useState<string>((data as any).language || 'español');
  const [topics,        setTopics]        = useState<string>((data as any).topicsText || '');
  const [testCallOpen,  setTestCallOpen]  = useState(false);

  const nodeArtistName = (data as any).artistName || 'Artist';

  // ── Sync back to store ─────────────────────────────────────────────────────
  const saveConfig = useCallback(() => {
    const persona = PERSONA_PRESETS[selectedPersonaIdx].value;
    const topicsList = topics.split(',').map(s => s.trim()).filter(Boolean);
    updateNodeData(id, {
      persona,
      topics: topicsList,
      topicsText: topics,
      language: selectedLang,
      sessionConfig: {
        agentId:  process.env.ELEVENLABS_CONVAI_AGENT_ID || '',
        persona,
        topics:   topicsList,
        language: selectedLang,
      },
    });
    setNodeStatus(id, 'success', { sessionConfigured: true, persona, language: selectedLang });
  }, [id, selectedPersonaIdx, topics, selectedLang, updateNodeData, setNodeStatus]);

  return (
    <>
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        style={{
          width: 290,
          position: 'relative',
          borderRadius: 18,
          background: 'linear-gradient(145deg,#0d1b2a,#0f1729)',
          border: `1px solid ${isActive ? '#10b981' : '#1e3a3a'}`,
          boxShadow: isActive ? '0 0 24px #10b98133' : '0 4px 24px #00000066',
          overflow: 'visible',
          fontFamily: "'Inter',sans-serif",
        }}
      >
        <BorderRing active={isActive} />

        {/* ── Input handle ──────────────────────────────────────────────── */}
        <Handle type="target" position={Position.Left} id="artistId"
          style={{ top: 28, left: -8, width: 14, height: 14, borderRadius: 7,
            background: '#10b981', border: '2px solid #0d1b2a', zIndex: 20 }} />

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
              📞
            </div>
            <div>
              <p className="text-white text-xs font-bold leading-tight">Talk To Me</p>
              <p className="text-[10px]" style={{ color: '#6b7280' }}>Conversational AI</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Status dot */}
            <div className="w-2 h-2 rounded-full"
              style={{
                background: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : '#374151',
                boxShadow: status === 'success' ? '0 0 6px #10b98166' : undefined,
              }} />

            <button
              className="nodrag w-7 h-7 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all"
              onClick={() => setExpanded(e => !e)}
            >
              <Settings2 size={13} />
            </button>
          </div>
        </div>

        {/* ── Compact artist badge ──────────────────────────────────────── */}
        <div className="px-4 pb-3">
          <div className="rounded-xl px-3 py-2 flex items-center gap-2.5"
            style={{ background: '#10b98112', border: '1px solid #10b98133' }}>
            <Mic2 size={14} className="text-[#10b981] shrink-0" />
            <span className="text-xs text-white truncate">{nodeArtistName}</span>
            <span className="text-[10px] ml-auto" style={{ color: '#10b981' }}>
              {PERSONA_PRESETS[selectedPersonaIdx].emoji}
            </span>
          </div>
        </div>

        {/* ── Expanded config ───────────────────────────────────────────── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="nodrag px-4 pb-4 space-y-3">
                {/* Persona */}
                <div>
                  <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">Personality</p>
                  <div className="flex flex-wrap gap-1">
                    {PERSONA_PRESETS.map((p, i) => (
                      <Pill key={p.label} active={selectedPersonaIdx === i} onClick={() => setPersonaIdx(i)}>
                        {p.emoji} {p.label}
                      </Pill>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div>
                  <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">Language</p>
                  <div className="flex flex-wrap gap-1">
                    {LANGUAGES.map(l => (
                      <Pill key={l} active={selectedLang === l} onClick={() => setLang(l)}>
                        {l}
                      </Pill>
                    ))}
                  </div>
                </div>

                {/* Topics */}
                <div>
                  <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Topics (comma-separated)</p>
                  <textarea
                    rows={2}
                    className="nodrag w-full bg-white/5 border rounded-xl px-2 py-1.5 text-[11px] text-white resize-none focus:outline-none"
                    style={{ borderColor: '#1e3a3a' }}
                    value={topics}
                    onChange={e => setTopics(e.target.value)}
                    placeholder="songwriting, tours, collaborations…"
                  />
                </div>

                {/* Save + Test */}
                <div className="flex gap-2">
                  <button
                    className="nodrag flex-1 py-1.5 rounded-xl text-[11px] font-semibold text-white transition-opacity"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
                    onClick={saveConfig}
                  >
                    <Sparkles size={10} className="inline mr-1" />
                    Save
                  </button>
                  <button
                    className="nodrag flex-1 py-1.5 rounded-xl text-[11px] font-semibold text-white border border-[#10b98133] hover:bg-[#10b98115] transition-all"
                    style={{ color: '#10b981' }}
                    onClick={() => setTestCallOpen(true)}
                  >
                    <Phone size={10} className="inline mr-1" />
                    Test Call
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Output handle ─────────────────────────────────────────────── */}
        <Handle type="source" position={Position.Right} id="sessionConfig"
          style={{ top: 28, right: -8, width: 14, height: 14, borderRadius: 7,
            background: '#10b981', border: '2px solid #0d1b2a', zIndex: 20 }} />
      </motion.div>

      {/* ── Test call modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {testCallOpen && (
          <TestCallModal
            artistName={nodeArtistName}
            nodeId={id}
            data={data}
            onClose={() => setTestCallOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
