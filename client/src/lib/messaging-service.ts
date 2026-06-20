import { db, auth } from "./firebase";
import { logger } from "./logger";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";

export interface Message {
  id: string;
  content: string;
  senderId: string;
  recipientId: string;
  conversationId: string;
  createdAt: Date;
  read: boolean;
}

export interface Conversation {
  id: string;
  participants: Record<string, boolean>;
  lastMessage?: string;
  lastMessageTime?: Date;
  updatedAt: Date;
}

class MessagingService {
  async sendMessage(recipientId: string, content: string): Promise<void> {
    if (!auth.currentUser) throw new Error("Not authenticated");

    try {
      // Get or create conversation
      const conversationId = await this.getOrCreateConversation(recipientId);

      // Add message
      const messageData = {
        content,
        senderId: auth.currentUser.uid,
        recipientId,
        conversationId,
        createdAt: serverTimestamp(),
        read: false
      };

      const messageRef = await addDoc(collection(db, "messages"), messageData);

      // Update conversation
      const conversationRef = doc(db, "conversations", conversationId);
      await updateDoc(conversationRef, {
        lastMessage: content,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return messageRef.id;
    } catch (error) {
      logger.error("Error sending message:", error);
      throw error;
    }
  }

  private async getOrCreateConversation(recipientId: string): Promise<string> {
    if (!auth.currentUser) throw new Error("Not authenticated");

    const conversationsRef = collection(db, "conversations");
    const q = query(
      conversationsRef,
      where(`participants.${auth.currentUser.uid}`, "==", true),
      where(`participants.${recipientId}`, "==", true)
    );

    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    }

    // Create new conversation
    const participants: Record<string, boolean> = {
      [auth.currentUser.uid]: true,
      [recipientId]: true
    };

    const conversationData = {
      participants,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const newConversationRef = await addDoc(conversationsRef, conversationData);
    return newConversationRef.id;
  }

  async getConversations(): Promise<Conversation[]> {
    if (!auth.currentUser) throw new Error("Not authenticated");

    const conversationsRef = collection(db, "conversations");
    const q = query(
      conversationsRef,
      where(`participants.${auth.currentUser.uid}`, "==", true),
      orderBy("updatedAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      lastMessageTime: doc.data().lastMessageTime?.toDate()
    })) as Conversation[];
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    if (!auth.currentUser) throw new Error("Not authenticated");

    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    })) as Message[];
  }

  subscribeToConversation(
    conversationId: string, 
    callback: (messages: Message[]) => void
  ) {
    if (!auth.currentUser) throw new Error("Not authenticated");

    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Message[];
      callback(messages);
    });
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    if (!auth.currentUser) throw new Error("Not authenticated");

    const messageRef = doc(db, "messages", messageId);
    const messageDoc = await getDoc(messageRef);

    if (messageDoc.exists() && messageDoc.data().recipientId === auth.currentUser.uid) {
      await updateDoc(messageRef, { read: true });
    }
  }
}

export const messagingService = new MessagingService();
