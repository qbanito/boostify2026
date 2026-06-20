import { db } from "../db";
import { notifications } from "@db/schema";

export interface CreateNotificationParams {
  userId: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

/**
 * Make.com webhook URL para enviar notificaciones
 * Se puede configurar con MAKE_WEBHOOK_URL en variables de entorno
 */
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || 'https://hook.us2.make.com/7s19bhqti18bgr2kkr7129u1ccfrv5km';

/**
 * Envía una notificación al webhook de Make.com
 */
async function sendToMakeWebhook(notification: any) {
  if (!MAKE_WEBHOOK_URL) {
    console.log('⚠️ Make.com webhook no configurado, saltando envío externo');
    return;
  }

  try {
    const payload = {
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
      timestamp: new Date().toISOString(),
      platform: 'Boostify',
    };

    console.log(`🔗 Enviando notificación a Make.com webhook...`);
    
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`✅ Notificación enviada a Make.com exitosamente`);
    } else {
      console.warn(`⚠️ Make.com webhook respondió con status ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error enviando a Make.com webhook:', error);
    // No lanzamos el error para no bloquear la creación de la notificación
  }
}

/**
 * Crea una notificación para un usuario
 * Esta función se puede usar desde cualquier parte del backend cuando ocurra un evento importante
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const [notification] = await db
      .insert(notifications)
      .values([{
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link || null,
        read: false,
        metadata: params.metadata || null,
      }])
      .returning();

    console.log(`✅ Notificación creada para usuario ${params.userId}: ${params.title}`);
    
    // Enviar al webhook de Make.com de forma asíncrona (sin esperar)
    sendToMakeWebhook(notification).catch(err => {
      console.error('Error en envío asíncrono a Make.com:', err);
    });
    
    return notification;
  } catch (error) {
    console.error("❌ Error creando notificación:", error);
    throw error;
  }
}

/**
 * Notificaciones predefinidas para eventos comunes
 */
export const NotificationTemplates = {
  videoRenderComplete: (userId: number, videoTitle: string, videoId: number) => 
    createNotification({
      userId,
      type: "VIDEO_RENDER_DONE",
      title: "¡Tu video está listo! 🎬",
      message: `El video "${videoTitle}" ha sido procesado y está listo para ver.`,
      link: `/videos/${videoId}`,
      metadata: { videoId },
    }),

  newFollower: (userId: number, followerName: string, followerId: number) =>
    createNotification({
      userId,
      type: "NEW_FOLLOWER",
      title: "Nuevo seguidor 👥",
      message: `${followerName} ahora te sigue`,
      link: `/social-network/profile/${followerId}`,
      metadata: { followerId, followerName },
    }),

  paymentReceived: (userId: number, amount: number, description: string) =>
    createNotification({
      userId,
      type: "PAYMENT_SUCCESS",
      title: "Pago recibido 💰",
      message: `Has recibido un pago de $${amount.toFixed(2)} por ${description}`,
      link: "/dashboard/earnings",
      metadata: { amount, description },
    }),

  musicVideoReady: (userId: number, tier: string, projectName: string, projectId: number) =>
    createNotification({
      userId,
      type: "MUSIC_VIDEO_READY",
      title: "¡Tu Music Video está listo! 🎵",
      message: `Tu video de nivel ${tier} para "${projectName}" ha sido generado exitosamente.`,
      link: `/music-videos/${projectId}`,
      metadata: { tier, projectId, projectName },
    }),

  subscriptionCreated: (userId: number, tier: string, nextBillingDate: string) =>
    createNotification({
      userId,
      type: "SUBSCRIPTION_CREATED",
      title: "Suscripción activada ✨",
      message: `Tu suscripción ${tier} está activa. Primer mes GRATIS. Próximo cargo: ${nextBillingDate}`,
      link: "/pricing",
      metadata: { tier, nextBillingDate },
    }),

  newsArticleGenerated: (userId: number, articleTitle: string, articleId: number) =>
    createNotification({
      userId,
      type: "NEWS_GENERATED",
      title: "Nueva noticia generada 📰",
      message: `Se ha creado el artículo: "${articleTitle}"`,
      link: `/artist-profile/${userId}#news`,
      metadata: { articleId, articleTitle },
    }),

  fashionVideoReady: (userId: number, sessionId: number) =>
    createNotification({
      userId,
      type: "FASHION_VIDEO_READY",
      title: "Tu Fashion Video está listo! 👔",
      message: "Tu video de moda ha sido generado con éxito.",
      link: `/fashion-studio/${sessionId}`,
      metadata: { sessionId },
    }),

  crowdfundingGoalReached: (userId: number, campaignName: string, amount: number) =>
    createNotification({
      userId,
      type: "CROWDFUNDING_GOAL",
      title: "¡Meta de crowdfunding alcanzada! 🎯",
      message: `Tu campaña "${campaignName}" ha alcanzado los $${amount.toFixed(2)}`,
      link: "/crowdfunding",
      metadata: { campaignName, amount },
    }),

  contractSigned: (userId: number, contractTitle: string, contractId: number) =>
    createNotification({
      userId,
      type: "CONTRACT_SIGNED",
      title: "Contrato firmado ✍️",
      message: `El contrato "${contractTitle}" ha sido firmado`,
      link: `/contracts/${contractId}`,
      metadata: { contractId, contractTitle },
    }),
};
