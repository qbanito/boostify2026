/**
 * 🔍 Image Quality Validation System
 * Detecta problemas de calidad en imágenes generadas:
 * - Collages/grids (múltiples imágenes en una)
 * - Baja calidad o blur
 * - Inconsistencia facial
 * - Errores de generación
 */

import { logger } from './logger';

export interface QualityValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: QualityIssue[];
  shouldRegenerate: boolean;
  regenerationReason?: string;
}

export interface QualityIssue {
  type: 'collage' | 'blur' | 'face_mismatch' | 'wrong_aspect' | 'error' | 'low_quality';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  confidence: number; // 0-1
}

// 🎯 Quality thresholds
const QUALITY_THRESHOLDS = {
  minScore: 60, // Minimum score to pass
  collageConfidence: 0.7, // Above this = definitely a collage
  blurThreshold: 0.3, // Above this = too blurry
  faceMatchThreshold: 0.6, // Below this = face mismatch
  autoRegenerateBelow: 40 // Auto-regenerate if score below this
};

/**
 * 🔍 Validates image quality using visual analysis
 * Uses heuristics and pattern detection for common issues
 */
export async function validateImageQuality(
  imageUrl: string,
  options?: {
    expectedAspectRatio?: string;
    hasFaceReference?: boolean;
    shotCategory?: 'PERFORMANCE' | 'B-ROLL' | 'STORY';
  }
): Promise<QualityValidationResult> {
  const issues: QualityIssue[] = [];
  let score = 100;

  try {
    // Load image for analysis
    const img = await loadImage(imageUrl);
    
    // 1. Check aspect ratio
    const aspectIssue = checkAspectRatio(img, options?.expectedAspectRatio || '16:9');
    if (aspectIssue) {
      issues.push(aspectIssue);
      score -= aspectIssue.severity === 'critical' ? 30 : aspectIssue.severity === 'high' ? 20 : 10;
    }

    // 2. Detect collage/grid pattern
    const collageIssue = await detectCollagePattern(img);
    if (collageIssue) {
      issues.push(collageIssue);
      score -= collageIssue.severity === 'critical' ? 50 : 30;
    }

    // 3. Check image resolution and blur
    const qualityIssue = checkImageQuality(img);
    if (qualityIssue) {
      issues.push(qualityIssue);
      score -= qualityIssue.severity === 'high' ? 25 : 15;
    }

    // 4. Validate face presence for non-B-roll shots
    if (options?.shotCategory && options.shotCategory !== 'B-ROLL') {
      const faceIssue = await checkFacePresence(img, options.hasFaceReference);
      if (faceIssue) {
        issues.push(faceIssue);
        score -= faceIssue.severity === 'high' ? 20 : 10;
      }
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    const shouldRegenerate = score < QUALITY_THRESHOLDS.autoRegenerateBelow;
    const regenerationReason = shouldRegenerate 
      ? issues.filter(i => i.severity === 'critical' || i.severity === 'high')
          .map(i => i.message).join('; ')
      : undefined;

    return {
      isValid: score >= QUALITY_THRESHOLDS.minScore,
      score,
      issues,
      shouldRegenerate,
      regenerationReason
    };

  } catch (error) {
    logger.error('Error validating image quality:', error);
    return {
      isValid: false,
      score: 0,
      issues: [{
        type: 'error',
        severity: 'critical',
        message: 'Failed to analyze image',
        confidence: 1
      }],
      shouldRegenerate: true,
      regenerationReason: 'Image analysis failed'
    };
  }
}

/**
 * 📐 Check if image matches expected aspect ratio
 */
function checkAspectRatio(img: HTMLImageElement, expected: string): QualityIssue | null {
  const actualRatio = img.width / img.height;
  
  const expectedRatios: Record<string, number> = {
    '16:9': 16/9,
    '9:16': 9/16,
    '4:3': 4/3,
    '3:4': 3/4,
    '1:1': 1
  };
  
  const expectedRatio = expectedRatios[expected] || 16/9;
  const tolerance = 0.1; // 10% tolerance
  
  if (Math.abs(actualRatio - expectedRatio) > tolerance) {
    return {
      type: 'wrong_aspect',
      severity: 'medium',
      message: `Aspect ratio mismatch: expected ${expected}, got ${actualRatio.toFixed(2)}`,
      confidence: 0.9
    };
  }
  
  return null;
}

/**
 * 🔲 Detect if image is a collage/grid of multiple images
 */
async function detectCollagePattern(img: HTMLImageElement): Promise<QualityIssue | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  // Analyze for grid patterns
  const patterns = detectGridLines(ctx, canvas.width, canvas.height);
  
  if (patterns.hasVerticalDivider && patterns.hasHorizontalDivider) {
    return {
      type: 'collage',
      severity: 'critical',
      message: 'Image appears to be a 4-panel collage/grid',
      confidence: patterns.confidence
    };
  }
  
  if (patterns.hasVerticalDivider || patterns.hasHorizontalDivider) {
    return {
      type: 'collage',
      severity: 'high',
      message: 'Image appears to be split into multiple panels',
      confidence: patterns.confidence * 0.8
    };
  }

  return null;
}

