import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import {
  runLiveGitHubAudit,
  parseCIEvidence,
  generateCIWorkflowYaml,
  fetchGitHubRateLimit,
  type AutomatedAuditReport,
  type AutomatedCheckResult,
  type GitHubRateLimitInfo,
} from '../services/githubAudit';
import { getSampleAuditReport } from '../services/sampleAuditReports';
import { usePortalState } from '../state/PortalStateProvider';
import { useAuth } from '../state/authContext';

type PanelMode = 'live' | 'import' | 'workflow';
type StatusFilter = 'all' | 'pass' | 'fail' | 'warn';

export function AutomatedVerificationPanel() {
  const { latestAuditReport, saveAuditReport, applyAuditVerifications } = usePortalState();
  const { isAdmin } = useAuth();

  const [mode, setMode] = useState<PanelMode>('live');
  const [repoInput, setRepoInput] = useState('Binod231/DevOps-Guide-Checklist');
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quota & Rate Limit State
  const [quota, setQuota] = useState<GitHubRateLimitInfo | null>(null);
  const [isRefreshingQuota, setIsRefreshingQuota] = useState(false);

  // Import state
  const [jsonInput, setJsonInput] = useState('');
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Results display state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);

  const report: AutomatedAuditReport | null = latestAuditReport;

  // Poll quota on mount & when token changes
  useEffect(() => {
    let isMounted = true;
    fetchGitHubRateLimit(tokenInput.trim() || undefined).then((q) => {
      if (isMounted) setQuota(q);
    });
    return () => {
      isMounted = false;
    };
  }, [tokenInput]);

  const handleRefreshQuota = async () => {
    setIsRefreshingQuota(true);
    const q = await fetchGitHubRateLimit(tokenInput.trim() || undefined);
    setQuota(q);
    setIsRefreshingQuota(false);
  };

  const handleLoadSample = (sampleKey: 'portal' | 'fastify') => {
    const sample = getSampleAuditReport(sampleKey);
    saveAuditReport(sample);
    setRepoInput(sample.repository);
    setErrorMessage(null);
    setAppliedNotice(null);
  };

  const handleRunScan = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAppliedNotice(null);

    const trimmed = repoInput.trim();
    if (!trimmed.includes('/')) {
      setErrorMessage('Please enter repository in "owner/repo" format (e.g., Binod231/DevOps-Guide-Checklist).');
      return;
    }

    const [owner, repo] = trimmed.split('/');
    if (!owner || !repo) {
      setErrorMessage('Invalid repository name format. Must be "owner/repo".');
      return;
    }

    setIsRunning(true);
    try {
      const generatedReport = await runLiveGitHubAudit(owner, repo, tokenInput.trim() || undefined);
      saveAuditReport(generatedReport);
      // Refresh quota after scan
      fetchGitHubRateLimit(tokenInput.trim() || undefined).then((q) => setQuota(q));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error during scan';
      setErrorMessage(msg);
      // Refresh quota on error as well
      fetchGitHubRateLimit(tokenInput.trim() || undefined).then((q) => setQuota(q));
    } finally {
      setIsRunning(false);
    }
  };

  const handleImportJson = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setImportNotice(null);

    if (!jsonInput.trim()) {
      setErrorMessage('Please paste or upload JSON evidence content.');
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      const generatedReport = parseCIEvidence(parsed);
      saveAuditReport(generatedReport);
      setImportNotice(`Loaded evidence report for ${generatedReport.repository}`);
      setTimeout(() => setImportNotice(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse JSON evidence file';
      setErrorMessage(msg);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setJsonInput(content);
        try {
          const parsed = JSON.parse(content);
          const generatedReport = parseCIEvidence(parsed);
          saveAuditReport(generatedReport);
          setImportNotice(`Loaded evidence from ${file.name}`);
          setTimeout(() => setImportNotice(null), 4000);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Invalid JSON file structure';
          setErrorMessage(msg);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleApplyVerifications = () => {
    if (!report) return;
    const { verifiedTrackerCount, verifiedChecklistCount } = applyAuditVerifications(
      report,
      'Automated GitHub Verification',
    );
    setAppliedNotice(
      `Successfully signed off ${verifiedTrackerCount} tracker rows and ${verifiedChecklistCount} guide practices using verified evidence.`,
    );
    setTimeout(() => setAppliedNotice(null), 5000);
  };

  const workflowYaml = generateCIWorkflowYaml(
    repoInput.split('/')[0] || 'your-org',
    repoInput.split('/')[1] || 'your-repo',
  );

  const handleCopyWorkflow = async () => {
    try {
      await navigator.clipboard.writeText(workflowYaml);
      setCopiedWorkflow(true);
      setTimeout(() => setCopiedWorkflow(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadWorkflow = () => {
    const blob = new Blob([workflowYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'devops-readiness-audit.yml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredResults = (report?.results ?? []).filter((r: AutomatedCheckResult) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  return (
    <div className="space-y-5">
      {/* Executive Header & Mode Selector */}
      <div className="rounded-lg border border-edge bg-surface p-5 shadow-2xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <svg className="size-5 text-ink-muted shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <h2 className="text-base font-semibold text-ink">
                Automated Repository Verification
              </h2>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Inspect branch protections, CI pipelines, secret scanning hooks, and IaC definitions against the DevOps Guide standards.
            </p>
          </div>

          {/* Segmented Navigation */}
          <div className="flex items-center rounded-md border border-edge bg-sunken p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode('live')}
              className={`rounded px-3 py-1.5 font-medium transition-all ${
                mode === 'live'
                  ? 'border border-edge/80 bg-surface font-semibold text-ink shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Live Scan
            </button>
            <button
              type="button"
              onClick={() => setMode('import')}
              className={`rounded px-3 py-1.5 font-medium transition-all ${
                mode === 'import'
                  ? 'border border-edge/80 bg-surface font-semibold text-ink shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Import CI Evidence
            </button>
            <button
              type="button"
              onClick={() => setMode('workflow')}
              className={`rounded px-3 py-1.5 font-medium transition-all ${
                mode === 'workflow'
                  ? 'border border-edge/80 bg-surface font-semibold text-ink shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              CI Workflow
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: Live API Scan Form */}
      {mode === 'live' && (
        <form onSubmit={handleRunScan} className="rounded-lg border border-edge bg-surface p-5 shadow-2xs space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="repo-input" className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                GitHub Repository (owner/repo)
              </label>
              <input
                id="repo-input"
                type="text"
                required
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="e.g. Binod231/DevOps-Guide-Checklist"
                className="mt-1.5 w-full rounded-md border border-edge bg-sunken px-3 py-2 text-xs text-ink transition-colors focus:border-accent focus:bg-surface focus:outline-hidden"
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] text-ink-muted">Try sample:</span>
                <button
                  type="button"
                  onClick={() => handleLoadSample('portal')}
                  className="inline-flex items-center rounded border border-edge bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink hover:border-accent hover:bg-surface transition-colors"
                >
                  DevOps Guide Portal (88%)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample('fastify')}
                  className="inline-flex items-center rounded border border-edge bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink hover:border-accent hover:bg-surface transition-colors"
                >
                  Fastify (75%)
                </button>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="token-input" className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Personal Access Token (Read-Only)
                </label>
                <div className="flex items-center gap-2">
                  <a
                    href="https://github.com/settings/tokens/new?description=DevOps-Portal-Audit&scopes="
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-accent hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Get free token (5k/hr)</span>
                    <svg className="size-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <span className="text-ink-muted">·</span>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-xs font-medium text-ink-muted hover:text-ink"
                  >
                    {showToken ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <input
                id="token-input"
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="github_pat_... (Leave blank for public repositories)"
                className="mt-1.5 w-full rounded-md border border-edge bg-sunken px-3 py-2 text-xs font-mono text-ink transition-colors focus:border-accent focus:bg-surface focus:outline-hidden"
              />
              {quota && (
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className={`font-mono ${quota.remaining === 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-ink-muted'}`}>
                    GitHub Quota: {quota.remaining} / {quota.limit} remaining
                    {quota.remaining === 0 && ` (Resets in ~${quota.minutesUntilReset} min at ${quota.resetDate})`}
                  </span>
                  <button
                    type="button"
                    onClick={handleRefreshQuota}
                    disabled={isRefreshingQuota}
                    className="text-ink-muted hover:text-ink transition-colors"
                  >
                    {isRefreshingQuota ? 'Checking...' : 'Check quota'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border border-edge bg-sunken/40 p-3 text-xs text-ink-muted leading-relaxed">
            <span className="font-semibold text-ink">Private repository note:</span> Tokens are kept in browser memory
            only and never persisted. Recommended scopes: <code className="rounded border border-edge bg-surface px-1.5 py-0.5 text-ink">actions:read</code>, <code className="rounded border border-edge bg-surface px-1.5 py-0.5 text-ink">administration:read</code>, <code className="rounded border border-edge bg-surface px-1.5 py-0.5 text-ink">contents:read</code>.
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="submit"
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-4 py-2 text-xs font-semibold text-white dark:text-ink-inverse shadow-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Querying GitHub API...</span>
                </>
              ) : (
                <span>Run Live Repository Audit</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Mode 2: Import CI Evidence JSON */}
      {mode === 'import' && (
        <form onSubmit={handleImportJson} className="rounded-lg border border-edge bg-surface p-5 shadow-2xs space-y-4">
          <p className="text-xs text-ink-muted">
            For automated CI in private repositories, import the <code className="rounded border border-edge bg-sunken px-1.5 py-0.5 text-ink">devops-audit-evidence.json</code> artifact produced by GitHub Actions.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              id="evidence-file"
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
              aria-label="Upload JSON Evidence File"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-edge bg-sunken px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface"
            >
              Upload Evidence JSON File
            </button>
            <span className="text-xs text-ink-muted">or paste the JSON payload below</span>
          </div>

          <div>
            <label htmlFor="evidence-paste" className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Paste Evidence JSON Content
            </label>
            <textarea
              id="evidence-paste"
              rows={5}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"repository": "org/repo", "results": [...]}'
              className="mt-1.5 w-full rounded-md border border-edge bg-sunken/60 p-3 font-mono text-xs text-ink transition-colors focus:border-accent focus:bg-surface focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="rounded-md border border-accent bg-accent px-4 py-2 text-xs font-semibold text-white dark:text-ink-inverse shadow-xs transition-opacity hover:opacity-90"
            >
              Parse &amp; Load Evidence
            </button>
            {importNotice && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{importNotice}</span>}
          </div>
        </form>
      )}

      {/* Mode 3: CI Workflow Template */}
      {mode === 'workflow' && (
        <div className="rounded-lg border border-edge bg-surface p-5 shadow-2xs space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">
                GitHub Actions Audit Workflow
              </h3>
              <p className="text-xs text-ink-muted">
                Add this file to your repository as <code className="rounded border border-edge bg-sunken px-1.5 py-0.5 text-ink">.github/workflows/devops-readiness-audit.yml</code>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyWorkflow}
                className="rounded-md border border-edge bg-sunken px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface"
              >
                {copiedWorkflow ? 'Copied' : 'Copy Workflow YAML'}
              </button>
              <button
                type="button"
                onClick={handleDownloadWorkflow}
                className="rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-white dark:text-ink-inverse shadow-xs transition-opacity hover:opacity-90"
              >
                Download .yml
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-md border border-edge bg-sunken/80 p-4 font-mono text-xs text-ink leading-relaxed">
            <pre className="whitespace-pre">{workflowYaml}</pre>
          </div>
        </div>
      )}

      {/* Errors or Notices */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-rose-300 bg-rose-50/90 p-4 text-xs text-rose-900 shadow-2xs dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <svg className="size-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 space-y-1">
              <h4 className="font-semibold text-rose-950 dark:text-rose-100">
                {errorMessage.toLowerCase().includes('rate limit') ? 'GitHub API Rate Limit Reached' : 'Audit Notice'}
              </h4>
              <p className="leading-relaxed opacity-90">{errorMessage}</p>
            </div>
          </div>

          {errorMessage.toLowerCase().includes('rate limit') && (
            <div className="pt-2 border-t border-rose-200/80 dark:border-rose-900/50 flex flex-wrap items-center gap-2">
              <a
                href="https://github.com/settings/tokens/new?description=DevOps-Portal-Audit&scopes="
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white px-3 py-1.5 font-semibold text-rose-900 shadow-2xs hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-100 transition-colors"
              >
                <span>Create Free Token (5,000 req/hr)</span>
                <svg className="size-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                </svg>
              </a>
              <button
                type="button"
                onClick={() => handleLoadSample('fastify')}
                className="inline-flex items-center rounded-md border border-edge bg-surface px-3 py-1.5 font-medium text-ink shadow-2xs hover:bg-sunken transition-colors"
              >
                Load Sample Fastify Report
              </button>
              <button
                type="button"
                onClick={() => handleLoadSample('portal')}
                className="inline-flex items-center rounded-md border border-edge bg-surface px-3 py-1.5 font-medium text-ink shadow-2xs hover:bg-sunken transition-colors"
              >
                Load Sample DevOps Guide Report
              </button>
            </div>
          )}
        </div>
      )}

      {appliedNotice && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <strong>Applied:</strong> {appliedNotice}
        </div>
      )}

      {/* Audit Report Presentation */}
      {report && (
        <div className="rounded-lg border border-edge bg-surface p-5 shadow-2xs space-y-5">
          {/* Executive Summary Banner */}
          <div className="flex flex-col gap-4 border-b border-edge pb-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Target:</span>
                <span className="font-mono text-sm font-bold text-ink">
                  {report.repository}
                </span>
                <span className="rounded border border-edge bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                  {report.scannerMode === 'live_api' ? 'Live GitHub API' : 'CI Evidence Artifact'}
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Audit executed: {new Date(report.scannedAt).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-ink">
                    {report.scorePercentage}%
                  </span>
                  <span className="text-xs font-medium text-ink-muted">
                    Compliance
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted">
                  {report.passedCount} of {report.totalEvaluated} controls satisfied
                </p>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleApplyVerifications}
                  className="rounded-md border border-emerald-600 bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs transition-opacity hover:opacity-90"
                >
                  Apply Passing Controls to Portal
                </button>
              )}
            </div>
          </div>

          {/* Clean High-Contrast Filter Pills (Fixed for Light & Dark Mode) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'border-accent bg-accent-subtle text-accent font-semibold'
                  : 'border-edge bg-surface text-ink-secondary hover:bg-sunken hover:text-ink'
              }`}
            >
              All Controls ({report.totalEvaluated})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pass')}
              className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === 'pass'
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold'
                  : 'border-edge bg-surface text-ink-secondary hover:bg-sunken hover:text-ink'
              }`}
            >
              Passed ({report.passedCount})
            </button>
            {report.failedCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('fail')}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === 'fail'
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold'
                    : 'border-edge bg-surface text-ink-secondary hover:bg-sunken hover:text-ink'
                }`}
              >
                Failed ({report.failedCount})
              </button>
            )}
            {report.warnCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('warn')}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === 'warn'
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold'
                    : 'border-edge bg-surface text-ink-secondary hover:bg-sunken hover:text-ink'
                }`}
              >
                Warnings ({report.warnCount})
              </button>
            )}
          </div>

          {/* Itemized Results Cards */}
          <div className="divide-y divide-edge rounded-md border border-edge bg-surface">
            {filteredResults.map((item) => (
              <div key={item.rowKey || item.id} className="p-4 transition-colors hover:bg-sunken/30">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-sunken border border-edge px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-secondary">
                      {item.id}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {item.category}
                    </span>
                    <span className="text-ink-muted" aria-hidden="true">·</span>
                    <h4 className="text-xs font-semibold text-ink sm:text-sm">
                      {item.title}
                    </h4>
                  </div>

                  <div className="shrink-0">
                    {item.status === 'pass' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-500"></span>
                        Verified
                      </span>
                    )}
                    {item.status === 'fail' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-400">
                        <span className="size-1.5 rounded-full bg-rose-500"></span>
                        Non-Compliant
                      </span>
                    )}
                    {item.status === 'warn' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <span className="size-1.5 rounded-full bg-amber-500"></span>
                        Advisory
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 space-y-2 text-xs">
                  <p className="font-medium text-ink leading-relaxed">{item.summary}</p>
                  
                  <div className="rounded border-l-2 border-accent/60 bg-sunken/50 px-3 py-2 text-ink-secondary">
                    <span className="font-semibold text-ink-muted">Evidence: </span>
                    <span>{item.evidence}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-ink-muted">
                    <p className="text-[11px]">
                      <span className="font-medium">DevOps Gate:</span> {item.verificationGate}
                    </p>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-medium text-accent hover:underline inline-flex items-center gap-1"
                      >
                        <span>View in GitHub</span>
                        <span aria-hidden="true">&rarr;</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
