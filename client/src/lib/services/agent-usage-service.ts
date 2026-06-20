// client/src/lib/services/agent-usage-service.ts

import { logger } from "../logger";
import { db, auth } from '../../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  Timestamp,
  DocumentReference 
} from 'firebase/firestore';

/**
 * Servicio para gestionar el uso de agentes y recomendaciones personalizadas
 * Este servicio maneja la persistencia y recuperación de datos de uso de agentes en Firestore
 */
export class AgentUsageService {
  private readonly COLLECTION_NAME = 'agent_usage';
  private readonly MAX_RECENT_AGENTS = 5;
  private readonly MAX_BOOKMARKS = 10;

  /**
   * Registra el uso de un agente para un usuario
   * @param agentId ID del agente utilizado
   * @param userId ID del usuario (o 'anonymous' si no está autenticado)
   */
  async recordAgentUsage(agentId: string, userId: string = 'anonymous'): Promise<void> {
    try {
      // Primero, siempre actualizamos localStorage como medida de respaldo
      try {
        // Obtener agentes recientes del localStorage
        const storedRecentAgents = localStorage.getItem('recentAgents');
        let recentAgents: string[] = storedRecentAgents ? JSON.parse(storedRecentAgents) : [];
        
        // Actualizar la lista de agentes recientes
        if (recentAgents.includes(agentId)) {
          // Mover el agente al inicio si ya existe
          recentAgents = [
            agentId,
            ...recentAgents.filter(id => id !== agentId)
          ];
        } else {
          // Añadir el agente al inicio
          recentAgents = [
            agentId,
            ...recentAgents
          ].slice(0, this.MAX_RECENT_AGENTS);
        }
        
        // Guardar la lista actualizada en localStorage
        localStorage.setItem('recentAgents', JSON.stringify(recentAgents));
        logger.info('Agente registrado en localStorage:', agentId);
      } catch (localError) {
        logger.error('Error al guardar en localStorage:', localError);
      }
      
      // Si el usuario es anónimo, no intentamos acceder a Firestore
      if (userId === 'anonymous') {
        return;
      }
      
      // Referencia al documento del usuario
      const userDocRef = doc(db, this.COLLECTION_NAME, userId);
      
      // Verificar si el documento existe
      const docSnap = await getDoc(userDocRef);
      
      if (docSnap.exists()) {
        // Si el documento existe, actualiza el array de agentes recientes
        // Usando arrayUnion primero elimina cualquier entrada duplicada
        await updateDoc(userDocRef, {
          recentAgents: arrayUnion(agentId),
          lastUpdated: serverTimestamp()
        });
        
        // Ahora necesitamos recuperar el documento actualizado para limitar el array
        const updatedDocSnap = await getDoc(userDocRef);
        const data = updatedDocSnap.data();
        
        if (data && data.recentAgents) {
          // Crear un nuevo array con el agente actual al inicio
          const recentAgents = Array.from(new Set([
            agentId, 
            ...data.recentAgents.filter((id: string) => id !== agentId)
          ])).slice(0, this.MAX_RECENT_AGENTS);
          
          // Actualizar el documento con el array ordenado y limitado
          await updateDoc(userDocRef, {
            recentAgents: recentAgents
          });
        }
      } else {
        // Si el documento no existe, créalo con el agente actual
        await setDoc(userDocRef, {
          userId,
          recentAgents: [agentId],
          bookmarkedAgents: [],
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      }
    } catch (error: any) {
      logger.error('Error al registrar uso de agente:', error);
      
      // Si es un error de permisos, no hacemos nada porque ya guardamos en localStorage
      if (error.code === 'permission-denied') {
        logger.info('Permiso denegado en Firestore, usando solo localStorage');
      }
    }
  }

  /**
   * Obtiene los agentes recientes para un usuario
   * @param userId ID del usuario (o 'anonymous' si no está autenticado)
   * @returns Array con los IDs de los agentes usados recientemente
   */
  async getRecentAgents(userId: string = 'anonymous'): Promise<string[]> {
    // Primero intentar obtener del localStorage
    try {
      const storedRecentAgents = localStorage.getItem('recentAgents');
      if (storedRecentAgents) {
        const parsedRecentAgents = JSON.parse(storedRecentAgents);
        if (Array.isArray(parsedRecentAgents) && parsedRecentAgents.length > 0) {
          logger.info('Agentes recientes obtenidos de localStorage:', parsedRecentAgents);
          return parsedRecentAgents;
        }
      }
    } catch (localError) {
      logger.error('Error al leer localStorage para agentes recientes:', localError);
    }
    
    // Si no es un usuario anónimo, intentar obtener de Firestore
    if (userId !== 'anonymous') {
      try {
        // Referencia al documento del usuario
        const userDocRef = doc(db, this.COLLECTION_NAME, userId);
        
        // Obtener el documento
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const recentAgents = data.recentAgents || [];
          
          // Guardar en localStorage como respaldo
          if (recentAgents.length > 0) {
            try {
              localStorage.setItem('recentAgents', JSON.stringify(recentAgents));
            } catch (localError) {
              logger.error('Error al guardar agentes recientes en localStorage:', localError);
            }
          }
          
          return recentAgents;
        }
      } catch (error: any) {
        logger.error('Error al obtener agentes recientes de Firestore:', error);
        if (error.code === 'permission-denied') {
          logger.info('Permiso denegado en Firestore, usando solo localStorage');
        }
      }
    }
    
    // Si llegamos aquí, no hay datos en ninguna fuente
    return [];
  }

  /**
   * Marca o desmarca un agente como favorito
   * @param agentId ID del agente a marcar/desmarcar
   * @param userId ID del usuario (o 'anonymous' si no está autenticado)
   * @returns true si el agente fue marcado como favorito, false si fue desmarcado
   */
  async toggleBookmark(agentId: string, userId: string = 'anonymous'): Promise<boolean> {
    // Primero obtenemos la lista actual de favoritos (de cualquier fuente disponible)
    let currentBookmarks: string[] = [];
    
    try {
      const storedBookmarks = localStorage.getItem('bookmarkedAgents');
      if (storedBookmarks) {
        const parsedBookmarks = JSON.parse(storedBookmarks);
        if (Array.isArray(parsedBookmarks)) {
          currentBookmarks = parsedBookmarks;
        }
      }
    } catch (localError) {
      logger.error('Error al leer favoritos de localStorage:', localError);
    }
    
    // Verificar si el agente ya está en favoritos
    const isCurrentlyBookmarked = currentBookmarks.includes(agentId);
    
    // Actualizar la lista local
    let updatedBookmarks: string[];
    if (isCurrentlyBookmarked) {
      // Quitar de favoritos
      updatedBookmarks = currentBookmarks.filter(id => id !== agentId);
    } else {
      // Añadir a favoritos
      updatedBookmarks = [agentId, ...currentBookmarks].slice(0, this.MAX_BOOKMARKS);
    }
    
    // Guardar siempre en localStorage primero
    try {
      localStorage.setItem('bookmarkedAgents', JSON.stringify(updatedBookmarks));
      logger.info('Favoritos actualizados en localStorage:', updatedBookmarks);
    } catch (localError) {
      logger.error('Error al guardar favoritos en localStorage:', localError);
    }
    
    // Si es un usuario anónimo, no intentamos Firestore
    if (userId === 'anonymous') {
      return !isCurrentlyBookmarked; // Retornamos true si se añadió, false si se quitó
    }
    
    // Para usuarios autenticados, intentar actualizar en Firestore
    try {
      // Referencia al documento del usuario
      const userDocRef = doc(db, this.COLLECTION_NAME, userId);
      
      // Verificar si el documento existe
      const docSnap = await getDoc(userDocRef);
      
      if (docSnap.exists()) {
        // Actualizar documento existente
        await updateDoc(userDocRef, {
          bookmarkedAgents: updatedBookmarks,
          lastUpdated: serverTimestamp()
        });
      } else {
        // Crear nuevo documento
        await setDoc(userDocRef, {
          userId,
          recentAgents: [],
          bookmarkedAgents: updatedBookmarks,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      }
    } catch (error: any) {
      logger.error('Error al actualizar favoritos en Firestore:', error);
      if (error.code === 'permission-denied') {
        logger.info('Permiso denegado en Firestore, usando solo localStorage');
      }
    }
    
    // Retornamos basado en la acción realizada
    return !isCurrentlyBookmarked; // true si se añadió, false si se quitó
  }

  /**
   * Obtiene los agentes favoritos de un usuario
   * @param userId ID del usuario (o 'anonymous' si no está autenticado)
   * @returns Array con los IDs de los agentes marcados como favoritos
   */
  async getBookmarkedAgents(userId: string = 'anonymous'): Promise<string[]> {
    // Primero intentar obtener del localStorage
    try {
      const storedBookmarks = localStorage.getItem('bookmarkedAgents');
      if (storedBookmarks) {
        const parsedBookmarks = JSON.parse(storedBookmarks);
        if (Array.isArray(parsedBookmarks) && parsedBookmarks.length > 0) {
          logger.info('Favoritos obtenidos de localStorage:', parsedBookmarks);
          return parsedBookmarks;
        }
      }
    } catch (localError) {
      logger.error('Error al leer localStorage para favoritos:', localError);
    }
    
    // Si no es un usuario anónimo, intentar obtener de Firestore
    if (userId !== 'anonymous') {
      try {
        // Referencia al documento del usuario
        const userDocRef = doc(db, this.COLLECTION_NAME, userId);
        
        // Obtener el documento
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const bookmarkedAgents = data.bookmarkedAgents || [];
          
          // Guardar en localStorage como respaldo
          if (bookmarkedAgents.length > 0) {
            try {
              localStorage.setItem('bookmarkedAgents', JSON.stringify(bookmarkedAgents));
            } catch (localError) {
              logger.error('Error al guardar favoritos en localStorage:', localError);
            }
          }
          
          return bookmarkedAgents;
        }
      } catch (error: any) {
        logger.error('Error al obtener favoritos de Firestore:', error);
        if (error.code === 'permission-denied') {
          logger.info('Permiso denegado en Firestore, usando solo localStorage');
        }
      }
    }
    
    // Si llegamos aquí, no hay datos en ninguna fuente
    return [];
  }

  /**
   * Verifica si un agente está marcado como favorito
   * @param agentId ID del agente a verificar
   * @param userId ID del usuario (o 'anonymous' si no está autenticado)
   * @returns true si el agente está marcado como favorito, false en caso contrario
   */
  async isAgentBookmarked(agentId: string, userId: string = 'anonymous'): Promise<boolean> {
    try {
      const bookmarkedAgents = await this.getBookmarkedAgents(userId);
      return bookmarkedAgents.includes(agentId);
    } catch (error) {
      logger.error('Error al verificar si el agente está marcado como favorito:', error);
      return false;
    }
  }

  /**
   * Sincroniza los datos locales con Firestore cuando un usuario inicia sesión
   * @param localData Datos almacenados localmente
   * @param userId ID del usuario que inició sesión
   */
  async syncLocalDataWithFirestore(
    localData: { recentAgents: string[], bookmarkedAgents: string[] },
    userId: string
  ): Promise<void> {
    try {
      // Referencia al documento del usuario
      const userDocRef = doc(db, this.COLLECTION_NAME, userId);
      
      // Verificar si el documento existe
      const docSnap = await getDoc(userDocRef);
      
      if (docSnap.exists()) {
        // Si el documento existe, combinamos los datos
        const firestoreData = docSnap.data();
        
        // Combinamos los arrays eliminando duplicados
        const combinedRecentAgents = Array.from(new Set([
          ...localData.recentAgents, 
          ...(firestoreData.recentAgents || [])
        ])).slice(0, this.MAX_RECENT_AGENTS);
        
        const combinedBookmarkedAgents = Array.from(new Set([
          ...localData.bookmarkedAgents, 
          ...(firestoreData.bookmarkedAgents || [])
        ])).slice(0, this.MAX_BOOKMARKS);
        
        // Actualizamos el documento
        await updateDoc(userDocRef, {
          recentAgents: combinedRecentAgents,
          bookmarkedAgents: combinedBookmarkedAgents,
          lastUpdated: serverTimestamp()
        });
      } else {
        // Si el documento no existe, lo creamos con los datos locales
        await setDoc(userDocRef, {
          userId,
          recentAgents: localData.recentAgents,
          bookmarkedAgents: localData.bookmarkedAgents,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      }
    } catch (error) {
      logger.error('Error al sincronizar datos locales con Firestore:', error);
    }
  }

  /**
   * Obtiene el ID de usuario actual (autenticado o anónimo)
   * @returns ID del usuario o 'anonymous' si no está autenticado
   */
  getCurrentUserId(): string {
    const currentUser = auth.currentUser;
    return currentUser ? currentUser.uid : 'anonymous';
  }
}

// Exportamos una instancia del servicio para su uso global
export const agentUsageService = new AgentUsageService();