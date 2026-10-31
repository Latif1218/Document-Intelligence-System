import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Key,
  UserPlus,
  Globe,
  Mail,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  X,
  Lock,
  User,
  Users,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { clientApi } from '../../api/apiClient';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';

export const ClientsPage = () => {
  const { isDark } = useTheme();
  const { user, isSuperAdmin, isClientAdmin } = useAuth();
  const navigate = useNavigate();

  // State
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  // Modals state
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [createdKeyInfo, setCreatedKeyInfo] = useState(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedClientForUser, setSelectedClientForUser] = useState(null);

  // Forms State
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    email: '',
    website: '',
    description: '',
  });
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState('');

  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'client_viewer',
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccessMessage, setUserSuccessMessage] = useState('');

  // Fetch clients on mount
  const fetchClients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await clientApi.listClients();
      // Handle both raw array and wrapped { data: [...] } responses
      const clientList = Array.isArray(response) ? response : response?.data || [];
      setClients(clientList);
    } catch (err) {
      console.error('Failed to load clients:', err);
      setError(err.message || 'Unable to retrieve clients. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.slug?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [clients, searchQuery]);

  // Copy helper
  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Submit Client Onboarding (Super Admin)
  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    if (!onboardForm.name || !onboardForm.email) {
      setOnboardError('Organization name and primary contact email are required.');
      return;
    }

    setIsOnboarding(true);
    setOnboardError('');
    try {
      const response = await clientApi.onboardClient(onboardForm);
      const data = response?.data || response;

      setIsOnboardModalOpen(false);
      setOnboardForm({ name: '', email: '', website: '', description: '' });

      // If initial auto-generated API key returned, show the secret modal
      if (data?.initialApiKey) {
        setCreatedKeyInfo({
          clientName: data.client?.name || onboardForm.name,
          clientSlug: data.client?.slug || '',
          apiKey: data.initialApiKey.keyValue,
          keyName: data.initialApiKey.name,
        });
        setIsNewKeyModalOpen(true);
      }

      await fetchClients();
    } catch (err) {
      setOnboardError(err.message || 'Failed to onboard organization.');
    } finally {
      setIsOnboarding(false);
    }
  };

  // Submit Client User Provisioning
  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClientForUser) return;
    if (!userForm.name || !userForm.username || !userForm.email || !userForm.password) {
      setUserError('All user fields are required.');
      return;
    }

    setIsCreatingUser(true);
    setUserError('');
    setUserSuccessMessage('');

    try {
      await clientApi.createClientUser(selectedClientForUser.id, userForm);
      setUserSuccessMessage(`User "${userForm.username}" successfully created!`);
      setTimeout(() => {
        setIsUserModalOpen(false);
        setUserSuccessMessage('');
        setUserForm({
          name: '',
          username: '',
          email: '',
          password: '',
          role: 'client_viewer',
        });
      }, 1500);
    } catch (err) {
      setUserError(err.message || 'Failed to create user.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Organizations & Tenants</h1>
            <Badge variant="default" size="sm">
              {clients.length} {clients.length === 1 ? 'Client' : 'Clients'}
            </Badge>
          </div>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
            Manage multi-tenant client accounts, assign user roles, and monitor API credentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            icon={RefreshCw}
            onClick={fetchClients}
            isLoading={isLoading}
            title="Refresh list"
          >
            Refresh
          </Button>

          {isSuperAdmin && (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsOnboardModalOpen(true)}
            >
              Onboard Client
            </Button>
          )}
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div
            className={`p-3 rounded-xl ${
              isDark
                ? 'bg-cyanBrand/10 text-cyanBrand border border-cyanBrand/20'
                : 'bg-orangeBrand/10 text-orangeBrand border border-orangeBrand/20'
            }`}
          >
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className={`text-xs uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
              Total Organizations
            </p>
            <h3 className="text-2xl font-bold mt-0.5">{clients.length}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className={`text-xs uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
              Active Tenants
            </p>
            <h3 className="text-2xl font-bold mt-0.5">
              {clients.filter((c) => c.is_active !== false).length}
            </h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className={`text-xs uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
              Access Scope
            </p>
            <h3 className="text-sm font-semibold mt-1">
              {isSuperAdmin ? 'Global Multi-Tenant Root' : 'Tenant Isolated'}
            </h3>
          </div>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by organization name, slug, or contact email..."
              icon={Search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
          <Button variant="ghost" size="sm" onClick={fetchClients}>
            Retry
          </Button>
        </div>
      )}

      {/* Clients Table / List */}
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
                <th className="py-3.5 px-5">Organization</th>
                <th className="py-3.5 px-5">Tenant Slug</th>
                <th className="py-3.5 px-5">Contact & Web</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Created</th>
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
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-cyanBrand" />
                      <p className="text-sm">Loading organizations...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Building2 className="w-8 h-8 opacity-40" />
                      <p className="text-base font-semibold">No organizations found</p>
                      <p className="text-xs text-slate-500">
                        {searchQuery
                          ? 'Try adjusting your search criteria'
                          : 'Onboard your first client organization to begin'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slateGray-50/80'
                    }`}
                  >
                    {/* Organization Name & ID */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                            isDark
                              ? 'bg-cyanBrand/10 text-cyanBrand border border-cyanBrand/20'
                              : 'bg-orangeBrand/10 text-orangeBrand border border-orangeBrand/20'
                          }`}
                        >
                          {client.name?.charAt(0).toUpperCase() || 'C'}
                        </div>
                        <div>
                          <p className="font-semibold">{client.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-mono text-slate-500">
                              {client.id?.slice(0, 12)}...
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(client.id, `id-${client.id}`)}
                              className="text-slate-400 hover:text-cyanBrand transition-colors"
                              title="Copy Full Client UUID"
                            >
                              {copiedKey === `id-${client.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="py-4 px-5">
                      <code
                        className={`text-xs px-2 py-1 rounded-md font-mono ${
                          isDark
                            ? 'bg-obsidian-card text-cyanBrand border border-obsidian-border'
                            : 'bg-slateGray-100 text-orangeBrand border border-slateGray-200'
                        }`}
                      >
                        {client.slug}
                      </code>
                    </td>

                    {/* Contact & Web */}
                    <td className="py-4 px-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <a
                            href={`mailto:${client.email}`}
                            className="hover:underline text-slate-300"
                          >
                            {client.email}
                          </a>
                        </div>
                        {client.website && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Globe className="w-3.5 h-3.5" />
                            <a
                              href={
                                client.website.startsWith('http')
                                  ? client.website
                                  : `https://${client.website}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline truncate max-w-[160px]"
                            >
                              {client.website}
                            </a>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-5">
                      <Badge
                        status={client.is_active !== false ? 'active' : 'inactive'}
                        size="sm"
                      >
                        {client.is_active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    {/* Created Date */}
                    <td className="py-4 px-5 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {client.created_at
                          ? new Date(client.created_at).toLocaleDateString()
                          : 'Recent'}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Add User Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={UserPlus}
                          onClick={() => {
                            setSelectedClientForUser(client);
                            setIsUserModalOpen(true);
                          }}
                          title="Add user to this organization"
                        >
                          User
                        </Button>

                        {/* API Keys Link */}
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Key}
                          onClick={() => navigate(`/api-keys?clientId=${client.id}`)}
                          title="View API Keys"
                        >
                          Keys
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

    
      {/*  Onboard Client Organization */}
      {isOnboardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-lg rounded-2xl shadow-2xl p-6 border ${
              isDark
                ? 'bg-obsidian-surface border-obsidian-border text-slate-100 shadow-glow-cyan/20'
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
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Onboard New Organization</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
                    Provisions isolated tenant database partition and default API key.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOnboardModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="mt-5 space-y-4">
              {onboardError && (
                <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{onboardError}</span>
                </div>
              )}

              <Input
                label="Organization Name"
                placeholder="e.g. Cottage Health Network"
                required
                value={onboardForm.name}
                onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
              />

              <Input
                label="Primary Contact Email"
                type="email"
                placeholder="admin@cottagehealth.com"
                required
                value={onboardForm.email}
                onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
              />

              <Input
                label="Website URL"
                placeholder="https://cottagehealth.com"
                value={onboardForm.website}
                onChange={(e) => setOnboardForm({ ...onboardForm, website: e.target.value })}
              />

              <div>
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    isDark ? 'text-slate-300' : 'text-slateGray-700'
                  }`}
                >
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={onboardForm.description}
                  onChange={(e) =>
                    setOnboardForm({ ...onboardForm, description: e.target.value })
                  }
                  placeholder="Notes about this client organization or account SLA..."
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all ${
                    isDark
                      ? 'bg-obsidian-card/80 border-obsidian-border text-slate-100 placeholder-slate-500 focus:border-cyanBrand focus:ring-2 focus:ring-cyanBrand/20'
                      : 'bg-white border-slateGray-300 text-slateGray-900 placeholder-slateGray-400 focus:border-orangeBrand focus:ring-2 focus:ring-orangeBrand/20'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-inherit">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsOnboardModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isOnboarding}
                  icon={CheckCircle2}
                >
                  Create & Generate API Key
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Newly Created API Key Secret Box */}
      {isNewKeyModalOpen && createdKeyInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div
            className={`w-full max-w-lg rounded-2xl p-6 border shadow-2xl ${
              isDark
                ? 'bg-obsidian-surface border-cyanBrand/40 shadow-glow-cyan text-slate-100'
                : 'bg-white border-orangeBrand/40 shadow-glow-orange text-slateGray-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Organization Onboarded!</h3>
                <p className="text-xs text-slate-400">
                  {createdKeyInfo.clientName} ({createdKeyInfo.clientSlug})
                </p>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Store this API Key securely</p>
                <p className="mt-0.5 opacity-90">
                  This raw secret key is only displayed once and cannot be retrieved later. Copy it now for document ingestion.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label
                className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slateGray-600'
                }`}
              >
                Initial Production API Key
              </label>
              <div
                className={`flex items-center justify-between p-3.5 rounded-xl font-mono text-sm border ${
                  isDark
                    ? 'bg-obsidian-card border-obsidian-border text-cyanBrand'
                    : 'bg-slateGray-100 border-slateGray-300 text-orangeBrand'
                }`}
              >
                <span className="truncate mr-2 select-all font-semibold">
                  {createdKeyInfo.apiKey}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  icon={copiedKey === 'new-key' ? Check : Copy}
                  onClick={() => handleCopy(createdKeyInfo.apiKey, 'new-key')}
                >
                  {copiedKey === 'new-key' ? 'Copied' : 'Copy Key'}
                </Button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="primary"
                onClick={() => {
                  setIsNewKeyModalOpen(false);
                  setCreatedKeyInfo(null);
                }}
              >
                I have saved this key
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* Create User for Client */}
      {isUserModalOpen && selectedClientForUser && (
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
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Add User</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
                    Target: <span className="font-semibold">{selectedClientForUser.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="mt-5 space-y-3.5">
              {userError && (
                <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{userError}</span>
                </div>
              )}

              {userSuccessMessage && (
                <div className="p-3 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{userSuccessMessage}</span>
                </div>
              )}

              <Input
                label="Full Name"
                icon={User}
                placeholder="Dr. Sarah Jenkins"
                required
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              />

              <Input
                label="Username"
                placeholder="sjenkins"
                required
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
              />

              <Input
                label="Email"
                type="email"
                icon={Mail}
                placeholder="sjenkins@cottagehealth.com"
                required
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />

              <Input
                label="Temporary Password"
                type="password"
                icon={Lock}
                placeholder="••••••••••••"
                required
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              />

              <div>
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    isDark ? 'text-slate-300' : 'text-slateGray-700'
                  }`}
                >
                  Role & Permissions
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all ${
                    isDark
                      ? 'bg-obsidian-card border-obsidian-border text-slate-100 focus:border-cyanBrand focus:ring-2 focus:ring-cyanBrand/20'
                      : 'bg-white border-slateGray-300 text-slateGray-900 focus:border-orangeBrand focus:ring-2 focus:ring-orangeBrand/20'
                  }`}
                >
                  <option value="client_viewer">Client Viewer (Read-only)</option>
                  <option value="client_admin">Client Admin (Manage uploads & users)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-inherit">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsUserModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isCreatingUser}
                  icon={UserPlus}
                >
                  Create User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;

