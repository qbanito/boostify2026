/**
 * Course Content Service — all course text generation.
 *
 * PROVIDERS: z.ai GLM-5.2 (deep reasoning, primary) → OpenAI (fallback).
 * Generates: outlines, lesson content, quizzes, slide decks (presentations),
 * image prompts, and course expansions.
 */

import OpenAI from 'openai';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL, ZAI_API_KEY, ZAI_BASE_URL, isZaiConfigured } from '../utils/ai-config';

const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = PRIMARY_MODEL;

// ─── GLM-5.2 (z.ai) — primary reasoning model for course design ───────────
const glm: OpenAI | null = isZaiConfigured()
  ? new OpenAI({ apiKey: ZAI_API_KEY, baseURL: ZAI_BASE_URL })
  : null;

/**
 * JSON-mode LLM call with GLM-5.2 → OpenAI cascade.
 * GLM sometimes wraps JSON in fences — tolerated. Parse failure → OpenAI.
 */
async function callCourseLLM(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  opts: { temperature: number; maxTokens?: number }
): Promise<any> {
  if (glm) {
    try {
      const res = await glm.chat.completions.create({
        model: 'glm-5.2',
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens ?? 4000,
        response_format: { type: 'json_object' },
      });
      const raw = res.choices[0]?.message?.content?.trim();
      if (raw) {
        const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(jsonText);
        console.log('[course-llm] GLM-5.2 ✅');
        return parsed;
      }
    } catch (e: any) {
      console.warn('[course-llm] GLM-5.2 failed, falling back to OpenAI:', e?.message);
    }
  }
  const res = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens ?? 4000,
    response_format: { type: 'json_object' },
  });
  return JSON.parse(res.choices[0].message.content || '{}');
}

// ─── INTERFACES ───────────────────────────────────────────

export interface CourseOutline {
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  lessons: Array<{
    title: string;
    description: string;
    duration: number;
  }>;
}

export interface LessonContent {
  title: string;
  description: string;
  content: string;   // rich markdown
  duration: number;
  keyPoints: string[];
}

export interface QuizQuestion {
  question: string;
  questionType: 'multiple_choice' | 'true_false';
  options: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
}

// ─── COURSE OUTLINE ───────────────────────────────────────

export async function generateCourseOutline(
  topic: string,
  level: 'Beginner' | 'Intermediate' | 'Advanced',
  lessonsCount: number = 15
): Promise<CourseOutline> {
  return callCourseLLM(
    [
      {
        role: 'system',
        content: `You are an expert music education course designer for the Boostify Music Academy.
Create comprehensive, long-form course outlines designed to grow progressively.
Lessons should build on each other. Include practical exercises and real-world applications.
Always respond with valid JSON.`,
      },
      {
        role: 'user',
        content: `Create a ${level} level course outline about "${topic}" with exactly ${lessonsCount} lessons.
Each lesson should be progressive and build on previous concepts.

Return JSON with this exact structure:
{
  "title": "Course Title",
  "description": "Detailed course description (2-3 sentences)",
  "category": "Category Name",
  "level": "${level}",
  "lessons": [
    { "title": "Lesson Title", "description": "Lesson description", "duration": 20 }
  ]
}`,
      },
    ],
    { temperature: 0.7 }
  );
}

// ─── LESSON CONTENT ───────────────────────────────────────

export async function generateLessonContent(
  lessonTitle: string,
  courseContext: string,
  previousLessons: string[] = []
): Promise<LessonContent> {
  const prevContext = previousLessons.length > 0
    ? `Previous lessons covered: ${previousLessons.join(', ')}.`
    : 'This is the first lesson.';

  return callCourseLLM(
    [
      {
        role: 'system',
        content: `You are an expert music educator creating detailed lesson content for the Boostify Music Academy.
Write comprehensive, engaging educational content in markdown format.
Include: code examples, practical tips, real-world scenarios, step-by-step instructions.
Make the content thorough — at least 1500 words per lesson. Students should feel they're getting real value.
Always respond with valid JSON.`,
      },
      {
        role: 'user',
        content: `Create detailed lesson content for "${lessonTitle}" in the course "${courseContext}".
${prevContext}

Include:
- Comprehensive explanation with examples (markdown formatted)
- Key concepts and takeaways
- Practical applications and exercises
- Clear, engaging writing style

Return JSON:
{
  "title": "${lessonTitle}",
  "description": "Brief description (1-2 sentences)",
  "content": "Full markdown content (1500+ words)",
  "duration": 20,
  "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"]
}`,
      },
    ],
    { temperature: 0.7, maxTokens: 4000 }
  );
}

