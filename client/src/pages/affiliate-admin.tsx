import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Clock,
  Shield,
  CreditCard,
  BarChart3
} from 'lucide-react';

interface Affiliate {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  level: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  totalClicks: number;
  totalConversions: number;
  totalEarnings: string;
  pendingPayment: string;
  paidAmount: string;
  createdAt: string;
}

interface PendingPayout {
  id: number;
  affiliateId: number;
  amount: string;
  description: string;
  status: string;
  metadata: any;
  createdAt: string;
  affiliateName: string;
  affiliateEmail: string;
  paymentMethod: string;
  paymentEmail: string;
}

interface AdminStats {
  totalAffiliates: number;
  pending: number;
  approved: number;
  rejected: number;
  suspended: number;
  totalClicks: number;
  totalConversions: number;
  totalEarnings: number;
  totalPendingPayments: number;
  totalPaidOut: number;
  conversionRate: string;
  pendingPayoutsCount: number;
  pendingPayoutsAmount: number;
  topPerformers: Array<{
    id: number;
    name: string;
    email: string;
    level: string;
    conversions: number;
    earnings: number;
  }>;
}

export default function AffiliateAdminDashboard() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch admin stats
  const { data: statsData } = useQuery({
    queryKey: ['/api/affiliate/admin/stats'],
  });

  // Fetch all affiliates
  const { data: affiliatesData, isLoading: loadingAffiliates } = useQuery({
    queryKey: ['/api/affiliate/admin/all', statusFilter],
    queryFn: async () => {
      const url = statusFilter === 'all' 
        ? '/api/affiliate/admin/all'
        : `/api/affiliate/admin/all?status=${statusFilter}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch affiliates');
      return res.json();
    }
  });

  // Fetch pending payouts
  const { data: payoutsData, isLoading: loadingPayouts } = useQuery({
    queryKey: ['/api/affiliate/admin/pending-payouts'],
  });

  const stats = statsData?.stats as AdminStats | undefined;
  const affiliates = affiliatesData?.affiliates as Affiliate[] | undefined;
  const pendingPayouts = payoutsData?.payouts as PendingPayout[] | undefined;

  // Approve affiliate mutation
  const approveAffiliate = useMutation({
    mutationFn: async (affiliateId: number) => {
      return apiRequest(`/api/affiliate/admin/approve/${affiliateId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate/admin/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate/admin/stats'] });
      toast({
        title: 'Afiliado aprobado',
        description: 'El afiliado ha sido aprobado exitosamente',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo aprobar el afiliado',
        variant: 'destructive',
      });
    },
  });

  // Reject affiliate mutation
  const rejectAffiliate = useMutation({
    mutationFn: async (affiliateId: number) => {
      return apiRequest(`/api/affiliate/admin/reject/${affiliateId}`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Rejected by admin' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate/admin/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate/admin/stats'] });
      toast({
        title: 'Afiliado rechazado',
        description: 'El afiliado ha sido rechazado',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo rechazar el afiliado',
        variant: 'destructive',
      });
    },
  });

  // Approve payout mutation
  const approvePayout = useMutation({
    mutationFn: async (payoutId: number) => {
      return apiRequest(`/api/affiliate/admin/approve-payout/${payoutId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate/admin/pending-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate/admin/all'] });
      toast({
        title: 'Pago aprobado',
        description: 'El pago ha sido procesado exitosamente',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo aprobar el pago',
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      approved: 'default',
      rejected: 'destructive',
      suspended: 'secondary',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      'Básico': 'bg-gray-100 text-gray-800',
      'Plata': 'bg-slate-100 text-slate-800',
      'Oro': 'bg-yellow-100 text-yellow-800',
      'Platino': 'bg-purple-100 text-purple-800',
      'Diamante': 'bg-blue-100 text-blue-800',
    };

    return (
      <Badge className={colors[level] || 'bg-gray-100 text-gray-800'}>
        {level}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard - Affiliates</h1>
          <p className="text-muted-foreground">Gestiona afiliados y pagos del sistema</p>
        </div>
      </div>

      <Tabs defaultValue="stats" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="stats" data-testid="tab-stats">
            <BarChart3 className="h-4 w-4 mr-2" />
            Estadísticas
          </TabsTrigger>
          <TabsTrigger value="affiliates" data-testid="tab-affiliates">
            <Users className="h-4 w-4 mr-2" />
            Afiliados
          </TabsTrigger>
          <TabsTrigger value="payouts" data-testid="tab-payouts">
            <CreditCard className="h-4 w-4 mr-2" />
            Pagos
          </TabsTrigger>
        </TabsList>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Afiliados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-affiliates">
                  {stats?.totalAffiliates || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.pending || 0} pendientes • {stats?.approved || 0} aprobados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-clicks">
                  {stats?.totalClicks || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.totalConversions || 0} conversiones ({stats?.conversionRate || '0'}% rate)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Comisiones</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-earnings">
                  ${(stats?.totalEarnings || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  ${(stats?.totalPaidOut || 0).toFixed(2)} pagado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-pending-payouts">
                  ${(stats?.pendingPayoutsAmount || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.pendingPayoutsCount || 0} solicitudes pendientes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers */}
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Afiliados</CardTitle>
              <CardDescription>Los afiliados con mejores resultados</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead className="text-right">Conversiones</TableHead>
                    <TableHead className="text-right">Ganancias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.topPerformers?.map((performer) => (
                    <TableRow key={performer.id}>
                      <TableCell className="font-medium">{performer.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{performer.email}</TableCell>
                      <TableCell>{getLevelBadge(performer.level)}</TableCell>
                      <TableCell className="text-right">{performer.conversions}</TableCell>
                      <TableCell className="text-right font-bold">${performer.earnings.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {(!stats?.topPerformers || stats.topPerformers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No hay afiliados activos todavía
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Affiliates Tab */}
        <TabsContent value="affiliates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gestión de Afiliados</CardTitle>
                  <CardDescription>Aprueba o rechaza solicitudes de afiliados</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                    data-testid="filter-all"
                  >
                    Todos
                  </Button>
                  <Button
                    variant={statusFilter === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('pending')}
                    data-testid="filter-pending"
                  >
                    Pendientes
                  </Button>
                  <Button
                    variant={statusFilter === 'approved' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('approved')}
                    data-testid="filter-approved"
                  >
                    Aprobados
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAffiliates ? (
                <div className="text-center py-8 text-muted-foreground">Cargando afiliados...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Conversiones</TableHead>
                      <TableHead className="text-right">Ganancias</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliates?.map((affiliate) => (
                      <TableRow key={affiliate.id}>
                        <TableCell className="font-medium">{affiliate.fullName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{affiliate.email}</TableCell>
                        <TableCell>{getLevelBadge(affiliate.level)}</TableCell>
                        <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                        <TableCell className="text-right">{affiliate.totalClicks}</TableCell>
                        <TableCell className="text-right">{affiliate.totalConversions}</TableCell>
                        <TableCell className="text-right">${Number(affiliate.totalEarnings).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          {affiliate.status === 'pending' && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveAffiliate.mutate(affiliate.id)}
                                disabled={approveAffiliate.isPending}
                                data-testid={`approve-affiliate-${affiliate.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectAffiliate.mutate(affiliate.id)}
                                disabled={rejectAffiliate.isPending}
                                data-testid={`reject-affiliate-${affiliate.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-1 text-red-600" />
                                Rechazar
                              </Button>
                            </div>
                          )}
                          {affiliate.status !== 'pending' && (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!affiliates || affiliates.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No hay afiliados {statusFilter !== 'all' ? statusFilter : ''} todavía
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes de Pago Pendientes</CardTitle>
              <CardDescription>Aprueba pagos de comisiones para afiliados</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPayouts ? (
                <div className="text-center py-8 text-muted-foreground">Cargando pagos...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Afiliado</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayouts?.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">{payout.affiliateName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{payout.affiliateEmail}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{payout.paymentMethod}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{payout.paymentEmail || '-'}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          ${Math.abs(Number(payout.amount)).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(payout.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => approvePayout.mutate(payout.id)}
                            disabled={approvePayout.isPending}
                            data-testid={`approve-payout-${payout.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprobar Pago
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!pendingPayouts || pendingPayouts.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No hay solicitudes de pago pendientes
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
