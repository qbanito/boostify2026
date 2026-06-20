import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
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
  DialogTrigger,
} from "../ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Mail, DollarSign, CheckCircle2, Clock, UserPlus } from "lucide-react";

export function AffiliateReferrals() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [referredEmail, setReferredEmail] = useState("");

  // Obtener referidos
  const { data: referralsData, isLoading } = useQuery({
    queryKey: ['/api/affiliate/referrals'],
  });

  const referrals = referralsData?.data?.referrals || [];
  const stats = referralsData?.data?.stats || {
    total: 0,
    active: 0,
    converted: 0,
    totalEarned: 0
  };

  // Crear referido
  const createReferralMutation = useMutation({
    mutationFn: async (email: string) => {
      return await apiRequest({
        url: '/api/affiliate/referrals',
        method: 'POST',
        data: { referredEmail: email }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate/referrals'] });
      toast({
        title: "Referido registrado",
        description: "Se ha enviado una invitación al email proporcionado",
      });
      setIsDialogOpen(false);
      setReferredEmail("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar el referido",
        variant: "destructive",
      });
    }
  });

  const handleCreateReferral = () => {
    if (!referredEmail || !referredEmail.includes('@')) {
      toast({
        title: "Error",
        description: "Por favor ingresa un email válido",
        variant: "destructive",
      });
      return;
    }

    createReferralMutation.mutate(referredEmail);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendiente", variant: "secondary" as const, icon: Clock },
      active: { label: "Activo", variant: "default" as const, icon: CheckCircle2 },
      converted: { label: "Convertido", variant: "default" as const, icon: DollarSign }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
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
            <Users className="h-6 w-6 text-primary" />
            Programa de Referidos
          </h2>
          <p className="text-muted-foreground mt-1">
            Gana comisiones adicionales refiriendo nuevos afiliados
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-invite-referral">
              <Plus className="h-4 w-4" />
              Invitar Referido
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Invitar Nuevo Referido</DialogTitle>
              <DialogDescription>
                Invita a alguien a unirse como afiliado y gana comisiones de segundo nivel
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email del Referido</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nombre@ejemplo.com"
                  value={referredEmail}
                  onChange={(e) => setReferredEmail(e.target.value)}
                  data-testid="input-referral-email"
                />
                <p className="text-xs text-muted-foreground">
                  Enviaremos una invitación personalizada a este email
                </p>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Comisión de Segundo Nivel
                </h4>
                <p className="text-sm text-muted-foreground">
                  Ganarás un 5% adicional sobre las ganancias de tus referidos cuando realicen ventas.
                </p>
              </div>

              <Button 
                onClick={handleCreateReferral} 
                className="w-full gap-2" 
                disabled={createReferralMutation.isPending}
                data-testid="button-submit-referral"
              >
                <Mail className="h-4 w-4" />
                {createReferralMutation.isPending ? "Enviando..." : "Enviar Invitación"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estadísticas de Referidos */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Referidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Referidos Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.active}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Convertidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.converted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comisiones Ganadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              ${stats.totalEarned.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Referidos */}
      {referrals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserPlus className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No has referido a nadie todavía.<br />
              Invita a otros afiliados y gana comisiones adicionales.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Mis Referidos</CardTitle>
            <CardDescription>
              Lista completa de personas que has referido al programa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {referrals.map((referral: any) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                  data-testid={`referral-item-${referral.id}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{referral.referredEmail}</p>
                      <p className="text-sm text-muted-foreground">
                        Referido el {new Date(referral.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {referral.commissionEarned > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Comisión Ganada</p>
                        <p className="font-semibold text-green-600 dark:text-green-400">
                          ${referral.commissionEarned.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {getStatusBadge(referral.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información del Programa */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Cómo Funciona el Programa de Referidos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">1</span>
            </div>
            <div>
              <p className="font-medium">Invita a un amigo</p>
              <p className="text-sm text-muted-foreground">
                Envía una invitación por email a alguien que pueda estar interesado en el programa de afiliados
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">2</span>
            </div>
            <div>
              <p className="font-medium">Tu referido se registra</p>
              <p className="text-sm text-muted-foreground">
                Cuando se registren y sean aprobados como afiliados, comenzarás a ganar comisiones de sus ventas
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">3</span>
            </div>
            <div>
              <p className="font-medium">Gana comisiones adicionales</p>
              <p className="text-sm text-muted-foreground">
                Recibe un 5% sobre todas las ganancias de tus referidos, además de tus propias comisiones
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
