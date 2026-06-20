export type MessageType =
  | 'CONNECT'
  | 'SYNC_NOW'
  | 'GET_STATUS'
  | 'PROFILE_DETECTED'
  | 'SYNC_STATS'
  | 'START_EXTRACTION'
  | 'EXTRACTION_PROGRESS'
  | 'EXTRACTION_COMPLETE'
  | 'CANCEL_EXTRACTION'
  | 'PING'
  | 'RUN_TOOL'
  | 'GET_LOGGED_IN_USER';

export interface SpotifyProfile {
  username: string;
  displayName: string;
  profilePicUrl: string;
  monthlyListeners: number;
  followers: number;
  playlistCount: number;
  totalStreams: number;
  topCities: Array<{ city: string; listeners: number }>;
  isVerified: boolean;
  genres: string[];
}

export interface ExtractedProfile {
  username: string;
  displayName: string;
  profilePicUrl?: string;
  profileUrl?: string;
  email?: string;
  followerCount?: number;
  monthlyListeners?: number;
  playlistName?: string;
  playlistUrl?: string;
  playlistFollowers?: number;
  genres?: string[];
  isVerified?: boolean;
  isCurator?: boolean;
  bio?: string;
}

export type SpotifyExtractType = 'playlist_followers' | 'artist_listeners' | 'playlist_curators' | 'related_artists';

export interface ExtractionJob {
  type: SpotifyExtractType;
  query: string;
  maxResults: number;
  status: 'idle' | 'running' | 'complete' | 'error';
  progress: number;
  results: ExtractedProfile[];
  error?: string;
}

export const API_BASE = typeof window !== 'undefined' && window.location?.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : 'https://boostifymusic.com';
