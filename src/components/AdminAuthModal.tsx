import React, { useEffect, useState } from 'react';
import {
  X,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Wand2,
  Copy,
  Check,
} from 'lucide-react';
import {
  User,
  auth,
  googleProvider,
  createSeparateAuthUser,
  signInWithPopup,
  signInWithEmailAndPassword,
  updatePassword,
} from '../lib/firebase';
import {
  ADMIN_EMAIL,
  ADMIN_LOGIN_ID,
  ADMIN_ID_EMAIL,
  registerAdminEntity,
  getRegisteredAdmin123,
} from '../lib/dataService';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  isVerifiedAdmin: boolean;
}

type AuthMode = 'signin' | 'setup';

function generateStrongPassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;
  const pick = (chars: string) => {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return chars[arr[0] % chars.length];
  };
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function resolveSeparateAdminEmail(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase() === ADMIN_LOGIN_ID.toLowerCase()) {
    return ADMIN_ID_EMAIL;
  }
  return trimmed;
}

function getReadableAuthError(err: any): { message: string; isProviderDisabled: boolean } {
  const code = err?.code || '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return {
        message:
          'Email/Password sign-in is not enabled yet in Firebase Authentication. Enable the Email/Password provider in Firebase Console (Authentication → Sign-in method) and try again.',
        isProviderDisabled: true,
      };
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        message: `Invalid ${ADMIN_LOGIN_ID} credentials or password. If ${ADMIN_LOGIN_ID} has not been created yet, sign in with Google Mail ID first and create ${ADMIN_LOGIN_ID}.`,
        isProviderDisabled: false,
      };
    case 'auth/invalid-email':
      return {
        message: `Enter Admin ID "${ADMIN_LOGIN_ID}" to sign in.`,
        isProviderDisabled: false,
      };
    case 'auth/email-already-in-use':
      return {
        message: `${ADMIN_LOGIN_ID} already has an account in Firebase Authentication. Sign in as ${ADMIN_LOGIN_ID} directly to update its password, or manage it in Firebase Console → Authentication → Users.`,
        isProviderDisabled: false,
      };
    case 'auth/weak-password':
      return {
        message: 'Password is too weak. Please choose at least 6 characters (8+ recommended).',
        isProviderDisabled: false,
      };
    case 'auth/requires-recent-login':
      return {
        message: `For security, please sign out and sign back in as ${ADMIN_LOGIN_ID} before updating its password.`,
        isProviderDisabled: false,
      };
    case 'auth/too-many-requests':
      return {
        message: 'Too many attempts. Please wait a moment before trying again.',
        isProviderDisabled: false,
      };
    default:
      return {
        message: err?.message || 'Authentication failed. Please try again.',
        isProviderDisabled: false,
      };
  }
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isVerifiedAdmin,
}) => {
  const isLoggedInAsAdmin123 = Boolean(
    currentUser && currentUser.email?.toLowerCase() === ADMIN_ID_EMAIL.toLowerCase()
  );
  const isLoggedInAsMailAdmin = Boolean(
    currentUser &&
      isVerifiedAdmin &&
      currentUser.email?.toLowerCase() !== ADMIN_ID_EMAIL.toLowerCase()
  );

  const [mode, setMode] = useState<AuthMode>(currentUser && isVerifiedAdmin ? 'setup' : 'signin');
  const [adminIdInput, setAdminIdInput] = useState<string>(ADMIN_LOGIN_ID);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [copiedPassword, setCopiedPassword] = useState<boolean>(false);
  const [admin123Registered, setAdmin123Registered] = useState<boolean>(false);
  const [checkingRegistry, setCheckingRegistry] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProviderDisabled, setIsProviderDisabled] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode(currentUser && isVerifiedAdmin ? 'setup' : 'signin');
    setAdminIdInput(ADMIN_LOGIN_ID);
    setPassword('');
    setConfirmPassword('');
    setCopiedPassword(false);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProviderDisabled(false);

    if (currentUser && isVerifiedAdmin) {
      setCheckingRegistry(true);
      getRegisteredAdmin123()
        .then((found) => {
          setAdmin123Registered(Boolean(found));
        })
        .catch(() => {
          setAdmin123Registered(false);
        })
        .finally(() => {
          setCheckingRegistry(false);
        });
    } else {
      setAdmin123Registered(false);
      setCheckingRegistry(false);
    }
    // Reset only when modal opens so in-modal auth transitions keep status messages intact
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const resolvedAuthEmail = resolveSeparateAdminEmail(adminIdInput);

  const handleSignInWithAdmin123 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProviderDisabled(false);

    if (!adminIdInput.trim() || !password) {
      setErrorMsg(`Enter Admin ID "${ADMIN_LOGIN_ID}" and password.`);
      return;
    }

    if (resolvedAuthEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      setErrorMsg(
        `"${ADMIN_LOGIN_ID}" and your Mail ID (${ADMIN_EMAIL}) are two separate logins. Use "Continue with Google Sign-In" for ${ADMIN_EMAIL}, or enter "${ADMIN_LOGIN_ID}" here.`
      );
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, resolvedAuthEmail, password);
      onClose();
    } catch (err: any) {
      const parsed = getReadableAuthError(err);
      setErrorMsg(parsed.message);
      setIsProviderDisabled(parsed.isProviderDisabled);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdateAdmin123 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProviderDisabled(false);

    if (!currentUser || !isVerifiedAdmin) {
      setErrorMsg(`You must be signed in as Admin to manage ${ADMIN_LOGIN_ID}.`);
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      if (isLoggedInAsAdmin123) {
        // Admin123 updating its own password
        await updatePassword(currentUser, password);
        setSuccessMsg(
          `Password updated for ${ADMIN_LOGIN_ID}. Your Mail ID login (${ADMIN_EMAIL}) remains completely separate.`
        );
        setPassword('');
        setConfirmPassword('');
        return;
      }

      // Mail ID Admin creating the separate Admin123 Firebase Auth entity + /admins/{uid} record
      const newAdminUid = await createSeparateAuthUser(ADMIN_ID_EMAIL, password);
      await registerAdminEntity(newAdminUid, ADMIN_ID_EMAIL, 'admin123');
      setAdmin123Registered(true);
      setSuccessMsg(
        `Separate "${ADMIN_LOGIN_ID}" entity created! You stayed logged in as ${currentUser.email}, and you can now sign in separately using ID "${ADMIN_LOGIN_ID}" and this password.`
      );
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const parsed = getReadableAuthError(err);
      setErrorMsg(parsed.message);
      setIsProviderDisabled(parsed.isProviderDisabled);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleMailLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setMode('setup');
        setAdminIdInput(ADMIN_LOGIN_ID);
        setCheckingRegistry(true);
        getRegisteredAdmin123()
          .then((found) => setAdmin123Registered(Boolean(found)))
          .catch(() => setAdmin123Registered(false))
          .finally(() => setCheckingRegistry(false));
        setSuccessMsg(
          `Signed in with Mail ID (${result.user.email}). You can create the separate "${ADMIN_LOGIN_ID}" entity below if needed.`
        );
      } else {
        onClose();
      }
    } catch (err: any) {
      const parsed = getReadableAuthError(err);
      setErrorMsg(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-auth-modal-title"
        className="w-full max-w-md bg-stone-900 text-stone-100 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 id="admin-auth-modal-title" className="font-serif font-bold text-lg text-stone-50">
                {ADMIN_LOGIN_ID} Entity Login
              </h2>
              <p className="text-[11px] text-stone-400">
                Separate from your Mail ID ({ADMIN_EMAIL}) login
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher (Admin123 Setup/Password only available when Admin is logged in) */}
        {currentUser && isVerifiedAdmin && (
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-950 border border-stone-800">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setIsProviderDisabled(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'signin'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {ADMIN_LOGIN_ID} Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('setup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setIsProviderDisabled(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'setup'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {isLoggedInAsAdmin123 ? `Update ${ADMIN_LOGIN_ID}` : `Create ${ADMIN_LOGIN_ID}`}
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
              {isProviderDisabled && (
                <div className="pl-6 pt-1 text-[11px] text-rose-200/90 space-y-1 border-t border-rose-500/20">
                  <p className="font-semibold text-amber-300">Firebase Console Setup Needed:</p>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>Open Firebase Console → <strong>Authentication</strong> → <strong>Sign-in method</strong></li>
                    <li>Select <strong>Email/Password</strong>, toggle <strong>Enable</strong>, and click <strong>Save</strong></li>
                    <li>Return here to create or sign in with {ADMIN_LOGIN_ID}</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {!(currentUser && isVerifiedAdmin) || mode === 'signin' ? (
            <form onSubmit={handleSignInWithAdmin123} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1.5">
                  Admin ID
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={adminIdInput}
                    onChange={(e) => setAdminIdInput(e.target.value)}
                    placeholder={ADMIN_LOGIN_ID}
                    autoComplete="username"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-500 focus:outline-none text-sm text-stone-100 placeholder:text-stone-600"
                    required
                  />
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  Independent Admin ID entity (separate from Google Mail login).
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={`Enter ${ADMIN_LOGIN_ID} password`}
                    autoComplete="current-password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-500 focus:outline-none text-sm text-stone-100 placeholder:text-stone-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>{loading ? 'Signing In...' : `Sign In as ${ADMIN_LOGIN_ID}`}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreateOrUpdateAdmin123} className="space-y-4">
              {isLoggedInAsAdmin123 ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-amber-100">
                      Signed in as {ADMIN_LOGIN_ID} Entity
                    </div>
                    <div className="text-[11px] text-amber-200/80 mt-0.5">
                      Update the password for {ADMIN_LOGIN_ID} below. Your Mail ID ({ADMIN_EMAIL}) remains a separate login.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-amber-100">
                      Mail ID Admin: {currentUser?.email}
                    </div>
                    <div className="text-[11px] text-amber-200/80 mt-0.5">
                      {checkingRegistry
                        ? `Checking ${ADMIN_LOGIN_ID} status...`
                        : admin123Registered
                        ? `${ADMIN_LOGIN_ID} is already registered as a separate Admin account. To change its password, sign out and log in as ${ADMIN_LOGIN_ID}.`
                        : `Create "${ADMIN_LOGIN_ID}" as a separate Admin entity with its own UID and password (your Mail ID stays untouched).`}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1.5">
                  Separate Admin ID
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={ADMIN_LOGIN_ID}
                    disabled
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-sm text-stone-100 opacity-75"
                    required
                  />
                </div>
              </div>

              {(!isLoggedInAsMailAdmin || !admin123Registered) && (
                <>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="block text-xs font-mono uppercase text-stone-400">
                        {isLoggedInAsAdmin123 ? 'New Password' : `Password for ${ADMIN_LOGIN_ID}`}
                      </label>
                      <div className="flex items-center gap-2">
                        {password && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(password);
                                setCopiedPassword(true);
                                setTimeout(() => setCopiedPassword(false), 2000);
                              } catch {
                                // Clipboard fallback ignored if blocked
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-stone-300 hover:text-amber-300 transition-colors"
                          >
                            {copiedPassword ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const nextPass = generateStrongPassword(14);
                            setPassword(nextPass);
                            setConfirmPassword(nextPass);
                            setShowPassword(true);
                            setCopiedPassword(false);
                            setErrorMsg(null);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          <Wand2 className="w-3 h-3" />
                          <span>Generate Strong Password</span>
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        autoComplete="new-password"
                        minLength={6}
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-500 focus:outline-none text-sm font-mono text-stone-100 placeholder:text-stone-600 placeholder:font-sans"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-stone-400 mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                        minLength={6}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-500 focus:outline-none text-sm text-stone-100 placeholder:text-stone-600"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isLoggedInAsAdmin123 ? (
                      <RefreshCw className="w-4 h-4" />
                    ) : (
                      <KeyRound className="w-4 h-4" />
                    )}
                    <span>
                      {loading
                        ? 'Saving...'
                        : isLoggedInAsAdmin123
                        ? `Update ${ADMIN_LOGIN_ID} Password`
                        : `Create Separate ${ADMIN_LOGIN_ID} Account`}
                    </span>
                  </button>
                </>
              )}
            </form>
          )}

          {/* Alternative Mail ID Google Sign-In */}
          {!currentUser && (
            <div className="pt-3 border-t border-stone-800">
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleMailLogin}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Sign In with Mail ID (Google)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
