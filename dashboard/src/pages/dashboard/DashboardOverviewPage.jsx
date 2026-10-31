import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Files,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  UploadCloud,
  RefreshCw,
  Search,
  Eye,
} from 'lucide-react';
import { documentApi } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';


export const DashboardOverviewPage = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    needsReview: 0,
    queued: 0,
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await documentApi.list({ limit: 8 });
      if (response.success && response.data) {
        const docs = response.data;
        setDocuments(docs);

        // Calculate metrics
        const total = response.meta?.total || docs.length;
        const completed = docs.filter((d) => d.status === 'completed').length;
        const needsReview = docs.filter((d) => d.needs_review || d.status === 'flagged').length;
        const queued = docs.filter((d) => ['queued', 'processing'].includes(d.status)).length;

        setStats({ total, completed, needsReview, queued });
      }
    } catch {
      // Fallback empty metrics on network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const statCards = [
    {
      label: 'Total Processed',
      value: stats.total,
      icon: Files,
      color: isDark ? 'text-cyanBrand' : 'text-orangeBrand',
      bg: isDark ? 'bg-cyanBrand/10 border-cyanBrand/20' : 'bg-orangeBrand/10 border-orangeBrand/20',
    },
    {
      label: 'Verified Invoices',
      value: stats.completed,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Flagged for Review',
      value: stats.needsReview,
      icon: AlertTriangle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'In Pipeline / Queued',
      value: stats.queued,
      icon: Clock,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10 border-sky-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className={`rounded-2xl p-6 lg:p-8 border relative overflow-hidden transition-all duration-300 ${
        isDark
          ? 'bg-gradient-to-r from-obsidian-surface via-obsidian-card to-obsidian-surface border-obsidian-border shadow-soft-float'
          : 'bg-gradient-to-r from-white via-slateGray-50 to-white border-warm-border shadow-warm-card'
      }`}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-75">
                Care Guide Enterprise
              </span>
              <Badge status={user?.role} size="sm" dot={false} />
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              Hello, {user?.name || user?.username || 'Executive'}
            </h1>
            <p className={`text-xs sm:text-sm mt-1 max-w-xl ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
              Monitor financial documents, invoice validation anomalies, and hybrid vector searches in real-time.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link to="/documents">
              <Button variant="primary" icon={UploadCloud}>
                Upload Invoices
              </Button>
            </Link>
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchDashboardData}
              isLoading={loading}
              title="Refresh Analytics"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Metric Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx} hoverable className="relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
                    {card.label}
                  </p>
                  <p className="text-2xl lg:text-3xl font-black mt-1">
                    {loading ? '...' : card.value}
                  </p>
                </div>
                <div className={`p-3 rounded-2xl border ${card.bg} ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent Documents Table */}
      <Card
        title="Recent Ingested Invoices"
        subtitle="Latest documents extracted via AI Structured Outputs"
        action={
          <Link to="/documents">
            <Button variant="ghost" size="sm" icon={ArrowUpRight}>
              View All
            </Button>
          </Link>
        }
      >
        {loading ? (
          <div className="py-12 text-center text-sm opacity-60">Loading recent documents...</div>
        ) : documents.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Files className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-sm font-medium">No documents processed yet</p>
            <Link to="/documents">
              <Button variant="outline" size="sm" icon={UploadCloud}>
                Ingest Your First Document
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className={`border-b ${isDark ? 'border-obsidian-border bg-obsidian-card/40 text-slate-400' : 'border-warm-border bg-slateGray-50 text-slateGray-600'}`}>
                <tr>
                  <th className="py-3 px-5 font-semibold">Document</th>
                  <th className="py-3 px-5 font-semibold">Invoice #</th>
                  <th className="py-3 px-5 font-semibold">Supplier</th>
                  <th className="py-3 px-5 font-semibold">Total Amount</th>
                  <th className="py-3 px-5 font-semibold">Status</th>
                  <th className="py-3 px-5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slateGray-50'
                    }`}
                  >
                    <td className="py-3 px-5 font-medium">
                      <div className="flex items-center gap-2">
                        <Files className={`w-4 h-4 shrink-0 ${isDark ? 'text-cyanBrand' : 'text-orangeBrand'}`} />
                        <span className="truncate max-w-[200px]" title={doc.original_filename}>
                          {doc.original_filename}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-5 font-mono text-[11px] opacity-80">
                      {doc.invoice_number || '—'}
                    </td>
                    <td className="py-3 px-5 opacity-90 truncate max-w-[150px]">
                      {doc.supplier_name || '—'}
                    </td>
                    <td className="py-3 px-5 font-semibold">
                      {doc.invoice_total ? `$${parseFloat(doc.invoice_total).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-5">
                      <Badge
                        status={doc.needs_review ? 'needs_review' : doc.status}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Link to={`/documents?selected=${doc.id}`}>
                        <Button variant="ghost" size="sm" icon={Eye}>
                          Inspect
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DashboardOverviewPage;

