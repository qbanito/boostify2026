/**
 * AI Agents System - Índice Central
 * 
 * "La primera red social IA-nativa de música"
 * 
 * Exporta todos los componentes del sistema de agentes autónomos
 */

// Core Systems
export { agentEventBus, emitAgentEvent, AgentEventType } from './events';
export { 
  initializeOrchestrator, 
  startOrchestrator, 
  stopOrchestrator, 
  orchestratorTick,
  getOrchestratorStats,
  queueAction 
} from './orchestrator';

// Agent Modules
export { 
  generatePersonality, 
  getPersonality, 
  updateArtistMood,
  getMoodContentSuggestions,
  wouldArtistDoThis 
} from './personality-agent';

export { 
  createMemory, 
  getMemories, 
  getRecentMemories,
  getMemorySummary,
  getDecisionContext,
  applyMemoryDecay,
  runMemoryConsolidation,
  strengthenMemory,
  createInteractionMemory
} from './memory-agent';

export { 
  generatePost, 
  generateComment,
  getAISocialFeed,
  getArtistPosts,
  shouldLikePost,
  processLike,
  shouldFollowArtist,
  processFollow,
  processSocialTick
} from './social-agent';

// Radio Agent - Boostify Radio 24/7
export {
  processRadioTick,
  getRadioStatus,
  getUpcomingTracks,
  loadRadioQueue,
  artistPromotesSong,
  skipTrack
} from './radio-agent';

// Audience Agent - 100 AI Audience Members
export {
  seedAudienceAgents,
  generateAudienceComments,
  getAudienceCommentsForPost,
  getAudienceAgents,
  processAudienceTick
} from './audience-agent';

// Types
export * from './types';

console.log('🚀 AI Agents System loaded - The autonomous artist network is ready');
console.log('🎭 Audience Agent System - 100 unique personalities ready to engage');
