import { useLocation } from 'react-router-dom';
import { resolveLocation } from '../content/location';
import type { Theme } from '../state/useTheme';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onOpenSearch?: () => void;
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
}: HeaderProps) {
  const { pathname } = useLocation();
  const { documentLabel, sectionLabel } = resolveLocation(pathname);

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
