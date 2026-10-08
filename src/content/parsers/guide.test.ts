import { describe, expect, it } from 'vitest';
import sources from '../generated/sources.json';
import { parseGuide } from './guide';
import type { Practice } from '../types';

const guide = parseGuide(sources.guide);
const practices: Practice[] = guide.categories.flatMap((c) => c.practices);

/** Verbatim H1 headings. */
const CATEGORY_HEADINGS = [
  '1. Source Code Management & CI/CD',
  '2. Infrastructure',
  '3. Testing & Quality',
  '4. Security',
  '5. Observability (Optional For Startup)',
  '6. Disaster Recovery (Optional For Startup)',
];

const PRACTICE_COUNTS = [5, 5, 2, 4, 6, 2];

/** Verbatim H2 headings in source order, emphasis markers removed. */
const PRACTICE_HEADINGS = [
  'Branch Protections & Single PR Approvals',
  'Automated CI Pipelines for Main & Pull Requests',
  'Automated Secret Scanning in CI & Pre-Commit Hooks',
  'Backward-Compatible Database Migrations (Expand and Contract)',
  'Progressive Delivery & Canary Deployments (Optional For Startup)',
  'Managed Application Platforms',
  'Infrastructure as Code',
  'Isolated Staging & Production Environments (Staging Env is Optional for the Startup or small company)',
  'Edge Security, WAF & Ingress Rate Limiting (Optional For Startup)',
  'Cloud FinOps Guardrails & Budget Ceilings',
  'Automated Core Integration & API Tests',
  'Pinned Dependencies & Automated Security Audits (Optional For Startup)',
  'Centralized Secret & Environment Variable Management (Implement in Startup, if they want more security)',
  'Enforced Two-Factor Authentication',
  'Automated Container & Binary Vulnerability Scanning',
  'Secure Container Registries & Access Control',
  'Centralized Application Exception Tracking',
  'Structured Log Aggregation & Search',
  'Uptime Monitoring & Basic Paging Alerts',
  'Golden Signals, SLIs & SLO Tracking',
  'Distributed APM & OpenTelemetry Tracing',
  'On-Call Rotation and Incident Routing (Optional for Startups)',
  'Automated Database Backups & Point-in-Time Recovery',
  'Documented Rollback Procedure & One-Click Reverts',
];

/** The three practices whose `Key concepts` list is mis-nested in the source. */
const MIS_NESTED = [
  'Backward-Compatible Database Migrations (Expand and Contract)',
  'Secure Container Registries & Access Control',
  'On-Call Rotation and Incident Routing (Optional for Startups)',
];

function practice(heading: string): Practice {
  const found = practices.find((p) => p.heading === heading);
  if (!found) throw new Error(`No practice "${heading}"`);
  return found;
}

describe('guide parser — document structure', () => {
  it('reads the document title', () => {
    expect(guide.title).toBe('DevOps Implementation Guide');
  });

  it('finds exactly 6 categories with verbatim headings', () => {
    expect(guide.categories).toHaveLength(6);
    expect(guide.categories.map((c) => c.heading)).toEqual(CATEGORY_HEADINGS);
  });

  it('reads the corrected heading spacing', () => {
    // The export left a double space after `3.`, `5.` and `6.`, and omitted the
    // space before `(Optional For Startup)` on `6.`. All corrected at source.
    expect(guide.categories[2]!.heading).toBe('3. Testing & Quality');
    expect(guide.categories[4]!.heading).toBe('5. Observability (Optional For Startup)');
    expect(guide.categories[5]!.heading).toBe('6. Disaster Recovery (Optional For Startup)');
  });

  it('leaves no double spaces in any category heading', () => {
    for (const category of guide.categories) {
      expect(category.heading, category.heading).not.toMatch(/\s{2}/);
    }
  });

  it('splits the category ordinal from its title without altering either', () => {
    expect(guide.categories.map((c) => c.ordinal)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(guide.categories[2]!.title).toBe('Testing & Quality');
    expect(guide.categories[5]!.title).toBe('Disaster Recovery (Optional For Startup)');
  });

  it('distributes practices 5/5/2/4/6/2 across the categories', () => {
    expect(guide.categories.map((c) => c.practices.length)).toEqual(PRACTICE_COUNTS);
  });

  it('finds exactly 24 practices with verbatim headings in source order', () => {
    expect(practices).toHaveLength(24);
    expect(practices.map((p) => p.heading)).toEqual(PRACTICE_HEADINGS);
  });

  it('assigns unique, stable slugs to every category and practice', () => {
    const categoryIds = guide.categories.map((c) => c.id);
    const practiceIds = practices.map((p) => p.id);
    expect(new Set(categoryIds).size).toBe(6);
    expect(new Set(practiceIds).size).toBe(24);
    expect(categoryIds[0]).toBe('1-source-code-management-ci-cd');
    expect(practiceIds[0]).toBe('branch-protections-single-pr-approvals');
  });

  it('numbers practices 1..24 globally and 1..n within a category', () => {
    expect(practices.map((p) => p.sourceOrder)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1),
    );
    for (const category of guide.categories) {
      expect(category.practices.map((p) => p.orderInCategory)).toEqual(
        category.practices.map((_, i) => i + 1),
      );
    }
  });

  it('links each practice back to its owning category', () => {
    for (const category of guide.categories) {
      for (const p of category.practices) expect(p.categoryId).toBe(category.id);
    }
  });
});

