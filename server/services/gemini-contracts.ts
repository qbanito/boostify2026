import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

interface ContractSection {
  title: string;
  content: string;
}

interface GeneratedContract {
  title: string;
  sections: ContractSection[];
  fullText: string;
}

export async function generateContract(params: {
  contractType: string;
  artistName: string;
  clientName?: string;
  projectDetails?: string;
  paymentTerms?: string;
  duration?: string;
  additionalClauses?: string;
}): Promise<string> {
  const prompt = `
Generate a professional music industry contract with the following details:

Contract Type: ${params.contractType}
Artist/Creator: ${params.artistName}
${params.clientName ? `Client/Party B: ${params.clientName}` : ''}
${params.projectDetails ? `Project Details: ${params.projectDetails}` : ''}
${params.paymentTerms ? `Payment Terms: ${params.paymentTerms}` : ''}
${params.duration ? `Duration: ${params.duration}` : ''}
${params.additionalClauses ? `Additional Clauses: ${params.additionalClauses}` : ''}

Please create a comprehensive, legally sound contract with proper sections including:
- Parties involved
- Scope of work/services
- Payment terms
- Rights and ownership
- Confidentiality
- Termination clauses
- Dispute resolution
- Signatures section

Format it professionally with clear sections and legal language appropriate for the music industry.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        maxOutputTokens: 8192,
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Error generating contract:", error);
    throw new Error("Failed to generate contract with Gemini AI");
  }
}

export async function analyzeContract(contractText: string): Promise<{
  summary: string;
  risks: string[];
  recommendations: string[];
  keyTerms: { term: string; description: string }[];
}> {
  const prompt = `
Analyze the following music industry contract and provide:

1. A brief summary of the contract
2. Potential risks or red flags
3. Recommendations for improvements
4. Key terms and their implications

Contract:
${contractText}

Provide a thorough legal analysis from an artist protection perspective.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            risks: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            keyTerms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["term", "description"]
              }
            }
          },
          required: ["summary", "risks", "recommendations", "keyTerms"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error analyzing contract:", error);
    throw new Error("Failed to analyze contract with Gemini AI");
  }
}

export const CONTRACT_TEMPLATES = {
  "music-licensing": {
    title: "Music Licensing Agreement",
    description: "License music for commercial use, sync rights, or publishing",
    type: "music-licensing"
  },
  "performance": {
    title: "Performance Agreement",
    description: "Contract for live performances, concerts, or events",
    type: "performance"
  },
  "production": {
    title: "Music Production Agreement",
    description: "Agreement for producing tracks, albums, or beats",
    type: "production"
  },
  "collaboration": {
    title: "Artist Collaboration Agreement",
    description: "Partnership agreement for joint musical projects",
    type: "collaboration"
  },
  "management": {
    title: "Artist Management Agreement",
    description: "Management services for artists and musicians",
    type: "management"
  },
  "recording": {
    title: "Recording Agreement",
    description: "Studio recording and distribution rights",
    type: "recording"
  },
  "work-for-hire": {
    title: "Work for Hire Agreement",
    description: "Commissioned music creation with rights transfer",
    type: "work-for-hire"
  },
  "nda": {
    title: "Non-Disclosure Agreement (NDA)",
    description: "Protect confidential information and unreleased music",
    type: "nda"
  }
};

export async function generateTemplateContract(
  templateType: string,
  customParams: Record<string, string>
): Promise<string> {
  const template = CONTRACT_TEMPLATES[templateType as keyof typeof CONTRACT_TEMPLATES];
  
  if (!template) {
    throw new Error(`Unknown template type: ${templateType}`);
  }

  const basePrompt = `
Generate a professional ${template.title} for the music industry.

Template Type: ${template.description}
`;

  const customFields = Object.entries(customParams)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const fullPrompt = `${basePrompt}\n\nCustom Details:\n${customFields}\n\nCreate a comprehensive, legally sound contract with all necessary clauses and professional formatting.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: fullPrompt,
      config: {
        maxOutputTokens: 8192,
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Error generating template contract:", error);
    throw new Error("Failed to generate template contract");
  }
}
