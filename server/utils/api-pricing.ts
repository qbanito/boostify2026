/**
 * API Pricing Configuration
 * Precios actualizados a noviembre 2025
 * Todos los precios en USD por 1K tokens
 */

export interface ModelPricing {
  inputCost: number;      // Costo por 1K input tokens
  outputCost: number;     // Costo por 1K output tokens
  costPer1MTokens?: {     // Alternativa: precio por 1M tokens
    input: number;
    output: number;
  };
}

export const API_PRICING: Record<string, Record<string, ModelPricing>> = {
  openai: {
    'gpt-4': {
      inputCost: 0.03,
      outputCost: 0.06
    },
    'gpt-4-turbo': {
      inputCost: 0.01,
      outputCost: 0.03
    },
    'gpt-4o': {
      inputCost: 0.0025,
      outputCost: 0.01
    },
    'gpt-4o-mini': {
      inputCost: 0.00015,
      outputCost: 0.0006
    },
    'gpt-4.1': {
      inputCost: 0.002,
      outputCost: 0.008
    },
    'gpt-4.1-mini': {
      inputCost: 0.0004,
      outputCost: 0.0016
    },
    'gpt-4.1-nano': {
      inputCost: 0.0001,
      outputCost: 0.0004
    },
    'o4-mini': {
      inputCost: 0.0011,
      outputCost: 0.0044
    },
    'gpt-3.5-turbo': {
      inputCost: 0.0005,
      outputCost: 0.0015
    },
    'gpt-3.5-turbo-16k': {
      inputCost: 0.003,
      outputCost: 0.004
    },
    'text-davinci-003': {
      inputCost: 0.02,
      outputCost: 0.02
    },
    'text-embedding-ada-002': {
      inputCost: 0.0001,
      outputCost: 0
    }
  },

  openrouter: {
    'xiaomi/mimo-v2.5-pro': {
      inputCost: 0.0001,
      outputCost: 0.0003
    },
    'xiaomi/mimo-v2.5': {
      inputCost: 0.00008,
      outputCost: 0.0002
    }
  },
  
  gemini: {
    'gemini-2.0-flash': {
      costPer1MTokens: {
        input: 0.075,
        output: 0.3
      }
    },
    'gemini-1.5-pro': {
      costPer1MTokens: {
        input: 1.25,
        output: 5
      }
    },
    'gemini-1.5-flash': {
      costPer1MTokens: {
        input: 0.075,
        output: 0.3
      }
    },
    'gemini-1.0-pro': {
      costPer1MTokens: {
        input: 0.5,
        output: 1.5
      }
    }
  },
  
  anthropic: {
    'claude-3-opus': {
      inputCost: 0.015,
      outputCost: 0.075
    },
    'claude-3-sonnet': {
      inputCost: 0.003,
      outputCost: 0.015
    },
    'claude-3-haiku': {
      inputCost: 0.00025,
      outputCost: 0.00125
    },
    'claude-2.1': {
      inputCost: 0.008,
      outputCost: 0.024
    },
    'claude-2': {
      inputCost: 0.008,
      outputCost: 0.024
    }
  },
  
  fal: {
    // FAL cobra principalmente por inferencia, no por tokens
    // Precios varían según modelo pero usamos aproximaciones
    'fal-ai/flux-pro': {
      inputCost: 0,
      outputCost: 0.005  // ~$0.005 por imagen
    },
    'fal-ai/flux-realism': {
      inputCost: 0,
      outputCost: 0.005
    },
    'fal-ai/stable-diffusion-3-large': {
      inputCost: 0,
      outputCost: 0.003
    },
    'fal-ai/fast-sdxl': {
      inputCost: 0,
      outputCost: 0.002
    },
    'fal-ai/kling-video': {
      inputCost: 0,
      outputCost: 0.1  // Videos son más caros
    },
    // Nano Banana Pro models (legacy - replaced by Flux 2 Pro)
    'fal-ai/nano-banana-pro': {
      inputCost: 0,
      outputCost: 0.004  // ~$0.004 por imagen
    },
    'fal-ai/nano-banana-pro/edit': {
      inputCost: 0,
      outputCost: 0.005  // Edición ligeramente más cara
    },
    // Nano Banana 2 Edit - primary image editing model
    'fal-ai/nano-banana-2/edit': {
      inputCost: 0,
      outputCost: 0.045  // ~$0.045 por edición
    },
    // Nano Banana 2 - primary image generation model
    'fal-ai/nano-banana-2': {
      inputCost: 0,
      outputCost: 0.04  // ~$0.04 por imagen
    },
    // Flux 2 Pro (legacy)
    'fal-ai/flux-2-pro': {
      inputCost: 0,
      outputCost: 0.05  // ~$0.05 por imagen
    },
    // MiniMax Music v2 for audio generation
    'fal-ai/minimax-music/v2': {
      inputCost: 0,
      outputCost: 0.02  // ~$0.02 por minuto de audio
    }
  },
  
  other: {
    default: {
      inputCost: 0,
      outputCost: 0
    }
  },

  // PiAPI - Video/Image generation via third-party API gateway
  piapi: {
    'suno-v3-music': {
      inputCost: 0,
      outputCost: 0.05 // ~$0.05 per generation
    },
    'kling-video': {
      inputCost: 0,
      outputCost: 0.10 // ~$0.10 per video
    },
    'kling-image': {
      inputCost: 0,
      outputCost: 0.02 // ~$0.02 per image
    },
    'flux1-dev': {
      inputCost: 0,
      outputCost: 0.03 // ~$0.03 per image
    },
    'hailuo-video': {
      inputCost: 0,
      outputCost: 0.08 // ~$0.08 per video
    },
    'face-swap': {
      inputCost: 0,
      outputCost: 0.05
    },
    'video-toolkit': {
      inputCost: 0,
      outputCost: 0.04
    },
    default: {
      inputCost: 0,
      outputCost: 0.05
    }
  },

  // OpenRouter - routes to various models
  openrouter: {
    'anthropic/claude-3-haiku': {
      inputCost: 0.00025,
      outputCost: 0.00125
    },
    'google/gemini-2.0-flash-lite': {
      costPer1MTokens: {
        input: 0.075,
        output: 0.3
      }
    },
    default: {
      inputCost: 0.001,
      outputCost: 0.003
    }
  },

  // Shotstack - video rendering
  shotstack: {
    'render': {
      inputCost: 0,
      outputCost: 0.049 // ~$0.049 per render
    },
    default: {
      inputCost: 0,
      outputCost: 0.049
    }
  },

  // Brevo/Resend - email
  brevo: {
    'smtp': {
      inputCost: 0,
      outputCost: 0.0007 // ~$0.0007 per email
    },
    default: {
      inputCost: 0,
      outputCost: 0.0007
    }
  },

  // Apify - web scraping
  apify: {
    'scraper': {
      inputCost: 0,
      outputCost: 0.005 // ~$0.005 per run
    },
    default: {
      inputCost: 0,
      outputCost: 0.005
    }
  }
};

