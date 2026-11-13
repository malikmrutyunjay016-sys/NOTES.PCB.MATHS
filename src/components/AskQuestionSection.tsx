import React, { useState } from 'react';
import {
  MessageSquare,
  Sparkles,
  Brain,
  Globe,
  BookOpen,
  Send,
  Sliders,
  BookmarkPlus,
  Check,
  Copy,
  ChevronDown,
  ExternalLink,
  BookMarked,
} from 'lucide-react';
import { Course, Unit, Book, Question, ANSWER_FORMATS } from '../types';
import { MarkdownView } from './MarkdownView';

interface AskQuestionSectionProps {
  course: Course;
  units: Unit[];
  books: Book[];
  prefilledUnit?: Unit | null;
  onSaveToNotes: (q: Omit<Question, 'id' | 'createdAt'>) => Promise<void>;
  userId: string;
  userName: string;
  isAdmin: boolean;
}

export const AskQuestionSection: React.FC<AskQuestionSectionProps> = ({
  course,
  units,
  books,
  prefilledUnit,
  onSaveToNotes,
  userId,
  userName,
  isAdmin,
}) => {
  const [question, setQuestion] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>(prefilledUnit?.id || '');
  const [answerFormat, setAnswerFormat] = useState<string>(course.answerFormat || 'detailed');
  const [useThinking, setUseThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(true); // Default to Google Search per requirement
  const [loading, setLoading] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<{
    text: string;
    modelUsed: string;
    sources: string[];
    webSources?: Array<{ title: string; uri: string }>;
    webSearchQueries?: string[];
    groundedInSearch?: boolean;
    thinkingUsed?: boolean;
  } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Suggested questions based on course
  const samplePrompts = course.code.includes('CS')
    ? [
        'How does Raft elect a new leader and prevent split votes?',
        'What is the difference between Linearizability and Eventual Consistency?',
        'Explain Quorum Reads and Writes (W + R > N) with a failure scenario.',
      ]
    : [
        'Derive the mathematical formulation of Scaled Dot-Product Attention.',
        'Why does softmax saturate when key dimension d_k is large?',
        'Compare Multi-Head Attention vs single-head attention with mathematical proofs.',
      ];

  const handleAsk = async (queryText?: string) => {
    const q = queryText || question;
    if (!q.trim()) return;

    try {
      setLoading(true);
      setIsSaved(false);
      setErrorMessage(null);

      const targetUnit = units.find((u) => u.id === selectedUnitId);

      const res = await fetch('/api/gemini/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q.trim(),
          courseTitle: course.title,
          courseCode: course.code,
          syllabusContext: course.syllabusText,
          unitTitle: targetUnit?.title || '',
          referenceBooks: books.map((b) => ({
            title: b.title,
            author: b.author,
            edition: b.edition,
            fileName: b.fileName,
            excerpt: b.excerpt,
            content: b.content,
          })),
          answerFormat,
          useThinking,
          useSearch: true, // Always search live Google web + cross-reference books
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const rawText = await res.text();
        throw new Error(`Server returned error (${res.status}): ${rawText.slice(0, 80)}`);
      }

      if (data.answer) {
        setCurrentAnswer({
          text: data.answer,
          modelUsed: data.modelUsed,
          sources: data.sources || [],
          webSources: data.webSources || [],
          webSearchQueries: data.webSearchQueries,
          groundedInSearch: data.groundedInSearch !== false,
          thinkingUsed: data.thinkingUsed,
        });
      } else if (data.error) {
        setErrorMessage(data.error);
      }
    } catch (err: any) {
      console.error('Error asking question:', err);
      setErrorMessage(err.message || 'Failed to generate answer.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToNotes = async () => {
    if (!currentAnswer || !question.trim()) return;
    try {
      setErrorMessage(null);
      await onSaveToNotes({
        courseId: course.id,
        unitId: selectedUnitId || (units[0]?.id || ''),
        question: question.trim(),
        answer: currentAnswer.text,
        answerFormat,
        isCurated: isAdmin,
        thinkingUsed: currentAnswer.thinkingUsed,
        groundedInSearch: currentAnswer.groundedInSearch,
        modelUsed: currentAnswer.modelUsed,
        sourceBooks: currentAnswer.sources.join(', '),
        webSources: currentAnswer.webSources || [],
        askedBy: userId,
        askedByName: userName,
      });
      setIsSaved(true);
    } catch (err: any) {
      console.error('Error saving to notes:', err);
      setErrorMessage('Could not save to notes: ' + err.message);
    }
  };

  const copyAnswer = () => {
    if (!currentAnswer) return;
    navigator.clipboard.writeText(currentAnswer.text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Search & Prompt Box */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-stone-900">
              Ask Reference Books & Syllabus Intelligence
            </h2>
            <p className="text-xs text-stone-500">
              Answers are summarized, accurate, and mathematically grounded in uploaded textbooks for {course.code}
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Generation Notice:</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 hover:text-rose-900 font-bold ml-2 px-1.5 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input Textarea */}
        <div className="mt-4">
          <textarea
            rows={3}
            placeholder={`Ask any question about ${course.code} syllabus or uploaded reference books...`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full bg-stone-50 border border-stone-300 rounded-xl p-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 leading-relaxed transition-all"
          />
        </div>

        {/* Suggested Prompts */}
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <span className="text-[11px] font-mono text-stone-400 uppercase">Suggested:</span>
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuestion(p);
                handleAsk(p);
              }}
              className="text-xs text-stone-600 hover:text-amber-800 bg-stone-100 hover:bg-amber-50/80 px-2.5 py-1 rounded-full border border-stone-200 transition-colors truncate max-w-xs"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Configuration Row: Thinking, Search Grounding, Format, Scope */}
        <div className="mt-6 pt-5 border-t border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Controls: Thinking Mode & Search Grounding */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Thinking Mode Toggle (gemini-4-argon with ThinkingLevel.HIGH) */}
            <label
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                useThinking
                  ? 'bg-purple-50 text-purple-900 border-purple-300 font-medium shadow-sm'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300'
              }`}
            >
              <input
                type="checkbox"
                checked={useThinking}
                onChange={(e) => {
                  setUseThinking(e.target.checked);
                  if (e.target.checked) setUseSearch(false);
                }}
                className="hidden"
              />
              <Brain className={`w-4 h-4 ${useThinking ? 'text-purple-600' : 'text-stone-400'}`} />
              <span>Deep Thinking (gemini-3.8-flash)</span>
            </label>

            {/* Google Search Grounding Toggle (gemini-3.8-flash with googleSearch) */}
            <label
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                useSearch
                  ? 'bg-sky-50 text-sky-900 border-sky-300 font-medium shadow-sm'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300'
              }`}
            >
              <input
                type="checkbox"
                checked={useSearch}
                onChange={(e) => {
                  setUseSearch(e.target.checked);
                  if (e.target.checked) setUseThinking(false);
                }}
                className="hidden"
              />
              <Globe className={`w-4 h-4 ${useSearch ? 'text-sky-600' : 'text-stone-400'}`} />
              <span>Google Search Grounding</span>
            </label>

            {/* Answer Format Selector */}
            <div className="flex items-center gap-1.5 text-xs text-stone-600">
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              <span>Format:</span>
              <select
                value={answerFormat}
                onChange={(e) => setAnswerFormat(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-lg py-1 px-2 text-xs text-stone-800 font-medium focus:outline-none focus:border-amber-500"
              >
                {ANSWER_FORMATS.map((fmt) => (
                  <option key={fmt.id} value={fmt.id}>
                    {fmt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Syllabus Unit Scope */}
            {units.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-stone-600">
                <span>Unit Scope:</span>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-lg py-1 px-2 text-xs text-stone-800 focus:outline-none focus:border-amber-500 max-w-[160px] truncate"
                >
                  <option value="">Full Course Scope</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unitNumber}: {u.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Ask Button */}
          <button
            onClick={() => handleAsk()}
            disabled={loading || !question.trim()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold text-xs shadow-md transition-all disabled:opacity-40"
          >
            {loading ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Consulting Reference Books...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Ask Question</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Answer Output Card */}
      {currentAnswer && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Answer Metadata Bar */}
          <div className="bg-stone-900 text-stone-100 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-800">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="font-mono text-amber-400 font-semibold">{currentAnswer.modelUsed}</span>
              {currentAnswer.thinkingUsed && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono">
                  Thinking Level: HIGH
                </span>
              )}
              {currentAnswer.groundedInSearch && (
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-mono flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Web Grounded
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Copy */}
              <button
                onClick={copyAnswer}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium transition-colors"
                title="Copy answer markdown"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>

              {/* Add to Notes */}
              <button
                onClick={handleSaveToNotes}
                disabled={isSaved}
                className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-all ${
                  isSaved
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                }`}
                title="Save this question & answer directly to official course unit notes"
              >
                {isSaved ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                <span>{isSaved ? 'Saved to Notes!' : 'Pin / Add to Notes'}</span>
              </button>
            </div>
          </div>

          {/* Reference Book Citations & Web Sources Bar */}
          <div className="bg-stone-50 border-b border-stone-200 divide-y divide-stone-200/70 text-xs">
            {/* Textbook Referral */}
            {currentAnswer.sources.length > 0 && (
              <div className="bg-amber-50/80 px-6 py-2.5 flex items-center gap-2 text-amber-950">
                <BookMarked className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-semibold text-amber-900">Reference Books Consulted:</span>
                <span className="text-stone-700 truncate">{currentAnswer.sources.join(' • ')}</span>
              </div>
            )}

            {/* Google Search Web Grounding Sources */}
            {currentAnswer.webSources && currentAnswer.webSources.length > 0 && (
              <div className="bg-sky-50/80 px-6 py-2.5 flex flex-wrap items-center gap-2 text-sky-950">
                <Globe className="w-4 h-4 text-sky-700 shrink-0" />
                <span className="font-semibold text-sky-900">Google Search Verified Sources:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {currentAnswer.webSources.map((ws, idx) => (
                    <a
                      key={idx}
                      href={ws.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-800 hover:text-sky-950 hover:border-sky-400 text-[11px] font-medium transition-colors shadow-2xs max-w-[240px] truncate"
                    >
                      <span className="truncate">{ws.title || ws.uri}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Google Search Queries */}
            {currentAnswer.webSearchQueries && currentAnswer.webSearchQueries.length > 0 && (
              <div className="px-6 py-1.5 flex items-center gap-2 text-[11px] text-stone-500 bg-stone-50">
                <span className="font-mono text-stone-400">Search Queries:</span>
                <div className="flex flex-wrap items-center gap-1">
                  {currentAnswer.webSearchQueries.map((q, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 rounded bg-stone-200/80 text-stone-700 font-mono text-[10px]">
                      "{q}"
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Answer Markdown Body */}
          <div className="p-6 md:p-8">
            <MarkdownView content={currentAnswer.text} />
          </div>
        </div>
      )}
    </div>
  );
};
