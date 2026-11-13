import React, { useState } from 'react';
import {
  X,
  Upload,
  Book,
  Trash2,
  Sparkles,
  FileText,
  AlertCircle,
  Eye,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { Book as BookType, Course } from '../types';

interface BookManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: BookType[];
  currentCourse: Course | null;
  courses: Course[];
  onUploadBook: (bookData: Omit<BookType, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
  userId: string;
}

export const BookManagerModal: React.FC<BookManagerModalProps> = ({
  isOpen,
  onClose,
  books,
  currentCourse,
  courses,
  onUploadBook,
  onDeleteBook,
  userId,
}) => {
  const [tab, setTab] = useState<'upload' | 'list'>('upload');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(currentCourse?.id || courses[0]?.id || '');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [edition, setEdition] = useState('');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [fileData, setFileData] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [excerpt, setExcerpt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingBook, setViewingBook] = useState<BookType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize(file.size);
    setMimeType(file.type || 'application/pdf');

    // If title is empty, infer a clean title from file name
    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_|-]/g, ' ');
      setTitle(cleanName);
    }

    const isText = file.type.startsWith('text/') || /\.(txt|md|text)$/i.test(file.name);

    if (isText) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setContent(text);
        }
      };
      reader.readAsText(file);
    } else {
      // Direct book file upload (PDF, EPUB, DOCX) - Do NOT extract text!
      // Read as data URL so the book file can be stored/downloaded
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setFileData(dataUrl);
          if (!content.trim()) {
            setContent(`Uploaded textbook file: ${file.name} (${Math.round(file.size / 1024)} KB)`);
          }
          if (!excerpt.trim()) {
            setExcerpt(`Official course reference textbook: ${file.name}`);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !fileName) {
      setErrorMessage('Please provide a textbook title or choose a book file to upload.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      const bookTitle = title.trim() || fileName.replace(/\.[^/.]+$/, '').replace(/[_|-]/g, ' ');
      const finalContent = content.trim() || `Reference Textbook: ${bookTitle} (${fileName || 'Uploaded file'})`;

      await onUploadBook({
        courseId: selectedCourseId || 'general',
        title: bookTitle,
        author: author.trim(),
        edition: edition.trim(),
        fileName: fileName.trim() || `${bookTitle.replace(/\s+/g, '_')}.pdf`,
        fileSize: fileSize || finalContent.length,
        content: finalContent,
        fileData: fileData || undefined,
        mimeType: mimeType || 'application/pdf',
        excerpt: excerpt.trim() || `Reference book: ${bookTitle} ${author ? `by ${author}` : ''}`,
        createdBy: userId,
      });

      // Reset form
      setTitle('');
      setAuthor('');
      setEdition('');
      setContent('');
      setFileName('');
      setFileSize(0);
      setFileData('');
      setMimeType('');
      setExcerpt('');
      setTab('list');
    } catch (err: any) {
      console.error('Error uploading book:', err);
      setErrorMessage(err.message || 'Failed to upload reference book');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (bookId: string) => {
    try {
      setDeletingId(bookId);
      setErrorMessage(null);
      await onDeleteBook(bookId);
      setConfirmDeleteId(null);
    } catch (err: any) {
      console.error('Error deleting book:', err);
      setErrorMessage('Failed to delete book: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl text-stone-100 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-stone-100">Reference Library Manager</h2>
              <p className="text-xs text-stone-400">Upload, organize, and manage textbooks for AI grounding</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-stone-800 px-6 bg-stone-950/40">
          <button
            onClick={() => setTab('upload')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              tab === 'upload'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload New Textbook / Material
          </button>
          <button
            onClick={() => setTab('list')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              tab === 'list'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Book className="w-4 h-4" />
            Current Library ({books.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
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
          {tab === 'upload' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Course Association */}
                <div>
                  <label className="block text-xs font-mono text-stone-300 uppercase mb-1.5">
                    Assign to Course / Paper
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}: {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Book Title */}
                <div>
                  <label className="block text-xs font-mono text-stone-300 uppercase mb-1.5">
                    Textbook Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Operating System Concepts"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Author */}
                <div>
                  <label className="block text-xs font-mono text-stone-300 uppercase mb-1.5">
                    Author(s)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Abraham Silberschatz, Peter Baer Galvin"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Edition */}
                <div>
                  <label className="block text-xs font-mono text-stone-300 uppercase mb-1.5">
                    Edition / Publication
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10th Global Edition (Wiley)"
                    value={edition}
                    onChange={(e) => setEdition(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* File upload trigger - Direct upload */}
              <div className="border-2 border-dashed border-stone-700 hover:border-amber-500/60 rounded-xl p-5 text-center transition-colors bg-stone-950/40">
                <input
                  type="file"
                  id="book-file-upload"
                  accept=".pdf,.epub,.txt,.md,.text,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="book-file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-stone-200">
                      {fileName ? `Selected: ${fileName} (${Math.round(fileSize / 1024)} KB)` : 'Click to select textbook file (PDF, EPUB, TXT, DOC)'}
                    </span>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Direct upload — No text extraction required. Gemini searches Google & references your book when questions are asked.
                    </p>
                  </div>
                </label>
              </div>

              {/* Optional Description / Book Excerpt */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono text-stone-300 uppercase">
                    Book Summary or Key Topics (Optional)
                  </label>
                  <span className="text-[11px] font-mono text-stone-400">
                    Recommended chapters or concepts
                  </span>
                </div>
                <textarea
                  rows={3}
                  placeholder="e.g. Core textbook covering Operating Systems, process scheduling, virtual memory, and distributed storage systems..."
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Optional Text Content */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono text-stone-300 uppercase">
                    Additional Notes / Excerpts (Optional)
                  </label>
                  <span className="text-[11px] font-mono text-stone-400">
                    {content.length.toLocaleString()} characters
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Optional: Paste specific formulas, key theorems, or chapter excerpts if you want to provide explicit text snippets..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-xs font-mono text-stone-200 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Actions */}
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
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? 'Uploading...' : 'Save Reference Book to Library'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {books.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  <BookOpen className="w-12 h-12 mx-auto text-stone-600 mb-3" />
                  <p className="text-sm font-medium">No reference books in library yet.</p>
                  <p className="text-xs mt-1">Switch to the "Upload New Textbook" tab to add materials.</p>
                </div>
              ) : (
                books.map((b) => {
                  const assignedCourse = courses.find((c) => c.id === b.courseId);
                  return (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl border border-stone-800 bg-stone-850 hover:border-stone-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-stone-100 text-sm truncate">{b.title}</span>
                          {assignedCourse && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                              {assignedCourse.code}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-400">
                          {b.author ? `By ${b.author}` : 'Author unspecified'} {b.edition ? `• ${b.edition}` : ''}
                        </p>
                        {b.excerpt && (
                          <p className="text-xs text-stone-300 mt-2 line-clamp-2 bg-stone-900/60 p-2 rounded border border-stone-800/80">
                            {b.excerpt}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-stone-400 font-mono">
                          <span>Length: {b.content.length.toLocaleString()} chars</span>
                          <span>•</span>
                          <span>File: {b.fileName || 'textbook.txt'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setViewingBook(b)}
                          className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1 transition-colors"
                          title="Read full book text"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">View Content</span>
                        </button>
                        {confirmDeleteId === b.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleDelete(b.id)}
                              disabled={deletingId === b.id}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-colors"
                            >
                              {deletingId === b.id ? 'Deleting...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1.5 rounded-lg bg-stone-800 text-stone-300 text-xs hover:bg-stone-700 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(b.id)}
                            className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/50 text-xs font-medium transition-colors"
                            title="Delete book"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Book View Modal Sub-dialog */}
      {viewingBook && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-100">{viewingBook.title}</h3>
                <p className="text-xs text-stone-400">{viewingBook.author} {viewingBook.edition ? `(${viewingBook.edition})` : ''}</p>
              </div>
              <button
                onClick={() => setViewingBook(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-100 bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-stone-950 p-4 rounded-xl border border-stone-800 text-xs font-mono text-stone-300 whitespace-pre-wrap leading-relaxed">
              {viewingBook.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
