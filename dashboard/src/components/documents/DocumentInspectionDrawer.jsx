import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Save,
  RotateCcw,
  Clock,
  Sparkles,
  DollarSign,
  AlertCircle,
  FileCode,
  Layers,
} from 'lucide-react';
import { documentApi } from '../../api/apiClient';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Input } from '../common/Input';


export const DocumentInspectionDrawer = ({ documentId, isOpen, onClose, onUpdated }) => {
  const { isDark } = useTheme();

  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('invoice'); // 'invoice' | 'lineItems' | 'validation' | 'rawText' | 'history'
  const [selectedInvoiceIdx, setSelectedInvoiceIdx] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form state for human corrections
  const [formState, setFormState] = useState({
    invoice_number: '',
    invoice_date: '',
    supplier_name: '',
    customer_name: '',
    subtotal: '',
    tax: '',
    total: '',
  });

  // Helper to format ISO timestamp or date strings to YYYY-MM-DD for HTML5 
  const formatDateValue = (val) => {
    if (!val) return '';
    return String(val).split('T')[0];
  };

  // Helper to load specific invoice metadata into formState
  const loadInvoiceIntoForm = useCallback((inv) => {
    if (!inv) return;
    setFormState({
      invoice_number: inv.invoice_number || '',
      invoice_date: formatDateValue(inv.invoice_date),
      supplier_name: inv.supplier_name || '',
      customer_name: inv.customer_name || '',
      subtotal: inv.subtotal !== null && inv.subtotal !== undefined ? String(inv.subtotal) : '',
      tax: inv.tax !== null && inv.tax !== undefined ? String(inv.tax) : '',
      total: inv.total !== null && inv.total !== undefined ? String(inv.total) : '',
    });
  }, []);

  const fetchDetails = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await documentApi.getResults(documentId);
      if (res.success && res.data) {
        setDocData(res.data);
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen) {
      setSelectedInvoiceIdx(0);
      fetchDetails();
      setIsEditing(false);
    }
  }, [isOpen, documentId, fetchDetails]);

  // Multi-invoice list and selected invoice calculation
  const invoicesList = (docData?.invoices && docData.invoices.length > 0)
    ? docData.invoices
    : (docData?.invoice ? [docData.invoice] : []);
  const currentInvoice = invoicesList[selectedInvoiceIdx] || docData?.invoice || null;
  const validationErrors = docData?.validation_errors || [];
  const lineItems = currentInvoice?.line_items || [];
  const history = docData?.processing_history || [];
  const pages = docData?.extracted_pages || [];

  // Synchronize form state whenever selected invoice index or document data changes
  useEffect(() => {
    if (!docData) return;
    const invList = (docData.invoices && docData.invoices.length > 0)
      ? docData.invoices
      : (docData.invoice ? [docData.invoice] : []);
    const validIdx = Math.min(selectedInvoiceIdx, Math.max(0, invList.length - 1));
    const activeInv = invList[validIdx] || docData.invoice || null;
    if (activeInv) {
      loadInvoiceIntoForm(activeInv);
    }
  }, [selectedInvoiceIdx, docData, loadInvoiceIntoForm]);

  if (!isOpen) return null;

  const handleSelectInvoice = (idx) => {
    setSelectedInvoiceIdx(idx);
    setIsEditing(false);
  };

  const handleInputChange = (e) => {
    setFormState((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSaveCorrections = async () => {
    setIsSaving(true);
    setNotification(null);
    try {
      const payload = {
        invoice_id: currentInvoice?.id || undefined,
        invoice_number: formState.invoice_number || null,
        invoice_date: formState.invoice_date || null,
        supplier_name: formState.supplier_name || null,
        customer_name: formState.customer_name || null,
        subtotal: formState.subtotal ? parseFloat(formState.subtotal) : null,
        tax: formState.tax ? parseFloat(formState.tax) : null,
        total: formState.total ? parseFloat(formState.total) : null,
      };

      const res = await documentApi.applyCorrections(documentId, payload);
      if (res.success) {
        setNotification({ type: 'success', message: 'Corrections applied and saved!' });
        setIsEditing(false);
        await fetchDetails();
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.message || 'Failed to save corrections' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      await documentApi.reprocess(documentId);
      setNotification({ type: 'success', message: 'Document re-processing queued!' });
      setTimeout(() => {
        setIsReprocessing(false);
        fetchDetails();
        if (onUpdated) onUpdated();
      }, 1500);
    } catch (err) {
      setNotification({ type: 'error', message: err.message || 'Reprocessing failed' });
      setIsReprocessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div
        className={`w-full max-w-2xl h-full flex flex-col shadow-2xl transition-all duration-300 ${
          isDark
            ? 'bg-obsidian-surface border-l border-obsidian-border text-slate-100'
            : 'bg-white border-l border-warm-border text-warm-text'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-inherit flex items-center justify-between">
          <div className="flex items-center gap-3 truncate">
            <div
              className={`p-2.5 rounded-xl ${
                isDark ? 'bg-cyanBrand/10 text-cyanBrand' : 'bg-orangeBrand/10 text-orangeBrand'
              }`}
            >
              <FileText className="w-6 h-6" />
            </div>
            <div className="truncate">
              <h2 className="text-base font-bold truncate">
                {docData?.original_filename || 'Document Inspection'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge status={docData?.needs_review ? 'needs_review' : docData?.status} size="sm" />
                {currentInvoice?.confidence_score && (
                  <span className="text-[11px] opacity-60 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyanBrand" />
                    AI Confidence: {(parseFloat(currentInvoice.confidence_score) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={handleReprocess}
              isLoading={isReprocessing}
              title="Reprocess through OCR & AI pipeline"
            >
              Reprocess
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center gap-2 border ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-inherit overflow-x-auto text-xs font-semibold">
          {[
            {
              id: 'invoice',
              label: invoicesList.length > 1 ? `Invoices (${invoicesList.length})` : 'Structured Invoice',
            },
            { id: 'lineItems', label: `Line Items (${lineItems.length})` },
            { id: 'validation', label: `Audit Findings (${validationErrors.length})` },
            { id: 'rawText', label: `Extracted Text (${pages.length}p)` },
            { id: 'history', label: 'Processing Logs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? isDark
                    ? 'border-cyanBrand text-cyanBrand'
                    : 'border-orangeBrand text-orangeBrand'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center opacity-60 text-sm">Loading document details...</div>
          ) : (
            <>
              {/* Multi-Invoice Batch Selector (Rendered whenever multiple invoices exist) */}
              {invoicesList.length > 1 && (
                <div
                  className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-colors ${
                    isDark
                      ? 'bg-obsidian-card/70 border-obsidian-border'
                      : 'bg-slateGray-50 border-warm-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyanBrand" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Multi-Invoice Batch ({invoicesList.length} Invoices Found)
                      </span>
                    </div>
                    <span className="text-[11px] opacity-60">
                      Click an invoice to view its items & details
                    </span>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    {invoicesList.map((inv, idx) => (
                      <button
                        key={inv.id || idx}
                        type="button"
                        onClick={() => handleSelectInvoice(idx)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0 flex flex-col text-left border cursor-pointer ${
                          selectedInvoiceIdx === idx
                            ? isDark
                              ? 'bg-cyanBrand/15 border-cyanBrand text-cyanBrand font-bold shadow-sm ring-1 ring-cyanBrand'
                              : 'bg-orangeBrand/15 border-orangeBrand text-orangeBrand font-bold shadow-sm ring-1 ring-orangeBrand'
                            : isDark
                            ? 'bg-obsidian-surface border-obsidian-border/50 text-slate-300 hover:border-slate-500'
                            : 'bg-white border-warm-border/60 text-slateGray-700 hover:border-slate-400'
                        }`}
                      >
                        <span className="truncate max-w-[150px]">
                          {inv.invoice_number || `Invoice #${idx + 1}`}
                        </span>
                        <span className="text-[10px] opacity-70">
                          {inv.supplier_name || 'Vendor N/A'} • ${inv.total ? Number(inv.total).toFixed(2) : '0.00'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 1 Structured Invoice */}
              {activeTab === 'invoice' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      Invoice Metadata {invoicesList.length > 1 ? `(${currentInvoice?.invoice_number || `#${selectedInvoiceIdx + 1}`})` : ''}
                    </h3>
                    <Button
                      variant={isEditing ? 'ghost' : 'outline'}
                      size="sm"
                      icon={isEditing ? X : Edit3}
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? 'Cancel Editing' : 'Manual Correction'}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Invoice Number"
                      name="invoice_number"
                      value={formState.invoice_number}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                    <Input
                      label="Invoice Date"
                      name="invoice_date"
                      type="date"
                      value={formatDateValue(formState.invoice_date)}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                    <Input
                      label="Supplier / Vendor"
                      name="supplier_name"
                      value={formState.supplier_name}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                    <Input
                      label="Customer Name"
                      name="customer_name"
                      value={formState.customer_name}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                    <Input
                      label="Subtotal Amount"
                      name="subtotal"
                      type="number"
                      step="0.01"
                      value={formState.subtotal}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                    <Input
                      label="Tax Amount"
                      name="tax"
                      type="number"
                      step="0.01"
                      value={formState.tax}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>

                  <Input
                    label="Grand Total Amount"
                    name="total"
                    type="number"
                    step="0.01"
                    value={formState.total}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                  />

                  {isEditing && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        variant="primary"
                        icon={Save}
                        onClick={handleSaveCorrections}
                        isLoading={isSaving}
                      >
                        Save Human Corrections
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2 Line Items */}
              {activeTab === 'lineItems' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">
                      Line Items {invoicesList.length > 1 ? `for ${currentInvoice?.invoice_number || `Invoice #${selectedInvoiceIdx + 1}`}` : ''}
                    </h3>
                    {invoicesList.length > 1 && (
                      <span className="text-xs opacity-60">
                        {currentInvoice?.supplier_name || ''}
                      </span>
                    )}
                  </div>
                  {lineItems.length === 0 ? (
                    <p className="text-xs opacity-60">No line items extracted for this invoice.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-inherit">
                      <table className="w-full text-left text-xs">
                        <thead className={`border-b ${isDark ? 'bg-obsidian-card text-slate-400' : 'bg-slateGray-100 text-slateGray-600'}`}>
                          <tr>
                            <th className="py-2.5 px-3">Description</th>
                            <th className="py-2.5 px-3">Qty</th>
                            <th className="py-2.5 px-3">Unit Price</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-inherit">
                          {lineItems.map((item, idx) => (
                            <tr key={idx}>
                              <td className="py-2.5 px-3 font-medium">{item.description}</td>
                              <td className="py-2.5 px-3">{parseFloat(item.quantity).toFixed(0)}</td>
                              <td className="py-2.5 px-3">${parseFloat(item.unit_price).toFixed(2)}</td>
                              <td className="py-2.5 px-3 font-bold text-right">${parseFloat(item.total_amount).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3 Validation Findings */}
              {activeTab === 'validation' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Audit Findings & Financial Rules
                  </h3>
                  {validationErrors.length === 0 ? (
                    <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>All financial math checks passed! Subtotal + Tax = Total.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {validationErrors.map((err, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs flex items-start gap-2.5"
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">{err.field_name}: {err.error_type}</p>
                            <p className="opacity-90 mt-0.5">{err.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4 Raw OCR Text */}
              {activeTab === 'rawText' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <FileCode className="w-4 h-4 opacity-70" />
                    OCR Extracted Text per Page
                  </h3>
                  <div className="space-y-3">
                    {pages.map((p) => (
                      <div key={p.id} className="rounded-xl border border-inherit p-3">
                        <span className="text-[10px] font-bold uppercase opacity-50 block mb-1">
                          Page {p.page_number}
                        </span>
                        <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed opacity-90 max-h-60 overflow-y-auto">
                          {p.raw_text}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5 Processing Logs */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Clock className="w-4 h-4 opacity-70" />
                    Pipeline Audit Trail
                  </h3>
                  <div className="space-y-2">
                    {history.map((hist) => (
                      <div
                        key={hist.id}
                        className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                          isDark ? 'border-obsidian-border bg-obsidian-card/40' : 'border-warm-border bg-slateGray-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold uppercase tracking-wider text-[10px]">
                              {hist.stage}
                            </span>
                            <Badge status={hist.status} size="sm" dot={false} />
                          </div>
                          <p className="opacity-80 mt-1">{hist.message}</p>
                        </div>
                        <span className="text-[10px] opacity-50 shrink-0">
                          {hist.duration_ms ? `${hist.duration_ms}ms` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentInspectionDrawer;


