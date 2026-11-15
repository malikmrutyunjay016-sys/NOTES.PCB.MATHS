import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Course, Question } from '../types';
import { parseDataUrlToBytes, validatePdfBytes } from '../lib/pdfUtils';
import { MarkdownView } from './MarkdownView';
import { PdfViewer } from './PdfViewer';
import { LatexText } from './LatexText';
import { LatexSymbolToolbar } from './LatexSymbolToolbar';

interface PracticalQuestionsViewProps {
  course: Course;
  questions: Question[];
  isAdmin: boolean;
  onSaveQuestion: (qData: Omit<Question, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateQuestion: (updatedQuestion: Question) => Promise<void>;
  onRequestDeleteQuestion: (q: Question) => void;
  userId: string;
  userName: string;
}

interface PendingPdfState {
  dataUrl: string;
  fileName: string;
  sizeKb: number;
}

function readAndValidatePdfFile(file: File): Promise<PendingPdfState> {
  return new Promise((resolve, reject) => {
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      reject(new Error('Please select a valid PDF document (.pdf) for the answer.'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('PDF file exceeds 10 MB limit. Please upload a smaller PDF.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = (ev.target?.result as string) || '';
      const parsed = parseDataUrlToBytes(dataUrl, 'application/pdf');
      if (!parsed) {
        reject(new Error('Could not decode the selected PDF file.'));
        return;
      }
      const check = validatePdfBytes(parsed.bytes);
      if (!check.valid) {
        reject(new Error(check.reason || 'The selected file is not a valid PDF.'));
        return;
      }
      resolve({
        dataUrl,
        fileName: file.name,
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
      });
    };
    reader.onerror = () => reject(new Error('Failed to read the PDF file.'));
    reader.readAsDataURL(file);
  });
}

export const PracticalQuestionsView: React.FC<PracticalQuestionsViewProps> = ({
  course,
  questions,
  isAdmin,
  onSaveQuestion,
  onUpdateQuestion,
  onRequestDeleteQuestion,
  userId,
  userName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Manual Add Practical Question (Text + LaTeX Question + PDF Answer)
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualQuestionNumber, setManualQuestionNumber] = useState<string>('');
  const [manualQuestion, setManualQuestion] = useState('');
  const [manualAnswerPdf, setManualAnswerPdf] = useState<PendingPdfState | null>(null);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const manualTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Inline Edit existing Practical Question & Answer PDF (Admin only)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionNumber, setEditQuestionNumber] = useState<string>('');
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editAnswerPdf, setEditAnswerPdf] = useState<PendingPdfState | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const sortedQuestions = useMemo(() => {
    return questions
      .slice()
      .sort((a, b) => {
        const numA =
          typeof a.questionNumber === 'number'
            ? a.questionNumber
            : Number.MAX_SAFE_INTEGER;
        const numB =
          typeof b.questionNumber === 'number'
            ? b.questionNumber
            : Number.MAX_SAFE_INTEGER;
        if (numA !== numB) return numA - numB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedQuestions;
    return sortedQuestions.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        (item.pdfFileName || '').toLowerCase().includes(q)
    );
  }, [sortedQuestions, searchQuery]);

  const nextQuestionNumber = useMemo(() => {
    let maxNum = 0;
    sortedQuestions.forEach((item, idx) => {
      const n = typeof item.questionNumber === 'number' ? item.questionNumber : idx + 1;
      if (n > maxNum) maxNum = n;
    });
    return maxNum + 1;
  }, [sortedQuestions]);

  const handleOpenManualForm = () => {
    setErrorMessage(null);
    setManualQuestionNumber(String(nextQuestionNumber));
    setShowManualForm((prev) => !prev);
  };

  const handleManualAnswerPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setErrorMessage(null);
      const parsed = await readAndValidatePdfFile(file);
      setManualAnswerPdf(parsed);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid Answer PDF file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleAddManualQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuestion.trim()) {
      setErrorMessage('Please enter the practical question in text or LaTeX format.');
      return;
    }
    if (!manualAnswerPdf) {
      setErrorMessage('Please upload a PDF file for the answer.');
      return;
    }

    const parsedNum = parseInt(manualQuestionNumber, 10);
    const questionNumber =
      Number.isFinite(parsedNum) && parsedNum > 0 ? parsedNum : nextQuestionNumber;

    try {
      setIsSavingManual(true);
      setErrorMessage(null);
      await onSaveQuestion({
        courseId: course.id,
        unitId: '',
        question: manualQuestion.trim(),
        answer: `Answer PDF: ${manualAnswerPdf.fileName} (${manualAnswerPdf.sizeKb} KB)`,
        marks: 0,
        questionNumber,
        section: 'Practical',
        answerFormat: course.answerFormat || 'qa_formula',
        isCurated: true,
        thinkingUsed: false,
        groundedInSearch: false,
        modelUsed: 'PDF Document Upload',
        pdfDataUrl: manualAnswerPdf.dataUrl,
        pdfFileName: manualAnswerPdf.fileName,
        mimeType: 'application/pdf',
        askedBy: userId,
        askedByName: userName,
      });
      setManualQuestion('');
      setManualQuestionNumber('');
      setManualAnswerPdf(null);
      setShowManualForm(false);
      setStatusMessage(`Added Question Q${questionNumber} with Answer PDF.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save practical question.');
    } finally {
      setIsSavingManual(false);
    }
  };

  const startEditingQuestion = (q: Question, fallbackNum: number) => {
    setErrorMessage(null);
    setEditingQuestionId(q.id);
    setEditQuestionNumber(
      String(typeof q.questionNumber === 'number' ? q.questionNumber : fallbackNum)
    );
    setEditQuestionText(q.question);
    setEditAnswerPdf(null);
    setExpandedIds((prev) => ({ ...prev, [q.id]: true }));
  };

  const handleEditAnswerPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setErrorMessage(null);
      const parsed = await readAndValidatePdfFile(file);
      setEditAnswerPdf(parsed);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid Answer PDF file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveEditedQuestion = async (original: Question) => {
    if (!editQuestionText.trim()) {
      setErrorMessage('Question text cannot be empty.');
      return;
    }

    const parsedNum = parseInt(editQuestionNumber, 10);
    const updatedNumber =
      Number.isFinite(parsedNum) && parsedNum > 0
        ? parsedNum
        : original.questionNumber;

    try {
      setIsSavingEdit(true);
      setErrorMessage(null);

      const updated: Question = {
        ...original,
        questionNumber: updatedNumber,
        question: editQuestionText.trim(),
        answer: editAnswerPdf
          ? `Answer PDF: ${editAnswerPdf.fileName} (${editAnswerPdf.sizeKb} KB)`
          : original.answer,
        pdfDataUrl: editAnswerPdf ? editAnswerPdf.dataUrl : original.pdfDataUrl,
        pdfFileName: editAnswerPdf ? editAnswerPdf.fileName : original.pdfFileName,
        mimeType: editAnswerPdf ? 'application/pdf' : original.mimeType,
        updatedAt: new Date().toISOString(),
      };

      await onUpdateQuestion(updated);
      setEditingQuestionId(null);
      setEditAnswerPdf(null);
      setStatusMessage(
        editAnswerPdf
          ? `Updated Question and Answer PDF (${editAnswerPdf.fileName}).`
          : 'Updated Question.'
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update practical question.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 p-6 md:p-8 shadow-sm space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 font-mono">
            <span className="font-semibold text-amber-800">{course.code}</span>
            <span aria-hidden="true">·</span>
            <span>Practical Paper (Question-Wise View)</span>
            {course.programmingLanguage && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-stone-900">
                  Language: {course.programmingLanguage}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {sortedQuestions.length}{' '}
              {sortedQuestions.length === 1 ? 'Question' : 'Questions'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-1">
            Practical Questions &amp; Answer PDFs
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {sortedQuestions.length > 0 && (
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions or PDFs..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-8 py-2 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenManualForm}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question (Text + LaTeX)</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banners */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin: Add Practical Question Form (Text + LaTeX + PDF Answer) */}
      {isAdmin && showManualForm && (
        <form
          onSubmit={handleAddManualQuestion}
          className="p-5 sm:p-6 rounded-xl border border-stone-200 bg-stone-50 space-y-5"
        >
          <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3">
            <div>
              <h3 className="text-base font-serif font-bold text-stone-900">
                Add Practical Question
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                Write the question using plain text and LaTeX symbols or equations (<code className="font-mono">$...$</code> or <code className="font-mono">$$...$$</code>), then upload the Answer PDF.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowManualForm(false)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Question No.
              </label>
              <input
                type="number"
                min={1}
                value={manualQuestionNumber}
                onChange={(e) => setManualQuestionNumber(e.target.value)}
                placeholder={String(nextQuestionNumber)}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-stone-900 focus:outline-none focus:border-amber-500 tabular-nums"
              />
            </div>
            <div className="sm:col-span-3 flex items-end">
              <p className="text-xs text-stone-500 pb-2">
                Use the LaTeX palette below to insert fractions, integrals, matrices, Greek letters, or units directly into your question.
              </p>
            </div>
          </div>

          {/* LaTeX Symbol & Equation Toolbar + Textarea */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-stone-700">
              Question Text &amp; LaTeX Equations *
            </label>

            <LatexSymbolToolbar
              textareaRef={manualTextareaRef}
              value={manualQuestion}
              onChange={setManualQuestion}
            />

            <textarea
              ref={manualTextareaRef}
              rows={4}
              required
              value={manualQuestion}
              onChange={(e) => setManualQuestion(e.target.value)}
              placeholder="Example: Determine the focal length $f$ of a convex lens using the formula $\frac{1}{f} = \frac{1}{v} - \frac{1}{u}$ and plot $\frac{1}{u}$ vs $\frac{1}{v}$."
              className="w-full bg-white border border-stone-200 rounded-xl p-3.5 text-xs sm:text-sm font-mono text-stone-900 focus:outline-none focus:border-amber-500 leading-relaxed"
            />

            {/* Live LaTeX Preview */}
            {manualQuestion.trim() && (
              <div className="p-3.5 rounded-xl bg-white border border-stone-200 space-y-1.5">
                <div className="text-[11px] font-mono font-semibold text-stone-500">
                  Live Rendered Preview
                </div>
                <div className="text-sm text-stone-900 leading-relaxed">
                  <LatexText text={manualQuestion} />
                </div>
              </div>
            )}
          </div>

          {/* Answer PDF Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-700">
              Answer Document (PDF) *
            </label>
            <div className="border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-xl p-4 bg-white transition-colors">
              <input
                type="file"
                id="practical-manual-answer-pdf"
                accept="application/pdf,.pdf"
                onChange={handleManualAnswerPdfChange}
                className="hidden"
              />
              {manualAnswerPdf ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-5 h-5 text-amber-700 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-stone-900 truncate">
                        {manualAnswerPdf.fileName}
                      </div>
                      <div className="text-[11px] font-mono text-stone-500 tabular-nums">
                        PDF Ready · {manualAnswerPdf.sizeKb} KB
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label
                      htmlFor="practical-manual-answer-pdf"
                      className="cursor-pointer px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                    >
                      Replace PDF
                    </label>
                    <button
                      type="button"
                      onClick={() => setManualAnswerPdf(null)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Remove selected PDF"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="practical-manual-answer-pdf"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center py-2"
                >
                  <Upload className="w-5 h-5 text-amber-600" />
                  <span className="text-xs font-semibold text-stone-800">
                    Click to Upload Answer PDF
                  </span>
                  <span className="text-[11px] font-mono text-stone-500">
                    Official practical solution, code output, or lab report (.pdf, max 10 MB)
                  </span>
                </label>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setShowManualForm(false)}
              className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingManual}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSavingManual ? 'Saving...' : 'Save Question & Answer PDF'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Question-Wise List */}
      {sortedQuestions.length === 0 ? (
        <div className="p-10 text-center rounded-xl bg-stone-50 border border-stone-200/80 space-y-3">
          <div className="flex items-center justify-center gap-2 text-amber-600/80">
            <ImageIcon className="w-6 h-6" />
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-lg text-stone-900">
            No Practical Questions Added Yet
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
            {isAdmin
              ? 'Click "Add Question (Text + LaTeX)" to write questions with mathematical symbols & equations and attach an Answer PDF.'
              : 'Practical questions for this paper have not been published yet. Please check back soon.'}
          </p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
          <p className="text-sm font-semibold text-stone-800">
            No practical questions match &ldquo;{searchQuery}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold text-amber-800 hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((q, idx) => {
            const isExpanded = Boolean(expandedIds[q.id]);
            const isEditing = isAdmin && editingQuestionId === q.id;
            const displayNum =
              typeof q.questionNumber === 'number' ? q.questionNumber : idx + 1;

            return (
              <div
                key={q.id}
                className="rounded-xl border border-stone-200 bg-stone-50 hover:border-amber-300 transition-all overflow-hidden shadow-xs"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedIds((prev) => ({
                      ...prev,
                      [q.id]: !prev[q.id],
                    }))
                  }
                  className="w-full text-left p-4 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                      Q{displayNum}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-stone-900 text-sm leading-relaxed">
                        <LatexText text={q.question} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-stone-500 font-mono">
                        <span className="text-amber-800 font-semibold">Practical</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {q.pdfDataUrl
                            ? `Answer PDF: ${q.pdfFileName || 'Attached'}`
                            : 'No Answer PDF attached yet'}
                        </span>
                        {q.sourceBooks && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{q.sourceBooks}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAdmin && (
                      <>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isEditing) {
                              setEditingQuestionId(null);
                            } else {
                              startEditingQuestion(q, displayNum);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              if (isEditing) {
                                setEditingQuestionId(null);
                              } else {
                                startEditingQuestion(q, displayNum);
                              }
                            }
                          }}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                          title={q.pdfDataUrl ? 'Edit Question / Replace Answer PDF' : 'Edit Question / Attach Answer PDF'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestDeleteQuestion(q);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onRequestDeleteQuestion(q);
                            }
                          }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title={q.pdfDataUrl ? 'Delete Question & Answer PDF' : 'Delete Question'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      </>
                    )}
                    <div className="p-1 text-stone-400">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-5 pt-4 border-t border-stone-200/80 bg-white space-y-4">
                    {isEditing && (
                      <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-mono font-bold text-stone-800">
                            Edit Question &amp; Answer PDF
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuestionId(null);
                              setEditAnswerPdf(null);
                            }}
                            className="text-stone-400 hover:text-stone-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                              Question No.
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={editQuestionNumber}
                              onChange={(e) => setEditQuestionNumber(e.target.value)}
                              className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold text-stone-900"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <LatexSymbolToolbar
                            textareaRef={editTextareaRef}
                            value={editQuestionText}
                            onChange={setEditQuestionText}
                          />
                          <textarea
                            ref={editTextareaRef}
                            rows={3}
                            value={editQuestionText}
                            onChange={(e) => setEditQuestionText(e.target.value)}
                            className="w-full bg-white border border-stone-200 rounded-xl p-3 text-xs font-mono text-stone-900 focus:outline-none focus:border-amber-500"
                          />
                          {editQuestionText.trim() && (
                            <div className="p-3 rounded-lg bg-white border border-stone-200 text-xs text-stone-900">
                              <LatexText text={editQuestionText} />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="text-xs text-stone-700 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>
                              {editAnswerPdf
                                ? `New Answer PDF: ${editAnswerPdf.fileName} (${editAnswerPdf.sizeKb} KB)`
                                : q.pdfDataUrl
                                ? `Current Answer PDF: ${q.pdfFileName || 'Attached'}`
                                : 'No Answer PDF attached yet'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              id={`edit-answer-pdf-${q.id}`}
                              accept="application/pdf,.pdf"
                              onChange={handleEditAnswerPdfChange}
                              className="hidden"
                            />
                            <label
                              htmlFor={`edit-answer-pdf-${q.id}`}
                              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-amber-50 hover:border-amber-400 text-xs font-semibold text-stone-800"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>{q.pdfDataUrl ? 'Replace Answer PDF' : 'Upload Answer PDF'}</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                          <button
                            type="button"
                            disabled={isSavingEdit}
                            onClick={() => {
                              setEditingQuestionId(null);
                              setEditAnswerPdf(null);
                            }}
                            className="px-3.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isSavingEdit}
                            onClick={() => handleSaveEditedQuestion(q)}
                            className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold disabled:opacity-50"
                          >
                            {isSavingEdit ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    )}

                    {q.pdfDataUrl ? (
                      <PdfViewer
                        collectionName="questions"
                        docId={q.id}
                        inlineDataUrl={q.pdfDataUrl}
                        fileName={q.pdfFileName}
                      />
                    ) : (
                      <div className="space-y-3">
                        {isAdmin && !isEditing && (
                          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                            <span className="text-xs text-amber-950 font-medium">
                              No Answer PDF is attached to this question yet.
                            </span>
                            <button
                              type="button"
                              onClick={() => startEditingQuestion(q, displayNum)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload Answer PDF</span>
                            </button>
                          </div>
                        )}
                        {q.answer && !q.answer.startsWith('Answer PDF will be attached') ? (
                          <>
                            <div className="text-xs text-stone-500 font-mono uppercase">
                              Solution / Procedure:
                            </div>
                            <MarkdownView content={q.answer} />
                          </>
                        ) : !isAdmin ? (
                          <p className="text-xs text-stone-500 italic">
                            The answer PDF for this practical question has not been uploaded yet.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
