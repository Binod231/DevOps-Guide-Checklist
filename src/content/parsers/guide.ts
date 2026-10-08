/**
 * Parser for `DevOps Implementation Guide`.
 *
 * Document shape:
 *   `# DevOps Implementation Guide`   document title (first H1)
 *     `## Objective`                  lead paragraph, principles, closing paragraph
 *   `# <n>. <Category>`               one H1 per category (6 of them)
 *     `## <Practice>`                 one H2 per practice (24 in total)
 *       `- [ ] Implementation complete`
 *       `- **Description:** ...`
 *       `- **Why it matters:** ...`
 *       `- **Key concepts:**` + nested bullets
 *       `- **Recommended tools:** ...`
 *       `- **Verification gate:** ...`
 *
 * Three practices put `Key concepts:` on a nested bullet beneath
 * `Why it matters` and carry the first concept inline on that same bullet. Two
 * write the checkbox label without emphasis. One H2 is wrapped in emphasis
 * markers. All of that is handled here; none of it is corrected in the output.
 */
import type {
  GuideCategory,
  GuideDocument,
  GuideObjective,
  GuidePrinciple,
  Practice,
} from '../types';
import { slugify, uniqueSlug } from '../slug';
import {
  asBullet,
  asLabelledField,
  asTaskBullet,
  fail,
  headingLevel,
  paragraphs,
  splitByHeading,
  stripWrappingEmphasis,
  toLines,
  type SourceLine,
} from './markdown';

/** The five labelled fields every practice carries, by canonical key. */
const PRACTICE_FIELDS = {
  description: 'description',
  whyitmatters: 'whyItMatters',
  keyconcepts: 'keyConcepts',
  recommendedtools: 'recommendedTools',
  verificationgate: 'verificationGate',
} as const;

type FieldKey = keyof typeof PRACTICE_FIELDS;

function isFieldKey(key: string): key is FieldKey {
  return Object.prototype.hasOwnProperty.call(PRACTICE_FIELDS, key);
}

export function parseGuide(source: string): GuideDocument {
  const lines = toLines(source);
  const h1Regions = splitByHeading(lines, 1);

  if (h1Regions.length < 2) {
    fail(`guide: expected a title H1 plus category H1s, found ${h1Regions.length}`);
  }

  const [titleRegion, ...categoryRegions] = h1Regions as [
    (typeof h1Regions)[number],
    ...(typeof h1Regions)[number][],
  ];

  const objective = parseObjective(titleRegion.body);

  const categoryIds = new Set<string>();
  const practiceIds = new Set<string>();
  let practiceCounter = 0;

  const categories: GuideCategory[] = categoryRegions.map((region) => {
    const { ordinal, title } = splitOrdinal(region.heading);
    const categoryId = uniqueSlug(slugify(region.heading), categoryIds);

    const practiceRegions = splitByHeading(region.body, 2);
    if (practiceRegions.length === 0) {
      fail(`guide: category "${region.heading}" (line ${region.line}) has no practices`);
    }

    const practices: Practice[] = practiceRegions.map((practiceRegion, index) => {
      practiceCounter += 1;
      return parsePractice({
        region: practiceRegion,
        categoryId,
        sourceOrder: practiceCounter,
        orderInCategory: index + 1,
        takenIds: practiceIds,
      });
    });

    return {
      id: categoryId,
      heading: region.heading,
      ordinal,
      title,
      practices,
      sourceLine: region.line,
    };
  });

  return {
    title: titleRegion.heading,
    objective,
    categories,
  };
}

/** `3.  Testing & Quality` -> ordinal `3`, title `Testing & Quality`. */
function splitOrdinal(heading: string): { ordinal: string; title: string } {
  const m = /^(\d+)\.\s*(.*)$/.exec(heading);
  if (!m) return { ordinal: '', title: heading };
  return { ordinal: m[1]!, title: m[2]!.trim() };
}

