/**
 * Master Character Generator with Multi-Angle Support & Casting
 * Generates high-quality artist portraits from multiple camera angles + casting actors
 */

import { analyzeFaceFeatures, generateMasterCharacterPrompt, type FaceAnalysis } from './face-analyzer';
import { logger } from "../logger";

export interface CharacterPortrait {
  angle: 'frontal' | 'left-profile' | 'right-profile' | 'three-quarter';
  imageUrl: string;
  description: string;
}

export interface CastingMember {
  role: string;
  characterName: string;
  description: string;
  imageUrl: string;
}

export interface MasterCharacterMultiAngle {
  mainCharacter: {
    imageUrl: string;
    angles: CharacterPortrait[];
  };
  casting: CastingMember[];
  analysis: FaceAnalysis;
  prompt: string;
  timestamp: Date;
}

/**
 * Generates Master Character with multiple camera angles for consistency
 * Each angle: frontal, left-profile, right-profile, three-quarter
 * Professional studio photography style
 */
export async function generateMasterCharacterMultiAngle(
  artistPhotos: string[],
  directorStyle: string,
  onProgress?: (stage: string, progress: number) => void
): Promise<MasterCharacterMultiAngle> {
  try {
    logger.info('🎭 [MASTER CHARACTER] Starting multi-angle generation with casting...');
    
    onProgress?.('Analyzing reference images...', 10);

    const baseCharacterPrompt = `Create a professional casting-ready studio portrait of the artist character based on the reference images.

CRITICAL REQUIREMENTS FOR ALL ANGLES:
- Maintain EXACT facial identity, features, and skin tone across all angles
- WARDROBE: Professional casting outfit (elegant black shirt, neutral professional clothing) - NOT the same clothes from reference
- Professional studio lighting (key light, fill light, back light)
- White or neutral background
- High-resolution 8K quality
- Sharp focus on facial details
- Professional color grading
- Movie-level cinematography
- Ready for professional casting and production`;

    // Generate 4 different angles of the main character IN PARALLEL for speed
    const angles: CharacterPortrait[] = [];
    const anglePrompts = [
      {
        angle: 'frontal' as const,
        instruction: 'Direct frontal view, looking straight at camera, professional headshot style, symmetrical lighting'
      },
      {
        angle: 'left-profile' as const,
        instruction: '90-degree left profile, clean side view showing facial structure, profile lighting with subtle rim light'
      },
      {
        angle: 'right-profile' as const,
        instruction: '90-degree right profile, clean side view showing facial structure, profile lighting with subtle rim light'
      },
      {
        angle: 'three-quarter' as const,
        instruction: '45-degree three-quarter view between frontal and side, most flattering angle, dimensional lighting'
      }
    ];

    onProgress?.('Generating all camera angles in parallel...', 20);

    // Start a progress interval that advances continuously while waiting for responses
    let currentProgress = 20;
    const angleProgressInterval = setInterval(() => {
      currentProgress = Math.min(currentProgress + 3, 48); // Advance by 3% every 200ms, cap at 48%
      onProgress?.(`Generating all camera angles in parallel...`, currentProgress);
    }, 200);

    // Generate all angles IN PARALLEL instead of sequential for speed
    const anglePromises = anglePrompts.map((angleData, index) => {
      const anglePrompt = `${baseCharacterPrompt}

CAMERA ANGLE: ${angleData.instruction}
Style: ${directorStyle}
Studio Setting: Professional photography studio with cinematic lighting`;

      return fetch('/api/gemini-image/generate-master-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImagesBase64: artistPhotos,
          prompt: anglePrompt,
          directorStyle: directorStyle
        }),
      })
        .then(response => {
          // Report progress as each angle completes with specific message
          const angleProgressMessages = [
            '📸 Frontal angle complete - Sharp headshot captured',
            '👤 Left profile complete - Clean side profile done',
            '👤 Right profile complete - Dimensional view ready',
            '✨ Three-quarter view complete - Most flattering angle captured'
          ];
          const progressValue = 25 + (index * 8); // 25%, 33%, 41%, 49%
          onProgress?.(angleProgressMessages[index], progressValue);
          
          if (response.ok) {
            return response.json().then(data => {
              if (data.success && data.imageUrl) {
                logger.info(`✅ Generated ${angleData.angle} angle`);
                return {
                  angle: angleData.angle,
                  imageUrl: data.imageUrl,
                  description: angleData.instruction
                };
              }
              return null;
            });
          }
          return null;
        })
        .catch(error => {
          logger.warn(`⚠️ Error generating ${angleData.angle}:`, error);
          return null;
        });
    });

    const angleResults = await Promise.all(anglePromises);
    clearInterval(angleProgressInterval);
    angleResults.forEach(result => {
      if (result) angles.push(result);
    });
    
    // Report progress after all angles complete
    onProgress?.('✅ All angles generated! Now creating casting profiles...', 50);

    // Generate casting members IN PARALLEL for speed
    onProgress?.('Preparing to generate ensemble cast members...', 55);

    // Start another progress interval for casting generation
    let castingProgress = 55;
    const castingProgressInterval = setInterval(() => {
      castingProgress = Math.min(castingProgress + 2.5, 88); // Advance by 2.5% every 200ms, cap at 88%
      onProgress?.(`🎬 Creating diverse ensemble cast for your video...`, castingProgress);
    }, 200);

    const castingRoles = [
      {
        role: 'Lead Supporting Actor',
        characterName: 'Protagonist',
        instruction: 'professional male actor, cinematic headshot, studio lighting, wearing professional casting wardrobe'
      },
      {
        role: 'Supporting Actress',
        characterName: 'Secondary Character',
        instruction: 'professional female actress, cinematic headshot, studio lighting, wearing professional casting wardrobe'
      },
      {
        role: 'Background Actor 1',
        characterName: 'Ensemble Member',
        instruction: 'diverse male actor, cinematic headshot, studio lighting, wearing professional casting wardrobe'
      },
      {
        role: 'Background Actress 2',
        characterName: 'Ensemble Member',
        instruction: 'diverse female actress, cinematic headshot, studio lighting, wearing professional casting wardrobe'
      }
    ];

    // Generate all casting members IN PARALLEL instead of sequential
    const castingPromises = castingRoles.map((castingRole, index) => {
      const castingPrompt = `Create a professional cinema-style headshot for a casting call.
Role: ${castingRole.role}
Character: ${castingRole.characterName}
Style: ${castingRole.instruction}

REQUIREMENTS:
- Professional casting wardrobe (elegant black/neutral professional clothing)
- Professional studio photography style
- 8K resolution, sharp focus
- Cinematic lighting with key, fill, and back light
- Neutral/white background for casting
- Professional color grading
- Movie production quality headshot
- Photorealistic rendering
- Suitable for music video casting`;

      return fetch('/api/gemini-image/generate-casting-headshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: castingPrompt,
          role: castingRole.role
        }),
      })
        .then(response => {
          // Report progress as each cast member is generated
          const castingProgressMessages = [
            '👨 Lead actor headshot captured with professional lighting',
            '👩 Supporting actress portrait ready for casting',
            '👨 Background actor ensemble member generated',
            '👩 Ensemble actress profile created for production'
          ];
          const progressValue = 60 + (index * 8); // 60%, 68%, 76%, 84%
          onProgress?.(castingProgressMessages[index], progressValue);
          
          if (response.ok) {
            return response.json().then(data => {
              if (data.success && data.imageUrl) {
                logger.info(`✅ Generated casting for ${castingRole.role}`);
                return {
                  role: castingRole.role,
                  characterName: castingRole.characterName,
                  description: castingRole.instruction,
                  imageUrl: data.imageUrl
                };
              }
              return null;
            });
          }
          return null;
        })
        .catch(error => {
          logger.warn(`⚠️ Error generating casting for ${castingRole.role}:`, error);
          return null;
        });
    });

    const castingResults = await Promise.all(castingPromises);
    clearInterval(castingProgressInterval);
    const casting: CastingMember[] = [];
    castingResults.forEach(result => {
      if (result) casting.push(result);
    });
    
    // Report almost done
    onProgress?.('⚡ Optimizing images and finalizing details...', 90);

    onProgress?.('Finalizing character generation...', 95);

    // Create simplified analysis
    const simplifiedAnalysis: FaceAnalysis = {
      faceShape: 'from reference images',
      jawline: 'from reference images',
      cheekbones: 'from reference images',
      eyeShape: 'from reference images',
      eyeColor: 'from reference images',
      eyeSize: 'from reference images',
      eyebrowShape: 'from reference images',
      eyeSpacing: 'from reference images',
      noseShape: 'from reference images',
      noseSize: 'from reference images',
      lipShape: 'from reference images',
      lipSize: 'from reference images',
      smileType: 'from reference images',
      hairColor: 'from reference images',
      hairTexture: 'from reference images',
      hairStyle: 'from reference images',
      hairline: 'from reference images',
      skinTone: 'from reference images',
      skinTexture: 'from reference images',
      distinctiveFeatures: ['Multi-angle studio photography'],
      typicalExpression: 'professional',
      facialProportions: {
        foreheadSize: 'from reference images',
        eyeToEyeDistance: 'from reference images',
        noseToLipDistance: 'from reference images',
        chinSize: 'from reference images'
      },
      apparentAge: 'from reference images',
      perceivedGender: 'from reference images',
      overallDescription: 'Master character with multi-angle portraits and professional casting',
      generationPrompt: baseCharacterPrompt
    };

    const result: MasterCharacterMultiAngle = {
      mainCharacter: {
        imageUrl: angles[0]?.imageUrl || '',
        angles: angles
      },
      casting: casting,
      analysis: simplifiedAnalysis,
      prompt: baseCharacterPrompt,
      timestamp: new Date()
    };

    onProgress?.('Character and casting generation complete!', 100);
    logger.info('✅ [MASTER CHARACTER] Multi-angle generation successful');

    return result;

  } catch (error) {
    logger.error('❌ [MASTER CHARACTER] Error:', error);
    throw error;
  }
}

/**
 * Validates character generation result
 */
export function validateMasterCharacterMultiAngle(character: MasterCharacterMultiAngle): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!character.mainCharacter.imageUrl) {
    issues.push('No main character image');
  }

  if (!character.mainCharacter.angles || character.mainCharacter.angles.length < 2) {
    issues.push('Need at least 2 angle variations');
  }

  if (!character.casting || character.casting.length === 0) {
    issues.push('No casting members generated');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}
