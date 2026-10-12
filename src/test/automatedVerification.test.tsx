import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../state/authContext';
import { PortalStateProvider } from '../state/PortalStateProvider';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { ROUTES } from '../content/registry';
import { findViolations, describeViolations } from './axe';

function renderDashboard(initialRole: 'admin' | 'user' = 'admin') {
  return render(
    <AuthProvider initialRole={initialRole}>
      <PortalStateProvider>
        <MemoryRouter initialEntries={[ROUTES.adminDashboard]}>
          <Routes>
            <Route path={ROUTES.adminDashboard} element={<AdminDashboardPage />} />
          </Routes>
        </MemoryRouter>
      </PortalStateProvider>
    </AuthProvider>,
  );
}

describe('Automated Repository Verification & GitHub CI Integration', () => {
  it('renders the Automated Repo Verification tab on Admin Dashboard', () => {
    renderDashboard('admin');

    const tabButton = screen.getByRole('button', { name: /automated repo verification/i });
    expect(tabButton).toBeInTheDocument();

    fireEvent.click(tabButton);

    expect(
      screen.getByText(/Automated Repository Verification/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/GitHub Repository/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run live repository audit/i })).toBeInTheDocument();
  });

  it('switches between Live Scan, Import CI Evidence, and CI Workflow tabs', () => {
    renderDashboard('admin');

    const mainTab = screen.getByRole('button', { name: /automated repo verification/i });
    fireEvent.click(mainTab);

    // Switch to CI Workflow tab
    const workflowSubTab = screen.getByRole('button', { name: /^ci workflow$/i });
    fireEvent.click(workflowSubTab);

    expect(screen.getByText(/GitHub Actions Audit Workflow/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy workflow yaml/i })).toBeInTheDocument();

    // Switch to Import CI Evidence tab
    const importSubTab = screen.getByRole('button', { name: /import ci evidence/i });
    fireEvent.click(importSubTab);

    expect(screen.getByLabelText(/Upload JSON Evidence File/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /parse & load evidence/i })).toBeInTheDocument();
  });

  it('imports valid CI evidence and applies verifications to portal state', async () => {
    renderDashboard('admin');

    const mainTab = screen.getByRole('button', { name: /automated repo verification/i });
    fireEvent.click(mainTab);

    const importSubTab = screen.getByRole('button', { name: /import ci evidence/i });
    fireEvent.click(importSubTab);

    const sampleEvidence = JSON.stringify({
      repository: 'test-org/private-repo',
      scannedAt: '2026-10-12T12:00:00Z',
      scannerMode: 'ci_artifact',
      passedCount: 2,
      failedCount: 0,
      warnCount: 0,
      totalEvaluated: 2,
      scorePercentage: 100,
      results: [
        {
          id: 'ST-01',
          practiceId: 'branch-protections-single-pr-approvals',
          rowKey: 'st-01--scm-ci-cd',
          title: 'Branch Protections & Single PR Approvals',
          category: 'SCM & CI/CD',
          verificationGate: 'PR required',
          status: 'pass',
          summary: 'Branch protection enforced',
          evidence: 'Verified in GitHub CI runner',
        },
        {
          id: 'ST-02',
          practiceId: 'automated-ci-pipelines-for-main-pull-requests',
          rowKey: 'st-02--scm-ci-cd',
          title: 'Automated CI Pipelines for Main & PRs',
          category: 'SCM & CI/CD',
          verificationGate: 'Tests passing',
          status: 'pass',
          summary: 'CI workflow passing',
          evidence: 'CI pipeline succeeded on main',
        },
      ],
    });

    const textarea = screen.getByLabelText(/paste evidence json content/i);
    fireEvent.change(textarea, { target: { value: sampleEvidence } });

    const parseBtn = screen.getByRole('button', { name: /parse & load evidence/i });
    fireEvent.click(parseBtn);

    expect(screen.getByText('test-org/private-repo')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Branch protection enforced')).toBeInTheDocument();

    // Click "Apply Passing Controls to Portal"
    const applyBtn = screen.getByRole('button', { name: /apply passing controls to portal/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Successfully signed off/i)).toBeInTheDocument();
    });
  });

  it('has zero axe-core accessibility violations with automated panel open', async () => {
    const { container } = renderDashboard('admin');

    const mainTab = screen.getByRole('button', { name: /automated repo verification/i });
    fireEvent.click(mainTab);

    const violations = await findViolations(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });
});
