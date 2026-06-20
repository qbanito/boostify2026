/**
 * Script to generate random artists with complete metadata
 * and save them to Firestore for use in other tools
 * Migrated to OpenAI for consistency with the rest of the platform
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { faker } from '@faker-js/faker';
import OpenAI from 'openai';
import { withTextFallback } from '../server/utils/ai-fallback';

// OpenAI client for text generation
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
});

/**
 * Generates a unique ID with prefix
 * @param prefix Prefix for the ID
 * @returns Unique ID
 */
function generateId(prefix: string): string {
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${randomPart}`;
}

/**
 * Generates a random duration in MM:SS format
 * @returns Duration as string
 */
function generateRandomDuration(): string {
  const minutes = Math.floor(Math.random() * 5) + 2; // Between 2 and 6 minutes
  const seconds = Math.floor(Math.random() * 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Generates an artistic description using OpenAI GPT-4o-mini
 * @param prompt The prompt to generate the description
 * @returns Generated description or fallback description if error
 */
async function generateAIDescription(prompt: string): Promise<string> {
  const systemPrompt = 'You are an expert at describing music artists with physical, stylistic, and personality details. Generate realistic, diverse, and detailed descriptions in English.';
  const result = await withTextFallback(
    async () => {
      const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
      if (!apiKey) return null;
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.8,
      });
      return response.choices[0]?.message?.content?.trim() || null;
    },
    {
      label: 'generateAIDescription',
      prompt,
      systemPrompt,
      maxTokens: 300,
      temperature: 0.8,
      returnNullOnFailure: true,
    }
  );
  return result || '';
}

/**
 * Optional parameters for generating an artist with pre-established characteristics
 */
export interface ArtistGenerationParams {
  genre?: string;
  style?: string;
  gender?: string;
  mood?: string;
  artistName?: string;
}

/**
 * Generates a random artist with all necessary data
 * @param params Optional parameters to guide the generation
 * @returns Generated artist data
 */
export async function generateRandomArtist(params?: ArtistGenerationParams) {
  // Use random seed for consistency per artist
  const seed = Math.floor(Math.random() * 10000);
  faker.seed(seed);

  // Available music genres
  const musicGenres = [
    'Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz', 
    'Classical', 'Country', 'Folk', 'Reggae', 'Blues',
    'Metal', 'Punk', 'Alternative', 'Indie', 'Latin',
    'K-Pop', 'J-Pop', 'Trap', 'Techno', 'House', 'EDM',
    'Soul', 'Funk', 'Disco', 'Synthwave', 'Lo-Fi', 'Ambient'
  ];

  // Use provided genre or select 1-3 random genres
  const selectedGenres = params?.genre 
    ? [params.genre, ...faker.helpers.arrayElements(musicGenres.filter(g => g !== params.genre), faker.number.int({ min: 0, max: 1 }))]
    : faker.helpers.arrayElements(musicGenres, faker.number.int({ min: 1, max: 3 }));

  // Use provided artist name or generate one
  const artistName = params?.artistName 
    ? params.artistName
    : (() => {
        const useRealName = faker.datatype.boolean();
        return useRealName 
          ? `${faker.person.firstName()} ${faker.person.lastName()}`
          : faker.word.words({ count: { min: 1, max: 3 } }).replace(/^\w/, c => c.toUpperCase());
      })();

  // Subscription plan data - Always generate a plan
  const SUBSCRIPTION_PLANS = [
    { name: "Basic", price: 59.99 },
    { name: "Pro", price: 99.99 },
    { name: "Enterprise", price: 149.99 }
  ];
  const selectedPlan = faker.helpers.arrayElement(SUBSCRIPTION_PLANS);
  
  // Generated videos data - 30% probability of having videos
  const videoPrice = 199;
  const hasVideos = faker.datatype.boolean(0.3); // 30% probability as requested
  const videosGenerated = hasVideos ? faker.number.int({ min: 1, max: 5 }) : 0;
  const totalVideoSpend = videoPrice * videosGenerated;
  
  // Purchased courses data - 15% probability of having courses
  const hasCourses = faker.datatype.boolean(0.15); // 15% probability as requested
  const coursesData = generateRandomCourses(faker, hasCourses); // Only forces courses if probability allows
  const totalCourseSpend = coursesData.reduce((total, course) => total + course.price, 0);

  // Generate album title
  const albumTitle = faker.music.songName();

  // Number of songs in the album (between 5 and 12)
  const songCount = faker.number.int({ min: 5, max: 12 });

  // Generate songs
  const songs = Array.from({ length: songCount }, () => ({
    title: faker.music.songName(),
    duration: generateRandomDuration(),
    composers: faker.helpers.arrayElements(
      [artistName, faker.person.fullName(), faker.person.fullName()],
      faker.number.int({ min: 1, max: 3 })
    ),
    explicit: faker.datatype.boolean(0.3) // 30% probability of being explicit
  }));

  // Select a random song as single
  const singleIndex = faker.number.int({ min: 0, max: songs.length - 1 });
  const single = {
    title: songs[singleIndex].title,
    duration: songs[singleIndex].duration
  };

  // Generate release date (between 3 months ago and 6 months in the future)
  const now = new Date();
  const releaseDate = faker.date.between({
    from: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
    to: new Date(now.getFullYear(), now.getMonth() + 6, now.getDate())
  });
  
  // Generate social media username
  const socialHandle = artistName.toLowerCase().replace(/\s+/g, '_');
  const boostifySocialHandle = `boostify_${socialHandle}`;

  // Generate colors for the color scheme
  const colors = [
    'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Orange',
    'Purple', 'Pink', 'Turquoise', 'Silver', 'Gold', 'Neon'
  ];
  const selectedColors = faker.helpers.arrayElements(colors, faker.number.int({ min: 2, max: 4 }));
  
  // Use provided gender or random selection
  // Binary gender options only (male/female) as requested
  const gender = params?.gender 
    ? (params.gender === 'female' || params.gender === 'Female' ? 'Female' : 'Male')
    : faker.helpers.arrayElement([
        { value: 'Female', probability: 0.5 },
        { value: 'Male', probability: 0.5 }
      ]).value;
  
  // Restrict age between 18 and 35 years as requested
  const ageOptions = faker.helpers.arrayElement([
    { value: 'young adult (18-25 years old)', probability: 0.6 },
    { value: 'adult (26-35 years old)', probability: 0.4 }
  ]);
  const age = ageOptions.value;
  
  // Adjust height based on age range (all artists are young adults 18-35 years)
  const isAdolescent = false; // No more adolescents with the new age range
  const height = faker.number.int({ 
    min: isAdolescent ? 150 : 160, 
    max: isAdolescent ? 185 : 190 
  });
  
  const eyeColor = faker.helpers.arrayElement(['dark brown', 'light brown', 'green', 'blue', 'hazel', 'gray', 'amber', 'heterochromia (different colored eyes)']);
  const skinTone = faker.helpers.arrayElement(['fair', 'medium', 'tan', 'dark', 'olive', 'bronzed', 'pale']);
  const facialFeatures = faker.helpers.arrayElements([
    'angular features', 'soft features', 'pronounced cheekbones', 'defined jawline',
    'oval face', 'round face', 'expressive eyebrows', 'full lips', 'thin lips',
    'piercing gaze', 'serene expression', 'charismatic smile', 'intense look',
    'upturned nose', 'aquiline nose', 'dimples', 'freckles', 'distinctive beauty mark'
  ], { min: 2, max: 4 });
  
  // Generate visual style description
  const fashionStyles = [
    'minimalist', 'elegant', 'urban', 'vintage', 'futuristic',
    'avant-garde', 'retro', 'classic', 'alternative', 'casual',
    'formal', 'eclectic', 'cyberpunk', 'bohemian', 'grunge'
  ];
  const accessories = [
    'sunglasses', 'hats', 'statement jewelry', 'gloves',
    'chains', 'piercings', 'visible tattoos', 'dramatic makeup',
    'scarves', 'shawls', 'bandanas', 'watches', 'boots'
  ];
  const hairStyles = [
    'long hair', 'short hair', 'dyed hair', 'dreadlocks',
    'undercut', 'afro', 'curly hair', 'straight hair', 'mullet',
    'mohawk', 'braided hair'
  ];

  const selectedFashion = params?.style 
    ? (fashionStyles.includes(params.style.toLowerCase()) ? params.style.toLowerCase() : params.style)
    : faker.helpers.arrayElement(fashionStyles);
  const selectedAccessory = faker.helpers.arrayElement(accessories);
  const selectedHairStyle = faker.helpers.arrayElement(hairStyles);
  const hairColor = faker.helpers.arrayElement(['black', 'dark brown', 'light brown', 'blonde', 'red', 'gray', 'blue dyed', 'green dyed', 'purple dyed', 'pink dyed']);
  const bodyType = faker.helpers.arrayElement(['slim', 'athletic', 'muscular', 'stocky', 'curvy']);

  // Generate descriptions with OpenAI for greater diversity
  // Prepare local descriptions first as fallback
  const moodDescription = params?.mood || faker.helpers.arrayElement(['energetic', 'melancholic', 'dark', 'bright', 'ethereal', 'aggressive', 'romantic', 'rebellious']);

  const defaultLookDescription = `${gender} ${age} standing ${height}cm tall with a ${bodyType} build. Has ${eyeColor} eyes, ${skinTone} skin and ${facialFeatures.join(', ')}. Hair is ${hairColor} styled ${selectedHairStyle}. Often wears ${selectedAccessory} as a distinctive accessory. Dresses in ${selectedFashion} style using primarily ${selectedColors.join(', ')} colors that reflect their musical identity. Stage presence is ${faker.helpers.arrayElement(['magnetic', 'intense', 'relaxed', 'enigmatic', 'extravagant', 'minimalist'])}. Overall mood: ${moodDescription}.`;

  const defaultBiography = `${artistName} is a talented ${selectedGenres.join(', ')} artist originally from ${faker.location.city()}, ${faker.location.country()}. Known for unique compositions and a ${faker.helpers.arrayElement(['powerful', 'melodic', 'emotional', 'versatile', 'distinctive'])} voice, they have captivated audiences worldwide. Their music explores themes of ${faker.helpers.arrayElements(['love', 'identity', 'society', 'politics', 'nature', 'technology', 'existentialism', 'urban culture'], faker.number.int({ min: 1, max: 3 })).join(', ')} with a ${moodDescription} energy.`;

  // Intentar generar descripciones con OpenAI para mayor diversidad
  let detailedLookDescription = defaultLookDescription;
  let biography = defaultBiography;
  
  // Prompt for physical description
  const lookPrompt = `Generate a detailed and creative physical description for a music artist with these characteristics:
- Gender: ${gender}
- Age: ${age}
- Height: ${height}cm
- Build: ${bodyType}
- Eyes: ${eyeColor}
- Skin: ${skinTone}
- Hair: ${hairColor}, styled ${selectedHairStyle}
- Fashion style: ${selectedFashion}
- Accessories: ${selectedAccessory}
- Preferred colors: ${selectedColors.join(', ')}
- Music: ${selectedGenres.join(', ')}
- Mood/Vibe: ${moodDescription}

Write in third person, between 100-150 words, highlighting unique features and stage appearance. Use vivid and descriptive language that captures the visual essence of the artist.`;

  // Prompt for biography
  const bioPrompt = `Generate a creative biography for ${artistName}, a music artist with these characteristics:
- Gender: ${gender}
- Age: ${age}
- Music genres: ${selectedGenres.join(', ')}
- Origin city: ${faker.location.city()}, ${faker.location.country()}
- Visual style: ${selectedFashion}, with colors ${selectedColors.join(', ')}
- Mood/Vibe: ${moodDescription}
- Explored themes: ${faker.helpers.arrayElements(['love', 'identity', 'society', 'politics', 'nature', 'technology', 'existentialism', 'urban culture'], faker.number.int({ min: 1, max: 3 })).join(', ')}

Write in third person, between 100-150 words, highlighting personal history, influences, achievements and unique musical style. Use a tone that reflects their music genre.`;

  try {
    // Intentar obtener descripciones de OpenAI
    const lookDescriptionAI = await generateAIDescription(lookPrompt);
    const biographyAI = await generateAIDescription(bioPrompt);
    
    // Usar las descripciones de AI si las recibimos correctamente
    if (lookDescriptionAI && lookDescriptionAI.length > 50) {
      detailedLookDescription = lookDescriptionAI;
    }
    
    if (biographyAI && biographyAI.length > 50) {
      biography = biographyAI;
    }
  } catch (error) {
    console.warn('Error generating descriptions with OpenAI, using local descriptions.', error);
    // Keep default descriptions
  }

  // Generar videos 
  const videos = generateRandomVideos(faker, videosGenerated);

  // Construir el objeto completo del artista
  const artistData = {
    id: generateId("ART"),
    name: artistName,
    gender: gender === 'Female' ? 'female' : 'male', // Artist gender for voice (male/female)
    biography: biography,
    album: {
      id: generateId("ALB"),
      name: albumTitle,
      release_date: releaseDate.toISOString().split('T')[0],
      songs: songs,
      single: single
    },
    look: {
      description: detailedLookDescription,
      color_scheme: selectedColors.join(', ')
    },
    music_genres: selectedGenres,
    image_prompts: {
      artist_look: `${gender} ${age} with ${selectedHairStyle} ${hairColor}, ${selectedAccessory}, ${selectedFashion} style, ${bodyType} build, ${eyeColor} eyes, ${skinTone} skin, ${facialFeatures[0]}, predominant colors ${selectedColors.slice(0, 2).join(' and ')}, ${faker.helpers.arrayElement(['studio', 'stage', 'urban', 'natural', 'futuristic'])} setting`,
      album_cover: `Album cover for ${selectedGenres.join(' and ')}, ${selectedFashion} aesthetic, colors ${selectedColors.join(', ')}, visual concept representing ${faker.helpers.arrayElement(['intense emotions', 'abstract landscapes', 'minimalist symbolism', 'photo collage', 'digital illustration'])}`,
      promotional: `${gender} in a ${faker.helpers.arrayElement(['natural', 'dynamic', 'thoughtful', 'artistic', 'powerful'])} pose, ${faker.helpers.arrayElement(['urban', 'studio', 'stage', 'natural', 'abstract'])} setting, ${faker.helpers.arrayElement(['warm', 'cool', 'high contrast', 'dramatic', 'soft'])} lighting`
    },
    social_media: {
      twitter: {
        handle: boostifySocialHandle,
        url: `https://twitter.com/${boostifySocialHandle}`
      },
      instagram: {
        handle: boostifySocialHandle,
        url: `https://instagram.com/${boostifySocialHandle}`
      },
      tiktok: {
        handle: boostifySocialHandle,
        url: `https://tiktok.com/@${boostifySocialHandle}`
      },
      youtube: {
        handle: boostifySocialHandle,
        url: `https://youtube.com/@${boostifySocialHandle}`
      },
      spotify: {
        handle: boostifySocialHandle,
        url: `https://open.spotify.com/artist/${boostifySocialHandle}`
      }
    },
    password: {
      value: `${faker.internet.password({ length: 12, memorable: true, pattern: /[A-Za-z0-9_@]/ })}`,
      last_updated: new Date().toISOString().split('T')[0]
    },
    management: {
      email: "info@boostifymusic.com",
      phone: "+14707983684"
    },
    subscription: {
      plan: selectedPlan.name,
      price: selectedPlan.price,
      status: faker.helpers.arrayElement(['active', 'trial', 'expired']),
      startDate: faker.date.past().toISOString().split('T')[0],
      renewalDate: faker.date.future().toISOString().split('T')[0]
    },
    purchases: {
      videos: {
        count: videosGenerated,
        totalSpent: totalVideoSpend,
        lastPurchase: videosGenerated > 0 ? faker.date.recent().toISOString().split('T')[0] : null,
        videos: videos
      },
      courses: {
        count: coursesData.length,
        totalSpent: totalCourseSpend,
        lastPurchase: coursesData.length > 0 ? faker.date.recent().toISOString().split('T')[0] : null,
        courses: coursesData
      }
    }
  };

  return artistData;
}

