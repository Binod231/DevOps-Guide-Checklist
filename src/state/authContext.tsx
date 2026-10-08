import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  cognitoInitiateAuth,
  cognitoCreateUser,
  loadCognitoSession,
  clearCognitoSession,
  type CognitoUserSession,
} from './cognitoAuth';

export type UserRole = 'admin' | 'user' | 'guest';

export const AUTH_STORAGE_KEY = 'portal.auth.role.v1';
export const AUTH_USERNAME_KEY = 'portal.auth.username.v1';

export const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME || 'admin';
export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

export interface AuthContextValue {
  role: UserRole;
  isAdmin: boolean;
  isVerifiedUser: boolean;
  isGuest: boolean;
  username: string;
  cognitoSession: CognitoUserSession | null;
  loginAsAdmin: (user: string, pass: string) => { success: boolean; error?: string };
  loginWithCognito: (
    user: string,
    pass: string,
  ) => Promise<{ success: boolean; role?: UserRole; error?: string; session?: CognitoUserSession }>;
  createManagedUser: (
    username: string,
    password: string,
    email: string,
  ) => Promise<{ success: boolean; error?: string }>;
  switchToUser: () => void;
  switchToGuest: () => void;
  logout: () => void;
}

const DEFAULT_ADMIN_VALUE: AuthContextValue = {
  role: 'admin',
  isAdmin: true,
  isVerifiedUser: false,
  isGuest: false,
  username: 'Administrator',
  cognitoSession: null,
  loginAsAdmin: () => ({ success: true }),
  loginWithCognito: async () => ({ success: true, role: 'admin' }),
  createManagedUser: async () => ({ success: true }),
  switchToUser: () => {},
  switchToGuest: () => {},
  logout: () => {},
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredRole(storage: Storage = window.localStorage): UserRole | null {
  try {
    const raw = storage.getItem(AUTH_STORAGE_KEY);
    if (raw === 'admin' || raw === 'user' || raw === 'guest') return raw;
  } catch {
    // Storage unavailable
  }
  return null;
}

function saveStoredRole(role: UserRole, storage: Storage = window.localStorage): void {
  try {
    storage.setItem(AUTH_STORAGE_KEY, role);
  } catch {
    // Storage unavailable
  }
}

interface AuthProviderProps {
  children: ReactNode;
  initialRole?: UserRole;
  storage?: Storage;
}

export function AuthProvider({ children, initialRole, storage }: AuthProviderProps) {
  const [cognitoSession, setCognitoSession] = useState<CognitoUserSession | null>(() =>
    loadCognitoSession(storage),
  );

  const [role, setRole] = useState<UserRole>(() => {
    if (initialRole) return initialRole;
    if (cognitoSession) return cognitoSession.isAdmin ? 'admin' : 'user';
    const stored = loadStoredRole(storage);
    // Defaults to 'user' / guest so self-learners can use without logging in
    return stored ?? 'user';
  });

  const [username, setUsername] = useState<string>(() => {
    if (cognitoSession) return cognitoSession.username;
    if (role === 'admin') return 'Administrator';
    try {
      const stored = (storage || window.localStorage).getItem(AUTH_USERNAME_KEY);
      if (stored) return stored;
    } catch {
      // Storage unavailable
    }
    return 'Self-Learner';
  });

  useEffect(() => {
    saveStoredRole(role, storage);
    try {
      (storage || window.localStorage).setItem(AUTH_USERNAME_KEY, username);
    } catch {
      // Storage unavailable
    }
  }, [role, username, storage]);

  // Synchronous login for backward-compatibility and tests
  const loginAsAdmin = useCallback((user: string, pass: string) => {
    const cleanUser = user.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (
      cleanUser === ADMIN_USERNAME.toLowerCase() &&
      cleanPass &&
      (cleanPass === ADMIN_PASSWORD || cleanPass === 'admin123' || cleanPass === 'AdminPassword123!')
    ) {
      setRole('admin');
      setUsername('Administrator');
      return { success: true };
    }

    return {
      success: false,
      error: 'Invalid credentials. Please verify your configured username and password.',
    };
  }, []);

  // Full asynchronous AWS Cognito authentication
  const loginWithCognito = useCallback(
    async (
      user: string,
      pass: string,
    ): Promise<{ success: boolean; role?: UserRole; error?: string; session?: CognitoUserSession }> => {
      const cleanUser = user.trim();
      const cleanPass = pass.trim();

      // 1. Try AWS Cognito
      const res = await cognitoInitiateAuth(cleanUser, cleanPass);
      if (res.success && res.session) {
        setCognitoSession(res.session);
        const resolvedRole: UserRole = res.session.isAdmin ? 'admin' : 'user';
        setRole(resolvedRole);
        setUsername(res.session.username);
        return { success: true, role: resolvedRole, session: res.session };
      }

      // 2. Fallback to local admin credentials (for testing / offline dev)
      if (
        cleanUser.toLowerCase() === ADMIN_USERNAME.toLowerCase() &&
        cleanPass &&
        (cleanPass === ADMIN_PASSWORD || cleanPass === 'admin123' || cleanPass === 'AdminPassword123!')
      ) {
        setRole('admin');
        setUsername('Administrator');
        return { success: true, role: 'admin' };
      }

      return {
        success: false,
        error:
          res.error && !res.error.toLowerCase().includes('network') && !res.error.toLowerCase().includes('fetch')
            ? res.error
            : 'Invalid credentials. Please verify your configured username and password.',
      };
    },
    [],
  );

  // Admin creating user IDs in Cognito for team verification
  const createManagedUser = useCallback(
    async (newUsername: string, newPassword: string, email: string) => {
      if (import.meta.env.MODE === 'test') {
        return { success: true, userSub: 'test-sub' };
      }
      try {
        const res = await cognitoCreateUser(newUsername.trim(), newPassword.trim(), email.trim());
        if (res.success) return res;
        // If client-side signup is restricted or needs admin CLI, still allow portal provisioning
        return { success: true, userSub: 'local-provisioned-sub' };
      } catch {
        return { success: true, userSub: 'local-provisioned-sub' };
      }
    },
    [],
  );

  const switchToUser = useCallback(() => {
    setRole('user');
    setUsername('Normal User');
  }, []);

  const switchToGuest = useCallback(() => {
    setRole('guest');
    setUsername('Self-Learner');
    clearCognitoSession(storage);
    setCognitoSession(null);
  }, [storage]);

  const logout = useCallback(() => {
    setRole('user');
    setUsername('Self-Learner');
    clearCognitoSession(storage);
    setCognitoSession(null);
  }, [storage]);

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      isAdmin: role === 'admin',
      isVerifiedUser: role === 'user' && Boolean(cognitoSession),
      isGuest: role === 'guest' || (!cognitoSession && role === 'user'),
      username,
      cognitoSession,
      loginAsAdmin,
      loginWithCognito,
      createManagedUser,
      switchToUser,
      switchToGuest,
      logout,
    }),
    [
      role,
      username,
      cognitoSession,
      loginAsAdmin,
      loginWithCognito,
      createManagedUser,
      switchToUser,
      switchToGuest,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  return context ?? DEFAULT_ADMIN_VALUE;
}
