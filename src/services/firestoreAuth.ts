import { auth } from './firebase';

export async function ensureFirestoreAuth(): Promise<void> {
  if (!auth) {
    throw new Error('Firebase auth is not configured');
  }

  await auth.authStateReady();

  if (!auth.currentUser) {
    throw new Error('You must be signed in');
  }
}
