/**
 * Parser for `DevOps Operational Checklist`.
 *
 * Document shape:
 *   `# DevOps Operational Checklist`   title, followed by a rule and the
 *                                      tracker CSV link
 *   `# Suggested Implementation Order`
 *     `## Phase <n> — <Title>`         4 phases, 23 items between them
 *   `# Production Readiness Gate`      lead-in sentence, then 16 criteria
 *   `# Notes & Decisions`
 *     `## Architecture Notes`          italic authoring prompt
 *     `## Security Notes`              italic authoring prompt
 *     `## Incident / Recovery Notes`   italic authoring prompt
 *     `## Open Issues`                 3 deliberately blank rows
 *     `## Useful Links`                9 labels with no values
 *
 * The `Notes & Decisions` subsections are classified by shape rather than by
 * name, so the parser follows the document instead of a hardcoded list.
 */
import type {
  ChecklistDocument,
  ChecklistItem,
  LinkLabel,
  NoteSection,
  NotesAndDecisions,
  Phase,
  ReadinessGate,
} from '../types';
import { slugify, uniqueSlug } from '../slug';
import {
  asBullet,
  asLabelledField,
  asTaskBullet,
  fail,
  paragraphs,
  splitByHeading,
  stripWrappingEmphasis,
  toLines,
  type Region,
  type SourceLine,
} from './markdown';

const IMPLEMENTATION_ORDER = 'suggestedimplementationorder';
const READINESS_GATE = 'productionreadinessgate';
const NOTES_AND_DECISIONS = 'notesdecisions';

function sectionKey(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseChecklist(source: string): ChecklistDocument {
  const lines = toLines(source);
  const regions = splitByHeading(lines, 1);

  const titleRegion = regions[0];
  if (!titleRegion) fail('checklist: document has no title H1');

  const byKey = new Map<string, Region>();
  for (const region of regions.slice(1)) {
    const key = sectionKey(region.heading);
    if (byKey.has(key)) fail(`checklist: duplicate top-level section "${region.heading}"`);
    byKey.set(key, region);
  }

  const orderRegion = byKey.get(IMPLEMENTATION_ORDER);
  const gateRegion = byKey.get(READINESS_GATE);
  const notesRegion = byKey.get(NOTES_AND_DECISIONS);

  if (!orderRegion) fail('checklist: no `Suggested Implementation Order` section');
  if (!gateRegion) fail('checklist: no `Production Readiness Gate` section');
  if (!notesRegion) fail('checklist: no `Notes & Decisions` section');

  const unexpected = [...byKey.keys()].filter(
    (k) => k !== IMPLEMENTATION_ORDER && k !== READINESS_GATE && k !== NOTES_AND_DECISIONS,
  );
  if (unexpected.length > 0) {
    fail(`checklist: unrecognised top-level section(s): ${unexpected.join(', ')}`);
  }

  const trackerLink = parseTrackerLink(titleRegion.body);

  return {
    title: titleRegion.heading,
    trackerLinkLabel: trackerLink.label,
    trackerLinkTarget: trackerLink.target,
    implementationOrderHeading: orderRegion.heading,
    phases: parsePhases(orderRegion),
    readinessGate: parseReadinessGate(gateRegion),
    notes: parseNotes(notesRegion),
  };
}

/** Pulls the `[label](target)` link that sits under the document title. */
function parseTrackerLink(body: SourceLine[]): { label: string; target: string } {
  for (const entry of body) {
    const m = /\[([^\]]*)\]\(([^)]*)\)/.exec(entry.raw);
    if (m) return { label: m[1]!.trim(), target: m[2]! };
  }
  fail('checklist: no tracker link found beneath the document title');
}

function parsePhases(region: Region): Phase[] {
  const phaseRegions = splitByHeading(region.body, 2);
  if (phaseRegions.length === 0) {
    fail('checklist: `Suggested Implementation Order` contains no phases');
  }

  const taken = new Set<string>();

  return phaseRegions.map((phaseRegion) => {
    const id = uniqueSlug(slugify(phaseRegion.heading), taken);
    const { label, title } = splitPhaseHeading(phaseRegion.heading);
    const items = collectTaskItems(phaseRegion.body, id);

    if (items.length === 0) {
      fail(`checklist: phase "${phaseRegion.heading}" has no items`);
    }

    return {
      id,
      heading: phaseRegion.heading,
      label,
      title,
      items,
      sourceLine: phaseRegion.line,
    };
  });
}

/** `Phase 1 — Foundations: ...` -> label `Phase 1`, title `Foundations: ...`. */
function splitPhaseHeading(heading: string): { label: string; title: string } {
  const m = /^(Phase\s+\d+)\s*[\u2014\u2013-]\s*(.*)$/.exec(heading);
  if (!m) fail(`checklist: phase heading "${heading}" is not \`Phase <n> — <title>\``);
  return { label: m[1]!, title: m[2]!.trim() };
}

