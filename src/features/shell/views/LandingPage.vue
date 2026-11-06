<template>
  <ion-page class="landing-page">
    <ion-content class="landing-content" :fullscreen="true">
      <div class="landing-shell">
        <header class="landing-brand">
          <FirmShakeLogo size="brand" />
          <h1 class="landing-title">firm-shake</h1>
          <p class="landing-tagline">Community marketplace with FirmShakes</p>
        </header>

        <div class="carousel">
          <button
            type="button"
            class="carousel-nav carousel-nav--prev"
            aria-label="Previous card"
            :disabled="activeIndex === 0"
            @click="goToPrevious"
          >
            <ion-icon :icon="chevronBackOutline" aria-hidden="true" />
          </button>

          <article class="carousel-card" :aria-label="`Card ${activeIndex + 1} of ${cards.length}`">
            <div class="carousel-card__icon" aria-hidden="true">
              <ion-icon :icon="cards[activeIndex].icon" />
            </div>
            <h2 class="carousel-card__title">{{ cards[activeIndex].title }}</h2>
            <p class="carousel-card__body">{{ cards[activeIndex].body }}</p>
          </article>

          <button
            type="button"
            class="carousel-nav carousel-nav--next"
            aria-label="Next card"
            :disabled="activeIndex === cards.length - 1"
            @click="goToNext"
          >
            <ion-icon :icon="chevronForwardOutline" aria-hidden="true" />
          </button>
        </div>

        <div class="carousel-dots" role="tablist" aria-label="FirmShake overview">
          <button
            v-for="(card, index) in cards"
            :key="card.title"
            type="button"
            class="carousel-dot"
            :class="{ 'carousel-dot--active': index === activeIndex }"
            role="tab"
            :aria-selected="index === activeIndex"
            :aria-label="`Go to card ${index + 1}: ${card.title}`"
            @click="activeIndex = index"
          />
        </div>

        <div class="landing-actions">
          <ion-button expand="block" router-link="/register">
            Get started
          </ion-button>
          <ion-button expand="block" fill="outline" router-link="/tabs/home">
            Browse listings
          </ion-button>
          <ion-button expand="block" fill="clear" router-link="/login">
            Sign in
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
} from '@ionic/vue';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';

import FirmShakeLogo from '@/components/FirmShakeLogo.vue';
import { LANDING_CARDS as cards } from '@/features/shell/data/landingCards';

const activeIndex = ref(0);

function goToPrevious() {
  activeIndex.value = Math.max(0, activeIndex.value - 1);
}

function goToNext() {
  activeIndex.value = Math.min(cards.length - 1, activeIndex.value + 1);
}
</script>

<style scoped>
.landing-content {
  --background: var(--ion-background-color, #000);
}

.landing-shell {
  box-sizing: border-box;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 2rem 1.25rem calc(2rem + env(safe-area-inset-bottom, 0px));
  max-width: 42rem;
  margin-inline: auto;
}

.landing-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.landing-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ion-color-primary, #3880ff);
}

.landing-tagline {
  margin: 0;
  font-size: 0.95rem;
  color: var(--ion-color-medium, #92949c);
}

.carousel {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.carousel-card {
  min-height: 14rem;
  padding: 1.75rem 1.5rem;
  border-radius: 18px;
  background: var(--ion-card-background, #1c1c1e);
  border: 1px solid rgba(56, 128, 255, 0.35);
  box-shadow: 0 12px 40px rgba(56, 128, 255, 0.12);
  text-align: center;
}

.carousel-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.85rem;
  border-radius: 999px;
  background: rgba(56, 128, 255, 0.16);
  color: var(--ion-color-primary, #3880ff);
  font-size: 1.6rem;
}

.carousel-card__title {
  margin: 0 0 0.65rem;
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.25;
}

.carousel-card__body {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.55;
  color: var(--ion-text-color);
}

.carousel-nav {
  appearance: none;
  border: 0;
  background: rgba(56, 128, 255, 0.12);
  color: var(--ion-color-primary, #3880ff);
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.carousel-nav:disabled {
  opacity: 0.35;
  cursor: default;
}

.carousel-nav:focus-visible {
  outline: 2px solid var(--ion-color-primary, #3880ff);
  outline-offset: 2px;
}

.carousel-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}

.carousel-dot {
  appearance: none;
  border: 0;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  padding: 0;
  cursor: pointer;
}

.carousel-dot--active {
  width: 1.4rem;
  background: var(--ion-color-primary, #3880ff);
}

.landing-actions {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
  max-width: 22rem;
}

@media (min-width: 768px) {
  .landing-shell {
    gap: 2rem;
    padding-top: 3rem;
  }

  .carousel-card {
    min-height: 15rem;
    padding: 2rem 2.25rem;
  }

  .carousel-card__title {
    font-size: 1.35rem;
  }
}
</style>
