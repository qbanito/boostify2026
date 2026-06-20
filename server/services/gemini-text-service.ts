/**
 * Servicio de generación de texto con Gemini 2.0 Flash
 * Para crear documentos profesionales para manager tools
 */
import { GoogleGenAI } from "@google/genai";

// Configurar múltiples clientes de Gemini para fallback automático
const apiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY2
].filter(key => key && key.length > 0);

const geminiClients = apiKeys.map(key => new GoogleGenAI({ apiKey: key || "" }));

/**
 * Intenta generar contenido con fallback automático entre API keys
 */
async function generateTextWithFallback(params: any): Promise<any> {
  let lastError: any = null;
  
  for (let i = 0; i < geminiClients.length; i++) {
    try {
      console.log(`🔑 Generando texto con API key ${i + 1}/${geminiClients.length}...`);
      const client = geminiClients[i];
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gemini API timeout después de 60 segundos')), 60000);
      });
      
      const generationPromise = client.models.generateContent(params);
      
      const response = await Promise.race([generationPromise, timeoutPromise]);
      console.log(`✅ Generación de texto exitosa con API key ${i + 1}`);
      return response;
    } catch (error: any) {
      lastError = error;
      
      console.error(`❌ Error con API key ${i + 1}:`, error.message);
      
      if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`⚠️ API key ${i + 1} sin cuota disponible, intentando con siguiente key...`);
        continue;
      }
      
      if (error.message?.includes('timeout')) {
        console.warn(`⏱️ API key ${i + 1} timeout, intentando con siguiente key...`);
        continue;
      }
      
      throw error;
    }
  }
  
  console.error('❌ Todas las API keys agotaron su cuota o fallaron');
  throw lastError || new Error('Todas las API keys de Gemini han fallado');
}

export interface DocumentGenerationOptions {
  type: 'technical-rider' | 'lighting-setup' | 'stage-plot' | 'hospitality' | 'contract' | 'requirements' | 'budget' | 'logistics' | 'hiring' | 'calendar' | 'ai-assistant';
  requirements: string;
  format?: 'detailed' | 'concise' | 'technical';
}

/**
 * Genera un documento profesional usando Gemini 2.0 Flash
 */
