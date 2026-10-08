import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './renderRoute';
import { ROUTES, guide } from '../content/registry';
import { ADMIN_PASSWORD, ADMIN_USERNAME } from '../state/authContext';

const FIRST_CATEGORY = guide.categories[0]!;

describe('Admin and Normal User Authentication & Role System', () => {
  it('defaults to normal user role in a clean session when specified', () => {
    renderApp(ROUTES.overview, 'user');
    // Header should offer the Admin Login button
    expect(screen.getByRole('button', { name: /log in as administrator/i })).toBeInTheDocument();
  });

  it('allows logging in as admin through the AuthDialog', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.overview, 'user');

    // Click Admin Login in Header
    const loginButton = screen.getByRole('button', { name: /log in as administrator/i });
    await user.click(loginButton);

    // Dialog should open
    const dialog = screen.getByRole('dialog', { name: /admin login/i });
    expect(dialog).toBeInTheDocument();

    // Type credentials
    const usernameInput = within(dialog).getByLabelText(/username/i);
    const passwordInput = within(dialog).getByLabelText(/password/i);

    await user.clear(usernameInput);
    await user.type(usernameInput, ADMIN_USERNAME);
    await user.type(passwordInput, ADMIN_PASSWORD);

    // Submit
    await user.click(within(dialog).getByRole('button', { name: /log in as admin/i }));

    // Status message should indicate success
    expect(within(dialog).getByRole('status')).toHaveTextContent(/successfully authenticated/i);
  });

  it('displays an error on wrong password', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.overview, 'user');

    await user.click(screen.getByRole('button', { name: /log in as administrator/i }));
    const dialog = screen.getByRole('dialog', { name: /admin login/i });

    const passwordInput = within(dialog).getByLabelText(/password/i);
    await user.type(passwordInput, 'wrongpassword');

    await user.click(within(dialog).getByRole('button', { name: /log in as admin/i }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent(/invalid credentials/i);
  });

  it('allows switching from admin back to normal user', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.overview, 'admin');

    // Header shows Admin active
    const adminButton = screen.getByRole('button', { name: /administrator active/i });
    await user.click(adminButton);

    const dialog = screen.getByRole('dialog', { name: /administrator session/i });
    expect(dialog).toBeInTheDocument();

    // Switch to normal user
    await user.click(within(dialog).getByRole('button', { name: /switch to normal user/i }));

    expect(within(dialog).getByRole('status')).toHaveTextContent(/switched to normal user/i);
  });
});

describe('Checklist Permissions — Enabled for Normal Users Too', () => {
  it('allows normal user to toggle guide checklist checkboxes', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id), 'user');
    const box = within(screen.getByRole('main')).getAllByRole('checkbox')[0]!;

    expect(box).not.toBeDisabled();
    await user.click(box);
    expect(box).toBeChecked();
    await user.click(box);
    expect(box).not.toBeChecked();
  });

  it('allows normal user to toggle implementation order checkboxes', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.implementationOrder, 'user');
    const box = within(screen.getByRole('main')).getAllByRole('checkbox')[0]!;

    expect(box).not.toBeDisabled();
    await user.click(box);
    expect(box).toBeChecked();
  });

  it('allows normal user to toggle production readiness criteria checkboxes', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.productionReadiness, 'user');
    const box = within(screen.getByRole('main')).getAllByRole('checkbox')[0]!;

    expect(box).not.toBeDisabled();
    await user.click(box);
    expect(box).toBeChecked();
  });
});

