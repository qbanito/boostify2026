import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { logger } from "../logger";
import { db } from '../firebase';

// Firestore collections for each agent type
export const AGENT_FIRESTORE_COLLECTIONS = {
  composer: 'ai_composer_results',
  videoDirector: 'ai_video_director_results',
  marketing: 'ai_marketing_results',
  socialMedia: 'ai_social_media_results',
  merchandise: 'ai_merchandise_results',
  manager: 'ai_manager_results',
  photographer: 'ai_photographer_results',
} as const;

// Base interface for all agent results
export interface BaseAgentResult {
  userId: string;
  agentType: keyof typeof AGENT_FIRESTORE_COLLECTIONS;
  timestamp: any;
  content: string;
  params: Record<string, any>;
}

// Specific result types for each agent
export interface ComposerResult extends BaseAgentResult {
  agentType: 'composer';
  resultType: 'lyrics' | 'music' | 'melody';
  genre?: string;
  mood?: string;
  theme?: string;
}

export interface VideoDirectorResult extends BaseAgentResult {
  agentType: 'videoDirector';
  resultType: 'script' | 'concept' | 'storyboard';
  style?: string;
  mood?: string;
}

export interface MarketingResult extends BaseAgentResult {
  agentType: 'marketing';
  resultType: 'strategy' | 'campaign' | 'analysis';
  targetAudience?: string;
  platforms?: string[];
}

export interface SocialMediaResult extends BaseAgentResult {
  agentType: 'socialMedia';
  resultType: 'post' | 'calendar' | 'strategy';
  platform?: string;
  contentType?: string;
}

export interface MerchandiseResult extends BaseAgentResult {
  agentType: 'merchandise';
  resultType: 'design' | 'ideas' | 'analysis';
  artistStyle?: string;
  targetMarket?: string;
}

export interface ManagerResult extends BaseAgentResult {
  agentType: 'manager';
  resultType: 'advice' | 'plan' | 'analysis';
  currentStage?: string;
  goals?: string;
}

export interface PhotographerResult extends BaseAgentResult {
  agentType: 'photographer';
  resultType: 'cover_art' | 'promotional' | 'artistic';
  style?: string;
  mood?: string;
  colorScheme?: string;
}

export type AgentResult = 
  | ComposerResult 
  | VideoDirectorResult 
  | MarketingResult 
  | SocialMediaResult 
  | MerchandiseResult 
  | ManagerResult
  | PhotographerResult;

class AIAgentsFirestoreService {
  /**
   * Save an agent result to Firestore
   */
  async saveResult(result: AgentResult): Promise<string> {
    try {
      const collectionName = AGENT_FIRESTORE_COLLECTIONS[result.agentType];
      
      const docData = {
        ...result,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, collectionName), docData);
      
      logger.info(`✅ ${result.agentType} result saved to Firestore:`, docRef.id);
      return docRef.id;
    } catch (error) {
      logger.error(`Error saving ${result.agentType} result to Firestore:`, error);
      throw error;
    }
  }

  /**
   * Get recent results for a user and agent type
   */
  async getRecentResults(
    userId: string, 
    agentType: keyof typeof AGENT_FIRESTORE_COLLECTIONS, 
    limitCount: number = 10
  ): Promise<AgentResult[]> {
    try {
      const collectionName = AGENT_FIRESTORE_COLLECTIONS[agentType];
      const q = query(
        collection(db, collectionName),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const results: AgentResult[] = [];

      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() } as AgentResult);
      });

      return results;
    } catch (error) {
      logger.error(`Error getting recent ${agentType} results:`, error);
      return [];
    }
  }

  /**
   * Save composer lyrics result
   */
  async saveComposerLyrics(
    userId: string,
    lyrics: string,
    params: { genre?: string; mood?: string; theme?: string; language?: string; structure?: string }
  ): Promise<string> {
    const result: ComposerResult = {
      userId,
      agentType: 'composer',
      resultType: 'lyrics',
      content: lyrics,
      params,
      timestamp: null,
      genre: params.genre,
      mood: params.mood,
      theme: params.theme,
    };

    return this.saveResult(result);
  }

  /**
   * Save video director script result
   */
  async saveVideoScript(
    userId: string,
    script: string,
    params: { lyrics?: string; style?: string; mood?: string }
  ): Promise<string> {
    const result: VideoDirectorResult = {
      userId,
      agentType: 'videoDirector',
      resultType: 'script',
      content: script,
      params,
      timestamp: null,
      style: params.style,
      mood: params.mood,
    };

    return this.saveResult(result);
  }

  /**
   * Save marketing strategy result
   */
  async saveMarketingStrategy(
    userId: string,
    strategy: string,
    params: { musicGenre?: string; targetAudience?: string; platforms?: string[]; budget?: string; goals?: string }
  ): Promise<string> {
    const result: MarketingResult = {
      userId,
      agentType: 'marketing',
      resultType: 'strategy',
      content: strategy,
      params,
      timestamp: null,
      targetAudience: params.targetAudience,
      platforms: params.platforms,
    };

    return this.saveResult(result);
  }

  /**
   * Save social media content result
   */
  async saveSocialMediaContent(
    userId: string,
    content: string,
    params: { platform?: string; contentType?: string; artist?: string; topic?: string; tone?: string }
  ): Promise<string> {
    const result: SocialMediaResult = {
      userId,
      agentType: 'socialMedia',
      resultType: params.contentType === 'calendar' ? 'calendar' : 'post',
      content,
      params,
      timestamp: null,
      platform: params.platform,
      contentType: params.contentType,
    };

    return this.saveResult(result);
  }

  /**
   * Save merchandise ideas result
   */
  async saveMerchandiseIdeas(
    userId: string,
    ideas: string,
    params: { artistStyle?: string; brandColors?: string; targetMarket?: string; priceRange?: string }
  ): Promise<string> {
    const result: MerchandiseResult = {
      userId,
      agentType: 'merchandise',
      resultType: 'ideas',
      content: ideas,
      params,
      timestamp: null,
      artistStyle: params.artistStyle,
      targetMarket: params.targetMarket,
    };

    return this.saveResult(result);
  }

  /**
   * Save career advice result
   */
  async saveCareerAdvice(
    userId: string,
    advice: string,
    params: { currentStage?: string; goals?: string; challenges?: string; timeline?: string }
  ): Promise<string> {
    const result: ManagerResult = {
      userId,
      agentType: 'manager',
      resultType: 'advice',
      content: advice,
      params,
      timestamp: null,
      currentStage: params.currentStage,
      goals: params.goals,
    };

    return this.saveResult(result);
  }

  /**
   * Get all results for a user across all agents
   */
  async getAllUserResults(userId: string, limitCount: number = 50): Promise<AgentResult[]> {
    const allResults: AgentResult[] = [];
    
    for (const agentType of Object.keys(AGENT_FIRESTORE_COLLECTIONS) as Array<keyof typeof AGENT_FIRESTORE_COLLECTIONS>) {
      const results = await this.getRecentResults(userId, agentType, limitCount);
      allResults.push(...results);
    }

    // Sort by timestamp descending
    allResults.sort((a, b) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return timeB - timeA;
    });

    return allResults.slice(0, limitCount);
  }
}

export const aiAgentsFirestore = new AIAgentsFirestoreService();
