import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useToast } from "../../hooks/use-toast";
import { queryClient, apiRequest } from "../../lib/queryClient";
import { Loader2, ShoppingCart, Plus, Minus, DollarSign } from "lucide-react";
import { Card } from "../ui/card";

interface SyncProduct {
  id: number;
  external_id: string;
  name: string;
  variants: number;
  thumbnail_url?: string;
}

interface SyncVariant {
  id: number;
  external_id?: string;
  sync_product_id: number;
  name: string;
  synced: boolean;
  variant_id: number;
  retail_price?: string;
  product?: {
    variant_id: number;
    product_id: number;
    image: string;
    name: string;
  };
}

interface OrderItem {
  sync_variant_id: number;
  quantity: number;
  variant: SyncVariant;
}

interface CreateOrderDialogProps {
  trigger?: React.ReactNode;
}

export function CreateOrderDialog({ trigger }: CreateOrderDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'products' | 'shipping' | 'review'>('products');
  
  // Order items
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  
  // Shipping info
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [shippingMethod, setShippingMethod] = useState("STANDARD");

  // Cost estimate
  const [estimatedCost, setEstimatedCost] = useState<any>(null);

  const { data: syncProductsData } = useQuery({
    queryKey: ['/api/printful/sync/products'],
    enabled: open,
  });

  const { data: variantsData } = useQuery({
    queryKey: ['/api/printful/sync/products', selectedProductId, 'variants'],
    enabled: !!selectedProductId && open,
  });

  const syncProducts: SyncProduct[] = syncProductsData?.data || [];
  const syncVariants: SyncVariant[] = variantsData?.data || [];

  const estimateMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return await apiRequest('/api/printful/orders/estimate', {
        method: 'POST',
        body: JSON.stringify(orderData),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: (data) => {
      setEstimatedCost(data.data);
      setStep('review');
    },
    onError: (error: any) => {
      toast({
        title: "Error estimating costs",
        description: error.message || "Could not calculate order cost",
        variant: "destructive",
      });
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async ({ orderData, confirm }: { orderData: any; confirm: boolean }) => {
      return await apiRequest('/api/printful/orders', {
        method: 'POST',
        body: JSON.stringify({ orderData, confirm }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Order Created",
        description: `Order #${data.data.id} created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/printful/orders'] });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error creating order",
        description: error.message || "Could not create order",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStep('products');
    setOrderItems([]);
    setSelectedProductId("");
    setSelectedVariantId("");
    setCustomerName("");
    setCustomerEmail("");
    setAddress1("");
    setCity("");
    setStateCode("");
    setCountryCode("US");
    setZip("");
    setPhone("");
    setShippingMethod("STANDARD");
    setEstimatedCost(null);
  };

  const addItemToOrder = () => {
    if (!selectedVariantId) return;
    
    const variant = syncVariants.find(v => v.id.toString() === selectedVariantId);
    if (!variant) return;

    const existingItem = orderItems.find(item => item.sync_variant_id === variant.id);
    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item.sync_variant_id === variant.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems([...orderItems, {
        sync_variant_id: variant.id,
        quantity: 1,
        variant,
      }]);
    }

    setSelectedVariantId("");
  };

  const updateItemQuantity = (syncVariantId: number, delta: number) => {
    setOrderItems(items =>
      items.map(item =>
        item.sync_variant_id === syncVariantId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const removeItem = (syncVariantId: number) => {
    setOrderItems(items => items.filter(item => item.sync_variant_id !== syncVariantId));
  };

  const handleEstimate = () => {
    if (orderItems.length === 0) {
      toast({
        title: "Add products",
        description: "You must add at least one product to the order",
        variant: "destructive",
      });
      return;
    }

    if (!customerName || !customerEmail || !address1 || !city || !stateCode || !zip) {
      toast({
        title: "Incomplete information",
        description: "Please complete all shipping information",
        variant: "destructive",
      });
      return;
    }

    const orderData = {
      shipping: shippingMethod,
      recipient: {
        name: customerName,
        email: customerEmail,
        address1,
        city,
        state_code: stateCode,
        country_code: countryCode,
        zip,
        ...(phone && { phone }),
      },
      items: orderItems.map(item => ({
        sync_variant_id: item.sync_variant_id,
        quantity: item.quantity,
      })),
    };

    estimateMutation.mutate(orderData);
  };

  const handleCreateOrder = (confirm: boolean) => {
    const orderData = {
      shipping: shippingMethod,
      recipient: {
        name: customerName,
        email: customerEmail,
        address1,
        city,
        state_code: stateCode,
        country_code: countryCode,
        zip,
        ...(phone && { phone }),
      },
      items: orderItems.map(item => ({
        sync_variant_id: item.sync_variant_id,
        quantity: item.quantity,
      })),
    };

    createOrderMutation.mutate({ orderData, confirm });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-orange-500 hover:bg-orange-600" data-testid="button-open-create-order">
            <ShoppingCart className="h-4 w-4 mr-2" />
            New Order
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Order in Boostify-Prints</DialogTitle>
          <DialogDescription>
            {step === 'products' && 'Select products for the order'}
            {step === 'shipping' && 'Enter customer shipping information'}
            {step === 'review' && 'Review and confirm the order'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step: Products */}
          {step === 'products' && (
            <>
              <div className="space-y-4">
                <Label>Add Products</Label>
                <div className="flex gap-2">
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="flex-1" data-testid="select-product">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {syncProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select
                    value={selectedVariantId}
                    onValueChange={setSelectedVariantId}
                    disabled={!selectedProductId}
                  >
                    <SelectTrigger className="flex-1" data-testid="select-variant">
                      <SelectValue placeholder="Select a variant" />
                    </SelectTrigger>
                    <SelectContent>
                      {syncVariants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id.toString()}>
                          {variant.name} - ${variant.retail_price || 'N/A'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button
                    onClick={addItemToOrder}
                    disabled={!selectedVariantId}
                    data-testid="button-add-item"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Order items */}
              {orderItems.length > 0 && (
                <div className="space-y-3">
                  <Label>Products in Order ({orderItems.length})</Label>
                  {orderItems.map((item) => (
                    <Card key={item.sync_variant_id} className="p-3">
                      <div className="flex items-center gap-3">
                        {item.variant.product?.image && (
                          <img
                            src={item.variant.product.image}
                            alt={item.variant.name}
                            className="w-16 h-16 object-contain rounded"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{item.variant.name}</p>
                          <p className="text-sm text-muted-foreground">
                            ${item.variant.retail_price} each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateItemQuantity(item.sync_variant_id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateItemQuantity(item.sync_variant_id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeItem(item.sync_variant_id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step: Shipping */}
          {step === 'shipping' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="customer-name">Full Name *</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Doe"
                  data-testid="input-customer-name"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="customer-email">Email *</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="john@example.com"
                  data-testid="input-customer-email"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  placeholder="123 Main Street"
                  data-testid="input-address"
                />
              </div>
              
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Miami"
                  data-testid="input-city"
                />
              </div>
              
              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  placeholder="FL"
                  maxLength={2}
                  data-testid="input-state"
                />
              </div>
              
              <div>
                <Label htmlFor="country">Country *</Label>
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger data-testid="select-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="MX">Mexico</SelectItem>
                    <SelectItem value="ES">Spain</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="zip">Zip Code *</Label>
                <Input
                  id="zip"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="33101"
                  data-testid="input-zip"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 305 555 0123"
                  data-testid="input-phone"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="shipping">Shipping Method</Label>
                <Select value={shippingMethod} onValueChange={setShippingMethod}>
                  <SelectTrigger data-testid="select-shipping">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard (5-7 days)</SelectItem>
                    <SelectItem value="EXPEDITED">Express (2-3 days)</SelectItem>
                    <SelectItem value="PRIORITY">Priority (1-2 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && estimatedCost && (
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Order Summary</h4>
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div key={item.sync_variant_id} className="flex justify-between text-sm">
                      <span>{item.variant.name} x {item.quantity}</span>
                      <span>${(parseFloat(item.variant.retail_price || '0') * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Shipping Information</h4>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>{customerName}</p>
                  <p>{customerEmail}</p>
                  <p>{address1}</p>
                  <p>{city}, {stateCode} {zip}</p>
                  <p>{countryCode}</p>
                </div>
              </div>

              {estimatedCost.costs && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Estimated Costs</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>${estimatedCost.costs.subtotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shipping:</span>
                      <span>${estimatedCost.costs.shipping}</span>
                    </div>
                    {estimatedCost.costs.tax !== '0.00' && (
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>${estimatedCost.costs.tax}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span className="text-orange-500">
                        {estimatedCost.costs.currency} ${estimatedCost.costs.total}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex gap-2">
            {step !== 'products' && (
              <Button
                variant="outline"
                onClick={() => setStep(step === 'review' ? 'shipping' : 'products')}
                disabled={estimateMutation.isPending || createOrderMutation.isPending}
              >
                Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={estimateMutation.isPending || createOrderMutation.isPending}
            >
              Cancel
            </Button>
            
            {step === 'products' && (
              <Button
                onClick={() => setStep('shipping')}
                disabled={orderItems.length === 0}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Continue
              </Button>
            )}
            
            {step === 'shipping' && (
              <Button
                onClick={handleEstimate}
                disabled={estimateMutation.isPending}
                className="bg-orange-500 hover:bg-orange-600"
                data-testid="button-estimate-order"
              >
                {estimateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Estimating...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Estimate Costs
                  </>
                )}
              </Button>
            )}
            
            {step === 'review' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleCreateOrder(false)}
                  disabled={createOrderMutation.isPending}
                >
                  Save Draft
                </Button>
                <Button
                  onClick={() => handleCreateOrder(true)}
                  disabled={createOrderMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-600"
                  data-testid="button-confirm-order"
                >
                  {createOrderMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Confirm Order
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
