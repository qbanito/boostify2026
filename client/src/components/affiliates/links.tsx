import React, { useState } from "react";
import { logger } from "@/lib/logger";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import {
  Copy,
  Link as LinkIcon,
  Plus,
  ExternalLink,
  MoreVertical,
  Trash,
  ShoppingCart,
  Edit,
  ChevronDown,
  CheckIcon,
  Clipboard,
  Share2,
} from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { ProgressCircular } from "../ui/progress-circular";

interface AffiliateLink {
  id: string;
  userId?: string;
  name: string;
  title?: string;
  slug?: string;
  uniqueCode?: string;
  customPath?: string;
  productId: string;
  productName: string;
  productUrl: string;
  productImageUrl?: string;
  productType: string;
  productPrice?: number;
  createdAt: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  commission: number;
  lastClickAt?: string;
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
  };
}

interface Product {
  id: string;
  name: string;
  url: string;
  imageUrl?: string;
  type: string;
  price?: number;
  commissionRate: number;
  description?: string;
}

interface AffiliateData {
  id: string;
  links: AffiliateLink[];
}

interface AffiliateLinksProps {
  affiliateData: AffiliateData;
}

// Etiqueta legible para un tipo de producto cuando no hay nombre disponible
function labelForType(type?: string): string {
  switch (type) {
    case "subscription":
      return "Boostify Subscription";
    case "bundle":
      return "Music Video Bundle";
    case "course":
      return "Boostify Academy Course";
    case "merchandise":
      return "Boostify Merchandise";
    default:
      return "Boostify";
  }
}

/**
 * Componente para gestionar enlaces de afiliado
 */
