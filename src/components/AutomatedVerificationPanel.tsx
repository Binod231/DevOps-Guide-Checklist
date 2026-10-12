import { useState, type FormEvent, type ChangeEvent } from 'react';
import {
  runLiveGitHubAudit,
  parseCIEvidence,
  generateCIWorkflowYaml,
  type AutomatedAuditReport,
  type AutomatedCheckResult,
} from '../services/githubAudit';
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

  // Import state
  const [jsonInput, setJsonInput] = useState('');
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Results display state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);

  const report: AutomatedAuditReport | null = latestAuditReport;

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error during scan';
      setErrorMessage(msg);
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
      setImportNotice(`Loaded evidence report for ${generatedReport.repository}!`);
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
          setImportNotice(`Loaded evidence from ${file.name} for ${generatedReport.repository}!`);
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
      `Successfully signed off ${verifiedTrackerCount} tracker rows and ${verifiedChecklistCount} guide practices using automated evidence!`,
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
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="border border-edge bg-surface p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Automated Repository Verification &amp; GitHub Audit
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Connect your codebase to automatically inspect branch protections, CI pipelines, secret scanners,
              lockfiles, and IaC definitions against the DevOps Guide standards.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 border border-edge bg-sunken p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode('live')}
              className={`px-3 py-1 font-medium transition-colors ${
                mode === 'live'
                  ? 'bg-surface font-semibold text-ink shadow-xs'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              Live Scan
            </button>
            <button
              type="button"
              onClick={() => setMode('import')}
              className={`px-3 py-1 font-medium transition-colors ${
                mode === 'import'
                  ? 'bg-surface font-semibold text-ink shadow-xs'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              Import CI Evidence
            </button>
            <button
              type="button"
              onClick={() => setMode('workflow')}
              className={`px-3 py-1 font-medium transition-colors ${
                mode === 'workflow'
                  ? 'bg-surface font-semibold text-ink shadow-xs'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              CI Workflow
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: Live API Scan Form */}
      {mode === 'live' && (
        <form onSubmit={handleRunScan} className="border border-edge bg-surface p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="repo-input" className="block text-xs font-semibold uppercase text-ink-muted">
                GitHub Repository (owner/repo)
              </label>
              <input
                id="repo-input"
                type="text"
                required
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="e.g. Binod231/DevOps-Guide-Checklist"
                className="mt-1.5 w-full border border-edge bg-sunken px-3 py-2 text-sm text-ink focus:border-accent focus:outline-hidden"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="token-input" className="block text-xs font-semibold uppercase text-ink-muted">
                  Personal Access Token (Optional for Public / Required for Private)
                </label>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-xs text-accent hover:underline"
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="token-input"
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="github_pat_... (Read-Only Token)"
                className="mt-1.5 w-full border border-edge bg-sunken px-3 py-2 text-sm text-ink font-mono focus:border-accent focus:outline-hidden"
              />
            </div>
          </div>

          <div className="border border-edge bg-sunken/60 p-3 text-xs text-ink-secondary">
            <span className="font-semibold text-ink">🔒 Security Note for Private Repositories:</span> Tokens are
            used strictly in browser memory to query <code className="bg-surface px-1">api.github.com</code> and are
            never stored or sent to any third-party server. Generate a <strong>Fine-Grained Token</strong> with
            read-only permissions (<em>Actions: Read-only, Administration: Read-only, Contents: Read-only</em>).
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={isRunning}
              className="inline-flex items-center gap-2 border border-accent bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
                <>
                  <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  <span>Run Live Repository Audit</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Mode 2: Import CI Evidence JSON */}
      {mode === 'import' && (
        <form onSubmit={handleImportJson} className="border border-edge bg-surface p-5 space-y-4">
          <p className="text-xs text-ink-secondary">
            If your private repository runs the automated audit in GitHub Actions CI, you can drop or paste the
            generated <code className="bg-sunken px-1">devops-audit-evidence.json</code> artifact below.
          </p>

          <div className="flex flex-col gap-2">
            <label htmlFor="evidence-file" className="text-xs font-semibold uppercase text-ink-muted">
              Upload JSON Evidence File
            </label>
            <input
              id="evidence-file"
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="border border-edge bg-sunken p-2 text-sm text-ink file:mr-3 file:border-0 file:bg-surface file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink hover:file:bg-accent hover:file:text-white"
            />
          </div>

          <div>
            <label htmlFor="evidence-paste" className="block text-xs font-semibold uppercase text-ink-muted">
              Or Paste Evidence JSON Content
            </label>
            <textarea
              id="evidence-paste"
              rows={6}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"repository": "org/repo", "results": [...]}'
              className="mt-1.5 w-full border border-edge bg-sunken p-3 font-mono text-xs text-ink focus:border-accent focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="border border-accent bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Parse &amp; Load Evidence
            </button>
            {importNotice && <span className="text-xs font-medium text-emerald-600">{importNotice}</span>}
          </div>
        </form>
      )}

      {/* Mode 3: CI Workflow Template */}
      {mode === 'workflow' && (
        <div className="border border-edge bg-surface p-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Drop-in GitHub Actions Audit Workflow
              </h3>
              <p className="text-xs text-ink-secondary">
                Add this file to your private repository as{' '}
                <code className="bg-sunken px-1 text-ink">.github/workflows/devops-readiness-audit.yml</code>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyWorkflow}
                className="border border-edge bg-sunken px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface"
              >
                {copiedWorkflow ? '✓ Copied!' : 'Copy Workflow YAML'}
              </button>
              <button
                type="button"
                onClick={handleDownloadWorkflow}
                className="border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
              >
                Download .yml
              </button>
            </div>
          </div>

          <div className="relative max-h-96 overflow-y-auto border border-edge bg-sunken p-4 font-mono text-xs text-ink">
            <pre className="whitespace-pre">{workflowYaml}</pre>
          </div>
        </div>
      )}

      {/* Errors or Notices */}
      {errorMessage && (
        <div className="border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <strong>Audit Error:</strong> {errorMessage}
        </div>
      )}

      {appliedNotice && (
        <div className="border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <strong>Verification Applied:</strong> {appliedNotice}
        </div>
      )}

      {/* Audit Report Presentation */}
      {report && (
        <div className="border border-edge bg-surface space-y-5 p-5">
          {/* Executive Summary Banner */}
          <div className="flex flex-col gap-4 border-b border-edge pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                  Audited Target:
                </span>
                <span className="font-mono text-sm font-semibold text-ink">
                  {report.repository}
                </span>
                <span className="border border-edge bg-sunken px-2 py-0.5 text-xs text-ink-secondary">
                  {report.scannerMode === 'live_api' ? 'Live GitHub API' : 'CI Evidence Artifact'}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Audit executed: {new Date(report.scannedAt).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums text-ink">
                  {report.scorePercentage}%
                </div>
                <div className="text-xs font-medium text-ink-muted">
                  Readiness Compliance
                </div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleApplyVerifications}
                  className="border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                >
                  Apply Passing Controls to Portal
                </button>
              )}
            </div>
          </div>

          {/* Stats Badges & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`border px-2.5 py-1 text-xs font-medium ${
                  statusFilter === 'all'
                    ? 'border-ink bg-ink text-white dark:bg-white dark:text-ink'
                    : 'border-edge bg-sunken text-ink hover:bg-surface'
                }`}
              >
                All Controls ({report.totalEvaluated})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pass')}
                className={`border px-2.5 py-1 text-xs font-medium ${
                  statusFilter === 'pass'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                }`}
              >
                Passed ({report.passedCount})
              </button>
              {report.failedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('fail')}
                  className={`border px-2.5 py-1 text-xs font-medium ${
                    statusFilter === 'fail'
                      ? 'border-rose-600 bg-rose-600 text-white'
                      : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}
                >
                  Failed ({report.failedCount})
                </button>
              )}
              {report.warnCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('warn')}
                  className={`border px-2.5 py-1 text-xs font-medium ${
                    statusFilter === 'warn'
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                  }`}
                >
                  Warnings ({report.warnCount})
                </button>
              )}
            </div>
          </div>

          {/* Itemized Results */}
          <div className="divide-y divide-edge border border-edge">
            {filteredResults.map((item) => (
              <div key={item.id} className="p-4 transition-colors hover:bg-sunken/40">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-ink-muted">
                      {item.id}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                      [{item.category}]
                    </span>
                    <h4 className="text-sm font-semibold text-ink">
                      {item.title}
                    </h4>
                  </div>
                  <div>
                    {item.status === 'pass' && (
                      <span className="inline-flex items-center gap-1 border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        ✓ PASSED
                      </span>
                    )}
                    {item.status === 'fail' && (
                      <span className="inline-flex items-center gap-1 border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                        ✕ FAILED
                      </span>
                    )}
                    {item.status === 'warn' && (
                      <span className="inline-flex items-center gap-1 border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        ⚠ WARNING
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 space-y-1 text-xs">
                  <p className="font-medium text-ink">{item.summary}</p>
                  <p className="text-ink-secondary">
                    <strong className="text-ink-muted">Evidence:</strong> {item.evidence}
                  </p>
                  <p className="text-ink-muted italic">
                    <strong>DevOps Gate:</strong> {item.verificationGate}
                  </p>
                  {item.details && item.details.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-ink-secondary space-y-0.5">
                      {item.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  )}
                  {item.url && (
                    <div className="pt-1">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        Inspect on GitHub &rarr;
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
