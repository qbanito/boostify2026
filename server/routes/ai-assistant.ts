import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import fileUpload from 'express-fileupload';
import fs from 'fs/promises';
import path from 'path';
import { generateImageWithNanoBanana, editImageWithNanoBanana } from '../services/fal-service';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

// Initialize OpenAI client (for text generation)
const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// Preset artistic prompts for cover generation
const COVER_PROMPTS = [
  {
    id: 'vibrant-concert',
    name: 'Vibrant Concert',
    prompt: 'Create a vibrant, energetic concert scene with stage lights, crowd silhouettes, and dynamic colors. Professional music artist cover art style, high quality, artistic, modern.'
  },
  {
    id: 'minimalist-modern',
    name: 'Minimalist Modern',
    prompt: 'Create a minimalist, modern artistic portrait with clean geometric shapes, bold colors, and professional music artist aesthetic. Contemporary design, high quality.'
  },
  {
    id: 'urban-street',
    name: 'Urban Street Art',
    prompt: 'Create an urban street art style cover with graffiti elements, bold colors, and hip-hop/urban music aesthetic. Professional artist cover, artistic, vibrant.'
  },
  {
    id: 'neon-futuristic',
    name: 'Neon Futuristic',
    prompt: 'Create a futuristic neon-lit scene with cyberpunk aesthetic, electric colors, and modern music vibe. Professional artist cover art, high quality, artistic.'
  },
  {
    id: 'vintage-retro',
    name: 'Vintage Retro',
    prompt: 'Create a vintage retro-style cover with warm tones, classic music aesthetic, and nostalgic vibe. Professional artist artwork, high quality, artistic.'
  },
  {
    id: 'abstract-artistic',
    name: 'Abstract Artistic',
    prompt: 'Create an abstract artistic composition with flowing shapes, bold colors, and creative music industry aesthetic. Professional cover art, modern, high quality.'
  }
];

// POST /api/ai/enrich-profile - AI-powered profile enrichment
router.post('/enrich-profile', authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUid = req.user!.uid || req.user!.id;
    const { artistName } = req.body;
    
    // Find user in PostgreSQL
    const [user] = await db.select().from(users).where(eq(users.username, firebaseUid)).limit(1);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userId = user.id;

    if (!artistName || typeof artistName !== 'string' || artistName.trim() === '') {
      return res.status(400).json({ message: 'Artist name is required' });
    }

    // Use Gemini to search for artist information
    
    const prompt = `Search for information about the music artist "${artistName}". 
    Provide a JSON response with the following structure (if information is not available, use null):
    {
      "realName": "Artist's real name",
      "country": "Country of origin",
      "genres": ["genre1", "genre2", "genre3"],
      "biography": "Short biography (2-3 sentences)",
      "website": "Official website URL",
      "spotifyUrl": "Spotify artist URL",
      "instagramHandle": "Instagram handle without @",
      "twitterHandle": "Twitter/X handle without @",
      "youtubeChannel": "YouTube channel URL",
      "facebookUrl": "Facebook page URL",
      "tiktokUrl": "TikTok profile URL",
      "topYoutubeVideos": [
        {
          "title": "Video title",
          "url": "YouTube video URL",
          "thumbnailUrl": "Thumbnail image URL",
          "type": "official_music_video or lyric_video or live_performance"
        }
      ],
      "concerts": {
        "upcoming": [
          {
            "tourName": "Tour name",
            "location": {
              "city": "City",
              "country": "Country",
              "venue": "Venue name"
            },
            "date": "YYYY-MM-DD",
            "status": "scheduled",
            "source": "ticketmaster"
          }
        ],
        "highlights": [
          {
            "eventName": "Notable tour or concert",
            "year": 2024,
            "note": "Brief description"
          }
        ]
      }
    }
    
    Only return valid JSON. If you cannot find information for a field, set it to null or empty array.`;

    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that provides accurate information about music artists in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
    });
    const text = response.choices[0]?.message?.content || '';
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ message: 'Failed to extract data from AI response' });
    }

    const enrichedData = JSON.parse(jsonMatch[0]);

    // Update user profile with enriched data
    const updateData: any = {
      ...(enrichedData.realName && { realName: enrichedData.realName }),
      ...(enrichedData.country && { country: enrichedData.country }),
      ...(enrichedData.genres && enrichedData.genres.length > 0 && { genres: enrichedData.genres }),
      ...(enrichedData.biography && { biography: enrichedData.biography }),
      ...(enrichedData.website && { website: enrichedData.website }),
      ...(enrichedData.spotifyUrl && { spotifyUrl: enrichedData.spotifyUrl }),
      ...(enrichedData.instagramHandle && { instagramHandle: enrichedData.instagramHandle }),
      ...(enrichedData.twitterHandle && { twitterHandle: enrichedData.twitterHandle }),
      ...(enrichedData.youtubeChannel && { youtubeChannel: enrichedData.youtubeChannel }),
      ...(enrichedData.facebookUrl && { facebookUrl: enrichedData.facebookUrl }),
      ...(enrichedData.tiktokUrl && { tiktokUrl: enrichedData.tiktokUrl }),
      ...(enrichedData.topYoutubeVideos && { topYoutubeVideos: enrichedData.topYoutubeVideos }),
      ...(enrichedData.concerts && { concerts: enrichedData.concerts }),
    };

    if (Object.keys(updateData).length > 0) {
      await db.update(users).set(updateData).where(eq(users.id, userId));
    }

    res.json({
      message: 'Profile enriched successfully',
      data: enrichedData
    });
  } catch (error: any) {
    console.error('Error enriching profile:', error);
    res.status(500).json({ 
      message: 'Error enriching profile', 
      error: error.message 
    });
  }
});

