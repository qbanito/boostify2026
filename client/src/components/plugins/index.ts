/**
 * Plugins system for Boostify Admin
 * 
 * This file exports all the plugin components that can be used in the Plugins page.
 * Each plugin provides specialized functionality for managing different aspects of the platform.
 */

// BeatNews: Plugin for automatic music news aggregation and publishing
export { BeatNewsPlugin } from "./beatnews-plugin";

// ContentPulse: Plugin for AI-powered content curation and generation
export { ContentPulsePlugin } from "./contentpulse-plugin";

// SocialSync: Plugin for social media management and analytics
export { SocialSyncPlugin } from "./socialsync-plugin";

// EventBeat: Plugin for music event tracking and promotion
export { EventBeatPlugin } from "./eventbeat-plugin";

// TuneMatch: Plugin that recommends personalized content based on user preferences
export { TuneMatchPlugin } from "./tunematch-plugin";

// TrendTracker: Plugin that analyzes and displays content interaction trends
export { TrendTrackerPlugin } from "./trendtracker-plugin";

// StreamLink: Plugin that connects with streaming platforms to display track data
export { StreamLinkPlugin } from "./streamlink-plugin";

// EchoChat: Plugin for user engagement through comments management across all platforms
export { EchoChatPlugin } from "./echochat-plugin";

// SEOPulse: Plugin for optimizing content for search engines and improving visibility
export { SEOPulsePlugin } from "./seopulse-plugin";