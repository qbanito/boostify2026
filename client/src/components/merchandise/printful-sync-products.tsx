import { useQuery } from "@tanstack/react-query";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { Package, RefreshCw, ExternalLink } from "lucide-react";

interface SyncProduct {
  id: number;
  external_id: string;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url?: string;
  is_ignored: boolean;
}

export function PrintfulSyncProducts() {
  const { data: syncProductsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/printful/sync/products'],
  });

  const products: SyncProduct[] = syncProductsData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Synced Products</h3>
          <Badge variant="outline" className="px-4 py-2">
            <Package className="h-4 w-4 mr-2" />
            {products.length} products
          </Badge>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          data-testid="button-refresh-sync-products"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No synced products</h3>
          <p className="text-muted-foreground mb-6">
            You haven't synced any products with Boostify-Prints yet. Browse the catalog to add products.
          </p>
          <Button className="bg-orange-500 hover:bg-orange-600">
            <Package className="h-4 w-4 mr-2" />
            View Catalog
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card
              key={product.id}
              className="overflow-hidden group hover:shadow-xl transition-all duration-300"
            >
              <div className="aspect-square relative overflow-hidden bg-white">
                {product.thumbnail_url ? (
                  <img
                    src={product.thumbnail_url}
                    alt={product.name}
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500/10 to-orange-500/5">
                    <Package className="h-16 w-16 text-orange-500/30" />
                  </div>
                )}
                {product.is_ignored && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary">Ignored</Badge>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2 line-clamp-2" data-testid={`text-sync-product-${product.id}`}>
                  {product.name}
                </h3>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">External ID:</span>
                    <span className="font-mono text-xs">{product.external_id}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Variants:</span>
                    <Badge variant="outline">{product.variants}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Synced:</span>
                    <Badge variant={product.synced > 0 ? "default" : "secondary"}>
                      {product.synced}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    window.open(`/merchandise/products/${product.id}`, '_blank');
                  }}
                  data-testid={`button-view-sync-product-${product.id}`}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