export function AffiliateLinks({ affiliateData }: AffiliateLinksProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLinkData, setNewLinkData] = useState({
    name: "",
    productId: "",
    slug: "",
    utmSource: "affiliate",
    utmMedium: "link",
    utmCampaign: "",
    utmContent: "",
  });

  const queryClient = useQueryClient();

  // Obtener productos disponibles para afiliados
  const {
    data: products,
    isLoading: isLoadingProducts,
    isError: isProductsError,
  } = useQuery({
    queryKey: ["/api/affiliate/products"],
    queryFn: async () => {
      const result = await apiRequest({ url: "/api/affiliate/products", method: "GET" });
      return (result?.products ?? []) as Product[];
    },
  });

  // Mutación para crear un nuevo enlace
  const createLinkMutation = useMutation({
    mutationFn: async (linkData: typeof newLinkData) => {
      const selectedProduct = products?.find((p) => p.id === linkData.productId);
      const result = await apiRequest({
        url: "/api/affiliate/links",
        method: "POST",
        data: {
          title: linkData.name || selectedProduct?.name || "Affiliate link",
          productType: selectedProduct?.type || "general",
          productId: linkData.productId || null,
          // Send the real destination of the chosen product so /ref/:code lands there
          customPath: selectedProduct?.url || null,
        },
      });
      return result;
    },
    onSuccess: () => {
      // Cerrar el diálogo y reiniciar el formulario
      setIsDialogOpen(false);
      setNewLinkData({
        name: "",
        productId: "",
        slug: "",
        utmSource: "affiliate",
        utmMedium: "link",
        utmCampaign: "",
        utmContent: "",
      });
      // Actualizar la lista de enlaces
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate/me"] });
    },
  });

  // Mutación para eliminar un enlace
  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await apiRequest({ url: `/api/affiliate/links/${linkId}`, method: "DELETE" });
      return linkId;
    },
    onSuccess: () => {
      // Actualizar la lista de enlaces
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate/me"] });
    },
  });

  // Normalizar los enlaces que vienen de la base de datos al formato que usa la UI
  const normalizedLinks: AffiliateLink[] = (affiliateData?.links || []).map((raw: any) => {
    const product = products?.find((p) => p.id === raw.productId);
    const clicks = Number(raw.clicks || 0);
    const conversions = Number(raw.conversions || 0);
    return {
      id: String(raw.id),
      name: raw.title || raw.name || "Affiliate link",
      title: raw.title,
      slug: raw.customPath || raw.slug,
      uniqueCode: raw.uniqueCode,
      customPath: raw.customPath,
      productId: raw.productId || "",
      productName: product?.name || raw.productName || labelForType(raw.productType),
      productUrl: product?.url || raw.customPath || "/",
      productImageUrl: product?.imageUrl || raw.productImageUrl,
      productType: raw.productType || "general",
      productPrice: product?.price,
      createdAt: raw.createdAt,
      clicks,
      conversions,
      conversionRate: clicks > 0 ? conversions / clicks : 0,
      revenue: Number(raw.revenue || 0),
      commission: Number(raw.earnings || raw.commission || 0),
    };
  });

  // Filtrar enlaces basados en el término de búsqueda
  const filteredLinks = normalizedLinks.filter((link) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (link.name || "").toLowerCase().includes(searchLower) ||
      (link.productName || "").toLowerCase().includes(searchLower) ||
      (link.uniqueCode || "").toLowerCase().includes(searchLower) ||
      (link.slug ? link.slug.toLowerCase().includes(searchLower) : false)
    );
  });

  // Función para copiar un enlace al portapapeles
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch((err) => {
      logger.error("No se pudo copiar el enlace:", err);
    });
  };

  // Generar URL completa para un enlace (apunta al endpoint de tracking /ref/:code)
  const getFullAffiliateUrl = (link: AffiliateLink) => {
    const baseUrl = window.location.origin;
    const code = (link.uniqueCode || link.id || "").toString();
    return `${baseUrl}/ref/${code}`;
  };

  // Manejar envío del formulario de nuevo enlace
  const handleCreateLink = (e: React.FormEvent) => {
    e.preventDefault();
    createLinkMutation.mutate(newLinkData);
  };

  // Componente para mostrar estadísticas resumidas de cada enlace
  const LinkStatBadge = ({ label, value, isPercentage = false }: { label: string; value: number; isPercentage?: boolean }) => (
    <div className="flex flex-col items-center p-2 border rounded-md">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">
        {isPercentage ? `${(value * 100).toFixed(1)}%` : value}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Enlaces de Afiliado</CardTitle>
              <CardDescription>
                Crea y gestiona tus enlaces de promoción
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo Enlace
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Enlace</DialogTitle>
                  <DialogDescription>
                    Personaliza tu enlace de afiliado para promocionar un producto
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreateLink}>
                  <div className="grid gap-4 py-4">
                    {/* Nombre del enlace */}
                    <div className="grid gap-2">
                      <Label htmlFor="link-name">Nombre del enlace</Label>
                      <Input
                        id="link-name"
                        placeholder="Ej: Promoción Instagram"
                        value={newLinkData.name}
                        onChange={(e) =>
                          setNewLinkData({ ...newLinkData, name: e.target.value })
                        }
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Un nombre descriptivo para identificar este enlace
                      </p>
                    </div>

                    {/* Producto */}
                    <div className="grid gap-2">
                      <Label htmlFor="product">Producto</Label>
                      <Select
                        value={newLinkData.productId}
                        onValueChange={(value) =>
                          setNewLinkData({ ...newLinkData, productId: value })
                        }
                        required
                      >
                        <SelectTrigger id="product">
                          <SelectValue placeholder="Selecciona un producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {isLoadingProducts ? (
                            <div className="flex items-center justify-center p-4">
                              <ProgressCircular value={undefined} size="sm" />
                              <span className="ml-2">Cargando productos...</span>
                            </div>
                          ) : (
                            products?.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                                {product.price && ` - $${product.price}`}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        El producto que promocionarás con este enlace
                      </p>
                    </div>

                    {/* URL personalizada */}
                    <div className="grid gap-2">
                      <Label htmlFor="custom-slug">URL personalizada (opcional)</Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 bg-muted border border-r-0 border-input rounded-l-md text-sm text-muted-foreground">
                          {window.location.origin}/ref/
                        </span>
                        <Input
                          id="custom-slug"
                          className="rounded-l-none"
                          placeholder="tu-slug-personalizado"
                          value={newLinkData.slug}
                          onChange={(e) =>
                            setNewLinkData({
                              ...newLinkData,
                              slug: e.target.value.replace(/\s+/g, "-").toLowerCase(),
                            })
                          }
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Una URL amigable para tu enlace (solo letras, números y guiones)
                      </p>
                    </div>

                    {/* Parámetros UTM avanzados (colapsable) */}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium pb-2 flex items-center">
                        <ChevronDown className="h-4 w-4 mr-1 inline" />
                        Parámetros UTM avanzados
                      </summary>
                      <div className="pl-2 pt-2 space-y-4 border-l">
                        <div className="grid gap-2">
                          <Label htmlFor="utm-source">Fuente (UTM Source)</Label>
                          <Input
                            id="utm-source"
                            placeholder="affiliate"
                            value={newLinkData.utmSource}
                            onChange={(e) =>
                              setNewLinkData({
                                ...newLinkData,
                                utmSource: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="utm-medium">Medio (UTM Medium)</Label>
                          <Input
                            id="utm-medium"
                            placeholder="link"
                            value={newLinkData.utmMedium}
                            onChange={(e) =>
                              setNewLinkData({
                                ...newLinkData,
                                utmMedium: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="utm-campaign">Campaña (UTM Campaign)</Label>
                          <Input
                            id="utm-campaign"
                            placeholder="summer_sale"
                            value={newLinkData.utmCampaign}
                            onChange={(e) =>
                              setNewLinkData({
                                ...newLinkData,
                                utmCampaign: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="utm-content">Contenido (UTM Content)</Label>
                          <Input
                            id="utm-content"
                            placeholder="banner_sidebar"
                            value={newLinkData.utmContent}
                            onChange={(e) =>
                              setNewLinkData({
                                ...newLinkData,
                                utmContent: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </details>
                  </div>

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createLinkMutation.isPending}
                      className="gap-2"
                    >
                      {createLinkMutation.isPending ? (
                        <>
                          <ProgressCircular value={undefined} size="xs" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Crear Enlace
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Buscador */}
          <div className="mb-4">
            <Input
              placeholder="Buscar enlaces..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {/* Lista de enlaces */}
          {filteredLinks.length === 0 ? (
            <div className="rounded-md border p-8 flex flex-col items-center justify-center text-center">
              <LinkIcon className="h-12 w-12 text-muted-foreground/70 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {searchTerm
                  ? "No se encontraron enlaces"
                  : "Aún no tienes enlaces de afiliado"}
              </h3>
              <p className="text-muted-foreground max-w-md mb-4">
                {searchTerm
                  ? `No hay resultados para "${searchTerm}". Intenta con otro término.`
                  : "Comienza creando tu primer enlace de afiliado para promocionar nuestros productos."}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Crear Enlace
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="hidden md:table-cell">Clics</TableHead>
                      <TableHead className="hidden md:table-cell">Conversiones</TableHead>
                      <TableHead className="hidden md:table-cell">Comisión</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{link.name}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {`/ref/${link.uniqueCode || link.id}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {link.productImageUrl && (
                              <div className="w-8 h-8 rounded-md overflow-hidden bg-muted">
                                <img
                                  src={link.productImageUrl}
                                  alt={link.productName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <span className="line-clamp-1">{link.productName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {link.clicks}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <span>{link.conversions}</span>
                            <span className="text-xs text-muted-foreground">
                              ({((link?.conversionRate || 0) * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          ${(link?.commission || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => copyToClipboard(getFullAffiliateUrl(link))}
                              title="Copiar enlace"
                            >
                              <Copy className="h-4 w-4" />
                              <span className="sr-only">Copiar</span>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                  <span className="sr-only">Más opciones</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => copyToClipboard(getFullAffiliateUrl(link))}
                                >
                                  <Clipboard className="h-4 w-4 mr-2" />
                                  Copiar enlace
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => window.open(getFullAffiliateUrl(link), "_blank")}
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Abrir enlace
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (navigator.share) {
                                      navigator.share({
                                        title: link.name,
                                        text: `Echa un vistazo a ${link.productName}`,
                                        url: getFullAffiliateUrl(link),
                                      }).catch(console.error);
                                    } else {
                                      copyToClipboard(getFullAffiliateUrl(link));
                                    }
                                  }}
                                >
                                  <Share2 className="h-4 w-4 mr-2" />
                                  Compartir
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-500 focus:text-red-500"
                                  onClick={() => {
                                    if (confirm("¿Estás seguro de que quieres eliminar este enlace?")) {
                                      deleteLinkMutation.mutate(link.id);
                                    }
                                  }}
                                >
                                  <Trash className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {filteredLinks.length} enlaces en total
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>
              Clics totales:{" "}
              <strong>
                {filteredLinks.reduce((acc, link) => acc + link.clicks, 0)}
              </strong>
            </span>
            <span>
              Conversiones totales:{" "}
              <strong>
                {filteredLinks.reduce((acc, link) => acc + link.conversions, 0)}
              </strong>
            </span>
          </div>
        </CardFooter>
      </Card>

      {/* Sección de productos promocionables */}
      <Card>
        <CardHeader>
          <CardTitle>Productos Promocionables</CardTitle>
          <CardDescription>
            Productos disponibles para promocionar como afiliado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingProducts ? (
            <div className="flex items-center justify-center p-8">
              <ProgressCircular value={undefined} className="mr-3" />
              <span>Cargando productos disponibles...</span>
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {products.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  {product.imageUrl && (
                    <div className="h-32 overflow-hidden">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="font-semibold">{product?.name || "Producto sin nombre"}</h3>
                      {product.price && (
                        <Badge variant="outline">${product.price}</Badge>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        {(product?.commissionRate || 0)}% comisión
                      </Badge>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            Crear enlace
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Crear Enlace para {product?.name || "Producto"}</DialogTitle>
                            <DialogDescription>
                              Personaliza tu enlace para promocionar este producto
                            </DialogDescription>
                          </DialogHeader>
                          {/* Formulario simple con los campos mínimos */}
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="quick-link-name">Nombre del enlace</Label>
                              <Input id="quick-link-name" placeholder="Ej: Promoción Instagram" />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="quick-slug">URL personalizada (opcional)</Label>
                              <div className="flex">
                                <span className="inline-flex items-center px-3 bg-muted border border-r-0 border-input rounded-l-md text-sm text-muted-foreground">
                                  {window.location.origin}/ref/
                                </span>
                                <Input
                                  id="quick-slug"
                                  className="rounded-l-none"
                                  placeholder="tu-slug-personalizado"
                                />
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button className="gap-2">
                              <Plus className="h-4 w-4" />
                              Crear Enlace
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-md border p-8 flex flex-col items-center justify-center text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground/70 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                No hay productos disponibles
              </h3>
              <p className="text-muted-foreground max-w-md">
                Actualmente no hay productos disponibles para promocionar. Por favor, revisa más tarde.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}