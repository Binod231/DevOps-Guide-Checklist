import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InlineMarkdown } from './InlineMarkdown';
import {
  type SearchResult,
  entryUrl,
  groupResults,
  search,
} from '../search/searchIndex';

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Global search over the source documents.
 *
 * A modal dialog with a focus trap, Escape to close, and arrow-key navigation
 * through the results. Results are grouped by source document and link to the
 * anchor where the text lives.
 */
export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const labelId = useId();
  const listboxId = useId();

  const results = useMemo(() => search(query), [query]);
  const buckets = useMemo(() => groupResults(results), [results]);

  // Reset and focus on open; restore focus to the trigger on close.
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setActiveIndex(0);
      inputRef.current?.focus();
    } else {
      previouslyFocused.current?.focus?.();
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the highlighted result in view as the selection moves.
  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  const goTo = (result: SearchResult) => {
    navigate(entryUrl(result));
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) =>
        results.length === 0 ? 0 : (i - 1 + results.length) % results.length,
      );
      return;
    }

    if (event.key === 'Enter') {
      const result = results[activeIndex];
      if (result) {
        event.preventDefault();
        goTo(result);
      }
      return;
    }

    // Focus trap: Tab cycles within the dialog.
    if (event.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  let runningIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className="relative flex max-h-full w-full max-w-2xl flex-col border border-edge-strong bg-surface shadow-lg"
      >
        <h2 id={labelId} className="sr-only">
          Search the source documents
        </h2>

        <div className="flex items-center gap-2 border-b border-edge px-3 py-2.5">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-4 shrink-0 text-ink-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>

          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-label="Search sections, checklist items, control IDs and document text"
            placeholder={'Search sections, items, control IDs\u2026'}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent py-1 text-ink outline-none placeholder:text-ink-muted"
          />

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 border border-edge px-2 py-1 text-xs text-ink-secondary hover:bg-sunken"
          >
            Close
          </button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {query.trim() === '' ? (
            <p className="px-4 py-6 text-sm text-ink-muted">
              Search headings, checklist items, control IDs and field text across the three source
              documents.
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted" role="status">
              No matches for &ldquo;{query}&rdquo; in the source documents.
            </p>
          ) : (
            <>
              <p className="sr-only" role="status">
                {`${results.length} ${results.length === 1 ? 'match' : 'matches'}`}
              </p>

              {/*
                A listbox may only contain options, so the group headers are
                presentational and each option names its own document instead.
                Fragments keep the options as direct DOM children.
              */}
              <div id={listboxId} role="listbox" aria-label="Search results">
                {buckets.map((bucket) => (
                  <Fragment key={bucket.group}>
                    <div
                      aria-hidden="true"
                      data-group-header={bucket.group}
                      className="sticky top-0 border-b border-edge bg-sunken px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted"
                    >
                      {bucket.group}
                      <span className="ml-2 font-normal tabular-nums">
                        {bucket.results.length}
                      </span>
                    </div>

                    {bucket.results.map((result) => {
                      runningIndex += 1;
                      const index = runningIndex;
                      const active = index === activeIndex;
                      return (
                        <button
                          key={result.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          data-active={active}
                          tabIndex={-1}
                          onClick={() => goTo(result)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={[
                            'block w-full border-b border-edge px-4 py-2.5 text-left',
                            active ? 'bg-accent-subtle' : 'hover:bg-sunken',
                          ].join(' ')}
                        >
                          <span className="flex items-baseline gap-2">
                            <span className="min-w-0 flex-1 text-sm text-ink">
                              <InlineMarkdown text={result.title} />
                            </span>
                            {result.field && (
                              <span className="shrink-0 border border-edge bg-surface px-1 text-xs text-ink-muted">
                                {result.field}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-muted">
                            {result.context}
                          </span>
                          {result.snippet && (
                            <span className="mt-1 block line-clamp-2 text-xs text-ink-secondary">
                              <InlineMarkdown text={result.snippet} />
                            </span>
                          )}
                          {/* Conveys the grouping, which the visual header
                              cannot carry for assistive technology. */}
                          <span className="sr-only">{`, in ${bucket.group}`}</span>
                        </button>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-edge bg-sunken px-4 py-2 text-xs text-ink-muted">
          <span>
            <kbd className="border border-edge bg-surface px-1">&uarr;</kbd>{' '}
            <kbd className="border border-edge bg-surface px-1">&darr;</kbd> to navigate
          </span>
          <span>
            <kbd className="border border-edge bg-surface px-1">Enter</kbd> to open
          </span>
          <span>
            <kbd className="border border-edge bg-surface px-1">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
