import { Router } from "express";
import { postgresSocialNetworkService } from "../services/postgres-social-network";
import { openRouterService } from "../services/openrouter-service";

const router = Router();

// Usar el servicio PostgreSQL en lugar de Firestore
const socialService = postgresSocialNetworkService;

/**
 * Obtener todos los usuarios de la red social
 */
router.get("/users", async (req, res) => {
  try {
    const users = await socialService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error getting social users:", error);
    res.status(500).json({ error: "Error getting social users" });
  }
});

/**
 * Obtener un usuario específico de la red social
 */
router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await socialService.getUserById(id);
    
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
 * Sincronizar o crear perfil de usuario en Firestore
 */
router.post("/users/sync", async (req, res) => {
  try {
    const { userId, displayName, avatar, bio, interests, language } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    
    const userData = {
      displayName: displayName || 'User',
      avatar,
      bio,
      interests,
      language: language || 'en'
    };
    
    const user = await socialService.createOrUpdateUserWithId(userId, userData);
    res.json(user);
  } catch (error) {
    console.error("Error syncing user:", error);
    res.status(500).json({ error: "Error syncing user" });
  }
});

/**
 * Actualizar perfil de usuario
 */
router.patch("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const updatedUser = await socialService.updateUser(id, updateData);
    
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Error updating user" });
  }
});

/**
 * Obtener posts de un usuario específico
 */
router.get("/users/:id/posts", async (req, res) => {
  try {
    const { id } = req.params;
    const posts = await socialService.getUserPosts(id);
    res.json(posts);
  } catch (error) {
    console.error("Error getting user posts:", error);
    res.status(500).json({ error: "Error getting user posts" });
  }
});

/**
 * Obtener todos los posts con sus usuarios y comentarios
 */
router.get("/posts", async (req, res) => {
  try {
    const postsWithDetails = await socialService.getPostsWithDetails();
    res.json(postsWithDetails);
  } catch (error) {
    console.error("Error getting posts:", error);
    res.status(500).json({ error: "Error getting posts" });
  }
});

/**
 * Crear un nuevo post
 */
router.post("/posts", async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }
    
    // Obtener el usuario actual
    // Nota: En un sistema real, obtendríamos el usuario de la sesión
    const userId = req.query.userId || req.body.userId || "1"; // Default to user ID 1
    
    // Crear el post
    const postData = {
      userId: userId as string,
      content,
      likes: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const newPost = await socialService.createPost(postData);
    
    // Obtener el usuario para incluirlo en la respuesta
    const user = await socialService.getUserById(newPost.userId);
    
    // Generar respuestas automatizadas de usuarios bot
    await generateBotResponses(newPost);
    
    res.status(201).json({
      ...newPost,
      user,
      comments: []
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Error creating post" });
  }
});

/**
 * Dar like a un post
 */
router.post("/posts/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    // Obtener el usuario actual
    // Nota: En un sistema real, obtendríamos el usuario de la sesión
    const userId = req.query.userId || req.body.userId || "1"; // Default to user ID 1
    
    const updatedPost = await socialService.incrementPostLikes(id, userId as string);
    
    if (!updatedPost) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    res.json(updatedPost);
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ error: "Error liking post" });
  }
});

/**
 * Guardar un post para ver más tarde
 */
router.post("/posts/:id/save", async (req, res) => {
  try {
    const { id } = req.params;
    // Obtener el usuario actual
    const userId = req.query.userId || req.body.userId || "1"; // Default to user ID 1
    
    const success = await socialService.savePost(id, userId as string);
    
    if (!success) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    res.json({ success: true, message: "Post saved successfully" });
  } catch (error) {
    console.error("Error saving post:", error);
    res.status(500).json({ error: "Error saving post" });
  }
});

/**
 * Obtener los posts guardados por el usuario
 */
router.get("/user/saved-posts", async (req, res) => {
  try {
    // Obtener el usuario actual
    const userId = req.query.userId || "1"; // Default to user ID 1
    
    const savedPosts = await socialService.getSavedPosts(userId as string);
    
    res.json(savedPosts);
  } catch (error) {
    console.error("Error getting saved posts:", error);
    res.status(500).json({ error: "Error getting saved posts" });
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
    const post = await socialService.getPostById(id);
    
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    // Obtener el usuario actual
    // Nota: En un sistema real, obtendríamos el usuario de la sesión
    const userId = req.query.userId || req.body.userId || "1"; // Default to user ID 1
    
    // Crear el comentario
    const commentData = {
      postId: parseInt(id),
      userId: userId as string,
      content,
      isReply,
      parentId: parentId ? parseInt(parentId as string) : null
    };
    
    const newComment = await socialService.createComment(commentData);
    
    // Obtener el usuario para incluirlo en la respuesta
    const user = await socialService.getUserById(newComment.userId);
    
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
    const botUsers = await socialService.getBotUsers();
    
    // Elegir aleatoriamente 1-2 bots para responder
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
        postId: typeof post.id === 'string' ? parseInt(post.id) : post.id,
        userId: bot.id as string,
        content: botResponse,
        isReply: false,
        parentId: null
      };
      
      await socialService.createComment(botCommentData);
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
    const postUser = await socialService.getUserById(post.userId);
    
    // Si el autor del post no es un bot O con una probabilidad del 70%, no responder
    if (!postUser?.isBot || Math.random() > 0.3) {
      return;
    }
    
    // Generar un tiempo de respuesta aleatorio (entre 1 y 8 segundos)
    const replyDelay = Math.floor(Math.random() * 7000) + 1000;
    
    // Esperar un tiempo aleatorio antes de responder (simulación de tiempo real)
    await new Promise(resolve => setTimeout(resolve, replyDelay));
    
    // Obtener el usuario que hizo el comentario
    const commentUser = await socialService.getUserById(comment.userId);
    
    // Personalidad del bot e intereses
    const personality = postUser.personality || 'friendly and engaging';
    const interests = postUser.interests || ['music', 'social media'];
    
    // Generar el prompt para OpenRouter
    const prompt = `You are a social media user with the following personality: ${personality}. 
      You're interested in: ${interests.join(', ')}.
      You made a post saying: "${post.content}"
      Someone commented: "${comment.content}"
      Please respond to their comment with a brief, ${postUser.language === 'es' ? 'Spanish' : 'English'} reply (maximum 2 sentences).`;
    
    const botResponse = await openRouterService.generateResponse(
      prompt, 
      undefined, 
      postUser.language || 'en'
    );
    
    // Crear la respuesta
    const replyData = {
      userId: postUser.id as string,
      postId: typeof post.id === 'string' ? parseInt(post.id) : post.id,
      parentId: typeof comment.id === 'string' ? parseInt(comment.id) : comment.id,
      content: botResponse,
      isReply: true
    };
    
    await socialService.createComment(replyData);
  } catch (error) {
    console.error("Error generating bot replies:", error);
  }
}

export default router;