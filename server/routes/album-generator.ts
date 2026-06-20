import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { users, songs } from '../db/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

// Initialize OpenAI client
const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// FAL AI Client
const FAL_API_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || "";

// Genre to color mapping
const genreColors: Record<string, string> = {
  'pop': '#FF6B35',
  'hip-hop': '#1A1A1A',
  'rap': '#00AA00',
  'rock': '#8B0000',
  'indie': '#9370DB',
  'folk': '#8B7355',
  'country': '#CD853F',
  'electronic': '#00CED1',
  'edm': '#00BFFF',
  'classical': '#FFD700',
  'jazz': '#800080',
  'r&b': '#4B0082',
  'reggae': '#228B22',
  'soul': '#DC143C',
  'funk': '#FFB6C1',
  'latin': '#FF8C00',
  'k-pop': '#FF1493',
  'afrobeats': '#FF69B4',
  'ambient': '#20B2AA',
  'trap': '#000000',
};

// Helper: Generate music with FAL/Udio
async function generateMusicWithFAL(title: string, lyrics: string, style: string, mood: string): Promise<string | null> {
  try {
    console.log(`🎵 Generating audio for "${title}" using FAL...`);
    
    const payload = {
      prompt: `${title} - ${lyrics.substring(0, 200)}. Style: ${style}. Mood: ${mood}. Duration: 3 minutes.`,
      duration: 180,
      model: "flow-match",
    };

    // Call FAL API
    const response = await axios.post('https://fal.run/fal-ai/udio-generate', payload, {
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    });

    const audioUrl = response.data?.audio_url || response.data?.output?.audio_url;
    
    if (audioUrl) {
      console.log(`✅ Audio generated: ${audioUrl}`);
      return audioUrl;
    } else {
      console.warn('⚠️ No audio URL in FAL response');
      return null;
    }
  } catch (error: any) {
    console.error('❌ FAL audio generation failed:', error.message);
    return null;
  }
}

// POST /api/generate-album
router.post('/generate-album', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { artistName, biography, profileImage } = req.body;

    if (!artistName || !biography) {
      return res.status(400).json({ message: 'Artist name and biography are required' });
    }

    console.log(`🎵 Generating album for ${artistName} (User ${userId})...`);

    // Generate 3 songs using Gemini (not 10)
    const songPrompt = `You are an expert music producer and songwriter. Based on the artist "${artistName}" with this bio: "${biography}", generate a JSON object for exactly 3 ORIGINAL hit songs.

IMPORTANT: 
- Make each song title UNIQUE and catchy (no repeats)
- Generate COMPLETE song lyrics (12-15 lines each, suitable for 3-min songs)
- Include realistic music style/genre
- Include mood/vibe

Return ONLY valid JSON (no markdown, no code blocks, just raw JSON):
{
  "albumTitle": "string (creative album name)",
  "genre": "string (main genre from the bio)",
  "releaseDate": "2025-01-15",
  "songs": [
    {"title": "string", "lyrics": "string", "style": "string", "mood": "string"},
    ... (exactly 3 different songs)
  ]
}

Rules:
1. Each song must have unique title
2. Lyrics must be real song lyrics, not descriptions
3. All values must be strings
4. Return ONLY JSON, nothing else
5. Generate exactly 3 songs - no more, no less`;

    let songText = '';
    try {
      const completion = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert music producer and songwriter. Return ONLY valid JSON without markdown code blocks.'
          },
          {
            role: 'user',
            content: songPrompt
          }
        ],
        temperature: 0.8,
        max_tokens: 4000,
      });
      songText = completion.choices[0]?.message?.content || '';
    } catch (openaiError: any) {
      console.error('🔴 OpenAI API error:', openaiError);
      return res.status(500).json({ 
        message: 'Failed to generate album content',
        error: openaiError.message 
      });
    }

    console.log('📝 OpenAI response length:', songText.length);

    // Extract JSON from response
    const jsonMatch = songText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ Could not extract JSON from response:', songText.substring(0, 500));
      return res.status(500).json({ message: 'Failed to parse album data from AI response' });
    }

    let albumData;
    try {
      albumData = JSON.parse(jsonMatch[0]);
    } catch (parseError: any) {
      console.error('❌ JSON Parse error:', parseError);
      console.error('Failed JSON:', jsonMatch[0].substring(0, 500));
      return res.status(500).json({ message: 'Invalid JSON from AI response' });
    }

    // Validate album data
    if (!albumData.albumTitle || !albumData.genre || !albumData.songs || !Array.isArray(albumData.songs)) {
      return res.status(500).json({ message: 'Invalid album data structure' });
    }

    if (albumData.songs.length !== 3) {
      console.warn(`⚠️ Expected 3 songs, got ${albumData.songs.length}. Using first 3.`);
      albumData.songs = albumData.songs.slice(0, 3);
    }

    // Generate audio for each of the 3 songs
    console.log('🎵 Starting audio generation for 3 songs...');
    const songsWithAudio = [];
    
    for (let i = 0; i < albumData.songs.length; i++) {
      const song = albumData.songs[i];
      console.log(`⏳ Generating audio ${i + 1}/3 for "${song.title}"...`);
      
      const audioUrl = await generateMusicWithFAL(song.title, song.lyrics, song.style, song.mood);
      
      if (audioUrl) {
        // Save to database
        try {
          const [savedSong] = await db
            .insert(songs)
            .values({
              userId,
              title: song.title,
              description: `${song.style} - ${song.mood}`,
              audioUrl,
              genre: song.style,
              duration: '180',
              coverArt: profileImage || null,
              isPublished: true,
            })
            .returning();
          
          songsWithAudio.push({
            ...song,
            audioUrl,
            songId: savedSong.id,
          });
          
          console.log(`✅ Song saved: ${song.title} (ID: ${savedSong.id})`);
        } catch (dbError: any) {
          console.error(`❌ DB Error saving song: ${dbError.message}`);
          songsWithAudio.push({ ...song, audioUrl, songId: null });
        }
      } else {
        console.warn(`⚠️ No audio generated for ${song.title}, using placeholder`);
        songsWithAudio.push({ ...song, audioUrl: '', songId: null });
      }
      
      // Small delay between API calls
      if (i < albumData.songs.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Determine color based on genre
    const genre = albumData.genre.toLowerCase();
    let coverColor = '#FF6B35';
    
    for (const [key, color] of Object.entries(genreColors)) {
      if (genre.includes(key)) {
        coverColor = color;
        break;
      }
    }

    console.log(`✅ Album generated: "${albumData.albumTitle}" (${albumData.genre})`);
    console.log(`🎨 Cover color: ${coverColor}`);

    res.json({
      success: true,
      albumData: {
        albumTitle: albumData.albumTitle,
        genre: albumData.genre,
        releaseDate: albumData.releaseDate || new Date().toISOString().split('T')[0],
        songs: songsWithAudio.map((song: any) => ({
          title: song.title || 'Untitled',
          lyrics: song.lyrics || '',
          style: song.style || albumData.genre,
          mood: song.mood || 'Energetic',
          audioUrl: song.audioUrl || '',
          songId: song.songId,
        })),
      },
      coverColor,
    });
  } catch (error: any) {
    console.error('❌ Album generation error:', error);
    res.status(500).json({ 
      message: 'Error generating album',
      error: error.message 
    });
  }
});

