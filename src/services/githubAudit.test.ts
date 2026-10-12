import { describe, it, expect } from 'vitest';
import {
  evaluateRepo,
  parseCIEvidence,
  generateCIWorkflowYaml,
  type RepoContext,
} from './githubAudit';

describe('githubAudit Service & Rule Engine', () => {
  const baseContext: RepoContext = {
    owner: 'test-org',
    repo: 'test-repo',
    defaultBranch: 'main',
    isPrivate: true,
    filePaths: [
      '.pre-commit-config.yaml',
      'package-lock.json',
      'main.tf',
      'src/test/app.test.ts',
      'migrations/001_init.sql',
      'src/routes/health.ts',
      'docs/rollback.md',
    ],
    workflows: [
      { name: 'CI Pipeline', path: '.github/workflows/ci.yml', state: 'active' },
      { name: 'Container Scan', path: '.github/workflows/trivy.yml', state: 'active' },
    ],
    recentRuns: [
      {
        workflow_name: 'CI Pipeline',
        conclusion: 'success',
        status: 'completed',
        head_branch: 'main',
        html_url: 'https://github.com/test-org/test-repo/actions/runs/1',
      },
    ],
    branchProtection: {
      enabled: true,
      requiredReviews: { required_approving_review_count: 1 },
      requiredStatusChecks: { strict: true, checks: [{ context: 'test' }] },
      enforceAdmins: true,
    },
    dependabotAlertsCount: 0,
    secretScanningEnabled: true,
  };

  it('evaluates all controls with high pass rate on compliant repository', () => {
    const report = evaluateRepo(baseContext);

    expect(report.repository).toBe('test-org/test-repo');
    expect(report.scannerMode).toBe('live_api');
    expect(report.passedCount).toBeGreaterThanOrEqual(8);
    expect(report.failedCount).toBe(0);
    expect(report.scorePercentage).toBeGreaterThanOrEqual(80);

    const st01 = report.results.find((r) => r.id === 'ST-01');
    expect(st01?.status).toBe('pass');
    expect(st01?.evidence).toContain('Enforces at least 1 approving review');

    const st02 = report.results.find((r) => r.id === 'ST-02');
    expect(st02?.status).toBe('pass');
    expect(st02?.evidence).toContain('successful runs on');

    const st03 = report.results.find((r) => r.id === 'ST-03');
    expect(st03?.status).toBe('pass');
    expect(st03?.summary).toContain('Secret scanning controls detected');

    const st07 = report.results.find((r) => r.id === 'ST-07');
    expect(st07?.status).toBe('pass');
    expect(st07?.evidence).toContain('main.tf');

    const st10 = report.results.find((r) => r.id === 'ST-10');
    expect(st10?.status).toBe('pass');
    expect(st10?.evidence).toContain('app.test.ts');
  });

  it('fails controls when branch protection and CI workflows are missing', () => {
    const nonCompliantContext: RepoContext = {
      ...baseContext,
      filePaths: ['index.js'], // No lockfile, no tests, no IaC
      workflows: [],
      recentRuns: [],
      branchProtection: { enabled: false },
    };

    const report = evaluateRepo(nonCompliantContext);

    const st01 = report.results.find((r) => r.id === 'ST-01');
    expect(st01?.status).toBe('fail');
    expect(st01?.summary).toContain('Branch protection is not enabled');

    const st02 = report.results.find((r) => r.id === 'ST-02');
    expect(st02?.status).toBe('fail');

    const st10 = report.results.find((r) => r.id === 'ST-10');
    expect(st10?.status).toBe('fail');
  });

  it('warns when token lacks administration:read permission for branch protection', () => {
    const restrictedTokenContext: RepoContext = {
      ...baseContext,
      branchProtection: { enabled: false, unauthorized: true },
    };

    const report = evaluateRepo(restrictedTokenContext);
    const st01 = report.results.find((r) => r.id === 'ST-01');
    expect(st01?.status).toBe('warn');
    expect(st01?.summary).toContain('Insufficient token permissions');
  });

  it('parses valid CI evidence JSON payloads', () => {
    const samplePayload = {
      repository: 'Binod231/DevOps-Guide-Checklist',
      scannedAt: '2026-10-12T10:00:00Z',
      scannerMode: 'ci_artifact',
      passedCount: 6,
      failedCount: 1,
      warnCount: 1,
      totalEvaluated: 8,
      scorePercentage: 75,
      results: [
        {
          id: 'ST-01',
          title: 'Branch Protections',
          category: 'SCM & CI/CD',
          verificationGate: 'Requires PR approvals',
          status: 'pass',
          summary: 'Enforced',
          evidence: 'Verified via CI',
        },
      ],
    };

    const report = parseCIEvidence(samplePayload);
    expect(report.repository).toBe('Binod231/DevOps-Guide-Checklist');
    expect(report.passedCount).toBe(6);
    expect(report.results).toHaveLength(1);
    expect(report.results[0]?.status).toBe('pass');
  });

  it('throws an error when CI evidence is malformed', () => {
    expect(() => parseCIEvidence(null)).toThrow();
    expect(() => parseCIEvidence('invalid-string')).toThrow();
    expect(() => parseCIEvidence({ unrelatedKey: 123 })).toThrow();
  });

  it('generates a valid CI workflow YAML file containing repository name', () => {
    const yaml = generateCIWorkflowYaml('custom-org', 'custom-repo');
    expect(yaml).toContain('name: DevOps Readiness Verification Audit');
    expect(yaml).toContain('custom-org/custom-repo');
    expect(yaml).toContain('devops-audit-evidence.json');
  });
});
