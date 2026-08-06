import { Capacitor } from '@capacitor/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from 'firebase/firestore';

import { debugLog } from '@/common/debug/debugLog';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function createFirestore(appInstance: FirebaseApp): Firestore {
  try {
    if (Capacitor.isNativePlatform()) {
      return initializeFirestore(appInstance, {
        localCache: persistentLocalCache(),
      });
    }

    return initializeFirestore(appInstance, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (error) {
    console.warn('Firestore offline persistence unavailable; using online cache.', error);
    return getFirestore(appInstance);
  }
}

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  void setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn('Firebase Auth persistence unavailable; session may not survive reloads.', error);
  });
  db = createFirestore(app);
}

/**
 * Terminate and recreate Firestore after logout or user switch so persistence
 * leases and cached credentials from the previous session are not reused.
 */
export async function resetFirestoreConnection(reason: string): Promise<void> {
  if (!app) {
    return;
  }

  const existing = db;
  db = null;

  if (existing) {
    try {
      await terminate(existing);
    } catch (error) {
      console.warn('Firestore terminate failed during reset.', error);
    }
  }

  db = createFirestore(app);
  debugLog.debug('firebase', 'Firestore connection reset', { reason });
}

export { app, auth, db, firebaseConfig };
