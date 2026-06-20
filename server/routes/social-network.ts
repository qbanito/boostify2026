import { Router } from "express";
import { db } from "../db";
import { socialUsers, posts as socialPosts, comments } from "../db/social-network-schema";
import { and, eq, desc, asc } from "drizzle-orm";
import { openRouterService } from "../services/openrouter-service";
import { moderateContent } from "./content-moderation";

const router = Router();

/**
 * Obtener todos los usuarios de la red social
 */
router.get("/users", async (req, res) => {
  try {
    const socialUsersList = await db.select().from(socialUsers);
    res.json(socialUsersList);
  } catch (error) {
    console.error("Error getting social users:", error);
    res.status(500).json({ error: "Error getting social users" });
  }
});

/**
 * Sincronizar o crear un usuario de la red social (cuando se autentica)
 */
router.post("/users/sync", async (req, res) => {
  try {
    const { userId, displayName, avatar, bio = "", interests = [], language = "en" } = req.body;

    if (!userId || !displayName) {
      return res.status(400).json({ error: "userId and displayName are required" });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;

    if (isNaN(userIdNum)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    // ── Moderate profile bio text ─────────────────────────────────────────────
    if (bio?.trim()) {
      const modResult = await moderateContent(bio, "profile", userIdNum, userIdNum, displayName);
      if (modResult.flagged) {
        return res.status(451).json({
          error: "Profile bio flagged for review",
          reason: modResult.item?.categories.join(", ") ?? "policy_violation",
          flagId: modResult.item?.id,
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Buscar si el usuario ya existe
    const existingUsers = await db
      .select()
      .from(socialUsers)
      .where(eq(socialUsers.id, userIdNum));

    if (existingUsers.length > 0) {
      // Actualizar usuario existente
      const updated = await db
        .update(socialUsers)
        .set({
          displayName,
          avatar: avatar || existingUsers[0].avatar,
          bio: bio || existingUsers[0].bio,
          interests: interests.length > 0 ? interests : existingUsers[0].interests,
          language: language || existingUsers[0].language,
          updatedAt: new Date(),
        })
        .where(eq(socialUsers.id, userIdNum))
        .returning();

      console.log("✅ User updated:", updated[0].id);
      return res.json(updated[0]);
    }

    // Crear nuevo usuario
    const userData = {
      id: userIdNum,
      displayName,
      avatar: avatar || null,
      bio: bio || null,
      interests: interests.length > 0 ? interests : null,
      language: language || "en",
      isBot: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await db.insert(socialUsers).values(userData as any).returning();
    console.log("✅ User created:", created[0].id);
    res.status(201).json(created[0]);
  } catch (error) {
    console.error("Error syncing social user:", error);
    res.status(500).json({ error: "Error syncing social user", details: String(error) });
  }
});

/**
 * Obtener un usuario específico de la red social
 */
router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [user] = await db
      .select()
      .from(socialUsers)
      .where(eq(socialUsers.id, parseInt(id)));
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(user);
  } catch (error) {
    console.error("Error getting social user:", error);
    res.status(500).json({ error: "Error getting social user" });
  }
});

/**
 * Obtener todos los posts con sus usuarios y comentarios
 */
router.get("/posts", async (req, res) => {
  try {
    // Buscar todos los posts ordenados por fecha de creación (más recientes primero)
    const postsData = await db
      .select()
      .from(socialPosts)
      .orderBy(desc(socialPosts.createdAt));
    
    // Recolectar todos los posts con usuarios y comentarios
    const postsWithDetails = await Promise.all(
      postsData.map(async (post) => {
        // Obtener el usuario que creó el post
        const [postUser] = await db
          .select()
          .from(socialUsers)
          .where(eq(socialUsers.id, post.userId));
        
        // Obtener los comentarios para este post
        const postComments = await db
          .select()
          .from(comments)
          .where(eq(comments.postId, post.id))
          .orderBy(asc(comments.createdAt));
        
        // Recolectar información detallada para cada comentario
        const commentsWithUsers = await Promise.all(
          postComments.map(async (comment) => {
            // Obtener el usuario que hizo el comentario
            const [commentUser] = await db
              .select()
              .from(socialUsers)
              .where(eq(socialUsers.id, comment.userId));
            
            return {
              ...comment,
              user: commentUser
            };
          })
        );
        
        // Determinar si el usuario actual dio like al post
        // Nota: aquí implementaríamos la lógica para determinar si el usuario ha dado like
        // Por ahora simplemente es aleatorio
        const isLiked = Math.random() > 0.5;
        
        return {
          ...post,
          user: postUser,
          comments: commentsWithUsers,
          isLiked
        };
      })
    );
    
    res.json(postsWithDetails);
  } catch (error) {
    console.error("Error getting posts:", error);
    res.status(500).json({ error: "Error getting posts" });
  }
});

/**
 * Obtener posts de un artista específico
 */
router.get("/posts/artist/:artistId", async (req, res) => {
  try {
    const { artistId } = req.params;
    const artistIdNum = parseInt(artistId);

    if (isNaN(artistIdNum)) {
      return res.status(400).json({ error: "Invalid artist ID" });
    }

    // Buscar todos los posts del artista ordenados por fecha de creación (más recientes primero)
    const postsData = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.userId, artistIdNum))
      .orderBy(desc(socialPosts.createdAt));
    
    // Recolectar todos los posts con usuarios y comentarios
    const postsWithDetails = await Promise.all(
      postsData.map(async (post) => {
        // Obtener el usuario que creó el post
        const [postUser] = await db
          .select()
          .from(socialUsers)
          .where(eq(socialUsers.id, post.userId));
        
        // Obtener los comentarios para este post
        const postComments = await db
          .select()
          .from(comments)
          .where(eq(comments.postId, post.id))
          .orderBy(asc(comments.createdAt));
        
        // Recolectar información detallada para cada comentario
        const commentsWithUsers = await Promise.all(
          postComments.map(async (comment) => {
            // Obtener el usuario que hizo el comentario
            const [commentUser] = await db
              .select()
              .from(socialUsers)
              .where(eq(socialUsers.id, comment.userId));
            
            return {
              ...comment,
              user: commentUser
            };
          })
        );
        
        const isLiked = Math.random() > 0.5;
        
        return {
          ...post,
          user: postUser,
          comments: commentsWithUsers,
          isLiked
        };
      })
    );
    
    res.json(postsWithDetails);
  } catch (error) {
    console.error("Error getting artist posts:", error);
    res.status(500).json({ error: "Error getting artist posts" });
  }
});

/**
 * Crear un nuevo post
 */
router.post("/posts", async (req, res) => {
  try {
    const { content, userId: bodyUserId } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }
    
    // Obtener el usuario ID del body o query
    const userIdParam = bodyUserId || req.query.userId;
    if (!userIdParam) {
      return res.status(400).json({ error: "userId is required" });
    }
    
    const userId = typeof userIdParam === 'string' ? parseInt(userIdParam) : userIdParam;
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }
    
    // Verificar que el usuario existe
    const [existingUser] = await db
      .select()
      .from(socialUsers)
      .where(eq(socialUsers.id, userId));
    
    if (!existingUser) {
      console.log(`User with ID ${userId} not found in socialUsers table`);
      return res.status(404).json({ error: "User not found" });
    }
    
    // Crear el post
    const { mediaType, mediaData, whatsappUrl } = req.body;
    
    const postData = {
      userId,
      content,
      mediaType: mediaType || null,
      mediaData: mediaData || null,
      whatsappUrl: whatsappUrl || null,
      likes: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // ── Content moderation check ──────────────────────────────────────
    const modResult = await moderateContent(
      content,
      "post",
      "new",
      userId,
      existingUser?.displayName,
    );
    if (modResult.flagged) {
      return res.status(451).json({
        error: "Content flagged for review",
        reason: modResult.item?.categories.join(", ") ?? "policy_violation",
        flagId: modResult.item?.id,
      });
    }
    // ─────────────────────────────────────────────────────────────────

    const [newPost] = await db.insert(socialPosts).values(postData as any).returning();
    
    // Obtener el usuario para incluirlo en la respuesta
    const [user] = await db
      .select()
      .from(socialUsers)
      .where(eq(socialUsers.id, newPost.userId));
    
    // Generar respuestas automatizadas de usuarios bot
    await generateBotResponses(newPost);
    
    console.log("✅ Post created successfully:", newPost.id);
    
    res.status(201).json({
      ...newPost,
      user,
      comments: []
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Error creating post", details: String(error) });
  }
});

/**
 * Dar like a un post
 */
router.post("/posts/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener el post actual
    const [post] = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.id, parseInt(id)));
    
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    // Incrementar los likes
    // Nota: En un sistema real, verificaríamos si el usuario ya dio like
    const likes = (post.likes || 0) + 1;
    
    // Actualizar el post
    const [updatedPost] = await db
      .update(socialPosts)
      .set({ likes })
      .where(eq(socialPosts.id, parseInt(id)))
      .returning();
    
    res.json(updatedPost);
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ error: "Error liking post" });
  }
});