function parseObjective(titleBody: SourceLine[]): GuideObjective {
  const regions = splitByHeading(titleBody, 2);
  const region = regions[0];
  if (!region) fail('guide: no `## Objective` section under the document title');
  if (regions.length > 1) {
    fail(`guide: expected one H2 under the title, found ${regions.length}`);
  }

  const prose = paragraphs(region.body).map((entry) => entry.raw.trim());
  const principleBullets = region.body
    .map(asBullet)
    .filter((b): b is NonNullable<typeof b> => b !== null);

  // The principles label is the standalone emphasised paragraph.
  const labelIndex = prose.findIndex((text) => /^\*\*[^*]+\*\*$/.test(text));
  if (labelIndex === -1) fail('guide: no emphasised `Operating principles` label in Objective');

  const lead = prose.slice(0, labelIndex).join(' ').trim();
  const closing = prose.slice(labelIndex + 1).join(' ').trim();
  if (!lead) fail('guide: Objective has no lead paragraph');
  if (!closing) fail('guide: Objective has no closing paragraph');

  const taken = new Set<string>();
  const principles: GuidePrinciple[] = principleBullets.map((bullet) => {
    const field = asLabelledField(bullet.content);
    if (!field) {
      fail(`guide: principle bullet on line ${bullet.line} is not \`**Term:** detail\``);
    }
    if (!field.value) {
      fail(`guide: principle "${field.label}" on line ${bullet.line} has no detail text`);
    }
    return {
      id: uniqueSlug(slugify(field.label), taken),
      term: field.label,
      detail: field.value,
    };
  });

  if (principles.length === 0) fail('guide: Objective lists no operating principles');

  return {
    heading: region.heading,
    leadParagraph: lead,
    principlesLabel: stripWrappingEmphasis(prose[labelIndex]!),
    principles,
    closingParagraph: closing,
  };
}

interface PracticeInput {
  region: { heading: string; headingRaw: string; line: number; body: SourceLine[] };
  categoryId: string;
  sourceOrder: number;
  orderInCategory: number;
  takenIds: Set<string>;
}

function parsePractice(input: PracticeInput): Practice {
  const { region, categoryId, sourceOrder, orderInCategory, takenIds } = input;
  const where = `practice "${region.heading}" (line ${region.line})`;

  let checkboxLabel: string | null = null;
  const scalars = new Map<FieldKey, string>();
  const keyConcepts: string[] = [];
  /** Which field a nested bullet currently belongs to. */
  let openList: FieldKey | null = null;

  for (const entry of region.body) {
    if (headingLevel(entry.raw) > 0) {
      fail(`guide: unexpected heading inside ${where} on line ${entry.line}`);
    }

    const task = asTaskBullet(entry);
    if (task && task.indent === 0) {
      if (checkboxLabel !== null) {
        fail(`guide: ${where} has more than one checkbox`);
      }
      checkboxLabel = task.label;
      openList = null;
      continue;
    }

    const bullet = asBullet(entry);
    if (!bullet) continue;

    const field = asLabelledField(bullet.content);

    if (bullet.indent === 0) {
      if (!field) {
        fail(
          `guide: top-level bullet in ${where} on line ${bullet.line} is not a labelled field: ` +
            JSON.stringify(bullet.content),
        );
      }
      if (!isFieldKey(field.key)) {
        fail(`guide: unknown field "${field.label}" in ${where} on line ${bullet.line}`);
      }
      if (field.key === 'keyconcepts') {
        openList = 'keyconcepts';
        // `**Key concepts:**` normally has an empty value, but accept an
        // inline first concept if one is ever written there.
        if (field.value) keyConcepts.push(field.value);
        continue;
      }
      if (scalars.has(field.key)) {
        fail(`guide: duplicate field "${field.label}" in ${where} on line ${bullet.line}`);
      }
      if (!field.value) {
        fail(`guide: field "${field.label}" in ${where} on line ${bullet.line} is empty`);
      }
      scalars.set(field.key, field.value);
      openList = field.key;
      continue;
    }

    // Nested bullet. A known field label here is the mis-nested shape: the
    // label was indented under the previous field and carries its first list
    // item inline.
    if (field && isFieldKey(field.key)) {
      if (field.key !== 'keyconcepts') {
        fail(
          `guide: field "${field.label}" is nested under another field in ${where} ` +
            `on line ${bullet.line}; only Key concepts appears that way in the source`,
        );
      }
      openList = 'keyconcepts';
      if (field.value) keyConcepts.push(field.value);
      continue;
    }

    if (openList !== 'keyconcepts') {
      fail(
        `guide: nested bullet in ${where} on line ${bullet.line} belongs to ` +
          `"${openList ?? 'no field'}", but only Key concepts takes a list`,
      );
    }
    keyConcepts.push(bullet.content.trim());
  }

  if (checkboxLabel === null) fail(`guide: ${where} has no checkbox`);
  if (keyConcepts.length === 0) fail(`guide: ${where} has no key concepts`);

  for (const key of Object.keys(PRACTICE_FIELDS) as FieldKey[]) {
    if (key === 'keyconcepts') continue;
    if (!scalars.has(key)) fail(`guide: ${where} is missing the "${key}" field`);
  }

  return {
    id: uniqueSlug(slugify(region.heading), takenIds),
    categoryId,
    heading: region.heading,
    headingRaw: region.headingRaw,
    checkboxLabel,
    description: scalars.get('description')!,
    whyItMatters: scalars.get('whyitmatters')!,
    keyConcepts,
    recommendedTools: scalars.get('recommendedtools')!,
    verificationGate: scalars.get('verificationgate')!,
    sourceOrder,
    orderInCategory,
    sourceLine: region.line,
  };
}
