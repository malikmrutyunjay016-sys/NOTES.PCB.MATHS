import React, { useState } from 'react';
import {
  X,
  HelpCircle,
  Sparkles,
  Sliders,
  CheckCircle2,
  BookOpen,
  Brain,
  Globe,
  FileText,
  Layers,
  Upload,
} from 'lucide-react';
import { Course, Unit, Book, Question, ANSWER_FORMATS, getSectionForMarks } from '../types';

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

interface ParsedBulkItem {
  question: string;
  answer: string;
  marks: number;
  section: string;
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
  const [modalMode, setModalMode] = useState<'single' | 'bulk'>('single');
  const [selectedUnitId, setSelectedUnitId] = useState<string>(defaultUnitId || units[0]?.id || '');
  
  // Single question state
  const [question, setQuestion] = useState(defaultMarks ? `${defaultMarks}M Exam Paper / Question Set` : '');
  const [answer, setAnswer] = useState('Official PDF uploaded for this mark tier.');
  const [marks, setMarks] = useState<number>(defaultMarks || 5);
  const [answerFormat, setAnswerFormat] = useState(course.answerFormat || 'detailed');
  const [useThinking, setUseThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modelUsed, setModelUsed] = useState('PDF Document Upload');
  const [sourcesList, setSourcesList] = useState<string[]>([]);
  const [webSourcesList, setWebSourcesList] = useState<Array<{ title: string; uri: string }>>([]);

