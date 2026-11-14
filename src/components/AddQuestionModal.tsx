import React, { useState } from 'react';
import {
  X,
  HelpCircle,
  CheckCircle2,
  FileText,
  Upload,
} from 'lucide-react';
import { Course, Unit, Book, Question, getSectionForMarks } from '../types';

interface AddQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  units: Unit[];
  books: Book[];
  defaultUnitId?: string;
  defaultMarks?: number;
  onSaveQuestion: (q: Omit<Question, 'id' | 'createdAt'>) => Promise<void>;
  userId: string;
  userName: string;
}

export const AddQuestionModal: React.FC<AddQuestionModalProps> = ({
  isOpen,
  onClose,
  course,
  units,
  books,
  defaultUnitId,
  defaultMarks,
  onSaveQuestion,
  userId,
  userName,
}) => {
  const [selectedUnitId, setSelectedUnitId] = useState<string>(defaultUnitId || units[0]?.id || '');
  const [isSaving, setIsSaving] = useState(false);

  // PDF upload state
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfFileData, setPdfFileData] = useState('');
  const [pdfMimeType, setPdfMimeType] = useState('application/pdf');
  const [pdfSizeKb, setPdfSizeKb] = useState<number>(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveMarks = Number(defaultMarks) || 5;

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('PDF file exceeds 10MB limit. Please upload a smaller PDF file.');
      return;
    }

    setPdfFileName(file.name);
    setPdfMimeType('application/pdf');
    setPdfSizeKb(Math.round(file.size / 1024));

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setPdfFileData(dataUrl);
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFileData || !pdfFileName) {
      setErrorMessage('Please select a PDF file to upload.');
      return;
    }

    const calculatedSection = getSectionForMarks(effectiveMarks);
    const derivedTitle = pdfFileName.replace(/\.[^/.]+$/, '').replace(/[_|-]/g, ' ').trim() || `${effectiveMarks}M Exam Paper PDF`;

    try {
      setIsSaving(true);
      setErrorMessage(null);
      await onSaveQuestion({
        courseId: course.id,
        unitId: selectedUnitId,
        question: derivedTitle,
        answer: `Uploaded official PDF question paper/notes: ${pdfFileName} (${pdfSizeKb} KB)`,
        marks: effectiveMarks,
        section: calculatedSection,
        isCurated: true,
        thinkingUsed: false,
        groundedInSearch: true,
        modelUsed: 'PDF Document Upload',
        sourceBooks: books.map((b) => b.title).join(', '),
        webSources: [],
        pdfDataUrl: pdfFileData,
        pdfFileName,
        mimeType: pdfMimeType,
        askedBy: userId,
        askedByName: `${userName} (Admin PDF Curated)`,
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving question PDF:', err);
      setErrorMessage('Failed to save PDF to notes: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-stone-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-stone-100">
                Upload {effectiveMarks}M PDF Document
              </h2>
              <p className="text-xs text-stone-400">
                Choose a syllabus unit and upload the PDF for this mark tier
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Unit & PDF Upload Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-200 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Unit selector */}
          <div>
            <label className="block text-xs font-mono text-stone-300 uppercase mb-1.5">
              Select Syllabus Unit
            </label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  Unit {u.unitNumber}: {u.title}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Admin PDF Upload for this Mark Tier */}
            <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase text-stone-200 font-semibold">
                    Upload PDF Question Paper / Solution Document
                  </h4>
                  <p className="text-[11px] text-stone-400">
                    Upload the official PDF for this {effectiveMarks}M tier. Users will be able to view and download it directly.
                  </p>
                </div>
              </div>

              <div className="border-2 border-dashed border-stone-700 hover:border-amber-500/60 rounded-xl p-4 text-center bg-stone-900/50 transition-colors">
                <input
                  type="file"
                  id="mark-tier-pdf-upload"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
                <label
                  htmlFor="mark-tier-pdf-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                >
                  <Upload className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-semibold text-stone-200">
                    {pdfFileName ? `Selected PDF: ${pdfFileName}` : 'Click to select PDF file for this mark tier'}
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">PDF documents only</span>
                </label>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save PDF to Unit'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