// GET /api/ai/cover-prompts - Get available cover generation prompts
router.get('/cover-prompts', authenticate, async (_req: Request, res: Response) => {
  res.json({ prompts: COVER_PROMPTS });
});

// POST /api/ai/generate-profile-auto-blocks - Generate catchy default banner + text blocks
router.post('/generate-profile-auto-blocks', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      artistId,
      artistName,
      biography,
      genre,
      location,
      latestSingleTitle,
      latestSingleDescription,
      selectedTheme,
      accentColor,
      primaryColor,
    } = req.body || {};

    if (!artistId || !artistName || !biography) {
      return res.status(400).json({ message: 'artistId, artistName and biography are required' });
    }

    const rawUserId = String(req.user?.id || req.user?.uid || '');
    const numericUserId = /^\d+$/.test(rawUserId) ? Number(rawUserId) : 0;
    const clerkUserId = rawUserId; // Clerk middleware sets req.user.id = clerkUserId

    let artist: any;
    const isNumericId = /^\d+$/.test(String(artistId));
    if (isNumericId) {
      const [byNumeric] = await db
        .select()
        .from(users)
        .where(eq(users.id, Number(artistId)))
        .limit(1);
      artist = byNumeric;
    } else {
      const [byFirestore] = await db
        .select()
        .from(users)
        .where(eq(users.firestoreId, String(artistId)))
        .limit(1);
      artist = byFirestore;
    }

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Resolve a numeric pg user id from Clerk id when needed
    let pgUserId = numericUserId;
    if (!pgUserId && clerkUserId) {
      try {
        const [byClerk] = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, clerkUserId))
          .limit(1);
        if (byClerk?.id) pgUserId = Number(byClerk.id);
      } catch {}
    }

    const isAdmin = Boolean((req.user as any)?.isAdmin);
    const isGeneratedByUser = pgUserId > 0 && Number(artist.generatedBy) === pgUserId;
    const isArtistSameUser = pgUserId > 0 && Number(artist.id) === pgUserId;
    const isOwnProfile =
      (clerkUserId && String(artist.clerkId || '') === clerkUserId) ||
      (clerkUserId && String(artist.firestoreId || '') === clerkUserId) ||
      (clerkUserId && String(artist.username || '') === clerkUserId);

    if (!isAdmin && !isGeneratedByUser && !isArtistSameUser && !isOwnProfile) {
      console.warn('[ai/auto-blocks] auth fail', {
        clerkUserId,
        pgUserId,
        artistId: artist.id,
        artistGeneratedBy: artist.generatedBy,
        artistClerkId: artist.clerkId,
        artistFirestoreId: artist.firestoreId,
      });
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const prompt = [
      'Generate compelling copy for an artist profile page.',
      'Return ONLY valid JSON with this EXACT structure (no extra keys):',
      '{',
      '  "bannerTitle": "short catchy title (max 70 chars) — NO quotes inside",',
      '  "bannerSubtitle": "energetic subtitle in 1-2 lines (max 180 chars)",',
      '  "ctaLabel": "2-4 words CTA",',
      '  "textHeading": "short heading (max 60 chars)",',
      '  "textBody": "90-150 words artist story in a persuasive, premium tone — NO markdown",',
      '  "iconName": "one of: sparkles, flame, rocket, music, crown, zap, star",',
      '  "genreVibe": "one single word describing the energy: dark|vibrant|ethereal|explosive|smooth|raw|elegant|futuristic|nostalgic|rebellious",',
      '  "decorativeSymbol": "one Unicode symbol that fits the genre: ◆ ✦ ♪ ⚡ ◈ ◉ ★ ♡ ⬡ ◌ ✺ ⬖"',
      '}',
      'Rules: highly engaging, modern, emotionally strong for fans. No markdown. No placeholders.',
      '',
      `Artist name: ${String(artistName).trim()}`,
      `Biography: ${String(biography).trim()}`,
      `Genre: ${String(genre || '').trim()}`,
      `Location: ${String(location || '').trim()}`,
      `Latest single: ${String(latestSingleTitle || '').trim()}`,
      `Single context: ${String(latestSingleDescription || '').trim()}`,
      `Selected theme: ${String(selectedTheme || '').trim()}`,
      `Accent color: ${String(accentColor || '').trim()}`,
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.88,
      messages: [
        {
          role: 'system',
          content: 'You are a senior music branding copywriter. Produce concise, high-impact copy that feels alive and genre-authentic.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    const safeIconNames = new Set(['sparkles', 'flame', 'rocket', 'music', 'crown', 'zap', 'star']);
    const iconName = safeIconNames.has(parsed.iconName) ? parsed.iconName : 'sparkles';

    const safeVibes = new Set(['dark', 'vibrant', 'ethereal', 'explosive', 'smooth', 'raw', 'elegant', 'futuristic', 'nostalgic', 'rebellious']);
    const genreVibe = safeVibes.has(parsed.genreVibe) ? parsed.genreVibe : 'vibrant';

    // Whitelist safe unicode symbols (no script injection)
    const safeSymbols = new Set(['◆', '✦', '♪', '⚡', '◈', '◉', '★', '♡', '⬡', '◌', '✺', '⬖']);
    const decorativeSymbol = safeSymbols.has(String(parsed.decorativeSymbol || '').trim())
      ? String(parsed.decorativeSymbol).trim()
      : '✦';

    return res.json({
      bannerTitle: String(parsed.bannerTitle || `New Era: ${artistName}`),
      bannerSubtitle: String(parsed.bannerSubtitle || 'Discover the sound, the vision, and the next chapter.'),
      ctaLabel: String(parsed.ctaLabel || 'Listen Now'),
      textHeading: String(parsed.textHeading || 'The Story Behind The Sound'),
      textBody: String(parsed.textBody || String(biography).slice(0, 240)),
      iconName,
      genreVibe,
      decorativeSymbol,
    });
  } catch (error: any) {
    console.error('Error generating profile auto blocks:', error);
    return res.status(500).json({
      message: 'Error generating profile auto blocks',
      error: error?.message || 'Unknown error',
    });
  }
});

// POST /api/ai/generate-cover - Generate artistic cover image
router.post('/generate-cover', authenticate, async (req: any, res: Response) => {
  try {
    const firebaseUid = req.user!.uid || req.user!.id;
    const { promptId, customPrompt, artistName } = req.body;
    
    // Find user in PostgreSQL
    const [user] = await db.select().from(users).where(eq(users.username, firebaseUid)).limit(1);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userId = user.id;

    // Get the prompt template
    let basePrompt = '';
    if (promptId) {
      const preset = COVER_PROMPTS.find(p => p.id === promptId);
      if (!preset) {
        return res.status(400).json({ message: 'Invalid prompt ID' });
      }
      basePrompt = preset.prompt;
    } else if (customPrompt) {
      basePrompt = customPrompt;
    } else {
      return res.status(400).json({ message: 'Either promptId or customPrompt is required' });
    }

    // Add artist name to the prompt
    const finalPrompt = artistName 
      ? `${basePrompt} Incorporate the essence and style of artist "${artistName}".`
      : basePrompt;

    // Generate image with FAL nano-banana
    let result;
    
    if (req.files && req.files.referenceImage) {
      // If there's a reference image, use editImageWithNanoBanana
      const file = Array.isArray(req.files.referenceImage) 
        ? req.files.referenceImage[0] 
        : req.files.referenceImage;
      
      // Convert to base64 data URL
      const base64Data = file.data.toString('base64');
      const referenceUrl = `data:${file.mimetype};base64,${base64Data}`;
      
      result = await editImageWithNanoBanana([referenceUrl], `Using this reference image as inspiration, ${finalPrompt}`);
    } else {
      // No reference image, generate from scratch
      result = await generateImageWithNanoBanana(finalPrompt, '1:1');
    }
    
    if (!result.success || !result.imageUrl) {
      return res.status(500).json({ message: result.error || 'Failed to generate image' });
    }

    // Save the generated image locally
    const uploadsDir = path.join(process.cwd(), 'uploads', 'covers', userId.toString());
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = `cover-${Date.now()}.png`;
    const filepath = path.join(uploadsDir, filename);
    
    // Download the image from FAL and save locally
    const imageResponse = await fetch(result.imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    await fs.writeFile(filepath, imageBuffer);

    const imageUrl = `/uploads/covers/${userId}/${filename}`;

    res.json({
      message: 'Cover image generated successfully',
      imageUrl
    });
  } catch (error: any) {
    console.error('Error generating cover:', error);
    res.status(500).json({ 
      message: 'Error generating cover image', 
      error: error.message 
    });
  }
});

export default router;