/**
 * Calcula el costo de una llamada API
 * @param provider - Proveedor de API (openai, gemini, etc)
 * @param model - Modelo específico
 * @param promptTokens - Tokens en la solicitud
 * @param completionTokens - Tokens en la respuesta
 * @returns Costo en USD
 */
export function calculateApiCost(
  provider: string,
  model: string | null | undefined,
  promptTokens: number = 0,
  completionTokens: number = 0
): number {
  try {
    const providerLower = provider.toLowerCase();
    const modelLower = (model || 'default').toLowerCase();
    
    // Obtener pricing del modelo
    let pricing = API_PRICING[providerLower]?.[modelLower];
    
    // Si no existe el modelo específico, buscar fallback
    if (!pricing) {
      // Intentar con nombre parcial
      const providerModels = API_PRICING[providerLower];
      if (providerModels) {
        const foundModel = Object.entries(providerModels).find(
          ([key]) => modelLower.includes(key.toLowerCase()) || key.toLowerCase().includes(modelLower)
        );
        if (foundModel) {
          pricing = foundModel[1];
        }
      }
    }
    
    // Si aún no hay pricing, usar default
    if (!pricing) {
      pricing = API_PRICING.other.default;
    }
    
    // Calcular costo
    let cost = 0;
    
    if (pricing.costPer1MTokens) {
      // Modelo con precios por 1M tokens
      cost = (promptTokens / 1000000) * pricing.costPer1MTokens.input +
             (completionTokens / 1000000) * pricing.costPer1MTokens.output;
    } else {
      // Modelo con precios por 1K tokens
      cost = (promptTokens / 1000) * pricing.inputCost +
             (completionTokens / 1000) * pricing.outputCost;
    }
    
    return parseFloat(cost.toFixed(8));
  } catch (error) {
    console.error('Error calculating API cost:', error);
    return 0;
  }
}

/**
 * Obtiene el pricing para un modelo específico
 */
export function getModelPricing(provider: string, model: string | null): ModelPricing | null {
  const providerLower = provider.toLowerCase();
  const modelLower = (model || 'default').toLowerCase();
  
  return API_PRICING[providerLower]?.[modelLower] || 
         API_PRICING.other.default;
}

/**
 * Formatea el costo para mostrar
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(6)}`;
}
