# Corrections applied to the source documents

The four source documents were Notion exports and carried a number of export
artefacts and one data-integrity problem. This file records every change.

Pristine copies of all four files are in [`source-originals/`](source-originals/).
There was no git repository when these edits were made, so that directory is the
only way back. Restore any file by copying it over the one in the project root.

Every correction below is a formatting or consistency fix. **No technical
content was reworded, added or removed** — no practice, control, tool, standard,
phase or criterion changed meaning. The one exception worth your attention is
listed under "Still outstanding".

---

## DevOps Implementation Guide (.md)

| # | What | Before | After |
|---|---|---|---|
| 1 | Double space after the category number, 3 headings | `# 3.  Testing & Quality` | `# 3. Testing & Quality` |
| 2 | Missing space before the parenthetical | `# 6.  Disaster Recovery(Optional For Startup)` | `# 6. Disaster Recovery (Optional For Startup)` |
| 3 | Unclosed parenthesis in a practice heading | `## Progressive Delivery & Canary Deployments (Optional For Startup` | `...(Optional For Startup)` |
| 4 | Stray emphasis wrapper around a heading | `## **On-Call Rotation and Incident Routing (Optional for Startups)**` | `## On-Call Rotation and Incident Routing (Optional for Startups)` |
| 5 | Checkbox label unemphasised on 3 of 24 practices | `- [ ]  Implementation complete` | `- [ ]  **Implementation complete**` |
| 6 | Colon outside the emphasis on 4 field labels | `- **Description**: text` | `- **Description:** text` |
| 7 | `Key concepts` list mis-nested under `Why it matters` on 3 practices | `    - Key concepts: Expand-and-contract pattern` | `- **Key concepts:**` then `    - Expand-and-contract pattern` |

Items 5, 6 and 7 affected the same three practices: *Backward-Compatible
Database Migrations*, *Secure Container Registries & Access Control*, and
*On-Call Rotation and Incident Routing*. The mis-nesting in item 7 meant those
three practices' key concepts were structurally children of the wrong field.

## DevOps Operational Checklist (.md)

| # | What | Before | After |
|---|---|---|---|
| 8 | Stray leading space in the link text | `[ Implementation Tracker](...)` | `[Implementation Tracker](...)` |
| 9 | Link pointed at a subdirectory that does not exist | `DevOps%20Operational%20Checklist/Implementation%20Tracker%20...csv` | `Implementation%20Tracker%20...csv` |
| 10 | Leftover empty checkbox marker on the 3 blank `Open Issues` rows | `- [ ]  [ ]` | `- [ ]` |

## Implementation Tracker (both .csv exports)

Applied identically to the canonical export and the `_all` export, which still
agree with each other row for row.

| # | What | Before | After |
|---|---|---|---|
| 11 | `ST-20` Status cell left empty while all 23 other rows read `Not Started` | *(empty)* | `Not Started` |
| 12 | Trailing newline inside `ST-09`'s quoted Implementation Item | `"Edge Security, WAF & Ingress Rate Limiting\n"` | `"Edge Security, WAF & Ingress Rate Limiting"` |
| 13 | Trailing newline inside `ST-19`'s quoted Verification Gate | `"...uptime checks pass.\n"` | `...uptime checks pass.` |
| 14 | LaTeX math delimiters in `ST-04`'s Verification Gate | `from Version $N+1$ to Version $N$` | `from Version N+1 to Version N` |

The UTF-8 BOM was deliberately kept on both CSVs — Excel relies on it to detect
the encoding.

---

## Still outstanding: the duplicate `ST-10`

**`ST-10` is used twice** and this has not been changed:

- `ST-10` / Infrastructure / Cloud FinOps Guardrails & Budget Ceilings
- `ST-10` / Testing & Quality / Core Integration & API Tests

So the tracker has 24 rows but only 23 distinct identifiers, which makes an
`ST-` number ambiguous as a reference.

I did not fix this unilaterally because both options change identifiers you may
already have quoted in client reports or tickets:

**Option A — sequential renumber.** Testing & Quality's row becomes `ST-11`, and
every row after it shifts up by one, ending at `ST-24`. Gives a clean
`ST-01`–`ST-24` with no gaps, but **rewrites 14 identifiers**.

**Option B — minimal change.** Only the duplicate moves, to `ST-24`. Touches
**one identifier**, but the Testing & Quality block then reads `ST-24`, `ST-11`,
which looks out of sequence.

Tell me which you prefer and I will apply it, including the portal's
guide-to-tracker mapping and the affected tests.

Until then the portal handles the duplicate safely: rows are keyed internally on
S.N **plus** Category, so the two `ST-10` rows are distinguishable everywhere —
in the table, in filters, in search, in the CSV export, and in the
guide-to-tracker cross-link.

---

## Also worth knowing

Two things in the documents are not defects, so they were left alone:

- **The `Objective` section states its purpose twice**, once at the top and once
  at the end, with slightly different wording ("without over-engineering or
  unnecessary infrastructure complexity" / "without unnecessary infrastructure
  complexity"). Both are rendered. Say the word if you want the closing
  repetition dropped.
- **The guide and the tracker word the same items differently** — the guide says
  `Automated Secret Scanning in CI & Pre-Commit Hooks`, the tracker says
  `Automated Secret Scanning`. Neither was changed. The portal links them
  through an explicit mapping in `src/content/crosslink.ts`.
- **The guide and the tracker order two pairs differently.** In Security the
  guide lists 2FA before container scanning while the tracker numbers them
  `ST-13` container scanning, `ST-14` 2FA; Disaster Recovery has the same
  inversion. Neither was changed; the mapping accounts for it.
