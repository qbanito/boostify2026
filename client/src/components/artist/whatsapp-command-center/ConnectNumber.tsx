import { AnimatePresence, motion } from 'framer-motion';
import { Smartphone, QrCode, RotateCcw, Power, Loader2, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import type { WhatsAppCenter } from '../../../hooks/use-whatsapp-center';
import { GlassCard, PanelHeader, StatusDot } from './shared';

/**
 * Connect Number — create an OpenWA session, render the pairing QR and surface
 * connection state. The artist scans the QR with WhatsApp → status flips to
 * connected and the rest of the Command Center unlocks.
 */
export function ConnectNumber({ center }: { center: WhatsAppCenter }) {
  const { status, isConnected, qrCode, simulated } = center;
  const phone = center.statusQuery.data?.phoneNumber;

  const stateLabel: Record<string, string> = {
    idle: 'Sin conectar', initializing: 'Inicializando…', qr: 'Escanea el QR',
    connected: 'Conectado', disconnected: 'Desconectado', expired: 'Sesión expirada', error: 'Error',
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<Smartphone className="h-5 w-5" />}
        title="Conectar WhatsApp"
        subtitle="Enlaza tu número para operar ventas, fans, tickets y comandos de IA."
      />

      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusDot connected={isConnected} />
            <div>
              <div className="text-sm font-semibold text-white">{stateLabel[status] || status}</div>
              {phone && <div className="text-xs text-white/50">+{phone}</div>}
            </div>
          </div>
          <div className="flex gap-2">
            {!isConnected ? (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => center.createSession.mutate(undefined)}
                disabled={center.createSession.isPending}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
              >
                {center.createSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Connect WhatsApp
              </motion.button>
            ) : (
              <button
                onClick={() => center.disconnect.mutate()}
                className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-200"
              >
                <Power className="h-4 w-4" /> Desconectar
              </button>
            )}
            {!isConnected && status !== 'idle' && (
              <button
                onClick={() => center.createSession.mutate(undefined)}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/80"
                title="Reconectar"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {simulated && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Modo simulación activo (sin gateway OpenWA configurado). La sesión se conecta
              automáticamente para que pruebes el panel. Define <code>OPENWA_BASE_URL</code> para
              enlazar un número real.
            </span>
          </div>
        )}
      </GlassCard>

      {/* QR modal */}
      <AnimatePresence>
        {!isConnected && qrCode && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm rounded-3xl border border-emerald-400/20 bg-[#0b0f14] p-6 text-center shadow-2xl"
            >
              <button
                onClick={() => center.reset()}
                className="absolute right-4 top-4 text-white/40 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <h4 className="text-lg font-semibold text-white">Escanea con WhatsApp</h4>
              <p className="mt-1 text-xs text-white/50">
                Abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo.
              </p>
              <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-3">
                <img src={qrCode} alt="WhatsApp QR" className="h-52 w-52 object-contain" />
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Esperando conexión…
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isConnected && (
        <GlassCard className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <p className="text-sm text-white/80">
            ¡WhatsApp conectado! Ya puedes usar el AI Command Console, enviar campañas y operar
            ventas desde tu número.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
