import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Database,
  Filter,
  FileText,
  Building2,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  X,
  Layers,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { searchApi, clientApi } from '../../api/apiClient';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { DocumentInspectionDrawer } from '../../components/documents/DocumentInspectionDrawer';


export const SearchPage = () => {
  const { isDark } = useTheme();
  const { isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search Query state
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);

  // Filters state
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [reviewFilter, setReviewFilter] = useState('');
  const [limitFilter, setLimitFilter] = useState(20);
  const [clientFilter, setClientFilter] = useState('');
  const [clients, setClients] = useState([]);

  // Results state
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);

  // Inspection Drawer state
  const [selectedDocId, setSelectedDocId] = useState(null);

  // Sample quick suggestion prompts
  const sampleQueries = [
    'Medical supplies invoice',
    'Care Guide BD patient billing',
    'Total balance due over 1000',
    'Payment terms net 30 days',
    'Overdue penalty charge',
  ];

  // Fetch clients list if Super Admin
  useEffect(() => {
    if (isSuperAdmin) {
      clientApi
        .listClients()
        .then((res) => {
          const list = Array.isArray(res) ? res : res?.data || [];
          setClients(list);
        })
        .catch((err) => console.error('Failed to load clients for search:', err));
    }
  }, [isSuperAdmin]);

  // Execute Search Function
  const executeSearch = async (searchTerm = query) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setError(null);
    setSubmittedQuery(trimmed);

    // Update URL query string
    setSearchParams({ q: trimmed }, { replace: true });

    try {
      const params = {
        q: trimmed,
        limit: limitFilter,
      };

      if (statusFilter) params.status = statusFilter;
      if (supplierFilter) params.supplier = supplierFilter;
      if (reviewFilter !== '') params.needs_review = reviewFilter;
      if (clientFilter) params.clientId = clientFilter;

      const res = await searchApi.search(params);

      // Handle response structure
      const items = Array.isArray(res) ? res : res?.data || [];
      const metaInfo = res?.meta || { total: items.length, searchMode: 'hybrid' };

      setResults(items);
      setMeta(metaInfo);
    } catch (err) {
      console.error('Search failed:', err);
      setError(err.message || 'Search execution failed. Please verify your query.');
      setResults([]);
      setMeta(null);
    } finally {
      setIsSearching(false);
    }
  };

  // Trigger search on mount if initial query existed in URL
  useEffect(() => {
    if (initialQuery) {
      executeSearch(initialQuery);
    }
  }, []);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleSuggestionClick = (sampleText) => {
    setQuery(sampleText);
    executeSearch(sampleText);
  };

  // Helper to format currency
  const formatCurrency = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Hybrid AI Search</h1>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 ${
                isDark
                  ? 'bg-cyanBrand/10 text-cyanBrand border border-cyanBrand/20'
                  : 'bg-orangeBrand/10 text-orangeBrand border border-orangeBrand/20'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              FTS + pgvector HNSW
            </span>
          </div>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
            Combines exact keyword PostgreSQL Full-Text Search with deep OpenAI vector embeddings via Reciprocal Rank Fusion (RRF).
          </p>
        </div>
      </div>

      {/* Search Input Box Card */}
      <Card className="p-4 md:p-6">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search invoices, supplier names, line items, amounts, or semantic topics..."
                className={`w-full pl-12 pr-10 py-3.5 rounded-xl text-base font-medium border outline-none transition-all ${
                  isDark
                    ? 'bg-obsidian-card border-obsidian-border text-slate-100 placeholder-slate-500 focus:border-cyanBrand focus:ring-2 focus:ring-cyanBrand/20'
                    : 'bg-white border-slateGray-300 text-slateGray-900 placeholder-slateGray-400 focus:border-orangeBrand focus:ring-2 focus:ring-orangeBrand/20'
                }`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={showFilters ? 'outline' : 'secondary'}
                size="lg"
                icon={SlidersHorizontal}
                onClick={() => setShowFilters(!showFilters)}
                title="Toggle Advanced Filters"
              >
                Filters
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={Search}
                isLoading={isSearching}
              >
                Search
              </Button>
            </div>
          </div>

          {/* Quick Query Suggestions Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className={`font-semibold flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slateGray-500'}`}>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Try searching:
            </span>
            {sampleQueries.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSuggestionClick(sample)}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  isDark
                    ? 'bg-obsidian-card/60 border-obsidian-border text-slate-300 hover:border-cyanBrand/50 hover:text-cyanBrand'
                    : 'bg-slateGray-100 border-slateGray-200 text-slateGray-700 hover:border-orangeBrand/50 hover:text-orangeBrand'
                }`}
              >
                &ldquo;{sample}&rdquo;
              </button>
            ))}
          </div>

          {/* Advanced Filter Collapse Drawer */}
          {showFilters && (
            <div
              className={`p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-200 ${
                isDark
                  ? 'bg-obsidian-card/40 border-obsidian-border'
                  : 'bg-slateGray-50 border-slateGray-200'
              }`}
            >
              {/* Status Filter */}
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
                  Document Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-xs border outline-none font-medium ${
                    isDark
                      ? 'bg-obsidian-card border-obsidian-border text-slate-100'
                      : 'bg-white border-slateGray-300 text-slateGray-900'
                  }`}
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Review Filter */}
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
                  Review Requirement
                </label>
                <select
                  value={reviewFilter}
                  onChange={(e) => setReviewFilter(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-xs border outline-none font-medium ${
                    isDark
                      ? 'bg-obsidian-card border-obsidian-border text-slate-100'
                      : 'bg-white border-slateGray-300 text-slateGray-900'
                  }`}
                >
                  <option value="">All</option>
                  <option value="true">Flagged for Review</option>
                  <option value="false">Passed Clean</option>
                </select>
              </div>

              {/* Result Limit */}
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
                  Max Matches
                </label>
                <select
                  value={limitFilter}
                  onChange={(e) => setLimitFilter(Number(e.target.value))}
                  className={`w-full px-3 py-2 rounded-lg text-xs border outline-none font-medium ${
                    isDark
                      ? 'bg-obsidian-card border-obsidian-border text-slate-100'
                      : 'bg-white border-slateGray-300 text-slateGray-900'
                  }`}
                >
                  <option value={10}>Top 10</option>
                  <option value={20}>Top 20</option>
                  <option value={50}>Top 50</option>
                </select>
              </div>

              {/* Super Admin Client Filter */}
              {isSuperAdmin && (
                <div>
                  <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slateGray-600'}`}>
                    Tenant Scope
                  </label>
                  <select
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-xs border outline-none font-medium ${
                      isDark
                        ? 'bg-obsidian-card border-obsidian-border text-slate-100'
                        : 'bg-white border-slateGray-300 text-slateGray-900'
                    }`}
                  >
                    <option value="">Global (All Tenants)</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </form>
      </Card>

      {/* Search Metadata & Stats */}
      {submittedQuery && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slateGray-700'}`}>
              Found {results.length} results for:
            </span>
            <span
              className={`px-2 py-0.5 rounded font-mono font-medium ${
                isDark ? 'bg-cyanBrand/10 text-cyanBrand' : 'bg-orangeBrand/10 text-orangeBrand'
              }`}
            >
              &ldquo;{submittedQuery}&rdquo;
            </span>
          </div>

          {meta?.searchMode && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Search Strategy:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider text-[10px] ${
                  meta.searchMode === 'hybrid'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                }`}
              >
                {meta.searchMode === 'hybrid' ? 'Reciprocal Rank Fusion (FTS + Vector)' : meta.searchMode}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => executeSearch()}>
            Retry
          </Button>
        </div>
      )}


      {/* Results List */}
      {isSearching ? (
        <Card className="p-12 text-center text-slate-400">
          <div className="flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-cyanBrand" />
            <p className="text-base font-semibold">Running Hybrid Vector & Full-Text Search...</p>
            <p className="text-xs text-slate-500">
              Querying PostgreSQL tsvector index and computing pgvector cosine distance...
            </p>
          </div>
        </Card>
      ) : submittedQuery && results.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <div className="flex flex-col items-center justify-center gap-3">
            <Database className="w-10 h-10 opacity-30" />
            <p className="text-lg font-semibold">No matching documents found</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              We couldn&apos;t find any invoices matching your search. Try broader terms or check that the document has completed processing.
            </p>
          </div>
        </Card>
      ) : results.length > 0 ? (
        <div className="space-y-3.5">
          {results.map((item, index) => {
            const isHybrid = item.search_type === 'hybrid';
            const isSemantic = item.search_type === 'semantic';
            const similarityPercent =
              item.semantic_similarity !== undefined && item.semantic_similarity !== null
                ? Math.round(item.semantic_similarity * 100)
                : null;

            return (
              <Card
                key={`${item.document_id}_${item.page_number || index}`}
                hoverable
                className="p-5 transition-all cursor-pointer"
                onClick={() => setSelectedDocId(item.document_id)}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left: Document & Invoice Summary */}
                  <div className="space-y-2 flex-1">
                    {/* Top Tag Pills */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Search Type Badge */}
                      {isHybrid ? (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          Hybrid Match (FTS + Vector)
                        </span>
                      ) : isSemantic ? (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-sky-400" />
                          Semantic Similarity
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Full-Text Match
                        </span>
                      )}

                      {/* RRF Score & Cosine Similarity */}
                      {item.rrf_score && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          RRF: {item.rrf_score.toFixed(4)}
                        </span>
                      )}

                      {similarityPercent !== null && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyanBrand/10 text-cyanBrand border border-cyanBrand/20">
                          {similarityPercent}% match
                        </span>
                      )}

                      {/* Needs Review Flag */}
                      {item.needs_review && (
                        <Badge variant="warning" size="sm">
                          Review Required
                        </Badge>
                      )}
                    </div>

                    {/* Title / Invoice Details */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <FileText
                        className={`w-5 h-5 flex-shrink-0 ${
                          isDark ? 'text-cyanBrand' : 'text-orangeBrand'
                        }`}
                      />
                      <div>
                        <h3 className="text-base font-bold tracking-tight hover:underline flex items-center gap-2">
                          <span>{item.supplier_name || 'Vendor Invoice'}</span>
                          {item.invoice_number && (
                            <span className="text-xs font-mono font-normal opacity-70">
                              #{item.invoice_number}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.original_filename || 'document.pdf'}{' '}
                          {item.page_number && <>&bull; Page {item.page_number}</>}
                        </p>
                      </div>
                    </div>

                    {/* Matched OCR Raw Text Snippet */}
                    {item.raw_text && (
                      <div
                        className={`p-3 rounded-xl text-xs font-mono line-clamp-2 border ${
                          isDark
                            ? 'bg-obsidian-card/60 border-obsidian-border text-slate-300'
                            : 'bg-slateGray-50 border-slateGray-200 text-slateGray-700'
                        }`}
                      >
                        {item.raw_text}
                      </div>
                    )}
                  </div>

                  {/* Right: Amount & Action */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-inherit flex-shrink-0">
                    {item.total !== undefined && item.total !== null && (
                      <div className="text-left md:text-right">
                        <p className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-slateGray-500'}`}>
                          Invoice Total
                        </p>
                        <p className="text-lg font-bold">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      icon={ChevronRight}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDocId(item.document_id);
                      }}
                    >
                      Inspect
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Empty State before search */
        <Card className="p-12 text-center text-slate-400">
          <div className="flex flex-col items-center justify-center gap-3">
            <div
              className={`p-4 rounded-2xl ${
                isDark
                  ? 'bg-cyanBrand/10 text-cyanBrand border border-cyanBrand/20'
                  : 'bg-orangeBrand/10 text-orangeBrand border border-orangeBrand/20'
              }`}
            >
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">
              Start typing to search documents
            </h3>
            <p className="text-xs text-slate-500 max-w-md">
              Enter keywords, vendor names, or natural language sentences. The engine automatically combines PostgreSQL Full-Text indexing with OpenAI vector embeddings.
            </p>
          </div>
        </Card>
      )}

      {/* Document Inspector Drawer (Slide-out) */}
      <DocumentInspectionDrawer
        documentId={selectedDocId}
        isOpen={!!selectedDocId}
        onClose={() => setSelectedDocId(null)}
        onUpdate={() => {
          if (submittedQuery) executeSearch(submittedQuery);
        }}
      />
    </div>
  );
};

export default SearchPage;

