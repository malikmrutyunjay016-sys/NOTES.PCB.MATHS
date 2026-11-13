import React, { useState, useRef, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
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
  Link as LinkIcon,
  Minus,
  Type,
  Sliders,
  Eye,
  Edit3,
  CheckCircle2,
  FileCheck,
  Lock,
  Sparkles,
  Search,
  ZoomIn,
  ZoomOut,
  Printer,
  ShieldCheck,
  Info,
  FolderOpen,
  Highlighter,
  Palette,
  RotateCcw,
  RotateCw,
  Subscript,
  Superscript,
} from 'lucide-react';
import { Course, Unit, WordNoteDocument, WordPageSettings } from '../types';

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

// Helper to convert a base64 data URL (`data:application/pdf;base64,...`) into an Object URL for fast iframe/download
function dataUrlToBlobUrl(dataUrl: string): string {
  try {
    if (!dataUrl || !dataUrl.startsWith('data:')) return '';
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return '';
  }
}

// Convert HTML structure & Microsoft Word Document Properties into a multi-page PDF data URL
function generatePdfFromWordDocument(params: {
  title: string;
  subject: string;
  author: string;
  category: string;
  keywords: string;
  status: string;
  comments: string;
  courseCode: string;
  courseTitle: string;
  htmlContent: string;
  pageSettings: WordPageSettings;
}): { pdfDataUrl: string; pageCount: number } {
  const {
    title,
    subject,
    author,
    category,
    keywords,
    status,
    comments,
    courseCode,
    courseTitle,
    htmlContent,
    pageSettings,
  } = params;

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

  // Set official PDF document properties (Microsoft Word -> PDF Metadata)
  doc.setProperties({
    title: title || 'Course Notes',
    subject: subject || `${courseCode} - ${courseTitle}`,
    author: author || 'Course Admin',
    keywords: keywords || `${courseCode}, ${category}`,
    creator: 'Notes Microsoft Word Studio (Auto-PDF Converter)',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginMap: Record<string, number> = {
    narrow: 12.7,
    moderate: 19.05,
    normal: 25.4,
    wide: 35.0,
  };
  const margin = marginMap[pageSettings.margins] || 20;
  const contentWidth = pageWidth - margin * 2;

  const lineSpacingMultiplier = parseFloat(pageSettings.lineSpacing || '1.15') || 1.15;

  // Choose base jsPDF font family
  const pdfFont = pageSettings.defaultFont.toLowerCase().includes('times') ||
    pageSettings.defaultFont.toLowerCase().includes('georgia') ||
    pageSettings.defaultFont.toLowerCase().includes('cambria')
    ? 'times'
    : pageSettings.defaultFont.toLowerCase().includes('consolas') ||
      pageSettings.defaultFont.toLowerCase().includes('courier')
    ? 'courier'
    : 'helvetica';

  let cursorY = margin + 8;

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > pageHeight - margin - 10) {
      doc.addPage();
      cursorY = margin + 8;
    }
  };

  // Document Header Banner inside Page 1
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(28, 25, 23);
  const titleLines = doc.splitTextToSize(title || 'Untitled Note Document', contentWidth);
  doc.text(titleLines, margin, cursorY);
  cursorY += titleLines.length * 7.5;

  if (subject || category || status) {
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 95, 90);
    const metaLine = [
      courseCode ? `${courseCode}: ${courseTitle}` : '',
      subject ? `Subject: ${subject}` : '',
      category ? `Category: ${category}` : '',
      author ? `Author: ${author}` : '',
      status ? `Status: ${status}` : '',
    ]
      .filter(Boolean)
      .join('  •  ');
    const splitMeta = doc.splitTextToSize(metaLine, contentWidth);
    doc.text(splitMeta, margin, cursorY);
    cursorY += splitMeta.length * 4.5 + 2;
  }

  if (comments) {
    doc.setFont(pdfFont, 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    const splitComments = doc.splitTextToSize(`Abstract / Notes: ${comments}`, contentWidth);
    doc.text(splitComments, margin, cursorY);
    cursorY += splitComments.length * 4.2 + 2;
  }

  // Divider line under document metadata
  doc.setDrawColor(214, 211, 209);
  doc.setLineWidth(0.4);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 7;

  // Parse HTML content into blocks for accurate PDF layout
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent || '<p></p>';

  const renderElementNode = (node: Node, listPrefix?: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(pageSettings.defaultFontSize || 11);
      doc.setTextColor(28, 25, 23);
      const lines = doc.splitTextToSize(text, contentWidth);
      const lineHeight = ((pageSettings.defaultFontSize || 11) * 0.38) * lineSpacingMultiplier;
      for (const line of lines) {
        ensureSpace(lineHeight + 2);
        doc.text(line, margin, cursorY);
        cursorY += lineHeight;
      }
      cursorY += 2;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();

    if (tag === 'HR') {
      ensureSpace(6);
      doc.setDrawColor(180, 175, 170);
      doc.setLineWidth(0.3);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 5;
      return;
    }

    if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4') {
      const text = (el.innerText || el.textContent || '').trim();
      if (!text) return;
      const sizeMap: Record<string, number> = { H1: 16, H2: 14, H3: 12.5, H4: 11.5 };
      const ptSize = sizeMap[tag] || 13;
      const lineHeight = ptSize * 0.42 * lineSpacingMultiplier;
      ensureSpace(lineHeight + 5);
      cursorY += 2;
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(ptSize);
      doc.setTextColor(20, 20, 20);
      const lines = doc.splitTextToSize(text, contentWidth);
      for (const line of lines) {
        ensureSpace(lineHeight + 2);
        doc.text(line, margin, cursorY);
        cursorY += lineHeight;
      }
      cursorY += 2.5;
      return;
    }

    if (tag === 'UL' || tag === 'OL') {
      const items = Array.from(el.children);
      items.forEach((child, idx) => {
        const prefix = tag === 'OL' ? `${idx + 1}. ` : '• ';
        renderElementNode(child, prefix);
      });
      cursorY += 2;
      return;
    }

    if (tag === 'TABLE') {
      const rows = Array.from(el.querySelectorAll('tr'));
      if (rows.length > 0) {
        cursorY += 2;
        rows.forEach((tr, rIdx) => {
          const cells = Array.from(tr.querySelectorAll('th, td'));
          if (cells.length === 0) return;
          const colW = contentWidth / cells.length;
          const cellTexts = cells.map((c) =>
            doc.splitTextToSize((c.textContent || '').trim(), colW - 4)
          );
          const maxLines = Math.max(1, ...cellTexts.map((lines) => lines.length));
          const rowH = maxLines * 4.8 + 4;
          ensureSpace(rowH + 2);

          cells.forEach((c, cIdx) => {
            const x = margin + cIdx * colW;
            if (rIdx === 0 || c.tagName.toUpperCase() === 'TH') {
              doc.setFillColor(245, 243, 240);
              doc.rect(x, cursorY - 3.5, colW, rowH, 'FD');
              doc.setFont(pdfFont, 'bold');
            } else {
              doc.setDrawColor(214, 211, 209);
              doc.rect(x, cursorY - 3.5, colW, rowH, 'S');
              doc.setFont(pdfFont, 'normal');
            }
            doc.setFontSize(9.5);
            doc.setTextColor(28, 25, 23);
            doc.text(cellTexts[cIdx], x + 2, cursorY + 1);
          });
          cursorY += rowH;
        });
        cursorY += 4;
      }
      return;
    }

    if (tag === 'BLOCKQUOTE' || tag === 'PRE') {
      const text = (el.innerText || el.textContent || '').trim();
      if (!text) return;
      doc.setFont(tag === 'PRE' ? 'courier' : pdfFont, tag === 'BLOCKQUOTE' ? 'italic' : 'normal');
      doc.setFontSize(10);
      doc.setTextColor(68, 64, 60);
      const lines = doc.splitTextToSize(text, contentWidth - 10);
      const blockH = lines.length * 4.5 + 5;
      ensureSpace(blockH + 3);
      doc.setFillColor(250, 248, 245);
      doc.setDrawColor(217, 119, 6);
      doc.rect(margin + 2, cursorY - 3.5, contentWidth - 4, blockH, 'F');
      doc.setLineWidth(0.8);
      doc.line(margin + 2, cursorY - 3.5, margin + 2, cursorY - 3.5 + blockH);
      doc.setLineWidth(0.3);
      doc.text(lines, margin + 6, cursorY + 1);
      cursorY += blockH + 3;
      return;
    }

    // Default paragraph / list item / div
    const rawText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!rawText && el.children.length > 0) {
      Array.from(el.childNodes).forEach((child) => renderElementNode(child));
      return;
    }
    if (!rawText) {
      cursorY += 3;
      return;
    }

    const isBold =
      tag === 'B' ||
      tag === 'STRONG' ||
      el.style?.fontWeight === 'bold' ||
      Number(el.style?.fontWeight) >= 600;
    const isItalic = tag === 'I' || tag === 'EM' || el.style?.fontStyle === 'italic';
    const fontStyle = isBold && isItalic ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';

    const fontSize = pageSettings.defaultFontSize || 11;
    doc.setFont(pdfFont, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(28, 25, 23);

    const indentX = listPrefix ? margin + 5 : margin;
    const availW = listPrefix ? contentWidth - 5 : contentWidth;
    const fullText = listPrefix ? `${listPrefix}${rawText}` : rawText;

    const lines = doc.splitTextToSize(fullText, availW);
    const lineHeight = fontSize * 0.39 * lineSpacingMultiplier;

    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      const align = el.style?.textAlign;
      if (align === 'center') {
        doc.text(line, pageWidth / 2, cursorY, { align: 'center' });
      } else if (align === 'right') {
        doc.text(line, pageWidth - margin, cursorY, { align: 'right' });
      } else {
        doc.text(line, indentX, cursorY);
      }
      cursorY += lineHeight;
    }
    cursorY += 2.5;
  };

  Array.from(tempDiv.childNodes).forEach((node) => renderElementNode(node));

  // Apply Running Header, Footer, Page Border, Watermark, and Page Numbers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Optional Page Border
    if (pageSettings.showPageBorder) {
      doc.setDrawColor(168, 162, 158);
      doc.setLineWidth(0.4);
      doc.rect(8, 8, pageWidth - 16, pageHeight - 16, 'S');
    }

    // Optional Watermark
    if (pageSettings.watermark && pageSettings.watermark.trim()) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(34);
      doc.setTextColor(235, 232, 228);
      doc.text(pageSettings.watermark.toUpperCase(), pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 35,
      });
    }

    // Running Header
    if (pageSettings.headerText && pageSettings.headerText.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 113, 108);
      doc.text(pageSettings.headerText, margin, 11);
      doc.setDrawColor(231, 229, 228);
      doc.setLineWidth(0.2);
      doc.line(margin, 13, pageWidth - margin, 13);
    }

    // Running Footer & Page Numbering
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 113, 108);
    if (pageSettings.footerText && pageSettings.footerText.trim()) {
      doc.text(pageSettings.footerText, margin, pageHeight - 10);
    }
    if (pageSettings.showPageNumbers) {
      doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 10, {
        align: 'right',
      });
    }
  }

  const pdfDataUrl = doc.output('datauristring');
  return { pdfDataUrl, pageCount: totalPages };
}

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
    footerText: 'Confidential Course Material • Auto-Converted PDF',
  });

  // Editor state
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isSaving, setIsSaving] = useState<boolean>(false);
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

  // Convert selectedNote's pdfDataUrl into a Blob URL for embedded PDF viewing
  const activePdfBlobUrl = useMemo(() => {
    if (!selectedNote?.pdfDataUrl) return '';
    return dataUrlToBlobUrl(selectedNote.pdfDataUrl);
  }, [selectedNote?.pdfDataUrl]);

  // Clean up object URL on unmount/change
  useEffect(() => {
    return () => {
      if (activePdfBlobUrl) {
        URL.revokeObjectURL(activePdfBlobUrl);
      }
    };
  }, [activePdfBlobUrl]);

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
      if (selectedNote.pageSettingsJson) {
        try {
          setPageSettings({
            ...DEFAULT_PAGE_SETTINGS,
            ...JSON.parse(selectedNote.pageSettingsJson),
          });
        } catch {
          // keep defaults
        }
      }
      if (editorRef.current && editorRef.current.innerHTML !== selectedNote.htmlContent) {
        editorRef.current.innerHTML = selectedNote.htmlContent;
      }
      computeStats(selectedNote.plainText || '');
    } else if (editorRef.current && !editorRef.current.innerHTML.trim()) {
      const initialHtml = `<h1>${course ? `${course.code}: ${course.title}` : 'Official Course Study Notes'}</h1><p>Start typing your lecture notes here using the <strong>Microsoft Word Ribbon</strong> above. Format headings, insert tables, mathematical symbols, and customize page layout.</p><p>When you click <strong>Save &amp; Auto-Convert to PDF</strong>, this Word document is automatically converted into a locked <strong>PDF</strong> for students and users.</p>`;
      editorRef.current.innerHTML = initialHtml;
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
    if (editorRef.current) {
      editorRef.current.innerHTML = `<h1>Untitled Lecture Notes</h1><p>Enter structured lecture content here...</p>`;
      computeStats(editorRef.current.innerText || '');
    }
    setSaveBanner(null);
  };

  // Save Word Document & Automatically Convert to PDF
  const handleSaveAndConvertPdf = async () => {
    if (!docTitle.trim()) {
      setErrorMessage('Please enter a Document Title before saving.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSaveBanner(null);

      const htmlContent = editorRef.current?.innerHTML || `<p>${docTitle}</p>`;
      const plainText = editorRef.current?.innerText || docTitle;

      // Auto-convert the Microsoft Word document & its properties into a real PDF
      const { pdfDataUrl, pageCount } = generatePdfFromWordDocument({
        title: docTitle.trim(),
        subject: docSubject.trim(),
        author: docAuthor.trim() || userName || 'Course Admin',
        category: docCategory.trim(),
        keywords: docKeywords.trim(),
        status: docStatus,
        comments: docComments.trim(),
        courseCode: course?.code || 'COURSE',
        courseTitle: course?.title || 'Academic Notes',
        htmlContent,
        pageSettings,
      });

      const cleanFileName = `${docTitle
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'Course_Notes'}.pdf`;

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
        `Saved "${noteDoc.title}" (v${noteDoc.version}) and automatically converted to PDF (${cleanFileName} • ${pageCount} ${
          pageCount === 1 ? 'page' : 'pages'
        })! Users can now view & download the PDF.`
      );
    } catch (err: any) {
      console.error('Error saving Word note and converting to PDF:', err);
      setErrorMessage(err?.message || 'Failed to save and convert document to PDF.');
    } finally {
      setIsSaving(false);
    }
  };

  // Download generated PDF file
  const handleDownloadPdf = (note: WordNoteDocument) => {
    if (!note.pdfDataUrl) return;
    const blobUrl = dataUrlToBlobUrl(note.pdfDataUrl);
    const link = document.createElement('a');
    link.href = blobUrl || note.pdfDataUrl;
    link.download = note.pdfFileName || `${note.title.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (blobUrl) {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
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

  // Page visual dimensions in editor
  const marginPaddingMap: Record<string, string> = {
    narrow: '24px',
    moderate: '36px',
    normal: '48px',
    wide: '68px',
  };

  // ============================================================================
  // USER / STUDENT VIEW (OR ADMIN PDF PREVIEW): USERS CAN ONLY ACCESS PDF
  // ============================================================================
  if (activeMode === 'pdf_reader') {
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
                  <Lock className="w-3 h-3" /> PDF-Only Reader Mode
                </span>
                {course && (
                  <span className="text-xs font-mono text-stone-400">
                    {course.code} • {course.title}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-serif font-bold text-white mt-1">
                Published Course Notes (PDF Documents)
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                {isAdmin
                  ? 'Previewing User PDF-Only Mode. Students can view and download auto-converted PDFs without editing permissions.'
                  : 'Official course notes authored by the administrator in Microsoft Word and automatically published as read-only PDFs.'}
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

        {courseNotes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
            <FileText className="w-12 h-12 text-stone-400 mx-auto mb-3" />
            <h3 className="font-serif font-bold text-xl text-stone-800">
              No PDF Notes Published Yet
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto mt-1.5 leading-relaxed">
              {isAdmin
                ? 'Switch to the Microsoft Word Studio to write course notes. Upon saving, they are automatically converted into PDFs for students.'
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
                          className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            isSelected
                              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Area: PDF Document Viewer & Properties */}
            {selectedNote && (
              <div className="lg:col-span-3 space-y-4">
                {/* PDF Header Bar */}
                <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-mono font-bold">
                        LOCKED PDF DOCUMENT
                      </span>
                      <span className="text-xs font-mono text-stone-500">
                        {selectedNote.pdfFileName}
                      </span>
                      <span className="text-xs font-mono text-stone-400">
                        • Author: {selectedNote.author}
                      </span>
                    </div>
                    <h3 className="text-lg font-serif font-bold text-stone-900">
                      {selectedNote.title}
                    </h3>
                    {selectedNote.subject && (
                      <p className="text-xs text-stone-500">{selectedNote.subject}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {activePdfBlobUrl && (
                      <a
                        href={activePdfBlobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-stone-200"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-700" />
                        <span>Open Native PDF</span>
                      </a>
                    )}
                    <button
                      onClick={() => handleDownloadPdf(selectedNote)}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF ({selectedNote.pageCount || 1}p)</span>
                    </button>
                  </div>
                </div>

                {/* Native Embedded PDF Frame + Read-Only Rendered PDF Sheet */}
                <div className="bg-stone-800 rounded-2xl border border-stone-700 p-4 md:p-6 shadow-inner space-y-6">
                  {activePdfBlobUrl && (
                    <div className="w-full h-[520px] rounded-xl overflow-hidden bg-stone-900 border border-stone-700">
                      <object
                        data={activePdfBlobUrl}
                        type="application/pdf"
                        className="w-full h-full"
                      >
                        <iframe
                          src={activePdfBlobUrl}
                          title={selectedNote.title}
                          className="w-full h-full border-0"
                        />
                      </object>
                    </div>
                  )}

                  {/* Read-Only Locked PDF Page Preview (Guaranteed rendering on mobile & sandboxed browsers) */}
                  <div className="bg-white rounded-xl shadow-2xl max-w-3xl mx-auto p-8 md:p-12 border border-stone-300 select-none relative overflow-hidden">
                    <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 border-b border-stone-200 pb-3 mb-6">
                      <span>{selectedNote.subject || selectedNote.title}</span>
                      <span>READ-ONLY PDF VIEW • {selectedNote.pdfFileName}</span>
                    </div>

                    <div className="mb-6 pb-4 border-b border-stone-200">
                      <h1 className="text-2xl font-serif font-bold text-stone-900">
                        {selectedNote.title}
                      </h1>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-stone-500 font-mono">
                        <span>Author: {selectedNote.author}</span>
                        <span>•</span>
                        <span>Category: {selectedNote.category || 'Lecture Notes'}</span>
                        <span>•</span>
                        <span>Status: {selectedNote.status || 'Published'}</span>
                        <span>•</span>
                        <span>Words: {selectedNote.wordCount}</span>
                      </div>
                    </div>

                    <div
                      className="prose prose-stone max-w-none text-stone-800 pointer-events-none"
                      dangerouslySetInnerHTML={{ __html: selectedNote.htmlContent }}
                    />

                    <div className="mt-10 pt-3 border-t border-stone-200 flex items-center justify-between text-[11px] font-mono text-stone-400">
                      <span>Auto-Converted from Admin Microsoft Word Document</span>
                      <span>
                        Version {selectedNote.version || 1} • {selectedNote.pageCount || 1} Page(s)
                      </span>
                    </div>
                  </div>
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
  return (
    <div className="space-y-4">
      {/* Top Admin Status & Mode Bar */}
      <div className="bg-[#185abd] text-white rounded-2xl p-4 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center font-serif font-bold text-lg shadow-inner shrink-0">
            W
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded font-semibold">
                Microsoft Word Studio • Admin Only
              </span>
              <span className="text-xs text-blue-100 font-mono">
                Auto-Converts to PDF on Save
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Enter Word Document Title..."
                className="bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-stone-900 font-semibold text-sm px-2.5 py-1 rounded-lg border border-white/20 focus:outline-none w-64 sm:w-80 transition-colors"
              />
              {selectedNote && (
                <span className="text-[11px] font-mono text-blue-100">
                  v{selectedNote.version} • {selectedNote.pageCount}p PDF Ready
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Document Switcher & Save / Auto-PDF Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {courseNotes.length > 0 && (
            <select
              value={selectedNoteId || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__new__') {
                  handleCreateNewDocument();
                } else {
                  setSelectedNoteId(val);
                }
              }}
              className="bg-blue-900/70 border border-white/25 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none"
            >
              <option value="__new__">+ New Word Document</option>
              {courseNotes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title} (v{n.version})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleCreateNewDocument}
            className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Create New Word Document"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Doc</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndConvertPdf}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {isSaving ? 'Saving & Converting to PDF...' : 'Save & Auto-Convert to PDF'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAdminViewMode('pdf_reader')}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs shadow flex items-center gap-1.5 transition-colors"
            title="Preview what regular users see (PDF Only)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>User PDF View ({courseNotes.length})</span>
          </button>

          {selectedNote && (
            <button
              type="button"
              onClick={() => onDeleteWordNote(selectedNote.id)}
              className="p-2 rounded-xl bg-rose-500/30 hover:bg-rose-500 text-white transition-colors"
              title="Delete Document"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Save & Auto-PDF Confirmation Banner */}
      {saveBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{saveBanner}</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedNote && (
              <button
                onClick={() => handleDownloadPdf(selectedNote)}
                className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>Download PDF</span>
              </button>
            )}
            <button
              onClick={() => setAdminViewMode('pdf_reader')}
              className="px-3 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              <span>Open User PDF Reader</span>
            </button>
            <button
              onClick={() => setSaveBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 font-bold px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Microsoft Word Ribbon Container */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Ribbon Tab Headers */}
        <div className="flex items-center gap-1 bg-stone-100 border-b border-stone-200 px-3 pt-2 overflow-x-auto">
          {[
            { id: 'file', label: 'File & Document Properties' },
            { id: 'home', label: 'Home' },
            { id: 'insert', label: 'Insert' },
            { id: 'layout', label: 'Page Layout' },
            { id: 'design', label: 'Header, Footer & Watermark' },
            { id: 'review', label: 'Review & Word Count' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setRibbonTab(t.id as any)}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all whitespace-nowrap ${
                ribbonTab === t.id
                  ? 'bg-white text-[#185abd] border-t border-x border-stone-200 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Ribbon Toolbar Content */}
        <div className="p-3.5 bg-white">
          {/* 1. FILE & DOCUMENT PROPERTIES TAB */}
          {ribbonTab === 'file' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-800">
                  <Info className="w-4 h-4 text-[#185abd]" />
                  <span>Microsoft Word Document Details, Metadata & Properties</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportWordDoc}
                    className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 border border-stone-200"
                  >
                    <Download className="w-3.5 h-3.5 text-[#185abd]" />
                    <span>Export .DOC (Admin)</span>
                  </button>
                  {selectedNote && (
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(selectedNote)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Converted .PDF</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#185abd]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                    Subject / Paper
                  </label>
                  <input
                    type="text"
                    value={docSubject}
                    onChange={(e) => setDocSubject(e.target.value)}
                    placeholder="e.g. Unit I & II Lecture Notes"
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#185abd]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                    Author Property
                  </label>
                  <input
                    type="text"
                    value={docAuthor}
                    onChange={(e) => setDocAuthor(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#185abd]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                    placeholder="Lecture Notes, Handout..."
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#185abd]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                    Keywords / Tags
                  </label>
                  <input
                    type="text"
                    value={docKeywords}
                    onChange={(e) => setDocKeywords(e.target.value)}
                    placeholder="Comma-separated tags..."
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#185abd]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                    Document Status
                  </label>
                  <select
                    value={docStatus}
                    onChange={(e) => setDocStatus(e.target.value as any)}
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#185abd]"
                  >
                    <option value="Published">Published (PDF Live)</option>
                    <option value="Final">Final Approved</option>
                    <option value="Draft">Draft</option>
                    <option value="Confidential">Confidential</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                    Link to Syllabus Unit
                  </label>
                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#185abd]"
                  >
                    <option value="">General Course Notes</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unit {u.unitNumber}: {u.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                    Comments / Abstract
                  </label>
                  <input
                    type="text"
                    value={docComments}
                    onChange={(e) => setDocComments(e.target.value)}
                    placeholder="Document summary embedded in PDF..."
                    className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#185abd]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. HOME TAB (FONT, PARAGRAPH, STYLES) */}
          {ribbonTab === 'home' && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Undo / Redo */}
              <div className="flex items-center gap-1 pr-2 border-r border-stone-200">
                <button
                  type="button"
                  onClick={() => execCmd('undo')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-700"
                  title="Undo"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('redo')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-700"
                  title="Redo"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Font Family & Size */}
              <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200">
                <select
                  value={pageSettings.defaultFont}
                  onChange={(e) => {
                    setPageSettings({ ...pageSettings, defaultFont: e.target.value });
                    execCmd('fontName', e.target.value);
                  }}
                  className="border border-stone-300 rounded-lg px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-[#185abd]"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.label} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <select
                  value={pageSettings.defaultFontSize}
                  onChange={(e) => {
                    const sz = Number(e.target.value) || 12;
                    setPageSettings({ ...pageSettings, defaultFontSize: sz });
                  }}
                  className="border border-stone-300 rounded-lg px-2 py-1 text-xs text-stone-800 focus:outline-none focus:border-[#185abd]"
                >
                  {FONT_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} pt
                    </option>
                  ))}
                </select>
              </div>

              {/* Bold, Italic, Underline, Strike, Sub, Sup */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-stone-200">
                <button
                  type="button"
                  onClick={() => execCmd('bold')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Bold (Ctrl+B)"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('italic')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Italic (Ctrl+I)"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('underline')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Underline (Ctrl+U)"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('strikeThrough')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Strikethrough"
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('subscript')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Subscript"
                >
                  <Subscript className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('superscript')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Superscript"
                >
                  <Superscript className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Font Color & Highlight Color */}
              <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200">
                <label className="flex items-center gap-1 text-[11px] text-stone-600 cursor-pointer" title="Font Color">
                  <Palette className="w-3.5 h-3.5 text-[#185abd]" />
                  <input
                    type="color"
                    defaultValue="#1c1917"
                    onChange={(e) => execCmd('foreColor', e.target.value)}
                    className="w-5 h-5 border-0 p-0 cursor-pointer bg-transparent"
                  />
                </label>
                <label className="flex items-center gap-1 text-[11px] text-stone-600 cursor-pointer" title="Text Highlight Color">
                  <Highlighter className="w-3.5 h-3.5 text-amber-600" />
                  <input
                    type="color"
                    defaultValue="#fef08a"
                    onChange={(e) => execCmd('hiliteColor', e.target.value)}
                    className="w-5 h-5 border-0 p-0 cursor-pointer bg-transparent"
                  />
                </label>
              </div>

              {/* Alignment */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-stone-200">
                <button
                  type="button"
                  onClick={() => execCmd('justifyLeft')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Align Left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('justifyCenter')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Align Center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('justifyRight')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Align Right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('justifyFull')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Justify"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Lists & Indent */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-stone-200">
                <button
                  type="button"
                  onClick={() => execCmd('insertUnorderedList')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Bullet List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('insertOrderedList')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Numbered List"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('outdent')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Decrease Indent"
                >
                  <Outdent className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('indent')}
                  className="p-1.5 rounded hover:bg-stone-100 text-stone-800"
                  title="Increase Indent"
                >
                  <Indent className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* MS Word Styles Gallery */}
              <div className="flex items-center gap-1">
                {[
                  { label: 'Normal', tag: 'P' },
                  { label: 'Heading 1', tag: 'H1' },
                  { label: 'Heading 2', tag: 'H2' },
                  { label: 'Heading 3', tag: 'H3' },
                  { label: 'Code / Pre', tag: 'PRE' },
                ].map((st) => (
                  <button
                    key={st.label}
                    type="button"
                    onClick={() => execCmd('formatBlock', st.tag)}
                    className="px-2.5 py-1 rounded border border-stone-200 hover:border-[#185abd] hover:bg-blue-50/50 text-[11px] font-medium text-stone-700 transition-colors"
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. INSERT TAB */}
          {ribbonTab === 'insert' && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Insert Table */}
              <div className="flex items-center gap-1.5 pr-3 border-r border-stone-200">
                <Table className="w-4 h-4 text-[#185abd]" />
                <span className="text-xs font-medium text-stone-700">Table:</span>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={tableRows}
                  onChange={(e) => setTableRows(Number(e.target.value) || 3)}
                  className="w-12 border border-stone-300 rounded px-1.5 py-1 text-xs text-center"
                  title="Rows"
                />
                <span className="text-xs text-stone-400">×</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={tableCols}
                  onChange={(e) => setTableCols(Number(e.target.value) || 3)}
                  className="w-12 border border-stone-300 rounded px-1.5 py-1 text-xs text-center"
                  title="Columns"
                />
                <button
                  type="button"
                  onClick={handleInsertTable}
                  className="px-2.5 py-1 rounded-lg bg-[#185abd] hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Insert Table
                </button>
              </div>

              {/* Callout / Page Break / Image */}
              <div className="flex items-center gap-2 pr-3 border-r border-stone-200">
                <button
                  type="button"
                  onClick={handleInsertCalloutBox}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-medium"
                >
                  + Theorem / Note Box
                </button>
                <button
                  type="button"
                  onClick={handleInsertPageBreak}
                  className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium flex items-center gap-1"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>Page Divider</span>
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium flex items-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#185abd]" />
                  <span>Insert Image</span>
                </button>
              </div>

              {/* Academic & Math Symbols */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] font-mono text-stone-500 mr-1">Symbols:</span>
                {ACADEMIC_SYMBOLS.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => execCmd('insertText', sym)}
                    className="w-6 h-6 rounded border border-stone-200 hover:border-[#185abd] hover:bg-blue-50 text-xs font-mono flex items-center justify-center text-stone-800"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. PAGE LAYOUT TAB */}
          {ribbonTab === 'layout' && (
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-stone-500 uppercase text-[11px]">Page Size:</span>
                <select
                  value={pageSettings.pageSize}
                  onChange={(e) =>
                    setPageSettings({ ...pageSettings, pageSize: e.target.value as any })
                  }
                  className="border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <option value="A4">A4 (210 × 297 mm)</option>
                  <option value="Letter">Letter (8.5 × 11 in)</option>
                  <option value="Legal">Legal (8.5 × 14 in)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-stone-500 uppercase text-[11px]">Orientation:</span>
                <select
                  value={pageSettings.orientation}
                  onChange={(e) =>
                    setPageSettings({ ...pageSettings, orientation: e.target.value as any })
                  }
                  className="border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-stone-500 uppercase text-[11px]">Margins:</span>
                <select
                  value={pageSettings.margins}
                  onChange={(e) =>
                    setPageSettings({ ...pageSettings, margins: e.target.value as any })
                  }
                  className="border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <option value="normal">Normal (1 in / 25.4 mm)</option>
                  <option value="narrow">Narrow (0.5 in / 12.7 mm)</option>
                  <option value="moderate">Moderate (0.75 in / 19 mm)</option>
                  <option value="wide">Wide (1.4 in / 35 mm)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-stone-500 uppercase text-[11px]">Line Spacing:</span>
                <select
                  value={pageSettings.lineSpacing}
                  onChange={(e) =>
                    setPageSettings({ ...pageSettings, lineSpacing: e.target.value as any })
                  }
                  className="border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <option value="1.0">1.0 (Single)</option>
                  <option value="1.15">1.15 (Word Default)</option>
                  <option value="1.5">1.5 Lines</option>
                  <option value="2.0">2.0 (Double)</option>
                </select>
              </div>
            </div>
          )}

          {/* 5. HEADER, FOOTER & WATERMARK TAB */}
          {ribbonTab === 'design' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs items-end">
              <div>
                <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                  Running Header Text
                </label>
                <input
                  type="text"
                  value={pageSettings.headerText}
                  onChange={(e) =>
                    setPageSettings({ ...pageSettings, headerText: e.target.value })
                  }
                  placeholder="Top page header in PDF..."
                  className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                  <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                  Running Footer Text
                </label>
                <input
                  type="text"
                  value={pageSettings.footerText}
                  onChange={(e) =>
                    setPageSettings({ ...pageSettings, footerText: e.target.value })
                  }
                  placeholder="Bottom page footer in PDF..."
                  className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-stone-500 mb-1">
                  PDF Diagonal Watermark
                </label>
                <input
                  type="text"
                  value={pageSettings.watermark}
                  onChange={(e) =>
                    setPageSettings({ ...pageSettings, watermark: e.target.value })
                  }
                  placeholder="e.g. OFFICIAL NOTES, CONFIDENTIAL"
                  className="w-full border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>

              <div className="flex items-center gap-4 pb-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pageSettings.showPageNumbers}
                    onChange={(e) =>
                      setPageSettings({ ...pageSettings, showPageNumbers: e.target.checked })
                    }
                  />
                  <span>Page Numbers</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pageSettings.showPageBorder}
                    onChange={(e) =>
                      setPageSettings({ ...pageSettings, showPageBorder: e.target.checked })
                    }
                  />
                  <span>Page Border</span>
                </label>
              </div>
            </div>
          )}

          {/* 6. REVIEW & FIND/REPLACE TAB */}
          {ribbonTab === 'review' && (
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-3 py-1.5 rounded-lg bg-stone-100 font-mono">
                  Words: <strong>{wordStats.words}</strong>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-stone-100 font-mono">
                  Characters: <strong>{wordStats.chars}</strong>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-stone-100 font-mono">
                  Paragraphs: <strong>{wordStats.paragraphs}</strong>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#185abd] font-mono">
                  Auto-PDF Conversion: <strong>Active on Save</strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Search className="w-3.5 h-3.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Find text..."
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  className="border border-stone-300 rounded-lg px-2.5 py-1 text-xs"
                />
                <input
                  type="text"
                  placeholder="Replace with..."
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  className="border border-stone-300 rounded-lg px-2.5 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={handleFindAndReplace}
                  className="px-3 py-1 rounded-lg bg-[#185abd] text-white font-semibold"
                >
                  Replace All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Microsoft Word Page Workspace & Ruler */}
      <div className="bg-stone-200/90 rounded-2xl border border-stone-300 p-4 md:p-8 shadow-inner overflow-x-auto">
        {/* Horizontal Top Ruler */}
        <div
          className={`mx-auto mb-3 bg-stone-100 border border-stone-300 rounded h-6 px-4 flex items-center justify-between text-[9px] font-mono text-stone-400 select-none ${
            pageSettings.orientation === 'landscape' ? 'max-w-5xl' : 'max-w-3xl'
          }`}
        >
          <span>0"</span>
          <span>1"</span>
          <span>2"</span>
          <span>3"</span>
          <span>4"</span>
          <span>5"</span>
          <span>6"</span>
          <span>7"</span>
          <span>8"</span>
        </div>

        {/* Editable MS Word Paper Sheet */}
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
            padding: marginPaddingMap[pageSettings.margins] || '48px',
            fontFamily: pageSettings.defaultFont,
            fontSize: `${pageSettings.defaultFontSize}pt`,
            lineHeight: pageSettings.lineSpacing,
            backgroundColor: pageSettings.pageColor || '#ffffff',
            border: pageSettings.showPageBorder ? '2px solid #78716c' : '1px solid #d6d3d1',
          }}
          className={`mx-auto bg-white shadow-2xl min-h-[780px] relative transition-all ${
            pageSettings.orientation === 'landscape' ? 'max-w-5xl' : 'max-w-3xl'
          }`}
        >
          {/* Watermark Preview inside Word Canvas */}
          {pageSettings.watermark && (
            <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-10">
              <span className="text-5xl font-bold uppercase tracking-widest text-stone-500 -rotate-35">
                {pageSettings.watermark}
              </span>
            </div>
          )}

          {/* Running Header Preview */}
          {pageSettings.headerText && (
            <div className="text-[10px] font-mono text-stone-400 border-b border-stone-200 pb-2 mb-6 flex items-center justify-between select-none">
              <span>{pageSettings.headerText}</span>
              <span>{pageSettings.pageSize} • {docStatus}</span>
            </div>
          )}

          {/* Rich ContentEditable Body */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleEditorInput}
            className="min-h-[640px] focus:outline-none prose prose-stone max-w-none relative z-10"
          />

          {/* Running Footer Preview */}
          {(pageSettings.footerText || pageSettings.showPageNumbers) && (
            <div className="text-[10px] font-mono text-stone-400 border-t border-stone-200 pt-2 mt-8 flex items-center justify-between select-none">
              <span>{pageSettings.footerText}</span>
              {pageSettings.showPageNumbers && <span>Page 1</span>}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Microsoft Word Status Bar */}
      <div className="bg-[#185abd] text-white rounded-xl px-4 py-2 text-xs font-mono flex flex-wrap items-center justify-between gap-4 shadow">
        <div className="flex flex-wrap items-center gap-4">
          <span>Page Size: {pageSettings.pageSize} ({pageSettings.orientation})</span>
          <span>•</span>
          <span>Words: {wordStats.words}</span>
          <span>•</span>
          <span>Characters: {wordStats.chars}</span>
          <span>•</span>
          <span>English (Academic)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
            className="p-1 rounded hover:bg-white/15"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="w-12 text-center">{zoomLevel}%</span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
            className="p-1 rounded hover:bg-white/15"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
