/**
 * OrdersPanel — Embeddable manual fulfillment dashboard.
 *
 * Shows pending custom-product orders for the artist with quick "Mark shipped"
 * action. Designed to be injected into the OfficialStoreSection (owner-only).
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Truck, CheckCircle2, Clock, Loader2,
  MapPin, User as UserIcon, Mail, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ManualOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: any;
  product: any;
  status: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  shippedAt: number | null;
  createdAt: number | null;
}

interface OrdersPanelProps {
  artistPgId: number;
  colors: { hexAccent: string };
}

export function OrdersPanel({ artistPgId, colors }: OrdersPanelProps) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<ManualOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('USPS');

  useEffect(() => {
    if (!artistPgId) return;
    fetch(`/api/merch/orders/manual/${artistPgId}`)
      .then(r => r.json())
      .then((d: any) => {
        if (d?.success) setOrders(d.orders || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [artistPgId]);

  const handleMarkShipped = async (orderId: string) => {
    if (!trackingNumber.trim()) {
      toast({ title: 'Tracking number required', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch(`/api/merch/orders/${orderId}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber: trackingNumber.trim(), trackingCarrier }),
      });
      const r = await res.json();
      if (r.success) {
        setOrders(prev => prev.map(o => o.id === orderId
          ? { ...o, status: 'shipped', trackingNumber: trackingNumber.trim(), trackingCarrier, shippedAt: Date.now() }
          : o));
        toast({ title: '📦 Marked as shipped', description: `Tracking: ${trackingNumber}` });
        setShippingId(null);
        setTrackingNumber('');
      } else {
        throw new Error(r.error || 'Failed');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const pending = orders.filter(o => o.status === 'paid');
  const shipped = orders.filter(o => o.status === 'shipped');

  // Hide entirely if no orders at all
  if (!loading && orders.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-2xl border bg-white/[0.02] overflow-hidden"
      style={{ borderColor: `${colors.hexAccent}30` }}
    >
      {/* Header — clickable to expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${colors.hexAccent}20`, color: colors.hexAccent }}
          >
            <Package className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-white font-bold text-sm flex items-center gap-2">
              Custom Drops Fulfillment
              {pending.length > 0 && (
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                  style={{ background: colors.hexAccent, color: '#000' }}
                >
                  {pending.length} pending
                </span>
              )}
            </p>
            <p className="text-[11px] text-white/40">{shipped.length} shipped · {orders.length} total</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/5"
          >
            <div className="p-3 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-white/40" />
                </div>
              ) : (
                <>
                  {/* Pending */}
                  {pending.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="w-3.5 h-3.5 text-orange-400" />
                        <p className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">
                          Pending shipment ({pending.length})
                        </p>
                      </div>
                      <div className="space-y-2">
                        {pending.map(o => (
                          <OrderRow
                            key={o.id}
                            order={o}
                            colors={colors}
                            isShipping={shippingId === o.id}
                            onStartShip={() => setShippingId(o.id)}
                            onCancelShip={() => { setShippingId(null); setTrackingNumber(''); }}
                            onConfirmShip={() => handleMarkShipped(o.id)}
                            trackingNumber={trackingNumber}
                            setTrackingNumber={setTrackingNumber}
                            trackingCarrier={trackingCarrier}
                            setTrackingCarrier={setTrackingCarrier}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shipped */}
                  {shipped.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Truck className="w-3.5 h-3.5 text-blue-400" />
                        <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                          Shipped ({shipped.length})
                        </p>
                      </div>
                      <div className="space-y-2">
                        {shipped.slice(0, 5).map(o => (
                          <OrderRow key={o.id} order={o} colors={colors} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface OrderRowProps {
  order: ManualOrder;
  colors: { hexAccent: string };
  isShipping?: boolean;
  onStartShip?: () => void;
  onCancelShip?: () => void;
  onConfirmShip?: () => void;
  trackingNumber?: string;
  setTrackingNumber?: (v: string) => void;
  trackingCarrier?: string;
  setTrackingCarrier?: (v: string) => void;
}

function OrderRow({
  order, colors, isShipping, onStartShip, onCancelShip, onConfirmShip,
  trackingNumber, setTrackingNumber, trackingCarrier, setTrackingCarrier,
}: OrderRowProps) {
  const addr = order.shippingAddress;
  const product = order.product || {};
  const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '';
  const isShipped = order.status === 'shipped';

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-2.5">
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-3 items-start">
        {/* Product thumb */}
        <div className="flex gap-2.5">
          {product.productImage ? (
            <img
              src={product.productImage}
              alt={product.displayName}
              className="w-12 h-12 rounded-lg object-cover bg-zinc-900 flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-white/20" />
            </div>
          )}
          <div className="min-w-0 md:hidden">
            <p className="text-white text-xs font-bold line-clamp-1">{product.displayName || product.productType}</p>
            <p className="text-white/40 text-[10px]">{product.size && `${product.size} · `}${Number(product.price || 0).toFixed(2)}</p>
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0">
          <p className="hidden md:block text-white text-xs font-bold line-clamp-1">{product.displayName || product.productType}</p>
          <p className="hidden md:block text-white/40 text-[10px]">
            {product.size && `Size ${product.size} · `}${Number(product.price || 0).toFixed(2)}
            {product.quantity > 1 && ` · qty ${product.quantity}`}
          </p>
          <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-white/60">
            <span className="flex items-center gap-1 truncate">
              <UserIcon className="w-2.5 h-2.5 text-white/30 flex-shrink-0" /> {order.customerName}
            </span>
            <span className="flex items-center gap-1 truncate">
              <Mail className="w-2.5 h-2.5 text-white/30 flex-shrink-0" /> {order.customerEmail}
            </span>
            {addr && (
              <span className="flex items-start gap-1 md:col-span-2 text-white/50">
                <MapPin className="w-2.5 h-2.5 text-white/30 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-1">
                  {addr.line1}, {addr.city}, {addr.state} {addr.postalCode}, {addr.country}
                </span>
              </span>
            )}
          </div>
          <p className="text-white/30 text-[10px] mt-1">
            #{order.orderNumber} {date && `· ${date}`}
            {isShipped && order.trackingNumber && (
              <> · <CheckCircle2 className="inline w-2.5 h-2.5 text-green-400" /> {order.trackingCarrier} #{order.trackingNumber}</>
            )}
          </p>
        </div>

        {/* Action */}
        {!isShipped && !isShipping && onStartShip && (
          <button
            onClick={onStartShip}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all hover:scale-105"
            style={{ background: colors.hexAccent, color: '#000' }}
          >
            <Truck className="w-3 h-3" /> Ship
          </button>
        )}
      </div>

      {/* Inline ship form */}
      {isShipping && (
        <div className="mt-2.5 pt-2.5 border-t border-white/5 flex flex-col sm:flex-row gap-1.5">
          <select
            value={trackingCarrier}
            onChange={e => setTrackingCarrier?.(e.target.value)}
            className="bg-zinc-900 border border-white/10 rounded-md px-2 text-[11px] text-white py-1.5"
          >
            <option>USPS</option>
            <option>UPS</option>
            <option>FedEx</option>
            <option>DHL</option>
            <option>Other</option>
          </select>
          <input
            type="text"
            placeholder="Tracking number"
            value={trackingNumber || ''}
            onChange={e => setTrackingNumber?.(e.target.value)}
            className="flex-1 bg-zinc-900 border border-white/10 rounded-md px-2.5 py-1.5 text-[11px] text-white placeholder-white/30"
          />
          <button
            onClick={onConfirmShip}
            className="text-[11px] font-bold px-3 py-1.5 rounded-md"
            style={{ background: colors.hexAccent, color: '#000' }}
          >
            Confirm
          </button>
          <button
            onClick={onCancelShip}
            className="text-[11px] text-white/40 hover:text-white px-2"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
