import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { AffiliateOverview } from "../components/affiliates/overview";
import { AffiliateRegistration } from "../components/affiliates/registration";
import { AffiliateLinks } from "../components/affiliates/links";
import { AffiliateEarnings } from "../components/affiliates/earnings";
import { AffiliateContentGenerator } from "../components/affiliates/content-generator";
import { AffiliateResources } from "../components/affiliates/resources";
import { AffiliateSupport } from "../components/affiliates/affiliate-support";
import { AffiliateSettings } from "../components/affiliates/settings";
import { AffiliateCoupons } from "../components/affiliates/coupons";
import { AffiliatePromotions } from "../components/affiliates/promotions";
import { AffiliateBadges } from "../components/affiliates/badges";
import { AffiliateReferrals } from "../components/affiliates/referrals";
import { AffiliateMarketingMaterials } from "../components/affiliates/marketing-materials";
import { useAuth } from "../hooks/use-auth";
import { useLocation } from "wouter";
import { db, auth } from "../lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { isAdminEmail } from "../../../shared/constants";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { 
  CircleCheck, 
  GraduationCap, 
  LineChart, 
  Rocket, 
  Stars, 
  Sparkles, 
  Award, 
  Users, 
  DollarSign, 
  Link, 
  FileText, 
  LifeBuoy, 
  Settings2,
  Mail,
  Video,
  AlertCircle,
  Zap,
  Crown,
  Headphones as HeadphonesIcon,
  Ticket,
  Globe,
  UserPlus,
  BookOpen,
  Download
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";

// Define AffiliateData type
type AffiliateDataType = {
  id: string;
  level?: string;
  stats?: {
    totalClicks?: number;
    totalSales?: number;
    totalCommission?: number;
  };
  // Add other properties as needed
};

