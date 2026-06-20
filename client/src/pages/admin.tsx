import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { Header } from '../components/layout/header';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/use-auth';
import { isAdminEmail, ADMIN_EMAILS } from '../../../shared/constants';
import { apiRequest } from '../lib/queryClient';
import { 
  BarChart3, Users, DollarSign, Music, Music2, FileVideo, Target, 
  Shield, RefreshCw, Activity, Upload, Sparkles, Link as LinkIcon,
  TrendingUp, Zap, Users2, AreaChart, PieChart as PieChartIcon, CreditCard, Terminal, FileText,
  Download, ScrollText, Settings, Loader2, Search, AlertTriangle, Key, Crown,
  MoreVertical, ChevronRight, Truck
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { useToast } from '../hooks/use-toast';
import { ArtistImportModal } from '../components/admin/artist-import-modal';
import { ArtistsManager } from '../components/admin/artists-manager';
import { ApiUsageDashboard } from '../components/admin/api-usage-dashboard';
import { AccountingDashboard } from '../components/admin/accounting-dashboard';
import { AdminAgent } from '../components/admin/admin-agent';
import { CSuitePanel } from '../components/admin/c-suite/CSuitePanel';
import { ApiLinks } from '../components/admin/api-links';
import { SessionManager } from '../components/admin/session-manager';
import { AffiliateSessions } from '../components/admin/affiliate-sessions';
import { InvestorSessions } from '../components/admin/investor-sessions';
import { StripeEventsLog } from '../components/admin/stripe-events-log';
import { UserManagement } from '../components/admin/user-management';
import { BoostiSwapArtistsManager } from '../components/admin/boostiswap-artists-manager';
import { OpenClawPanel } from '../components/admin/openclaw-panel';
import { PlatformReports } from '../components/admin/platform-reports';
import { DiscoveryAgentPanel } from '../components/admin/discovery-agent-panel';
import { ActivationDashboard } from '../components/admin/activation-dashboard';
import { ArtistHunterAgent } from '../components/admin/artist-hunter-agent';
import { AdminStyleControl } from '../components/admin/admin-style-control';
import { EconomicEngineManager } from '../components/admin/economic-engine-manager';
import { SmartMerchSupplierAdmin } from '../components/admin/smart-merch-supplier-admin';
import { ContentModerationQueue } from '../components/admin/content-moderation-queue';
import { MCPApiKeysManager } from '../components/admin/mcp-api-keys';
import { AdminSongAnalyzer } from '../components/admin/admin-song-analyzer';
import { ConcertsManager } from '../components/admin/concerts-manager';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'overview';
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'overview';
  });
  const [showImportModal, setShowImportModal] = useState(false);

  // Cross-module navigation: other admin components can dispatch
  // `window.dispatchEvent(new CustomEvent('admin:navigate', { detail: { tab: 'artists' } }))`
  // to switch tabs without a full reload.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab && typeof detail.tab === 'string') {
        setActiveTab(detail.tab);
      }
    };
    window.addEventListener('admin:navigate', handler as EventListener);
    return () => window.removeEventListener('admin:navigate', handler as EventListener);
  }, []);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  
  const isAdmin = user && (user.isAdmin === true || isAdminEmail(user.email));

  const [stats, setStats] = useState({
    totalArtists: 0, totalInvestors: 0, totalInvestments: 0, totalRevenue: 0,
    activeSubscriptions: 0, totalCourses: 0, totalSocialPosts: 0, totalCampaigns: 0,
    totalVideos: 0, totalMusicians: 0, activeUsers: 0, totalUsers: 0,
    totalSongs: 0, totalPayments: 0, monthlyGrowthPct: 0,
    subscriptionsByPlan: {} as Record<string, { active: number; total: number }>,
    firestoreActiveSubscriptions: 0,
    recentEvents30d: 0,
  });

  useEffect(() => {
    if (user && isAdmin) loadAllData();
  }, [user, isAdmin]);

  const loadAllData = async () => {
    try {
      const data = await apiRequest('GET', '/api/admin/reports/platform-metrics');
      if (data.success && data.metrics) {
        const m = data.metrics;
        setStats(prev => ({
          ...prev,
          totalUsers: m.totalUsers || 0,
          totalArtists: m.totalArtists || 0,
          totalSongs: m.totalSongs || 0,
          activeSubscriptions: m.activeSubscriptions || 0,
          totalInvestors: m.totalInvestors || 0,
          totalCourses: m.totalCourses || 0,
          totalCampaigns: m.totalCampaigns || 0,
          totalPayments: m.totalPayments || 0,
          totalRevenue: m.totalRevenue || 0,
          monthlyGrowthPct: m.monthlyGrowthPct || 0,
          subscriptionsByPlan: m.subscriptionsByPlan || {},
          firestoreActiveSubscriptions: m.firestoreActiveSubscriptions || 0,
          recentEvents30d: m.recentEvents30d || 0,
        }));
      }
    } catch (err) {
      console.error('Failed to load platform metrics:', err);
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Card className="p-8 bg-slate-900 border-orange-500/20">
          <p className="text-white">Please login to access admin dashboard</p>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Card className="p-8 bg-slate-900 border-red-500/20">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white text-center mb-2">Access Denied</h2>
          <p className="text-slate-400 text-center">You do not have permission to access this page.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Card className="p-8 bg-slate-900 border-orange-500/20">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-orange-400 animate-spin" />
            <p className="text-white">Loading admin dashboard...</p>
          </div>
        </Card>
      </div>
    );
  }

  const statCards = [
    { label: 'Artists', value: stats.totalArtists, icon: Music, gradient: 'from-orange-500/20 to-orange-600/20', color: 'text-orange-400' },
    { label: 'Songs', value: stats.totalSongs, icon: FileVideo, gradient: 'from-purple-500/20 to-purple-600/20', color: 'text-purple-400' },
    { label: 'Users', value: stats.totalUsers, icon: Users, gradient: 'from-blue-500/20 to-blue-600/20', color: 'text-blue-400' },
    { label: 'Subscriptions', value: stats.activeSubscriptions, icon: Zap, gradient: 'from-yellow-500/20 to-yellow-600/20', color: 'text-yellow-400' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      <Header />
      
      <main className="flex-1 pt-16">
        <ScrollArea className="h-[calc(100vh-4rem)] w-full">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-5 md:py-6 lg:py-8">
            
            <div className="mb-6 pb-5 border-b border-orange-500/20">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                    Admin Control
                  </h1>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1 truncate">AI-powered analytics & unified platform management</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shrink-0"
                      data-testid="admin-actions-menu"
                    >
                      <MoreVertical className="h-4 w-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 bg-slate-900 border-orange-500/30">
                    <DropdownMenuLabel className="text-orange-300">Quick Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-700" />
                    <DropdownMenuItem
                      onSelect={() => setShowImportModal(true)}
                      className="text-white focus:bg-orange-500/20 focus:text-orange-300 cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import Artists
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-slate-700" />
                    <DropdownMenuLabel className="text-slate-400 text-xs font-normal">External Pages</DropdownMenuLabel>
                    <Link href="/admin/artist-acquisition">
                      <DropdownMenuItem className="text-white focus:bg-orange-500/20 focus:text-orange-300 cursor-pointer">
                        <Target className="h-4 w-4 mr-2" />
                        Artist Acquisition
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/admin/boostify-alliances">
                      <DropdownMenuItem className="text-white focus:bg-orange-500/20 focus:text-orange-300 cursor-pointer">
                        <Users2 className="h-4 w-4 mr-2" />
                        Boostify Alliances
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/admin/artist-identity">
                      <DropdownMenuItem className="text-white focus:bg-orange-500/20 focus:text-orange-300 cursor-pointer">
                        <Key className="h-4 w-4 mr-2" />
                        Identity & Provisioning
                      </DropdownMenuItem>
                    </Link>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Hero C-Suite shortcut — strategic prominence */}
            <button
              onClick={() => setActiveTab('c-suite')}
              className="group w-full mb-6 text-left rounded-xl bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-red-500/15 border border-orange-500/40 hover:border-orange-400 hover:from-orange-500/25 hover:via-amber-500/15 hover:to-red-500/25 transition-all p-4 sm:p-5 shadow-lg shadow-orange-500/10"
              data-testid="admin-csuite-hero"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Crown className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-base sm:text-lg font-bold text-white truncate">C-Suite AI Command</h3>
                    <Badge className="bg-orange-500/30 text-orange-200 border border-orange-400/40 text-[10px] hidden sm:inline-flex">10 Agents</Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-orange-200/80 line-clamp-2">Talk to your AI executives · run goals · approve decisions</p>
                </div>
                <ChevronRight className="h-5 w-5 text-orange-300 shrink-0 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card 
                    key={stat.label} 
                    className={`bg-gradient-to-br ${stat.gradient} border-orange-500/20 hover:border-orange-500/50 transition`}
                  >
                    <CardContent className="p-4 md:pt-6">
                      <div className="flex items-center justify-between mb-1 md:mb-2">
                        <p className="text-slate-400 text-xs md:text-sm">{stat.label}</p>
                        <Icon className={`h-4 w-4 md:h-5 md:w-5 ${stat.color}`} />
                      </div>
                      <p className={`text-2xl md:text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {(() => {
                const TAB_GROUPS: { label: string; tabs: { value: string; label: string; icon: any }[] }[] = [
                  {
                    label: '📊 Insights',
                    tabs: [
                      { value: 'overview', label: 'Overview', icon: BarChart3 },
                      { value: 'reports', label: 'Reports', icon: FileText },
                      { value: 'api-usage', label: 'API Usage', icon: Activity },
                    ],
                  },
                  {
                    label: '🤖 AI Operations',
                    tabs: [
                      { value: 'c-suite', label: 'C-Suite AI', icon: Crown },
                      { value: 'ai-agent', label: 'AI Agent', icon: Sparkles },
                      { value: 'song-analyzer', label: 'Song Analyzer', icon: Music },
                      { value: 'hunter', label: 'Artist Hunter', icon: Target },
                      { value: 'discovery', label: 'Discovery', icon: Search },
                      { value: 'openclaw', label: 'OpenClaw', icon: Terminal },
                      { value: 'moderation', label: 'Moderation', icon: AlertTriangle },
                    ],
                  },
                  {
                    label: '👥 People',
                    tabs: [
                      { value: 'users', label: 'Users', icon: Users },
                      { value: 'artists', label: 'Leads CRM', icon: Music },
                      { value: 'affiliates', label: 'Affiliates', icon: TrendingUp },
                      { value: 'investors', label: 'Investors', icon: Target },
                    ],
                  },
                  {
                    label: '💰 Money',
                    tabs: [
                      { value: 'accounting', label: 'Accounting', icon: DollarSign },
                      { value: 'stripe-events', label: 'Stripe Events', icon: CreditCard },
                      { value: 'economic-engine', label: 'Economic Engine', icon: PieChartIcon },
                      { value: 'smart-merch-suppliers', label: 'Smart Merch', icon: Truck },
                      { value: 'boostiswap-artists', label: 'BoostiSwap', icon: Zap },
                      { value: 'concerts', label: 'Concerts', icon: Music2 },
                    ],
                  },
                  {
                    label: '🔌 Platform',
                    tabs: [
                      { value: 'apis', label: 'APIs', icon: LinkIcon },
                      { value: 'mcp-keys', label: 'MCP Keys', icon: Key },
                    ],
                  },
                ];
                const allTabs = TAB_GROUPS.flatMap((g) => g.tabs);
                const activeMeta = allTabs.find((t) => t.value === activeTab);

                return (
                  <div className="w-full mb-5">
                    {/* MOBILE + TABLET (< 1024px): native select with grouped optgroups */}
                    <div className="lg:hidden">
                      <div className="flex items-center gap-2 mb-2">
                        {activeMeta && <activeMeta.icon className="h-4 w-4 text-orange-400 shrink-0" />}
                        <label className="text-xs text-slate-400 uppercase tracking-wide">Section</label>
                        {activeMeta && (
                          <span className="ml-auto text-xs font-semibold text-orange-300">{activeMeta.label}</span>
                        )}
                      </div>
                      <div className="relative">
                        <select
                          value={activeTab}
                          onChange={(e) => setActiveTab(e.target.value)}
                          className="w-full appearance-none bg-slate-900 border border-orange-500/30 text-white rounded-xl px-4 py-3.5 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50 touch-manipulation"
                          data-testid="admin-mobile-tab-select"
                          style={{ fontSize: '16px' /* Prevents iOS zoom on focus */ }}
                        >
                          {TAB_GROUPS.map((g) => (
                            <optgroup key={g.label} label={g.label}>
                              {g.tabs.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400 rotate-90 pointer-events-none" />
                      </div>

                      {/* iPad: quick-access pill row for the 5 most-used tabs */}
                      <div className="hidden md:flex lg:hidden gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
                        {[
                          { value: 'overview', label: 'Overview', icon: BarChart3 },
                          { value: 'c-suite', label: 'C-Suite', icon: Crown },
                          { value: 'artists', label: 'Leads', icon: Music },
                          { value: 'users', label: 'Users', icon: Users },
                          { value: 'accounting', label: 'Finance', icon: DollarSign },
                        ].map((t) => {
                          const Icon = t.icon;
                          const isActive = activeTab === t.value;
                          return (
                            <button
                              key={t.value}
                              onClick={() => setActiveTab(t.value)}
                              className={`flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-all touch-manipulation ${
                                isActive
                                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* DESKTOP (≥ 1024px): grouped horizontal tab bar */}
                    <div className="hidden lg:block overflow-x-auto scrollbar-thin scrollbar-thumb-orange-500/30 scrollbar-track-transparent pb-2">
                      <TabsList className="inline-flex w-max min-w-full bg-slate-900/50 border border-orange-500/20 p-1 h-auto gap-1 items-center">
                        {TAB_GROUPS.map((g, gi) => (
                          <div key={g.label} className="flex items-center gap-1">
                            {gi > 0 && <div className="h-6 w-px bg-orange-500/20 mx-1" />}
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 select-none hidden xl:inline">
                              {g.label.replace(/^[^\w]+\s/, '')}
                            </span>
                            {g.tabs.map((t) => {
                              const Icon = t.icon;
                              return (
                                <TabsTrigger
                                  key={t.value}
                                  value={t.value}
                                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white hover:bg-orange-500/40 text-xs xl:text-sm whitespace-nowrap flex-shrink-0 px-2 xl:px-3"
                                >
                                  <Icon className="h-3.5 w-3.5 mr-1" />
                                  <span>{t.label}</span>
                                </TabsTrigger>
                              );
                            })}
                          </div>
                        ))}
                      </TabsList>
                    </div>
                  </div>
                );
              })()}

              <TabsContent value="overview" className="space-y-4 md:space-y-6 w-full">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
                  <div className="xl:col-span-2 space-y-4 md:space-y-6">
                    <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
                      <CardHeader>
                        <CardTitle className="text-orange-400 flex items-center gap-2">
                          <AreaChart className="h-5 w-5" />
                          Platform Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          {[
                            { label: 'Investors', value: stats.totalInvestors, icon: Target },
                            { label: 'Courses', value: stats.totalCourses, icon: FileVideo },
                            { label: 'Campaigns', value: stats.totalCampaigns, icon: TrendingUp },
                            { label: 'Songs', value: stats.totalSongs, icon: Music },
                            { label: 'Revenue', value: `$${(stats.totalRevenue / 100).toLocaleString()}`, icon: DollarSign },
                            { label: 'Growth', value: `${stats.monthlyGrowthPct > 0 ? '+' : ''}${stats.monthlyGrowthPct}%`, icon: PieChartIcon },
                          ].map((metric) => {
                            const Icon = metric.icon;
                            return (
                              <div key={metric.label} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <Icon className="h-4 w-4 text-orange-400" />
                                  <p className="text-xs text-slate-400">{metric.label}</p>
                                </div>
                                <p className="text-xl font-bold text-white">{metric.value}</p>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
                      <CardHeader>
                        <CardTitle className="text-orange-400">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-3">
                        <Button 
                          variant="outline" 
                          className="border-orange-500/30 hover:bg-orange-500/10"
                          disabled={generatingReport}
                          onClick={async () => {
                            setGeneratingReport(true);
                            try {
                              const data = await apiRequest('POST', '/api/admin/reports/trigger-weekly');
                              toast({ title: 'Report Generated', description: data.message || 'Weekly report generated and sent to your email.' });
                            } catch (err: any) {
                              toast({ title: 'Report Error', description: err.message || 'Failed to generate report', variant: 'destructive' });
                            } finally {
                              setGeneratingReport(false);
                            }
                          }}
                        >
                          {generatingReport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                          {generatingReport ? 'Generating...' : 'Generate Report'}
                        </Button>
                        <Button 
                          variant="outline" 
                          className="border-orange-500/30 hover:bg-orange-500/10"
                          disabled={exportingData}
                          onClick={async () => {
                            setExportingData(true);
                            try {
                              const res = await fetch('/api/admin/accounting/export/csv?days=90', { credentials: 'include' });
                              if (!res.ok) throw new Error('Export failed');
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `boostify-data-${new Date().toISOString().split('T')[0]}.csv`;
                              a.click();
                              URL.revokeObjectURL(url);
                              toast({ title: 'Export Complete', description: 'CSV downloaded with last 90 days of data.' });
                            } catch (err: any) {
                              toast({ title: 'Export Error', description: err.message || 'Failed to export data', variant: 'destructive' });
                            } finally {
                              setExportingData(false);
                            }
                          }}
                        >
                          {exportingData ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                          {exportingData ? 'Exporting...' : 'Export Data'}
                        </Button>
                        <Button 
                          variant="outline" 
                          className="border-orange-500/30 hover:bg-orange-500/10"
                          onClick={() => setActiveTab('stripe-events')}
                        >
                          <ScrollText className="h-4 w-4 mr-2" />
                          View Logs
                        </Button>
                        <Button 
                          variant="outline" 
                          className="border-orange-500/30 hover:bg-orange-500/10"
                          onClick={() => setActiveTab('openclaw')}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <SessionManager />
                    <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
                      <CardHeader>
                        <CardTitle className="text-orange-400 text-sm md:text-base">Admin Info</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-xs text-slate-400">Email</p>
                          <p className="text-sm text-white font-mono break-all">{user?.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Status</p>
                          <Badge className="bg-green-500/20 text-green-300 text-xs">Active</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Admin Style Control */}
                <AdminStyleControl />
              </TabsContent>

              <TabsContent value="c-suite" className="w-full">
                <CSuitePanel />
              </TabsContent>

              <TabsContent value="ai-agent" className="w-full">
                <AdminAgent />
              </TabsContent>

              <TabsContent value="song-analyzer" className="w-full">
                <AdminSongAnalyzer />
              </TabsContent>

              <TabsContent value="users" className="w-full">
                <UserManagement />
              </TabsContent>

              <TabsContent value="accounting" className="w-full">
                <AccountingDashboard />
              </TabsContent>

              <TabsContent value="api-usage" className="w-full">
                <ApiUsageDashboard />
              </TabsContent>

              <TabsContent value="artists" className="w-full">
                <ArtistsManager onRefresh={loadAllData} />
              </TabsContent>

              <TabsContent value="affiliates" className="w-full">
                <AffiliateSessions />
              </TabsContent>

              <TabsContent value="investors" className="w-full">
                <InvestorSessions />
              </TabsContent>

              <TabsContent value="apis" className="w-full">
                <ApiLinks />
              </TabsContent>

              <TabsContent value="stripe-events" className="w-full">
                <StripeEventsLog />
              </TabsContent>

              <TabsContent value="boostiswap-artists" className="w-full">
                <BoostiSwapArtistsManager />
              </TabsContent>

              <TabsContent value="reports" className="w-full">
                <PlatformReports />
              </TabsContent>

              <TabsContent value="openclaw" className="w-full">
                <OpenClawPanel />
              </TabsContent>

              <TabsContent value="discovery" className="w-full">
                <DiscoveryAgentPanel />
                <div className="mt-4">
                  <ActivationDashboard />
                </div>
              </TabsContent>

              <TabsContent value="economic-engine" className="w-full">
                <EconomicEngineManager />
              </TabsContent>

              <TabsContent value="smart-merch-suppliers" className="w-full">
                <SmartMerchSupplierAdmin />
              </TabsContent>

              <TabsContent value="concerts" className="w-full">
                <ConcertsManager />
              </TabsContent>

              <TabsContent value="hunter" className="w-full">
                <ArtistHunterAgent />
              </TabsContent>

              <TabsContent value="moderation" className="w-full">
                <ContentModerationQueue />
              </TabsContent>

              <TabsContent value="mcp-keys" className="w-full">
                <MCPApiKeysManager />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </main>

      <ArtistImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onSuccess={() => {
          loadAllData();
          toast({
            title: 'Artists imported',
            description: 'Artists were imported successfully'
          });
        }}
      />

      {/* Mobile-only floating C-Suite shortcut — always reachable */}
      {activeTab !== 'c-suite' && (
        <button
          onClick={() => setActiveTab('c-suite')}
          aria-label="Open C-Suite AI"
          className="md:hidden fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-orange-500 to-red-600 shadow-xl shadow-orange-500/40 flex items-center justify-center active:scale-95 transition-transform border-2 border-orange-300/40"
          data-testid="admin-csuite-fab"
        >
          <Crown className="h-6 w-6 text-white" />
        </button>
      )}
    </div>
  );
}
