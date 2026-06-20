import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Zap, Plus, Calendar, DollarSign, TrendingUp, Target } from "lucide-react";

export function AffiliatePromotions() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPromotion, setNewPromotion] = useState({
    name: "",
    description: "",
    bonusCommission: 5,
    startDate: "",
    endDate: "",
    minSales: 0,
    minRevenue: 0
  });

  // Obtener promociones
  const { data: promotionsData, isLoading } = useQuery({
    queryKey: ['/api/affiliate/promotions'],
  });

  const promotions = promotionsData?.data || [];

  // Crear promoción
  const createPromotionMutation = useMutation({
    mutationFn: async (promotionData: any) => {
      return await apiRequest({
        url: '/api/affiliate/promotions',
        method: 'POST',
        data: promotionData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate/promotions'] });
      toast({
        title: "Promoción creada",
        description: "Tu promoción ha sido creada exitosamente",
      });
      setIsDialogOpen(false);
      setNewPromotion({
        name: "",
        description: "",
        bonusCommission: 5,
        startDate: "",
        endDate: "",
        minSales: 0,
        minRevenue: 0
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la promoción",
        variant: "destructive",
      });
    }
  });

  const handleCreatePromotion = () => {
    if (!newPromotion.name) {
      toast({
        title: "Error",
        description: "El nombre de la promoción es requerido",
        variant: "destructive",
      });
      return;
    }

    createPromotionMutation.mutate({
      name: newPromotion.name,
      description: newPromotion.description,
      bonusCommission: parseFloat(String(newPromotion.bonusCommission)),
      startDate: newPromotion.startDate || new Date().toISOString(),
      endDate: newPromotion.endDate || null,
      requirements: {
        minSales: parseInt(String(newPromotion.minSales)) || 0,
        minRevenue: parseFloat(String(newPromotion.minRevenue)) || 0
      }
    });
  };

  const getPromotionStatus = (promotion: any) => {
    const now = new Date();
    const startDate = new Date(promotion.startDate);
    const endDate = promotion.endDate ? new Date(promotion.endDate) : null;

    if (now < startDate) return { label: "Próximamente", variant: "secondary" as const };
    if (endDate && now > endDate) return { label: "Finalizada", variant: "outline" as const };
    if (promotion.active) return { label: "Activa", variant: "default" as const };
    return { label: "Inactiva", variant: "destructive" as const };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Promociones Especiales
          </h2>
          <p className="text-muted-foreground mt-1">
            Crea campañas con comisiones extra para aumentar tus ganancias
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-promotion">
              <Plus className="h-4 w-4" />
              Crear Promoción
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Crear Nueva Promoción</DialogTitle>
              <DialogDescription>
                Lanza una campaña especial con comisión adicional por tiempo limitado
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Promoción *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Black Friday 2024"
                  value={newPromotion.name}
                  onChange={(e) => setNewPromotion({ ...newPromotion, name: e.target.value })}
                  data-testid="input-promotion-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Describe los detalles de esta promoción..."
                  value={newPromotion.description}
                  onChange={(e) => setNewPromotion({ ...newPromotion, description: e.target.value })}
                  rows={3}
                  data-testid="input-promotion-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bonusCommission">Comisión Adicional (%)</Label>
                <Input
                  id="bonusCommission"
                  type="number"
                  placeholder="5"
                  value={newPromotion.bonusCommission}
                  onChange={(e) => setNewPromotion({ ...newPromotion, bonusCommission: parseFloat(e.target.value) || 0 })}
                  data-testid="input-promotion-bonus"
                />
                <p className="text-xs text-muted-foreground">
                  Porcentaje extra sobre la comisión base
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Fecha de Inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newPromotion.startDate}
                    onChange={(e) => setNewPromotion({ ...newPromotion, startDate: e.target.value })}
                    data-testid="input-promotion-start"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">Fecha de Fin</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={newPromotion.endDate}
                    onChange={(e) => setNewPromotion({ ...newPromotion, endDate: e.target.value })}
                    data-testid="input-promotion-end"
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold text-sm">Requisitos para Desbloquear</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minSales">Ventas Mínimas</Label>
                    <Input
                      id="minSales"
                      type="number"
                      placeholder="0"
                      value={newPromotion.minSales}
                      onChange={(e) => setNewPromotion({ ...newPromotion, minSales: parseInt(e.target.value) || 0 })}
                      data-testid="input-promotion-min-sales"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minRevenue">Ingresos Mínimos ($)</Label>
                    <Input
                      id="minRevenue"
                      type="number"
                      placeholder="0"
                      value={newPromotion.minRevenue}
                      onChange={(e) => setNewPromotion({ ...newPromotion, minRevenue: parseFloat(e.target.value) || 0 })}
                      data-testid="input-promotion-min-revenue"
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleCreatePromotion} 
                className="w-full" 
                disabled={createPromotionMutation.isPending}
                data-testid="button-submit-promotion"
              >
                {createPromotionMutation.isPending ? "Creando..." : "Crear Promoción"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {promotions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No tienes promociones activas.<br />
              Crea una promoción para impulsar tus ventas con comisiones extra.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {promotions.map((promotion: any) => {
            const status = getPromotionStatus(promotion);
            const salesProgress = promotion.requirements?.minSales 
              ? (promotion.stats?.sales / promotion.requirements.minSales) * 100 
              : 100;
            const revenueProgress = promotion.requirements?.minRevenue 
              ? (promotion.stats?.revenue / promotion.requirements.minRevenue) * 100 
              : 100;

            return (
              <Card key={promotion.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{promotion.name}</CardTitle>
                      <CardDescription className="mt-2">
                        {promotion.description}
                      </CardDescription>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-primary/5 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-primary mb-1">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-sm font-medium">Comisión Extra</span>
                      </div>
                      <p className="text-2xl font-bold">+{promotion.bonusCommission}%</p>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-sm font-medium">Ventas</span>
                      </div>
                      <p className="text-2xl font-bold">{promotion.stats?.sales || 0}</p>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-sm font-medium">Ingresos</span>
                      </div>
                      <p className="text-2xl font-bold">${promotion.stats?.revenue || 0}</p>
                    </div>

                    <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                        <Target className="h-4 w-4" />
                        <span className="text-sm font-medium">Bono Ganado</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        ${promotion.stats?.bonusEarned || 0}
                      </p>
                    </div>
                  </div>

                  {(promotion.requirements?.minSales > 0 || promotion.requirements?.minRevenue > 0) && (
                    <div className="space-y-3 pt-3 border-t">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Progreso de Requisitos
                      </h4>
                      
                      {promotion.requirements.minSales > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Ventas Mínimas</span>
                            <span className="font-medium">
                              {promotion.stats?.sales || 0} / {promotion.requirements.minSales}
                            </span>
                          </div>
                          <Progress value={Math.min(salesProgress, 100)} className="h-2" />
                        </div>
                      )}

                      {promotion.requirements.minRevenue > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Ingresos Mínimos</span>
                            <span className="font-medium">
                              ${promotion.stats?.revenue || 0} / ${promotion.requirements.minRevenue}
                            </span>
                          </div>
                          <Progress value={Math.min(revenueProgress, 100)} className="h-2" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Inicio: {new Date(promotion.startDate).toLocaleDateString()}</span>
                    </div>
                    {promotion.endDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Fin: {new Date(promotion.endDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