// ─── QUIZ QUESTIONS ───────────────────────────────────────

export async function generateQuizQuestions(
  lessonTitle: string,
  lessonContent: string,
  questionsCount: number = 5
): Promise<QuizQuestion[]> {
  const parsed = await callCourseLLM(
    [
      {
        role: 'system',
        content: `You are an expert quiz designer for music education.
Create clear, fair questions that test real understanding — not trick questions.
Provide helpful explanations for correct answers.
Always respond with valid JSON.`,
      },
      {
        role: 'user',
        content: `Create ${questionsCount} quiz questions for the lesson "${lessonTitle}".

Lesson content (excerpt):
${lessonContent.substring(0, 2500)}

Return JSON:
{
  "questions": [
    {
      "question": "Question text",
      "questionType": "multiple_choice",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "Why this is correct",
      "points": 10
    }
  ]
}

Mix of multiple_choice (4 options) and true_false (["True", "False"]).`,
      },
    ],
    { temperature: 0.6 }
  );
  return parsed.questions || [];
}

// ─── LESSON SLIDES (interactive presentation deck) ────────

export interface LessonSlide {
  title: string;
  bullets: string[];
  speakerNotes: string;
}

/**
 * Generates an interactive slide deck (presentation) for a lesson.
 * GLM-5.2 reasons over the full lesson content to distill it into
 * 6-10 teachable slides students can step through.
 */
export async function generateLessonSlides(
  lessonTitle: string,
  courseTitle: string,
  lessonContent: string
): Promise<LessonSlide[]> {
  try {
    const parsed = await callCourseLLM(
      [
        {
          role: 'system',
          content: `You are a master educator who turns lessons into engaging slide presentations.
Each slide: one clear concept, 3-5 punchy bullets, and speaker notes that TEACH (not just repeat the bullets).
Always respond with valid JSON.`,
        },
        {
          role: 'user',
          content: `Turn this lesson into a slide deck of 6-10 slides.

Course: "${courseTitle}"
Lesson: "${lessonTitle}"

Lesson content:
${lessonContent.substring(0, 6000)}

Return JSON:
{
  "slides": [
    { "title": "Slide title", "bullets": ["point 1", "point 2", "point 3"], "speakerNotes": "2-3 sentences teaching this slide" }
  ]
}

First slide = lesson intro/hook. Last slide = recap + what's next.`,
        },
      ],
      { temperature: 0.6, maxTokens: 3000 }
    );
    const slides = Array.isArray(parsed.slides) ? parsed.slides : [];
    return slides
      .filter((s: any) => s?.title && Array.isArray(s?.bullets))
      .slice(0, 12)
      .map((s: any) => ({
        title: String(s.title),
        bullets: s.bullets.map((b: any) => String(b)).slice(0, 6),
        speakerNotes: String(s.speakerNotes || ''),
      }));
  } catch (e: any) {
    console.warn('[course-llm] slide generation failed:', e?.message);
    return [];
  }
}

// ─── IMAGE PROMPT GENERATOR ──────────────────────────────

export async function generateLessonImagePrompt(
  lessonTitle: string,
  lessonDescription: string
): Promise<string> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.8,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: 'Generate concise image prompts for AI image generation. Output ONLY the prompt text, no explanation.',
      },
      {
        role: 'user',
        content: `Create an image generation prompt for a music education lesson: "${lessonTitle}" — ${lessonDescription}.
Style: professional, educational, modern dark background with vibrant neon accents, music/technology themed.
Keep under 150 words. Output only the prompt.`,
      },
    ],
  });

  return res.choices[0].message.content?.trim() || `Professional educational illustration for ${lessonTitle}, modern style, dark background with vibrant accents`;
}

// ─── COURSE EXPANSION ─────────────────────────────────────
// Generate additional lessons when user nears completion

export async function generateExpansionLessons(
  courseTitle: string,
  existingLessonTitles: string[],
  count: number = 5
): Promise<Array<{ title: string; description: string; duration: number }>> {
  const parsed = await callCourseLLM(
    [
      {
        role: 'system',
        content: `You are an expert course designer. Create advanced follow-up lessons that deepen existing knowledge.
Always respond with valid JSON.`,
      },
      {
        role: 'user',
        content: `The course "${courseTitle}" currently has these lessons:
${existingLessonTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Generate ${count} NEW advanced lessons that continue and deepen the course.
These should cover more advanced topics, practical projects, and real-world applications.

Return JSON:
{
  "lessons": [
    { "title": "Lesson Title", "description": "Description", "duration": 20 }
  ]
}`,
      },
    ],
    { temperature: 0.7 }
  );
  return parsed.lessons || [];
}
