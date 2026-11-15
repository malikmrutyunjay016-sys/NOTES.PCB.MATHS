import React, { useEffect, useState } from 'react';
import {
  FileCode2,
  Download,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Eye,
  Code2,
} from 'lucide-react';
import { resolvePdfDataUrl } from '../lib/dataService';
import {
  decodeDataUrlToText,
  downloadDataUrlFile,
  dataUrlToBlobUrl,
  ensureHtmlFileName,
} from '../lib/pdfUtils';

interface HtmlDocumentViewerProps {
  collectionName: 'books' | 'questions' | 'word_notes';
  docId: string;
  inlineDataUrl?: string;
  fileName?: string;
  maxHeightClass?: string;
}

export const HtmlDocumentViewer: React.FC<HtmlDocumentViewerProps> = ({
  collectionName,
  docId,
  inlineDataUrl,
  fileName,
  maxHeightClass = 'h-[580px]',
}) => {
  const [resolvedDataUrl, setResolvedDataUrl] = useState<string>('');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const displayFileName = ensureHtmlFileName(fileName, 'Document.html');

  useEffect(() => {
    let cancelled = false;

    async function loadHtml() {
      setIsLoading(true);
      setErrorMessage(null);
      setHtmlContent('');

      try {
        const fullUrl = await resolvePdfDataUrl(collectionName, docId, inlineDataUrl);
        if (cancelled) return;

        if (!fullUrl) {
          setErrorMessage('HTML document data is empty or unavailable.');
          setIsLoading(false);
          return;
        }

        const decoded = decodeDataUrlToText(fullUrl, 'text/html');
        if (!decoded.trim()) {
          setErrorMessage('Unable to decode HTML document content.');
          setIsLoading(false);
          return;
        }

        setResolvedDataUrl(fullUrl);
        setHtmlContent(decoded);
      } catch (err: any) {
        if (!cancelled) {
          console.error('HTML render error:', err);
          setErrorMessage(err?.message || 'Failed to load this HTML document.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadHtml();

    return () => {
      cancelled = true;
    };
  }, [collectionName, docId, inlineDataUrl]);

  const handleDownload = async () => {
    setActionError(null);
    const fullUrl =
      resolvedDataUrl || (await resolvePdfDataUrl(collectionName, docId, inlineDataUrl));
    const result = downloadDataUrlFile(displayFileName, fullUrl, 'text/html');
    if (!result.ok) {
      setActionError(result.error || 'Failed to download HTML file.');
    }
  };

  const handleOpenInNewTab = async () => {
    setActionError(null);
    const fullUrl =
      resolvedDataUrl || (await resolvePdfDataUrl(collectionName, docId, inlineDataUrl));
    const blobUrl = dataUrlToBlobUrl(fullUrl, 'text/html;charset=utf-8');
    if (!blobUrl) {
      setActionError('Unable to create HTML preview link.');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };

  return (
    <div className="space-y-3 pt-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-900 text-stone-100 p-3 rounded-xl border border-stone-800">
        <div className="flex items-center gap-2 text-xs font-mono min-w-0">
          <FileCode2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate font-semibold">{displayFileName}</span>
          <span className="px-2 py-0.5 rounded bg-stone-800 text-amber-300 text-[10px] shrink-0">
            HTML Document
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {htmlContent && (
            <div className="flex items-center bg-stone-800 rounded-lg border border-stone-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-stone-700 text-white'
                    : 'text-stone-300 hover:text-white hover:bg-stone-700/60'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('source')}
                className={`px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  viewMode === 'source'
                    ? 'bg-stone-700 text-white'
                    : 'text-stone-300 hover:text-white hover:bg-stone-700/60'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>HTML Source</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1 border border-stone-700 transition-colors"
            title="Open HTML in New Browser Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open Tab</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download HTML</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Viewer Surface */}
      <div
        className={`w-full ${maxHeightClass} rounded-xl border border-stone-300 overflow-hidden shadow-inner ${
          viewMode === 'source' ? 'bg-stone-950' : 'bg-white'
        }`}
      >
        {isLoading ? (
          <div className="h-full bg-stone-900 flex flex-col items-center justify-center text-stone-300 gap-2 py-12">
            <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
            <span className="text-xs font-mono">Loading HTML document...</span>
          </div>
        ) : errorMessage ? (
          <div className="h-full bg-stone-900 flex flex-col items-center justify-center text-center max-w-md mx-auto p-6 space-y-3">
            <div className="p-3 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-stone-100">Unable to Open HTML Document</div>
            <p className="text-xs text-stone-300 leading-relaxed">{errorMessage}</p>
          </div>
        ) : viewMode === 'source' ? (
          <pre className="w-full h-full overflow-auto p-4 text-xs font-mono text-stone-100 whitespace-pre-wrap break-words leading-relaxed">
            {htmlContent}
          </pre>
        ) : (
          <iframe
            title={displayFileName}
            srcDoc={htmlContent}
            sandbox="allow-scripts"
            className="w-full h-full bg-white border-0"
          />
        )}
      </div>
    </div>
  );
};
