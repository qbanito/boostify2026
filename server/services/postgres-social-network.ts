import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { db } from "../db";
import { 
  socialUsers, 
  socialPosts, 
  socialComments,
  type InsertSocialUser,
  type SelectSocialUser,
  type InsertSocialPost,
  type SelectSocialPost,
  type InsertSocialComment,
  type SelectSocialComment
} from "../../db/schema";

/**
 * Servicio PostgreSQL para Social Network
 * Reemplaza el servicio de Firestore con PostgreSQL
 */
export class PostgresSocialNetworkService {
  
  // ===================== USUARIOS =====================
  
  /**
   * Obtener todos los usuarios de la red social
   */
  async getAllUsers(): Promise<SelectSocialUser[]> {
    try {
      return await db.select().from(socialUsers);
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }
  
  /**
   * Obtener un usuario por ID
   */
  async getUserById(id: string): Promise<SelectSocialUser | null> {
    try {
      const [user] = await db
        .select()
        .from(socialUsers)
        .where(eq(socialUsers.id, id))
        .limit(1);
      
      return user || null;
    } catch (error) {
      console.error(`Error getting user with ID ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Crear o actualizar usuario (sync)
   */
  async createOrUpdateUserWithId(userId: string, userData: Partial<InsertSocialUser>): Promise<SelectSocialUser> {
    try {
      const existingUser = await this.getUserById(userId);
      
      if (existingUser) {
        // Usuario existe, actualizar
        const [updated] = await db
          .update(socialUsers)
          .set({
            ...userData,
            updatedAt: new Date()
          })
          .where(eq(socialUsers.id, userId))
          .returning();
        
        return updated;
      } else {
        // Usuario no existe, crear
        const [created] = await db
          .insert(socialUsers)
          .values({
            id: userId,
            displayName: userData.displayName || 'User',
            bio: userData.bio || '',
            interests: userData.interests || [],
            language: userData.language || 'en',
            isBot: false,
            avatar: userData.avatar,
            personality: userData.personality,
            savedPosts: [],
            likedPosts: []
          })
          .returning();
        
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw error;
    }
  }
  
  /**
   * Actualizar usuario
   */
  async updateUser(userId: string, updateData: Partial<InsertSocialUser>): Promise<SelectSocialUser | null> {
    try {
      const [updated] = await db
        .update(socialUsers)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(socialUsers.id, userId))
        .returning();
      
      return updated || null;
    } catch (error) {
      console.error(`Error updating user with ID ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Obtener usuarios bot
   */
  async getBotUsers(): Promise<SelectSocialUser[]> {
    try {
      return await db
        .select()
        .from(socialUsers)
        .where(eq(socialUsers.isBot, true));
    } catch (error) {
      console.error('Error getting bot users:', error);
      throw error;
    }
  }
  
  // ===================== POSTS =====================
  
  /**
   * Obtener todos los posts ordenados por fecha
   */
  async getAllPosts(): Promise<SelectSocialPost[]> {
    try {
      return await db
        .select()
        .from(socialPosts)
        .orderBy(desc(socialPosts.createdAt));
    } catch (error) {
      console.error('Error getting all posts:', error);
      throw error;
    }
  }
  
  /**
   * Obtener un post por ID
   */
  async getPostById(id: string): Promise<SelectSocialPost | null> {
    try {
      const [post] = await db
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.id, parseInt(id)))
        .limit(1);
      
      return post || null;
    } catch (error) {
      console.error(`Error getting post with ID ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Crear un nuevo post
   */
  async createPost(postData: InsertSocialPost): Promise<SelectSocialPost> {
    try {
      const [post] = await db
        .insert(socialPosts)
        .values({
          ...postData,
          likes: 0,
          likedBy: [],
          savedBy: []
        })
        .returning();
      
      return post;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }
  
  /**
   * Incrementar likes de un post
   */
  async incrementPostLikes(id: string, userId: string): Promise<SelectSocialPost | null> {
    try {
      const post = await this.getPostById(id);
      if (!post) return null;
      
      // Verificar si el usuario ya dio like
      const likedBy = post.likedBy || [];
      if (likedBy.includes(userId)) {
        return post; // Ya dio like, no hacer nada
      }
      
      // Actualizar post - incrementar likes y añadir userId
      const [updated] = await db
        .update(socialPosts)
        .set({
          likes: sql`${socialPosts.likes} + 1`,
          likedBy: sql`array_append(${socialPosts.likedBy}, ${userId})`,
          updatedAt: new Date()
        })
        .where(eq(socialPosts.id, parseInt(id)))
        .returning();
      
      // Actualizar usuario - añadir post a likedPosts
      await db
        .update(socialUsers)
        .set({
          likedPosts: sql`array_append(${socialUsers.likedPosts}, ${id})`,
          updatedAt: new Date()
        })
        .where(eq(socialUsers.id, userId));
      
      return updated;
    } catch (error) {
      console.error(`Error incrementing post likes for ID ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Guardar un post
   */
  async savePost(id: string, userId: string): Promise<boolean> {
    try {
      const post = await this.getPostById(id);
      if (!post) return false;
      
      // Verificar si el post ya está guardado
      const savedBy = post.savedBy || [];
      if (savedBy.includes(userId)) {
        return true; // Ya está guardado
      }
      
      // Actualizar post - añadir userId a savedBy
      await db
        .update(socialPosts)
        .set({
          savedBy: sql`array_append(${socialPosts.savedBy}, ${userId})`,
          updatedAt: new Date()
        })
        .where(eq(socialPosts.id, parseInt(id)));
      
      // Actualizar usuario - añadir post a savedPosts
      await db
        .update(socialUsers)
        .set({
          savedPosts: sql`array_append(${socialUsers.savedPosts}, ${id})`,
          updatedAt: new Date()
        })
        .where(eq(socialUsers.id, userId));
      
      return true;
    } catch (error) {
      console.error(`Error saving post with ID ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Obtener posts guardados por un usuario
   */
  async getSavedPosts(userId: string): Promise<any[]> {
    try {
      const user = await this.getUserById(userId);
      if (!user || !user.savedPosts || user.savedPosts.length === 0) {
        return [];
      }
      
      // Convertir string IDs a integers
      const postIds = user.savedPosts.map(id => parseInt(id));
      
      const posts = await db
        .select()
        .from(socialPosts)
        .where(inArray(socialPosts.id, postIds))
        .orderBy(desc(socialPosts.createdAt));
      
      // Obtener detalles completos de cada post
      const postsWithDetails = await Promise.all(
        posts.map(async (post) => {
          const user = await this.getUserById(post.userId);
          const comments = await this.getCommentsByPostId(post.id.toString());
          
          return {
            ...post,
            id: post.id.toString(),
            user,
            comments,
            isLiked: (post.likedBy || []).includes(userId),
            isSaved: true
          };
        })
      );
      
      return postsWithDetails;
    } catch (error) {
      console.error(`Error getting saved posts for user ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Obtener posts de un usuario específico
   */
  async getUserPosts(userId: string): Promise<any[]> {
    try {
      const posts = await db
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.userId, userId))
        .orderBy(desc(socialPosts.createdAt));
      
      // Obtener detalles completos de cada post
      const postsWithDetails = await Promise.all(
        posts.map(async (post) => {
          const user = await this.getUserById(post.userId);
          const comments = await this.getCommentsByPostId(post.id.toString());
          
          return {
            ...post,
            id: post.id.toString(),
            user,
            comments,
            isLiked: (post.likedBy || []).includes(userId),
            isSaved: (post.savedBy || []).includes(userId)
          };
        })
      );
      
      return postsWithDetails;
    } catch (error) {
      console.error(`Error getting posts for user ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Obtener todos los posts con detalles (usuario y comentarios)
   */
  async getPostsWithDetails(currentUserId?: string): Promise<any[]> {
    try {
      const posts = await this.getAllPosts();
      
      const postsWithDetails = await Promise.all(
        posts.map(async (post) => {
          const user = await this.getUserById(post.userId);
          const comments = await this.getCommentsByPostId(post.id.toString());
          
          return {
            ...post,
            id: post.id.toString(),
            user,
            comments,
            isLiked: currentUserId ? (post.likedBy || []).includes(currentUserId) : false,
            isSaved: currentUserId ? (post.savedBy || []).includes(currentUserId) : false
          };
        })
      );
      
      return postsWithDetails;
    } catch (error) {
      console.error('Error getting posts with details:', error);
      throw error;
    }
  }
  
  // ===================== COMENTARIOS =====================
  
  /**
   * Obtener comentarios de un post
   */
  async getCommentsByPostId(postId: string): Promise<any[]> {
    try {
      const comments = await db
        .select()
        .from(socialComments)
        .where(eq(socialComments.postId, parseInt(postId)))
        .orderBy(desc(socialComments.createdAt));
      
      // Obtener usuario para cada comentario
      const commentsWithUsers = await Promise.all(
        comments.map(async (comment) => {
          const user = await this.getUserById(comment.userId);
          return {
            ...comment,
            id: comment.id.toString(),
            postId: comment.postId.toString(),
            user
          };
        })
      );
      
      return commentsWithUsers;
    } catch (error) {
      console.error(`Error getting comments for post ${postId}:`, error);
      throw error;
    }
  }
  
  /**
   * Crear un comentario
   */
  async createComment(commentData: InsertSocialComment): Promise<SelectSocialComment> {
    try {
      const [comment] = await db
        .insert(socialComments)
        .values({
          ...commentData,
          likes: 0
        })
        .returning();
      
      return comment;
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  }
}

// Exportar instancia singleton
export const postgresSocialNetworkService = new PostgresSocialNetworkService();
