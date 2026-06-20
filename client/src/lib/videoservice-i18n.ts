/** Bilingual dictionary for Video Service landing page (ES / EN) */

export type Lang = 'es' | 'en';

const dict = {
  // ── Hero ──────────────────────────────────────────────────────────
  heroTitle: {
    es: 'Tu Música Merece Una Imagen Profesional',
    en: 'Your Music Deserves a Professional Image',
  },
  heroSub: {
    es: 'Creamos videos musicales y comerciales con tecnología de inteligencia artificial y producción real. Desde $999.',
    en: 'We create music videos and commercials with AI technology and real production. Starting at $999.',
  },
  heroCta: { es: 'Obtén Tu Propuesta Gratis', en: 'Get Your Free Proposal' },

  // ── Language toggle ───────────────────────────────────────────────
  langToggle: { es: 'English', en: 'Español' },

  // ── Demo showcase ─────────────────────────────────────────────────
  demoTitle: { es: 'Videos Producidos por Boostify', en: 'Videos Produced by Boostify' },
  demoSub: {
    es: 'Mira lo que podemos crear para tu música',
    en: 'See what we can create for your music',
  },
  demoBadgeAI: { es: '100% IA', en: '100% AI' },
  demoBadgeReal: { es: 'Video Real + IA', en: 'Real Video + AI' },

  // ── How it works ──────────────────────────────────────────────────
  howTitle: { es: 'Cómo Funciona', en: 'How It Works' },
  howStep1: { es: 'Sube Tu Canción', en: 'Upload Your Song' },
  howStep1d: {
    es: 'Envíanos tu canción y cuéntanos tu visión artística.',
    en: 'Send us your song and tell us your artistic vision.',
  },
  howStep2: { es: 'Recibe Tu Propuesta', en: 'Get Your Proposal' },
  howStep2d: {
    es: 'Nuestro equipo + IA crean un concepto visual personalizado.',
    en: 'Our team + AI create a personalized visual concept.',
  },
  howStep3: { es: 'Aprueba y Paga Depósito', en: 'Approve & Pay Deposit' },
  howStep3d: {
    es: 'Revisa la propuesta, haz ajustes y paga el depósito para iniciar.',
    en: 'Review the proposal, make adjustments, and pay the deposit to start.',
  },
  howStep4: { es: 'Recibe Tu Video', en: 'Receive Your Video' },
  howStep4d: {
    es: 'Entrega profesional lista para plataformas digitales.',
    en: 'Professional delivery ready for digital platforms.',
  },

  // ── Pricing cards ─────────────────────────────────────────────────
  pricingTitle: { es: 'Nuestros Planes', en: 'Our Plans' },
  pricingSub: {
    es: 'Elige el servicio que mejor se adapta a tu proyecto',
    en: 'Choose the service that best fits your project',
  },

  aiCardTitle: { es: 'Video 100% IA', en: '100% AI Video' },
  aiCardDesc: {
    es: 'Video musical generado completamente con inteligencia artificial de última generación.',
    en: 'Music video fully generated with cutting-edge artificial intelligence.',
  },
  aiCardPrice: { es: 'Desde', en: 'Starting at' },
  aiCardDeposit: { es: 'Depósito: $499', en: 'Deposit: $499' },
  aiFeature1: { es: 'Guión creativo con IA', en: 'AI-powered creative script' },
  aiFeature2: { es: 'Escenas generadas con IA', en: 'AI-generated scenes' },
  aiFeature3: { es: 'Lip-sync disponible', en: 'Lip-sync available' },
  aiFeature4: { es: 'Resolución hasta 4K', en: 'Up to 4K resolution' },
  aiFeature5: { es: 'Entrega en 7-14 días', en: 'Delivery in 7-14 days' },

  premiumCardTitle: { es: 'Video Premium (Real + IA)', en: 'Premium Video (Real + AI)' },
  premiumCardDesc: {
    es: 'Producción con video real combinada con efectos de IA para un resultado cinematográfico.',
    en: 'Real video production combined with AI effects for a cinematic result.',
  },
  premiumCardPrice: { es: 'Desde', en: 'Starting at' },
  premiumCardDeposit: { es: 'Depósito: 40% del total', en: 'Deposit: 40% of total' },
  premiumFeature1: { es: 'Producción y filmación real', en: 'Real production and filming' },
  premiumFeature2: { es: 'Post-producción con IA', en: 'AI post-production' },
  premiumFeature3: { es: 'Efectos VFX cinematográficos', en: 'Cinematic VFX effects' },
  premiumFeature4: { es: 'Director creativo dedicado', en: 'Dedicated creative director' },
  premiumFeature5: { es: 'Entrega en 14-30 días', en: 'Delivery in 14-30 days' },

  popular: { es: 'Más Popular', en: 'Most Popular' },
  selectPlan: { es: 'Seleccionar Plan', en: 'Select Plan' },

  // ── Value-add banner ──────────────────────────────────────────────
  valueBannerTitle: {
    es: '¡Landing Page de Artista GRATIS!',
    en: 'FREE Artist Landing Page!',
  },
  valueBannerDesc: {
    es: 'Obtén tu propia landing page profesional en Boostify gratis por 30 días. Si contratas un video de $2,900+, ¡es GRATIS por 1 año! (Valor: $1,200/año)',
    en: 'Get your own professional landing page on Boostify free for 30 days. If you hire a video of $2,900+, it\'s FREE for 1 year! (Value: $1,200/year)',
  },
  valueBannerCta: { es: 'Quiero Mi Landing Gratis', en: 'I Want My Free Landing' },

  // ── Form steps ────────────────────────────────────────────────────
  formTitle: { es: 'Solicita Tu Video', en: 'Request Your Video' },
  formSub: {
    es: 'Completa el formulario y recibe una propuesta profesional en 24-48 horas',
    en: 'Fill out the form and receive a professional proposal in 24-48 hours',
  },

  step1Title: { es: 'Tu Canción', en: 'Your Song' },
  step2Title: { es: 'Tu Visión', en: 'Your Vision' },
  step3Title: { es: 'Detalles Técnicos', en: 'Technical Details' },
  step4Title: { es: 'Tu Presupuesto', en: 'Your Budget' },
  step5Title: { es: 'Datos de Contacto', en: 'Contact Info' },

  songNameLabel: { es: 'Nombre de la canción', en: 'Song name' },
  songNamePh: { es: 'Ej: Mi Corazón', en: 'Ex: My Heart' },
  genreLabel: { es: 'Género musical', en: 'Music genre' },
  genres: {
    es: ['Reggaeton', 'Pop', 'Hip-Hop', 'R&B', 'Rock', 'Electrónica', 'Latin', 'Trap', 'Bachata', 'Salsa', 'Regional Mexicano', 'Otro'],
    en: ['Reggaeton', 'Pop', 'Hip-Hop', 'R&B', 'Rock', 'Electronic', 'Latin', 'Trap', 'Bachata', 'Salsa', 'Regional Mexican', 'Other'],
  },
  uploadSong: { es: 'Sube tu canción (MP3/WAV)', en: 'Upload your song (MP3/WAV)' },
  uploadDrag: { es: 'Arrastra o haz clic para subir', en: 'Drag or click to upload' },
  uploadMax: { es: 'Máximo 50MB', en: 'Max 50MB' },

  videoTypeLabel: { es: 'Tipo de video', en: 'Video type' },
  videoTypes: {
    es: { music_video: 'Video Musical', commercial: 'Comercial', lyric_video: 'Lyric Video' },
    en: { music_video: 'Music Video', commercial: 'Commercial', lyric_video: 'Lyric Video' },
  },
  aestheticLabel: { es: 'Estética / Mood', en: 'Aesthetic / Mood' },
  aesthetics: {
    es: ['Urbano', 'Cinematográfico', 'Minimalista', 'Fantasía', 'Documental', 'Retro / Vintage', 'Futurista', 'Naturaleza'],
    en: ['Urban', 'Cinematic', 'Minimalist', 'Fantasy', 'Documentary', 'Retro / Vintage', 'Futuristic', 'Nature'],
  },
  visionLabel: { es: 'Describe tu visión para el video', en: 'Describe your vision for the video' },
  visionPh: {
    es: 'Cuéntanos qué imaginas: colores, ambiente, historia...',
    en: 'Tell us what you imagine: colors, atmosphere, story...',
  },

  realVideoQ: { es: '¿Necesitas filmación real?', en: 'Do you need real filming?' },
  realVideoYes: { es: 'Sí, quiero video real + IA', en: 'Yes, I want real video + AI' },
  realVideoNo: { es: 'No, 100% IA', en: 'No, 100% AI' },
  lipSyncQ: { es: '¿Quieres lip-sync?', en: 'Do you want lip-sync?' },
  lipSyncYes: { es: 'Sí', en: 'Yes' },
  lipSyncNo: { es: 'No', en: 'No' },
  resolutionLabel: { es: 'Resolución', en: 'Resolution' },
  videoDurationLabel: { es: 'Duración del video', en: 'Video duration' },
  durations: {
    es: ['Hasta 2 min', '2-3 min', '3-4 min', '4-5 min', 'Más de 5 min'],
    en: ['Up to 2 min', '2-3 min', '3-4 min', '4-5 min', 'Over 5 min'],
  },
  locationsLabel: { es: 'Locaciones (si video real)', en: 'Locations (if real video)' },
  locationsPh: { es: 'Ej: estudio, playa, ciudad...', en: 'Ex: studio, beach, city...' },

  // Budget step
  budgetSummary: { es: 'Resumen de Presupuesto', en: 'Budget Summary' },
  budgetBase: { es: 'Precio base', en: 'Base price' },
  budgetLipSync: { es: 'Lip-sync', en: 'Lip-sync' },
  budget4k: { es: 'Upgrade 4K', en: '4K Upgrade' },
  budgetExtra: { es: 'Duración extra', en: 'Extra duration' },
  budgetLocations: { es: 'Locaciones (estimado)', en: 'Locations (estimate)' },
  budgetTotal: { es: 'Total Estimado', en: 'Estimated Total' },
  budgetDeposit: { es: 'Depósito Requerido', en: 'Required Deposit' },
  budgetNote: {
    es: 'Este es un estimado. El precio final se confirmará con la propuesta.',
    en: 'This is an estimate. The final price will be confirmed with the proposal.',
  },

  // Contact step
  fullNameLabel: { es: 'Nombre completo', en: 'Full name' },
  emailLabel: { es: 'Email', en: 'Email' },
  phoneLabel: { es: 'Teléfono', en: 'Phone' },
  instagramLabel: { es: 'Instagram (opcional)', en: 'Instagram (optional)' },
  spotifyLabel: { es: 'Spotify (opcional)', en: 'Spotify (optional)' },
  termsLabel: {
    es: 'Acepto los términos de servicio y la política de privacidad',
    en: 'I accept the Terms of Service and Privacy Policy',
  },

  // Form buttons
  next: { es: 'Siguiente', en: 'Next' },
  prev: { es: 'Anterior', en: 'Back' },
  submitDeposit: { es: 'Pagar Depósito y Enviar', en: 'Pay Deposit & Submit' },
  submitFree: { es: 'Enviar Solicitud Gratis', en: 'Send Free Request' },
  submitting: { es: 'Enviando...', en: 'Submitting...' },

  // Image upload
  uploadImageLabel: { es: 'Sube una imagen tuya (opcional)', en: 'Upload a photo of yourself (optional)' },
  uploadImageDesc: { es: 'La convertiremos en una imagen artística para tu landing page gratis', en: 'We\'ll transform it into an artistic image for your free landing page' },
  uploadImageDrag: { es: 'Arrastra una imagen o haz clic para subir', en: 'Drag an image or click to upload' },
  uploadImageMax: { es: 'JPG, PNG, WebP — Máx. 10MB', en: 'JPG, PNG, WebP — Max 10MB' },
  uploadImageProcessing: { es: 'Procesando tu imagen artística...', en: 'Processing your artistic image...' },

  // Free landing page
  freeLandingBanner: { es: '🎁 ¡Recibirás tu Landing Page de artista GRATIS al enviar!', en: '🎁 You\'ll get your FREE artist Landing Page on submit!' },
  submitAndGetPage: { es: 'Enviar y Obtener Mi Página Gratis', en: 'Submit & Get My Free Page' },

  // FAQ
  faqTitle: { es: 'Preguntas Frecuentes', en: 'Frequently Asked Questions' },
  faq: {
    es: [
      { q: '¿Cuánto tiempo toma producir un video?', a: 'Videos 100% IA: 7-14 días. Videos con filmación real: 14-30 días dependiendo de la complejidad.' },
      { q: '¿Puedo hacer cambios después de ver la propuesta?', a: 'Sí, incluimos hasta 2 rondas de revisiones sin costo adicional.' },
      { q: '¿Qué formatos de entrega recibo?', a: 'Recibes el video en MP4 optimizado para YouTube, Instagram, TikTok y Spotify Canvas.' },
      { q: '¿El depósito es reembolsable?', a: 'El depósito es reembolsable al 100% si no apruebas la propuesta inicial.' },
      { q: '¿Puedo subir mi canción aunque no esté terminada?', a: 'Sí, podemos trabajar con demos o mezclas preliminares.' },
      { q: '¿Qué incluye la landing page gratis?', a: 'Una página profesional en Boostify con tu música, biografia, fotos, tienda de merch y links.' },
    ],
    en: [
      { q: 'How long does it take to produce a video?', a: '100% AI videos: 7-14 days. Real filming videos: 14-30 days depending on complexity.' },
      { q: 'Can I make changes after seeing the proposal?', a: 'Yes, we include up to 2 rounds of revisions at no extra cost.' },
      { q: 'What delivery formats do I receive?', a: 'You receive the video in MP4 optimized for YouTube, Instagram, TikTok, and Spotify Canvas.' },
      { q: 'Is the deposit refundable?', a: 'The deposit is 100% refundable if you don\'t approve the initial proposal.' },
      { q: 'Can I upload my song even if it\'s not finished?', a: 'Yes, we can work with demos or preliminary mixes.' },
      { q: 'What does the free landing page include?', a: 'A professional page on Boostify with your music, bio, photos, merch store, and links.' },
    ],
  },

  // Success page
  successTitle: { es: '¡Proyecto Recibido!', en: 'Project Received!' },
  successSub: {
    es: 'Tu solicitud fue enviada exitosamente. Te contactaremos en las próximas 24-48 horas.',
    en: 'Your request was sent successfully. We\'ll contact you within 24-48 hours.',
  },
  successDeposit: { es: 'Depósito pagado', en: 'Deposit paid' },
  successProjectId: { es: 'Número de proyecto', en: 'Project number' },
  successTimeline: { es: 'Seguimiento de Tu Proyecto', en: 'Track Your Project' },
  phase1: { es: 'Proyecto Recibido', en: 'Project Received' },
  phase2: { es: 'Creación del Guión', en: 'Script Creation' },
  phase3: { es: 'Propuesta Enviada', en: 'Proposal Sent' },
  phase4: { es: 'En Producción', en: 'In Production' },
  phase5: { es: 'Entrega Final', en: 'Final Delivery' },
  successLanding: {
    es: 'Tu landing page de artista gratis está lista para activar:',
    en: 'Your free artist landing page is ready to activate:',
  },
  activateLanding: { es: 'Activar Mi Landing Page', en: 'Activate My Landing Page' },
  successEmail: {
    es: 'Revisa tu email para más detalles del proceso.',
    en: 'Check your email for more details about the process.',
  },

  // Social proof
  proofTitle: { es: 'Artistas Confían en Boostify', en: 'Artists Trust Boostify' },
  proofVideos: { es: 'Videos Producidos', en: 'Videos Produced' },
  proofArtists: { es: 'Artistas Satisfechos', en: 'Happy Artists' },
  proofCountries: { es: 'Países', en: 'Countries' },
  proofSatisfaction: { es: 'Satisfacción', en: 'Satisfaction' },

  // Why Boostify
  whyTitle: { es: '¿Por Qué Elegir Boostify?', en: 'Why Choose Boostify?' },
  whySub: { es: 'Combinamos creatividad, tecnología y experiencia para hacer brillar tu música', en: 'We combine creativity, technology, and experience to make your music shine' },
  whyFeature1: { es: 'IA de Última Generación', en: 'Cutting-Edge AI' },
  whyFeature1d: { es: 'Utilizamos modelos de IA avanzados para crear escenas y efectos visuales únicos que hacen cada video irrepetible.', en: 'We use advanced AI models to create unique scenes and visual effects that make every video one of a kind.' },
  whyFeature2: { es: 'Entrega Ultra Rápida', en: 'Ultra-Fast Delivery' },
  whyFeature2d: { es: 'Videos 100% IA listos en 7-14 días. Sin largos tiempos de espera ni retrasos innecesarios.', en: 'AI videos ready in 7-14 days. No long wait times or unnecessary delays.' },
  whyFeature3: { es: 'Precio Accesible', en: 'Affordable Pricing' },
  whyFeature3d: { es: 'Videos profesionales desde $999. Hasta 10x más barato que una productora tradicional.', en: 'Professional videos from $999. Up to 10x cheaper than a traditional production house.' },
  whyFeature4: { es: 'Landing Page Gratis', en: 'Free Landing Page' },
  whyFeature4d: { es: 'Cada artista recibe su propia página profesional con música, bio, fotos y tienda de merch.', en: 'Every artist gets their own professional page with music, bio, photos, and merch store.' },
  whyFeature5: { es: 'Multi-Plataforma', en: 'Multi-Platform' },
  whyFeature5d: { es: 'Tu video optimizado para YouTube, Instagram Reels, TikTok y Spotify Canvas desde el primer día.', en: 'Your video optimized for YouTube, Instagram Reels, TikTok, and Spotify Canvas from day one.' },
  whyFeature6: { es: 'Soporte Dedicado', en: 'Dedicated Support' },
  whyFeature6d: { es: 'Un director creativo asignado a tu proyecto con comunicación directa durante todo el proceso.', en: 'A creative director assigned to your project with direct communication throughout the process.' },

  // Testimonials
  testimonialsTitle: { es: 'Lo Que Dicen Nuestros Artistas', en: 'What Our Artists Say' },
  testimonialsSub: { es: 'Historias reales de artistas que confiaron en Boostify', en: 'Real stories from artists who trusted Boostify' },
  testimonial1: {
    es: 'Boostify transformó mi single en un video increíble. La calidad de la IA me dejó sin palabras. ¡Lo mejor es que tuve mi video en menos de 2 semanas!',
    en: 'Boostify transformed my single into an incredible video. The AI quality left me speechless. The best part is I had my video in less than 2 weeks!',
  },
  testimonial1Author: { es: 'JUVENTINO', en: 'JUVENTINO' },
  testimonial1Role: { es: 'Artista Urbano • Miami, FL', en: 'Urban Artist • Miami, FL' },
  testimonial2: {
    es: 'No podía creer que un video de esta calidad costara menos de $1,500. El equipo fue super profesional y el resultado fue exactamente lo que imaginé.',
    en: 'I couldn\'t believe a video of this quality cost less than $1,500. The team was super professional and the result was exactly what I imagined.',
  },
  testimonial2Author: { es: 'Solo Frank', en: 'Solo Frank' },
  testimonial2Role: { es: 'Rapero • República Dominicana', en: 'Rapper • Dominican Republic' },
  testimonial3: {
    es: 'La landing page gratis fue un bonus increíble. Ahora tengo un sitio profesional donde mando a todos mis fans. ¡100% recomendado!',
    en: 'The free landing page was an incredible bonus. Now I have a professional site where I send all my fans. 100% recommended!',
  },
  testimonial3Author: { es: 'Sencilla Conexion', en: 'Sencilla Conexion' },
  testimonial3Role: { es: 'Banda Indie • México', en: 'Indie Band • Mexico' },

  // Brands / Platforms
  platformsTitle: { es: 'Optimizado Para Todas Las Plataformas', en: 'Optimized For All Platforms' },

  // Urgency banner
  urgencyBadge: {
    es: '🔥 Solo 3 espacios disponibles en abril',
    en: '🔥 Only 3 spots available in April',
  },
  urgencyTimer: {
    es: 'Precio de lanzamiento por tiempo limitado',
    en: 'Limited-time launch price',
  },

  // Comparison table
  compTitle: { es: 'Boostify vs Productora Tradicional', en: 'Boostify vs Traditional Studio' },
  compSub: { es: 'Mira por qué artistas inteligentes eligen Boostify', en: 'See why smart artists choose Boostify' },
  compFeature: { es: 'Característica', en: 'Feature' },
  compBoostify: { es: 'Boostify', en: 'Boostify' },
  compTraditional: { es: 'Productora Tradicional', en: 'Traditional Studio' },
  compPrice: { es: 'Precio', en: 'Price' },
  compPriceB: { es: 'Desde $999', en: 'From $999' },
  compPriceT: { es: '$5,000 – $50,000+', en: '$5,000 – $50,000+' },
  compTime: { es: 'Tiempo de entrega', en: 'Delivery time' },
  compTimeB: { es: '7-14 días', en: '7-14 days' },
  compTimeT: { es: '1-3 meses', en: '1-3 months' },
  compRevisions: { es: 'Revisiones', en: 'Revisions' },
  compRevisionsB: { es: '2 rondas incluidas', en: '2 rounds included' },
  compRevisionsT: { es: 'Cobran extra', en: 'Extra charge' },
  compLanding: { es: 'Landing page', en: 'Landing page' },
  compLandingB: { es: 'GRATIS incluida', en: 'FREE included' },
  compLandingT: { es: 'No incluida', en: 'Not included' },
  compFormats: { es: 'Multi-plataforma', en: 'Multi-platform' },
  compFormatsB: { es: 'YouTube, IG, TikTok, Spotify', en: 'YouTube, IG, TikTok, Spotify' },
  compFormatsT: { es: 'Solo 1 formato', en: 'Only 1 format' },
  compAI: { es: 'Tecnología IA', en: 'AI Technology' },
  compAIB: { es: 'IA de última generación', en: 'Cutting-edge AI' },
  compAIT: { es: 'No disponible', en: 'Not available' },

  // Artist pages showcase
  artistShowcaseTitle: { es: 'Landing Pages de Nuestros Artistas', en: 'Our Artists\' Landing Pages' },
  artistShowcaseSub: { es: 'Cada artista recibe una página profesional GRATIS — mira las de nuestros clientes', en: 'Every artist gets a FREE professional page — check out our clients\'' },
  artistShowcaseCta: { es: 'Ver Página', en: 'View Page' },

  // Who is this for
  whoTitle: { es: '¿Para Quién Es Esto?', en: 'Who Is This For?' },
  whoSub: { es: 'Si te identificas con alguno, este servicio es para ti', en: 'If you identify with any of these, this service is for you' },
  who1: { es: 'Artistas independientes que quieren su primer video profesional', en: 'Independent artists who want their first professional video' },
  who2: { es: 'Artistas con presupuesto limitado que quieren calidad cinematográfica', en: 'Artists with limited budget who want cinematic quality' },
  who3: { es: 'Sellos discográficos pequeños que necesitan videos rápidos', en: 'Small labels that need fast videos' },
  who4: { es: 'Artistas que quieren una presencia digital profesional completa', en: 'Artists who want a complete professional digital presence' },

  // WhatsApp
  whatsappText: { es: 'Hola! Me interesa un video musical con Boostify', en: 'Hi! I\'m interested in a music video with Boostify' },

  // Sticky CTA
  stickyCta: { es: 'Solicitar Video', en: 'Request Video' },
  stickyFrom: { es: 'Desde', en: 'From' },

  // Footer CTA
  footerCta: {
    es: '¿Listo para llevar tu música al siguiente nivel?',
    en: 'Ready to take your music to the next level?',
  },
  footerCtaSub: {
    es: 'Únete a más de 80 artistas que ya confían en Boostify para sus videos musicales',
    en: 'Join 80+ artists who already trust Boostify for their music videos',
  },

  // ── AI Tutorial Section ───────────────────────────────────────────
  aiTutorialBadge: { es: 'APRENDE CON IA', en: 'LEARN WITH AI' },
  aiTutorialTitle: { es: 'Cómo Hacer Videos con IA', en: 'How to Make AI Videos' },
  aiTutorialSub: {
    es: 'La inteligencia artificial está revolucionando la producción de videos musicales. Así es como funciona el proceso.',
    en: 'Artificial intelligence is revolutionizing music video production. Here\'s how the process works.',
  },
  aiTutStep1: { es: 'Genera el Concepto Visual', en: 'Generate the Visual Concept' },
  aiTutStep1d: {
    es: 'Con herramientas como Midjourney y DALL·E, creas storyboards y conceptos visuales únicos a partir de prompts de texto.',
    en: 'Using tools like Midjourney and DALL·E, you create unique storyboards and visual concepts from text prompts.',
  },
  aiTutStep2: { es: 'Crea Escenas con Video IA', en: 'Create Scenes with AI Video' },
  aiTutStep2d: {
    es: 'Plataformas como Kling AI y Runway ML transforman tus imágenes en clips de video con movimiento, cámara y efectos cinematográficos.',
    en: 'Platforms like Kling AI and Runway ML transform your images into video clips with motion, camera work, and cinematic effects.',
  },
  aiTutStep3: { es: 'Edición y Post-Producción', en: 'Editing & Post-Production' },
  aiTutStep3d: {
    es: 'Se editan las escenas, se sincroniza con la música, se agrega color grading y efectos VFX para un resultado profesional.',
    en: 'Scenes are edited, synced to music, color graded, and VFX effects are added for a professional result.',
  },
  aiTutToolsLabel: { es: 'HERRAMIENTAS QUE USAMOS', en: 'TOOLS WE USE' },

  // ── AI Video Course – Presale ─────────────────────────────────────
  coursePresaleBadge: { es: 'CURSO EN PREVENTA', en: 'COURSE PRE-SALE' },
  courseTitle: { es: 'Curso: Crea Videos Musicales con IA', en: 'Course: Create Music Videos with AI' },
  courseDesc: {
    es: 'Aprende paso a paso a crear videos musicales profesionales usando inteligencia artificial. Desde el concepto hasta la publicación — sin necesidad de cámara ni experiencia previa.',
    en: 'Learn step by step how to create professional music videos using AI. From concept to publishing — no camera or prior experience needed.',
  },
  courseMod1: { es: 'Módulo 1: Fundamentos de IA para Video', en: 'Module 1: AI Fundamentals for Video' },
  courseMod2: { es: 'Módulo 2: Generación de Imágenes (Midjourney, DALL·E)', en: 'Module 2: Image Generation (Midjourney, DALL·E)' },
  courseMod3: { es: 'Módulo 3: Video AI (Kling, Runway, Sora)', en: 'Module 3: AI Video (Kling, Runway, Sora)' },
  courseMod4: { es: 'Módulo 4: Edición y Post-Producción', en: 'Module 4: Editing & Post-Production' },
  courseMod5: { es: 'Módulo 5: Lip-Sync y Efectos Especiales', en: 'Module 5: Lip-Sync & Special Effects' },
  courseMod6: { es: 'Módulo 6: Monetización y Distribución', en: 'Module 6: Monetization & Distribution' },
  courseIncludes: { es: 'QUÉ INCLUYE', en: 'WHAT\'S INCLUDED' },
  courseIncl1: { es: '20+ horas de video', en: '20+ hours of video' },
  courseIncl2: { es: 'Acceso de por vida', en: 'Lifetime access' },
  courseIncl3: { es: 'Prompts y templates', en: 'Prompts & templates' },
  courseIncl4: { es: 'Comunidad privada', en: 'Private community' },
  coursePresaleTag: { es: 'PREVENTA -50%', en: 'PRE-SALE -50%' },
  coursePresaleLabel: { es: 'Precio de preventa', en: 'Pre-sale price' },
  courseSaveLabel: { es: '¡Ahorras $300! Precio sube al lanzar', en: 'You save $300! Price goes up at launch' },
  coursePerk1: { es: 'Acceso anticipado al curso completo', en: 'Early access to the full course' },
  coursePerk2: { es: 'Bonus: Sesión 1-on-1 con el instructor', en: 'Bonus: 1-on-1 session with instructor' },
  coursePerk3: { es: 'Pack de 50+ prompts profesionales', en: 'Pack of 50+ professional prompts' },
  coursePerk4: { es: 'Certificado de finalización', en: 'Certificate of completion' },
  courseBuyCta: { es: 'Reservar Mi Lugar — $299', en: 'Reserve My Spot — $299' },
  courseGuarantee: {
    es: 'Garantía de devolución de 30 días • Pago seguro con Stripe',
    en: '30-day money-back guarantee • Secure payment via Stripe',
  },
  courseLimited: {
    es: '🔥 Solo 50 lugares a precio de preventa — 12 vendidos',
    en: '🔥 Only 50 spots at pre-sale price — 12 sold',
  },
} as const;

export type DictKey = keyof typeof dict;

export function t(key: DictKey, lang: Lang): any {
  return dict[key]?.[lang] ?? dict[key]?.['es'] ?? key;
}

export default dict;
