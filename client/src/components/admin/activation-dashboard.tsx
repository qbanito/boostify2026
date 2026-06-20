import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { RefreshCw, Play, Pause, Zap, TrendingUp, Mail, Users, Target, ArrowRight, Clock, Shield, Eye, MousePointerClick, AlertTriangle } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';

interface DashboardData {
  ok: boolean;
  scheduler: { running: boolean; processing: boolean };
  activation: {
    totalTracked: number;
    bySegment: { segment: string; cnt: string }[];
    eventsThisWeek: number;
    paidConverted: number;
  };
  drip: {
    activeSequences: number;
    byTypeAndStatus: { sequence_type: string; status: string; cnt: string }[];
    emailsSentThisWeek: number;
    completedSequences: number;
  };
  funnel: {
    discovered: number;
    emailed: number;
    clicked: number;
    signedUp: number;
    active: number;
    paying: number;
    bySource: any[];
  };
  recentRuns: {
    timestamp: string;
    enrolled: number;
    emailsSent: number;
    emailErrors: number;
    sequencesCompleted: number;
    segmentTransitions: number;
    durationMs: number;
  }[];
}

export function ActivationDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<{ date: string; sent: number; limit: number; remaining: number; dbSentToday: number } | null>(null);
  const [emailActivity, setEmailActivity] = useState<any[]>([]);
  const [respondedContacts, setRespondedContacts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'responded'>('overview');

  const loadData = useCallback(async () => {
    try {
      const [result, dailyResult] = await Promise.all([
        apiRequest('GET', '/api/admin/artist-activation/dashboard'),
        apiRequest('GET', '/api/admin/artist-activation/daily-email-stats').catch(() => null),
      ]);
      setData(result);
      if (dailyResult?.ok) setDailyStats(dailyResult.daily ? { ...dailyResult.daily, dbSentToday: dailyResult.dbSentToday } : null);
    } catch {
      console.error('Failed to load activation dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const result = await apiRequest('GET', '/api/admin/artist-activation/email-activity?limit=80');
      if (result?.ok) setEmailActivity(result.events || []);
    } catch {}
  }, []);

  const loadResponded = useCallback(async () => {
    try {
      const result = await apiRequest('GET', '/api/admin/artist-activation/responded');
      if (result?.ok) setRespondedContacts(result.contacts || []);
    } catch {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (activeTab === 'activity') loadActivity();
    if (activeTab === 'responded') loadResponded();
  }, [activeTab, loadActivity, loadResponded]);
  useEffect(() => {
    const iv = setInterval(loadData, 30000);
    return () => clearInterval(iv);
  }, [loadData]);

  const handleRunTick = async () => {
    try {
      await apiRequest('POST', '/api/admin/artist-activation/run');
      toast({ title: 'Activation Tick Started', description: 'Processing drip queue, enrollments, and transitions...' });
      setTimeout(loadData, 5000);
      setTimeout(loadData, 15000);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleEnrollNew = async () => {
    try {
      const result = await apiRequest('POST', '/api/admin/artist-activation/enroll-new');
      toast({ title: 'Enrolled', description: `${result.enrolled} new contacts enrolled in welcome sequence` });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleScheduler = async (start: boolean) => {
    try {
      await apiRequest('POST', `/api/admin/artist-activation/scheduler/${start ? 'start' : 'stop'}`);
      toast({ title: start ? 'Scheduler Started' : 'Scheduler Stopped' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-orange-900/30 to-amber-900/20 border-orange-500/20">
        <CardContent className="p-6 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-400 mb-2" />
          <div className="text-slate-400">Loading Activation Engine...</div>
        </CardContent>
      </Card>
    );
  }

  const funnel = data?.funnel;
  const drip = data?.drip;
  const activation = data?.activation;
  const segments = activation?.bySegment || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-br from-orange-900/40 to-amber-900/30 border-orange-500/30">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-orange-200">
              <Target className="w-5 h-5 text-orange-400" />
              Artist Activation Engine
              <span className="hidden sm:inline text-xs text-slate-400 font-normal ml-2">Target: 50K active by 2026</span>
            </CardTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              {data?.scheduler.processing && (
                <Badge className="bg-amber-500/20 text-amber-300 animate-pulse">Processing...</Badge>
              )}
              {data?.scheduler.running ? (
                <Badge className="bg-green-500/20 text-green-300">Auto: ON</Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-300">Auto: OFF</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Conversion Funnel */}
          {funnel && (
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {[
                { label: 'Discovered', value: funnel.discovered, color: 'text-slate-300' },
                { label: 'Emailed', value: funnel.emailed, color: 'text-blue-300' },
                { label: 'Clicked', value: funnel.clicked, color: 'text-cyan-300' },
                { label: 'Signed Up', value: funnel.signedUp, color: 'text-purple-300' },
                { label: 'Active', value: funnel.active, color: 'text-green-300' },
                { label: 'Paying', value: funnel.paying, color: 'text-amber-300' },
              ].map((step, i, arr) => (
                <React.Fragment key={step.label}>
                  <div className="bg-slate-900/60 rounded-lg p-2 sm:p-3 text-center min-w-[70px] sm:min-w-[90px] flex-shrink-0">
                    <div className={`text-base sm:text-lg font-bold ${step.color}`}>{step.value.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">{step.label}</div>
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-slate-900/60 rounded-lg p-2 sm:p-3 text-center">
              <Mail className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <div className="text-lg sm:text-xl font-bold text-blue-300">{drip?.emailsSentThisWeek?.toLocaleString() || 0}</div>
              <div className="text-[10px] sm:text-xs text-slate-400">Emails This Week</div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2 sm:p-3 text-center">
              <Zap className="w-4 h-4 text-orange-400 mx-auto mb-1" />
              <div className="text-lg sm:text-xl font-bold text-orange-300">{drip?.activeSequences?.toLocaleString() || 0}</div>
              <div className="text-[10px] sm:text-xs text-slate-400">Active Sequences</div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2 sm:p-3 text-center">
              <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
              <div className="text-lg sm:text-xl font-bold text-green-300">{activation?.eventsThisWeek?.toLocaleString() || 0}</div>
              <div className="text-[10px] sm:text-xs text-slate-400">Events This Week</div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2 sm:p-3 text-center">
              <Users className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <div className="text-lg sm:text-xl font-bold text-amber-300">{activation?.paidConverted?.toLocaleString() || 0}</div>
              <div className="text-[10px] sm:text-xs text-slate-400">Paid Conversions</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRunTick} disabled={data?.scheduler.processing} className="bg-orange-600 hover:bg-orange-500 text-white">
              {data?.scheduler.processing ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Run Activation Tick</>
              )}
            </Button>
            <Button onClick={handleEnrollNew} variant="outline" className="border-blue-500/40 text-blue-300 hover:bg-blue-900/30">
              <Mail className="w-4 h-4 mr-2" /> Enroll New Contacts
            </Button>
            {data?.scheduler.running ? (
              <Button onClick={() => handleToggleScheduler(false)} variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-900/30">
                <Pause className="w-4 h-4 mr-2" /> Stop Scheduler
              </Button>
            ) : (
              <Button onClick={() => handleToggleScheduler(true)} variant="outline" className="border-green-500/40 text-green-300 hover:bg-green-900/30">
                <Play className="w-4 h-4 mr-2" /> Start Scheduler (30m)
              </Button>
            )}
            <Button onClick={loadData} variant="ghost" size="sm" className="text-slate-400">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Segments Breakdown */}
      {segments.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Lead Segments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {segments.map(s => {
                const colors: Record<string, string> = {
                  cold: 'border-blue-500/40 text-blue-300',
                  warming: 'border-yellow-500/40 text-yellow-300',
                  engaged: 'border-purple-500/40 text-purple-300',
                  hot: 'border-red-500/40 text-red-300',
                  converted: 'border-green-500/40 text-green-300',
                  churned: 'border-slate-500/40 text-slate-400',
                };
                return (
                  <Badge key={s.segment} variant="outline" className={`text-sm px-3 py-1 ${colors[s.segment] || ''}`}>
                    {s.segment}: {parseInt(s.cnt).toLocaleString()}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drip Sequences Status */}
      {drip?.byTypeAndStatus && drip.byTypeAndStatus.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Drip Sequences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {drip.byTypeAndStatus.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-xs text-slate-400">{s.sequence_type?.replace(/_/g, ' ')}</span>
                    <Badge variant="outline" className="ml-1 text-[10px] px-1">{s.status}</Badge>
                  </div>
                  <span className="text-sm font-bold text-white">{parseInt(s.cnt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Email Limits */}
      {dailyStats && (
        <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/20 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-200">
              <Shield className="w-4 h-4 text-blue-400" />
              Daily Email Rate Limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>{dailyStats.sent} sent today</span>
                  <span>Limit: {dailyStats.limit}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${dailyStats.remaining <= 0 ? 'bg-red-500' : dailyStats.sent / dailyStats.limit > 0.8 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, (dailyStats.sent / dailyStats.limit) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-right min-w-[80px]">
                <div className={`text-xl font-bold ${dailyStats.remaining <= 0 ? 'text-red-400' : 'text-blue-300'}`}>
                  {dailyStats.remaining}
                </div>
                <div className="text-[10px] text-slate-500">remaining</div>
              </div>
            </div>
            {dailyStats.remaining <= 0 && (
              <div className="flex items-center gap-2 mt-2 text-xs text-red-400">
                <AlertTriangle className="w-3 h-3" />
                Daily limit reached — emails will resume tomorrow
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs: Activity / Responded */}
      <div className="flex gap-2">
        {(['overview', 'activity', 'responded'] as const).map(tab => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'outline'}
            size="sm"
            className={activeTab === tab ? 'bg-orange-600 text-white' : 'border-slate-600 text-slate-400'}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && <><Clock className="w-3 h-3 mr-1" /> Runs</>}
            {tab === 'activity' && <><Eye className="w-3 h-3 mr-1" /> Email Activity</>}
            {tab === 'responded' && <><MousePointerClick className="w-3 h-3 mr-1" /> Engaged Contacts</>}
          </Button>
        ))}
      </div>

      {/* Tab: Recent Runs (Overview) */}
      {activeTab === 'overview' && data?.recentRuns && data.recentRuns.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Recent Activation Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentRuns.map((run, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 bg-slate-800/60 rounded-lg px-3 py-2 text-xs">
                  <span className="text-slate-500">{new Date(run.timestamp).toLocaleString()}</span>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="text-blue-400">+{run.enrolled} enrolled</span>
                    <span className="text-green-400">{run.emailsSent} sent</span>
                    {run.emailErrors > 0 && <span className="text-red-400">{run.emailErrors} err</span>}
                    <span className="text-purple-400">{run.segmentTransitions} transitions</span>
                    <span className="text-slate-600">{Math.round(run.durationMs / 1000)}s</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Email Activity Feed */}
      {activeTab === 'activity' && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-300">Email Activity Feed</CardTitle>
              <Button onClick={loadActivity} variant="ghost" size="sm" className="text-slate-400">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {emailActivity.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-4">No email activity recorded yet</div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {emailActivity.map((e, i) => {
                  const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
                    email_opened: { icon: <Eye className="w-3 h-3" />, color: 'text-cyan-400' },
                    email_clicked: { icon: <MousePointerClick className="w-3 h-3" />, color: 'text-green-400' },
                    email_delivered: { icon: <Mail className="w-3 h-3" />, color: 'text-blue-400' },
                    email_bounced: { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-red-400' },
                    email_hard_bounce: { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-red-500' },
                    email_spam: { icon: <Shield className="w-3 h-3" />, color: 'text-amber-400' },
                  };
                  const cfg = typeConfig[e.event_type] || { icon: <Zap className="w-3 h-3" />, color: 'text-slate-400' };
                  return (
                    <div key={i} className="flex items-center gap-3 bg-slate-800/40 rounded px-3 py-2 text-xs">
                      <span className={cfg.color}>{cfg.icon}</span>
                      <span className="text-slate-300 truncate flex-1">{e.full_name || e.contact_email || 'Unknown'}</span>
                      <Badge variant="outline" className={`text-[10px] ${cfg.color} border-current`}>
                        {(e.event_type || '').replace('email_', '').replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-slate-600 whitespace-nowrap">
                        {e.created_at ? new Date(e.created_at).toLocaleString() : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Engaged / Responded Contacts */}
      {activeTab === 'responded' && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-slate-300">Engaged Contacts (Score ≥ 30)</CardTitle>
              <Button onClick={loadResponded} variant="ghost" size="sm" className="text-slate-400">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {respondedContacts.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-4">No highly engaged contacts yet</div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {respondedContacts.map((c, i) => {
                  const scoreColor = c.score >= 70 ? 'text-green-400' : c.score >= 50 ? 'text-amber-400' : 'text-blue-400';
                  const segColor: Record<string, string> = {
                    hot: 'bg-red-500/20 text-red-300',
                    engaged: 'bg-purple-500/20 text-purple-300',
                    warming: 'bg-yellow-500/20 text-yellow-300',
                    converted: 'bg-green-500/20 text-green-300',
                  };
                  return (
                    <div key={i} className="flex items-center gap-3 bg-slate-800/40 rounded px-3 py-2 text-xs">
                      <span className={`font-bold min-w-[32px] text-right ${scoreColor}`}>{c.score}</span>
                      <div className="flex-1 truncate">
                        <span className="text-slate-200">{c.full_name || '—'}</span>
                        <span className="text-slate-500 ml-2">{c.email}</span>
                      </div>
                      {c.segment && (
                        <Badge className={`text-[10px] ${segColor[c.segment] || 'bg-slate-500/20 text-slate-400'}`}>
                          {c.segment}
                        </Badge>
                      )}
                      <span className="text-slate-600 whitespace-nowrap">
                        {c.last_activity_at ? new Date(c.last_activity_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
