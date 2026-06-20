import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { Package, Eye, X, RefreshCw, Truck, AlertCircle, Plus } from "lucide-react";
import { CreateOrderDialog } from "./create-order-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface PrintfulOrder {
  id: number;
  external_id?: string;
  status: string;
  created: number;
  updated: number;
  recipient: {
    name: string;
    email: string;
    city: string;
    country_name: string;
  };
  items: Array<{
    id: number;
    quantity: number;
    price: string;
    name: string;
    product: {
      image: string;
      name: string;
    };
  }>;
  costs?: {
    currency: string;
    total: string;
  };
  shipments?: Array<{
    carrier: string;
    tracking_number: string;
    tracking_url: string;
  }>;
}

const statusColors: Record<string, string> = {
  draft: 'secondary',
  pending: 'default',
  failed: 'destructive',
  canceled: 'secondary',
  onhold: 'outline',
  inprocess: 'default',
  partial: 'default',
  fulfilled: 'default',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  failed: 'Failed',
  canceled: 'Canceled',
  onhold: 'On Hold',
  inprocess: 'In Process',
  partial: 'Partial',
  fulfilled: 'Completed',
};

export function PrintfulOrders() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<PrintfulOrder | null>(null);

  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['/api/printful/orders', { status: statusFilter !== 'all' ? statusFilter : undefined }],
  });

  const orders: PrintfulOrder[] = ordersData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="select-order-status">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="inprocess">In Process</SelectItem>
              <SelectItem value="fulfilled">Completed</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="px-4 py-2">
            <Package className="h-4 w-4 mr-2" />
            {orders.length} orders
          </Badge>
        </div>
        <div className="flex gap-2">
          <CreateOrderDialog />
          <Button
            variant="outline"
            onClick={() => refetch()}
            data-testid="button-refresh-orders"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
            </Card>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No orders</h3>
          <p className="text-muted-foreground">
            {statusFilter !== 'all'
              ? `No orders with status "${statusLabels[statusFilter] || statusFilter}"`
              : 'You have no orders in Boostify-Prints yet'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold" data-testid={`text-order-${order.id}`}>
                      Order #{order.id}
                    </h3>
                    {order.external_id && (
                      <Badge variant="outline" className="text-xs">
                        {order.external_id}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Customer: {order.recipient.name} ({order.recipient.email})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.recipient.city}, {order.recipient.country_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Created: {format(new Date(order.created * 1000), 'PPp')}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={statusColors[order.status] as any} className="mb-2">
                    {statusLabels[order.status] || order.status}
                  </Badge>
                  {order.costs && (
                    <p className="text-lg font-bold text-orange-500">
                      {order.costs.currency} ${order.costs.total}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {order.items.length} {order.items.length === 1 ? 'product' : 'products'}
                </span>
                {order.shipments && order.shipments.length > 0 && (
                  <>
                    <Truck className="h-4 w-4 text-muted-foreground ml-4" />
                    <span className="text-sm text-muted-foreground">
                      {order.shipments.length} {order.shipments.length === 1 ? 'shipment' : 'shipments'}
                    </span>
                  </>
                )}
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedOrder(order)}
                    data-testid={`button-view-order-${order.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Order Details #{order.id}</DialogTitle>
                    <DialogDescription>
                      Created on {format(new Date(order.created * 1000), 'PPP')}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 mt-4">
                    <div>
                      <h4 className="font-semibold mb-3">Status</h4>
                      <Badge variant={statusColors[order.status] as any} className="text-lg px-4 py-2">
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">Customer Information</h4>
                      <div className="bg-muted p-4 rounded-lg space-y-2">
                        <p><strong>Name:</strong> {order.recipient.name}</p>
                        <p><strong>Email:</strong> {order.recipient.email}</p>
                        <p><strong>Location:</strong> {order.recipient.city}, {order.recipient.country_name}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">Products ({order.items.length})</h4>
                      <div className="space-y-3">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg">
                            <img
                              src={item.product.image}
                              alt={item.product.name}
                              className="w-16 h-16 object-contain rounded"
                            />
                            <div className="flex-1">
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                            </div>
                            <p className="font-semibold">${item.price}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.costs && (
                      <div>
                        <h4 className="font-semibold mb-3">Costs</h4>
                        <div className="bg-muted p-4 rounded-lg">
                          <div className="flex items-center justify-between text-xl font-bold">
                            <span>Total</span>
                            <span className="text-orange-500">
                              {order.costs.currency} ${order.costs.total}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.shipments && order.shipments.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Shipments ({order.shipments.length})</h4>
                        <div className="space-y-3">
                          {order.shipments.map((shipment, idx) => (
                            <div key={idx} className="p-4 border rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <Truck className="h-4 w-4 text-orange-500" />
                                <p className="font-medium">{shipment.carrier}</p>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                Tracking: {shipment.tracking_number}
                              </p>
                              {shipment.tracking_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(shipment.tracking_url, '_blank')}
                                >
                                  Track Shipment
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
