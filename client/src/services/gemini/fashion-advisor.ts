/**
 * Gemini Fashion Advisor
 * 
 * Asesor de moda personalizado usando Gemini AI
 * - Análisis de estilo personal
 * - Recomendaciones por género musical
 * - Paletas de color
 * - Referencias de artistas
 * - Asesoría para eventos específicos
 */

export interface FashionAnalysisRequest {
  imageUrl?: string;
  artistGenre?: string;
  occasion?: string;
  currentStyle?: string;
  goals?: string[];
}

export interface FashionAnalysisResponse {
  styleScore: number;
  colorPalette: string[];
  bodyType?: string;
  genreCoherence: number;
  suggestions: string[];
  moodBoard: {
    keywords: string[];
    artistReferences: string[];
    trendReferences: string[];
  };
  detailedAnalysis: string;
}

export interface FashionPromptRequest {
  description: string;
  genre?: string;
  occasion?: string;
  style?: string;
}

export class GeminiFashionAdvisor {
  
  /**
   * Analizar imagen de artista y dar recomendaciones de moda
   */
  async analyzeArtistImage(request: FashionAnalysisRequest): Promise<FashionAnalysisResponse> {
    try {
      console.log('🎨 Analizando estilo con Gemini...');

      const prompt = this.buildAnalysisPrompt(request);
      
      // Llamar al backend que tiene acceso a Gemini
      const response = await fetch('/api/fashion/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: request.imageUrl,
          prompt,
          genre: request.artistGenre,
          occasion: request.occasion
        })
      });

      if (!response.ok) {
        throw new Error('Error en análisis de moda');
      }

      const data = await response.json();
      return data.analysis;

    } catch (error: any) {
      console.error('❌ Error en análisis de moda:', error);
      throw error;
    }
  }

  /**
   * Generar prompt optimizado para generación de ropa
   */
  async generateFashionPrompt(request: FashionPromptRequest): Promise<string> {
    try {
      console.log('✨ Generando prompt de moda con Gemini...');

      const response = await fetch('/api/fashion/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error('Error generando prompt');
      }

      const data = await response.json();
      return data.prompt;

    } catch (error: any) {
      console.error('❌ Error generando prompt:', error);
      throw error;
    }
  }

  /**
   * Obtener recomendaciones por género musical
   */
  getStyleByGenre(genre: string): {
    keywords: string[];
    colors: string[];
    vibes: string[];
    references: string[];
  } {
    const genreStyles: Record<string, any> = {
      'rock': {
        keywords: ['leather jacket', 'distressed denim', 'band tees', 'boots', 'chains'],
        colors: ['black', 'dark red', 'charcoal', 'silver'],
        vibes: ['edgy', 'rebellious', 'bold', 'authentic'],
        references: ['Joan Jett', 'Slash', 'Debbie Harry', 'Kurt Cobain']
      },
      'pop': {
        keywords: ['trendy', 'colorful', 'accessible', 'polished', 'statement pieces'],
        colors: ['vibrant pink', 'electric blue', 'white', 'metallics'],
        vibes: ['fun', 'energetic', 'current', 'versatile'],
        references: ['Dua Lipa', 'Harry Styles', 'Billie Eilish', 'Olivia Rodrigo']
      },
      'hip-hop': {
        keywords: ['streetwear', 'oversized', 'luxury brands', 'sneakers', 'gold chains'],
        colors: ['black', 'white', 'red', 'gold'],
        vibes: ['confident', 'urban', 'luxurious', 'fresh'],
        references: ['Travis Scott', 'Doja Cat', 'Bad Bunny', 'A$AP Rocky']
      },
      'electronic': {
        keywords: ['futuristic', 'minimal', 'tech-wear', 'neon accents', 'sleek'],
        colors: ['black', 'white', 'neon green', 'electric blue'],
        vibes: ['innovative', 'minimal', 'forward-thinking', 'nightlife'],
        references: ['Grimes', 'Skrillex', 'deadmau5', 'FKA twigs']
      },
      'latin': {
        keywords: ['vibrant', 'fitted', 'cultural elements', 'bold patterns', 'flowing'],
        colors: ['red', 'yellow', 'tropical', 'gold', 'bright colors'],
        vibes: ['passionate', 'celebratory', 'rhythmic', 'expressive'],
        references: ['Bad Bunny', 'Rosalía', 'J Balvin', 'Karol G']
      },
      'indie': {
        keywords: ['vintage', 'thrifted', 'layered', 'unique', 'artsy'],
        colors: ['earth tones', 'muted pastels', 'forest green', 'rust'],
        vibes: ['authentic', 'creative', 'non-conformist', 'organic'],
        references: ['Phoebe Bridgers', 'The 1975', 'Lorde', 'Tame Impala']
      },
      'country': {
        keywords: ['western boots', 'denim', 'leather', 'fringe', 'cowboy hats'],
        colors: ['brown', 'tan', 'denim blue', 'burgundy'],
        vibes: ['authentic', 'rugged', 'down-to-earth', 'classic'],
        references: ['Kacey Musgraves', 'Orville Peck', 'Maren Morris', 'Luke Combs']
      },
      'jazz': {
        keywords: ['sophisticated', 'tailored', 'classic', 'elegant', 'timeless'],
        colors: ['navy', 'burgundy', 'cream', 'gold'],
        vibes: ['refined', 'timeless', 'sophisticated', 'smooth'],
        references: ['Gregory Porter', 'Esperanza Spalding', 'Robert Glasper']
      }
    };

    const lowerGenre = genre.toLowerCase();
    return genreStyles[lowerGenre] || genreStyles['pop']; // Default to pop
  }

  /**
   * Recomendaciones por ocasión
   */
  getStyleByOccasion(occasion: string): {
    description: string;
    keywords: string[];
    tips: string[];
  } {
    const occasions: Record<string, any> = {
      'concert': {
        description: 'Performance ready - comfortable but eye-catching',
        keywords: ['stage-worthy', 'movement-friendly', 'statement piece', 'camera-ready'],
        tips: [
          'Choose fabrics that don\'t wrinkle easily',
          'Consider stage lighting (avoid pure white)',
          'Ensure comfort for energetic performance',
          'Add one bold statement piece'
        ]
      },
      'photoshoot': {
        description: 'High-impact visuals - bold and memorable',
        keywords: ['photogenic', 'textured', 'bold colors', 'defined silhouette'],
        tips: [
          'Strong colors photograph better than pastels',
          'Add texture for visual interest',
          'Avoid busy patterns that compete with face',
          'Consider multiple looks/layers'
        ]
      },
      'red_carpet': {
        description: 'Elegant and sophisticated - make a statement',
        keywords: ['formal', 'glamorous', 'designer', 'show-stopping'],
        tips: [
          'Go for timeless elegance over trends',
          'Invest in tailoring for perfect fit',
          'One statement piece, keep rest minimal',
          'Consider awards show dress codes'
        ]
      },
      'music_video': {
        description: 'Visually striking - tell a story',
        keywords: ['conceptual', 'bold', 'thematic', 'memorable'],
        tips: [
          'Align with song\'s message and vibe',
          'Think about movement and choreography',
          'Be bold - camera loves contrast',
          'Consider multiple outfit changes'
        ]
      },
      'social_media': {
        description: 'Instagram-ready - engaging and authentic',
        keywords: ['current', 'relatable', 'authentic', 'aesthetic'],
        tips: [
          'Show personality, not just polish',
          'Consider your brand aesthetic',
          'Mix high and low fashion',
          'Think about backgrounds/settings'
        ]
      },
      'casual': {
        description: 'Everyday style - comfortable yet stylish',
        keywords: ['effortless', 'comfortable', 'versatile', 'signature'],
        tips: [
          'Develop a signature casual look',
          'Quality basics are key',
          'Add one interesting piece',
          'Comfort enables confidence'
        ]
      }
    };

    return occasions[occasion] || occasions['casual'];
  }

  /**
   * Construir prompt para análisis
   */
  private buildAnalysisPrompt(request: FashionAnalysisRequest): string {
    let prompt = `You are a professional fashion stylist specializing in music artists. `;
    
    if (request.artistGenre) {
      const genreStyle = this.getStyleByGenre(request.artistGenre);
      prompt += `The artist is in the ${request.artistGenre} genre. `;
      prompt += `Typical ${request.artistGenre} fashion includes: ${genreStyle.keywords.join(', ')}. `;
    }

    if (request.occasion) {
      const occasionStyle = this.getStyleByOccasion(request.occasion);
      prompt += `This look is for: ${request.occasion}. ${occasionStyle.description}. `;
    }

    prompt += `
Analyze the provided image and provide:
1. Style Score (0-100) - how well does current style align with genre
2. Color Palette - 5 dominant colors that work for this artist
3. Body Type analysis (if applicable)
4. Genre Coherence (0-100) - how well does outfit match their music genre
5. 5-7 Specific, actionable fashion suggestions
6. Mood Board references (keywords, similar artists, trends)

Focus on practical, achievable improvements. Consider:
- Genre authenticity vs. personal expression
- Comfort and movement (especially for performances)
- Current trends vs. timeless style
- Budget-friendly alternatives when possible

Provide response in JSON format with these exact keys:
{
  "styleScore": number,
  "colorPalette": string[],
  "bodyType": string,
  "genreCoherence": number,
  "suggestions": string[],
  "moodBoard": {
    "keywords": string[],
    "artistReferences": string[],
    "trendReferences": string[]
  },
  "detailedAnalysis": string
}`;

    return prompt;
  }

  /**
   * Optimizar prompt para generación de ropa
   */
  optimizeFashionPrompt(description: string, genre?: string, style?: string): string {
    let optimized = description;

    // Agregar keywords de calidad
    const qualityKeywords = [
      'high fashion photography',
      'professional studio lighting',
      '8k uhd',
      'detailed fabric texture',
      'sharp focus',
      'vogue style'
    ];

    // Agregar estilo por género si se especifica
    if (genre) {
      const genreStyle = this.getStyleByGenre(genre);
      optimized += `, ${genreStyle.keywords.slice(0, 3).join(', ')} aesthetic`;
    }

    // Agregar keywords de estilo
    if (style) {
      optimized += `, ${style} style`;
    }

    optimized += `, ${qualityKeywords.join(', ')}`;

    return optimized;
  }
}

// Exportar instancia única
export const geminiFashionAdvisor = new GeminiFashionAdvisor();