// DELETE /api/album-songs/:songId - Delete generated song
router.delete('/album-songs/:songId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const songId = parseInt(req.params.songId);

    if (!songId) {
      return res.status(400).json({ message: 'Song ID is required' });
    }

    // Check if song belongs to user
    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song || song.userId !== userId) {
      return res.status(403).json({ message: 'You do not have permission to delete this song' });
    }

    // Delete song
    await db.delete(songs).where(eq(songs.id, songId));

    console.log(`✅ Song deleted: ${song.title} (ID: ${songId})`);
    res.json({ success: true, message: 'Song deleted successfully' });
  } catch (error: any) {
    console.error('❌ Delete song error:', error);
    res.status(500).json({ message: 'Error deleting song' });
  }
});

// POST /api/album-songs/:songId/regenerate - Regenerate specific song
router.post('/album-songs/:songId/regenerate', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const songId = parseInt(req.params.songId);
    const { title, lyrics, style, mood } = req.body;

    if (!songId || !title || !lyrics) {
      return res.status(400).json({ message: 'Song ID, title, and lyrics are required' });
    }

    // Check if song belongs to user
    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song || song.userId !== userId) {
      return res.status(403).json({ message: 'You do not have permission to regenerate this song' });
    }

    console.log(`🎵 Regenerating audio for "${title}" (Song ${songId})...`);
    
    // Generate new audio
    const newAudioUrl = await generateMusicWithFAL(title, lyrics, style, mood);

    if (!newAudioUrl) {
      return res.status(500).json({ message: 'Failed to generate audio for song' });
    }

    // Update song
    await db.update(songs).set({ audioUrl: newAudioUrl }).where(eq(songs.id, songId));

    console.log(`✅ Song regenerated: ${title}`);
    res.json({ 
      success: true, 
      message: 'Song regenerated successfully',
      audioUrl: newAudioUrl 
    });
  } catch (error: any) {
    console.error('❌ Regenerate song error:', error);
    res.status(500).json({ message: 'Error regenerating song' });
  }
});

export default router;