describe('Role-Based Permissions — Normal User on Tracker & Notes', () => {
  it('does not display admin login banner or mode indicator to normal user on tracker', () => {
    renderApp(ROUTES.tracker, 'user');
    expect(screen.queryByText(/normal user mode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/admin mode/i)).not.toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByRole('button', { name: /admin/i })).not.toBeInTheDocument();
  });

  it('does not display export and import panel to normal user', () => {
    renderApp(ROUTES.tracker, 'user');
    expect(screen.queryByRole('heading', { name: /export and import/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export state \(json\)/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /import state \(json\)/i })).not.toBeInTheDocument();
  });

  it('does not display row CRUD buttons (+ Add Row, Edit, Delete) to normal user', () => {
    renderApp(ROUTES.tracker, 'user');
    expect(screen.queryByRole('button', { name: /\+ add tracker row/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit row /i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^delete row /i })).not.toBeInTheDocument();
  });

  it('locks Verified By, Target Date (Verify Deadline), Verified, and Evidence on tracker for normal user', () => {
    renderApp(ROUTES.tracker, 'user');

    // Verified By is disabled
    const verifiedByInputs = screen.getAllByLabelText(/^Verified By for /);
    expect(verifiedByInputs[0]).toBeDisabled();

    // Target Date (Verify Deadline) is disabled
    const targetDateInputs = screen.getAllByLabelText(/^Target Date for /);
    expect(targetDateInputs[0]).toBeDisabled();

    // Verified is disabled
    const verifiedInputs = screen.getAllByLabelText(/^Verified for /);
    expect(verifiedInputs[0]).toBeDisabled();

    // Evidence textarea is disabled
    const evidenceTextareas = screen.getAllByLabelText(/^Evidence for /);
    expect(evidenceTextareas[0]).toBeDisabled();
  });

  it('allows normal user to edit Status, Implementation By, and Notes on tracker', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker, 'user');

    // Status dropdown is enabled
    const statusSelect = screen.getByLabelText('Status for ST-01, SCM & CI/CD');
    expect(statusSelect).not.toBeDisabled();
    await user.selectOptions(statusSelect, 'In Progress');
    expect(statusSelect).toHaveValue('In Progress');

    // Implementation By is enabled
    const implInput = screen.getByLabelText('Implementation By for ST-01, SCM & CI/CD');
    expect(implInput).not.toBeDisabled();
    await user.type(implInput, 'Dev Team');
    expect(implInput).toHaveValue('Dev Team');

    // Notes textarea is enabled
    const notesTextarea = screen.getByLabelText('Notes for ST-01');
    expect(notesTextarea).not.toBeDisabled();
    await user.type(notesTextarea, 'Working on GitHub Actions workflow');
    expect(notesTextarea).toHaveValue('Working on GitHub Actions workflow');
  });

  it('allows normal user full write access on the Notes & Decisions page', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.notes, 'user');

    // Note fields are editable
    const noteArea = screen.getByRole('textbox', { name: 'Architecture Notes' });
    expect(noteArea).not.toBeDisabled();
    await user.type(noteArea, 'Decision to use AWS EKS');
    expect(noteArea).toHaveValue('Decision to use AWS EKS');

    // Open Issues checkboxes and text inputs are editable
    const issueCheckbox = screen.getByRole('checkbox', { name: /open issue 1 complete/i });
    expect(issueCheckbox).not.toBeDisabled();
    await user.click(issueCheckbox);
    expect(issueCheckbox).toBeChecked();

    const issueInput = screen.getByLabelText('Open issue 1');
    expect(issueInput).not.toBeDisabled();
    await user.type(issueInput, 'Fix IAM role policy');
    expect(issueInput).toHaveValue('Fix IAM role policy');

    // Useful links are editable
    const linkInput = screen.getByLabelText(/^repository$/i);
    expect(linkInput).not.toBeDisabled();
    await user.type(linkInput, 'https://github.com/my-org/repo');
    expect(linkInput).toHaveValue('https://github.com/my-org/repo');
  });
});

