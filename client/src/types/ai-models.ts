import { z } from "zod";

export const textModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(["openai", "anthropic", "google", "cohere", "deepseek", "alibaba", "baidu", "zhipu"]),
  modelId: z.string(),
  maxTokens: z.number(),
  temperature: z.number(),
  enabled: z.boolean(),
  apiKey: z.string().optional(),
  contextWindow: z.number(),
});

export const imageModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(["fal", "openai", "stability", "baidu"]),
  modelId: z.string(),
  enabled: z.boolean(),
  apiKey: z.string().optional(),
  maxResolution: z.object({
    width: z.number(),
    height: z.number(),
  }),
});

export type TextModel = z.infer<typeof textModelSchema>;
export type ImageModel = z.infer<typeof imageModelSchema>;

export interface AIModelsConfig {
  textModels: TextModel[];
  imageModels: ImageModel[];
  defaultTextModel: string;
  defaultImageModel: string;
}