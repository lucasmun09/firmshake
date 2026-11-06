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
import { resolveFirebaseAuthDomain } from '@/common/services/firebaseAuthDomain';

const configuredAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const pageHostname = typeof window !== 'undefined' ? window.location.hostname : undefined;
const resolvedAuthDomain = resolveFirebaseAuthDomain({
  configuredAuthDomain,
  pageHostname,
  projectId,
});

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolvedAuthDomain,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

if (
  typeof window !== 'undefined'
  && configuredAuthDomain
  && resolvedAuthDomain
  && configuredAuthDomain !== resolvedAuthDomain
) {
  debugLog.info('auth', 'Firebase authDomain resolved to page hostname for redirect compatibility', {
    configuredAuthDomain,
    resolvedAuthDomain,
    pageHostname,
    pageOrigin: window.location.origin,
  });
}

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
