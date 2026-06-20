import { logger } from "../logger";
/**
 * Face Analysis Service - Analiza fotos del artista para extraer rasgos faciales detallados
 * Usa Gemini Vision para análisis preciso de características faciales
 */

export interface FaceAnalysis {
  // Estructura facial
  faceShape: string; // oval, round, square, heart, diamond, rectangular
  jawline: string; // strong, soft, angular, rounded, defined
  cheekbones: string; // high, prominent, subtle, soft
  
  // Ojos
  eyeShape: string; // almond, round, hooded, monolid, upturned, downturned
  eyeColor: string; // brown, blue, green, hazel, amber, gray
  eyeSize: string; // large, medium, small
  eyebrowShape: string; // arched, straight, curved, thick, thin
  eyeSpacing: string; // close-set, wide-set, normal
  
  // Nariz
  noseShape: string; // straight, Roman, button, aquiline, snub, broad, narrow
  noseSize: string; // proportionate, prominent, small
  
  // Boca y labios
  lipShape: string; // full, thin, bow-shaped, heart-shaped, wide, narrow
  lipSize: string; // full, medium, thin
  smileType: string; // wide, subtle, closed, toothy, asymmetric
  
  // Cabello
  hairColor: string; // black, brown, blonde, red, gray, etc
  hairTexture: string; // straight, wavy, curly, coily
  hairStyle: string; // short, medium, long, specific style
  hairline: string; // straight, widow's peak, receding, high, low
  
  // Piel
  skinTone: string; // fair, light, medium, tan, olive, brown, deep
  skinTexture: string; // smooth, textured, clear, freckled
  
  // Características distintivas
  distinctiveFeatures: string[]; // dimples, freckles, beauty marks, scars, etc
  
  // Expresión general
  typicalExpression: string; // serious, friendly, intense, relaxed, confident
  
  // Proporciones faciales
  facialProportions: {
    foreheadSize: string; // large, medium, small
    eyeToEyeDistance: string; // close, normal, wide
    noseToLipDistance: string; // short, normal, long
    chinSize: string; // strong, moderate, delicate
  };
  
  // Edad aparente y género percibido
  apparentAge: string; // young adult, adult, mature
  perceivedGender: string; // masculine, feminine, androgynous
  
  // Descripción general
  overallDescription: string;
  
  // Prompt optimizado para generación
  generationPrompt: string;
}

/**
 * Analiza múltiples fotos del artista para extraer características faciales completas
 */
export async function analyzeFaceFeatures(photos: string[]): Promise<FaceAnalysis> {
  try {
    logger.info(`🔍 Analizando ${photos.length} fotos del artista...`);
    
    // Usar Gemini Vision para análisis detallado
    const response = await fetch('/api/gemini/analyze-face', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: photos,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error analyzing face: ${response.status}`);
    }

    const data = await response.json();
    logger.info('✅ Análisis facial completado');
    
    return data.analysis;
  } catch (error) {
    logger.error('Error en análisis facial:', error);
    throw error;
  }
}

/**
 * Genera un prompt detallado para crear el master character
 */
export function generateMasterCharacterPrompt(
  analysis: FaceAnalysis,
  directorStyle: string,
  additionalContext?: string
): string {
  const prompt = `Professional portrait photograph of a person with the following precise characteristics:

FACIAL STRUCTURE:
- Face shape: ${analysis.faceShape}
- Jawline: ${analysis.jawline}
- Cheekbones: ${analysis.cheekbones}
- Forehead: ${analysis.facialProportions.foreheadSize}
- Chin: ${analysis.facialProportions.chinSize}

EYES:
- Shape: ${analysis.eyeShape}
- Color: ${analysis.eyeColor}
- Size: ${analysis.eyeSize}
- Spacing: ${analysis.eyeSpacing}
- Eyebrows: ${analysis.eyebrowShape}

NOSE:
- Shape: ${analysis.noseShape}
- Size: ${analysis.noseSize}

MOUTH:
- Lip shape: ${analysis.lipShape}
- Lip size: ${analysis.lipSize}
- Smile: ${analysis.smileType}

HAIR:
- Color: ${analysis.hairColor}
- Texture: ${analysis.hairTexture}
- Style: ${analysis.hairStyle}
- Hairline: ${analysis.hairline}

SKIN:
- Tone: ${analysis.skinTone}
- Texture: ${analysis.skinTexture}

DISTINCTIVE FEATURES:
${analysis.distinctiveFeatures.map(f => `- ${f}`).join('\n')}

EXPRESSION & DEMEANOR:
- Typical expression: ${analysis.typicalExpression}
- Perceived gender: ${analysis.perceivedGender}
- Apparent age: ${analysis.apparentAge}

STYLE DIRECTION:
${directorStyle}

${additionalContext || ''}

Requirements: 
- Photorealistic, high quality, professional photography
- Perfect lighting and composition
- Sharp focus on facial features
- Cinematic quality
- Studio lighting setup
- 4K resolution quality
- Professional color grading`;

  return prompt;
}

/**
 * Versión simplificada del prompt para casos donde el análisis completo no está disponible
 */
export function generateSimplifiedCharacterPrompt(
  photos: string[],
  directorStyle: string
): string {
  return `Create a professional, cinematic portrait that captures the essence and facial features of the person shown in the reference images. 

Style: ${directorStyle}

Requirements:
- Maintain accurate facial features and proportions
- Professional studio lighting
- Photorealistic quality
- Cinematic color grading
- High resolution
- Sharp focus on face
- Professional photography quality`;
}
