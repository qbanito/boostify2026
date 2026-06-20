/**
 * Artist Orders Dashboard — manual fulfillment for custom products.
 * Lists all paid orders with fulfillment === 'manual' for the current artist
 * and lets them mark items as shipped (with tracking number).
 */
import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  Package, Truck, CheckCircle2, Clock, Loader2, ArrowLeft, MapPin, User as UserIcon, Mail, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function ArtistOrdersPage() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ManualOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('USPS');

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch(`/api/users/by-clerk/${user.id}`)
      .then(r => r.json())
      .then(d => {
        const pgId = d?.user?.id || d?.id;
        if (!pgId) {
          setLoading(false);
          return;
        }
        return fetch(`/api/merch/orders/manual/${pgId}`).then(r => r.json());
      })
      .then((data: any) => {
        if (data?.success) setOrders(data.orders || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load orders:', err);
        setLoading(false);
      });
  }, [isLoaded, user]);

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
      const result = await res.json();
      if (result.success) {
        setOrders(prev => prev.map(o => o.id === orderId
          ? { ...o, status: 'shipped', trackingNumber: trackingNumber.trim(), trackingCarrier, shippedAt: Date.now() }
          : o
        ));
        toast({ title: 'Order marked as shipped', description: `Tracking: ${trackingNumber}` });
        setShippingId(null);
        setTrackingNumber('');
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const pending = orders.filter(o => o.status === 'paid');
  const shipped = orders.filter(o => o.status === 'shipped');

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p>Sign in to view your orders</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link href="/dashboard">
            <a className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to dashboard
            </a>
          </Link>
          <h1 className="text-4xl font-black mb-2">Custom Drops Fulfillment</h1>
          <p className="text-white/50">Manage and ship your custom product orders</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard icon={<Clock className="w-5 h-5 text-orange-400" />} label="Pending shipment" value={pending.length} />
          <StatCard icon={<Truck className="w-5 h-5 text-blue-400" />} label="Shipped" value={shipped.length} />
          <StatCard icon={<CheckCircle2 className="w-5 h-5 text-green-400" />} label="Total orders" value={orders.length} />
        </div>

        {/* Pending */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-400" /> Pending shipment ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <div className="rounded-2xl border border-white/10 p-12 text-center">
              <Package className="w-12 h-12 text-white/10 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No pending orders right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(order => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                >
                  <OrderCardContent order={order} />
                  {shippingId === order.id ? (
                    <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-2">
                      <select
                        value={trackingCarrier}
                        onChange={e => setTrackingCarrier(e.target.value)}
                        className="bg-zinc-900 border border-white/10 rounded-lg px-3 text-sm text-white"
                      >
                        <option>USPS</option>
                        <option>UPS</option>
                        <option>FedEx</option>
                        <option>DHL</option>
                        <option>Other</option>
                      </select>
                      <Input
                        placeholder="Tracking number"
                        value={trackingNumber}
                        onChange={e => setTrackingNumber(e.target.value)}
                        className="flex-1 bg-zinc-900 border-white/10"
                      />
                      <Button onClick={() => handleMarkShipped(order.id)} className="bg-orange-500 hover:bg-orange-600">
                        Confirm shipment
                      </Button>
                      <Button variant="ghost" onClick={() => { setShippingId(null); setTrackingNumber(''); }}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                      <Button onClick={() => setShippingId(order.id)} className="bg-orange-500 hover:bg-orange-600">
                        <Truck className="w-4 h-4 mr-2" /> Mark as shipped
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Shipped */}
        {shipped.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-400" /> Shipped ({shipped.length})
            </h2>
            <div className="space-y-3">
              {shipped.map(order => (
                <div key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <OrderCardContent order={order} />
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-white/70">Shipped via {order.trackingCarrier} · #{order.trackingNumber}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-2">
        {icon}
        <span className="text-3xl font-black">{value}</span>
      </div>
      <p className="text-[11px] text-white/40 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function OrderCardContent({ order }: { order: ManualOrder }) {
  const addr = order.shippingAddress;
  const product = order.product || {};
  const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '';
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Product */}
      <div className="flex gap-3">
        {product.productImage && (
          <img src={product.productImage} alt={product.displayName} className="w-16 h-16 rounded-lg object-cover bg-zinc-900" />
        )}
        <div className="min-w-0">
          <p className="font-bold text-sm line-clamp-1">{product.displayName || product.productType}</p>
          <p className="text-white/40 text-xs mt-0.5">{product.size && `Size: ${product.size}`}{product.quantity > 1 && ` · Qty: ${product.quantity}`}</p>
          <p className="text-orange-400 text-sm font-bold mt-1">${Number(product.price || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Customer */}
      <div className="text-sm">
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Customer</p>
        <p className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5 text-white/40" /> {order.customerName}</p>
        <p className="flex items-center gap-1.5 text-white/60 text-xs mt-0.5"><Mail className="w-3 h-3 text-white/40" /> {order.customerEmail}</p>
      </div>

      {/* Address + Order# */}
      <div className="text-sm">
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Ship to · {order.orderNumber}</p>
        {addr ? (
          <p className="flex items-start gap-1.5 text-white/70 text-xs">
            <MapPin className="w-3.5 h-3.5 text-white/40 mt-0.5 flex-shrink-0" />
            <span>{addr.line1}{addr.line2 && `, ${addr.line2}`}<br/>{addr.city}, {addr.state} {addr.postalCode}<br/>{addr.country}</span>
          </p>
        ) : (
          <p className="text-white/40 text-xs">No address on file</p>
        )}
        {date && <p className="text-white/30 text-[10px] mt-2">Ordered {date}</p>}
      </div>
    </div>
  );
}
