import { describe, expect, it } from 'vitest';
import sources from '../generated/sources.json';
import { parseChecklist } from './checklist';

const checklist = parseChecklist(sources.checklist);

const PHASE_HEADINGS = [
  'Phase 1 — Foundations: Infrastructure, Identity & Data Safety',
  'Phase 2 — Quality & CI Pipeline Gating',
  'Phase 3 — Observability & SRE Mechanics',
  'Phase 4 — Safe Release Engineering, Edge & Cost Controls',
];

const PHASE_ITEM_COUNTS = [6, 6, 6, 5];

const PHASE_1_ITEMS = [
  'Managed application platform provisioning',
  'Infrastructure as Code (IaC) with remote state locking',
  'Automated database backups & continuous Point-in-Time Recovery (PITR)',
  'Centralized secret management (no plaintext `.env` files)',
  'Organization-wide 2FA enforcement',
  'Environment isolation (Staging and Production)',
];

const PHASE_4_ITEMS = [
  'Backward-compatible database migrations (expand-and-contract)',
  'Documented rollback procedure & one-click reverts',
  'Progressive delivery (canary rollouts/feature flags)',
  'Edge security, WAF & ingress rate limiting',
  'Cloud FinOps spend ceilings & budget alerts',
];

const READINESS_CRITERIA = [
  'Infrastructure is provisioned declaratively via IaC with remote state locking',
  'Database Point-in-Time Recovery (PITR) is active, and an initial restore drill has passed',
  'Secrets are centralized in a dedicated vault; zero plain-text production secrets in repos',
  '2FA is enforced across cloud, repository, and SaaS tooling',
  'Code cannot be pushed directly to production trunk branches',
  'Pull requests have automated CI checks completing in under 5 minutes',
  'Dependencies are pinned and scanned for known vulnerabilities',
  'Critical business paths have automated integration/E2E coverage',
  'Containers are built from minimal images and scanned for vulnerabilities',
  'Application exceptions are monitored with real-time alerting',
  'Structured logs are centralized and searchable via correlation IDs',
  'Golden signal metrics (p95/p99 latency, error rates) and uptime probes are active',
  'On-call escalation paths and runbooks are documented',
  'Releases support backward-compatible migrations and fast one-click rollback',
  'Public ingress endpoints are protected by rate limiting and WAF',
  'Cloud billing budget alerts and auto-scaling limits are configured',
];

const USEFUL_LINK_LABELS = [
  'Repository',
  'CI/CD',
  'Infrastructure repository',
  'Monitoring',
  'Logging',
  'Error tracking',
  'Backup/DR documentation',
  'Incident runbook',
  'Architecture diagram',
];

describe('checklist parser — document structure', () => {
  it('reads the document title and section headings verbatim', () => {
    expect(checklist.title).toBe('DevOps Operational Checklist');
    expect(checklist.implementationOrderHeading).toBe('Suggested Implementation Order');
    expect(checklist.readinessGate.heading).toBe('Production Readiness Gate');
    expect(checklist.notes.heading).toBe('Notes & Decisions');
  });

  it('reads the tracker link', () => {
    // The export wrote `[ Implementation Tracker]` with a stray leading space,
    // and pointed at a subdirectory that does not exist. Both corrected.
    expect(checklist.trackerLinkLabel).toBe('Implementation Tracker');
    expect(checklist.trackerLinkTarget).toBe(
      'Implementation%20Tracker%203f1e3ade4b32805d868ed8dcec71f05b.csv',
    );
  });
});

