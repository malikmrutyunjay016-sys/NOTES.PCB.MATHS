import { GoogleGenAI, ThinkingLevel } from '@google/genai';

// Initialize the shared server-side Google GenAI client
const apiKey = process.env.GEMINI_API_KEY || '';

export const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to unwrap and humanize Gemini API error messages
export function formatGeminiError(error: any): string {
  if (!error) return 'An unexpected error occurred with the AI service.';

  let msg = error.message || '';
  let status = error.status || error.code || 0;

  // If the error message is a serialized JSON error object from Google GenAI, unwrap it
  try {
    if (typeof msg === 'string' && (msg.startsWith('{') || msg.includes('{"error"'))) {
      const jsonStart = msg.indexOf('{');
      const jsonEnd = msg.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(msg.slice(jsonStart, jsonEnd + 1));
        if (parsed?.error?.message) {
          msg = parsed.error.message;
        }
        if (parsed?.error?.code) {
          status = parsed.error.code;
        }
      }
    }
  } catch {
    // Keep original msg
  }

  if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded')) {
    return 'Gemini API quota or rate limit exceeded. Please wait a moment or try again later.';
  }
  if (status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
    return 'The AI service is currently experiencing high temporary demand. Please retry in a moment.';
  }
  if (status === 403 || msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
    return 'Gemini API permission denied. Please verify your API key in Settings > Secrets.';
  }
  if (status === 404 || msg.includes('404') || msg.includes('NOT_FOUND')) {
    return 'The requested AI model was not found.';
  }

  return msg || 'Failed to process request with Gemini AI.';
}

// Resilient API call with 1 auto-retry for transient 503 service spikes
export async function callWithRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 400): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const isTransient = err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE') || err?.message?.includes('high demand');
    if (retries > 0 && isTransient) {
      await new Promise(r => setTimeout(r, delayMs));
      return callWithRetry(fn, retries - 1, delayMs * 1.5);
    }
    throw err;
  }
}

// Helper to get minimal thinking config for the chosen model
export function getFastThinkingConfig(modelName: string) {
  if (modelName.startsWith('gemini-4')) {
    return { thinkingLevel: ThinkingLevel.LOW };
  }
  return { thinkingLevel: ThinkingLevel.MINIMAL };
}

