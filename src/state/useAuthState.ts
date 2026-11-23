import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  FirebaseAuthErrorInfo,
  formatFirebaseAuthError,
  googleSignIn,
  initAuth,
  logout,
} from '../services/firebaseAuthService';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isConnectingGoogle: boolean;
  authError: FirebaseAuthErrorInfo | null;
  clearAuthError: () => void;
  connectGoogle: (onSuccess?: () => void) => Promise<boolean>;
  signOutGoogle: () => Promise<void>;
}

/**
 * Thin React state hook wrapping Firebase Auth & Google OAuth Drive token lifecycle.
 */
export function useAuthState(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [authError, setAuthError] = useState<FirebaseAuthErrorInfo | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const connectGoogle = async (onSuccess?: () => void): Promise<boolean> => {
    setIsConnectingGoogle(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        onSuccess?.();
        return true;
      }
      return false;
    } catch (err: unknown) {
      console.error('Google sign-in error:', err);
      setAuthError(formatFirebaseAuthError(err));
      return false;
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const signOutGoogle = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
  };

  return {
    user,
    accessToken,
    isConnectingGoogle,
    authError,
    clearAuthError: () => setAuthError(null),
    connectGoogle,
    signOutGoogle,
  };
}
