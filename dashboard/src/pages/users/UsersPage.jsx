import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Search,
  RefreshCw,
  Mail,
  Building2,
  Copy,
  Check,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  X,
  Filter,
  Calendar,
  MoreVertical,
  ChevronDown,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { authApi, clientApi } from '../../api/apiClient';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';


export const UsersPage = () => {
  const { isDark } = useTheme();
  const { user: currentUser, isSuperAdmin, isClientAdmin } = useAuth();

  // State
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Create User
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'client_viewer',
    clientId: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Change Role
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState(null);
  const [newRole, setNewRole] = useState('client_viewer');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [roleSuccess, setRoleSuccess] = useState('');

  // Fetch Users List
  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (clientFilter) params.clientId = clientFilter;

      const res = await authApi.getUsers(params);
      const userList = Array.isArray(res) ? res : res?.data || [];
      setUsers(userList);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError(err.message || 'Unable to retrieve user directory.');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Clients for dropdown selectors
  useEffect(() => {
    clientApi
      .listClients()
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setClients(list);
        if (list.length > 0 && !createForm.clientId) {
          setCreateForm((prev) => ({ ...prev, clientId: list[0].id }));
        }
      })
      .catch((err) => console.error('Failed to load clients:', err));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, clientFilter]);

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.client_name?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    return {
      total: users.length,
      superAdmins: users.filter((u) => u.role === 'super_admin').length,
      clientAdmins: users.filter((u) => u.role === 'client_admin').length,
      viewers: users.filter((u) => u.role === 'client_viewer').length,
    };
  }, [users]);

  // Copy helper
  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Submit User Creation
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!createForm.name || !createForm.username || !createForm.email || !createForm.password) {
      setCreateError('All fields are required.');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      if (createForm.clientId) {
        // Use client user endpoint
        await clientApi.createClientUser(createForm.clientId, {
          name: createForm.name,
          username: createForm.username,
          email: createForm.email,
          password: createForm.password,
          role: createForm.role,
        });
      } else {
        // General registration endpoint
        await authApi.register({
          name: createForm.name,
          username: createForm.username,
          email: createForm.email,
          password: createForm.password,
        });
      }

      setCreateSuccess(`User "${createForm.username}" successfully created!`);
      setTimeout(() => {
        setIsCreateModalOpen(false);
        setCreateSuccess('');
        setCreateForm({
          name: '',
          username: '',
          email: '',
          password: '',
          role: 'client_viewer',
          clientId: clients[0]?.id || '',
        });
        fetchUsers();
      }, 1500);
    } catch (err) {
      setCreateError(err.message || 'Failed to create user.');
    } finally {
      setIsCreating(false);
    }
  };

  // Submit Role Change (Super Admin only)
  const handleRoleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedUserForRole) return;

    setIsUpdatingRole(true);
    setRoleError('');
    setRoleSuccess('');

    try {
      await authApi.updateRole(selectedUserForRole.id, newRole);
      setRoleSuccess(`Role updated to ${newRole.replace('_', ' ').toUpperCase()} successfully!`);

      setTimeout(() => {
        setIsRoleModalOpen(false);
        setRoleSuccess('');
        setSelectedUserForRole(null);
        fetchUsers();
      }, 1200);
    } catch (err) {
      setRoleError(err.message || 'Failed to update user role.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">User Directory & RBAC</h1>
            <Badge variant="default" size="sm">
              {users.length} {users.length === 1 ? 'User' : 'Users'}
            </Badge>
          </div>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
            Manage member credentials, assign organizational boundaries, and audit permissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            icon={RefreshCw}
            onClick={fetchUsers}
            isLoading={isLoading}
            title="Refresh Users"
          >
            Refresh
          </Button>

          {(isSuperAdmin || isClientAdmin) && (
            <Button
              variant="primary"
              size="md"
              icon={UserPlus}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Add New User
            </Button>
          )}
        </div>
      </div>


      {/* Metric Cards Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center gap-3.5">
          <div
            className={`p-3 rounded-xl ${
              isDark
                ? 'bg-cyanBrand/10 text-cyanBrand border border-cyanBrand/20'
                : 'bg-orangeBrand/10 text-orangeBrand border border-orangeBrand/20'
            }`}
          >
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-[11px] uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
              Total Members
            </p>
            <h3 className="text-xl font-bold mt-0.5">{metrics.total}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-[11px] uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
              Super Admins
            </p>
            <h3 className="text-xl font-bold mt-0.5">{metrics.superAdmins}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-[11px] uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
              Client Admins
            </p>
            <h3 className="text-xl font-bold mt-0.5">{metrics.clientAdmins}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className={`text-[11px] uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
              Active Viewers
            </p>
            <h3 className="text-xl font-bold mt-0.5">{metrics.viewers}</h3>
          </div>
        </Card>
      </div>


      {/* Search & Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by full name, username, or email..."
              icon={Search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2.5">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold border outline-none ${
                isDark
                  ? 'bg-obsidian-card border-obsidian-border text-slate-100'
                  : 'bg-white border-slateGray-300 text-slateGray-900'
              }`}
            >
              <option value="">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="client_admin">Client Admin</option>
              <option value="client_viewer">Client Viewer</option>
            </select>

            {/* Tenant Filter (Super Admin only) */}
            {isSuperAdmin && clients.length > 0 && (
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border outline-none max-w-[200px] truncate ${
                  isDark
                    ? 'bg-obsidian-card border-obsidian-border text-slate-100'
                    : 'bg-white border-slateGray-300 text-slateGray-900'
                }`}
              >
                <option value="">All Organizations</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Card>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchUsers}>
            Retry
          </Button>
        </div>
      )}


      {/* Users Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className={`border-b text-xs font-semibold uppercase tracking-wider ${
                  isDark
                    ? 'border-obsidian-border bg-obsidian-card/40 text-slate-400'
                    : 'border-slateGray-200 bg-slateGray-50 text-slateGray-600'
                }`}
              >
                <th className="py-3.5 px-5">User</th>
                <th className="py-3.5 px-5">Email & Credentials</th>
                <th className="py-3.5 px-5">Organization</th>
                <th className="py-3.5 px-5">Assigned Role</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Joined</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y text-sm ${
                isDark ? 'divide-obsidian-border text-slate-200' : 'divide-slateGray-200 text-slateGray-800'
              }`}
            >
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-cyanBrand" />
                      <p className="text-sm">Loading member directory...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 opacity-40" />
                      <p className="text-base font-semibold">No users found</p>
                      <p className="text-xs text-slate-500">
                        {searchQuery ? 'Adjust your search or filter settings.' : 'Provision your first member.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id || currentUser?.userId === u.id;
                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slateGray-50/80'
                      }`}
                    >
                      {/* User Name & Avatar */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                              u.role === 'super_admin'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : isDark
                                ? 'bg-cyanBrand/10 text-cyanBrand border border-cyanBrand/20'
                                : 'bg-orangeBrand/10 text-orangeBrand border border-orangeBrand/20'
                            }`}
                          >
                            {u.name?.charAt(0) || u.username?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold">{u.name || u.username}</p>
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 font-mono">@{u.username}</p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate max-w-[180px]">{u.email}</span>
                        </div>
                      </td>

                      {/* Organization / Tenant */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="font-medium">
                            {u.client_name || (u.role === 'super_admin' ? 'Root System' : 'Individual')}
                          </span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-4 px-5">
                        <Badge status={u.role} size="sm">
                          {u.role.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        <Badge
                          status={u.is_active !== false ? 'active' : 'inactive'}
                          size="sm"
                        >
                          {u.is_active !== false ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>

                      {/* Joined Date */}
                      <td className="py-4 px-5 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recent'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Super Admin can edit any user's role */}
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Shield}
                              onClick={() => {
                                setSelectedUserForRole(u);
                                setNewRole(u.role);
                                setIsRoleModalOpen(true);
                              }}
                              title="Update Role"
                            >
                              Role
                            </Button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopy(u.id, `user-${u.id}`)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyanBrand transition-colors"
                            title="Copy User UUID"
                          >
                            {copiedId === `user-${u.id}` ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>


      {/* MODAL 1: Create New User */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-2xl shadow-2xl p-6 border ${
              isDark
                ? 'bg-obsidian-surface border-obsidian-border text-slate-100'
                : 'bg-white border-slateGray-200 text-slateGray-900 shadow-xl'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-inherit">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl ${
                    isDark
                      ? 'bg-cyanBrand/10 text-cyanBrand'
                      : 'bg-orangeBrand/10 text-orangeBrand'
                  }`}
                >
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Provision Member</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
                    Creates credentials and binds user to an organization partition.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-5 space-y-3.5">
              {createError && (
                <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {createSuccess && (
                <div className="p-3 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{createSuccess}</span>
                </div>
              )}

              {/* Organization Selector */}
              {clients.length > 0 && (
                <div>
                  <label
                    className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                      isDark ? 'text-slate-300' : 'text-slateGray-700'
                    }`}
                  >
                    Client Organization
                  </label>
                  <select
                    value={createForm.clientId}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, clientId: e.target.value })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none font-medium transition-all ${
                      isDark
                        ? 'bg-obsidian-card border-obsidian-border text-slate-100 focus:border-cyanBrand focus:ring-2 focus:ring-cyanBrand/20'
                        : 'bg-white border-slateGray-300 text-slateGray-900 focus:border-orangeBrand focus:ring-2 focus:ring-orangeBrand/20'
                    }`}
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Input
                label="Full Name"
                icon={User}
                placeholder="Dr. Raymond Miller"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />

              <Input
                label="Username"
                placeholder="rmiller"
                required
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              />

              <Input
                label="Email"
                type="email"
                icon={Mail}
                placeholder="rmiller@domain.com"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />

              <Input
                label="Password"
                type="password"
                icon={Lock}
                placeholder="••••••••••••"
                required
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />

              <div>
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    isDark ? 'text-slate-300' : 'text-slateGray-700'
                  }`}
                >
                  Role Permission Scope
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none font-medium transition-all ${
                    isDark
                      ? 'bg-obsidian-card border-obsidian-border text-slate-100 focus:border-cyanBrand focus:ring-2 focus:ring-cyanBrand/20'
                      : 'bg-white border-slateGray-300 text-slateGray-900 focus:border-orangeBrand focus:ring-2 focus:ring-orangeBrand/20'
                  }`}
                >
                  <option value="client_viewer">Client Viewer (Read-only)</option>
                  <option value="client_admin">Client Admin (Manage uploads & users)</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin (Full Root Authority)</option>}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-inherit">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isCreating}
                  icon={UserPlus}
                >
                  Create Member
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Change User Role (Super Admin) */}
      {isRoleModalOpen && selectedUserForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-2xl shadow-2xl p-6 border ${
              isDark
                ? 'bg-obsidian-surface border-obsidian-border text-slate-100'
                : 'bg-white border-slateGray-200 text-slateGray-900 shadow-xl'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-inherit">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Modify User Role</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
                    Target: <span className="font-semibold">{selectedUserForRole.name || selectedUserForRole.username}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRoleUpdate} className="mt-5 space-y-4">
              {roleError && (
                <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{roleError}</span>
                </div>
              )}

              {roleSuccess && (
                <div className="p-3 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{roleSuccess}</span>
                </div>
              )}

              <div>
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${
                    isDark ? 'text-slate-300' : 'text-slateGray-700'
                  }`}
                >
                  Select New Role
                </label>
                <div className="space-y-2">
                  {[
                    {
                      id: 'client_viewer',
                      label: 'Client Viewer',
                      desc: 'Read-only access to view and export processed invoices.',
                    },
                    {
                      id: 'client_admin',
                      label: 'Client Admin',
                      desc: 'Can upload documents, manage client users, and generate API keys.',
                    },
                    {
                      id: 'super_admin',
                      label: 'Super Admin',
                      desc: 'Global root platform access. Can onboard clients and manage all tenants.',
                    },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        newRole === option.id
                          ? isDark
                            ? 'bg-cyanBrand/10 border-cyanBrand text-white'
                            : 'bg-orangeBrand/10 border-orangeBrand text-slateGray-900'
                          : isDark
                          ? 'bg-obsidian-card border-obsidian-border text-slate-400 hover:text-slate-200'
                          : 'bg-slateGray-50 border-slateGray-200 text-slateGray-600 hover:text-slateGray-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="newRole"
                        value={option.id}
                        checked={newRole === option.id}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className="text-xs opacity-75 mt-0.5">{option.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {newRole === 'super_admin' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Granting Super Admin gives this user unrestricted platform privileges across all organizations.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-inherit">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsRoleModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isUpdatingRole}
                  icon={ShieldCheck}
                >
                  Save New Role
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;

