/**
 * BOOSTIFY NODE FLOW — NODE_SCHEMA
 * Defines input requirements and output contracts for every node type.
 * Used by NodeDependencyContext to compute, in real-time, which required
 * upstream nodes are connected vs. missing for any given node on the canvas.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutputKind = 'image' | 'video' | 'audio' | 'text' | 'data';

export interface InputRequirement {
  /** Node type that provides this input */
  nodeType: string;
  /** Human-readable label shown in the missing-inputs UI */
  label: string;
  /** Emoji icon for the indicator chip */
  icon: string;
  /** Neon accent color for the chip */
  color: string;
  /** One-liner explaining why this node is needed */
  reason: string;
  /** If true → node cannot run without this. If false → recommended but optional. */
  required: boolean;
}

export interface OutputSpec {
  key: string;
  label: string;
  kind: OutputKind;
}

export interface NodeSchema {
  /** Human-readable name */
  label: string;
  /** One-liner description */
  description: string;
  /** What inputs this node needs from upstream nodes */
  inputs: InputRequirement[];
  /** What this node produces (used to inform downstream consumers) */
  outputs: OutputSpec[];
  /** Primary output kind — used for the type badge */
  outputKind?: OutputKind;
}

// ─── Schema map ───────────────────────────────────────────────────────────────

