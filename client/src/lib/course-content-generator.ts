import { z } from 'zod';
import { logger } from "./logger";
import OpenAI from 'openai';

const examQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.number(),
  explanation: z.string()
});

const sectionSchema = z.object({
  subtitle: z.string(),
  icon: z.string(),
  paragraphs: z.array(z.string()),
  imagePrompt: z.string().optional()
});

const lessonContentSchema = z.object({
  title: z.string(),
  content: z.object({
    introduction: z.string(),
    coverImagePrompt: z.string(),
    keyPoints: z.array(z.object({
      point: z.string(),
      icon: z.string()
    })),
    mainContent: z.array(sectionSchema),
    practicalExercises: z.array(z.object({
      title: z.string(),
      description: z.string(),
      steps: z.array(z.string()),
      icon: z.string()
    })),
    additionalResources: z.array(z.object({
      title: z.string(),
      url: z.string(),
      description: z.string(),
      icon: z.string()
    })),
    summary: z.string(),
    exam: z.array(examQuestionSchema).min(3)
  })
});

export type ExamQuestion = z.infer<typeof examQuestionSchema>;
export type LessonContent = z.infer<typeof lessonContentSchema>;

export async function generateLessonContent(lessonTitle: string, lessonDescription: string): Promise<LessonContent> {
  try {
    logger.info('Getting OpenRouter API key...');
    // Get the API key securely from the server instead of using it directly from env
    const apiKeyResponse = await fetch("/api/get-openrouter-key");
    if (!apiKeyResponse.ok) {
      throw new Error("Could not get OpenRouter API key from server");
    }
    
    const { key, exists } = await apiKeyResponse.json();
    if (!exists || !key) {
      throw new Error("OpenRouter API key not found on server");
    }

    logger.info('Initializing OpenRouter API client...');
    const openai = new OpenAI({
      apiKey: key,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Boostify Music Education',
      },
      dangerouslyAllowBrowser: true
    });

    const systemPrompt = `You are an expert music industry educator. Create a detailed lesson following this format:
    - A thorough introduction explaining the topic
    - At least 3 key learning points with icons
    - At least 3 detailed content sections
    - At least 3 practical exercises with clear steps
    - At least 3 relevant external resources
    - A comprehensive summary
    - At least 3 exam questions to test understanding

    Use only these Lucide icons: Music, Star, Book, Lightbulb, FileText, Link, Pencil, Trophy, Clock, Users, Award, ChevronRight.

    Ensure all content is practical and immediately applicable to music industry professionals.`;

    const userPrompt = `Create a comprehensive lesson about "${lessonTitle}" based on this description: "${lessonDescription}".

    The response must be a valid JSON object with this exact structure:
    {
      "title": "string",
      "content": {
        "introduction": "string",
        "coverImagePrompt": "string",
        "keyPoints": [{"point": "string", "icon": "string"}],
        "mainContent": [{
          "subtitle": "string",
          "icon": "string",
          "paragraphs": ["string"],
          "imagePrompt": "string"
        }],
        "practicalExercises": [{
          "title": "string",
          "description": "string",
          "steps": ["string"],
          "icon": "string"
        }],
        "additionalResources": [{
          "title": "string",
          "url": "string",
          "description": "string",
          "icon": "string"
        }],
        "summary": "string",
        "exam": [{
          "question": "string",
          "options": ["string"],
          "correctAnswer": 0,
          "explanation": "string"
        }]
      }
    }`;

    logger.info('Making API request to OpenRouter with model: google/gemini-2.0-flash-lite-preview-02-05:free');
    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2, // Lower temperature for more consistent JSON output
      max_tokens: 2500,  // Ensure enough tokens for complete lesson content
      response_format: { type: "json_object" }
    });

    logger.info('Received API response:', completion);

    if (!completion.choices?.[0]?.message?.content) {
      logger.error('Invalid API response structure:', completion);
      throw new Error('Invalid API response structure');
    }

    const content = completion.choices[0].message.content.trim();
    logger.info('Raw content:', content);

    try {
      const parsedContent = JSON.parse(content);
      logger.info('Successfully parsed JSON content');

      const validatedContent = lessonContentSchema.parse(parsedContent);
      logger.info('Successfully validated content schema');

      return validatedContent;
    } catch (parseError) {
      logger.error('Error parsing/validating content:', parseError);
      logger.error('Raw content that failed:', content);
      throw new Error('Failed to parse or validate lesson content');
    }

  } catch (error) {
    logger.error('Error in generateLessonContent:', error);
    
    // Create a basic fallback content if API call fails
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('auth'))) {
      logger.warn('Authentication error with OpenRouter API. Using fallback content.');
      
      // Generate a simple fallback lesson content
      const fallbackContent: LessonContent = {
        title: lessonTitle,
        content: {
          introduction: `Welcome to this lesson on ${lessonTitle}. ${lessonDescription}`,
          coverImagePrompt: `Professional music education image about ${lessonTitle}`,
          keyPoints: [
            { point: "Understand the fundamentals of this topic", icon: "Book" },
            { point: "Apply practical techniques in real music scenarios", icon: "Music" },
            { point: "Develop professional skills for your music career", icon: "Star" }
          ],
          mainContent: [
            {
              subtitle: "Key Concepts",
              icon: "Lightbulb",
              paragraphs: [
                `This section covers the essential concepts of ${lessonTitle}.`,
                "Understanding these fundamentals will help you build a solid foundation.",
                "The music industry constantly evolves, making these concepts crucial for success."
              ],
              imagePrompt: `Diagram illustrating key concepts of ${lessonTitle}`
            },
            {
              subtitle: "Practical Applications",
              icon: "FileText",
              paragraphs: [
                "Now let's look at how to apply these concepts in real-world scenarios.",
                "Music professionals use these techniques daily to solve common challenges.",
                "Adapting these methods to your specific situation will maximize their effectiveness."
              ],
              imagePrompt: `Musicians applying ${lessonTitle} techniques in studio`
            },
            {
              subtitle: "Advanced Strategies",
              icon: "Trophy",
              paragraphs: [
                "For those looking to excel, these advanced strategies provide an edge.",
                "Industry leaders often employ these approaches to stand out in competitive markets.",
                "Combining multiple strategies can create a unique approach that defines your professional identity."
              ],
              imagePrompt: `Professional music setting showing advanced ${lessonTitle} in action`
            }
          ],
          practicalExercises: [
            {
              title: "Basic Application",
              description: "A simple exercise to practice the fundamentals",
              steps: [
                "Prepare your materials and environment",
                "Follow the step-by-step process outlined in the lesson",
                "Review your work and identify areas for improvement"
              ],
              icon: "Pencil"
            },
            {
              title: "Skill Development",
              description: "Build on the basics with this intermediate exercise",
              steps: [
                "Apply the concepts in a more challenging context",
                "Experiment with variations to understand the flexibility of the approach",
                "Document your process and results for future reference"
              ],
              icon: "Clock"
            },
            {
              title: "Professional Application",
              description: "Advanced exercise simulating real industry scenarios",
              steps: [
                "Create a project that mirrors professional standards",
                "Implement all techniques covered in the lesson",
                "Get feedback from peers or mentors to refine your approach"
              ],
              icon: "Users"
            }
          ],
          additionalResources: [
            {
              title: "Industry Guide",
              url: "https://musicindustryhowto.com/",
              description: "Comprehensive resource for music industry professionals",
              icon: "Link"
            },
            {
              title: "Professional Association",
              url: "https://www.namm.org/",
              description: "Network with other professionals in the field",
              icon: "Link"
            },
            {
              title: "Advanced Tutorial",
              url: "https://www.masterclass.com/categories/music",
              description: "In-depth tutorials from industry experts",
              icon: "Link"
            }
          ],
          summary: `This lesson covered the essential aspects of ${lessonTitle}. You've learned the fundamental concepts, practical applications, and advanced strategies that will help you succeed in this area of the music industry. Continue practicing the exercises to reinforce these skills and explore the additional resources for deeper understanding.`,
          exam: [
            {
              question: `What is a key benefit of mastering ${lessonTitle}?`,
              options: [
                "Increased career opportunities",
                "Lower production costs",
                "Faster recording sessions",
                "All of the above"
              ],
              correctAnswer: 3,
              explanation: "Mastering this topic provides multiple benefits including all of those listed."
            },
            {
              question: "Which approach is recommended for beginners?",
              options: [
                "Start with advanced techniques immediately",
                "Build a solid foundation of fundamentals first",
                "Skip the theory and focus only on practice",
                "Rely exclusively on digital tools"
              ],
              correctAnswer: 1,
              explanation: "Building a solid foundation is essential before moving to more advanced concepts."
            },
            {
              question: "How often should these skills be practiced?",
              options: [
                "Once a month is sufficient",
                "Only when preparing for a project",
                "Regularly as part of your professional routine",
                "They don't require practice once learned"
              ],
              correctAnswer: 2,
              explanation: "Regular practice is key to maintaining and improving these professional skills."
            }
          ]
        }
      };
      
      return fallbackContent;
    }
    
    // For other errors, rethrow
    throw error;
  }
}