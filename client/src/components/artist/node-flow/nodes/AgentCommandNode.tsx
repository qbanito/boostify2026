/**
 * AGENT COMMAND NODE — Coordinates all other nodes via natural language.
 * The artist types a command; the AI interprets it, routes to the right module,
 * executes the action, and sends a confirmation email.
 */

import { useState, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, SendHorizontal, Loader2, CheckCircle, XCircle, Mail, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface AgentLog {
  id: string;
  command: string;
  summary: string;
  actionLabel: string;
  result: any;
  success: boolean;
  timestamp: Date;
}

interface AgentCommandNodeProps {
  data: {
    artistSlug?: string;
    artistId?: string | number;
    artistName?: string;
  };
}

export function AgentCommandNode({ data }: AgentCommandNodeProps) {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { artistSlug, artistId, artistName } = data;

  const submit = useCallback(async () => {
    const cmd = command.trim();
    if (!cmd || loading) return;
    setLoading(true);
    setCommand('');

    try {
      const res = await fetch('/api/node-flow-agent/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          command: cmd,
          artistSlug: artistSlug || '',
          artistId: artistId || 0,
        }),
      });

      const json = await res.json();
      const newLog: AgentLog = {
        id: Date.now().toString(),
        command: cmd,
        summary: json.summary || '',
        actionLabel: json.actionLabel || json.intent || '',
        result: json.result,
        success: json.success ?? false,
        timestamp: new Date(),
      };
      setLogs(prev => [newLog, ...prev].slice(0, 8));
      setShowLogs(true);
    } catch (e) {
      setLogs(prev => [{
        id: Date.now().toString(),
        command: cmd,
        summary: 'Error de conexión con el agente.',
        actionLabel: 'Error',
        result: null,
        success: false,
        timestamp: new Date(),
      }, ...prev].slice(0, 8));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [command, loading, artistSlug, artistId]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
  };

  const W = 320;

  return (
    <div style={{ position: 'relative', width: W, fontFamily: "'Inter', sans-serif", background: 'transparent' }}>
      {/* React Flow Handles — outside overflow:hidden */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#818cf8', border: '2px solid #312e81', width: 10, height: 10, zIndex: 10 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#818cf8', border: '2px solid #312e81', width: 10, height: 10, zIndex: 10 }}
      />

      {/* Card */}
      <div style={{
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1.5px solid rgba(99,102,241,0.5)',
        boxShadow: '0 0 24px rgba(99,102,241,0.2), 0 8px 24px rgba(0,0,0,0.4)',
        background: 'linear-gradient(145deg, #0f0f1a 0%, #1a1028 100%)',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 14px 10px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.15) 100%)',
          borderBottom: '1px solid rgba(99,102,241,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(99,102,241,0.5)',
          }}>
            <Bot size={16} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.5px' }}>
              NODE AGENT
            </div>
            <div style={{ fontSize: 9, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Coordinator AI · {artistName || artistSlug}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={12} color="#f59e0b" />
            <span style={{ fontSize: 9, color: '#f59e0b' }}>OpenRouter</span>
          </div>
        </div>

        {/* Input area */}
        <div style={{ padding: '12px 12px 8px' }}>
          <div style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 10,
            padding: '8px 10px',
            position: 'relative',
          }}>
            <textarea
              ref={inputRef}
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Escribe una instrucción... p.ej. 'Crea una noticia de mi nuevo lanzamiento'"
              rows={3}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: '#e2e8f0',
                fontSize: 11,
                lineHeight: 1.5,
                fontFamily: 'inherit',
              }}
            />
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 4,
            }}>
              <span style={{ fontSize: 9, color: '#4b5563' }}>Ctrl+Enter para enviar</span>
              <button
                onClick={submit}
                disabled={loading || !command.trim()}
                style={{
                  background: loading || !command.trim()
                    ? 'rgba(99,102,241,0.2)'
                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 10px',
                  cursor: loading || !command.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >
                {loading
                  ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Procesando…</>
                  : <><SendHorizontal size={11} /> Enviar</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Example commands */}
        {logs.length === 0 && (
          <div style={{ padding: '0 12px 10px' }}>
            <p style={{ fontSize: 9, color: '#4b5563', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Ejemplos
            </p>
            {[
              'Crea una noticia de mi nuevo álbum',
              'Activa el módulo de merchandise',
              'Escribe un post para Instagram',
            ].map(ex => (
              <button
                key={ex}
                onClick={() => setCommand(ex)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'rgba(99,102,241,0.06)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  color: '#818cf8',
                  fontSize: 10,
                  cursor: 'pointer',
                  marginBottom: 4,
                  fontFamily: 'inherit',
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Log */}
        {logs.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(99,102,241,0.15)' }}>
            <button
              onClick={() => setShowLogs(v => !v)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 12px',
                color: '#6b7280',
                fontSize: 10,
              }}
            >
              <span>Historial ({logs.length})</span>
              {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showLogs && (
              <div style={{ maxHeight: 200, overflowY: 'auto', padding: '0 10px 10px' }}>
                {logs.map(log => (
                  <div
                    key={log.id}
                    style={{
                      background: log.success ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                      border: `1px solid ${log.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      borderRadius: 8,
                      padding: '7px 9px',
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      {log.success
                        ? <CheckCircle size={10} color="#22c55e" />
                        : <XCircle size={10} color="#ef4444" />
                      }
                      <span style={{ fontSize: 10, fontWeight: 600, color: log.success ? '#22c55e' : '#ef4444' }}>
                        {log.actionLabel}
                      </span>
                      <span style={{ fontSize: 9, color: '#4b5563', marginLeft: 'auto' }}>
                        {log.timestamp.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
                      "{log.command}"
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: '#a78bfa' }}>
                      {log.summary}
                    </p>
                    {log.result?.post && (
                      <div style={{
                        marginTop: 5,
                        background: 'rgba(99,102,241,0.1)',
                        borderRadius: 5,
                        padding: '5px 7px',
                        fontSize: 9,
                        color: '#c4b5fd',
                        lineHeight: 1.4,
                      }}>
                        {log.result.post}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Email notice */}
        <div style={{
          padding: '6px 12px 10px',
          borderTop: '1px solid rgba(99,102,241,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}>
          <Mail size={9} color="#4b5563" />
          <span style={{ fontSize: 9, color: '#4b5563' }}>
            Confirmación a convoycubano@gmail.com vía Brevo
          </span>
        </div>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
