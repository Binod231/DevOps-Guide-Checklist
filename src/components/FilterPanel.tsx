import type { FilterField, FilterState } from './trackerTableModel';
import { activeFilterCount } from './trackerTableModel';

export interface FilterGroup {
  field: FilterField;
  /** Header spelling from the source CSV, e.g. `Company Stage`. */
  label: string;
  options: string[];
}

interface FilterPanelProps {
  groups: FilterGroup[];
  filters: FilterState;
  onToggle: (field: FilterField, value: string) => void;
  onClear: () => void;
  /** Rows matching the current filters, for the result summary. */
  matching: number;
  total: number;
}

/**
 * Filters for the tracker.
 *
 * Only the attributes the source actually carries are offered, and each
 * attribute's options are the values present in the data. A group with fewer
 * than two options is dropped, because a filter that cannot narrow anything is
 * noise.
 */
export function FilterPanel({
  groups,
  filters,
  onToggle,
  onClear,
  matching,
  total,
}: FilterPanelProps) {
  const usable = groups.filter((group) => group.options.length > 1);
  const active = activeFilterCount(filters);

  if (usable.length === 0) return null;

  return (
    <section aria-labelledby="tracker-filters" className="border border-edge bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge bg-sunken px-4 py-2.5">
        <h2
          id="tracker-filters"
          className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
        >
          Filters
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-xs text-ink-muted tabular-nums" aria-live="polite">
            {matching === total
              ? `${total} rows`
              : `${matching} of ${total} rows match`}
          </p>
          {active > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="border border-edge bg-surface px-2 py-0.5 text-xs text-ink-secondary hover:bg-sunken"
            >
              Clear filters
              <span className="sr-only">{`, ${active} applied`}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
        {usable.map((group) => (
          <fieldset key={group.field} className="min-w-0">
            <legend className="mb-1.5 text-xs font-semibold text-ink-secondary">
              {group.label}
            </legend>
            <div className="space-y-1">
              {group.options.map((option) => {
                const id = `filter-${group.field}-${option.replace(/\W+/g, '-')}`;
                return (
                  <div key={option} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={id}
                      checked={filters[group.field].includes(option)}
                      onChange={() => onToggle(group.field, option)}
                      className="size-3.5 shrink-0 cursor-pointer accent-[var(--portal-accent)]"
                    />
                    <label htmlFor={id} className="cursor-pointer text-sm text-ink-secondary">
                      {option}
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
