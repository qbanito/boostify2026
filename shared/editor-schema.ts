/**
 * Editor Profile Schema
 * Defines legendary video editors and their signature editing styles
 */

export interface EditingStyle {
  name: string;
  description: string;
  characteristics: string[];
  cutFrequency: 'rapid' | 'moderate' | 'slow';
  transitionStyle: string;
  colorGrading: string;
  effectsIntensity: 'light' | 'moderate' | 'heavy';
}

export interface EditorProfile {
  id: string;
  name: string;
  bio: string;
  imageUrl: string;
  signature: string;
  style: EditingStyle;
  specialty: string[];
  yearActive: { start: number; end?: number };
  famousWorks: string[];
}

// 8 Legendary Editors
export const LEGENDARY_EDITORS: EditorProfile[] = [
  {
    id: "hype-williams",
    name: "Hype Williams",
    bio: "Pioneering visual director known for innovative camera work and experimental editing",
    imageUrl: "/editors/hype-williams.jpg",
    signature: "Rapid cuts with creative transitions, bold color grading",
    style: {
      name: "Experimental Hip-Hop",
      description: "Fast-paced, creative editing with unconventional camera movements",
      characteristics: [
        "Rapid jump cuts",
        "Creative wipes and transitions",
        "Bold color separation",
        "Experimental camera angles",
        "Quick montage sequences"
      ],
      cutFrequency: "rapid",
      transitionStyle: "Creative wipes, creative fades",
      colorGrading: "Bold color separation and contrast",
      effectsIntensity: "heavy"
    },
    specialty: ["Hip-Hop", "Rap", "Experimental", "Music Video"],
    yearActive: { start: 1989 },
    famousWorks: ["Busta Rhymes - Woo Ha", "Missy Elliott - The Rain", "Jay-Z - Jigga What Fuck"]
  },
  {
    id: "spike-jonze",
    name: "Spike Jonze",
    bio: "Filmmaker and music video pioneer known for narrative-driven, cinematic storytelling",
    imageUrl: "/editors/spike-jonze.jpg",
    signature: "Cinematic storytelling with seamless edits and emotional depth",
    style: {
      name: "Cinematic Narrative",
      description: "Story-driven editing with seamless transitions and emotional pacing",
      characteristics: [
        "Cinematic shots",
        "Seamless transitions",
        "Emotional pacing",
        "Narrative structure",
        "Natural flow"
      ],
      cutFrequency: "slow",
      transitionStyle: "Seamless cuts and dissolves",
      colorGrading: "Natural, cinematic grading",
      effectsIntensity: "light"
    },
    specialty: ["Alternative Rock", "Pop", "Narrative", "Cinematic"],
    yearActive: { start: 1992 },
    famousWorks: ["Bjork - It's Oh So Quiet", "Weezer - Buddy Holly", "The Beastie Boys - Sabotage"]
  },
  {
    id: "mtv-style",
    name: "MTV Style Editor",
    bio: "Classic MTV editing aesthetic with fast cuts, colorful effects, and high energy",
    imageUrl: "/editors/mtv-style.jpg",
    signature: "Fast cuts, colorful effects, high energy montages",
    style: {
      name: "MTV 90s",
      description: "Fast-paced, energetic editing with colorful effects and quick montages",
      characteristics: [
        "Fast cuts on beats",
        "Colorful transitions",
        "Text overlays",
        "Montage sequences",
        "High energy pacing"
      ],
      cutFrequency: "rapid",
      transitionStyle: "Colorful transitions and effects",
      colorGrading: "Vibrant, saturated colors",
      effectsIntensity: "heavy"
    },
    specialty: ["Pop", "Rock", "Teen Music", "High Energy"],
    yearActive: { start: 1981 },
    famousWorks: ["Various MTV hits", "80s and 90s classics"]
  },
  {
    id: "michel-gondry",
    name: "Michel Gondry",
    bio: "Visual innovator known for stop-motion, hand-made effects, and creative analog techniques",
    imageUrl: "/editors/michel-gondry.jpg",
    signature: "Stop-motion, hand-made effects, creative analog techniques",
    style: {
      name: "Analog & Practical",
      description: "Innovative use of practical effects, stop-motion, and analog techniques",
      characteristics: [
        "Stop-motion sequences",
        "Hand-made effects",
        "Analog techniques",
        "Creative transitions",
        "Unique visual effects"
      ],
      cutFrequency: "moderate",
      transitionStyle: "Creative practical transitions",
      colorGrading: "Warm, nostalgic",
      effectsIntensity: "moderate"
    },
    specialty: ["Alternative", "Indie", "Experimental", "Art Film"],
    yearActive: { start: 1987 },
    famousWorks: ["Björk - All Is Full of Love", "Chemical Brothers - Let Forever Be", "The White Stripes - Fell in Love with a Girl"]
  },
  {
    id: "benny-boom",
    name: "Benny Boom",
    bio: "Modern hip-hop director known for dynamic editing, cinematic camera work, and storytelling",
    imageUrl: "/editors/benny-boom.jpg",
    signature: "Dynamic camera work, cinematic storytelling, modern hip-hop aesthetic",
    style: {
      name: "Modern Hip-Hop",
      description: "Dynamic editing with cinematic camera work and contemporary storytelling",
      characteristics: [
        "Dynamic camera movements",
        "Quick narrative cuts",
        "Modern color grading",
        "Strong emotional pacing",
        "High production value"
      ],
      cutFrequency: "moderate",
      transitionStyle: "Smooth cinematic transitions",
      colorGrading: "Modern, cinematic grading",
      effectsIntensity: "moderate"
    },
    specialty: ["Hip-Hop", "Rap", "R&B", "Modern Music"],
    yearActive: { start: 2002 },
    famousWorks: ["50 Cent - In Da Club", "Nelly - Ride wit Me", "Soulja Boy - Crank That"]
  },
  {
    id: "joseph-kahn",
    name: "Joseph Kahn",
    bio: "Prolific director known for high-energy editing, visual spectacle, and cutting-edge effects",
    imageUrl: "/editors/joseph-kahn.jpg",
    signature: "High-energy, visual spectacle, cutting-edge effects",
    style: {
      name: "Visual Spectacle",
      description: "High-energy editing with visual spectacle and cutting-edge visual effects",
      characteristics: [
        "High-energy cuts",
        "Visual spectacle",
        "Modern effects",
        "Fast pacing",
        "Bold color work"
      ],
      cutFrequency: "rapid",
      transitionStyle: "Dynamic visual transitions",
      colorGrading: "Bold, modern color work",
      effectsIntensity: "heavy"
    },
    specialty: ["Pop", "Dance", "Visual Effects", "High Energy"],
    yearActive: { start: 1996 },
    famousWorks: ["Katy Perry - Firework", "The Weeknd - Blinding Lights", "Taylor Swift - Style"]
  },
  {
    id: "fyodor-bondarchuk",
    name: "Fyodor Bondarchuk",
    bio: "Russian director known for epic scale, visual poetry, and dramatic cinematic editing",
    imageUrl: "/editors/fyodor-bondarchuk.jpg",
    signature: "Epic scale, visual poetry, dramatic cinematic editing",
    style: {
      name: "Epic Cinema",
      description: "Large-scale cinematic editing with visual poetry and dramatic pacing",
      characteristics: [
        "Epic scale shots",
        "Visual poetry",
        "Dramatic pacing",
        "Cinematic transitions",
        "Atmospheric editing"
      ],
      cutFrequency: "slow",
      transitionStyle: "Cinematic dissolves and fades",
      colorGrading: "Cinematic, atmospheric",
      effectsIntensity: "light"
    },
    specialty: ["Drama", "Epic", "Cinematic", "Visual Poetry"],
    yearActive: { start: 1995 },
    famousWorks: ["Various European arthouse films"]
  },
  {
    id: "treatment-studio",
    name: "Treatment Studio Professional",
    bio: "Professional commercial editing with clean aesthetics, precision timing, and brand-focused editing",
    imageUrl: "/editors/treatment-studio.jpg",
    signature: "Clean, precise, brand-focused editing with professional polish",
    style: {
      name: "Professional Commercial",
      description: "Clean, precise editing optimized for commercial and brand content",
      characteristics: [
        "Clean cuts",
        "Precision timing",
        "Brand-focused",
        "Professional polish",
        "Clear messaging"
      ],
      cutFrequency: "moderate",
      transitionStyle: "Clean, professional transitions",
      colorGrading: "Professional, brand-aligned",
      effectsIntensity: "light"
    },
    specialty: ["Commercial", "Brand", "Corporate", "Professional"],
    yearActive: { start: 2000 },
    famousWorks: ["Various high-end commercials"]
  }
];

// Editor selection interface
export interface EditorSelection {
  editorId: string;
  editorName: string;
  style: EditingStyle;
  intensity: number; // 0-1, how much to apply the style
}
