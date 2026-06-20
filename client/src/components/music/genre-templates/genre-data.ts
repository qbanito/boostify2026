// Define the music genre template interface
export interface MusicGenreTemplate {
  id: string;
  name: string;
  description: string;
  defaultPrompt: string;
  suggestedTags: string[];
  tempo: number;
  keySignature: string;
  mainInstruments: string[];
  structure: {
    intro: boolean;
    verse: boolean;
    chorus: boolean;
    bridge: boolean;
    outro: boolean;
  };
}

/**
 * Collection of music genre templates for music generation
 * Each template includes default settings for the specific genre
 */
export const musicGenreTemplates: MusicGenreTemplate[] = [
  {
    id: "pop",
    name: "Pop",
    description: "Catchy melodies with contemporary production",
    defaultPrompt: "Create a modern pop song with catchy hooks, upbeat tempo, and contemporary production. Include verse-chorus structure with a memorable hook.",
    suggestedTags: ["pop", "catchy", "contemporary", "radio-friendly"],
    tempo: 120,
    keySignature: "C Major",
    mainInstruments: ["piano", "guitar", "drums"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  },
  {
    id: "rock",
    name: "Rock",
    description: "Guitar-driven energy with dynamic structures",
    defaultPrompt: "Create an energetic rock song with electric guitars, punchy drums, and powerful vocals. Include driving rhythm and dynamic contrast between verses and chorus.",
    suggestedTags: ["rock", "guitar", "energetic", "drums"],
    tempo: 135,
    keySignature: "E Minor",
    mainInstruments: ["electric guitar", "bass", "drums"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  },
  {
    id: "electronic",
    name: "Electronic",
    description: "Synthesizer-based sounds with rhythmic patterns",
    defaultPrompt: "Create an electronic dance track with synthesizers, driving beat, and progressive structure. Include builds and drops with electronic production techniques.",
    suggestedTags: ["electronic", "dance", "synth", "beat"],
    tempo: 128,
    keySignature: "F Major",
    mainInstruments: ["synthesizer", "drum machine", "bass"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  },
  {
    id: "rnb",
    name: "R&B",
    description: "Soulful vocals with rhythm and blues influence",
    defaultPrompt: "Create a smooth R&B track with soulful vocals, rhythmic beats, and emotional lyrics. Include jazz-influenced chord progressions and expressive melody.",
    suggestedTags: ["rnb", "soul", "smooth", "vocal"],
    tempo: 95,
    keySignature: "Bb Major",
    mainInstruments: ["piano", "bass", "drums", "vocals"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  },
  {
    id: "hiphop",
    name: "Hip Hop",
    description: "Rhythmic vocals with heavy beats and samples",
    defaultPrompt: "Create a hip hop track with strong beats, bass, and rhythmic vocal flow. Include atmospheric elements and minimal musical backing to highlight lyrics.",
    suggestedTags: ["hiphop", "rap", "beat", "urban"],
    tempo: 90,
    keySignature: "G Minor",
    mainInstruments: ["drums", "bass", "samples"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: false,
      outro: true
    }
  },
  {
    id: "jazz",
    name: "Jazz",
    description: "Improvisational style with complex harmonies",
    defaultPrompt: "Create a jazz composition with improvisational feel, complex chord progressions, and swing rhythm. Include instrumental solos and sophisticated harmonic structure.",
    suggestedTags: ["jazz", "swing", "improvisation", "sophisticated"],
    tempo: 110,
    keySignature: "D Minor",
    mainInstruments: ["piano", "saxophone", "bass", "drums"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  },
  {
    id: "acoustic",
    name: "Acoustic",
    description: "Natural instruments with intimate production",
    defaultPrompt: "Create an acoustic folk song with guitar, gentle vocals, and natural instruments. Focus on storytelling lyrics and organic production without electronic elements.",
    suggestedTags: ["acoustic", "folk", "natural", "intimate"],
    tempo: 85,
    keySignature: "G Major",
    mainInstruments: ["acoustic guitar", "vocals", "percussion"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  },
  {
    id: "classical",
    name: "Classical",
    description: "Orchestral instruments with traditional structures",
    defaultPrompt: "Create a classical composition for orchestra with traditional structure and development. Include string and brass sections with dynamic range and emotional impact.",
    suggestedTags: ["classical", "orchestral", "strings", "traditional"],
    tempo: 100,
    keySignature: "A Minor",
    mainInstruments: ["strings", "piano", "brass", "woodwinds"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  }
];

// Interface has been moved to the top of the file

// Helper functions for working with genre templates

/**
 * Get a genre template by ID
 * @param id The ID of the genre template to retrieve
 * @returns The template or undefined if not found
 */
export function getGenreTemplateById(id: string): MusicGenreTemplate | undefined {
  return musicGenreTemplates.find(template => template.id === id);
}

/**
 * Generate a detailed prompt from a template and additional parameters
 * @param template The genre template to use as a base
 * @param additionalParams Additional parameters to enhance the prompt
 * @returns A detailed generation prompt
 */
export function getDetailedPrompt(
  template: MusicGenreTemplate, 
  additionalParams?: {
    makeInstrumental?: boolean;
    customInstruments?: string[];
    emotion?: string;
    lyrics?: string;
  }
): string {
  let prompt = template.defaultPrompt;
  
  // Add custom instrumentation if provided
  if (additionalParams?.customInstruments && additionalParams.customInstruments.length > 0) {
    prompt += ` Use primarily ${additionalParams.customInstruments.join(', ')} instruments.`;
  }
  
  // Add emotional direction if provided
  if (additionalParams?.emotion) {
    prompt += ` The composition should have a ${additionalParams.emotion} emotional tone.`;
  }
  
  // Mention vocal/instrumental preference
  if (additionalParams?.makeInstrumental) {
    prompt += ` Make this a fully instrumental track without vocals.`;
  } else {
    // If custom lyrics are provided, let's mention that
    if (additionalParams?.lyrics) {
      prompt += ` Include vocals with lyrics about ${additionalParams.lyrics}.`;
    } else {
      prompt += ` Include appropriate vocals for this genre.`;
    }
  }
  
  return prompt;
}

/**
 * Generate defaults for music generation based on a template
 * @param template The template to generate defaults from
 * @returns Default parameters for music generation
 */
export function getGenerationDefaults(template: MusicGenreTemplate) {
  return {
    prompt: template.defaultPrompt,
    tags: template.suggestedTags.join(', '),
    negativeTags: '',
    tempo: template.tempo,
    keySignature: template.keySignature,
    makeInstrumental: template.id === 'classical' || template.id === 'jazz', // Default for classical and jazz
    generateLyrics: !(template.id === 'classical' || template.id === 'jazz'), // Default for everything else
    title: getDefaultTitle(template.id),
    mainInstruments: template.mainInstruments,
    lyricsType: (template.id === 'classical' || template.id === 'jazz') ? 'none' : 'auto',
    musicTemplate: template.id
  };
}

/**
 * Get a default title for a genre
 * @param genreId The ID of the genre
 * @returns A default title
 */
function getDefaultTitle(genreId: string): string {
  const titleMap: Record<string, string> = {
    'pop': 'Catchy Melody',
    'rock': 'Electric Dreams',
    'electronic': 'Digital Beats',
    'rnb': 'Soul Rhythm',
    'hiphop': 'Flow State',
    'jazz': 'Blue Notes',
    'acoustic': 'Wooden Strings',
    'classical': 'Symphony No. 1'
  };
  
  return titleMap[genreId] || 'New Composition';
}