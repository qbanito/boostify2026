import { db } from "../firebase";
import { logger } from "../logger";
import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { env } from "../../env";

export const managerToolsService = {
  async generateWithAI(prompt: string, type: string) {
    try {
      logger.info('📄 Making request to Gemini API with prompt:', prompt);
      
      // Map old types to new Gemini types
      const typeMapping: Record<string, string> = {
        'technical': 'technical-rider',
        'requirements': 'requirements',
        'budget': 'budget',
        'logistics': 'logistics',
        'hiring': 'hiring',
        'calendar': 'calendar',
        'ai': 'ai-assistant'
      };

      const geminiType = typeMapping[type] || 'requirements';

      // Use window.fetch explicitly to call Gemini endpoint
      const response = await window.fetch('/api/manager/documents/generate-text', {
        method: 'POST',
        body: JSON.stringify({
          type: geminiType,
          requirements: prompt,
          metadata: {} // Empty metadata for backward compatibility
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Error response from server:', errorData);
        throw new Error(errorData.error || `Failed to generate content: ${response.status}`);
      }

      const data = await response.json();
      logger.info('✅ Response received from Gemini');
      
      if (!data.content) {
        logger.error('Invalid response format from server');
        throw new Error('Invalid API response format');
      }

      return data.content;

    } catch (error: any) {
      logger.error('Error in generateWithAI:', error);
      if (error.status === 401) {
        throw new Error('Authentication failed. Please check your API key configuration.');
      } else if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(error.message || 'Failed to generate content');
    }
  },

  async previewTechnicalRider(requirements: string) {
    try {
      const prompt = `Generate a preview of a technical rider based on these requirements: ${requirements}. Include sections for sound equipment, lighting requirements, stage setup, and any special requirements.`;

      const content = await this.generateWithAI(prompt, 'technical');
      return content;
    } catch (error) {
      logger.error('Error generating technical rider preview:', error);
      throw error;
    }
  },

  async saveToFirestore(data: ManagerToolData) {
    try {
      // Use the specific collection based on the type
      let collectionName = '';
      switch (data.type) {
        case 'technical':
          collectionName = 'technical_rider';
          break;
        case 'requirements':
          collectionName = 'requirements';
          break;
        case 'budget':
          collectionName = 'budget';
          break;
        case 'logistics':
          collectionName = 'logistics';
          break;
        case 'hiring':
          collectionName = 'hiring';
          break;
        case 'calendar':
          collectionName = 'calendar';
          break;
        case 'ai':
          collectionName = 'ai_tools';
          break;
        default:
          collectionName = 'manager_tools'; // fallback for unspecified types
      }
      
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      logger.error('Error saving to Firestore:', error);
      throw error;
    }
  },

  async getFromFirestore(userId: string, type: string) {
    try {
      // Use the specific collection based on the type
      let collectionName = '';
      switch (type) {
        case 'technical':
          collectionName = 'technical_rider';
          break;
        case 'requirements':
          collectionName = 'requirements';
          break;
        case 'budget':
          collectionName = 'budget';
          break;
        case 'logistics':
          collectionName = 'logistics';
          break;
        case 'hiring':
          collectionName = 'hiring';
          break;
        case 'calendar':
          collectionName = 'calendar';
          break;
        case 'ai':
          collectionName = 'ai_tools';
          break;
        default:
          collectionName = 'manager_tools'; // fallback for unspecified types
      }
      
      const q = query(
        collection(db, collectionName),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Error fetching from Firestore:', error);
      throw error;
    }
  },

  async generateContentByType(type: string, details: string, userId: string) {
    try {
      let prompt = '';
      switch (type) {
        case 'technical':
          prompt = `Generate a detailed technical rider based on these requirements: ${details}. Include sections for sound equipment, lighting requirements, stage setup, and any special requirements.`;
          break;
        case 'requirements':
          prompt = `Create a comprehensive requirements list for this event/artist: ${details}. Include all necessary technical, logistical, and personnel requirements.`;
          break;
        case 'budget':
          prompt = `Create a detailed budget breakdown for this project: ${details}. Include all expected costs, contingencies, and potential revenue streams.`;
          break;
        case 'logistics':
          prompt = `Create a detailed logistics plan for this event/tour: ${details}. Include transportation, accommodation, equipment handling, and timeline.`;
          break;
        case 'hiring':
          prompt = `Create detailed job descriptions and requirements for these positions: ${details}. Include responsibilities, qualifications, and experience needed.`;
          break;
        case 'calendar':
          // Calendar type contains event/project type in the details string
          const parts = details.split(': ');
          const scheduleType = parts[0]; // 'event' or 'project'
          const scheduleDetails = parts.slice(1).join(': ');
          prompt = `Create a ${scheduleType} schedule plan for: ${scheduleDetails}. Include timeline, key milestones, responsibilities, and detailed breakdown of activities. Format the response with clear sections and time-based organization.`;
          break;
        case 'ai':
          prompt = `Provide AI assistant insights and recommendations for: ${details}. Include specific actionable steps, analysis, and expert industry knowledge.`;
          break;
        default:
          prompt = `Provide expert recommendations and insights for: ${details}`;
      }

      const content = await this.generateWithAI(prompt, type);
      return this.saveToFirestore({
        type: type as ManagerToolData['type'],
        content,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: prompt // Save the prompt for reference
      });
    } catch (error) {
      logger.error(`Error generating ${type} content:`, error);
      throw error;
    }
  },

  async deleteDocument(docId: string, type: string) {
    try {
      // Use the specific collection based on the type
      let collectionName = '';
      switch (type) {
        case 'technical':
          collectionName = 'technical_rider';
          break;
        case 'requirements':
          collectionName = 'requirements';
          break;
        case 'budget':
          collectionName = 'budget';
          break;
        case 'logistics':
          collectionName = 'logistics';
          break;
        case 'hiring':
          collectionName = 'hiring';
          break;
        case 'calendar':
          collectionName = 'calendar';
          break;
        case 'ai':
          collectionName = 'ai_tools';
          break;
        default:
          collectionName = 'manager_tools';
      }

      await deleteDoc(doc(db, collectionName, docId));
      logger.info(`Document ${docId} deleted from ${collectionName}`);
    } catch (error) {
      logger.error('Error deleting document:', error);
      throw error;
    }
  },

  async updateDocument(docId: string, type: string, updates: { content?: string }) {
    try {
      // Use the specific collection based on the type
      let collectionName = '';
      switch (type) {
        case 'technical':
          collectionName = 'technical_rider';
          break;
        case 'requirements':
          collectionName = 'requirements';
          break;
        case 'budget':
          collectionName = 'budget';
          break;
        case 'logistics':
          collectionName = 'logistics';
          break;
        case 'hiring':
          collectionName = 'hiring';
          break;
        case 'calendar':
          collectionName = 'calendar';
          break;
        case 'ai':
          collectionName = 'ai_tools';
          break;
        default:
          collectionName = 'manager_tools';
      }

      await updateDoc(doc(db, collectionName, docId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      logger.info(`Document ${docId} updated in ${collectionName}`);
    } catch (error) {
      logger.error('Error updating document:', error);
      throw error;
    }
  }
};

interface ManagerToolData {
  type: 'technical' | 'requirements' | 'budget' | 'logistics' | 'hiring' | 'ai' | 'calendar';
  content: any;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  prompt?: string; // Added prompt field for AI responses
}

export default managerToolsService;