import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { LogOut, Clock, MapPin, Monitor, Smartphone } from 'lucide-react';
import { useAuth } from '../../hooks/use-auth';

interface Session {
  id: string;
  userAgent: string;
  lastActivity: Date;
  ipAddress: string;
  isCurrent: boolean;
}

export function SessionManager() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    const currentSession: Session = {
      id: Math.random().toString(36).substr(2, 9),
      userAgent: navigator.userAgent,
      lastActivity: new Date(),
      ipAddress: 'Current Device',
      isCurrent: true,
    };
    setSessions([currentSession]);
  }, []);

  const getDeviceIcon = (userAgent: string) => {
    if (userAgent.includes('Mobile') || userAgent.includes('iPhone')) {
      return <Smartphone className="h-4 w-4 text-orange-400" />;
    }
    return <Monitor className="h-4 w-4 text-orange-400" />;
  };

  const getDeviceType = (userAgent: string) => {
    if (userAgent.includes('Mobile') || userAgent.includes('iPhone')) {
      return 'Mobile';
    }
    return 'Desktop';
  };

  return (
    <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
      <CardHeader>
        <CardTitle className="text-orange-400">Active Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="p-3 sm:p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-orange-500/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 flex-1">
              {getDeviceIcon(session.userAgent)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold">{getDeviceType(session.userAgent)}</span>
                  {session.isCurrent && <Badge className="bg-orange-500/20 text-orange-300 text-xs">Current</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {session.lastActivity.toLocaleTimeString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {session.ipAddress}
                  </span>
                </div>
              </div>
            </div>
            {!session.isCurrent && (
              <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10">
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