describe('guide parser — Objective section', () => {
  const { objective } = guide;

  it('reads the heading and the emphasised principles label', () => {
    expect(objective.heading).toBe('Objective');
    expect(objective.principlesLabel).toBe('Operating principles');
  });

  it('captures the lead and closing paragraphs verbatim', () => {
    expect(objective.leadParagraph).toBe(
      'Use this checklist to establish a lean, reliable, secure, and production-ready DevOps foundation without over-engineering or unnecessary infrastructure complexity.',
    );
    expect(objective.closingParagraph).toBe(
      'Use this checklist to establish a lean, reliable, secure, and production-ready DevOps foundation without unnecessary infrastructure complexity.',
    );
  });

  it('keeps the two near-identical paragraphs distinct', () => {
    // The source really does repeat itself with a small variation. Preserve both.
    expect(objective.leadParagraph).not.toBe(objective.closingParagraph);
    expect(objective.leadParagraph).toContain('over-engineering or');
    expect(objective.closingParagraph).not.toContain('over-engineering');
  });

  it('lists the 6 operating principles with term and detail split', () => {
    expect(objective.principles).toHaveLength(6);
    expect(objective.principles.map((p) => p.term)).toEqual([
      'Speed & Developer Velocity',
      'Simplicity First',
      'Automated Quality Gates',
      'Security by Default',
      'Observable Systems',
      'Resilience & Recovery',
    ]);
    expect(objective.principles[0]!.detail).toBe(
      'Fast feedback loops that keep engineers shipping code safely.',
    );
    expect(objective.principles[5]!.detail).toBe(
      'Reliable backups, safe rollbacks, and non-breaking migrations.',
    );
  });
});

