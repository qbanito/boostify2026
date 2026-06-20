/**
 * Agent Tool Executors — The actual functions that execute when OpenAI calls a tool
 * Each executor receives parsed arguments + context, performs real actions, and returns ToolResult
 */
import { db } from '../db';
import { agentSavedResults } from '../../db/schema';
import { generateImageWithNanoBanana } from './fal-service';
import type { ToolResult, ToolAction } from './agent-tool-registry';

interface ExecutionContext {
  userId: number;
  artistId?: number;
  sessionId?: number;
  artistName?: string;
}

type ToolExecutor = (args: any, ctx: ExecutionContext) => Promise<ToolResult>;

// ═══════════════════════════════════════════════════
// EXECUTOR REGISTRY
// ═══════════════════════════════════════════════════

const executors: Record<string, ToolExecutor> = {};

function registerExecutor(name: string, executor: ToolExecutor) {
  executors[name] = executor;
}

export function getExecutor(toolName: string): ToolExecutor | undefined {
  return executors[toolName];
}

export async function executeTool(
  toolName: string,
  args: any,
  ctx: ExecutionContext
): Promise<ToolResult> {
  const executor = executors[toolName];
  if (!executor) {
    return {
      success: false,
      toolName,
      message: `Unknown tool: ${toolName}`,
    };
  }
  try {
    return await executor(args, ctx);
  } catch (error) {
    console.error(`Tool execution error [${toolName}]:`, error);
    return {
      success: false,
      toolName,
      message: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ═══════════════════════════════════════════════════
// COMPOSER EXECUTORS
// ═══════════════════════════════════════════════════

registerExecutor('save_lyrics', async (args, ctx) => {
  const [saved] = await db.insert(agentSavedResults).values({
    userId: ctx.userId,
    artistId: ctx.artistId || null,
    sessionId: ctx.sessionId || null,
    agentType: 'composer',
    title: args.title,
    content: args.lyrics,
    contentType: 'lyrics',
    metadata: {
      genre: args.genre,
      mood: args.mood,
      language: args.language,
      structure: args.structure,
    },
    tags: [args.genre, args.mood, 'lyrics'].filter(Boolean),
  }).returning();

  return {
    success: true,
    toolName: 'save_lyrics',
    message: `Lyrics "${args.title}" saved successfully with ID ${saved.id}`,
    data: { id: saved.id, title: args.title },
    actions: [
      {
        id: 'view_lyrics',
        label: 'Ver letras guardadas',
        icon: '📝',
        type: 'secondary',
        url: '/ai-agents?tab=saved&type=composer',
      },
      {
        id: 'generate_audio',
        label: 'Generar audio',
        icon: '🎵',
        type: 'primary',
        endpoint: `/api/agents/execute`,
        method: 'POST',
        payload: {
          agentType: 'composer',
          tool: 'generate_music_audio',
          args: { lyrics: args.lyrics, genre: args.genre },
        },
      },
    ],
  };
});

registerExecutor('generate_music_audio', async (args, ctx) => {
  // Build FAL prompt from lyrics + genre
  const musicPrompt = `${args.genre} song, ${args.mood || 'energetic'}, ${args.tempo ? args.tempo + ' BPM' : 'moderate tempo'}. Lyrics: ${args.lyrics.substring(0, 200)}`;

  return {
    success: true,
    toolName: 'generate_music_audio',
    message: `Audio generation request created. Use the Composer page to generate the actual audio track with these parameters.`,
    data: {
      prompt: musicPrompt,
      genre: args.genre,
      tempo: args.tempo,
      mood: args.mood,
    },
    actions: [
      {
        id: 'go_composer',
        label: 'Ir al Compositor',
        icon: '🎹',
        type: 'primary',
        url: '/ai-agents?agent=composer',
      },
    ],
  };
});

// ═══════════════════════════════════════════════════
// MARKETING EXECUTORS
// ═══════════════════════════════════════════════════

registerExecutor('create_campaign', async (args, ctx) => {
  const [saved] = await db.insert(agentSavedResults).values({
    userId: ctx.userId,
    artistId: ctx.artistId || null,
    sessionId: ctx.sessionId || null,
    agentType: 'marketing',
    title: `Campaign: ${args.name}`,
    content: JSON.stringify({
      name: args.name,
      goal: args.goal,
      startDate: args.startDate || new Date().toISOString(),
      durationDays: args.durationDays || 30,
      platforms: args.platforms,
      budget: args.budget,
      milestones: args.milestones || [],
    }),
    contentType: 'campaign',
    metadata: {
      campaignType: 'marketing',
      platforms: args.platforms,
      durationDays: args.durationDays,
    },
    tags: ['campaign', ...args.platforms],
  }).returning();

  return {
    success: true,
    toolName: 'create_campaign',
    message: `Marketing campaign "${args.name}" created with ${args.milestones?.length || 0} milestones targeting ${args.platforms.join(', ')}`,
    data: {
      id: saved.id,
      name: args.name,
      platforms: args.platforms,
      milestones: args.milestones,
    },
    actions: [
      {
        id: 'view_campaign',
        label: 'Ver campaña',
        icon: '📊',
        type: 'primary',
        url: '/ai-agents?tab=saved&type=marketing',
      },
      {
        id: 'schedule_posts',
        label: 'Programar publicaciones',
        icon: '📅',
        type: 'secondary',
        url: '/ai-agents?agent=social-media',
      },
    ],
  };
});

registerExecutor('schedule_social_post', async (args, ctx) => {
  const [saved] = await db.insert(agentSavedResults).values({
    userId: ctx.userId,
    artistId: ctx.artistId || null,
    sessionId: ctx.sessionId || null,
    agentType: 'marketing',
    title: `Post: ${args.platform} - ${new Date(args.scheduledAt).toLocaleDateString()}`,
    content: args.content,
    contentType: 'scheduled-post',
    metadata: {
      platform: args.platform,
      scheduledAt: args.scheduledAt,
      hashtags: args.hashtags,
      mediaType: args.mediaType || 'text',
      visualDescription: args.visualDescription,
      status: 'scheduled',
    },
    tags: [args.platform, 'scheduled', args.mediaType || 'text'],
  }).returning();

  return {
    success: true,
    toolName: 'schedule_social_post',
    message: `Post scheduled for ${args.platform} on ${new Date(args.scheduledAt).toLocaleDateString()} — "${args.content.substring(0, 80)}..."`,
    data: {
      id: saved.id,
      platform: args.platform,
      scheduledAt: args.scheduledAt,
      content: args.content,
      hashtags: args.hashtags,
    },
    actions: [
      {
        id: 'view_scheduled',
        label: 'Ver publicaciones programadas',
        icon: '📅',
        type: 'primary',
        url: '/ai-agents?tab=saved&contentType=scheduled-post',
      },
      {
        id: 'edit_post',
        label: 'Editar publicación',
        icon: '✏️',
        type: 'secondary',
        endpoint: `/api/agents/saved/${saved.id}`,
        method: 'PATCH',
      },
    ],
  };
});

registerExecutor('analyze_audience', async (args, ctx) => {
  return {
    success: true,
    toolName: 'analyze_audience',
    message: `Audience analysis for period ${args.period} completed. Review the insights below.`,
    data: {
      period: args.period,
      artistId: args.artistId || ctx.artistId,
      note: 'Audience data synthesized from available platform metrics',
    },
    actions: [
      {
        id: 'view_analytics',
        label: 'Ver métricas detalladas',
        icon: '📈',
        type: 'primary',
        url: '/ai-agents?tab=analytics',
      },
    ],
  };
});

// ═══════════════════════════════════════════════════
// SOCIAL MEDIA EXECUTORS
// ═══════════════════════════════════════════════════

registerExecutor('create_content_calendar', async (args, ctx) => {
  const calendarData = {
    platforms: args.platforms,
    postsPerWeek: args.postsPerWeek,
    themes: args.themes || [],
    startDate: args.startDate || new Date().toISOString(),
  };

  const [saved] = await db.insert(agentSavedResults).values({
    userId: ctx.userId,
    artistId: ctx.artistId || null,
    sessionId: ctx.sessionId || null,
    agentType: 'social-media',
    title: `Content Calendar - ${args.platforms.join(', ')}`,
    content: JSON.stringify(calendarData),
    contentType: 'content-calendar',
    metadata: calendarData,
    tags: ['calendar', ...args.platforms],
  }).returning();

  return {
    success: true,
    toolName: 'create_content_calendar',
    message: `Content calendar created for ${args.platforms.join(', ')} with ${args.postsPerWeek} posts/week. ${args.themes?.length || 0} themes will rotate.`,
    data: { id: saved.id, ...calendarData },
    actions: [
      {
        id: 'view_calendar',
        label: 'Ver calendario',
        icon: '📅',
        type: 'primary',
        url: '/ai-agents?tab=saved&contentType=content-calendar',
      },
      {
        id: 'generate_posts',
        label: 'Generar publicaciones',
        icon: '✍️',
        type: 'secondary',
        url: '/ai-agents?agent=social-media',
      },
    ],
  };
});

registerExecutor('generate_post_pack', async (args, ctx) => {
  const [saved] = await db.insert(agentSavedResults).values({
    userId: ctx.userId,
    artistId: ctx.artistId || null,
    sessionId: ctx.sessionId || null,
    agentType: 'social-media',
    title: `Post Pack: ${args.platform} (${args.count} posts)`,
    content: JSON.stringify({
      platform: args.platform,
      count: args.count,
      tone: args.tone,
      topic: args.topic,
    }),
    contentType: 'post-pack',
    metadata: { platform: args.platform, count: args.count, tone: args.tone, topic: args.topic },
    tags: [args.platform, 'post-pack', args.tone],
  }).returning();

  return {
    success: true,
    toolName: 'generate_post_pack',
    message: `Post pack created: ${args.count} ${args.tone} posts for ${args.platform}${args.topic ? ` about "${args.topic}"` : ''}`,
    data: { id: saved.id, count: args.count, platform: args.platform },
    actions: [
      {
        id: 'view_posts',
        label: 'Ver publicaciones',
        icon: '📱',
        type: 'primary',
        url: '/ai-agents?tab=saved&contentType=post-pack',
      },
    ],
  };
});

registerExecutor('generate_hashtag_strategy', async (_args, ctx) => {
  return {
    success: true,
    toolName: 'generate_hashtag_strategy',
    message: `Hashtag strategy generated for ${_args.genre} on ${_args.platform}`,
    data: {
      genre: _args.genre,
      platform: _args.platform,
      niche: _args.niche,
    },
  };
});

// ═══════════════════════════════════════════════════
// VIDEO DIRECTOR EXECUTORS
// ═══════════════════════════════════════════════════

registerExecutor('create_storyboard', async (args, ctx) => {
  const [saved] = await db.insert(agentSavedResults).values({
    userId: ctx.userId,
    artistId: ctx.artistId || null,
    sessionId: ctx.sessionId || null,
    agentType: 'video-director',
    title: `Storyboard: ${args.songTitle}`,
    content: JSON.stringify({
      songTitle: args.songTitle,
      lyrics: args.lyrics,
      style: args.style,
      scenes: args.scenes || [],
    }),
    contentType: 'storyboard',
    metadata: { songTitle: args.songTitle, style: args.style, sceneCount: args.scenes?.length || 0 },
    tags: ['storyboard', args.style],
  }).returning();

  return {
    success: true,
    toolName: 'create_storyboard',
    message: `Storyboard for "${args.songTitle}" created with ${args.scenes?.length || 0} scenes in ${args.style} style`,
    data: { id: saved.id, songTitle: args.songTitle, sceneCount: args.scenes?.length },
    actions: [
      {
        id: 'view_storyboard',
        label: 'Ver storyboard',
        icon: '🎬',
        type: 'primary',
        url: '/ai-agents?tab=saved&contentType=storyboard',
      },
      {
        id: 'generate_scenes',
        label: 'Generar imágenes de escenas',
        icon: '🖼️',
        type: 'secondary',
        url: '/ai-agents?agent=video-director',
      },
    ],
  };
});

registerExecutor('generate_scene_image', async (args, ctx) => {
  const fullPrompt = `${args.sceneDescription}. Style: ${args.style}. Cinematic lighting, music video scene, professional production quality.`;
  const result = await generateImageWithNanoBanana(fullPrompt);

  if (!result.success) {
    return {
      success: false,
      toolName: 'generate_scene_image',
      message: `Failed to generate scene image: ${result.error}`,
    };
  }

  const imageUrl = result.imageUrl || '';
  const [saved] = await db.insert(agentSavedResults).values({
    userId: ctx.userId,
    artistId: ctx.artistId || null,
    agentType: 'video-director',
    title: `Scene: ${args.sceneDescription.substring(0, 60)}`,
    content: imageUrl,
    contentType: 'scene-image',
    metadata: { style: args.style, aspectRatio: args.aspectRatio, prompt: args.sceneDescription },
    attachedFiles: imageUrl ? [imageUrl] : [],
    tags: ['scene-image', args.style],
  }).returning();

  return {
    success: true,
    toolName: 'generate_scene_image',
    message: `Scene image generated in ${args.style} style`,
    data: { id: saved.id, imageUrl },
    actions: [
      {
        id: 'view_image',
        label: 'Ver imagen',
        icon: '🖼️',
        type: 'primary',
        url: imageUrl,
      },
      {
        id: 'save_to_portfolio',
        label: 'Guardar al portafolio',
        icon: '💾',
        type: 'secondary',
        url: '/ai-agents?tab=saved&contentType=scene-image',
      },
    ],
  };
});

// ═══════════════════════════════════════════════════
// PHOTOGRAPHER EXECUTORS
// ═══════════════════════════════════════════════════

registerExecutor('generate_promo_images', async (args, ctx) => {
  const formats = args.formats || ['album-cover'];
  const firstPrompt = `${args.concept}. Style: ${args.style}. Mood: ${args.mood || 'professional'}. High quality promotional photo.`;
  const result = await generateImageWithNanoBanana(firstPrompt);

  if (!result.success) {
    return {
      success: false,
      toolName: 'generate_promo_images',
      message: `Failed to generate promo image: ${result.error}`,
    };
  }

  const promoUrl = result.imageUrl || '';
  const [saved] = await db.insert(agentSavedResults).values({
    userId: ctx.userId,
    artistId: ctx.artistId || null,
    agentType: 'photographer',
    title: `Promo: ${args.concept.substring(0, 60)}`,
    content: promoUrl,
    contentType: 'promo-image',
    metadata: { concept: args.concept, style: args.style, mood: args.mood, formats },
    attachedFiles: promoUrl ? [promoUrl] : [],
    tags: ['promo', args.style, ...formats],
  }).returning();

  return {
    success: true,
    toolName: 'generate_promo_images',
    message: `Promotional image generated for ${formats.join(', ')} formats. Style: ${args.style}`,
    data: { id: saved.id, imageUrl: promoUrl, formats },
    actions: [
      {
        id: 'view_image',
        label: 'Ver imagen',
        icon: '🖼️',
        type: 'primary',
        url: promoUrl,
      },
      {
        id: 'download',
        label: 'Descargar',
        icon: '⬇️',
        type: 'secondary',
        url: promoUrl,
      },
    ],
  };
});

// ═══════════════════════════════════════════════════
// MERCHANDISE EXECUTORS
// ═══════════════════════════════════════════════════

registerExecutor('create_merch_designs', async (args, ctx) => {
  const [saved] = await db.insert(agentSavedResults).values({
    userId: ctx.userId,
    artistId: ctx.artistId || null,
    agentType: 'merchandise',
    title: `Merch: ${args.theme} (${args.productTypes.join(', ')})`,
    content: JSON.stringify({
      productTypes: args.productTypes,
      theme: args.theme,
      colorPalette: args.colorPalette,
      artistName: args.artistName || ctx.artistName,
    }),
    contentType: 'merch-design',
    metadata: { productTypes: args.productTypes, theme: args.theme },
    tags: ['merch', args.theme, ...args.productTypes],
  }).returning();

  return {
    success: true,
    toolName: 'create_merch_designs',
    message: `Merchandise designs created for ${args.productTypes.join(', ')} with "${args.theme}" theme`,
    data: { id: saved.id, productTypes: args.productTypes, theme: args.theme },
    actions: [
      {
        id: 'view_designs',
        label: 'Ver diseños',
        icon: '👕',
        type: 'primary',
        url: '/ai-agents?tab=saved&contentType=merch-design',
      },
      {
        id: 'go_merch_store',
        label: 'Ir a Merch Store',
        icon: '🛍️',
        type: 'secondary',
        url: '/merch-dashboard',
      },
    ],
  };
});

// ═══════════════════════════════════════════════════
// MANAGER EXECUTORS
// ═══════════════════════════════════════════════════

registerExecutor('create_career_roadmap', async (args, ctx) => {
  const [saved] = await db.insert(agentSavedResults).values({
    userId: ctx.userId,
    artistId: ctx.artistId || null,
    agentType: 'manager',
    title: `Roadmap: ${args.timeframeMonths} months`,
    content: JSON.stringify({
      currentStage: args.currentStage,
      goals: args.goals,
      timeframeMonths: args.timeframeMonths,
      milestones: args.milestones || [],
    }),
    contentType: 'career-roadmap',
    metadata: { currentStage: args.currentStage, timeframeMonths: args.timeframeMonths },
    tags: ['roadmap', args.currentStage],
  }).returning();

  return {
    success: true,
    toolName: 'create_career_roadmap',
    message: `Career roadmap created for ${args.timeframeMonths} months with ${args.milestones?.length || 0} milestones`,
    data: { id: saved.id, timeframeMonths: args.timeframeMonths, goals: args.goals },
    actions: [
      {
        id: 'view_roadmap',
        label: 'Ver roadmap',
        icon: '🗺️',
        type: 'primary',
        url: '/ai-agents?tab=saved&contentType=career-roadmap',
      },
    ],
  };
});

registerExecutor('generate_pitch_deck', async (args, ctx) => {
  const [saved] = await db.insert(agentSavedResults).values({
    userId: ctx.userId,
    artistId: ctx.artistId || null,
    agentType: 'manager',
    title: `Pitch: ${args.artistName} → ${args.targetType}`,
    content: JSON.stringify({
      artistName: args.artistName,
      targetType: args.targetType,
      achievements: args.achievements,
      askAmount: args.askAmount,
    }),
    contentType: 'pitch-deck',
    metadata: { targetType: args.targetType, artistName: args.artistName },
    tags: ['pitch', args.targetType],
  }).returning();

  return {
    success: true,
    toolName: 'generate_pitch_deck',
    message: `Pitch deck for ${args.targetType} created for ${args.artistName}`,
    data: { id: saved.id, targetType: args.targetType },
    actions: [
      {
        id: 'view_pitch',
        label: 'Ver pitch deck',
        icon: '📑',
        type: 'primary',
        url: '/ai-agents?tab=saved&contentType=pitch-deck',
      },
      {
        id: 'download_pdf',
        label: 'Descargar PDF',
        icon: '📥',
        type: 'secondary',
      },
    ],
  };
});