/**
 * 📏 Detect grid lines in image that indicate collage
 */
function detectGridLines(
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number
): { hasVerticalDivider: boolean; hasHorizontalDivider: boolean; confidence: number } {
  const sampleSize = 5; // pixels to sample around potential divider
  
  // Check for vertical divider at center
  const midX = Math.floor(width / 2);
  let verticalSimilarity = 0;
  
  for (let y = 0; y < height; y += 10) {
    const leftPixel = ctx.getImageData(midX - sampleSize, y, 1, 1).data;
    const rightPixel = ctx.getImageData(midX + sampleSize, y, 1, 1).data;
    
    // Check if there's a sharp color difference (indicating edge/border)
    const colorDiff = Math.abs(leftPixel[0] - rightPixel[0]) + 
                      Math.abs(leftPixel[1] - rightPixel[1]) + 
                      Math.abs(leftPixel[2] - rightPixel[2]);
    
    if (colorDiff > 50) {
      verticalSimilarity++;
    }
  }
  
  // Check for horizontal divider at center
  const midY = Math.floor(height / 2);
  let horizontalSimilarity = 0;
  
  for (let x = 0; x < width; x += 10) {
    const topPixel = ctx.getImageData(x, midY - sampleSize, 1, 1).data;
    const bottomPixel = ctx.getImageData(x, midY + sampleSize, 1, 1).data;
    
    const colorDiff = Math.abs(topPixel[0] - bottomPixel[0]) + 
                      Math.abs(topPixel[1] - bottomPixel[1]) + 
                      Math.abs(topPixel[2] - bottomPixel[2]);
    
    if (colorDiff > 50) {
      horizontalSimilarity++;
    }
  }
  
  const samplesVertical = Math.floor(height / 10);
  const samplesHorizontal = Math.floor(width / 10);
  
  const verticalRatio = verticalSimilarity / samplesVertical;
  const horizontalRatio = horizontalSimilarity / samplesHorizontal;
  
  return {
    hasVerticalDivider: verticalRatio > 0.6,
    hasHorizontalDivider: horizontalRatio > 0.6,
    confidence: Math.max(verticalRatio, horizontalRatio)
  };
}

/**
 * 🔍 Check general image quality (resolution, blur)
 */
function checkImageQuality(img: HTMLImageElement): QualityIssue | null {
  // Check minimum resolution
  const minWidth = 800;
  const minHeight = 450;
  
  if (img.width < minWidth || img.height < minHeight) {
    return {
      type: 'low_quality',
      severity: img.width < 400 ? 'critical' : 'high',
      message: `Low resolution: ${img.width}x${img.height} (minimum: ${minWidth}x${minHeight})`,
      confidence: 0.95
    };
  }
  
  return null;
}

/**
 * 👤 Check for face presence in non-B-roll shots
 */
