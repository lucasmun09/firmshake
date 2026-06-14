import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref } from 'vue';

import type { UserProfile } from '@/types';
import { auth, db, isFirebaseConfigured } from './firebase';

export const currentUser = ref<User | null>(null);
export const authReady = ref(false);

if (isFirebaseConfigured && auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser.value = user;
    authReady.value = true;
  });
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
  await signOut(auth);
}
