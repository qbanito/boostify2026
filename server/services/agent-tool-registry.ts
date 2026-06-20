/**
 * Agent Tool Registry — Defines executable tools that OpenAI function calling can invoke
 * Each tool has: name, description, parameters schema, and an execute() function
 * 
 * This is the CORE system that transforms agents from "text generators" to "action executors"
 */
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

// ═══════════════════════════════════════════════════
// TOOL RESULT TYPES
// ═══════════════════════════════════════════════════

export interface ToolResult {
  success: boolean;
  toolName: string;
  data?: any;
  message: string;
  /** Actions the user can take on this result */
  actions?: ToolAction[];
}

export interface ToolAction {
  id: string;
  label: string;
  icon: string; // emoji
  type: 'primary' | 'secondary' | 'destructive';
  /** API endpoint to call when user clicks */
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  payload?: Record<string, any>;
  /** Or a URL to open */
  url?: string;
  /** Whether to confirm before executing */
  confirm?: boolean;
  confirmMessage?: string;
}

// ═══════════════════════════════════════════════════
// TOOL DEFINITIONS (OpenAI Function Calling schema)
// ═══════════════════════════════════════════════════

export const AGENT_TOOLS: Record<string, ChatCompletionTool[]> = {
  // ── COMPOSER TOOLS ──
  composer: [
    {
      type: 'function',
      function: {
        name: 'save_lyrics',
        description: 'Save generated lyrics to the artist project. Returns a saved lyrics object with ID.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Song title' },
            lyrics: { type: 'string', description: 'Full lyrics text' },
            genre: { type: 'string', description: 'Music genre' },
            mood: { type: 'string', description: 'Song mood/emotion' },
            language: { type: 'string', enum: ['english', 'spanish', 'portuguese', 'french'], description: 'Lyrics language' },
            structure: { type: 'string', description: 'Song structure (verse-chorus, AABA, etc.)' },
          },
          required: ['title', 'lyrics', 'genre'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'generate_music_audio',
        description: 'Generate an actual audio track from lyrics and parameters using AI music generation. Returns an audio URL.',
        parameters: {
          type: 'object',
          properties: {
            lyrics: { type: 'string', description: 'Lyrics to set to music' },
            genre: { type: 'string', description: 'Music genre' },
            tempo: { type: 'number', description: 'BPM tempo' },
            mood: { type: 'string', description: 'Mood for the music' },
          },
          required: ['lyrics', 'genre'],
        },
      },
    },
  ],

  // ── MARKETING TOOLS ──
  marketing: [
    {
      type: 'function',
      function: {
        name: 'create_campaign',
        description: 'Create a marketing campaign with a timeline of scheduled actions. Saves to database and returns campaign plan.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Campaign name' },
            goal: { type: 'string', description: 'Campaign goal' },
            startDate: { type: 'string', description: 'Start date ISO string' },
            durationDays: { type: 'number', description: 'Campaign duration in days' },
            platforms: { type: 'array', items: { type: 'string' }, description: 'Target platforms' },
            budget: { type: 'string', description: 'Budget description' },
            milestones: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  day: { type: 'number' },
                  action: { type: 'string' },
                  platform: { type: 'string' },
                },
              },
              description: 'List of campaign milestones/actions',
            },
          },
          required: ['name', 'goal', 'platforms'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'schedule_social_post',
        description: 'Schedule a social media post for a specific date and platform. Saves to post queue.',
        parameters: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: ['instagram', 'tiktok', 'twitter', 'youtube', 'facebook'], description: 'Social platform' },
            content: { type: 'string', description: 'Post text content' },
            hashtags: { type: 'array', items: { type: 'string' }, description: 'Hashtags' },
            scheduledAt: { type: 'string', description: 'Scheduled datetime ISO string' },
            mediaType: { type: 'string', enum: ['text', 'image', 'video', 'carousel', 'reel', 'story'], description: 'Media type' },
            visualDescription: { type: 'string', description: 'Description of visual content needed' },
          },
          required: ['platform', 'content', 'scheduledAt'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'analyze_audience',
        description: 'Analyze the artist\'s current audience demographics and engagement metrics from available data.',
        parameters: {
          type: 'object',
          properties: {
            artistId: { type: 'number', description: 'Artist ID to analyze' },
            period: { type: 'string', enum: ['7d', '30d', '90d', '1y'], description: 'Analysis period' },
          },
          required: ['period'],
        },
      },
    },
  ],

  // ── SOCIAL MEDIA TOOLS ──
  'social-media': [
    {
      type: 'function',
      function: {
        name: 'create_content_calendar',
        description: 'Create a full content calendar with scheduled posts for the next 30 days. Each entry has date, platform, content type, and post text.',
        parameters: {
          type: 'object',
          properties: {
            platforms: { type: 'array', items: { type: 'string' }, description: 'Target platforms' },
            postsPerWeek: { type: 'number', description: 'Posts per week per platform' },
            themes: { type: 'array', items: { type: 'string' }, description: 'Content themes to rotate' },
            startDate: { type: 'string', description: 'Calendar start date' },
          },
          required: ['platforms', 'postsPerWeek'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'generate_post_pack',
        description: 'Generate a pack of ready-to-publish social media posts (text + image descriptions). Returns 5-10 posts ready for review.',
        parameters: {
          type: 'object',
          properties: {
            platform: { type: 'string', description: 'Target platform' },
            count: { type: 'number', description: 'Number of posts to generate (max 10)' },
            tone: { type: 'string', enum: ['casual', 'professional', 'fun', 'inspiring', 'provocative'], description: 'Content tone' },
            topic: { type: 'string', description: 'Theme or topic for the posts' },
          },
          required: ['platform', 'count', 'tone'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'generate_hashtag_strategy',
        description: 'Generate an optimized hashtag strategy with primary, secondary, and niche hashtags.',
        parameters: {
          type: 'object',
          properties: {
            genre: { type: 'string', description: 'Music genre' },
            platform: { type: 'string', description: 'Target platform' },
            niche: { type: 'string', description: 'Specific niche within genre' },
          },
          required: ['genre', 'platform'],
        },
      },
    },
  ],

  // ── VIDEO DIRECTOR TOOLS ──
  'video-director': [
    {
      type: 'function',
      function: {
        name: 'create_storyboard',
        description: 'Create a detailed storyboard with scene descriptions, camera angles, and timing for each shot.',
        parameters: {
          type: 'object',
          properties: {
            songTitle: { type: 'string', description: 'Song title' },
            lyrics: { type: 'string', description: 'Song lyrics' },
            style: { type: 'string', description: 'Visual style' },
            scenes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timeStart: { type: 'string' },
                  timeEnd: { type: 'string' },
                  description: { type: 'string' },
                  cameraAngle: { type: 'string' },
                  lighting: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
              description: 'Scene breakdown',
            },
          },
          required: ['songTitle', 'style'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'generate_scene_image',
        description: 'Generate a concept image for a specific scene using AI image generation.',
        parameters: {
          type: 'object',
          properties: {
            sceneDescription: { type: 'string', description: 'Detailed visual description of the scene' },
            style: { type: 'string', description: 'Art style (cinematic, anime, photorealistic, etc.)' },
            aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5'], description: 'Image aspect ratio' },
          },
          required: ['sceneDescription', 'style'],
        },
      },
    },
  ],

  // ── PHOTOGRAPHER TOOLS ──
  photographer: [
    {
      type: 'function',
      function: {
        name: 'generate_promo_images',
        description: 'Generate a pack of promotional images optimized for different platforms (1 cover + social variants).',
        parameters: {
          type: 'object',
          properties: {
            concept: { type: 'string', description: 'Visual concept description' },
            style: { type: 'string', description: 'Photography style' },
            mood: { type: 'string', description: 'Photo mood' },
            formats: {
              type: 'array',
              items: { type: 'string', enum: ['album-cover', 'instagram-post', 'instagram-story', 'youtube-thumbnail', 'twitter-header', 'facebook-cover'] },
              description: 'Image format variants to generate',
            },
          },
          required: ['concept', 'style'],
        },
      },
    },
  ],

  // ── MERCHANDISE TOOLS ──
  merchandise: [
    {
      type: 'function',
      function: {
        name: 'create_merch_designs',
        description: 'Generate merchandise design mockups with descriptions and pricing suggestions.',
        parameters: {
          type: 'object',
          properties: {
            productTypes: {
              type: 'array',
              items: { type: 'string', enum: ['tshirt', 'hoodie', 'poster', 'hat', 'tote-bag', 'phone-case', 'vinyl', 'sticker-pack'] },
              description: 'Product types to design',
            },
            theme: { type: 'string', description: 'Design theme' },
            colorPalette: { type: 'array', items: { type: 'string' }, description: 'Color palette' },
            artistName: { type: 'string', description: 'Artist name for branding' },
          },
          required: ['productTypes', 'theme'],
        },
      },
    },
  ],

  // ── MANAGER TOOLS ──
  manager: [
    {
      type: 'function',
      function: {
        name: 'create_career_roadmap',
        description: 'Create a structured career roadmap with milestones, deadlines, and KPIs.',
        parameters: {
          type: 'object',
          properties: {
            currentStage: { type: 'string', description: 'Current career stage' },
            goals: { type: 'array', items: { type: 'string' }, description: 'Career goals' },
            timeframeMonths: { type: 'number', description: 'Roadmap timeframe in months' },
            milestones: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  month: { type: 'number' },
                  milestone: { type: 'string' },
                  kpi: { type: 'string' },
                  actions: { type: 'array', items: { type: 'string' } },
                },
              },
              description: 'Career milestones',
            },
          },
          required: ['currentStage', 'goals', 'timeframeMonths'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'generate_pitch_deck',
        description: 'Generate a professional pitch deck outline for labels, sponsors, or investors.',
        parameters: {
          type: 'object',
          properties: {
            artistName: { type: 'string', description: 'Artist name' },
            targetType: { type: 'string', enum: ['label', 'sponsor', 'investor', 'venue', 'festival'], description: 'Who the pitch is for' },
            achievements: { type: 'array', items: { type: 'string' }, description: 'Key achievements' },
            askAmount: { type: 'string', description: 'What is being requested' },
          },
          required: ['artistName', 'targetType'],
        },
      },
    },
  ],
};

// ═══════════════════════════════════════════════════
// GET TOOLS FOR AN AGENT TYPE
// ═══════════════════════════════════════════════════

export function getToolsForAgent(agentType: string): ChatCompletionTool[] {
  return AGENT_TOOLS[agentType] || [];
}

export function getAllToolNames(agentType: string): string[] {
  return getToolsForAgent(agentType).map(t => t.function.name);
}
