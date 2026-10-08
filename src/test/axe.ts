import axe, { type Result, type RunOptions } from 'axe-core';

/**
 * Runs axe-core against a container and returns its violations.
 *
 * Colour-contrast is disabled because jsdom does not compute layout or resolve
 * CSS custom properties, so axe cannot read the real rendered colours. Contrast
 * is covered separately by a dedicated test that computes ratios from the token
 * values in `src/index.css`.
 */
export async function findViolations(
  container: HTMLElement,
  options: RunOptions = {},
): Promise<Result[]> {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
      // jsdom renders no viewport, so axe cannot judge scrollable-region focus.
      'scrollable-region-focusable': { enabled: false },
      ...(options.rules ?? {}),
    },
    ...options,
  });
  return results.violations;
}

/** A readable one-line summary of a violation, for assertion messages. */
export function describeViolations(violations: Result[]): string {
  if (violations.length === 0) return 'no violations';
  return violations
    .map((v) => {
      const targets = v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(', ');
      return `${v.id} (${v.impact}): ${v.help} \u2014 ${targets}`;
    })
    .join('\n');
}
