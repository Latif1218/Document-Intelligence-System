import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Files,
  UploadCloud,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { documentApi } from '../../api/apiClient';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { FileUploadModal } from '../../components/documents/FileUploadModal';
import { DocumentInspectionDrawer } from '../../components/documents/DocumentInspectionDrawer';

export const DocumentsPage = () => {
  const { isDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal & Drawer State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(() => searchParams.get('selected') || null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 12 };
      if (statusFilter) params.status = statusFilter;

      const response = await documentApi.list(params);
      if (response.success && response.data) {
        setDocuments(response.data);
        if (response.meta) {
          setTotalPages(response.meta.totalPages || 1);
          setTotalCount(response.meta.total || response.data.length);
        }
      }
    } catch {
      // Handle error gracefully
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Sync selected doc with search params
  const handleSelectDoc = (id) => {
    setSelectedDocId(id);
    if (id) {
      setSearchParams({ selected: id });
    } else {
      setSearchParams({});
    }
  };

  // Local filter for search term
  const filteredDocuments = documents.filter((doc) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      doc.original_filename?.toLowerCase().includes(term) ||
      doc.invoice_number?.toLowerCase().includes(term) ||
      doc.supplier_name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents Hub</h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
            Manage multi-format documents, view extracted invoices, and audit validation anomalies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            icon={RefreshCw}
            onClick={fetchDocuments}
            isLoading={loading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={UploadCloud}
            onClick={() => setIsUploadModalOpen(true)}
          >
            Upload Invoices
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="!p-4">
        <div className="flex flex-col md:flex-row items-center gap-3 justify-between">
          {/* Search Input */}
          <div className="w-full md:w-80">
            <Input
              icon={Search}
              placeholder="Search by filename, invoice #, supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="!mb-0"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { id: '', label: 'All Statuses' },
              { id: 'completed', label: 'Verified' },
              { id: 'flagged', label: 'Needs Review' },
              { id: 'processing', label: 'Processing' },
              { id: 'queued', label: 'Queued' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setStatusFilter(f.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === f.id
                    ? isDark
                      ? 'bg-cyanBrand/20 text-cyanBrand border border-cyanBrand/30'
                      : 'bg-orangeBrand/20 text-orangeBrand border border-orangeBrand/30'
                    : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-slateGray-600 hover:text-slateGray-900 hover:bg-slateGray-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Documents Table View */}
      <Card>
        {loading ? (
          <div className="py-20 text-center opacity-60 text-sm">Loading documents...</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Files className="w-12 h-12 mx-auto opacity-30" />
            <h3 className="text-base font-semibold">No documents found</h3>
            <p className={`text-xs max-w-sm mx-auto ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
              {statusFilter || searchTerm
                ? 'Try adjusting your search criteria or status filter.'
                : 'Upload your first invoice PDF, scanned image, or spreadsheet to begin.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              icon={UploadCloud}
              onClick={() => setIsUploadModalOpen(true)}
            >
              Upload Invoices
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 -my-5">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead
                className={`border-b ${
                  isDark
                    ? 'border-obsidian-border bg-obsidian-card/40 text-slate-400'
                    : 'border-warm-border bg-slateGray-50 text-slateGray-600'
                }`}
              >
                <tr>
                  <th className="py-3 px-5 font-semibold">Document</th>
                  <th className="py-3 px-5 font-semibold">Invoice #</th>
                  <th className="py-3 px-5 font-semibold">Supplier</th>
                  <th className="py-3 px-5 font-semibold">Total Amount</th>
                  <th className="py-3 px-5 font-semibold">Client Organization</th>
                  <th className="py-3 px-5 font-semibold">Status</th>
                  <th className="py-3 px-5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {filteredDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slateGray-50'
                    }`}
                    onClick={() => handleSelectDoc(doc.id)}
                  >
                    <td className="py-3 px-5 font-medium">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-1.5 rounded-lg ${
                            isDark ? 'bg-cyanBrand/10 text-cyanBrand' : 'bg-orangeBrand/10 text-orangeBrand'
                          }`}
                        >
                          <Files className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold truncate max-w-[220px]" title={doc.original_filename}>
                            {doc.original_filename}
                          </p>
                          <p className="text-[10px] opacity-50 uppercase">
                            {doc.file_type?.split('/')[1] || 'FILE'} • {(doc.file_size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 font-mono text-[11px] opacity-80">
                      {doc.invoice_number || '—'}
                    </td>
                    <td className="py-3 px-5 opacity-90 truncate max-w-[160px]">
                      {doc.supplier_name || '—'}
                    </td>
                    <td className="py-3 px-5 font-bold">
                      {doc.invoice_total ? `$${parseFloat(doc.invoice_total).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-5 text-xs opacity-75">
                      {doc.client_name || 'Platform Default'}
                    </td>
                    <td className="py-3 px-5">
                      <Badge
                        status={doc.needs_review ? 'needs_review' : doc.status}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => handleSelectDoc(doc.id)}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-inherit pt-4 mt-5 text-xs">
            <span className="opacity-60">
              Showing page {page} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronRight}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Upload Modal Component */}
      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          fetchDocuments();
        }}
      />

      {/* Document Details & Corrections Drawer */}
      <DocumentInspectionDrawer
        documentId={selectedDocId}
        isOpen={!!selectedDocId}
        onClose={() => handleSelectDoc(null)}
        onUpdated={() => {
          fetchDocuments();
        }}
      />
    </div>
  );
};

export default DocumentsPage;

