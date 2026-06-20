import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { CreditCard, Download, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface StripeEvent {
  id: number;
  userId: string;
  userEmail: string;
  userName: string;
  eventType: string;
  planTier: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export function StripeEventsLog() {
  const [events, setEvents] = useState<StripeEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<StripeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (searchEmail.trim() === '') {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(
        events.filter(e => 
          e.userEmail.toLowerCase().includes(searchEmail.toLowerCase()) ||
          e.userName.toLowerCase().includes(searchEmail.toLowerCase())
        )
      );
    }
  }, [searchEmail, events]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/stripe-events');
      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error loading Stripe events:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const csv = [
      ['Date', 'Email', 'User', 'Event', 'Plan', 'Amount', 'Currency', 'Status'].join(','),
      ...filteredEvents.map(e => 
        [
          new Date(e.createdAt).toLocaleString(),
          e.userEmail,
          e.userName,
          e.eventType,
          e.planTier,
          e.amount,
          e.currency,
          e.status
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stripe-events-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'subscription_created':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'payment_succeeded':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'payment_failed':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'plan_changed':
        return <Clock className="h-4 w-4 text-blue-400" />;
      default:
        return <CreditCard className="h-4 w-4 text-orange-400" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'subscription_created':
        return 'Suscripción Creada';
      case 'payment_succeeded':
        return 'Pago Exitoso';
      case 'payment_failed':
        return 'Pago Fallido';
      case 'plan_changed':
        return 'Plan Cambiado';
      default:
        return eventType;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'bg-green-500/20 text-green-300';
      case 'failed':
        return 'bg-red-500/20 text-red-300';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300';
      default:
        return 'bg-slate-500/20 text-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto">
          <Input
            placeholder="Buscar por email o nombre..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={loadEvents}
            disabled={loading}
            className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button
            onClick={exportCSV}
            className="flex-1 sm:flex-none bg-slate-700 hover:bg-slate-600 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-orange-400 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Historial de Eventos Stripe
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 text-orange-400 animate-spin" />
              <span className="ml-2 text-slate-400">Cargando eventos...</span>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No hay eventos registrados
            </div>
          ) : (
            <>
              {/* Mobile: Card layout */}
              <div className="space-y-3 sm:hidden">
                {filteredEvents.map((event) => (
                  <div key={event.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getEventIcon(event.eventType)}
                        <span className="text-sm text-white font-medium">{getEventLabel(event.eventType)}</span>
                      </div>
                      <Badge className={getStatusColor(event.status) + ' text-[10px]'}>
                        {event.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{event.userEmail}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{new Date(event.createdAt).toLocaleDateString()}</span>
                      <span className="text-orange-400 font-mono font-medium">${event.amount.toFixed(2)} {event.currency.toUpperCase()}</span>
                    </div>
                    {event.planTier && (
                      <Badge className="bg-slate-700/50 text-slate-300 text-[10px]">{event.planTier}</Badge>
                    )}
                  </div>
                ))}
              </div>
              {/* Desktop: Table layout */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-300">Fecha</TableHead>
                      <TableHead className="text-slate-300">Email</TableHead>
                      <TableHead className="text-slate-300">Tipo</TableHead>
                      <TableHead className="text-slate-300">Plan</TableHead>
                      <TableHead className="text-slate-300">Monto</TableHead>
                      <TableHead className="text-slate-300">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => (
                      <TableRow key={event.id} className="border-b border-slate-700 hover:bg-slate-800/50">
                        <TableCell className="text-slate-300 text-sm">
                          {new Date(event.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-slate-300 text-sm">{event.userEmail}</TableCell>
                        <TableCell className="text-slate-300 text-sm">
                          <div className="flex items-center gap-2">
                            {getEventIcon(event.eventType)}
                            {getEventLabel(event.eventType)}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-300 text-sm">
                          {event.planTier}
                        </TableCell>
                        <TableCell className="text-slate-300 text-sm font-mono">
                          ${event.amount.toFixed(2)} {event.currency.toUpperCase()}
                        </TableCell>
                        <TableCell className="text-slate-300 text-sm">
                          <Badge className={getStatusColor(event.status)}>
                            {event.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          
          <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col sm:flex-row justify-between gap-1 text-xs sm:text-sm text-slate-400">
            <span>Total de eventos: {filteredEvents.length}</span>
            <span>Mostrando {filteredEvents.length} de {events.length}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
