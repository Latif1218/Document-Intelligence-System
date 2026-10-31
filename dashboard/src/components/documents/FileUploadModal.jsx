import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Radio,
} from 'lucide-react';
import { documentApi } from '../../api/apiClient';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../common/Button';


export const FileUploadModal = ({ isOpen, onClose, onSuccess }) => {
  const { isDark } = useTheme();
  const fileInputRef = useRef(null);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles) => {
    setErrorMessage('');
    // Allowed extensions check
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.xlsx', '.xls', '.csv'];
    const valid = newFiles.filter((f) => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      return allowed.includes(ext);
    });

    if (valid.length !== newFiles.length) {
      setErrorMessage('Some files were ignored. Only PDF, Images, Excel, and CSV are supported.');
    }

    setSelectedFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setStatusMessage('Uploading files to secure S3 storage...');
    setErrorMessage('');

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await documentApi.upload(formData, (percent) => {
        setUploadProgress(percent);
        if (percent === 100) {
          setStatusMessage('Files stored in S3. Dispatching BullMQ pipeline...');
        }
      });

      if (response.success && response.data) {
        setStatusMessage('Documents queued successfully! Worker is processing...');
        setTimeout(() => {
          setSelectedFiles([]);
          setIsUploading(false);
          if (onSuccess) onSuccess(response.data);
          onClose();
        }, 1200);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Upload failed. Please check network connection.');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div
        className={`w-full max-w-lg rounded-2xl p-6 border shadow-2xl relative transition-all duration-200 ${
          isDark
            ? 'bg-obsidian-surface border-obsidian-border text-slate-100 shadow-soft-float'
            : 'bg-white border-warm-border text-warm-text shadow-warm-card'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-inherit">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                isDark ? 'bg-cyanBrand/10 text-cyanBrand' : 'bg-orangeBrand/10 text-orangeBrand'
              }`}
            >
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Upload Documents</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
                Supports multi-page PDF, Image scans, Excel & CSV
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Drag and Drop Box */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? isDark
                ? 'border-cyanBrand bg-cyanBrand/5'
                : 'border-orangeBrand bg-orangeBrand/5'
              : isDark
              ? 'border-obsidian-border hover:border-slate-600 bg-obsidian-card/40'
              : 'border-warm-border hover:border-slateGray-300 bg-slateGray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <UploadCloud
            className={`w-10 h-10 mx-auto mb-2 ${
              isDragging
                ? isDark
                  ? 'text-cyanBrand'
                  : 'text-orangeBrand'
                : 'opacity-40'
            }`}
          />
          <p className="text-sm font-semibold">
            Click to browse or drag and drop documents
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-warm-muted'}`}>
            PDF, JPG, PNG, TIFF, XLSX, XLS, CSV (Max 50MB per file)
          </p>
        </div>

        {/* Selected Files Preview List */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 max-h-40 overflow-y-auto space-y-2 pr-1">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2.5 rounded-xl text-xs border ${
                  isDark
                    ? 'bg-obsidian-card/60 border-obsidian-border'
                    : 'bg-slateGray-50 border-warm-border'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className={`w-4 h-4 shrink-0 ${isDark ? 'text-cyanBrand' : 'text-orangeBrand'}`} />
                  <span className="font-medium truncate">{file.name}</span>
                  <span className="opacity-50 text-[10px]">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>

                {!isUploading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="text-rose-500 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {statusMessage}
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden bg-slate-700/30">
              <div
                className={`h-full transition-all duration-300 ${
                  isDark ? 'bg-gradient-cyan-indigo' : 'bg-gradient-orange-warm'
                }`}
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-inherit pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={UploadCloud}
            onClick={handleUpload}
            isLoading={isUploading}
            disabled={selectedFiles.length === 0}
          >
            Start Ingestion ({selectedFiles.length})
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FileUploadModal;