/**
 * Generates random course data
 * @param faker Faker instance
 * @param forceAtLeastOne If true, guarantees at least one course
 * @returns Array of purchased courses
 */
function generateRandomCourses(faker: any, forceAtLeastOne: boolean = false) {
  // If no courses needed, return empty array
  if (!forceAtLeastOne) {
    return [];
  }

  // If forcing courses, generate between 1 and 3
  const courseCount = faker.number.int({ min: 1, max: 3 });
  const courses = [];
  
  const COURSE_TITLES = [
    "Advanced Music Production",
    "Digital Marketing for Musicians",
    "Soundtrack Composition",
    "Professional Vocal Techniques",
    "Music Distribution in the Digital Era",
    "Audio Mastering",
    "Music Release Strategies",
    "Harmony and Music Theory",
    "Beat Creation"
  ];
  
  for (let i = 0; i < courseCount; i++) {
    const price = faker.number.int({ min: 149, max: 299 });
    const title = faker.helpers.arrayElement(COURSE_TITLES);
    
    courses.push({
      id: generateId("CRS"),
      title,
      price,
      purchaseDate: faker.date.past().toISOString().split('T')[0],
      progress: faker.number.int({ min: 0, max: 100 }),
      completed: faker.datatype.boolean(0.4) // 40% probability of being completed
    });
  }
  
  return courses;
}

