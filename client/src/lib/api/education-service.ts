import { getAuthToken } from "../auth";
import { logger } from "../logger";

interface CourseContent {
  overview: string;
  objectives: string[];
  curriculum: {
    title: string;
    description: string;
    estimatedMinutes: number;
  }[];
  topics: string[];
  assignments: string[];
  applications: string[];
}

/**
 * Creates fallback course content when API calls fail
 */
function createFallbackCourseContent(prompt: string): CourseContent {
  logger.info("Creating fallback course content from prompt:", prompt.substring(0, 100) + "...");
  
  // Extract course title and category from the prompt if possible
  const titleMatch = prompt.match(/Title: "([^"]+)"/i);
  const descriptionMatch = prompt.match(/Description: "([^"]+)"/i);
  const levelMatch = prompt.match(/Level: ([A-Za-z]+)/i);
  const categoryMatch = prompt.match(/Category: ([A-Za-z]+)/i);
  
  const title = titleMatch ? titleMatch[1] : "Music Course";
  const description = descriptionMatch ? descriptionMatch[1] : "Comprehensive music industry course";
  const level = levelMatch ? levelMatch[1] : "Intermediate";
  const category = categoryMatch ? categoryMatch[1] : "Music";
  
  // Create modular structure based on extracted information
  return {
    overview: `A comprehensive ${level.toLowerCase()} level course focusing on ${category.toLowerCase()} in the music industry. ${description}`,
    objectives: [
      `Understand key concepts and principles in ${category}`,
      `Develop practical skills through guided exercises and hands-on projects`,
      `Learn industry best practices and professional techniques for ${category.toLowerCase()}`,
      `Build a professional portfolio demonstrating your ${category.toLowerCase()} skills`
    ],
    curriculum: [
      {
        title: `Introduction to ${title}`,
        description: "A comprehensive introduction to the key concepts covered in this course.",
        estimatedMinutes: 45
      },
      {
        title: `${category} Fundamentals`,
        description: "Master the essential building blocks necessary for success.",
        estimatedMinutes: 60
      },
      {
        title: "Practical Applications",
        description: `Apply your ${category.toLowerCase()} knowledge to real-world scenarios and projects.`,
        estimatedMinutes: 90
      },
      {
        title: `Advanced ${category} Techniques`,
        description: "Take your skills to the next level with advanced concepts and methods.",
        estimatedMinutes: 75
      },
      {
        title: "Professional Development",
        description: `Prepare for success in the ${category.toLowerCase()} industry with career-focused strategies.`,
        estimatedMinutes: 60
      },
      {
        title: "Industry Integration",
        description: "Learn how to position your skills in the current music industry landscape.",
        estimatedMinutes: 90
      },
      {
        title: "Final Project",
        description: "Apply everything you've learned to create a professional portfolio piece.",
        estimatedMinutes: 120
      }
    ],
    topics: [`${category} Fundamentals`, "Best Practices", "Technical Skills", "Industry Standards", "Career Growth", "Portfolio Development"],
    assignments: ["Concept Development", "Technical Exercise", "Research Project", "Creative Application", "Final Portfolio"],
    applications: ["Professional Portfolio Development", `${category} Industry Implementation`, "Creative Collaboration", "Career Advancement"]
  };
}

/**
 * Generate course content using the OpenRouter API 
 * Will try to use the API first, falling back to local generation if needed
 */
