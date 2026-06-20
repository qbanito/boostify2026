/**
 * Boostify Music Academy — Built-in course catalog
 * Includes the free Boostify platform course + premium paid courses.
 * These are "seed" courses shown even before AI generation runs.
 */

export interface AcademyLesson {
  title: string;
  description: string;
  duration: number; // minutes
  type: 'video' | 'text' | 'interactive';
  isFree: boolean;
}

export interface AcademyCourse {
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  thumbnail: string | null;
  lessons: AcademyLesson[];
  tags: string[];
  isFeatured: boolean;
  isBoostifyOfficial: boolean;
  learningPath?: string;
  objectives: string[];
  instructor: string;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  icon: string;
  courseSlugs: string[];
  color: string;
}

// ─── LEARNING PATHS ────────────────────────────────────────
export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'music-creator',
    title: 'Music Creator',
    description: 'From zero to releasing your first tracks with AI-powered tools',
    icon: '🎵',
    courseSlugs: ['boostify-essentials', 'ai-music-production', 'mixing-mastering-ai'],
    color: 'from-purple-600 to-pink-500',
  },
  {
    id: 'video-producer',
    title: 'Video Producer',
    description: 'Master AI music video creation from concept to export',
    icon: '🎬',
    courseSlugs: ['boostify-essentials', 'ai-music-videos', 'visual-effects-motion'],
    color: 'from-blue-600 to-cyan-500',
  },
  {
    id: 'music-business',
    title: 'Music Business',
    description: 'Market, distribute, and monetize your music career',
    icon: '💰',
    courseSlugs: ['music-marketing-mastery', 'music-business-essentials', 'digital-distribution'],
    color: 'from-orange-600 to-yellow-500',
  },
  {
    id: 'full-artist',
    title: 'Complete Artist',
    description: 'The full journey — create, produce, market, and grow',
    icon: '⭐',
    courseSlugs: ['boostify-essentials', 'ai-music-production', 'ai-music-videos', 'artist-brand-development', 'digital-distribution'],
    color: 'from-emerald-600 to-teal-500',
  },
];

// ─── FREE BOOSTIFY COURSE ──────────────────────────────────
const BOOSTIFY_ESSENTIALS: AcademyCourse = {
  slug: 'boostify-essentials',
  title: 'Boostify Music — Complete Platform Guide',
  description: 'Master every feature of Boostify Music. Learn how to create AI-powered songs, produce stunning music videos with the timeline editor, generate merchandise, and distribute your music worldwide. This is your complete onboarding course — 100% free.',
  shortDescription: 'Learn everything about Boostify Music — free for all users',
  category: 'Boostify Platform',
  level: 'Beginner',
  price: 0,
  thumbnail: null,
  isFeatured: true,
  isBoostifyOfficial: true,
  learningPath: 'music-creator',
  instructor: 'Boostify Team',
  tags: ['boostify', 'platform', 'getting-started', 'free'],
  objectives: [
    'Navigate the Boostify Music platform confidently',
    'Generate AI songs and edit them professionally',
    'Create complete music videos with the timeline editor',
    'Use Motion Sync and Choreography features',
    'Design AI-generated merchandise',
    'Distribute your music to all platforms',
  ],
  lessons: [
    { title: 'Welcome to Boostify Music', description: 'Tour of the platform, creating your account, and setting up your artist profile.', duration: 8, type: 'interactive', isFree: true },
    { title: 'Navigating the Dashboard', description: 'Understand the sidebar, pages, settings, and how everything connects.', duration: 6, type: 'video', isFree: true },
    { title: 'Creating Your First AI Song', description: 'Use the AI Song Generator to create music from text prompts, choose genres, and customize output.', duration: 12, type: 'interactive', isFree: true },
    { title: 'Editing & Mixing Tracks', description: 'Work with the audio editor, adjust levels, apply effects, and export high-quality audio.', duration: 15, type: 'video', isFree: true },
    { title: 'Timeline Editor Basics', description: 'Learn the timeline interface — layers, clips, zoom, playback, and basic editing operations.', duration: 18, type: 'interactive', isFree: true },
    { title: 'Generating AI Images for Videos', description: 'Create stunning visuals with AI image generation, use variations panel, and manage image styles.', duration: 14, type: 'video', isFree: true },
    { title: 'Motion Sync & Choreography', description: 'Animate your artist images with Motion Sync, record or upload choreography videos, and apply dance presets.', duration: 16, type: 'interactive', isFree: true },
    { title: 'Advanced Video Effects', description: 'Add transitions, camera angles, visual effects, and cinematic looks to your music videos.', duration: 12, type: 'video', isFree: true },
    { title: 'Exporting Your Music Video', description: 'Render settings, format options, resolution choices, and publishing your final video.', duration: 10, type: 'video', isFree: true },
    { title: 'AI Merchandise Design', description: 'Generate merchandise with AI, connect to print-on-demand, and set up your merch store.', duration: 14, type: 'interactive', isFree: true },
    { title: 'Music Distribution', description: 'Distribute your music to Spotify, Apple Music, and 150+ platforms directly from Boostify.', duration: 12, type: 'video', isFree: true },
    { title: 'Monetization & Growth', description: 'Understand BTF tokens, NFTs, royalty tracking, and strategies to grow your artist career.', duration: 15, type: 'video', isFree: true },
  ],
};

