import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Zap, Users, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';

interface ExtraServiceCardProps {
  id: number;
  title: string;
  description?: string;
  price: number;
  rating: number;
  reviews: number;
  image?: string;
  extraFast?: boolean;
  category: string;
  sellerDisplayName?: string;
  deliveryDays?: number;
  stripePrice?: string;
  onOrderCreated?: () => void;
}

export function ExtraServiceCard({
  id,
  title,
  description,
  price,
  rating,
  reviews,
  image,
  extraFast,
  category,
  sellerDisplayName,
  deliveryDays = 1,
  stripePrice,
  onOrderCreated,
}: ExtraServiceCardProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    try {
      setLoading(true);

      // Best-effort: create a tracking order. Never block checkout if this fails
      // (e.g. user not logged in, DB temporarily unavailable, webhook offline).
      try {
        await apiRequest('/api/services/order', {
          method: 'POST',
          body: JSON.stringify({
            serviceId: id,
            quantity: 1,
            category,
            serviceName: title,
            price,
          }),
        });
      } catch (orderErr) {
        console.warn('[checkout] order pre-tracking skipped:', orderErr);
      }

      // Redirect to Stripe checkout (works for guests and authenticated users)
      const response = await fetch('/api/services/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          serviceId: id,
          quantity: 1,
          serviceName: title,
          price,
          category,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Checkout failed (${response.status})`);
      }

      const data = await response.json();
      if (data.success && data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
        return;
      }

      throw new Error('No checkout URL received');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to checkout',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }

    onOrderCreated?.();
  };

  return (
    <Card className="group overflow-hidden hover:shadow-xl hover:border-primary/50 transition-all duration-300 border border-border/50 bg-gradient-to-br from-background to-background/80">
      {/* Image Container */}
      <div className="relative h-48 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden border-b border-border/50">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Zap className="w-12 h-12 text-primary/30" />
          </div>
        )}
        
        {/* Badge: Fast Delivery */}
        {extraFast && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-orange-500/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg">
            <Zap className="w-3.5 h-3.5" />
            Fast
          </div>
        )}

        {/* Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      <CardContent className="p-5 space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-sm line-clamp-2 text-foreground leading-tight group-hover:text-primary transition-colors">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}

        {/* Seller Info */}
        {sellerDisplayName && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span className="truncate">{sellerDisplayName}</span>
          </div>
        )}

        {/* Rating & Reviews */}
        <div className="flex items-center justify-between py-2 border-y border-border/50">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-semibold">{rating.toFixed(2)}</span>
            </div>
            <span className="text-xs text-muted-foreground">({reviews.toLocaleString()})</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            {deliveryDays}d
          </div>
        </div>

        {/* Price */}
        <div className="space-y-2">
          <div className="text-2xl font-bold text-primary">
            ${price.toFixed(2)}
          </div>
        </div>

        {/* Checkout Button */}
        <Button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 font-semibold shadow-md hover:shadow-lg transition-all"
          size="sm"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            'Pay with Stripe'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
