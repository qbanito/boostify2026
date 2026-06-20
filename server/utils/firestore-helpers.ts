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

/**
 * Paginated, bounded collection read using cursor pagination.
 *
 * ALWAYS prefer this over `collection.get()` for list endpoints: a bare `.get()`
 * scans (and bills) the entire collection and grows unbounded as data grows.
 * This caps each page and returns an opaque cursor (the last doc id) for the
 * next page.
 *
 * @param collectionName Collection to read.
 * @param opts.orderField Field to order by (must have an index for composite filters). Default 'createdAt'.
 * @param opts.direction  'asc' | 'desc'. Default 'desc'.
 * @param opts.pageSize   Max docs per page (hard-capped at 200). Default 25.
 * @param opts.cursor     Last doc id from the previous page (start after it).
 * @param opts.where      Optional equality filters [field, value][] applied with '=='.
 */
export async function paginateCollection<T = any>(
  collectionName: string,
  opts: {
    orderField?: string;
    direction?: 'asc' | 'desc';
    pageSize?: number;
    cursor?: string | null;
    where?: [string, any][];
  } = {},
): Promise<{ items: (T & { id: string })[]; nextCursor: string | null }> {
  const orderField = opts.orderField || 'createdAt';
  const direction = opts.direction || 'desc';
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 200);

  let q: Query<DocumentData> = getCollection(collectionName);
  for (const [field, value] of opts.where || []) {
    q = q.where(field, '==', value);
  }
  q = q.orderBy(orderField, direction).limit(pageSize);

  if (opts.cursor) {
    const cursorDoc = await getDocRef(collectionName, opts.cursor).get();
    if (cursorDoc.exists) q = q.startAfter(cursorDoc);
  }

  const snapshot = await q.get();
  const items = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as T) }));
  const nextCursor = snapshot.size === pageSize ? snapshot.docs[snapshot.size - 1].id : null;
  return { items, nextCursor };
}