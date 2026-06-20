// Shared types for the Copywrite Workflow — Lyrics Authorship Traceability

export interface LyricsStructureMap {
  intro: boolean;
  verse1: boolean;
  preChorus: boolean;
  chorus: boolean;
  verse2: boolean;
  bridge: boolean;
  outro: boolean;
}

export type LineSource = "human-original" | "ai-generated" | "human-approved" | "human-edited" | "human-rewritten";

export interface DraftLine {
  text: string;
  section: string;
  source: LineSource;
  originalAiText?: string;
  editComment?: string;
}

export interface DraftVersion {
  version: number;
  type: "origin" | "ai-draft" | "human-edit" | "final";
  content: string;
  lines: DraftLine[];
  timestamp: string;
}

export interface AuthorshipMetrics {
  humanOriginalLines: number;
  humanEditedLines: number;
  aiAcceptedLines: number;
  humanRewrittenLines: number;
  rewritePercentage: number;
  totalDecisions: number;
}

export interface LyricsProject {
  id?: number;
  userId?: number;
  // Phase 1
  songTitle: string;
  language: string;
  genre: string;
  theme: string;
  emotion: string;
  messageCore: string;
  personalStory: string;
  styleReferences: string[];
  keywords: string[];
  humanOriginalPhrases: string[];
  humanIdeas: string[];
  desiredTone: string;
  // Phase 2
  freeWritingBlock: string;
  looseLines: string[];
  metaphorBank: string[];
  hookBank: string[];
  narrativeImages: string[];
  // Phase 3
  structureMap: LyricsStructureMap;
  verseCount: number;
  chorusLength: string;
  hookRepetition: number;
  bridgePosition: string;
  closingType: string;
  // Phase 4-5
  draftVersions: DraftVersion[];
  // Metrics
  authorshipMetrics: AuthorshipMetrics;
  // Phase 7
  finalLyrics: string;
  authorDeclaration: string;
  // Status
  currentPhase: number;
  status: "draft" | "in-progress" | "completed" | "archived";
  createdAt?: string;
  updatedAt?: string;
}

export const EMPTY_LYRICS_PROJECT: LyricsProject = {
  songTitle: "",
  language: "en",
  genre: "",
  theme: "",
  emotion: "",
  messageCore: "",
  personalStory: "",
  styleReferences: [],
  keywords: [],
  humanOriginalPhrases: [],
  humanIdeas: [],
  desiredTone: "",
  freeWritingBlock: "",
  looseLines: [],
  metaphorBank: [],
  hookBank: [],
  narrativeImages: [],
  structureMap: {
    intro: false,
    verse1: true,
    preChorus: true,
    chorus: true,
    verse2: true,
    bridge: true,
    outro: true,
  },
  verseCount: 2,
  chorusLength: "medium",
  hookRepetition: 2,
  bridgePosition: "after-verse2",
  closingType: "fade",
  draftVersions: [],
  authorshipMetrics: {
    humanOriginalLines: 0,
    humanEditedLines: 0,
    aiAcceptedLines: 0,
    humanRewrittenLines: 0,
    rewritePercentage: 0,
    totalDecisions: 0,
  },
  finalLyrics: "",
  authorDeclaration: "",
  currentPhase: 1,
  status: "draft",
};

export const SECTION_LABELS: Record<string, string> = {
  intro: "Intro",
  verse1: "Verse 1",
  preChorus: "Pre-Chorus",
  chorus: "Chorus",
  verse2: "Verse 2",
  bridge: "Bridge",
  outro: "Outro",
};

export const EMOTION_OPTIONS = [
  "Joy", "Sadness", "Anger", "Love", "Nostalgia", "Hope",
  "Melancholy", "Empowerment", "Longing", "Freedom", "Anxiety", "Peace"
];

export const TONE_OPTIONS = [
  "Poetic", "Street / Raw", "Romantic", "Dark", "Playful",
  "Inspiring", "Cinematic", "Conversational", "Abstract", "Storytelling"
];

export const GENRE_OPTIONS = [
  "Pop", "Rock", "Hip Hop", "R&B", "Electronic", "Jazz",
  "Acoustic", "Classical", "Latin", "Reggaeton", "Country", "Metal"
];

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "pt", label: "Portuguese" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
];
