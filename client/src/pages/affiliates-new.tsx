import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { AffiliateOverview } from "../components/affiliates/overview";
import { AffiliateLinks } from "../components/affiliates/links";
import { AffiliateEarnings } from "../components/affiliates/earnings";
import { AffiliateContentGenerator } from "../components/affiliates/content-generator";
import { AffiliateCoupons } from "../components/affiliates/coupons";
import { AffiliatePromotions } from "../components/affiliates/promotions";
import { AffiliateBadges } from "../components/affiliates/badges";
import { AffiliateReferrals } from "../components/affiliates/referrals";
import { AffiliateMarketingMaterials } from "../components/affiliates/marketing-materials";
import { AffiliateSettings } from "../components/affiliates/settings";
import { useAuth } from "../hooks/use-auth";
import { Badge } from "../components/ui/badge";
import { 
  LineChart, 
  Sparkles, 
  Award, 
  DollarSign, 
  Link as LinkIcon, 
  Ticket,
  Globe,
  UserPlus,
  Zap,
  Settings2
} from "lucide-react";

export default function AffiliatesNewPage() {
  const { user } = useAuth() || {};
  const [activeTab, setActiveTab] = useState("overview");

  // Mock affiliate data for testing - bypassing API call
  const currentAffiliateData = {
    id: user?.uid || "2",
    level: "Platino",
    fullName: "Admin User",
    email: "admin@boostify.com",
    status: "approved",
    stats: {
      totalClicks: 125,
      conversions: 8,
      earnings: 240.50,
      pendingPayment: 120.25,
    },
    links: [],
    paymentHistory: [],
    savedContent: []
  };

  const isAffiliate = true; // Force true for testing

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header del dashboard */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-lg border border-primary/10 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Dashboard de Afiliados (Nueva Versión)
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    ¡Bienvenido! Rastrea tu rendimiento y accede a todas las herramientas de afiliados.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
                  <Badge variant="outline" className="text-sm py-2 px-4 flex items-center gap-2 border-primary/20 bg-primary/10 text-primary">
                    <Award className="h-4 w-4 text-yellow-500" />
                    <span>Nivel {currentAffiliateData.level || "Básico"}</span>
                  </Badge>
                  <Badge variant="secondary" className="text-sm py-2 px-4">
                    ID: {user?.uid?.substring(0, 8) || ""}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 bg-background/80 p-4 rounded-lg border border-primary/5">
                <div className="flex flex-col items-center p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{currentAffiliateData.stats?.totalClicks?.toLocaleString() || "0"}</div>
                  <div className="text-xs text-muted-foreground mt-1">Clics Totales</div>
                </div>
                <div className="flex flex-col items-center p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{currentAffiliateData.stats?.conversions?.toLocaleString() || "0"}</div>
                  <div className="text-xs text-muted-foreground mt-1">Conversiones</div>
                </div>
                <div className="flex flex-col items-center p-3 text-center">
                  <div className="text-2xl font-bold text-primary">${currentAffiliateData.stats?.earnings?.toLocaleString() || "0"}</div>
                  <div className="text-xs text-muted-foreground mt-1">Ganancias Totales</div>
                </div>
                <div className="flex flex-col items-center p-3 text-center">
                  <div className="text-2xl font-bold text-primary">${currentAffiliateData.stats?.pendingPayment?.toLocaleString() || "0"}</div>
                  <div className="text-xs text-muted-foreground mt-1">Pago Pendiente</div>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-8">
            {/* Tabs para escritorio */}
            <div className="overflow-x-auto">
              <TabsList className="inline-flex gap-2 w-auto">
                <TabsTrigger value="overview" className="flex items-center gap-1.5 px-4">
                  <LineChart className="h-4 w-4" />
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger value="links" className="flex items-center gap-1.5 px-4">
                  <LinkIcon className="h-4 w-4" />
                  <span>Enlaces</span>
                </TabsTrigger>
                <TabsTrigger value="earnings" className="flex items-center gap-1.5 px-4">
                  <DollarSign className="h-4 w-4" />
                  <span>Ganancias</span>
                </TabsTrigger>
                <TabsTrigger value="coupons" className="flex items-center gap-1.5 px-4">
                  <Ticket className="h-4 w-4" />
                  <span>Cupones</span>
                </TabsTrigger>
                <TabsTrigger value="promotions" className="flex items-center gap-1.5 px-4">
                  <Zap className="h-4 w-4" />
                  <span>Promociones</span>
                </TabsTrigger>
                <TabsTrigger value="badges" className="flex items-center gap-1.5 px-4">
                  <Award className="h-4 w-4" />
                  <span>Logros</span>
                </TabsTrigger>
                <TabsTrigger value="referrals" className="flex items-center gap-1.5 px-4">
                  <UserPlus className="h-4 w-4" />
                  <span>Referidos</span>
                </TabsTrigger>
                <TabsTrigger value="materials" className="flex items-center gap-1.5 px-4">
                  <Globe className="h-4 w-4" />
                  <span>Materiales</span>
                </TabsTrigger>
                <TabsTrigger value="content" className="flex items-center gap-1.5 px-4">
                  <Sparkles className="h-4 w-4" />
                  <span>Contenido</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-1.5 px-4">
                  <Settings2 className="h-4 w-4" />
                  <span>Configuración</span>
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="overview" className="space-y-4">
              <AffiliateOverview affiliateData={currentAffiliateData as any} />
            </TabsContent>
            
            <TabsContent value="links" className="space-y-4">
              <AffiliateLinks affiliateData={currentAffiliateData as any} />
            </TabsContent>
            
            <TabsContent value="earnings" className="space-y-4">
              <AffiliateEarnings affiliateData={currentAffiliateData} />
            </TabsContent>
            
            <TabsContent value="coupons" className="space-y-4">
              <AffiliateCoupons />
            </TabsContent>
            
            <TabsContent value="promotions" className="space-y-4">
              <AffiliatePromotions />
            </TabsContent>
            
            <TabsContent value="badges" className="space-y-4">
              <AffiliateBadges />
            </TabsContent>
            
            <TabsContent value="referrals" className="space-y-4">
              <AffiliateReferrals />
            </TabsContent>
            
            <TabsContent value="materials" className="space-y-4">
              <AffiliateMarketingMaterials />
            </TabsContent>
            
            <TabsContent value="content" className="space-y-6">
              <AffiliateContentGenerator affiliateData={currentAffiliateData as any} />
            </TabsContent>
            
            <TabsContent value="settings" className="space-y-4">
              <AffiliateSettings />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