// Resilient model fallback wrapper using ultra-fast Gemini models
export async function callGeminiWithModelFallback<T>(callFn: (modelName: string) => Promise<T>): Promise<T> {
  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      return await callWithRetry(() => callFn(model));
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || '';
      const status = err?.status || err?.code || 0;
      const isRateLimit = status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded');
      const isTransient = status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
      const isNotFound = status === 404 || msg.includes('404') || msg.includes('NOT_FOUND');

      if (isRateLimit || isTransient || isNotFound) {
        console.warn(`Model ${model} encountered ${status || 'error'}, trying next fast model fallback...`);
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export interface GenerateAnswerParams {
  question: string;
  courseTitle: string;
  courseCode: string;
  syllabusContext?: string;
  unitTitle?: string;
  referenceBooks: Array<{
    title: string;
    author?: string;
    edition?: string;
    content?: string;
    excerpt?: string;
    fileName?: string;
  }>;
  answerFormat: string;
  useThinking?: boolean;
  useSearch?: boolean;
}

export async function generateNotesAnswer(params: GenerateAnswerParams) {
  const {
    question,
    courseTitle,
    courseCode,
    syllabusContext = '',
    unitTitle = '',
    referenceBooks = [],
    answerFormat = 'Detailed Academic Explanation',
    useThinking = false,
    useSearch = true,
  } = params;

  let formatGuide = '';
  switch (answerFormat) {
    case 'bullet_summary':
      formatGuide = 'Provide clear, concise bullet points, bold key terms, high-yield takeaways, and a 2-sentence executive summary.';
      break;
    case 'qa_formula':
      formatGuide = 'Provide rigorous question breakdown, step-by-step formula derivations/code, key equations in clean markdown, and worked examples.';
      break;
    case 'conceptual_breakdown':
      formatGuide = 'Provide an intuitive conceptual breakdown, real-world analogies, historical/practical context, and common student pitfalls/misconceptions.';
      break;
    case 'exam_prep':
      formatGuide = 'Provide an exam-ready model answer, marking scheme breakdown (marks distribution), crucial keywords examiners look for, and expected diagrams or flowcharts description.';
      break;
    case 'detailed':
    default:
      formatGuide = 'Provide a structured, comprehensive academic explanation with numbered sections, clear headings, definitions, citations to the reference books, and concluding remarks.';
      break;
  }

  const booksText = referenceBooks.length > 0
    ? referenceBooks.map((b, i) => {
        let entry = `--- [REFERENCE BOOK ${i + 1}: "${b.title}" ${b.author ? `by ${b.author}` : ''} ${b.edition ? `(${b.edition})` : ''}] ---`;
        if (b.fileName) entry += `\nFile Attachment: ${b.fileName}`;
        if (b.excerpt) entry += `\nSummary/Overview: ${b.excerpt}`;
        if (b.content && b.content.trim() && !b.content.startsWith('Uploaded file:')) {
          entry += `\nExcerpts/Content:\n${b.content.slice(0, 20000)}`;
        }
        return entry;
      }).join('\n\n')
    : 'No reference books currently attached. Rely primarily on Google Search grounding and syllabus standards.';

  const systemInstruction = `You are "Notes AI", an elite academic professor and syllabus-aligned tutor for the course: "${courseCode}: ${courseTitle}".
Your mission:
1. Answer the question using Google Search as your real-time grounding and fact-verification source.
2. Refer to the course's uploaded reference textbook(s) whenever possible and relevant. Cite the specific textbook title and author, and connect the explanation to the textbook concepts or syllabus.
3. If the reference textbook covers the concept, highlight how it aligns with the search findings (e.g., "As referenced in [Book Title]...").
4. If the reference textbook does not explicitly detail this topic, provide the authoritative answer from Google Search and explicitly note: "This topic is synthesized from verified academic web sources as an extension to [Book Title(s)]."
5. Strictly adhere to this format guideline:
${formatGuide}`;

  const prompt = `Course: ${courseCode} - ${courseTitle}
${unitTitle ? `Current Syllabus Unit: ${unitTitle}\n` : ''}${syllabusContext ? `Syllabus Overview: ${syllabusContext.slice(0, 1500)}\n` : ''}
UPLOADED REFERENCE TEXTBOOKS IN LIBRARY:
${booksText}

QUESTION:
"${question}"

TASK:
Answer the question accurately using Google Search, and refer to the uploaded reference textbook(s) if possible. Follow the chosen format "${answerFormat}".`;

  try {
    if (useThinking && !useSearch) {
      const response = await callGeminiWithModelFallback((modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MEDIUM,
            },
          },
        })
      );
      return {
        answer: response.text || 'No answer generated.',
        modelUsed: 'Deep Thinking + Book Reference',
        sources: referenceBooks.map(b => b.title),
        webSources: [],
        webSearchQueries: [],
        groundedInSearch: false,
        thinkingUsed: true,
      };
    } else {
      const response = await callGeminiWithModelFallback((modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
          },
        })
      );

      const webQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];
      const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      const webSources: Array<{ title: string; uri: string }> = [];
      const seenUris = new Set<string>();
      for (const chunk of searchChunks) {
        if (chunk.web?.uri && !seenUris.has(chunk.web.uri)) {
          seenUris.add(chunk.web.uri);
          webSources.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          });
        }
      }

      return {
        answer: response.text || 'No answer generated.',
        modelUsed: 'Google Search + Book Reference',
        sources: referenceBooks.map(b => b.title),
        webSources,
        webSearchQueries: webQueries,
        groundedInSearch: true,
        thinkingUsed: false,
      };
    }
  } catch (error: any) {
    console.error('Error generating notes answer:', error);
    throw new Error(formatGeminiError(error));
  }
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function buildStructuredUnitNotes(unit: {
  unitNumber: number;
  romanNumeral?: string;
  title: string;
  topics: string;
  summary: string;
  keyPoints?: string[];
}): string {
  const roman = unit.romanNumeral || ROMAN_NUMERALS[unit.unitNumber - 1] || String(unit.unitNumber);
  const cleanTitle = unit.title.startsWith('Unit') ? unit.title : `Unit ${roman}: ${unit.title}`;
  const topicList = unit.topics
    .split(/[,;•\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const bulletTopics = topicList.length > 0
    ? topicList.map((t) => `- **${t}**`).join('\n')
    : `- ${unit.topics}`;

  const keyTakeaways = Array.isArray(unit.keyPoints) && unit.keyPoints.length > 0
    ? unit.keyPoints.map((kp) => `- ${kp}`).join('\n')
    : topicList.slice(0, 5).map((t) => `- Master the foundational principles and exam applications of **${t}**.`).join('\n');

  return `# ${cleanTitle}

## 1. Unit Scope & Core Overview
${unit.summary || `Comprehensive coverage of ${cleanTitle}, focusing on core theoretical concepts and practical applications.`}

## 2. Syllabus Topics & Module Breakdown
${bulletTopics}

## 3. Key Takeaways & Exam Focus
${keyTakeaways}
`;
}

// Fast local regex pre-parser for standard syllabus texts with explicit Unit headings
export function tryFastRegexSyllabusParse(syllabusText: string): Array<{
  unitNumber: number;
  romanNumeral: string;
  title: string;
  topics: string;
  summary: string;
  notes: string;
}> | null {
  const text = syllabusText.replace(/\r\n/g, '\n').trim();
  if (!text) return null;

  // Match headings like "UNIT - I: Title", "Unit 1 - Title", "## UNIT I", "MODULE 1:"
  const unitHeadingRegex = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:UNIT|MODULE)\s*[-–—:]?\s*(I{1,3}|IV|V|VI{0,3}|IX|X|\d+)\s*[-–—:.)]?\s*([^\n]*)/gi;
  const matches = Array.from(text.matchAll(unitHeadingRegex));

  if (matches.length < 2) {
    return null;
  }

  const romanToNum: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  };

  const units = matches.map((match, idx) => {
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
      if (firstSplit[0] && firstSplit[0].length < 65) {
        rawTitle = firstSplit[0].trim();
      } else {
        rawTitle = `Core Module ${romanNumeral}`;
      }
    }
    if (!topics) {
      topics = rawTitle;
    }

    const title = `Unit ${romanNumeral}: ${rawTitle || `Syllabus Unit ${romanNumeral}`}`;
    const summary = `Covers ${topics.slice(0, 180)}${topics.length > 180 ? '...' : ''}`;
    const unitObj = {
      unitNumber,
      romanNumeral,
      title,
      topics,
      summary,
    };

    return {
      ...unitObj,
      notes: buildStructuredUnitNotes(unitObj),
    };
  });

  return units.length >= 2 ? units : null;
}

