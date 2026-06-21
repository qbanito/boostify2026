/**
 * WhatsApp Artist Command Center — Firestore schema (typed reference).
 * ---------------------------------------------------------------------------
 * Single source of truth for the document shapes stored under each artist.
 * These are written/read ONLY by the backend (Admin SDK) — see
 * server/routes/whatsapp.ts and firestore.rules (direct client access denied).
 *
 * Collection paths:
 *   artists/{artistId}/whatsappSessions/{sessionId}
 *   artists/{artistId}/whatsappContacts/{contactId}   (contactId = phone digits)
 *   artists/{artistId}/whatsappMessages/{messageId}
 *   artists/{artistId}/whatsappCampaigns/{campaignId}
 *   artists/{artistId}/aiCommands/{commandId}
 *   artists/{artistId}/whatsappSales/{saleId}
 *   artists/{artistId}/whatsappAuditLog/{logId}
 */

export type WhatsAppSessionStatus =
  | 'initializing' | 'qr' | 'connected' | 'disconnected' | 'expired' | 'error';

export interface WhatsAppSession {
  sessionId: string;
  artistId: string;
  ownerId: string;
  artistName?: string | null;
  phoneNumber?: string | null;
  sessionStatus: WhatsAppSessionStatus;
  qrCode?: string | null;
  simulated?: boolean;
  createdAt: any;          // serverTimestamp
  updatedAt: number;       // epoch ms
  lastConnectedAt?: number | null;
}

export type ConsentStatus = 'opted_in' | 'opted_out' | 'pending';

export interface WhatsAppContact {
  name: string;
  phone: string;           // digits only (also the doc id)
  tags: string[];
  source: string;          // 'import' | 'inbound' | 'manual' | ...
  consentStatus: ConsentStatus;
  city?: string | null;
  isVip: boolean;
  totalSpent: number;
  lastMessageAt?: number | null;
  optedOutAt?: number | null;
  updatedAt: number;
}

export interface WhatsAppMessage {
  id: string;
  direction: 'in' | 'out';
  from: string;
  to: string;
  body: string;
  mediaUrl?: string | null;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'unknown';
  status: 'sent' | 'failed' | 'received' | 'delivered';
  timestamp: number;
  campaignId?: string | null;
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  segment: string;         // 'all' | 'vip' | 'buyers' | 'top' | 'new' | 'city'
  message: string;
  mediaUrl?: string | null;
  status: 'sending' | 'completed' | 'failed';
  sentCount: number;
  deliveredCount: number;
  responseCount: number;
  conversionCount: number;
  revenue: number;
  targetCount?: number;
  ownerId: string;
  createdAt: number;
  updatedAt?: number;
}

export interface WhatsAppAiCommand {
  id: string;
  rawText: string;
  intent: string;
  moduleTarget: string;
  params: Record<string, any>;
  confidence: number;
  source: 'llm' | 'fallback';
  actionStatus: 'classified' | 'executed' | 'failed';
  result?: string;
  from?: string;           // present for inbound (fan) commands
  channel?: 'inbound' | 'dashboard';
  ownerId?: string;
  createdAt: number;
}

export interface WhatsAppSale {
  id: string;
  type: 'ticket' | 'merch' | 'tip' | 'gift' | 'other';
  amount: number;
  currency: string;
  btfAmount?: number;
  fanId?: string;          // contact phone
  source: string;          // 'whatsapp'
  status: 'pending' | 'completed' | 'refunded';
  createdAt: number;
}

export interface WhatsAppAuditLog {
  action: string;
  detail: any;
  ownerId?: string | null;
  at: number;
}
