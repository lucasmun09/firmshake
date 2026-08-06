<template>
  <div v-if="displayUrls.length > 0" class="listing-photo-gallery">
    <div
      ref="carouselRef"
      class="gallery-carousel"
      :class="{ 'gallery-carousel--single': displayUrls.length === 1 }"
      @scroll="onCarouselScroll"
    >
      <button
        v-for="(url, index) in displayUrls"
        :key="`${url}-${index}`"
        type="button"
        class="gallery-slide"
        :aria-label="`View ${title} photo ${index + 1}`"
        @click="openViewer(index)"
      >
        <img :src="url" :alt="`${title} photo ${index + 1}`" loading="lazy" />
      </button>
    </div>

    <p v-if="displayUrls.length > 1" class="gallery-count">
      {{ activeCarouselIndex + 1 }} / {{ displayUrls.length }}
    </p>

    <ion-modal
      :is-open="viewerOpen"
      class="photo-viewer-modal"
      @did-dismiss="closeViewer"
    >
      <div class="viewer-page">
        <ion-header>
          <ion-toolbar color="dark">
            <ion-buttons slot="start">
              <ion-button fill="clear" @click="closeViewer">Close</ion-button>
            </ion-buttons>
            <ion-title v-if="displayUrls.length > 1">
              {{ viewerIndex + 1 }} / {{ displayUrls.length }}
            </ion-title>
            <ion-buttons v-if="displayUrls.length > 1" slot="end">
              <ion-button fill="clear" :disabled="viewerIndex === 0" @click="showPrevious">
                Prev
              </ion-button>
              <ion-button
                fill="clear"
                :disabled="viewerIndex >= displayUrls.length - 1"
                @click="showNext"
              >
                Next
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <div
          class="viewer-viewport"
          :class="{ 'is-panning': isPanning }"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
          @dblclick.prevent="toggleZoom"
          @wheel.prevent="onWheel"
        >
          <img
            v-if="displayUrls[viewerIndex]"
            :src="displayUrls[viewerIndex]"
            :alt="`${title} photo ${viewerIndex + 1}`"
            :style="viewerImageStyle"
            draggable="false"
          />
        </div>

        <p class="viewer-hint">
          Drag to move · Scroll or pinch to zoom · Double-tap to toggle zoom
        </p>
      </div>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import { resolveAuthenticatedImageUrl } from '@/common/services/images';

const props = defineProps<{
  imageUrls: string[];
  title: string;
}>();

const displayUrls = ref<string[]>([]);
const carouselRef = ref<HTMLDivElement | null>(null);
const activeCarouselIndex = ref(0);
const viewerOpen = ref(false);
const viewerIndex = ref(0);
const viewerScale = ref(1);
const viewerPanX = ref(0);
const viewerPanY = ref(0);
const isPanning = ref(false);

let pinchStartDistance = 0;
let pinchStartScale = 1;
let panStartX = 0;
let panStartY = 0;
let panOriginX = 0;
let panOriginY = 0;
let mousePanning = false;

const viewerImageStyle = computed(() => ({
  transform: `translate(${viewerPanX.value}px, ${viewerPanY.value}px) scale(${viewerScale.value})`,
}));

watch(
  () => props.imageUrls,
  async (urls) => {
    const resolved = await Promise.all(
      urls.map((url) =>
        resolveAuthenticatedImageUrl(url).catch(() => ''),
      ),
    );
    displayUrls.value = resolved.filter(Boolean);
  },
  { immediate: true },
);

onUnmounted(() => {
  closeViewer();
});

function onCarouselScroll() {
  const carousel = carouselRef.value;
  if (!carousel || displayUrls.value.length <= 1) {
    return;
  }

  const slideWidth = carousel.clientWidth;
  if (slideWidth <= 0) {
    return;
  }

  activeCarouselIndex.value = Math.round(carousel.scrollLeft / slideWidth);
}

function resetViewerTransform() {
  viewerScale.value = 1;
  viewerPanX.value = 0;
  viewerPanY.value = 0;
  isPanning.value = false;
  mousePanning = false;
}

function openViewer(index: number) {
  viewerIndex.value = index;
  resetViewerTransform();
  viewerOpen.value = true;
}

function closeViewer() {
  viewerOpen.value = false;
  resetViewerTransform();
}

