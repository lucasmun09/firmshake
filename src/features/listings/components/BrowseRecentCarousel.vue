<template>
  <section
    v-if="entries.length > 0"
    class="browse-recent-carousel"
    aria-label="Recently viewed listings"
  >
    <div class="browse-recent-carousel__header">
      <h2 class="browse-recent-carousel__title">Recent</h2>
    </div>

    <div
      class="browse-recent-carousel__track"
      :style="{ '--recent-visible-slots': visibleSlotCount }"
    >
      <RouterLink
        v-for="entry in entries"
        :key="entry.id"
        :to="listingDetailPath(entry.id)"
        class="browse-recent-carousel__card"
      >
        <div class="browse-recent-carousel__media">
          <AuthenticatedImage
            :src="entry.imageUrl"
            :alt="entry.title"
            variant="thumbnail"
            class="browse-recent-carousel__image"
          />
        </div>
        <div class="browse-recent-carousel__body">
          <p class="browse-recent-carousel__card-title">{{ entry.title }}</p>
          <p class="browse-recent-carousel__price">{{ formatPrice(entry.price) }}</p>
        </div>
      </RouterLink>

      <RouterLink
        :to="recentListingsPath"
        class="browse-recent-carousel__see-all"
        aria-label="See all recently viewed listings"
      >
        <span class="browse-recent-carousel__see-all-label">See all</span>
        <ion-icon :icon="chevronForwardOutline" aria-hidden="true" />
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { chevronForwardOutline } from 'ionicons/icons';

import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import { useRecentListingsEntries } from '@/features/listings/composables/useRecentListings';
import { listingDetailPath } from '@/features/listings/utils/browseMapView';
import { formatPrice } from '@/utils/currency';

defineProps<{
  visibleSlotCount: number;
}>();

const recentListingsPath = '/tabs/home/recent';
const { entries } = useRecentListingsEntries();
</script>

<style scoped>
.browse-recent-carousel {
  margin: 0 0 var(--fs-space-sm);
}

.browse-recent-carousel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--fs-space-xs);
}

.browse-recent-carousel__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.browse-recent-carousel__track {
  --recent-gap: var(--fs-space-sm);
  display: flex;
  gap: var(--recent-gap);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 0.15rem;
  scrollbar-width: thin;
}

.browse-recent-carousel__card,
.browse-recent-carousel__see-all {
  flex: 0 0
    calc(
      (100% - (var(--recent-visible-slots) - 1) * var(--recent-gap)) /
        var(--recent-visible-slots)
    );
  scroll-snap-align: start;
  text-decoration: none;
  color: inherit;
}

.browse-recent-carousel__card {
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  overflow: hidden;
  background: var(--ion-color-step-50, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.12));
  min-width: 6.5rem;
}

.browse-recent-carousel__media {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
}

.browse-recent-carousel__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.browse-recent-carousel__body {
  padding: 0.35rem 0.45rem 0.45rem;
}

.browse-recent-carousel__card-title {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browse-recent-carousel__price {
  margin: 0.1rem 0 0;
  font-size: 0.68rem;
  color: var(--ion-color-medium, #92949c);
}

.browse-recent-carousel__see-all {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-height: 6.5rem;
  border-radius: 10px;
  border: 1px dashed var(--ion-color-step-200, rgba(255, 255, 255, 0.2));
  background: transparent;
  color: var(--ion-color-primary, #3880ff);
  font-size: 0.78rem;
  font-weight: 600;
}

.browse-recent-carousel__see-all ion-icon {
  font-size: 1.1rem;
}
</style>
