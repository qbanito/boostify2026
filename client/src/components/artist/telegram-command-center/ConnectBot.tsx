import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Power, Loader2, ShieldAlert, CheckCircle2, KeyRound, ExternalLink } from 'lucide-react';
import type { TelegramCenter } from '../../../hooks/use-telegram-center';
import { GlassCard, PanelHeader, StatusDot } from './shared';

/**
 * Connect Bot — paste a @BotFather token, validate it on the backend (getMe)
 * and register the per-artist webhook. On success the rest of the Command
 * Center unlocks. Enter "demo" to try the module in simulation mode.
 */
export function ConnectBot({ center }: { center: TelegramCenter }) {
  const { status, isConnected, simulated, botUsername, botName } = center;
  const [token, setToken] = useState('');

  const stateLabel: Record<string, string> = {
    idle: 'Sin conectar', initializing: 'Validando token…', connected: 'Conectado',
    disconnected: 'Desconectado', invalid: 'Token inválido', error: 'Error',
  };

  const connect = () => {
    const t = token.trim();
    if (!t) return;
    center.connectBot.mutate(t);
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<Bot className="h-5 w-5" />}
        title="Conectar Bot de Telegram"
        subtitle="Pega el token de tu bot (@BotFather) para operar fans, canales, ventas y comandos de IA."
      />

      <GlassCard className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusDot connected={isConnected} />
            <div>
              <div className="text-sm font-semibold text-white">{stateLabel[status] || status}</div>
              {isConnected && (botUsername || botName) && (
                <div className="text-xs text-white/50">{botUsername ? `@${botUsername}` : botName}</div>
              )}
            </div>
          </div>
          {isConnected && (
            <button
              onClick={() => center.disconnect.mutate()}
              className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-200"
            >
              <Power className="h-4 w-4" /> Desconectar
            </button>
          )}
        </div>

        {!isConnected && (
          <div className="space-y-3">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') connect(); }}
                placeholder="123456789:ABCdef_token-de-tu-bot   (o «demo» para probar)"
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={connect}
              disabled={!token.trim() || center.connectBot.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {center.connectBot.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              Conectar bot
            </motion.button>
            {center.connectBot.data && !center.connectBot.data.success && center.connectBot.data.error && (
              <p className="text-center text-xs text-rose-300/90">{center.connectBot.data.error}</p>
            )}
          </div>
        )}

        {simulated && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Modo simulación activo. Los envíos se registran sin tocar Telegram. Conecta un token real de
              @BotFather para operar tu bot de verdad.
            </span>
          </div>
        )}
      </GlassCard>

      {/* How-to */}
      {!isConnected && (
        <GlassCard className="p-4">
          <h4 className="mb-2 text-sm font-semibold text-white/80">Cómo obtener tu token</h4>
          <ol className="space-y-1.5 text-xs text-white/60">
            <li>1. Abre Telegram y busca <span className="text-sky-300">@BotFather</span>.</li>
            <li>2. Envía <code className="rounded bg-white/10 px-1">/newbot</code> y elige nombre + usuario.</li>
            <li>3. Copia el token que te entrega y pégalo arriba.</li>
            <li>4. (Opcional) Para canales/grupos VIP, añade tu bot como administrador.</li>
          </ol>
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-sky-300 hover:text-sky-200"
          >
            Abrir @BotFather <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </GlassCard>
      )}

      {isConnected && (
        <GlassCard className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-sky-400" />
          <p className="text-sm text-white/80">
            ¡Bot conectado! Ya puedes usar el AI Command Console, enviar campañas, abrir canales/grupos VIP y
            operar ventas desde Telegram.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
