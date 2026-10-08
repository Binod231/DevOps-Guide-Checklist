/**
 * AWS Cognito Identity Provider Authentication Service.
 *
 * Implements browser-based authentication directly against AWS Cognito IDP
 * endpoints using standard fetch with zero heavy SDK overhead.
 */

export interface CognitoConfig {
  region: string;
  userPoolId: string;
  clientId: string;
}

export const DEFAULT_COGNITO_CONFIG: CognitoConfig = {
  region: import.meta.env.VITE_AWS_REGION || import.meta.env.VITE_COGNITO_REGION || '',
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
};

export const COGNITO_STORAGE_PREFIX = 'portal.cognito.';

export interface CognitoAuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface CognitoUserSession {
  username: string;
  email?: string;
  groups: string[];
  role: 'admin' | 'user' | 'guest';
  isAdmin: boolean;
  isVerifiedUser: boolean;
  sub: string;
  tokens?: CognitoAuthTokens;
}

/** Decodes a JWT payload without external libraries. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1]!;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/** Initiates authentication against AWS Cognito using USER_PASSWORD_AUTH. */
export async function cognitoInitiateAuth(
  username: string,
  pass: string,
  config: CognitoConfig = DEFAULT_COGNITO_CONFIG,
): Promise<{ success: boolean; session?: CognitoUserSession; error?: string }> {
  const endpoint = `https://cognito-idp.${config.region}.amazonaws.com/`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: config.clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: pass,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data.__type === 'NotAuthorizedException'
          ? 'Incorrect username or password.'
          : data.__type === 'UserNotFoundException'
            ? 'User does not exist in Cognito pool.'
            : data.message || 'Cognito authentication failed.';
      return { success: false, error: errorMsg };
    }

    const authResult = data.AuthenticationResult;
    if (!authResult || !authResult.IdToken) {
      return { success: false, error: 'Authentication challenge required or token missing.' };
    }

    const payload = decodeJwtPayload(authResult.IdToken);
    if (!payload) {
      return { success: false, error: 'Failed to decode Cognito ID token.' };
    }

    const groups = Array.isArray(payload['cognito:groups'])
      ? (payload['cognito:groups'] as string[])
      : [];
    const isAdmin = groups.includes('Admins') || username.toLowerCase() === 'admin';
    const isVerifiedUser = groups.includes('VerifiedUsers') || !isAdmin;

    const session: CognitoUserSession = {
      username: (payload['cognito:username'] as string) || username,
      email: payload['email'] as string | undefined,
      groups,
      role: isAdmin ? 'admin' : 'user',
      isAdmin,
      isVerifiedUser,
      sub: (payload['sub'] as string) || '',
      tokens: {
        accessToken: authResult.AccessToken,
        idToken: authResult.IdToken,
        refreshToken: authResult.RefreshToken,
        expiresAt: Date.now() + (authResult.ExpiresIn || 3600) * 1000,
      },
    };

    saveCognitoSession(session);
    return { success: true, session };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error communicating with AWS Cognito.',
    };
  }
}

/** Signs up a new user via Cognito Client API (used by Admin to provision user IDs). */
export async function cognitoCreateUser(
  username: string,
  pass: string,
  email: string,
  config: CognitoConfig = DEFAULT_COGNITO_CONFIG,
): Promise<{ success: boolean; userSub?: string; error?: string }> {
  const endpoint = `https://cognito-idp.${config.region}.amazonaws.com/`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
      },
      body: JSON.stringify({
        ClientId: config.clientId,
        Username: username,
        Password: pass,
        UserAttributes: [{ Name: 'email', Value: email }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to create user in Cognito.' };
    }

    return { success: true, userSub: data.UserSub };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error calling AWS Cognito SignUp.',
    };
  }
}

export function saveCognitoSession(session: CognitoUserSession, storage = window.localStorage): void {
  try {
    storage.setItem(`${COGNITO_STORAGE_PREFIX}session`, JSON.stringify(session));
  } catch {
    // Storage unavailable
  }
}

export function loadCognitoSession(storage = window.localStorage): CognitoUserSession | null {
  try {
    const raw = storage.getItem(`${COGNITO_STORAGE_PREFIX}session`);
    if (!raw) return null;
    const session = JSON.parse(raw) as CognitoUserSession;
    if (session.tokens && session.tokens.expiresAt < Date.now()) {
      clearCognitoSession(storage);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearCognitoSession(storage = window.localStorage): void {
  try {
    storage.removeItem(`${COGNITO_STORAGE_PREFIX}session`);
  } catch {
    // Storage unavailable
  }
}
