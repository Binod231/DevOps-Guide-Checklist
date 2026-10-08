import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_TREE, ROUTES, type NavGroup, type NavLeaf, type NavNode } from '../content/registry';
import { useAuth } from '../state/authContext';

interface SidebarNavProps {
  /** Invoked after a navigation, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}

/**
 * Sidebar navigation rendered from the content registry.
 *
 * Every label is a heading or title taken from a source document; the tree is
 * derived, never hand-listed, so it cannot drift from the documents.
 */
export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const { isAdmin } = useAuth();

  return (
    <nav aria-label="Portal sections" className="py-4">
      <ul className="space-y-1">
        {NAV_TREE.map((node) => (
          <li key={node.id}>
            {node.kind === 'group' ? (
              <NavGroupSection group={node} onNavigate={onNavigate} />
            ) : (
              <NavLeafLink leaf={node} onNavigate={onNavigate} />
            )}
          </li>
        ))}

        {isAdmin && (
          <li className="pt-3 border-t border-edge/60">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Administration
            </div>
            <NavLink
              to={ROUTES.adminDashboard}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2 border-l-2 px-3 py-1.5 text-sm leading-snug',
                  isActive
                    ? 'border-l-accent bg-accent-subtle font-semibold text-accent'
                    : 'border-l-transparent text-ink-secondary hover:border-l-edge-strong hover:bg-sunken',
                ].join(' ')
              }
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="currentColor">
                <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm0 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8-8A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm0 8A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z" />
              </svg>
              <span>Admin Dashboard</span>
            </NavLink>
          </li>
        )}
      </ul>
    </nav>
  );
}

function NavGroupSection({ group, onNavigate }: { group: NavGroup; onNavigate?: () => void }) {
  const location = useLocation();
  const containsActive = collectPaths(group.children).includes(location.pathname);
  const [open, setOpen] = useState(true);
  const contentId = `nav-group-${group.id}`;

  return (
    <div className="pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted hover:text-ink"
      >
        <Chevron open={open} />
        <span className="flex-1">{group.label}</span>
      </button>

      <ul id={contentId} hidden={!open} className="mt-1 space-y-0.5">
        {group.children.map((child) => (
          <li key={child.id}>
            {child.kind === 'group' ? (
              <NavGroupSection group={child} onNavigate={onNavigate} />
            ) : (
              <NavLeafLink
                leaf={child}
                onNavigate={onNavigate}
                showAnchors={containsActive && location.pathname === child.path}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavLeafLink({
  leaf,
  onNavigate,
  showAnchors = false,
}: {
  leaf: NavLeaf;
  onNavigate?: () => void;
  showAnchors?: boolean;
}) {
  return (
    <>
      <NavLink
        to={leaf.path}
        end
        onClick={onNavigate}
        className={({ isActive }) =>
          [
            'flex items-start gap-2 border-l-2 px-3 py-1.5 text-sm leading-snug',
            isActive
              ? 'border-l-accent bg-accent-subtle font-semibold text-accent'
              : 'border-l-transparent text-ink-secondary hover:border-l-edge-strong hover:bg-sunken',
          ].join(' ')
        }
      >
        {({ isActive }) => (
          <>
            <span
              className="flex-1"
              aria-current={isActive ? 'page' : undefined}
              // The full heading when the label was shortened, so the stage
              // qualifier is still reachable.
              title={leaf.fullLabel === leaf.label ? undefined : leaf.fullLabel}
            >
              {leaf.label}
            </span>
            {leaf.count !== undefined && (
              <>
                <span
                  aria-hidden="true"
                  className="mt-px shrink-0 border border-edge bg-surface px-1 text-xs tabular-nums text-ink-muted"
                >
                  {leaf.count}
                </span>
                {/* Reads as "<section>, 16 items" rather than a bare number. */}
                <span className="sr-only">{`, ${leaf.count} items`}</span>
              </>
            )}
          </>
        )}
      </NavLink>

      {showAnchors && leaf.anchors && leaf.anchors.length > 0 && (
        <ul className="my-1 ml-5 space-y-0.5 border-l border-edge pl-2">
          {leaf.anchors.map((anchor) => (
            <li key={anchor.id}>
              <a
                href={`#${anchor.id}`}
                onClick={onNavigate}
                title={anchor.fullLabel === anchor.label ? undefined : anchor.fullLabel}
                className="block py-1 pr-2 text-xs leading-snug text-ink-muted hover:text-accent hover:underline"
              >
                {anchor.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`size-3 shrink-0 ${open ? '' : '-rotate-90'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function collectPaths(nodes: NavNode[]): string[] {
  return nodes.flatMap((node) => (node.kind === 'leaf' ? [node.path] : collectPaths(node.children)));
}
