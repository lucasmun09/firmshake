/**
 * Backfill communityFeeds and listing search fields for existing listings.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   node scripts/backfill-listing-feeds.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { FieldValue, GeoPoint, getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const DEFAULT_CATEGORY = 'general';

function encodeGeohash(lat, lng, precision = 9) {
  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }

    isLng = !isLng;
    if (bit < 4) {
      bit += 1;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

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

const SEED_CATEGORIES = [
  { id: 'general', name: 'General', slug: 'general', sortOrder: 0 },
  { id: 'electronics', name: 'Electronics', slug: 'electronics', sortOrder: 10 },
  { id: 'phones', name: 'Phones & Tablets', slug: 'phones', parentId: 'electronics', sortOrder: 11 },
  { id: 'computers', name: 'Computers', slug: 'computers', parentId: 'electronics', sortOrder: 12 },
  { id: 'home', name: 'Home & Garden', slug: 'home', sortOrder: 20 },
  { id: 'furniture', name: 'Furniture', slug: 'furniture', parentId: 'home', sortOrder: 21 },
  { id: 'clothing', name: 'Clothing & Accessories', slug: 'clothing', sortOrder: 30 },
  { id: 'sports', name: 'Sports & Outdoors', slug: 'sports', sortOrder: 40 },
  { id: 'vehicles', name: 'Vehicles', slug: 'vehicles', sortOrder: 50 },
  { id: 'books', name: 'Books & Media', slug: 'books', sortOrder: 60 },
  { id: 'toys', name: 'Toys & Games', slug: 'toys', sortOrder: 70 },
  { id: 'services', name: 'Services', slug: 'services', sortOrder: 80 },
];

function feedTargets(communityIds = []) {
  const ids = new Set(['all', ...communityIds]);
  return [...ids];
}

async function seedCategories() {
  const batch = db.batch();
  for (const category of SEED_CATEGORIES) {
    batch.set(db.collection('categories').doc(category.id), category, { merge: true });
  }
  await batch.commit();
  console.log(`Seeded ${SEED_CATEGORIES.length} categories`);
}

function buildFeedPayload(listingId, data, feedCommunityId) {
  const imageUrls = Array.isArray(data.imageUrls)
    ? data.imageUrls
    : data.imageUrl
      ? [data.imageUrl]
      : [];
  const primaryCategoryId = data.primaryCategoryId ?? DEFAULT_CATEGORY;
  const payload = {
    listingId,
    feedCommunityId,
    title: data.title ?? '',
    titleLower: String(data.titleLower ?? data.title ?? '').toLowerCase(),
    description: data.description ?? '',
    price: data.price ?? 0,
    imageUrls,
    imageUrl: data.imageUrl ?? imageUrls[0] ?? '',
    sellerId: data.sellerId ?? '',
    sellerName: data.sellerName ?? '',
    communityIds: data.communityIds ?? ['all'],
    primaryCategoryId,
    categoryIds: data.categoryIds ?? [primaryCategoryId],
    status: data.status ?? 'active',
    createdAt: data.createdAt ?? FieldValue.serverTimestamp(),
  };

  if (data.location?.latitude != null) {
    payload.location = data.location;
    payload.lat = data.location.latitude;
    payload.lng = data.location.longitude;
    payload.geohash = data.geohash ?? encodeGeohash(payload.lat, payload.lng);
  } else if (data.lat != null && data.lng != null) {
    payload.lat = data.lat;
    payload.lng = data.lng;
    payload.geohash = data.geohash ?? encodeGeohash(data.lat, data.lng);
    payload.location = new GeoPoint(data.lat, data.lng);
  }

  return payload;
}

async function backfillListings() {
  const snapshot = await db.collection('listings').get();
  let updated = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const primaryCategoryId = data.primaryCategoryId ?? DEFAULT_CATEGORY;
    const patch = {
      primaryCategoryId,
      categoryIds: data.categoryIds ?? [primaryCategoryId],
      titleLower: String(data.titleLower ?? data.title ?? '').toLowerCase(),
    };

    if (data.lat != null && data.lng != null && !data.geohash) {
      patch.geohash = encodeGeohash(Number(data.lat), Number(data.lng));
    }

    await docSnap.ref.set(patch, { merge: true });

    const listing = { ...data, ...patch, id: docSnap.id };
    const batch = db.batch();
    for (const feedCommunityId of feedTargets(listing.communityIds)) {
      batch.set(
        db.collection('communityFeeds').doc(feedCommunityId).collection('listings').doc(docSnap.id),
        buildFeedPayload(docSnap.id, listing, feedCommunityId),
        { merge: true },
      );
    }
    await batch.commit();
    updated += 1;
  }

  console.log(`Backfilled ${updated} listings into communityFeeds`);
}

await seedCategories();
await backfillListings();
