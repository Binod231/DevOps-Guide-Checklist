/**
 * Colour-contrast checks computed from the design tokens.
 *
 * axe-core cannot judge contrast under jsdom, which resolves no CSS custom
 * properties and performs no layout. So the ratios are computed here directly
 * from the hex values declared in `src/index.css`, for every text-on-surface
 * pairing the portal actually uses, in both themes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No block "${selector}"`);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error(`Unterminated block "${selector}"`);
}

function tokens(source: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of source.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found.set(match[1]!, match[2]!.trim());
  }
  return found;
}

const LIGHT = tokens(block(':root'));
const DARK = tokens(block('.dark'));

/** sRGB channel to linear light. */
function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const n = Number.parseInt(m[1]!, 16);
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

/** WCAG 2.1 contrast ratio, rounded to two decimals. */
function ratio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

function colour(theme: Map<string, string>, token: string): string {
  const value = theme.get(token);
  if (!value) throw new Error(`Token ${token} is not declared`);
  return value;
}

/** Text-on-surface pairings the portal renders, as [foreground, background]. */
const NORMAL_TEXT_PAIRS: [string, string][] = [
  ['--portal-text', '--portal-surface'],
  ['--portal-text', '--portal-canvas'],
  ['--portal-text', '--portal-surface-sunken'],
  ['--portal-text-secondary', '--portal-surface'],
  ['--portal-text-secondary', '--portal-surface-sunken'],
  ['--portal-text-muted', '--portal-surface'],
  ['--portal-text-muted', '--portal-surface-sunken'],
  ['--portal-accent', '--portal-surface'],
  ['--portal-accent', '--portal-surface-sunken'],
  ['--portal-accent', '--portal-accent-subtle'],
  ['--portal-p0', '--portal-p0-surface'],
  ['--portal-p0', '--portal-surface'],
  ['--portal-p1', '--portal-p1-surface'],
  ['--portal-p1', '--portal-surface'],
  ['--portal-p2', '--portal-p2-surface'],
  ['--portal-p2', '--portal-surface'],
  ['--portal-status-neutral', '--portal-status-neutral-surface'],
  ['--portal-status-active', '--portal-status-active-surface'],
  ['--portal-status-done', '--portal-status-done-surface'],
  ['--portal-stage-all', '--portal-accent-subtle'],
  ['--portal-stage-optional', '--portal-surface-sunken'],
  ['--portal-text-inverse', '--portal-accent'],
];

/**
 * Non-text pairings held to WCAG 1.4.11's 3:1.
 *
 * That rule covers visual information needed to identify a control or its
 * state. So the focus ring and the accent used for active and selected states
 * are here.
 *
 * `--portal-border-strong` is deliberately absent. It appears only on
 * `aria-hidden` decorative glyphs, on `hover:` borders whose selected
 * counterpart uses the accent token, and on the search dialog's outer edge
 * above a dark scrim. It never carries state on its own, so 1.4.11 does not
 * apply — a claim the tests below pin down rather than assume.
 */
