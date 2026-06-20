import { Router, Request, Response } from 'express';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import {
  generateImageWithNanoBanana,
  generateVideoWithGrok,
  generateMusicWithMiniMax,
  generateVideoFromImage,
} from '../services/fal-service';
import Stripe from 'stripe';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
});

// ─── Price helpers ───────────────────────────────────────────────────────────
function getCoursePrice(idx: number, level: string): string {
  if (idx === 0) return '0.00'; // Introduction to Boostify — FREE
  const prices: Record<string, string[]> = {
    Beginner: ['19.99', '24.99', '29.99'],
    Intermediate: ['39.99', '44.99', '49.99'],
    Advanced: ['59.99', '69.99', '79.99', '99.99'],
  };
  const arr = prices[level] || prices.Intermediate;
  return arr[idx % arr.length];
}

function getPriceByLevel(level: string): string {
  const prices: Record<string, string[]> = {
    Beginner: ['19.99', '24.99', '29.99'],
    Intermediate: ['39.99', '44.99', '49.99'],
    Advanced: ['59.99', '69.99', '79.99', '99.99'],
  };
  const arr = prices[level] || prices.Intermediate;
  return arr[Math.floor(Math.random() * arr.length)];
}

// Initialize OpenAI
const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Simple retry helper without external dependencies
async function retryWithBackoff(
  fn: () => Promise<any>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<any> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Simple concurrency limiter without external dependencies
async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = Promise.resolve().then(task).then(result => {
      results[tasks.indexOf(task)] = result;
    });
    
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }

  await Promise.all(executing);
  return results;
}

// Generate 20 varied courses with Gemini AI
router.post('/api/education/generate-20-courses', async (req: Request, res: Response) => {
  try {
    console.log('🎓 Starting generation of 20 varied music courses...');
    
    const courseTopics = [
      'Introduction to Boostify Music Platform',
      'Music Production Fundamentals',
      'Mixing and Mastering Essentials',
      'Advanced Vocal Techniques',
      'Guitar Playing Mastery',
      'Digital Audio Workstations (DAWs)',
      'Music Theory for Composers',
      'Electronic Music Production',
      'Sound Design Techniques',
      'Music Business and Marketing',
      'Live Performance Skills',
      'Podcast Production',
      'Hip-Hop Production',
      'Jazz Improvisation',
      'Film Scoring and Soundtracks',
      'Songwriting Craft',
      'Studio Recording Techniques',
      'Music Video Production',
      'Music Licensing and Rights',
      'Music Promotion Strategies',
      'Orchestra Arrangement',
    ].slice(0, 20);

    const levels = ['Beginner', 'Intermediate', 'Advanced'];
    const descriptions = [
      'Learn the fundamentals and master the basics',
      'Build on your existing knowledge',
      'Take your skills to professional level',
      'Discover advanced techniques and strategies',
      'Comprehensive guide for professionals',
      'Deep dive into specialized topics'
    ];

    // Generate 20 courses in parallel with concurrency limit of 2
    const courseGenerators = courseTopics.map((topic, idx) => async () => {
      const level = levels[idx % 3];
      const description = descriptions[idx % descriptions.length];
      
      console.log(`Generating course ${idx + 1}/20: ${topic} (${level})`);
      
      return await retryWithBackoff(async () => {
        const response = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a music education expert. Generate course structures in valid JSON format.'
            },
            {
              role: 'user',
              content: `Generate a JSON course structure for: "${topic}" - Level: ${level}. Include: title, description, preview (first 2 lessons only), fullCurriculum (complete), objectives (3-4), topics (4-5), estimatedHours, skills (3-4), prerequisites, imagePrompt.`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        });

        const courseData = JSON.parse(response.choices[0].message.content || '{}');
        
        // Generate thumbnail image with FAL nano-banana
        let thumbnail = null;
        try {
          const imagePrompt = courseData.imagePrompt || `Professional music course thumbnail for ${topic}. Modern design with vibrant colors, musical elements, and text "${topic}". 16:9 aspect ratio.`;
          
          const imageResult = await generateImageWithNanoBanana(imagePrompt, {
            aspectRatio: '16:9',
            outputFormat: 'png'
          });

          if (imageResult.success && imageResult.imageUrl) {
            thumbnail = imageResult.imageUrl;
          } else if (imageResult.success && imageResult.imageBase64) {
            thumbnail = `data:image/png;base64,${imageResult.imageBase64}`;
          }
        } catch (imgError) {
          console.warn(`Could not generate image for ${topic}:`, imgError);
        }

        return {
          id: `course-${Date.now()}-${idx}`,
          ...courseData,
          thumbnail,
          price: getCoursePrice(idx, level),
          isPublished: true,
          createdAt: new Date().toISOString(),
          quiz: {
            questions: [
              {
                question: `What is the main objective of ${courseData.title}?`,
                options: courseData.objectives.slice(0, 4),
                correct: 0
              },
              {
                question: `Which of the following is NOT a topic in this course?`,
                options: [...courseData.topics.slice(0, 3), 'Unrelated Topic'],
                correct: 3
              }
            ]
          }
        };
      });
    });

    const courses = await withConcurrencyLimit(courseGenerators, 2);
    console.log(`✅ Generated ${courses.length} courses successfully`);
    
    res.json({
      success: true,
      count: courses.length,
      courses: courses.filter(c => c !== null)
    });
  } catch (error: any) {
    console.error('❌ Error generating courses:', error);
    res.status(500).json({
      error: 'Failed to generate courses',
      details: error.message
    });
  }
});

