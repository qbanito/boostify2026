/**
 * Cart success page — shown after Stripe redirects from a multi-product cart checkout.
 * Clears the cart and shows order summary + upsell recommendations.
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { CheckCircle2, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCart } from '@/contexts/cart-context';

export default function CartSuccessPage() {
  const cart = useCart();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || '';

    // Capture cart snapshot before clearing for upsell context
    const productIds = cart.items.filter(i => i.productId).map(i => i.productId!);
    const artistSlugs = Array.from(new Set(cart.items.map(i => i.artistSlug).filter(Boolean)));

    // Clear cart immediately on success
    cart.clear();

    // Fetch post-purchase recommendations
    if (productIds.length > 0 || artistSlugs.length > 0) {
      fetch('/api/merch/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, artistSlugs, limit: 4 }),
      })
        .then(r => r.json())
        .then(d => { if (d.success) setRecommendations(d.recommendations || []); })
        .catch(() => {});
    }

    if (sessionId.startsWith('cs_')) {
      setOrdersLoading(true);
      fetch(`/api/merch/orders/by-session/${encodeURIComponent(sessionId)}`)
        .then(r => r.json())
        .then(d => {
          if (d?.success && Array.isArray(d.orders)) setOrders(d.orders);
        })
        .catch(() => {})
        .finally(() => setOrdersLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primaryOrder = orders[0];
  const shipping = primaryOrder?.shippingAddress;

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        {/* Hero */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-6"
          >
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black mb-4">Order confirmed!</h1>
          <p className="text-white/60 text-lg max-w-md mx-auto">
            Thank you for supporting independent artists. You'll receive an email confirmation shortly.
          </p>
        </div>

        {/* Trust strip */}
        <div className="grid grid-cols-3 gap-3 mb-12">
          <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Status</p>
            <p className="text-white font-bold text-sm">Paid</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Shipping</p>
            <p className="text-white font-bold text-sm">3-7 days</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Tracking</p>
            <p className="text-white font-bold text-sm">Via email</p>
          </div>
        </div>

        {/* Order details */}
        <div className="mb-10 rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5">
          <h3 className="text-white font-bold mb-3">Order details</h3>
          {ordersLoading ? (
            <p className="text-white/40 text-sm">Loading order details...</p>
          ) : orders.length === 0 ? (
            <p className="text-white/40 text-sm">Your order is confirmed. Detailed tracking will appear shortly.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Order Number</p>
                  <p className="text-white font-semibold">{primaryOrder?.orderNumber || 'Pending'}</p>
                </div>
                <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Status</p>
                  <p className="text-white font-semibold capitalize">{primaryOrder?.status || 'paid'}</p>
                </div>
              </div>

              {shipping && (
                <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Shipping Address</p>
                  <p className="text-white text-sm">
                    {[shipping.line1, shipping.line2].filter(Boolean).join(' ')}<br />
                    {[shipping.city, shipping.state, shipping.postalCode].filter(Boolean).join(', ')}<br />
                    {shipping.country}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {orders.map((o, idx) => (
                  <div key={o.id || idx} className="rounded-xl bg-black/30 border border-white/10 p-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-medium text-sm">{o.product?.displayName || 'Product'}</p>
                      <p className="text-white/40 text-xs">{o.product?.size ? `Size: ${o.product.size}` : 'Default size'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/60 text-xs uppercase">Fulfillment</p>
                      <p className="text-white text-sm capitalize">{o.fulfillment || 'printful'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upsell */}
        {recommendations.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <h3 className="text-white font-bold">You may also love</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {recommendations.map((u: any) => (
                <Link key={u.productId} href={u.artistSlug ? `/artist/${u.artistSlug}/store` : '/store'}>
                  <a className="group rounded-xl overflow-hidden bg-white/[0.03] border border-white/10 hover:border-orange-500/40 transition-all">
                    <div className="aspect-square bg-zinc-900 overflow-hidden">
                      {u.imageUrl && <img src={u.imageUrl} alt={u.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />}
                    </div>
                    <div className="p-2">
                      <p className="text-white text-xs font-semibold line-clamp-1">{u.name}</p>
                      <p className="text-orange-400 text-xs font-bold mt-0.5">${Number(u.price).toFixed(2)}</p>
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/store">
            <a className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
              <ShoppingBag className="w-4 h-4" />
              Keep shopping
              <ArrowRight className="w-4 h-4" />
            </a>
          </Link>
          <Link href="/">
            <a className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-colors">
              Back to home
            </a>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
