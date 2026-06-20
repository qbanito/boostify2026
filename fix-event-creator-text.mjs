/**
 * fix-event-creator-text.mjs
 * Repairs corrupted Spanish text in event-creator.tsx caused by double encoding.
 * All non-ASCII chars became U+FFFD (□). Emojis became '?'.
 * Run: node fix-event-creator-text.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, 'client/src/pages/event-creator.tsx');

let content = readFileSync(filePath, 'utf-8');

// Each entry: [corrupted, correct]
// Using \uFFFD for the replacement character (□)
const fixes = [

  // ─── EVENT_TYPES labels ────────────────────────────────────────────────────
  ["'?? Quincea\uFFFDera'", "'🎀 Quinceañera'"],
  ["'?? Boda'",             "'💍 Boda'"],
  ["'?? Premiere'",         "'🎬 Premiere'"],
  ["'?? Corporativo'",      "'🏢 Corporativo'"],
  ["'? Otro'",              "'✨ Otro'"],

  // ─── TIERS desc ────────────────────────────────────────────────────────────
  ["'Photo Booth + Galer\uFFFDa + Memory Book'", "'Photo Booth + Galería + Memory Book'"],

  // ─── ALL_MODULES labels & descs ────────────────────────────────────────────
  ["label: 'Confirmaci\uFFFDn RSVP'",          "label: 'Confirmación RSVP'"],
  ["desc: 'Formulario de asistencia + QR'",    "desc: 'Formulario de asistencia + QR'"], // no accent, skip
  ["label: 'Historia'",                        "label: 'Historia'"],                    // no accent
  ["desc: 'Biograf\uFFFDa del homenajeado'",   "desc: 'Biografía del homenajeado'"],
  ["label: 'Programa del d\uFFFDa'",           "label: 'Programa del día'"],
  ["label: 'C\uFFFDmara + marcos del evento'", "label: 'Cámara + marcos del evento'"],  // wrong - it's Photo Booth desc
  ["desc: 'C\uFFFDmara + marcos del evento'",  "desc: 'Cámara + marcos del evento'"],
  ["desc: 'Dedica una canci\uFFFDn'",          "desc: 'Dedica una canción'"],
  ["desc: 'C\uFFFDdigo de vestimenta visual'", "desc: 'Código de vestimenta visual'"],
  ["desc: 'Direcci\uFFFDn + c\uFFFDmo llegar'","desc: 'Dirección + cómo llegar'"],
  ["label: 'Galer\uFFFDa'",                   "label: 'Galería'"],
  ["desc: 'Galer\uFFFDa colaborativa'",        "desc: 'Galería colaborativa'"],
  ["desc: 'DJ, florer\uFFFDa, catering\uFFFD'","desc: 'DJ, florería, catering…'"],

  // ─── handleSave errors & toasts ────────────────────────────────────────────
  ["'El t\uFFFDtulo es obligatorio'",           "'El título es obligatorio'"],
  ["'\uFFFDEvento creado!'",                    "'¡Evento creado!'"],
  ["'\uFFFDCambios guardados!'",               "'¡Cambios guardados!'"],
  ["'\uFFFDEvento publicado!'",                "'¡Evento publicado!'"],

  // ─── Tabs bar label ────────────────────────────────────────────────────────
  ["label: 'M\uFFFDdulos'",                    "label: 'Módulos'"],

  // ─── Tab General — field labels & placeholders ─────────────────────────────
  ['<Field label="T\uFFFDtulo del evento *">',   '<Field label="Título del evento *">'],
  ['placeholder="Los XV de Sof\uFFFDa"',         'placeholder="Los XV de Sofía"'],
  ['<Field label="Subt\uFFFDtulo">',             '<Field label="Subtítulo">'],
  ['placeholder="Una noche que se convierte en pel\uFFFDcula"', 'placeholder="Una noche que se convierte en película"'],
  ['placeholder="Sof\uFFFDa Ram\uFFFDrez"',      'placeholder="Sofía Ramírez"'],
  ['placeholder="Gran Sal\uFFFDn Imperial, CDMX"','placeholder="Gran Salón Imperial, CDMX"'],
  ['<Field label="URL de la p\uFFFDgina *">',     '<Field label="URL de la página *">'],
  ['<Label>Acceso a la p\uFFFDgina</Label>',      '<Label>Acceso a la página</Label>'],
  ["{ v: 'code', l: 'C\uFFFDdigo',",             "{ v: 'code', l: 'Código',"],
  ['<Field label="C\uFFFDdigo de acceso">',       '<Field label="Código de acceso">'],
  ['placeholder="ej: Sofia2026"',                 'placeholder="ej: Sofia2026"'], // no accent

  // ─── Tab Modules — description ─────────────────────────────────────────────
  ["'Activa/desactiva m\uFFFDdulos y ord\uFFFDnalos. El orden aqu\uFFFD es el orden en la p\uFFFDgina.'",
   "'Activa/desactiva módulos y ordénalos. El orden aquí es el orden en la página.'"],

  // ─── Tab Content — Story ───────────────────────────────────────────────────
  ['<Field label="T\uFFFDtulo de secci\uFFFDn">',  '<Field label="Título de sección">'],
  ['placeholder="La historia de Sof\uFFFDa"',       'placeholder="La historia de Sofía"'],
  ['placeholder="Desde que era peque\uFFFDa, Sof\uFFFDa so\uFFFDaba con este momento..."',
   'placeholder="Desde que era pequeña, Sofía soñaba con este momento..."'],
  ["placeholder='\"La vida es un regalo\uFFFD\"'",  "placeholder='\"La vida es un regalo…\"'"],

  // ─── Tab Content — Schedule ────────────────────────────────────────────────
  ['<ContentSection title="Programa del d\uFFFDa"', '<ContentSection title="Programa del día"'],

  // ─── Tab Content — DressCode ───────────────────────────────────────────────
  ['<Field label="Nota / indicaci\uFFFDn">',         '<Field label="Nota / indicación">'],
  ['placeholder="Blanco exclusivo para la quincea\uFFFDera"', 'placeholder="Blanco exclusivo para la quinceañera"'],

  // ─── Tab Content — Venue ───────────────────────────────────────────────────
  ['<ContentSection title="Lugar / C\uFFFDmo llegar"', '<ContentSection title="Lugar / Cómo llegar"'],
  ['<Field label="Direcci\uFFFDn completa">',           '<Field label="Dirección completa">'],
  ['<Field label="C\uFFFDmo llegar (indicaciones)">',   '<Field label="Cómo llegar (indicaciones)">'],

  // ─── Tab Content — Vendors ─────────────────────────────────────────────────
  ['<ContentSection title="Proveedores / Cr\uFFFDditos"', '<ContentSection title="Proveedores / Créditos"'],
  ['placeholder="DJ Valent\uFFFDn"',                      'placeholder="DJ Valentín"'],

  // ─── Tab Content — empty state ─────────────────────────────────────────────
  ['Activa m\uFFFDdulos de contenido en la pesta\uFFFDa \u201cM\uFFFDdulos\u201d para editarlos aqu\uFFFD.',
   'Activa módulos de contenido en la pestaña "Módulos" para editarlos aquí.'],
  // Also try with ASCII quotes in case curly quotes were lost:
  ['Activa m\uFFFDdulos de contenido en la pesta\uFFFDa "M\uFFFDdulos" para editarlos aqu\uFFFD.',
   'Activa módulos de contenido en la pestaña "Módulos" para editarlos aquí.'],

  // ─── Tab Media ─────────────────────────────────────────────────────────────
  ['Pega URLs de im\uFFFDgenes/videos ya alojados. Soporte para YouTube, Vimeo, Cloudinary, etc.',
   'Pega URLs de imágenes/videos ya alojados. Soporte para YouTube, Vimeo, Cloudinary, etc.'],
  ['placeholder="https://\uFFFD/portada.jpg"',           'placeholder="https://…/portada.jpg"'],
  ['<Field label="Trailer / Video de presentaci\uFFFDn">', '<Field label="Trailer / Video de presentación">'],
  ['placeholder="https://youtube.com/watch?v=\uFFFD"',    'placeholder="https://youtube.com/watch?v=…"'],
  ['<Field label="M\uFFFDsica de fondo (loop ambiental)">', '<Field label="Música de fondo (loop ambiental)">'],
  ['placeholder="https://\uFFFD/ambient.mp3"',             'placeholder="https://…/ambient.mp3"'],

  // ─── Tab Client ────────────────────────────────────────────────────────────
  ['Datos internos del cliente. Solo visibles para ti, no aparecen en la p\uFFFDgina p\uFFFDblica.',
   'Datos internos del cliente. Solo visibles para ti, no aparecen en la página pública.'],
  ['placeholder="Sra. Garc\uFFFDa Mart\uFFFDnez"',   'placeholder="Sra. García Martínez"'],
  ['<Field label="Tel\uFFFDfono / WhatsApp">',         '<Field label="Teléfono / WhatsApp">'],
  ['placeholder="+52 55 \uFFFD"',                      'placeholder="+52 55 …"'],
  ['placeholder="Notas sobre el evento, acuerdos, recordatorios\uFFFD"',
   'placeholder="Notas sobre el evento, acuerdos, recordatorios…"'],
  ["'Guardando\uFFFD'",                                "'Guardando…'"],

  // ─── EventCard ─────────────────────────────────────────────────────────────
  [": '\uFFFD'",                  ": '—'"],            // dateStr fallback
  ["'?? {event.client_name}'",   "'👤 ' + event.client_name"],  // NO — it's JSX
  // The JSX line is: `<p ...>?? {event.client_name}</p>`
  [">?? {event.client_name}</p>",  ">👤 {event.client_name}</p>"],
  ["'? Publicado'",               "'● Publicado'"],
  ["'? Publicar'",                "'○ Publicar'"],

  // ─── EventCreatorPage header ───────────────────────────────────────────────
  ['Mis eventos cinematogr\uFFFDficos',                'Mis eventos cinematográficos'],
  ['Crea y configura p\uFFFDginas de invitaci\uFFFDn de lujo para tus clientes.',
   'Crea y configura páginas de invitación de lujo para tus clientes.'],

  // ─── How it works steps ────────────────────────────────────────────────────
  ["'Llena el formulario: t\uFFFDtulo, fecha, lugar, tipo y plan.'",
   "'Llena el formulario: título, fecha, lugar, tipo y plan.'"],
  ["'Activa m\uFFFDdulos y agrega contenido (historia, schedule, dress code\uFFFD).'",
   "'Activa módulos y agrega contenido (historia, schedule, dress code…).'"],
  ["'Env\uFFFDa el link /event/tu-evento a tus invitados.'",
   "'Envía el link /event/tu-evento a tus invitados.'"],
  ["'RSVP, Photo Booth, Soundtrack, Galer\uFFFDa \uFFFD todo en un lugar.'",
   "'RSVP, Photo Booth, Soundtrack, Galería – todo en un lugar.'"],

  // ─── EventCreatorPage empty state & demo hint ──────────────────────────────
  ["'A\uFFFDn no tienes eventos creados.'",            "'Aún no tienes eventos creados.'"],
  ['Ver p\uFFFDgina de demo',                          'Ver página de demo'],
  ['Mira c\uFFFDmo se ve la experiencia completa para los invitados.',
   'Mira cómo se ve la experiencia completa para los invitados.'],

  // ─── Cómo funciona title (check both possible states) ─────────────────────
  ['\uFFFD\uFFFDC\uFFFDmo funciona?',  '¿Cómo funciona?'],
  ['\uFFFDC\uFFFDmo funciona?',         '¿Cómo funciona?'],
  ['C\uFFFDmo funciona?',               '¿Cómo funciona?'],
];

let count = 0;
for (const [from, to] of fixes) {
  if (content.includes(from)) {
    content = content.split(from).join(to);
    console.log(`✅  Fixed: ${from.slice(0,50).replace(/\uFFFD/g,'□')}`);
    count++;
  }
}

writeFileSync(filePath, content, 'utf-8');
console.log(`\n🎬 Done! Applied ${count} fixes to event-creator.tsx`);

// Verify no □ remain
const remaining = (content.match(/\uFFFD/g) || []).length;
if (remaining > 0) {
  console.warn(`⚠️  ${remaining} replacement characters (□) still remain in the file.`);
  // Show context for each remaining
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('\uFFFD')) {
      console.warn(`   Line ${i+1}: ${line.trim().slice(0, 80)}`);
    }
  });
} else {
  console.log('✅  No □ characters remaining!');
}
