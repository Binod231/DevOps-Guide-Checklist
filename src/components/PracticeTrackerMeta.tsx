import type { TrackerRow } from '../content/types';
import { usePortalState } from '../state/PortalStateProvider';
import { PriorityBadge, StageBadge, StatusBadge } from './badges';

/**
 * The tracker metadata strip shown on a guide practice. (ADDITION 3.)
 *
 * The documents never state that a guide practice and a tracker row are the
 * same item — their names differ — so this strip is an asserted link, declared
 * explicitly in `src/content/crosslink.ts`. It is hidden entirely when
 * `UI_FLAGS.guideTrackerCrossLink` is off.
 *
 * Status reflects the reader's edit when there is one, so the guide and the
 * tracker never disagree about the same row.
 */
export function PracticeTrackerMeta({ row }: { row: TrackerRow }) {
  const { trackerRowState } = usePortalState();
  const edits = trackerRowState(row.rowKey);
  const status = edits.status ?? row.status;

  return (
    <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      <div className="flex items-center gap-1.5">
        <dt className="uppercase tracking-wide text-ink-muted">S.N</dt>
        <dd className="font-mono text-ink-secondary">{row.sn}</dd>
      </div>

      <div className="flex items-center gap-1.5">
        <dt className="uppercase tracking-wide text-ink-muted">Priority</dt>
        <dd>
          <PriorityBadge value={row.priority} />
        </dd>
      </div>

      <div className="flex items-center gap-1.5">
        <dt className="uppercase tracking-wide text-ink-muted">Company Stage</dt>
        <dd>
          <StageBadge value={row.companyStage} />
        </dd>
      </div>

      <div className="flex items-center gap-1.5">
        <dt className="uppercase tracking-wide text-ink-muted">Status</dt>
        <dd>
          <StatusBadge value={status} />
        </dd>
      </div>
    </dl>
  );
}
