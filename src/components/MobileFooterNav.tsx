import React, { useState } from 'react';
import {
  Layers,
  BookMarked,
  Download,
  Smartphone,
  CheckCircle2,
  Share,
  PlusSquare,
  ExternalLink,
  X,
  HelpCircle,
  WifiOff,
  FileText,
} from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';

interface MobileFooterNavProps {
  activeTab: 'units' | 'library' | 'notes' | 'course_settings';
  onSelectTab: (tab: 'units' | 'library' | 'notes') => void;
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
  notesCount = 0,
  onQuickAddQuestion,
}) => {
  const { isInstallable, isInstalled, isIOS, isOnline, install } = usePWAInstall();
  const [showInstallModal, setShowInstallModal] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  return (
    <>
      {/* Offline Mode Indicator */}
      {!isOnline && (
        <div className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Offline Mode — Viewing cached study notes</span>
        </div>
      )}

      {/* Footer / Bottom Navigation Bar with Install App Tab */}
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
                <span className="text-[11px] sm:text-xs">Syllabus ({unitsCount})</span>
              </button>

              <button
                onClick={() => onSelectTab('notes')}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'notes'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs">Notes ({notesCount})</span>
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

              {onQuickAddQuestion && (
                <button
                  onClick={onQuickAddQuestion}
                  className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-100 hover:bg-stone-900 transition-all"
                >
                  <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[11px] sm:text-xs">Q&A Bank</span>
                </button>
              )}

              {/* Install App Tab on Footer */}
              {!isInstalled ? (
                <button
                  onClick={handleInstallClick}
                  className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] sm:text-xs">Install App</span>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] sm:text-xs">App Installed</span>
                </div>
              )}
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

      {/* Install Mobile App Guide Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-stone-100 space-y-5 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-stone-950 shadow-md shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-stone-50">
                    Install Notes Mobile App
                  </h3>
                  <p className="text-xs text-stone-400">
                    Add to your home screen for full-screen offline access
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct Install Button if browser prompt is available */}
            {isInstallable && (
              <button
                onClick={async () => {
                  const ok = await install();
                  if (ok) setShowInstallModal(false);
                }}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Install Now (1-Tap Native App)</span>
              </button>
            )}

            {/* If inside an iframe (like AI Studio preview), explain opening in a new tab */}
            {isInIframe && !isInstallable && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                <p className="text-xs text-amber-200 leading-relaxed">
                  <strong>Preview Mode Notice:</strong> Browsers block direct home-screen installation inside preview frames. Open the app in a full browser tab to trigger 1-tap installation:
                </p>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Full Browser Tab to Install</span>
                </a>
              </div>
            )}

            {/* Platform Instructions */}
            <div className="space-y-3 text-xs">
              {isIOS ? (
                <div className="p-4 rounded-xl bg-stone-800/90 border border-stone-700 space-y-2.5">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Share className="w-4 h-4" />
                    <span>Install on iPhone / iPad (Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-stone-300">
                    <li>
                      Tap the <strong>Share</strong> icon at the bottom of Safari.
                    </li>
                    <li>
                      Scroll down and tap <strong>Add to Home Screen</strong>{' '}
                      <PlusSquare className="w-3.5 h-3.5 inline text-amber-400" />.
                    </li>
                    <li>
                      Tap <strong>Add</strong> in the top-right corner to launch Notes as a standalone app.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-stone-800/90 border border-stone-700 space-y-2.5">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Download className="w-4 h-4" />
                    <span>Install on Android / Chrome / Edge:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-stone-300">
                    <li>
                      Open this app in Chrome or Edge on your phone or desktop.
                    </li>
                    <li>
                      Tap the browser menu <strong>(⋮)</strong> or address bar install icon.
                    </li>
                    <li>
                      Select <strong>Install App</strong> or <strong>Add to Home screen</strong>.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