export const NODE_SCHEMA: Record<string, NodeSchema> = {

  // ── Root inputs (no upstream requirements) ────────────────────────────────

  artistInput: {
    label: 'Artist Input',
    description: 'Provides artist identity: name, genre, location, style.',
    inputs: [],
    outputs: [
      { key: 'artistId',   label: 'Artist ID',   kind: 'data' },
      { key: 'artistName', label: 'Artist Name',  kind: 'text' },
      { key: 'genre',      label: 'Genre',        kind: 'text' },
      { key: 'biography',  label: 'Biography',    kind: 'text' },
    ],
  },

  songInput: {
    label: 'Song Input',
    description: 'Provides song metadata: title, audio URL, BPM, genre.',
    inputs: [],
    outputs: [
      { key: 'songId',    label: 'Song ID',    kind: 'data' },
      { key: 'title',     label: 'Song Title', kind: 'text' },
      { key: 'audioUrl',  label: 'Audio URL',  kind: 'audio' },
    ],
  },

  videoInput: {
    label: 'Video Input',
    description: 'Provides a video: paste URL or AI-generate via PiAPI Hailuo.',
    inputs: [],
    outputs: [
      { key: 'videoUrl',     label: 'Video URL',     kind: 'video' },
      { key: 'title',        label: 'Video Title',   kind: 'text'  },
      { key: 'thumbnailUrl', label: 'Thumbnail URL', kind: 'image' },
    ],
    outputKind: 'video',
  },

  talkToMe: {
    label: 'Talk To Me',
    description: 'Configure ElevenLabs Conversational AI so fans can voice-chat with the artist AI double.',
    inputs: [
      {
        nodeType: 'artistInput',
        label: 'Artist Input',
        icon: '🎤',
        color: '#10b981',
        reason: 'Needs artist name and context to build the AI conversation persona.',
        required: false,
      },
    ],
    outputs: [
      { key: 'sessionConfig', label: 'Session Config', kind: 'text' },
    ],
    outputKind: 'text',
  },

  // ── Premium Page Nodes ────────────────────────────────────────────────────

  youtubeBoost: {
    label: 'YouTube Boost',
    description: 'AI-powered YouTube channel growth tools.',
    inputs: [{ nodeType: 'artistInput', label: 'Artist Input', icon: '🎤', color: '#ff0000', reason: 'Links artist channel data.', required: false }],
    outputs: [
      { key: 'channelUrl',   label: 'Channel URL',   kind: 'text' },
      { key: 'subscribers',  label: 'Subscribers',   kind: 'text' },
      { key: 'growthScore',  label: 'Growth Score',  kind: 'text' },
    ],
    outputKind: 'text',
  },

  instagramBoost: {
    label: 'Instagram Boost',
    description: 'AI captions, hashtags, viral score & engagement tools.',
    inputs: [{ nodeType: 'artistInput', label: 'Artist Input', icon: '🎤', color: '#e1306c', reason: 'Links artist Instagram handle.', required: false }],
    outputs: [
      { key: 'handle',          label: 'IG Handle',       kind: 'text' },
      { key: 'followers',       label: 'Followers',       kind: 'text' },
      { key: 'engagementRate',  label: 'Engagement Rate', kind: 'text' },
    ],
    outputKind: 'text',
  },

  tiktokBoost: {
    label: 'TikTok Boost',
    description: 'Viral score, trends, reel creator & content calendar.',
    inputs: [{ nodeType: 'artistInput', label: 'Artist Input', icon: '🎤', color: '#010101', reason: 'Links artist TikTok context.', required: false }],
    outputs: [
      { key: 'handle',     label: 'TikTok Handle', kind: 'text' },
      { key: 'followers',  label: 'Followers',     kind: 'text' },
      { key: 'viralScore', label: 'Viral Score',   kind: 'text' },
    ],
    outputKind: 'text',
  },

  artistImage: {
    label: 'Artist Image',
    description: 'AI visual identity advisor: photos, covers & personas.',
    inputs: [{ nodeType: 'artistInput', label: 'Artist Input', icon: '🎤', color: '#8b5cf6', reason: 'Provides current artist images.', required: false }],
    outputs: [
      { key: 'profileImage', label: 'Profile Image', kind: 'image' },
      { key: 'coverImage',   label: 'Cover Image',   kind: 'image' },
      { key: 'styleScore',   label: 'Style Score',   kind: 'text'  },
    ],
    outputKind: 'image',
  },

  merch: {
    label: 'Merch Store',
    description: 'Printful merchandise, bundles & seasonal drops.',
    inputs: [{ nodeType: 'artistInput', label: 'Artist Input', icon: '🎤', color: '#f97316', reason: 'Links the artist merch catalog.', required: false }],
    outputs: [
      { key: 'productCount', label: 'Product Count', kind: 'text' },
      { key: 'revenue',      label: 'Revenue',       kind: 'text' },
      { key: 'storeUrl',     label: 'Store URL',     kind: 'text' },
    ],
    outputKind: 'text',
  },

  contacts: {
    label: 'Contacts',
    description: 'Music industry contacts, venues & AI outreach campaigns.',
    inputs: [{ nodeType: 'artistInput', label: 'Artist Input', icon: '🎤', color: '#06b6d4', reason: 'Adds artist context to outreach.', required: false }],
    outputs: [
      { key: 'contactCount',    label: 'Contact Count',    kind: 'text' },
      { key: 'activeOutreach',  label: 'Active Outreach',  kind: 'text' },
      { key: 'venues',          label: 'Venues Found',     kind: 'text' },
    ],
    outputKind: 'text',
  },

  aiArtistMint: {
    label: 'AI Artist Mint',
    description: 'Mint your artist identity as a BTF-2300 token on Polygon.',
    inputs: [{ nodeType: 'artistInput', label: 'Artist Input', icon: '🎤', color: '#f59e0b', reason: 'Provides artist metadata to mint.', required: false }],
    outputs: [
      { key: 'mintStatus',       label: 'Mint Status',       kind: 'text' },
      { key: 'tokenId',          label: 'Token ID',          kind: 'text' },
      { key: 'blockchainNetwork', label: 'Network',          kind: 'text' },
    ],
    outputKind: 'text',
  },

  // ── Processing nodes ──────────────────────────────────────────────────────

  bioGenerator: {
    label: 'Bio Generator',
    description: 'Generates an AI biography for the artist.',
    inputs: [
      {
        nodeType: 'artistInput',
        label: 'Artist Input',
        icon: '🎤',
        color: '#3b82f6',
        reason: 'Needs artist name, genre and location to craft the biography.',
        required: true,
      },
    ],
    outputs: [
      { key: 'biography', label: 'Biography', kind: 'text' },
    ],
    outputKind: 'text',
  },

  coverArt: {
    label: 'Cover Art',
    description: 'AI-generates a cover image based on artist style and song.',
    inputs: [
      {
        nodeType: 'artistInput',
        label: 'Artist Input',
        icon: '🎤',
        color: '#3b82f6',
        reason: 'Needs artist style and genre to generate the visual aesthetic.',
        required: true,
      },
      {
        nodeType: 'songInput',
        label: 'Song Input',
        icon: '🎵',
        color: '#a78bfa',
        reason: 'Song title and mood refine the cover art concept.',
        required: false,
      },
    ],
    outputs: [
      { key: 'imageUrl', label: 'Cover Image', kind: 'image' },
    ],
    outputKind: 'image',
  },

  karaoke: {
    label: 'Karaoke',
    description: 'Strips vocals and generates a lyrics overlay video.',
    inputs: [
      {
        nodeType: 'songInput',
        label: 'Song Input',
        icon: '🎵',
        color: '#a78bfa',
        reason: 'Needs the audio URL to perform vocal separation.',
        required: true,
      },
    ],
    outputs: [
      { key: 'videoUrl',  label: 'Karaoke Video', kind: 'video' },
      { key: 'lyricsUrl', label: 'Lyrics File',   kind: 'text' },
    ],
    outputKind: 'video',
  },

  promoClip: {
    label: 'Promo Clip',
    description: 'Generates a short promo video clip for a song.',
    inputs: [
      {
        nodeType: 'songInput',
        label: 'Song Input',
        icon: '🎵',
        color: '#a78bfa',
        reason: 'Needs audio and song metadata as the base for the video.',
        required: true,
      },
      {
        nodeType: 'artistInput',
        label: 'Artist Input',
        icon: '🎤',
        color: '#3b82f6',
        reason: 'Artist branding and visuals personalize the promo style.',
        required: false,
      },
      {
        nodeType: 'coverArt',
        label: 'Cover Art',
        icon: '🖼️',
        color: '#8b5cf6',
        reason: 'Cover image is used as the video thumbnail / background.',
        required: false,
      },
    ],
    outputs: [
      { key: 'videoUrl', label: 'Promo Video', kind: 'video' },
    ],
    outputKind: 'video',
  },

  socialPost: {
    label: 'Social Post',
    description: 'Generates caption + hashtags for social media.',
    inputs: [
      {
        nodeType: 'artistInput',
        label: 'Artist Input',
        icon: '🎤',
        color: '#3b82f6',
        reason: 'Artist name, genre and tone define the caption voice.',
        required: true,
      },
      {
        nodeType: 'songInput',
        label: 'Song Input',
        icon: '🎵',
        color: '#a78bfa',
        reason: 'Song title and mood improve hashtag relevance.',
        required: false,
      },
      {
        nodeType: 'coverArt',
        label: 'Cover Art',
        icon: '🖼️',
        color: '#8b5cf6',
        reason: 'Attaches the generated cover as the post image.',
        required: false,
      },
    ],
    outputs: [
      { key: 'caption',  label: 'Caption',   kind: 'text' },
      { key: 'hashtags', label: 'Hashtags',  kind: 'text' },
    ],
    outputKind: 'text',
  },

  shareCard: {
    label: 'Share Card',
    description: 'Creates a branded share card image for the artist or song.',
    inputs: [
      {
        nodeType: 'artistInput',
        label: 'Artist Input',
        icon: '🎤',
        color: '#3b82f6',
        reason: 'Artist name and branding are required for the card design.',
        required: true,
      },
      {
        nodeType: 'songInput',
        label: 'Song Input',
        icon: '🎵',
        color: '#a78bfa',
        reason: 'Song title is displayed on the card.',
        required: false,
      },
      {
        nodeType: 'coverArt',
        label: 'Cover Art',
        icon: '🖼️',
        color: '#8b5cf6',
        reason: 'Uses the cover as the card background image.',
        required: false,
      },
    ],
    outputs: [
      { key: 'cardUrl', label: 'Share Card Image', kind: 'image' },
    ],
    outputKind: 'image',
  },

  profileUpdate: {
    label: 'Profile Update',
    description: 'Pushes updated data back to the artist profile.',
    inputs: [
      {
        nodeType: 'artistInput',
        label: 'Artist Input',
        icon: '🎤',
        color: '#3b82f6',
        reason: 'Identifies which profile to update.',
        required: true,
      },
      {
        nodeType: 'bioGenerator',
        label: 'Bio Generator',
        icon: '📝',
        color: '#22d3ee',
        reason: 'New biography to write to the profile.',
        required: false,
      },
      {
        nodeType: 'coverArt',
        label: 'Cover Art',
        icon: '🖼️',
        color: '#8b5cf6',
        reason: 'New cover/profile image to upload.',
        required: false,
      },
    ],
    outputs: [
      { key: 'updated', label: 'Profile Updated', kind: 'data' },
    ],
    outputKind: 'data',
  },

  newsPublisher: {
    label: 'News Publisher',
    description: 'Publishes a news article to the artist\'s news feed.',
    inputs: [
      {
        nodeType: 'artistInput',
        label: 'Artist Input',
        icon: '🎤',
        color: '#3b82f6',
        reason: 'The article is published under the artist\'s identity.',
        required: true,
      },
      {
        nodeType: 'bioGenerator',
        label: 'Bio Generator',
        icon: '📝',
        color: '#22d3ee',
        reason: 'Generated content can be used as article body.',
        required: false,
      },
      {
        nodeType: 'songInput',
        label: 'Song Input',
        icon: '🎵',
        color: '#a78bfa',
        reason: 'Links the article to a specific song release.',
        required: false,
      },
    ],
    outputs: [
      { key: 'articleUrl', label: 'Published Article', kind: 'data' },
    ],
    outputKind: 'data',
  },
};

// ─── Output kind badge label ──────────────────────────────────────────────────

export const OUTPUT_KIND_META: Record<OutputKind, { label: string; icon: string; color: string }> = {
  image: { label: 'Image',  icon: '🖼️',  color: '#8b5cf6' },
  video: { label: 'Video',  icon: '🎬',  color: '#22d3ee' },
  audio: { label: 'Audio',  icon: '🎵',  color: '#3b82f6' },
  text:  { label: 'Text',   icon: '📝',  color: '#10b981' },
  data:  { label: 'Data',   icon: '📦',  color: '#f59e0b' },
};
