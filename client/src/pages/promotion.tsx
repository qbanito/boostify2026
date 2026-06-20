import { useState, useEffect } from "react";
import { logger } from "../lib/logger";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Header } from "../components/layout/header";
import {
  Activity,
  Megaphone,
  Plus,
  Target,
  Globe,
  Calendar,
  Users,
  TrendingUp,
  BarChart2,
  Edit2,
  Trash2,
  Clock
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CampaignForm } from "../components/promotion/campaign-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { db, auth } from "../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  getDoc
} from "firebase/firestore";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useToast } from "../hooks/use-toast";

// Interfaces
interface Campaign {
  id: string;
  name: string;
  description: string;
  platform: string;
  budget: number;
  startDate: Timestamp | string;
  endDate: Timestamp | string;
  status: 'active' | 'scheduled' | 'completed' | 'draft';
  progress: number;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CampaignStats {
  activeCampaigns: number;
  totalReach: number;
  engagementRate: number;
  roi: number;
}

export default function PromotionPage() {
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch campaigns
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const user = auth.currentUser;
      if (!user) return [];

      try {
        logger.info("Intentando obtener campañas para usuario:", user.uid);
        const campaignsRef = collection(db, "campaigns");

        // Simplificar la consulta para debug
        const q = query(
          campaignsRef,
          where("userId", "==", user.uid)
        );

        logger.info("Ejecutando consulta de Firestore");
        const querySnapshot = await getDocs(q);
        logger.info("Resultado de la consulta:", querySnapshot.size, "documentos");

        const results = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Campaign[];

        logger.info("Campañas recuperadas:", results);
        return results;
      } catch (error) {
        logger.error("Error detallado al obtener campañas:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las campañas. Por favor, intenta de nuevo.",
          variant: "destructive"
        });
        return [];
      }
    },
    enabled: !!auth.currentUser
  });

  // Fetch campaign stats
  const { data: stats = { activeCampaigns: 0, totalReach: 0, engagementRate: 0, roi: 0 } } = useQuery({
    queryKey: ["campaign_stats"],
    queryFn: async () => {
      const user = auth.currentUser;
      if (!user) return null;

      try {
        const statsRef = doc(db, "campaign_stats", user.uid);
        const statsDoc = await getDoc(statsRef);

        if (!statsDoc.exists()) {
          return {
            activeCampaigns: campaigns.filter(c => c.status === 'active').length,
            totalReach: 0,
            engagementRate: 0,
            roi: 0
          };
        }

        return statsDoc.data() as CampaignStats;
      } catch (error) {
        logger.error("Error fetching stats:", error);
        return null;
      }
    },
    enabled: !!auth.currentUser
  });

  // Mutations
  const createCampaignMutation = useMutation({
    mutationFn: async (newCampaign: Omit<Campaign, 'id'>) => {
      logger.info("Intentando crear nueva campaña:", newCampaign);
      const campaignsRef = collection(db, "campaigns");
      try {
        // Convertir las fechas a Timestamp
        const docRef = await addDoc(campaignsRef, {
          ...newCampaign,
          startDate: Timestamp.fromDate(new Date(newCampaign.startDate)),
          endDate: Timestamp.fromDate(new Date(newCampaign.endDate)),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        logger.info("Campaña creada exitosamente con ID:", docRef.id);
        return docRef;
      } catch (error) {
        logger.error("Error al crear campaña:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Éxito",
        description: "Campaña creada exitosamente",
      });
      setShowNewCampaignDialog(false);
    },
    onError: (error) => {
      logger.error("Error en mutation al crear campaña:", error);
      toast({
        title: "Error",
        description: "No se pudo crear la campaña. Por favor, intenta de nuevo.",
        variant: "destructive"
      });
    }
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async (campaign: Campaign) => {
      const campaignRef = doc(db, "campaigns", campaign.id);
      await updateDoc(campaignRef, {
        ...campaign,
        updatedAt: Timestamp.now()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Success",
        description: "Campaign updated successfully",
      });
      setEditingCampaign(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update campaign. Please try again.",
        variant: "destructive"
      });
    }
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const campaignRef = doc(db, "campaigns", campaignId);
      await deleteDoc(campaignRef);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Success",
        description: "Campaign deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete campaign. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleDeleteCampaign = (campaignId: string) => {
    if (window.confirm("Are you sure you want to delete this campaign?")) {
      deleteCampaignMutation.mutate(campaignId);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-24">
        <ScrollArea className="h-[calc(100vh-6rem)]">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-500/70">
                  Promotion Center
                </h1>
                <p className="text-muted-foreground mt-2">
                  Manage and track your promotional campaigns
                </p>
              </div>
              <Dialog open={showNewCampaignDialog} onOpenChange={setShowNewCampaignDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-orange-500 hover:bg-orange-600">
                    <Plus className="mr-2 h-4 w-4" />
                    New Campaign
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Create New Campaign</DialogTitle>
                    <DialogDescription>
                      Set up your campaign details and get AI-powered suggestions
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <CampaignForm
                      onSuccess={(campaignData) => {
                        createCampaignMutation.mutate({
                          ...campaignData,
                          userId: auth.currentUser!.uid,
                          status: 'draft',
                          progress: 0
                        } as Omit<Campaign, 'id'>);
                      }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Campaign Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="p-6 hover:bg-orange-500/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <Target className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Campaigns</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-2xl font-bold">{stats.activeCampaigns}</h3>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 hover:bg-orange-500/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <Users className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Reach</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-2xl font-bold">{stats.totalReach.toLocaleString()}</h3>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 hover:bg-orange-500/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Engagement Rate</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-2xl font-bold">{stats.engagementRate}%</h3>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 hover:bg-orange-500/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <BarChart2 className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Engagement Score</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-2xl font-bold">{stats.roi}%</h3>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Tabs defaultValue="active" className="space-y-6">
              <TabsList>
                <TabsTrigger value="active">Active Campaigns</TabsTrigger>
                <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="draft">Drafts</TabsTrigger>
              </TabsList>

              {["active", "scheduled", "completed", "draft"].map((status) => (
                <TabsContent key={status} value={status} className="space-y-6">
                  {isLoadingCampaigns ? (
                    <Card className="p-6">
                      <p className="text-center text-muted-foreground">Loading campaigns...</p>
                    </Card>
                  ) : campaigns.filter(c => c.status === status).length === 0 ? (
                    <Card className="p-6">
                      <p className="text-center text-muted-foreground">No {status} campaigns</p>
                    </Card>
                  ) : (
                    campaigns
                      .filter(campaign => campaign.status === status)
                      .map((campaign) => (
                        <Card key={campaign.id} className="p-6 hover:bg-orange-500/5 transition-colors">
                          <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-xl font-semibold">{campaign.name}</h3>
                                    <Badge variant="outline" className={`
                                      ${status === 'active' ? 'bg-green-500/10 text-green-500' : ''}
                                      ${status === 'scheduled' ? 'bg-blue-500/10 text-blue-500' : ''}
                                      ${status === 'completed' ? 'bg-gray-500/10 text-gray-500' : ''}
                                      ${status === 'draft' ? 'bg-orange-500/10 text-orange-500' : ''}
                                    `}>
                                      {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </Badge>
                                  </div>
                                  <p className="text-muted-foreground">{campaign.description}</p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setEditingCampaign(campaign)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="text-destructive"
                                    onClick={() => handleDeleteCampaign(campaign.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> Platform
                                  </p>
                                  <p className="font-semibold capitalize">{campaign.platform}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Target className="h-4 w-4" /> Budget
                                  </p>
                                  <p className="font-semibold">${campaign.budget?.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Calendar className="h-4 w-4" /> Duration
                                  </p>
                                  <p className="font-semibold">
                                    {typeof campaign.startDate === 'string' 
                                      ? new Date(campaign.startDate).toLocaleDateString()
                                      : campaign.startDate instanceof Timestamp 
                                        ? campaign.startDate.toDate().toLocaleDateString()
                                        : 'Fecha no disponible'
                                    } - {
                                      typeof campaign.endDate === 'string'
                                        ? new Date(campaign.endDate).toLocaleDateString()
                                        : campaign.endDate instanceof Timestamp
                                          ? campaign.endDate.toDate().toLocaleDateString()
                                          : 'Fecha no disponible'
                                    }
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> Progress
                                  </p>
                                  <p className="font-semibold">{campaign.progress}%</p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Campaign Progress</span>
                                  <span className="font-medium">{campaign.progress}%</span>
                                </div>
                                <Progress value={campaign.progress} className="bg-orange-500/20" />
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </ScrollArea>
      </main>

      {/* Edit Campaign Dialog */}
      {editingCampaign && (
        <Dialog open={!!editingCampaign} onOpenChange={() => setEditingCampaign(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Campaign</DialogTitle>
              <DialogDescription>
                Update your campaign details
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <CampaignForm
                campaign={editingCampaign}
                onSuccess={(campaignData) => {
                  updateCampaignMutation.mutate({
                    ...editingCampaign,
                    ...campaignData,
                  });
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}