/**
 * Generates random video data
 * @param faker Faker instance
 * @param count Number of videos
 * @returns Array of generated videos
 */
function generateRandomVideos(faker: any, count: number) {
  const videos = [];
  
  const VIDEO_TYPES = [
    "Audio visualizer",
    "Full music video",
    "Promotional teaser",
    "Lyric video",
    "Behind the scenes"
  ];
  
  for (let i = 0; i < count; i++) {
    videos.push({
      id: generateId("VID"),
      title: faker.music.songName(),
      type: faker.helpers.arrayElement(VIDEO_TYPES),
      duration: `${faker.number.int({ min: 1, max: 5 })}:${faker.number.int({ min: 0, max: 59 }).toString().padStart(2, '0')}`,
      creationDate: faker.date.past().toISOString().split('T')[0],
      resolution: faker.helpers.arrayElement(["720p", "1080p", "4K"]),
      price: 199
    });
  }
  
  return videos;
}

// This implementation has been migrated to server/routes/artist-generator.ts
// Keeping the function signature for compatibility
async function saveArtistToFirestore(artistData: any): Promise<string> {
  throw new Error('This function has been migrated to server/routes/artist-generator.ts');
}

/**
 * Main function that generates and saves an artist
 */
async function main() {
  try {
    console.log('Generating random artist...');
    const artistData = await generateRandomArtist();
    console.log('Artist data generated:', JSON.stringify(artistData, null, 2));
    
    console.log('Saving artist to Firestore...');
    const firestoreId = await saveArtistToFirestore(artistData);
    console.log(`Artist saved successfully with Firestore ID: ${firestoreId}`);
    
    return { artistData, firestoreId };
  } catch (error) {
    console.error('Error in artist generation process:', error);
    throw error;
  }
}

// DISABLED: Do not auto-execute during server startup
// This code was causing API calls during module initialization in production
// If you need to run this script directly, uncomment and run with: node --loader ts-node/esm scripts/generate-random-artist.ts

// const isMainModule = import.meta.url === `file://${process.argv[1]}`;
// if (isMainModule) {
//   main()
//     .then(() => {
//       console.log('Proceso completado exitosamente.');
//       process.exit(0);
//     })
//     .catch((error) => {
//       console.error('Error en el proceso:', error);
//       process.exit(1);
//     });
// }

// Export functions for use in other files
// Note: generateRandomArtist is already exported directly above
export {
  saveArtistToFirestore,
  main as generateArtist
};