import { Router, Request, Response } from 'express';
import {
  generateNotesAnswer,
  parseSyllabusIntoUnits,
  generateUnitNotes,
  summarizeUploadedBook,
  extractSyllabusFromFile,
  parseBulkQuestions,
} from './gemini';

export const apiRouter = Router();

// Robust JSON responder that handles both Express Response and raw Connect/http ServerResponse
function sendJson(res: Response, statusCode: number, data: any) {
  try {
    if (typeof (res as any).status === 'function' && typeof (res as any).json === 'function') {
      return (res as any).status(statusCode).json(data);
    }
    (res as any).statusCode = statusCode;
    if (typeof (res as any).setHeader === 'function') {
      (res as any).setHeader('Content-Type', 'application/json');
    }
    return (res as any).end(JSON.stringify(data));
  } catch (err) {
    console.error('Error in sendJson:', err);
    if (!res.headersSent && typeof (res as any).end === 'function') {
      (res as any).end(JSON.stringify(data));
    }
  }
}

// Handle answering questions with reference books & optional thinking / search grounding
apiRouter.post('/gemini/answer', async (req: Request, res: Response) => {
  try {
    const {
      question,
      courseTitle,
      courseCode,
      syllabusContext,
      unitTitle,
      referenceBooks,
      answerFormat,
      useThinking,
      useSearch,
    } = req.body || {};

    if (!question || !courseTitle) {
      return sendJson(res, 400, { error: 'Question and courseTitle are required.' });
    }

    const result = await generateNotesAnswer({
      question,
      courseTitle,
      courseCode: courseCode || '',
      syllabusContext,
      unitTitle,
      referenceBooks: referenceBooks || [],
      answerFormat: answerFormat || 'detailed',
      useThinking: Boolean(useThinking),
      useSearch: Boolean(useSearch),
    });

    return sendJson(res, 200, result);
  } catch (error: any) {
    console.error('API /gemini/answer error:', error);
    return sendJson(res, 500, { error: error.message || 'Server error generating answer' });
  }
});

// Handle parsing raw syllabus into structured units
apiRouter.post('/gemini/parse-syllabus', async (req: Request, res: Response) => {
  try {
    const { syllabusText, courseTitle } = req.body || {};
    if (!syllabusText) {
      return sendJson(res, 400, { error: 'syllabusText is required.' });
    }

    const units = await parseSyllabusIntoUnits(syllabusText, courseTitle || 'Course');
    return sendJson(res, 200, { units });
  } catch (error: any) {
    console.error('API /gemini/parse-syllabus error:', error);
    return sendJson(res, 500, { error: error.message || 'Server error parsing syllabus' });
  }
});

// Handle generating complete unit notes
apiRouter.post('/gemini/generate-unit-notes', async (req: Request, res: Response) => {
  try {
    const {
      courseTitle,
      courseCode,
      unitNumber,
      unitTitle,
      topics,
      referenceBooks,
      answerFormat,
    } = req.body || {};

    if (!unitTitle || !courseTitle) {
      return sendJson(res, 400, { error: 'unitTitle and courseTitle are required.' });
    }

    const notes = await generateUnitNotes({
      courseTitle,
      courseCode: courseCode || '',
      unitNumber: Number(unitNumber) || 1,
      unitTitle,
      topics: topics || '',
      referenceBooks: referenceBooks || [],
      answerFormat: answerFormat || 'detailed',
    });

    return sendJson(res, 200, { notes });
  } catch (error: any) {
    console.error('API /gemini/generate-unit-notes error:', error);
    return sendJson(res, 500, { error: error.message || 'Server error generating notes' });
  }
});

// Handle summarizing a book upon upload
apiRouter.post('/gemini/summarize-book', async (req: Request, res: Response) => {
  try {
    const { title, author, content } = req.body || {};
    if (!title || !content) {
      return sendJson(res, 400, { error: 'title and content are required.' });
    }

    const summary = await summarizeUploadedBook(title, author || '', content);
    return sendJson(res, 200, { summary });
  } catch (error: any) {
    console.error('API /gemini/summarize-book error:', error);
    return sendJson(res, 500, { error: error.message || 'Server error summarizing book' });
  }
});

// Handle extracting syllabus text and structured units from uploaded PDF, Image/Photo, or Document in one pass
apiRouter.post('/gemini/extract-syllabus', async (req: Request, res: Response) => {
  try {
    const { base64Data, mimeType, fileName } = req.body || {};
    if (!base64Data || !mimeType) {
      return sendJson(res, 400, { error: 'base64Data and mimeType are required.' });
    }

    const result = await extractSyllabusFromFile({
      base64Data,
      mimeType,
      fileName,
    });

    if (typeof result === 'string') {
      return sendJson(res, 200, { extractedText: result, units: [] });
    }

    return sendJson(res, 200, {
      extractedText: result.extractedText,
      units: result.units || [],
    });
  } catch (error: any) {
    console.error('API /gemini/extract-syllabus error:', error);
    return sendJson(res, 500, { error: error.message || 'Error extracting syllabus text' });
  }
});

// Handle parsing bulk questions text pasted by admin
apiRouter.post('/gemini/parse-bulk-questions', async (req: Request, res: Response) => {
  try {
    const { rawText, courseTitle, courseCode, unitTitle } = req.body || {};
    if (!rawText) {
      return sendJson(res, 400, { error: 'rawText is required.' });
    }

    const questions = await parseBulkQuestions({
      rawText,
      courseTitle: courseTitle || '',
      courseCode: courseCode || '',
      unitTitle: unitTitle || '',
    });

    return sendJson(res, 200, { questions });
  } catch (error: any) {
    console.error('API /gemini/parse-bulk-questions error:', error);
    return sendJson(res, 500, { error: error.message || 'Error parsing bulk questions' });
  }
});
