/**
 * Content generator.
 *
 * Reads the four authored source documents and emits typed JSON into
 * `src/content/generated/`. This is the only code that touches the sources, and
 * it only ever reads them.
 *
 * It also emits `sources.json` carrying the raw text of each document. The
 * fidelity suite uses that to assert every generated string is a verbatim
 * substring of its source. Only test files import it, so it never reaches the
 * production bundle.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GENERATED_DIR, PROJECT_ROOT, SOURCE_FILENAMES, sourcePath } from '../content.config';
import { parseGuide } from '../src/content/parsers/guide';
import { parseChecklist } from '../src/content/parsers/checklist';
import { parseTracker } from '../src/content/parsers/tracker';
import { buildGuideTrackerLinks } from '../src/content/crosslink';

type RawSources = Record<keyof typeof SOURCE_FILENAMES, string>;

function readSources(): RawSources {
  const entries = Object.keys(SOURCE_FILENAMES) as (keyof typeof SOURCE_FILENAMES)[];
  const out = {} as RawSources;
  for (const key of entries) {
    const path = sourcePath(key);
    try {
      out[key] = readFileSync(path, 'utf8');
    } catch {
      throw new Error(
        `[generate-content] cannot read source "${key}" at ${path}\n` +
          `Update SOURCE_FILENAMES in content.config.ts if the file was renamed.`,
      );
    }
  }
  return out;
}

function emit(filename: string, data: unknown): void {
  const path = join(GENERATED_DIR, filename);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`  wrote ${relative(PROJECT_ROOT, path)}`);
}

function main(): void {
  mkdirSync(GENERATED_DIR, { recursive: true });
  const sources = readSources();

  emit('sources.json', sources);

  const guide = parseGuide(sources.guide);
  emit('guide.json', guide);

  const practiceCount = guide.categories.reduce((n, c) => n + c.practices.length, 0);
  console.log(
    `[generate-content] guide: ${guide.categories.length} categories, ` +
      `${practiceCount} practices, ${guide.objective.principles.length} operating principles`,
  );

  const checklist = parseChecklist(sources.checklist);
  emit('checklist.json', checklist);

  const phaseItemCount = checklist.phases.reduce((n, p) => n + p.items.length, 0);
  console.log(
    `[generate-content] checklist: ${checklist.phases.length} phases, ` +
      `${phaseItemCount} phase items, ${checklist.readinessGate.criteria.length} readiness ` +
      `criteria, ${checklist.notes.noteSections.length} note sections, ` +
      `${checklist.notes.openIssues.length} open issues, ` +
      `${checklist.notes.usefulLinks.length} useful links`,
  );

  const tracker = parseTracker(sources.tracker, sources.trackerAll);
  emit('tracker.json', tracker);

  const priorities = tally(tracker.rows.map((r) => r.priority));
  const stages = tally(tracker.rows.map((r) => r.companyStage));
  console.log(
    `[generate-content] tracker: ${tracker.rows.length} rows, ` +
      `${tracker.columns.length} columns; priority ${format(priorities)}; stage ${format(stages)}`,
  );

  const crosslinks = buildGuideTrackerLinks(guide, tracker);
  emit('crosslinks.json', crosslinks);
  console.log(`[generate-content] crosslinks: ${crosslinks.length} guide-to-tracker pairs`);

  const checkboxTotal =
    practiceCount + phaseItemCount + checklist.readinessGate.criteria.length;
  console.log(
    `[generate-content] interactive checkboxes: ${checkboxTotal} ` +
      `(${practiceCount} guide + ${phaseItemCount} phase + ` +
      `${checklist.readinessGate.criteria.length} readiness)`,
  );
}

function tally(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function format(counts: Map<string, number>): string {
  return [...counts.entries()].map(([k, n]) => `${k || '(blank)'}=${n}`).join(' ');
}

main();
