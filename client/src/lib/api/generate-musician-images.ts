import { generateImageWithFal } from "./fal-ai";
import { logger } from "../logger";
import { saveMusicianImage } from "./musician-images-store";
import {db, collection, getDocs, query, orderBy} from "./firebase";

const musicianImagePrompts = [
  // Guitarristas
  {
    prompt: "professional portrait of a male rock guitarist in a modern recording studio, dramatic lighting, electric guitar, ultra realistic, photorealistic, 4k quality, detailed facial features",
    category: "Guitar"
  },
  {
    prompt: "portrait of a female guitarist with acoustic guitar in a music studio, soft lighting, professional headshot, photorealistic, ultra high quality, 4k, detailed features",
    category: "Guitar"
  },
  {
    prompt: "portrait of a professional jazz guitarist performing on stage, warm stage lighting, vintage Gibson guitar, photorealistic, 4k quality",
    category: "Guitar"
  },
  // Bateristas
  {
    prompt: "professional drummer portrait with modern drum kit in a recording studio, dynamic lighting, full drum set visible, photorealistic, 4k quality",
    category: "Drums"
  },
  {
    prompt: "female drummer portrait with Pearl drum kit, professional studio lighting, photorealistic, detailed features, 4k quality",
    category: "Drums"
  },
  {
    prompt: "portrait of a jazz drummer with vintage Gretsch drum kit, natural lighting, performing stance, photorealistic, 4k quality",
    category: "Drums"
  },
  // Pianistas
  {
    prompt: "elegant classical pianist portrait at a grand piano in a concert hall, professional lighting, formal attire, photorealistic, 4k quality",
    category: "Piano"
  },
  {
    prompt: "jazz pianist portrait at a Steinway piano, moody studio lighting, performing stance, photorealistic, detailed features, 4k quality",
    category: "Piano"
  },
  {
    prompt: "contemporary pianist at a modern digital piano setup, artistic lighting, casual professional attire, photorealistic, 4k quality",
    category: "Piano"
  },
  // Vocalistas
  {
    prompt: "female pop singer portrait in a recording booth, professional microphone, studio lighting, emotive expression, photorealistic, 4k quality",
    category: "Vocals"
  },
  {
    prompt: "soul singer portrait on stage, dramatic spotlight, vintage microphone, passionate performance, photorealistic, 4k quality",
    category: "Vocals"
  },
  {
    prompt: "jazz vocalist portrait in elegant evening attire, warm stage lighting, professional microphone setup, photorealistic, 4k quality",
    category: "Vocals"
  },
  // Productores
  {
    prompt: "professional music producer in a modern recording studio, mixing console visible, multiple screens, professional equipment, photorealistic, 4k quality",
    category: "Production"
  },
  {
    prompt: "female EDM producer with modern production setup, synthesizers and controllers visible, creative studio environment, photorealistic, 4k quality",
    category: "Production"
  },
  {
    prompt: "rock music producer in a professional mixing room, vintage analog equipment, studio monitors visible, photorealistic, 4k quality",
    category: "Production"
  }
];

export async function generateMusicianImages() {
  const images = [];
  const negativePrompt = "deformed, unrealistic, cartoon, anime, illustration, low quality, blurry, distorted, bad anatomy, bad proportions, watermark, text, title";

  for (const { prompt, category } of musicianImagePrompts) {
    try {
      logger.info(`Generating image for ${category} with prompt: ${prompt.substring(0, 50)}...`);

      const result = await generateImageWithFal({
        prompt,
        negativePrompt,
        imageSize: "portrait_9_16"
      });

      if (result.data && result.data.images && result.data.images[0]) {
        const imageUrl = result.data.images[0].url;
        logger.info(`Successfully generated image for ${category}: ${imageUrl}`);

        // Save to Firestore with category information
        await saveMusicianImage({
          url: imageUrl,
          requestId: result.requestId,
          prompt,
          category,
          createdAt: new Date()
        });
        logger.info(`Saved ${category} image to Firestore`);

        images.push({
          url: imageUrl,
          category
        });

        // Wait between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        logger.error(`Invalid response format from Fal.ai for ${category}:`, result);
        images.push({
          url: "/assets/musician-placeholder.jpg",
          category
        });
      }
    } catch (error) {
      logger.error(`Error generating image for ${category}:`, error);
      images.push({
        url: "/assets/musician-placeholder.jpg",
        category
      });
    }
  }

  return images;
}

export interface MusicianImage {
  url: string;
  category: string;
  requestId?: string;
  prompt?: string;
  createdAt?: Date;
}

export async function getStoredMusicianImages(): Promise<MusicianImage[]> {
  try {
    logger.info("Starting to fetch musician images from Firestore...");
    const imagesRef = collection(db, "musicianImages");
    const querySnapshot = await getDocs(query(imagesRef, orderBy("createdAt", "desc")));

    if (querySnapshot.empty) {
      logger.info("No images found in Firestore");
      return [];
    }

    const images = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        url: data.url,
        category: data.category,
        requestId: data.requestId,
        prompt: data.prompt,
        createdAt: data.createdAt?.toDate()
      };
    }).filter(img => img.url && img.category);

    logger.info("Successfully retrieved images:", images.length);
    return images;
  } catch (error) {
    logger.error("Error fetching stored images:", error);
    return [];
  }
}

export async function testMusicianImageGeneration() {
  try {
    const testPrompt = musicianImagePrompts[0];
    const result = await generateImageWithFal({
      prompt: testPrompt.prompt,
      negativePrompt: "deformed, unrealistic, cartoon, anime, illustration, low quality, blurry",
      imageSize: "portrait_9_16"
    });

    logger.info("Test successful, result:", result);
    return result;
  } catch (error) {
    logger.error("Test musician image generation failed:", error);
    throw error;
  }
}