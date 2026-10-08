/**
 * Single source of truth for where the authored documents live.
 *
 * These four files are the ONLY authority for portal content. The parsers read
 * them; nothing in this project ever writes back to them. If a filename
 * changes, edit it here and nowhere else.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** Relative source filenames, exactly as exported. */
export const SOURCE_FILENAMES = {
  guide: 'DevOps Implementation Guide 3f3e3ade4b3280a78467d8270d3f8bc2.md',
  checklist: 'DevOps Operational Checklist 3f1e3ade4b3280d388b2d71e1145bead.md',
  /** Canonical tracker export: S.N-sorted, and the file the checklist links to. */
  tracker: 'Implementation Tracker 3f1e3ade4b32805d868ed8dcec71f05b.csv',
  /** Alternate export of the same 24 rows in a different column/row order. */
  trackerAll: 'Implementation Tracker 3f1e3ade4b32805d868ed8dcec71f05b_all.csv',
} as const;

export type SourceKey = keyof typeof SOURCE_FILENAMES;

/** Absolute path to a source document. */
export function sourcePath(key: SourceKey): string {
  return resolve(projectRoot, SOURCE_FILENAMES[key]);
}

/** Where the generator emits typed JSON. */
export const GENERATED_DIR = resolve(projectRoot, 'src/content/generated');

export const PROJECT_ROOT = projectRoot;