/**
 * Crear un comentario en un post
 */
router.post("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { content, isReply = false, parentId = null } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }
    
    // Verificar si el post existe
    const [post] = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.id, parseInt(id)));
    
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    // Obtener el usuario actual
    // Nota: En un sistema real, obtendríamos el usuario de la sesión
    const userId = req.query.userId || req.body.userId || 1; // Default to user ID 1
    
    // Crear el comentario
    const commentData = {
      postId: parseInt(id),
      userId: typeof userId === 'string' ? parseInt(userId) : userId,
      content,
      likes: 0,
      isReply,
      parentId: parentId ? parseInt(parentId) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // ── Content moderation check ──────────────────────────────────────
    const modResult = await moderateContent(
      content,
      "comment",
      `${id}`,
      typeof userId === "string" ? parseInt(userId) : userId,
    );
    if (modResult.flagged) {
      return res.status(451).json({
        error: "Content flagged for review",
        reason: modResult.item?.categories.join(", ") ?? "policy_violation",
        flagId: modResult.item?.id,
      });
    }
    // ─────────────────────────────────────────────────────────────────

    const [newComment] = await db.insert(comments).values(commentData as any).returning();
    
    // Obtener el usuario para incluirlo en la respuesta
    const [user] = await db
      .select()
      .from(socialUsers)
      .where(eq(socialUsers.id, newComment.userId));
    
    // Generar respuestas automatizadas de usuarios bot a este comentario
    await generateBotReplies(post, newComment);
    
    res.status(201).json({
      ...newComment,
      user
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Error creating comment" });
  }
});

