/**
 * Tipos para la red social.
 * Esta interfaz proporciona tipado para todo lo relacionado con la red social
 */

export interface SocialUser {
  id: string;
  displayName: string;
  avatar?: string | null;
  bio?: string | null;
  interests?: string[] | null;
  language: 'en' | 'es';
  isBot: boolean;
  personality?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  user?: SocialUser;
  postId: string;
  parentId?: string | null;
  content: string;
  likes: number;
  isReply: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  userId: string;
  user?: SocialUser;
  content: string;
  likes: number;
  isLiked?: boolean;
  isSaved?: boolean;
  comments?: Comment[];
  createdAt: string;
  updatedAt: string;
}

// Request y Response types

export interface CreatePostRequest {
  content: string;
}

export interface CreateCommentRequest {
  content: string;
  isReply: boolean;
  parentId: string | null;
}

export interface GetPostsResponse {
  posts: Post[];
}

export interface GetUsersResponse {
  users: SocialUser[];
}

/**
 * Interface para la respuesta del servicio OpenRouter AI
 */
export interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
    index: number;
  }[];
  created: number;
  model: string;
  object: string;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Servicio OpenRouter para generar respuestas de IA contextuales
 */
export interface OpenRouterService {
  generateResponse(prompt: string, context?: string, language?: string): Promise<string>;
}