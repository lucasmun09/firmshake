<template>
  <div class="browse-cards-view">
    <RouterLink
      v-for="listing in listings"
      :key="listing.id"
      :to="listingDetailPath(listing.id)"
      class="browse-card"
    >
      <div class="browse-card__media">
        <AuthenticatedImage
          :src="listing.imageUrl"
          :alt="listing.title"
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
    </RouterLink>
    <BrowseCardSkeleton
      v-for="index in trailingSkeletonCount"
      :key="`card-trailing-${index}`"
    />
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';

import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import BrowseCardSkeleton from '@/components/skeletons/BrowseCardSkeleton.vue';
import { listingDetailPath } from '@/features/listings/utils/browseMapView';
import { MEETUP_DEPOSIT_AMOUNT, type Listing } from '@/types';
import { formatPrice } from '@/utils/currency';

defineProps<{
  listings: Listing[];
  trailingSkeletonCount?: number;
}>();

function formatDepositAmount(): string {
  return `$${MEETUP_DEPOSIT_AMOUNT} deposit`;
}
</script>

<style scoped>
.browse-cards-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
  gap: 0.65rem;
  padding: 0.25rem 0 0.5rem;
}

@media (min-width: 480px) {
  .browse-cards-view {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 10.5rem), 1fr));
    gap: 0.75rem;
  }
}

@media (min-width: 768px) {
  .browse-cards-view {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 11.5rem), 1fr));
    gap: 0.85rem;
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
}

.browse-card:hover,
.browse-card:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
}

.browse-card:focus-visible {
  outline: 2px solid var(--ion-color-primary, #3880ff);
  outline-offset: 2px;
}

.browse-card__media {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
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
