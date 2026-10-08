import { describe, expect, it } from 'vitest';
import {
  displayTitle,
  fullTitleAttribute,
  hasStageQualifier,
  stageQualifier,
} from './displayTitle';
import { allPractices, guide } from './registry';

describe('displayTitle — the headings that carry a stage qualifier', () => {
  it.each([
    ['5. Observability (Optional For Startup)', '5. Observability'],
    ['6. Disaster Recovery (Optional For Startup)', '6. Disaster Recovery'],
    [
      'Progressive Delivery & Canary Deployments (Optional For Startup)',
      'Progressive Delivery & Canary Deployments',
    ],
    [
      'Edge Security, WAF & Ingress Rate Limiting (Optional For Startup)',
      'Edge Security, WAF & Ingress Rate Limiting',
    ],
    [
      'Pinned Dependencies & Automated Security Audits (Optional For Startup)',
      'Pinned Dependencies & Automated Security Audits',
    ],
    [
      'On-Call Rotation and Incident Routing (Optional for Startups)',
      'On-Call Rotation and Incident Routing',
    ],
    [
      'Isolated Staging & Production Environments (Staging Env is Optional for the Startup or small company)',
      'Isolated Staging & Production Environments',
    ],
    [
      'Centralized Secret & Environment Variable Management (Implement in Startup, if they want more security)',
      'Centralized Secret & Environment Variable Management',
    ],
  ])('strips the qualifier from %s', (heading, expected) => {
    expect(displayTitle(heading)).toBe(expected);
  });
});

describe('displayTitle — what it leaves alone', () => {
  it.each([
    '1. Source Code Management & CI/CD',
    '2. Infrastructure',
    '3. Testing & Quality',
    '4. Security',
    'Branch Protections & Single PR Approvals',
    'Infrastructure as Code',
    'Golden Signals, SLIs & SLO Tracking',
    'Automated Database Backups & Point-in-Time Recovery',
  ])('leaves %s unchanged', (heading) => {
    expect(displayTitle(heading)).toBe(heading);
    expect(hasStageQualifier(heading)).toBe(false);
  });

  it('keeps a parenthetical that is part of the name', () => {
    // `(Expand and Contract)` names the pattern; it is not an applicability note.
    expect(displayTitle('Backward-Compatible Database Migrations (Expand and Contract)')).toBe(
      'Backward-Compatible Database Migrations (Expand and Contract)',
    );
  });

  it('keeps a parenthetical mentioning a stage without an applicability word', () => {
    expect(displayTitle('Scaling Beyond Startup')).toBe('Scaling Beyond Startup');
    expect(displayTitle('Something (Startup Edition)')).toBe('Something (Startup Edition)');
  });

  it('keeps a parenthetical that is applicability without a stage', () => {
    expect(displayTitle('Retention Policy (Optional)')).toBe('Retention Policy (Optional)');
  });

  it('only strips from the end, never mid-string', () => {
    expect(displayTitle('A (Optional For Startup) and more')).toBe(
      'A (Optional For Startup) and more',
    );
  });

  it('handles an empty string', () => {
    expect(displayTitle('')).toBe('');
  });
});

describe('stageQualifier', () => {
  it('returns the removed text without its parentheses', () => {
    expect(stageQualifier('5. Observability (Optional For Startup)')).toBe(
      'Optional For Startup',
    );
    expect(
      stageQualifier('On-Call Rotation and Incident Routing (Optional for Startups)'),
    ).toBe('Optional for Startups');
  });

  it('returns undefined when nothing is removed', () => {
    expect(stageQualifier('2. Infrastructure')).toBeUndefined();
  });
});

describe('fullTitleAttribute', () => {
  it('returns the full heading only when the display title is shorter', () => {
    expect(fullTitleAttribute('5. Observability (Optional For Startup)')).toBe(
      '5. Observability (Optional For Startup)',
    );
    expect(fullTitleAttribute('2. Infrastructure')).toBeUndefined();
  });
});

describe('displayTitle — applied to the real documents', () => {
  it('shortens exactly 2 of the 6 category headings', () => {
    const shortened = guide.categories.filter((c) => hasStageQualifier(c.heading));
    expect(shortened.map((c) => c.heading)).toEqual([
      '5. Observability (Optional For Startup)',
      '6. Disaster Recovery (Optional For Startup)',
    ]);
  });

  it('shortens exactly 6 of the 24 practice headings', () => {
    const shortened = allPractices.filter((p) => hasStageQualifier(p.heading));
    expect(shortened).toHaveLength(6);
  });

  it('leaves no stage qualifier in any display title', () => {
    for (const heading of [
      ...guide.categories.map((c) => c.heading),
      ...allPractices.map((p) => p.heading),
    ]) {
      expect(displayTitle(heading), heading).not.toMatch(/optional|implement in/i);
    }
  });

  it('never produces an empty display title', () => {
    for (const heading of [
      ...guide.categories.map((c) => c.heading),
      ...allPractices.map((p) => p.heading),
    ]) {
      expect(displayTitle(heading).length, heading).toBeGreaterThan(0);
    }
  });

  it('keeps display titles unique, so navigation stays unambiguous', () => {
    const categories = guide.categories.map((c) => displayTitle(c.heading));
    expect(new Set(categories).size).toBe(6);

    const practices = allPractices.map((p) => displayTitle(p.heading));
    expect(new Set(practices).size).toBe(24);
  });

  it('leaves the parsed headings untouched', () => {
    // The documents remain the authority; this is display only.
    expect(guide.categories[4]!.heading).toBe('5. Observability (Optional For Startup)');
    expect(
      allPractices.find((p) => p.heading.startsWith('Progressive Delivery'))!.heading,
    ).toBe('Progressive Delivery & Canary Deployments (Optional For Startup)');
  });
});
