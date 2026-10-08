/**
 * Resolves a pathname into the document and section it belongs to.
 *
 * Both labels come from the navigation tree, which in turn comes from the
 * source headings, so the header and breadcrumb cannot show a label that is not
 * in the documents.
 */
import { NAV_TREE, type NavNode } from './registry';

export interface PortalLocation {
  /** Source document title, when the section sits under one. */
  documentLabel?: string;
  /** Section heading for the current route. */
  sectionLabel?: string;
  path: string;
}

function walk(
  nodes: NavNode[],
  pathname: string,
  documentLabel: string | undefined,
): PortalLocation | null {
  for (const node of nodes) {
    if (node.kind === 'group') {
      const found = walk(node.children, pathname, node.label);
      if (found) return found;
      continue;
    }
    if (node.path === pathname) {
      return { documentLabel, sectionLabel: node.label, path: node.path };
    }
  }
  return null;
}

export function resolveLocation(pathname: string): PortalLocation {
  return walk(NAV_TREE, pathname, undefined) ?? { path: pathname };
}

/** Breadcrumb trail for a pathname: document title, then section heading. */
export function breadcrumbTrail(pathname: string): string[] {
  const location = resolveLocation(pathname);
  return [location.documentLabel, location.sectionLabel].filter(
    (part): part is string => part !== undefined,
  );
}