// ─── PREMIUM COURSES ───────────────────────────────────────
const PREMIUM_COURSES: AcademyCourse[] = [
  {
    slug: 'ai-music-production',
    title: 'AI Music Production Masterclass',
    description: 'Deep dive into AI-assisted music production. Learn prompt engineering for music generation, advanced audio manipulation, genre blending techniques, and how to create radio-ready tracks using artificial intelligence tools.',
    shortDescription: 'Professional AI music production from concept to master',
    category: 'Production',
    level: 'Intermediate',
    price: 199,
    thumbnail: null,
    isFeatured: true,
    isBoostifyOfficial: true,
    learningPath: 'music-creator',
    instructor: 'AI Production Lab',
    tags: ['production', 'ai', 'music', 'mixing'],
    objectives: [
      'Master AI prompt engineering for music generation',
      'Create professional-quality tracks in any genre',
      'Apply advanced mixing and mastering techniques',
      'Build a complete production workflow',
    ],
    lessons: [
      { title: 'Understanding AI Music Models', description: 'How AI music generation works — models, training data, and output quality.', duration: 20, type: 'video', isFree: false },
      { title: 'Prompt Engineering for Music', description: 'Write effective prompts that produce the exact sound you want.', duration: 25, type: 'interactive', isFree: true },
      { title: 'Genre Blending with AI', description: 'Combine multiple genres to create unique sounds using AI tools.', duration: 18, type: 'video', isFree: false },
      { title: 'Vocal Generation & Processing', description: 'Generate and enhance vocals with AI, including style transfer and harmonization.', duration: 22, type: 'video', isFree: false },
      { title: 'Beat Making with AI Assistance', description: 'Create drums, basslines, and rhythmic patterns using AI tools.', duration: 20, type: 'interactive', isFree: false },
      { title: 'Arrangement & Song Structure', description: 'Use AI to help arrange your songs with professional structure.', duration: 18, type: 'video', isFree: false },
      { title: 'Mixing Fundamentals with AI', description: 'Learn EQ, compression, and spatial effects with AI-assisted mixing.', duration: 25, type: 'video', isFree: false },
      { title: 'Mastering Your Tracks', description: 'Final mastering process including loudness optimization for streaming platforms.', duration: 20, type: 'video', isFree: false },
      { title: 'Building Your Release Strategy', description: 'Plan and execute a professional release from start to finish.', duration: 15, type: 'text', isFree: false },
      { title: 'Advanced Production Techniques', description: 'Sound design, layering, automation, and professional polish.', duration: 22, type: 'video', isFree: false },
    ],
  },
  {
    slug: 'ai-music-videos',
    title: 'AI Music Video Creation',
    description: 'Learn to create professional music videos using AI tools. From storyboarding with AI to generating visuals, animating with motion transfer, and editing in the timeline — produce videos that rival studio productions.',
    shortDescription: 'Create stunning music videos with AI — no studio needed',
    category: 'Video Production',
    level: 'Intermediate',
    price: 249,
    thumbnail: null,
    isFeatured: true,
    isBoostifyOfficial: true,
    learningPath: 'video-producer',
    instructor: 'Visual Arts Studio',
    tags: ['video', 'ai', 'motion-sync', 'timeline'],
    objectives: [
      'Storyboard and plan music videos efficiently',
      'Generate cinematic AI visuals in different styles',
      'Animate images with Motion Sync technology',
      'Edit and export professional music videos',
    ],
    lessons: [
      { title: 'Music Video Fundamentals', description: 'Video concepts, shot types, and music video storytelling techniques.', duration: 15, type: 'video', isFree: true },
      { title: 'AI Storyboarding', description: 'Use AI to generate storyboards and visual plans from your song lyrics.', duration: 20, type: 'interactive', isFree: false },
      { title: 'Image Generation for Videos', description: 'Create consistent character images, backgrounds, and scenes with AI.', duration: 22, type: 'interactive', isFree: false },
      { title: 'Style Consistency & Variations', description: 'Maintain visual consistency across scenes using reference images and style locks.', duration: 18, type: 'video', isFree: false },
      { title: 'Motion Sync Deep Dive', description: 'Animate still images with DreamActor v2 for realistic character movement.', duration: 25, type: 'interactive', isFree: false },
      { title: 'Choreography & Dance', description: 'Record or upload dance videos and apply them as motion to your AI characters.', duration: 20, type: 'interactive', isFree: false },
      { title: 'Lip Sync Technology', description: 'Add realistic lip sync to your characters using PixVerse and OmniHuman.', duration: 18, type: 'video', isFree: false },
      { title: 'Timeline Editing Mastery', description: 'Advanced timeline techniques — multi-layer editing, transitions, and timing.', duration: 22, type: 'video', isFree: false },
      { title: 'Visual Effects & Post-Processing', description: 'Add camera effects, color grading, and cinematic looks to your videos.', duration: 20, type: 'video', isFree: false },
      { title: 'Export & Distribution', description: 'Render at optimal settings and distribute to YouTube, social media, and streaming.', duration: 12, type: 'text', isFree: false },
    ],
  },
  {
    slug: 'music-marketing-mastery',
    title: 'Music Marketing Mastery',
    description: 'Advanced digital marketing strategies specifically tailored for musicians. From social media optimization to email campaigns, playlist pitching, and audience building — learn to effectively promote your music in the digital age.',
    shortDescription: 'Promote your music like a pro in the digital age',
    category: 'Marketing',
    level: 'Intermediate',
    price: 179,
    thumbnail: null,
    isFeatured: false,
    isBoostifyOfficial: true,
    learningPath: 'music-business',
    instructor: 'Digital Marketing Pro',
    tags: ['marketing', 'social-media', 'growth', 'promotion'],
    objectives: [
      'Build a comprehensive music marketing strategy',
      'Master social media for music promotion',
      'Learn playlist pitching and PR strategies',
      'Create effective email marketing campaigns',
    ],
    lessons: [
      { title: 'Music Marketing in 2025', description: 'The landscape of music marketing — what works today and what doesn\'t.', duration: 12, type: 'video', isFree: true },
      { title: 'Building Your Brand Identity', description: 'Create a compelling artist brand that resonates with your audience.', duration: 18, type: 'interactive', isFree: false },
      { title: 'Social Media Strategy', description: 'Platform-specific strategies for Instagram, TikTok, YouTube, and X.', duration: 22, type: 'video', isFree: false },
      { title: 'Content Creation for Musicians', description: 'Create engaging content that grows your audience organically.', duration: 20, type: 'video', isFree: false },
      { title: 'Playlist Pitching Mastery', description: 'Get your music on Spotify playlists — editorial, algorithmic, and independent.', duration: 18, type: 'interactive', isFree: false },
      { title: 'Email Marketing for Artists', description: 'Build and nurture a mailing list that converts fans into superfans.', duration: 15, type: 'text', isFree: false },
      { title: 'Paid Advertising', description: 'Run effective ad campaigns on Meta, Google, and TikTok for music.', duration: 22, type: 'video', isFree: false },
      { title: 'PR & Press Coverage', description: 'Get featured in music blogs, magazines, and media outlets.', duration: 16, type: 'text', isFree: false },
    ],
  },
  {
    slug: 'music-business-essentials',
    title: 'Music Business Essentials',
    description: 'Master the fundamentals of the music business. Learn about copyright law, royalties, music licensing, contracts, publishing, and how to navigate the industry like a professional.',
    shortDescription: 'Essential business knowledge for every musician',
    category: 'Business',
    level: 'Beginner',
    price: 149,
    thumbnail: null,
    isFeatured: false,
    isBoostifyOfficial: true,
    learningPath: 'music-business',
    instructor: 'Music Law Academy',
    tags: ['business', 'copyright', 'royalties', 'contracts'],
    objectives: [
      'Understand copyright law and protect your music',
      'Navigate royalties, publishing, and revenue streams',
      'Read and negotiate music contracts',
      'Set up your music business professionally',
    ],
    lessons: [
      { title: 'The Music Industry Landscape', description: 'How the modern music industry works — key players and revenue flows.', duration: 15, type: 'video', isFree: true },
      { title: 'Copyright Fundamentals', description: 'Protect your music with copyright — what it covers and how to register.', duration: 20, type: 'video', isFree: false },
      { title: 'Understanding Royalties', description: 'Performance, mechanical, sync, and digital royalties explained.', duration: 22, type: 'video', isFree: false },
      { title: 'Music Publishing 101', description: 'How publishing works, publishing deals, and administration.', duration: 18, type: 'text', isFree: false },
      { title: 'Contracts & Legal Basics', description: 'Common music contracts — what to look for and what to avoid.', duration: 20, type: 'video', isFree: false },
      { title: 'Setting Up Your Business', description: 'Register your business entity, set up banking, and manage finances.', duration: 15, type: 'text', isFree: false },
      { title: 'Revenue Streams for Musicians', description: 'Diversify income — streaming, merch, live, sync, teaching, and more.', duration: 18, type: 'video', isFree: false },
      { title: 'Building a Team', description: 'When and how to hire managers, agents, lawyers, and accountants.', duration: 14, type: 'text', isFree: false },
    ],
  },
  {
    slug: 'artist-brand-development',
    title: 'Artist Brand Development',
    description: 'Build and maintain a strong artist brand from scratch. Cover everything from visual identity and social media presence to storytelling, audience psychology, and creating a compelling narrative that turns listeners into loyal fans.',
    shortDescription: 'Build a powerful artist brand that stands out',
    category: 'Branding',
    level: 'Intermediate',
    price: 179,
    thumbnail: null,
    isFeatured: false,
    isBoostifyOfficial: true,
    learningPath: 'full-artist',
    instructor: 'Brand Strategy Lab',
    tags: ['branding', 'visual-identity', 'storytelling', 'audience'],
    objectives: [
      'Define your unique artist identity and voice',
      'Create a cohesive visual brand across platforms',
      'Tell your story in a way that connects with fans',
      'Build a loyal community around your brand',
    ],
    lessons: [
      { title: 'What Makes an Artist Brand', description: 'The elements of a successful artist brand in the modern era.', duration: 12, type: 'video', isFree: true },
      { title: 'Finding Your Unique Voice', description: 'Discover what makes you different and how to communicate it.', duration: 18, type: 'interactive', isFree: false },
      { title: 'Visual Identity Design', description: 'Logos, color palettes, photography style, and consistent aesthetics.', duration: 22, type: 'interactive', isFree: false },
      { title: 'Storytelling for Artists', description: 'Craft your narrative — bio, origin story, and ongoing content story arcs.', duration: 16, type: 'video', isFree: false },
      { title: 'Social Media Brand Presence', description: 'Maintain brand consistency across Instagram, TikTok, YouTube, and more.', duration: 20, type: 'video', isFree: false },
      { title: 'Audience Psychology', description: 'Understand your fans — demographics, behaviors, and motivations.', duration: 18, type: 'text', isFree: false },
      { title: 'Community Building', description: 'Create and manage a fan community that supports your career.', duration: 15, type: 'video', isFree: false },
      { title: 'Brand Evolution', description: 'How to evolve your brand over time without losing your core identity.', duration: 14, type: 'text', isFree: false },
    ],
  },
  {
    slug: 'digital-distribution',
    title: 'Digital Music Distribution Mastery',
    description: 'Master the digital distribution landscape. Learn about streaming platforms, release strategies, metadata optimization, playlist algorithms, and how to maximize your music\'s reach and revenue in the streaming era.',
    shortDescription: 'Maximize your reach on all streaming platforms',
    category: 'Distribution',
    level: 'Beginner',
    price: 129,
    thumbnail: null,
    isFeatured: false,
    isBoostifyOfficial: true,
    learningPath: 'music-business',
    instructor: 'Distribution Expert',
    tags: ['distribution', 'streaming', 'spotify', 'release-strategy'],
    objectives: [
      'Distribute music to 150+ platforms efficiently',
      'Optimize metadata for algorithmic discovery',
      'Plan and execute release strategies',
      'Maximize streaming revenue',
    ],
    lessons: [
      { title: 'Distribution Landscape', description: 'How digital distribution works — platforms, aggregators, and direct deals.', duration: 12, type: 'video', isFree: true },
      { title: 'Choosing a Distributor', description: 'Compare distributors — pricing, features, and what matters most.', duration: 15, type: 'text', isFree: false },
      { title: 'Metadata Optimization', description: 'ISRC codes, UPC, credits, and metadata that drives discovery.', duration: 18, type: 'video', isFree: false },
      { title: 'Release Strategy Planning', description: 'Singles, EPs, albums — timing, pre-saves, and marketing coordination.', duration: 20, type: 'interactive', isFree: false },
      { title: 'Spotify Algorithm Secrets', description: 'How Spotify\'s algorithm works and how to trigger algorithmic playlists.', duration: 22, type: 'video', isFree: false },
      { title: 'Multi-Platform Strategy', description: 'Optimize for Spotify, Apple Music, YouTube Music, and emerging platforms.', duration: 18, type: 'video', isFree: false },
      { title: 'Revenue Analytics', description: 'Read and interpret streaming analytics to inform your strategy.', duration: 15, type: 'text', isFree: false },
      { title: 'International Distribution', description: 'Reach global audiences — localization and market-specific strategies.', duration: 14, type: 'text', isFree: false },
    ],
  },
  {
    slug: 'mixing-mastering-ai',
    title: 'Mixing & Mastering with AI Tools',
    description: 'Master the art of mixing and mastering music using the latest AI-powered tools. Learn professional audio engineering techniques combined with AI assistance for faster, better results.',
    shortDescription: 'Professional audio engineering meets AI assistance',
    category: 'Audio Engineering',
    level: 'Advanced',
    price: 299,
    thumbnail: null,
    isFeatured: false,
    isBoostifyOfficial: true,
    learningPath: 'music-creator',
    instructor: 'Audio Engineering Lab',
    tags: ['mixing', 'mastering', 'audio-engineering', 'advanced'],
    objectives: [
      'Mix tracks to professional industry standards',
      'Master audio for streaming and physical formats',
      'Use AI tools to accelerate mixing workflows',
      'Develop critical listening skills',
    ],
    lessons: [
      { title: 'Mixing Philosophy & Workflow', description: 'Approach mixing with the right mindset and efficient session setup.', duration: 18, type: 'video', isFree: true },
      { title: 'EQ & Frequency Management', description: 'Master equalization — surgical precision and musical shaping.', duration: 25, type: 'video', isFree: false },
      { title: 'Compression & Dynamics', description: 'Control dynamics with compression, limiting, expansion, and gating.', duration: 25, type: 'video', isFree: false },
      { title: 'Spatial Effects & Depth', description: 'Reverb, delay, and modulation — create space and dimension in your mix.', duration: 22, type: 'video', isFree: false },
      { title: 'AI-Assisted Mixing Tools', description: 'Use AI plugins and tools that analyze and suggest mix improvements.', duration: 20, type: 'interactive', isFree: false },
      { title: 'Vocal Mix Techniques', description: 'Mix vocals to sit perfectly in any genre with clarity and presence.', duration: 22, type: 'video', isFree: false },
      { title: 'Mastering Fundamentals', description: 'The mastering chain — EQ, compression, limiting, and LUFS targets.', duration: 25, type: 'video', isFree: false },
      { title: 'Loudness Standards & Streaming', description: 'Master to the correct loudness for Spotify, Apple Music, and YouTube.', duration: 18, type: 'video', isFree: false },
      { title: 'A/B Testing & Critical Listening', description: 'Develop your ear with reference tracks and systematic comparison.', duration: 16, type: 'interactive', isFree: false },
      { title: 'Advanced Mastering Techniques', description: 'Mid-side processing, multiband dynamics, and master bus recipes.', duration: 22, type: 'video', isFree: false },
    ],
  },
  {
    slug: 'visual-effects-motion',
    title: 'Visual Effects & Motion for Music',
    description: 'Create cinematic visual effects for your music videos. Learn motion graphics, particle effects, camera movements, color grading, and how to use AI motion transfer to bring still images to life.',
    shortDescription: 'Cinematic visual effects for AI music videos',
    category: 'Visual Effects',
    level: 'Advanced',
    price: 249,
    thumbnail: null,
    isFeatured: false,
    isBoostifyOfficial: true,
    learningPath: 'video-producer',
    instructor: 'VFX Workshop',
    tags: ['vfx', 'motion', 'effects', 'cinema'],
    objectives: [
      'Create professional visual effects for music videos',
      'Master color grading and cinematic looks',
      'Apply motion transfer and AI animation techniques',
      'Design motion graphics and particle effects',
    ],
    lessons: [
      { title: 'VFX for Music Videos', description: 'Overview of visual effects techniques used in modern music videos.', duration: 14, type: 'video', isFree: true },
      { title: 'Color Grading Fundamentals', description: 'Create mood and atmosphere with professional color grading.', duration: 22, type: 'video', isFree: false },
      { title: 'Camera Movement & Angles', description: 'Virtual camera techniques — pans, zooms, tracking, and dollies.', duration: 18, type: 'interactive', isFree: false },
      { title: 'Particle Effects & Overlays', description: 'Add rain, snow, sparks, smoke, and other particle effects.', duration: 20, type: 'video', isFree: false },
      { title: 'AI Motion Transfer Advanced', description: 'Advanced DreamActor techniques for realistic character animation.', duration: 25, type: 'interactive', isFree: false },
      { title: 'Text & Typography in Video', description: 'Animated titles, lyrics overlay, and kinetic typography.', duration: 16, type: 'video', isFree: false },
      { title: 'Compositing Techniques', description: 'Layer multiple elements, blend modes, and create complex scenes.', duration: 22, type: 'video', isFree: false },
      { title: 'Export Optimization', description: 'Optimal codec settings, resolution, and quality for every platform.', duration: 12, type: 'text', isFree: false },
    ],
  },
];

// ─── EXPORTS ───────────────────────────────────────────────
export const ALL_ACADEMY_COURSES: AcademyCourse[] = [BOOSTIFY_ESSENTIALS, ...PREMIUM_COURSES];
export const FREE_COURSES = ALL_ACADEMY_COURSES.filter(c => c.price === 0);
export const PAID_COURSES = ALL_ACADEMY_COURSES.filter(c => c.price > 0);
export const FEATURED_COURSES = ALL_ACADEMY_COURSES.filter(c => c.isFeatured);

export function getCourseBySlug(slug: string): AcademyCourse | undefined {
  return ALL_ACADEMY_COURSES.find(c => c.slug === slug);
}

export function getCoursesByPath(pathId: string): AcademyCourse[] {
  const path = LEARNING_PATHS.find(p => p.id === pathId);
  if (!path) return [];
  return path.courseSlugs
    .map(slug => getCourseBySlug(slug))
    .filter((c): c is AcademyCourse => c !== undefined);
}

export function getTotalDuration(course: AcademyCourse): string {
  const totalMinutes = course.lessons.reduce((sum, l) => sum + l.duration, 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}min`;
  return `${hours}h ${mins}min`;
}
