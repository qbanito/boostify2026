import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Trash2, Edit2, Download, RefreshCw, Mail, Send, Users, Building2, Globe, Filter, CheckCircle2, XCircle, Clock, UserPlus } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';

interface ArtistLead {
  id: number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  jobTitle?: string;
  industry?: string;
  companyName?: string;
  companyWebsite?: string;
  companyDescription?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedin?: string;
  category?: string;
  status?: string;
  emailsSent?: number;
  lastContactedAt?: string;
  createdAt: string;
}

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

interface ArtistsManagerProps {
  onRefresh?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300',
  queued: 'bg-purple-500/20 text-purple-300',
  contacted: 'bg-cyan-500/20 text-cyan-300',
  opened: 'bg-yellow-500/20 text-yellow-300',
  clicked: 'bg-orange-500/20 text-orange-300',
  responded: 'bg-green-500/20 text-green-300',
  not_interested: 'bg-slate-500/20 text-slate-400',
  deal_in_progress: 'bg-emerald-500/20 text-emerald-300',
  unsubscribed: 'bg-red-500/20 text-red-300',
  bounced: 'bg-red-500/20 text-red-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  artist: 'Artist',
  record_label: 'Record Label',
  publishing: 'Publishing',
  management: 'Management',
  booking: 'Booking',
  radio: 'Radio',
  tv: 'TV',
  sync: 'Sync',
  studio: 'Studio',
  streaming: 'Streaming',
  live_events: 'Live Events',
  pr: 'PR',
  pr_marketing: 'PR/Marketing',
  distribution: 'Distribution',
  media: 'Media',
  other: 'Other',
};

