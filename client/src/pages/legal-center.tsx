import { Header } from "../components/layout/header";
import { Link } from "wouter";

const COMPANY = "Boostify Music, Inc.";
const EMAIL_DMCA = "copywrite@boostifymusic.com";
const DMCA_AGENT_NAME = "Neiver A. Alvarez";
const DMCA_AGENT_ADDRESS = "9860 N Kendall Dr, Apt E201, Miami, FL 33176, USA";
const DMCA_REGISTRATION = "DMCA-1074443";

interface DocCard {
  href: string;
  icon: string;
  title: string;
  desc: string;
  external?: boolean;
}

const DOCS: DocCard[] = [
  { href: "/terms", icon: "📄", title: "Términos y Condiciones", desc: "Reglas de uso de la plataforma y servicios." },
  { href: "/privacy", icon: "🔒", title: "Política de Privacidad", desc: "Cómo recopilamos, usamos y protegemos tus datos." },
  { href: "/legal/dmca", icon: "⚖️", title: "Política DMCA & Retirada", desc: "Notice & Takedown, agente designado y proceso." },
  { href: "/legal/copyright", icon: "©️", title: "Política de Copyright", desc: "Titularidad, licencias y reclamaciones de derechos." },
  { href: "/legal/ai-content", icon: "🤖", title: "Contenido Generado por IA", desc: "Licencia, responsabilidad e indemnización del contenido IA." },
  { href: "/legal/prohibited", icon: "🚫", title: "Contenido Prohibido", desc: "Qué no está permitido subir o distribuir." },
  { href: "/legal/dmca#trademark", icon: "™️", title: "Reclamaciones de Marca", desc: "Cómo reportar infracciones de marca registrada." },
  { href: "/legal/dmca#counter", icon: "↩️", title: "Contranotificaciones", desc: "Cómo apelar una retirada de contenido." },
  { href: "/legal/transparency", icon: "📊", title: "Transparencia & Apelaciones", desc: "Estadísticas de retiradas y proceso de apelación." },
];

function Card({ doc }: { doc: DocCard }) {
  const inner = (
    <div className="group h-full rounded-xl border border-slate-700 bg-slate-800/40 p-5 transition hover:border-orange-500/60 hover:bg-slate-800/80">
      <div className="mb-3 text-3xl">{doc.icon}</div>
      <h3 className="mb-1 font-semibold text-white group-hover:text-orange-300">{doc.title}</h3>
      <p className="text-xs leading-relaxed text-slate-400">{doc.desc}</p>
    </div>
  );
  return doc.href.startsWith("/legal") || doc.href.startsWith("/terms") || doc.href.startsWith("/privacy") ? (
    <Link href={doc.href}>{inner}</Link>
  ) : (
    <a href={doc.href}>{inner}</a>
  );
}

export default function LegalCenterPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-16 pt-28">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/15 text-3xl">🛡️</div>
          <h1 className="mb-2 text-4xl font-bold">Centro Legal</h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-400">
            {COMPANY} cumple con la Digital Millennium Copyright Act (DMCA) y opera bajo el régimen de
            puerto seguro (safe harbor). Aquí encontrarás todas nuestras políticas, el proceso de
            notificación y retirada, y cómo apelar.
          </p>
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DOCS.map((d) => (
            <Card key={d.title} doc={d} />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-6">
            <h2 className="mb-2 text-lg font-bold text-orange-300">¿Tus derechos están siendo infringidos?</h2>
            <p className="mb-4 text-sm text-slate-300">
              Si crees que tu obra protegida por copyright se está usando sin autorización en la plataforma,
              presenta una notificación DMCA. La revisaremos y actuaremos rápidamente.
            </p>
            <Link href="/legal/dmca">
              <span className="inline-block cursor-pointer rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600">
                Presentar notificación DMCA
              </span>
            </Link>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6">
            <h2 className="mb-2 text-lg font-bold text-white">Agente DMCA designado</h2>
            <p className="text-sm text-slate-300">
              Agente registrado ante la U.S. Copyright Office. Las notificaciones deben dirigirse a:
            </p>
            <ul className="mt-3 space-y-1 text-sm text-slate-400">
              <li><span className="text-slate-500">Empresa:</span> {COMPANY}</li>
              <li><span className="text-slate-500">Agente:</span> {DMCA_AGENT_NAME}</li>
              <li><span className="text-slate-500">Dirección:</span> {DMCA_AGENT_ADDRESS}</li>
              <li><span className="text-slate-500">Email DMCA:</span> <a className="text-orange-400 hover:underline" href={`mailto:${EMAIL_DMCA}`}>{EMAIL_DMCA}</a></li>
            </ul>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs text-green-300">
              <span>🛡️ U.S. Copyright Office Reg. No.</span>
              <span className="font-mono text-green-200">{DMCA_REGISTRATION}</span>
              <span className="text-green-400">· Active</span>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-500">
          ¿Recibiste una retirada? Puedes ver el estado de tus reclamaciones en{" "}
          <Link href="/legal/my-claims"><span className="cursor-pointer text-orange-400 hover:underline">Mis Reclamaciones</span></Link>.
        </p>
      </main>
    </div>
  );
}