function parseReadinessGate(region: Region): ReadinessGate {
  const prose = paragraphs(region.body).map((entry) => entry.raw.trim());
  const intro = prose[0];
  if (!intro) fail('checklist: `Production Readiness Gate` has no lead-in sentence');
  if (prose.length > 1) {
    fail(`checklist: expected one lead-in paragraph in the readiness gate, found ${prose.length}`);
  }

  const criteria = collectTaskItems(region.body, 'readiness');
  if (criteria.length === 0) fail('checklist: `Production Readiness Gate` lists no criteria');

  return { heading: region.heading, intro, criteria };
}

function parseNotes(region: Region): NotesAndDecisions {
  const subsections = splitByHeading(region.body, 2);
  if (subsections.length === 0) fail('checklist: `Notes & Decisions` has no subsections');

  const noteSections: NoteSection[] = [];
  let openIssues: { heading: string; items: ChecklistItem[] } | null = null;
  let usefulLinks: { heading: string; links: LinkLabel[] } | null = null;
  const takenNoteIds = new Set<string>();

  for (const subsection of subsections) {
    const id = slugify(subsection.heading);
    const tasks = subsection.body.map(asTaskBullet).filter((t) => t !== null);

    // Shape 1 — a list of checkboxes.
    if (tasks.length > 0) {
      if (openIssues) {
        fail(
          `checklist: two checklist subsections in Notes & Decisions ` +
            `("${openIssues.heading}" and "${subsection.heading}")`,
        );
      }
      openIssues = {
        heading: subsection.heading,
        items: collectTaskItems(subsection.body, id),
      };
      continue;
    }

    const bullets = subsection.body.map(asBullet).filter((b) => b !== null);

    // Shape 2 — a list of `Label:` entries.
    if (bullets.length > 0) {
      const takenLinkIds = new Set<string>();
      const links: LinkLabel[] = bullets.map((bullet) => {
        const field = asLabelledField(bullet.content);
        if (!field) {
          fail(
            `checklist: bullet on line ${bullet.line} in "${subsection.heading}" ` +
              `is not a \`Label:\` entry: ${JSON.stringify(bullet.content)}`,
          );
        }
        return {
          id: uniqueSlug(slugify(field.label), takenLinkIds),
          label: field.label,
          value: field.value,
        };
      });
      if (usefulLinks) {
        fail(
          `checklist: two link subsections in Notes & Decisions ` +
            `("${usefulLinks.heading}" and "${subsection.heading}")`,
        );
      }
      usefulLinks = { heading: subsection.heading, links };
      continue;
    }

    // Shape 3 — an italic authoring prompt.
    const prose = paragraphs(subsection.body).map((entry) => entry.raw.trim());
    if (prose.length === 0) {
      fail(`checklist: subsection "${subsection.heading}" has no recognisable content`);
    }
    if (prose.length > 1) {
      fail(
        `checklist: note subsection "${subsection.heading}" has ${prose.length} paragraphs, ` +
          `expected a single prompt`,
      );
    }
    noteSections.push({
      id: uniqueSlug(id, takenNoteIds),
      heading: subsection.heading,
      prompt: stripWrappingEmphasis(prose[0]!),
    });
  }

  if (noteSections.length === 0) fail('checklist: Notes & Decisions has no note subsections');
  if (!openIssues) fail('checklist: Notes & Decisions has no checklist subsection');
  if (!usefulLinks) fail('checklist: Notes & Decisions has no links subsection');

  return {
    heading: region.heading,
    noteSections,
    openIssuesHeading: openIssues.heading,
    openIssues: openIssues.items,
    usefulLinksHeading: usefulLinks.heading,
    usefulLinks: usefulLinks.links,
  };
}

/**
 * Collects `- [ ]` rows.
 *
 * A row whose only remaining content is another checkbox marker (`- [ ]  [ ]`,
 * as the source writes its blank Open Issues) is recorded with empty `text`,
 * because that marker is leftover syntax rather than prose. `rawText` keeps it.
 */
function collectTaskItems(body: SourceLine[], idPrefix: string): ChecklistItem[] {
  const taken = new Set<string>();
  const items: ChecklistItem[] = [];

  for (const entry of body) {
    const task = asTaskBullet(entry);
    if (!task) continue;

    const rawText = task.label;
    const text = /^\[[ xX]?\]$/.test(rawText.trim()) ? '' : rawText;
    const slug = text ? slugify(text) : '';
    const candidate = slug ? `${idPrefix}--${slug}` : `${idPrefix}--item-${items.length + 1}`;

    items.push({
      id: uniqueSlug(candidate, taken),
      text,
      rawText,
      sourceLine: task.line,
    });
  }

  return items;
}
