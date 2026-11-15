import React, { useState } from 'react';
import {
  X,
  GraduationCap,
  Sparkles,
  BookOpen,
  Sliders,
  CheckCircle2,
  Layers,
  FileText,
  Upload,
  Image as ImageIcon,
  FileUp,
  Loader2,
  FileCheck,
  HelpCircle,
  Trash2,
  Code2,
} from 'lucide-react';
import { Course, Unit, ANSWER_FORMATS } from '../types';
import {
  ExtractedPracticalQuestion,
  extractPracticalQuestionsFromUpload,
} from '../lib/practicalExtraction';

interface CourseEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseToEdit?: Course | null;
  onSaveCourse: (
    course: Course,
    initialUnits?: Array<Omit<Unit, 'id' | 'createdAt'>>,
    initialPracticalQuestions?: ExtractedPracticalQuestion[]
  ) => Promise<void>;
  userId: string;
}

export const CourseEditorModal: React.FC<CourseEditorModalProps> = ({
  isOpen,
  onClose,
  courseToEdit,
  onSaveCourse,
  userId,
}) => {
  const [code, setCode] = useState(courseToEdit?.code || '');
  const [title, setTitle] = useState(courseToEdit?.title || '');
  const [department, setDepartment] = useState(courseToEdit?.department || '');
  const [semester, setSemester] = useState(courseToEdit?.semester || '');
  const [description, setDescription] = useState(courseToEdit?.description || '');
  const [paperType, setPaperType] = useState<'theory' | 'practical'>(courseToEdit?.paperType || 'theory');
  const [programmingLanguage, setProgrammingLanguage] = useState(courseToEdit?.programmingLanguage || '');
  const [answerFormat, setAnswerFormat] = useState(courseToEdit?.answerFormat || 'detailed');
  const [syllabusText, setSyllabusText] = useState(courseToEdit?.syllabusText || '');

  // File extraction state for PDF / Photo / Text (Theory Syllabus)
  const [isExtractingSyllabus, setIsExtractingSyllabus] = useState(false);
  const [syllabusFileName, setSyllabusFileName] = useState('');
  const [extractionMessage, setExtractionMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Practical Paper Photo/PDF Question Extraction state
  const [isExtractingPractical, setIsExtractingPractical] = useState(false);
  const [practicalMessage, setPracticalMessage] = useState('');
  const [extractedPracticalQuestions, setExtractedPracticalQuestions] = useState<ExtractedPracticalQuestion[]>([]);

  const [isParsingSyllabus, setIsParsingSyllabus] = useState(false);
  const [parsedUnits, setParsedUnits] = useState<Array<{ unitNumber: number; title: string; topics: string; summary: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  // Instant <5ms client-side parser for syllabus text with Unit/Module headings
  const tryClientRegexSyllabusParse = (rawSyllabus: string) => {
    const text = rawSyllabus.replace(/\r\n/g, '\n').trim();
    if (!text) return null;

    const unitHeadingRegex = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:UNIT|MODULE)\s*[-–—:]?\s*(I{1,3}|IV|V|VI{0,3}|IX|X|\d+)\s*[-–—:.)]?\s*([^\n]*)/gi;
    const matches = Array.from(text.matchAll(unitHeadingRegex));
    if (matches.length < 2) return null;

    const romanToNum: Record<string, number> = {
      I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
    };

    return matches.map((match, idx) => {
      const rawNum = match[1].toUpperCase();
      const unitNumber = romanToNum[rawNum] || parseInt(rawNum, 10) || idx + 1;
      const romanNumeral = ROMAN_NUMERALS[unitNumber - 1] || String(unitNumber);
      const headingRemainder = (match[2] || '').replace(/^[-–—:]+\s*/, '').trim();

      const startIdx = (match.index || 0) + match[0].length;
      const endIdx = idx + 1 < matches.length ? (matches[idx + 1].index || text.length) : text.length;
      const bodyText = text
        .slice(startIdx, endIdx)
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      let rawTitle = headingRemainder;
      let topics = bodyText;
      if (!rawTitle && bodyText) {
        const firstSplit = bodyText.split(/[:–—.-]/);
        rawTitle = firstSplit[0] && firstSplit[0].length < 65 ? firstSplit[0].trim() : `Core Module ${romanNumeral}`;
      }
      if (!topics) topics = rawTitle;

      const unitTitle = `Unit ${romanNumeral}: ${rawTitle || `Syllabus Unit ${romanNumeral}`}`;
      const summary = `Covers ${topics.slice(0, 180)}${topics.length > 180 ? '...' : ''}`;
      const topicBullets = topics
        .split(/[,;•\n]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => `- **${t}**`)
        .join('\n');

      const notes = `# ${unitTitle}\n\n## 1. Unit Scope & Core Overview\n${summary}\n\n## 2. Syllabus Topics & Module Breakdown\n${topicBullets || `- ${topics}`}\n`;

      return {
        unitNumber,
        romanNumeral,
        title: unitTitle,
        topics,
        summary,
        notes,
      };
    });
  };

  // Fast browser-side image compression to reduce upload payload from ~10MB down to ~120KB in 10ms
  const compressImageForFastOcr = (file: File): Promise<{ base64Data: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1024; // High-speed resolution for text OCR
          let { width, height } = img;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
            resolve({
              base64Data: dataUrl.split(',')[1],
              mimeType: 'image/jpeg',
            });
            return;
          }

          const rawDataUrl = e.target?.result as string;
          resolve({
            base64Data: rawDataUrl.split(',')[1],
            mimeType: file.type || 'image/jpeg',
          });
        };
        img.onerror = () => {
          const rawDataUrl = e.target?.result as string;
          resolve({
            base64Data: rawDataUrl.split(',')[1],
            mimeType: file.type || 'image/jpeg',
          });
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        resolve({ base64Data: '', mimeType: 'image/jpeg' });
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle uploading PDF / Photo / Text file and extracting syllabus text + units in one fast pass
  const handleSyllabusFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSyllabusFileName(file.name);
    setErrorMessage(null);
    const fileType = file.type;
    const fileNameLower = file.name.toLowerCase();

    // 1. Plain text or Markdown file (.txt, .md, .text) - Instantaneous
    if (fileType.startsWith('text/') || fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        if (text) {
          setSyllabusText(text);
          const instantUnits = tryClientRegexSyllabusParse(text);
          if (instantUnits && instantUnits.length > 0) {
            setParsedUnits(instantUnits);
            setExtractionMessage(`✓ Instantly extracted ${instantUnits.length} Units from ${file.name}!`);
          } else {
            setExtractionMessage(`Extracted ${text.length.toLocaleString()} characters from ${file.name}. Splitting units...`);
            await parseUnitsFromText(text);
          }
        }
      };
      reader.readAsText(file);
      e.target.value = '';
      return;
    }

    // 2. Photos / Images or PDF - Single-pass extraction with Gemini 3.1 Flash Lite
    const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(fileNameLower);
    const isPdf = fileType === 'application/pdf' || fileNameLower.endsWith('.pdf');

    if (isImage || isPdf) {
      try {
        setIsExtractingSyllabus(true);
        setExtractionMessage('⚡ Fast single-pass syllabus & unit extraction in progress...');

        let base64Data = '';
        let mimeType = '';

        if (isImage) {
          const compressed = await compressImageForFastOcr(file);
          base64Data = compressed.base64Data;
          mimeType = compressed.mimeType;
        } else {
          base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              resolve(dataUrl.split(',')[1]);
            };
            reader.readAsDataURL(file);
          });
          mimeType = 'application/pdf';
        }

        const res = await fetch('/api/gemini/extract-syllabus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data,
            mimeType,
            fileName: file.name,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        let data: any = {};
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const rawText = await res.text();
          throw new Error(`Server returned unexpected response (${res.status}): ${rawText.slice(0, 80)}`);
        }

        if (data.extractedText) {
          setSyllabusText(data.extractedText);
          if (Array.isArray(data.units) && data.units.length > 0) {
            setParsedUnits(data.units);
            setExtractionMessage(`✓ Extracted syllabus & ${data.units.length} Units from "${file.name}" in one pass!`);
          } else {
            const instantUnits = tryClientRegexSyllabusParse(data.extractedText);
            if (instantUnits && instantUnits.length > 0) {
              setParsedUnits(instantUnits);
              setExtractionMessage(`✓ Extracted syllabus & ${instantUnits.length} Units from "${file.name}"!`);
            } else {
              await parseUnitsFromText(data.extractedText);
            }
          }
        } else if (data.error) {
          setErrorMessage('Extraction failed: ' + data.error);
          setExtractionMessage('Extraction failed. You can paste the syllabus manually.');
        }
      } catch (err: any) {
        console.error('Error in fast syllabus extraction:', err);
        setErrorMessage('Failed to extract syllabus from file: ' + err.message);
        setExtractionMessage('Extraction error.');
      } finally {
        setIsExtractingSyllabus(false);
        e.target.value = '';
      }
    } else {
      setErrorMessage('Please upload a PDF (.pdf), Photo / Image (.jpg, .png, .webp), or Text file (.txt, .md).');
      e.target.value = '';
    }
  };

  const parseUnitsFromText = async (textToParse: string) => {
    if (!textToParse.trim()) return;

    // 1. Try instant <5ms client-side regex extraction first if text has explicit Unit headings
    const instantUnits = tryClientRegexSyllabusParse(textToParse);
    if (instantUnits && instantUnits.length >= 2) {
      setParsedUnits(instantUnits);
      setExtractionMessage(`✓ Instantly extracted ${instantUnits.length} Units (Unit I, II, III, IV) with study notes!`);
      return;
    }

    // 2. Otherwise call fast Gemini 3.1 Flash Lite parser
    try {
      setIsParsingSyllabus(true);
      const res = await fetch('/api/gemini/parse-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syllabusText: textToParse,
          courseTitle: title || code || 'Academic Course',
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      }

      if (data.units && Array.isArray(data.units) && data.units.length > 0) {
        setParsedUnits(data.units);
        setExtractionMessage(`✓ Successfully extracted ${data.units.length} Units (Unit I, II, III, IV) with study notes!`);
      }
    } catch (err: any) {
      console.warn('Unit parse notice:', err);
    } finally {
      setIsParsingSyllabus(false);
    }
  };

  const handleParseSyllabus = async () => {
    if (!syllabusText.trim()) {
      setErrorMessage('Please upload a PDF/photo or enter syllabus text first.');
      return;
    }
    setErrorMessage(null);
    await parseUnitsFromText(syllabusText);
  };

  const handlePracticalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setPracticalMessage('');
    try {
      setIsExtractingPractical(true);
      const extracted = await extractPracticalQuestionsFromUpload({
        file,
        courseCode: code.trim(),
        courseTitle: title.trim(),
      });
      setExtractedPracticalQuestions(extracted);
      setPracticalMessage(
        `Extracted ${extracted.length} practical ${extracted.length === 1 ? 'question' : 'questions'} from "${file.name}". Review or edit below before saving.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to extract practical questions from file.');
    } finally {
      setIsExtractingPractical(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) {
      setErrorMessage('Course code and title are required.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      const courseId = courseToEdit?.id || `course-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
      
      const courseObj: Course = {
        id: courseId,
        code: code.trim(),
        title: title.trim(),
        department: department.trim(),
        semester: semester.trim(),
        description: description.trim(),
        paperType,
        programmingLanguage: paperType === 'practical' ? programmingLanguage.trim() : '',
        syllabusText: paperType === 'theory' ? syllabusText.trim() : '',
        answerFormat: answerFormat,
        createdBy: courseToEdit?.createdBy || userId,
        createdAt: courseToEdit?.createdAt || new Date().toISOString(),
      };

      const unitsToCreate =
        paperType === 'theory'
          ? parsedUnits.map((u: any) => ({
              courseId,
              unitNumber: u.unitNumber,
              title: u.title,
              topics: u.topics,
              summary: u.summary,
              notes: u.notes || `# ${u.title}\n\n*Topics:* ${u.topics}\n\n*Overview:* ${u.summary}`,
              createdBy: userId,
            }))
          : [];

      const practicalQuestionsToCreate =
        paperType === 'practical' && extractedPracticalQuestions.length > 0
          ? extractedPracticalQuestions.filter((item) => item.question.trim().length > 0)
          : undefined;

      await onSaveCourse(
        courseObj,
        unitsToCreate.length > 0 ? unitsToCreate : undefined,
        practicalQuestionsToCreate
      );
      onClose();
    } catch (err: any) {
      console.error('Error saving course:', err);
      setErrorMessage('Failed to save course: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-stone-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-stone-100">
                {courseToEdit ? 'Edit Course / Paper Section' : 'Create New Course / Paper Section'}
              </h2>
              <p className="text-xs text-stone-400">
                Choose Theory (Unit-Wise) or Practical (Question-Wise), then upload materials
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
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
          {/* Top Grid: Code, Title, Dept, Semester */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-stone-300 uppercase mb-1">
                Course / Paper Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CS401, PHY102, MATH301"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-stone-300 uppercase mb-1">
                Course Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Distributed Systems & Consensus"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-stone-300 uppercase mb-1">
                Department / Faculty
              </label>
              <input
                type="text"
                placeholder="e.g. Computer Science & Engineering"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-stone-300 uppercase mb-1">
                Academic Semester
              </label>
              <input
                type="text"
                placeholder="e.g. 5th Semester, Fall 2026"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono text-stone-300 uppercase mb-1">
              Course Description & Learning Scope
            </label>
            <textarea
              rows={2}
              placeholder="Brief overview of course prerequisites and learning outcomes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
            />
          </div>



          {/* Paper Type Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-mono text-stone-300 uppercase">
              Paper Type *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaperType('theory')}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  paperType === 'theory'
                    ? 'bg-amber-500/15 border-amber-500 text-stone-100'
                    : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:border-stone-600'
                }`}
              >
                <Layers className={`w-4 h-4 mt-0.5 shrink-0 ${paperType === 'theory' ? 'text-amber-400' : 'text-stone-400'}`} />
                <div>
                  <div className="text-xs font-semibold text-stone-100">
                    Theory Paper (Unit-Wise)
                  </div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    Organized into Units, Notes, 1M/2M/5M/8M questions &amp; Textbooks
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaperType('practical')}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  paperType === 'practical'
                    ? 'bg-amber-500/15 border-amber-500 text-stone-100'
                    : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:border-stone-600'
                }`}
              >
                <HelpCircle className={`w-4 h-4 mt-0.5 shrink-0 ${paperType === 'practical' ? 'text-amber-400' : 'text-stone-400'}`} />
                <div>
                  <div className="text-xs font-semibold text-stone-100">
                    Practical Paper (Question-Wise)
                  </div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    Question-wise view; extract questions from Photo or PDF
                  </div>
                </div>
              </button>
            </div>
          </div>

          {paperType === 'practical' && (
            <div className="space-y-2.5 bg-stone-850 p-4 rounded-xl border border-stone-800">
              <label className="text-xs font-mono text-stone-200 uppercase font-semibold flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-amber-400" />
                <span>Programming Language</span>
              </label>
              <p className="text-[11px] text-stone-400">
                Choose a preset or enter any programming language used for this practical paper.
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {['Python', 'C', 'C++', 'Java', 'JavaScript', 'SQL', 'R', 'MATLAB', 'Bash'].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setProgrammingLanguage(lang)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                      programmingLanguage.trim().toLowerCase() === lang.toLowerCase()
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-500'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="e.g. Python 3, C++, Java, SQL, MATLAB..."
                value={programmingLanguage}
                onChange={(e) => setProgrammingLanguage(e.target.value)}
                className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {paperType === 'theory' ? (
            /* Upload Syllabus (PDF / Photo / Text) */
            <div className="space-y-3 bg-stone-850 p-4 rounded-xl border border-stone-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-mono text-stone-200 uppercase font-semibold flex items-center gap-1.5">
                    <FileUp className="w-4 h-4 text-amber-400" />
                    <span>Upload Syllabus (PDF, Photo, or Text)</span>
                  </label>
                  <p className="text-[11px] text-stone-400">
                    Upload a photo of your syllabus, a university PDF document, or text file. Gemini extracts all text automatically.
                  </p>
                </div>

                {/* File upload input */}
                <div>
                  <input
                    type="file"
                    id="syllabus-file-input"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md"
                    onChange={handleSyllabusFileUpload}
                    disabled={isExtractingSyllabus}
                    className="hidden"
                  />
                  <label
                    htmlFor="syllabus-file-input"
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/40 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-all shadow-sm"
                  >
                    {isExtractingSyllabus ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Extracting with OCR...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload PDF / Photo / Text</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Status message */}
              {extractionMessage && (
                <div className="p-2.5 rounded-lg bg-stone-900 border border-stone-700/80 text-xs flex items-center gap-2 text-amber-300">
                  <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{extractionMessage}</span>
                </div>
              )}

              {/* Syllabus Text Preview / Editing Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono text-stone-300 uppercase">
                    Extracted Syllabus Content (Editable)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-stone-400">
                      {syllabusText.length.toLocaleString()} characters
                    </span>
                    <button
                      type="button"
                      onClick={handleParseSyllabus}
                      disabled={isParsingSyllabus || !syllabusText.trim()}
                      className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[11px] font-medium transition-colors disabled:opacity-40 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>{isParsingSyllabus ? 'Parsing Units...' : 'Auto-Split into Units'}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={7}
                  placeholder="Upload a PDF/photo above or paste syllabus text containing Unit 1, Unit 2, Unit 3, topics, modules, or chapter descriptions..."
                  value={syllabusText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSyllabusText(val);
                    const instant = tryClientRegexSyllabusParse(val);
                    if (instant && instant.length >= 2) {
                      setParsedUnits(instant);
                      setExtractionMessage(`✓ Instantly extracted ${instant.length} Units from syllabus text!`);
                    }
                  }}
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-xs font-mono text-stone-200 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Parsed Units Preview */}
              {parsedUnits.length > 0 && (
                <div className="p-3 bg-stone-950/70 rounded-xl border border-stone-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase font-semibold">
                    <Layers className="w-4 h-4" />
                    <span>{parsedUnits.length} Units Extracted (Unit I, II, III, IV) — Study Notes Ready</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
                    {parsedUnits.map((u: any) => (
                      <div key={u.unitNumber} className="p-2.5 rounded bg-stone-900 border border-stone-800 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-300">
                            {u.title.startsWith('Unit') ? u.title : `Unit ${u.romanNumeral || u.unitNumber}: ${u.title}`}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                            Notes Compiled ✓
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 font-mono mt-1 line-clamp-2">{u.topics}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Practical Question Paper (Optional Photo / PDF Extraction) */
            <div className="space-y-3 bg-stone-850 p-4 rounded-xl border border-stone-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-mono text-stone-200 uppercase font-semibold flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <span>Practical Question Paper (Optional Photo / PDF Extraction)</span>
                  </label>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Upload a Photo or PDF of the practical manual / question sheet to extract questions now, or add them later inside the Question-Wise view.
                  </p>
                </div>

                <div className="shrink-0">
                  <input
                    type="file"
                    id="practical-file-input-modal"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={handlePracticalFileUpload}
                    disabled={isExtractingPractical}
                    className="hidden"
                  />
                  <label
                    htmlFor="practical-file-input-modal"
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/40 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-all shadow-sm whitespace-nowrap"
                  >
                    {isExtractingPractical ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Extracting Questions...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Photo / PDF</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {practicalMessage && (
                <div className="p-2.5 rounded-lg bg-stone-900 border border-stone-700/80 text-xs flex items-center gap-2 text-emerald-300">
                  <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{practicalMessage}</span>
                </div>
              )}

              {extractedPracticalQuestions.length > 0 && (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {extractedPracticalQuestions.map((draft, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-stone-900 border border-stone-700/80 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-bold text-amber-400">
                          Question {draft.questionNumber || idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExtractedPracticalQuestions((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="p-1 rounded text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition-colors"
                          title="Remove extracted question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={draft.question}
                        onChange={(e) => {
                          const value = e.target.value;
                          setExtractedPracticalQuestions((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, question: value } : item))
                          );
                        }}
                        placeholder="Question statement..."
                        className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                      />
                      <textarea
                        rows={2}
                        value={draft.answer}
                        onChange={(e) => {
                          const value = e.target.value;
                          setExtractedPracticalQuestions((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, answer: value } : item))
                          );
                        }}
                        placeholder="Procedure / solution..."
                        className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2 text-xs font-mono text-stone-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Modal Actions */}
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
              disabled={isSaving || isExtractingSyllabus || isExtractingPractical}
              className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'Saving...'
                  : paperType === 'practical'
                  ? 'Save Practical Paper'
                  : 'Save Syllabus & Course'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