describe('guide parser — practice fields', () => {
  it('gives all 24 practices five non-empty fields plus a checkbox label', () => {
    for (const p of practices) {
      expect(p.checkboxLabel, p.heading).toBe('Implementation complete');
      expect(p.description.length, `${p.heading} description`).toBeGreaterThan(0);
      expect(p.whyItMatters.length, `${p.heading} whyItMatters`).toBeGreaterThan(0);
      expect(p.keyConcepts.length, `${p.heading} keyConcepts`).toBeGreaterThan(0);
      expect(p.recommendedTools.length, `${p.heading} recommendedTools`).toBeGreaterThan(0);
      expect(p.verificationGate.length, `${p.heading} verificationGate`).toBeGreaterThan(0);
    }
  });

  it('never leaks a field label into a field value', () => {
    for (const p of practices) {
      for (const value of [
        p.description,
        p.whyItMatters,
        p.recommendedTools,
        p.verificationGate,
        ...p.keyConcepts,
      ]) {
        expect(value, p.heading).not.toMatch(/^\*\*/);
        expect(value, p.heading).not.toMatch(
          /^(Description|Why it matters|Key concepts|Recommended tools|Verification gate)\s*:/i,
        );
      }
    }
  });

  it('reads field values regardless of label spelling', () => {
    // Four labels were written `**Label**:` with the colon outside the
    // emphasis; corrected at source. The parser still accepts both spellings.
    expect(practice('Branch Protections & Single PR Approvals').description).toBe(
      'Enforce branch protection on `main`/`master`. Prohibit direct pushes and require at least one peer code review before merging.',
    );
    expect(practice('Secure Container Registries & Access Control').description).toBe(
      'Secure your container registries with strict least-privilege access, short-lived tokens, and vulnerability gating before push/pull.',
    );
  });

  it('uses one consistent label spelling across the document', () => {
    const raw = sources.guide;
    expect(raw).not.toMatch(/^- \*\*[A-Za-z][A-Za-z ]*\*\*:/m);
  });

  it('reads the checkbox label on every practice', () => {
    // Three practices had an unemphasised label; corrected at source so all 24
    // now read `- [ ]  **Implementation complete**`. The parser still accepts
    // either spelling.
    for (const p of practices) {
      expect(p.checkboxLabel, p.heading).toBe('Implementation complete');
    }
  });

  it('still accepts an unemphasised checkbox label', () => {
    const minimal = `# Guide
## Objective

Lead.

**Operating principles**

- **Speed:** Fast.

Closing.

# 1. Category

## Practice

- [ ]  Implementation complete
- **Description:** Something.
- **Why it matters:** Reason.
- **Key concepts:**
    - One
- **Recommended tools:** Tool
- **Verification gate:** Gate
`;
    const parsed = parseGuide(minimal);
    expect(parsed.categories[0]!.practices[0]!.checkboxLabel).toBe('Implementation complete');
  });

  it('reads the heading whose stray emphasis wrapper was removed', () => {
    // The export wrapped this one H2 in `**...**`; corrected at source.
    const p = practice('On-Call Rotation and Incident Routing (Optional for Startups)');
    expect(p.headingRaw).toBe('On-Call Rotation and Incident Routing (Optional for Startups)');
    expect(p.heading).toBe(p.headingRaw);
  });

  it('leaves no emphasis markers on any practice heading', () => {
    for (const p of practices) {
      expect(p.headingRaw, p.heading).not.toMatch(/\*\*/);
    }
  });

  it('reads the Progressive Delivery heading with its parenthesis closed', () => {
    expect(practices[4]!.heading).toBe(
      'Progressive Delivery & Canary Deployments (Optional For Startup)',
    );
  });

  it('leaves no unbalanced parentheses in any heading', () => {
    for (const heading of [
      ...guide.categories.map((c) => c.heading),
      ...practices.map((p) => p.heading),
    ]) {
      const open = (heading.match(/\(/g) ?? []).length;
      const close = (heading.match(/\)/g) ?? []).length;
      expect(open, heading).toBe(close);
    }
  });
});

describe('guide parser — previously mis-nested Key concepts', () => {
  it.each(MIS_NESTED)('reads 3 key concepts from "%s"', (heading) => {
    expect(practice(heading).keyConcepts).toHaveLength(3);
  });

  it('now finds every Key concepts label at the top level in the source', () => {
    // All three mis-nested lists were corrected at source, so the document has
    // 24 top-level `- **Key concepts:**` bullets and no indented label.
    const topLevel = sources.guide.match(/^- \*\*Key concepts:\*\*$/gm) ?? [];
    expect(topLevel).toHaveLength(24);
    expect(sources.guide).not.toMatch(/^ {4}- Key concepts:/m);
  });

  it('reads the concepts in order', () => {
    expect(practice('Backward-Compatible Database Migrations (Expand and Contract)').keyConcepts)
      .toEqual(['Expand-and-contract pattern', 'Non-breaking migrations', 'Decoupled deployments']);
    expect(practice('Secure Container Registries & Access Control').keyConcepts).toEqual([
      'Private registry IAM',
      'Short-lived registry credentials',
      'Image signing/provenance',
    ]);
    expect(
      practice('On-Call Rotation and Incident Routing (Optional for Startups)').keyConcepts,
    ).toEqual(['On-call schedules', 'Escalation policies', 'Alert severity levels']);
  });

  it('does not absorb the Key concepts label into Why it matters', () => {
    for (const heading of MIS_NESTED) {
      expect(practice(heading).whyItMatters).not.toContain('Key concepts');
    }
  });

  it('still recovers a mis-nested list, in case an export regresses', () => {
    const regressed = `# Guide
## Objective

Lead.

**Operating principles**

- **Speed:** Fast.

Closing.

# 1. Category

## Practice

- [ ]  **Implementation complete**
- **Description:** Something.
- **Why it matters:** Reason.
    - Key concepts: One
    - Two
- **Recommended tools:** Tool
- **Verification gate:** Gate
`;
    const parsed = parseGuide(regressed);
    expect(parsed.categories[0]!.practices[0]!.keyConcepts).toEqual(['One', 'Two']);
  });

  it('reads well-formed Key concepts lists at their authored length', () => {
    // These two carry 4 concepts in the source, not 3.
    expect(practice('Automated Database Backups & Point-in-Time Recovery').keyConcepts).toEqual([
      'PITR — Point-in-Time Recovery',
      'Automated snapshots',
      'Offsite backup storage',
      'Defined RPO/RTO',
    ]);
    expect(practice('Documented Rollback Procedure & One-Click Reverts').keyConcepts).toHaveLength(
      4,
    );
  });
});

