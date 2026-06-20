import OpenAI from "openai";
import { logger } from "./logger";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export { openai };

export const CONTRACT_TYPES = {
  DISTRIBUTION: 'distribution',
  RECORDING: 'recording',
  PERFORMANCE: 'performance',
  LICENSING: 'licensing',
  MANAGEMENT: 'management',
  COLLABORATION: 'collaboration'
} as const;

export type ContractType = typeof CONTRACT_TYPES[keyof typeof CONTRACT_TYPES];

interface ContractDetails {
  type: ContractType;
  artistName: string;
  otherParty: string;
  terms: string;
  additionalDetails?: string;
}

const CONTRACT_PROMPTS = {
  [CONTRACT_TYPES.DISTRIBUTION]: "Create a professional music distribution agreement",
  [CONTRACT_TYPES.RECORDING]: "Create a professional music recording contract",
  [CONTRACT_TYPES.PERFORMANCE]: "Create a professional performance agreement",
  [CONTRACT_TYPES.LICENSING]: "Create a professional music licensing agreement",
  [CONTRACT_TYPES.MANAGEMENT]: "Create a professional artist management contract",
  [CONTRACT_TYPES.COLLABORATION]: "Create a professional music collaboration agreement"
};

export async function generateContract(details: ContractDetails): Promise<string> {
  const basePrompt = CONTRACT_PROMPTS[details.type];

  const prompt = `${basePrompt} between "${details.artistName}" and "${details.otherParty}" with the following terms: ${details.terms}.
  ${details.additionalDetails ? `Additional considerations: ${details.additionalDetails}` : ''}

  Format the contract professionally with the following sections:
  1. Parties and Definitions
  2. Scope of Agreement
  3. Rights and Obligations
  4. Term and Termination
  5. Compensation
  6. Representations and Warranties
  7. General Provisions

  Use formal legal language but make it clear and understandable. Include proper formatting with numbered sections and subsections.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert legal contract generator specializing in music industry contracts. Generate clear, professional, and legally sound contracts."
        },
        {
          role: "user",
          content: prompt
        }
      ],
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    logger.error('Error generating contract:', error);
    throw new Error('Failed to generate contract. Please try again.');
  }
}

// Add the aiAgentChat function for the Super Agent
export async function aiAgentChat(messages: { role: 'user' | 'assistant'; content: string; }[]): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a music industry expert agent helping artists develop their careers. Provide clear, actionable advice based on the artist's current situation and goals."
        },
        ...messages
      ],
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    logger.error('Error in AI agent chat:', error);
    throw new Error('Failed to get AI response. Please try again.');
  }
}