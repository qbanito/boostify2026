/**
 * OpenAI Agents Service
 * Reemplaza gemini-service.ts para agentes especializados de la industria musical
 * Migrado de Gemini a OpenAI para mayor eficiencia y consistencia
 * 
 * V2: Function Calling + Tool Execution Loop
 */
import { createTrackedOpenAI } from "../utils/tracked-openai";
import { generateImageWithNanoBanana, editImageWithNanoBanana, type FalImageResult } from './fal-service';
import { getToolsForAgent, type ToolResult } from './agent-tool-registry';
import { executeTool } from './agent-tool-executors';

// Initialize OpenAI client
const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
}

/** Result from the enhanced agent execution with tool calling */
export interface AgentExecutionResult {
  text: string;
  toolResults: ToolResult[];
  tokensUsed: number;
  model: string;
}

export const agentsService = {
  /**
   * Simple text generation (backward compatible, no tools)
   */
  async generateText(
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<string> {
    const {
      model = PRIMARY_MODEL,
      temperature = 0.9,
      maxTokens = 4096,
      systemInstruction
    } = options;

    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [];
      
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
      }
      messages.push({ role: "user", content: prompt });

      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new Error("No text generated in response");
      }

      return text;
    } catch (error) {
      console.error("Error generating text with OpenAI:", error);
      throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  /**
   * ENHANCED: Execute an agent with Function Calling + tool execution loop
   * The LLM can invoke tools, get real results, and incorporate them into the response
   */
  async executeWithTools(
    agentType: string,
    prompt: string,
    options: GenerationOptions & {
      userId: number;
      artistId?: number;
      sessionId?: number;
      artistName?: string;
      maxToolCalls?: number;
    }
  ): Promise<AgentExecutionResult> {
    const {
      model = PRIMARY_MODEL,
      temperature = 0.9,
      maxTokens = 4096,
      systemInstruction,
      userId,
      artistId,
      sessionId,
      artistName,
      maxToolCalls = 5,
    } = options;

    const tools = getToolsForAgent(agentType);
    const allToolResults: ToolResult[] = [];
    let totalTokens = 0;

    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    // Inject tool usage instructions
    messages.push({
      role: "system",
      content: `You have access to tools that can execute REAL actions (save to database, generate images, schedule posts, etc.). When the user asks you to do something actionable, USE the tools to actually do it — don't just describe what should be done. After using tools, summarize what was accomplished and what the user can do next. Always respond in the same language the user uses.`,
    });
    messages.push({ role: "user", content: prompt });

    let toolCallCount = 0;

    // Tool execution loop: keep calling LLM until it stops requesting tools
    while (toolCallCount < maxToolCalls) {
      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
      });

      totalTokens += response.usage?.total_tokens || 0;
      const choice = response.choices[0];

      if (!choice?.message) break;

      // Add assistant message to conversation
      messages.push(choice.message);

      // If no tool calls, we're done
      if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
        break;
      }

      // Execute each tool call
      for (const toolCall of choice.message.tool_calls) {
        toolCallCount++;
        let args: any;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        const result = await executeTool(toolCall.function.name, args, {
          userId,
          artistId,
          sessionId,
          artistName,
        });

        allToolResults.push(result);

        // Feed tool result back to LLM
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Extract final text from last assistant message
    const lastAssistantMsg = messages
      .filter(m => m.role === 'assistant')
      .pop();
    const finalText = (lastAssistantMsg as any)?.content || '';

    return {
      text: finalText,
      toolResults: allToolResults,
      tokensUsed: totalTokens,
      model,
    };
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
2. **TARGET AUDIENCE ANALYSIS**
3. **PLATFORM-SPECIFIC STRATEGIES**
4. **CONTENT CALENDAR** (30-day plan)
5. **GROWTH TACTICS**
6. **METRICS & KPIs**
7. **BUDGET ALLOCATION**
8. **TIMELINE & MILESTONES** (90-day roadmap)

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
1. **POST COPY** - Platform-optimized caption/text with hashtags and CTA
2. **VISUAL SUGGESTIONS** - Image/video concept
3. **ENGAGEMENT TACTICS** - Questions or prompts for audience
4. **OPTIMAL POSTING** - Best time to post
5. **VARIATIONS** - 2-3 alternative versions

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
2. **DESIGN DETAILS** - Visual elements, typography, colors, materials
3. **MARKET POSITIONING** - Target segment, pricing, value proposition
4. **PRODUCTION NOTES** - Manufacturers, quality, MOQs
5. **MARKETING ANGLES** - Promotion, bundles, limited editions

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
2. **ACTION PLAN** - Short-term, medium-term, long-term
3. **STRATEGIC RECOMMENDATIONS**
4. **INDUSTRY INSIGHTS**
5. **BUSINESS CONSIDERATIONS**
6. **NEXT STEPS** - Immediate actionable tasks

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
  }): Promise<FalImageResult> {
    try {
      // Build enhanced prompt
      let enhancedPrompt = params.prompt;
      if (params.style) {
        enhancedPrompt += `. Style: ${params.style}`;
      }
      if (params.mood) {
        enhancedPrompt += `. Mood: ${params.mood}`;
      }

      // Use FAL nano-banana for image generation
      if (params.referenceImage) {
        return editImageWithNanoBanana([params.referenceImage], enhancedPrompt);
      }
      
      return generateImageWithNanoBanana(enhancedPrompt);
    } catch (error) {
      console.error("Error generating image with FAL:", error);
      return {
        success: false,
        error: `Failed to generate image: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

// Alias for backward compatibility
export const geminiService = agentsService;
