import { useLocation } from 'react-router-dom';
import { breadcrumbTrail } from '../content/location';

/** Document title then section heading, both taken from the source documents. */
export function Breadcrumb() {
  const { pathname } = useLocation();
  const trail = breadcrumbTrail(pathname);

  if (trail.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="min-w-0 border-b border-edge bg-sunken px-4 py-2 sm:px-6"
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        {trail.map((label, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={`${index}-${label}`} className="flex items-center gap-2">
              {index > 0 && (
                <span aria-hidden="true" className="text-edge-strong">
                  /
                </span>
              )}
              <span
                className={isLast ? 'font-semibold text-ink-secondary' : undefined}
                aria-current={isLast ? 'page' : undefined}
                title={label}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
