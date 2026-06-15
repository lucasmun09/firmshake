/**
 * Seed the system "All" community into Firestore.
 *
 * Usage:
 *   1. Download a service account key from Firebase Console
 *      (Project settings → Service accounts → Generate new private key)
 *   2. export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   3. npm run firebase:seed
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'firmshake-dev';
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!credentialsPath) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf8'));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId,
  });
}

const db = getFirestore();

const community = {
  id: 'all',
  name: 'All',
  type: 'system',
  description: 'Global marketplace feed.',
  createdBy: 'system',
  memberCount: 0,
};

const { id, ...data } = community;
await db.collection('communities').doc(id).set(
  {
    ...data,
    createdAt: new Date(),
  },
  { merge: true },
);
console.log(`Seeded community: ${community.name}`);
console.log('Community seed complete.');
