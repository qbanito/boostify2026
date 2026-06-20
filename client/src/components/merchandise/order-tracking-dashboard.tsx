/**
 * OrderTrackingDashboard
 * ─────────────────────────────────────────────────────────────
 * Artist-facing order tracking panel for the Merch Store page.
 * Reads from /api/merch/orders which returns the artist's own
 * sales_transactions rows with an aggregate summary.
 *
 * Design: dark theme, orange-500 accents, slate backgrounds
 * (matches the rest of the /merchandise page).
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  Package,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Receipt,
  Truck,
  Box,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type OrderStatus = "pending" | "completed" | "refunded" | "cancelled";

interface MerchOrder {
  id: number;
  artistId: number;
  merchandiseId: number | null;
  productName: string;
  saleAmount: string;
  productionCost: string;
  artistEarning: string;
  platformFee: string;
  commissionRate: number;
  quantity: number;
  currency: string;
  buyerEmail: string | null;
  stripePaymentId: string | null;
  status: OrderStatus;
  createdAt: string;
}

interface OrderSummary {
  pending: number;
  completed: number;
  refunded: number;
  cancelled: number;
  totalRevenue: number;
  totalEarning: number;
}

interface OrdersResponse {
  orders: MerchOrder[];
  total: number;
  summary: OrderSummary;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; badgeClass: string; icon: React.FC<{ className?: string }> }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-400",
    badgeClass: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
    icon: Clock,
  },
  completed: {
    label: "Completed",
    color: "text-green-400",
    badgeClass: "bg-green-400/10 text-green-400 border-green-400/30",
    icon: CheckCircle2,
  },
  refunded: {
    label: "Refunded",
    color: "text-blue-400",
    badgeClass: "bg-blue-400/10 text-blue-400 border-blue-400/30",
    icon: RotateCcw,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-slate-400",
    badgeClass: "bg-slate-400/10 text-slate-400 border-slate-400/30",
    icon: XCircle,
  },
};

// Visual step timeline for an order (maps status → position in funnel)
const ORDER_STEPS: { key: OrderStatus | "processing"; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: "pending",    label: "Order Placed",    icon: ShoppingCart },
  { key: "processing", label: "Processing",       icon: Box },
  { key: "completed",  label: "Completed",        icon: CheckCircle2 },
];

function getStepIndex(status: OrderStatus): number {
  if (status === "completed") return 2;
  if (status === "pending")   return 0;
  return -1; // refunded / cancelled — shown separately
}

function fmt(amount: string | number, currency = "USD"): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(n);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryStat({
  label,
  value,
  subValue,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.FC<{ className?: string }>;
  color: string;
}) {
  return (
    <Card className="p-4 bg-slate-900/60 border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-slate-800/80`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.badgeClass}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "refunded" || status === "cancelled") {
    const cfg = STATUS_CONFIG[status];
    const Icon = cfg.icon;
    return (
      <div className={`flex items-center gap-2 text-sm ${cfg.color}`}>
        <Icon className="h-4 w-4" />
        <span>{cfg.label}</span>
      </div>
    );
  }

  const activeStep = getStepIndex(status);

  return (
    <div className="flex items-center gap-1">
      {ORDER_STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i <= activeStep;
        const active = i === activeStep;
        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full border transition-all ${
                done
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-slate-800 border-slate-600 text-slate-500"
              } ${active ? "ring-2 ring-orange-500/40" : ""}`}
              title={step.label}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            {i < ORDER_STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 transition-colors ${
                  i < activeStep ? "bg-orange-500" : "bg-slate-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrderDetailDialog({
  order,
  open,
  onClose,
}: {
  order: MerchOrder | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-orange-500" />
            Order #{order.id}
          </DialogTitle>
          <DialogDescription>
            Placed on {format(new Date(order.createdAt), "PPP")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Status timeline */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Status
            </p>
            <OrderTimeline status={order.status} />
          </div>

          {/* Product info */}
          <div className="rounded-lg bg-slate-800/60 p-4 space-y-2">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10 mt-0.5">
                <Package className="h-4 w-4 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{order.productName}</p>
                <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-orange-500">{fmt(order.saleAmount, order.currency)}</p>
                <p className="text-xs text-muted-foreground">Sale price</p>
              </div>
            </div>
          </div>

          {/* Financials */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Financials
            </p>
            <div className="space-y-1.5 text-sm">
              {[
                { label: "Sale amount",     value: fmt(order.saleAmount, order.currency) },
                { label: "Production cost", value: fmt(order.productionCost, order.currency) },
                { label: "Platform fee",    value: fmt(order.platformFee, order.currency) },
                { label: "Your earning",    value: fmt(order.artistEarning, order.currency), highlight: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={row.highlight ? "font-semibold text-green-400" : ""}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Buyer */}
          {order.buyerEmail && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Buyer
              </p>
              <p className="text-sm">{order.buyerEmail}</p>
            </div>
          )}

          {/* Payment ref */}
          {order.stripePaymentId && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Payment reference
              </p>
              <code className="text-xs text-muted-foreground break-all">
                {order.stripePaymentId}
              </code>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OrderTrackingDashboard() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<MerchOrder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const queryKey = ["/api/merch/orders", { status: statusFilter !== "all" ? statusFilter : undefined }];

  const { data, isLoading, isError, refetch, isFetching } = useQuery<OrdersResponse>({
    queryKey,
    staleTime: 30_000,
  });

  const summary = data?.summary;

  // Client-side search/filter (fast, no round-trip)
  const visibleOrders = useMemo<MerchOrder[]>(() => {
    const orders = data?.orders ?? [];
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      o =>
        o.productName.toLowerCase().includes(q) ||
        (o.buyerEmail ?? "").toLowerCase().includes(q) ||
        String(o.id).includes(q)
    );
  }, [data?.orders, search]);

  const openDetail = (order: MerchOrder) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))
        ) : (
          <>
            <SummaryStat
              label="Total Revenue"
              value={fmt(summary?.totalRevenue ?? 0)}
              subValue={`${(summary?.completed ?? 0)} completed`}
              icon={DollarSign}
              color="text-green-400"
            />
            <SummaryStat
              label="Your Earnings"
              value={fmt(summary?.totalEarning ?? 0)}
              icon={TrendingUp}
              color="text-orange-500"
            />
            <SummaryStat
              label="Pending"
              value={summary?.pending ?? 0}
              icon={Clock}
              color="text-yellow-400"
            />
            <SummaryStat
              label="Cancelled / Refunded"
              value={(summary?.cancelled ?? 0) + (summary?.refunded ?? 0)}
              icon={XCircle}
              color="text-slate-400"
            />
          </>
        )}
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product, buyer email, or order ID…"
            className="pl-9 bg-slate-900/60 border-slate-700/50"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-slate-900/60 border-slate-700/50">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh"
          className="border-slate-700/50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Order list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card className="p-10 text-center bg-slate-900/60 border-slate-700/50">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="font-medium">Failed to load orders</p>
          <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      ) : visibleOrders.length === 0 ? (
        <Card className="p-12 text-center bg-slate-900/60 border-slate-700/50">
          <Truck className="h-14 w-14 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-1">No orders yet</h3>
          <p className="text-sm text-muted-foreground">
            {search
              ? "No orders match your search."
              : "Once fans purchase your merch, orders will appear here."}
          </p>
        </Card>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {visibleOrders.map((order, i) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: i * 0.02 }}
              >
                <Card className="p-4 bg-slate-900/60 border-slate-700/50 hover:border-orange-500/30 transition-colors group cursor-pointer" onClick={() => openDetail(order)}>
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="p-2.5 rounded-xl bg-orange-500/10 shrink-0">
                      <Package className="h-5 w-5 text-orange-500" />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold truncate">{order.productName}</span>
                        <span className="text-xs text-muted-foreground shrink-0">#{order.id}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>Qty: {order.quantity}</span>
                        {order.buyerEmail && <span className="truncate max-w-[180px]">{order.buyerEmail}</span>}
                        <span>{format(new Date(order.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    </div>

                    {/* Timeline (hide on small screens) */}
                    <div className="hidden md:block shrink-0">
                      <OrderTimeline status={order.status} />
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-orange-500">{fmt(order.saleAmount, order.currency)}</p>
                      <p className="text-xs text-green-400">+{fmt(order.artistEarning, order.currency)}</p>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-orange-500 transition-colors shrink-0" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Footer count */}
      {!isLoading && visibleOrders.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Showing {visibleOrders.length} order{visibleOrders.length !== 1 ? "s" : ""}
          {search ? " matching your search" : ""}
        </p>
      )}

      {/* Detail dialog */}
      <OrderDetailDialog
        order={selectedOrder}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

export default OrderTrackingDashboard;
