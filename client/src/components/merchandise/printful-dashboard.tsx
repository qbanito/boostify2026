import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Package, ShoppingCart, Store, AlertCircle, CheckCircle, Printer, Shield, Settings, Megaphone, BarChart3 } from "lucide-react";
import { PrintfulCatalog } from "./printful-catalog";
import { PrintfulOrders } from "./printful-orders";
import { PrintfulSyncProducts } from "./printful-sync-products";
import { StoreManager } from "./store-manager";
import { MarketingHub } from "./marketing-hub";
import { AnalyticsDashboardReal } from "./analytics-dashboard-real";
import { Skeleton } from "../ui/skeleton";

interface BoostifyPrintsStoreInfo {
  id: number;
  type: string;
  name: string;
  website: string;
  currency: string;
  created: number;
}

export function PrintfulDashboard() {
  const [activeTab, setActiveTab] = useState("store-manager");

  const { data: storeData, isLoading: loadingStore, error } = useQuery({
    queryKey: ['/api/printful/store'],
  });

  const storeInfo: BoostifyPrintsStoreInfo | null = storeData?.data || null;
  const isConnected = !error && storeInfo !== null;

  return (
    <div className="space-y-6">
      {/* Admin Notice */}
      <Card className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Shield className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="font-medium text-blue-400">Admin Only</p>
            <p className="text-sm text-muted-foreground">
              API connections and production settings can only be configured by platform administrators.
            </p>
          </div>
        </div>
      </Card>

      {/* Header with connection status */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
              <Printer className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Boostify-Prints Integration</h2>
              {loadingStore ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ) : isConnected && storeInfo ? (
                <>
                  <p className="text-muted-foreground mb-2">
                    Connected to: <span className="font-medium">{storeInfo.name}</span>
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Type: {storeInfo.type}</span>
                    <span>•</span>
                    <span>Currency: {storeInfo.currency}</span>
                    {storeInfo.website && (
                      <>
                        <span>•</span>
                        <span>Website: {storeInfo.website}</span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>Could not connect to Boostify-Prints</span>
                </div>
              )}
            </div>
          </div>
          {!loadingStore && (
            <Badge
              variant={isConnected ? "default" : "destructive"}
              className="px-4 py-2"
            >
              {isConnected ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Connected
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Disconnected
                </>
              )}
            </Badge>
          )}
        </div>
      </Card>

      {/* Tabs for different sections */}
      {isConnected && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="store-manager" data-testid="tab-store-manager">
              <Settings className="h-4 w-4 mr-2" />
              Store Manager
            </TabsTrigger>
            <TabsTrigger value="catalog" data-testid="tab-catalog">
              <Store className="h-4 w-4 mr-2" />
              My Catalog
            </TabsTrigger>
            <TabsTrigger value="sync" data-testid="tab-sync">
              <Package className="h-4 w-4 mr-2" />
              My Products
            </TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="marketing" data-testid="tab-marketing">
              <Megaphone className="h-4 w-4 mr-2" />
              Marketing
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="store-manager" className="mt-6">
            <StoreManager />
          </TabsContent>

          <TabsContent value="catalog" className="mt-6">
            <PrintfulCatalog />
          </TabsContent>

          <TabsContent value="sync" className="mt-6">
            <PrintfulSyncProducts />
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <PrintfulOrders />
          </TabsContent>

          <TabsContent value="marketing" className="mt-6">
            <MarketingHub />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <AnalyticsDashboardReal />
          </TabsContent>
        </Tabs>
      )}

      {/* Error message if not connected */}
      {!loadingStore && !isConnected && (
        <Card className="p-12 text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h3 className="text-xl font-semibold mb-2">Could not connect to Boostify-Prints</h3>
          <p className="text-muted-foreground mb-4">
            Contact an administrator to configure the API connection.
          </p>
          <p className="text-sm text-muted-foreground">
            Error: {error?.message || 'Connection failed'}
          </p>
        </Card>
      )}
    </div>
  );
}
