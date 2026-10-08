import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

/** Pull a `--token: value;` declaration out of a specific block. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `block "${selector}" not found in index.css`).toBeGreaterThan(-1);
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

function tokensIn(source: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of source.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found.set(match[1]!, match[2]!.trim());
  }
  return found;
}

const light = tokensIn(block(':root'));
const dark = tokensIn(block('.dark'));
const themed = tokensIn(block('@theme inline'));

/** Tokens the plan requires, with the exact approved values. */
const REQUIRED_LIGHT: Record<string, string> = {
  '--portal-surface': '#ffffff',
  '--portal-canvas': '#f8f9fa',
  '--portal-text': '#0f172a',
  '--portal-text-secondary': '#1a2332',
  '--portal-accent': '#1f4e8c',
  '--portal-border': '#d4d9e0',
  '--portal-p0': '#9b1c1c',
  '--portal-p1': '#92400e',
  '--portal-p2': '#475569',
};

describe('design tokens', () => {
  it('declares the approved light palette verbatim', () => {
    for (const [token, value] of Object.entries(REQUIRED_LIGHT)) {
      expect(light.get(token), `${token} should be ${value}`).toBe(value);
    }
  });

  it('sets a 16px base and 1.65 body line-height', () => {
    expect(css).toContain('font-size: 100%');
    expect(css).toContain('line-height: 1.65');
  });

  it('constrains prose to a ~72ch measure', () => {
    expect(light.get('--portal-measure')).toBe('72ch');
  });

  it('uses a system sans stack', () => {
    expect(light.get('--portal-font-sans')).toContain('system-ui');
  });

  it('keeps radii conservative (<= 4px) for a documentation portal', () => {
    for (const [token, value] of themed) {
      if (!token.startsWith('--radius')) continue;
      const px = Number.parseFloat(value);
      expect(px, `${token} should stay <= 4px`).toBeLessThanOrEqual(4);
    }
  });

  it('overrides every themeable colour token in dark mode', () => {
    const colourTokens = [...light.keys()].filter(
      (t) => t.startsWith('--portal-') && !t.includes('font') && !t.includes('measure'),
    );
    const missing = colourTokens.filter((t) => !dark.has(t));
    expect(missing, 'dark mode must reassign all colour tokens').toEqual([]);
  });

  it('resolves every @theme token to a declared custom property', () => {
    const unresolved: string[] = [];
    for (const [token, value] of themed) {
      const ref = /var\((--[\w-]+)\)/.exec(value);
      if (!ref) continue;
      if (!light.has(ref[1]!)) unresolved.push(`${token} -> ${ref[1]}`);
    }
    expect(unresolved, 'every @theme var() must point at a :root token').toEqual([]);
  });

  it('declares no duplicate token values within a block', () => {
    for (const [label, source] of [
      [':root', block(':root')],
      ['.dark', block('.dark')],
    ] as const) {
      const names = [...source.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]!);
      const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
      expect(duplicates, `${label} redeclares tokens`).toEqual([]);
    }
  });

  it('uses class-based dark mode so the toggle controls it', () => {
    expect(css).toContain('@custom-variant dark');
  });

  it('provides a 2px focus ring', () => {
    expect(css).toContain('outline: 2px solid var(--portal-focus)');
  });
});
