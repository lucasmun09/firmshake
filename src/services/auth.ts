import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref } from 'vue';

import type { UserProfile } from '@/types';
import { ensureCommunitiesSeeded } from './communities';
import { auth, db, isFirebaseConfigured } from './firebase';
import { initPushNotifications, resetPushNotifications } from './pushNotifications';

export const currentUser = ref<User | null>(null);
export const authReady = ref(false);

if (isFirebaseConfigured && auth) {
  void (async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        await ensureUserProfile(result.user);
      }
    } catch (err) {
      console.error('Google redirect sign-in failed', err);
    }

    onAuthStateChanged(auth, async (user) => {
      currentUser.value = user;
      if (user) {
        await ensureCommunitiesSeeded();
        void initPushNotifications(user.uid);
      } else {
        resetPushNotifications();
      }
      authReady.value = true;
    });
  })();
} else {
  authReady.value = true;
}

async function ensureUserProfile(user: User, displayName?: string): Promise<void> {
  if (!db) return;

  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    const profile: Omit<UserProfile, 'uid'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
      email: user.email ?? '',
      displayName: displayName ?? user.displayName ?? 'FirmShake User',
      communityIds: ['all'],
      isAdmin: false,
      createdAt: serverTimestamp(),
    };
    await setDoc(userRef, profile);
  }

  await ensureCommunitiesSeeded();
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  if (!auth) {
    throw new Error('Firebase is not configured. Add credentials to .env.local');
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  await ensureUserProfile(credential.user, displayName);
  return credential.user;
}

export async function loginWithGoogle(): Promise<User | null> {
  if (!auth) {
    throw new Error('Firebase is not configured. Add credentials to .env.local');
  }

  const provider = new GoogleAuthProvider();

  try {
    const credential = await signInWithPopup(auth, provider);
    await ensureUserProfile(credential.user);
    return credential.user;
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : '';

    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  if (!auth) {
    throw new Error('Firebase is not configured. Add credentials to .env.local');
  }

  const credential = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(credential.user);
  return credential.user;
}

export async function logout(): Promise<void> {
  if (!auth) return;
  const { clearAuthenticatedImageCache } = await import('./images');
  clearAuthenticatedImageCache();
  await signOut(auth);
}
