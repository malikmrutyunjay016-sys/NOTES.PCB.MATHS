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
  Home,
  KeyRound,
} from 'lucide-react';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { Course } from '../types';

interface HeaderProps {
  courses: Course[];
  selectedCourse: Course | null;
  onSelectCourse: (course: Course) => void;
  onGoHome?: () => void;
  currentUser: User | null;
  isAdmin: boolean;
  canToggleAdmin?: boolean;
  onToggleDemoAdmin: () => void;
  onOpenAdminLogin: () => void;
  onOpenNewCourse: () => void;
  onOpenBookManager: () => void;
  onDownloadCourseDossier?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  courses,
  selectedCourse,
  onSelectCourse,
  onGoHome,
  currentUser,
  isAdmin,
  canToggleAdmin = false,
  onToggleDemoAdmin,
  onOpenAdminLogin,
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
          <button
            type="button"
            onClick={() => {
              setCourseDropdownOpen(false);
              onGoHome?.();
            }}
            className="flex items-center gap-3 text-left hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-xl"
            title="Go to Home Page"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-stone-950 rounded-[10px] flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-xl tracking-tight text-stone-50">Notes</span>
              </div>
              <p className="text-[11px] text-stone-400 hidden sm:block">Academic Study Portal</p>
            </div>
          </button>

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
                  {selectedCourse ? `${selectedCourse.code}: ${selectedCourse.title}` : courses.length === 0 ? 'No courses yet' : 'All Courses (Home)'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-stone-400 ml-1" />
            </button>

            {courseDropdownOpen && (
              <div className="absolute left-0 mt-2 w-80 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl py-2 z-50">
                <div className="px-3 py-1.5 text-xs font-mono uppercase text-stone-400 border-b border-stone-800">
                  Available Courses & Papers
                </div>
                {onGoHome && (
                  <button
                    type="button"
                    onClick={() => {
                      onGoHome();
                      setCourseDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 border-b border-stone-800 transition-colors ${
                      !selectedCourse
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-stone-200 hover:bg-stone-800'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Home — All Courses &amp; Papers</span>
                  </button>
                )}
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

            {/* Admin Role Toggle & Password Setup (visible to verified admin) */}
            {canToggleAdmin && (
              <>
                <button
                  onClick={onToggleDemoAdmin}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isAdmin
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-stone-800/80 text-stone-400 border-stone-700 hover:text-stone-200'
                  }`}
                  title="Toggle between Admin Mode and Student View"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isAdmin ? 'Admin Mode' : 'Student View'}</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium border border-stone-700 transition-colors"
                  title="Create or update Admin ID & password"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden xl:inline">Admin Password</span>
                </button>
              </>
            )}

            {/* User Auth Info / Admin ID & Google Sign In */}
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
                    {canToggleAdmin ? 'Verified Admin' : 'Student'}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-colors"
                  title="Sign in with Admin ID & Password"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin ID Login</span>
                </button>
                <button
                  onClick={handleSignIn}
                  disabled={authLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{authLoading ? 'Signing In...' : 'Google Sign In'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            {canToggleAdmin && (
              <button
                onClick={onToggleDemoAdmin}
                className={`p-1.5 rounded-lg text-xs border ${
                  isAdmin ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-stone-800 text-stone-400 border-stone-700'
                }`}
                title="Toggle between Admin Mode and Student View"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              </button>
            )}
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
          {onGoHome && (
            <button
              type="button"
              onClick={() => {
                onGoHome();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium border border-stone-700"
            >
              <Home className="w-3.5 h-3.5 text-amber-400" />
              <span>Home — All Courses &amp; Papers</span>
            </button>
          )}
          <div>
            <label className="text-xs font-mono text-stone-400 uppercase block mb-1">Select Course / Paper</label>
            <select
              value={selectedCourse?.id || ''}
              onChange={(e) => {
                if (!e.target.value) {
                  onGoHome?.();
                  setMobileMenuOpen(false);
                  return;
                }
                const found = courses.find((c) => c.id === e.target.value);
                if (found) {
                  onSelectCourse(found);
                  setMobileMenuOpen(false);
                }
              }}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2.5 text-sm text-stone-200"
            >
              <option value="">All Courses (Home Page)</option>
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

          <div className="pt-2 border-t border-stone-800 space-y-2">
            {currentUser ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserIcon className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-stone-300 truncate">{currentUser.email}</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
                {canToggleAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAdminLogin();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-stone-800 text-amber-300 text-xs font-medium border border-amber-500/30"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Set / Update Admin Password</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAdminLogin();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-stone-800 text-amber-300 text-xs font-medium border border-amber-500/30"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Admin ID Login</span>
                </button>
                <button
                  onClick={handleSignIn}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-600 text-white text-xs font-medium"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Google Sign In</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
