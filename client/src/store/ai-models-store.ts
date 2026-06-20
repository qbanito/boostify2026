import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TextModel, ImageModel, AIModelsConfig } from "../types/ai-models";

interface AIModelsStore extends AIModelsConfig {
  updateTextModel: (model: TextModel) => void;
  updateImageModel: (model: ImageModel) => void;
  setDefaultTextModel: (modelId: string) => void;
  setDefaultImageModel: (modelId: string) => void;
  toggleModelStatus: (modelId: string, type: 'text' | 'image') => void;
}

const initialState: AIModelsConfig = {
  textModels: [
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      modelId: 'gpt-4-turbo',
      maxTokens: 128000,
      temperature: 0.7,
      enabled: true,
      contextWindow: 128000,
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      modelId: 'gpt-3.5-turbo',
      maxTokens: 16384,
      temperature: 0.7,
      enabled: true,
      contextWindow: 16384,
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      modelId: 'claude-3-opus',
      maxTokens: 200000,
      temperature: 0.7,
      enabled: true,
      contextWindow: 200000,
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      modelId: 'claude-3-sonnet',
      maxTokens: 200000,
      temperature: 0.7,
      enabled: true,
      contextWindow: 200000,
    },
    {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      modelId: 'claude-3-haiku',
      maxTokens: 200000,
      temperature: 0.7,
      enabled: true,
      contextWindow: 200000,
    },
    {
      id: 'gemini-1-ultra',
      name: 'Gemini Ultra',
      provider: 'google',
      modelId: 'gemini-1-ultra',
      maxTokens: 32768,
      temperature: 0.7,
      enabled: true,
      contextWindow: 32768,
    },
    {
      id: 'gemini-1-pro',
      name: 'Gemini Pro',
      provider: 'google',
      modelId: 'gemini-1-pro',
      maxTokens: 32768,
      temperature: 0.7,
      enabled: true,
      contextWindow: 32768,
    },
    {
      id: 'command-r',
      name: 'Command-R',
      provider: 'cohere',
      modelId: 'command-r',
      maxTokens: 4096,
      temperature: 0.7,
      enabled: true,
      contextWindow: 4096,
    },
  ],
  imageModels: [
    {
      id: 'dall-e-3',
      name: 'DALL·E 3',
      provider: 'openai',
      modelId: 'dall-e-3',
      enabled: true,
      maxResolution: {
        width: 1024,
        height: 1024,
      },
    },
    {
      id: 'stable-diffusion-xl',
      name: 'Stable Diffusion XL',
      provider: 'stability',
      modelId: 'stable-diffusion-xl',
      enabled: true,
      maxResolution: {
        width: 1024,
        height: 1024,
      },
    },
    {
      id: 'ernie-vilg-2',
      name: 'ERNIE-ViLG 2.0',
      provider: 'baidu',
      modelId: 'ernie-vilg-2.0',
      enabled: true,
      maxResolution: {
        width: 1024,
        height: 1024,
      },
    },
  ],
  defaultTextModel: 'gpt-4-turbo',
  defaultImageModel: 'dall-e-3',
};

export const useAIModelsStore = create<AIModelsStore>()(
  persist(
    (set) => ({
      ...initialState,
      updateTextModel: (model) =>
        set((state) => ({
          textModels: state.textModels.map((m) =>
            m.id === model.id ? model : m
          ),
        })),
      updateImageModel: (model) =>
        set((state) => ({
          imageModels: state.imageModels.map((m) =>
            m.id === model.id ? model : m
          ),
        })),
      setDefaultTextModel: (modelId) =>
        set(() => ({ defaultTextModel: modelId })),
      setDefaultImageModel: (modelId) =>
        set(() => ({ defaultImageModel: modelId })),
      toggleModelStatus: (modelId, type) =>
        set((state) => {
          if (type === 'text') {
            return {
              textModels: state.textModels.map((m) =>
                m.id === modelId ? { ...m, enabled: !m.enabled } : m
              ),
            };
          }
          return {
            imageModels: state.imageModels.map((m) =>
              m.id === modelId ? { ...m, enabled: !m.enabled } : m
            ),
          };
        }),
    }),
    {
      name: 'ai-models-storage',
    }
  )
);