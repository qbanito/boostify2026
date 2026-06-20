import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

// Configurar Gemini con AI Integrations
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || "",
  },
});

// Definir las 5 poses de ejemplo
const examplePhotos = [
  {
    name: "frontal",
    prompt: "Professional headshot portrait photo of a young musician artist, frontal view facing camera directly, clear facial features, neutral background, studio photography, soft professional lighting, high quality 4k, sharp focus, photorealistic"
  },
  {
    name: "profile",
    prompt: "Professional side profile portrait photo of a young musician artist, 90 degree side view showing profile silhouette, clean studio background, professional photography lighting, high quality 4k, sharp focus, photorealistic"
  },
  {
    name: "smiling",
    prompt: "Professional portrait photo of a young musician artist smiling warmly at camera, genuine happy expression, frontal view, neutral background, studio photography, soft professional lighting, high quality 4k, sharp focus, photorealistic"
  },
  {
    name: "three-quarter",
    prompt: "Professional 3/4 angle portrait photo of a young musician artist, face turned 45 degrees showing three-quarter view, clear facial features, neutral background, studio photography, professional lighting, high quality 4k, sharp focus, photorealistic"
  },
  {
    name: "full-body",
    prompt: "Professional full body portrait photo of a young musician artist standing confidently, complete head to toe view, neutral studio background, professional photography lighting, high quality 4k, sharp focus, photorealistic, stylish casual outfit"
  }
];

async function generateImage(prompt: string): Promise<string> {
  console.log(`Generando imagen con prompt: ${prompt.substring(0, 80)}...`);
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
  
  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  const mimeType = imagePart.inlineData.mimeType || "image/png";
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

async function saveBase64Image(base64Data: string, filename: string): Promise<void> {
  // Extraer el base64 del data URL
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 data");
  }

  const imageBuffer = Buffer.from(matches[2], 'base64');
  const outputDir = path.join(process.cwd(), 'attached_assets', 'example_photos');
  
  // Crear directorio si no existe
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, imageBuffer);
  console.log(`✅ Imagen guardada: ${outputPath}`);
}

async function generateAllExamples() {
  console.log("🎨 Generando 5 imágenes de ejemplo profesionales...\n");

  for (const photo of examplePhotos) {
    try {
      console.log(`📸 Generando: ${photo.name}...`);
      const base64Image = await generateImage(photo.prompt);
      await saveBase64Image(base64Image, `${photo.name}.png`);
      console.log(`✅ ${photo.name} completado\n`);
      
      // Pequeño delay para evitar rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Error generando ${photo.name}:`, error);
    }
  }

  console.log("🎉 ¡Generación de imágenes completada!");
}

// Ejecutar
generateAllExamples().catch(console.error);
