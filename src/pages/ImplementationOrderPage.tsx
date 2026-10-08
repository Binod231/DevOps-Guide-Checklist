import { PageShell } from '../components/PageShell';
import { SectionHeader } from '../components/SectionHeader';
import { ChecklistGroup } from '../components/ChecklistGroup';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { PHASE_CHECKLIST, checklist } from '../content/registry';
import { usePortalState } from '../state/PortalStateProvider';

/**
 * Suggested Implementation Order.
 *
 * The four phases and their 23 items, in source order, with progress scoped
 * per phase and rolled up across the section.
 *
 * This checklist is tracked separately from the guide's `Implementation
 * complete` boxes and from the Production Readiness Gate. The three sets are
 * worded differently in the source documents, so they are never merged or
 * cross-mapped — ticking an item here changes nothing elsewhere.
 */
export function ImplementationOrderPage() {
  const { progressFor } = usePortalState();
  const overall = progressFor(PHASE_CHECKLIST);

  return (
    <PageShell>
      <SectionHeader
        eyebrow={checklist.title}
        heading={checklist.implementationOrderHeading}
      />

      <div className="mt-6">
        <ProgressIndicator label="Implementation order progress" progress={overall} live />
      </div>

      <div className="mt-6 space-y-5">
        {checklist.phases.map((phase) => (
          <ChecklistGroup
            key={phase.id}
            id={phase.id}
            heading={phase.heading}
            items={phase.items}
          />
        ))}
      </div>
    </PageShell>
  );
}
