/**
 * Deterministic slug derivation for route and anchor identifiers.
 *
 * Slugs are the one class of generated string that is NOT a verbatim substring
 * of the source documents — they are derived identifiers, not content. The
 * fidelity suite exempts identifier fields for exactly this reason.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\u2014|\u2013/g, ' ') // em / en dash
    .replace(/[/&]/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Appends a numeric suffix when a slug has already been used, so identifiers
 * stay unique without renaming or renumbering source content.
 */
export function uniqueSlug(candidate: string, taken: Set<string>): string {
  let slug = candidate;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${candidate}-${n}`;
    n += 1;
  }
  taken.add(slug);
  return slug;
}
