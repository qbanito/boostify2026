import { GoogleGenAI, Modality, Type, SchemaType } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

interface LessonContent {
  title: string;
  description: string;
  content: string;
  duration: number;
  keyPoints: string[];
}

interface QuizQuestion {
  question: string;
  questionType: "multiple_choice" | "true_false";
  options: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
}

interface CourseOutline {
  title: string;
  description: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  lessons: {
    title: string;
    description: string;
    duration: number;
  }[];
}

export async function generateCourseImage(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      throw new Error("No image data in response");
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;
  } catch (error: any) {
    console.error("Error generating course image:", error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

export async function generateCourseOutline(
  topic: string,
  level: "Beginner" | "Intermediate" | "Advanced",
  lessonsCount: number = 8
): Promise<CourseOutline> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create a comprehensive ${level} level course outline about "${topic}" with exactly ${lessonsCount} lessons. 
      Each lesson should be progressive and build on previous concepts. Include practical examples.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            level: { type: Type.STRING },
            lessons: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  duration: { type: Type.INTEGER }
                },
                required: ["title", "description", "duration"]
              }
            }
          },
          required: ["title", "description", "category", "level", "lessons"]
        }
      }
    });

    const outline = JSON.parse(response.text || "{}") as CourseOutline;
    return outline;
  } catch (error: any) {
    console.error("Error generating course outline:", error);
    throw new Error(`Course outline generation failed: ${error.message}`);
  }
}

export async function generateLessonContent(
  lessonTitle: string,
  courseContext: string,
  previousLessons: string[] = []
): Promise<LessonContent> {
  try {
    const context = previousLessons.length > 0 
      ? `Previous lessons covered: ${previousLessons.join(", ")}.` 
      : "This is the first lesson.";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create detailed lesson content for "${lessonTitle}" in a course about "${courseContext}". 
      ${context}
      
      The lesson should include:
      - Comprehensive explanation with examples
      - Key concepts and takeaways
      - Practical applications
      - Clear and engaging writing style
      
      Format the content in markdown.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            content: { type: Type.STRING },
            duration: { type: Type.INTEGER },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "description", "content", "duration", "keyPoints"]
        }
      }
    });

    const lessonContent = JSON.parse(response.text || "{}") as LessonContent;
    return lessonContent;
  } catch (error: any) {
    console.error("Error generating lesson content:", error);
    throw new Error(`Lesson content generation failed: ${error.message}`);
  }
}

export async function generateQuizQuestions(
  lessonTitle: string,
  lessonContent: string,
  questionsCount: number = 5
): Promise<QuizQuestion[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Based on this lesson "${lessonTitle}", create ${questionsCount} quiz questions to test understanding.
      
      Lesson content:
      ${lessonContent.substring(0, 2000)}
      
      Create a mix of multiple choice and true/false questions.
      Each question should test a different concept from the lesson.
      Provide clear explanations for the correct answers.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              questionType: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING },
              points: { type: Type.INTEGER }
            },
            required: ["question", "questionType", "options", "correctAnswer", "explanation", "points"]
          }
        }
      }
    });

    const questions = JSON.parse(response.text || "[]") as QuizQuestion[];
    return questions;
  } catch (error: any) {
    console.error("Error generating quiz questions:", error);
    throw new Error(`Quiz generation failed: ${error.message}`);
  }
}

export async function generateLessonImagePrompt(
  lessonTitle: string,
  lessonDescription: string
): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create a detailed image generation prompt for a lesson titled "${lessonTitle}": ${lessonDescription}.
      
      The prompt should describe a professional, educational, and visually appealing illustration that represents the lesson's main concept.
      Keep it under 200 characters, focused on visual elements, style should be modern and educational.
      Just return the prompt text, nothing else.`,
    });

    return response.text?.trim() || `Professional educational illustration for ${lessonTitle}`;
  } catch (error: any) {
    console.error("Error generating image prompt:", error);
    return `Professional educational illustration for ${lessonTitle}`;
  }
}