export async function generateCourseContent(prompt: string): Promise<CourseContent> {
  try {
    logger.info("Starting course content generation...");
    
    try {
      // First attempt: Try to use the direct API call to OpenRouter
      logger.info("Attempting direct OpenRouter API call...");
      const content = await generateCourseContentDirect(prompt);
      logger.info("Successfully generated course content with OpenRouter API");
      return content;
    } catch (directError) {
      logger.warn("Direct OpenRouter API call failed:", directError);
      
      try {
        // Second attempt: Try the backend API route
        logger.info("Attempting backend API route...");
        const response = await fetch('/api/education/generate-course', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        logger.info("Successfully generated course content with backend API");
        return data;
      } catch (backendError) {
        logger.warn("Backend API route failed:", backendError);
        // Both attempts failed, use fallback
        throw new Error("Both API attempts failed, using fallback");
      }
    }
  } catch (error) {
    logger.error("Course generation error:", error);
    logger.info("Using fallback course content generation due to error");
    return createFallbackCourseContent(prompt);
  }
}

/**
 * Direct API call to OpenRouter for course generation
 * This is a fallback in case the backend route isn't implemented yet
 */
export async function generateCourseContentDirect(prompt: string): Promise<CourseContent> {
  try {
    logger.info("Starting direct course content generation with OpenRouter...");

    // Get OPENROUTER_API_KEY from the server
    const apiKeyResponse = await fetch("/api/get-openrouter-key");
    if (!apiKeyResponse.ok) {
      throw new Error("Could not get OpenRouter API key");
    }
    
    const { key, exists } = await apiKeyResponse.json();
    if (!exists || !key) {
      throw new Error("Invalid or missing OpenRouter API key");
    }

    // Prepare headers for OpenRouter
    const headers = {
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer": window.location.origin || "https://boostify.music.app",
      "X-Title": "Boostify Music Education",
      "Content-Type": "application/json"
    };
    
    // Use the Gemini 2.0 Flash model
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [
          {
            role: "system",
            content: `You are a JSON generator for music education courses. You MUST return a valid JSON object with this EXACT structure:
{
  "overview": "course overview text",
  "objectives": ["objective1", "objective2", "objective3"],
  "curriculum": [
    {
      "title": "lesson title",
      "description": "lesson description",
      "estimatedMinutes": 60
    }
  ],
  "topics": ["topic1", "topic2", "topic3"],
  "assignments": ["assignment1", "assignment2"],
  "applications": ["application1", "application2"]
}`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error("Invalid API response structure");
    }

    // Extract content from response
    const content = data.choices[0].message?.content;
    if (!content) {
      throw new Error("No content in API response");
    }

    // Parse JSON content
    try {
      const parsed = JSON.parse(content);
      
      // Validate and ensure structure is correct
      const validatedContent: CourseContent = {
        overview: typeof parsed.overview === 'string' ? parsed.overview : 'Course overview',
        objectives: Array.isArray(parsed.objectives) ? parsed.objectives : [],
        curriculum: Array.isArray(parsed.curriculum) ? parsed.curriculum : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
        applications: Array.isArray(parsed.applications) ? parsed.applications : []
      };

      return validatedContent;
    } catch (parseError) {
      logger.error('Error parsing JSON from API response:', parseError);
      throw new Error(`Failed to parse course content: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    logger.error('Direct OpenRouter API call failed:', error);
    throw error; // Rethrow to allow fallback in the caller function
  }
}
// Interfaz para el contenido adicional del curso
export interface AdditionalCourseContent {
  additionalLessons: {
    title: string;
    description: string;
    estimatedMinutes: number;
    keyPoints: string[];
    practicalApplication: string;
  }[];
  recommendedResources: string[];
  advancedTopics: string[];
}

/**
 * Genera contenido adicional para extender un curso existente
 * @param courseId ID del curso a extender
 * @param courseTitle Título del curso
 * @param courseDescription Descripción del curso
 * @param existingContent Contenido existente del curso (opcional)
 * @returns Promesa con el contenido adicional generado
 */
export async function extendCourseContent(
  courseId: string,
  courseTitle: string,
  courseDescription: string,
  existingContent?: any
): Promise<AdditionalCourseContent> {
  try {
    logger.info("Iniciando generación de contenido adicional para curso:", courseTitle);
    
    try {
      // Primer intento: usar llamada directa a la API de OpenRouter
      logger.info("Intentando llamada directa a OpenRouter API...");
      const additionalContent = await extendCourseContentDirect(courseId, courseTitle, courseDescription, existingContent);
      logger.info("Contenido adicional generado con éxito usando OpenRouter API");
      return additionalContent;
    } catch (directError) {
      logger.warn("Error en llamada directa a OpenRouter:", directError);
      
      try {
        // Segundo intento: usar la ruta API del backend
        logger.info("Intentando ruta API del backend...");
        const response = await fetch('/api/education/extend-course', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            courseId, 
            courseTitle, 
            courseDescription, 
            existingContent 
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error API: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        logger.info("Contenido adicional generado con éxito usando API del backend");
        return data;
      } catch (backendError) {
        logger.warn("Error en la ruta API del backend:", backendError);
        // Ambos intentos fallaron, usar contenido de respaldo
        throw new Error("Ambos intentos de API fallaron, usando contenido de respaldo");
      }
    }
  } catch (error) {
    logger.error("Error en generación de contenido adicional:", error);
    logger.info("Usando generación de contenido adicional de respaldo debido a error");
    return createFallbackAdditionalContent(courseTitle, courseDescription);
  }
}

/**
 * Función de respaldo para crear contenido adicional cuando falla la API
 */
function createFallbackAdditionalContent(courseTitle: string, courseDescription: string): AdditionalCourseContent {
  logger.info("Creando contenido adicional de respaldo para:", courseTitle);
  
  // Extraer palabras clave de la descripción para crear contenido relevante
  const keywords = courseDescription
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 4 && !['about', 'through', 'their', 'these', 'those', 'while', 'would'].includes(w))
    .slice(0, 5);
  
  const keyTerms = keywords.length > 0 ? keywords.join(', ') : 'música, industria, producción';
  
  return {
    additionalLessons: [
      {
        title: `Técnicas avanzadas en ${courseTitle}`,
        description: `Explorando métodos y enfoques avanzados relacionados con ${courseTitle}. Este módulo profundiza en aspectos técnicos y profesionales para llevar tus habilidades al siguiente nivel.`,
        estimatedMinutes: 75,
        keyPoints: [
          "Aplicación de técnicas profesionales",
          "Metodologías avanzadas",
          "Estudios de caso relevantes"
        ],
        practicalApplication: `Proyecto práctico aplicando técnicas avanzadas de ${keyTerms} en un contexto profesional real.`
      },
      {
        title: "Tendencias actuales del mercado musical",
        description: "Análisis de las tendencias actuales y emergentes en la industria musical y cómo adaptarse a ellas para mantenerse relevante.",
        estimatedMinutes: 60,
        keyPoints: [
          "Análisis de tendencias emergentes",
          "Estrategias de adaptación",
          "Casos de éxito recientes"
        ],
        practicalApplication: "Desarrollo de estrategia personalizada basada en tendencias actuales."
      },
      {
        title: "Integración de tecnologías emergentes",
        description: "Exploración de cómo las nuevas tecnologías están transformando la industria musical y cómo incorporarlas en tu carrera.",
        estimatedMinutes: 90,
        keyPoints: [
          "Tecnologías disruptivas en música",
          "Herramientas digitales avanzadas",
          "Optimización de flujos de trabajo"
        ],
        practicalApplication: "Implementación de una solución tecnológica innovadora para un desafío específico."
      },
      {
        title: "Expansión internacional y nuevos mercados",
        description: "Estrategias para expandir tu alcance a mercados internacionales y diversificar tu audiencia en la industria musical global.",
        estimatedMinutes: 65,
        keyPoints: [
          "Análisis de mercados internacionales",
          "Adaptación cultural",
          "Estrategias de distribución global"
        ],
        practicalApplication: "Desarrollo de plan de expansión a un mercado internacional específico."
      },
      {
        title: "Masterclass con profesionales de la industria",
        description: "Sesiones especiales con profesionales reconocidos que comparten insights, consejos y experiencias prácticas.",
        estimatedMinutes: 120,
        keyPoints: [
          "Experiencias de primera mano",
          "Networking profesional",
          "Consejos prácticos de expertos"
        ],
        practicalApplication: "Desarrollo de proyecto personal con mentoría especializada."
      }
    ],
    recommendedResources: [
      "Billboard Pro - Análisis y tendencias de la industria musical",
      "Music Business Worldwide - Publicación especializada en negocios musicales",
      "Masterclass en producción musical - Curso especializado en técnicas avanzadas",
      "Music Ally - Informes sobre tecnología y marketing musical",
      "International Music Summit - Conferencias y reportes anuales"
    ],
    advancedTopics: [
      "Monetización de catálogos musicales",
      "Modelos de negocio emergentes en streaming",
      "Marketing musical basado en datos",
      "Inteligencia artificial en composición y producción",
      "Estrategias de licenciamiento musical para medios visuales"
    ]
  };
}

/**
 * Llamada directa a OpenRouter para extender contenido de cursos
 * Esto se usa como alternativa si la ruta del backend no está disponible
 */
export async function extendCourseContentDirect(
  courseId: string,
  courseTitle: string,
  courseDescription: string,
  existingContent?: any
): Promise<AdditionalCourseContent> {
  try {
    logger.info("Iniciando generación directa de contenido adicional con OpenRouter...");

    // Obtener OPENROUTER_API_KEY del entorno
    // La obtendremos del servidor para mantenerla segura
    const apiKeyResponse = await fetch("/api/get-openrouter-key");
    if (!apiKeyResponse.ok) {
      throw new Error("No se pudo obtener la clave API de OpenRouter");
    }
    
    const { key } = await apiKeyResponse.json();
    if (!key) {
      throw new Error("Clave API de OpenRouter inválida o faltante");
    }

    // Crear prompt para extensión de curso
    const prompt = `Genera contenido adicional para extender el siguiente curso de música:
      
      Título: "${courseTitle}"
      Descripción: "${courseDescription || 'Curso educativo de música'}"
      
      ${existingContent ? `Contenido actual del curso (para referencia): ${JSON.stringify(existingContent).substring(0, 500)}...` : ''}
      
      Genera 5 nuevas lecciones que amplíen el contenido actual del curso. Concéntrate en temas avanzados y aplicaciones prácticas.`;
    
    // Preparar los headers correctos para OpenRouter
    const headers = {
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer": window.location.origin || "https://boostify.music.app",
      "X-Title": "Boostify Music Education",
      "Content-Type": "application/json"
    };
    
    // Usar el modelo Gemini 2.0 Flash
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [
          {
            role: "system",
            content: `Eres un generador JSON para contenido educativo de música. DEBES devolver un objeto JSON válido con esta estructura EXACTA:
{
  "additionalLessons": [
    {
      "title": "título de la lección",
      "description": "descripción detallada de la lección",
      "estimatedMinutes": 60,
      "keyPoints": ["punto clave 1", "punto clave 2", "punto clave 3"],
      "practicalApplication": "aplicación práctica de esta lección"
    }
  ],
  "recommendedResources": ["recurso 1", "recurso 2", "recurso 3"],
  "advancedTopics": ["tema avanzado 1", "tema avanzado 2", "tema avanzado 3"]
}`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error de API OpenRouter: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error("Estructura de respuesta API inválida");
    }

    // Extraer el contenido de la respuesta
    const content = data.choices[0].message?.content;
    if (!content) {
      throw new Error("No hay contenido en la respuesta API");
    }

    // Parsear el contenido JSON
    try {
      const parsed = JSON.parse(content);
      
      // Validar y asegurar que la estructura es correcta
      const validatedContent: AdditionalCourseContent = {
        additionalLessons: Array.isArray(parsed.additionalLessons) && parsed.additionalLessons.length > 0
          ? parsed.additionalLessons.map((lesson: any) => ({
              title: lesson.title || `Lección avanzada de ${courseTitle}`,
              description: lesson.description || "Descripción no disponible",
              estimatedMinutes: typeof lesson.estimatedMinutes === 'number' ? 
                                lesson.estimatedMinutes : 
                                (parseInt(String(lesson.estimatedMinutes)) || 60),
              keyPoints: Array.isArray(lesson.keyPoints) && lesson.keyPoints.length > 0 
                ? lesson.keyPoints 
                : ["Concepto clave", "Técnica profesional", "Aplicación práctica"],
              practicalApplication: lesson.practicalApplication || "Aplicación práctica de los conceptos aprendidos"
            }))
          : createFallbackAdditionalContent(courseTitle, courseDescription).additionalLessons,
            
        recommendedResources: Array.isArray(parsed.recommendedResources) && parsed.recommendedResources.length > 0
          ? parsed.recommendedResources
          : createFallbackAdditionalContent(courseTitle, courseDescription).recommendedResources,
          
        advancedTopics: Array.isArray(parsed.advancedTopics) && parsed.advancedTopics.length > 0
          ? parsed.advancedTopics
          : createFallbackAdditionalContent(courseTitle, courseDescription).advancedTopics
      };
      
      return validatedContent;
    } catch (parseError) {
      logger.error("Error al parsear JSON:", parseError);
      throw new Error("Error al parsear respuesta JSON");
    }
  } catch (error) {
    logger.error("Error en generación directa de contenido adicional:", error);
    return createFallbackAdditionalContent(courseTitle, courseDescription);
  }
}