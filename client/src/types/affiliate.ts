// Definiciones de tipos para el sistema de afiliados

export interface Product {
  id: string;
  name: string;
  url?: string;
  imageUrl?: string;
  type?: string;
  price?: number;
  commissionRate?: number;
  description?: string;
}

export interface AffiliateLinkType {
  id: string;
  createdAt: any;
  userId?: string;
  productId?: string;
  url?: string;
  campaign?: string;
  clicks?: number;
  conversions?: number;
  earnings?: number;
  [key: string]: any; // Permite acceso con índice dinámico para la ordenación
}

export interface AffiliateEarningType {
  id: string;
  createdAt: any;
  userId?: string;
  productId?: string;
  productName?: string;
  orderId?: string;
  amount?: number;
  status?: string;
}

export interface AffiliatePaymentType {
  id: string;
  createdAt: any;
  processedAt: any;
  userId?: string;
  amount?: number;
  method?: string;
  status?: string;
}

export interface AffiliateContentType {
  id: string;
  createdAt: any;
  userId?: string;
  productId?: string;
  contentType?: string;
  content?: string;
  title?: string;
  format?: string;
}