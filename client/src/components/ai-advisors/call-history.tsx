/**
 * Componente para mostrar el historial de llamadas a asesores
 * con diferentes opciones de visualización
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '../../hooks/use-toast';
import { advisorCallService, AdvisorCall, ADVISOR_PHONE_NUMBER } from '../../lib/services/advisor-call-service';
import { Timestamp } from 'firebase/firestore';

// Importar componentes de UI
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';

// Importar iconos
import {
  MoreVertical,
  Phone,
  PhoneCall,
  Clock,
  Calendar,
  Download,
  Filter,
  AlertCircle,
  FileText,
  User,
  RefreshCcw
} from 'lucide-react';

interface CallHistoryProps {
  maxCalls?: number;
  variant?: 'default' | 'compact' | 'card';
  showHeader?: boolean;
  showFooter?: boolean;
  showFilters?: boolean;
  className?: string;
}

export function CallHistory({
  maxCalls = 10,
  variant = 'default',
  showHeader = true,
  showFooter = true,
  showFilters = true,
  className = '',
}: CallHistoryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [calls, setCalls] = useState<AdvisorCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCalls, setTotalCalls] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  
  // Estados para filtrado
  const [currentTab, setCurrentTab] = useState('all');
  const [filteredCalls, setFilteredCalls] = useState<AdvisorCall[]>([]);
  
  // Cargar historial de llamadas
  useEffect(() => {
    const loadCallHistory = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        const history = await advisorCallService.getUserCallHistory(maxCalls);
        
        setCalls(history.calls);
        setTotalCalls(history.totalCalls);
        setTotalDuration(history.totalDuration);
        setFilteredCalls(history.calls);
      } catch (err: any) {
        console.error('Error loading call history:', err);
        setError(err.message || 'Error al cargar historial de llamadas');
        
        toast({
          title: 'Error',
          description: 'No se pudo cargar el historial de llamadas',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCallHistory();
  }, [user, maxCalls, toast]);
  
  // Efecto para filtrar llamadas cuando cambia la pestaña
  useEffect(() => {
    if (currentTab === 'all') {
      setFilteredCalls(calls);
    } else {
      setFilteredCalls(calls.filter(call => call.status === currentTab));
    }
  }, [currentTab, calls]);
  
  // Formatear duración de llamada
  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} seg`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return `${minutes} min${remainingSeconds > 0 ? ` ${remainingSeconds} seg` : ''}`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours} h${remainingMinutes > 0 ? ` ${remainingMinutes} min` : ''}`;
  };
  
  // Obtener color de estado para badge
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
      case 'cancelled':
        return 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
      default:
        return 'bg-muted';
    }
  };
  
  // Obtener texto de estado traducido
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      case 'failed':
        return 'Fallida';
      default:
        return 'Desconocido';
    }
  };
  
  // Exportar historial de llamadas a CSV
  const exportToCSV = () => {
    if (calls.length === 0) {
      toast({
        title: 'Sin datos',
        description: 'No hay llamadas para exportar',
        variant: 'default'
      });
      return;
    }
    
    try {
      // Cabecera del CSV
      const headers = ['Fecha', 'Asesor', 'Cargo', 'Teléfono', 'Duración', 'Estado', 'Notas'];
      
      // Convertir datos a filas CSV
      const csvRows = [
        headers.join(','),
        ...calls.map(call => {
          const timestamp = call.timestamp instanceof Timestamp 
            ? call.timestamp.toDate() 
            : new Date(call.timestamp);
            
          const date = format(timestamp, 'dd/MM/yyyy HH:mm');
          const duration = formatDuration(call.duration);
          const status = getStatusText(call.status);
          const phoneNumber = call.phoneNumber || ADVISOR_PHONE_NUMBER;
          
          // Escapar notas (pueden contener comas)
          const notes = call.notes ? `"${call.notes.replace(/"/g, '""')}"` : '';
          
          return [
            date,
            call.advisorName,
            call.advisorTitle,
            phoneNumber,
            duration,
            status,
            notes
          ].join(',');
        })
      ];
      
      // Unir filas con saltos de línea
      const csvString = csvRows.join('\n');
      
      // Crear archivo Blob
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      
      // Crear URL de descarga
      const url = URL.createObjectURL(blob);
      
      // Crear elemento de ancla para descarga
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `historial-llamadas-${format(new Date(), 'yyyyMMdd')}.csv`);
      link.style.display = 'none';
      
      // Agregar al DOM, hacer clic y luego eliminar
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Exportación completada',
        description: 'El historial de llamadas se ha descargado correctamente',
      });
    } catch (error) {
      console.error('Error exporting call history:', error);
      toast({
        title: 'Error de exportación',
        description: 'No se pudo exportar el historial de llamadas',
        variant: 'destructive'
      });
    }
  };
  
  // Recargar datos manualmente
  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const history = await advisorCallService.getUserCallHistory(maxCalls);
      
      setCalls(history.calls);
      setTotalCalls(history.totalCalls);
      setTotalDuration(history.totalDuration);
      setFilteredCalls(
        currentTab === 'all' 
          ? history.calls 
          : history.calls.filter(call => call.status === currentTab)
      );
      
      toast({
        title: 'Datos actualizados',
        description: 'El historial de llamadas se ha recargado correctamente'
      });
    } catch (err: any) {
      console.error('Error refreshing call history:', err);
      setError(err.message || 'Error al recargar historial de llamadas');
      
      toast({
        title: 'Error',
        description: 'No se pudo recargar el historial de llamadas',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Versión compacta del componente para paneles
  if (variant === 'compact') {
    return (
      <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <PhoneCall className="w-4 h-4 mr-2 text-primary" />
              <span className="font-medium text-sm">Llamadas recientes</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-2 text-center">
              <AlertCircle className="w-8 h-8 text-destructive mb-2" />
              <p className="text-xs text-muted-foreground">Error al cargar llamadas</p>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-3">
              <p className="text-sm text-muted-foreground">No hay llamadas registradas</p>
            </div>
          ) : (
            <ScrollArea className="h-[160px]">
              <div className="space-y-2">
                {filteredCalls.slice(0, 5).map((call) => {
                  const date = call.timestamp instanceof Timestamp
                    ? call.timestamp.toDate()
                    : new Date(call.timestamp);
                    
                  return (
                    <div key={call.id} className="flex items-center py-1">
                      <div className="flex-shrink-0 mr-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          call.status === 'completed' ? 'bg-green-500/10' :
                          call.status === 'cancelled' ? 'bg-amber-500/10' :
                          'bg-red-500/10'
                        }`}>
                          <Phone className={`w-4 h-4 ${
                            call.status === 'completed' ? 'text-green-500' :
                            call.status === 'cancelled' ? 'text-amber-500' :
                            'text-red-500'
                          }`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{call.advisorName}</p>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 text-muted-foreground mr-1" />
                          <span className="text-xs text-muted-foreground">{formatDuration(call.duration)}</span>
                          <span className="mx-1 text-muted-foreground text-xs">•</span>
                          <span className="text-xs text-muted-foreground">{format(date, 'dd MMM', { locale: es })}</span>
                        </div>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className={getStatusColor(call.status)} variant="outline">
                              {getStatusText(call.status).charAt(0)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {getStatusText(call.status)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
        {!isLoading && !error && filteredCalls.length > 0 && (
          <div className="border-t p-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{totalCalls} llamadas en total</span>
            <span>{formatDuration(totalDuration)} acumulados</span>
          </div>
        )}
      </div>
    );
  }
  
  // Versión estilo card para dashboard
  if (variant === 'card') {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Historial de Llamadas</CardTitle>
                <CardDescription>Registro de tus llamadas a asesores</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </CardHeader>
        )}
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive" className="my-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                No se pudo cargar el historial de llamadas. Intenta nuevamente.
              </AlertDescription>
            </Alert>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Phone className="w-12 h-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-medium">No hay llamadas registradas</h3>
                <p className="text-sm text-muted-foreground">
                  Tu historial de llamadas a asesores aparecerá aquí.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {showFilters && (
                <div className="flex justify-between items-center mb-2">
                  <Tabs 
                    defaultValue="all" 
                    value={currentTab}
                    onValueChange={setCurrentTab}
                    className="w-full"
                  >
                    <TabsList className="grid grid-cols-3 w-full">
                      <TabsTrigger value="all">Todas</TabsTrigger>
                      <TabsTrigger value="completed">Completadas</TabsTrigger>
                      <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}
              
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {filteredCalls.map((call) => {
                    const date = call.timestamp instanceof Timestamp
                      ? call.timestamp.toDate()
                      : new Date(call.timestamp);
                      
                    return (
                      <div 
                        key={call.id}
                        className="flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-shrink-0 mr-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            call.status === 'completed' ? 'bg-green-500/10' :
                            call.status === 'cancelled' ? 'bg-amber-500/10' :
                            'bg-red-500/10'
                          }`}>
                            <Phone className={`w-5 h-5 ${
                              call.status === 'completed' ? 'text-green-500' :
                              call.status === 'cancelled' ? 'text-amber-500' :
                              'text-red-500'
                            }`} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{call.advisorName}</p>
                            <Badge className={getStatusColor(call.status)} variant="outline">
                              {getStatusText(call.status)}
                            </Badge>
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <User className="h-3 w-3 mr-1" />
                            <span>{call.advisorTitle}</span>
                            <span className="mx-1">•</span>
                            <Clock className="h-3 w-3 mr-1" />
                            <span>{formatDuration(call.duration)}</span>
                            <span className="mx-1">•</span>
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{format(date, 'dd MMM yyyy, HH:mm', { locale: es })}</span>
                          </div>
                          
                          {call.notes && (
                            <div className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded-md">
                              <div className="flex items-start">
                                <FileText className="h-3 w-3 mr-1 mt-0.5" />
                                <p className="line-clamp-2">{call.notes}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
        {showFooter && !isLoading && !error && filteredCalls.length > 0 && (
          <CardFooter className="flex justify-between items-center border-t pt-3">
            <div className="text-xs text-muted-foreground">
              {totalCalls} llamadas • {formatDuration(totalDuration)} tiempo total
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={filteredCalls.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }
  
  // Versión predeterminada del componente (tabla completa)
  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Historial completo de llamadas</CardTitle>
              <CardDescription>Registro de todas tus interacciones con asesores</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              {filteredCalls.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      )}
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive" className="my-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              No se pudo cargar el historial de llamadas. Intenta nuevamente.
            </AlertDescription>
          </Alert>
        ) : filteredCalls.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <Phone className="w-16 h-16 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-medium">No hay llamadas registradas</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Tu historial de llamadas a asesores aparecerá aquí.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {showFilters && (
              <div className="flex justify-between items-center mb-4">
                <Tabs 
                  defaultValue="all" 
                  value={currentTab}
                  onValueChange={setCurrentTab}
                  className="w-full max-w-md"
                >
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="all">Todas</TabsTrigger>
                    <TabsTrigger value="completed">Completadas</TabsTrigger>
                    <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center">
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {filteredCalls.length} {filteredCalls.length === 1 ? 'llamada' : 'llamadas'} mostradas
                  </span>
                </div>
              </div>
            )}
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asesor</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCalls.map((call) => {
                    const date = call.timestamp instanceof Timestamp
                      ? call.timestamp.toDate()
                      : new Date(call.timestamp);
                      
                    return (
                      <TableRow key={call.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{call.advisorName}</p>
                            <p className="text-xs text-muted-foreground">{call.advisorTitle}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="link" 
                                  className="font-medium text-sm p-0 h-auto"
                                  onClick={() => window.open(`tel:${(call.phoneNumber || ADVISOR_PHONE_NUMBER).replace(/\s+/g, '')}`, '_blank')}
                                >
                                  {call.phoneNumber || ADVISOR_PHONE_NUMBER}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Llamar a este número</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{format(date, 'dd/MM/yyyy', { locale: es })}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(date, 'HH:mm', { locale: es })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDuration(call.duration)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getStatusColor(call.status)}
                          >
                            {getStatusText(call.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem 
                                      className="flex items-center cursor-pointer"
                                      onClick={() => {
                                        navigator.clipboard.writeText(call.notes || '');
                                        toast({
                                          title: 'Notas copiadas',
                                          description: 'Las notas se han copiado al portapapeles',
                                        });
                                      }}
                                      disabled={!call.notes}
                                    >
                                      <FileText className="mr-2 h-4 w-4" />
                                      <span>Copiar notas</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Opciones</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableCaption>
                  {totalCalls} llamadas en total • {formatDuration(totalDuration)} de tiempo acumulado
                </TableCaption>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}