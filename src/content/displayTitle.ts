/**
 * Display titles.
 *
 * Several guide headings carry a trailing parenthetical saying which company
 * stage the practice applies to — `(Optional For Startup)` and its variants.
 * That same information is a first-class column in the tracker (`Company
 * Stage`), where it is recorded for all 24 items rather than only some, so in
 * the headings it is redundant and makes the sidebar noisy.
 *
 * These helpers strip the qualifier for display only. The parsed `heading`
 * stays untouched, so the source documents remain the authority and the
 * fidelity suite still checks the full string. Where a title is shortened the
 * UI carries the full heading in a `title` attribute.
 *
 * Only stage/applicability qualifiers are removed. A parenthetical that is part
 * of the practice's name — `(Expand and Contract)` — is kept.
 */

/**
 * Matches a trailing parenthetical about who the practice applies to.
 *
 * Deliberately narrow: the parenthetical must mention a company stage
 * (`startup`, `small company`) alongside an applicability word (`optional`,
 * `implement`, `for`), so unrelated parentheticals are left alone.
 */
const STAGE_QUALIFIER =
  /\s*\((?=[^)]*\b(?:startup|startups|small company)\b)[^)]*\b(?:optional|implement|for)\b[^)]*\)\s*$/i;

/** The heading with any trailing stage qualifier removed. */
export function displayTitle(heading: string): string {
  return heading.replace(STAGE_QUALIFIER, '').trimEnd();
}

/** True when {@link displayTitle} would shorten this heading. */
export function hasStageQualifier(heading: string): boolean {
  return STAGE_QUALIFIER.test(heading);
}

/**
 * The qualifier that was removed, without its parentheses, or undefined when
 * nothing was. Useful for a tooltip or an aside.
 */
export function stageQualifier(heading: string): string | undefined {
  const match = STAGE_QUALIFIER.exec(heading);
  if (!match) return undefined;
  return match[0].trim().replace(/^\(|\)$/g, '');
}

/**
 * A `title` attribute value: the full heading, but only when it differs from
 * what is shown, so unchanged headings get no redundant tooltip.
 */
export function fullTitleAttribute(heading: string): string | undefined {
  return hasStageQualifier(heading) ? heading : undefined;
}
