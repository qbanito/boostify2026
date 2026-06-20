import { collection, addDoc, getDocs, query, where, orderBy } from "firebase/firestore";
import { logger } from "../logger";
import { db } from "../firebase";

export interface MusicianImage {
  id?: string;
  url: string;
  requestId: string;
  prompt: string;
  createdAt: Date;
  category: string;
}

export async function saveMusicianImage(image: Omit<MusicianImage, "id">) {
  try {
    const docRef = await addDoc(collection(db, "musician_images"), {
      ...image,
      createdAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    logger.error("Error saving musician image:", error);
    throw error;
  }
}

export async function getMusicianImages() {
  try {
    const imagesRef = collection(db, "musician_images");
    const q = query(imagesRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as MusicianImage[];
  } catch (error) {
    logger.error("Error getting musician images:", error);
    throw error;
  }
}
