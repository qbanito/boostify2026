/**
 * Utilidades para trabajar con Firestore de manera consistente
 */
import { db } from '../firebase';
import { 
  Firestore, DocumentData, CollectionReference, Query
} from 'firebase-admin/firestore';

/**
 * Obtiene una referencia a una colección de Firestore
 * @param collectionName Nombre de la colección
 * @returns Referencia a la colección
 */
export function getCollection(collectionName: string): CollectionReference<DocumentData> {
  return db.collection(collectionName);
}

/**
 * Obtiene una referencia a un documento de Firestore
 * @param collectionName Nombre de la colección
 * @param docId ID del documento
 * @returns Referencia al documento
 */
export function getDocRef(collectionName: string, docId: string) {
  return db.collection(collectionName).doc(docId);
}

/**
 * Obtiene un documento por su ID
 * @param collectionName Nombre de la colección
 * @param docId ID del documento
 * @returns Datos del documento o null si no existe
 */
export async function getDocById(collectionName: string, docId: string) {
  const docRef = getDocRef(collectionName, docId);
  const doc = await docRef.get();
  return doc.exists ? doc.data() : null;
}

/**
 * Guarda un documento en Firestore
 * @param collectionName Nombre de la colección
 * @param docId ID del documento
 * @param data Datos a guardar
 */
export async function setDocument(collectionName: string, docId: string, data: any) {
  const docRef = getDocRef(collectionName, docId);
  await docRef.set(data);
}

/**
 * Actualiza un documento existente en Firestore
 * @param collectionName Nombre de la colección
 * @param docId ID del documento
 * @param data Datos a actualizar
 */
export async function updateDocument(collectionName: string, docId: string, data: any) {
  const docRef = getDocRef(collectionName, docId);
  await docRef.update(data);
}

/**
 * Consulta documentos en Firestore
 * @param collectionName Nombre de la colección
 * @param fieldPath Campo por el que filtrar
 * @param opStr Operador de comparación ('==', '<', '>', '<=', '>=', '!=', 'array-contains', 'array-contains-any', 'in', 'not-in')
 * @param value Valor para comparar
 * @returns Documentos que coinciden con la consulta
 */
export async function queryDocuments(collectionName: string, fieldPath: string, opStr: string, value: any) {
  const collectionRef = getCollection(collectionName);
  const q = collectionRef.where(fieldPath, opStr as any, value);
  const snapshot = await q.get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Busca un usuario por su Stripe Customer ID
 * @param stripeCustomerId ID de cliente en Stripe
 * @returns Documento del usuario o null si no se encuentra
 */
export async function findUserByStripeCustomerId(stripeCustomerId: string) {
  const usersRef = getCollection('users');
  const q = usersRef.where('stripeCustomerId', '==', stripeCustomerId);
  const snapshot = await q.get();
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  };
}