export async function generateProfessionalDocument(options: DocumentGenerationOptions): Promise<string> {
  try {
    if (geminiClients.length === 0) {
      throw new Error('No hay API keys de Gemini configuradas');
    }

    const prompts = {
      'technical-rider': `You are a professional tour manager creating a comprehensive technical rider. Generate a detailed, professional technical rider document based on these requirements:

${options.requirements}

Include the following sections:
1. STAGE REQUIREMENTS
   - Stage dimensions and specifications
   - Power requirements (voltage, amperage, outlets)
   - Riser/platform requirements

2. AUDIO REQUIREMENTS
   - PA system specifications
   - Monitor system requirements
   - Microphone list with specific models
   - DI boxes and connections
   - Mixing console preferences

3. LIGHTING REQUIREMENTS
   - Lighting rig specifications
   - Specific fixture requirements
   - DMX control needs
   - Special effects requirements

4. BACKLINE EQUIPMENT
   - Instruments provided by venue
   - Equipment provided by artist
   - Specific brand/model requirements

5. PERSONNEL REQUIREMENTS
   - Sound engineer needs
   - Lighting technician needs
   - Stage crew requirements

6. ADDITIONAL NOTES
   - Load-in/out times
   - Soundcheck requirements
   - Special requests

Format this as a professional technical rider document with clear sections and specifications.`,

      'lighting-setup': `You are a professional lighting designer creating a detailed lighting setup document. Generate a comprehensive lighting plan based on these requirements:

${options.requirements}

Include:
1. LIGHTING FIXTURES
   - Types of lights (LED, moving heads, PAR cans, etc.)
   - Quantity and specifications
   - Positioning (front, side, back, truss)

2. LIGHTING PLOT
   - Stage layout with fixture positions
   - Hanging points and heights
   - Cable runs and power distribution

3. CONTROL SYSTEM
   - DMX universe assignments
   - Console requirements
   - Backup systems

4. COLOR AND EFFECTS
   - Color palettes for each song/section
   - Atmospheric effects (haze, strobes)
   - Special effects requirements

5. TECHNICAL SPECIFICATIONS
   - Power requirements per fixture
   - Total power consumption
   - Cable and connector types

6. CUELIST
   - Lighting cues by song/section
   - Transition timings
   - Special moments/effects

Format this as a professional lighting designer's technical document.`,

      'stage-plot': `You are a professional stage manager creating a detailed stage plot. Generate a comprehensive stage plot document based on:

${options.requirements}

Include:
1. STAGE LAYOUT
   - Performer positions
   - Instrument placement
   - Monitor positions
   - Cable runs

2. DIMENSIONS
   - Stage size requirements
   - Playing area dimensions
   - Wing space needed

3. EQUIPMENT PLACEMENT
   - Drum kit position and size
   - Amplifiers and cabinets
   - Keyboards and stands
   - Microphone stands

4. MONITORING
   - Monitor wedge positions
   - In-ear monitor requirements
   - Mix positions

5. CABLES AND CONNECTIONS
   - Audio snake placement
   - Power distribution
   - Cable routing

Format as a professional stage plot document with clear positioning and measurements.`,

      'hospitality': `You are a professional tour manager creating a hospitality rider. Generate a detailed hospitality document based on:

${options.requirements}

Include:
1. DRESSING ROOM REQUIREMENTS
   - Number of rooms needed
   - Furniture and amenities
   - Climate control

2. CATERING
   - Meal requirements by time
   - Dietary restrictions
   - Beverage preferences
   - Snacks and refreshments

3. TRANSPORTATION
   - Load-in vehicle access
   - Parking requirements
   - Local transportation needs

4. ACCOMMODATIONS
   - Hotel room requirements
   - Check-in/out times
   - Special requests

5. PRODUCTION OFFICE
   - Internet connectivity
   - Printing/copying access
   - Storage needs

Format as a professional hospitality rider with clear requirements.`,

      'contract': `You are a professional entertainment lawyer creating a performance contract. Generate a detailed performance agreement based on:

${options.requirements}

Include:
1. PARTIES
   - Artist/performer details
   - Venue/promoter details

2. PERFORMANCE DETAILS
   - Date(s) and time(s)
   - Venue location
   - Performance duration

3. COMPENSATION
   - Performance fee
   - Payment schedule
   - Deposit requirements

4. TECHNICAL REQUIREMENTS
   - Reference to technical rider
   - Equipment responsibilities
   - Sound/lighting requirements

5. CANCELLATION POLICY
   - Force majeure clause
   - Cancellation fees
   - Rescheduling terms

6. ADDITIONAL TERMS
   - Merchandise rights
   - Recording rights
   - Promotional obligations

Format as a professional performance contract with clear legal language.`,

      'requirements': `You are a professional tour manager creating a comprehensive requirements list. Generate a detailed requirements document based on:

${options.requirements}

Include:
1. TECHNICAL REQUIREMENTS
   - Audio equipment needs
   - Lighting specifications
   - Stage requirements
   - Power requirements

2. LOGISTICAL REQUIREMENTS
   - Transportation needs
   - Accommodation details
   - Load-in/out schedule
   - Crew requirements

3. PERSONNEL REQUIREMENTS
   - Team members needed
   - Roles and responsibilities
   - Qualifications required

4. HOSPITALITY REQUIREMENTS
   - Catering needs
   - Dressing room setup
   - Green room amenities

5. PRODUCTION REQUIREMENTS
   - Rehearsal needs
   - Soundcheck timing
   - Video/photo requirements

6. SPECIAL REQUIREMENTS
   - Security needs
   - Access requirements
   - Special requests

Format as a professional requirements document with clear, itemized lists.`,

      'budget': `You are a professional production accountant creating a detailed budget breakdown. Generate a comprehensive budget document based on:

${options.requirements}

Include:
1. PRE-PRODUCTION COSTS
   - Planning and preparation
   - Location scouting
   - Permits and insurance
   - Staff pre-production time

2. PRODUCTION COSTS
   - Personnel (crew, talent, specialists)
   - Equipment rental
   - Venue/location fees
   - Catering and hospitality
   - Transportation
   - Accommodation

3. POST-PRODUCTION COSTS
   - Editing and mixing
   - Graphics and effects
   - Distribution costs
   - Marketing materials

4. CONTINGENCY
   - Unexpected expenses (10-15%)
   - Weather delays
   - Equipment failure backup

5. REVENUE PROJECTIONS (if applicable)
   - Ticket sales
   - Merchandise
   - Sponsorships
   - Streaming/licensing

6. BUDGET SUMMARY
   - Total estimated costs
   - Cost per category
   - Profit/loss projection

Format as a professional budget with clear line items, subtotals, and grand total.`,

      'logistics': `You are a professional tour logistics coordinator creating a detailed logistics plan. Generate a comprehensive logistics document based on:

${options.requirements}

Include:
1. TRANSPORTATION
   - Travel routes and schedules
   - Vehicle requirements
   - Equipment transport
   - Crew transportation

2. ACCOMMODATION
   - Hotel bookings
   - Room assignments
   - Check-in/out times
   - Special requests

3. EQUIPMENT HANDLING
   - Load-in schedule
   - Load-out schedule
   - Storage requirements
   - Equipment security

4. TIMELINE
   - Detailed day-of schedule
   - Setup timeline
   - Performance schedule
   - Breakdown timeline

5. CONTACT INFORMATION
   - Venue contacts
   - Transportation providers
   - Emergency contacts
   - Team communication

6. CONTINGENCY PLANS
   - Backup transportation
   - Alternative routes
   - Weather delays
   - Emergency procedures

Format as a professional logistics plan with clear timelines and responsibilities.`,

      'hiring': `You are a professional talent recruiter creating detailed job descriptions. Generate comprehensive hiring documentation based on:

${options.requirements}

Include:
1. POSITION OVERVIEW
   - Job title
   - Department/team
   - Reports to
   - Employment type

2. RESPONSIBILITIES
   - Primary duties
   - Day-to-day tasks
   - Project involvement
   - Team collaboration

3. QUALIFICATIONS
   - Required education
   - Required experience
   - Technical skills
   - Soft skills

4. PREFERRED QUALIFICATIONS
   - Additional certifications
   - Industry experience
   - Portfolio requirements
   - References

5. COMPENSATION & BENEFITS
   - Salary range
   - Benefits package
   - Tour per diems (if applicable)
   - Travel opportunities

6. APPLICATION PROCESS
   - How to apply
   - Required materials
   - Interview process
   - Timeline

Format as professional job descriptions with clear requirements and expectations.`,

      'calendar': `You are a professional event coordinator creating a detailed schedule. Generate a comprehensive calendar/schedule document based on:

${options.requirements}

Include:
1. TIMELINE OVERVIEW
   - Project start and end dates
   - Major milestones
   - Key deadlines
   - Phase breakdown

2. DETAILED SCHEDULE
   - Daily/weekly activities
   - Time allocations
   - Responsible parties
   - Dependencies

3. REHEARSAL SCHEDULE (if applicable)
   - Rehearsal dates and times
   - Location
   - Objectives for each session
   - Equipment needs

4. PRODUCTION SCHEDULE
   - Setup timeline
   - Performance/event times
   - Breakdown timeline
   - Travel time buffers

5. IMPORTANT DATES
   - Payment deadlines
   - Contract submissions
   - Marketing milestones
   - Technical rehearsals

6. REMINDERS & NOTES
   - Critical checkpoints
   - Advance preparation needed
   - Backup dates
   - Weather considerations

Format as a professional schedule with clear dates, times, and responsibilities.`,

      'ai-assistant': `You are an expert AI consultant providing professional insights and recommendations. Analyze this request and provide detailed guidance:

${options.requirements}

Include:
1. SITUATION ANALYSIS
   - Current state assessment
   - Key challenges identified
   - Opportunities available
   - Industry context

2. RECOMMENDATIONS
   - Specific actionable steps
   - Priority ranking
   - Timeline for implementation
   - Resource requirements

3. BEST PRACTICES
   - Industry standards
   - Proven strategies
   - Common pitfalls to avoid
   - Success metrics

4. IMPLEMENTATION PLAN
   - Step-by-step approach
   - Tools and resources needed
   - Team requirements
   - Budget considerations

5. RISK MITIGATION
   - Potential challenges
   - Backup strategies
   - Contingency planning
   - Quality control measures

6. NEXT STEPS
   - Immediate actions
   - Short-term goals
   - Long-term objectives
   - Follow-up recommendations

Format as professional AI-powered consulting advice with clear, actionable insights.`
    };

    const prompt = prompts[options.type] || prompts['technical-rider'];

    console.log('📄 Generando documento profesional con Gemini...');

    const response = await generateTextWithFallback({
      model: "gemini-2.0-flash-exp",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No se recibieron candidatos de la API');
    }

    const content = candidates[0].content;
    if (!content || !content.parts || !content.parts[0].text) {
      throw new Error('Contenido vacío en la respuesta');
    }

    const generatedText = content.parts[0].text;
    console.log('✅ Documento profesional generado exitosamente');

    return generatedText;
  } catch (error: any) {
    console.error('❌ Error generando documento profesional:', error);
    throw new Error(error.message || 'Error generando documento profesional');
  }
}

/**
 * Genera un preview corto del documento (para mostrar antes de guardar)
 */
export async function generateDocumentPreview(options: DocumentGenerationOptions): Promise<string> {
  try {
    const prompt = `Generate a brief preview (300-400 words) of a professional ${options.type.replace('-', ' ')} document based on these requirements:

${options.requirements}

Make it professional and include the key highlights that would appear in the full document.`;

    const response = await generateTextWithFallback({
      model: "gemini-2.0-flash-exp",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No se recibieron candidatos de la API');
    }

    const content = candidates[0].content;
    return content.parts[0].text;
  } catch (error: any) {
    console.error('Error generando preview:', error);
    throw error;
  }
}
