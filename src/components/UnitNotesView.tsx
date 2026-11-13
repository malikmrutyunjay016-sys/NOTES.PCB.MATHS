import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  HelpCircle,
  Plus,
  FileText,
  Layers,
  BookMarked,
  ChevronDown,
  ChevronUp,
  Globe,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { Course, Unit, Book, Question, getSectionForMarks } from '../types';
import { MarkdownView } from './MarkdownView';

const ROMAN_NUMERALS: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
};

const toRoman = (num: number) => ROMAN_NUMERALS[num] || String(num);

interface UnitNotesViewProps {
  course: Course;
  units: Unit[];
  activeUnit: Unit | null;
  onSelectUnit: (unit: Unit) => void;
  books: Book[];
  questions: Question[];
  isAdmin: boolean;
  onOpenAddQuestion: (unitId: string) => void;
  onUpdateUnitNotes: (unitId: string, newNotes: string) => Promise<void>;
  onAskQuestionAboutUnit: (unit: Unit) => void;
  onOpenEditCourse?: () => void;
  onSaveQuestion?: (q: Omit<Question, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteQuestion?: (questionId: string) => Promise<void>;
  userId?: string;
  userName?: string;
}

export const UnitNotesView: React.FC<UnitNotesViewProps> = ({
  course,
  units,
  activeUnit,
  onSelectUnit,
  books,
  questions,
  isAdmin,
  onOpenAddQuestion,
  onUpdateUnitNotes,
  onAskQuestionAboutUnit,
  onOpenEditCourse,
  onSaveQuestion,
  onDeleteQuestion,
  userId,
  userName,
}) => {
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);

  const sortedUnits = [...units].sort((a, b) => a.unitNumber - b.unitNumber);
  const currentUnit = activeUnit || sortedUnits[0] || null;

  // Filter questions attached to this unit
  const unitQuestions = questions.filter(
    (q) => q.courseId === course.id && (q.unitId === currentUnit?.id || !q.unitId)
  );

  const toggleQuestion = (qId: string) => {
    setExpandedQuestions((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleUploadPdfQuestions = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUnit) return;

    try {
      setIsExtractingPdf(true);
      setErrorMessage(null);

      const reader = new FileReader();
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        try {
          const res = await fetch('/api/gemini/extract-pdf-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64Data: base64String,
              mimeType: file.type || 'application/pdf',
              fileName: file.name,
              courseTitle: course.title,
              courseCode: course.code,
              unitTitle: currentUnit.title,
            }),
          });

          const data = await res.json();
          if (data.questions && Array.isArray(data.questions)) {
            if (onSaveQuestion) {
              await Promise.all(
                data.questions.map((item: any) => {
                  const rawMarksStr = String(item.marks || '5');
                  const matchedNum = parseInt(rawMarksStr.replace(/\D/g, ''), 10);
                  const m = isNaN(matchedNum) ? 5 : matchedNum;
                  const sec = item.group || item.section || getSectionForMarks(m);
                  let targetUnitId = currentUnit.id;
                  if (item.unitNumber) {
                    const foundUnit = units.find((u) => u.unitNumber === Number(item.unitNumber));
                    if (foundUnit) {
                      targetUnitId = foundUnit.id;
                    }
                  }

                  return onSaveQuestion({
                    courseId: course.id,
                    unitId: targetUnitId,
                    question: item.question,
                    answer: item.answer,
                    marks: m,
                    section: sec,
                    answerFormat: course.answerFormat || 'detailed',
                    isCurated: true,
                    thinkingUsed: false,
                    groundedInSearch: true,
                    modelUsed: `PDF Question Bank Extractor (${file.name})`,
                    sourceBooks: books.map((b) => b.title).join(', '),
                    webSources: [],
                    askedBy: userId || 'guest-admin',
                    askedByName: `${userName || 'Admin'} (${sec} • ${m}M Extracted)`,
                  });
                })
              );
            }
          } else if (data.error) {
            setErrorMessage(data.error);
          }
        } catch (apiErr: any) {
          setErrorMessage(apiErr.message || 'Failed to extract Q&A from PDF');
        } finally {
          setIsExtractingPdf(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsExtractingPdf(false);
      setErrorMessage(err.message || 'Error reading PDF file');
    }
  };

