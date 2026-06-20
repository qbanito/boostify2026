/**
 * Servicio completo para Manager Tools
 * Combina OpenAI (texto) + FAL Nano Banana (imágenes) + Firestore (almacenamiento)
 */
import { generateProfessionalDocument, generateDocumentPreview, DocumentGenerationOptions } from './openai-text-service';
import { generateImageWithNanoBanana } from './fal-service';
import { db } from '../firebase';
import { Timestamp } from 'firebase-admin/firestore';

export interface ManagerDocument {
  id: string;
  userId: string;
  type: 'technical-rider' | 'lighting-setup' | 'stage-plot' | 'hospitality' | 'contract';
  title: string;
  content: string;
  images?: {
    url: string;
    prompt: string;
    type: string;
  }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export class ManagerDocumentsService {
  private collection = 'managerDocuments';

  /**
   * Genera un documento completo con texto (Gemini) e imágenes (Nano Banana)
   */
  async generateDocument(
    userId: string,
    type: DocumentGenerationOptions['type'],
    requirements: string,
    includeImages: boolean = false
  ): Promise<ManagerDocument> {
    try {
      console.log(`📄 Generando documento tipo: ${type} para usuario: ${userId}`);

      // 1. Generar el texto profesional con Gemini
      const textContent = await generateProfessionalDocument({
        type,
        requirements,
        format: 'detailed'
      });

      // 2. Generar imágenes profesionales con Nano Banana (si se requieren)
      const images: { url: string; prompt: string; type: string }[] = [];
      
      if (includeImages) {
        const imagePrompts = this.getImagePromptsForDocumentType(type, requirements);
        
        for (const imagePrompt of imagePrompts) {
          try {
            console.log(`🎨 Generando imagen: ${imagePrompt.type}`);
            const result = await generateImageWithNanoBanana(imagePrompt.prompt);
            
            if (result.success && result.imageUrl) {
              images.push({
                url: result.imageUrl,
                prompt: imagePrompt.prompt,
                type: imagePrompt.type
              });
              console.log(`✅ Imagen generada: ${imagePrompt.type}`);
            }
          } catch (error) {
            console.error(`❌ Error generando imagen ${imagePrompt.type}:`, error);
          }
        }
      }

      // 3. Guardar en Firestore
      const docRef = db.collection(this.collection).doc();
      const document: ManagerDocument = {
        id: docRef.id,
        userId,
        type,
        title: this.generateTitle(type, requirements),
        content: textContent,
        images: images.length > 0 ? images : undefined,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await docRef.set(document);
      console.log(`✅ Documento guardado en Firestore: ${docRef.id}`);

      return document;
    } catch (error: any) {
      console.error('❌ Error generando documento:', error);
      throw new Error(error.message || 'Error generando documento');
    }
  }

  /**
   * Obtiene todos los documentos de un usuario
   */
  async getDocuments(userId: string, type?: string): Promise<ManagerDocument[]> {
    try {
      let query = db.collection(this.collection).where('userId', '==', userId);
      
      if (type) {
        query = query.where('type', '==', type);
      }
      
      const snapshot = await query.orderBy('createdAt', 'desc').get();
      
      return snapshot.docs.map((doc: any) => doc.data() as ManagerDocument);
    } catch (error: any) {
      console.error('Error obteniendo documentos:', error);
      throw error;
    }
  }

  /**
   * Obtiene un documento específico
   */
  async getDocument(documentId: string): Promise<ManagerDocument | null> {
    try {
      const doc = await db.collection(this.collection).doc(documentId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return doc.data() as ManagerDocument;
    } catch (error: any) {
      console.error('Error obteniendo documento:', error);
      throw error;
    }
  }

  /**
   * Actualiza un documento existente
   */
  async updateDocument(
    documentId: string,
    updates: Partial<Pick<ManagerDocument, 'title' | 'content' | 'images'>>
  ): Promise<ManagerDocument> {
    try {
      const docRef = db.collection(this.collection).doc(documentId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        throw new Error('Documento no encontrado');
      }
      
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now()
      };
      
      await docRef.update(updateData);
      
      const updatedDoc = await docRef.get();
      return updatedDoc.data() as ManagerDocument;
    } catch (error: any) {
      console.error('Error actualizando documento:', error);
      throw error;
    }
  }

  /**
   * Elimina un documento
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await db.collection(this.collection).doc(documentId).delete();
      console.log(`🗑️ Documento eliminado: ${documentId}`);
    } catch (error: any) {
      console.error('Error eliminando documento:', error);
      throw error;
    }
  }

  /**
   * Regenera las imágenes de un documento existente
   */
  async regenerateImages(documentId: string): Promise<ManagerDocument> {
    try {
      const doc = await this.getDocument(documentId);
      
      if (!doc) {
        throw new Error('Documento no encontrado');
      }

      const imagePrompts = this.getImagePromptsForDocumentType(doc.type, doc.content);
      const images: { url: string; prompt: string; type: string }[] = [];

      for (const imagePrompt of imagePrompts) {
        try {
          console.log(`🎨 Regenerando imagen: ${imagePrompt.type}`);
          const result = await generateImageWithNanoBanana(imagePrompt.prompt);
          
          if (result.success && result.imageUrl) {
            images.push({
              url: result.imageUrl,
              prompt: imagePrompt.prompt,
              type: imagePrompt.type
            });
          }
        } catch (error) {
          console.error(`Error regenerando imagen ${imagePrompt.type}:`, error);
        }
      }

      return await this.updateDocument(documentId, { images });
    } catch (error: any) {
      console.error('Error regenerando imágenes:', error);
      throw error;
    }
  }

  /**
   * Genera prompts de imágenes según el tipo de documento
   */
  private getImagePromptsForDocumentType(
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

  /**
   * Genera un título descriptivo para el documento
   */
  private generateTitle(type: string, requirements: string): string {
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    
    const typeNames: Record<string, string> = {
      'technical-rider': 'Technical Rider',
      'lighting-setup': 'Lighting Setup',
      'stage-plot': 'Stage Plot',
      'hospitality': 'Hospitality Rider',
      'contract': 'Performance Contract'
    };

    const baseName = typeNames[type] || 'Document';
    
    // Extraer algún detalle del requirements para hacerlo más específico
    const words = requirements.split(' ').slice(0, 5).join(' ');
    const summary = words.length > 30 ? words.substring(0, 30) + '...' : words;
    
    return `${baseName} - ${date}`;
  }
}

export const managerDocumentsService = new ManagerDocumentsService();
