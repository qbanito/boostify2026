/**
 * OpenAI Course Content Service — replaces Gemini for all course text generation
 *
 * Uses gpt-4o-mini for cost-effective, high-quality educational content:
 *  - Course outlines (title, description, 15-25 lessons)
 *  - Detailed lesson content (comprehensive markdown)
 *  - Quiz questions (mixed types with explanations)
 *  - Image prompt generation for FAL
 *  - Course expansion (auto-add lessons when user nears end)
 */

import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = PRIMARY_MODEL;

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
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
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
  });

  return JSON.parse(res.choices[0].message.content || '{}');
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

  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
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
  });

  return JSON.parse(res.choices[0].message.content || '{}');
}

// ─── QUIZ QUESTIONS ───────────────────────────────────────

export async function generateQuizQuestions(
  lessonTitle: string,
  lessonContent: string,
  questionsCount: number = 5
): Promise<QuizQuestion[]> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.6,
    response_format: { type: 'json_object' },
    messages: [
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
  });

  const parsed = JSON.parse(res.choices[0].message.content || '{"questions":[]}');
  return parsed.questions || [];
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
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
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
  });

  const parsed = JSON.parse(res.choices[0].message.content || '{"lessons":[]}');
  return parsed.lessons || [];
}
