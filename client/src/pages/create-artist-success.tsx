/**
 * /create-artist/success
 * Pantalla post-Stripe Checkout. El webhook ya marcó la compra como confirmed
 * (idempotente), así que este componente sólo muestra confirmación y siguientes pasos.
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Music2, Mail, ArrowRight, Sparkles } from "lucide-react";

export default function CreateArtistSuccessPage() {
  const [showConfetti, setShowConfetti] = useState(true);

  const sessionId = useMemo(() => {
    const usp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return usp.get("session_id");
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-zinc-900 text-white">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <div className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.08] to-rose-500/[0.04] p-10 text-center">
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 shadow-2xl shadow-orange-500/40 ${showConfetti ? "animate-bounce" : ""}`}>
            <CheckCircle2 className="h-12 w-12 text-white" />
          </div>

          <h1 className="mt-8 text-4xl font-black text-white sm:text-5xl">¡Bienvenido a Boostify!</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-zinc-300">
            Tu pago de <span className="font-black text-orange-300">$500 USD</span> fue procesado correctamente. Tu artista digital ya está
            en cola de producción.
          </p>

          {sessionId && (
            <p className="mt-3 text-[10px] font-mono text-zinc-500">Ref: {sessionId.slice(0, 24)}…</p>
          )}

          <div className="mt-10 grid gap-3 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
                <Mail className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-black text-white">Revisa tu email</p>
              <p className="mt-1 text-xs text-zinc-400">
                Te enviamos confirmación + acceso al curso de videos musicales con IA y a las herramientas Boostify.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-black text-white">Producción 24-72h</p>
              <p className="mt-1 text-xs text-zinc-400">
                Tu equipo Boostify empieza la entrega de tu artista digital (nombre, biografía, concepto, música, portada, video).
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
                <Music2 className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-black text-white">Programa de afiliados</p>
              <p className="mt-1 text-xs text-zinc-400">
                Activa tu link único para vender este mismo paquete y ganar comisiones.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-black text-white">Garantía activa</p>
              <p className="mt-1 text-xs text-zinc-400">
                Si no recibes tu estructura inicial completa, te devolvemos tu dinero.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => (window.location.href = "/dashboard")}
              className="bg-gradient-to-r from-orange-500 to-rose-500 px-8 py-6 font-black uppercase tracking-wide text-white"
            >
              Ir a mi dashboard <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/create-artist")}
              className="border-white/20 bg-white/5 px-8 py-6 font-bold text-white"
            >
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
