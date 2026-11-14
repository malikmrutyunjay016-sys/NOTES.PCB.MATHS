import React, { useState, useRef, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { toCanvas } from 'html-to-image';
import {
  FileText,
  Save,
  Download,
  Plus,
  Trash2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Table,
  Image as ImageIcon,
  Minus,
  Eye,
  Edit3,
  CheckCircle2,
  FileCheck,
  Lock,
  Search,
  ZoomIn,
  ZoomOut,
  Info,
  Highlighter,
  Palette,
  RotateCcw,
  RotateCw,
  Subscript,
  Superscript,
} from 'lucide-react';
import { Course, Unit, WordNoteDocument, WordPageSettings } from '../types';
import { resolvePdfDataUrl } from '../lib/dataService';
import { downloadDataUrlFile } from '../lib/pdfUtils';

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

const FONT_FAMILIES = [
  { label: 'Calibri (Body)', value: 'Calibri, Inter, sans-serif' },
  { label: 'Times New Roman (Academic)', value: '"Times New Roman", Times, serif' },
  { label: 'Cambria (Headings)', value: 'Cambria, Georgia, serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Consolas (Code)', value: 'Consolas, monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];

const ACADEMIC_SYMBOLS = ['∑', '∫', 'π', 'Δ', '∞', '≈', '≠', '≤', '≥', '→', '⇔', 'λ', 'θ', 'μ', 'σ', '√', '±', '∈'];

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


// Convert the exact Read-Only PDF Sheet DOM element into a multi-page PDF that is 100% visually identical
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
    creator: 'Notes Microsoft Word Studio',
  });

  const pdfPageWidthMm = doc.internal.pageSize.getWidth();
  const pdfPageHeightMm = doc.internal.pageSize.getHeight();

  // Render the exact DOM element at 2x resolution for crisp print quality
  const canvas = await toCanvas(element, {
    pixelRatio: 2,
    backgroundColor: pageSettings.pageColor || '#ffffff',
    cacheBust: true,
    skipFonts: true,
    fontEmbedCSS: '',
  });

  const imgWidthPx = canvas.width;
  const imgHeightPx = canvas.height;

  // Calculate how many canvas pixels correspond to 1 full PDF page height
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

// Reusable Exact Read-Only PDF Sheet Component (Used both for on-screen Read-Only PDF View and exact PDF conversion)
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
      {/* Diagonal Watermark Overlay */}
      {pageSettings.watermark && pageSettings.watermark.trim() && (
        <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-10 z-0">
          <span className="text-5xl font-bold uppercase tracking-widest text-stone-500 -rotate-35">
            {pageSettings.watermark}
          </span>
        </div>
      )}

      <div className="relative z-10">
        {/* Top Running Header / Read-Only PDF Header */}
        <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 border-b border-stone-200 pb-3 mb-6">
          <span>{pageSettings.headerText || subject || title}</span>
          <span>READ-ONLY PDF VIEW • {pdfFileName}</span>
        </div>

        {/* Document Title & Properties Block */}
        <div className="mb-6 pb-4 border-b border-stone-200">
          <h1 className="text-2xl font-serif font-bold text-stone-900">
            {title}
          </h1>
          {subject && (
            <p className="text-xs text-stone-600 mt-1 font-medium">{subject}</p>
          )}
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

        {/* Exact Formatted Document Body */}
        <div
          className="prose prose-stone max-w-none text-stone-800 pointer-events-none min-h-[420px]"
          style={{
            fontFamily: pageSettings.defaultFont || 'Calibri, sans-serif',
            fontSize: `${pageSettings.defaultFontSize || 12}pt`,
            lineHeight: pageSettings.lineSpacing || '1.15',
          }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {/* Bottom Running Footer */}
        <div className="mt-10 pt-3 border-t border-stone-200 flex items-center justify-between text-[11px] font-mono text-stone-400">
          <span>
            {pageSettings.footerText || 'Auto-Converted from Admin Microsoft Word Document'}
          </span>
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
  // Filter notes for current course (or all notes if no course is selected)
  const courseNotes = useMemo(() => {
    if (!course) return wordNotes;
    return wordNotes.filter((n) => n.courseId === course.id || n.courseId === 'general');
  }, [wordNotes, course]);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    courseNotes[0]?.id || null
  );

  // Admin can toggle between 'word_editor' and 'pdf_reader' preview; Users are strictly locked to 'pdf_reader'
  const [adminViewMode, setAdminViewMode] = useState<'word_editor' | 'pdf_reader'>('word_editor');
  const activeMode = isAdmin ? adminViewMode : 'pdf_reader';

  // Active Ribbon Tab in MS Word
  const [ribbonTab, setRibbonTab] = useState<
    'file' | 'home' | 'insert' | 'layout' | 'design' | 'review'
  >('home');

  // Document Properties State (MS Word Details & Properties)
  const [docTitle, setDocTitle] = useState<string>('Official Lecture Notes');
  const [docSubject, setDocSubject] = useState<string>(course ? `${course.code}: ${course.title}` : '');
  const [docAuthor, setDocAuthor] = useState<string>(userName || 'Course Admin');
  const [docCategory, setDocCategory] = useState<string>('Lecture Notes');
  const [docKeywords, setDocKeywords] = useState<string>(course ? `${course.code}, Exam Prep, Syllabus Notes` : 'Notes');
  const [docStatus, setDocStatus] = useState<'Draft' | 'Final' | 'Published' | 'Confidential'>('Published');
  const [docComments, setDocComments] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>(units[0]?.id || '');
  const [pageSettings, setPageSettings] = useState<WordPageSettings>({
    ...DEFAULT_PAGE_SETTINGS,
    headerText: course ? `${course.code} • ${course.title}` : 'Official Academic Notes',
    footerText: 'Official Course Material • Auto-Converted PDF',
  });

  // Live HTML mirror state for exact offscreen PDF capture during save
  const [liveHtmlForPdf, setLiveHtmlForPdf] = useState<string>('');

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const captureSheetRef = useRef<HTMLDivElement>(null);
  const readOnlyViewerSheetRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wordStats, setWordStats] = useState({ words: 0, chars: 0, paragraphs: 1 });

  // Find & Replace state
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  // Table insertion dimensions
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  const selectedNote = useMemo(
    () => courseNotes.find((n) => n.id === selectedNoteId) || courseNotes[0] || null,
    [courseNotes, selectedNoteId]
  );

  // Load selected note into Word Editor when selection changes
  useEffect(() => {
    if (selectedNote) {
      setDocTitle(selectedNote.title);
      setDocSubject(selectedNote.subject || '');
      setDocAuthor(selectedNote.author || userName || 'Course Admin');
      setDocCategory(selectedNote.category || 'Lecture Notes');
      setDocKeywords(selectedNote.keywords || '');
      setDocStatus((selectedNote.status as any) || 'Published');
      setDocComments(selectedNote.comments || '');
      setSelectedUnitId(selectedNote.unitId || '');
      setPageSettings(parsePageSettings(selectedNote.pageSettingsJson));
      setLiveHtmlForPdf(selectedNote.htmlContent);
      if (editorRef.current && editorRef.current.innerHTML !== selectedNote.htmlContent) {
        editorRef.current.innerHTML = selectedNote.htmlContent;
      }
      computeStats(selectedNote.plainText || '');
    } else if (editorRef.current && !editorRef.current.innerHTML.trim()) {
      const initialHtml = `<h1>${course ? `${course.code}: ${course.title}` : 'Official Course Study Notes'}</h1><p>Start typing your lecture notes here using the <strong>Microsoft Word Ribbon</strong> above. Format headings, insert tables, mathematical symbols, and customize page layout.</p><p>When you click <strong>Save &amp; Auto-Convert to PDF</strong>, this Word document is automatically converted into an exact read-only <strong>PDF</strong> for students and users.</p>`;
      editorRef.current.innerHTML = initialHtml;
      setLiveHtmlForPdf(initialHtml);
      computeStats(editorRef.current.innerText || '');
    }
  }, [selectedNote?.id]);

  const computeStats = (text: string) => {
    const clean = text.trim();
    const words = clean ? clean.split(/\s+/).length : 0;
    const chars = clean.length;
    const paragraphs = clean ? clean.split(/\n+/).filter(Boolean).length : 1;
    setWordStats({ words, chars, paragraphs });
  };

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    setLiveHtmlForPdf(editorRef.current.innerHTML);
    computeStats(editorRef.current.innerText || '');
  };

  // Execute rich text formatting command
  const execCmd = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  const handleInsertTable = () => {
    if (!editorRef.current) return;
    const r = Math.max(1, Math.min(15, tableRows));
    const c = Math.max(1, Math.min(8, tableCols));
    let html = `<table style="width:100%; border-collapse:collapse; margin:12px 0; border:1px solid #d6d3d1;"><thead><tr>`;
    for (let j = 0; j < c; j++) {
      html += `<th style="border:1px solid #d6d3d1; background:#f5f5f4; padding:8px; text-align:left; font-weight:bold;">Header ${j + 1}</th>`;
    }
    html += `</tr></thead><tbody>`;
    for (let i = 0; i < r - 1; i++) {
      html += `<tr>`;
      for (let j = 0; j < c; j++) {
        html += `<td style="border:1px solid #d6d3d1; padding:8px;">Cell ${i + 1},${j + 1}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table><p><br/></p>`;
    execCmd('insertHTML', html);
  };

  const handleInsertCalloutBox = () => {
    const html = `<blockquote style="border-left:4px solid #d97706; background:#fffbeb; padding:12px 16px; margin:12px 0; border-radius:6px;"><strong>Key Definition / Theorem:</strong> Write important theorem, formula, or exam note here...</blockquote><p><br/></p>`;
    execCmd('insertHTML', html);
  };

  const handleInsertPageBreak = () => {
    const html = `<hr style="border:none; border-top:2px dashed #a8a29e; margin:24px 0;" /><p><br/></p>`;
    execCmd('insertHTML', html);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        execCmd(
          'insertHTML',
          `<img src="${dataUrl}" alt="${file.name}" style="max-width:100%; height:auto; border-radius:8px; margin:10px 0;" /><p><br/></p>`
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFindAndReplace = () => {
    if (!findText || !editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    editorRef.current.innerHTML = currentHtml.replace(regex, replaceText);
    handleEditorInput();
  };

  const handleCreateNewDocument = () => {
    setSelectedNoteId(null);
    setDocTitle('Untitled Lecture Notes');
    setDocSubject(course ? `${course.code}: ${course.title}` : 'Academic Course Notes');
    setDocAuthor(userName || 'Course Admin');
    setDocCategory('Lecture Notes');
    setDocKeywords(course ? `${course.code}, Notes` : 'Notes');
    setDocStatus('Published');
    setDocComments('');
    const initialHtml = `<h1>Untitled Lecture Notes</h1><p>Enter structured lecture content here...</p>`;
    setLiveHtmlForPdf(initialHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml;
      computeStats(editorRef.current.innerText || '');
    }
    setSaveBanner(null);
  };

  // Save Word Document & Automatically Convert to an EXACT visual match PDF
  const handleSaveAndConvertPdf = async () => {
    if (!docTitle.trim()) {
      setErrorMessage('Please enter a Document Title before saving.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSaveBanner(null);

      const htmlContent = editorRef.current?.innerHTML || liveHtmlForPdf || `<p>${docTitle}</p>`;
      const plainText = editorRef.current?.innerText || docTitle;
      setLiveHtmlForPdf(htmlContent);

      // Wait one animation frame so the offscreen ReadOnlyPdfSheet reflects the latest HTML
      await new Promise((r) => setTimeout(r, 60));

      const cleanFileName = `${docTitle
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'Course_Notes'}.pdf`;

      let pdfDataUrl = '';
      let pageCount = 1;

      if (captureSheetRef.current) {
        const result = await convertDomSheetToExactPdf({
          element: captureSheetRef.current,
          title: docTitle.trim(),
          subject: docSubject.trim(),
          author: docAuthor.trim() || userName || 'Course Admin',
          keywords: docKeywords.trim(),
          pageSettings,
        });
        pdfDataUrl = result.pdfDataUrl;
        pageCount = result.pageCount;
      }

      const noteId =
        selectedNote?.id || `wordnote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      const noteDoc: WordNoteDocument = {
        id: noteId,
        courseId: course?.id || 'general',
        unitId: selectedUnitId || undefined,
        title: docTitle.trim(),
        subject: docSubject.trim(),
        author: docAuthor.trim() || userName || 'Course Admin',
        category: docCategory.trim(),
        keywords: docKeywords.trim(),
        status: docStatus,
        comments: docComments.trim(),
        htmlContent,
        plainText,
        pageSettingsJson: JSON.stringify(pageSettings),
        pdfDataUrl,
        pdfFileName: cleanFileName,
        wordCount: wordStats.words,
        charCount: wordStats.chars,
        pageCount,
        version: (selectedNote?.version || 0) + 1,
        createdBy: userId || 'admin',
        createdAt: selectedNote?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSaveWordNote(noteDoc);
      setSelectedNoteId(noteId);
      setSaveBanner(
        `Saved "${noteDoc.title}" (v${noteDoc.version}) and converted to an exact PDF (${cleanFileName} • ${pageCount} ${
          pageCount === 1 ? 'page' : 'pages'
        })!`
      );
    } catch (err: any) {
      console.error('Error saving Word note and converting to PDF:', err);
      setErrorMessage(err?.message || 'Failed to save and convert document to PDF.');
    } finally {
      setIsSaving(false);
    }
  };

  // Download exact PDF matching the Read-Only PDF View
  const handleDownloadPdf = async (note: WordNoteDocument) => {
    try {
      setErrorMessage(null);
      setIsDownloadingPdf(true);
      let targetDataUrl = note.pdfDataUrl;

      // If currently viewing this note in the Read-Only PDF View, capture directly from the rendered sheet so it is 100% identical
      if (readOnlyViewerSheetRef.current && selectedNote?.id === note.id) {
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

  // Export as Microsoft Word (.doc) for Admin
  const handleExportWordDoc = () => {
    const htmlContent = editorRef.current?.innerHTML || selectedNote?.htmlContent || '';
    const fullWordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${docTitle}</title></head>
      <body style="font-family:${pageSettings.defaultFont}; font-size:${pageSettings.defaultFontSize}pt;">
        ${htmlContent}
      </body>
    </html>`;
    const blob = new Blob(['\ufeff', fullWordHtml], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.replace(/\s+/g, '_') || 'Document'}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // USER / STUDENT VIEW (OR ADMIN PDF PREVIEW): ONLY SHOW THE READ-ONLY PDF
  // ============================================================================
  if (activeMode === 'pdf_reader') {
    const selectedNotePageSettings = parsePageSettings(selectedNote?.pageSettingsJson);

    return (
      <div className="space-y-6">
        {/* Top Role & Access Banner */}
        <div className="bg-stone-900 text-stone-100 rounded-2xl border border-stone-800 p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Read-Only PDF Access
                </span>
                {course && (
                  <span className="text-xs font-mono text-stone-400">
                    {course.code} • {course.title}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-serif font-bold text-white mt-1">
                Published Course Notes (Read-Only PDF)
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                {isAdmin
                  ? 'Viewing the exact Read-Only PDF that students see and download.'
                  : 'Official course notes authored by the administrator in Microsoft Word and published as read-only PDFs.'}
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => setAdminViewMode('word_editor')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow transition-all shrink-0"
            >
              <Edit3 className="w-4 h-4" />
              <span>Back to Admin MS Word Studio</span>
            </button>
          )}
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 hover:text-rose-800 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {courseNotes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
            <FileText className="w-12 h-12 text-stone-400 mx-auto mb-3" />
            <h3 className="font-serif font-bold text-xl text-stone-800">
              No PDF Notes Published Yet
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto mt-1.5 leading-relaxed">
              {isAdmin
                ? 'Switch to the Microsoft Word Studio to write course notes. Upon saving, they are automatically converted into read-only PDFs for students.'
                : 'The course administrator has not published any PDF lecture notes yet. Please check back soon.'}
            </p>
            {isAdmin && (
              <button
                onClick={() => setAdminViewMode('word_editor')}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition-all"
              >
                <Edit3 className="w-4 h-4" />
                <span>Open MS Word Editor to Create Notes</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar: List of Published PDFs */}
            <div className="lg:col-span-1 space-y-3">
              <div className="text-xs font-mono font-bold uppercase text-stone-500 px-1">
                Available PDF Notes ({courseNotes.length})
              </div>
              <div className="space-y-2.5">
                {courseNotes.map((note) => {
                  const isSelected = selectedNote?.id === note.id;
                  return (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`cursor-pointer p-4 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-stone-900 text-stone-100 border-stone-900 shadow-md'
                          : 'bg-white text-stone-800 border-stone-200 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText
                            className={`w-4 h-4 shrink-0 ${
                              isSelected ? 'text-amber-400' : 'text-rose-600'
                            }`}
                          />
                          <span className="font-semibold text-xs line-clamp-1">
                            {note.title}
                          </span>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                            isSelected
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          PDF
                        </span>
                      </div>

                      <div
                        className={`mt-2 text-[11px] font-mono flex flex-wrap items-center gap-2 ${
                          isSelected ? 'text-stone-400' : 'text-stone-500'
                        }`}
                      >
                        <span>{note.pageCount || 1} {note.pageCount === 1 ? 'Page' : 'Pages'}</span>
                        <span>•</span>
                        <span>v{note.version || 1}</span>
                        {note.category && (
                          <>
                            <span>•</span>
                            <span>{note.category}</span>
                          </>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPdf(note);
                          }}
                          disabled={isDownloadingPdf}
                          className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            isSelected
                              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isDownloadingPdf && isSelected ? 'Preparing PDF...' : 'Download PDF'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Area: ONLY the Read-Only PDF View */}
            {selectedNote && (
              <div className="lg:col-span-3 space-y-4">
                {/* PDF Action Header Bar */}
                <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-mono font-bold">
                      READ-ONLY PDF
                    </span>
                    <span className="text-xs font-mono text-stone-600 font-semibold">
                      {selectedNote.pdfFileName}
                    </span>
                    <span className="text-xs font-mono text-stone-400">
                      • {selectedNote.pageCount || 1} {selectedNote.pageCount === 1 ? 'Page' : 'Pages'} • v{selectedNote.version || 1}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDownloadPdf(selectedNote)}
                    disabled={isDownloadingPdf}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-all disabled:opacity-50 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {isDownloadingPdf
                        ? 'Generating Exact PDF...'
                        : `Download Exact PDF (${selectedNote.pdfFileName})`}
                    </span>
                  </button>
                </div>

                {/* ONLY the Read-Only PDF Sheet */}
                <div className="bg-stone-800 rounded-2xl border border-stone-700 p-4 md:p-8 shadow-inner overflow-x-auto">
                  <ReadOnlyPdfSheet
                    sheetRef={readOnlyViewerSheetRef}
                    title={selectedNote.title}
                    subject={selectedNote.subject}
                    author={selectedNote.author}
                    category={selectedNote.category}
                    status={selectedNote.status}
                    comments={selectedNote.comments}
                    pdfFileName={selectedNote.pdfFileName}
                    wordCount={selectedNote.wordCount}
                    version={selectedNote.version}
                    pageCount={selectedNote.pageCount}
                    htmlContent={selectedNote.htmlContent}
                    pageSettings={selectedNotePageSettings}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // ADMIN-ONLY MICROSOFT WORD STUDIO & DOCUMENT PROPERTIES
  // ============================================================================
  const cleanPreviewFileName = `${docTitle
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Course_Notes'}.pdf`;

  return <div className="space-y-4" />;
};
