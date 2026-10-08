import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/authContext';
import { usePortalState } from '../state/PortalStateProvider';
import { guide, checklist, tracker, ROUTES } from '../content/registry';
import { DEFAULT_COGNITO_CONFIG } from '../state/cognitoAuth';

type FilterTab = 'pending' | 'verified' | 'completed' | 'all' | 'users' | 'aws';
type SectionFilter = 'all' | 'tracker' | 'guide' | 'order' | 'readiness' | 'notes';

interface UnifiedDashboardItem {
  id: string;
  kind: 'tracker' | 'checklist';
  section: string;
  sectionCategory: SectionFilter;
  title: string;
  route: string;
  completed: boolean;
  completedBy: string;
  completedAt: string;
  userNotes?: string;
  verified: boolean;
  verifiedBy: string;
  verifiedAt: string;
  verificationNotes?: string;
}

interface ManagedUserAccount {
  username: string;
  email: string;
  password?: string;
  role: 'VerifiedUsers' | 'Admins';
  createdAt: string;
}

const MANAGED_USERS_KEY = 'portal.cognito.managed_users.v1';

export function AdminDashboardPage() {
  const { isAdmin, username, loginAsAdmin, createManagedUser } = useAuth();
  const {
    state,
    allTrackerRows,
    trackerRowState,
    allCategoryPractices,
    allPhaseItems,
    allReadinessCriteria,
    allOpenIssues,
    openIssueValue,
    checklistAcknowledgement,
    checklistVerification,
    verifyChecklistItem,
    unverifyChecklistItem,
    verifyTrackerRow,
    unverifyTrackerRow,
  } = usePortalState();

  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminVerifyNotes, setAdminVerifyNotes] = useState<Record<string, string>>({});
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Quick inline login for convenience if viewer is currently normal user
  const [quickLoginPass, setQuickLoginPass] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // User Management state
  const [managedUsers, setManagedUsers] = useState<ManagedUserAccount[]>(() => {
    try {
      const raw = localStorage.getItem(MANAGED_USERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Ensure root admin password is never stored or shown in plaintext
          return parsed.map((u: ManagedUserAccount) =>
            u.username.toLowerCase() === (import.meta.env.VITE_ADMIN_USERNAME || 'admin').toLowerCase()
              ? { ...u, password: '' }
              : u,
          );
        }
      }
    } catch {
      // Storage unavailable
    }
    return [
      {
        username: import.meta.env.VITE_ADMIN_USERNAME || 'admin',
        email: 'admin@devopsportal.internal',
        password: '',
        role: 'Admins',
        createdAt: '2026-10-08T10:00:00Z',
      },
      {
        username: 'john.devops',
        email: 'john@example.com',
        password: 'Pass392019!',
        role: 'VerifiedUsers',
        createdAt: '2026-10-08T10:05:00Z',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(MANAGED_USERS_KEY, JSON.stringify(managedUsers));
    } catch {
      // Storage unavailable
    }
  }, [managedUsers]);

  const [newUsername, setNewUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('Pass' + Math.floor(100000 + Math.random() * 900000) + '!');
  const [newUserRole, setNewUserRole] = useState<'VerifiedUsers' | 'Admins'>('VerifiedUsers');
  const [userCreateLoading, setUserCreateLoading] = useState(false);
  const [userCreateSuccess, setUserCreateSuccess] = useState<ManagedUserAccount | null>(null);
  const [userCreateError, setUserCreateError] = useState<string | null>(null);

  // Managed users CRUD modal states
  const [passwordModalUser, setPasswordModalUser] = useState<ManagedUserAccount | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showPasswordModalPass, setShowPasswordModalPass] = useState(false);

  const [editUserModal, setEditUserModal] = useState<ManagedUserAccount | null>(null);
  const [editEmailInput, setEditEmailInput] = useState('');
  const [editRoleInput, setEditRoleInput] = useState<'VerifiedUsers' | 'Admins'>('VerifiedUsers');

  const [deleteModalUser, setDeleteModalUser] = useState<ManagedUserAccount | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Aggregate all items across all sections of the portal
  const allItems = useMemo<UnifiedDashboardItem[]>(() => {
    const list: UnifiedDashboardItem[] = [];

    // 1. Implementation Tracker Rows
    const trackerRows = allTrackerRows(tracker.rows);
    for (const row of trackerRows) {
      const rState = trackerRowState(row.rowKey);
      const rowStatus = rState.status ?? row.status ?? '';
      const implBy = rState.implementationBy ?? row.implementationBy ?? '';
      const isComplete =
        rowStatus.toLowerCase().includes('complete') ||
        rowStatus.toLowerCase().includes('implemented') ||
        Boolean(implBy.trim());
      const isVerified = (rState.verified ?? row.verified)?.toLowerCase() === 'yes';
      const verBy = rState.verifiedBy ?? row.verifiedBy ?? '';

      list.push({
        id: `tracker-${row.rowKey}`,
        kind: 'tracker',
        section: `Tracker: ${row.category}`,
        sectionCategory: 'tracker',
        title: `${row.sn || row.rowKey}: ${row.implementationItem}`,
        route: ROUTES.tracker,
        completed: isComplete,
        completedBy: implBy || (isComplete ? 'DevOps Contributor' : ''),
        completedAt: rState.targetDate ?? row.targetDate ?? '',
        userNotes: [rState.notes, rState.evidence ? `Evidence: ${rState.evidence}` : '']
          .filter(Boolean)
          .join(' · '),
        verified: isVerified,
        verifiedBy: verBy,
        verifiedAt: '',
        verificationNotes: '',
      });
    }

    // 2. Guide Practices
    for (const cat of guide.categories) {
      const practices = allCategoryPractices(cat);
      for (const p of practices) {
        const isChecked = Boolean(state.checked[p.id]);
        const ack = checklistAcknowledgement(p.id);
        const ver = checklistVerification(p.id);

        list.push({
          id: p.id,
          kind: 'checklist',
          section: `Guide: ${cat.heading}`,
          sectionCategory: 'guide',
          title: p.heading,
          route: `${ROUTES.guideCategory(cat.id)}#${p.id}`,
          completed: isChecked,
          completedBy: ack?.completedBy ?? (isChecked ? 'DevOps Contributor' : ''),
          completedAt: ack?.completedAt ?? '',
          userNotes: ack?.notes,
          verified: Boolean(ver?.verified),
          verifiedBy: ver?.verifiedBy ?? '',
          verifiedAt: ver?.verifiedAt ?? '',
          verificationNotes: ver?.notes,
        });
      }
    }

    // 3. Implementation Order Phases
    for (const phase of checklist.phases) {
      const items = allPhaseItems(phase);
      for (const item of items) {
        const isChecked = Boolean(state.checked[item.id]);
        const ack = checklistAcknowledgement(item.id);
        const ver = checklistVerification(item.id);

        list.push({
          id: item.id,
          kind: 'checklist',
          section: `Order: ${phase.heading}`,
          sectionCategory: 'order',
          title: item.text,
          route: `${ROUTES.implementationOrder}#${phase.id}`,
          completed: isChecked,
          completedBy: ack?.completedBy ?? (isChecked ? 'DevOps Contributor' : ''),
          completedAt: ack?.completedAt ?? '',
          userNotes: ack?.notes,
          verified: Boolean(ver?.verified),
          verifiedBy: ver?.verifiedBy ?? '',
          verifiedAt: ver?.verifiedAt ?? '',
          verificationNotes: ver?.notes,
        });
      }
    }

    // 4. Production Readiness Gate
    const readinessCriteria = allReadinessCriteria(checklist.readinessGate.criteria);
    for (const crit of readinessCriteria) {
      const isChecked = Boolean(state.checked[crit.id]);
      const ack = checklistAcknowledgement(crit.id);
      const ver = checklistVerification(crit.id);

      list.push({
        id: crit.id,
        kind: 'checklist',
        section: 'Production Readiness Gate',
        sectionCategory: 'readiness',
        title: crit.text,
        route: ROUTES.productionReadiness,
        completed: isChecked,
        completedBy: ack?.completedBy ?? (isChecked ? 'DevOps Contributor' : ''),
        completedAt: ack?.completedAt ?? '',
        userNotes: ack?.notes,
        verified: Boolean(ver?.verified),
        verifiedBy: ver?.verifiedBy ?? '',
        verifiedAt: ver?.verifiedAt ?? '',
        verificationNotes: ver?.notes,
      });
    }

    // 5. Open Issues (Notes & Decisions)
    const openIssues = allOpenIssues(checklist.notes.openIssues);
    for (const issue of openIssues) {
      const isChecked = Boolean(state.checked[issue.id]);
      const issueVal = openIssueValue(issue.id);
      const ack = checklistAcknowledgement(issue.id);
      const ver = checklistVerification(issue.id);

      list.push({
        id: issue.id,
        kind: 'checklist',
        section: 'Notes & Decisions: Open Issues',
        sectionCategory: 'notes',
        title: issueVal || issue.text || `Open Issue ${issue.id}`,
        route: `${ROUTES.notes}#open-issues`,
        completed: isChecked,
        completedBy: ack?.completedBy ?? (isChecked ? 'DevOps Contributor' : ''),
        completedAt: ack?.completedAt ?? '',
        userNotes: ack?.notes,
        verified: Boolean(ver?.verified),
        verifiedBy: ver?.verifiedBy ?? '',
        verifiedAt: ver?.verifiedAt ?? '',
        verificationNotes: ver?.notes,
      });
    }

    return list;
  }, [
    state.checked,
    allTrackerRows,
    trackerRowState,
    allCategoryPractices,
    allPhaseItems,
    allReadinessCriteria,
    allOpenIssues,
    openIssueValue,
    checklistAcknowledgement,
    checklistVerification,
  ]);

  // Unique contributors list
  const uniqueContributors = useMemo(() => {
    const set = new Set<string>();
    for (const item of allItems) {
      if (item.completed && item.completedBy) {
        set.add(item.completedBy.trim());
      }
    }
    return Array.from(set).sort();
  }, [allItems]);

  // Overall metrics
  const totalCount = allItems.length;
  const completedCount = allItems.filter((i) => i.completed).length;
  const verifiedCount = allItems.filter((i) => i.completed && i.verified).length;
  const pendingCount = allItems.filter((i) => i.completed && !i.verified).length;
  const verificationRate =
    completedCount === 0 ? 0 : Math.round((verifiedCount / completedCount) * 100);

  // Filtered items based on tab, section, user, search query
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Tab filter
      if (activeTab === 'pending' && (!item.completed || item.verified)) return false;
      if (activeTab === 'verified' && (!item.completed || !item.verified)) return false;
      if (activeTab === 'completed' && !item.completed) return false;

      // Section filter
      if (sectionFilter !== 'all' && item.sectionCategory !== sectionFilter) return false;

      // User filter
      if (userFilter !== 'all' && item.completedBy.trim() !== userFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesSection = item.section.toLowerCase().includes(query);
        const matchesUser = item.completedBy.toLowerCase().includes(query);
        const matchesNotes = Boolean(item.userNotes?.toLowerCase().includes(query));
        const matchesVerNotes = Boolean(item.verificationNotes?.toLowerCase().includes(query));
        if (!matchesTitle && !matchesSection && !matchesUser && !matchesNotes && !matchesVerNotes) {
          return false;
        }
      }

      return true;
    });
  }, [allItems, activeTab, sectionFilter, userFilter, searchQuery]);

  // Single verify action
  const handleVerify = (item: UnifiedDashboardItem) => {
    const notes = adminVerifyNotes[item.id] || '';
    if (item.kind === 'tracker') {
      const rowKey = item.id.replace(/^tracker-/, '');
      verifyTrackerRow(rowKey, username || 'Administrator');
    } else {
      verifyChecklistItem(item.id, username || 'Administrator', notes);
    }
    setFeedbackNotice(`Verified "${item.title.slice(0, 40)}..." for ${item.completedBy}`);
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  // Single unverify action
  const handleUnverify = (item: UnifiedDashboardItem) => {
    if (item.kind === 'tracker') {
      const rowKey = item.id.replace(/^tracker-/, '');
      unverifyTrackerRow(rowKey);
    } else {
      unverifyChecklistItem(item.id);
    }
    setFeedbackNotice(`Revoked verification for "${item.title.slice(0, 40)}..."`);
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  // Bulk verify all currently visible pending items
  const handleVerifyAllVisible = () => {
    const pendingVisible = filteredItems.filter((i) => i.completed && !i.verified);
    if (pendingVisible.length === 0) return;

    for (const item of pendingVisible) {
      if (item.kind === 'tracker') {
        const rowKey = item.id.replace(/^tracker-/, '');
        verifyTrackerRow(rowKey, username || 'Administrator');
      } else {
        verifyChecklistItem(item.id, username || 'Administrator');
      }
    }
    setFeedbackNotice(`Successfully verified ${pendingVisible.length} pending items!`);
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  // Admin handles creating a new user in Cognito
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserCreateError(null);
    setUserCreateSuccess(null);
    setUserCreateLoading(true);

    try {
      const res = await createManagedUser(newUsername, newUserPassword, newUserEmail);
      if (!res.success) {
        setUserCreateError(res.error || 'Failed to create user in Cognito.');
        return;
      }

      const account: ManagedUserAccount = {
        username: newUsername.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        role: newUserRole,
        createdAt: new Date().toISOString(),
      };

      setManagedUsers((prev) => [account, ...prev.filter((u) => u.username !== account.username)]);
      setUserCreateSuccess(account);
      setNewUsername('');
      setNewUserEmail('');
      setNewUserPassword('Pass' + Math.floor(100000 + Math.random() * 900000) + '!');
      setFeedbackNotice(`User "${account.username}" created successfully! Copy credentials below.`);
    } catch (err) {
      setUserCreateError(err instanceof Error ? err.message : 'Error creating user in Cognito');
    } finally {
      setUserCreateLoading(false);
    }
  };

  const isRootAdmin = (u: ManagedUserAccount) =>
    u.username.toLowerCase() === (import.meta.env.VITE_ADMIN_USERNAME || 'admin').toLowerCase();

  const handleOpenPasswordModal = (u: ManagedUserAccount) => {
    setPasswordModalUser(u);
    setNewPasswordInput('Pass' + Math.floor(100000 + Math.random() * 900000) + '!');
    setShowPasswordModalPass(false);
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser || !newPasswordInput.trim()) return;

    const trimmedPass = newPasswordInput.trim();
    setManagedUsers((prev) =>
      prev.map((u) =>
        u.username === passwordModalUser.username ? { ...u, password: trimmedPass } : u,
      ),
    );
    setFeedbackNotice(`Password updated for user "${passwordModalUser.username}"!`);
    setPasswordModalUser(null);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  const handleOpenEditModal = (u: ManagedUserAccount) => {
    setEditUserModal(u);
    setEditEmailInput(u.email);
    setEditRoleInput(u.role);
  };

  const handleSaveUserEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserModal) return;

    setManagedUsers((prev) =>
      prev.map((u) =>
        u.username === editUserModal.username
          ? { ...u, email: editEmailInput.trim(), role: editRoleInput }
          : u,
      ),
    );
    setFeedbackNotice(`User details updated for "${editUserModal.username}"!`);
    setEditUserModal(null);
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  const handleConfirmDelete = () => {
    if (!deleteModalUser) return;
    setManagedUsers((prev) => prev.filter((u) => u.username !== deleteModalUser.username));
    setFeedbackNotice(`User "${deleteModalUser.username}" removed.`);
    setDeleteModalUser(null);
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  // Non-admin view: polite restriction with direct login box
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="border border-edge bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-sm bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <div>
              <h1 className="text-lg font-bold text-ink">Administrator Access Required</h1>
              <p className="text-xs text-ink-muted">
                Admin Verification &amp; Acknowledgement Dashboard
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-ink-secondary leading-relaxed">
            This dashboard is reserved for portal administrators to review checklist completions,
            inspect user sign-offs and acknowledgements, verify implementations, and provision user
            accounts in AWS Cognito.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setLoginError(null);
              const res = loginAsAdmin('admin', quickLoginPass);
              if (!res.success) setLoginError(res.error || 'Authentication failed');
            }}
            className="mt-6 border-t border-edge pt-4"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Log in as Administrator (AWS Cognito)
            </h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                value={quickLoginPass}
                onChange={(e) => setQuickLoginPass(e.target.value)}
                placeholder="Enter administrator password"
                className="flex-1 border border-edge bg-canvas px-3 py-2 text-sm text-ink"
                aria-label="Admin password"
              />
              <button
                type="submit"
                className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Log In
              </button>
            </div>
            {loginError && <p className="mt-2 text-xs text-rose-600">{loginError}</p>}
          </form>

          <div className="mt-6 border-t border-edge pt-4 text-xs text-ink-muted">
            <p>
              <strong>Self-Learners:</strong> You can explore and use all checklists, guides, and
              notes without logging in!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Page Title & Mission */}
      <div className="border-b border-edge pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                AWS Cognito Admin
              </span>
              <span className="text-xs text-ink-muted">
                Logged in as <strong>{username}</strong> (Pool: {DEFAULT_COGNITO_CONFIG.userPoolId})
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Verification &amp; Acknowledgement Dashboard
            </h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Review user checklist completions and acknowledgements across all guide practices,
              phases, readiness criteria, and tracker rows. Verify sign-offs, manage Cognito users,
              and view AWS deployment status.
            </p>
          </div>

          {pendingCount > 0 && activeTab !== 'users' && activeTab !== 'aws' && (
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleVerifyAllVisible}
                className="inline-flex items-center gap-1.5 border border-emerald-600 bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
              >
                <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Verify All Visible Pending ({filteredItems.filter((i) => i.completed && !i.verified).length})
              </button>
            </div>
          )}
        </div>
      </div>

      {feedbackNotice && (
        <div className="mt-4 rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span>{feedbackNotice}</span>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="border border-edge bg-surface p-4">
          <p className="text-xs font-medium text-ink-muted uppercase">Total Items</p>
          <p className="mt-1 text-2xl font-bold text-ink">{totalCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Across all portal sections</p>
        </div>

        <div className="border border-edge bg-surface p-4">
          <p className="text-xs font-medium text-ink-muted uppercase">User Completed</p>
          <p className="mt-1 text-2xl font-bold text-accent">{completedCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Marked by contributors</p>
        </div>

        <div className="border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase">
            Pending Verification
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-300">
            {pendingCount}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
            Awaiting Admin Review
          </p>
        </div>

        <div className="border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">
            Verified by Admin
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-300">
            {verifiedCount}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
            Approved &amp; signed off
          </p>
        </div>

        <div className="border border-edge bg-surface p-4 col-span-2 sm:col-span-1">
          <p className="text-xs font-medium text-ink-muted uppercase">Verification Rate</p>
          <p className="mt-1 text-2xl font-bold text-ink">{verificationRate}%</p>
          <div className="mt-1 h-1.5 w-full bg-edge/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${verificationRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mt-8 border-b border-edge">
        <div className="flex flex-wrap gap-2 -mb-px">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={[
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
              activeTab === 'pending'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-secondary hover:text-ink',
            ].join(' ')}
          >
            <span>Pending Verification</span>
            <span
              className={[
                'rounded-full px-1.5 py-0.2 text-[10px]',
                pendingCount > 0
                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold'
                  : 'bg-edge/40 text-ink-muted',
              ].join(' ')}
            >
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('verified')}
            className={[
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
              activeTab === 'verified'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-secondary hover:text-ink',
            ].join(' ')}
          >
            <span>Verified</span>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.2 text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
              {verifiedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={[
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
              activeTab === 'completed'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-secondary hover:text-ink',
            ].join(' ')}
          >
            <span>All User Completed</span>
            <span className="rounded-full bg-accent-subtle px-1.5 py-0.2 text-[10px] text-accent font-bold">
              {completedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={[
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
              activeTab === 'all'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-secondary hover:text-ink',
            ].join(' ')}
          >
            <span>All Inventory</span>
            <span className="rounded-full bg-edge/40 px-1.5 py-0.2 text-[10px] text-ink-muted font-bold">
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={[
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
              activeTab === 'users'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-secondary hover:text-ink',
            ].join(' ')}
          >
            <span>Cognito User Management</span>
            <span className="rounded-full bg-accent-subtle px-1.5 py-0.2 text-[10px] text-accent font-bold">
              {managedUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('aws')}
            className={[
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
              activeTab === 'aws'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-secondary hover:text-ink',
            ].join(' ')}
          >
            <span>AWS Deployment Status</span>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.2 text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
              Live
            </span>
          </button>
        </div>
      </div>

      {/* Tab: User Management in Cognito */}
      {activeTab === 'users' && (
        <div className="mt-6 space-y-6">
          <div className="border border-edge bg-surface p-5 sm:p-6">
            <h2 className="text-base font-bold text-ink">
              Create User ID in AWS Cognito
            </h2>
            <p className="mt-1 text-xs text-ink-secondary">
              As an administrator, create user IDs and passwords for your team members. Give the
              credentials to the contributor so they can log in, complete checklists, and have their
              work verified by you.
            </p>

            <form onSubmit={handleCreateUser} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cognito-new-user" className="block text-xs font-medium text-ink">
                  User ID / Username:
                </label>
                <input
                  type="text"
                  id="cognito-new-user"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. sarah.lead or alex.devops"
                  className="mt-1 w-full border border-edge bg-canvas px-3 py-1.5 text-xs text-ink"
                  required
                />
              </div>

              <div>
                <label htmlFor="cognito-new-email" className="block text-xs font-medium text-ink">
                  Email Address:
                </label>
                <input
                  type="email"
                  id="cognito-new-email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. sarah@company.com"
                  className="mt-1 w-full border border-edge bg-canvas px-3 py-1.5 text-xs text-ink"
                  required
                />
              </div>

              <div>
                <label htmlFor="cognito-new-pass" className="block text-xs font-medium text-ink">
                  Password:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="cognito-new-pass"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="mt-1 w-full border border-edge bg-canvas px-3 py-1.5 text-xs text-ink font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setNewUserPassword('Pass' + Math.floor(100000 + Math.random() * 900000) + '!')
                    }
                    className="mt-1 shrink-0 border border-edge bg-sunken px-2.5 py-1.5 text-xs text-ink hover:bg-surface"
                    title="Generate Random Password"
                  >
                    Regenerate
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="cognito-new-role" className="block text-xs font-medium text-ink">
                  Role / Group in Cognito:
                </label>
                <select
                  id="cognito-new-role"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'VerifiedUsers' | 'Admins')}
                  className="mt-1 w-full border border-edge bg-canvas px-3 py-1.5 text-xs text-ink"
                >
                  <option value="VerifiedUsers">Verified Contributor (VerifiedUsers Group)</option>
                  <option value="Admins">Administrator (Admins Group - Full CRUD)</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-center justify-between border-t border-edge pt-4">
                <p className="text-[11px] text-ink-muted">
                  Self-learners do NOT need an account — they can use the portal freely as guests.
                </p>
                <button
                  type="submit"
                  disabled={userCreateLoading}
                  className="border border-accent bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {userCreateLoading ? 'Creating User in Cognito...' : 'Create User & Generate Credentials'}
                </button>
              </div>
            </form>

            {userCreateError && (
              <div className="mt-3 rounded border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300">
                {userCreateError}
              </div>
            )}

            {userCreateSuccess && (
              <div className="mt-4 rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs text-emerald-900 dark:text-emerald-200">
                <h3 className="font-bold flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Credentials Ready to Share with Contributor:
                </h3>
                <div className="mt-2 space-y-1 font-mono text-xs bg-white dark:bg-slate-900 p-3 border border-emerald-200 dark:border-emerald-800 rounded">
                  <p><strong>Username / User ID:</strong> {userCreateSuccess.username}</p>
                  <p><strong>Password:</strong> {userCreateSuccess.password}</p>
                  <p><strong>Role:</strong> {userCreateSuccess.role === 'Admins' ? 'Administrator' : 'Verified Contributor'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const text = `DevOps Portal Credentials\nUsername: ${userCreateSuccess.username}\nPassword: ${userCreateSuccess.password}\nLogin at: ${import.meta.env.VITE_S3_WEBSITE_URL || window.location.origin}`;
                    navigator.clipboard?.writeText(text);
                    setFeedbackNotice('Credentials copied to clipboard!');
                    setTimeout(() => setFeedbackNotice(null), 2500);
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Copy User Credentials to Clipboard
                </button>
              </div>
            )}
          </div>

          {/* Active Cognito Users (CRUD Management) */}
          <div className="border border-edge bg-surface p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-edge">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Active Cognito Users ({managedUsers.length})
                </h3>
                <p className="text-xs text-ink-muted">
                  Provisioned user IDs in Cognito. Manage credentials, change roles, or remove accounts.
                </p>
              </div>

              {/* User search filter */}
              <div className="w-full sm:w-60">
                <input
                  type="search"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Filter users by name or email..."
                  className="w-full border border-edge bg-canvas px-2.5 py-1 text-xs text-ink"
                  aria-label="Filter users by name or email"
                />
              </div>
            </div>

            <div className="mt-4 divide-y divide-edge border border-edge">
              {managedUsers
                .filter((u) => {
                  if (!userSearchQuery.trim()) return true;
                  const q = userSearchQuery.toLowerCase();
                  return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                })
                .map((u) => {
                  const rootAdmin = isRootAdmin(u);
                  return (
                    <div
                      key={u.username}
                      className="flex flex-col lg:flex-row lg:items-center lg:justify-between p-3.5 gap-3 hover:bg-sunken/30 transition-colors"
                    >
                      {/* Left: User metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-xs font-semibold text-ink">{u.username}</strong>
                          <span
                            className={[
                              'rounded px-1.5 py-0.2 text-[10px] font-semibold',
                              u.role === 'Admins'
                                ? 'bg-accent-subtle text-accent'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
                            ].join(' ')}
                          >
                            {rootAdmin
                              ? 'Root Admin (Full CRUD)'
                              : u.role === 'Admins'
                                ? 'Admin'
                                : 'Verified User'}
                          </span>
                          {rootAdmin && (
                            <span className="rounded bg-sunken px-1.5 py-0.2 text-[10px] text-ink-muted border border-edge">
                              Environment Protected
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-muted mt-0.5">{u.email}</p>
                      </div>

                      {/* Middle: Password display (NEVER SHOW ADMIN PASSWORD) */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-ink-muted">Password:</span>
                        {rootAdmin ? (
                          <span className="font-mono text-xs bg-sunken px-2.5 py-1 text-ink-muted border border-edge italic">
                            •••••••• (Protected in .env)
                          </span>
                        ) : (
                          <span className="font-mono text-xs bg-canvas px-2.5 py-1 text-ink font-semibold border border-edge">
                            {u.password || '••••••••'}
                          </span>
                        )}
                      </div>

                      {/* Right: CRUD Actions */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {rootAdmin ? (
                          <span className="text-xs text-ink-muted italic px-2 py-1">
                            Admin credentials set via .env
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const text = `DevOps Portal Credentials\nUsername: ${u.username}\nPassword: ${u.password || ''}\nRole: ${u.role}\nURL: ${import.meta.env.VITE_S3_WEBSITE_URL || window.location.origin}`;
                                navigator.clipboard?.writeText(text);
                                setFeedbackNotice(`Copied credentials for ${u.username}`);
                                setTimeout(() => setFeedbackNotice(null), 2500);
                              }}
                              className="border border-edge px-2.5 py-1 text-xs text-ink hover:bg-sunken"
                              title="Copy user credentials to clipboard"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPasswordModal(u)}
                              className="border border-accent/40 bg-accent-subtle px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent hover:text-white transition-colors"
                              title="Change / Reset password"
                            >
                              Change Password
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(u)}
                              className="border border-edge px-2.5 py-1 text-xs text-ink hover:bg-sunken"
                              title="Edit user email and role"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteModalUser(u)}
                              className="border border-rose-300 dark:border-rose-900 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Delete user"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: AWS Cloud Deployment Status */}
      {activeTab === 'aws' && (
        <div className="mt-6 space-y-6">
          <div className="border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
              <span className="flex size-3 rounded-full bg-emerald-500 animate-pulse" />
              AWS Cloud Deployment Live
            </div>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              Your DevOps Implementation &amp; Readiness Portal is deployed and hosted on AWS infrastructure.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-surface p-4 border border-edge rounded">
              <div>
                <p className="font-semibold text-ink">Live Portal URL (S3 Website):</p>
                <a
                  href={import.meta.env.VITE_S3_WEBSITE_URL || window.location.origin}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline font-mono text-[11px] break-all hover:text-accent-hover"
                >
                  {import.meta.env.VITE_S3_WEBSITE_URL || window.location.origin}
                </a>
              </div>

              <div>
                <p className="font-semibold text-ink">AWS Region &amp; Account:</p>
                <p className="font-mono text-[11px] text-ink-secondary">
                  {import.meta.env.VITE_AWS_REGION || DEFAULT_COGNITO_CONFIG.region} (Account: {import.meta.env.VITE_AWS_ACCOUNT_ID || 'Configured'})
                </p>
              </div>

              <div>
                <p className="font-semibold text-ink">Cognito User Pool ID:</p>
                <p className="font-mono text-[11px] text-ink-secondary">
                  {DEFAULT_COGNITO_CONFIG.userPoolId || 'Configured'}
                </p>
              </div>

              <div>
                <p className="font-semibold text-ink">Cognito Web Client ID:</p>
                <p className="font-mono text-[11px] text-ink-secondary">
                  {DEFAULT_COGNITO_CONFIG.clientId || 'Configured'}
                </p>
              </div>
            </div>
          </div>

          <div className="border border-edge bg-surface p-5 sm:p-6">
            <h3 className="text-sm font-bold text-ink">AWS CLI Management Reference</h3>
            <p className="mt-1 text-xs text-ink-secondary">
              You can also create and verify users directly from terminal using your configured AWS CLI:
            </p>
            <div className="mt-3 bg-canvas p-3 border border-edge font-mono text-[11px] text-ink overflow-x-auto space-y-2">
              <p className="text-ink-muted"># 1. Create a new user in Cognito:</p>
              <p>aws cognito-idp admin-create-user --user-pool-id {DEFAULT_COGNITO_CONFIG.userPoolId || '&lt;pool-id&gt;'} --username &lt;username&gt; --user-attributes Name=email,Value=&lt;email&gt; Name=email_verified,Value=true --message-action SUPPRESS</p>
              <p className="text-ink-muted mt-2"># 2. Set user permanent password:</p>
              <p>aws cognito-idp admin-set-user-password --user-pool-id {DEFAULT_COGNITO_CONFIG.userPoolId || '&lt;pool-id&gt;'} --username &lt;username&gt; --password '&lt;password&gt;' --permanent</p>
              <p className="text-ink-muted mt-2"># 3. Add to VerifiedUsers group:</p>
              <p>aws cognito-idp admin-add-user-to-group --user-pool-id {DEFAULT_COGNITO_CONFIG.userPoolId || '&lt;pool-id&gt;'} --username &lt;username&gt; --group-name VerifiedUsers</p>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar: Filters & Search (Only on item listing tabs) */}
      {activeTab !== 'users' && activeTab !== 'aws' && (
        <>
          <div className="mt-4 flex flex-col gap-3 rounded border border-edge bg-sunken/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {/* Section filter */}
              <div>
                <label htmlFor="filter-section" className="sr-only">
                  Filter by section
                </label>
                <select
                  id="filter-section"
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value as SectionFilter)}
                  className="border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink"
                >
                  <option value="all">All Sections</option>
                  <option value="tracker">Implementation Tracker</option>
                  <option value="guide">Guide Practices</option>
                  <option value="order">Implementation Order</option>
                  <option value="readiness">Production Readiness Gate</option>
                  <option value="notes">Notes &amp; Decisions (Open Issues)</option>
                </select>
              </div>

              {/* Contributor filter */}
              <div>
                <label htmlFor="filter-contributor" className="sr-only">
                  Filter by contributor
                </label>
                <select
                  id="filter-contributor"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink"
                >
                  <option value="all">All Contributors</option>
                  {uniqueContributors.map((user) => (
                    <option key={user} value={user}>
                      Contributor: {user}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search input */}
            <div className="w-full sm:w-72">
              <label htmlFor="search-dashboard" className="sr-only">
                Search items
              </label>
              <input
                type="search"
                id="search-dashboard"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items, users, notes..."
                className="w-full border border-edge bg-surface px-3 py-1.5 text-xs text-ink"
              />
            </div>
          </div>

          {/* Active Items Count */}
          <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
            <p>
              Showing <span className="font-semibold text-ink">{filteredItems.length}</span> items
              {activeTab === 'pending' && ' awaiting admin verification'}
              {activeTab === 'verified' && ' verified by admin'}
            </p>
          </div>

          {/* Item List / Cards */}
          {filteredItems.length === 0 ? (
            <div className="mt-6 border border-dashed border-edge bg-surface p-8 text-center">
              <p className="text-sm font-medium text-ink">No items match your selected filters</p>
              <p className="mt-1 text-xs text-ink-muted">
                Try switching tabs or resetting the search query and category filters.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={[
                    'border p-4 transition-colors',
                    item.verified
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-surface'
                      : item.completed
                        ? 'border-amber-200 dark:border-amber-900/60 bg-surface'
                        : 'border-edge bg-surface opacity-75',
                  ].join(' ')}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left side: Item metadata & user completion info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                          {item.section}
                        </span>
                        <span className="text-[11px] text-ink-muted">{item.id}</span>
                        {item.completed ? (
                          <span className="inline-flex items-center gap-1 rounded bg-accent-subtle px-2 py-0.5 text-[11px] font-semibold text-accent">
                            ✓ User Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-edge/40 px-2 py-0.5 text-[11px] text-ink-muted">
                            Not Completed
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2 text-sm font-semibold text-ink">
                        <Link to={item.route} className="hover:text-accent hover:underline">
                          {item.title}
                        </Link>
                      </h3>

                      {/* User acknowledgement / implementation information */}
                      {item.completed && (
                        <div className="mt-3 rounded border border-edge/60 bg-sunken/40 p-2.5 text-xs text-ink-secondary">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <div>
                              <span className="font-semibold text-ink">Implemented By: </span>
                              <span className="font-medium text-accent">
                                {item.completedBy || 'DevOps Contributor'}
                              </span>
                            </div>
                            {item.completedAt && (
                              <div className="text-[11px] text-ink-muted">
                                <span>Completed: </span>
                                <span>{new Date(item.completedAt).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>

                          {item.userNotes && (
                            <p className="mt-1.5 text-[11px] text-ink-secondary italic">
                              <strong className="not-italic text-ink font-medium">Notes: </strong>
                              {item.userNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right side: Verification Status & Actions */}
                    <div className="flex shrink-0 flex-col sm:items-end gap-2 border-t sm:border-t-0 border-edge pt-3 sm:pt-0">
                      {item.verified ? (
                        <div className="flex flex-col sm:items-end gap-1">
                          <span className="inline-flex items-center gap-1 rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                            </svg>
                            Verified by {item.verifiedBy}
                          </span>
                          {item.verifiedAt && (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                              {new Date(item.verifiedAt).toLocaleDateString()}
                            </span>
                          )}
                          {item.verificationNotes && (
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 italic max-w-xs text-right">
                              &ldquo;{item.verificationNotes}&rdquo;
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleUnverify(item)}
                            className="mt-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline"
                          >
                            Revoke Verification
                          </button>
                        </div>
                      ) : item.completed ? (
                        <div className="flex flex-col sm:items-end gap-2">
                          <span className="inline-flex items-center gap-1 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300">
                            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                            Pending Admin Verification
                          </span>

                          {item.kind === 'checklist' && (
                            <input
                              type="text"
                              placeholder="Verification note (optional)"
                              value={adminVerifyNotes[item.id] || ''}
                              onChange={(e) =>
                                setAdminVerifyNotes((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              className="w-full sm:w-48 border border-edge bg-canvas px-2 py-1 text-xs text-ink"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => handleVerify(item)}
                            className="inline-flex items-center gap-1.5 border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                            </svg>
                            Verify &amp; Sign Off
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-muted">Awaiting user completion</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal: Change Password */}
      {passwordModalUser && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPasswordModalUser(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-pass-title"
            className="w-full max-w-md border border-edge bg-surface p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h3 id="change-pass-title" className="text-base font-semibold text-ink">
                Change Password for {passwordModalUser.username}
              </h3>
              <button
                type="button"
                onClick={() => setPasswordModalUser(null)}
                className="text-ink-muted hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="mt-4 space-y-4">
              <div>
                <label htmlFor="new-pass-field" className="block text-xs font-medium text-ink">
                  New Password:
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type={showPasswordModalPass ? 'text' : 'password'}
                    id="new-pass-field"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full border border-edge bg-canvas px-3 py-1.5 text-xs text-ink font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordModalPass((v) => !v)}
                    className="shrink-0 border border-edge px-2.5 py-1.5 text-xs text-ink hover:bg-sunken"
                  >
                    {showPasswordModalPass ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewPasswordInput('Pass' + Math.floor(100000 + Math.random() * 900000) + '!')
                    }
                    className="shrink-0 border border-edge bg-sunken px-2.5 py-1.5 text-xs text-ink hover:bg-surface"
                    title="Generate Random Password"
                  >
                    Regenerate
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">
                  Cognito requirement: 8+ characters with uppercase, lowercase, number, and special symbol.
                </p>
              </div>

              {/* AWS CLI Sync Tip */}
              <div className="rounded border border-edge bg-canvas p-2.5 text-[11px] font-mono text-ink-secondary">
                <p className="text-ink-muted font-sans text-[10px] uppercase font-semibold">
                  AWS CLI Sync Command (Optional):
                </p>
                <p className="mt-1 break-all select-all text-accent">
                  aws cognito-idp admin-set-user-password --user-pool-id{' '}
                  {DEFAULT_COGNITO_CONFIG.userPoolId || '&lt;pool-id&gt;'} --username{' '}
                  {passwordModalUser.username} --password &apos;{newPasswordInput}&apos; --permanent
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-edge pt-3">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="border border-edge px-3 py-1.5 text-xs text-ink hover:bg-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="border border-accent bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User Details */}
      {editUserModal && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditUserModal(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
            className="w-full max-w-md border border-edge bg-surface p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h3 id="edit-user-title" className="text-base font-semibold text-ink">
                Edit User: {editUserModal.username}
              </h3>
              <button
                type="button"
                onClick={() => setEditUserModal(null)}
                className="text-ink-muted hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="edit-email-field" className="block text-xs font-medium text-ink">
                  Email Address:
                </label>
                <input
                  type="email"
                  id="edit-email-field"
                  value={editEmailInput}
                  onChange={(e) => setEditEmailInput(e.target.value)}
                  className="mt-1 w-full border border-edge bg-canvas px-3 py-1.5 text-xs text-ink"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-role-field" className="block text-xs font-medium text-ink">
                  Role / Group in Cognito:
                </label>
                <select
                  id="edit-role-field"
                  value={editRoleInput}
                  onChange={(e) => setEditRoleInput(e.target.value as 'VerifiedUsers' | 'Admins')}
                  className="mt-1 w-full border border-edge bg-canvas px-3 py-1.5 text-xs text-ink"
                >
                  <option value="VerifiedUsers">Verified Contributor (VerifiedUsers Group)</option>
                  <option value="Admins">Administrator (Admins Group - Full CRUD)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-edge pt-3">
                <button
                  type="button"
                  onClick={() => setEditUserModal(null)}
                  className="border border-edge px-3 py-1.5 text-xs text-ink hover:bg-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="border border-accent bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete User Confirmation */}
      {deleteModalUser && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteModalUser(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            className="w-full max-w-md border border-edge bg-surface p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h3 id="delete-user-title" className="text-base font-semibold text-rose-600 dark:text-rose-400">
                Confirm User Deletion
              </h3>
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                className="text-ink-muted hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-ink">
                Are you sure you want to delete user{' '}
                <strong className="text-ink font-semibold">{deleteModalUser.username}</strong> ({deleteModalUser.email})?
              </p>
              <p className="text-[11px] text-ink-muted">
                This will remove the user from the managed directory in the portal.
              </p>

              {/* AWS CLI Sync Tip */}
              <div className="rounded border border-edge bg-canvas p-2.5 text-[11px] font-mono text-ink-secondary">
                <p className="text-ink-muted font-sans text-[10px] uppercase font-semibold">
                  AWS CLI Delete Command (Optional):
                </p>
                <p className="mt-1 break-all select-all text-rose-600 dark:text-rose-400">
                  aws cognito-idp admin-delete-user --user-pool-id{' '}
                  {DEFAULT_COGNITO_CONFIG.userPoolId || '&lt;pool-id&gt;'} --username{' '}
                  {deleteModalUser.username}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-edge pt-3">
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                className="border border-edge px-3 py-1.5 text-xs text-ink hover:bg-sunken"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="border border-rose-600 bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