// Ultra-fast syllabus parser that extracts Unit I, Unit II, Unit III, Unit IV in ~1 second
export async function parseSyllabusIntoUnits(syllabusText: string, courseTitle: string) {
  // 1. Check if we can instantaneously split clear Unit headings via regex first when structured
  const localParsed = tryFastRegexSyllabusParse(syllabusText);
  if (localParsed && localParsed.length >= 2) {
    return localParsed;
  }

  // 2. Otherwise use gemini-3.1-flash-lite with ThinkingLevel.MINIMAL and concise JSON schema
  const prompt = `Extract all syllabus units from the text below for "${courseTitle}".
Normalize units into sequential numbers (1, 2, 3, 4...) and Roman numerals ("I", "II", "III", "IV"...).
Return ONLY a valid JSON array:
[
  {
    "unitNumber": 1,
    "romanNumeral": "I",
    "title": "Unit I: <Short Unit Title>",
    "topics": "<Comma-separated syllabus topics>",
    "summary": "<1-2 sentence overview>",
    "keyPoints": ["<Key concept 1>", "<Key concept 2>", "<Key concept 3>"]
  }
]

Syllabus Text:
${syllabusText.slice(0, 12000)}`;

  try {
    const response = await callGeminiWithModelFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: getFastThinkingConfig(modelName),
        },
      })
    );

    const parsed = JSON.parse(response.text || '[]');
    if (!Array.isArray(parsed)) return [];

    return parsed.map((u: any, idx: number) => {
      const unitNumber = Number(u.unitNumber) || idx + 1;
      const romanNumeral = u.romanNumeral || ROMAN_NUMERALS[unitNumber - 1] || String(unitNumber);
      const title = u.title?.startsWith('Unit') ? u.title : `Unit ${romanNumeral}: ${u.title || `Unit ${romanNumeral}`}`;
      const topics = u.topics || '';
      const summary = u.summary || `Core topics for ${title}.`;
      return {
        unitNumber,
        romanNumeral,
        title,
        topics,
        summary,
        notes: u.notes || buildStructuredUnitNotes({ unitNumber, romanNumeral, title, topics, summary, keyPoints: u.keyPoints }),
      };
    });
  } catch (error: any) {
    console.error('Error parsing syllabus into Unit I, II, III, IV:', error);
    throw new Error(formatGeminiError(error));
  }
}

