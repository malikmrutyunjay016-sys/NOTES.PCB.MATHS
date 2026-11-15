import React, { useState, useRef, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { toCanvas } from 'html-to-image';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  FileText,
  Download,
  Plus,
  Trash2,
  FileCheck,
  Lock,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  FileUp,
} from 'lucide-react';
import { Course, Unit, WordNoteDocument, WordPageSettings } from '../types';
import { resolvePdfDataUrl } from '../lib/dataService';
import {
  downloadDataUrlFile,
  parseDataUrlToBytes,
  validatePdfBytes,
  ensurePdfFileName,
} from '../lib/pdfUtils';
import { PdfViewer } from './PdfViewer';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface WordNotesTabViewProps {
  course: Course | null;
  units: Unit[];
  wordNotes: WordNoteDocument[];
  isAdmin: boolean;
  onSaveWordNote: (note: WordNoteDocument) => Promise<void>;
  onDeleteWordNote: (noteId: string) => Promise<void>;
  userId: string;
  userName: string;
}

const UPLOADED_PDF_MARKER = '__UPLOADED_PDF__';

const DEFAULT_PAGE_SETTINGS: WordPageSettings = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: 'normal',
  lineSpacing: '1.15',
  defaultFont: 'Calibri, sans-serif',
  defaultFontSize: 12,
  headerText: '',
  footerText: '',
  watermark: '',
  showPageNumbers: true,
  showPageBorder: false,
  pageColor: '#ffffff',
};

const MARGIN_PADDING_MAP: Record<string, string> = {
  narrow: '24px',
  moderate: '36px',
  normal: '48px',
  wide: '68px',
};

function parsePageSettings(jsonStr?: string): WordPageSettings {
  if (!jsonStr) return DEFAULT_PAGE_SETTINGS;
  try {
    return { ...DEFAULT_PAGE_SETTINGS, ...JSON.parse(jsonStr) };
  } catch {
    return DEFAULT_PAGE_SETTINGS;
  }
}

interface ValidatedPdfUpload {
  dataUrl: string;
  fileName: string;
  sizeKb: number;
  pageCount: number;
}

async function readAndValidateNotePdf(file: File): Promise<ValidatedPdfUpload> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    throw new Error('Please select a valid PDF document (.pdf).');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('PDF file exceeds 10 MB limit. Please upload a smaller PDF.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve((ev.target?.result as string) || '');
    reader.onerror = () => reject(new Error('Failed to read the PDF file.'));
    reader.readAsDataURL(file);
  });

  const parsed = parseDataUrlToBytes(dataUrl, 'application/pdf');
  if (!parsed) {
    throw new Error('Could not decode the selected PDF file.');
  }

  const check = validatePdfBytes(parsed.bytes);
  if (!check.valid) {
    throw new Error(check.reason || 'The selected file is not a valid PDF.');
  }

  let pageCount = 1;
  let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
  try {
    loadingTask = pdfjsLib.getDocument({ data: parsed.bytes.slice() });
    const pdf = await loadingTask.promise;
    pageCount = Math.max(1, pdf.numPages || 1);
  } catch {
    pageCount = 1;
  } finally {
    if (loadingTask) {
      await loadingTask.destroy().catch(() => {});
    }
  }

  return {
    dataUrl,
    fileName: ensurePdfFileName(file.name, 'Notes.pdf'),
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    pageCount,
  };
}