describe('Role-Based Permissions — Admin User & Full CRUD', () => {
  it('allows admin to edit all tracker fields including Verified By, Target Date, and Evidence', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker, 'admin');

    const verifiedByInput = screen.getByLabelText('Verified By for ST-01, SCM & CI/CD');
    expect(verifiedByInput).not.toBeDisabled();
    await user.type(verifiedByInput, 'DevOps Lead');
    expect(verifiedByInput).toHaveValue('DevOps Lead');

    const targetDateInput = screen.getByLabelText('Target Date for ST-01, SCM & CI/CD');
    expect(targetDateInput).not.toBeDisabled();
    await user.type(targetDateInput, '2026-06-01');
    expect(targetDateInput).toHaveValue('2026-06-01');

    const evidenceTextarea = screen.getByLabelText('Evidence for ST-01');
    expect(evidenceTextarea).not.toBeDisabled();
    await user.type(evidenceTextarea, 'Audit report URL');
    expect(evidenceTextarea).toHaveValue('Audit report URL');
  });

  it('enables export and import panel for admin', () => {
    renderApp(ROUTES.tracker, 'admin');

    expect(screen.getByRole('heading', { name: /export and import/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export state \(json\)/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /export tracker \(csv\)/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /import state \(json\)/i })).not.toBeDisabled();
  });

  it('allows admin to create a new row via modal (Create)', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker, 'admin');

    // Click + Add Tracker Row
    const addButton = screen.getByRole('button', { name: /\+ add tracker row/i });
    expect(addButton).toBeInTheDocument();
    await user.click(addButton);

    // Modal opens
    const modal = screen.getByRole('dialog', { name: /add new tracker item/i });
    expect(modal).toBeInTheDocument();

    // Fill form
    const itemInput = within(modal).getByLabelText(/implementation item/i);
    await user.type(itemInput, 'Automated Cost Anomaly Detection');

    const implByInput = within(modal).getByLabelText(/implementation by/i);
    await user.type(implByInput, 'FinOps Team');

    // Save
    await user.click(within(modal).getByRole('button', { name: /create item/i }));

    // Modal closes and item appears
    expect(screen.getByText('Automated Cost Anomaly Detection')).toBeInTheDocument();
  });

  it('allows admin to edit an existing row via modal (Update)', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker, 'admin');

    const editButton = screen.getByRole('button', { name: 'Edit row ST-01' });
    await user.click(editButton);

    const modal = screen.getByRole('dialog', { name: /edit tracker item/i });
    expect(modal).toBeInTheDocument();

    const itemInput = within(modal).getByLabelText(/implementation item/i);
    await user.clear(itemInput);
    await user.type(itemInput, 'Branch Protection & Signed Commits');

    await user.click(within(modal).getByRole('button', { name: /save changes/i }));

    expect(screen.getByText('Branch Protection & Signed Commits')).toBeInTheDocument();
  });

  it('allows admin to delete and restore rows (Delete & Restore)', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker, 'admin');

    expect(screen.getByText('Branch Protections & Single PR Approvals')).toBeInTheDocument();

    // Click Delete on ST-01
    const deleteButton = screen.getByRole('button', { name: 'Delete row ST-01' });
    await user.click(deleteButton);

    // Row ST-01 is removed
    expect(screen.queryByText('Branch Protections & Single PR Approvals')).not.toBeInTheDocument();

    // "Restore Deleted Rows" button appears
    const restoreButton = screen.getByRole('button', { name: /restore deleted rows/i });
    expect(restoreButton).toBeInTheDocument();

    // Restore
    await user.click(restoreButton);
    expect(screen.getByText('Branch Protections & Single PR Approvals')).toBeInTheDocument();
  });

  it('allows admin full CRUD on Guide practices (Add, Edit, Delete, Restore)', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id), 'admin');

    // Add practice button is present
    const addPracticeButton = screen.getByRole('button', { name: /\+ add practice/i });
    expect(addPracticeButton).toBeInTheDocument();

    // Open Add Practice modal
    await user.click(addPracticeButton);
    const modal = screen.getByRole('dialog', { name: /add new practice/i });
    expect(modal).toBeInTheDocument();

    await user.type(
      within(modal).getByLabelText(/practice title \/ heading/i),
      'Automated Vulnerability Scanning',
    );
    await user.type(
      within(modal).getByLabelText(/description/i),
      'Scans all container images in CI before deployment.',
    );
    await user.click(within(modal).getByRole('button', { name: /create practice/i }));

    // Added practice appears
    expect(screen.getByText('Automated Vulnerability Scanning')).toBeInTheDocument();

    // Edit an existing practice
    const firstPractice = FIRST_CATEGORY.practices[0]!;
    const editBtn = screen.getByRole('button', { name: `Edit practice ${firstPractice.heading}` });
    await user.click(editBtn);

    const editModal = screen.getByRole('dialog', { name: /edit practice/i });
    expect(editModal).toBeInTheDocument();

    const descInput = within(editModal).getByLabelText(/description/i);
    await user.clear(descInput);
    await user.type(descInput, 'Updated custom description for practice.');
    await user.click(within(editModal).getByRole('button', { name: /save changes/i }));

    expect(screen.getByText('Updated custom description for practice.')).toBeInTheDocument();

    // Delete a practice
    const deleteBtn = screen.getByRole('button', { name: `Delete practice ${firstPractice.heading}` });
    await user.click(deleteBtn);

    // Restore button appears and restores it
    const restoreBtn = screen.getByRole('button', { name: /restore deleted practices/i });
    expect(restoreBtn).toBeInTheDocument();
    await user.click(restoreBtn);
  });

  it('does not display practice CRUD buttons to normal users', () => {
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id), 'user');
    expect(screen.queryByRole('button', { name: /\+ add practice/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit practice /i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^delete practice /i })).not.toBeInTheDocument();
  });

  it('allows admin full CRUD on Implementation Order checklist', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.implementationOrder, 'admin');

    // Admin sees + Add Item button
    const addButtons = screen.getAllByRole('button', { name: /\+ add item/i });
    expect(addButtons.length).toBeGreaterThan(0);

    // Add item to first phase
    await user.click(addButtons[0]!);
    const modal = screen.getByRole('dialog', { name: /add item to phase 1/i });
    expect(modal).toBeInTheDocument();

    const textInput = within(modal).getByLabelText(/checklist item description/i);
    await user.type(textInput, 'Enforce strict TLS 1.3 across all load balancers');
    await user.click(within(modal).getByRole('button', { name: /save item/i }));

    expect(screen.getByText('Enforce strict TLS 1.3 across all load balancers')).toBeInTheDocument();

    // Edit item
    const editBtn = screen.getByRole('button', {
      name: 'Edit item Enforce strict TLS 1.3 across all load balancers',
    });
    await user.click(editBtn);

    const editModal = screen.getByRole('dialog', { name: /edit implementation item/i });
    const editText = within(editModal).getByLabelText(/checklist item description/i);
    await user.clear(editText);
    await user.type(editText, 'Enforce strict TLS 1.3 and mTLS on internal mesh');
    await user.click(within(editModal).getByRole('button', { name: /save item/i }));

    expect(screen.getByText('Enforce strict TLS 1.3 and mTLS on internal mesh')).toBeInTheDocument();

    // Delete item
    const deleteBtn = screen.getByRole('button', {
      name: 'Delete item Enforce strict TLS 1.3 and mTLS on internal mesh',
    });
    await user.click(deleteBtn);
    expect(screen.queryByText('Enforce strict TLS 1.3 and mTLS on internal mesh')).not.toBeInTheDocument();
  });

  it('allows admin full CRUD on Production Readiness criteria', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.productionReadiness, 'admin');

    const addCriterionBtn = screen.getByRole('button', { name: /\+ add criterion/i });
    expect(addCriterionBtn).toBeInTheDocument();

    await user.click(addCriterionBtn);
    const modal = screen.getByRole('dialog', { name: /add new readiness criterion/i });
    expect(modal).toBeInTheDocument();

    const input = within(modal).getByLabelText(/checklist item description/i);
    await user.type(input, 'Disaster Recovery RTO under 15 minutes validated in live fire drill');
    await user.click(within(modal).getByRole('button', { name: /save item/i }));

    expect(
      screen.getByText('Disaster Recovery RTO under 15 minutes validated in live fire drill'),
    ).toBeInTheDocument();

    // Edit criterion
    const editBtn = screen.getByRole('button', { name: 'Edit criterion 1' });
    await user.click(editBtn);

    const editModal = screen.getByRole('dialog', { name: /edit readiness criterion/i });
    const editInput = within(editModal).getByLabelText(/checklist item description/i);
    await user.clear(editInput);
    await user.type(editInput, 'Infrastructure is provisioned via OpenTofu with locking');
    await user.click(within(editModal).getByRole('button', { name: /save item/i }));

    expect(
      screen.getByText('Infrastructure is provisioned via OpenTofu with locking'),
    ).toBeInTheDocument();
  });
});