  // PDF upload state
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfFileData, setPdfFileData] = useState('');
  const [pdfMimeType, setPdfMimeType] = useState('application/pdf');

  // Bulk paste state
  const [bulkText, setBulkText] = useState('');
  const [isParsingBulk, setIsParsingBulk] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedBulkItem[]>([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentUnit = units.find((u) => u.id === selectedUnitId);

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfFileName(file.name);
    setPdfMimeType(file.type || 'application/pdf');
    if (!question || question.includes('Exam Paper')) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_|-]/g, ' ');
      setQuestion(cleanName);
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setPdfFileData(dataUrl);
        setAnswer(`Uploaded official PDF question paper/notes: ${file.name} (${Math.round(file.size / 1024)} KB)`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleParseBulkText = async () => {
    if (!bulkText.trim()) {
      setErrorMessage('Please paste raw text containing multiple questions.');
      return;
    }

    try {
      setIsParsingBulk(true);
      setErrorMessage(null);
      const res = await fetch('/api/gemini/parse-bulk-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: bulkText,
          courseTitle: course.title,
          courseCode: course.code,
          unitTitle: currentUnit?.title || '',
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text.slice(0, 80)}`);
      }

      if (data.questions && Array.isArray(data.questions)) {
        setParsedItems(data.questions);
      } else if (data.error) {
        setErrorMessage(data.error);
      }
    } catch (err: any) {
      console.error('Error parsing bulk questions:', err);
      setErrorMessage(err.message || 'Failed to parse questions from text');
    } finally {
      setIsParsingBulk(false);
    }
  };

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setErrorMessage('Question title or description is required.');
      return;
    }

    const calculatedSection = getSectionForMarks(marks);

    try {
      setIsSaving(true);
      setErrorMessage(null);
      await onSaveQuestion({
        courseId: course.id,
        unitId: selectedUnitId,
        question: question.trim(),
        answer: answer.trim() || `PDF document: ${pdfFileName || 'Question Paper'}`,
        marks: Number(marks) || defaultMarks || 5,
        section: calculatedSection,
        answerFormat,
        isCurated: true,
        thinkingUsed: useThinking,
        groundedInSearch: true,
        modelUsed,
        sourceBooks: sourcesList.join(', ') || books.map((b) => b.title).join(', '),
        webSources: webSourcesList,
        pdfDataUrl: pdfFileData || undefined,
        pdfFileName: pdfFileName || undefined,
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

  const handleSaveAllBulk = async () => {
    if (parsedItems.length === 0) return;
    try {
      setIsSaving(true);
      setErrorMessage(null);
      for (const item of parsedItems) {
        const m = Number(item.marks) || 5;
        const sec = item.section || getSectionForMarks(m);
        await onSaveQuestion({
          courseId: course.id,
          unitId: selectedUnitId,
          question: item.question,
          answer: item.answer,
          marks: m,
          section: sec,
          answerFormat: course.answerFormat || 'detailed',
          isCurated: true,
          thinkingUsed: false,
          groundedInSearch: true,
          modelUsed: 'AI Bulk Parser (Gemini)',
          sourceBooks: books.map((b) => b.title).join(', '),
          webSources: [],
          askedBy: userId,
          askedByName: `${userName} (Admin Bulk Curated)`,
        });
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving bulk questions:', err);
      setErrorMessage('Failed to save bulk questions: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-stone-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-stone-100">Curated Exam Questions & Sections</h2>
              <p className="text-xs text-stone-400">
                Add single questions or bulk-paste exam text to auto-organize into Groups A, B, C, D by marks
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

        {/* Mode Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 bg-stone-900 border-b border-stone-800">
          <button
            onClick={() => setModalMode('single')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              modalMode === 'single'
                ? 'border-amber-500 text-amber-300 bg-stone-800/80'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            Single Question (Manual / AI Generate)
          </button>
          <button
            onClick={() => setModalMode('bulk')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              modalMode === 'bulk'
                ? 'border-amber-500 text-amber-300 bg-stone-800/80'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            Bulk Paste Multiple Questions (Auto-Parse Sections)
          </button>
        </div>

        {/* Target Unit & Content */}
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

          {/* Unit selector shared */}
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

          {modalMode === 'single' ? (
            <form onSubmit={handleSubmitSingle} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-mono text-stone-300 uppercase mb-1.5">
                    Question Formulation *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Derive the conditions under which Raft prevents split votes..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg p-3 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-stone-300 uppercase mb-1.5">
                    Marks Distribution *
                  </label>
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {[1, 2, 5, 8].map((m) => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setMarks(m)}
                        className={`py-1.5 rounded text-xs font-mono font-bold transition-all ${
                          marks === m
                            ? 'bg-amber-500 text-stone-950 shadow'
                            : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                        }`}
                      >
                        {m}M
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={marks}
                    onChange={(e) => setMarks(Number(e.target.value) || 5)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <div className="mt-2 text-[11px] font-mono text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20 text-center">
                    Section: <strong className="font-bold">{getSectionForMarks(marks)}</strong>
                  </div>
                </div>
              </div>

              {/* Admin Format */}
              <div className="bg-stone-850 p-3.5 rounded-xl border border-stone-800">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-mono uppercase text-stone-200 font-semibold">
                    Answer Format
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {ANSWER_FORMATS.map((fmt) => (
                    <button
                      type="button"
                      key={fmt.id}
                      onClick={() => setAnswerFormat(fmt.id)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        answerFormat === fmt.id
                          ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                          : 'border-stone-700 bg-stone-800 text-stone-300 hover:border-stone-600'
                      }`}
                    >
                      <div className="font-semibold text-stone-100">{fmt.label}</div>
                      <div className="text-[10px] text-stone-400 line-clamp-1 mt-0.5">{fmt.recommendedFor}</div>
                    </button>
                  ))}
                </div>
              </div>

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
                      Upload the official PDF for this {marks}M tier. Users will be able to view and download it directly.
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

              {/* Submit Single */}
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
                  <span>{isSaving ? 'Saving...' : 'Save Question to Unit'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                <div className="font-semibold text-amber-300 mb-1">Bulk Question Paste & Auto-Grouping</div>
                Paste raw text containing multiple questions, exam papers, or question banks below. AI will automatically parse individual questions, generate answers, determine marks, and assign them to <strong>Groups A, B, C, D</strong> according to their marks:
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                  <span className="bg-stone-800 p-1.5 rounded border border-stone-700">Group A: 1-2M</span>
                  <span className="bg-stone-800 p-1.5 rounded border border-stone-700">Group B: 3-5M</span>
                  <span className="bg-stone-800 p-1.5 rounded border border-stone-700">Group C: 6-10M</span>
                  <span className="bg-stone-800 p-1.5 rounded border border-stone-700">Group D: 11+M</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-stone-300 uppercase mb-1.5">
                  Raw Exam / Question Text *
                </label>
                <textarea
                  rows={6}
                  placeholder="Paste multiple questions here (e.g. 1. What is virtual memory? [2 marks]\n2. Explain paging and segmentation in detail [10 marks]...)"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg p-3 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParseBulkText}
                  disabled={isParsingBulk || !bulkText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold shadow transition-all disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isParsingBulk ? 'Parsing Questions & Sections with AI...' : 'Parse & Extract Questions into Groups A,B,C,D'}</span>
                </button>
              </div>

              {parsedItems.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-stone-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-200">
                      Extracted Questions Preview ({parsedItems.length})
                    </span>
                    <span className="text-amber-400 font-mono">Ready to Save</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {parsedItems.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-stone-800 border border-stone-700 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-stone-100">
                            Q{idx + 1}: {item.question}
                          </span>
                          <div className="flex items-center gap-2 font-mono shrink-0">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                              {item.marks} Marks
                            </span>
                            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
                              {item.section || getSectionForMarks(item.marks)}
                            </span>
                          </div>
                        </div>
                        <p className="text-stone-400 line-clamp-2 text-[11px] font-mono">{item.answer}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAllBulk}
                      disabled={isSaving}
                      className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isSaving ? 'Saving All...' : `Save All ${parsedItems.length} Questions to Unit`}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
