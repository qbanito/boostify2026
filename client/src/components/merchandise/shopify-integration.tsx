import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { ShoppingBag, AlertCircle, CheckCircle2, Settings, ExternalLink } from "lucide-react";
import { useToast } from "../../hooks/use-toast";

export function ShopifyIntegration() {
  const { toast } = useToast();
  const [shopifyDomain, setShopifyDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = () => {
    if (!shopifyDomain || !accessToken) {
      toast({
        title: "Campos requeridos",
        description: "Ingresa tu dominio de Shopify y el token de acceso",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Próximamente",
      description: "La integración de Shopify estará disponible pronto",
    });

    setIsConnected(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-green-600" />
            Integración con Shopify
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Conecta tu tienda Shopify para sincronizar productos y órdenes
          </p>
        </div>
        <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-green-600" : ""}>
          {isConnected ? (
            <>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Conectado
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3 mr-1" />
              No conectado
            </>
          )}
        </Badge>
      </div>

      {!isConnected ? (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <Settings className="h-4 w-4" />
                Cómo conectar tu tienda Shopify
              </h4>
              <ol className="text-sm space-y-2 text-muted-foreground ml-6 list-decimal">
                <li>Ve a tu panel de administración de Shopify</li>
                <li>Navega a "Aplicaciones" → "Desarrollo de aplicaciones"</li>
                <li>Crea una aplicación personalizada con permisos de lectura/escritura para productos y órdenes</li>
                <li>Copia el dominio de tu tienda y el token de acceso</li>
                <li>Ingresa los datos en este formulario</li>
              </ol>
              <a
                href="https://help.shopify.com/en/manual/apps/app-types/custom-apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-3"
              >
                Ver guía completa
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="shopify-domain">Dominio de Shopify</Label>
                <Input
                  id="shopify-domain"
                  value={shopifyDomain}
                  onChange={(e) => setShopifyDomain(e.target.value)}
                  placeholder="mi-tienda.myshopify.com"
                  data-testid="input-shopify-domain"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ingresa solo el dominio, sin https://
                </p>
              </div>

              <div>
                <Label htmlFor="access-token">Token de Acceso (Admin API)</Label>
                <Input
                  id="access-token"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="shpat_••••••••••••••••"
                  data-testid="input-shopify-token"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  El token debe tener permisos para productos y órdenes
                </p>
              </div>

              <Button
                onClick={handleConnect}
                className="w-full bg-green-600 hover:bg-green-700"
                data-testid="button-connect-shopify"
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Conectar Tienda Shopify
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 mt-1" />
              <div className="flex-1">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                  Tienda Shopify Conectada
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                  Tu tienda está conectada correctamente
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-700 dark:text-green-400 font-medium">Dominio:</span>
                    <span className="text-green-600 dark:text-green-300">{shopifyDomain}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h4 className="font-semibold mb-4">Funciones Disponibles (Próximamente)</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Sincronización de Productos</p>
                  <p className="text-xs text-muted-foreground">
                    Importa y exporta productos entre Shopify y Boostify automáticamente
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Gestión de Órdenes</p>
                  <p className="text-xs text-muted-foreground">
                    Sincroniza órdenes de Shopify con Boostify para cumplimiento automático
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Inventario en Tiempo Real</p>
                  <p className="text-xs text-muted-foreground">
                    Mantén el inventario sincronizado automáticamente entre plataformas
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => setIsConnected(false)}
              data-testid="button-disconnect-shopify"
            >
              Desconectar Shopify
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
