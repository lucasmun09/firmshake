<template>
  <div class="browse-cards-view">
    <article
      v-for="listing in listings"
      :key="listing.id"
      class="browse-card"
      @click="onCardClick(listing)"
      @dblclick.prevent.stop="onCardDoubleClick(listing)"
    >
      <div class="browse-card__media">
        <ListingBookmarkButton
          class="browse-card__bookmark"
          :saved="savedIds.has(listing.id)"
          @toggle="onBookmarkToggle(listing)"
        />
        <AuthenticatedImage
          :src="listing.imageUrl"
          :alt="listing.title"
          variant="thumbnail"
          class="browse-card__image"
        />
        <div class="browse-card__overlay">
          <p class="browse-card__title">{{ listing.title }}</p>
          <p class="browse-card__meta">
            <span>{{ formatPrice(listing.price) }}</span>
            <span class="browse-card__sep" aria-hidden="true">·</span>
            <span>{{ formatDepositAmount() }}</span>
          </p>
        </div>
      </div>
    </article>
    <BrowseCardSkeleton
      v-for="index in trailingSkeletonCount"
      :key="`card-trailing-${index}`"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import BrowseCardSkeleton from '@/components/skeletons/BrowseCardSkeleton.vue';
import ListingBookmarkButton from '@/features/listings/components/ListingBookmarkButton.vue';
import {
  resolveListingPrefsUid,
  savedListingsRevision,
  useListingBookmark,
} from '@/features/listings/composables/useListingBookmark';
import { getSavedListings } from '@/features/listings/services/savedListings';
import { listingDetailPath } from '@/features/listings/utils/browseMapView';
import { MEETUP_DEPOSIT_AMOUNT, type ListingSummary } from '@/types';
import { formatPrice } from '@/utils/currency';

defineProps<{
  listings: ListingSummary[];
  trailingSkeletonCount?: number;
}>();

const router = useRouter();
const uid = computed(() => resolveListingPrefsUid());
const savedIds = computed(() => {
  savedListingsRevision.value;
  return new Set(getSavedListings(uid.value).map((entry) => entry.id));
});

let clickTimer: ReturnType<typeof setTimeout> | null = null;

function formatDepositAmount(): string {
  return `$${MEETUP_DEPOSIT_AMOUNT} deposit`;
}

const { toggleBookmark } = useListingBookmark(() => '');

function onCardClick(listing: ListingSummary) {
  if (clickTimer) {
    clearTimeout(clickTimer);
  }

  clickTimer = setTimeout(() => {
    void router.push(listingDetailPath(listing.id));
    clickTimer = null;
  }, 250);
}

async function onBookmarkToggle(listing: ListingSummary) {
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }
  await toggleBookmark(listing);
}

async function onCardDoubleClick(listing: ListingSummary) {
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }
  await toggleBookmark(listing);
}
</script>

<style scoped>
.browse-cards-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
  gap: var(--fs-card-gap);
  padding: var(--fs-space-xs) 0 var(--fs-space-sm);
}

@media (min-width: 480px) {
  .browse-cards-view {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 10.5rem), 1fr));
  }
}

@media (min-width: 768px) {
  .browse-cards-view {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 11.5rem), 1fr));
  }
}

@media (min-width: 1024px) {
  .browse-cards-view {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 12.5rem), 1fr));
  }
}

.browse-card {
  display: block;
  text-decoration: none;
  color: inherit;
  border-radius: 10px;
  overflow: hidden;
  background: var(--ion-color-step-50, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.12));
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  cursor: pointer;
}

.browse-card:hover,
.browse-card:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
}

.browse-card__media {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
}

.browse-card__bookmark {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  z-index: 2;
}

.browse-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.browse-card__overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 28%;
  min-height: 2.75rem;
  max-height: 3.5rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0.4rem 0.5rem;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.82) 0%,
    rgba(0, 0, 0, 0.55) 55%,
    rgba(0, 0, 0, 0) 100%
  );
}

.browse-card__title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.25;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browse-card__meta {
  margin: 0.1rem 0 0;
  font-size: 0.72rem;
  line-height: 1.25;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browse-card__sep {
  margin: 0 0.2rem;
  opacity: 0.75;
}
</style>
