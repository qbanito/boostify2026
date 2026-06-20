import { createApi } from 'unsplash-js';
import { logger } from "./logger";

const unsplash = createApi({
  accessKey: import.meta.env.VITE_UNSPLASH_ACCESS_KEY || ''
});

// Diverse collection IDs related to music industry, studio, and education
const MUSIC_COLLECTIONS = [
  '317099',  // Music Industry
  '3694365', // Recording Studios
  '4332580', // Music Production
  '8684079', // Music Education
  '1580876', // Musicians
  '827743',  // Performance
  '962360',  // Music Technology
];

export async function getRelevantImage(query: string): Promise<string> {
  try {
    // Add random music-related keywords to diversify results
    const musicKeywords = [
      'professional music studio',
      'music production workspace',
      'recording studio equipment',
      'music industry professional',
      'music education classroom',
      'music technology setup',
      'professional audio gear'
    ];

    const randomKeyword = musicKeywords[Math.floor(Math.random() * musicKeywords.length)];
    const randomCollections = MUSIC_COLLECTIONS
      .sort(() => Math.random() - 0.5)
      .slice(0, 3); // Get 3 random collections

    // Enrich the query with random keyword and specific context
    const enrichedQuery = `${query} ${randomKeyword}`;
    logger.info('Enriched image query:', enrichedQuery);

    const result = await unsplash.photos.getRandom({
      query: enrichedQuery,
      orientation: 'landscape',
      contentFilter: 'high',
      collectionIds: randomCollections,
    });

    if (result.response) {
      if (Array.isArray(result.response)) {
        return result.response[0].urls.regular;
      }
      return result.response.urls.regular;
    }

    // Return a different fallback image each time based on the current timestamp
    const timestamp = Date.now();
    const fallbackImages = [
      'https://images.unsplash.com/photo-1511379938547-c1f69419868d',
      'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04',
      'https://images.unsplash.com/photo-1598653222000-6b7b7a552625'
    ];

    return `${fallbackImages[timestamp % fallbackImages.length]}?auto=format&fit=crop&w=1200&timestamp=${timestamp}`;

  } catch (error) {
    logger.error('Error fetching image from Unsplash:', error);
    // Return a different fallback image based on timestamp to avoid repetition
    const timestamp = Date.now();
    return `https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&timestamp=${timestamp}`;
  }
}