// Legacy Word-Note sheet PDF converter (used when downloading older HTML-authored notes)
async function convertDomSheetToExactPdf(params: {
  element: HTMLElement;
  title: string;
  subject: string;
  author: string;
  keywords: string;
  pageSettings: WordPageSettings;
}): Promise<{ pdfDataUrl: string; pageCount: number }> {
  const { element, title, subject, author, keywords, pageSettings } = params;

  const formatMap: Record<string, 'a4' | 'letter' | 'legal'> = {
    A4: 'a4',
    Letter: 'letter',
    Legal: 'legal',
  };

  const doc = new jsPDF({
    orientation: pageSettings.orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: formatMap[pageSettings.pageSize] || 'a4',
  });

  doc.setProperties({
    title: title || 'Course Notes',
    subject: subject || 'Academic Notes',
    author: author || 'Course Admin',
    keywords: keywords || 'Notes',
    creator: 'Notes Studio',
  });

  const pdfPageWidthMm = doc.internal.pageSize.getWidth();
  const pdfPageHeightMm = doc.internal.pageSize.getHeight();

  const canvas = await toCanvas(element, {
    pixelRatio: 2,
    backgroundColor: pageSettings.pageColor || '#ffffff',
    cacheBust: true,
    skipFonts: true,
    fontEmbedCSS: '',
  });

  const imgWidthPx = canvas.width;
  const imgHeightPx = canvas.height;
  const pageHeightPx = Math.floor((imgWidthPx * pdfPageHeightMm) / pdfPageWidthMm);
  const totalPages = Math.max(1, Math.ceil(imgHeightPx / pageHeightPx));

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    if (pageIndex > 0) {
      doc.addPage();
    }

    const sourceY = pageIndex * pageHeightPx;
    const sliceHeightPx = Math.min(pageHeightPx, imgHeightPx - sourceY);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = imgWidthPx;
    pageCanvas.height = pageHeightPx;

    const ctx = pageCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = pageSettings.pageColor || '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        sourceY,
        imgWidthPx,
        sliceHeightPx,
        0,
        0,
        imgWidthPx,
        sliceHeightPx
      );
    }

    const sliceDataUrl = pageCanvas.toDataURL('image/jpeg', 0.92);
    doc.addImage(sliceDataUrl, 'JPEG', 0, 0, pdfPageWidthMm, pdfPageHeightMm);
  }

  return {
    pdfDataUrl: doc.output('datauristring'),
    pageCount: totalPages,
  };
}

interface ReadOnlyPdfSheetProps {
  sheetRef?: React.RefObject<HTMLDivElement | null>;
  title: string;
  subject?: string;
  author: string;
  category?: string;
  status?: string;
  comments?: string;
  pdfFileName: string;
  wordCount: number;
  version: number;
  pageCount: number;
  htmlContent: string;
  pageSettings: WordPageSettings;
}