// Updated with new affiliate features: Coupons, Promotions, Badges, Referrals, Materials
export default function AffiliatesPage() {
  const { user } = useAuth() || {};
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  // Query to check if the current user is an affiliate using backend API
  const { data: affiliateApiData, isLoading: isLoadingAffiliateData, error: affiliateError } = useQuery<{
    success: boolean;
    affiliate?: any;
    message?: string;
  }>({
    queryKey: ["/api/affiliate/me"],
    enabled: !!user?.uid,
    retry: false
  });

  // Extract affiliate data from API response
  const affiliateData = affiliateApiData?.success && affiliateApiData?.affiliate
    ? affiliateApiData.affiliate 
    : null;

  // Admin users (convoycubano@gmail.com) always have full access
  const isAdmin = isAdminEmail(user?.email);

  // Determine if we should show the registration form or the affiliate dashboard
  const isAffiliate = isAdmin || !!affiliateData;
  
  // Use real affiliate data from API
  const currentAffiliateData = affiliateData || {
    id: user?.uid || "",
    level: "Basic",
    fullName: user?.displayName || "User",
    stats: {
      totalClicks: 0,
      conversions: 0,
      earnings: 0,
      pendingPayment: 0
    },
    links: [],
    conversions: [],
    badges: []
  };

  // Auth guard - redirect if not logged in
  useEffect(() => {
    if (!user) {
      setLocation('/auth');
    }
  }, [user, setLocation]);

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="bg-zinc-900/50 border-orange-500/20 p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-white/70 mb-6">You need to be logged in to access the Affiliate Program.</p>
          <Button onClick={() => setLocation('/auth')} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">Sign In / Sign Up</Button>
        </Card>
      </div>
    );
  }

  // Benefits of the affiliate program
  const benefits = [
    {
      icon: <DollarSign className="h-8 w-8 text-primary" />,
      title: "Competitive Commissions",
      description: "Earn up to 30% commission on every sale made through your unique affiliate links"
    },
    {
      icon: <Rocket className="h-8 w-8 text-primary" />,
      title: "Instant Access",
      description: "Start promoting immediately with ready-to-use marketing resources and tools"
    },
    {
      icon: <Stars className="h-8 w-8 text-primary" />,
      title: "Premium Content",
      description: "Access exclusive content and promotional materials designed to boost conversions"
    },
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: "Dedicated Support",
      description: "Get personalized assistance from our affiliate team to maximize your earnings"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        {!isAffiliate && (
          <>
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-primary/20 via-primary/10 to-background mb-8 p-8 border border-primary/10 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <Badge className="bg-primary/20 text-primary hover:bg-primary/30 transition-colors py-2 px-4 text-base">
                    Now Available
                  </Badge>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">Amplify Your Earnings with the Boostify Affiliate Program</h1>
                  <p className="text-muted-foreground text-base md:text-lg">
                    Join our community of high-performing affiliates and earn generous commissions promoting premium music education products.
                  </p>
                  <div className="flex flex-wrap gap-6 pt-6">
                    <Button className="gap-2 text-base py-6" size="lg">
                      <Sparkles className="h-5 w-5" /> Join Now
                    </Button>
                    <Button variant="outline" className="text-base py-6" size="lg">
                      Learn More
                    </Button>
                  </div>
                </div>
                <div className="hidden md:block relative h-72">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-primary/10 rounded-lg flex items-center justify-center shadow-md">
                    <div className="text-center p-6">
                      <Sparkles className="h-16 w-16 text-primary mx-auto mb-4" />
                      <p className="text-3xl font-bold">Earn up to 30%</p>
                      <p className="text-xl mt-2">on every sale</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold mb-6">Why Become a Boostify Affiliate?</h2>
              <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 mt-8">
                <div className="flex flex-col items-center p-6 rounded-xl bg-gradient-to-b from-primary/5 to-transparent border border-primary/10">
                  <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <DollarSign className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Competitive Commissions</h3>
                  <p className="text-muted-foreground text-center">
                    Earn up to 30% commission on every sale made through your affiliate links
                  </p>
                </div>
                
                <div className="flex flex-col items-center p-6 rounded-xl bg-gradient-to-b from-primary/5 to-transparent border border-primary/10">
                  <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Instant Access</h3>
                  <p className="text-muted-foreground text-center">
                    Start promoting immediately with ready-to-use marketing resources
                  </p>
                </div>
                
                <div className="flex flex-col items-center p-6 rounded-xl bg-gradient-to-b from-primary/5 to-transparent border border-primary/10">
                  <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <Crown className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Premium Content</h3>
                  <p className="text-muted-foreground text-center">
                    Access exclusive content and promotional materials designed to boost conversions
                  </p>
                </div>
                
                <div className="flex flex-col items-center p-6 rounded-xl bg-gradient-to-b from-primary/5 to-transparent border border-primary/10">
                  <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <HeadphonesIcon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Dedicated Support</h3>
                  <p className="text-muted-foreground text-center">
                    Get personalized assistance from our affiliate team to maximize your earnings
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col gap-8">
          {!isAffiliate && (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-center">Why Become a Boostify Affiliate?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {benefits.map((benefit, index) => (
                  <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-all">
                    <CardHeader className="pb-2">
                      <div className="mb-2">{benefit.icon}</div>
                      <CardTitle>{benefit.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{benefit.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {isLoadingAffiliateData ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : !isAffiliate ? (
            // If not an affiliate, show registration form
            <AffiliateRegistration />
          ) : (
            // If already an affiliate, show full dashboard
            <div>
              <div className="mb-8">
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-lg border border-primary/10 shadow-sm mb-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Affiliate Dashboard
                      </h1>
                      <p className="text-muted-foreground mt-2">
                        Welcome! Track your performance and access all affiliate tools.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
                      <Badge variant="outline" className="text-sm py-2 px-4 flex items-center gap-2 border-primary/20 bg-primary/10 text-primary">
                        <Award className="h-4 w-4 text-yellow-500" />
                        <span>Level {currentAffiliateData.level || "Basic"}</span>
                      </Badge>
                      <Badge variant="secondary" className="text-sm py-2 px-4">
                        ID: {user?.uid?.substring(0, 8) || ""}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 bg-background/80 p-4 rounded-lg border border-primary/5">
                    <div className="flex flex-col items-center p-3 text-center">
                      <div className="text-2xl font-bold text-primary">{currentAffiliateData.stats?.totalClicks?.toLocaleString() || "0"}</div>
                      <div className="text-xs text-muted-foreground mt-1">Total Clicks</div>
                    </div>
                    <div className="flex flex-col items-center p-3 text-center">
                      <div className="text-2xl font-bold text-primary">{currentAffiliateData.stats?.conversions?.toLocaleString() || "0"}</div>
                      <div className="text-xs text-muted-foreground mt-1">Conversions</div>
                    </div>
                    <div className="flex flex-col items-center p-3 text-center">
                      <div className="text-2xl font-bold text-primary">${currentAffiliateData.stats?.earnings?.toLocaleString() || "0"}</div>
                      <div className="text-xs text-muted-foreground mt-1">Total Earnings</div>
                    </div>
                    <div className="flex flex-col items-center p-3 text-center">
                      <div className="text-2xl font-bold text-primary">${currentAffiliateData.stats?.pendingPayment?.toLocaleString() || "0"}</div>
                      <div className="text-xs text-muted-foreground mt-1">Pending Payment</div>
                    </div>
                  </div>
                </div>
              </div>

              <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-8">
                {/* Sistema de pestañas mejorado con nuevas funcionalidades */}
                {/* Tabs para móvil: vista en forma de grid */}
                <div className="md:hidden space-y-3">
                  <TabsList className="grid grid-cols-3 gap-2">
                    <TabsTrigger value="overview" className="flex flex-col items-center gap-1.5 py-2.5">
                      <LineChart className="h-4 w-4" />
                      <span className="text-xs">Overview</span>
                    </TabsTrigger>
                    <TabsTrigger value="links" className="flex flex-col items-center gap-1.5 py-2.5">
                      <Link className="h-4 w-4" />
                      <span className="text-xs">Links</span>
                    </TabsTrigger>
                    <TabsTrigger value="earnings" className="flex flex-col items-center gap-1.5 py-2.5">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs">Earnings</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsList className="grid grid-cols-3 gap-2">
                    <TabsTrigger value="coupons" className="flex flex-col items-center gap-1.5 py-2.5">
                      <Ticket className="h-4 w-4" />
                      <span className="text-xs">Coupons</span>
                    </TabsTrigger>
                    <TabsTrigger value="promotions" className="flex flex-col items-center gap-1.5 py-2.5">
                      <Zap className="h-4 w-4" />
                      <span className="text-xs">Promos</span>
                    </TabsTrigger>
                    <TabsTrigger value="badges" className="flex flex-col items-center gap-1.5 py-2.5">
                      <Award className="h-4 w-4" />
                      <span className="text-xs">Badges</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsList className="grid grid-cols-4 gap-2">
                    <TabsTrigger value="referrals" className="flex flex-col items-center gap-1.5 py-2.5">
                      <UserPlus className="h-4 w-4" />
                      <span className="text-xs">Referrals</span>
                    </TabsTrigger>
                    <TabsTrigger value="materials" className="flex flex-col items-center gap-1.5 py-2.5">
                      <Globe className="h-4 w-4" />
                      <span className="text-xs">Materials</span>
                    </TabsTrigger>
                    <TabsTrigger value="content" className="flex flex-col items-center gap-1.5 py-2.5">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-xs">Content</span>
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="flex flex-col items-center gap-1.5 py-2.5">
                      <Settings2 className="h-4 w-4" />
                      <span className="text-xs">Settings</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsList className="grid grid-cols-2 gap-2">
                    <TabsTrigger value="resources" className="flex flex-col items-center gap-1.5 py-2.5">
                      <Download className="h-4 w-4" />
                      <span className="text-xs">Resources</span>
                    </TabsTrigger>
                    <TabsTrigger value="support" className="flex flex-col items-center gap-1.5 py-2.5">
                      <LifeBuoy className="h-4 w-4" />
                      <span className="text-xs">Support</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                {/* Tabs para escritorio: scrollable horizontal */}
                <div className="hidden md:block relative">
                  <div className="overflow-x-auto scrollbar-hide">
                    <TabsList className="inline-flex gap-2 w-auto">
                      <TabsTrigger value="overview" className="flex items-center gap-1.5 px-4">
                        <LineChart className="h-4 w-4" />
                        <span>Overview</span>
                      </TabsTrigger>
                      <TabsTrigger value="links" className="flex items-center gap-1.5 px-4">
                        <Link className="h-4 w-4" />
                        <span>Links</span>
                      </TabsTrigger>
                      <TabsTrigger value="earnings" className="flex items-center gap-1.5 px-4">
                        <DollarSign className="h-4 w-4" />
                        <span>Earnings</span>
                      </TabsTrigger>
                      <TabsTrigger value="coupons" className="flex items-center gap-1.5 px-4">
                        <Ticket className="h-4 w-4" />
                        <span>Coupons</span>
                      </TabsTrigger>
                      <TabsTrigger value="promotions" className="flex items-center gap-1.5 px-4">
                        <Zap className="h-4 w-4" />
                        <span>Promotions</span>
                      </TabsTrigger>
                      <TabsTrigger value="badges" className="flex items-center gap-1.5 px-4">
                        <Award className="h-4 w-4" />
                        <span>Badges</span>
                      </TabsTrigger>
                      <TabsTrigger value="referrals" className="flex items-center gap-1.5 px-4">
                        <UserPlus className="h-4 w-4" />
                        <span>Referrals</span>
                      </TabsTrigger>
                      <TabsTrigger value="materials" className="flex items-center gap-1.5 px-4">
                        <Globe className="h-4 w-4" />
                        <span>Materials</span>
                      </TabsTrigger>
                      <TabsTrigger value="content" className="flex items-center gap-1.5 px-4">
                        <Sparkles className="h-4 w-4" />
                        <span>Content</span>
                      </TabsTrigger>
                      <TabsTrigger value="resources" className="flex items-center gap-1.5 px-4">
                        <Download className="h-4 w-4" />
                        <span>Resources</span>
                      </TabsTrigger>
                      <TabsTrigger value="support" className="flex items-center gap-1.5 px-4">
                        <LifeBuoy className="h-4 w-4" />
                        <span>Support</span>
                      </TabsTrigger>
                      <TabsTrigger value="settings" className="flex items-center gap-1.5 px-4">
                        <Settings2 className="h-4 w-4" />
                        <span>Settings</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>
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
                  <div className="bg-gradient-to-r from-primary/10 to-transparent p-6 rounded-lg border border-primary/10 shadow-sm mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          Content Generator
                        </h2>
                        <p className="text-muted-foreground mt-2">
                          Create persuasive content to promote products and boost your sales
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col items-center bg-background/80 p-5 rounded-lg border border-primary/10 shadow-sm">
                        <div className="bg-primary/10 p-3 rounded-full mb-3">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-semibold mb-1">Posts</h3>
                        <p className="text-xs text-center text-muted-foreground">Create posts for blogs and social media</p>
                      </div>
                      
                      <div className="flex flex-col items-center bg-background/80 p-5 rounded-lg border border-primary/10 shadow-sm">
                        <div className="bg-primary/10 p-3 rounded-full mb-3">
                          <Mail className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-semibold mb-1">Emails</h3>
                        <p className="text-xs text-center text-muted-foreground">Generate persuasive emails for your audience</p>
                      </div>
                      
                      <div className="flex flex-col items-center bg-background/80 p-5 rounded-lg border border-primary/10 shadow-sm">
                        <div className="bg-primary/10 p-3 rounded-full mb-3">
                          <Video className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-semibold mb-1">Scripts</h3>
                        <p className="text-xs text-center text-muted-foreground">Create scripts for promotional videos</p>
                      </div>
                    </div>
                    
                    <div className="mt-6 bg-primary/5 p-4 rounded-lg border border-primary/10 flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <AlertCircle className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Premium level affiliates have access to additional content types and advanced customization.
                        <Button variant="link" className="p-0 h-auto text-sm text-primary ml-1">Learn more</Button>
                      </p>
                    </div>
                  </div>
                  
                  <AffiliateContentGenerator affiliateData={currentAffiliateData as any} />
                </TabsContent>
                
                <TabsContent value="resources" className="space-y-4">
                  <AffiliateResources />
                </TabsContent>
                
                <TabsContent value="support" className="space-y-4">
                  <AffiliateSupport />
                </TabsContent>
                
                <TabsContent value="settings" className="space-y-4">
                  <AffiliateSettings />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        {!isAffiliate && (
          <div className="mt-12 border-t pt-12">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl font-bold mb-4">What Our Top Affiliates Are Saying</h2>
              <div className="grid gap-6 md:grid-cols-2 mt-6">
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <p className="italic text-muted-foreground mb-4">
                      "The commission rates are among the best I've seen, and the marketing materials make promotion effortless. I've already earned over $5,000 in my first three months!"
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="font-semibold">JM</span>
                      </div>
                      <div>
                        <p className="font-medium">James Morrison</p>
                        <p className="text-xs text-muted-foreground">Music Producer & Educator</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <p className="italic text-muted-foreground mb-4">
                      "Boostify's affiliate dashboard is incredibly user-friendly. The content generator saves me hours of work and has significantly improved my conversion rates!"
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="font-semibold">SR</span>
                      </div>
                      <div>
                        <p className="font-medium">Sarah Rodriguez</p>
                        <p className="text-xs text-muted-foreground">Music Marketing Specialist</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <div className="mt-16 mb-8 bg-gradient-to-r from-primary/20 via-primary/10 to-background rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Ready to Start Earning?</h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                Join our affiliate program today and start earning generous commissions by promoting our premium music education products.
              </p>
              <Button size="lg" className="gap-2">
                <Sparkles className="h-5 w-5" /> Become an Affiliate
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}