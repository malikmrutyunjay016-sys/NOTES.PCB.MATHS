import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  getDocs,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Course, Unit, Book, Question, WordNoteDocument } from '../types';

export const ADMIN_EMAIL = 'malikmrutyunjay016@gmail.com';

// ----------------- COURSES -----------------

export function subscribeCourses(
  onData: (courses: Course[]) => void,
  onError?: (err: any) => void
) {
  const colPath = 'courses';
  const q = query(collection(db, colPath));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Course[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Course);
      });
      onData(list);
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.GET, colPath);
      } catch {
        // Logged via handleFirestoreError
      }
    }
  );
}

export async function createOrUpdateCourse(course: Course): Promise<void> {
  const path = `courses/${course.id}`;
  try {
    const payload = {
      code: course.code.slice(0, 50),
      title: course.title.slice(0, 200),
      description: (course.description || '').slice(0, 2000),
      department: (course.department || '').slice(0, 100),
      semester: (course.semester || '').slice(0, 50),
      syllabusText: (course.syllabusText || '').slice(0, 50000),
      answerFormat: (course.answerFormat || 'detailed').slice(0, 100),
      createdBy: course.createdBy,
      createdAt: course.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'courses', course.id), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  const path = `courses/${courseId}`;
  try {
    await deleteDoc(doc(db, 'courses', courseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------- UNITS -----------------

export function subscribeUnits(
  onData: (units: Unit[]) => void,
  onError?: (err: any) => void
) {
  const colPath = 'units';
  const q = query(collection(db, colPath));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Unit[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Unit);
      });
      // Sort by unitNumber ascending
      list.sort((a, b) => a.unitNumber - b.unitNumber);
      onData(list);
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.GET, colPath);
      } catch {
        // Logged via handleFirestoreError
      }
    }
  );
}

export async function createOrUpdateUnit(unit: Unit): Promise<void> {
  const path = `units/${unit.id}`;
  try {
    const payload = {
      courseId: unit.courseId,
      unitNumber: Number(unit.unitNumber),
      title: unit.title.slice(0, 200),
      topics: (unit.topics || '').slice(0, 5000),
      notes: (unit.notes || '').slice(0, 100000),
      summary: (unit.summary || '').slice(0, 5000),
      createdBy: unit.createdBy,
      createdAt: unit.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'units', unit.id), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUnit(unitId: string): Promise<void> {
  const path = `units/${unitId}`;
  try {
    await deleteDoc(doc(db, 'units', unitId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------- BOOKS -----------------

export function subscribeBooks(
  onData: (books: Book[]) => void,
  onError?: (err: any) => void
) {
  const colPath = 'books';
  const q = query(collection(db, colPath));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Book[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Book);
      });
      onData(list);
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.GET, colPath);
      } catch {
        // Logged via handleFirestoreError
      }
    }
  );
}

export async function createBook(book: Book): Promise<void> {
  const path = `books/${book.id}`;
  try {
    const payload: any = {
      courseId: book.courseId,
      title: book.title.slice(0, 200),
      author: (book.author || '').slice(0, 200),
      edition: (book.edition || '').slice(0, 100),
      fileName: (book.fileName || '').slice(0, 255),
      fileSize: book.fileSize || 0,
      content: (book.content || '').slice(0, 200000),
      excerpt: (book.excerpt || '').slice(0, 5000),
      mimeType: (book.mimeType || '').slice(0, 100),
      createdBy: book.createdBy,
      createdAt: book.createdAt || new Date().toISOString(),
    };
    if (book.fileData) {
      // Store file data up to safe Firestore document limit (~700KB)
      payload.fileData = book.fileData.slice(0, 750000);
    }
    await setDoc(doc(db, 'books', book.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBook(bookId: string): Promise<void> {
  const path = `books/${bookId}`;
  try {
    await deleteDoc(doc(db, 'books', bookId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------- QUESTIONS -----------------

export function subscribeQuestions(
  onData: (questions: Question[]) => void,
  onError?: (err: any) => void
) {
  const colPath = 'questions';
  const q = query(collection(db, colPath));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Question[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Question);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.GET, colPath);
      } catch {
        // Logged via handleFirestoreError
      }
    }
  );
}

export async function createQuestion(q: Question): Promise<void> {
  const path = `questions/${q.id}`;
  try {
    const payload: any = {
      courseId: q.courseId,
      unitId: q.unitId || '',
      question: q.question.slice(0, 2000),
      answer: q.answer.slice(0, 50000),
      marks: typeof q.marks === 'number' ? q.marks : 5,
      section: (q.section || '').slice(0, 50),
      answerFormat: (q.answerFormat || 'detailed').slice(0, 100),
      isCurated: Boolean(q.isCurated),
      thinkingUsed: Boolean(q.thinkingUsed),
      groundedInSearch: Boolean(q.groundedInSearch),
      modelUsed: (q.modelUsed || 'gemini-3.8-flash').slice(0, 100),
      sourceBooks: (q.sourceBooks || '').slice(0, 1000),
      askedBy: q.askedBy,
      askedByName: (q.askedByName || 'Anonymous Student').slice(0, 100),
      createdAt: q.createdAt || new Date().toISOString(),
    };
    if (Array.isArray(q.webSources) && q.webSources.length > 0) {
      payload.webSources = q.webSources.slice(0, 8);
    }
    await setDoc(doc(db, 'questions', q.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const path = `questions/${questionId}`;
  try {
    await deleteDoc(doc(db, 'questions', questionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------- WORD NOTES (ADMIN WORD -> USER PDF) -----------------

export function subscribeWordNotes(
  onData: (notes: WordNoteDocument[]) => void,
  onError?: (err: any) => void
) {
  const colPath = 'word_notes';
  const q = query(collection(db, colPath));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: WordNoteDocument[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as WordNoteDocument);
      });
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      onData(list);
    },
    (error) => {
      onError?.(error);
      try {
        handleFirestoreError(error, OperationType.GET, colPath);
      } catch {
        // Logged via handleFirestoreError
      }
    }
  );
}

export async function saveWordNote(note: WordNoteDocument): Promise<void> {
  const path = `word_notes/${note.id}`;
  try {
    const payload = {
      courseId: note.courseId.slice(0, 128),
      unitId: (note.unitId || '').slice(0, 128),
      title: note.title.slice(0, 200),
      subject: (note.subject || '').slice(0, 200),
      author: (note.author || 'Course Admin').slice(0, 150),
      category: (note.category || 'Lecture Notes').slice(0, 100),
      keywords: (note.keywords || '').slice(0, 500),
      status: (note.status || 'Published').slice(0, 50),
      comments: (note.comments || '').slice(0, 2000),
      htmlContent: note.htmlContent.slice(0, 300000),
      plainText: (note.plainText || '').slice(0, 200000),
      pageSettingsJson: (note.pageSettingsJson || '{}').slice(0, 5000),
      pdfDataUrl: note.pdfDataUrl.slice(0, 750000),
      pdfFileName: (note.pdfFileName || 'Notes.pdf').slice(0, 255),
      wordCount: Number(note.wordCount) || 0,
      charCount: Number(note.charCount) || 0,
      pageCount: Number(note.pageCount) || 1,
      version: Number(note.version) || 1,
      createdBy: note.createdBy.slice(0, 128),
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'word_notes', note.id), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteWordNote(noteId: string): Promise<void> {
  const path = `word_notes/${noteId}`;
  try {
    await deleteDoc(doc(db, 'word_notes', noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

