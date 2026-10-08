import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider, ADMIN_PASSWORD } from '../state/authContext';
import { PortalStateProvider, usePortalState } from '../state/PortalStateProvider';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { ROUTES } from '../content/registry';

function renderDashboard(initialRole: 'admin' | 'user' = 'admin', initialRoute = '/admin') {
  return render(
    <AuthProvider initialRole={initialRole}>
      <PortalStateProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path={ROUTES.adminDashboard} element={<AdminDashboardPage />} />
          </Routes>
        </MemoryRouter>
      </PortalStateProvider>
    </AuthProvider>,
  );
}

describe('Admin Verification & Acknowledgement Dashboard', () => {
  it('blocks non-admin users with an access required notice', () => {
    renderDashboard('user');

    expect(screen.getByText('Administrator Access Required')).toBeInTheDocument();
    expect(
      screen.getByText(/dashboard is reserved for portal administrators/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('allows logging into admin from the restriction prompt', () => {
    renderDashboard('user');

    const passwordInput = screen.getByLabelText(/admin password/i);
    const loginButton = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(passwordInput, { target: { value: ADMIN_PASSWORD } });
    fireEvent.click(loginButton);

    expect(
      screen.getByRole('heading', {
        name: /Verification & Acknowledgement Dashboard/i,
      }),
    ).toBeInTheDocument();
  });

  it('displays metric cards and filter tabs for admin', () => {
    renderDashboard('admin');

    expect(
      screen.getByRole('heading', {
        name: /Verification & Acknowledgement Dashboard/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/Total Items/i)).toBeInTheDocument();
    expect(screen.getAllByText(/User Completed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pending Verification/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Verified by Admin/i)).toBeInTheDocument();
    expect(screen.getByText(/Verification Rate/i)).toBeInTheDocument();

    // Tabs
    expect(screen.getByRole('button', { name: /pending verification/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verified/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all user completed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all inventory/i })).toBeInTheDocument();
  });

  it('shows all inventory items when selecting the all inventory tab', () => {
    renderDashboard('admin');

    const allInventoryTab = screen.getByRole('button', { name: /all inventory/i });
    fireEvent.click(allInventoryTab);

    // Tracker item, guide practice, and phase item should appear
    expect(screen.getByText(/ST-01: Branch Protections/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Branch Protections & Single PR Approvals/i).length).toBeGreaterThan(0);
  });

  it('allows searching items by title and section', () => {
    renderDashboard('admin');

    const allInventoryTab = screen.getByRole('button', { name: /all inventory/i });
    fireEvent.click(allInventoryTab);

    const searchInput = screen.getByPlaceholderText(/search items, users, notes/i);
    fireEvent.change(searchInput, { target: { value: 'Container Vulnerability' } });

    expect(screen.getByText(/Container Vulnerability/i)).toBeInTheDocument();
    expect(screen.queryByText(/Branch Protections & Single PR Approvals/i)).not.toBeInTheDocument();
  });

  it('filters items by section dropdown', () => {
    renderDashboard('admin');

    const allInventoryTab = screen.getByRole('button', { name: /all inventory/i });
    fireEvent.click(allInventoryTab);

    const sectionSelect = screen.getByRole('combobox', { name: /filter by section/i });
    fireEvent.change(sectionSelect, { target: { value: 'readiness' } });

    expect(screen.getAllByText(/Production Readiness Gate/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ST-01/i)).not.toBeInTheDocument();
  });

  it('aggregates completed checklist items with user acknowledgement and allows admin verification', () => {
    function TestSetup() {
      const { setChecked, setChecklistAcknowledgement } = usePortalState();
      return (
        <button
          type="button"
          onClick={() => {
            setChecked('branch-protections-single-pr-approvals', true);
            setChecklistAcknowledgement('branch-protections-single-pr-approvals', {
              completedBy: 'Jane DevOps',
              completedAt: '2026-10-08T10:00:00.000Z',
              notes: 'Implemented branch protection rules in GitHub',
            });
          }}
        >
          Mark Completed
        </button>
      );
    }

    render(
      <AuthProvider initialRole="admin">
        <PortalStateProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <TestSetup />
            <AdminDashboardPage />
          </MemoryRouter>
        </PortalStateProvider>
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark Completed' }));

    // The item should appear under Pending Verification
    expect(screen.getByText('Jane DevOps')).toBeInTheDocument();
    expect(screen.getByText(/Implemented branch protection rules in GitHub/i)).toBeInTheDocument();
    expect(screen.getByText('Pending Admin Verification')).toBeInTheDocument();

    // Admin verifies the item
    const verifyButton = screen.getByRole('button', { name: /Verify & Sign Off/i });
    fireEvent.click(verifyButton);

    // Switch to Verified tab to view the verified item
    fireEvent.click(screen.getByRole('button', { name: (n) => n.startsWith('Verified') }));
    expect(screen.getByText(/Verified by Administrator/i)).toBeInTheDocument();

    // Revoke verification
    const revokeButton = screen.getByRole('button', { name: /Revoke Verification/i });
    fireEvent.click(revokeButton);

    // Moves back to Pending Admin Verification tab
    fireEvent.click(screen.getByRole('button', { name: (n) => n.startsWith('Pending Verification') }));
    expect(screen.getByText('Pending Admin Verification')).toBeInTheDocument();
  });

  it('aggregates tracker rows marked with implementationBy and allows admin verification', () => {
    function TrackerSetup() {
      const { setTrackerField } = usePortalState();
      return (
        <button
          type="button"
          onClick={() => {
            setTrackerField('st-01--scm-ci-cd', 'implementationBy', 'John Engineer');
            setTrackerField('st-01--scm-ci-cd', 'notes', 'GitHub Enterprise policy enforced');
          }}
        >
          Implement Tracker Row
        </button>
      );
    }

    render(
      <AuthProvider initialRole="admin">
        <PortalStateProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <TrackerSetup />
            <AdminDashboardPage />
          </MemoryRouter>
        </PortalStateProvider>
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Implement Tracker Row' }));

    expect(screen.getByText('John Engineer')).toBeInTheDocument();
    expect(screen.getByText(/GitHub Enterprise policy enforced/i)).toBeInTheDocument();

    const verifyButton = screen.getByRole('button', { name: /Verify & Sign Off/i });
    fireEvent.click(verifyButton);

    // Switch to Verified tab
    fireEvent.click(screen.getByRole('button', { name: (n) => n.startsWith('Verified') }));
    expect(screen.getByText(/Verified by Administrator/i)).toBeInTheDocument();
  });

  it('supports bulk verification of all visible pending items', () => {
    function MultiItemSetup() {
      const { setChecked, setChecklistAcknowledgement } = usePortalState();
      return (
        <button
          type="button"
          onClick={() => {
            setChecked('branch-protections-single-pr-approvals', true);
            setChecked('automated-ci-pipelines-for-main-pull-requests', true);
            setChecklistAcknowledgement('branch-protections-single-pr-approvals', {
              completedBy: 'Alice',
              completedAt: '2026-10-08',
            });
            setChecklistAcknowledgement('automated-ci-pipelines-for-main-pull-requests', {
              completedBy: 'Bob',
              completedAt: '2026-10-08',
            });
          }}
        >
          Setup Multiple
        </button>
      );
    }

    render(
      <AuthProvider initialRole="admin">
        <PortalStateProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <MultiItemSetup />
            <AdminDashboardPage />
          </MemoryRouter>
        </PortalStateProvider>
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Setup Multiple' }));

    const bulkButton = screen.getByRole('button', { name: /Verify All Visible Pending/i });
    fireEvent.click(bulkButton);

    expect(screen.getByText(/Successfully verified 2 pending items/i)).toBeInTheDocument();
  });

  describe('Cognito User Management tab', () => {
    it('masks the root admin password and prevents modifying root admin', () => {
      renderDashboard('admin');

      // Click on Cognito User Management tab
      const cognitoTab = screen.getByRole('button', { name: (n) => n.startsWith('Cognito User Management') });
      fireEvent.click(cognitoTab);

      // Check root admin password is protected and NOT in cleartext
      expect(screen.getByText('•••••••• (Protected in .env)')).toBeInTheDocument();
      expect(screen.queryByText(ADMIN_PASSWORD)).not.toBeInTheDocument();

      // Check "Environment Protected" badge and notice is shown
      expect(screen.getByText('Environment Protected')).toBeInTheDocument();
      expect(screen.getByText('Admin credentials set via .env')).toBeInTheDocument();

      // Verify that delete, change password or edit buttons are not rendered for root admin
      expect(screen.queryByRole('button', { name: /Change Password for admin/i })).not.toBeInTheDocument();
    });

    it('supports full CRUD: create, change password, edit role, and delete user', async () => {
      renderDashboard('admin');

      // Click on Cognito User Management tab
      const cognitoTab = screen.getByRole('button', { name: (n) => n.startsWith('Cognito User Management') });
      fireEvent.click(cognitoTab);

      // --- CREATE USER ---
      const usernameInput = screen.getByLabelText(/User ID \/ Username:/i);
      const emailInput = screen.getByLabelText(/Email Address:/i);
      const createUserBtn = screen.getByRole('button', { name: /Create User & Generate Credentials/i });

      fireEvent.change(usernameInput, { target: { value: 'alice.engineer' } });
      fireEvent.change(emailInput, { target: { value: 'alice@company.com' } });
      fireEvent.click(createUserBtn);

      // Verify user created and rendered
      await waitFor(() => {
        expect(screen.getByText(/User "alice\.engineer" created successfully/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/alice@company\.com/i)).toBeInTheDocument();

      // --- CHANGE PASSWORD ---
      const changePwBtn = screen.getAllByRole('button', { name: /Change Password/i })[0]!;
      fireEvent.click(changePwBtn);

      // Modal appears
      expect(screen.getByRole('heading', { name: /Change Password for alice\.engineer/i })).toBeInTheDocument();
      const newPwInput = screen.getByLabelText(/New Password:/i);
      fireEvent.change(newPwInput, { target: { value: 'AliceNewSecret123!' } });
      const savePwBtn = screen.getByRole('button', { name: /Save New Password/i });
      fireEvent.click(savePwBtn);

      // Modal closed, new password displayed
      expect(screen.getByText('AliceNewSecret123!')).toBeInTheDocument();

      // --- EDIT USER DETAILS ---
      const editBtn = screen.getAllByRole('button', { name: /^Edit$/i })[0]!;
      fireEvent.click(editBtn);

      expect(screen.getByRole('heading', { name: /Edit User: alice\.engineer/i })).toBeInTheDocument();
      const editEmailInput = screen.getByDisplayValue('alice@company.com');
      fireEvent.change(editEmailInput, { target: { value: 'alice.updated@company.com' } });
      const saveDetailsBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveDetailsBtn);

      // Modal closed, updated email displayed
      expect(screen.getByText('alice.updated@company.com')).toBeInTheDocument();

      // --- DELETE USER ---
      const deleteBtn = screen.getAllByRole('button', { name: /^Delete$/i })[0]!;
      fireEvent.click(deleteBtn);

      expect(screen.getByRole('heading', { name: /Confirm User Deletion/i })).toBeInTheDocument();
      // Click confirm Delete User inside the dialog
      const confirmDeleteBtn = screen.getByRole('button', { name: /^Delete User$/i });
      fireEvent.click(confirmDeleteBtn);

      // Alice should no longer be in the list
      expect(screen.queryByText('alice.updated@company.com')).not.toBeInTheDocument();
    });
  });
});