// Generate comprehensive unit notes from syllabus & reference books
export async function generateUnitNotes(params: {
  courseTitle: string;
  courseCode: string;
  unitNumber: number;
  unitTitle: string;
  topics: string;
  referenceBooks: Array<{ title: string; author?: string; content: string }>;
  answerFormat: string;
}) {
  const { courseTitle, courseCode, unitNumber, unitTitle, topics, referenceBooks, answerFormat } = params;

  const booksText = referenceBooks.length > 0
    ? referenceBooks.map((b, i) => `--- [BOOK ${i + 1}: ${b.title}] ---\n${b.content.slice(0, 20000)}`).join('\n\n')
    : 'Use syllabus topics and academic foundational concepts.';

  const prompt = `Create comprehensive, unit-wise master study notes for:
Course: ${courseCode} - ${courseTitle}
Unit ${unitNumber}: ${unitTitle}
Topics to cover: ${topics}

FORMAT SPECIFICATION:
Adhere to the format: "${answerFormat}".
Include:
1. Executive Unit Overview & Core Objectives
2. In-Depth Syllabus Topic Breakdowns (exhaustive explanations, clear formulas/theorems, code/diagram descriptions)
3. Key Definitions & Glossary
4. Worked Examples / Numerical or Practical Problem Solutions
5. High-Yield Summary Table / Cheatsheet
6. 5 Top Recommended Exam & Practice Questions with brief model answers

REFERENCE BOOKS EXTRACTS:
${booksText}

Generate thorough, high-quality, publishable study notes in rich GitHub Flavored Markdown.`;

  try {
    const response = await callGeminiWithModelFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: `You are a distinguished university professor crafting official lecture notes and study material for students based on uploaded reference textbooks. Write cleanly, thoroughly, and authoritatively.`,
          thinkingConfig: getFastThinkingConfig(modelName),
        },
      })
    );

    return response.text || '';
  } catch (error: any) {
    console.error('Error generating unit notes:', error);
    throw new Error(formatGeminiError(error));
  }
}

// Summarize and index uploaded reference book
export async function summarizeUploadedBook(title: string, author: string, content: string) {
  const prompt = `Analyze this reference book text and generate:
1. A 3-sentence summary of the book and its primary academic domain.
2. A list of 5 key themes/chapters covered.
3. Recommended course subjects it serves.

Book Title: ${title}
Author: ${author}
Excerpt/Text:
${content.slice(0, 15000)}
`;

  try {
    const response = await callGeminiWithModelFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          thinkingConfig: getFastThinkingConfig(modelName),
        },
      })
    );
    return response.text || '';
  } catch (err: any) {
    console.warn('Summarize book error:', err);
    return 'Reference book uploaded successfully to library.';
  }
}

