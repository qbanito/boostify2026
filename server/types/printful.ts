/**
 * Tipos de datos para la API de Printful
 */

export interface PrintfulProduct {
  id: number;
  external_id?: string;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url?: string;
  is_ignored?: boolean;
}

export interface PrintfulSyncProduct {
  id: number;
  external_id: string;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url?: string;
  is_ignored: boolean;
}

export interface PrintfulVariant {
  id: number;
  external_id?: string;
  sync_product_id: number;
  name: string;
  synced: boolean;
  variant_id: number;
  retail_price?: string;
  currency?: string;
  is_ignored?: boolean;
  sku?: string;
  product?: {
    variant_id: number;
    product_id: number;
    image: string;
    name: string;
  };
  files?: Array<{
    id: number;
    type: string;
    hash: string;
    url: string;
    filename: string;
    mime_type: string;
    size: number;
    width: number;
    height: number;
    dpi: number;
    status: string;
    created: number;
    thumbnail_url: string;
    preview_url: string;
    visible: boolean;
  }>;
}

export interface PrintfulCatalogProduct {
  id: number;
  type: string;
  type_name: string;
  title: string;
  brand: string;
  model: string;
  image: string;
  variant_count: number;
  currency: string;
  options: Array<{
    id: string;
    title: string;
    type: string;
    values: Record<string, string>;
    additional_price?: string;
  }>;
  dimensions?: {
    width: string;
    height: string;
    length: string;
  };
  is_discontinued: boolean;
  avg_fulfillment_time?: number;
  description: string;
  files: Array<{
    id: string;
    type: string;
    title: string;
    additional_price?: string;
  }>;
}

export interface PrintfulCatalogVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code?: string;
  image: string;
  price: string;
  in_stock: boolean;
  availability_status?: string;
  availability_regions: {
    US?: string;
    EU?: string;
    [key: string]: string | undefined;
  };
  availability_status_info?: string;
}

export interface PrintfulOrder {
  id: number;
  external_id?: string;
  store: number;
  status: string;
  shipping: string;
  created: number;
  updated: number;
  recipient: {
    name: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state_code: string;
    state_name: string;
    country_code: string;
    country_name: string;
    zip: string;
    phone?: string;
    email: string;
  };
  items: Array<{
    id: number;
    external_id?: string;
    variant_id?: number;
    sync_variant_id?: number;
    external_variant_id?: string;
    quantity: number;
    price: string;
    retail_price?: string;
    name: string;
    product: {
      variant_id: number;
      product_id: number;
      image: string;
      name: string;
    };
    files?: Array<{
      type: string;
      url: string;
    }>;
    options?: Array<{
      id: string;
      value: string;
    }>;
  }>;
  costs?: {
    currency: string;
    subtotal: string;
    discount: string;
    shipping: string;
    digitization: string;
    additional_fee: string;
    fulfillment_fee: string;
    tax: string;
    vat: string;
    total: string;
  };
  retail_costs?: {
    currency: string;
    subtotal: string;
    discount: string;
    shipping: string;
    tax: string;
    vat: string;
    total: string;
  };
  shipments?: Array<{
    id: number;
    carrier: string;
    service: string;
    tracking_number: string;
    tracking_url: string;
    created: number;
    ship_date: string;
    shipped_at: number;
    reshipment: boolean;
    items: Array<{
      item_id: number;
      quantity: number;
    }>;
  }>;
}

export interface CreatePrintfulOrder {
  external_id?: string;
  shipping: string;
  recipient: {
    name: string;
    address1: string;
    city: string;
    state_code: string;
    country_code: string;
    zip: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    sync_variant_id?: number;
    external_variant_id?: string;
    quantity: number;
    retail_price?: string;
    files?: Array<{
      url: string;
    }>;
  }>;
  retail_costs?: {
    currency?: string;
    subtotal?: string;
    discount?: string;
    shipping?: string;
    tax?: string;
  };
}

export interface PrintfulStoreInfo {
  id: number;
  type: string;
  name: string;
  website: string;
  currency: string;
  created: number;
}
