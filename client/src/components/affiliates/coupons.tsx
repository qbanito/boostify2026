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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Plus, Copy, CheckCircle2, Clock, Users, TrendingUp } from "lucide-react";

export function AffiliateCoupons() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discount: 10,
    type: "percentage",
    expiresAt: "",
    usageLimit: ""
  });

  // Obtener cupones
  const { data: couponsData, isLoading } = useQuery({
    queryKey: ['/api/affiliate/coupons'],
  });

  const coupons = couponsData?.data || [];

  // Crear cupón
  const createCouponMutation = useMutation({
    mutationFn: async (couponData: any) => {
      return await apiRequest({
        url: '/api/affiliate/coupons',
        method: 'POST',
        data: couponData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate/coupons'] });
      toast({
        title: "Cupón creado",
        description: "Tu cupón ha sido creado exitosamente",
      });
      setIsDialogOpen(false);
      setNewCoupon({
        code: "",
        discount: 10,
        type: "percentage",
        expiresAt: "",
        usageLimit: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el cupón",
        variant: "destructive",
      });
    }
  });

  const handleCreateCoupon = () => {
    if (!newCoupon.code || newCoupon.code.length < 3) {
      toast({
        title: "Error",
        description: "El código debe tener al menos 3 caracteres",
        variant: "destructive",
      });
      return;
    }

    createCouponMutation.mutate({
      code: newCoupon.code.toUpperCase(),
      discount: parseFloat(String(newCoupon.discount)),
      type: newCoupon.type,
      expiresAt: newCoupon.expiresAt || null,
      usageLimit: newCoupon.usageLimit ? parseInt(newCoupon.usageLimit) : null
    });
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copiado",
      description: `Código ${code} copiado al portapapeles`,
    });
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCoupon({ ...newCoupon, code });
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
            <Ticket className="h-6 w-6 text-primary" />
            Cupones de Descuento
          </h2>
          <p className="text-muted-foreground mt-1">
            Crea cupones exclusivos para promocionar productos con descuentos especiales
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-coupon">
              <Plus className="h-4 w-4" />
              Crear Cupón
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Cupón</DialogTitle>
              <DialogDescription>
                Crea un código de descuento único para promocionar productos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código del Cupón</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    placeholder="PROMO2024"
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                    className="uppercase"
                    data-testid="input-coupon-code"
                  />
                  <Button variant="outline" onClick={generateRandomCode} data-testid="button-generate-code">
                    Generar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount">Descuento</Label>
                  <Input
                    id="discount"
                    type="number"
                    placeholder="10"
                    value={newCoupon.discount}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discount: parseFloat(e.target.value) || 0 })}
                    data-testid="input-coupon-discount"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select value={newCoupon.type} onValueChange={(value) => setNewCoupon({ ...newCoupon, type: value })}>
                    <SelectTrigger id="type" data-testid="select-coupon-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                      <SelectItem value="fixed">Monto Fijo ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Fecha de Expiración</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={newCoupon.expiresAt}
                    onChange={(e) => setNewCoupon({ ...newCoupon, expiresAt: e.target.value })}
                    data-testid="input-coupon-expiry"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="usageLimit">Límite de Uso</Label>
                  <Input
                    id="usageLimit"
                    type="number"
                    placeholder="Ilimitado"
                    value={newCoupon.usageLimit}
                    onChange={(e) => setNewCoupon({ ...newCoupon, usageLimit: e.target.value })}
                    data-testid="input-coupon-limit"
                  />
                </div>
              </div>

              <Button 
                onClick={handleCreateCoupon} 
                className="w-full" 
                disabled={createCouponMutation.isPending}
                data-testid="button-submit-coupon"
              >
                {createCouponMutation.isPending ? "Creando..." : "Crear Cupón"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {coupons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ticket className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No has creado ningún cupón todavía.<br />
              Crea tu primer cupón para comenzar a promocionar productos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon: any) => (
            <Card key={coupon.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-mono flex items-center gap-2">
                      {coupon.code}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(coupon.code)}
                        data-testid={`button-copy-${coupon.code}`}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {coupon.type === 'percentage' 
                        ? `${coupon.discount}% de descuento`
                        : `$${coupon.discount} de descuento`}
                    </CardDescription>
                  </div>
                  <Badge variant={coupon.active ? "default" : "secondary"}>
                    {coupon.active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{coupon.usageCount || 0} usos</span>
                  </div>
                  {coupon.usageLimit && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      <span>Límite: {coupon.usageLimit}</span>
                    </div>
                  )}
                </div>

                {coupon.expiresAt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-md p-2">
                    <Clock className="h-3 w-3" />
                    <span>
                      Expira: {new Date(coupon.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {coupon.usageCount > 0 && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-muted-foreground">
                        Generó {coupon.usageCount} conversión{coupon.usageCount !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
