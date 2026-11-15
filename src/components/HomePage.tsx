import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Book, Course, Question, Unit, WordNoteDocument } from '../types';

interface HomePageProps {
  courses: Course[];
  units: Unit[];
  books: Book[];
  questions: Question[];
  wordNotes: WordNoteDocument[];
  userName?: string | null;
  isAdmin: boolean;
  isLoading?: boolean;
  onSelectCourse: (course: Course) => void;
  onCreateCourse: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  courses,
  units,
  books,
  questions,
  wordNotes,
  userName,
  isAdmin,
  isLoading = false,
  onSelectCourse,
  onCreateCourse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const departments = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      const dept = (c.department || '').trim();
      if (dept) set.add(dept);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [courses]);

  const sortedCourses = useMemo(() => {
    return courses
      .slice()
      .sort((a, b) => {
        const codeCmp = (a.code || '').localeCompare(b.code || '', undefined, {
          sensitivity: 'base',
        });
        if (codeCmp !== 0) return codeCmp;
        return (a.title || '').localeCompare(b.title || '', undefined, {
          sensitivity: 'base',
        });
      });
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedCourses.filter((course) => {
      const matchesDept =
        selectedDepartment === 'all' ||
        (course.department || '').trim() === selectedDepartment;
      if (!matchesDept) return false;
      if (!q) return true;
      return (
        (course.code || '').toLowerCase().includes(q) ||
        (course.title || '').toLowerCase().includes(q) ||
        (course.department || '').toLowerCase().includes(q) ||
        (course.semester || '').toLowerCase().includes(q) ||
        (course.programmingLanguage || '').toLowerCase().includes(q) ||
        (course.description || '').toLowerCase().includes(q)
      );
    });
  }, [sortedCourses, searchQuery, selectedDepartment]);

  return (
    <div className="space-y-8 py-2">
      {/* Welcome Hero Section */}
      <section className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-10 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs font-mono font-semibold text-amber-800 tracking-wide">
              Academic Study Portal
            </p>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 tracking-tight text-balance">
              Welcome Back
            </h1>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Choose any course or paper below to open its syllabus units, published lecture notes, mark-wise exam PDFs, and reference textbooks.
            </p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1 text-xs font-mono text-stone-500 tabular-nums">
              <span>
                {courses.length} {courses.length === 1 ? 'Course / Paper' : 'Courses & Papers'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {units.length} {units.length === 1 ? 'Unit' : 'Units'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {questions.length} {questions.length === 1 ? 'Exam PDF' : 'Exam PDFs'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {books.length} {books.length === 1 ? 'Textbook' : 'Textbooks'}
              </span>
            </div>
          </div>

          {isAdmin && (
            <div className="shrink-0">
              <button
                type="button"
                onClick={onCreateCourse}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Course / Paper</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Course / Paper Directory */}
      <section className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
              Available Courses &amp; Papers
            </h2>
            <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
              {courses.length === 0
                ? 'No courses published yet'
                : `Showing ${filteredCourses.length} of ${courses.length} available ${courses.length === 1 ? 'course/paper' : 'courses/papers'}`}
            </p>
          </div>

          {courses.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by code, title, or term..."
                  className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-9 py-2 text-xs sm:text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Interactive Department Filter Tabs (only when multiple departments exist) */}
        {departments.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-200/60 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setSelectedDepartment('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedDepartment === 'all'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All Departments
            </button>
            {departments.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDepartment(dept)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedDepartment === dept
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        )}

        {/* Loading / Empty / Course Grid */}
        {isLoading && courses.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-3 animate-pulse"
              >
                <div className="h-3 w-28 bg-stone-200 rounded" />
                <div className="h-6 w-3/4 bg-stone-200 rounded" />
                <div className="h-4 w-full bg-stone-100 rounded" />
                <div className="h-4 w-2/3 bg-stone-100 rounded" />
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200/90 p-10 sm:p-12 text-center shadow-xs">
            <BookOpen className="w-10 h-10 text-amber-600/70 mx-auto mb-3" />
            <h3 className="font-serif font-bold text-xl text-stone-900">
              No Courses or Papers Published Yet
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto mt-1.5 leading-relaxed">
              {isAdmin
                ? 'Create your first course or paper, paste its syllabus to generate units, and upload PDFs and textbooks.'
                : 'No courses or papers are available right now. Please check back once your instructor publishes course materials.'}
            </p>
            {isAdmin && (
              <button
                type="button"
                onClick={onCreateCourse}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Course / Paper</span>
              </button>
            )}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200/90 p-10 text-center shadow-xs space-y-3">
            <h3 className="font-serif font-bold text-lg text-stone-900">
              No Matching Courses or Papers
            </h3>
            <p className="text-xs sm:text-sm text-stone-600">
              Try clearing your search term or switching the department filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDepartment('all');
              }}
              className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCourses.map((course) => {
              const unitCount = units.filter((u) => u.courseId === course.id).length;
              const pdfCount = questions.filter((q) => q.courseId === course.id).length;
              const noteCount = wordNotes.filter((n) => n.courseId === course.id).length;
              const bookCount = books.filter((b) => b.courseId === course.id).length;

              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onSelectCourse(course)}
                  className="group bg-white rounded-2xl border border-stone-200/90 hover:border-amber-500/80 hover:shadow-md p-6 text-left transition-all duration-150 flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                >
                  <div className="w-full">
                    {/* Unboxed 1-line metadata */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500">
                      <span className="font-mono font-bold text-amber-800">
                        {course.code}
                      </span>
                      {course.paperType === 'practical' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-stone-800">Practical Paper</span>
                        </>
                      )}
                      {course.paperType === 'practical' && course.programmingLanguage && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-amber-800">
                            {course.programmingLanguage}
                          </span>
                        </>
                      )}
                      {course.department && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{course.department}</span>
                        </>
                      )}
                      {course.semester && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{course.semester}</span>
                        </>
                      )}
                    </div>

                    <h3 className="font-serif font-bold text-xl text-stone-900 group-hover:text-amber-900 mt-2.5 leading-snug transition-colors">
                      {course.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-stone-600 mt-2 line-clamp-2 leading-relaxed">
                      {course.description ||
                        (course.paperType === 'practical'
                          ? 'Open this practical paper for question-wise procedures, extracted lab problems, notes, and reference textbooks.'
                          : 'Open this course to study syllabus units, lecture notes, PDF question papers, and reference books.')}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between gap-3 w-full">
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-mono text-stone-500 tabular-nums">
                      {course.paperType === 'practical' ? (
                        <span>
                          {pdfCount} {pdfCount === 1 ? 'Question' : 'Questions'}
                        </span>
                      ) : (
                        <>
                          <span>{unitCount} {unitCount === 1 ? 'Unit' : 'Units'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{pdfCount} {pdfCount === 1 ? 'PDF' : 'PDFs'}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{noteCount} {noteCount === 1 ? 'Note' : 'Notes'}</span>
                      {bookCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{bookCount} {bookCount === 1 ? 'Book' : 'Books'}</span>
                        </>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 group-hover:text-amber-700 whitespace-nowrap shrink-0">
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
