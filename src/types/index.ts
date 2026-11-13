export interface Course {
  id: string;
  code: string;
  title: string;
  description?: string;
  department?: string;
  semester?: string;
  syllabusText?: string;
  answerFormat?: string; // 'detailed' | 'bullet_summary' | 'qa_formula' | 'conceptual_breakdown' | 'exam_prep'
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Unit {
  id: string;
  courseId: string;
  unitNumber: number;
  title: string;
  topics?: string;
  notes?: string;
  summary?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Book {
  id: string;
  courseId: string;
  title: string;
  author?: string;
  edition?: string;
  fileName?: string;
  fileSize?: number;
  content: string;
  excerpt?: string;
  fileData?: string;
  mimeType?: string;
  createdBy: string;
  createdAt: string;
}

export interface WebGroundingSource {
  title: string;
  uri: string;
}

export interface Question {
  id: string;
  courseId: string;
  unitId?: string;
  question: string;
  answer: string;
  answerFormat?: string;
  marks?: number;
  section?: 'Group A' | 'Group B' | 'Group C' | 'Group D' | string;
  isCurated?: boolean;
  thinkingUsed?: boolean;
  groundedInSearch?: boolean;
  modelUsed?: string;
  sourceBooks?: string;
  webSources?: WebGroundingSource[];
  askedBy: string;
  askedByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export function getSectionForMarks(marks?: number): string {
  const m = marks || 5;
  if (m <= 1) return 'Group A';
  if (m <= 2) return 'Group B';
  if (m <= 5) return 'Group C';
  return 'Group D';
}

export interface AnswerFormatOption {
  id: string;
  label: string;
  description: string;
  sampleStyle: string;
  recommendedFor: string;
}

export const ANSWER_FORMATS: AnswerFormatOption[] = [
  {
    id: 'detailed',
    label: 'Detailed Academic Explanation',
    description: 'Exhaustive thesis-level depth with numbered sections, academic prose, citations, and formal terminology.',
    sampleStyle: 'Multi-paragraph with deep derivations and conceptual grounding.',
    recommendedFor: 'Comprehensive textbook study & university exam prep',
  },
  {
    id: 'bullet_summary',
    label: 'Executive Bullet Points & High-Yield',
    description: 'Punchy key takeaways, bold concept terms, succinct bullet hierarchy, and a 2-minute revision summary.',
    sampleStyle: 'Hierarchical bullets with rapid-scan formatting.',
    recommendedFor: 'Quick revision & last-minute review',
  },
  {
    id: 'qa_formula',
    label: 'Q&A, Worked Examples & Formulas',
    description: 'Step-by-step problem solving, equation proofs, code snippets or mathematical formulation, and worked solutions.',
    sampleStyle: 'Numbered steps, LaTeX-style equations, input/output trace.',
    recommendedFor: 'STEM, Engineering, Mathematics & Coding papers',
  },
  {
    id: 'conceptual_breakdown',
    label: 'Intuitive Conceptual & Case Studies',
    description: 'Clear analogies, real-world case applications, intuitive intuition builders, and common student pitfalls.',
    sampleStyle: 'Analogy + Deep Dive + Practical Application.',
    recommendedFor: 'Foundations, Humanities & Systems architecture',
  },
  {
    id: 'exam_prep',
    label: 'Exam Standard with Marking Scheme',
    description: 'Structured as an optimal 10-mark university question answer, explicit mark distribution, and crucial keywords.',
    sampleStyle: 'Keywords [2M], Core Proof [5M], Conclusion & Graph [3M].',
    recommendedFor: 'Official University Paper & Semester Finals',
  },
];

export interface WordPageSettings {
  pageSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margins: 'normal' | 'narrow' | 'moderate' | 'wide';
  lineSpacing: '1.0' | '1.15' | '1.5' | '2.0';
  defaultFont: string;
  defaultFontSize: number;
  headerText: string;
  footerText: string;
  watermark: string;
  showPageNumbers: boolean;
  showPageBorder: boolean;
  pageColor: string;
}

export interface WordNoteDocument {
  id: string;
  courseId: string;
  unitId?: string;
  title: string;
  subject?: string;
  author: string;
  category?: string;
  keywords?: string;
  status?: 'Draft' | 'Final' | 'Published' | 'Confidential';
  comments?: string;
  htmlContent: string;
  plainText: string;
  pageSettingsJson?: string;
  pdfDataUrl: string;
  pdfFileName: string;
  wordCount: number;
  charCount: number;
  pageCount: number;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

