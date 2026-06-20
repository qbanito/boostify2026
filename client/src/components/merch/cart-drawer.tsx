/**
 * CartDrawer — Slide-in cart UI with line items, qty controls, upsell carousel,
 * and "Checkout" button that POSTs all items to /api/merch/cart-checkout.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Plus, Minus, Trash2, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { useCart, type CartItem } from '@/contexts/cart-context';
import { useToast } from '@/hooks/use-toast';

interface UpsellProduct {
  productId: string;
  artistSlug: string;
  artistName: string;
  artistUserId?: number;
  name: string;
  imageUrl: string;
  price: number;
  productType: string;
  category: string;
  reason: string; // "Same artist" | "Frequently bought together" | etc.
  isCustomProduct?: boolean;
  sizes?: string[];
}

export function CartDrawer() {
  const cart = useCart();
  const { toast } = useToast();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [upsells, setUpsells] = useState<UpsellProduct[]>([]);

  // Fetch smart upsells whenever cart changes
  useEffect(() => {
    if (cart.items.length === 0) {
      setUpsells([]);
      return;
    }
    const productIds = cart.items.filter(i => i.productId).map(i => i.productId!);
    const artistSlugs = Array.from(new Set(cart.items.map(i => i.artistSlug).filter(Boolean)));
    if (productIds.length === 0 && artistSlugs.length === 0) return;

    const controller = new AbortController();
    fetch('/api/merch/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds, artistSlugs, limit: 6 }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.recommendations)) {
          // Filter out items already in cart
          const inCart = new Set(cart.items.map(i => i.productId).filter(Boolean));
          setUpsells(data.recommendations.filter((u: UpsellProduct) => !inCart.has(u.productId)));
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [cart.items]);

  const handleCheckout = async () => {
    if (cart.items.length === 0) return;
    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/merch/cart-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart.items }),
      });
      const result = await res.json();
      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        throw new Error(result.error || 'Checkout failed');
      }
    } catch (err: any) {
      toast({ title: 'Checkout error', description: err.message, variant: 'destructive' });
      setIsCheckingOut(false);
    }
  };

  const addUpsell = (u: UpsellProduct) => {
    cart.addItem({
      source: 'firestore',
      productId: u.productId,
      artistSlug: u.artistSlug,
      artistName: u.artistName,
      artistUserId: u.artistUserId,
      name: u.name,
      imageUrl: u.imageUrl,
      price: u.price,
      size: u.sizes?.[0] || '',
      productType: u.productType,
      isCustomProduct: u.isCustomProduct,
    });
  };

  return (
    <AnimatePresence>
      {cart.isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={cart.closeCart}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-zinc-950 border-l border-white/10 z-[101] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Your Cart</h3>
                  <p className="text-[11px] text-white/40">{cart.count} {cart.count === 1 ? 'item' : 'items'}</p>
                </div>
              </div>
              <button
                onClick={cart.closeCart}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {cart.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <ShoppingBag className="w-12 h-12 text-white/10 mb-4" />
                  <p className="text-white/40 text-sm mb-1">Your cart is empty</p>
                  <p className="text-white/20 text-xs">Add products from any artist's store</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.items.map(item => (
                    <CartLine key={item.key} item={item} />
                  ))}
                </div>
              )}

              {/* Upsells */}
              {upsells.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    <h4 className="text-white text-sm font-bold">You may also like</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {upsells.slice(0, 4).map(u => (
                      <button
                        key={u.productId}
                        onClick={() => addUpsell(u)}
                        className="group text-left rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-orange-500/40 transition-all"
                      >
                        <div className="aspect-square bg-zinc-900 overflow-hidden">
                          {u.imageUrl ? (
                            <img src={u.imageUrl} alt={u.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="w-6 h-6 text-white/10" />
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-[11px] text-white font-semibold line-clamp-1">{u.name}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-orange-400 text-xs font-bold">${u.price.toFixed(2)}</span>
                            <span className="text-[9px] text-white/30">{u.reason}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {cart.items.length > 0 && (
              <div className="border-t border-white/5 p-5 space-y-3 bg-zinc-950/95 backdrop-blur-md">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Subtotal</span>
                  <span className="text-white font-bold text-base">${cart.subtotal.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-white/30">Shipping & taxes calculated at checkout</p>
                <button
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-orange-500/20"
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Checkout — ${cart.subtotal.toFixed(2)}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button
                  onClick={cart.clear}
                  className="w-full text-white/30 hover:text-white/60 text-[11px] py-1 transition-colors"
                >
                  Clear cart
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function CartLine({ item }: { item: CartItem }) {
  const cart = useCart();
  return (
    <div className="flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white/10" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-semibold line-clamp-1">{item.name}</p>
        <p className="text-white/40 text-[10px] line-clamp-1">{item.artistName}{item.size ? ` · ${item.size}` : ''}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 bg-white/5 rounded-md">
            <button
              onClick={() => cart.updateQuantity(item.key, item.quantity - 1)}
              className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-white text-xs font-bold w-5 text-center">{item.quantity}</span>
            <button
              onClick={() => cart.updateQuantity(item.key, item.quantity + 1)}
              className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400 text-xs font-bold">${(item.price * item.quantity).toFixed(2)}</span>
            <button
              onClick={() => cart.removeItem(item.key)}
              className="text-white/30 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Floating cart button — shows count badge, opens drawer
 */
export function CartFloatingButton() {
  const cart = useCart();
  if (cart.count === 0) return null;
  return (
    <button
      onClick={cart.openCart}
      className="fixed bottom-6 right-6 z-50 bg-orange-500 hover:bg-orange-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-2xl shadow-orange-500/30 transition-all hover:scale-105"
    >
      <ShoppingBag className="w-5 h-5" />
      <span className="absolute -top-1 -right-1 bg-white text-orange-500 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-orange-500">
        {cart.count}
      </span>
    </button>
  );
}
