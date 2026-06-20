import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Product, AffiliateLinkType } from "../types/affiliate";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
// Crear un objeto toast temporal mientras solucionamos el error de sonner
const toast = {
  success: (message: string) => console.log('Success:', message),
  error: (message: string) => console.error('Error:', message),
  info: (message: string) => console.info('Info:', message)
};
import { AlertCircle, CheckCircle2, Loader2, Copy, Link, BarChart, Trash2, PlusCircle, ArrowUpDown, ChevronDown, MoreHorizontal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";

interface AffiliateLinksProps {
  affiliateData: any;
}

// Esquema de validación para la creación de un nuevo enlace
const newLinkFormSchema = z.object({
  productId: z.string({ required_error: "Selecciona un producto" }),
  campaign: z.string().min(3, { message: "La campaña debe tener al menos 3 caracteres" }).max(50, { message: "La campaña no puede exceder los 50 caracteres" }).optional().or(z.literal("")),
  utmSource: z.string().optional().or(z.literal("")),
  utmMedium: z.string().optional().or(z.literal("")),
  utmCampaign: z.string().optional().or(z.literal("")),
});

type NewLinkFormValues = z.infer<typeof newLinkFormSchema>;

export function AffiliateLinks({ affiliateData }: AffiliateLinksProps) {
  const { user } = useAuth() || {};
  const queryClient = useQueryClient();
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<any | null>(null);
  const [sortColumn, setSortColumn] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Inicializar useForm para el formulario de nuevo enlace
  const form = useForm<NewLinkFormValues>({
    resolver: zodResolver(newLinkFormSchema),
    defaultValues: {
      productId: "",
      campaign: "",
      utmSource: "boostify_affiliate",
      utmMedium: "affiliate",
      utmCampaign: "",
    },
  });

  // Consulta para obtener los productos disponibles para afiliados
  const { data: products, isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["affiliate-products"],
    queryFn: async () => {
      const productsRef = collection(db, "affiliateProducts");
      const querySnapshot = await getDocs(productsRef);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
    },
  });

  // Consulta para obtener los enlaces de afiliado del usuario
  const { data: affiliateLinks, isLoading: isLoadingLinks } = useQuery<AffiliateLinkType[]>({
    queryKey: ["affiliate-links", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      const linksRef = collection(db, "affiliateLinks");
      const q = query(linksRef, where("affiliateId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        productId: doc.data().productId || "",
        campaign: doc.data().campaign || "",
        url: doc.data().url || "",
        clicks: doc.data().clicks || 0,
        conversions: doc.data().conversions || 0,
        earnings: doc.data().earnings || 0
      })) as AffiliateLinkType[];
    },
    enabled: !!user?.uid,
  });

  // Mutación para crear un nuevo enlace de afiliado
  const createLinkMutation = useMutation({
    mutationFn: async (data: NewLinkFormValues) => {
      if (!user?.uid) throw new Error("Usuario no autenticado");
      
      // Encontrar información del producto seleccionado
      const selectedProduct = products?.find(p => p.id === data.productId);
      if (!selectedProduct) throw new Error("Producto no encontrado");
      
      // Crear enlace con parámetros de afiliado
      let baseUrl = selectedProduct.url || `https://boostify.com/products/${selectedProduct.id}`;
      
      // Asegurar que la URL base no tenga parámetros de consulta
      const hasQueryParams = baseUrl.includes('?');
      const baseUrlWithoutParams = hasQueryParams ? baseUrl.split('?')[0] : baseUrl;
      
      // Construir los parámetros UTM
      const queryParams = new URLSearchParams();
      queryParams.append('ref', user.uid);
      
      if (data.utmSource) queryParams.append('utm_source', data.utmSource);
      if (data.utmMedium) queryParams.append('utm_medium', data.utmMedium);
      if (data.utmCampaign) queryParams.append('utm_campaign', data.utmCampaign);
      if (data.campaign) queryParams.append('campaign', data.campaign);
      
      const fullUrl = `${baseUrlWithoutParams}?${queryParams.toString()}`;
      
      // Guardar el enlace en Firestore
      const linkData = {
        affiliateId: user.uid,
        productId: data.productId,
        url: fullUrl,
        campaign: data.campaign || "",
        utmParams: {
          source: data.utmSource || "",
          medium: data.utmMedium || "",
          campaign: data.utmCampaign || "",
        },
        clicks: 0,
        conversions: 0,
        earnings: 0,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, "affiliateLinks"), linkData);
      return { id: docRef.id, ...linkData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-links", user?.uid] });
      toast.success("Enlace de afiliado creado correctamente");
      form.reset();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error al crear enlace:", error);
      toast.error("Error al crear el enlace de afiliado");
    },
  });

  // Mutación para eliminar un enlace de afiliado
  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await deleteDoc(doc(db, "affiliateLinks", linkId));
      return linkId;
    },
    onSuccess: (linkId) => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-links", user?.uid] });
      toast.success("Enlace de afiliado eliminado correctamente");
    },
    onError: (error) => {
      console.error("Error al eliminar enlace:", error);
      toast.error("Error al eliminar el enlace de afiliado");
    },
  });

  // Función para copiar un enlace al portapapeles
  const copyLinkToClipboard = (url: string | undefined) => {
    if (!url) {
      toast.error("Enlace no disponible");
      return;
    }
    
    navigator.clipboard.writeText(url)
      .then(() => {
        toast.success("Enlace copiado al portapapeles");
      })
      .catch(err => {
        console.error("Error al copiar enlace:", err);
        toast.error("Error al copiar enlace");
      });
  };

  // Función para manejar la ordenación de la tabla
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Ordenar los enlaces según la columna y dirección seleccionadas
  const sortedLinks = affiliateLinks ? [...affiliateLinks].sort((a, b) => {
    let valueA, valueB;
    
    // Obtener los valores a comparar según la columna
    if (sortColumn === "productId") {
      const productA = products?.find(p => p.id === a.productId);
      const productB = products?.find(p => p.id === b.productId);
      valueA = productA?.name || "";
      valueB = productB?.name || "";
    } else if (sortColumn === "createdAt") {
      valueA = new Date(a.createdAt).getTime();
      valueB = new Date(b.createdAt).getTime();
    } else if (["clicks", "conversions", "earnings"].includes(sortColumn)) {
      valueA = a[sortColumn] || 0;
      valueB = b[sortColumn] || 0;
    } else {
      valueA = a[sortColumn] || "";
      valueB = b[sortColumn] || "";
    }
    
    // Comparar según la dirección
    if (sortDirection === "asc") {
      return valueA > valueB ? 1 : -1;
    } else {
      return valueA < valueB ? 1 : -1;
    }
  }) : [];

  // Función para manejar la creación de un nuevo enlace
  const onSubmit = (data: NewLinkFormValues) => {
    setIsCreatingLink(true);
    createLinkMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Enlaces de Afiliado</h2>
          <p className="text-muted-foreground">
            Genera y gestiona tus enlaces de afiliado para promocionar productos
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Crear nuevo enlace
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear nuevo enlace de afiliado</DialogTitle>
              <DialogDescription>
                Selecciona un producto y personaliza tu enlace de afiliado.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Producto</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedProduct(value);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un producto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Productos disponibles</SelectLabel>
                            {isLoadingProducts ? (
                              <div className="flex items-center justify-center p-2">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Cargando productos...
                              </div>
                            ) : (
                              products?.map((product: any) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} - {product.commissionRate}% comisión
                                </SelectItem>
                              ))
                            )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="campaign"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaña (opcional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Nombre de tu campaña" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Identifica esta campaña específica (ej. "Instagram Verano")
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Parámetros UTM avanzados (opcionales)</h4>
                  
                  <FormField
                    control={form.control}
                    name="utmSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fuente (utm_source)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="boostify_affiliate" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="utmMedium"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medio (utm_medium)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="affiliate" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="utmCampaign"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaña UTM (utm_campaign)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="summer_promo" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <DialogFooter className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={createLinkMutation.isPending}
                    className="w-full"
                  >
                    {createLinkMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando enlace...
                      </>
                    ) : (
                      "Crear enlace"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Tus enlaces de afiliado</CardTitle>
          <CardDescription>
            Gestiona y haz seguimiento de todos tus enlaces de promoción
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLinks ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : affiliateLinks && affiliateLinks.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">
                      <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort("productId")}>
                        Producto
                        {sortColumn === "productId" && (
                          <ChevronDown className={`h-4 w-4 transition-transform ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort("campaign")}>
                        Campaña
                        {sortColumn === "campaign" && (
                          <ChevronDown className={`h-4 w-4 transition-transform ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center gap-1 cursor-pointer justify-center" onClick={() => handleSort("clicks")}>
                        Clics
                        {sortColumn === "clicks" && (
                          <ChevronDown className={`h-4 w-4 transition-transform ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center gap-1 cursor-pointer justify-center" onClick={() => handleSort("conversions")}>
                        Conversiones
                        {sortColumn === "conversions" && (
                          <ChevronDown className={`h-4 w-4 transition-transform ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center gap-1 cursor-pointer justify-center" onClick={() => handleSort("earnings")}>
                        Ganancias
                        {sortColumn === "earnings" && (
                          <ChevronDown className={`h-4 w-4 transition-transform ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLinks.map((link) => {
                    const product = products?.find(p => p.id === link.productId);
                    return (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium">
                          {product?.name || "Producto desconocido"}
                        </TableCell>
                        <TableCell>
                          {link.campaign ? (
                            link.campaign
                          ) : (
                            <span className="text-muted-foreground text-sm italic">Sin campaña</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{link.clicks || 0}</TableCell>
                        <TableCell className="text-center">{link.conversions || 0}</TableCell>
                        <TableCell className="text-center">${(link.earnings || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menú</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => copyLinkToClipboard(link.url)}>
                                <Copy className="mr-2 h-4 w-4" />
                                <span>Copiar enlace</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => link.url && window.open(link.url, "_blank")}>
                                <Link className="mr-2 h-4 w-4" />
                                <span>Abrir enlace</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  if (confirm("¿Estás seguro de que quieres eliminar este enlace?")) {
                                    deleteLinkMutation.mutate(link.id);
                                  }
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Eliminar</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
                <Link className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium">No tienes enlaces de afiliado</h3>
                <p className="text-sm text-muted-foreground">
                  Crea tu primer enlace para comenzar a promocionar productos
                </p>
              </div>
              <Button onClick={() => setIsDialogOpen(true)}>
                Crear primer enlace
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="text-sm text-muted-foreground">
            Total de enlaces: {affiliateLinks?.length || 0}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500"></div>
              <span>Total de clics: {affiliateLinks?.reduce((sum, link) => sum + (link.clicks || 0), 0)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <span>Conversiones: {affiliateLinks?.reduce((sum, link) => sum + (link.conversions || 0), 0)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500"></div>
              <span>Ganancias totales: ${affiliateLinks?.reduce((sum, link) => sum + (link.earnings || 0), 0).toFixed(2)}</span>
            </div>
          </div>
        </CardFooter>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Enlaces populares</CardTitle>
            <CardDescription>
              Tus enlaces con mejor rendimiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingLinks ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : affiliateLinks && affiliateLinks.length > 0 ? (
              <div className="space-y-4">
                {[...affiliateLinks]
                  .sort((a, b) => (b.conversions || 0) - (a.conversions || 0))
                  .slice(0, 3)
                  .map((link) => {
                    const product = products?.find(p => p.id === link.productId);
                    return (
                      <div key={link.id} className="flex flex-col p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{product?.name}</h4>
                            <p className="text-sm text-muted-foreground truncate max-w-[220px]">
                              {link.campaign || "Campaña sin nombre"}
                            </p>
                          </div>
                          <Badge variant="outline" className="ml-auto">
                            {product?.commissionRate}% comisión
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <div className="flex flex-col items-center p-2 bg-muted rounded">
                            <span className="text-sm font-medium">{link.clicks || 0}</span>
                            <span className="text-xs text-muted-foreground">Clics</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-muted rounded">
                            <span className="text-sm font-medium">{link.conversions || 0}</span>
                            <span className="text-xs text-muted-foreground">Conversiones</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-muted rounded">
                            <span className="text-sm font-medium">${(link.earnings || 0).toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground">Ganancia</span>
                          </div>
                        </div>
                        <div className="mt-3 flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => copyLinkToClipboard(link.url)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copiar
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => link.url && window.open(link.url, "_blank")}
                          >
                            <Link className="h-3.5 w-3.5 mr-1" />
                            Abrir
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center space-y-2">
                <BarChart className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Crea enlaces para ver estadísticas
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos recomendados</CardTitle>
            <CardDescription>
              Productos con altas tasas de conversión para promocionar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingProducts ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : products && products.length > 0 ? (
              <div className="space-y-4">
                {products
                  .sort((a, b) => (b.commissionRate || 0) - (a.commissionRate || 0))
                  .slice(0, 3)
                  .map((product) => (
                    <div key={product.id} className="flex flex-col p-4 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium">{product.name}</h4>
                        <Badge className="ml-auto bg-green-500/10 text-green-600 border-green-500/20">
                          {product.commissionRate}% comisión
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {product.description}
                      </p>
                      <div className="mt-4">
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="w-full"
                          onClick={() => {
                            form.setValue("productId", product.id);
                            setSelectedProduct(product.id);
                            setIsDialogOpen(true);
                          }}
                        >
                          <PlusCircle className="h-3.5 w-3.5 mr-1" />
                          Crear enlace
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center space-y-2">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No hay productos disponibles
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}