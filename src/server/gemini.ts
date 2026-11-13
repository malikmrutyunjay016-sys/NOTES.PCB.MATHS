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
export async function callWithRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 1500): Promise<T> {
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

// Resilient model fallback wrapper for 429 rate limit / quota exhaustion across models
export async function callGeminiWithModelFallback<T>(callFn: (modelName: string) => Promise<T>): Promise<T> {
  const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
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

      if (isRateLimit || isTransient) {
        console.warn(`Model ${model} encountered ${status || 'rate limit / error'}, trying next model fallback...`);
        await new Promise(r => setTimeout(r, 1200));
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

// Fast syllabus parser that extracts Unit I, Unit II, Unit III, Unit IV and generates structured unit notes
export async function parseSyllabusIntoUnits(syllabusText: string, courseTitle: string) {
  const prompt = `You are an elite academic curriculum engine. Analyze the syllabus text below for course "${courseTitle}".
Explicitly identify and extract all syllabus units: Unit I, Unit II, Unit III, Unit IV, Unit V, etc. (normalize Roman numerals I, II, III, IV into sequential unitNumber 1, 2, 3, 4...).
For EACH unit:
1. "unitNumber": integer (1 for Unit I, 2 for Unit II, 3 for Unit III, 4 for Unit IV, etc.)
2. "romanNumeral": string ("I", "II", "III", "IV", etc.)
3. "title": string formatted as "Unit I: <Title>", "Unit II: <Title>", "Unit III: <Title>", "Unit IV: <Title>"
4. "topics": string (detailed comma-separated topics, theorems, and modules)
5. "summary": string (2-3 sentence overview)
6. "notes": string in rich GitHub-Flavored Markdown containing complete, thorough unit study notes with:
   - # Unit <Roman Numeral>: <Title>
   - ## 1. Unit Scope & Core Learning Objectives
   - ## 2. Detailed Conceptual Explanations & Topic Breakdown
   - ## 3. Essential Definitions, Formulas & Theorems
   - ## 4. High-Yield Revision Summary & Cheatsheet

Return ONLY valid JSON matching this structure:
[
  {
    "unitNumber": 1,
    "romanNumeral": "I",
    "title": "Unit I: <Title>",
    "topics": "...",
    "summary": "...",
    "notes": "..."
  }
]

Syllabus Text:
${syllabusText.slice(0, 20000)}
`;

  try {
    const response = await callGeminiWithModelFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      })
    );

    const parsed = JSON.parse(response.text || '[]');
    return Array.isArray(parsed) ? parsed : [];
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
    ? referenceBooks.map((b, i) => `--- [BOOK ${i + 1}: ${b.title}] ---\n${b.content.slice(0, 30000)}`).join('\n\n')
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
${content.slice(0, 20000)}
`;

  try {
    const response = await callGeminiWithModelFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
      })
    );
    return response.text || '';
  } catch (err: any) {
    console.warn('Summarize book error:', err);
    return 'Reference book uploaded successfully to library.';
  }
}

// High-speed syllabus text extraction using multimodal gemini model fallback
export async function extractSyllabusFromFile(params: {
  base64Data: string;
  mimeType: string;
  fileName?: string;
}) {
  const { base64Data, mimeType, fileName = 'syllabus' } = params;

  const promptText = `Transcribe and extract the complete academic syllabus from this uploaded document/photo ("${fileName}").
Organize the transcribed syllabus with distinct Unit headings using Roman numerals:
## UNIT - I: [Title]
[List of topics, subtopics, syllabus concepts]

## UNIT - II: [Title]
[List of topics, subtopics, syllabus concepts]

## UNIT - III: [Title]
[List of topics, subtopics, syllabus concepts]

## UNIT - IV: [Title]
[List of topics, subtopics, syllabus concepts]

Extract all topics verbatim without summarizing or omitting content.
Output ONLY the clean, structured syllabus text in markdown without any conversational preamble.`;

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
          systemInstruction: 'You are an accurate, fast academic document OCR engine. Transcribe syllabus text accurately and structure it into units.',
        },
      })
    );

    return response.text || '';
  } catch (error: any) {
    console.error('Error extracting syllabus with model fallback:', error);
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
  const prompt = `Analyze the raw text pasted below containing multiple exam questions, practice questions, or problem sets for course "${courseCode}: ${courseTitle}"${unitTitle ? ` (Unit: ${unitTitle})` : ''}.
Extract all individual questions and answers, determine the marks for each question mapping strictly to the distribution tiers: 1 mark, 2 marks, 5 marks, or 8 marks (assigning the closest tier if not explicitly specified), and assign each question to a section according to its marks:
- Group A: 1 Mark (Very Short / Objective)
- Group B: 2 Marks (Short Answer)
- Group C: 5 Marks (Medium Descriptive)
- Group D: 8 Marks (Long Answer / Comprehensive Essay)

Return ONLY a valid JSON array of objects with the exact structure:
[
  {
    "question": "...",
    "answer": "...",
    "marks": 5,
    "section": "Group C"
  }
]

Raw Text:
${rawText.slice(0, 30000)}`;

  try {
    const response = await callGeminiWithModelFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
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

// Extract questions and answers from an uploaded PDF file with high-speed optimization
export async function extractPdfQuestions(params: {
  base64Data: string;
  mimeType: string;
  fileName: string;
  courseTitle: string;
  courseCode: string;
  unitTitle: string;
}) {
  const { base64Data, mimeType, fileName, courseTitle, courseCode, unitTitle } = params;

  const prompt = `Extract all exam questions, model answers, marks (1, 2, 5, or 8), group (Group A, B, C, D), and unit number from this PDF ("${fileName}") for course "${courseCode}: ${courseTitle}".
Return ONLY a valid JSON array matching:
[
  {
    "question": "...",
    "answer": "...",
    "marks": 5,
    "group": "Group C",
    "unitNumber": 1
  }
]`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'application/pdf',
              data: base64Data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error: any) {
    console.error('Error extracting PDF questions fast:', error);
    try {
      const response = await callGeminiWithModelFallback((modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'application/pdf',
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        })
      );
      const parsed = JSON.parse(response.text || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (fallbackErr: any) {
      throw new Error(formatGeminiError(fallbackErr));
    }
  }
}



