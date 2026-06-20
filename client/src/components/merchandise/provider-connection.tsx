import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Star, MapPin, Package, Truck, Shield, CheckCircle } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  rating: number;
  location: string;
  specialties: string[];
  minimumOrder: number;
  productionTime: string;
  verified: boolean;
  image: string;
}

const providers: Provider[] = [
  {
    id: "1",
    name: "GlobalMerch Prints",
    rating: 4.8,
    location: "Los Angeles, CA",
    specialties: ["T-Shirts", "Hoodies", "Accessories"],
    minimumOrder: 50,
    productionTime: "5-7 business days",
    verified: true,
    image: "/assets/providers/provider1.jpg"
  },
  {
    id: "2",
    name: "ArtisanWear Pro",
    rating: 4.9,
    location: "New York, NY",
    specialties: ["Premium Apparel", "Custom Packaging", "Eco-Friendly"],
    minimumOrder: 100,
    productionTime: "7-10 business days",
    verified: true,
    image: "/assets/providers/provider2.jpg"
  },
  {
    id: "3",
    name: "MusicMerch Solutions",
    rating: 4.7,
    location: "Nashville, TN",
    specialties: ["Band Merchandise", "Tour Supplies", "Vinyl Products"],
    minimumOrder: 25,
    productionTime: "3-5 business days",
    verified: true,
    image: "/assets/providers/provider3.jpg"
  }
];

export function ProviderConnection() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((provider) => (
          <Card key={provider.id} className="overflow-hidden group">
            <div className="aspect-video bg-orange-500/10 relative">
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">{provider.name}</h3>
                  {provider.verified && (
                    <Badge className="bg-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-white/90 mt-2">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span>{provider.rating}</span>
                  <span className="text-white/60">|</span>
                  <MapPin className="w-4 h-4" />
                  <span>{provider.location}</span>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {provider.specialties.map((specialty, index) => (
                  <Badge key={index} variant="secondary">
                    {specialty}
                  </Badge>
                ))}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-orange-500" />
                  <span>Minimum Order: {provider.minimumOrder} units</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="w-4 h-4 text-orange-500" />
                  <span>Production Time: {provider.productionTime}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-orange-500" />
                  <span>Quality Guaranteed</span>
                </div>
              </div>
              
              <div className="flex gap-3 mt-4">
                <Button className="flex-1 bg-orange-500 hover:bg-orange-600">
                  Contact Provider
                </Button>
                <Button variant="outline" className="flex-1">
                  View Catalog
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      <Card className="p-6 bg-orange-500/5 border-orange-500/20">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-orange-500/10">
            <Shield className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-2">Provider Verification</h4>
            <p className="text-muted-foreground">
              All our providers are thoroughly vetted and must maintain high quality standards.
              We ensure reliable production, shipping, and customer service.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
