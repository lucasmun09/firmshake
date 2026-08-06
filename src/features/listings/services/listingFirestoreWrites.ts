import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { debugLog, serializeError } from '@/common/debug/debugLog';
import { db } from '@/common/services/firebase';
import { getDefaultCategoryId } from '@/features/listings/data/seedCategories';
import {
  listingFromCreatePayload,
  syncListingFeeds,
  updateListingFeedStatus,
} from '@/features/listings/services/listingFeed';
import { syncListingSearchIndex } from '@/features/listings/services/listingSearch';
import { primaryListingImageUrl } from '@/features/listings/utils/listingImages';
import { listingWritePayload } from '@/features/listings/utils/listingMapper';
import { buildListingSearchDocument } from '@/features/listings/utils/listingSearchDocument';
import type { Listing, UserProfile } from '@/types';

import type { CreateListingInput, UpdateListingInput } from './listingBff';

function assertDb() {
  if (!db) {
    throw new Error('Firestore is not configured');
  }
  return db;
}

/** Direct Firestore create (feed + search sync client-side). Used when BFF flag is off. */
export async function createListing(input: CreateListingInput): Promise<Listing> {
  const firestore = assertDb();

  const primaryCategoryId = input.primaryCategoryId || getDefaultCategoryId();
  const categoryIds =
    input.categoryIds && input.categoryIds.length > 0 ? input.categoryIds : [primaryCategoryId];

  const payload = listingWritePayload({
    ...input,
    primaryCategoryId,
    categoryIds,
  });

  const docRef = await addDoc(collection(firestore, 'listings'), {
    ...payload,
    status: 'active',
    createdAt: serverTimestamp(),
  });

  const created = listingFromCreatePayload(docRef.id, {
    ...input,
    primaryCategoryId,
    categoryIds,
  });

  try {
    await syncListingFeeds(created);
    await syncListingSearchIndex(buildListingSearchDocument(created));
    debugLog.info('listing', 'Listing created', { listingId: created.id, title: created.title });
  } catch (error) {
    debugLog.warn('listing', 'Listing created but feed/search sync failed', {
      listingId: created.id,
      error: serializeError(error),
    });
  }

  return created;
}

/** Direct Firestore update. Caller must supply merged fields (see listingServiceRouter). */
export async function updateListing(
  listingId: string,
  input: UpdateListingInput,
  existing: Listing,
): Promise<Listing> {
  const firestore = assertDb();

  const imageUrls = input.imageUrls.filter(Boolean);
  const primaryCategoryId = input.primaryCategoryId || existing.primaryCategoryId;
  const categoryIds =
    input.categoryIds && input.categoryIds.length > 0 ? input.categoryIds : [primaryCategoryId];

  const payload = {
    ...listingWritePayload({
      ...existing,
      ...input,
      imageUrls,
      primaryCategoryId,
      categoryIds,
    }),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(firestore, 'listings', listingId), payload);

  const updated: Listing = {
    ...existing,
    ...input,
    imageUrls,
    imageUrl: primaryListingImageUrl(imageUrls),
    primaryCategoryId,
    categoryIds,
  };

  try {
    await syncListingFeeds(updated, existing.communityIds);
    await syncListingSearchIndex(buildListingSearchDocument(updated));
  } catch (error) {
    console.warn('Listing updated, but feed/search sync failed', error);
  }

  return updated;
}

/** Direct Firestore remove. Caller must validate permissions and active status. */
export async function removeListing(
  listingId: string,
  actor: UserProfile,
  existing: Listing,
): Promise<Listing> {
  const firestore = assertDb();

  await updateDoc(doc(firestore, 'listings', listingId), {
    status: 'removed',
    removedAt: serverTimestamp(),
    removedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });

  const removed: Listing = {
    ...existing,
    status: 'removed',
    removedBy: actor.uid,
  };

  try {
    await updateListingFeedStatus(listingId, 'removed', existing.communityIds);
    await syncListingSearchIndex(buildListingSearchDocument(removed));
  } catch (error) {
    console.warn('Listing removed, but feed/search sync failed', error);
  }

  return removed;
}