/**
 * Función para generar respuestas de bots (usuarios IA) a un post
 * @param post El post al que responder
 */
async function generateBotResponses(post: any) {
  try {
    // Obtener todos los usuarios bot
    const botUsers = await db
      .select()
      .from(socialUsers)
      .where(eq(socialUsers.isBot, true));
    
    // Eligir aleatoriamente 1-2 bots para responder
    const numResponders = Math.floor(Math.random() * 2) + 1;
    const responders = botUsers
      .sort(() => Math.random() - 0.5)
      .slice(0, numResponders);
    
    // Para cada bot, generar una respuesta
    for (const bot of responders) {
      // Generar un tiempo de respuesta aleatorio (entre 0.5 y 4 segundos)
      const replyDelay = Math.floor(Math.random() * 3500) + 500;
      
      // Esperar un tiempo aleatorio antes de responder (simulación de tiempo real)
      await new Promise(resolve => setTimeout(resolve, replyDelay));
      
      // Personalidad del bot e intereses
      const personality = bot.personality || 'friendly and engaging';
      const interests = bot.interests || ['music', 'social media'];
      
      // Generar el prompt para OpenRouter
      const prompt = `You are a social media user with the following personality: ${personality}. 
        You're interested in: ${interests.join(', ')}.
        Please write a short, conversational comment in ${bot.language === 'es' ? 'Spanish' : 'English'} 
        (max 2 sentences) responding to this social media post: "${post.content}"`;
      
      // Obtener respuesta de OpenRouter
      const botResponse = await openRouterService.generateResponse(
        prompt, 
        undefined, 
        bot.language || 'en'
      );
      
      // Crear el comentario
      const botCommentData = {
        postId: post.id,
        userId: bot.id,
        content: botResponse,
        likes: Math.floor(Math.random() * 3), // 0-2 likes aleatorios
        isReply: false,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(comments).values(botCommentData as any);
    }
  } catch (error) {
    console.error("Error generating bot responses:", error);
  }
}

/**
 * Función para generar respuestas de bots a un comentario
 * @param post El post original
 * @param comment El comentario al que responder
 */
async function generateBotReplies(post: any, comment: any) {
  try {
    // Verificar si el usuario del post es un bot (solo los bots responden a comentarios)
    const [postUser] = await db
      .select()
      .from(socialUsers)
      .where(eq(socialUsers.id, post.userId));
    
    // Si el autor del post no es un bot O con una probabilidad del 70%, no responder
    if (!postUser?.isBot || Math.random() > 0.3) {
      return;
    }
    
    // Generar un tiempo de respuesta aleatorio (entre 1 y 8 segundos)
    const replyDelay = Math.floor(Math.random() * 7000) + 1000;
    
    // Esperar un tiempo aleatorio antes de responder (simulación de tiempo real)
    await new Promise(resolve => setTimeout(resolve, replyDelay));
    
    // Obtener el usuario que hizo el comentario
    const [commentUser] = await db
      .select()
      .from(socialUsers)
      .where(eq(socialUsers.id, comment.userId));
    
    // Personalidad del bot e intereses
    const personality = postUser.personality || 'friendly and engaging';
    const interests = postUser.interests || ['music', 'social media'];
    
    // Generar el prompt para OpenRouter
    const prompt = `You are a social media user with the following personality: ${personality}. 
      You're interested in: ${interests.join(', ')}.
      You made a post saying: "${post.content}"
      Someone commented: "${comment.content}"
      Please write a brief reply in ${postUser.language === 'es' ? 'Spanish' : 'English'} (1-2 sentences) to this comment.`;
    
    // Obtener respuesta de OpenRouter
    const botResponse = await openRouterService.generateResponse(
      prompt, 
      undefined, 
      postUser.language || 'en'
    );
    
    // Crear la respuesta
    const botReplyData = {
      postId: post.id,
      userId: postUser.id,
      content: botResponse,
      likes: Math.floor(Math.random() * 2), // 0-1 likes aleatorios
      isReply: true,
      parentId: comment.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.insert(comments).values(botReplyData as any);
  } catch (error) {
    console.error("Error generating bot replies:", error);
  }
}

export default router;
/**
 * Actualizar/Editar un post
 */
router.patch("/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { content, userId } = req.body;

    if (!content || !userId) {
      return res.status(400).json({ error: "Content and userId are required" });
    }

    // Verificar que el post existe y pertenece al usuario
    const [post] = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.id, parseInt(id)));

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: "You can only edit your own posts" });
    }

    // Actualizar el post
    const [updatedPost] = await db
      .update(socialPosts)
      .set({
        content,
        updatedAt: new Date()
      })
      .where(eq(socialPosts.id, parseInt(id)))
      .returning();

    console.log("✅ Post updated:", updatedPost.id);
    res.json(updatedPost);
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ error: "Error updating post" });
  }
});

