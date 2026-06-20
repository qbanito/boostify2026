// Servicio para interactuar con Gemini AI para los agentes

export interface MusicLyricsParams {
  genre: string;
  mood: string;
  theme: string;
  language: string;
  structure: string;
}

export interface VideoScriptParams {
  lyrics: string;
  style: string;
  mood: string;
}

export interface MarketingStrategyParams {
  musicGenre?: string;
  targetAudience?: string;
  platforms?: string[];
  budget?: string;
  goals?: string;
}

export interface SocialMediaParams {
  platform?: string;
  contentType?: string;
  artist?: string;
  topic?: string;
  tone?: string;
}

export interface MerchandiseParams {
  artistStyle?: string;
  brandColors?: string;
  targetMarket?: string;
  priceRange?: string;
}

export interface CareerAdviceParams {
  currentStage?: string;
  goals?: string;
  challenges?: string;
  timeline?: string;
}

export interface ImageGenerationParams {
  prompt: string;
  referenceImage?: string; // Base64 encoded image
  style?: string;
  mood?: string;
}

class GeminiAgentsService {
  private baseUrl = '/api/gemini-agents';

  private async request<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate content');
    }

    return response.json();
  }

  async generateMusicLyrics(params: MusicLyricsParams): Promise<string> {
    const result = await this.request<{ success: boolean; lyrics: string }>(
      '/composer/lyrics',
      params
    );
    return result.lyrics;
  }

  async generateVideoScript(params: VideoScriptParams): Promise<string> {
    const result = await this.request<{ success: boolean; script: string }>(
      '/video-director/script',
      params
    );
    return result.script;
  }

  async generateMarketingStrategy(params: MarketingStrategyParams): Promise<string> {
    const result = await this.request<{ success: boolean; strategy: string }>(
      '/marketing/strategy',
      params
    );
    return result.strategy;
  }

  async generateSocialMediaContent(params: SocialMediaParams): Promise<string> {
    const result = await this.request<{ success: boolean; content: string }>(
      '/social-media/content',
      params
    );
    return result.content;
  }

  async generateMerchandiseIdeas(params: MerchandiseParams): Promise<string> {
    const result = await this.request<{ success: boolean; ideas: string }>(
      '/merchandise/ideas',
      params
    );
    return result.ideas;
  }

  async generateCareerAdvice(params: CareerAdviceParams): Promise<string> {
    const result = await this.request<{ success: boolean; advice: string }>(
      '/manager/advice',
      params
    );
    return result.advice;
  }

  async generateText(
    prompt: string,
    systemInstruction?: string,
    temperature?: number
  ): Promise<string> {
    const result = await this.request<{ success: boolean; text: string }>(
      '/generate',
      { prompt, systemInstruction, temperature }
    );
    return result.text;
  }

  async generateImage(params: ImageGenerationParams): Promise<string> {
    const result = await this.request<{ success: boolean; imageUrl: string }>(
      '/photographer/generate-image',
      params
    );
    return result.imageUrl;
  }
}

export const geminiAgentsService = new GeminiAgentsService();
