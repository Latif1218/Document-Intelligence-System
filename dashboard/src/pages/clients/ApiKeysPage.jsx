import React, { useState, useEffect, useMemo } from 'react';
import {
  Key,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Building2,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  X,
  Code2,
  Calendar,
  CheckCircle2,
  Lock,
  Layers,
  Terminal,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { clientApi } from '../../api/apiClient';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';

export const ApiKeysPage = () => {
  const { isDark } = useTheme();
  const { user, isSuperAdmin, isClientAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(searchParams.get('clientId') || '');
  const [apiKeys, setApiKeys] = useState([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Modals
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);

  // Generate Key Form
  const [keyForm, setKeyForm] = useState({
    name: '',
    description: '',
    environment: 'production',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // Fetch available clients
  const fetchClients = async () => {
    setIsLoadingClients(true);
    setError(null);
    try {
      const res = await clientApi.listClients();
      const list = Array.isArray(res) ? res : res?.data || [];
      setClients(list);

      // Auto-select client: either from URL params, or user's client, or first client in list
      const urlClientId = searchParams.get('clientId');
      if (urlClientId && list.some((c) => c.id === urlClientId)) {
        setSelectedClientId(urlClientId);
      } else if (user?.clientId && list.some((c) => c.id === user.clientId)) {
        setSelectedClientId(user.clientId);
      } else if (list.length > 0 && !selectedClientId) {
        setSelectedClientId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load clients for API keys:', err);
      setError(err.message || 'Failed to retrieve clients list.');
    } finally {
      setIsLoadingClients(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Fetch API keys whenever selectedClientId changes
  const fetchApiKeys = async (clientId) => {
    if (!clientId) {
      setApiKeys([]);
      return;
    }
    setIsLoadingKeys(true);
    setError(null);
    try {
      const res = await clientApi.getClientApiKeys(clientId);
      const keys = Array.isArray(res) ? res : res?.data || [];
      setApiKeys(keys);
    } catch (err) {
      console.error('Failed to load API keys:', err);
      setError(err.message || 'Unable to retrieve API keys for this organization.');
      setApiKeys([]);
    } finally {
      setIsLoadingKeys(false);
    }
  };

  useEffect(() => {
    if (selectedClientId) {
      setSearchParams({ clientId: selectedClientId }, { replace: true });
      fetchApiKeys(selectedClientId);
    }
  }, [selectedClientId]);

  // Selected client details
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Copy helper
  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Submit Generate New Key
  const handleGenerateKeySubmit = async (e) => {
    e.preventDefault();
    if (!keyForm.name.trim()) {
      setGenerateError('API Key name is required.');
      return;
    }

    setIsGenerating(true);
    setGenerateError('');
    try {
      const res = await clientApi.createApiKey(selectedClientId, keyForm);
      const data = res?.data || res;

      // Extract generated raw key
      setNewlyCreatedKey({
        rawKey: data.key_value || data.keyValue,
        name: data.name || keyForm.name,
        environment: data.environment || keyForm.environment,
        clientName: selectedClient?.name || 'Organization',
      });

      setIsGenerateModalOpen(false);
      setKeyForm({ name: '', description: '', environment: 'production' });

      // Refresh keys table
      await fetchApiKeys(selectedClientId);
    } catch (err) {
      setGenerateError(err.message || 'Failed to generate API key.');
    } finally {
      setIsGenerating(false);
    }
  };

  const canManageKeys = isSuperAdmin || isClientAdmin;

  return (
    <div className="space-y-6">
      {/* Top Header & Client Switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">API Keys & Ingestion Credentials</h1>
            <Badge variant="default" size="sm">
              {apiKeys.length} {apiKeys.length === 1 ? 'Key' : 'Keys'}
            </Badge>
          </div>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
            Secure tokens used by client pipelines and automated scanners to ingest financial documents.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            icon={RefreshCw}
            onClick={() => fetchApiKeys(selectedClientId)}
            isLoading={isLoadingKeys}
            disabled={!selectedClientId}
          >
            Refresh
          </Button>

          {canManageKeys && (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsGenerateModalOpen(true)}
              disabled={!selectedClientId}
            >
              Generate New Key
            </Button>
          )}
        </div>
      </div>

      {/* Organization Selector Bar  */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isDark
                  ? 'bg-cyanBrand/10 text-cyanBrand border border-cyanBrand/20'
                  : 'bg-orangeBrand/10 text-orangeBrand border border-orangeBrand/20'
              }`}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
                Active Organization
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-bold text-base">
                  {selectedClient?.name || 'Loading organization...'}
                </span>
                {selectedClient?.slug && (
                  <code
                    className={`text-xs px-2 py-0.5 rounded font-mono ${
                      isDark
                        ? 'bg-obsidian-card text-cyanBrand border border-obsidian-border'
                        : 'bg-slateGray-100 text-orangeBrand border border-slateGray-200'
                    }`}
                  >
                    {selectedClient.slug}
                  </code>
                )}
              </div>
            </div>
          </div>

          {/* Client Select dropdown for Super Admin */}
          {isSuperAdmin && clients.length > 1 && (
            <div className="w-full sm:w-72">
              <label
                className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${
                  isDark ? 'text-slate-400' : 'text-slateGray-600'
                }`}
              >
                Switch Tenant
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-sm border outline-none font-medium transition-all ${
                  isDark
                    ? 'bg-obsidian-card border-obsidian-border text-slate-100 focus:border-cyanBrand focus:ring-2 focus:ring-cyanBrand/20'
                    : 'bg-white border-slateGray-300 text-slateGray-900 focus:border-orangeBrand focus:ring-2 focus:ring-orangeBrand/20'
                }`}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.slug})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchApiKeys(selectedClientId)}
          >
            Retry
          </Button>
        </div>
      )}

    
      {/* API Keys Table */}
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
                <th className="py-3.5 px-5">Key Name & Details</th>
                <th className="py-3.5 px-5">Token / Masked Key</th>
                <th className="py-3.5 px-5">Environment</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Created Date</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y text-sm ${
                isDark ? 'divide-obsidian-border text-slate-200' : 'divide-slateGray-200 text-slateGray-800'
              }`}
            >
              {isLoadingKeys ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-cyanBrand" />
                      <p className="text-sm">Loading API keys...</p>
                    </div>
                  </td>
                </tr>
              ) : apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Key className="w-8 h-8 opacity-40" />
                      <p className="text-base font-semibold">No API keys found for this client</p>
                      <p className="text-xs text-slate-500">
                        Generate a new API key to enable document ingestion through HTTP headers.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => {
                  const displayToken = key.maskedKey || key.key_value || '••••••••••••••••••••••••••••••••';
                  return (
                    <tr
                      key={key.id}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slateGray-50/80'
                      }`}
                    >
                      {/* Name & Description */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-xl ${
                              isDark
                                ? 'bg-cyanBrand/10 text-cyanBrand border border-cyanBrand/20'
                                : 'bg-orangeBrand/10 text-orangeBrand border border-orangeBrand/20'
                            }`}
                          >
                            <Key className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold">{key.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {key.description || 'General API Ingestion Key'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Token Value */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <code
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-mono tracking-wide ${
                              isDark
                                ? 'bg-obsidian-card text-slate-300 border border-obsidian-border'
                                : 'bg-slateGray-100 text-slateGray-800 border border-slateGray-200'
                            }`}
                          >
                            {displayToken}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(key.maskedKey || key.key_value, `key-${key.id}`)}
                            className="p-1 rounded text-slate-400 hover:text-cyanBrand transition-colors"
                            title="Copy Token"
                          >
                            {copiedId === `key-${key.id}` ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Environment */}
                      <td className="py-4 px-5">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium uppercase tracking-wider ${
                            key.environment === 'production'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {key.environment || 'production'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        <Badge
                          status={key.is_active !== false ? 'active' : 'inactive'}
                          size="sm"
                        >
                          {key.is_active !== false ? 'Active' : 'Revoked'}
                        </Badge>
                      </td>

                      {/* Created Date */}
                      <td className="py-4 px-5 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {key.created_at
                            ? new Date(key.created_at).toLocaleDateString()
                            : 'Recent'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Copy}
                          onClick={() => handleCopy(key.key_id || key.id, `id-${key.id}`)}
                          title="Copy Key UUID"
                        >
                          {copiedId === `id-${key.id}` ? 'Copied' : 'Key ID'}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>


      {/* Quick Integration Guide Snippet */}
      <Card
        title="Developer Integration Snippet"
        subtitle="Authenticate API requests using the x-api-key HTTP header"
        icon={Code2}
      >
        <div
          className={`p-4 rounded-xl font-mono text-xs overflow-x-auto border ${
            isDark
              ? 'bg-obsidian-card/90 border-obsidian-border text-slate-300'
              : 'bg-slateGray-100 border-slateGray-300 text-slateGray-800'
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-inherit text-slate-400">
            <span className="flex items-center gap-1.5 font-sans font-semibold text-[11px]">
              <Terminal className="w-3.5 h-3.5 text-cyanBrand" />
              cURL File Ingestion
            </span>
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  `curl -X POST "http://localhost:5000/documents" \\\n  -H "x-api-key: YOUR_DOCINTEL_API_KEY" \\\n  -F "file=@invoice.pdf"`,
                  'curl-sample'
                )
              }
              className="text-xs hover:text-white flex items-center gap-1 text-slate-400"
            >
              {copiedId === 'curl-sample' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy cURL</span>
                </>
              )}
            </button>
          </div>
          <p className="text-cyanBrand"># Upload multi-page invoice via authenticated client key</p>
          <p>
            curl -X POST &quot;http://localhost:5000/documents&quot; \
          </p>
          <p className="text-amber-400">
            &nbsp;&nbsp;-H &quot;x-api-key: YOUR_DOCINTEL_API_KEY&quot; \
          </p>
          <p>&nbsp;&nbsp;-F &quot;file=@invoice.pdf&quot;</p>
        </div>
      </Card>


      {/* Generate New API Key */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-lg rounded-2xl shadow-2xl p-6 border ${
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
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Generate New API Key</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
                    Organization: <span className="font-semibold">{selectedClient?.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateKeySubmit} className="mt-5 space-y-4">
              {generateError && (
                <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{generateError}</span>
                </div>
              )}

              <Input
                label="Key Name"
                placeholder="e.g. Care Guide Production Ingestion"
                required
                value={keyForm.name}
                onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })}
              />

              <div>
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    isDark ? 'text-slate-300' : 'text-slateGray-700'
                  }`}
                >
                  Deployment Environment
                </label>
                <select
                  value={keyForm.environment}
                  onChange={(e) => setKeyForm({ ...keyForm, environment: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all ${
                    isDark
                      ? 'bg-obsidian-card border-obsidian-border text-slate-100 focus:border-cyanBrand focus:ring-2 focus:ring-cyanBrand/20'
                      : 'bg-white border-slateGray-300 text-slateGray-900 focus:border-orangeBrand focus:ring-2 focus:ring-orangeBrand/20'
                  }`}
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging / Test</option>
                  <option value="development">Local Development</option>
                </select>
              </div>

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
                  value={keyForm.description}
                  onChange={(e) =>
                    setKeyForm({ ...keyForm, description: e.target.value })
                  }
                  placeholder="e.g. Dedicated scanner key for Care Guide BD automated bills"
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
                  onClick={() => setIsGenerateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isGenerating}
                  icon={Key}
                >
                  Generate Secret Key
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Secret API Key Reveal */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
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
                <h3 className="font-bold text-lg">API Key Created!</h3>
                <p className="text-xs text-slate-400">
                  {newlyCreatedKey.clientName} &bull; {newlyCreatedKey.name} (
                  {newlyCreatedKey.environment})
                </p>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Copy and store this secret key immediately</p>
                <p className="mt-0.5 opacity-90">
                  For strict security, this raw key will never be visible again. Pass this value in the <code className="font-mono bg-black/20 px-1 py-0.5 rounded">x-api-key</code> request header.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label
                className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slateGray-600'
                }`}
              >
                Secret API Token
              </label>
              <div
                className={`flex items-center justify-between p-3.5 rounded-xl font-mono text-sm border ${
                  isDark
                    ? 'bg-obsidian-card border-obsidian-border text-cyanBrand'
                    : 'bg-slateGray-100 border-slateGray-300 text-orangeBrand'
                }`}
              >
                <span className="truncate mr-2 select-all font-semibold">
                  {newlyCreatedKey.rawKey}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  icon={copiedId === 'modal-key' ? Check : Copy}
                  onClick={() => handleCopy(newlyCreatedKey.rawKey, 'modal-key')}
                >
                  {copiedId === 'modal-key' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="primary"
                onClick={() => setNewlyCreatedKey(null)}
              >
                Done, I have stored it safely
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeysPage;

