import { auth, googleAuthProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged, User, GoogleAuthProvider } from 'firebase/auth';

// Add the required Drive scope
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = (): Promise<{ user: User; accessToken: string }> => {
  return new Promise(async (resolve, reject) => {
    try {
      isSigningIn = true;
      const result = await signInWithPopup(auth, googleAuthProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to get access token from Firebase Auth');
      }

      cachedAccessToken = credential.accessToken;
      resolve({ user: result.user, accessToken: cachedAccessToken });
    } catch (error: any) {
      console.error('Sign in error:', error);
      reject(error);
    } finally {
      isSigningIn = false;
    }
  });
};

export const getGoogleAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