/**
 * Borrar un post
 */
router.delete("/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Verificar que el post existe y pertenece al usuario
    const [post] = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.id, parseInt(id)));

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: "You can only delete your own posts" });
    }

    // Borrar el post (los comentarios se borrarán en cascada)
    await db
      .delete(socialPosts)
      .where(eq(socialPosts.id, parseInt(id)));

    console.log("✅ Post deleted:", id);
    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Error deleting post" });
  }
});

/**
 * Crear desafío/reto musical
 */
router.post("/challenges", async (req, res) => {
  try {
    const { creatorId, title, description, hashtag, content, mediaType, mediaData, endDate } = req.body;

    if (!creatorId || !title || !hashtag) {
      return res.status(400).json({ error: "creatorId, title, and hashtag are required" });
    }

    const newChallenge = {
      creatorId,
      title,
      description: description || null,
      hashtag,
      content: content || null,
      mediaType: mediaType || null,
      mediaData: mediaData || null,
      endDate: endDate ? new Date(endDate) : null,
      createdAt: new Date(),
    };

    console.log("✅ Challenge created:", title);
    res.status(201).json(newChallenge);
  } catch (error) {
    console.error("Error creating challenge:", error);
    res.status(500).json({ error: "Error creating challenge" });
  }
});

/**
 * Obtener todos los desafíos
 */
router.get("/challenges", async (req, res) => {
  try {
    const challenges = [];
    res.json(challenges);
  } catch (error) {
    console.error("Error getting challenges:", error);
    res.status(500).json({ error: "Error getting challenges" });
  }
});

/**
 * Agregar badge a usuario
 */
router.post("/users/:id/badge", async (req, res) => {
  try {
    const { id } = req.params;
    const { badgeType, reason } = req.body;

    if (!badgeType) {
      return res.status(400).json({ error: "badgeType is required" });
    }

    const newBadge = {
      userId: parseInt(id),
      badgeType,
      reason: reason || null,
      createdAt: new Date(),
    };

    console.log("✅ Badge added to user", id);
    res.status(201).json(newBadge);
  } catch (error) {
    console.error("Error adding badge:", error);
    res.status(500).json({ error: "Error adding badge" });
  }
});

/**
 * Obtener badges de usuario
 */
router.get("/users/:id/badges", async (req, res) => {
  try {
    const { id } = req.params;
    const badges = [];
    res.json(badges);
  } catch (error) {
    console.error("Error getting user badges:", error);
    res.status(500).json({ error: "Error getting user badges" });
  }
});

/**
 * Búsqueda avanzada de artistas
 */
router.get("/users/search", async (req, res) => {
  try {
    const { genre, location, keyword } = req.query;
    const users = [];
    res.json(users);
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ error: "Error searching users" });
  }
});

/**
 * Obtener sugerencias de colaboración
 */
router.get("/users/:id/collaboration-suggestions", async (req, res) => {
  try {
    const { id } = req.params;
    const suggestions = [];
    res.json(suggestions);
  } catch (error) {
    console.error("Error getting collaboration suggestions:", error);
    res.status(500).json({ error: "Error getting collaboration suggestions" });
  }
});
