import { Router } from "express";
import { db } from "../db";
import { notifications, insertNotificationSchema, users } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { isAuthenticated } from '../middleware/clerk-auth';

const router = Router();

// Helper para obtener el PostgreSQL user ID desde Clerk ID
async function getPostgresUserId(clerkId: string): Promise<number | null> {
  const userRecord = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return userRecord.length > 0 ? userRecord[0].id : null;
}

// GET /api/notifications - Obtener todas las notificaciones del usuario autenticado
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const clerkUserId = req.user?.id;
    
    if (!clerkUserId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const pgUserId = await getPostgresUserId(clerkUserId);
    if (!pgUserId) {
      return res.json([]); // Usuario no tiene perfil en PostgreSQL aún
    }

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, pgUserId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return res.json(userNotifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ error: "Error al obtener notificaciones" });
  }
});

// GET /api/notifications/unread-count - Contar notificaciones no leídas
router.get("/unread-count", isAuthenticated, async (req, res) => {
  try {
    const clerkUserId = req.user?.id;
    
    if (!clerkUserId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const pgUserId = await getPostgresUserId(clerkUserId);
    if (!pgUserId) {
      return res.json({ count: 0 }); // Usuario no tiene perfil en PostgreSQL aún
    }

    const unreadNotifications = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, pgUserId),
        eq(notifications.read, false)
      ));

    return res.json({ count: unreadNotifications.length });
  } catch (error) {
    console.error("Error counting unread notifications:", error);
    return res.status(500).json({ error: "Error al contar notificaciones" });
  }
});

// PATCH /api/notifications/:id/mark-read - Marcar notificación como leída
router.patch("/:id/mark-read", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const notificationId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: "ID de notificación inválido" });
    }

    // Verificar que la notificación pertenece al usuario
    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));

    if (!notification) {
      return res.status(404).json({ error: "Notificación no encontrada" });
    }

    // Marcar como leída
    const [updated] = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, notificationId))
      .returning();

    return res.json(updated);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({ error: "Error al marcar notificación como leída" });
  }
});

// PATCH /api/notifications/mark-all-read - Marcar todas las notificaciones como leídas
router.patch("/mark-all-read", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    await db
      .update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      ));

    return res.json({ success: true, message: "Todas las notificaciones marcadas como leídas" });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return res.status(500).json({ error: "Error al marcar todas las notificaciones como leídas" });
  }
});

// DELETE /api/notifications/:id - Eliminar una notificación
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const notificationId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: "ID de notificación inválido" });
    }

    // Verificar que la notificación pertenece al usuario
    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));

    if (!notification) {
      return res.status(404).json({ error: "Notificación no encontrada" });
    }

    // Eliminar la notificación
    await db
      .delete(notifications)
      .where(eq(notifications.id, notificationId));

    return res.json({ success: true, message: "Notificación eliminada" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({ error: "Error al eliminar notificación" });
  }
});

// POST /api/notifications - Crear una notificación (para pruebas, solo admins o sistema)
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const validation = insertNotificationSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const [newNotification] = await db
      .insert(notifications)
      .values([validation.data])
      .returning();

    return res.status(201).json(newNotification);
  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({ error: "Error al crear notificación" });
  }
});

// POST /api/notifications/test-webhook - Probar envío al webhook de Make.com (solo desarrollo)
router.post("/test-webhook", async (req, res) => {
  try {
    // Solo permitir en desarrollo
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: "Este endpoint solo está disponible en desarrollo" });
    }

    const { NotificationTemplates } = await import('../utils/notifications');
    
    // Crear una notificación de prueba
    const testNotification = await NotificationTemplates.paymentReceived(
      2, // User ID de prueba
      149.99,
      "GOLD Tier Bundle - Prueba Make.com Webhook"
    );

    return res.json({
      success: true,
      message: "Notificación de prueba creada y enviada al webhook de Make.com",
      notification: testNotification,
      webhookUrl: process.env.MAKE_WEBHOOK_URL || 'https://hook.us2.make.com/7s19bhqti18bgr2kkr7129u1ccfrv5km'
    });
  } catch (error) {
    console.error("Error testing webhook:", error);
    return res.status(500).json({ error: "Error al probar webhook" });
  }
});

export default router;