describe('guide parser — inline markup retained for the renderer', () => {
  it('keeps backtick code spans in field values', () => {
    expect(practice('Infrastructure as Code').verificationGate).toContain('`terraform plan`');
    expect(practice('Structured Log Aggregation & Search').verificationGate).toContain(
      '`request_id`',
    );
    expect(practice('Uptime Monitoring & Basic Paging Alerts').verificationGate).toContain('`503`');
    expect(
      practice('Centralized Secret & Environment Variable Management (Implement in Startup, if they want more security)')
        .description,
    ).toContain('`.env`');
  });

  it('keeps backtick code spans inside key concepts', () => {
    expect(practice('Distributed APM & OpenTelemetry Tracing').keyConcepts[1]).toBe(
      'Context propagation (W3C `traceparent`)',
    );
  });

  it("leaves Notion's LaTeX delimiters untouched", () => {
    expect(
      practice('Backward-Compatible Database Migrations (Expand and Contract)').verificationGate,
    ).toBe(
      'Simulate a rollback from Code Version N+1 to Version N while running the new schema. The older version must still function without errors.',
    );
  });

  it('keeps arrows and percentages in key concepts', () => {
    expect(
      practice('Progressive Delivery & Canary Deployments (Optional For Startup)').keyConcepts[0],
    ).toBe('Canary rollouts (e.g., 5% → 25% → 100%)');
  });
});

describe('guide parser — strictness', () => {
  it('rejects a practice with a missing field', () => {
    const broken = `# Guide
## Objective

Lead paragraph.

**Operating principles**

- **Speed:** Fast.

Closing paragraph.

# 1. Category

## Practice

- [ ]  **Implementation complete**
- **Description:** Something.
- **Key concepts:**
    - One
- **Recommended tools:** Tool
`;
    expect(() => parseGuide(broken)).toThrow(/missing the "whyitmatters" field/);
  });

  it('rejects a practice with no checkbox', () => {
    const broken = `# Guide
## Objective

Lead.

**Operating principles**

- **Speed:** Fast.

Closing.

# 1. Category

## Practice

- **Description:** Something.
- **Why it matters:** Reason.
- **Key concepts:**
    - One
- **Recommended tools:** Tool
- **Verification gate:** Gate
`;
    expect(() => parseGuide(broken)).toThrow(/has no checkbox/);
  });

  it('rejects an unknown labelled field rather than dropping it', () => {
    const broken = `# Guide
## Objective

Lead.

**Operating principles**

- **Speed:** Fast.

Closing.

# 1. Category

## Practice

- [ ]  **Implementation complete**
- **Description:** Something.
- **Why it matters:** Reason.
- **Key concepts:**
    - One
- **Recommended tools:** Tool
- **Verification gate:** Gate
- **Compliance mapping:** Invented
`;
    expect(() => parseGuide(broken)).toThrow(/unknown field "Compliance mapping"/);
  });

  it('rejects a category with no practices', () => {
    const broken = `# Guide
## Objective

Lead.

**Operating principles**

- **Speed:** Fast.

Closing.

# 1. Empty Category
`;
    expect(() => parseGuide(broken)).toThrow(/has no practices/);
  });

  it('rejects a document with no Objective section', () => {
    expect(() => parseGuide('# Guide\n\n# 1. Category\n\n## P\n')).toThrow(/no `## Objective`/);
  });
});
