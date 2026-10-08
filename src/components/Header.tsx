import { Link, useLocation } from 'react-router-dom';
import { resolveLocation } from '../content/location';
import { ROUTES } from '../content/registry';
import type { Theme } from '../state/useTheme';
import { useAuth } from '../state/authContext';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onOpenSearch?: () => void;
  onOpenAuth?: () => void;
}

/**
 * Portal header.
 *
 * Carries the portal title and the current section only. The source documents
 * contain no organisation name, version number or date, so none is shown —
 * inventing one would put text on screen that is not in the documents.
 */
export function Header({
  theme,
  onToggleTheme,
  onToggleSidebar,
  sidebarOpen,
  onOpenSearch,
  onOpenAuth,
}: HeaderProps) {
  const { pathname } = useLocation();
  const { documentLabel, sectionLabel } = resolveLocation(pathname);
  const { isAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-surface">
      <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-expanded={sidebarOpen}
          aria-controls="portal-sidebar"
          className="shrink-0 border border-edge p-1.5 text-ink-secondary hover:bg-sunken lg:hidden"
        >
          <span className="sr-only">
            {sidebarOpen ? 'Close section navigation' : 'Open section navigation'}
          </span>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="currentColor">
            <path d="M1 3h14v1.5H1V3zm0 4.25h14v1.5H1v-1.5zM1 11.5h14V13H1v-1.5z" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-ink">
            DevOps Implementation &amp; Readiness Portal
          </p>
          {sectionLabel && (
            <p className="truncate text-xs text-ink-muted">
              {documentLabel && (
                <>
                  <span>{documentLabel}</span>
                  <span aria-hidden="true" className="px-1.5 text-edge-strong">
                    /
                  </span>
                </>
              )}
              <span className="text-ink-secondary">{sectionLabel}</span>
            </p>
          )}
        </div>

        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex shrink-0 items-center gap-2 border border-edge px-2.5 py-1.5 text-sm text-ink-muted hover:bg-sunken hover:text-ink-secondary"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden border border-edge bg-sunken px-1 text-xs md:inline">
              Ctrl K
            </kbd>
          </button>
        )}

        {isAdmin && (
          <Link
            to={ROUTES.adminDashboard}
            className="flex shrink-0 items-center gap-1.5 border border-accent/40 bg-accent-subtle px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-white transition-colors"
            aria-label="Admin Dashboard"
            title="Open Admin Verification Dashboard"
          >
            <DashboardIcon />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        )}

        {onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            className={[
              'flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium transition-colors',
              isAdmin
                ? 'border-accent-border bg-accent-subtle text-accent hover:bg-accent-subtle/80'
                : 'border-edge bg-surface text-ink-secondary hover:bg-sunken',
            ].join(' ')}
            aria-label={
              isAdmin
                ? 'Administrator active. Click to manage session or log out'
                : 'Normal user active. Click to log in as administrator'
            }
          >
            {isAdmin ? (
              <>
                <ShieldIcon />
                <span className="hidden sm:inline font-semibold">Admin</span>
              </>
            ) : (
              <>
                <UserIcon />
                <span className="hidden sm:inline">Admin Login</span>
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          className="shrink-0 border border-edge p-1.5 text-ink-secondary hover:bg-sunken"
        >
          <span className="sr-only">
            Switch to {theme === 'dark' ? 'light' : 'dark'} theme
          </span>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="currentColor">
      <path d="M8 1l5 2.5v4c0 3.5-2.5 6-5 7.5-2.5-1.5-5-4-5-7.5v-4L8 1z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="5" r="3" />
      <path d="M2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="8" r="3.25" />
      <path
        d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="currentColor">
      <path d="M9.5 1.5a6.5 6.5 0 105 10.6 5.5 5.5 0 01-5-10.6z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="currentColor">
      <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm0 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8-8A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm0 8A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z" />
    </svg>
  );
}
