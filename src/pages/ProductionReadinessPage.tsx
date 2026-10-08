import { PageShell } from '../components/PageShell';
import { SectionHeader } from '../components/SectionHeader';
import { ChecklistItem } from '../components/ChecklistItem';
import { ReadinessGatePanel } from '../components/ReadinessGatePanel';
import { READINESS_CHECKLIST, checklist } from '../content/registry';
import { usePortalState } from '../state/PortalStateProvider';

/**
 * Production Readiness Gate.
 *
 * The document's lead-in sentence followed by its 16 criteria, verbatim and in
 * source order. Readiness is computed from these 16 criteria alone — the guide
 * practices and the implementation-order phases are tracked separately and are
 * never folded into this figure.
 */
export function ProductionReadinessPage() {
  const { progressFor } = usePortalState();
  const progress = progressFor(READINESS_CHECKLIST);
  const { readinessGate } = checklist;

  return (
    <PageShell>
      <SectionHeader
        eyebrow={checklist.title}
        heading={readinessGate.heading}
        intro={readinessGate.intro}
      />

      <div className="mt-6">
        <ReadinessGatePanel progress={progress} />
      </div>

      <section aria-labelledby="readiness-criteria" className="mt-6 border border-edge bg-surface">
        <div className="border-b border-edge bg-sunken px-4 py-3">
          <h2
            id="readiness-criteria"
            className="text-sm font-semibold uppercase tracking-wide text-ink-muted"
          >
            Criteria
          </h2>
        </div>

        <ol className="divide-y divide-edge">
          {readinessGate.criteria.map((criterion, index) => (
            <li key={criterion.id} className="flex gap-3 px-4 py-3">
              <span
                aria-hidden="true"
                className="mt-0.5 w-5 shrink-0 text-right font-mono text-xs text-ink-muted tabular-nums"
              >
                {index + 1}
              </span>
              <ChecklistItem id={criterion.id} text={criterion.text} dense />
            </li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}
