/**
 * Professional Editor Components
 * Export barrel for all professional editing components
 */

// Export Enhanced Timeline as main timeline component
export { EnhancedTimeline, default as ProfessionalTimeline } from './EnhancedTimeline';
export type { TimelineClip, TimelineTrack } from './EnhancedTimeline';

// Keep backward compatibility
export { default as FixedTimeline } from './fixed-timeline';
