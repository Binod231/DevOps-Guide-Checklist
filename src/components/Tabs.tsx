import { useId, useRef, useState, type ReactNode } from 'react';

export interface TabDefinition {
  id: string;
  label: string;
  /** Count shown beside the label when the tab holds countable items. */
  count?: number;
  panel: ReactNode;
}

interface TabsProps {
  /** Accessible name for the tab list. */
  label: string;
  /**
   * Tabs to render. Callers filter out tabs with no content before passing
   * them in — an empty tab is never displayed.
   */
  tabs: TabDefinition[];
}

/**
 * ARIA tabs with arrow-key navigation and a roving tab index, following the
 * standard manual-activation pattern.
 */
export function Tabs({ label, tabs }: TabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  if (tabs.length === 0) return null;

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeId),
  );
  const active = tabs[activeIndex]!;

  const focusTab = (index: number) => {
    const target = tabs[(index + tabs.length) % tabs.length]!;
    setActiveId(target.id);
    tabRefs.current.get(target.id)?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusTab(activeIndex + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusTab(activeIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(tabs.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-0 border-b border-edge"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              className={[
                '-mb-px border-b-2 px-4 py-2 text-sm',
                selected
                  ? 'border-b-accent font-semibold text-accent'
                  : 'border-b-transparent text-ink-muted hover:border-b-edge-strong hover:text-ink-secondary',
              ].join(' ')}
            >
              {tab.label}
              {tab.count !== undefined && (
                <>
                  <span aria-hidden="true" className="ml-1.5 tabular-nums">
                    ({tab.count})
                  </span>
                  <span className="sr-only">{`, ${tab.count} items`}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active.id}
          tabIndex={0}
          className="pt-5"
        >
          {tab.id === active.id && tab.panel}
        </div>
      ))}
    </div>
  );
}