describe('checklist parser — Suggested Implementation Order', () => {
  it('finds exactly 4 phases with verbatim headings', () => {
    expect(checklist.phases).toHaveLength(4);
    expect(checklist.phases.map((p) => p.heading)).toEqual(PHASE_HEADINGS);
  });

  it('distributes items 6/6/6/5 across the phases, 23 in total', () => {
    expect(checklist.phases.map((p) => p.items.length)).toEqual(PHASE_ITEM_COUNTS);
    const total = checklist.phases.reduce((n, p) => n + p.items.length, 0);
    expect(total).toBe(23);
  });

  it('splits the phase label from its title without altering either', () => {
    expect(checklist.phases.map((p) => p.label)).toEqual([
      'Phase 1',
      'Phase 2',
      'Phase 3',
      'Phase 4',
    ]);
    expect(checklist.phases[0]!.title).toBe(
      'Foundations: Infrastructure, Identity & Data Safety',
    );
    expect(checklist.phases[3]!.title).toBe('Safe Release Engineering, Edge & Cost Controls');
  });

  it('keeps items in source order with verbatim text', () => {
    expect(checklist.phases[0]!.items.map((i) => i.text)).toEqual(PHASE_1_ITEMS);
    expect(checklist.phases[3]!.items.map((i) => i.text)).toEqual(PHASE_4_ITEMS);
  });

  it('retains inline code spans inside phase items', () => {
    expect(checklist.phases[0]!.items[3]!.text).toBe(
      'Centralized secret management (no plaintext `.env` files)',
    );
  });

  it('gives every phase and item a unique, stable id', () => {
    const phaseIds = checklist.phases.map((p) => p.id);
    expect(new Set(phaseIds).size).toBe(4);
    expect(phaseIds[0]).toBe('phase-1-foundations-infrastructure-identity-data-safety');

    const itemIds = checklist.phases.flatMap((p) => p.items.map((i) => i.id));
    expect(new Set(itemIds).size).toBe(23);
  });

  it('does not reword phase items into guide or readiness phrasing', () => {
    // The three checklist universes are worded differently in the source and
    // must stay distinct.
    const phaseTexts = checklist.phases.flatMap((p) => p.items.map((i) => i.text));
    expect(phaseTexts).toContain('Organization-wide 2FA enforcement');
    expect(phaseTexts).not.toContain('2FA is enforced across cloud, repository, and SaaS tooling');
  });
});

describe('checklist parser — Production Readiness Gate', () => {
  it('captures the lead-in sentence with its inline emphasis intact', () => {
    expect(checklist.readinessGate.intro).toBe(
      'Before calling the system **production-ready**, confirm:',
    );
  });

  it('finds exactly 16 criteria with verbatim text in source order', () => {
    expect(checklist.readinessGate.criteria).toHaveLength(16);
    expect(checklist.readinessGate.criteria.map((c) => c.text)).toEqual(READINESS_CRITERIA);
  });

  it('gives every criterion a unique id namespaced away from the phases', () => {
    const ids = checklist.readinessGate.criteria.map((c) => c.id);
    expect(new Set(ids).size).toBe(16);
    for (const id of ids) expect(id.startsWith('readiness--')).toBe(true);
  });
});

