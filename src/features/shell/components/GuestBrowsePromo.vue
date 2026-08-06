<template>
  <section
    class="guest-browse-promo"
    aria-label="About FirmShake"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <button
      type="button"
      class="guest-browse-promo__nav guest-browse-promo__nav--prev"
      aria-label="Previous card"
      :disabled="activeIndex === 0"
      @click="goToPrevious"
    >
      <ion-icon :icon="chevronBackOutline" aria-hidden="true" />
    </button>

    <article
      class="guest-browse-promo__card"
      :aria-label="`Card ${activeIndex + 1} of ${LANDING_CARDS.length}`"
    >
      <div class="guest-browse-promo__icon" aria-hidden="true">
        <ion-icon :icon="LANDING_CARDS[activeIndex].icon" />
      </div>
      <h2 class="guest-browse-promo__title">{{ LANDING_CARDS[activeIndex].title }}</h2>
      <p class="guest-browse-promo__body">{{ LANDING_CARDS[activeIndex].body }}</p>
    </article>

    <button
      type="button"
      class="guest-browse-promo__nav guest-browse-promo__nav--next"
      aria-label="Next card"
      :disabled="activeIndex === LANDING_CARDS.length - 1"
      @click="goToNext"
    >
      <ion-icon :icon="chevronForwardOutline" aria-hidden="true" />
    </button>

    <div class="guest-browse-promo__dots" role="tablist" aria-label="FirmShake overview">
      <button
        v-for="(card, index) in LANDING_CARDS"
        :key="card.title"
        type="button"
        class="guest-browse-promo__dot"
        :class="{ 'guest-browse-promo__dot--active': index === activeIndex }"
        role="tab"
        :aria-selected="index === activeIndex"
        :aria-label="`Go to card ${index + 1}: ${card.title}`"
        @click="activeIndex = index"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';

import { LANDING_CARDS } from '@/features/shell/data/landingCards';

const activeIndex = ref(0);
let touchStartX = 0;

function goToPrevious() {
  activeIndex.value = Math.max(0, activeIndex.value - 1);
}

function goToNext() {
  activeIndex.value = Math.min(LANDING_CARDS.length - 1, activeIndex.value + 1);
}

function onTouchStart(event: TouchEvent) {
  touchStartX = event.touches[0]?.clientX ?? 0;
}

function onTouchEnd(event: TouchEvent) {
  const touchEndX = event.changedTouches[0]?.clientX ?? 0;
  const deltaX = touchEndX - touchStartX;

  if (deltaX < -48 && activeIndex.value < LANDING_CARDS.length - 1) {
    goToNext();
  } else if (deltaX > 48 && activeIndex.value > 0) {
    goToPrevious();
  }
}
</script>

<style scoped>
.guest-browse-promo {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: 1fr auto;
  align-items: center;
  gap: 0.35rem 0.4rem;
  max-height: 25vh;
  margin: 0.5rem 0 0.65rem;
  padding: 0.55rem 0.35rem 0.45rem;
  border-radius: 14px;
  background: var(--ion-card-background, #1c1c1e);
  border: 1px solid rgba(56, 128, 255, 0.28);
  overflow: hidden;
}

.guest-browse-promo__card {
  grid-column: 2;
  grid-row: 1;
  min-height: 0;
  max-height: calc(25vh - 1.6rem);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  text-align: center;
  padding: 0 0.15rem;
}

.guest-browse-promo__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  margin-bottom: 0.35rem;
  border-radius: 999px;
  background: rgba(56, 128, 255, 0.16);
  color: var(--ion-color-primary, #3880ff);
  font-size: 1.05rem;
}

.guest-browse-promo__title {
  margin: 0 0 0.25rem;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.25;
}

.guest-browse-promo__body {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.4;
  color: var(--ion-color-medium, #92949c);
}

.guest-browse-promo__nav {
  grid-row: 1;
  appearance: none;
  border: 0;
  background: rgba(56, 128, 255, 0.12);
  color: var(--ion-color-primary, #3880ff);
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 1rem;
  padding: 0;
}

.guest-browse-promo__nav:disabled {
  opacity: 0.35;
  cursor: default;
}

.guest-browse-promo__nav:focus-visible {
  outline: 2px solid var(--ion-color-primary, #3880ff);
  outline-offset: 2px;
}

.guest-browse-promo__dots {
  grid-column: 1 / -1;
  grid-row: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.guest-browse-promo__dot {
  appearance: none;
  border: 0;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  padding: 0;
  cursor: pointer;
}

.guest-browse-promo__dot--active {
  width: 1.1rem;
  background: var(--ion-color-primary, #3880ff);
}
</style>
