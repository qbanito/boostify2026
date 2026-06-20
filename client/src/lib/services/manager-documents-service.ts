import { logger } from "../logger";
/**
 * Manager Documents Service - Client Side
 * Usa Gemini API desde el backend + Firestore desde el cliente
 */
import { collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

export interface DocumentMetadata {
  artistName: string;
  eventName?: string;
  eventDate?: string;
  venueName?: string;
  venueCity?: string;
  venueCapacity?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface ManagerDocument {
  id: string;
  userId: string;
  type: 'technical-rider' | 'lighting-setup' | 'stage-plot' | 'hospitality' | 'contract' | 'requirements' | 'budget' | 'logistics' | 'hiring' | 'calendar' | 'ai-assistant';
  title: string;
  content: string;
  metadata?: DocumentMetadata;
  images?: {
    url: string;
    prompt: string;
    type: string;
  }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

class ManagerDocumentsService {
  private collectionName = 'managerDocuments';

  /**
   * Genera un documento usando Gemini (texto) y opcionalmente Nano Banana (imágenes)
   */
  async generateDocument(
    userId: string,
    type: 'technical-rider' | 'lighting-setup' | 'stage-plot' | 'hospitality' | 'contract' | 'requirements' | 'budget' | 'logistics' | 'hiring' | 'calendar' | 'ai-assistant',
    requirements: string,
    metadata: DocumentMetadata,
    includeImages: boolean = false
  ): Promise<ManagerDocument> {
    try {
      logger.info('📄 Generando documento con Gemini...');

      // Llamar al backend para generar el texto con Gemini
      const textResponse = await fetch('/api/manager/documents/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, requirements, metadata })
      });

      if (!textResponse.ok) {
        throw new Error('Error generando texto con Gemini');
      }

      const { content } = await textResponse.json();

      // Generar imágenes si se requieren
      let images: { url: string; prompt: string; type: string }[] = [];
      
      if (includeImages) {
        logger.info('🎨 Generando imágenes con Nano Banana...');
        
        const imagePromptsResponse = await fetch('/api/manager/documents/image-prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, requirements })
        });

        if (imagePromptsResponse.ok) {
          const { prompts } = await imagePromptsResponse.json();
          
          for (const promptData of prompts) {
            try {
              const imageResponse = await fetch('/api/gemini-image/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: promptData.prompt })
              });

              if (imageResponse.ok) {
                const imageResult = await imageResponse.json();
                
                if (imageResult.success && imageResult.imageBase64) {
                  images.push({
                    url: `data:image/png;base64,${imageResult.imageBase64}`,
                    prompt: promptData.prompt,
                    type: promptData.type
                  });
                }
              }
            } catch (error) {
              logger.error(`Error generando imagen ${promptData.type}:`, error);
            }
          }
        }
      }

      // Guardar en Firestore (cliente)
      // Nota: No incluir campos undefined en Firestore
      const docData: any = {
        userId,
        type,
        title: this.generateTitle(type, metadata.artistName, metadata.eventName),
        content,
        metadata,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Solo agregar images si hay imágenes generadas
      if (images.length > 0) {
        docData.images = images;
      }

      const docRef = await addDoc(collection(db, this.collectionName), docData);

      return {
        id: docRef.id,
        ...docData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      } as ManagerDocument;
    } catch (error: any) {
      logger.error('Error generando documento:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los documentos de un usuario
   */
  async getDocuments(userId: string, type?: string): Promise<ManagerDocument[]> {
    try {
      // Consulta simple sin orderBy para evitar requisitos de índice compuesto
      let q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId)
      );

      if (type) {
        q = query(
          collection(db, this.collectionName),
          where('userId', '==', userId),
          where('type', '==', type)
        );
      }

      const snapshot = await getDocs(q);
      
      const documents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ManagerDocument[];

      // Ordenar en el cliente por fecha de creación (más reciente primero)
      return documents.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    } catch (error: any) {
      logger.error('Error obteniendo documentos:', error);
      throw error;
    }
  }

  /**
   * Actualiza un documento
   */
  async updateDocument(
    documentId: string,
    updates: Partial<Pick<ManagerDocument, 'title' | 'content'>>
  ): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, documentId);
      
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      logger.error('Error actualizando documento:', error);
      throw error;
    }
  }

  /**
   * Elimina un documento
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, documentId);
      await deleteDoc(docRef);
    } catch (error: any) {
      logger.error('Error eliminando documento:', error);
      throw error;
    }
  }

  /**
   * Regenera las imágenes de un documento
   */
  async regenerateImages(documentId: string, document: ManagerDocument): Promise<void> {
    try {
      logger.info('🎨 Regenerando imágenes...');

      const imagePromptsResponse = await fetch('/api/manager/documents/image-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: document.type, requirements: document.content })
      });

      if (!imagePromptsResponse.ok) {
        throw new Error('Error obteniendo prompts de imágenes');
      }

      const { prompts } = await imagePromptsResponse.json();
      const images: { url: string; prompt: string; type: string }[] = [];

      for (const promptData of prompts) {
        try {
          const imageResponse = await fetch('/api/gemini-image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptData.prompt })
          });

          if (imageResponse.ok) {
            const imageResult = await imageResponse.json();
            
            if (imageResult.success && imageResult.imageBase64) {
              images.push({
                url: `data:image/png;base64,${imageResult.imageBase64}`,
                prompt: promptData.prompt,
                type: promptData.type
              });
            }
          }
        } catch (error) {
          logger.error(`Error generando imagen ${promptData.type}:`, error);
        }
      }

      // Actualizar documento con nuevas imágenes
      const docRef = doc(db, this.collectionName, documentId);
      await updateDoc(docRef, {
        images,
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      logger.error('Error regenerando imágenes:', error);
      throw error;
    }
  }

  /**
   * Genera un título descriptivo
   */
  private generateTitle(type: string, artistName?: string, eventName?: string): string {
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
      'contract': 'Performance Contract',
      'requirements': 'Requirements List',
      'budget': 'Budget Plan',
      'logistics': 'Logistics Plan',
      'hiring': 'Hiring Document',
      'calendar': 'Event Calendar',
      'ai-assistant': 'AI Consultation'
    };

    const typeName = typeNames[type] || 'Document';
    
    if (artistName && eventName) {
      return `${typeName} - ${artistName} - ${eventName}`;
    } else if (artistName) {
      return `${typeName} - ${artistName} - ${date}`;
    } else {
      return `${typeName} - ${date}`;
    }
  }
}

export const managerDocumentsService = new ManagerDocumentsService();
