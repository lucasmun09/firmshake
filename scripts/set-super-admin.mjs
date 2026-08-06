#!/usr/bin/env node
/**
 * Grant super admin privileges to a user by email.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
 *   node scripts/set-super-admin.mjs user@example.com
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import { readFileSync } from 'node:fs';

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error('Usage: node scripts/set-super-admin.mjs user@example.com');
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
  process.exit(1);
}

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'),
  );
  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID ?? serviceAccount.project_id ?? 'firmshake-dev',
  });
}

const db = getFirestore();
const auth = getAuth();

let uid = null;
const matches = await db.collection('users').where('email', '==', email).limit(1).get();

if (!matches.empty) {
  uid = matches.docs[0].id;
} else {
  try {
    const user = await auth.getUserByEmail(email);
    uid = user.uid;
    console.log(`No Firestore profile yet; using Firebase Auth uid ${uid}`);
  } catch {
    console.error(`No Firebase user found with email ${email}. Sign in once on the main app first.`);
    process.exit(1);
  }
}

const userRef = db.collection('users').doc(uid);
const existing = await userRef.get();

if (existing.exists) {
  await userRef.update({
    isSuperAdmin: true,
    isAdmin: true,
  });
} else {
  const authUser = await auth.getUser(uid);
  const displayName = authUser.displayName ?? 'FirmShake User';
  const parts = displayName.trim().split(/\s+/);
  const firstName = parts[0] ?? 'FirmShake';
  const lastName = parts.slice(1).join(' ') || 'User';

  await userRef.set({
    email,
    firstName,
    lastName,
    displayName,
    communityIds: ['all'],
    isAdmin: true,
    isSuperAdmin: true,
    moderatorCommunityIds: [],
    profileComplete: true,
    accountSetupComplete: true,
    authProvider: authUser.providerData.some((entry) => entry.providerId === 'google.com')
      ? 'google.com'
      : 'password',
    createdAt: FieldValue.serverTimestamp(),
  });
}

console.log(`Super admin granted to ${email} (${uid})`);
