import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';
import { 
  Users, Search, Shield, Crown, UserCog, Mail, Calendar, 
  ChevronLeft, ChevronRight, RefreshCw, Edit2, Trash2,
  CheckCircle, XCircle, Star, Zap, UserPlus, AlertTriangle,
  Send, Loader2, Eraser, KeyRound, Globe
} from 'lucide-react';

interface User {
  id: number;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  clerkId: string | null;
  createdAt: string;
  role: string | null;
  permissions: string[] | null;
  roleGrantedAt: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionEnd: string | null;
}

interface RoleStats {
  byRole: { role: string; count: number }[];
  usersWithoutRole: number;
  totalUsers: number;
}

interface AvailableRole {
  value: string;
  label: string;
  description: string;
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-slate-500/20 text-slate-300',
  creator: 'bg-orange-500/20 text-orange-300',
  professional: 'bg-purple-500/20 text-purple-300',
  enterprise: 'bg-yellow-500/20 text-yellow-300',
};

const ROLE_COLORS: Record<string, string> = {
  user: 'bg-slate-500/20 text-slate-300',
  moderator: 'bg-blue-500/20 text-blue-300',
  support: 'bg-green-500/20 text-green-300',
  admin: 'bg-red-500/20 text-red-300',
  tester: 'bg-purple-500/20 text-purple-300 border border-purple-500/50',
};

const PLAN_NAMES: Record<string, string> = {
  free: 'Discover',
  creator: 'Elevate',
  professional: 'Amplify',
  enterprise: 'Dominate',
};