function showPrevious() {
  if (viewerIndex.value <= 0) {
    return;
  }

  viewerIndex.value -= 1;
  resetViewerTransform();
}

function showNext() {
  if (viewerIndex.value >= displayUrls.value.length - 1) {
    return;
  }

  viewerIndex.value += 1;
  resetViewerTransform();
}

function toggleZoom() {
  if (viewerScale.value > 1) {
    resetViewerTransform();
    return;
  }

  viewerScale.value = 2.5;
  viewerPanX.value = 0;
  viewerPanY.value = 0;
}

function onWheel(event: WheelEvent) {
  const delta = event.deltaY > 0 ? -0.15 : 0.15;
  const nextScale = clampScale(viewerScale.value + delta);
  if (nextScale === 1) {
    viewerPanX.value = 0;
    viewerPanY.value = 0;
  }
  viewerScale.value = nextScale;
}

function touchDistance(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function canPan(): boolean {
  return viewerScale.value > 1;
}

function onMouseDown(event: MouseEvent) {
  if (event.button !== 0 || !canPan()) {
    return;
  }

  mousePanning = true;
  isPanning.value = true;
  panStartX = event.clientX;
  panStartY = event.clientY;
  panOriginX = viewerPanX.value;
  panOriginY = viewerPanY.value;
}

function onMouseMove(event: MouseEvent) {
  if (!mousePanning) {
    return;
  }

  viewerPanX.value = panOriginX + (event.clientX - panStartX);
  viewerPanY.value = panOriginY + (event.clientY - panStartY);
}

function onMouseUp() {
  mousePanning = false;
  isPanning.value = false;
}

function onTouchStart(event: TouchEvent) {
  if (event.touches.length === 2) {
    mousePanning = false;
    isPanning.value = false;
    pinchStartDistance = touchDistance(event.touches);
    pinchStartScale = viewerScale.value;
    return;
  }

  if (event.touches.length === 1 && canPan()) {
    isPanning.value = true;
    panStartX = event.touches[0].clientX;
    panStartY = event.touches[0].clientY;
    panOriginX = viewerPanX.value;
    panOriginY = viewerPanY.value;
  }
}

function onTouchMove(event: TouchEvent) {
  if (event.touches.length === 2 && pinchStartDistance > 0) {
    event.preventDefault();
    const distance = touchDistance(event.touches);
    const nextScale = clampScale(pinchStartScale * (distance / pinchStartDistance));
    if (nextScale === 1) {
      viewerPanX.value = 0;
      viewerPanY.value = 0;
    }
    viewerScale.value = nextScale;
    return;
  }

  if (isPanning.value && event.touches.length === 1 && canPan()) {
    event.preventDefault();
    viewerPanX.value = panOriginX + (event.touches[0].clientX - panStartX);
    viewerPanY.value = panOriginY + (event.touches[0].clientY - panStartY);
  }
}

function onTouchEnd() {
  pinchStartDistance = 0;
  isPanning.value = false;
}

function clampScale(value: number): number {
  return Math.min(4, Math.max(1, value));
}
</script>

<style scoped>
.listing-photo-gallery {
  width: 100%;
  margin-bottom: 0.25rem;
}

.gallery-carousel {
  display: flex;
  width: 100%;
  height: var(--listing-hero-height, 50dvh);
  min-height: var(--listing-hero-height, 50dvh);
  max-height: var(--listing-hero-height, 50dvh);
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  background: var(--ion-color-step-100);
  border-radius: 8px;
}

.gallery-carousel::-webkit-scrollbar {
  display: none;
}

.gallery-slide {
  flex: 0 0 100%;
  width: 100%;
  height: var(--listing-hero-height, 50dvh);
  min-height: var(--listing-hero-height, 50dvh);
  margin: 0;
  padding: 0;
  border: none;
  background: var(--ion-color-step-100);
  cursor: zoom-in;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gallery-slide img {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 100%;
  object-fit: contain;
}

.gallery-count {
  margin: 0;
  padding: 0.35rem 0.75rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.photo-viewer-modal {
  --width: 100%;
  --height: 100%;
}

.viewer-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #000;
}

.viewer-viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.viewer-viewport.is-panning {
  cursor: grabbing;
}

.viewer-viewport img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  transform-origin: center center;
  will-change: transform;
  pointer-events: none;
}

.viewer-hint {
  margin: 0;
  padding: 0.5rem 1rem 1rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}
</style>
