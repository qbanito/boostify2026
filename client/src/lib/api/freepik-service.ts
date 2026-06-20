/**
 * Freepik AI Service Client
 * 
 * This provides a client for the Freepik AI API to generate images with various models.
 * Models supported: Mystic, Imagen3, Classic Fast, and Flux Dev
 */

import axios from 'axios';
import { logger } from "../logger";

/**
 * Enum for supported Freepik AI models
 */
export enum FreepikModel {
  MYSTIC = 'mystic',
  IMAGEN3 = 'imagen3',
  CLASSIC_FAST = 'classic_fast',
  CLASSIC = 'classic',
  FLUX_DEV = 'flux_dev'
}

/**
 * Enum for aspect ratios supported by Freepik AI
 */
export type FreepikAspectRatio = 
  'square_1_1' | 'classic_4_3' | 'traditional_3_4' | 'widescreen_16_9' | 
  'social_story_9_16' | 'smartphone_horizontal_20_9' | 'smartphone_vertical_9_20' |
  'standard_3_2' | 'portrait_2_3' | 'horizontal_2_1' | 'vertical_1_2' |
  'social_5_4' | 'social_post_4_5';

/**
 * Base options for all Freepik AI models
 */
export interface FreepikBaseOptions {
  prompt: string;
  aspect_ratio: FreepikAspectRatio;
}

/**
 * Options for Mystic AI model
 */
export interface FreepikMysticOptions extends FreepikBaseOptions {
  resolution: '4k' | '2k';
  realism: boolean;
  creative_detailing: number;
  engine: 'automatic' | 'magnific_illusio' | 'magnific_sharpy' | 'magnific_sparkle';
  fixed_generation: boolean;
  filter_nsfw: boolean;
}

/**
 * Options for Imagen3 AI model
 */
export interface FreepikImagen3Options extends FreepikBaseOptions {
  num_images: number;
  style_preset?: string; // Replacing styling object with style_preset for consistency
  person_generation: 'dont_allow' | 'allow_adult' | 'allow_all';
  safety_settings: 'block_low_and_above' | 'block_medium_and_above' | 'block_only_high' | 'block_none';
}

/**
 * Options for Classic and Classic Fast AI models
 */
export interface FreepikClassicOptions extends FreepikBaseOptions {
  resolution?: 'high' | 'medium' | 'low';
  seed?: number;
  negative_prompt?: string;
  guidance_scale?: number;
  num_inference_steps?: number;
  num_images?: number;
}

/**
 * Options for Flux Dev AI model
 */
export interface FreepikFluxDevOptions extends FreepikBaseOptions {
  resolution: 'high' | 'medium' | 'low';
  seed?: number;
  negative_prompt?: string;
  style_preset?: string;
  guidance_scale?: number;
}

/**
 * Union type for all model options
 */
export type FreepikGenerationOptions = 
  FreepikMysticOptions | 
  FreepikImagen3Options | 
  FreepikClassicOptions | 
  FreepikFluxDevOptions;

/**
 * Task status response from Freepik
 */
export interface FreepikTaskStatusResponse {
  task_id: string;
  status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  generated?: {
    url: string;
    prompt: string;
  }[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Freepik API Client Class
 */
class FreepikService {
  private apiKey: string;
  private baseUrl: string;
  
  constructor() {
    this.apiKey = import.meta.env.VITE_FREEPIK_API_KEY || '';
    this.baseUrl = 'https://api.freepik.com/v1/ai';
  }
  
  /**
   * Check if API key is available
   */
  hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 10);
  }
  
  /**
   * Generate image with specified model
   * @param options Generation options
   * @param model Freepik model to use
   */
  async generateImage(options: FreepikGenerationOptions, model: FreepikModel = FreepikModel.MYSTIC) {
    const endpoint = `${this.baseUrl}/${model}`;
    
    try {
      return await axios.post(endpoint, options, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-Key': this.apiKey
        }
      });
    } catch (error) {
      logger.error(`Error generating image with Freepik ${model}:`, error);
      throw error;
    }
  }
  
  /**
   * Check status of an asynchronous task
   * @param taskId ID of the task to check
   */
  async checkTaskStatus(taskId: string) {
    const endpoint = `${this.baseUrl}/mystic/${taskId}`;
    
    try {
      return await axios.get(endpoint, {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': this.apiKey
        }
      });
    } catch (error) {
      logger.error('Error checking task status with Freepik:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const freepikService = new FreepikService();

// Check if we can use the API directly in the browser
export function canUseFreepikDirectly(): boolean {
  return freepikService.hasApiKey();
}