// Generate full course content on purchase
router.post('/api/education/generate-full-content', async (req: Request, res: Response) => {
  try {
    const { courseId, courseTitle, level } = req.body;
    
    if (!courseId || !courseTitle) {
      return res.status(400).json({ error: 'Course ID and title required' });
    }

    console.log(`📖 Generating full content for course: ${courseTitle}`);

    const content = await retryWithBackoff(async () => {
      const response = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a music education expert. Generate complete course content in valid JSON format with modules, lessons, exercises, examples, and exams.'
          },
          {
            role: 'user',
            content: `Generate complete course content for "${courseTitle}" (${level || 'Intermediate'} level). Include: detailed lessons with exercises, practical examples, code snippets, best practices, common mistakes to avoid, and a comprehensive final exam with 10 multiple choice questions. Return JSON with "modules" array (each with title and lessons array containing title, content, exercises, examples) and "exam" object (with title and questions array containing question, options array, and correct index).`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    }, 3, 2000);

    console.log(`✅ Full content generated for ${courseTitle}`);
    
    res.json({
      success: true,
      content,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error generating full content:', error);
    res.status(500).json({
      error: 'Failed to generate full content',
      details: error.message
    });
  }
});

// Generate a single course with OpenAI + FAL image
router.post('/api/education/generate-single-course', async (req: Request, res: Response) => {
  try {
    const { topic, level = 'Intermediate', lessonsCount = 8 } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
      return res.status(400).json({ error: 'A valid course topic is required (min 3 chars)' });
    }

    const sanitizedTopic = topic.trim().slice(0, 200);
    const sanitizedLevel = ['Beginner', 'Intermediate', 'Advanced'].includes(level) ? level : 'Intermediate';
    const sanitizedLessons = Math.min(Math.max(parseInt(lessonsCount) || 8, 3), 20);

    console.log(`🎓 Generating single course: "${sanitizedTopic}" (${sanitizedLevel}, ${sanitizedLessons} lessons)`);

    const courseData = await retryWithBackoff(async () => {
      const response = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a world-class music education curriculum designer (think Berklee Online, MasterClass).
Create comprehensive, professional, and commercially successful course structures.
Every course should feel like a masterpiece — specific, actionable, and transformative.`
          },
          {
            role: 'user',
            content: `Create a MASTERPIECE professional music course about "${sanitizedTopic}" at ${sanitizedLevel} level with ${sanitizedLessons} lessons.

Return a JSON object with:
- "title": compelling, specific course title (not generic)
- "description": 3-sentence marketing description that sells the transformation (not just the topic)
- "level": "${sanitizedLevel}"
- "estimatedHours": total learning hours (realistic number)
- "learningOutcome": single powerful sentence describing what student will be able to DO after this course
- "objectives": array of 5 specific, measurable learning objectives (use action verbs: "Build", "Create", "Apply", "Master", "Design")
- "prerequisites": array of specific prerequisites (empty array for Beginner)
- "skills": array of 5-6 concrete, marketable skills gained (specific tools/techniques)
- "topics": array of 5-6 key topics covered
- "targetAudience": who this course is for (1-2 sentences)
- "imagePrompt": detailed cinematic prompt for generating a stunning 16:9 course thumbnail (professional, dramatic, music-themed)
- "preview": array of first 3 lesson objects with "title", "description", "duration", "type" ("lecture"/"workshop"/"lab"/"project")
- "fullCurriculum": array of ALL ${sanitizedLessons} lesson objects with:
  - "title": specific lesson title
  - "description": 1-2 sentence description of exactly what's covered
  - "duration": estimated time (e.g., "45 min")
  - "type": "lecture" | "workshop" | "lab" | "project" | "quiz"
  - "topics": array of 2-3 specific subtopics`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 3000,
      });
      return JSON.parse(response.choices[0].message.content || '{}');
    });

    // Generate thumbnail
    let thumbnail = null;
    try {
      const imagePrompt = courseData.imagePrompt || `Professional music course thumbnail for "${sanitizedTopic}". Modern, sleek design with musical elements. 16:9 aspect ratio.`;
      const imageResult = await generateImageWithNanoBanana(imagePrompt, { aspectRatio: '16:9', outputFormat: 'png' });
      if (imageResult.success && imageResult.imageUrl) {
        thumbnail = imageResult.imageUrl;
      } else if (imageResult.success && imageResult.imageBase64) {
        thumbnail = `data:image/png;base64,${imageResult.imageBase64}`;
      }
    } catch (imgErr) {
      console.warn('Could not generate thumbnail:', imgErr);
    }

    const course = {
      id: `course-${Date.now()}`,
      ...courseData,
      thumbnail,
      price: getPriceByLevel(sanitizedLevel),
      isPublished: true,
      createdAt: new Date().toISOString(),
    };

    console.log(`✅ Single course generated: "${course.title}"`);
    res.json({ success: true, course });
  } catch (error: any) {
    console.error('❌ Error generating single course:', error);
    res.status(500).json({ error: 'Failed to generate course', details: error.message });
  }
});

// Generate complete lesson content for a specific lesson
router.post('/api/education/generate-lesson-content', async (req: Request, res: Response) => {
  try {
    const { courseTitle, lessonTitle, lessonIndex, level, courseTopics } = req.body;

    if (!courseTitle || !lessonTitle) {
      return res.status(400).json({ error: 'Course title and lesson title are required' });
    }

    console.log(`📖 Generating lesson content: "${lessonTitle}" from "${courseTitle}"`);

    const lessonContent = await retryWithBackoff(async () => {
      const response = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a world-class music educator and curriculum designer with 20 years of professional experience. 
Your lessons are masterworks of pedagogy: clear, practical, inspiring, and deeply educational. 
Write in engaging professional Markdown with concrete musical examples, real-world applications, and actionable exercises.
Every lesson should feel like it was written by a top-tier online music academy (Berklee Online, MasterClass level quality).`
          },
          {
            role: 'user',
            content: `Write a MASTERPIECE lesson for the course "${courseTitle}" (${level || 'Intermediate'} level).

Lesson ${(lessonIndex || 0) + 1}: "${lessonTitle}"
${courseTopics ? `Course topics context: ${JSON.stringify(courseTopics)}` : ''}

Return a JSON object with:
- "content": EXCEPTIONAL full lesson in Markdown (minimum 2000 words). Structure:
  ## Introduction (hook the student, why this matters)
  ## Core Concepts (3-4 sections with deep explanations, music theory where relevant)
  ## Practical Application (step-by-step DAW workflow or instrument technique with specifics)
  ## Musical Examples (describe chord progressions, rhythms, production settings, or notation examples)
  ## Pro Tips (5 insider secrets from working professionals)
  ## Common Mistakes & How to Avoid Them
  ## Practice Routine (specific drills and exercises with timing)
  ## Summary & Next Steps
  
- "keyTakeaways": array of 5 powerful, specific takeaways (not vague — include concrete techniques/values/settings)
- "exercises": array of 4 practical exercises, each with "title", "description" (detailed, step-by-step), "difficulty" (easy/medium/hard), "estimatedMinutes" (number)
- "quiz": array of 6 quiz questions, each with "question", "options" (4 strings), "correctIndex" (0-3), "explanation" (detailed explanation of why the answer is correct)
- "imagePrompt": detailed cinematic prompt for generating a stunning visual illustration for this lesson (include style, lighting, composition)
- "musicSamplePrompt": short style description (30-100 chars) for generating an audio music example related to this lesson content (e.g., "Electronic house beat, 128 BPM, four-on-the-floor kick, synthesizer arpeggios")
- "musicSampleLyrics": optional short lyric snippet for the music sample if it's a song-based lesson (use [verse]/[chorus] format, 10-200 chars), or null if instrumental
- "additionalResources": array of 4 resource suggestions with "title", "description", and "type" ("book"/"video"/"tool"/"practice")`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 4000,
      });
      return JSON.parse(response.choices[0].message.content || '{}');
    });

    // Generate lesson image
    let lessonImage = null;
    try {
      const imgPrompt = lessonContent.imagePrompt || `Educational illustration for music lesson: "${lessonTitle}". Clean modern style.`;
      const imageResult = await generateImageWithNanoBanana(imgPrompt, { aspectRatio: '16:9', outputFormat: 'png' });
      if (imageResult.success && imageResult.imageUrl) {
        lessonImage = imageResult.imageUrl;
      } else if (imageResult.success && imageResult.imageBase64) {
        lessonImage = `data:image/png;base64,${imageResult.imageBase64}`;
      }
    } catch (imgErr) {
      console.warn('Could not generate lesson image:', imgErr);
    }

    console.log(`✅ Lesson content generated: "${lessonTitle}"`);
    res.json({
      success: true,
      lesson: { ...lessonContent, image: lessonImage },
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error generating lesson content:', error);
    res.status(500).json({ error: 'Failed to generate lesson content', details: error.message });
  }
});

// ─── Stripe Checkout for course purchase ────────────────────────────────────
router.post('/api/education/checkout', async (req: Request, res: Response) => {
  try {
    const { courseId, courseTitle, price, level, thumbnail } = req.body;

    if (!courseId || !courseTitle || price === undefined) {
      return res.status(400).json({ error: 'courseId, courseTitle, and price are required' });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }

    // Server-side price validation to prevent tampering
    const validRanges: Record<string, [number, number]> = {
      Beginner: [10, 35],
      Intermediate: [30, 60],
      Advanced: [50, 110],
    };
    if (numericPrice > 0 && level && validRanges[level]) {
      const [min, max] = validRanges[level];
      if (numericPrice < min || numericPrice > max) {
        return res.status(400).json({ error: 'Price out of expected range for this course level' });
      }
    }

    const baseUrl = process.env.PRODUCTION_URL || 'https://boostifymusic.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: courseTitle,
              description: `Full access to "${courseTitle}" — AI-generated course with lessons, exercises & quizzes.`,
              images: thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('http') ? [thumbnail] : undefined,
            },
            unit_amount: Math.round(numericPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/education?payment=success&courseId=${encodeURIComponent(courseId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/education?payment=cancelled`,
      metadata: {
        courseId: String(courseId),
        courseTitle: String(courseTitle).slice(0, 500),
        price: String(price),
      },
    });

    console.log('📦 Course checkout session created:', session.id);
    res.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error('❌ Error creating course checkout:', error);
    res.status(500).json({ error: 'Failed to create checkout session', details: error.message });
  }
});

// ─── Google Cloud Text-to-Speech for lesson narration ────────────────────────
router.post('/api/education/generate-audio', async (req: Request, res: Response) => {
  try {
    const { text, lessonTitle } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const sanitizedText = text.trim().slice(0, 5000);
    const apiKey = process.env.GOOGLE_API_KEY2 || process.env.GOOGLE_API_KEY3 || '';
    if (!apiKey) {
      return res.status(500).json({ error: 'Google TTS API key not configured' });
    }

    // Try Journey voice first (most realistic), fall back to Neural2
    const voices = ['en-US-Journey-F', 'en-US-Neural2-F', 'en-US-Standard-F'];

    for (const voiceName of voices) {
      const ttsResponse = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: sanitizedText },
            voice: { languageCode: 'en-US', name: voiceName },
            audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 },
          }),
        }
      );

      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json();
        console.log(`🎙️ Audio generated for "${lessonTitle || 'lesson'}" using ${voiceName}`);
        return res.json({ success: true, audioContent: ttsData.audioContent, voice: voiceName });
      }

      const errText = await ttsResponse.text();
      console.warn(`TTS voice ${voiceName} failed:`, errText);
    }

    return res.status(500).json({ error: 'All TTS voice options failed' });
  } catch (error: any) {
    console.error('❌ Error generating TTS audio:', error);
    res.status(500).json({ error: 'Failed to generate audio', details: error.message });
  }
});

// ─── Generate AI Course Introduction Video (HeyGen-style) ────────────────────
// Uses FAL: first generates a professional instructor avatar image, then
// animates it with Grok Image-to-Video for a 6-second cinematic course intro.
router.post('/api/education/generate-intro-video', async (req: Request, res: Response) => {
  try {
    const { courseTitle, courseLevel, thumbnailUrl } = req.body;

    if (!courseTitle) {
      return res.status(400).json({ error: 'courseTitle is required' });
    }

    console.log(`🎬 Generating intro video for: "${courseTitle}"`);

    // If no thumbnail, generate an instructor avatar image first
    let instructorImageUrl = thumbnailUrl || null;

    if (!instructorImageUrl || !instructorImageUrl.startsWith('http')) {
      // Generate a professional instructor avatar
      const avatarPrompt = `Professional music educator, expert ${courseLevel || 'music'} instructor, 
        confident pose, studio background with musical equipment, warm professional lighting, 
        photorealistic portrait, high-end online course thumbnail style, 
        teaching "${courseTitle}", welcoming smile, bokeh background`;

      const imgResult = await generateImageWithNanoBanana(avatarPrompt, {
        aspectRatio: '16:9',
        outputFormat: 'png',
      });

      if (imgResult.success && (imgResult.imageUrl || imgResult.imageBase64)) {
        instructorImageUrl = imgResult.imageUrl || `data:image/png;base64,${imgResult.imageBase64}`;
      }
    }

    if (!instructorImageUrl || instructorImageUrl.startsWith('data:')) {
      return res.status(422).json({
        error: 'Could not obtain a valid image URL for video generation',
        details: 'FAL video requires an HTTPS image URL — base64 is not supported',
      });
    }

    // Generate motion video from the instructor image
    const motionPrompt = `Professional music instructor presenting a course about "${courseTitle}". 
      Subtle head movement, gentle breathing, confident posture. 
      Cinematic course introduction style, smooth camera movement, 
      professional studio atmosphere. High quality educational video.`;

    const videoResult = await generateVideoFromImage(instructorImageUrl, motionPrompt, {
      duration: 6,
      resolution: '720p',
    });

    if (videoResult.success && videoResult.videoUrl) {
      console.log(`✅ Intro video generated: ${videoResult.videoUrl}`);
      return res.json({
        success: true,
        videoUrl: videoResult.videoUrl,
        thumbnailUrl: instructorImageUrl,
        generatedAt: new Date().toISOString(),
      });
    }

    console.warn('⚠️ Video generation failed, returning thumbnail only');
    return res.json({
      success: true,
      videoUrl: null,
      thumbnailUrl: instructorImageUrl,
      fallback: true,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Error generating intro video:', error);
    res.status(500).json({ error: 'Failed to generate intro video', details: error.message });
  }
});

// ─── Generate Music Sample for Lesson ────────────────────────────────────────
// Uses FAL MiniMax Music V2 to create a short music example for a lesson
router.post('/api/education/generate-music-sample', async (req: Request, res: Response) => {
  try {
    const { lessonTitle, courseTitle, stylePrompt, lyricsPrompt } = req.body;

    if (!lessonTitle && !stylePrompt) {
      return res.status(400).json({ error: 'lessonTitle or stylePrompt is required' });
    }

    const style = stylePrompt || `Educational music demonstration for "${lessonTitle}" lesson from ${courseTitle}. Instrumental, clear structure, educational purpose`;
    const lyrics = lyricsPrompt || `[verse]\nThis is a musical example\nDemonstrating the concept clearly\n[chorus]\nLearn the technique, feel the music\nMaster the craft, embrace the art`;

    // Validate lengths for MiniMax API
    const safeStyle = style.slice(0, 295);
    const safeLyrics = lyrics.slice(0, 2990);

    if (safeStyle.length < 10 || safeLyrics.length < 10) {
      return res.status(400).json({ error: 'Style or lyrics too short' });
    }

    console.log(`🎵 Generating music sample for: "${lessonTitle}"`);

    const musicResult = await generateMusicWithMiniMax(safeStyle, safeLyrics, {
      format: 'mp3',
      bitrate: 128000,
    });

    if (musicResult.success && (musicResult.audioUrl || musicResult.audioBase64)) {
      console.log(`✅ Music sample generated for "${lessonTitle}"`);
      return res.json({
        success: true,
        audioUrl: musicResult.audioUrl,
        audioBase64: musicResult.audioBase64,
        generatedAt: new Date().toISOString(),
      });
    }

    return res.status(500).json({
      error: 'Music generation failed',
      details: musicResult.error || 'Unknown error',
    });
  } catch (error: any) {
    console.error('❌ Error generating music sample:', error);
    res.status(500).json({ error: 'Failed to generate music sample', details: error.message });
  }
});

// ─── Adaptive Learning: Get Recommended Lessons ────────────────────────────
router.post('/api/education/get-recommendations', async (req: Request, res: Response) => {
  try {
    const { completedCourseIds, currentCourseTitle, currentLevel, quizScores } = req.body;

    const avgScore = quizScores && quizScores.length > 0
      ? quizScores.reduce((a: number, b: number) => a + b, 0) / quizScores.length
      : null;

    const adaptiveSuggestion = avgScore !== null
      ? avgScore >= 85
        ? 'The student is excelling — recommend Advanced level content or specialization tracks'
        : avgScore >= 60
          ? 'The student is progressing normally — recommend continuing at current level'
          : 'The student needs more practice — recommend reviewing fundamentals and easier prerequisite topics'
      : 'No quiz data yet — recommend standard progression';

    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an adaptive music education AI that provides personalized learning recommendations. Return valid JSON only.',
        },
        {
          role: 'user',
          content: `Generate adaptive learning recommendations for a music student.

Current course: "${currentCourseTitle || 'Unknown'}" (${currentLevel || 'Intermediate'} level)
Completed courses: ${completedCourseIds?.length || 0}
Average quiz score: ${avgScore !== null ? `${avgScore.toFixed(1)}%` : 'N/A'}
Adaptive assessment: ${adaptiveSuggestion}

Return JSON with:
- "nextTopics": array of 4 specific topic recommendations (strings)
- "practiceAreas": array of 3 areas to focus on based on performance
- "motivationalMessage": encouraging personalized message (2-3 sentences)
- "suggestedPace": "accelerate" | "maintain" | "review"
- "weeklyGoal": specific achievable weekly learning goal (1 sentence)`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
    });

    const recommendations = JSON.parse(response.choices[0].message.content || '{}');
    res.json({ success: true, recommendations, avgScore });
  } catch (error: any) {
    console.error('❌ Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations', details: error.message });
  }
});

// ─── Generate Missing Course Thumbnails with Flux Pro ─────────────────────
// Accepts a list of courses that have no thumbnail and generates them using
// fal-ai/flux-pro/kontext/text-to-image, returning the updated courses array.
router.post('/api/education/fill-missing-images', async (req: Request, res: Response) => {
  try {
    const { courses } = req.body;

    if (!Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({ error: 'courses array is required' });
    }

    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_AI_KEY || '';
    if (!FAL_KEY) {
      return res.status(500).json({ error: 'FAL_KEY not configured' });
    }

    // Only process entries where thumbnail is null / empty
    const missing = courses.filter((c: any) => !c.thumbnail);
    if (missing.length === 0) {
      return res.json({ success: true, updated: [], message: 'All courses already have thumbnails' });
    }

    console.log(`🖼️  Generating ${missing.length} missing course thumbnails with Flux Pro…`);

    const updated: Array<{ id: string; thumbnail: string }> = [];

    for (const course of missing) {
      try {
        const imagePrompt = course.imagePrompt
          || `Professional online course thumbnail for "${course.title}". ${course.level || 'Music'} level course. Vibrant modern educational design, music theme, dark background with orange accents, high quality digital art.`;

        const falResponse = await fetch('https://fal.run/fal-ai/flux-pro/kontext/text-to-image', {
          method: 'POST',
          headers: {
            Authorization: `Key ${FAL_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: imagePrompt,
            image_size: 'landscape_16_9',
            num_images: 1,
            num_inference_steps: 28,
            guidance_scale: 3.5,
          }),
        });

        if (!falResponse.ok) {
          console.warn(`⚠️  Flux Pro failed for "${course.title}":`, await falResponse.text());
          continue;
        }

        const falData = await falResponse.json();
        const imageUrl = falData?.images?.[0]?.url || falData?.image?.url || null;

        if (imageUrl) {
          updated.push({ id: course.id, thumbnail: imageUrl });
          console.log(`  ✅ Thumbnail generated for "${course.title}"`);
        }
      } catch (err: any) {
        console.warn(`⚠️  Could not generate thumbnail for "${course.title}":`, err.message);
      }
    }

    console.log(`✅ fill-missing-images done: ${updated.length}/${missing.length} generated`);
    res.json({ success: true, updated, totalProcessed: missing.length, totalGenerated: updated.length });
  } catch (error: any) {
    console.error('❌ Error in fill-missing-images:', error);
    res.status(500).json({ error: 'Failed to fill missing images', details: error.message });
  }
});

export default router;
