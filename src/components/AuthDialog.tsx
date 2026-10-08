import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../state/authContext';
import { useFocusTrap } from '../state/useFocusTrap';
import { clearCognitoSession } from '../state/cognitoAuth';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const {
    isAdmin,
    isVerifiedUser,
    username: activeUsername,
    loginAsAdmin,
    loginWithCognito,
    logout,
    switchToUser,
  } = useAuth();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      setError(null);
      setSuccessNotice(null);
      setPassword('');
      setLoading(false);
    } else {
      previouslyFocused.current?.focus?.();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // 1. Immediate validation against local/env admin credentials
    const localRes = loginAsAdmin(username, password);
    if (localRes.success) {
      setSuccessNotice('Successfully authenticated as Administrator!');
      setPassword('');
      setTimeout(() => {
        onClose();
      }, 700);
      return;
    }

    if (process.env.NODE_ENV === 'test') {
      setError(localRes.error || 'Invalid credentials. Please verify your credentials.');
      return;
    }

    // 2. Full AWS Cognito IDP authentication in browser
    setLoading(true);
    try {
      const res = await loginWithCognito(username, password);
      if (res.success) {
        setSuccessNotice(
          res.role === 'admin'
            ? 'Successfully authenticated as Administrator!'
            : `Successfully authenticated as Verified Contributor (${res.session?.username || username})!`,
        );
        setPassword('');
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        setError(res.error ?? 'Invalid credentials.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToNormalUser = () => {
    switchToUser();
    clearCognitoSession();
    setSuccessNotice('Switched to Normal User mode.');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleLogoutToGuest = () => {
    logout();
    setSuccessNotice('Signed out. Continuing in Self-Learner mode without login.');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const isAuthenticated = isAdmin || isVerifiedUser;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        className="relative w-full max-w-md border border-edge bg-surface p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-edge pb-3">
          <div className="flex items-center gap-2">
            <span
              className={[
                'flex size-7 items-center justify-center rounded-xs text-xs font-bold uppercase',
                isAdmin
                  ? 'bg-accent-subtle text-accent'
                  : isVerifiedUser
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-sunken text-ink-secondary',
              ].join(' ')}
              aria-hidden="true"
            >
              {isAdmin ? 'AD' : isVerifiedUser ? 'VU' : 'SL'}
            </span>
            <h2 id="auth-dialog-title" className="text-base font-semibold text-ink">
              {isAdmin
                ? 'Administrator Session'
                : isVerifiedUser
                  ? 'Verified Contributor'
                  : 'Admin Login'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-edge p-1 text-ink-muted hover:bg-sunken hover:text-ink"
            aria-label="Close dialog"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Current Role Indicator */}
          <div className="border border-edge bg-sunken px-3.5 py-2.5 text-xs">
            <span className="font-semibold text-ink-muted uppercase tracking-wide">
              Current Access:
            </span>{' '}
            <span
              className={[
                'font-semibold',
                isAdmin
                  ? 'text-accent'
                  : isVerifiedUser
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-ink-secondary',
              ].join(' ')}
            >
              {isAdmin
                ? `Administrator (${activeUsername}) — Full CRUD & Sign-off Verification`
                : isVerifiedUser
                  ? `Verified Contributor (${activeUsername}) — Verified Identity`
                  : 'Self-Learner Mode (Guest — No Login Required)'}
            </span>
          </div>

          {/* Self-learner tip */}
          {!isAuthenticated && (
            <div className="rounded border border-edge/80 bg-sunken/40 p-2.5 text-[11px] text-ink-secondary">
              <span className="font-semibold text-ink">Self-Learners:</span> You can use the entire
              portal (checkboxes, notes, tracker) freely without logging in. Login is only for
              Administrators or contributors who received an account from an admin.
            </div>
          )}

          {successNotice && (
            <div
              role="status"
              className="border border-status-done bg-status-done-surface px-3 py-2 text-xs font-medium text-status-done"
            >
              {successNotice}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="border border-p0 bg-p0-surface px-3 py-2 text-xs font-medium text-p0"
            >
              {error}
            </div>
          )}

          {isAuthenticated ? (
            /* Authenticated Active View */
            <div className="space-y-4">
              <p className="text-xs text-ink-secondary">
                {isAdmin
                  ? 'Logged in with administrator privileges via AWS Cognito. You have full CRUD across all guides, checklists, and tracker rows, plus sign-off verification.'
                  : `Signed in as verified contributor "${activeUsername}". Your completions and acknowledgements are recorded and ready for administrator verification.`}
              </p>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-edge pt-4">
                <button
                  type="button"
                  onClick={handleSwitchToNormalUser}
                  className="border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-sunken"
                >
                  Switch to Normal User
                </button>
                <button
                  type="button"
                  onClick={handleLogoutToGuest}
                  className="border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-sunken"
                >
                  Sign Out to Self-Learner Mode
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="border border-edge bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Login Form View */
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="auth-username" className="block text-xs font-medium text-ink">
                  Username or User ID:
                </label>
                <input
                  type="text"
                  id="auth-username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or john.devops"
                  className="mt-1 w-full border border-edge bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="auth-password" className="block text-xs font-medium text-ink">
                    Password:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-[11px] text-accent hover:underline"
                    tabIndex={-1}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="auth-password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="mt-1 w-full border border-edge bg-canvas px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-hidden"
                  required
                />
                <p className="mt-1 text-[11px] text-ink-muted">
                  Use your AWS Cognito credentials or configured administrator login.
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-edge pt-3 text-xs">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-ink-secondary hover:underline"
                >
                  Continue as Self-Learner
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="border border-edge px-3 py-1.5 font-medium text-ink-secondary hover:bg-sunken"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="border border-accent bg-accent px-4 py-1.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    {loading ? 'Authenticating...' : 'Log in as Admin'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
