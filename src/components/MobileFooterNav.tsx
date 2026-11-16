import React from 'react';
import {
  Layers,
  BookMarked,
  HelpCircle,
  WifiOff,
  Users,
} from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';

interface MobileFooterNavProps {
  activeTab: 'notes' | 'units' | 'practical_questions' | 'library' | 'course_settings' | '1M' | '2M' | '5M' | '8M';
  onSelectTab: (tab: 'units' | 'practical_questions' | 'library') => void;
  isPractical?: boolean;
  questionsCount?: number;
  unitsCount: number;
  booksCount: number;
  notesCount?: number;
  courseVisitorCount?: number;
  onQuickAddQuestion?: () => void;
}

export const MobileFooterNav: React.FC<MobileFooterNavProps> = ({
  activeTab,
  onSelectTab,
  isPractical = false,
  questionsCount = 0,
  unitsCount,
  booksCount,
  courseVisitorCount = 0,
}) => {
  const { isOnline } = usePWAInstall();

  return (
    <>
      {/* Offline Mode Indicator */}
      {!isOnline && (
        <div className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Offline Mode — Viewing cached study notes</span>
        </div>
      )}

      {/* Footer / Bottom Navigation Bar */}
      <footer className="sticky bottom-0 z-40 mt-auto border-t border-stone-800 bg-stone-950/95 backdrop-blur-md text-stone-200 shadow-2xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-2">
            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-around sm:justify-start">
              {isPractical ? (
                <button
                  onClick={() => onSelectTab('practical_questions')}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'practical_questions'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'
                  }`}
                >
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] sm:text-xs">Questions ({questionsCount})</span>
                </button>
              ) : (
                <button
                  onClick={() => onSelectTab('units')}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'units'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] sm:text-xs">Syllabus &amp; Notes ({unitsCount})</span>
                </button>
              )}

              <button
                onClick={() => onSelectTab('library')}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'library'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'
                }`}
              >
                <BookMarked className="w-4 h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs">Textbooks ({booksCount})</span>
              </button>
            </div>

            {/* Course Unique Visitors (30s+) */}
            <div className="flex items-center gap-3 text-[11px] font-mono text-stone-300 shrink-0">
              <div
                className="flex items-center gap-1.5"
                title="Unique visitors who visited the site and spent at least 30 seconds in this course"
              >
                <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline text-stone-400">TOTAL COURSE VISITORS:</span>
                <span className="sm:hidden text-stone-400">VISITORS:</span>
                <span className="font-bold text-amber-400 tabular-nums">
                  {courseVisitorCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};
