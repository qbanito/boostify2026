import { GoogleGenAI } from "@google/genai";

// Using Replit's AI Integrations service for Gemini (blueprint:javascript_gemini_ai_integrations)
// This provides Gemini-compatible API access without requiring your own API key
// Charges are billed to your Replit credits
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface GeminiGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
}

export const geminiService = {
  async generateText(
    prompt: string,
    options: GeminiGenerationOptions = {}
  ): Promise<string> {
    const {
      model = "gemini-2.5-flash", // Using Replit AI Integrations supported model
      temperature = 0.9,
      maxTokens = 8192, // Increased token limit for better responses
      systemInstruction
    } = options;

    try {
      const requestBody: any = {
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        config: {
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens
          }
        }
      };

      if (systemInstruction) {
        requestBody.config.systemInstruction = {
          role: "system",
          parts: [{ text: systemInstruction }]
        };
      }

      const response = await ai.models.generateContent(requestBody);

      if (!response || !response.text) {
        throw new Error("No text generated in response");
      }

      return response.text;
    } catch (error) {
      console.error("Error generating text with Gemini:", error);
      throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  async generateMusicLyrics(params: {
    genre: string;
    mood: string;
    theme: string;
    language: string;
    structure: string;
  }): Promise<string> {
    const prompt = `Create professional song lyrics with the following parameters:

Genre: ${params.genre}
Mood: ${params.mood}
Theme: ${params.theme}
Language: ${params.language}
Structure: ${params.structure}

Requirements:
1. Write emotive and meaningful lyrics that capture the essence of the theme
2. Structure the output with clear verse and chorus sections
3. Make the lyrics flow naturally and be singable
4. Include bridge sections if appropriate for the structure
5. Ensure the lyrics match the specified mood and genre

Please provide complete, professional-quality lyrics.`;

    return this.generateText(prompt, {
      systemInstruction: "You are an expert songwriter with deep knowledge of musical composition and lyrics writing across all genres. You create meaningful, emotive, and commercially viable lyrics.",
      temperature: 1.0
    });
  },

  async generateVideoScript(params: {
    lyrics: string;
    style: string;
    mood: string;
  }): Promise<string> {
    const prompt = `Create a detailed music video script with the following parameters:

LYRICS:
${params.lyrics}

VISUAL STYLE: ${params.style}
MOOD: ${params.mood}

Please provide a comprehensive music video script that includes:

1. **CONCEPT OVERVIEW**
   - Main narrative or visual concept
   - Target audience and intended impact
   
2. **SCENE-BY-SCENE BREAKDOWN**
   - Detailed description of each scene
   - How scenes connect to specific lyrics
   - Location and setting for each scene
   
3. **VISUAL DIRECTION**
   - Color palette and lighting
   - Visual motifs and symbolism
   - Costume and styling notes
   
4. **CAMERA WORK**
   - Shot types (close-ups, wide shots, etc.)
   - Camera movements (pans, dolly, tracking shots)
   - Special angles or techniques
   
5. **SPECIAL EFFECTS & POST-PRODUCTION**
   - VFX suggestions
   - Transitions between scenes
   - Color grading notes
   
6. **NARRATIVE ELEMENTS**
   - Story arc (if applicable)
   - Character development
   - Emotional journey

Format the script professionally with clear sections and timing notes.`;

    return this.generateText(prompt, {
      systemInstruction: "You are an experienced music video director with expertise in visual storytelling, cinematography, and modern music video production. You understand how to create compelling visual narratives that enhance musical works.",
      temperature: 0.9
    });
  },

  async generateMarketingStrategy(params: {
    musicGenre?: string;
    targetAudience?: string;
    platforms?: string[];
    budget?: string;
    goals?: string;
  }): Promise<string> {
    const prompt = `Create a comprehensive marketing strategy for a music artist with the following details:

${params.musicGenre ? `Music Genre: ${params.musicGenre}` : ""}
${params.targetAudience ? `Target Audience: ${params.targetAudience}` : ""}
${params.platforms ? `Platforms: ${params.platforms.join(", ")}` : ""}
${params.budget ? `Budget Range: ${params.budget}` : ""}
${params.goals ? `Goals: ${params.goals}` : ""}

Provide a detailed marketing strategy that includes:

1. **EXECUTIVE SUMMARY**
   - Overview of the strategy
   - Key objectives
   
2. **TARGET AUDIENCE ANALYSIS**
   - Demographic breakdown
   - Psychographic profile
   - Listening habits and preferences
   
3. **PLATFORM-SPECIFIC STRATEGIES**
   - Tailored approach for each platform
   - Content recommendations
   - Posting frequency and timing
   
4. **CONTENT CALENDAR**
   - 30-day content plan
   - Mix of promotional and engaging content
   - Key dates and milestones
   
5. **GROWTH TACTICS**
   - Organic growth strategies
   - Paid promotion recommendations
   - Collaboration opportunities
   
6. **METRICS & KPIs**
   - Key performance indicators
   - Tracking and measurement plan
   - Success benchmarks
   
7. **BUDGET ALLOCATION**
   - Recommended spending distribution
   - ROI expectations
   
8. **TIMELINE & MILESTONES**
   - 90-day roadmap
   - Key deliverables

Provide actionable, realistic strategies based on current music industry best practices.`;

    return this.generateText(prompt, {
      systemInstruction: "You are a music marketing strategist with extensive experience in digital marketing, social media growth, and artist development. You understand the modern music industry landscape and create data-driven, actionable strategies.",
      temperature: 0.8
    });
  },

  async generateSocialMediaContent(params: {
    platform?: string;
    contentType?: string;
    artist?: string;
    topic?: string;
    tone?: string;
  }): Promise<string> {
    const prompt = `Generate social media content for a music artist with these specifications:

${params.platform ? `Platform: ${params.platform}` : ""}
${params.contentType ? `Content Type: ${params.contentType}` : ""}
${params.artist ? `Artist Name: ${params.artist}` : ""}
${params.topic ? `Topic/Theme: ${params.topic}` : ""}
${params.tone ? `Tone: ${params.tone}` : ""}

Provide:

1. **POST COPY**
   - Platform-optimized caption/text
   - Appropriate hashtags
   - Call-to-action
   
2. **VISUAL SUGGESTIONS**
   - Image/video concept
   - Visual style recommendations
   
3. **ENGAGEMENT TACTICS**
   - Questions or prompts for audience
   - Interactive elements
   
4. **OPTIMAL POSTING**
   - Best time to post
   - Expected engagement patterns
   
5. **VARIATIONS**
   - 2-3 alternative versions
   - Different angles/approaches

Make the content authentic, engaging, and optimized for the specific platform.`;

    return this.generateText(prompt, {
      systemInstruction: "You are a social media expert specializing in music artist promotion. You understand platform algorithms, audience engagement, and creating viral-worthy content while maintaining authenticity.",
      temperature: 0.95
    });
  },

  async generateMerchandiseIdeas(params: {
    artistStyle?: string;
    brandColors?: string;
    targetMarket?: string;
    priceRange?: string;
  }): Promise<string> {
    const prompt = `Generate creative merchandise design ideas for a music artist:

${params.artistStyle ? `Artist Style: ${params.artistStyle}` : ""}
${params.brandColors ? `Brand Colors: ${params.brandColors}` : ""}
${params.targetMarket ? `Target Market: ${params.targetMarket}` : ""}
${params.priceRange ? `Price Range: ${params.priceRange}` : ""}

Provide detailed merchandise concepts including:

1. **PRODUCT CONCEPTS** (at least 5 different items)
   - Product name and type
   - Design description
   - Unique selling points
   
2. **DESIGN DETAILS**
   - Visual elements and graphics
   - Typography and text placement
   - Color schemes
   - Material recommendations
   
3. **MARKET POSITIONING**
   - Target customer segment
   - Pricing strategy
   - Value proposition
   
4. **PRODUCTION NOTES**
   - Recommended manufacturers
   - Quality considerations
   - Minimum order quantities
   
5. **MARKETING ANGLES**
   - How to promote each item
   - Bundle opportunities
   - Limited edition possibilities

Focus on unique, marketable designs that align with the artist's brand identity.`;

    return this.generateText(prompt, {
      systemInstruction: "You are a merchandise designer and brand strategist specializing in music artist merchandise. You understand fashion trends, fan culture, and creating products that fans love and want to purchase.",
      temperature: 0.9
    });
  },

  async generateCareerAdvice(params: {
    currentStage?: string;
    goals?: string;
    challenges?: string;
    timeline?: string;
  }): Promise<string> {
    const prompt = `Provide strategic career advice for a music artist:

${params.currentStage ? `Current Stage: ${params.currentStage}` : ""}
${params.goals ? `Goals: ${params.goals}` : ""}
${params.challenges ? `Challenges: ${params.challenges}` : ""}
${params.timeline ? `Timeline: ${params.timeline}` : ""}

Provide comprehensive career guidance including:

1. **CURRENT SITUATION ANALYSIS**
   - Assessment of current position
   - Strengths and opportunities
   - Areas for improvement
   
2. **ACTION PLAN**
   - Short-term priorities (0-3 months)
   - Medium-term goals (3-12 months)
   - Long-term vision (1-3 years)
   
3. **STRATEGIC RECOMMENDATIONS**
   - Career moves to consider
   - Networking opportunities
   - Skill development areas
   
4. **INDUSTRY INSIGHTS**
   - Current trends to leverage
   - Emerging opportunities
   - Common pitfalls to avoid
   
5. **BUSINESS CONSIDERATIONS**
   - Revenue stream diversification
   - Team building recommendations
   - Financial planning tips
   
6. **NEXT STEPS**
   - Immediate actionable tasks
   - Resources and tools needed
   - Success metrics

Provide practical, industry-specific advice based on proven success patterns in the music industry.`;

    return this.generateText(prompt, {
      systemInstruction: "You are an experienced music industry career manager and business advisor. You have guided numerous artists to success and understand the business, creative, and strategic aspects of building a sustainable music career.",
      temperature: 0.7
    });
  },

  async generateImage(params: {
    prompt: string;
    referenceImage?: string;
    style?: string;
    mood?: string;
  }): Promise<string> {
    try {
      const requestBody: any = {
        model: "gemini-2.5-flash-image", // Nano Banana - image generation model
        contents: [
          {
            role: "user",
            parts: [{ text: params.prompt }]
          }
        ],
        config: {
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 8192
          }
        }
      };

      // Add reference image if provided
      if (params.referenceImage) {
        requestBody.contents[0].parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: params.referenceImage
          }
        });
      }

      const response = await ai.models.generateContent(requestBody);

      // Extract image URL from response
      // The response should contain the generated image data or URL
      if (!response || !response.text) {
        throw new Error("No image generated in response");
      }

      // For now, return the response text which should contain the image data/URL
      // In production, you might need to handle the image data differently
      return response.text;
    } catch (error) {
      console.error("Error generating image with Gemini:", error);
      throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};
