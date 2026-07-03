/**
 * Musician Services Terms — legal clause shown at claim/activation time for
 * instrumentalist leads. The musician MUST accept these terms before their
 * services listing becomes active (musicians.is_active = true).
 *
 * Shared between server (claim endpoint, outreach email footer) and client
 * (claim page checkbox + expandable terms).
 */

export const MUSICIAN_TERMS_VERSION = '2026-07-03';

export interface MusicianTermsSection { title: string; body: string; }

const SECTIONS_ES: MusicianTermsSection[] = [
  {
    title: '1. Contratista independiente',
    body:
      'Al activar tu perfil de músico aceptas que actúas como contratista independiente. No existe relación laboral, de agencia, sociedad ni empleo entre tú y Boostify Music. Eres responsable de tus propios impuestos, licencias, permisos y obligaciones legales en tu jurisdicción.',
  },
  {
    title: '2. Boostify como intermediario tecnológico',
    body:
      'Boostify Music es únicamente una plataforma tecnológica que conecta músicos con artistas y clientes. Boostify no es parte de los contratos de servicios entre músicos y clientes, no garantiza volumen de trabajo ni ingresos, y no supervisa ni dirige la prestación de tus servicios.',
  },
  {
    title: '3. Servicios, calidad y entregas',
    body:
      'Eres el único responsable de la veracidad de tu perfil (instrumento, experiencia, tarifas) y de la calidad, puntualidad y entrega de los servicios que ofrezcas. Los acuerdos de alcance, plazos y entregables se pactan directamente entre tú y el cliente.',
  },
  {
    title: '4. Tarifas y comisión de plataforma',
    body:
      'Boostify puede aplicar una comisión de plataforma sobre las transacciones procesadas a través de sus herramientas de pago. Las comisiones vigentes se muestran antes de confirmar cada transacción. Tú fijas tus propias tarifas.',
  },
  {
    title: '5. Moderación y retirada de listados',
    body:
      'Boostify se reserva el derecho de suspender o retirar tu listado en cualquier momento por incumplimiento de estos términos, quejas verificadas de clientes, contenido fraudulento o uso indebido de la plataforma.',
  },
  {
    title: '6. Limitación de responsabilidad',
    body:
      'En la máxima medida permitida por la ley, Boostify Music no será responsable de daños indirectos, incidentales o consecuentes derivados de los servicios prestados entre músicos y clientes, ni de disputas, impagos o incumplimientos entre las partes.',
  },
  {
    title: '7. Origen de tus datos y derecho de supresión',
    body:
      'Tu perfil preliminar se creó a partir de información que tú mismo publicaste en fuentes públicas (por ejemplo, tu biografía pública de Instagram). Puedes solicitar la eliminación completa de tu perfil y tus datos en cualquier momento escribiendo a info@boostifymusic.com o usando el enlace de baja incluido en nuestras comunicaciones.',
  },
];

const SECTIONS_EN: MusicianTermsSection[] = [
  {
    title: '1. Independent contractor',
    body:
      'By activating your musician profile you agree that you act as an independent contractor. No employment, agency, partnership or joint-venture relationship exists between you and Boostify Music. You are responsible for your own taxes, licenses, permits and legal obligations in your jurisdiction.',
  },
  {
    title: '2. Boostify as a technology intermediary',
    body:
      'Boostify Music is solely a technology platform that connects musicians with artists and clients. Boostify is not a party to service contracts between musicians and clients, does not guarantee work volume or income, and does not supervise or direct how you perform your services.',
  },
  {
    title: '3. Services, quality and delivery',
    body:
      'You are solely responsible for the accuracy of your profile (instrument, experience, rates) and for the quality, timeliness and delivery of the services you offer. Scope, deadlines and deliverables are agreed directly between you and the client.',
  },
  {
    title: '4. Rates and platform fee',
    body:
      'Boostify may apply a platform fee on transactions processed through its payment tools. Current fees are displayed before each transaction is confirmed. You set your own rates.',
  },
  {
    title: '5. Moderation and listing removal',
    body:
      'Boostify reserves the right to suspend or remove your listing at any time for breach of these terms, verified client complaints, fraudulent content or misuse of the platform.',
  },
  {
    title: '6. Limitation of liability',
    body:
      'To the maximum extent permitted by law, Boostify Music shall not be liable for indirect, incidental or consequential damages arising from services rendered between musicians and clients, nor for disputes, non-payment or breaches between the parties.',
  },
  {
    title: '7. Source of your data and right to erasure',
    body:
      'Your preliminary profile was created from information you yourself published in public sources (for example, your public Instagram biography). You may request full deletion of your profile and data at any time by writing to info@boostifymusic.com or using the opt-out link included in our communications.',
  },
];

export function musicianTermsSections(lang: 'es' | 'en'): MusicianTermsSection[] {
  return lang === 'es' ? SECTIONS_ES : SECTIONS_EN;
}

/** Plain-text version (email footers, logs). */
export function musicianTermsText(lang: 'es' | 'en'): string {
  return musicianTermsSections(lang)
    .map((s) => `${s.title}\n${s.body}`)
    .join('\n\n');
}

/** One-line summary used next to the acceptance checkbox. */
export function musicianTermsSummary(lang: 'es' | 'en'): string {
  return lang === 'es'
    ? 'Acepto los Términos de Servicios para Músicos: actúo como contratista independiente, Boostify es un intermediario tecnológico con comisión de plataforma, soy responsable de mis servicios y puedo solicitar la eliminación de mis datos en cualquier momento.'
    : 'I accept the Musician Services Terms: I act as an independent contractor, Boostify is a technology intermediary with a platform fee, I am responsible for my services and I can request deletion of my data at any time.';
}