export function ArtistsManager({ onRefresh }: ArtistsManagerProps) {
  const { toast } = useToast();
  const [leads, setLeads] = useState<ArtistLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState<number | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [editingLead, setEditingLead] = useState<ArtistLead | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [converting, setConverting] = useState<number | null>(null);
  const PAGE_SIZE = 50;

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        category: categoryFilter,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE)
      });
      const data = await apiRequest('GET', `/api/admin/artist-leads?${params}`);
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast({ title: 'Error', description: 'Error loading artist leads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, page]);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiRequest('GET', '/api/admin/artist-leads/stats');
      setStats(data.stats);
    } catch {}
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { loadStats(); }, []);

  const handleSendInvite = async (id: number) => {
    setSending(id);
    try {
      const data = await apiRequest('POST', `/api/admin/artist-leads/${id}/invite`);
      if (data.success) {
        toast({ title: 'Invite Sent!', description: data.message });
        loadLeads();
        loadStats();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send invite', variant: 'destructive' });
    } finally {
      setSending(null);
    }
  };

  const handleBulkInvite = async () => {
    if (selectedIds.size === 0) return;
    setBulkSending(true);
    try {
      const data = await apiRequest('POST', '/api/admin/artist-leads/bulk-invite', {
        ids: Array.from(selectedIds)
      });
      toast({
        title: 'Bulk Invite Complete',
        description: `Sent: ${data.sent}, Failed: ${data.failed}${data.errors?.length ? '\n' + data.errors.slice(0, 3).join(', ') : ''}`
      });
      setSelectedIds(new Set());
      loadLeads();
      loadStats();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Bulk invite failed', variant: 'destructive' });
    } finally {
      setBulkSending(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingLead) return;
    try {
      const data = await apiRequest('PATCH', `/api/admin/artist-leads/${editingLead.id}`, {
        fullName: editingLead.fullName,
        email: editingLead.email,
        jobTitle: editingLead.jobTitle,
        companyName: editingLead.companyName,
        status: editingLead.status,
        category: editingLead.category,
      });
      if (data.success) {
        toast({ title: 'Updated', description: 'Lead updated successfully' });
        setShowEditDialog(false);
        loadLeads();
      }
    } catch {
      toast({ title: 'Error', description: 'Error updating lead', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this lead permanently?')) return;
    try {
      await apiRequest('DELETE', `/api/admin/artist-leads/${id}`);
      toast({ title: 'Deleted', description: 'Lead removed' });
      loadLeads();
      loadStats();
    } catch {
      toast({ title: 'Error', description: 'Error deleting lead', variant: 'destructive' });
    }
  };

  const handleConvertToUser = async (lead: ArtistLead) => {
    if (!confirm(`Convert "${lead.fullName}" (${lead.email}) to a platform user?`)) return;
    setConverting(lead.id);
    try {
      const data = await apiRequest('POST', `/api/admin/artist-leads/${lead.id}/convert`);
      if (data.success) {
        toast({ title: 'User Created!', description: data.message });
        loadLeads();
        loadStats();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to convert lead', variant: 'destructive' });
    } finally {
      setConverting(null);
    }
  };

  const exportData = async () => {
    try {
      const data = await apiRequest('GET', '/api/admin/artist-leads/export');
      const rows = data.leads || [];
      const headers = ['ID', 'Name', 'Email', 'Personal Email', 'Job Title', 'Company', 'Industry', 'Category', 'City', 'Country', 'Status', 'Emails Sent', 'LinkedIn'];
      const csv = [
        headers.join(','),
        ...rows.map((r: any) => [
          r.id, `"${r.fullName || ''}"`, r.email || '', r.personalEmail || '',
          `"${r.jobTitle || ''}"`, `"${r.companyName || ''}"`, r.industry || '',
          r.category || '', r.city || '', r.country || '', r.status || '',
          r.emailsSent || 0, r.linkedin || ''
        ].join(','))
      ].join('\n');
      const el = document.createElement('a');
      el.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
      el.setAttribute('download', `artist-leads-${new Date().toISOString().slice(0, 10)}.csv`);
      el.style.display = 'none';
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-400" />
            Leads CRM
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Manage contacts, send invites, convert leads to platform users
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
          <Card className="bg-gradient-to-br from-cyan-900/40 to-cyan-900/20 border-cyan-500/20">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold text-cyan-300">{stats.total}</div>
              <div className="text-xs text-slate-400">Total Contacts</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-900/40 to-blue-900/20 border-blue-500/20">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold text-blue-300">{stats.byStatus?.new || 0}</div>
              <div className="text-xs text-slate-400">New</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-900/40 to-purple-900/20 border-purple-500/20">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold text-purple-300">{stats.byStatus?.contacted || 0}</div>
              <div className="text-xs text-slate-400">Contacted</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-900/40 to-green-900/20 border-green-500/20">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold text-green-300">{stats.byStatus?.responded || 0}</div>
              <div className="text-xs text-slate-400">Responded</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-900/40 to-emerald-900/20 border-emerald-500/20">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold text-emerald-300">{stats.byStatus?.deal_in_progress || 0}</div>
              <div className="text-xs text-slate-400">Deals</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row items-center gap-2 sm:gap-3">
        <div className="flex-1 w-full">
          <Input
            placeholder="Search by name, email, company, title..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="bg-slate-900 border-slate-700"
          />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-md px-2 sm:px-3 py-2 text-xs sm:text-sm text-white"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="opened">Opened</option>
          <option value="clicked">Clicked</option>
          <option value="responded">Responded</option>
          <option value="deal_in_progress">Deal in Progress</option>
          <option value="not_interested">Not Interested</option>
          <option value="bounced">Bounced</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
          className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-md px-2 sm:px-3 py-2 text-xs sm:text-sm text-white"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => { loadLeads(); loadStats(); }} variant="outline" size="sm" className="border-cyan-500/50 text-cyan-300">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button onClick={exportData} variant="outline" size="sm" className="border-cyan-500/50 text-cyan-300">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-purple-900/30 border border-purple-500/30 rounded-lg">
          <span className="text-sm text-purple-300">{selectedIds.size} selected</span>
          <Button
            size="sm"
            onClick={handleBulkInvite}
            disabled={bulkSending}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Send className="h-4 w-4 mr-1" />
            {bulkSending ? 'Sending...' : `Send ${selectedIds.size} Invites`}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-slate-400">
            Clear
          </Button>
        </div>
      )}

      {/* Leads Table */}
      <Card className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-cyan-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-cyan-300 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Artists Database ({total.toLocaleString()} contacts)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading contacts...</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No contacts found</div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[600px] sm:min-w-[800px]">
                <thead className="sticky top-0 bg-slate-900 z-10">
                  <tr className="border-b border-slate-700">
                    <th className="p-2 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === leads.length && leads.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left p-2 text-slate-400">Name</th>
                    <th className="text-left p-2 text-slate-400">Email</th>
                    <th className="text-left p-2 text-slate-400">Company</th>
                    <th className="text-left p-2 text-slate-400">Title</th>
                    <th className="text-left p-2 text-slate-400">Location</th>
                    <th className="text-left p-2 text-slate-400">Status</th>
                    <th className="text-left p-2 text-slate-400">Sent</th>
                    <th className="text-right p-2 text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-2">
                        <div className="text-white font-medium">{lead.fullName}</div>
                        {lead.category && (
                          <span className="text-xs text-slate-500">{CATEGORY_LABELS[lead.category] || lead.category}</span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="text-cyan-400 text-xs">{lead.email || '—'}</div>
                        {lead.personalEmail && (
                          <div className="text-slate-500 text-xs">{lead.personalEmail}</div>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="text-slate-300 text-xs">{lead.companyName || '—'}</div>
                      </td>
                      <td className="p-2 text-slate-400 text-xs max-w-[150px] truncate">{lead.jobTitle || '—'}</td>
                      <td className="p-2 text-slate-500 text-xs">
                        {[lead.city, lead.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="p-2">
                        <Badge className={STATUS_COLORS[lead.status || 'new'] || STATUS_COLORS.new}>
                          {(lead.status || 'new').replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-2 text-center text-slate-400">{lead.emailsSent || 0}</td>
                      <td className="p-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSendInvite(lead.id)}
                            disabled={!lead.email || sending === lead.id}
                            className="text-purple-400 hover:bg-purple-500/10"
                            title="Send invite email"
                          >
                            {sending === lead.id ? <Clock className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                          </Button>
                          {lead.linkedin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(lead.linkedin!, '_blank')}
                              className="text-blue-400 hover:bg-blue-500/10"
                              title="View LinkedIn"
                            >
                              <Globe className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleConvertToUser(lead)}
                            disabled={!lead.email || converting === lead.id || lead.status === 'deal_in_progress'}
                            className="text-green-400 hover:bg-green-500/10"
                            title="Convert to platform user"
                          >
                            {converting === lead.id ? <Clock className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingLead(lead); setShowEditDialog(true); }}
                            className="text-orange-400 hover:bg-orange-500/10"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(lead.id)}
                            className="text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </ScrollArea>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 pt-4 border-t border-slate-800">
              <span className="text-xs sm:text-sm text-slate-400">
                Page {page + 1} of {totalPages} ({total.toLocaleString()} total)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="border-slate-600"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="border-slate-600"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingLead && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm sm:text-base">Edit Contact: {editingLead.fullName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    value={editingLead.fullName}
                    onChange={(e) => setEditingLead({ ...editingLead, fullName: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    value={editingLead.email || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Job Title</label>
                  <Input
                    value={editingLead.jobTitle || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, jobTitle: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Company</label>
                  <Input
                    value={editingLead.companyName || ''}
                    onChange={(e) => setEditingLead({ ...editingLead, companyName: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={editingLead.status || 'new'}
                    onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value })}
                    className="w-full mt-1 p-2 rounded border border-slate-700 bg-slate-900 text-white text-sm"
                  >
                    <option value="new">New</option>
                    <option value="queued">Queued</option>
                    <option value="contacted">Contacted</option>
                    <option value="opened">Opened</option>
                    <option value="clicked">Clicked</option>
                    <option value="responded">Responded</option>
                    <option value="deal_in_progress">Deal in Progress</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="unsubscribed">Unsubscribed</option>
                    <option value="bounced">Bounced</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    value={editingLead.category || 'other'}
                    onChange={(e) => setEditingLead({ ...editingLead, category: e.target.value })}
                    className="w-full mt-1 p-2 rounded border border-slate-700 bg-slate-900 text-white text-sm"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                <Button onClick={handleUpdate} className="bg-orange-500 hover:bg-orange-600">Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
