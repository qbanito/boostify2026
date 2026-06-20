import { useState, useEffect } from 'react';
import { ExtraServiceCard } from './extra-services-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Sparkles, AlertCircle } from 'lucide-react';
import { FIVERR_SERVICES_DATA } from '@/lib/fiverr-services-data';

interface ExtraServicesSectionProps {
  category: 'youtube_boost' | 'spotify_boost' | 'instagram_boost';
  title?: string;
  description?: string;
  onOrderCreated?: () => void;
}

export function ExtraServicesSection({
  category,
  title = 'Creator Services',
  description = 'Get premium services from verified creators to boost your presence',
  onOrderCreated,
}: ExtraServicesSectionProps) {
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading delay for better UX
    const timer = setTimeout(() => {
      try {
        // Use real data from processed Fiverr dataset
        const categoryServices = FIVERR_SERVICES_DATA[category] || [];
        setServices(categoryServices);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load services');
        console.error('Error loading services:', err);
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [category]);

  if (isLoading) {
    return (
      <div className="space-y-6 py-8">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-1" />
          <div className="flex-1">
            <h3 className="text-2xl font-bold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-yellow-200 bg-yellow-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-1" />
          <div>
            <h4 className="font-semibold text-yellow-900">{error}</h4>
            <p className="text-sm text-yellow-700 mt-1">Please refresh the page to try again or contact support.</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!services || services.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">No services available in this category at this time.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-2xl font-bold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {services.map((service: any) => (
          <ExtraServiceCard
            key={service.id}
            id={service.id}
            title={service.title}
            description={service.description}
            price={service.price}
            rating={service.sellerRating}
            reviews={service.sellerReviews}
            image={service.imageUrl}
            extraFast={service.extraFast}
            category={category}
            sellerDisplayName={service.sellerDisplayName}
            deliveryDays={service.deliveryDays}
            stripePrice={service.stripePrice}
            onOrderCreated={onOrderCreated}
          />
        ))}
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <span className="text-primary font-semibold mt-0.5">💡</span>
          <span>All services are delivered by verified industry professionals. Services are charged separately via secure checkout. Available to all Boostify users.</span>
        </p>
      </div>
    </div>
  );
}
