import { logger } from "../logger";
/**
 * Freepik Storage Service
 * 
 * This service provides dedicated storage functionality for Freepik generated images.
 * It ensures all images are properly saved to Firestore with metadata and provides
 * retrieval functionality.
 */

import { auth, db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, Timestamp, DocumentData } from 'firebase/firestore';
import { ImageResult } from '../types/model-types';

// Nombre de la colección específica para imágenes de Freepik
const FREEPIK_IMAGES_COLLECTION = 'freepik_images';

/**
 * Adapta un objeto ImageResult específicamente para imágenes de Freepik
 * @param image Imagen generada a guardar
 * @returns Objeto preparado para Firestore
 */
function adaptFreepikImageForFirestore(image: ImageResult) {
  return {
    url: image.url,
    provider: image.provider,
    requestId: image.requestId || null,
    taskId: image.taskId || null,
    status: image.status || 'completed',
    prompt: image.prompt,
    createdAt: Timestamp.fromDate(image.createdAt),
    userId: auth.currentUser?.uid || 'anonymous',
    savedAt: Timestamp.now(),
    source: 'freepik'  // Marcador específico para imágenes Freepik
  };
}

/**
 * Convierte un documento de Firestore a ImageResult
 * @param doc Documento de Firestore
 * @returns Instancia de ImageResult
 */
function convertFreepikFirestoreToImage(doc: DocumentData): ImageResult {
  const data = doc.data();
  return {
    url: data.url,
    provider: data.provider || 'freepik',
    requestId: data.requestId,
    taskId: data.taskId,
    status: data.status,
    prompt: data.prompt,
    createdAt: data.createdAt.toDate(),
    firestoreId: doc.id
  };
}

/**
 * Guarda una imagen generada por Freepik en Firestore
 * @param image Imagen a guardar
 * @returns ID del documento creado en Firestore
 */
export async function saveFreepikImage(image: ImageResult): Promise<string> {
  // Si la imagen ya tiene un firestoreId, significa que ya está guardada
  if (image.firestoreId) {
    return image.firestoreId;
  }
  
  try {
    // Guardar en la colección específica para Freepik
    const imagesCollection = collection(db, FREEPIK_IMAGES_COLLECTION);
    const firestoreData = adaptFreepikImageForFirestore(image);
    
    const docRef = await addDoc(imagesCollection, firestoreData);
    logger.info('Freepik image saved to Firestore:', docRef.id);
    return docRef.id;
  } catch (error) {
    logger.error('Error saving Freepik image to Firestore:', error);
    throw error;
  }
}

/**
 * Obtiene todas las imágenes generadas por Freepik para el usuario actual
 * @returns Array de imágenes generadas
 */
export async function getFreepikImages(): Promise<ImageResult[]> {
  try {
    const userId = auth.currentUser?.uid || 'anonymous';
    const imagesCollection = collection(db, FREEPIK_IMAGES_COLLECTION);
    
    // Consulta filtrada por userId
    const q = query(
      imagesCollection, 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const images = querySnapshot.docs.map(convertFreepikFirestoreToImage);
    
    logger.info(`Retrieved ${images.length} Freepik images from Firestore`);
    return images;
  } catch (error) {
    logger.error('Error getting Freepik images from Firestore:', error);
    return [];
  }
}

/**
 * Busca una imagen específica generada por Freepik por su taskId
 * @param taskId ID de la tarea de Freepik
 * @returns La imagen encontrada o null si no existe
 */
export async function findFreepikImageByTaskId(taskId: string): Promise<ImageResult | null> {
  try {
    if (!taskId) return null;
    
    const imagesCollection = collection(db, FREEPIK_IMAGES_COLLECTION);
    
    // Consulta filtrada por taskId
    const q = query(
      imagesCollection, 
      where('taskId', '==', taskId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      logger.info(`No Freepik image found with taskId: ${taskId}`);
      return null;
    }
    
    // Devolver el primer resultado (debería ser único)
    return convertFreepikFirestoreToImage(querySnapshot.docs[0]);
  } catch (error) {
    logger.error(`Error finding Freepik image with taskId ${taskId}:`, error);
    return null;
  }
}

/**
 * Comprueba si una imagen de Freepik está guardada utilizando su URL
 * @param url URL de la imagen a comprobar
 * @returns true si la imagen está guardada, false en caso contrario
 */
export async function isFreepikImageSaved(url: string): Promise<boolean> {
  try {
    if (!url) return false;
    
    const imagesCollection = collection(db, FREEPIK_IMAGES_COLLECTION);
    
    // Consulta filtrada por URL
    const q = query(
      imagesCollection, 
      where('url', '==', url)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    logger.error(`Error checking if Freepik image is saved:`, error);
    return false;
  }
}

// Servicio de almacenamiento para imágenes de Freepik
export const freepikStorageService = {
  saveImage: saveFreepikImage,
  getImages: getFreepikImages,
  findImageByTaskId: findFreepikImageByTaskId,
  isImageSaved: isFreepikImageSaved
};