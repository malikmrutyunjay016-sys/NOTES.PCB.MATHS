import React, { useState } from 'react';
import {
  Book,
  BookOpen,
  Search,
  Download,
  Trash2,
  Plus,
  Eye,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Book as BookType, Course } from '../types';
import { resolvePdfDataUrl } from '../lib/dataService';
import { downloadDataUrlFile } from '../lib/pdfUtils';
import { PdfViewer } from './PdfViewer';

function downloadFile(filename: string, content: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

interface ReferenceLibraryViewProps {
  course: Course;
  books: BookType[];
  isAdmin: boolean;
  onOpenBookManager: () => void;
  onDeleteBook: (bookId: string) => Promise<void>;
}

export const ReferenceLibraryView: React.FC<ReferenceLibraryViewProps> = ({
  course,
  books,
  isAdmin,
  onOpenBookManager,
  onDeleteBook,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<BookType | null>(null);
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [bookToDelete, setBookToDelete] = useState<BookType | null>(null);
  const [isDeletingBook, setIsDeletingBook] = useState<boolean>(false);

  // Filter books by current course or search query
  const filteredBooks = books.filter((b) => {
    const matchesCourse = b.courseId === course.id || !b.courseId;
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.author || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.excerpt || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCourse && matchesSearch;
  });

  const handleBookDownload = async (b: BookType) => {
    setDownloadError(null);
    if (!b.fileData) {
      downloadFile(`${b.title.replace(/\s+/g, '_')}.txt`, b.content, 'text/plain');
      return;
    }

    try {
      setDownloadingBookId(b.id);
      const fullDataUrl = await resolvePdfDataUrl('books', b.id, b.fileData);
      if (!fullDataUrl) {
        setDownloadError(`Unable to load file data for "${b.title}". Please delete and re-upload it.`);
        return;
      }
      const fname = b.fileName || `${b.title.replace(/\s+/g, '_')}.pdf`;
      const result = downloadDataUrlFile(fname, fullDataUrl, b.mimeType || 'application/pdf');
      if (!result.ok) {
        setDownloadError(result.error || `Failed to download "${b.title}".`);
      }
    } finally {
      setDownloadingBookId(null);
    }
  };

  const isPdfBook = (b: BookType) =>
    Boolean(
      b.fileData &&
        (b.mimeType?.toLowerCase().includes('pdf') ||
          (b.fileName || '').toLowerCase().endsWith('.pdf'))
    );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-serif font-bold text-xl text-stone-900">
              Reference Textbook Library
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-mono font-bold">
              {filteredBooks.length} Books
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Authoritative reference texts used by Gemini to generate verified unit notes and answers for {course.code}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          {isAdmin && (
            <button
              onClick={onOpenBookManager}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Book</span>
            </button>
          )}
        </div>
      </div>

      {downloadError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{downloadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDownloadError(null)}
            className="text-rose-500 hover:text-rose-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Book Grid */}
      {filteredBooks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
          <Book className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="font-serif font-bold text-lg text-stone-700">No Reference Books Found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
            {isAdmin
              ? 'Click "Upload Book" to add reference textbooks, OCR papers, or lecture notes to this course.'
              : 'No reference books have been uploaded for this course yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBooks.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-sm hover:border-amber-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/70">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-stone-900 text-base">{b.title}</h4>
                      <p className="text-xs text-stone-500">
                        {b.author ? `By ${b.author}` : 'Author unspecified'} {b.edition ? `• ${b.edition}` : ''}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                    {Math.round((b.fileSize || b.content.length) / 1024)} KB
                  </span>
                </div>

                {b.excerpt && (
                  <p className="text-xs text-stone-600 mt-3 p-3 bg-stone-50 rounded-xl border border-stone-100 line-clamp-3 leading-relaxed">
                    {b.excerpt}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[11px] font-mono text-stone-400">
                  {b.fileName ? `File: ${b.fileName}` : `${b.content.length.toLocaleString()} characters`}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBookDownload(b)}
                    disabled={downloadingBookId === b.id}
                    className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-medium transition-colors disabled:opacity-50"
                    title={b.fileData ? 'Download original textbook file' : 'Download reference text file'}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setSelectedBook(b)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isPdfBook(b) ? 'Open PDF' : 'View Info'}</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => setBookToDelete(b)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                      title="Delete reference book"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Book Reader Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col p-6 shadow-2xl text-stone-100">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase text-amber-400 font-bold">Reference Textbook</span>
                  <span className="text-stone-500">•</span>
                  <span className="text-xs text-stone-400 font-mono">
                    {Math.round((selectedBook.fileSize || selectedBook.content.length) / 1024)} KB
                  </span>
                </div>
                <h3 className="text-xl font-serif font-bold text-stone-50 mt-1">{selectedBook.title}</h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  {selectedBook.author} {selectedBook.edition ? `• ${selectedBook.edition}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedBook(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isPdfBook(selectedBook) ? (
              <div className="flex-1 overflow-hidden">
                <PdfViewer
                  collectionName="books"
                  docId={selectedBook.id}
                  inlineDataUrl={selectedBook.fileData}
                  fileName={selectedBook.fileName || `${selectedBook.title}.pdf`}
                  maxHeightClass="h-[62vh]"
                />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto bg-stone-950 p-6 rounded-xl border border-stone-800 font-mono text-xs md:text-sm text-stone-300 whitespace-pre-wrap leading-relaxed selection:bg-amber-400 selection:text-stone-950 mt-2">
                  {selectedBook.content}
                </div>

                <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between">
                  <span className="text-xs text-stone-500 font-mono">
                    Total Words: ~{Math.round(selectedBook.content.split(/\s+/).length).toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleBookDownload(selectedBook)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{selectedBook.fileData ? 'Download Textbook File' : 'Download Book Notes'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Admin Delete File Confirmation Modal */}
      {isAdmin && bookToDelete && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            if (!isDeletingBook) setBookToDelete(null);
          }}
        >
          <div
            className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-serif font-bold text-stone-900">
                  Confirm Delete File
                </h3>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <span className="font-semibold text-stone-900 break-words">
                    {bookToDelete.fileName || bookToDelete.title}
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                disabled={isDeletingBook}
                onClick={() => setBookToDelete(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingBook}
                onClick={async () => {
                  try {
                    setIsDeletingBook(true);
                    await onDeleteBook(bookToDelete.id);
                    if (selectedBook?.id === bookToDelete.id) {
                      setSelectedBook(null);
                    }
                    setBookToDelete(null);
                  } finally {
                    setIsDeletingBook(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {isDeletingBook ? 'Deleting...' : 'Delete File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