  // Group questions into sections Group A, B, C, D sorted by marks (1, 2, 5, 8 marks distribution)
  const sectionsConfig = [
    { key: 'Group A', label: 'Group A (1 Mark • Objective & Very Short)' },
    { key: 'Group B', label: 'Group B (2 Marks • Short Answer)' },
    { key: 'Group C', label: 'Group C (5 Marks • Medium Descriptive)' },
    { key: 'Group D', label: 'Group D (8 Marks • Long Answer / Essay)' },
  ];

  const groupedQuestions: Record<string, Question[]> = {
    'Group A': [],
    'Group B': [],
    'Group C': [],
    'Group D': [],
  };

  for (const q of unitQuestions) {
    const sec = getSectionForMarks(q.marks);
    if (groupedQuestions[sec]) {
      groupedQuestions[sec].push(q);
    } else if (q.section && groupedQuestions[q.section]) {
      groupedQuestions[q.section].push(q);
    } else {
      groupedQuestions['Group B'].push(q);
    }
  }

  for (const key of Object.keys(groupedQuestions)) {
    groupedQuestions[key].sort((a, b) => (a.marks || 5) - (b.marks || 5));
  }

  if (sortedUnits.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
        <Layers className="w-12 h-12 text-amber-500/60 mx-auto mb-3" />
        <h3 className="font-serif font-bold text-xl text-stone-800">No Syllabus Units Configured</h3>
        <p className="text-sm text-stone-500 max-w-md mx-auto mt-2">
          {isAdmin
            ? 'Upload a syllabus PDF, photo, or text file to have AI automatically separate it into units and compile study notes.'
            : 'The course syllabus is being organized into units. Please check back shortly.'}
        </p>
        {isAdmin && onOpenEditCourse && (
          <button
            onClick={onOpenEditCourse}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow transition-all"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Upload Syllabus (PDF / Photo / Text)</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span className="font-medium">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-2 px-1"
          >
            ✕
          </button>
        </div>
      )}
      {/* Unit Selector Tabs */}
      <div className="bg-stone-900 rounded-2xl border border-stone-800 p-3 shadow-md">
        <div className="text-[11px] font-mono text-stone-400 uppercase tracking-wider px-2 mb-2">
          Syllabus Units ({sortedUnits.length})
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {sortedUnits.map((unit) => {
            const isSelected = currentUnit?.id === unit.id;
            return (
              <button
                key={unit.id}
                onClick={() => onSelectUnit(unit)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-left transition-all flex items-center gap-3 ${
                  isSelected
                    ? 'bg-amber-500 text-stone-950 font-semibold shadow-md'
                    : 'bg-stone-800/80 hover:bg-stone-800 text-stone-300'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                    isSelected ? 'bg-stone-950 text-amber-400' : 'bg-stone-700 text-stone-300'
                  }`}
                >
                  {toRoman(unit.unitNumber)}
                </div>
                <div className="text-left">
                  <div className="text-xs truncate max-w-[180px] sm:max-w-[220px] font-medium">
                    {unit.title}
                  </div>
                  {unit.topics && (
                    <div
                      className={`text-[10px] truncate max-w-[180px] sm:max-w-[220px] ${
                        isSelected ? 'text-stone-900/80' : 'text-stone-400'
                      }`}
                    >
                      {unit.topics}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Unit Card */}
      {currentUnit && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden">
          {/* Unit Banner Header */}
          <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-stone-100 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-semibold">
                    Unit {toRoman(currentUnit.unitNumber)}
                  </span>
                  <span className="text-xs text-stone-400 font-mono">
                    {course.code} • {course.semester || 'Academic Syllabus'}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-50 tracking-tight">
                  {currentUnit.title}
                </h2>
                {currentUnit.topics && (
                  <p className="text-xs md:text-sm text-stone-300 mt-2 font-mono bg-stone-950/40 p-2.5 rounded-lg border border-stone-800/80">
                    <span className="text-amber-400 font-semibold">Syllabus Scope: </span>
                    {currentUnit.topics}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Ask Question on this Unit */}
                <button
                  onClick={() => onAskQuestionAboutUnit(currentUnit)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition-colors shadow"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ask AI on Unit</span>
                </button>
              </div>
            </div>
          </div>

          {/* Unit Content & Markdown Notes */}
          <div className="p-6 md:p-10">
            {/* Reference Books Active */}
            <div className="mb-6 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-amber-700" />
                <span className="font-semibold">Synthesized with Reference Books:</span>
                <span className="text-stone-600">
                  {books.length > 0 ? books.map((b) => b.title).join(', ') : 'No books uploaded yet.'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-amber-800 uppercase px-2 py-0.5 rounded bg-amber-100">
                Format: {course.answerFormat || 'Detailed Academic'}
              </span>
            </div>

            {/* Rendered Notes */}
            <div className="max-w-none text-stone-800">
              <MarkdownView content={currentUnit.notes || 'No detailed notes generated yet.'} />
            </div>

            {/* Admin PDF Question Bank Box Above Unit Questions */}
            {isAdmin && (
              <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 text-[10px] font-mono font-bold">
                      Admin Question Bank OCR
                    </span>
                    <span className="text-xs text-stone-500 font-mono">PDF Question Paper & Answer Parser</span>
                  </div>
                  <h4 className="font-serif font-bold text-stone-900 text-base md:text-lg">
                    Upload Exam Question Bank PDF (Questions, Answers, Groups, Marks & Units)
                  </h4>
                  <p className="text-xs text-stone-600 max-w-2xl leading-relaxed">
                    Upload a PDF containing exam questions and answers. Gemini will automatically extract information about questions, answers, groups (A, B, C, D), marks (1M, 2M, 5M, 8M), and syllabus units, categorizing them immediately below.
                  </p>
                </div>
                <div className="shrink-0">
                  <label className={`cursor-pointer inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition-all ${isExtractingPdf ? 'opacity-50 pointer-events-none' : ''}`}>
                    <FileText className="w-4 h-4" />
                    <span>{isExtractingPdf ? 'Extracting Q&A, Groups & Marks...' : 'Upload Question Bank PDF'}</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleUploadPdfQuestions}
                      disabled={isExtractingPdf}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Categorized Unit Questions by Group & Marks */}
            {unitQuestions.length > 0 && (
              <div className="mt-8 space-y-6">
                {sectionsConfig.map((sec) => {
                  const secQuestions = groupedQuestions[sec.key] || [];
                  if (secQuestions.length === 0) return null;

                  return (
                    <div key={sec.key} className="space-y-3">
                      <div className="flex items-center gap-3 bg-stone-900 text-stone-100 px-4 py-2.5 rounded-xl shadow-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                        <span className="text-xs font-mono font-bold uppercase tracking-wider">{sec.label}</span>
                        <span className="ml-auto text-[11px] font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-300">
                          {secQuestions.length} {secQuestions.length === 1 ? 'Question' : 'Questions'}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {secQuestions.map((q, idx) => {
                          const isExpanded = Boolean(expandedQuestions[q.id]);
                          return (
                            <div
                              key={q.id}
                              className="rounded-xl border border-stone-200 bg-stone-50 hover:border-amber-300 transition-all overflow-hidden shadow-xs"
                            >
                              <button
                                onClick={() => toggleQuestion(q.id)}
                                className="w-full text-left p-4 flex items-start justify-between gap-3"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                                    {q.marks ? `${q.marks}M` : `${idx + 1}`}
                                  </span>
                                  <div>
                                    <div className="font-semibold text-stone-900 text-sm leading-snug">
                                      {q.question}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-stone-500 font-mono">
                                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                                        {sec.key} • {q.marks || 5} {Number(q.marks) === 1 ? 'Mark' : 'Marks'}
                                      </span>
                                      <span>•</span>
                                      <span>{q.askedByName || 'Course Admin'}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isAdmin && onDeleteQuestion && (
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteQuestion(q.id);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.stopPropagation();
                                          onDeleteQuestion(q.id);
                                        }
                                      }}
                                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                      title="Delete Question"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                  <div className="p-1 text-stone-400">
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </div>
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="p-5 pt-0 border-t border-stone-200/80 bg-white">
                                  <div className="text-xs text-stone-500 font-mono uppercase mb-2 mt-3">Model Answer:</div>
                                  <MarkdownView content={q.answer} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
