import React from 'react';
import {
  Layers,
  BookMarked,
  WifiOff,
} from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';

interface MobileFooterNavProps {
  activeTab: 'notes' | 'units' | 'library' | 'course_settings' | '1M' | '2M' | '5M' | '8M';
  onSelectTab: (tab: 'units' | 'library') => void;
  unitsCount: number;
  booksCount: number;
  notesCount?: number;
  onQuickAddQuestion?: () => void;
}

export const MobileFooterNav: React.FC<MobileFooterNavProps> = ({
  activeTab,
  onSelectTab,
  unitsCount,
  booksCount,
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
              <button
                onClick={() => onSelectTab('units')}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'units'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs">Syllabus & Notes ({unitsCount})</span>
              </button>

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

            {/* Desktop Right Status */}
            <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-stone-400">
              <span>Notes Mobile PWA</span>
              <span>•</span>
              <span className={isOnline ? 'text-emerald-400' : 'text-amber-400'}>
                {isOnline ? 'Online & Synced' : 'Offline Ready'}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

