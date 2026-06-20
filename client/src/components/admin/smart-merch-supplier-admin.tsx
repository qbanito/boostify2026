/**
 * SMART MERCH — Supplier Network (Admin only)
 *
 * Admin-only control surface for the Smart Merch fulfillment network:
 *  - Directory: curated suppliers (with links) the platform works with.
 *  - Assign:    link each product to the supplier that fulfills it.
 *  - Orders:    paid orders + their routing status (providers receive orders
 *               directly by email when paid; admin can re-send).
 *  - Messages:  admin ↔ supplier conversations delivered via Resend.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Truck, Plus, RefreshCw, ExternalLink, Mail, Send, Loader2, Trash2,
  Package, CheckCircle2, AlertCircle, X, Pencil, Inbox, Boxes, Link2,
} from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';

interface Supplier {
  id: number;
  name: string;
  provider_key?: string | null;
  category?: string | null;
  website?: string | null;
  order_email?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  regions?: string[] | null;
  product_categories?: string[] | null;
  api_ready?: boolean;
  api_connected?: boolean;
  notes?: string | null;
  is_active: boolean;
  assigned_products?: number;
  routed_orders?: number;
  unread?: number;
}

interface AdminProduct {
  id: number;
  title: string;
  category?: string | null;
  status: string;
  image_url?: string | null;
  fulfillment_provider?: string | null;
  assigned_supplier_id?: number | null;
  supplier_name?: string | null;
  artist_username?: string | null;
}

interface AdminOrder {
  id: number;
  product_title?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  quantity: number;
  subtotal?: number | null;
  payment_status: string;
  shipping_status: string;
  supplier_name?: string | null;
  supplier_email?: string | null;
  route_status?: string | null;
  route_provider?: string | null;
}

interface ThreadRow {
  id: number;
  supplier_id: number;
  supplier_name?: string;
  supplier_email?: string | null;
  subject?: string | null;
  status: string;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  admin_unread?: number;
  related_order_id?: number | null;
}

interface MessageRow {
  id: number;
  sender_role: 'admin' | 'supplier' | 'system';
  body: string;
  email_provider?: string | null;
  created_at: string;
}

type Tab = 'directory' | 'products' | 'orders' | 'messages';

const API = '/api/smart-merch/admin';

function money(v?: number | string | null) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
}

export function SmartMerchSupplierAdmin() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('directory');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [messageSupplier, setMessageSupplier] = useState<Supplier | null>(null);
  const [openThread, setOpenThread] = useState<ThreadRow | null>(null);
  const [threadMessages, setThreadMessages] = useState<MessageRow[]>([]);
  const [reply, setReply] = useState('');

  const loadSuppliers = useCallback(async () => {
    try {
      const r = await apiRequest('GET', `${API}/suppliers`);
      setSuppliers(r.suppliers || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Could not load suppliers', variant: 'destructive' });
    }
  }, [toast]);

  const loadProducts = useCallback(async () => {
    try {
      const r = await apiRequest('GET', `${API}/products`);
      setProducts(r.products || []);
    } catch { /* ignore */ }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const r = await apiRequest('GET', `${API}/orders`);
      setOrders(r.orders || []);
    } catch { /* ignore */ }
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const r = await apiRequest('GET', `${API}/supplier-threads`);
      setThreads(r.threads || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSuppliers(), loadProducts(), loadOrders(), loadThreads()]).finally(() => setLoading(false));
  }, [loadSuppliers, loadProducts, loadOrders, loadThreads]);

  const seedDirectory = async () => {
    setLoading(true);
    try {
      const r = await apiRequest('POST', `${API}/suppliers/seed`, {});
      setSuppliers(r.suppliers || []);
      toast({ title: 'Directory ready', description: `${r.inserted} suppliers imported.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const removeSupplier = async (id: number) => {
    if (!confirm('Deactivate this supplier?')) return;
    try {
      await apiRequest('DELETE', `${API}/suppliers/${id}`);
      loadSuppliers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const assignSupplier = async (productId: number, supplierId: number | null) => {
    try {
      await apiRequest('PUT', `${API}/products/${productId}/supplier`, { supplierId });
      setProducts((prev) => prev.map((p) => (p.id === productId
        ? { ...p, assigned_supplier_id: supplierId, supplier_name: suppliers.find((s) => s.id === supplierId)?.name || null }
        : p)));
      toast({ title: 'Updated', description: 'Supplier assigned to product.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const routeOrder = async (orderId: number, force = false) => {
    try {
      await apiRequest('POST', `${API}/orders/${orderId}/route`, { force });
      toast({ title: 'Order sent', description: `Order SM-${orderId} dispatched to the supplier.` });
      loadOrders();
    } catch (e: any) {
      toast({ title: 'Could not route', description: e.message, variant: 'destructive' });
    }
  };

  const openThreadView = async (t: ThreadRow) => {
    setOpenThread(t);
    setThreadMessages([]);
    try {
      const r = await apiRequest('GET', `${API}/supplier-threads/${t.id}`);
      setThreadMessages(r.messages || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const sendReply = async () => {
    if (!openThread || !reply.trim()) return;
    try {
      const r = await apiRequest('POST', `${API}/supplier-threads/${openThread.id}/reply`, { message: reply.trim() });
      setReply('');
      const fresh = await apiRequest('GET', `${API}/supplier-threads/${openThread.id}`);
      setThreadMessages(fresh.messages || []);
      loadThreads();
      if (!r.emailDelivered) toast({ title: 'Saved (email not delivered)', description: r.emailError || 'No email on file' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'directory', label: 'Directory', icon: Truck },
    { key: 'products', label: 'Assign', icon: Boxes },
    { key: 'orders', label: 'Orders', icon: Package },
    { key: 'messages', label: 'Messages', icon: Mail },
  ];

  const totalUnread = suppliers.reduce((a, s) => a + Number(s.unread || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-orange-500/15"><Truck className="h-5 w-5 text-orange-400" /></div>
          <div>
            <h2 className="text-lg font-bold text-white">Smart Merch — Supplier Network</h2>
            <p className="text-xs text-slate-400">Connect fulfillment providers, route orders directly & message suppliers via Resend.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { loadSuppliers(); loadProducts(); loadOrders(); loadThreads(); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          {suppliers.length === 0 && (
            <button onClick={seedDirectory} disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-orange-500 text-white disabled:opacity-60">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Import recommended suppliers
            </button>
          )}
          <button onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-orange-500 text-white">
            <Plus className="h-3.5 w-3.5" /> Add supplier
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/60 border border-slate-700 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key;
          const badge = t.key === 'messages' ? totalUnread : 0;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${active ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
              {badge > 0 && <span className="ml-1 px-1.5 rounded-full bg-pink-500 text-white text-[10px]">{badge}</span>}
            </button>
          );
        })}
      </div>

      {/* DIRECTORY */}
      {tab === 'directory' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {suppliers.length === 0 && !loading && (
            <div className="col-span-full py-10 text-center rounded-xl bg-slate-900/60 border border-dashed border-slate-700">
              <Truck className="h-8 w-8 mx-auto text-slate-500" />
              <p className="text-sm text-slate-300 mt-2">No suppliers yet</p>
              <p className="text-xs text-slate-500 mt-1">Import the recommended providers or add your own.</p>
            </div>
          )}
          {suppliers.map((s) => (
            <div key={s.id} className={`rounded-xl p-3 bg-slate-900/60 border ${s.is_active ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{s.name}</h3>
                  {s.category && <p className="text-[11px] text-orange-300 capitalize">{s.category.replace(/-/g, ' ')}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditSupplier(s)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => removeSupplier(s.id)} className="p-1.5 rounded-lg hover:bg-slate-700 text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {s.notes && <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">{s.notes}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(s.product_categories || []).map((c) => (
                  <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 capitalize">{c}</span>
                ))}
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-400 hover:underline"><ExternalLink className="h-3 w-3" /> {s.website.replace(/^https?:\/\//, '')}</a>}
                <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {s.order_email || s.contact_name || <span className="text-amber-400">no order email — add one to receive orders</span>}</p>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>{s.assigned_products || 0} products · {s.routed_orders || 0} orders</span>
                <button onClick={() => setMessageSupplier(s)} className="inline-flex items-center gap-1 text-orange-300 hover:underline">
                  <Send className="h-3 w-3" /> Message
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PRODUCTS / ASSIGN */}
      {tab === 'products' && (
        <div className="rounded-xl overflow-hidden border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-xs">
              <tr>
                <th className="text-left p-2.5">Product</th>
                <th className="text-left p-2.5 hidden md:table-cell">Artist</th>
                <th className="text-left p-2.5 hidden md:table-cell">Status</th>
                <th className="text-left p-2.5">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-slate-800">
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      {p.image_url ? <img src={p.image_url} className="h-8 w-8 rounded object-cover" alt="" /> : <Package className="h-5 w-5 text-slate-500" />}
                      <span className="text-white">{p.title}</span>
                    </div>
                  </td>
                  <td className="p-2.5 hidden md:table-cell text-slate-400">{p.artist_username || `#${p.id}`}</td>
                  <td className="p-2.5 hidden md:table-cell text-slate-400 capitalize">{p.status?.replace(/_/g, ' ')}</td>
                  <td className="p-2.5">
                    <select
                      value={p.assigned_supplier_id || ''}
                      onChange={(e) => assignSupplier(p.id, e.target.value ? Number(e.target.value) : null)}
                      className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs">
                      <option value="">— Unassigned —</option>
                      {suppliers.filter((s) => s.is_active).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-slate-500 text-sm">No products yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ORDERS */}
      {tab === 'orders' && (
        <div className="rounded-xl overflow-hidden border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-xs">
              <tr>
                <th className="text-left p-2.5">Order</th>
                <th className="text-left p-2.5 hidden md:table-cell">Product</th>
                <th className="text-left p-2.5 hidden lg:table-cell">Payment</th>
                <th className="text-left p-2.5">Supplier route</th>
                <th className="text-right p-2.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const paid = o.payment_status === 'paid';
                return (
                  <tr key={o.id} className="border-t border-slate-800">
                    <td className="p-2.5">
                      <div className="text-white font-semibold">SM-{o.id}</div>
                      <div className="text-[11px] text-slate-500">{o.quantity}× · {money(o.subtotal)}</div>
                    </td>
                    <td className="p-2.5 hidden md:table-cell text-slate-300">{o.product_title}</td>
                    <td className="p-2.5 hidden lg:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${paid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{o.payment_status}</span>
                    </td>
                    <td className="p-2.5">
                      {!o.supplier_name ? (
                        <span className="text-[11px] text-amber-400">No supplier assigned</span>
                      ) : o.route_status === 'sent' || o.route_status === 'acknowledged' || o.route_status === 'shipped' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> {o.supplier_name} ({o.route_provider})</span>
                      ) : o.route_status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-400"><AlertCircle className="h-3.5 w-3.5" /> Failed → {o.supplier_name}</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Not sent → {o.supplier_name}</span>
                      )}
                    </td>
                    <td className="p-2.5 text-right">
                      {paid && o.supplier_name && (
                        <button onClick={() => routeOrder(o.id, !!o.route_status)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-orange-500/15 text-orange-300 border border-orange-500/40 hover:bg-orange-500/25 inline-flex items-center gap-1">
                          <Send className="h-3 w-3" /> {o.route_status ? 'Resend' : 'Send'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500 text-sm">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MESSAGES */}
      {tab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-1 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-2.5 bg-slate-900/80 text-xs text-slate-400 flex items-center gap-1.5"><Inbox className="h-3.5 w-3.5" /> Threads</div>
            <div className="divide-y divide-slate-800 max-h-[460px] overflow-y-auto">
              {threads.map((t) => (
                <button key={t.id} onClick={() => openThreadView(t)}
                  className={`w-full text-left p-3 hover:bg-slate-800/60 ${openThread?.id === t.id ? 'bg-slate-800/80' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white truncate">{t.supplier_name}</span>
                    {Number(t.admin_unread || 0) > 0 && <span className="px-1.5 rounded-full bg-pink-500 text-white text-[10px]">{t.admin_unread}</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{t.last_message_preview || t.subject}</p>
                </button>
              ))}
              {threads.length === 0 && <div className="p-6 text-center text-slate-500 text-sm">No conversations yet.</div>}
            </div>
          </div>
          <div className="lg:col-span-2 rounded-xl border border-slate-700 flex flex-col min-h-[460px]">
            {!openThread ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Select a conversation</div>
            ) : (
              <>
                <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{openThread.supplier_name}</p>
                    <p className="text-[11px] text-slate-500">{openThread.supplier_email || 'no email on file'}</p>
                  </div>
                  <button onClick={() => setOpenThread(null)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[320px]">
                  {threadMessages.map((m) => (
                    <div key={m.id} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.sender_role === 'admin' ? 'ml-auto bg-orange-500/20 text-orange-100' : m.sender_role === 'system' ? 'mx-auto bg-slate-800 text-slate-400 text-[11px]' : 'bg-slate-800 text-slate-200'}`}>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className="text-[10px] opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}{m.email_provider ? ` · ${m.email_provider}` : ''}</p>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-slate-800 flex items-center gap-2">
                  <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                    placeholder="Reply to supplier…"
                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none" />
                  <button onClick={sendReply} disabled={!reply.trim()}
                    className="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5">
                    <Send className="h-4 w-4" /> Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {(showCreate || editSupplier) && (
        <SupplierFormModal
          supplier={editSupplier}
          onClose={() => { setShowCreate(false); setEditSupplier(null); }}
          onSaved={() => { setShowCreate(false); setEditSupplier(null); loadSuppliers(); }}
        />
      )}

      {messageSupplier && (
        <SupplierMessageModal
          supplier={messageSupplier}
          onClose={() => setMessageSupplier(null)}
          onSent={() => { setMessageSupplier(null); loadThreads(); setTab('messages'); }}
        />
      )}
    </div>
  );
}

function SupplierFormModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const isEdit = !!supplier;
  const [name, setName] = useState(supplier?.name || '');
  const [category, setCategory] = useState(supplier?.category || 'print-on-demand');
  const [website, setWebsite] = useState(supplier?.website || '');
  const [orderEmail, setOrderEmail] = useState(supplier?.order_email || '');
  const [contactName, setContactName] = useState(supplier?.contact_name || '');
  const [contactPhone, setContactPhone] = useState(supplier?.contact_phone || '');
  const [productCategories, setProductCategories] = useState<string[]>(supplier?.product_categories || []);
  const [notes, setNotes] = useState(supplier?.notes || '');
  const [isActive, setIsActive] = useState(supplier?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const CATEGORIES = ['wearable', 'collectible', 'vinyl', 'poster', 'accessory', 'other'];
  const toggleCat = (c: string) => setProductCategories((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const save = async () => {
    if (!name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), category, website: website || null, orderEmail: orderEmail || null, contactName: contactName || null, contactPhone: contactPhone || null, productCategories, notes: notes || null, isActive };
      if (isEdit) await apiRequest('PUT', `${API}/suppliers/${supplier!.id}`, payload);
      else await apiRequest('POST', `${API}/suppliers`, payload);
      onSaved();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">{isEdit ? 'Edit supplier' : 'Add supplier'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-700 text-slate-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier name" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white outline-none">
              <option value="print-on-demand">Print on demand</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="jewelry">Jewelry</option>
              <option value="vinyl">Vinyl</option>
              <option value="nfc">NFC</option>
              <option value="stickers-packaging">Stickers / packaging</option>
              <option value="custom">Custom</option>
            </select>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://website.com" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white outline-none" />
          </div>
          <input value={orderEmail} onChange={(e) => setOrderEmail(e.target.value)} placeholder="Order email (receives orders directly)" type="email" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white outline-none" />
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white outline-none" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 mb-1.5">Product categories handled</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => toggleCat(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs capitalize ${productCategories.includes(c) ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white outline-none" />
          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
            </label>
          )}
          <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold disabled:opacity-60">
            {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span> : (isEdit ? 'Save changes' : 'Add supplier')}
          </button>
        </div>
      </div>
    </div>
  );
}

function SupplierMessageModal({ supplier, onClose, onSent }: { supplier: Supplier; onClose: () => void; onSent: () => void }) {
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const r = await apiRequest('POST', `${API}/suppliers/${supplier.id}/message`, { subject: subject.trim(), message: message.trim() });
      if (r.emailDelivered) toast({ title: 'Message sent', description: `Delivered to ${supplier.name} via email.` });
      else toast({ title: 'Saved', description: r.emailError || 'No order email on file — message logged only.' });
      onSent();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">Message {supplier.name}</h3>
            <p className="text-[11px] text-slate-500">{supplier.order_email || 'no order email on file'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-700 text-slate-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white outline-none" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message…" rows={5} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white outline-none" />
          <button onClick={send} disabled={sending || !message.trim()} className="w-full py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send via Resend
          </button>
        </div>
      </div>
    </div>
  );
}
