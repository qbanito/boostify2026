import { Header } from "../components/layout/header";

const COMPANY = "Boostify Music, Inc.";
const EMAIL_LEGAL = "legal@boostify.music";
const EFFECTIVE_DATE = "Junio 2026";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-28">
      <h2 className="mb-3 border-l-4 border-orange-500 pl-3 text-xl font-bold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

const PROHIBITED = [
  "Material protegido por copyright sin autorización o licencia válida.",
  "Contenido que infrinja marcas registradas o induzca a confusión sobre su origen.",
  "Suplantación de la voz, rostro o identidad de personas reales sin consentimiento.",
  "Contenido sexual explícito con menores (CSAM) — reportado de inmediato a las autoridades.",
  "Discurso de odio, incitación a la violencia o acoso.",
  "Malware, virus, scripts ejecutables o archivos diseñados para dañar sistemas.",
  "Contenido fraudulento, esquemas de phishing o suplantación de identidad.",
  "Información personal de terceros sin consentimiento (doxing).",
  "Contenido que viole leyes de exportación, sanciones o regulaciones aplicables.",
  "Formatos de archivo prohibidos (ejecutables, scripts) o archivos corruptos/maliciosos.",
];

export default function ProhibitedContentPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-16 pt-28">
        <div className="mb-10">
          <h1 className="mb-2 text-4xl font-bold">Contenido Prohibido</h1>
          <p className="text-sm text-slate-400">Vigente desde: {EFFECTIVE_DATE} · {COMPANY}</p>
        </div>

        <Section id="rules" title="1. Contenido que no está permitido">
          <p>Está estrictamente prohibido subir, almacenar o distribuir en Boostify cualquiera de los siguientes:</p>
          <ul className="list-disc space-y-2 pl-5">
            {PROHIBITED.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Section>

        <Section id="scanning" title="2. Escaneo automático antes de publicar">
          <p>
            Todo archivo subido se analiza automáticamente antes de publicarse: detección de malware y ejecutables,
            verificación de integridad (archivos corruptos), análisis de metadatos, detección de duplicados por huella
            (SHA-256), validación de formato permitido y de tamaño máximo. Los archivos que no superen el escaneo son
            rechazados o marcados para revisión.
          </p>
        </Section>

        <Section id="enforcement" title="3. Consecuencias">
          <p>
            La publicación de contenido prohibido puede conllevar la retirada inmediata, la acumulación de strikes, la
            suspensión o terminación de la cuenta y, cuando proceda, la notificación a las autoridades competentes.
          </p>
        </Section>

        <p className="text-xs text-slate-500">
          Reportes: <a className="text-orange-400 hover:underline" href={`mailto:${EMAIL_LEGAL}`}>{EMAIL_LEGAL}</a>
        </p>
      </main>
    </div>
  );
}
