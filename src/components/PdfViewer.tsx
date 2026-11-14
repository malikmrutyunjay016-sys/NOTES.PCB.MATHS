import React, { useEffect, useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { resolvePdfDataUrl } from '../lib/dataService';
import {
  parseDataUrlToBytes,
  validatePdfBytes,
  downloadDataUrlFile,
  dataUrlToBlobUrl,
  ensurePdfFileName,
} from '../lib/pdfUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  collectionName: 'books' | 'questions' | 'word_notes';
  docId: string;
  inlineDataUrl?: string;
  fileName?: string;
  maxHeightClass?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  collectionName,
  docId,
  inlineDataUrl,
  fileName,
  maxHeightClass = 'h-[580px]',
}) => {
  const [resolvedDataUrl, setResolvedDataUrl] = useState<string>('');
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.25);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayFileName = ensurePdfFileName(fileName, 'Document.pdf');

  // 1. Resolve full data URL (reassembling chunks if needed) and load PDF document
  useEffect(() => {
    let cancelled = false;
    let activeTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    async function loadPdf() {
      setIsLoading(true);
      setErrorMessage(null);
      setPdfDoc(null);
      setNumPages(0);

      try {
        const fullUrl = await resolvePdfDataUrl(collectionName, docId, inlineDataUrl);
        if (cancelled) return;

        if (!fullUrl) {
          setErrorMessage('PDF data is empty or unavailable.');
          setIsLoading(false);
          return;
        }

        setResolvedDataUrl(fullUrl);

        const parsed = parseDataUrlToBytes(fullUrl, 'application/pdf');
        if (!parsed) {
          setErrorMessage('Unable to decode PDF binary data.');
          setIsLoading(false);
          return;
        }

        const validation = validatePdfBytes(parsed.bytes);
        if (!validation.valid) {
          setErrorMessage(validation.reason || 'This PDF file is corrupted or unsupported.');
          setIsLoading(false);
          return;
        }

        // Pass a fresh copy of the byte buffer because PDF.js transfers ownership to its Web Worker
        const loadingTask = pdfjsLib.getDocument({
          data: parsed.bytes.slice(),
        });
        activeTask = loadingTask;
        const loadedPdf = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy().catch(() => {});
          return;
        }
        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);
      } catch (err: any) {
        if (!cancelled) {
          console.error('PDF render error:', err);
          setErrorMessage(
            err?.message ||
              'Failed to open this PDF. If it was uploaded before the storage fix, please delete and re-upload it.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (activeTask) {
        activeTask.destroy().catch(() => {});
      }
    };
  }, [collectionName, docId, inlineDataUrl]);

  // 2. Render all pages onto high-DPI canvases inside containerRef
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;
    container.innerHTML = '';

    async function renderAllPages() {
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);

      for (let pageNum = 1; pageNum <= pdfDoc!.numPages; pageNum++) {
        if (cancelled) return;
        const page = await pdfDoc!.getPage(pageNum);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const wrapper = document.createElement('div');
        wrapper.className = 'mb-4 last:mb-0 bg-white rounded-lg shadow-lg overflow-hidden mx-auto';
        wrapper.style.width = `${Math.floor(viewport.width)}px`;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.style.display = 'block';

        const pageLabel = document.createElement('div');
        pageLabel.className =
          'bg-stone-100 border-t border-stone-200 px-3 py-1 text-[10px] font-mono text-stone-500 text-right';
        pageLabel.textContent = `Page ${pageNum} of ${pdfDoc!.numPages}`;

        wrapper.appendChild(canvas);
        wrapper.appendChild(pageLabel);
        container.appendChild(wrapper);

        if (ctx) {
          const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
          await page.render({
            canvasContext: ctx,
            viewport,
            transform,
            canvas,
          } as any).promise;
        }
      }
    }

    renderAllPages().catch((err) => {
      if (!cancelled) {
        console.error('Error rendering PDF pages:', err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, scale]);

  const handleDownload = async () => {
    setDownloadError(null);
    const fullUrl =
      resolvedDataUrl || (await resolvePdfDataUrl(collectionName, docId, inlineDataUrl));
    const result = downloadDataUrlFile(displayFileName, fullUrl, 'application/pdf');
    if (!result.ok) {
      setDownloadError(result.error || 'Failed to download PDF.');
    }
  };

  const handleOpenInNewTab = async () => {
    setDownloadError(null);
    const fullUrl =
      resolvedDataUrl || (await resolvePdfDataUrl(collectionName, docId, inlineDataUrl));
    const blobUrl = dataUrlToBlobUrl(fullUrl, 'application/pdf');
    if (!blobUrl) {
      setDownloadError('Unable to create PDF preview link.');
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
          <FileText className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate font-semibold">{displayFileName}</span>
          {numPages > 0 && (
            <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 text-[10px] shrink-0">
              {numPages} {numPages === 1 ? 'page' : 'pages'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {numPages > 0 && (
            <div className="flex items-center bg-stone-800 rounded-lg border border-stone-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(2))))}
                className="p-1.5 text-stone-300 hover:text-white hover:bg-stone-700 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-[11px] font-mono text-stone-300">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.2).toFixed(2))))}
                className="p-1.5 text-stone-300 hover:text-white hover:bg-stone-700 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1 border border-stone-700 transition-colors"
            title="Open PDF in New Browser Tab"
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
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {downloadError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Viewer Surface */}
      <div
        className={`w-full ${maxHeightClass} bg-stone-800 rounded-xl border border-stone-700 overflow-auto p-4 shadow-inner`}
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-300 gap-2 py-12">
            <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
            <span className="text-xs font-mono">Loading & rendering PDF pages...</span>
          </div>
        ) : errorMessage ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12 space-y-3">
            <div className="p-3 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-stone-100">Unable to Open PDF</div>
            <p className="text-xs text-stone-300 leading-relaxed">{errorMessage}</p>
          </div>
        ) : (
          <div ref={containerRef} className="min-w-fit flex flex-col items-center" />
        )}
      </div>
    </div>
  );
};