export function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [subscriptionFilter, setSubscriptionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  
  // Role editing
  const [newRole, setNewRole] = useState('user');
  const [newPermissions, setNewPermissions] = useState<string[]>([]);
  
  // Subscription editing
  const [newPlan, setNewPlan] = useState('creator');
  const [newDuration, setNewDuration] = useState('30');
  
  // New user form
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  
  // Invite
  const [sendInviteOnAdd, setSendInviteOnAdd] = useState(true);
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [showCleanupPreview, setShowCleanupPreview] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<{count: number; users: {id: number; email: string; firstName: string}[]}|null>(null);
  
  // Platform access
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [userAreas, setUserAreas] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  // Action loading states
  const [savingRole, setSavingRole] = useState(false);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  
  // Stats
  const [roleStats, setRoleStats] = useState<RoleStats | null>(null);
  const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([
    { value: 'user', label: 'User', description: 'Standard user access' },
    { value: 'moderator', label: 'Moderator', description: 'Can moderate content and users' },
    { value: 'support', label: 'Support', description: 'Customer support access' },
    { value: 'admin', label: 'Admin', description: 'Full administrative access' },
    { value: 'tester', label: 'Tester', description: 'Full platform access for testing' },
  ]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);

  useEffect(() => {
    loadUsers();
    loadRoleStats();
  }, [page, roleFilter, subscriptionFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(subscriptionFilter && { subscription: subscriptionFilter }),
      });
      
      const data = await apiRequest(`/api/admin/users?${params}`);
      
      if (data.success) {
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
        setTotalUsers(data.pagination.total);
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({ title: 'Error', description: error.message || 'Failed to load users', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadRoleStats = async () => {
    try {
      const data = await apiRequest('/api/admin/roles');
      
      if (data.success) {
        setRoleStats(data.stats);
        if (data.availableRoles?.length) setAvailableRoles(data.availableRoles);
        if (data.availablePermissions?.length) setAvailablePermissions(data.availablePermissions);
      }
    } catch (error) {
      console.error('Error loading role stats:', error);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadUsers();
  };

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role || 'user');
    setNewPermissions(user.permissions || []);
    setShowRoleModal(true);
  };

  const openSubscriptionModal = (user: User) => {
    setSelectedUser(user);
    setNewPlan(user.subscriptionPlan || 'creator');
    setNewDuration('30');
    setShowSubscriptionModal(true);
  };

  const saveRole = async () => {
    if (!selectedUser) return;
    setSavingRole(true);
    try {
      const data = await apiRequest(`/api/admin/users/${selectedUser.id}/role`, {
        method: 'POST',
        data: { role: newRole, permissions: newPermissions }
      });
      
      if (data.success) {
        toast({ title: 'Rol guardado', description: data.message });
        setShowRoleModal(false);
        loadUsers();
        loadRoleStats();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save role', variant: 'destructive' });
    } finally {
      setSavingRole(false);
    }
  };

  const removeRole = async () => {
    if (!selectedUser) return;
    setSavingRole(true);
    try {
      const data = await apiRequest(`/api/admin/users/${selectedUser.id}/role`, {
        method: 'DELETE'
      });
      
      if (data.success) {
        toast({ title: 'Rol eliminado', description: data.message });
        setShowRoleModal(false);
        loadUsers();
        loadRoleStats();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to remove role', variant: 'destructive' });
    } finally {
      setSavingRole(false);
    }
  };

  const saveSubscription = async () => {
    if (!selectedUser) return;
    setSavingSubscription(true);
    try {
      const data = await apiRequest(`/api/admin/users/${selectedUser.id}/subscription`, {
        method: 'POST',
        data: { 
          plan: newPlan, 
          status: 'active',
          durationDays: parseInt(newDuration)
        }
      });
      
      if (data.success) {
        toast({ title: 'Plan asignado', description: data.message });
        setShowSubscriptionModal(false);
        loadUsers();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save subscription', variant: 'destructive' });
    } finally {
      setSavingSubscription(false);
    }
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const deleteUser = async () => {
    if (!selectedUser) return;
    setDeletingUser(true);
    try {
      const data = await apiRequest(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE'
      });
      
      if (data.success) {
        toast({ title: 'Usuario eliminado', description: data.message });
        setShowDeleteModal(false);
        setSelectedUser(null);
        loadUsers();
        loadRoleStats();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete user', variant: 'destructive' });
    } finally {
      setDeletingUser(false);
    }
  };

  const addUser = async () => {
    if (!newUserEmail) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return;
    }
    setAddingUser(true);
    try {
      const data = await apiRequest('/api/admin/users', {
        method: 'POST',
        data: {
          email: newUserEmail,
          firstName: newUserFirstName,
          lastName: newUserLastName,
          role: newUserRole
        }
      });
      
      if (data.success) {
        toast({ title: 'Success', description: data.message });
        
        // Send invite email if checkbox was checked
        if (sendInviteOnAdd && data.userId) {
          try {
            await apiRequest(`/api/admin/users/${data.userId}/invite`, { method: 'POST', data: {} });
            toast({ title: 'Invite Sent', description: `Welcome email sent to ${newUserEmail}` });
          } catch {
            toast({ title: 'Note', description: 'User created but invite email failed', variant: 'destructive' });
          }
        }
        
        setShowAddUserModal(false);
        setNewUserEmail('');
        setNewUserFirstName('');
        setNewUserLastName('');
        setNewUserRole('user');
        loadUsers();
        loadRoleStats();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to add user', variant: 'destructive' });
    } finally {
      setAddingUser(false);
    }
  };

  const sendInvite = async (userId: number, email: string) => {
    setInvitingUserId(userId);
    try {
      const data = await apiRequest(`/api/admin/users/${userId}/invite`, { method: 'POST', data: {} });
      if (data.success) {
        toast({ title: 'Invite Sent', description: `Welcome email sent to ${email}` });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send invite', variant: 'destructive' });
    } finally {
      setInvitingUserId(null);
    }
  };

  const cleanupTestUsers = async (confirm: boolean) => {
    setCleaningUp(true);
    try {
      const data = await apiRequest('/api/admin/users/cleanup-test', {
        method: 'POST',
        data: { confirmDelete: confirm }
      });
      if (data.success) {
        if (data.preview) {
          setCleanupPreview({ count: data.count, users: data.users });
          setShowCleanupPreview(true);
        } else {
          toast({ title: 'Cleanup Complete', description: data.message });
          setShowCleanupPreview(false);
          setCleanupPreview(null);
          loadUsers();
          loadRoleStats();
        }
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Cleanup failed', variant: 'destructive' });
    } finally {
      setCleaningUp(false);
    }
  };

  const openAccessModal = async (user: User) => {
    setSelectedUser(user);
    try {
      const data = await apiRequest(`/api/admin/users/${user.id}/platform-access`);
      if (data.success) {
        setUserAreas(data.areas || []);
      }
    } catch {
      setUserAreas([]);
    }
    setShowAccessModal(true);
  };

  const saveAccess = async () => {
    if (!selectedUser) return;
    setSavingAccess(true);
    try {
      const data = await apiRequest(`/api/admin/users/${selectedUser.id}/platform-access`, {
        method: 'POST',
        data: { areas: userAreas }
      });
      if (data.success) {
        toast({ title: 'Success', description: data.message });
        setShowAccessModal(false);
        loadUsers();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save access', variant: 'destructive' });
    } finally {
      setSavingAccess(false);
    }
  };

  const toggleArea = (area: string) => {
    setUserAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  };

  const togglePermission = (permission: string) => {
    setNewPermissions(prev => 
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };


  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Total Users</p>
                <p className="text-2xl font-bold text-blue-400">{roleStats?.totalUsers || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Admins</p>
                <p className="text-2xl font-bold text-red-400">
                  {roleStats?.byRole.find(r => r.role === 'admin')?.count || 0}
                </p>
              </div>
              <Crown className="h-8 w-8 text-red-400/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Support</p>
                <p className="text-2xl font-bold text-green-400">
                  {roleStats?.byRole.find(r => r.role === 'support')?.count || 0}
                </p>
              </div>
              <Shield className="h-8 w-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Moderators</p>
                <p className="text-2xl font-bold text-purple-400">
                  {roleStats?.byRole.find(r => r.role === 'moderator')?.count || 0}
                </p>
              </div>
              <UserCog className="h-8 w-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-orange-400 flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>Manage users, roles, and permissions</CardDescription>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => cleanupTestUsers(false)}
                disabled={cleaningUp}
                className="border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs"
              >
                {cleaningUp ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Eraser className="h-4 w-4 mr-1" />}
                Clean
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => { loadUsers(); loadRoleStats(); }}
                className="border-orange-500/30 text-xs"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button 
                size="sm"
                onClick={() => setShowAddUserModal(true)}
                className="bg-green-600 hover:bg-green-700 text-xs"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 bg-slate-800 border-slate-700"
              />
            </div>
            
            <Select value={roleFilter || 'all'} onValueChange={(v) => { setRoleFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px] bg-slate-800 border-slate-700">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={subscriptionFilter || 'all'} onValueChange={(v) => { setSubscriptionFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px] bg-slate-800 border-slate-700">
                <SelectValue placeholder="All Plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="none">No Subscription</SelectItem>
                <SelectItem value="free">Discover (Free)</SelectItem>
                <SelectItem value="creator">Elevate</SelectItem>
                <SelectItem value="professional">Amplify</SelectItem>
                <SelectItem value="enterprise">Dominate</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={handleSearch} className="bg-orange-500 hover:bg-orange-600">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          {/* Users Table */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No users found
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-orange-500/30 transition gap-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-sm">
                        {user.email?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white text-sm truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {user.email}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Role Badge */}
                      <Badge className={`text-xs ${ROLE_COLORS[user.role || 'user']}`}>
                        {user.role || 'user'}
                      </Badge>
                      
                      {/* Subscription Badge */}
                      {user.subscriptionPlan && (
                        <Badge className={`text-xs ${PLAN_COLORS[user.subscriptionPlan] || PLAN_COLORS.free}`}>
                          <Zap className="h-3 w-3 mr-1" />
                          {PLAN_NAMES[user.subscriptionPlan] || user.subscriptionPlan}
                        </Badge>
                      )}
                      
                      {/* Status */}
                      {user.subscriptionStatus === 'active' ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : user.subscriptionStatus ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                      ) : null}
                    </div>
                    
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendInvite(user.id, user.email || '')}
                        disabled={invitingUserId === user.id}
                        className="h-8 w-8 p-0 border-green-500/30 hover:bg-green-500/10"
                        title="Send invite"
                      >
                        {invitingUserId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAccessModal(user)}
                        className="h-8 px-2 border-cyan-500/30 hover:bg-cyan-500/10 text-xs gap-1"
                        title="Platform access"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Access</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRoleModal(user)}
                        className="h-8 px-2 border-blue-500/30 hover:bg-blue-500/10 text-xs gap-1"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Role</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSubscriptionModal(user)}
                        className="h-8 px-2 border-purple-500/30 hover:bg-purple-500/10 text-xs gap-1"
                      >
                        <Star className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Plan</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteModal(user)}
                        className="h-8 w-8 p-0 border-red-500/30 hover:bg-red-500/10 text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-slate-700">
            <p className="text-xs sm:text-sm text-slate-400">
              {users.length} of {totalUsers}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-slate-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="border-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Edit Modal — modal={false} fixes Select dropdown inside Dialog */}
      <Dialog open={showRoleModal} onOpenChange={setShowRoleModal} modal={false}>
        <DialogContent className="bg-slate-900 border-orange-500/20 z-[200]">
          <DialogHeader>
            <DialogTitle className="text-orange-400">Edit User Role</DialogTitle>
            <DialogDescription>
              Assign role and permissions for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="z-[300] bg-slate-800 border-slate-700">
                  {availableRoles.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      <span className="font-medium">{role.label}</span>
                      <span className="text-xs text-slate-400 ml-2">— {role.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
                {availablePermissions.length === 0 ? (
                  <p className="text-xs text-slate-500 col-span-2">No extra permissions loaded</p>
                ) : availablePermissions.map(permission => (
                  <div key={permission} className="flex items-center space-x-2">
                    <Checkbox
                      id={permission}
                      checked={newPermissions.includes(permission)}
                      onCheckedChange={() => togglePermission(permission)}
                    />
                    <label
                      htmlFor={permission}
                      className="text-sm text-slate-300 cursor-pointer"
                    >
                      {permission.replace(/_/g, ' ')}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button
              variant="destructive"
              onClick={removeRole}
              disabled={savingRole}
              className="mr-auto"
            >
              {savingRole ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Quitar Rol
            </Button>
            <Button variant="outline" onClick={() => setShowRoleModal(false)} disabled={savingRole}>
              Cancelar
            </Button>
            <Button onClick={saveRole} disabled={savingRole} className="bg-orange-500 hover:bg-orange-600">
              {savingRole ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {savingRole ? 'Guardando...' : 'Guardar Rol'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Edit Modal — modal={false} fixes Select inside Dialog */}
      <Dialog open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal} modal={false}>
        <DialogContent className="bg-slate-900 border-orange-500/20 z-[200]">
          <DialogHeader>
            <DialogTitle className="text-orange-400">Assign Subscription</DialogTitle>
            <DialogDescription>
              Manually assign a subscription plan for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[300] bg-slate-800 border-slate-700">
                  <SelectItem value="free">Discover (Free)</SelectItem>
                  <SelectItem value="creator">Elevate ($49.99/mo)</SelectItem>
                  <SelectItem value="professional">Amplify ($89.99/mo)</SelectItem>
                  <SelectItem value="enterprise">Dominate ($149.99/mo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Select value={newDuration} onValueChange={setNewDuration}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[300] bg-slate-800 border-slate-700">
                  <SelectItem value="7">7 days (Trial)</SelectItem>
                  <SelectItem value="30">30 days (1 month)</SelectItem>
                  <SelectItem value="90">90 days (3 months)</SelectItem>
                  <SelectItem value="180">180 days (6 months)</SelectItem>
                  <SelectItem value="365">365 days (1 year)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-300">
                ⚠️ This will manually assign a subscription without payment. 
                Use this for special cases like partnerships or testing.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubscriptionModal(false)} disabled={savingSubscription}>
              Cancelar
            </Button>
            <Button onClick={saveSubscription} disabled={savingSubscription} className="bg-purple-500 hover:bg-purple-600">
              {savingSubscription ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {savingSubscription ? 'Asignando...' : 'Asignar Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent className="bg-slate-900 border-red-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="text-white font-semibold">{selectedUser?.email}</span>?
              <br /><br />
              This action will permanently remove the user and all associated data including:
              <ul className="list-disc list-inside mt-2 text-slate-400">
                <li>User profile and account</li>
                <li>Assigned roles and permissions</li>
                <li>Subscription data</li>
              </ul>
              <br />
              <span className="text-red-400 font-semibold">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700" disabled={deletingUser}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteUser}
              disabled={deletingUser}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingUser ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {deletingUser ? 'Eliminando...' : 'Eliminar Usuario'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add User Modal — modal={false} needed for Select dropdown inside Dialog */}
      <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal} modal={false}>
        <DialogContent className="bg-slate-900 border-orange-500/20 z-[200]">
          <DialogHeader>
            <DialogTitle className="text-orange-400 flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Agregar Usuario
            </DialogTitle>
            <DialogDescription>
              Crear una nueva cuenta de usuario manualmente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email <span className="text-red-400">*</span></Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  placeholder="John"
                  value={newUserFirstName}
                  onChange={(e) => setNewUserFirstName(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  placeholder="Doe"
                  value={newUserLastName}
                  onChange={(e) => setNewUserLastName(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Initial Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[300] bg-slate-800 border-slate-700">
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="tester">
                    <span className="flex items-center gap-1">
                      🧪 Tester <span className="text-xs text-purple-400">(Full Access)</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Checkbox
                id="send-invite"
                checked={sendInviteOnAdd}
                onCheckedChange={(checked) => setSendInviteOnAdd(checked === true)}
              />
              <label htmlFor="send-invite" className="text-sm text-green-300 cursor-pointer">
                Send welcome/invite email after creating user
              </label>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-300">
                ℹ️ The user will be created without a password. They will need to use 
                Clerk authentication (Google, email link, etc.) to access their account.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserModal(false)} disabled={addingUser}>
              Cancelar
            </Button>
            <Button onClick={addUser} disabled={addingUser} className="bg-green-600 hover:bg-green-700">
              {addingUser ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              {addingUser ? 'Creando...' : sendInviteOnAdd ? 'Agregar e Invitar' : 'Agregar Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cleanup Test Users Preview Dialog */}
      <AlertDialog open={showCleanupPreview} onOpenChange={setShowCleanupPreview}>
        <AlertDialogContent className="bg-slate-900 border-red-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <Eraser className="h-5 w-5" />
              Clean Test Users
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">Found <span className="text-white font-bold">{cleanupPreview?.count || 0}</span> test users to remove (users without Clerk authentication, excluding admin emails):</p>
                <ScrollArea className="h-[200px] rounded-md border border-slate-700 p-3">
                  <div className="space-y-2">
                    {cleanupPreview?.users.map(u => (
                      <div key={u.id} className="flex items-center gap-2 text-sm">
                        <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                        <span className="text-slate-300">{u.email || 'No email'}</span>
                        <span className="text-slate-500">({u.firstName || 'No name'})</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="mt-3 text-red-400 text-sm font-semibold">This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cleanupTestUsers(true)}
              className="bg-red-600 hover:bg-red-700"
              disabled={cleaningUp}
            >
              {cleaningUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eraser className="h-4 w-4 mr-2" />}
              Delete {cleanupPreview?.count || 0} Users
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Platform Access Modal */}
      <Dialog open={showAccessModal} onOpenChange={setShowAccessModal}>
        <DialogContent className="bg-slate-900 border-cyan-500/20 max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Platform Access
            </DialogTitle>
            <DialogDescription>
              Manage platform area access for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-2 max-h-[50vh] sm:max-h-[350px] overflow-y-auto pr-2">
              {[
                { key: 'dashboard', label: 'Dashboard', icon: '📊' },
                { key: 'artist_studio', label: 'Artist Studio', icon: '🎨' },
                { key: 'music_creation', label: 'Music Creation', icon: '🎵' },
                { key: 'video_creation', label: 'Video Creation', icon: '🎬' },
                { key: 'merch_store', label: 'Merch Store', icon: '👕' },
                { key: 'social_boost', label: 'Social Boost', icon: '📱' },
                { key: 'ig_boost', label: 'IG Boost', icon: '📸' },
                { key: 'youtube_boost', label: 'YouTube Boost', icon: '▶️' },
                { key: 'spotify_boost', label: 'Spotify Boost', icon: '🎧' },
                { key: 'analytics', label: 'Analytics', icon: '📈' },
                { key: 'monetization', label: 'Monetization', icon: '💰' },
                { key: 'courses', label: 'Courses', icon: '📚' },
                { key: 'crowdfunding', label: 'Crowdfunding', icon: '🚀' },
                { key: 'boostiswap', label: 'BoostiSwap', icon: '🔄' },
                { key: 'investor_portal', label: 'Investor Portal', icon: '💼' },
                { key: 'admin_panel', label: 'Admin Panel', icon: '⚙️' },
                { key: 'api_access', label: 'API Access', icon: '🔑' },
                { key: 'export_tools', label: 'Export Tools', icon: '📤' },
              ].map(area => (
                <div
                  key={area.key}
                  onClick={() => toggleArea(area.key)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                    userAreas.includes(area.key)
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="text-base">{area.icon}</span>
                  <span className="text-sm font-medium">{area.label}</span>
                  {userAreas.includes(area.key) && <CheckCircle className="h-3.5 w-3.5 ml-auto text-cyan-400" />}
                </div>
              ))}
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-400">{userAreas.length} areas selected</p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUserAreas([])}
                  className="text-xs h-7"
                >
                  Clear All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUserAreas(['dashboard', 'artist_studio', 'music_creation', 'video_creation', 'merch_store', 'social_boost', 'ig_boost', 'youtube_boost', 'spotify_boost', 'analytics', 'monetization', 'courses', 'crowdfunding', 'boostiswap', 'investor_portal', 'admin_panel', 'api_access', 'export_tools'])}
                  className="text-xs h-7"
                >
                  Select All
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccessModal(false)} disabled={savingAccess}>
              Cancelar
            </Button>
            <Button
              onClick={saveAccess}
              disabled={savingAccess}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {savingAccess ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
              {savingAccess ? 'Guardando...' : 'Guardar Acceso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