const ReadOnlyPdfSheet: React.FC<ReadOnlyPdfSheetProps> = ({
  sheetRef,
  title,
  subject,
  author,
  category,
  status,
  comments,
  pdfFileName,
  wordCount,
  version,
  pageCount,
  htmlContent,
  pageSettings,
}) => {
  return (
    <div
      ref={sheetRef}
      style={{
        backgroundColor: pageSettings.pageColor || '#ffffff',
        padding: MARGIN_PADDING_MAP[pageSettings.margins] || '48px',
        fontFamily: pageSettings.defaultFont || 'Calibri, sans-serif',
        fontSize: `${pageSettings.defaultFontSize || 12}pt`,
        lineHeight: pageSettings.lineSpacing || '1.15',
        border: pageSettings.showPageBorder ? '2px solid #78716c' : '1px solid #d6d3d1',
      }}
      className={`bg-white rounded-xl shadow-2xl mx-auto select-none relative overflow-hidden ${
        pageSettings.orientation === 'landscape' ? 'max-w-5xl' : 'max-w-3xl'
      }`}
    >
      {pageSettings.watermark && pageSettings.watermark.trim() && (
        <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-10 z-0">
          <span className="text-5xl font-bold uppercase tracking-widest text-stone-500 -rotate-35">
            {pageSettings.watermark}
          </span>
        </div>
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 border-b border-stone-200 pb-3 mb-6">
          <span>{pageSettings.headerText || subject || title}</span>
          <span>READ-ONLY PDF VIEW • {pdfFileName}</span>
        </div>

        <div className="mb-6 pb-4 border-b border-stone-200">
          <h1 className="text-2xl font-serif font-bold text-stone-900">{title}</h1>
          {subject && <p className="text-xs text-stone-600 mt-1 font-medium">{subject}</p>}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-stone-500 font-mono">
            <span>Author: {author}</span>
            <span>•</span>
            <span>Category: {category || 'Lecture Notes'}</span>
            <span>•</span>
            <span>Status: {status || 'Published'}</span>
            <span>•</span>
            <span>Words: {wordCount}</span>
          </div>
          {comments && (
            <p className="text-xs text-stone-500 italic mt-2 bg-stone-50 p-2.5 rounded-lg border border-stone-200/80">
              {comments}
            </p>
          )}
        </div>

        <div
          className="prose prose-stone max-w-none text-stone-800 pointer-events-none min-h-[420px]"
          style={{
            fontFamily: pageSettings.defaultFont || 'Calibri, sans-serif',
            fontSize: `${pageSettings.defaultFontSize || 12}pt`,
            lineHeight: pageSettings.lineSpacing || '1.15',
          }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        <div className="mt-10 pt-3 border-t border-stone-200 flex items-center justify-between text-[11px] font-mono text-stone-400">
          <span>{pageSettings.footerText || 'Course Lecture Notes'}</span>
          <span>
            Version {version || 1}
            {pageSettings.showPageNumbers ? ` • ${pageCount || 1} Page(s)` : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

export const WordNotesTabView: React.FC<WordNotesTabViewProps> = ({
  course,
  units,
  wordNotes,
  isAdmin,
  onSaveWordNote,
  onDeleteWordNote,
  userId,
  userName,
}) => {
  const courseNotes = useMemo(() => {
    if (!course) return wordNotes;
    return wordNotes.filter((n) => n.courseId === course.id || n.courseId === 'general');
  }, [wordNotes, course]);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    courseNotes[0]?.id || null
  );

  useEffect(() => {
    if (courseNotes.length === 0) {
      setSelectedNoteId(null);
      return;
    }
    if (!selectedNoteId || !courseNotes.some((n) => n.id === selectedNoteId)) {
      setSelectedNoteId(courseNotes[0].id);
    }
  }, [courseNotes, selectedNoteId]);

  const selectedNote = useMemo(
    () => courseNotes.find((n) => n.id === selectedNoteId) || courseNotes[0] || null,
    [courseNotes, selectedNoteId]
  );

  // Admin PDF Upload Panel State
  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteCategory, setNoteCategory] = useState<string>('Lecture Notes');
  const [noteUnitId, setNoteUnitId] = useState<string>('');
  const [noteComments, setNoteComments] = useState<string>('');
  const [pendingPdf, setPendingPdf] = useState<ValidatedPdfUpload | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState<boolean>(false);
  const [isSavingPdf, setIsSavingPdf] = useState<boolean>(false);

  // Delete confirmation modal state (always confirm before deleting any file)
  const [noteToDelete, setNoteToDelete] = useState<WordNoteDocument | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState<boolean>(false);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const readOnlyViewerSheetRef = useRef<HTMLDivElement>(null);

  const handleSelectPdfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    setStatusMessage(null);
    try {
      setIsReadingPdf(true);
      const validated = await readAndValidateNotePdf(file);
      setPendingPdf(validated);
      if (!noteTitle.trim()) {
        setNoteTitle(file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim());
      }
    } catch (err: any) {
      setPendingPdf(null);
      setErrorMessage(err?.message || 'Unable to load the selected PDF.');
    } finally {
      setIsReadingPdf(false);
    }
  };

  const handleUploadNotePdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!pendingPdf) {
      setErrorMessage('Please choose a valid PDF file first.');
      return;
    }

    const finalTitle =
      noteTitle.trim() || pendingPdf.fileName.replace(/\.pdf$/i, '') || 'Course Notes';

    try {
      setIsSavingPdf(true);
      setErrorMessage(null);
      setStatusMessage(null);

      const noteId = `wordnote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const nowIso = new Date().toISOString();

      const newNote: WordNoteDocument = {
        id: noteId,
        courseId: course?.id || 'general',
        unitId: noteUnitId || undefined,
        title: finalTitle,
        subject: course ? `${course.code}: ${course.title}` : 'Academic Course Notes',
        author: userName || 'Course Admin',
        category: noteCategory.trim() || 'Lecture Notes',
        keywords: course ? `${course.code}, Notes, PDF` : 'Notes, PDF',
        status: 'Published',
        comments: noteComments.trim(),
        htmlContent: UPLOADED_PDF_MARKER,
        plainText: noteComments.trim() || finalTitle,
        pageSettingsJson: JSON.stringify(DEFAULT_PAGE_SETTINGS),
        pdfDataUrl: pendingPdf.dataUrl,
        pdfFileName: pendingPdf.fileName,
        wordCount: 0,
        charCount: 0,
        pageCount: pendingPdf.pageCount,
        version: 1,
        createdBy: userId || 'admin',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await onSaveWordNote(newNote);
      setSelectedNoteId(noteId);
      setStatusMessage(
        `Uploaded "${finalTitle}" (${pendingPdf.fileName} • ${pendingPdf.pageCount} ${
          pendingPdf.pageCount === 1 ? 'page' : 'pages'
        }).`
      );
      setNoteTitle('');
      setNoteComments('');
      setNoteUnitId('');
      setPendingPdf(null);
      setShowUploadForm(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to upload Note PDF.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleDownloadPdf = async (note: WordNoteDocument) => {
    try {
      setErrorMessage(null);
      setIsDownloadingPdf(true);
      let targetDataUrl = note.pdfDataUrl;

      const isUploadedPdf =
        note.htmlContent === UPLOADED_PDF_MARKER ||
        note.htmlContent.trim() === '';

      if (!isUploadedPdf && readOnlyViewerSheetRef.current && selectedNote?.id === note.id) {
        try {
          const noteSettings = parsePageSettings(note.pageSettingsJson);
          const exact = await convertDomSheetToExactPdf({
            element: readOnlyViewerSheetRef.current,
            title: note.title,
            subject: note.subject || '',
            author: note.author || 'Course Admin',
            keywords: note.keywords || '',
            pageSettings: noteSettings,
          });
          targetDataUrl = exact.pdfDataUrl;
        } catch {
          // fallback to stored pdfDataUrl
        }
      }

      if (!targetDataUrl) {
        setErrorMessage('No PDF data available for this note.');
        return;
      }
      targetDataUrl = await resolvePdfDataUrl('word_notes', note.id, targetDataUrl);
      if (!targetDataUrl) {
        setErrorMessage('Unable to reconstruct PDF data for download.');
        return;
      }

      const result = downloadDataUrlFile(
        note.pdfFileName || `${note.title.replace(/\s+/g, '_')}.pdf`,
        targetDataUrl,
        'application/pdf'
      );
      if (!result.ok) {
        setErrorMessage(result.error || 'Failed to download note PDF.');
      }
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-stone-900 text-stone-100 rounded-2xl border border-stone-800 p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> PDF Notes
              </span>
              {course && (
                <span className="text-xs font-mono text-stone-400">
                  {course.code} • {course.title}
                </span>
              )}
            </div>
            <h2 className="text-xl font-serif font-bold text-white mt-1">
              Course Notes (PDF Library)
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {isAdmin
                ? 'Upload, preview, download, and manage PDF study notes for this course.'
                : 'Official PDF study notes published by the course administrator.'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setShowUploadForm((prev) => !prev);
              setErrorMessage(null);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow transition-all shrink-0"
          >
            {showUploadForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showUploadForm ? 'Close Upload Form' : 'Add Note PDF'}</span>
          </button>
        )}
      </div>

      {/* Status & Error Alerts */}
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Admin Upload Note PDF Form */}
      {isAdmin && showUploadForm && (
        <form
          onSubmit={handleUploadNotePdf}
          className="bg-white rounded-2xl border border-amber-300/80 p-5 md:p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
                <FileUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900">
                  Add PDF to Notes
                </h3>
                <p className="text-[11px] text-stone-500">
                  Upload any PDF lecture note, handout, or summary (max 10 MB)
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-stone-600 mb-1.5">
                Note Title *
              </label>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g., Unit 1 Complete Lecture Notes"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:border-amber-500 focus:outline-none text-sm text-stone-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-stone-600 mb-1.5">
                Category
              </label>
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:border-amber-500 focus:outline-none text-sm text-stone-900 bg-white"
              >
                <option value="Lecture Notes">Lecture Notes</option>
                <option value="Handwritten Notes">Handwritten Notes</option>
                <option value="Revision Summary">Revision Summary</option>
                <option value="Lab Manual">Lab Manual</option>
                <option value="Formula Sheet">Formula Sheet</option>
              </select>
            </div>

            {units.length > 0 && (
              <div>
                <label className="block text-xs font-mono uppercase text-stone-600 mb-1.5">
                  Linked Unit (Optional)
                </label>
                <select
                  value={noteUnitId}
                  onChange={(e) => setNoteUnitId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:border-amber-500 focus:outline-none text-sm text-stone-900 bg-white"
                >
                  <option value="">All Units / General Course Notes</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unitNumber}: {u.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={units.length > 0 ? '' : 'md:col-span-2'}>
              <label className="block text-xs font-mono uppercase text-stone-600 mb-1.5">
                Description / Remarks (Optional)
              </label>
              <input
                type="text"
                value={noteComments}
                onChange={(e) => setNoteComments(e.target.value)}
                placeholder="Brief summary of topics covered in this PDF"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:border-amber-500 focus:outline-none text-sm text-stone-900"
              />
            </div>
          </div>

          {/* PDF Picker */}
          <div>
            <label className="block text-xs font-mono uppercase text-stone-600 mb-1.5">
              Select PDF File *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleSelectPdfFile}
              className="hidden"
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-dashed border-stone-300 bg-stone-50">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-amber-600 shrink-0" />
                {isReadingPdf ? (
                  <span className="text-xs text-stone-600 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Reading &amp; validating PDF...
                  </span>
                ) : pendingPdf ? (
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-stone-900 truncate">
                      {pendingPdf.fileName}
                    </div>
                    <div className="text-[11px] font-mono text-stone-500">
                      {pendingPdf.pageCount} {pendingPdf.pageCount === 1 ? 'page' : 'pages'} • {pendingPdf.sizeKb} KB
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-stone-500">
                    No PDF selected yet (up to 10 MB)
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={isReadingPdf || isSavingPdf}
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{pendingPdf ? 'Change PDF' : 'Choose PDF File'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
            <button
              type="button"
              disabled={isSavingPdf}
              onClick={() => {
                setShowUploadForm(false);
                setPendingPdf(null);
              }}
              className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!pendingPdf || isReadingPdf || isSavingPdf}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow disabled:opacity-50"
            >
              {isSavingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isSavingPdf ? 'Uploading PDF...' : 'Publish Note PDF'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Notes Empty State or Full-Width PDF Viewer List */}
      {courseNotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
          <FileText className="w-12 h-12 text-stone-400 mx-auto mb-3" />
          <h3 className="font-serif font-bold text-xl text-stone-800">
            No PDF Notes Published Yet
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto mt-1.5 leading-relaxed">
            {isAdmin
              ? 'Click "Add Note PDF" above to upload PDF lecture notes, handwritten notes, or summaries for students.'
              : 'The course administrator has not published any PDF lecture notes yet. Please check back soon.'}
          </p>
          {isAdmin && !showUploadForm && (
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Add First Note PDF</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {courseNotes.map((note) => {
            const isExpanded = courseNotes.length === 1 || selectedNote?.id === note.id;
            const linkedUnit = units.find((u) => u.id === note.unitId);
            const noteIsUploadedPdf = Boolean(
              note.htmlContent === UPLOADED_PDF_MARKER || !note.htmlContent?.trim()
            );
            const notePageSettings = parsePageSettings(note.pageSettingsJson);

            return (
              <div key={note.id} className="space-y-4">
                <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-mono font-bold">
                        PDF NOTE
                      </span>
                      <h3 className="font-serif font-bold text-base text-stone-900 truncate">
                        {note.title}
                      </h3>
                    </div>
                    <div className="text-xs text-stone-500 mt-1 flex flex-wrap items-center gap-2 font-mono">
                      <span>{note.pdfFileName}</span>
                      <span>•</span>
                      <span>
                        {note.pageCount || 1}{' '}
                        {note.pageCount === 1 ? 'Page' : 'Pages'}
                      </span>
                      {note.category && (
                        <>
                          <span>•</span>
                          <span>{note.category}</span>
                        </>
                      )}
                      {linkedUnit && (
                        <>
                          <span>•</span>
                          <span>Unit {linkedUnit.unitNumber}</span>
                        </>
                      )}
                      {note.comments && (
                        <>
                          <span>•</span>
                          <span className="font-sans text-stone-600">{note.comments}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {courseNotes.length > 1 && !isExpanded && (
                      <button
                        type="button"
                        onClick={() => setSelectedNoteId(note.id)}
                        className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors"
                      >
                        View PDF
                      </button>
                    )}

                    {!noteIsUploadedPdf && (
                      <button
                        type="button"
                        disabled={isDownloadingPdf}
                        onClick={() => handleDownloadPdf(note)}
                        className="px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isDownloadingPdf && isExpanded ? 'Preparing...' : 'Download'}</span>
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setNoteToDelete(note)}
                        className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete PDF</span>
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded &&
                  (noteIsUploadedPdf ? (
                    <PdfViewer
                      collectionName="word_notes"
                      docId={note.id}
                      inlineDataUrl={note.pdfDataUrl}
                      fileName={note.pdfFileName}
                      maxHeightClass="h-[680px]"
                    />
                  ) : (
                    <div className="bg-stone-800 rounded-2xl border border-stone-700 p-4 md:p-8 shadow-inner overflow-x-auto">
                      <ReadOnlyPdfSheet
                        sheetRef={readOnlyViewerSheetRef}
                        title={note.title}
                        subject={note.subject}
                        author={note.author}
                        category={note.category}
                        status={note.status}
                        comments={note.comments}
                        pdfFileName={note.pdfFileName}
                        wordCount={note.wordCount}
                        version={note.version}
                        pageCount={note.pageCount}
                        htmlContent={note.htmlContent}
                        pageSettings={notePageSettings}
                      />
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Delete Confirmation Modal */}
      {isAdmin && noteToDelete && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            if (!isDeletingNote) setNoteToDelete(null);
          }}
        >
          <div
            className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-serif font-bold text-stone-900">
                  Confirm Delete Note PDF
                </h3>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <span className="font-semibold text-stone-900 break-words">
                    {noteToDelete.title} ({noteToDelete.pdfFileName})
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                disabled={isDeletingNote}
                onClick={() => setNoteToDelete(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingNote}
                onClick={async () => {
                  try {
                    setIsDeletingNote(true);
                    await onDeleteWordNote(noteToDelete.id);
                    setStatusMessage(`Deleted "${noteToDelete.title}".`);
                    setNoteToDelete(null);
                  } finally {
                    setIsDeletingNote(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {isDeletingNote ? 'Deleting...' : 'Delete PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
