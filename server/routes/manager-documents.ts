/**
 * API Routes para Manager Tools - Solo generación de contenido con OpenAI
 * El almacenamiento en Firestore se maneja desde el cliente
 */
import express from 'express';
import { generateProfessionalDocument } from '../services/openai-text-service';

const router = express.Router();

/**
 * POST /api/manager/documents/generate-text
 * Genera solo el texto del documento con Gemini
 */
router.post('/generate-text', async (req, res) => {
  try {
    const { type, requirements, metadata } = req.body;

    if (!type || !requirements) {
      return res.status(400).json({ 
        error: 'type y requirements son requeridos' 
      });
    }

    const validTypes = ['technical-rider', 'lighting-setup', 'stage-plot', 'hospitality', 'contract', 'requirements', 'budget', 'logistics', 'hiring', 'calendar', 'ai-assistant'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: `Tipo inválido. Debe ser uno de: ${validTypes.join(', ')}` 
      });
    }

    console.log(`📄 Generando texto con Gemini para tipo: ${type}`);

    // Construir requirements completos con metadata
    let fullRequirements = requirements;
    
    if (metadata) {
      fullRequirements = `
ARTIST/EVENT INFORMATION:
- Artist/Band Name: ${metadata.artistName || 'N/A'}
${metadata.eventName ? `- Event Name: ${metadata.eventName}` : ''}
${metadata.eventDate ? `- Event Date: ${metadata.eventDate}` : ''}
${metadata.venueName ? `- Venue: ${metadata.venueName}` : ''}
${metadata.venueCity ? `- City: ${metadata.venueCity}` : ''}
${metadata.venueCapacity ? `- Venue Capacity: ${metadata.venueCapacity}` : ''}
${metadata.contactName ? `- Contact Person: ${metadata.contactName}` : ''}
${metadata.contactEmail ? `- Contact Email: ${metadata.contactEmail}` : ''}
${metadata.contactPhone ? `- Contact Phone: ${metadata.contactPhone}` : ''}

TECHNICAL REQUIREMENTS:
${requirements}

Please generate a professional document that includes all the above information in the appropriate sections.
`;
    }

    const content = await generateProfessionalDocument({
      type,
      requirements: fullRequirements,
      format: 'detailed'
    });

    res.json({ 
      success: true, 
      content 
    });
  } catch (error: any) {
    console.error('Error en /generate-text:', error);
    res.status(500).json({ 
      error: error.message || 'Error generando texto' 
    });
  }
});

/**
 * POST /api/manager/documents/image-prompts
 * Retorna los prompts para generar imágenes según el tipo de documento
 */
router.post('/image-prompts', async (req, res) => {
  try {
    const { type, requirements } = req.body;

    if (!type) {
      return res.status(400).json({ 
        error: 'type es requerido' 
      });
    }

    const prompts = getImagePromptsForDocumentType(type, requirements || '');

    res.json({ 
      success: true, 
      prompts 
    });
  } catch (error: any) {
    console.error('Error en /image-prompts:', error);
    res.status(500).json({ 
      error: error.message || 'Error obteniendo prompts' 
    });
  }
});

/**
 * Genera prompts de imágenes según el tipo de documento
 */
function getImagePromptsForDocumentType(
  type: string,
  requirements: string
): { prompt: string; type: string }[] {
  const prompts: { prompt: string; type: string }[] = [];

  switch (type) {
    case 'lighting-setup':
      prompts.push({
        type: 'lighting-diagram',
        prompt: `Professional lighting setup technical diagram for a live concert. Technical illustration showing: stage layout with truss positions, lighting fixtures (LED moving heads, PAR cans, spotlights), DMX control lines, power distribution. Clean technical drawing style, isometric view, labeled components, professional stage lighting design blueprint. White background, clear annotations, industry-standard symbols.`
      });
      prompts.push({
        type: 'lighting-render',
        prompt: `Professional 3D render of a concert stage lighting setup. Multiple LED stage lights, moving head fixtures, colorful spotlights illuminating an empty stage. Professional concert lighting atmosphere, dramatic lighting effects, haze/fog effects, vibrant colors (blue, purple, orange), realistic lighting simulation. High-quality render, professional concert venue.`
      });
      break;

    case 'technical-rider':
      prompts.push({
        type: 'stage-plot',
        prompt: `Professional stage plot technical diagram for a live band. Top-down view showing: stage dimensions, instrument positions (drums, keyboards, guitar amps), monitor wedge placements, microphone positions, audio snake location. Clean technical drawing style, labeled positions, measurements indicated, professional stage manager's plot. White background, clear annotations.`
      });
      break;

    case 'stage-plot':
      prompts.push({
        type: 'stage-layout',
        prompt: `Professional stage layout blueprint. Top-down technical view showing detailed stage plot: band member positions, instrument placements, monitor positions, cable runs, power distribution. Clean CAD-style technical drawing, measurements and annotations, professional touring production standard. White background, crisp lines.`
      });
      prompts.push({
        type: 'stage-3d',
        prompt: `Professional 3D visualization of a concert stage setup. Isometric view showing complete stage layout: drum kit, keyboard setup, guitar amplifiers, microphone stands, monitor wedges, lighting truss overhead. Professional production render, clean and organized stage, realistic equipment, professional concert production quality.`
      });
      break;

    case 'hospitality':
      prompts.push({
        type: 'dressing-room',
        prompt: `Professional artist dressing room setup. Comfortable modern dressing room with: sofa seating, makeup station with mirror and lighting, clothing rack, mini refrigerator, coffee station, fruit and snack table. Clean, well-lit, professional touring hospitality standard. Warm lighting, organized and welcoming atmosphere.`
      });
      break;

    default:
      break;
  }

  return prompts;
}

export default router;
