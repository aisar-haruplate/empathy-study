import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseAppletConfig from '../../firebase-applet-config.json';

export interface FirebaseAuthErrorInfo {
  code: string;
  title: string;
  message: string;
  guidance: string;
  hostname?: string;
  consoleUrl?: string;
}

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

function readEnv(key: string): string {
  return (env[key] || '').trim();
}

const appletConfig = firebaseAppletConfig as Partial<FirebaseOptions>;

const resolvedFirebaseConfig: FirebaseOptions = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY') || appletConfig.apiKey || '',
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN') || appletConfig.authDomain || '',
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID') || appletConfig.projectId || '',
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET') || appletConfig.storageBucket || '',
  messagingSenderId:
    readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || appletConfig.messagingSenderId || '',
  appId: readEnv('VITE_FIREBASE_APP_ID') || appletConfig.appId || '',
  measurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID') || appletConfig.measurementId || undefined,
};

export const firebaseProjectId = resolvedFirebaseConfig.projectId || '';
export const isFirebaseConfigured = Boolean(
  resolvedFirebaseConfig.apiKey &&
    resolvedFirebaseConfig.authDomain &&
    resolvedFirebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firebaseInitError: unknown = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(resolvedFirebaseConfig);
    authInstance = getAuth(app);
  } catch (err) {
    firebaseInitError = err;
    console.warn(
      '[Firebase] Failed to initialize Firebase Auth. Local features remain available:',
      err
    );
  }
} else {
  console.warn(
    '[Firebase] Firebase Auth is not configured (missing apiKey, authDomain, or projectId). Local features remain available.'
  );
}

export const auth: Auth | null = authInstance;

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
// Request access to drive file list and content
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

function getCurrentHostname(): string {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return 'this domain';
  }
  return window.location.hostname;
}

function getFirebaseAuthSettingsUrl(): string {
  if (firebaseProjectId) {
    return `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`;
  }
  return 'https://console.firebase.google.com/';
}

/**
 * Convert Firebase/Google Auth errors into clear, actionable UI messages.
 */
export function formatFirebaseAuthError(error: unknown): FirebaseAuthErrorInfo {
  const errObj = (error && typeof error === 'object' ? error : {}) as {
    code?: string;
    message?: string;
  };
  const code = errObj.code || 'auth/unknown';
  const rawMessage = errObj.message || '';
  const hostname = getCurrentHostname();
  const consoleUrl = getFirebaseAuthSettingsUrl();
  const localNote =
    'You can still use local file upload, pasted transcripts, text cleaning, coding sheet review, and synthesis without Google Sign-In.';

  switch (code) {
    case 'auth/unauthorized-domain':
      return {
        code,
        hostname,
        consoleUrl,
        title: `Domain "${hostname}" is not authorized for Firebase Google Sign-In`,
        message: `Firebase blocked Google Sign-In because "${hostname}" is not listed as an authorized domain for project "${firebaseProjectId || 'unknown'}".`,
        guidance: `Add "${hostname}" in Firebase Console → Authentication → Settings → Authorized domains, and verify your VITE_FIREBASE_* values in .env (or firebase-applet-config.json). ${localNote}`,
      };

    case 'auth/popup-blocked':
      return {
        code,
        hostname,
        title: 'Google Sign-In popup was blocked by your browser',
        message: `Your browser blocked the authentication popup on "${hostname}".`,
        guidance: `Allow popups for "${hostname}" in your browser settings and try again. ${localNote}`,
      };

    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        code,
        hostname,
        title: 'Google Sign-In was canceled',
        message: 'The Google Sign-In window was closed before authentication completed.',
        guidance: `Click "Sign in with Google" again if you want to connect Google Drive. ${localNote}`,
      };

    case 'auth/operation-not-allowed':
      return {
        code,
        hostname,
        consoleUrl,
        title: 'Google Sign-In provider is disabled in Firebase',
        message: 'Google authentication is not enabled for this Firebase project.',
        guidance: `Enable the Google provider in Firebase Console → Authentication → Sign-in method. ${localNote}`,
      };

    case 'auth/invalid-api-key':
    case 'auth/configuration-not-found':
    case 'auth/not-configured':
      return {
        code,
        hostname,
        consoleUrl,
        title: 'Firebase Authentication is not properly configured',
        message:
          rawMessage ||
          'Firebase API key or authentication configuration is missing or invalid.',
        guidance: `Check your VITE_FIREBASE_* values in .env or firebase-applet-config.json. ${localNote}`,
      };

    case 'auth/network-request-failed':
      return {
        code,
        hostname,
        title: 'Network error during Google Sign-In',
        message: 'Could not reach Firebase Authentication servers.',
        guidance: `Check your internet connection or firewall settings and try again. ${localNote}`,
      };

    default:
      return {
        code,
        hostname,
        title: `Google Sign-In failed (${code})`,
        message: rawMessage || 'An unexpected error occurred during Google Sign-In.',
        guidance: `Check your Firebase Auth configuration and browser popup settings, then try again. ${localNote}`,
      };
  }
}

/**
 * Initialize auth listener and notify caller with user and in-memory access token.
 * Safe no-op if Firebase is unconfigured or unavailable in a local environment.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }

  try {
    return onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else if (!isSigningIn) {
          // We have a user session, but token needs re-acquisition via interactive sign-in or cached
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    });
  } catch (err) {
    console.warn('[Firebase] Failed to attach auth state listener:', err);
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
};

/**
 * Prompt user for Google Sign-In with Drive scope
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!auth || !isFirebaseConfigured) {
    const configErr = Object.assign(
      new Error(
        firebaseInitError instanceof Error
          ? firebaseInitError.message
          : 'Firebase Auth is not configured for this environment.'
      ),
      { code: 'auth/not-configured' }
    );
    throw configErr;
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw Object.assign(
        new Error('Google Sign-In succeeded, but no Google Drive access token was returned.'),
        { code: 'auth/missing-access-token' }
      );
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('[Firebase] Google sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieve cached token in memory
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Sign out and clear in-memory token
 */
export const logout = async () => {
  cachedAccessToken = null;
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('[Firebase] Sign-out error:', err);
  }
};