// Single-pass high-speed syllabus extraction + unit splitting from PDF or Photo
export async function extractSyllabusFromFile(params: {
  base64Data: string;
  mimeType: string;
  fileName?: string;
}) {
  const { base64Data, mimeType, fileName = 'syllabus' } = params;

  const promptText = `Extract the syllabus from this document/image ("${fileName}") into structured units (Unit I, II, III, IV...).
Return ONLY a valid JSON object with this exact shape:
{
  "extractedText": "## UNIT - I: <Title>\\n<Topics>\\n\\n## UNIT - II: <Title>\\n<Topics>...",
  "units": [
    {
      "unitNumber": 1,
      "romanNumeral": "I",
      "title": "Unit I: <Unit Title>",
      "topics": "<All topics and subtopics in this unit>",
      "summary": "<1-2 sentence unit summary>"
    }
  ]
}`;

  try {
    const inlinePart = {
      inlineData: {
        mimeType: mimeType || 'application/pdf',
        data: base64Data,
      },
    };
    const textPart = {
      text: promptText,
    };

    const response = await callGeminiWithModelFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: { parts: [inlinePart, textPart] },
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: getFastThinkingConfig(modelName),
        },
      })
    );

    const rawText = response.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Fallback if plain text was returned
      const localUnits = tryFastRegexSyllabusParse(rawText) || [];
      return {
        extractedText: rawText,
        units: localUnits,
      };
    }

    const rawUnits = Array.isArray(parsed.units) ? parsed.units : [];
    const units = rawUnits.map((u: any, idx: number) => {
      const unitNumber = Number(u.unitNumber) || idx + 1;
      const romanNumeral = u.romanNumeral || ROMAN_NUMERALS[unitNumber - 1] || String(unitNumber);
      const title = u.title?.startsWith('Unit') ? u.title : `Unit ${romanNumeral}: ${u.title || `Unit ${romanNumeral}`}`;
      const topics = u.topics || '';
      const summary = u.summary || `Core syllabus topics for ${title}.`;
      return {
        unitNumber,
        romanNumeral,
        title,
        topics,
        summary,
        notes: buildStructuredUnitNotes({ unitNumber, romanNumeral, title, topics, summary }),
      };
    });

    const extractedText =
      parsed.extractedText ||
      units.map((u: any) => `## ${u.title}\n${u.topics}`).join('\n\n') ||
      rawText;

    return {
      extractedText,
      units,
    };
  } catch (error: any) {
    console.error('Error extracting syllabus with fast model fallback:', error);
    throw new Error(formatGeminiError(error));
  }
}

// Parse bulk questions text pasted by admin, extracting question, answer, marks, and section (Group A, B, C, D)
export async function parseBulkQuestions(params: {
  rawText: string;
  courseTitle: string;
  courseCode: string;
  unitTitle?: string;
}) {
  const { rawText, courseTitle, courseCode, unitTitle = '' } = params;
  const prompt = `Analyze the raw text pasted below containing exam or practice questions for course "${courseCode}: ${courseTitle}"${unitTitle ? ` (Unit: ${unitTitle})` : ''}.
Extract all individual questions and answers, determine the marks for each question mapping strictly to: 1, 2, 5, or 8 marks, and assign each question to its group:
- Group A: 1 Mark
- Group B: 2 Marks
- Group C: 5 Marks
- Group D: 8 Marks

Return ONLY a valid JSON array:
[
  {
    "question": "...",
    "answer": "...",
    "marks": 5,
    "section": "Group C"
  }
]

Raw Text:
${rawText.slice(0, 25000)}`;

  try {
    const response = await callGeminiWithModelFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: getFastThinkingConfig(modelName),
        },
      })
    );
    const parsed = JSON.parse(response.text || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err: any) {
    console.error('Error parsing bulk questions:', err);
    throw new Error(formatGeminiError(err));
  }
}
