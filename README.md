# DevOps-Guide-Checklist

A DevOps Implementation &amp; Readiness Portal: a government/enterprise-style web
portal that renders an existing DevOps guide, operational checklist and
implementation tracker into something navigable, trackable and presentable.

The four source documents in the project root are the only authority for the
content. The portal adds no DevOps practices, controls, tools or standards of
its own — a guarantee enforced by the test suite rather than by convention.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # static bundle in dist/
npm run test     # 811 tests
npm run typecheck
```

Every script regenerates the content from the source documents first, so a
fresh clone works without extra steps.

## What's in it

| Route | Content |
|---|---|
| `/` | The guide's `Objective` and its operating principles, plus a contents index |
| `/guide/:category` | One page per guide category: practices with their description, rationale, key concepts, recommended tools and verification gate |
| `/checklist/implementation-order` | The four phases and their items, with per-phase and overall progress |
| `/checklist/production-readiness` | The Production Readiness Gate, with readiness computed from its criteria alone |
| `/notes` | Notes &amp; Decisions capture fields, plus the Open Issues rows and Useful Links labels |
| `/tracker` | The Implementation Tracker: sortable, filterable, editable, exportable |

Other features: global search over the whole corpus (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>
+ <kbd>K</kbd>), interactive checklists persisted per browser, JSON state
export/import, tracker CSV export that round-trips into the original
spreadsheet, and a light/dark theme.

The three checklists — guide practices, implementation-order items and
readiness criteria — are tracked **independently**, because the source documents
word them differently. Completing every guide practice leaves the readiness gate
reading 0 of 16, which the tests assert.

## How content gets in

```
Source documents  ->  build-time parsers  ->  typed JSON  ->  registry  ->  UI
  (2 .md, 2 .csv)     scripts/parse-content.ts
```

`npm run generate-content` parses the documents into
`src/content/generated/`. The navigation tree is derived from the parsed
headings, so adding or renaming a section in a source document updates the
sidebar automatically; it cannot drift.

The parsers are deliberately strict. A missing field, an unknown field, an
unrecognised section or a tracker column that no longer matches fails the build
with a message naming the problem, rather than silently dropping content.

### Updating the source documents

Replace a file in the project root and run `npm run build`. If the change
alters the guide-to-tracker correspondence, generation fails and tells you to
update the mapping in `src/content/crosslink.ts`.

Filenames live in `content.config.ts` — one edit if you rename a document.

## The content guarantee

The keystone test walks every string in the generated content and asserts it
appears **verbatim** in the raw text of a source document. It currently checks
607 strings. Lightly rewording a requirement fails it.

Two narrow exemptions exist, each separately validated: route slugs and internal
property names.

Alongside it, a rendered-coverage report counts the DOM and confirms nothing was
dropped:

```
Guide categories      6/6     Phase items              23/23
Guide practices      24/24    Readiness criteria       16/16
Guide field values  120/120   Tracker rows             24/24
Key concepts         74/74    Tracked checkboxes       63/63
```

## Additions beyond the documents

Three, all user-approved, each isolated behind a flag in
`src/config/uiFlags.ts` and switchable off independently:

1. **Extra Status values.** The tracker's `Status` column only ever contains
   `Not Started`; `In Progress` and `Completed` are the portal's vocabulary.
2. **Per-row Notes and Evidence fields.** Not columns in the source export.
   They render empty and are flagged in the UI with a dagger.
3. **The guide-to-tracker mapping.** The documents name the same items
   differently, so the link is an asserted relationship, declared explicitly
   and validated at build time.

## Source document corrections

The documents were Notion exports and carried several export artefacts. Every
correction is recorded in [CORRECTIONS.md](CORRECTIONS.md), with pristine
originals in [`source-originals/`](source-originals/).

One data-integrity issue is still open: `ST-10` is used by two different rows.
See CORRECTIONS.md for the two ways to resolve it.

## Accessibility

axe-core reports no violations across all 11 routes and six interactive states.
Every text pairing clears 4.5:1 in both themes, computed from the design tokens.
Focus is trapped in the search dialog and the mobile drawer, headings never skip
a level, and every form control has an accessible name.

Automated tooling catches roughly 30–40% of accessibility problems. This is a
floor, not a conformance claim — full WCAG conformance needs manual
screen-reader testing and expert review.

## Security

The build output is a **static bundle with no backend and no authentication**.
All state lives in the visitor's own browser via `localStorage`. Anyone with the
URL can read the portal and edit their own copy. Fine for a reference guide;
worth knowing before hosting it on a public domain for a client.

## Stack

React 18, TypeScript, Vite 8, Tailwind CSS 4, React Router 7, Vitest with
Testing Library, jsdom and axe-core. No runtime dependencies beyond React and
the router.

```
content.config.ts          source document paths
scripts/parse-content.ts   the generator
src/content/               types, parsers, registry, cross-link, fidelity tests
src/components/            reusable UI
src/pages/                 one per route
src/state/                 persistence, transfer, theme, focus trap
src/search/                the search index
src/test/                  harness, axe helper, coverage report
source-originals/          pristine source documents
```
