/**
 * Bilingual dictionary for the Boostify Video Concepts premium landing page.
 *
 * Mirrors the shape of `videoservice-i18n.ts`: every key resolves to
 * `{ es, en }`. Use the `t()` helper with the active `Lang`.
 */

export type Lang = 'es' | 'en';

const dict = {
  // ── Header / language toggle ──────────────────────────────────
  langToggle: { es: 'English', en: 'Español' },
  brandTag: { es: 'Boostify Video Concepts', en: 'Boostify Video Concepts' },

  // ── Hero ──────────────────────────────────────────────────────
  heroEyebrow: {
    es: 'Películas de evento de autor — desde $5,999',
    en: 'Signature event films — from $5,999',
  },
  heroTitle: {
    es: 'Convierte tu evento en una película de autor',
    en: 'Turn your event into a signature film',
  },
  heroSub: {
    es: 'Dirección creativa, narrativa cinematográfica, edición de alto nivel, color, música, galería privada y entregables premium listos para compartir.',
    en: 'Creative direction, cinematic storytelling, high-end editing, colour, music, a private gallery and premium deliverables ready to share.',
  },
  heroPrice: {
    es: 'Proyectos premium desde $5,999',
    en: 'Premium projects from $5,999',
  },
  heroCtaPrimary: {
    es: 'Empezar mi proyecto',
    en: 'Start my project',
  },
  heroCtaSecondary: {
    es: 'Ver experiencias premium',
    en: 'See premium experiences',
  },
  heroSlide1: { es: 'Bodas que se sienten películas', en: 'Weddings that feel like films' },
  heroSlide2: { es: 'Quinceañeras de portada editorial', en: 'Editorial-cover quinceañeras' },
  heroSlide3: { es: 'Eventos corporativos premium', en: 'Premium corporate events' },
  heroSlide4: { es: 'Memorias que se vuelven legado', en: 'Memories that become legacy' },
  heroScroll: { es: 'Desliza para descubrir', en: 'Scroll to explore' },

  // ── What is it ────────────────────────────────────────────────
  whatTitle: {
    es: '¿Qué es Boostify Video Concepts?',
    en: 'What is Boostify Video Concepts?',
  },
  whatBody: {
    es: 'Cada evento tiene una historia. La convertimos en una experiencia cinematográfica con dirección creativa, edición premium, color editorial, música y una galería privada interactiva.',
    en: 'Every event has a story. We turn it into a cinematic experience with creative direction, premium editing, editorial colour, music and a private interactive gallery.',
  },
  whatBullet1Title: { es: 'Dirección creativa', en: 'Creative direction' },
  whatBullet1Desc: {
    es: 'Concepto, mood, paleta y narrativa diseñados para tu evento.',
    en: 'Concept, mood, palette and narrative crafted for your event.',
  },
  whatBullet2Title: { es: 'Producción de autor', en: 'Signature production' },
  whatBullet2Desc: {
    es: 'Cobertura, edición, color y sonido al nivel de un largometraje.',
    en: 'Coverage, editing, colour and sound at feature-film level.',
  },
  whatBullet3Title: { es: 'Entrega privada', en: 'Private delivery' },
  whatBullet3Desc: {
    es: 'Galería privada interactiva para ver, aprobar y compartir.',
    en: 'Interactive private gallery to view, approve and share.',
  },

  // ── Categories ────────────────────────────────────────────────
  catsTitle: {
    es: 'Cuatro experiencias cinematográficas',
    en: 'Four cinematic experiences',
  },
  cat1Title: { es: 'Quinceañeras', en: 'Quinceañeras' },
  cat1Desc: {
    es: 'Convertimos una quinceañera en una película de coming-of-age con visuales de lujo, narrativa emocional y clips listos para redes.',
    en: 'We transform a quinceañera into a cinematic coming-of-age film with luxury visuals, emotional storytelling and social-ready clips.',
  },
  cat2Title: { es: 'Bodas', en: 'Weddings' },
  cat2Desc: {
    es: 'Una película de boda elegante con ritmo emocional, visuales románticos, trailers, votos, reels y galería privada.',
    en: 'An elegant wedding film with emotional pacing, romantic visuals, trailers, vows, reels and a private gallery.',
  },
  cat3Title: { es: 'Eventos corporativos', en: 'Corporate events' },
  cat3Desc: {
    es: 'Eventos corporativos como activos premium para LinkedIn, prensa, ventas, inversores, cultura interna y posicionamiento ejecutivo.',
    en: 'Corporate events as premium brand assets for LinkedIn, press, sales, investors, internal culture and executive positioning.',
  },
  cat4Title: { es: 'Memorias / Legacy films', en: 'Memories / Legacy films' },
  cat4Desc: {
    es: 'Recuerdos familiares, fotos antiguas y momentos emocionales convertidos en una historia visual atemporal.',
    en: 'Family memories, old photos and emotional moments turned into a timeless visual story.',
  },
  cat5Title: { es: 'Boostify Event Premiere', en: 'Boostify Event Premiere' },
  cat5Desc: {
    es: 'Landing page cinematográfica interactiva para tu evento: RSVP digital, photo booth, galería colaborativa, dedicatorias musicales y libro de recuerdos — todo en una experiencia standalone exclusiva.',
    en: 'Interactive cinematic landing page for your event: digital RSVP, photo booth, collaborative gallery, song dedications and memory book — all in an exclusive standalone experience.',
  },

  // ── How it works ──────────────────────────────────────────────
  howTitle: { es: 'Cómo funciona', en: 'How it works' },
  step1Title: { es: 'Cuéntanos tu evento', en: 'Tell us about your event' },
  step1Desc: {
    es: 'Fecha, lugar, número de invitados, momentos clave y personas importantes.',
    en: 'Date, venue, guest count, key moments and important people.',
  },
  step2Title: { es: 'Elige tu estilo', en: 'Choose your style' },
  step2Desc: {
    es: 'Estilo visual, mood, paleta, música y tipo de narrativa.',
    en: 'Visual style, mood, palette, music and story type.',
  },
  step3Title: { es: 'Diseñamos el concepto', en: 'We design the concept' },
  step3Desc: {
    es: 'Dirección creativa entrega un guion visual, paleta y treatment.',
    en: 'Creative direction delivers a visual script, palette and treatment.',
  },
  step4Title: { es: 'Producción premium', en: 'Premium production' },
  step4Desc: {
    es: 'Cobertura del evento, edición, color editorial y diseño sonoro.',
    en: 'Event coverage, editing, editorial colour and sound design.',
  },
  step5Title: { es: 'Revisión y aprobación', en: 'Review and approval' },
  step5Desc: {
    es: 'Dos rondas de revisiones premium dentro de tu galería privada.',
    en: 'Two premium revision rounds inside your private gallery.',
  },
  step6Title: { es: 'Galería privada del evento', en: 'Private event gallery' },
  step6Desc: {
    es: 'Galería privada para ver, comentar, aprobar, descargar y compartir.',
    en: 'Private gallery to view, comment, approve, download and share.',
  },

  // ── Creative team ─────────────────────────────────────────────
  agentsTitle: { es: 'Equipo creativo dedicado', en: 'Dedicated creative team' },
  agentsSub: {
    es: 'Doce roles especializados que trabajan tu evento como una producción de autor.',
    en: 'Twelve specialised roles working your event like a signature production.',
  },

  // ── Deliverables ──────────────────────────────────────────────
  deliverablesTitle: { es: 'Entregables premium', en: 'Premium deliverables' },

  // ── Signature Experience (value-added universe) ───────────────
  sigEyebrow: { es: 'Más allá del video', en: 'Beyond video' },
  sigTitle: {
    es: 'Una experiencia completa alrededor de tu evento',
    en: 'A complete experience built around your event',
  },
  sigSub: {
    es: 'No entregamos solo una película. Construimos un universo coleccionable: libro editorial, recuerdos físicos, invitaciones electrónicas, sesión musical original y una app interactiva donde tus invitados reviven cada momento.',
    en: 'We don\'t just deliver a film. We build a collectible universe: editorial book, physical memorabilia, electronic invitations, an original music session, and an interactive app where guests relive every moment.',
  },

  sigBookTitle: { es: 'Libro editorial del evento', en: 'Editorial event book' },
  sigBookDesc: {
    es: 'Un libro impreso de tapa dura, diseñado como revista de portada: fotografía editorial, tipografía premium y narrativa por capítulos. Una pieza de colección que pasará entre generaciones.',
    en: 'A hardcover printed book designed like a cover magazine: editorial photography, premium typography and chapter-based narrative. A collectible piece passed between generations.',
  },

  sigStoreTitle: { es: 'Tienda de recuerdos del evento', en: 'Event memorabilia store' },
  sigStoreDesc: {
    es: 'Cada invitado recibe acceso a una tienda privada con productos exclusivos del evento: prints, tazas, sudaderas, posters y álbumes diseñados con la identidad de tu día.',
    en: 'Every guest gets access to a private store with exclusive event products: prints, mugs, hoodies, posters and albums designed with your day\'s identity.',
  },

  sigInviteTitle: { es: 'Invitaciones electrónicas premium', en: 'Premium electronic invitations' },
  sigInviteDesc: {
    es: 'Invitaciones digitales animadas con video, música y RSVP integrado. Cada invitado recibe un pase personalizado con su nombre, asiento y código de acceso a la galería.',
    en: 'Animated digital invitations with video, music and integrated RSVP. Each guest receives a personalised pass with their name, seat and gallery access code.',
  },

  sigFilmTitle: { es: 'Película cinematográfica', en: 'Cinematic feature film' },
  sigFilmDesc: {
    es: 'Una película donde participan todos los invitados como protagonistas. Estructura narrativa, escenas dirigidas, planos cinematográficos y una historia que merece pantalla grande.',
    en: 'A film where every guest appears as a lead character. Narrative structure, directed scenes, cinematic shots and a story that deserves the big screen.',
  },

  sigAppTitle: { es: 'App interactiva del evento', en: 'Interactive event app' },
  sigAppDesc: {
    es: 'Tu evento vive en una app. Los invitados ven la película, suben momentos, descargan fotos, exploran la galería privada y crean videos interactivos personalizados con tu identidad.',
    en: 'Your event lives inside an app. Guests watch the film, upload moments, download photos, explore the private gallery and create personalised interactive videos with your identity.',
  },

  sigMusicTitle: { es: 'Sesión musical original', en: 'Original music session' },
  sigMusicDesc: {
    es: 'Componemos una canción original para tu evento donde se mencionan los invitados por nombre. Una pieza única, grabada en estudio, que sonará como banda sonora durante toda la película.',
    en: 'We compose an original song for your event with your guests mentioned by name. A unique piece, studio-recorded, used as the soundtrack throughout the film.',
  },

  // ── Why different ────────────────────────────────────────────
  whyEyebrow: { es: 'Por qué somos diferentes', en: 'Why we\'re different' },
  whyTitle: {
    es: 'Hacemos lo que ningún videógrafo tradicional hace',
    en: 'We do what no traditional videographer does',
  },
  whySub: {
    es: 'Mientras otros entregan un video, nosotros producimos una experiencia editorial completa con dirección de cine, diseño, música original, productos físicos y una app interactiva.',
    en: 'While others deliver a video, we produce a complete editorial experience with film direction, design, original music, physical products and an interactive app.',
  },

  whyTradTitle: { es: 'Videografía tradicional', en: 'Traditional videography' },
  whyTrad1: { es: 'Un video plano del evento', en: 'A flat event video' },
  whyTrad2: { es: 'Música genérica de stock', en: 'Generic stock music' },
  whyTrad3: { es: 'Solo entregables digitales', en: 'Digital deliverables only' },
  whyTrad4: { es: 'Sin participación de invitados', en: 'No guest participation' },
  whyTrad5: { es: 'Crew local con equipo básico', en: 'Local crew, basic gear' },
  whyTrad6: { es: 'Edición plantilla repetida', en: 'Repeated template editing' },

  whyUsTitle: { es: 'Boostify Video Concepts', en: 'Boostify Video Concepts' },
  whyUs1: { es: 'Película de autor con narrativa', en: 'Signature film with narrative' },
  whyUs2: { es: 'Música original con tus invitados', en: 'Original music with your guests' },
  whyUs3: { es: 'Libro, tienda, app + invitaciones', en: 'Book, store, app + invitations' },
  whyUs4: { es: 'Todos los invitados protagonizan', en: 'Every guest is a lead character' },
  whyUs5: { es: 'Equipo dedicado que viaja al mundo entero', en: 'Dedicated crew travelling worldwide' },
  whyUs6: { es: 'Dirección creativa única por evento', en: 'Unique creative direction per event' },

  // ── World tour / travel ──────────────────────────────────────
  worldEyebrow: { es: 'Filmamos en cualquier parte del mundo', en: 'We film anywhere in the world' },
  worldTitle: {
    es: 'Viajamos a tu evento, donde sea que esté',
    en: 'We travel to your event, wherever it is',
  },
  worldSub: {
    es: 'Equipo cinematográfico especializado, logística internacional, locaciones únicas. Desde una hacienda en México hasta un castillo en Europa o una playa privada en Asia: tu evento merece producción de cine.',
    en: 'Specialised cinema crew, international logistics, unique locations. From a Mexican hacienda to a European castle or a private Asian beach: your event deserves cinema-grade production.',
  },
  worldStat1Num: { es: '4 continentes', en: '4 continents' },
  worldStat1Lbl: { es: 'donde hemos filmado', en: 'where we\'ve filmed' },
  worldStat2Num: { es: '12 personas', en: '12 people' },
  worldStat2Lbl: { es: 'crew dedicado por evento', en: 'dedicated crew per event' },
  worldStat3Num: { es: '48h', en: '48h' },
  worldStat3Lbl: { es: 'tiempo de despliegue global', en: 'global deployment time' },
  worldStat4Num: { es: '100%', en: '100%' },
  worldStat4Lbl: { es: 'logística incluida', en: 'logistics included' },

  // ── Packages ──────────────────────────────────────────────────
  pkgTitle: { es: 'Rango de inversión', en: 'Investment range' },
  pkgSub: {
    es: 'Cada proyecto se cotiza por alcance creativo, complejidad de producción y nivel de entregables.',
    en: 'Each project is quoted by creative scope, production complexity and deliverable level.',
  },
  pkg1Name: { es: 'Cinematic Concept Experience', en: 'Cinematic Concept Experience' },
  pkg1From: { es: 'Desde $5,999', en: 'From $5,999' },
  pkg2Name: { es: 'Signature Event Film', en: 'Signature Event Film' },
  pkg2From: { es: 'Desde $10,000+', en: 'From $10,000+' },
  pkg3Name: { es: 'Luxury Event Film', en: 'Luxury Event Film' },
  pkg3From: { es: 'Desde $25,000+', en: 'From $25,000+' },
  pkgNote: {
    es: 'Cotizaciones superiores a $25,000 disponibles según producción, locación, equipo, narrativa, tiempo de cobertura y volumen de entregables.',
    en: 'Quotes above $25,000 available based on production, location, crew, narrative, coverage time and deliverable volume.',
  },

  // ── Multi-step intake ─────────────────────────────────────────
  formTitle: { es: 'Diseña tu concepto', en: 'Design your concept' },
  formSub: {
    es: 'Un director creativo te contactará en menos de 24 horas.',
    en: 'A creative director will reach out within 24 hours.',
  },
  // step labels
  stepEventLabel: { es: 'Evento', en: 'Event' },
  stepStyleLabel: { es: 'Estilo', en: 'Style' },
  stepDetailsLabel: { es: 'Detalles', en: 'Details' },
  stepBudgetLabel: { es: 'Inversión', en: 'Budget' },
  stepContactLabel: { es: 'Contacto', en: 'Contact' },
  // step 1 — event type
  s1Title: { es: '¿Qué tipo de evento celebramos?', en: 'What event are we crafting?' },
  s1Sub: { es: 'Toca la categoría que mejor describa tu proyecto.', en: 'Tap the category that fits your project best.' },
  evWedding: { es: 'Boda', en: 'Wedding' },
  evWeddingDesc: { es: 'Película romántica de autor', en: 'Signature romantic film' },
  evQuince: { es: 'Quinceañera', en: 'Quinceañera' },
  evQuinceDesc: { es: 'Coming-of-age cinematográfico', en: 'Cinematic coming-of-age' },
  evCorporate: { es: 'Corporativo', en: 'Corporate' },
  evCorporateDesc: { es: 'Branding ejecutivo premium', en: 'Premium executive branding' },
  evLegacy: { es: 'Legacy / Memorias', en: 'Legacy / Memories' },
  evLegacyDesc: { es: 'Historia familiar atemporal', en: 'Timeless family story' },
  evOther: { es: 'Otro', en: 'Other' },
  evOtherDesc: { es: 'Cuéntanos tu visión', en: 'Tell us your vision' },
  // step 2 — style + music
  s2Title: { es: 'Elige el alma visual', en: 'Pick the visual soul' },
  s2Sub: { es: 'Selecciona el mood que mejor te represente.', en: 'Pick the mood that best represents you.' },
  styleEditorial: { es: 'Editorial', en: 'Editorial' },
  styleRomantic: { es: 'Romántico', en: 'Romantic' },
  styleCinematic: { es: 'Cinematográfico', en: 'Cinematic' },
  styleVintage: { es: 'Vintage / Film', en: 'Vintage / Film' },
  styleLuxury: { es: 'Lujo minimal', en: 'Minimal luxury' },
  styleVibrant: { es: 'Vibrante', en: 'Vibrant' },
  styleModern: { es: 'Moderno', en: 'Modern' },
  styleDramatic: { es: 'Dramático', en: 'Dramatic' },
  musicLabel: { es: 'Dirección musical preferida', en: 'Preferred music direction' },
  musicPh: { es: 'Ej: bandas sonoras épicas, indie acústico, latin pop, lo-fi…', en: 'E.g. epic scores, acoustic indie, latin pop, lo-fi…' },
  // step 3 — details
  s3Title: { es: 'Detalles del evento', en: 'Event details' },
  s3Sub: { es: 'Esto nos ayuda a planear cobertura y narrativa.', en: 'This helps us plan coverage and narrative.' },
  eventDateLabel: { es: 'Fecha del evento', en: 'Event date' },
  eventLocationLabel: { es: 'Lugar', en: 'Location' },
  eventLocationPh: { es: 'Ciudad, país o nombre del venue', en: 'City, country or venue name' },
  guestsLabel: { es: 'Aprox. invitados', en: 'Approx. guests' },
  emotionsLabel: { es: 'Emociones que quieres transmitir', en: 'Emotions you want to convey' },
  emoJoy: { es: 'Alegría', en: 'Joy' },
  emoLove: { es: 'Amor', en: 'Love' },
  emoEpic: { es: 'Épico', en: 'Epic' },
  emoNostalgia: { es: 'Nostalgia', en: 'Nostalgia' },
  emoElegance: { es: 'Elegancia', en: 'Elegance' },
  emoIntimate: { es: 'Íntimo', en: 'Intimate' },
  emoCelebration: { es: 'Celebración', en: 'Celebration' },
  emoFamily: { es: 'Familia', en: 'Family' },
  notesLabel: { es: 'Comentarios adicionales', en: 'Additional notes' },
  notesPh: { es: 'Personas importantes, momentos imperdibles, referencias…', en: 'Important people, must-have moments, references…' },
  // step 4 — budget
  s4Title: { es: '¿Qué nivel de inversión te acomoda?', en: 'What investment level works for you?' },
  s4Sub: { es: 'Es un rango aproximado. La cotización final se afina contigo.', en: 'This is an approximate range. The final quote is fine-tuned with you.' },
  bud1: { es: '$5,999 – $9,999', en: '$5,999 – $9,999' },
  bud1Desc: { es: 'Cinematic Concept Experience', en: 'Cinematic Concept Experience' },
  bud2: { es: '$10,000 – $15,000', en: '$10,000 – $15,000' },
  bud2Desc: { es: 'Signature Event Film', en: 'Signature Event Film' },
  bud3: { es: '$15,000 – $25,000', en: '$15,000 – $25,000' },
  bud3Desc: { es: 'Signature Premium', en: 'Signature Premium' },
  bud4: { es: '$25,000+', en: '$25,000+' },
  bud4Desc: { es: 'Luxury Event Film', en: 'Luxury Event Film' },
  // step 5 — contact
  s5Title: { es: 'Tus datos de contacto', en: 'Your contact details' },
  s5Sub: { es: 'Un director creativo te escribirá personalmente.', en: 'A creative director will personally reach out.' },
  formName: { es: 'Nombre completo', en: 'Full name' },
  formEmail: { es: 'Email', en: 'Email' },
  formPhone: { es: 'Teléfono / WhatsApp', en: 'Phone / WhatsApp' },
  formNamePh: { es: 'María Rodríguez', en: 'Maria Rodriguez' },
  formEmailPh: { es: 'tu@email.com', en: 'you@email.com' },
  formPhonePh: { es: '+1 555 000 0000', en: '+1 555 000 0000' },
  formInstagram: { es: 'Instagram (opcional)', en: 'Instagram (optional)' },
  formInstagramPh: { es: '@usuario', en: '@username' },
  termsLabel: {
    es: 'Acepto que un director creativo de Boostify se ponga en contacto conmigo.',
    en: 'I agree that a Boostify creative director may contact me.',
  },
  // ── Step 6 — Service contract (review + electronic signature) ─
  stepContractLabel: { es: 'Contrato', en: 'Contract' },
  s6Title: { es: 'Contrato de servicio', en: 'Service agreement' },
  s6Sub: {
    es: 'Lee con calma cada cláusula y firma electrónicamente. Solo después de firmar pasarás al pago del depósito (50 %).',
    en: 'Read every clause carefully and sign electronically. Only after signing will you proceed to the 50 % booking deposit.',
  },
  contractVersionLabel: { es: 'Versión', en: 'Version' },
  contractHeader: {
    es: 'CONTRATO DE PRESTACIÓN DE SERVICIOS DE PRODUCCIÓN AUDIOVISUAL',
    en: 'AUDIOVISUAL PRODUCTION SERVICES AGREEMENT',
  },
  contractPartiesTitle: { es: '1. Partes', en: '1. Parties' },
  contractPartiesBody: {
    es: 'Este contrato se celebra entre BOOSTIFY MUSIC LLC ("Boostify", "el Productor") y el Cliente identificado en el formulario de contratación de este mismo proyecto. Al firmar electrónicamente, el Cliente declara que es mayor de edad y tiene capacidad legal para contratar.',
    en: 'This agreement is entered into between BOOSTIFY MUSIC LLC ("Boostify", "the Producer") and the Client identified in this project intake form. By signing electronically, the Client declares to be of legal age and to have full legal capacity to contract.',
  },
  contractScopeTitle: { es: '2. Objeto del contrato', en: '2. Scope of services' },
  contractScopeBody: {
    es: 'Boostify producirá una película cinematográfica del evento descrito en el formulario, incluyendo dirección creativa, guion, plan de rodaje, producción audiovisual, edición, color, sonido, galería privada y los entregables del paquete contratado. El alcance específico se confirmará en el master concept JSON generado tras el depósito.',
    en: 'Boostify will produce a cinematic film of the event described in the intake form, including creative direction, script, shooting plan, audiovisual production, editing, colour, sound, private gallery and the deliverables of the selected package. The specific scope will be confirmed in the master concept JSON generated after the deposit.',
  },
  contractFeesTitle: { es: '3. Honorarios y forma de pago', en: '3. Fees and payment schedule' },
  contractFeesBody: {
    es: 'El precio total del proyecto se acuerda según el rango de inversión seleccionado y se confirma por escrito antes de la primera factura. El pago se divide en DOS hitos:',
    en: 'The total project price is agreed based on the selected investment range and confirmed in writing before the first invoice. Payment is split into TWO milestones:',
  },
  contractFee1: {
    es: '50 % de depósito al firmar este contrato. Este pago reserva el equipo, la fecha de rodaje y desbloquea el master concept JSON con guion, blueprint y demo privado.',
    en: '50 % deposit upon signing this contract. This payment reserves the crew, locks the filming date and unlocks the master concept JSON with script, blueprint and private demo.',
  },
  contractFee2: {
    es: '50 % restante el día del rodaje, antes de comenzar a grabar. Sin la confirmación de este pago, el equipo no iniciará la producción.',
    en: '50 % remaining on the filming day, before any recording begins. Without confirmation of this payment, the crew will not start production.',
  },
  contractFeeNote: {
    es: 'Los pagos se procesan en USD a través de Stripe. Los importes incluyen los servicios contratados; los gastos extraordinarios (viajes fuera del área base, locaciones con tarifa, permisos especiales, horas extra) se cotizan aparte y se autorizan por escrito.',
    en: 'Payments are processed in USD through Stripe. Amounts cover the contracted services; out-of-pocket expenses (travel beyond the base area, paid locations, special permits, overtime) are quoted separately and approved in writing.',
  },
  contractDeliverablesTitle: { es: '4. Entregables', en: '4. Deliverables' },
  contractDeliverablesBody: {
    es: 'Los entregables incluyen, según el paquete: película principal cinematográfica, trailer vertical y horizontal, libro editorial digital, sesión musical original, invitaciones electrónicas, tienda privada de recuerdos y galería interactiva. Los formatos finales se entregan en una galería privada con descarga en alta resolución.',
    en: 'Deliverables include, depending on the package: cinematic main film, vertical and horizontal trailers, digital editorial book, original music session, electronic invitations, private memorabilia store and interactive gallery. Final formats are delivered in a private gallery with high-resolution download.',
  },
  contractTimelineTitle: { es: '5. Plazos', en: '5. Timeline' },
  contractTimelineBody: {
    es: 'La pre-producción comienza al recibir el 50 % de depósito. La entrega final se realiza entre 3 y 8 semanas tras el rodaje, según el alcance. Los retrasos imputables al Cliente (entrega de referencias, aprobaciones, accesos a locación) extienden los plazos en igual medida.',
    en: 'Pre-production begins upon receipt of the 50 % deposit. Final delivery is made within 3 to 8 weeks after the shoot, depending on scope. Delays attributable to the Client (delivery of references, approvals, location access) extend the timeline accordingly.',
  },
  contractRevisionsTitle: { es: '6. Revisiones', en: '6. Revisions' },
  contractRevisionsBody: {
    es: 'El paquete incluye dos rondas de revisión sobre el corte aprobado. Cambios estructurales (nuevo guion, nueva locación, nuevo ritmo musical) se cotizan aparte como trabajo adicional.',
    en: 'The package includes two rounds of revisions on the approved cut. Structural changes (new script, new location, new musical pacing) are quoted separately as additional work.',
  },
  contractCancellationTitle: { es: '7. Cancelación y reagendamiento', en: '7. Cancellation and rescheduling' },
  contractCancellationBody: {
    es: 'El depósito del 50 % es no reembolsable, ya que cubre la reserva del equipo y el bloqueo de la fecha. Si el Cliente cancela, podrá reagendar la fecha por una sola vez, sin costo adicional, dentro de los 12 meses siguientes y sujeto a disponibilidad. Una segunda reagenda implica un cargo administrativo del 15 % sobre el saldo. Si Boostify cancela por causa imputable a sí mismo, devolverá el 100 % de lo recibido.',
    en: 'The 50 % deposit is non-refundable, as it covers crew booking and date lock. If the Client cancels, the date may be rescheduled once at no additional cost within the following 12 months and subject to availability. A second reschedule incurs an administrative fee of 15 % over the outstanding balance. If Boostify cancels due to its own fault, 100 % of amounts received will be refunded.',
  },
  contractIpTitle: { es: '8. Propiedad intelectual y uso del material', en: '8. Intellectual property and usage rights' },
  contractIpBody: {
    es: 'El material final entregado es de uso personal del Cliente y de su familia/empresa, con derechos perpetuos para uso privado y redes sociales personales. Boostify conserva la propiedad del material en bruto y de la canción original, y mantiene una licencia para usar fragmentos en su portafolio, redes y materiales de marketing salvo solicitud expresa por escrito en contrario.',
    en: 'The final delivered material is for personal use by the Client and their family/company, with perpetual rights for private use and personal social media. Boostify retains ownership of the raw material and the original song, and keeps a license to use excerpts in its portfolio, social media and marketing materials unless expressly waived in writing.',
  },
  contractPrivacyTitle: { es: '9. Privacidad de invitados', en: '9. Guest privacy' },
  contractPrivacyBody: {
    es: 'El Cliente garantiza haber informado a los invitados que serán grabados durante el evento y asume la responsabilidad sobre dichas autorizaciones. Boostify protegerá la galería privada con token y solo el Cliente podrá compartir el enlace.',
    en: 'The Client warrants having informed the guests that they will be recorded during the event and assumes responsibility for those authorizations. Boostify will protect the private gallery with a token and only the Client may share the link.',
  },
  contractForceMajeureTitle: { es: '10. Fuerza mayor', en: '10. Force majeure' },
  contractForceMajeureBody: {
    es: 'Ninguna parte será responsable por incumplimientos derivados de fuerza mayor (desastres naturales, pandemias, restricciones gubernamentales, cancelación del venue). En tal caso se reagenda sin penalización dentro de los 12 meses siguientes.',
    en: 'Neither party will be liable for breaches caused by force majeure (natural disasters, pandemics, government restrictions, venue cancellation). In such cases the booking is rescheduled without penalty within the following 12 months.',
  },
  contractLiabilityTitle: { es: '11. Limitación de responsabilidad', en: '11. Limitation of liability' },
  contractLiabilityBody: {
    es: 'La responsabilidad máxima de Boostify, en cualquier caso, no excederá los montos efectivamente pagados por el Cliente bajo este contrato. Boostify no responde por daños indirectos, lucro cesante o daños emocionales.',
    en: "Boostify's maximum liability under any circumstance will not exceed the amounts actually paid by the Client under this contract. Boostify is not liable for indirect damages, lost profits or emotional distress.",
  },
  contractConfidentialityTitle: { es: '12. Confidencialidad', en: '12. Confidentiality' },
  contractConfidentialityBody: {
    es: 'Ambas partes se comprometen a tratar como confidencial la información personal, financiera y creativa intercambiada durante el proyecto, salvo lo necesario para ejecutarlo o cumplir obligaciones legales.',
    en: 'Both parties agree to treat as confidential the personal, financial and creative information exchanged during the project, except as necessary to perform it or comply with legal obligations.',
  },
  contractCommsTitle: { es: '13. Comunicaciones electrónicas', en: '13. Electronic communications' },
  contractCommsBody: {
    es: 'El Cliente acepta recibir notificaciones del proyecto y aprobar versiones por correo electrónico, WhatsApp o el panel privado del proyecto. Las aprobaciones por estos medios tienen plena validez.',
    en: 'The Client accepts receiving project notifications and approving versions via email, WhatsApp or the private project dashboard. Approvals through these channels have full legal validity.',
  },
  contractLawTitle: { es: '14. Ley aplicable y jurisdicción', en: '14. Governing law and jurisdiction' },
  contractLawBody: {
    es: 'Este contrato se rige por las leyes del Estado de Florida, EE. UU. Cualquier controversia será resuelta ante los tribunales competentes de dicho estado, salvo acuerdo de mediación previa.',
    en: 'This agreement is governed by the laws of the State of Florida, USA. Any dispute will be resolved before the competent courts of that state, subject to prior mediation if mutually agreed.',
  },
  contractSignatureTitle: { es: '15. Firma electrónica', en: '15. Electronic signature' },
  contractSignatureBody: {
    es: 'Al escribir tu nombre completo y marcar la casilla de aceptación, confirmas que has leído y aceptas todas las cláusulas anteriores. Tu firma quedará registrada con fecha, hora e IP a efectos de prueba.',
    en: 'By typing your full legal name and checking the acceptance box, you confirm that you have read and accept all clauses above. Your signature will be recorded with date, time and IP for evidentiary purposes.',
  },
  contractSignatureLabel: { es: 'Firma (escribe tu nombre legal completo)', en: 'Signature (type your full legal name)' },
  contractSignaturePh: { es: 'Ej. María del Carmen Rodríguez', en: 'E.g. Maria del Carmen Rodriguez' },
  contractAcceptLabel: {
    es: 'He leído y acepto íntegramente el Contrato de Prestación de Servicios de Producción Audiovisual.',
    en: 'I have read and fully accept the Audiovisual Production Services Agreement.',
  },
  contractDownloadHint: {
    es: 'Recibirás una copia firmada por correo electrónico junto con la confirmación del depósito.',
    en: 'You will receive a signed copy by email together with the deposit confirmation.',
  },
  contractSummaryTitle: { es: 'Resumen económico', en: 'Financial summary' },
  contractSummaryTotal: { es: 'Inversión total estimada', en: 'Estimated total investment' },
  contractSummaryDeposit: { es: 'Depósito al firmar (50 %)', en: 'Deposit upon signing (50 %)' },
  contractSummaryFinal: { es: 'Saldo el día del rodaje (50 %)', en: 'Balance on filming day (50 %)' },
  contractSummaryDisclaimer: {
    es: 'Importes calculados sobre el rango seleccionado. La cifra exacta se confirma por escrito antes de cada factura.',
    en: 'Amounts calculated on the selected range. The exact figure is confirmed in writing before each invoice.',
  },
  // ── Post-deposit storyboard workflow (interactive 10-scene generator) ──
  sbCtaTitle: { es: 'Crea tu storyboard cinematográfico', en: 'Build your cinematic storyboard' },
  sbCtaSub: {
    es: 'Sube tus fotos y cuéntanos los detalles. Generamos un guion interactivo de 10 escenas con imágenes premium creadas por IA — totalmente editable.',
    en: 'Upload your photos and share the details. We generate an interactive 10-scene script with premium AI imagery — fully editable.',
  },
  sbCtaBtn: { es: 'Empezar mi storyboard', en: 'Start my storyboard' },
  sbCtaContinue: { es: 'Continuar storyboard', en: 'Continue storyboard' },
  sbCtaView: { es: 'Ver storyboard', en: 'View storyboard' },
  sbFormTitle: { es: 'Cuéntanos más sobre tu historia', en: 'Tell us more about your story' },
  sbFormSub: {
    es: 'Estos detalles alimentan a nuestro director creativo IA para generar un guion único de 10 escenas.',
    en: 'These details feed our AI creative director to generate a unique 10-scene script.',
  },
  sbStep1: { es: '1. Sube tus fotos de referencia', en: '1. Upload your reference photos' },
  sbStep1Sub: {
    es: 'Mínimo 1 foto, máximo 12. Las usamos como base creativa con gpt-image-2 en modo edit.',
    en: 'Minimum 1 photo, maximum 12. We use them as creative base with gpt-image-2 in edit mode.',
  },
  sbUploadDrop: { es: 'Arrastra fotos o haz clic', en: 'Drop photos or click to upload' },
  sbUploadHint: { es: 'JPG / PNG / HEIC · hasta 100 MB cada una', en: 'JPG / PNG / HEIC · up to 100 MB each' },
  sbUploadAdd: { es: 'Añadir más fotos', en: 'Add more photos' },
  sbUploading: { es: 'Subiendo…', en: 'Uploading…' },
  sbUploadedCount: { es: 'fotos subidas', en: 'photos uploaded' },
  sbStep2: { es: '2. Tono narrativo', en: '2. Story tone' },
  sbToneRomantic: { es: 'Romántico', en: 'Romantic' },
  sbToneEpic: { es: 'Épico', en: 'Epic' },
  sbToneIntimate: { es: 'Íntimo', en: 'Intimate' },
  sbTonePlayful: { es: 'Lúdico', en: 'Playful' },
  sbToneCinematic: { es: 'Cinematográfico', en: 'Cinematic' },
  sbToneDocumentary: { es: 'Documental', en: 'Documentary' },
  sbStep3: { es: '3. Momentos imprescindibles', en: '3. Must-have moments' },
  sbStep3Ph: {
    es: 'Ej: brindis del padrino, primer baile, vals con papá…',
    en: 'E.g. best-man toast, first dance, father-daughter dance…',
  },
  sbStep4: { es: '4. Personas a destacar', en: '4. People to feature' },
  sbStep4Ph: {
    es: 'Ej: novia (María), abuela, mejores amigos del cole…',
    en: 'E.g. bride (Maria), grandmother, childhood best friends…',
  },
  sbStep5: { es: '5. Paleta de color preferida', en: '5. Preferred color palette' },
  sbStep5Ph: { es: 'Ej: champagne, dorado, azul medianoche…', en: 'E.g. champagne, gold, midnight blue…' },
  sbStep6: { es: '6. Vibra musical', en: '6. Music vibe' },
  sbStep6Ph: {
    es: 'Ej: cuerdas orquestales, indie acústico, mariachi cinematográfico…',
    en: 'E.g. orchestral strings, indie acoustic, cinematic mariachi…',
  },
  sbStep7: { es: '7. Estilo de narración', en: '7. Narration style' },
  sbNarrVoiceover: { es: 'Voz en off poética', en: 'Poetic voiceover' },
  sbNarrLyrical: { es: 'Letras de la canción original', en: 'Original song lyrics' },
  sbNarrSilent: { es: 'Sin narración (solo música)', en: 'No narration (music only)' },
  sbNarrInterview: { es: 'Entrevistas a invitados', en: 'Guest interviews' },
  sbStep8: { es: '8. Notas adicionales (opcional)', en: '8. Additional notes (optional)' },
  sbStep8Ph: {
    es: 'Cualquier detalle creativo que debamos saber…',
    en: 'Any creative detail you want us to know…',
  },
  sbSaveBrief: { es: 'Guardar y continuar', en: 'Save and continue' },
  sbBriefSaved: { es: 'Brief guardado', en: 'Brief saved' },
  sbGenerateTitle: { es: 'Generar storyboard', en: 'Generate storyboard' },
  sbGenerateSub: {
    es: 'Crearemos 10 escenas con narración, dirección visual y cue musical, e iremos renderizando cada imagen con gpt-image-2 en modo edit usando tus fotos.',
    en: 'We will craft 10 scenes with narration, visual direction and music cues, and render each image with gpt-image-2 in edit mode using your photos.',
  },
  sbGenerate: { es: 'Generar mi storyboard', en: 'Generate my storyboard' },
  sbGenerating: { es: 'Generando guion…', en: 'Generating script…' },
  sbGeneratingScenes: { es: 'Renderizando escenas…', en: 'Rendering scenes…' },
  sbGenerateError: { es: 'No se pudo generar. Intenta de nuevo.', en: 'Generation failed. Please try again.' },
  sbViewerTitle: { es: 'Tu storyboard interactivo', en: 'Your interactive storyboard' },
  sbViewerSub: {
    es: 'Cada escena puede editarse y regenerarse. Explora, pule el texto, regenera la imagen hasta que se sienta perfecto.',
    en: 'Every scene can be edited and regenerated. Browse, polish the text, regenerate the image until it feels perfect.',
  },
  sbScene: { es: 'Escena', en: 'Scene' },
  sbSceneOf: { es: 'de', en: 'of' },
  sbNarration: { es: 'Narración', en: 'Narration' },
  sbVisualDir: { es: 'Dirección visual', en: 'Visual direction' },
  sbCameraMove: { es: 'Cámara', en: 'Camera' },
  sbDuration: { es: 'Duración', en: 'Duration' },
  sbMusicCue: { es: 'Música', en: 'Music' },
  sbImagePrompt: { es: 'Prompt de imagen', en: 'Image prompt' },
  sbEditScene: { es: 'Editar', en: 'Edit' },
  sbSaveScene: { es: 'Guardar', en: 'Save' },
  sbCancel: { es: 'Cancelar', en: 'Cancel' },
  sbRegenerateImage: { es: 'Regenerar imagen', en: 'Regenerate image' },
  sbRegenerating: { es: 'Regenerando…', en: 'Regenerating…' },
  sbScenePending: { es: 'En cola', en: 'Queued' },
  sbSceneGenerating: { es: 'Generando imagen…', en: 'Generating image…' },
  sbSceneError: { es: 'Error al generar', en: 'Generation error' },
  sbRetry: { es: 'Reintentar', en: 'Retry' },
  sbBackToProject: { es: 'Volver al proyecto', en: 'Back to project' },
  sbStoryboardReady: { es: 'Storyboard listo', en: 'Storyboard ready' },
  sbViewPrompts: { es: 'Ver prompts', en: 'Show prompts' },
  sbHidePrompts: { es: 'Ocultar prompts', en: 'Hide prompts' },
  sbRegenerateAll: { es: 'Regenerar todo el storyboard', en: 'Regenerate full storyboard' },
  sbConfirmRegen: {
    es: '¿Seguro que quieres regenerar todo? Esto reemplazará el guion actual.',
    en: 'Are you sure you want to regenerate everything? This will replace the current script.',
  },
  // navigation / submission
  prev: { es: 'Atrás', en: 'Back' },
  next: { es: 'Siguiente', en: 'Next' },
  formSubmit: { es: 'Enviar mi concepto', en: 'Submit my concept' },
  formSending: { es: 'Enviando...', en: 'Sending...' },
  formSuccess: {
    es: '¡Recibido! Tu concepto fue creado.',
    en: 'Received! Your concept has been created.',
  },
  formSuccessSub: {
    es: 'Tu página privada está lista. Ahí podrás pagar el depósito para desbloquear el demo, guion y blueprint del proyecto.',
    en: 'Your private page is ready. There you can pay the deposit to unlock the demo, script and project blueprint.',
  },
  openProject: { es: 'Abrir página de depósito', en: 'Open deposit page' },
  formError: {
    es: 'No se pudo enviar. Intenta de nuevo.',
    en: 'Could not send. Please try again.',
  },

  // ── FAQ ───────────────────────────────────────────────────────
  faqTitle: { es: 'Preguntas frecuentes', en: 'Frequently asked questions' },
  faq1Q: { es: '¿Por qué este servicio comienza en $5,999?', en: 'Why does this service start at $5,999?' },
  faq1A: {
    es: 'Cada proyecto incluye dirección creativa, producción premium, edición, color, sonido, galería privada y un equipo dedicado. No vendemos edición barata: vendemos una experiencia cinematográfica.',
    en: 'Each project includes creative direction, premium production, editing, colour, sound, a private gallery and a dedicated team. We do not sell cheap editing — we sell a cinematic experience.',
  },
  faq2Q: { es: '¿Cuánto tiempo toma?', en: 'How long does it take?' },
  faq2A: {
    es: 'Entre 3 y 8 semanas dependiendo del alcance. Los proyectos Luxury pueden requerir más tiempo de pre-producción.',
    en: 'Between 3 and 8 weeks depending on scope. Luxury projects may require additional pre-production time.',
  },
  faq3Q: { es: '¿Quién es el dueño del material?', en: 'Who owns the material?' },
  faq3A: {
    es: 'Los entregables finales son tuyos. Boostify mantiene una licencia limitada para portfolio.',
    en: 'You own the final deliverables. Boostify keeps a limited portfolio license.',
  },
  faq4Q: { es: '¿Cuántas correcciones incluye?', en: 'How many revisions are included?' },
  faq4A: {
    es: 'Dos rondas de correcciones premium incluidas. Adicionales se cotizan por hora.',
    en: 'Two premium revision rounds included. Additional rounds are quoted hourly.',
  },

  // ── Footer / final CTA ────────────────────────────────────────
  finalCtaTitle: {
    es: 'No editamos videos. Creamos memorias cinematográficas.',
    en: 'Not just a video. A cinematic memory system.',
  },
  finalCtaSub: {
    es: 'Tu evento merece más que metraje. Merece una historia.',
    en: 'Your event deserves more than footage. It deserves a story.',
  },
} satisfies Record<string, { es: string; en: string }>;

export type DictKey = keyof typeof dict;

export function t(key: DictKey, lang: Lang): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en ?? key;
}
