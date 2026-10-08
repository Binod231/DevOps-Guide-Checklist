/**
 * Small, deliberately strict markdown primitives shared by the document
 * parsers.
 *
 * Strictness is the point: these helpers throw rather than guess. If a source
 * document changes shape, `npm run generate-content` fails loudly instead of
 * silently dropping or mangling content.
 */

export interface SourceLine {
  /** Raw line text with the trailing newline removed. */
  raw: string;
  /** 1-based line number in the source file. */
  line: number;
}

export function toLines(source: string): SourceLine[] {
  return source.split('\n').map((raw, i) => ({ raw, line: i + 1 }));
}

/** Heading level, or 0 when the line is not an ATX heading. */
export function headingLevel(raw: string): number {
  const m = /^(#{1,6})\s+/.exec(raw);
  return m ? m[1]!.length : 0;
}

export function headingText(raw: string): string {
  const m = /^#{1,6}\s+(.*)$/.exec(raw);
  if (!m) throw new Error(`Not a heading: ${JSON.stringify(raw)}`);
  return m[1]!.trim();
}

/**
 * Removes a single pair of wrapping emphasis markers.
 *
 * This is a rendering concern, not a content edit: `**Heading**` means "render
 * this emphasised", and the portal conveys emphasis structurally. Markers that
 * appear mid-string are left alone.
 */
export function stripWrappingEmphasis(text: string): string {
  const t = text.trim();
  for (const marker of ['**', '__', '*', '_'] as const) {
    if (t.length > marker.length * 2 && t.startsWith(marker) && t.endsWith(marker)) {
      const inner = t.slice(marker.length, -marker.length);
      // Only unwrap when the markers genuinely bracket the whole string.
      if (!inner.startsWith(marker) && !inner.includes(marker)) return inner.trim();
    }
  }
  return t;
}

/** Indentation width in spaces, counting a tab as four. */
export function indentWidth(raw: string): number {
  const m = /^[ \t]*/.exec(raw)![0];
  return [...m].reduce((n, ch) => n + (ch === '\t' ? 4 : 1), 0);
}

export interface Bullet {
  /** Text following the list marker. */
  content: string;
  indent: number;
  line: number;
}

/** Parses `- text`, `* text` or `+ text` at any indentation. */
export function asBullet(entry: SourceLine): Bullet | null {
  const m = /^([ \t]*)[-*+]\s+(.*)$/.exec(entry.raw);
  if (!m) return null;
  return {
    content: m[2]!.trimEnd(),
    indent: indentWidth(entry.raw),
    line: entry.line,
  };
}

export interface TaskBullet extends Bullet {
  checked: boolean;
  /** Label beside the checkbox, wrapping emphasis removed. */
  label: string;
}

/** Parses a `- [ ]` / `- [x]` task bullet. */
export function asTaskBullet(entry: SourceLine): TaskBullet | null {
  const bullet = asBullet(entry);
  if (!bullet) return null;
  const m = /^\[([ xX])\]\s*(.*)$/.exec(bullet.content);
  if (!m) return null;
  return {
    ...bullet,
    checked: m[1]!.toLowerCase() === 'x',
    label: stripWrappingEmphasis(m[2]!),
  };
}

export interface LabelledField {
  /** Label text with emphasis and the trailing colon removed. */
  label: string;
  /** Label reduced to lowercase alphanumerics, for comparison. */
  key: string;
  /** Text after the colon; empty when the value is a nested list. */
  value: string;
}

/**
 * Parses a `Label: value` bullet across the spellings the sources use:
 *
 *   `**Description:** text`   colon inside the emphasis
 *   `**Description**: text`   colon outside the emphasis
 *   `Key concepts: text`     no emphasis at all (the mis-nested shape)
 */
export function asLabelledField(content: string): LabelledField | null {
  const patterns = [
    /^\*\*(.+?):\*\*\s*(.*)$/, //            **Label:** value
    /^\*\*(.+?)\*\*\s*:\s*(.*)$/, //         **Label**: value
    /^([A-Za-z][A-Za-z0-9 /&'-]*?)\s*:\s*(.*)$/, // Label: value
  ];
  for (const pattern of patterns) {
    const m = pattern.exec(content.trim());
    if (!m) continue;
    const label = m[1]!.trim();
    return { label, key: canonicalKey(label), value: m[2]!.trim() };
  }
  return null;
}

/** `Why it matters` -> `whyitmatters`. */
export function canonicalKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Groups lines into the regions introduced by headings of `level`. */
export interface Region {
  heading: string;
  headingRaw: string;
  line: number;
  body: SourceLine[];
}

export function splitByHeading(lines: SourceLine[], level: number): Region[] {
  const regions: Region[] = [];
  let current: Region | null = null;

  for (const entry of lines) {
    if (headingLevel(entry.raw) === level) {
      const raw = headingText(entry.raw);
      current = {
        heading: stripWrappingEmphasis(raw),
        headingRaw: raw,
        line: entry.line,
        body: [],
      };
      regions.push(current);
      continue;
    }
    if (current) current.body.push(entry);
  }

  return regions;
}

/** Non-blank, non-bullet, non-heading lines, each trimmed. */
export function paragraphs(body: SourceLine[]): SourceLine[] {
  return body.filter(
    (entry) =>
      entry.raw.trim().length > 0 &&
      headingLevel(entry.raw) === 0 &&
      asBullet(entry) === null &&
      entry.raw.trim() !== '---',
  );
}

export function fail(message: string): never {
  throw new Error(`[content] ${message}`);
}

/** Asserts a parsed value is present and non-empty, failing loudly if not. */
export function requirePresent<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined || value === '') fail(message);
  return value;
}
