/**
 * 🛡️ Agent Console — Private owner dashboard
 *
 * Shows:
 * - Pipeline stats (total requests, pipeline value, pending approvals)
 * - Pending approvals with approve/reject actions
 * - Active conversations list
 * - Quick settings
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Shield, Loader2, CheckCircle2, XCircle, Clock, TrendingUp,
  DollarSign, Users, AlertTriangle, ChevronRight, RefreshCw,
  Briefcase, Music, Handshake, Newspaper, MessageCircle, Eye,
  Mail, Send, Settings, FileText,
} from 'lucide-react';

interface ConsoleProps {
  artistId: number;
  artistName: string;
  colors: { hexPrimary: string; hexAccent: string; hexBorder: string };
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  collecting_info: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  qualified: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  negotiating: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  pending_approval: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  spam: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const AGENT_ICONS: Record<string, React.ComponentType<any>> = {
  booking: Briefcase,
  licensing: Music,
  brand_deals: Handshake,
  collaboration: Users,
  press: Newspaper,
  fan_relations: MessageCircle,
  manager: Shield,
  legal_guard: Shield,
  finance: DollarSign,
};

function fmt$(n: number | string | null | undefined) {
  if (!n) return '$0';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!isFinite(num)) return '$0';
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
  return `$${Math.round(num).toLocaleString()}`;
}

export function AgentConsole({ artistId, artistName, colors }: ConsoleProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'approvals' | 'requests' | 'emails'>('dashboard');
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [summaryConvId, setSummaryConvId] = useState('');

  // Stats
  const statsQ = useQuery({
    queryKey: ['agent-gateway', 'stats', artistId],
    queryFn: async () => (await apiRequest('GET', `/api/agent-gateway/${artistId}/console/stats`)) as any,
    refetchInterval: 30000,
  });

  // Pending approvals
  const approvalsQ = useQuery({
    queryKey: ['agent-gateway', 'approvals', artistId],
    queryFn: async () => (await apiRequest('GET', `/api/agent-gateway/${artistId}/console/approvals`)) as any,
    refetchInterval: 15000,
  });

  // All requests
  const requestsQ = useQuery({
    queryKey: ['agent-gateway', 'requests', artistId],
    queryFn: async () => (await apiRequest('GET', `/api/agent-gateway/${artistId}/console/requests`)) as any,
    refetchInterval: 15000,
  });

  // Approve mutation
  const approveM = useMutation({
    mutationFn: async (vars: { requestId: number; note?: string }) => {
      return await apiRequest('POST', `/api/agent-gateway/${artistId}/console/approve/${vars.requestId}`, { note: vars.note }) as any;
    },
    onSuccess: () => {
      toast({ title: 'Request approved', description: 'The agent will notify the sender.' });
      qc.invalidateQueries({ queryKey: ['agent-gateway'] });
    },
    onError: (err: any) => toast({ title: 'Approve failed', description: err?.message, variant: 'destructive' }),
  });

  // Reject mutation
  const rejectM = useMutation({
    mutationFn: async (vars: { requestId: number; note?: string }) => {
      return await apiRequest('POST', `/api/agent-gateway/${artistId}/console/reject/${vars.requestId}`, { note: vars.note }) as any;
    },
    onSuccess: () => {
      toast({ title: 'Request rejected' });
      setRejectingId(null);
      setRejectNote('');
      qc.invalidateQueries({ queryKey: ['agent-gateway'] });
    },
    onError: (err: any) => toast({ title: 'Reject failed', description: err?.message, variant: 'destructive' }),
  });

  const stats = statsQ.data?.stats;
  const approvals = approvalsQ.data?.approvals || [];
  const requests = requestsQ.data?.requests || [];

  // Email diagnostics
  const emailDiagQ = useQuery({
    queryKey: ['agent-gateway', 'email-diagnostics', artistId],
    queryFn: async () => (await apiRequest('GET', `/api/agent-gateway/${artistId}/console/email-diagnostics`)) as any,
    enabled: activeTab === 'emails',
  });

  // Test email mutation
  const testEmailM = useMutation({
    mutationFn: async (testEmail: string) => {
      return await apiRequest('POST', `/api/agent-gateway/${artistId}/console/test-email`, { testEmail }) as any;
    },
    onSuccess: (data) => toast({ title: 'Test email sent', description: data?.message || 'Check your inbox.' }),
    onError: (err: any) => toast({ title: 'Test email failed', description: err?.message, variant: 'destructive' }),
  });

  // Send summary mutation
  const sendSummaryM = useMutation({
    mutationFn: async (conversationId: string) => {
      return await apiRequest('POST', `/api/agent-gateway/${artistId}/console/send-summary/${conversationId}`) as any;
    },
    onSuccess: (data) => toast({ title: 'Summary sent', description: data?.message || 'Email dispatched.' }),
    onError: (err: any) => toast({ title: 'Summary failed', description: err?.message, variant: 'destructive' }),
  });

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: TrendingUp },
    { id: 'approvals' as const, label: `Approvals (${approvals.length})`, icon: Clock },
    { id: 'requests' as const, label: `All Requests (${requests.length})`, icon: Eye },
    { id: 'emails' as const, label: 'Emails', icon: Mail },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${colors.hexPrimary}25`, border: `1px solid ${colors.hexPrimary}40` }}>
            <Shield className="w-5 h-5" style={{ color: colors.hexPrimary }} />
          </div>
          <div>
            <h3 className="text-white font-bold">Agent Console</h3>
            <p className="text-white/40 text-xs">{artistName}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="border-white/20 text-white/60 h-7" onClick={() => { statsQ.refetch(); approvalsQ.refetch(); requestsQ.refetch(); }}>
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
              activeTab === tab.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && stats && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Total Requests', value: stats.totalRequests, icon: Users, color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/20' },
              { label: 'Pipeline Value', value: fmt$(stats.pipelineValue), icon: DollarSign, color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
              { label: 'Pending Approvals', value: stats.pendingApprovals, icon: Clock, color: 'text-orange-300', bg: 'bg-orange-500/10 border-orange-500/20' },
              { label: 'Active', value: (stats.byStatus?.collecting_info || 0) + (stats.byStatus?.negotiating || 0), icon: TrendingUp, color: 'text-purple-300', bg: 'bg-purple-500/10 border-purple-500/20' },
            ].map((kpi, i) => (
              <div key={i} className={`p-3 rounded-xl border ${kpi.bg}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                  <span className="text-white/40 text-[10px]">{kpi.label}</span>
                </div>
                <div className={`font-bold text-lg ${kpi.color}`}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* By Agent Type */}
          {stats.byAgent && Object.keys(stats.byAgent).length > 0 && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-white/40 text-xs mb-2">Requests by Agent</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byAgent).map(([type, count]) => {
                  const Icon = AGENT_ICONS[type] || Shield;
                  return (
                    <div key={type} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
                      <Icon className="w-3.5 h-3.5 text-white/50" />
                      <span className="text-white/70 text-xs capitalize">{type.replace(/_/g, ' ')}</span>
                      <span className="text-white font-bold text-xs">{count as number}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent pending approvals preview */}
          {approvals.length > 0 && (
            <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <span className="text-orange-300 text-sm font-semibold">{approvals.length} Pending Approval{approvals.length > 1 ? 's' : ''}</span>
                </div>
                <button onClick={() => setActiveTab('approvals')} className="text-orange-400/60 hover:text-orange-400 text-xs flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {approvals.slice(0, 2).map((a: any) => (
                <div key={a.id} className="text-white/50 text-xs py-1">
                  • {a.approvalType?.replace(/_/g, ' ')} — {a.agentRecommendation?.slice(0, 80)}…
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* APPROVALS TAB */}
      {activeTab === 'approvals' && (
        <div className="space-y-3">
          {approvals.length === 0 && (
            <div className="text-center py-8 text-white/30 text-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No pending approvals
            </div>
          )}
          {approvals.map((a: any) => (
            <div key={a.id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <Badge className={`${STATUS_COLORS[a.status] || 'bg-white/10 text-white/50'} text-[10px] border`}>
                    {a.approvalType?.replace(/_/g, ' ')}
                  </Badge>
                  <p className="text-white/80 text-sm mt-2">{a.agentRecommendation}</p>
                  <p className="text-white/40 text-xs mt-1">Action: {a.agentProposedAction}</p>
                </div>
                <span className="text-white/25 text-[10px]">{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}</span>
              </div>

              {rejectingId === a.requestId ? (
                <div className="space-y-2">
                  <Textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Rejection reason (optional)…" className="bg-white/5 border-white/10 text-white text-xs min-h-[60px]" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-white/20 text-white/60 h-7 text-xs" onClick={() => { setRejectingId(null); setRejectNote(''); }}>Cancel</Button>
                    <Button size="sm" className="bg-rose-600 hover:bg-rose-500 text-white h-7 text-xs" onClick={() => rejectM.mutate({ requestId: a.requestId, note: rejectNote })} disabled={rejectM.isPending}>
                      {rejectM.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm Reject'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs flex-1" onClick={() => approveM.mutate({ requestId: a.requestId })} disabled={approveM.isPending}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 h-8 text-xs flex-1" onClick={() => setRejectingId(a.requestId)}>
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* REQUESTS TAB */}
      {activeTab === 'requests' && (
        <div className="space-y-2">
          {requests.length === 0 && (
            <div className="text-center py-8 text-white/30 text-sm">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No requests yet
            </div>
          )}
          {requests.map((r: any) => {
            const Icon = AGENT_ICONS[r.agentType] || Shield;
            return (
              <div key={r.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-white/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white text-sm font-medium truncate">{r.senderCompany || r.senderName || 'Unknown'}</span>
                    <Badge className={`${STATUS_COLORS[r.status] || 'bg-white/10 text-white/50'} text-[9px] border`}>{r.status?.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-white/40 text-[10px]">
                    <span className="capitalize">{r.agentType?.replace(/_/g, ' ')}</span>
                    {r.opportunityScore > 0 && <span>Score: {r.opportunityScore}</span>}
                    {r.estimatedValueMax && <span>{fmt$(r.estimatedValueMax)}</span>}
                  </div>
                </div>
                <span className="text-white/20 text-[10px] shrink-0">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* EMAILS TAB */}
      {activeTab === 'emails' && (
        <div className="space-y-4">

          {/* Config Status */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-4 h-4 text-white/50" />
              <span className="text-white/70 text-sm font-semibold">Email Configuration</span>
              <button onClick={() => emailDiagQ.refetch()} className="ml-auto text-white/30 hover:text-white/60">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {emailDiagQ.isLoading && <div className="text-white/30 text-xs">Checking configuration…</div>}
            {emailDiagQ.data && (() => {
              const d = emailDiagQ.data;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-white/50 text-xs">Brevo API</span>
                    <span className={`text-xs font-medium flex items-center gap-1 ${d.brevo ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {d.brevo ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {d.brevo ? 'Configured' : 'Not set'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-white/50 text-xs">Resend API</span>
                    <span className={`text-xs font-medium flex items-center gap-1 ${d.resend ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {d.resend ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {d.resend ? 'Configured (fallback)' : 'Not set (optional)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-white/50 text-xs">Verified Sender</span>
                    <span className="text-xs text-white/70 font-mono">info@boostifymusic.com</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-white/50 text-xs">Artist Email (owner)</span>
                    <span className={`text-xs font-mono ${d.artistEmail ? 'text-white/70' : 'text-rose-400'}`}>
                      {d.artistEmail || '⚠ Not set — update your profile'}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Test Email */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-white/50" />
              <span className="text-white/70 text-sm font-semibold">Send Test Email</span>
            </div>
            <p className="text-white/30 text-xs">Verify your Brevo/Resend integration is working by sending a test email.</p>
            <div className="flex gap-2">
              <Input
                value={testEmailAddress}
                onChange={e => setTestEmailAddress(e.target.value)}
                placeholder="recipient@example.com"
                className="bg-white/5 border-white/10 text-white text-xs h-8 flex-1"
              />
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white h-8 text-xs px-3"
                onClick={() => testEmailM.mutate(testEmailAddress)}
                disabled={testEmailM.isPending || !testEmailAddress.trim()}
              >
                {testEmailM.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 mr-1" />Send</>}
              </Button>
            </div>
          </div>

          {/* Manual Conversation Summary */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-white/50" />
              <span className="text-white/70 text-sm font-semibold">Send Conversation Summary</span>
            </div>
            <p className="text-white/30 text-xs">Manually trigger a summary email for any conversation. Summaries are also sent automatically on key milestones.</p>
            <div className="flex gap-2">
              <Input
                value={summaryConvId}
                onChange={e => setSummaryConvId(e.target.value)}
                placeholder="Conversation ID"
                className="bg-white/5 border-white/10 text-white text-xs h-8 flex-1"
              />
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-500 text-white h-8 text-xs px-3"
                onClick={() => sendSummaryM.mutate(summaryConvId)}
                disabled={sendSummaryM.isPending || !summaryConvId.trim()}
              >
                {sendSummaryM.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Mail className="w-3 h-3 mr-1" />Send</>}
              </Button>
            </div>
          </div>

          {/* Routing Reference */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-white/50" />
              <span className="text-white/70 text-sm font-semibold">Email Routing Reference</span>
            </div>
            <p className="text-white/30 text-xs mb-3">All emails are sent FROM info@boostifymusic.com. Replies route to the agent-specific address below.</p>
            <div className="space-y-1">
              {[
                { agent: 'Booking', email: 'booking@boostifymusic.com', icon: Briefcase },
                { agent: 'Brand Deals', email: 'deals@boostifymusic.com', icon: Handshake },
                { agent: 'Licensing', email: 'licensing@boostifymusic.com', icon: Music },
                { agent: 'Press', email: 'press@boostifymusic.com', icon: Newspaper },
                { agent: 'Collaboration', email: 'collab@boostifymusic.com', icon: Users },
                { agent: 'Fan Relations', email: 'gateway@boostifymusic.com', icon: MessageCircle },
                { agent: 'Manager / Legal / Finance', email: 'manager@boostifymusic.com', icon: Shield },
              ].map(row => (
                <div key={row.agent} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <row.icon className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <span className="text-white/50 text-xs w-36 shrink-0">{row.agent}</span>
                  <span className="text-white/70 text-xs font-mono">{row.email}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