async function checkFacePresence(
  img: HTMLImageElement, 
  hasFaceReference?: boolean
): Promise<QualityIssue | null> {
  // This would ideally use a face detection API
  // For now, we do a basic check based on image properties
  
  // If we have a face reference but the image is too dark/uniform,
  // it might mean the face isn't properly visible
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const sampleSize = 100;
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  
  // Sample center of image (where face typically is)
  const centerX = img.width / 2 - sampleSize / 2;
  const centerY = img.height / 3; // Upper third where face usually is
  
  ctx.drawImage(
    img, 
    centerX, centerY, sampleSize, sampleSize,
    0, 0, sampleSize, sampleSize
  );
  
  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  
  // Calculate variance in skin-tone range
  let skinTonePixels = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    
    // Very rough skin tone detection
    if (r > 60 && g > 40 && b > 20 && r > g && g > b) {
      skinTonePixels++;
    }
  }
  
  const skinToneRatio = skinTonePixels / (sampleSize * sampleSize / 4);
  
  // If very low skin tone presence in upper center, might be an issue
  if (hasFaceReference && skinToneRatio < 0.05) {
    return {
      type: 'face_mismatch',
      severity: 'medium',
      message: 'Face may not be clearly visible in frame',
      confidence: 0.6
    };
  }
  
  return null;
}

/**
 * 🖼️ Load image for analysis
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * 🔄 Suggests regeneration parameters based on quality issues
 */
export function suggestRegenerationParams(
  issues: QualityIssue[],
  originalPrompt: string
): { modifiedPrompt: string; suggestions: string[] } {
  const suggestions: string[] = [];
  let modifiedPrompt = originalPrompt;

  for (const issue of issues) {
    switch (issue.type) {
      case 'collage':
        suggestions.push('Added "single unified frame" instruction');
        if (!modifiedPrompt.includes('single')) {
          modifiedPrompt = `[SINGLE UNIFIED IMAGE - NOT A COLLAGE] ${modifiedPrompt}. Output must be ONE cohesive frame, NOT multiple panels or grid.`;
        }
        break;
        
      case 'blur':
        suggestions.push('Added sharpness and focus requirements');
        modifiedPrompt += '. Sharp focus, high detail, no blur, crisp edges.';
        break;
        
      case 'face_mismatch':
        suggestions.push('Emphasized face visibility');
        modifiedPrompt += '. Face clearly visible in frame, well-lit, recognizable features.';
        break;
        
      case 'low_quality':
        suggestions.push('Requested higher quality output');
        modifiedPrompt += '. Ultra high quality, 8K resolution, professional photography.';
        break;
    }
  }

  return { modifiedPrompt, suggestions };
}

/**
 * 📊 Batch validate multiple images
 */
export async function batchValidateImages(
  images: Array<{ url: string; sceneIndex: number; shotCategory?: string }>
): Promise<Map<number, QualityValidationResult>> {
  const results = new Map<number, QualityValidationResult>();
  
  const validations = images.map(async (img) => {
    const result = await validateImageQuality(img.url, {
      expectedAspectRatio: '16:9',
      shotCategory: img.shotCategory as any
    });
    return { sceneIndex: img.sceneIndex, result };
  });

  const completed = await Promise.allSettled(validations);
  
  completed.forEach((res) => {
    if (res.status === 'fulfilled') {
      results.set(res.value.sceneIndex, res.value.result);
    }
  });

  return results;
}

/**
 * 📈 Get overall quality statistics
 */
export function getQualityStats(
  validations: Map<number, QualityValidationResult>
): {
  averageScore: number;
  passRate: number;
  issueBreakdown: Record<string, number>;
  needsRegeneration: number[];
} {
  const scores: number[] = [];
  const passed: number[] = [];
  const issueBreakdown: Record<string, number> = {};
  const needsRegeneration: number[] = [];

  validations.forEach((result, sceneIndex) => {
    scores.push(result.score);
    if (result.isValid) passed.push(sceneIndex);
    if (result.shouldRegenerate) needsRegeneration.push(sceneIndex);
    
    result.issues.forEach(issue => {
      issueBreakdown[issue.type] = (issueBreakdown[issue.type] || 0) + 1;
    });
  });

  return {
    averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    passRate: scores.length > 0 ? (passed.length / scores.length) * 100 : 0,
    issueBreakdown,
    needsRegeneration
  };
}
