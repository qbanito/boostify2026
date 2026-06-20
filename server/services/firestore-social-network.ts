import { db } from '../firebase';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// Colecciones de Firestore
const USERS_COLLECTION = 'social_users';
const POSTS_COLLECTION = 'social_posts';
const COMMENTS_COLLECTION = 'social_comments';

// Estructura tipada para los documentos
export interface SocialUser {
  id?: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  interests?: string[];
  language: 'en' | 'es';
  isBot: boolean;
  personality?: string;
  savedPosts?: string[]; // Array de IDs de posts guardados
  likedPosts?: string[]; // Array de IDs de posts a los que dio like
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface Post {
  id?: string;
  userId: string;
  content: string;
  likes: number;
  likedBy?: string[]; // Array de IDs de usuarios que dieron like
  savedBy?: string[]; // Array de IDs de usuarios que guardaron el post
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface Comment {
  id?: string;
  userId: string;
  postId: string;
  parentId?: string | null;
  content: string;
  likes: number;
  isReply: boolean;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// Funciones para convertir entre formatos de fecha
const toFirestoreDate = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};

const fromFirestoreDate = (timestamp: Timestamp): Date => {
  return timestamp.toDate();
};

// Función para convertir los datos al formato de Firestore
const toFirestore = <T>(data: T): any => {
  const result: any = {...data};
  
  // Convertir fechas a formato Firestore
  if (result.createdAt && result.createdAt instanceof Date) {
    result.createdAt = toFirestoreDate(result.createdAt);
  }
  
  if (result.updatedAt && result.updatedAt instanceof Date) {
    result.updatedAt = toFirestoreDate(result.updatedAt);
  }
  
  // Eliminar propiedades undefined - Firestore no acepta valores undefined
  for (const key in result) {
    if (result[key] === undefined) {
      if (key === 'personality') {
        result[key] = ''; // Convertir undefined a cadena vacía para personalidad
      } else if (key === 'parentId') {
        result[key] = null; // Convertir undefined a null para parentId
      } else {
        delete result[key]; // Eliminar campos undefined
      }
    }
  }
  
  return result;
};

// Función para convertir documentos de Firestore a nuestro formato
const fromFirestore = <T>(doc: FirebaseFirestore.DocumentSnapshot): T | null => {
  if (!doc.exists) return null;
  
  const data = doc.data();
  if (!data) return null;
  
  // Convertir Timestamps a Date
  const result: any = {
    id: doc.id,
    ...data
  };
  
  if (result.createdAt && result.createdAt instanceof Timestamp) {
    result.createdAt = fromFirestoreDate(result.createdAt);
  }
  
  if (result.updatedAt && result.updatedAt instanceof Timestamp) {
    result.updatedAt = fromFirestoreDate(result.updatedAt);
  }
  
  return result as T;
};

// Clase de servicio para la red social en Firestore
export class FirestoreSocialNetworkService {
  
  // USUARIOS
  
  async getAllUsers(): Promise<SocialUser[]> {
    try {
      const snapshot = await db.collection(USERS_COLLECTION).get();
      return snapshot.docs.map(doc => fromFirestore<SocialUser>(doc) as SocialUser);
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }
  
  async getUserById(id: string): Promise<SocialUser | null> {
    try {
      const doc = await db.collection(USERS_COLLECTION).doc(id).get();
      return fromFirestore<SocialUser>(doc);
    } catch (error) {
      console.error(`Error getting user with ID ${id}:`, error);
      throw error;
    }
  }
  
  async createUser(userData: Omit<SocialUser, 'id'>): Promise<SocialUser> {
    try {
      const data = toFirestore(userData);
      const docRef = await db.collection(USERS_COLLECTION).add(data);
      const doc = await docRef.get();
      return fromFirestore<SocialUser>(doc) as SocialUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async createOrUpdateUserWithId(userId: string, userData: Partial<SocialUser>): Promise<SocialUser> {
    try {
      const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
      const data = toFirestore(userData);

      if (userDoc.exists) {
        // Usuario existe, actualizar
        await db.collection(USERS_COLLECTION).doc(userId).update({
          ...data,
          updatedAt: toFirestoreDate(new Date())
        });
      } else {
        // Usuario no existe, crear
        await db.collection(USERS_COLLECTION).doc(userId).set({
          displayName: userData.displayName || 'User',
          bio: userData.bio || '',
          interests: userData.interests || [],
          language: userData.language || 'en',
          isBot: false,
          savedPosts: [],
          likedPosts: [],
          createdAt: toFirestoreDate(new Date()),
          updatedAt: toFirestoreDate(new Date()),
          ...data
        });
      }

      const updatedDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
      return fromFirestore<SocialUser>(updatedDoc) as SocialUser;
    } catch (error) {
      console.error('Error creating/updating user with ID:', error);
      throw error;
    }
  }

  async updateUser(userId: string, updateData: Partial<SocialUser>): Promise<SocialUser | null> {
    try {
      const data = toFirestore(updateData);
      
      await db.collection(USERS_COLLECTION).doc(userId).update({
        ...data,
        updatedAt: toFirestoreDate(new Date())
      });
      
      const updatedDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
      return fromFirestore<SocialUser>(updatedDoc);
    } catch (error) {
      console.error(`Error updating user with ID ${userId}:`, error);
      throw error;
    }
  }

  async getUserPosts(userId: string): Promise<any[]> {
    try {
      const snapshot = await db.collection(POSTS_COLLECTION)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      const posts = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const post = fromFirestore<Post>(doc) as Post;
          const user = await this.getUserById(post.userId);
          const comments = await this.getCommentsByPostId(post.id!);

          return {
            ...post,
            user,
            comments
          };
        })
      );

      return posts;
    } catch (error) {
      console.error(`Error getting posts for user ${userId}:`, error);
      throw error;
    }
  }
  
  async getBotUsers(): Promise<SocialUser[]> {
    try {
      const snapshot = await db.collection(USERS_COLLECTION)
        .where('isBot', '==', true)
        .get();
      
      return snapshot.docs.map(doc => fromFirestore<SocialUser>(doc) as SocialUser);
    } catch (error) {
      console.error('Error getting bot users:', error);
      throw error;
    }
  }
  
  // POSTS
  
  async getAllPosts(): Promise<Post[]> {
    try {
      const snapshot = await db.collection(POSTS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => fromFirestore<Post>(doc) as Post);
    } catch (error) {
      console.error('Error getting all posts:', error);
      throw error;
    }
  }
  
  async getPostById(id: string): Promise<Post | null> {
    try {
      const doc = await db.collection(POSTS_COLLECTION).doc(id).get();
      return fromFirestore<Post>(doc);
    } catch (error) {
      console.error(`Error getting post with ID ${id}:`, error);
      throw error;
    }
  }
  
  async createPost(postData: Omit<Post, 'id'>): Promise<Post> {
    try {
      const data = toFirestore(postData);
      const docRef = await db.collection(POSTS_COLLECTION).add(data);
      const doc = await docRef.get();
      return fromFirestore<Post>(doc) as Post;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }
  
  async updatePost(id: string, updateData: Partial<Post>): Promise<Post | null> {
    try {
      const data = toFirestore(updateData);
      
      await db.collection(POSTS_COLLECTION).doc(id).update({
        ...data,
        updatedAt: toFirestoreDate(new Date())
      });
      
      const updatedDoc = await db.collection(POSTS_COLLECTION).doc(id).get();
      return fromFirestore<Post>(updatedDoc);
    } catch (error) {
      console.error(`Error updating post with ID ${id}:`, error);
      throw error;
    }
  }
  
  async incrementPostLikes(id: string, userId: string = "1"): Promise<Post | null> {
    try {
      // 1. Obtener el post actual
      const postDoc = await db.collection(POSTS_COLLECTION).doc(id).get();
      const post = fromFirestore<Post>(postDoc);
      
      if (!post) {
        throw new Error(`Post with ID ${id} not found`);
      }
      
      // 2. Verificar si el usuario ya dio like
      const likedBy = post.likedBy || [];
      const alreadyLiked = likedBy.includes(userId);
      
      // Si ya dio like, no hacer nada
      if (alreadyLiked) {
        return post;
      }
      
      // 3. Actualizar el post - incrementar likes y añadir userId
      await db.collection(POSTS_COLLECTION).doc(id).update({
        likes: FieldValue.increment(1),
        likedBy: FieldValue.arrayUnion(userId),
        updatedAt: toFirestoreDate(new Date())
      });
      
      // 4. Actualizar el usuario - añadir el post a sus likedPosts
      await db.collection(USERS_COLLECTION).doc(userId).update({
        likedPosts: FieldValue.arrayUnion(id),
        updatedAt: toFirestoreDate(new Date())
      });
      
      // Obtener el post actualizado
      const updatedDoc = await db.collection(POSTS_COLLECTION).doc(id).get();
      return fromFirestore<Post>(updatedDoc);
    } catch (error) {
      console.error(`Error incrementing likes for post with ID ${id}:`, error);
      throw error;
    }
  }
  
  // Nuevo método para guardar posts
  async savePost(postId: string, userId: string = "1"): Promise<boolean> {
    try {
      // 1. Verificar si el post existe
      const postDoc = await db.collection(POSTS_COLLECTION).doc(postId).get();
      if (!postDoc.exists) {
        throw new Error(`Post with ID ${postId} not found`);
      }
      
      // 2. Actualizar el usuario - añadir el post a sus savedPosts
      await db.collection(USERS_COLLECTION).doc(userId).update({
        savedPosts: FieldValue.arrayUnion(postId),
        updatedAt: toFirestoreDate(new Date())
      });
      
      // 3. Actualizar el post - añadir el usuario a savedBy
      await db.collection(POSTS_COLLECTION).doc(postId).update({
        savedBy: FieldValue.arrayUnion(userId),
        updatedAt: toFirestoreDate(new Date())
      });
      
      return true;
    } catch (error) {
      console.error(`Error saving post with ID ${postId}:`, error);
      throw error;
    }
  }
  
  // Nuevo método para obtener los posts guardados de un usuario
  async getSavedPosts(userId: string): Promise<any[]> {
    try {
      // 1. Obtener el usuario
      const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
      const user = fromFirestore<SocialUser>(userDoc);
      
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }
      
      // 2. Obtener los IDs de los posts guardados
      const savedPostIds = user.savedPosts || [];
      
      if (savedPostIds.length === 0) {
        return [];
      }
      
      // 3. Obtener los posts guardados
      const savedPosts = await Promise.all(
        savedPostIds.map(async (postId) => {
          const post = await this.getPostById(postId);
          if (!post) return null;
          
          // Obtener el usuario que publicó el post
          const postUser = await this.getUserById(post.userId);
          
          // Obtener los comentarios
          const comments = await this.getCommentsByPostId(postId);
          
          // Obtener usuarios para cada comentario
          const commentsWithUsers = await Promise.all(
            comments.map(async (comment) => {
              const commentUser = await this.getUserById(comment.userId);
              return {
                ...comment,
                user: commentUser
              };
            })
          );
          
          return {
            ...post,
            user: postUser,
            comments: commentsWithUsers,
            isLiked: (user.likedPosts || []).includes(postId),
            isSaved: true
          };
        })
      );
      
      // Filtrar los posts nulos (pueden haber sido eliminados)
      return savedPosts.filter(post => post !== null);
    } catch (error) {
      console.error(`Error getting saved posts for user with ID ${userId}:`, error);
      throw error;
    }
  }
  
  async getPostsWithDetails(currentUserId: string = "1"): Promise<any[]> {
    try {
      const posts = await this.getAllPosts();
      
      // Obtener el usuario actual
      const currentUser = await this.getUserById(currentUserId);
      const userLikedPosts = currentUser?.likedPosts || [];
      const userSavedPosts = currentUser?.savedPosts || [];
      
      // Obtener detalles completos para cada post
      const postsWithDetails = await Promise.all(
        posts.map(async (post) => {
          // Obtener el usuario
          const user = await this.getUserById(post.userId);
          
          // Obtener los comentarios
          const comments = await this.getCommentsByPostId(post.id as string);
          
          // Obtener usuarios para cada comentario
          const commentsWithUsers = await Promise.all(
            comments.map(async (comment) => {
              const commentUser = await this.getUserById(comment.userId);
              return {
                ...comment,
                user: commentUser
              };
            })
          );
          
          // Determinar si el usuario dio like o guardó el post (datos reales)
          const isLiked = userLikedPosts.includes(post.id as string);
          const isSaved = userSavedPosts.includes(post.id as string);
          
          return {
            ...post,
            user,
            comments: commentsWithUsers,
            isLiked,
            isSaved
          };
        })
      );
      
      return postsWithDetails;
    } catch (error) {
      console.error('Error getting posts with details:', error);
      throw error;
    }
  }
  
  // COMENTARIOS
  
  async getCommentsByPostId(postId: string): Promise<Comment[]> {
    try {
      // Modificamos la consulta para no requerir un índice compuesto
      // Primero obtenemos todos los comentarios del post sin ordenar
      const snapshot = await db.collection(COMMENTS_COLLECTION)
        .where('postId', '==', postId)
        .get();
      
      // Convertimos los documentos a objetos Comment
      const comments = snapshot.docs.map(doc => fromFirestore<Comment>(doc) as Comment);
      
      // Ordenamos en memoria por fecha de creación (ascendente)
      return comments.sort((a, b) => {
        // Manejo seguro de diferentes tipos de fecha
        let timeA: number;
        let timeB: number;
        
        if (a.createdAt instanceof Date) {
          timeA = a.createdAt.getTime();
        } else if (a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt) {
          // Es un Timestamp de Firestore
          timeA = a.createdAt.toDate().getTime();
        } else {
          // Intenta convertir a Date como último recurso
          timeA = new Date(String(a.createdAt)).getTime();
        }
        
        if (b.createdAt instanceof Date) {
          timeB = b.createdAt.getTime();
        } else if (b.createdAt && typeof b.createdAt === 'object' && 'toDate' in b.createdAt) {
          // Es un Timestamp de Firestore
          timeB = b.createdAt.toDate().getTime();
        } else {
          // Intenta convertir a Date como último recurso
          timeB = new Date(String(b.createdAt)).getTime();
        }
        
        return timeA - timeB;
      });
    } catch (error) {
      console.error(`Error getting comments for post with ID ${postId}:`, error);
      throw error;
    }
  }
  
  async createComment(commentData: Omit<Comment, 'id'>): Promise<Comment> {
    try {
      const data = toFirestore(commentData);
      const docRef = await db.collection(COMMENTS_COLLECTION).add(data);
      const doc = await docRef.get();
      return fromFirestore<Comment>(doc) as Comment;
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  }
  
  async incrementCommentLikes(id: string): Promise<Comment | null> {
    try {
      await db.collection(COMMENTS_COLLECTION).doc(id).update({
        likes: FieldValue.increment(1),
        updatedAt: toFirestoreDate(new Date())
      });
      
      const updatedDoc = await db.collection(COMMENTS_COLLECTION).doc(id).get();
      return fromFirestore<Comment>(updatedDoc);
    } catch (error) {
      console.error(`Error incrementing likes for comment with ID ${id}:`, error);
      throw error;
    }
  }
}

// Exportar una instancia del servicio
export const firestoreSocialNetworkService = new FirestoreSocialNetworkService();