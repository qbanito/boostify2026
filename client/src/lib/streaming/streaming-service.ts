export interface StreamingTrack {
  id: string;
  title: string;
  artist: string;
  albumArt?: string;
  duration: number;
  streamUrl: string;
  source: 'spotify' | 'apple' | 'youtube' | 'local';
  externalUrl?: string;
}

export interface StreamingService {
  name: string;
  isAuthenticated: boolean;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  search(query: string): Promise<StreamingTrack[]>;
  getRecommendations(): Promise<StreamingTrack[]>;
  play(track: StreamingTrack): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

export class StreamingError extends Error {
  constructor(
    message: string,
    public service: string,
    public code?: string
  ) {
    super(message);
    this.name = 'StreamingError';
  }
}
