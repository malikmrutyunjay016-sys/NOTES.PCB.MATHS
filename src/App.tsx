import React, { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  BookOpen,
  Layers,
  BookMarked,
  Download,
  Settings,
  Plus,
  Sparkles,
  Sliders,
  ShieldCheck,
  GraduationCap,
  FileText,
  AlertCircle,
  LogIn,
} from 'lucide-react';
import { auth, googleProvider } from './lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import {
  subscribeCourses,
  subscribeUnits,
  subscribeBooks,
  subscribeQuestions,
  subscribeWordNotes,
  createOrUpdateCourse,
  deleteCourse,
  createOrUpdateUnit,
  createBook,
  deleteBook,
  createQuestion,
  deleteQuestion,
  saveWordNote,
  deleteWordNote,
  ADMIN_EMAIL,
} from './lib/dataService';
import { Course, Unit, Book, Question, WordNoteDocument } from './types';
import { Header } from './components/Header';
import { UnitNotesView } from './components/UnitNotesView';
import { ReferenceLibraryView } from './components/ReferenceLibraryView';
import { WordNotesTabView } from './components/WordNotesTabView';
import { BookManagerModal } from './components/BookManagerModal';
import { CourseEditorModal } from './components/CourseEditorModal';
import { AddQuestionModal } from './components/AddQuestionModal';
import { MobileFooterNav } from './components/MobileFooterNav';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [demoAdmin, setDemoAdmin] = useState<boolean>(true);

  // App Data State (Initialized empty — no default courses, units, books, or questions)
  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [wordNotes, setWordNotes] = useState<WordNoteDocument[]>([]);

  // Selected Active Course & Unit
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // Active View Tab: 'units' | 'library' | 'notes' | 'course_settings'
  const [activeTab, setActiveTab] = useState<'units' | 'library' | 'notes' | 'course_settings'>('units');

  // Modals
  const [isBookManagerOpen, setIsBookManagerOpen] = useState(false);
  const [isCourseEditorOpen, setIsCourseEditorOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [addQuestionDefaultUnitId, setAddQuestionDefaultUnitId] = useState<string | undefined>(undefined);

  // Notification for guest mode
  const [showGuestBanner, setShowGuestBanner] = useState<boolean>(true);

  // Determine admin privileges
  const isAdmin = Boolean(
    demoAdmin || (currentUser && currentUser.email === ADMIN_EMAIL)
  );

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setShowGuestBanner(false);
        if (user.email === ADMIN_EMAIL) {
          setDemoAdmin(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Real-Time Subscriptions
  useEffect(() => {
    const unsubCourses = subscribeCourses(
      (firestoreCourses) => {
        if (firestoreCourses.length > 0 || auth.currentUser) {
          setCourses(firestoreCourses);
          setSelectedCourse((prev) => {
            if (firestoreCourses.length === 0) return null;
            if (!prev) return firestoreCourses[0];
            return firestoreCourses.find((c) => c.id === prev.id) || firestoreCourses[0];
          });
        }
      },
      (err) => console.log('Courses listener status:', err?.message)
    );

    const unsubUnits = subscribeUnits(
      (firestoreUnits) => {
        if (firestoreUnits.length > 0 || auth.currentUser) {
          setUnits(firestoreUnits);
        }
      },
      (err) => console.log('Units listener status:', err?.message)
    );

    const unsubBooks = subscribeBooks(
      (firestoreBooks) => {
        if (firestoreBooks.length > 0 || auth.currentUser) {
          setBooks(firestoreBooks);
        }
      },
      (err) => console.log('Books listener status:', err?.message)
    );

    const unsubQuestions = subscribeQuestions(
      (firestoreQuestions) => {
        if (firestoreQuestions.length > 0 || auth.currentUser) {
          setQuestions(firestoreQuestions);
        }
      },
      (err) => console.log('Questions listener status:', err?.message)
    );

    const unsubWordNotes = subscribeWordNotes(
      (firestoreWordNotes) => {
        if (firestoreWordNotes.length > 0 || auth.currentUser) {
          setWordNotes(firestoreWordNotes);
        }
      },
      (err) => console.log('WordNotes listener status:', err?.message)
    );

    return () => {
      unsubCourses();
      unsubUnits();
      unsubBooks();
      unsubQuestions();
      unsubWordNotes();
    };
  }, []);

  // Filter units, books, questions, and wordNotes for current course
  const currentUnits = selectedCourse
    ? units.filter((u) => u.courseId === selectedCourse.id)
    : [];

  const currentBooks = selectedCourse
    ? books.filter((b) => b.courseId === selectedCourse.id || !b.courseId)
    : books;

  const currentQuestions = selectedCourse
    ? questions.filter((q) => q.courseId === selectedCourse.id)
    : questions;

  const currentWordNotes = selectedCourse
    ? wordNotes.filter((n) => n.courseId === selectedCourse.id || n.courseId === 'general')
    : wordNotes;

  // Handlers for Course Management
  const handleSaveCourse = async (
    courseData: Course,
    initialUnits?: Array<Omit<Unit, 'id' | 'createdAt'>>
  ) => {
    // 1. Optimistic local update so UI reflects the new course immediately
    const finalizedCourse: Course = {
      ...courseData,
      createdBy: currentUser?.uid || courseData.createdBy || 'admin-creator',
    };

    setCourses((prev) => {
      const idx = prev.findIndex((c) => c.id === finalizedCourse.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = finalizedCourse;
        return next;
      }
      return [finalizedCourse, ...prev];
    });
    setSelectedCourse(finalizedCourse);

    // If units were parsed, update locally
    if (initialUnits && initialUnits.length > 0) {
      const createdUnits: Unit[] = initialUnits.map((u) => ({
        id: `unit-${finalizedCourse.id}-${u.unitNumber}-${Date.now().toString(36)}`,
        ...u,
        createdBy: currentUser?.uid || 'admin-creator',
        createdAt: new Date().toISOString(),
      }));
      setUnits((prev) => [...prev, ...createdUnits]);

      // If user is authenticated, persist to Firestore
      if (currentUser) {
        for (const unitObj of createdUnits) {
          try {
            await createOrUpdateUnit(unitObj);
          } catch (err) {
            console.warn('Firestore unit write notice:', err);
          }
        }
      }
    }

    // 2. Persist to Firestore if user is logged in
    if (currentUser) {
      try {
        await createOrUpdateCourse(finalizedCourse);
      } catch (err) {
        console.warn('Firestore course write notice:', err);
      }
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    setSelectedCourse((prev) => (prev?.id === courseId ? courses.find((c) => c.id !== courseId) || null : prev));
    if (currentUser) {
      try {
        await deleteCourse(courseId);
      } catch (err) {
        console.warn('Firestore delete notice:', err);
      }
    }
  };

  // Handlers for Book Management
  const handleUploadBook = async (bookData: Omit<Book, 'id' | 'createdAt'>) => {
    const bookId = `book-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newBook: Book = {
      id: bookId,
      ...bookData,
      createdBy: currentUser?.uid || bookData.createdBy || 'admin-creator',
      createdAt: new Date().toISOString(),
    };
    setBooks((prev) => [newBook, ...prev]);

    if (currentUser) {
      try {
        await createBook(newBook);
      } catch (err) {
        console.warn('Firestore book write notice:', err);
      }
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    if (currentUser) {
      try {
        await deleteBook(bookId);
      } catch (err) {
        console.warn('Firestore book delete notice:', err);
      }
    }
  };

  // Handlers for Question Management
  const handleSaveQuestion = async (qData: Omit<Question, 'id' | 'createdAt'>) => {
    const qId = `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newQ: Question = {
      id: qId,
      ...qData,
      askedBy: currentUser?.uid || qData.askedBy || 'user-student',
      createdAt: new Date().toISOString(),
    };
    setQuestions((prev) => [newQ, ...prev]);

    if (currentUser) {
      try {
        await createQuestion(newQ);
      } catch (err) {
        console.warn('Firestore question write notice:', err);
      }
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    if (currentUser) {
      try {
        await deleteQuestion(questionId);
      } catch (err) {
        console.warn('Firestore question delete notice:', err);
      }
    }
  };

  // Handlers for Word Notes (Admin MS Word -> Auto-PDF for Users)
  const handleSaveWordNote = async (noteDoc: WordNoteDocument) => {
    setWordNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === noteDoc.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = noteDoc;
        return next;
      }
      return [noteDoc, ...prev];
    });

    if (currentUser) {
      try {
        await saveWordNote(noteDoc);
      } catch (err) {
        console.warn('Firestore word_note write notice:', err);
      }
    }
  };

  const handleDeleteWordNote = async (noteId: string) => {
    setWordNotes((prev) => prev.filter((n) => n.id !== noteId));
    if (currentUser) {
      try {
        await deleteWordNote(noteId);
      } catch (err) {
        console.warn('Firestore word_note delete notice:', err);
      }
    }
  };

  // Handler for Unit Note Updates
  const handleUpdateUnitNotes = async (unitId: string, newNotes: string) => {
    setUnits((prev) =>
      prev.map((u) => (u.id === unitId ? { ...u, notes: newNotes, updatedAt: new Date().toISOString() } : u))
    );

    const targetUnit = units.find((u) => u.id === unitId);
    if (targetUnit && currentUser) {
      try {
        await createOrUpdateUnit({
          ...targetUnit,
          notes: newNotes,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Firestore update unit note notice:', err);
      }
    }
  };


  const handlePromptLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.warn('Login notice:', err?.message);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Header
        courses={courses}
        selectedCourse={selectedCourse}
        onSelectCourse={(c) => {
          setSelectedCourse(c);
          setSelectedUnit(null);
        }}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onToggleDemoAdmin={() => setDemoAdmin(!demoAdmin)}
        onOpenNewCourse={() => {
          setCourseToEdit(null);
          setIsCourseEditorOpen(true);
        }}
        onOpenBookManager={() => setIsBookManagerOpen(true)}
      />

      {/* Guest Sign-In Notice Banner */}
      {!currentUser && showGuestBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-900">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Exploring in Guest Mode:</strong> Reference books, questions, and syllabus notes are fully functional. Sign in with Google to synchronize additions permanently with the Firestore database.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePromptLogin}
                className="font-semibold text-amber-800 underline hover:text-amber-950 flex items-center gap-1"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Google Sign In</span>
              </button>
              <button
                onClick={() => setShowGuestBanner(false)}
                className="text-stone-400 hover:text-stone-600 ml-2"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {selectedCourse ? (
          <div className="space-y-6">
            {/* Course Overview Banner */}
            <div className="bg-white rounded-2xl border border-stone-200/90 p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-amber-100 text-amber-900 border border-amber-200">
                    {selectedCourse.code}
                  </span>
                  <span className="text-xs text-stone-500 font-medium">
                    {selectedCourse.department || 'Academic Department'} • {selectedCourse.semester || 'Semester'}
                  </span>
                  {isAdmin && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                      Admin Access Active
                    </span>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 tracking-tight">
                  {selectedCourse.title}
                </h1>
                {selectedCourse.description && (
                  <p className="text-xs md:text-sm text-stone-600 max-w-3xl leading-relaxed">
                    {selectedCourse.description}
                  </p>
                )}
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setCourseToEdit(selectedCourse);
                    setIsCourseEditorOpen(true);
                  }}
                  className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition-colors"
                  title="Edit Course Settings & Syllabus"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-stone-200/90 bg-white/70 backdrop-blur rounded-xl px-2 shadow-xs overflow-x-auto">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('units')}
                  className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === 'units'
                      ? 'border-amber-600 text-amber-900 font-bold'
                      : 'border-transparent text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>Syllabus ({currentUnits.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === 'notes'
                      ? 'border-amber-600 text-amber-900 font-bold'
                      : 'border-transparent text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>Notes ({currentWordNotes.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('library')}
                  className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === 'library'
                      ? 'border-amber-600 text-amber-900 font-bold'
                      : 'border-transparent text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <BookMarked className="w-4 h-4 text-amber-600" />
                  <span>Reference Textbooks ({currentBooks.length})</span>
                </button>
              </div>

              {/* Admin Format Badge */}
              <div className="hidden md:flex items-center gap-2 text-[11px] text-stone-500 font-mono pr-2">
                <span>Admin Format:</span>
                <span className="font-semibold text-stone-800 uppercase px-2 py-0.5 rounded bg-stone-100">
                  {selectedCourse.answerFormat || 'Detailed Academic'}
                </span>
              </div>
            </div>

            {/* Tab Views */}
            {activeTab === 'units' && (
              <UnitNotesView
                course={selectedCourse}
                units={currentUnits}
                activeUnit={selectedUnit}
                onSelectUnit={(u) => setSelectedUnit(u)}
                books={currentBooks}
                questions={currentQuestions}
                isAdmin={isAdmin}
                onOpenAddQuestion={(unitId) => {
                  setAddQuestionDefaultUnitId(unitId);
                  setIsAddQuestionOpen(true);
                }}
                onUpdateUnitNotes={handleUpdateUnitNotes}
                onAskQuestionAboutUnit={(unit) => {
                  setSelectedUnit(unit);
                  setAddQuestionDefaultUnitId(unit.id);
                  setIsAddQuestionOpen(true);
                }}
                onOpenEditCourse={() => {
                  setCourseToEdit(selectedCourse);
                  setIsCourseEditorOpen(true);
                }}
                onSaveQuestion={handleSaveQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                userId={currentUser?.uid || 'guest-admin'}
                userName={currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Course Admin')}
              />
            )}

            {activeTab === 'notes' && (
              <WordNotesTabView
                course={selectedCourse}
                units={currentUnits}
                wordNotes={currentWordNotes}
                isAdmin={isAdmin}
                onSaveWordNote={handleSaveWordNote}
                onDeleteWordNote={handleDeleteWordNote}
                userId={currentUser?.uid || 'guest-admin'}
                userName={currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Course Admin')}
              />
            )}

            {activeTab === 'library' && (
              <ReferenceLibraryView
                course={selectedCourse}
                books={currentBooks}
                isAdmin={isAdmin}
                onOpenBookManager={() => setIsBookManagerOpen(true)}
                onDeleteBook={handleDeleteBook}
              />
            )}
          </div>
        ) : activeTab === 'notes' ? (
          <WordNotesTabView
            course={null}
            units={[]}
            wordNotes={wordNotes}
            isAdmin={isAdmin}
            onSaveWordNote={handleSaveWordNote}
            onDeleteWordNote={handleDeleteWordNote}
            userId={currentUser?.uid || 'guest-admin'}
            userName={currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Course Admin')}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200/90 p-8 sm:p-12 shadow-sm text-center max-w-3xl mx-auto my-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 mx-auto mb-4 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-stone-950 rounded-[14px] flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-amber-400" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
              Welcome to Notes
            </h2>
            <p className="text-stone-600 text-sm mt-2 max-w-xl mx-auto leading-relaxed">
              Your database is clean and ready. Create your first academic course or paper section, paste a syllabus to auto-generate units, and upload reference textbooks to begin.
            </p>

            {/* Quick 3-step guide */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8 text-left">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-xs font-mono font-bold text-amber-700 uppercase mb-1">Step 1</div>
                <div className="font-semibold text-stone-900 text-sm">Add Course & Syllabus</div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Input course code, paste curriculum syllabus, and AI automatically splits it into units.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-xs font-mono font-bold text-amber-700 uppercase mb-1">Step 2</div>
                <div className="font-semibold text-stone-900 text-sm">Upload Reference Books</div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Upload text/markdown books, papers, or excerpts to ground notes and Q&A.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-xs font-mono font-bold text-amber-700 uppercase mb-1">Step 3</div>
                <div className="font-semibold text-stone-900 text-sm">MS Word Notes → Auto-PDF</div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Admin writes notes in MS Word Studio; saving auto-converts them to PDF for students.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  setCourseToEdit(null);
                  setIsCourseEditorOpen(true);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold text-sm shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Course / Paper</span>
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#185abd] hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-md"
              >
                <FileText className="w-4 h-4" />
                <span>Open Notes (MS Word → Auto-PDF)</span>
              </button>

              <button
                onClick={() => setIsBookManagerOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-sm transition-colors border border-stone-200"
              >
                <BookMarked className="w-4 h-4 text-amber-600" />
                <span>Open Reference Library</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Mobile App Footer Navigation & Install App Tab */}
      <MobileFooterNav
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        unitsCount={currentUnits.length}
        booksCount={currentBooks.length}
        notesCount={currentWordNotes.length}
        onQuickAddQuestion={
          selectedCourse
            ? () => {
                setAddQuestionDefaultUnitId(selectedUnit?.id || currentUnits[0]?.id);
                setIsAddQuestionOpen(true);
              }
            : undefined
        }
      />

      {/* Modals */}
      {isBookManagerOpen && (
        <BookManagerModal
          isOpen={isBookManagerOpen}
          onClose={() => setIsBookManagerOpen(false)}
          books={books}
          currentCourse={selectedCourse}
          courses={courses}
          onUploadBook={handleUploadBook}
          onDeleteBook={handleDeleteBook}
          userId={currentUser?.uid || 'guest-admin'}
        />
      )}

      {isCourseEditorOpen && (
        <CourseEditorModal
          isOpen={isCourseEditorOpen}
          onClose={() => setIsCourseEditorOpen(false)}
          courseToEdit={courseToEdit}
          onSaveCourse={handleSaveCourse}
          userId={currentUser?.uid || 'guest-admin'}
        />
      )}

      {isAddQuestionOpen && selectedCourse && (
        <AddQuestionModal
          isOpen={isAddQuestionOpen}
          onClose={() => setIsAddQuestionOpen(false)}
          course={selectedCourse}
          units={currentUnits}
          books={currentBooks}
          defaultUnitId={addQuestionDefaultUnitId}
          onSaveQuestion={handleSaveQuestion}
          userId={currentUser?.uid || 'guest-admin'}
          userName={currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Course Admin')}
        />
      )}
    </div>
  );
}
