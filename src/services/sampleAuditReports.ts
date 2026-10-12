import { evaluateRepo, type RepoContext, type AutomatedAuditReport } from './githubAudit';

/**
 * Pre-evaluated sample repository contexts for immediate demonstration
 * and offline testing when GitHub API rate limits are reached.
 */

export const SAMPLE_PORTAL_CONTEXT: RepoContext = {
  owner: 'Binod231',
  repo: 'DevOps-Guide-Checklist',
  defaultBranch: 'main',
  isPrivate: false,
  filePaths: [
    '.github/workflows/deploy.yml',
    '.github/workflows/devops-readiness-audit.yml',
    '.pre-commit-config.yaml',
    'gitleaks.toml',
    'terraform/main.tf',
    'terraform/s3.tf',
    'package.json',
    'package-lock.json',
    'src/index.css',
    'src/main.tsx',
    'src/test/accessibility.test.tsx',
    'src/test/automatedVerification.test.tsx',
    'src/services/githubAudit.test.ts',
    'scripts/health-check.sh',
    'scripts/parse-content.ts',
    'scripts/run-devops-audit.mjs',
    'docs/runbooks/disaster-recovery.md',
    'docs/runbooks/incident-response.md',
    'environments/prod/terraform.tfvars',
    'environments/staging/terraform.tfvars',
    'infracost.yml',
    'vault.yaml',
    'SECURITY.md',
    'Dockerfile',
    'src/services/logger.ts',
    'docs/tabletop-drill-2026.md',
  ],
  workflows: [
    { name: 'Deploy to AWS S3', path: '.github/workflows/deploy.yml', state: 'active' },
    { name: 'DevOps Readiness Verification Audit', path: '.github/workflows/devops-readiness-audit.yml', state: 'active' },
  ],
  recentRuns: [
    {
      workflow_name: 'Deploy to AWS S3',
      conclusion: 'success',
      status: 'completed',
      head_branch: 'main',
      html_url: 'https://github.com/Binod231/DevOps-Guide-Checklist/actions/runs/1',
    },
    {
      workflow_name: 'DevOps Readiness Verification Audit',
      conclusion: 'success',
      status: 'completed',
      head_branch: 'main',
      html_url: 'https://github.com/Binod231/DevOps-Guide-Checklist/actions/runs/2',
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

export const SAMPLE_FASTIFY_CONTEXT: RepoContext = {
  owner: 'fastify',
  repo: 'fastify',
  defaultBranch: 'main',
  isPrivate: false,
  filePaths: [
    '.github/workflows/ci.yml',
    '.github/workflows/package.yml',
    '.github/workflows/scorecards.yml',
    '.github/dependabot.yml',
    '.github/PULL_REQUEST_TEMPLATE.md',
    'package.json',
    'package-lock.json',
    'test/route.test.js',
    'test/server.test.js',
    'lib/server.js',
    'docs/Guides/Recommendations.md',
    'SECURITY.md',
    'pino.js',
  ],
  workflows: [
    { name: 'CI', path: '.github/workflows/ci.yml', state: 'active' },
    { name: 'Security Scorecard', path: '.github/workflows/scorecards.yml', state: 'active' },
  ],
  recentRuns: [
    {
      workflow_name: 'CI',
      conclusion: 'success',
      status: 'completed',
      head_branch: 'main',
      html_url: 'https://github.com/fastify/fastify/actions/runs/100',
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

export function getSampleAuditReport(sampleKey: 'portal' | 'fastify'): AutomatedAuditReport {
  if (sampleKey === 'fastify') {
    return evaluateRepo(SAMPLE_FASTIFY_CONTEXT, 'live_api');
  }
  return evaluateRepo(SAMPLE_PORTAL_CONTEXT, 'live_api');
}
