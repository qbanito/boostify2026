import { db } from './firebase';
import { logger } from "./logger";
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

export interface YouTubeViewsData {
  id?: string;
  videoUrl: string;
  purchasedViews: number;
  currentViews: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  updatedAt: Date;
  apifyRunId: string;
  userId: string;
}

export async function createYouTubeViewsOrder(
  user: User,
  data: Omit<YouTubeViewsData, 'userId' | 'startedAt' | 'updatedAt' | 'currentViews' | 'status'>
): Promise<YouTubeViewsData> {
  if (!user?.uid) {
    throw new Error('Usuario no autenticado');
  }

  const docId = `${user.uid}_${Date.now()}`;
  const orderData: YouTubeViewsData = {
    id: docId,
    ...data,
    userId: user.uid,
    currentViews: 0,
    status: 'pending',
    startedAt: new Date(),
    updatedAt: new Date()
  };

  const orderRef = doc(db, 'youtube_views_orders', docId);
  await setDoc(orderRef, orderData);

  return orderData;
}

export async function updateYouTubeViewsOrder(
  orderId: string,
  updates: Partial<YouTubeViewsData>
): Promise<void> {
  const orderRef = doc(db, 'youtube_views_orders', orderId);
  await updateDoc(orderRef, {
    ...updates,
    updatedAt: new Date()
  });
}

export async function getYouTubeViewsOrders(userId: string): Promise<YouTubeViewsData[]> {
  try {
    const orderRef = doc(db, 'youtube_views_orders', userId);
    const orderDoc = await getDoc(orderRef);

    if (!orderDoc.exists()) {
      return [];
    }

    return [orderDoc.data() as YouTubeViewsData];
  } catch (error) {
    logger.error('Error fetching YouTube views orders:', error);
    throw error;
  }
}

export async function checkApifyRun(runId: string): Promise<any> {
  const response = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${import.meta.env.VITE_APIFY_API_TOKEN}`
  );

  if (!response.ok) {
    throw new Error('Error al verificar el estado del proceso de vistas');
  }

  return response.json();
}