const UI_COMPONENT_PAIRS: [string, string][] = [
  ['--portal-focus', '--portal-surface'],
  ['--portal-focus', '--portal-canvas'],
  ['--portal-focus', '--portal-surface-sunken'],
  ['--portal-accent', '--portal-surface'],
  ['--portal-accent', '--portal-surface-sunken'],
];

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
] as const)('contrast — %s theme', (themeName, theme) => {
  it.each(NORMAL_TEXT_PAIRS)(
    'meets 4.5:1 for %s on %s',
    (foreground, background) => {
      const value = ratio(colour(theme, foreground), colour(theme, background));
      expect(
        value,
        `${themeName}: ${foreground} on ${background} is ${value}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(UI_COMPONENT_PAIRS)('meets 3:1 for %s on %s', (foreground, background) => {
    const value = ratio(colour(theme, foreground), colour(theme, background));
    expect(
      value,
      `${themeName}: ${foreground} on ${background} is ${value}:1`,
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps secondary text no darker than primary text', () => {
    // Secondary must not out-contrast primary, or the hierarchy inverts.
    const surface = colour(theme, '--portal-surface');
    const primary = ratio(colour(theme, '--portal-text'), surface);
    const secondary = ratio(colour(theme, '--portal-text-secondary'), surface);
    expect(secondary, `${themeName}: secondary ${secondary}:1 vs primary ${primary}:1`).
      toBeLessThanOrEqual(primary);
  });

  it('keeps muted text lighter than secondary text', () => {
    const surface = colour(theme, '--portal-surface');
    const secondary = ratio(colour(theme, '--portal-text-secondary'), surface);
    const muted = ratio(colour(theme, '--portal-text-muted'), surface);
    expect(muted, themeName).toBeLessThan(secondary);
  });
});

describe('contrast — border-strong carries no state', () => {
  const componentSource = ['Tabs', 'SidebarNav', 'SearchDialog', 'Header', 'FieldBlock', 'Breadcrumb', 'TrackerTable']
    .map((name) => readFileSync(resolve(process.cwd(), `src/components/${name}.tsx`), 'utf8'))
    .join('\n');

  it('uses edge-strong only on hover borders or decorative text', () => {
    const uses = componentSource
      .split('\n')
      .filter((line) => line.includes('edge-strong'))
      .map((line) => line.trim());

    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) {
      const isHoverBorder = /hover:border-[a-z]-edge-strong/.test(use);
      const isDecorativeText = use.includes('text-edge-strong');
      const isDialogEdge = use.includes('border border-edge-strong');
      expect(isHoverBorder || isDecorativeText || isDialogEdge, use).toBe(true);
    }
  });

  it('marks every decorative edge-strong glyph aria-hidden', () => {
    const lines = componentSource.split('\n');
    lines.forEach((line, index) => {
      if (!line.includes('text-edge-strong')) return;
      const context = lines.slice(Math.max(0, index - 1), index + 2).join(' ');
      expect(context, line.trim()).toContain('aria-hidden');
    });
  });

  it('conveys the active and selected states with the accent token', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/components/SidebarNav.tsx'), 'utf8');
    const tabs = readFileSync(resolve(process.cwd(), 'src/components/Tabs.tsx'), 'utf8');
    expect(sidebar).toContain('border-l-accent');
    expect(tabs).toContain('border-b-accent');
  });

  it('pairs those states with a non-colour cue as well', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/components/SidebarNav.tsx'), 'utf8');
    const tabs = readFileSync(resolve(process.cwd(), 'src/components/Tabs.tsx'), 'utf8');
    // Weight plus an ARIA state, so colour is never the only signal.
    expect(sidebar).toContain('font-semibold');
    expect(sidebar).toContain('aria-current');
    expect(tabs).toContain('font-semibold');
    expect(tabs).toContain('aria-selected');
  });

  it('keeps edge-strong visible against the surface even so', () => {
    for (const [name, theme] of [
      ['light', LIGHT],
      ['dark', DARK],
    ] as const) {
      const value = ratio(
        colour(theme, '--portal-border-strong'),
        colour(theme, '--portal-surface'),
      );
      expect(value, `${name}: ${value}:1`).toBeGreaterThan(1.5);
    }
  });
});

describe('contrast — ratio helper', () => {
  it('computes the known extremes', () => {
    expect(ratio('#000000', '#ffffff')).toBe(21);
    expect(ratio('#ffffff', '#ffffff')).toBe(1);
  });

  it('is symmetric', () => {
    expect(ratio('#1f4e8c', '#ffffff')).toBe(ratio('#ffffff', '#1f4e8c'));
  });

  it('rejects a malformed colour instead of scoring it', () => {
    expect(() => ratio('not-a-colour', '#ffffff')).toThrow(/6-digit hex/);
  });
});
