import { db } from './firebase-admin';
import * as fal from "@fal-ai/serverless-client";

// Configure fal.ai with environment variable
fal.config({
  credentials: process.env.FAL_API_KEY,
});

const sampleDirectors = [
  {
    name: "Sofia Ramirez",
    specialty: "Urban & Hip-Hop Visuals",
    experience: "10+ years directing music videos for top urban artists",
    style: "Dynamic street cinematography with bold color grading",
    rating: 4.8
  },
  {
    name: "Marcus Chen",
    specialty: "Alternative & Indie Rock",
    experience: "Award-winning director with 15+ years in music video production",
    style: "Surrealist narratives with experimental techniques",
    rating: 4.9
  },
  {
    name: "Isabella Moretti",
    specialty: "Pop & Contemporary",
    experience: "Former MTV director with global brand collaborations",
    style: "High-fashion aesthetic with cutting-edge visual effects",
    rating: 4.7
  },
  {
    name: "David O'Connor",
    specialty: "Rock & Metal",
    experience: "20+ years specializing in high-energy performance videos",
    style: "Raw, intense cinematography with practical effects",
    rating: 4.6
  },
  {
    name: "Nina Patel",
    specialty: "Electronic & Dance",
    experience: "Pioneer in AI-enhanced music video production",
    style: "Futuristic visuals with immersive digital elements",
    rating: 4.8
  },
  {
    name: "James Wilson",
    specialty: "R&B & Soul",
    experience: "15+ years crafting emotional visual narratives",
    style: "Intimate storytelling with sophisticated cinematography",
    rating: 4.7
  },
  {
    name: "Elena Rodriguez",
    specialty: "Latin Music & Reggaeton",
    experience: "Award-winning director with major label collaborations",
    style: "Vibrant aesthetics with dynamic camera movements",
    rating: 4.9
  },
  {
    name: "Alex Thompson",
    specialty: "Indie Pop & Alternative",
    experience: "12+ years specializing in artistic music videos",
    style: "Experimental visuals with vintage aesthetics",
    rating: 4.6
  },
  {
    name: "Yuki Tanaka",
    specialty: "K-pop & J-pop",
    experience: "International director with major Asian labels",
    style: "High-energy choreography with innovative transitions",
    rating: 4.8
  },
  {
    name: "Michael Brooks",
    specialty: "Country & Folk",
    experience: "25+ years capturing authentic storytelling",
    style: "Natural cinematography with emotional depth",
    rating: 4.7
  }
];

const generateDirectorImage = async (prompt: string): Promise<string> => {
  try {
    const result = await fal.subscribe("fal-ai/flux-pro", {
      input: {
        prompt: `professional headshot portrait photo of a director, ${prompt}, 4k, photorealistic, natural lighting, modern photography studio background, clear facial features`,
        model_id: "flux-pro",
        width: 768,
        height: 768,
        scheduler: "dpmpp",
        num_inference_steps: 40,
        guidance_scale: 7.5,
      },
    });

    const imageUrl = result?.images?.[0]?.url;
    if (imageUrl) {
      return imageUrl;
    }

    console.log("No image URL in response:", result);
    return '';
  } catch (error) {
    console.error("Error generating image:", error);
    return '';
  }
};

const seedDirectors = async () => {
  try {
    // Delete all existing directors
    const snapshot = await db.collection("directors").get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("Deleted existing directors");

    // Generate and store directors
    for (const director of sampleDirectors) {
      console.log(`Generating image for director: ${director.name}`);
      const imageUrl = await generateDirectorImage(
        `${director.name}, professional film director, ${director.specialty}`
      );

      console.log(`Adding director ${director.name} to Firestore`);
      await db.collection("directors").add({
        ...director,
        imageUrl,
        createdAt: new Date(),
        status: 'active'
      });

      // Add a delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("Successfully seeded all directors");
  } catch (error) {
    console.error("Error seeding directors:", error);
    throw error;
  }
};

seedDirectors().catch(console.error);