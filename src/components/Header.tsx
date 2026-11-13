import React, { useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Sparkles,
  Download,
  LogIn,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Plus,
  BookMarked,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { Course } from '../types';
import { ADMIN_EMAIL } from '../lib/dataService';

interface HeaderProps {
  courses: Course[];
  selectedCourse: Course | null;
  onSelectCourse: (course: Course) => void;
  currentUser: User | null;
  isAdmin: boolean;
  onToggleDemoAdmin: () => void;
  onOpenNewCourse: () => void;
  onOpenBookManager: () => void;
  onDownloadCourseDossier?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  courses,
  selectedCourse,
  onSelectCourse,
  currentUser,
  isAdmin,
  onToggleDemoAdmin,
  onOpenNewCourse,
  onOpenBookManager,
  onDownloadCourseDossier,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.warn('Sign in notice:', err?.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 text-stone-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-stone-950 rounded-[10px] flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-xl tracking-tight text-stone-50">Notes</span>
                <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  Academic AI
                </span>
              </div>
              <p className="text-[11px] text-stone-400 hidden sm:block">Reference-Grounded Syllabus Companion</p>
            </div>
          </div>

          {/* Center: Course Selector */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setCourseDropdownOpen(!courseDropdownOpen)}
              className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-800 border border-stone-700 text-sm font-medium transition-all"
            >
              <GraduationCap className="w-4 h-4 text-amber-400" />
              <div className="text-left">
                <span className="text-xs text-stone-400 block font-normal">Active Course/Paper</span>
                <span className="text-stone-100 font-semibold truncate max-w-[220px] block">
                  {selectedCourse ? `${selectedCourse.code}: ${selectedCourse.title}` : courses.length === 0 ? 'No courses yet' : 'Select a course'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-stone-400 ml-1" />
            </button>

            {courseDropdownOpen && (
              <div className="absolute left-0 mt-2 w-80 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl py-2 z-50">
                <div className="px-3 py-1.5 text-xs font-mono uppercase text-stone-400 border-b border-stone-800">
                  Enrolled Courses & Papers
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {courses.length === 0 ? (
                    <div className="px-4 py-5 text-center text-stone-400 text-xs">
                      No courses created yet.
                    </div>
                  ) : (
                    courses.map((course) => (
                      <button
                        key={course.id}
                        onClick={() => {
                          onSelectCourse(course);
                          setCourseDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-sm flex flex-col transition-colors ${
                          selectedCourse?.id === course.id
                            ? 'bg-amber-500/20 text-amber-300 font-semibold'
                            : 'text-stone-200 hover:bg-stone-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-amber-400 font-bold">{course.code}</span>
                          <span className="text-[10px] text-stone-400">{course.semester || 'Semester'}</span>
                        </div>
                        <span className="truncate text-xs text-stone-300 mt-0.5">{course.title}</span>
                      </button>
                    ))
                  )}
                </div>
                {isAdmin && (
                  <div className="p-2 border-t border-stone-800">
                    <button
                      onClick={() => {
                        setCourseDropdownOpen(false);
                        onOpenNewCourse();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 text-xs font-medium border border-amber-500/40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create New Course / Paper
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Offline Study Pack Download */}
            {selectedCourse && (
              <button
                onClick={onDownloadCourseDossier}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium border border-stone-700 transition-colors"
                title="Download full course study pack for offline viewing"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Offline Dossier</span>
              </button>
            )}

            {/* Admin Library Management */}
            {isAdmin && (
              <button
                onClick={onOpenBookManager}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-medium border border-amber-500/30 transition-colors"
                title="Upload & manage reference textbooks"
              >
                <BookMarked className="w-3.5 h-3.5 text-amber-400" />
                <span>Manage Books</span>
              </button>
            )}

            {/* Admin Role Toggle (for convenient evaluation) */}
            <button
              onClick={onToggleDemoAdmin}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isAdmin
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-stone-800/80 text-stone-400 border-stone-700 hover:text-stone-200'
              }`}
              title="Toggle admin mode"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>{isAdmin ? 'Admin Mode' : 'Student Mode'}</span>
            </button>

            {/* User Auth Info / Google Sign In */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-stone-800">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-7 h-7 rounded-full border border-amber-500/50"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-amber-600/30 text-amber-300 flex items-center justify-center text-xs font-bold">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="text-left hidden xl:block">
                  <div className="text-xs font-medium text-stone-200 truncate max-w-[120px]">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono truncate max-w-[120px]">
                    {currentUser.email === ADMIN_EMAIL ? 'Verified Admin' : 'Student'}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-md transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={authLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{authLoading ? 'Signing In...' : 'Google Sign In'}</span>
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={onToggleDemoAdmin}
              className={`p-1.5 rounded-lg text-xs border ${
                isAdmin ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-stone-800 text-stone-400 border-stone-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-stone-800 text-stone-200 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-stone-900 border-b border-stone-800 px-4 py-4 space-y-4">
          <div>
            <label className="text-xs font-mono text-stone-400 uppercase block mb-1">Select Course / Paper</label>
            <select
              value={selectedCourse?.id || ''}
              onChange={(e) => {
                const found = courses.find((c) => c.id === e.target.value);
                if (found) {
                  onSelectCourse(found);
                  setMobileMenuOpen(false);
                }
              }}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-sm text-stone-200"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}: {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-800">
            {selectedCourse && onDownloadCourseDossier && (
              <button
                onClick={() => {
                  onDownloadCourseDossier?.();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-stone-800 text-stone-200 text-xs font-medium border border-stone-700"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Offline Dossier</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => {
                  onOpenBookManager();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-stone-800 text-amber-300 text-xs font-medium border border-amber-500/30"
              >
                <BookMarked className="w-3.5 h-3.5 text-amber-400" />
                <span>Manage Books</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => {
                  onOpenNewCourse();
                  setMobileMenuOpen(false);
                }}
                className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-600/30 text-amber-300 text-xs font-medium border border-amber-500/40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Course / Paper</span>
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
            {currentUser ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-stone-300">{currentUser.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-600 text-white text-xs font-medium"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