describe('checklist parser — Notes & Decisions', () => {
  const { notes } = checklist;

  it('finds the 3 note subsections with verbatim headings', () => {
    expect(notes.noteSections.map((s) => s.heading)).toEqual([
      'Architecture Notes',
      'Security Notes',
      'Incident / Recovery Notes',
    ]);
  });

  it('unwraps each italic authoring prompt without altering its wording', () => {
    expect(notes.noteSections[0]!.prompt).toBe(
      'Add infrastructure decisions, diagrams, constraints, and important assumptions here.',
    );
    expect(notes.noteSections[1]!.prompt).toBe(
      'Add security exceptions, access-control decisions, secret-rotation policies, and audit findings here.',
    );
    expect(notes.noteSections[2]!.prompt).toBe(
      'Record backup-restore tests, rollback tests, incidents, RCA links, and lessons learned here.',
    );
  });

  it('leaves no italic markers in the prompts', () => {
    for (const section of notes.noteSections) {
      expect(section.prompt.startsWith('*')).toBe(false);
      expect(section.prompt.endsWith('*')).toBe(false);
    }
  });

  it('reads the 3 Open Issues rows as blank', () => {
    expect(notes.openIssuesHeading).toBe('Open Issues');
    expect(notes.openIssues).toHaveLength(3);
    for (const item of notes.openIssues) {
      expect(item.text).toBe('');
      // The export left a stray `[ ]` after the checkbox; corrected at source,
      // so the rows are now genuinely empty.
      expect(item.rawText).toBe('');
    }
  });

  it('still strips a stray checkbox marker, in case an export regresses', () => {
    const regressed = `# Title
---
[Tracker](x.csv)

# Suggested Implementation Order

## Phase 1 — Start

- [ ]  Item

# Production Readiness Gate

Confirm:

- [ ]  Criterion

# Notes & Decisions

## Architecture Notes

*Prompt.*

## Open Issues

- [ ]  [ ]

## Useful Links

- Repository:
`;
    const parsed = parseChecklist(regressed);
    expect(parsed.notes.openIssues[0]!.text).toBe('');
    expect(parsed.notes.openIssues[0]!.rawText).toBe('[ ]');
  });

  it('gives the blank Open Issues distinct ids despite having no text', () => {
    const ids = notes.openIssues.map((i) => i.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('finds the 9 Useful Links labels with empty values', () => {
    expect(notes.usefulLinksHeading).toBe('Useful Links');
    expect(notes.usefulLinks).toHaveLength(9);
    expect(notes.usefulLinks.map((l) => l.label)).toEqual(USEFUL_LINK_LABELS);
    for (const link of notes.usefulLinks) expect(link.value).toBe('');
  });

  it('keeps the slash inside the CI/CD and Backup/DR labels', () => {
    expect(notes.usefulLinks[1]!.label).toBe('CI/CD');
    expect(notes.usefulLinks[6]!.label).toBe('Backup/DR documentation');
  });
});

describe('checklist parser — totals', () => {
  it('accounts for all 42 source checkboxes', () => {
    const phaseItems = checklist.phases.reduce((n, p) => n + p.items.length, 0);
    const criteria = checklist.readinessGate.criteria.length;
    const openIssues = checklist.notes.openIssues.length;
    expect(phaseItems).toBe(23);
    expect(criteria).toBe(16);
    expect(openIssues).toBe(3);
    expect(phaseItems + criteria + openIssues).toBe(42);
  });

  it('yields 39 trackable items, excluding the blank placeholders', () => {
    const trackable =
      checklist.phases.reduce((n, p) => n + p.items.length, 0) +
      checklist.readinessGate.criteria.length;
    expect(trackable).toBe(39);
  });
});

describe('checklist parser — strictness', () => {
  const VALID_TAIL = `
# Suggested Implementation Order

## Phase 1 — Start

- [ ]  Item

# Production Readiness Gate

Confirm:

- [ ]  Criterion

# Notes & Decisions

## Architecture Notes

*Prompt here.*

## Open Issues

- [ ]  [ ]

## Useful Links

- Repository:
`;

  it('rejects a document missing the implementation order section', () => {
    const broken = `# Title
---
[ Tracker](x.csv)

# Production Readiness Gate

Confirm:

- [ ]  Criterion

# Notes & Decisions

## Architecture Notes

*Prompt.*

## Open Issues

- [ ]  [ ]

## Useful Links

- Repository:
`;
    expect(() => parseChecklist(broken)).toThrow(/no `Suggested Implementation Order`/);
  });

  it('rejects an unrecognised top-level section rather than ignoring it', () => {
    const broken = `# Title
---
[ Tracker](x.csv)
${VALID_TAIL}
# Compliance Mapping

- [ ]  Invented
`;
    expect(() => parseChecklist(broken)).toThrow(/unrecognised top-level section/);
  });

  it('rejects a phase heading that is not `Phase <n> — <title>`', () => {
    const broken = `# Title
---
[ Tracker](x.csv)

# Suggested Implementation Order

## Foundations

- [ ]  Item

# Production Readiness Gate

Confirm:

- [ ]  Criterion

# Notes & Decisions

## Architecture Notes

*Prompt.*

## Open Issues

- [ ]  [ ]

## Useful Links

- Repository:
`;
    expect(() => parseChecklist(broken)).toThrow(/is not `Phase <n>/);
  });

  it('rejects a phase with no items', () => {
    const broken = `# Title
---
[ Tracker](x.csv)

# Suggested Implementation Order

## Phase 1 — Start

## Phase 2 — Next

- [ ]  Item

# Production Readiness Gate

Confirm:

- [ ]  Criterion

# Notes & Decisions

## Architecture Notes

*Prompt.*

## Open Issues

- [ ]  [ ]

## Useful Links

- Repository:
`;
    expect(() => parseChecklist(broken)).toThrow(/has no items/);
  });

  it('rejects a missing tracker link', () => {
    const broken = `# Title
${VALID_TAIL}`;
    expect(() => parseChecklist(broken)).toThrow(/no tracker link/);
  });

  it('rejects a readiness gate with no lead-in sentence', () => {
    const broken = `# Title
---
[ Tracker](x.csv)

# Suggested Implementation Order

## Phase 1 — Start

- [ ]  Item

# Production Readiness Gate

- [ ]  Criterion

# Notes & Decisions

## Architecture Notes

*Prompt.*

## Open Issues

- [ ]  [ ]

## Useful Links

- Repository:
`;
    expect(() => parseChecklist(broken)).toThrow(/no lead-in sentence/);
  });
});
