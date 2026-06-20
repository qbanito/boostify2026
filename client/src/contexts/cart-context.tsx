/**
 * Boostify Merch Cart — multi-product, multi-artist cart with localStorage persistence.
 *
 * Items can come from:
 *   - Firestore artist products (productId = Firestore docId, has artistName + productType)
 *   - Printful catalog products (printfulId numeric, no productId)
 *   - Bundles (bundleId, products[])
 *
 * The checkout endpoint /api/merch/cart-checkout consumes this shape.
 */
import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';

export type CartItemSource = 'firestore' | 'printful' | 'bundle';

export interface CartItem {
  /** Unique key in the cart (productId|printfulId|bundleId + size) */
  key: string;
  source: CartItemSource;
  productId?: string;        // Firestore docId
  printfulId?: number;       // Printful catalog id
  bundleId?: string;
  artistSlug: string;
  artistName: string;
  artistUserId?: number;     // PG user id (resolved server-side if missing)
  name: string;
  imageUrl: string;
  printFileUrl?: string;     // canonical design file for Printful production
  price: number;             // unit price USD
  size: string;
  productType: string;
  quantity: number;
  isCustomProduct?: boolean; // skip Printful in webhook
  printfulVariantId?: string;
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  count: number;
  subtotal: number;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartItem, 'key' | 'quantity'> & { quantity?: number }) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'boostify_cart_v1';

function loadFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p: any) => p && typeof p.key === 'string' && typeof p.price === 'number');
  } catch {
    return [];
  }
}

function makeKey(item: Pick<CartItem, 'productId' | 'printfulId' | 'bundleId' | 'size'>): string {
  const id = item.productId || (item.printfulId ? `pf_${item.printfulId}` : '') || (item.bundleId ? `b_${item.bundleId}` : '');
  return `${id}__${item.size || 'default'}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadFromStorage());
  const [isOpen, setIsOpen] = useState(false);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* quota exceeded — ignore */
    }
  }, [items]);

  const addItem = useCallback<CartContextValue['addItem']>((raw) => {
    const key = makeKey(raw);
    const qty = raw.quantity ?? 1;
    setItems(prev => {
      const idx = prev.findIndex(p => p.key === key);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qty };
        return updated;
      }
      return [...prev, { ...raw, key, quantity: qty } as CartItem];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems(prev => prev.filter(p => p.key !== key));
  }, []);

  const updateQuantity = useCallback((key: string, qty: number) => {
    setItems(prev => {
      if (qty <= 0) return prev.filter(p => p.key !== key);
      return prev.map(p => (p.key === key ? { ...p, quantity: qty } : p));
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => ({
    items,
    isOpen,
    count: items.reduce((s, p) => s + p.quantity, 0),
    subtotal: items.reduce((s, p) => s + p.price * p.quantity, 0),
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    toggleCart: () => setIsOpen(o => !o),
    addItem,
    removeItem,
    updateQuantity,
    clear,
  }), [items, isOpen, addItem, removeItem, updateQuantity, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
