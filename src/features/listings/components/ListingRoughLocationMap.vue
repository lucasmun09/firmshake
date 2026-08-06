<template>
  <section class="rough-location">
    <h2 class="rough-location__heading">Location</h2>

    <p v-if="!hasCoordinates" class="rough-location__empty">Location not provided</p>

    <template v-else>
      <p v-if="!mapsConfigured" class="rough-location__hint">
        Map preview is unavailable without a Google Maps API key.
      </p>
      <p v-else-if="loadError" class="rough-location__hint warning">{{ loadError }}</p>
      <div v-else ref="mapHostRef" class="rough-location__map" role="img" :aria-label="ariaLabel" />

      <p v-if="cityStateLabel" class="rough-location__label">{{ cityStateLabel }}</p>
      <p class="rough-location__privacy">Approximate area only — exact address is not shown.</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import {
  LISTING_MAP_DISPLAY_RADIUS_MILES,
  jitterListingMapCenter,
} from '@/features/listings/utils/listingLocationJitter';
import { milesToMeters } from '@/features/listings/utils/geoDistance';
import type { ListingLocation } from '@/types';
import {
  isGoogleMapsConfigured,
  loadMapsLibrary,
  registerGoogleMapsAuthFailure,
} from '@/utils/googleMaps';

const props = defineProps<{
  listingId: string;
  location?: ListingLocation;
}>();

const mapHostRef = ref<HTMLDivElement | null>(null);
const mapsConfigured = isGoogleMapsConfigured();
const loadError = ref('');

let map: google.maps.Map | undefined;
let circle: google.maps.Circle | undefined;
let resizeObserver: ResizeObserver | undefined;

const hasCoordinates = computed(() => {
  const location = props.location;
  return (
    location != null &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng)
  );
});

const cityStateLabel = computed(() => {
  const city = props.location?.city?.trim();
  const region = props.location?.region?.trim();
  if (city && region) {
    return `${city}, ${region}`;
  }
  if (city) {
    return city;
  }
  if (region) {
    return region;
  }
  return '';
});

const ariaLabel = computed(() => {
  const area = cityStateLabel.value || 'listing';
  return `Approximate ${LISTING_MAP_DISPLAY_RADIUS_MILES}-mile area near ${area}`;
});

async function initMap() {
  if (!mapsConfigured || !mapHostRef.value || !hasCoordinates.value || !props.location) {
    return;
  }

  loadError.value = '';

  try {
    const { Map } = await loadMapsLibrary();
    const jittered = jitterListingMapCenter(
      props.listingId,
      props.location.lat,
      props.location.lng,
    );

    map = new Map(mapHostRef.value, {
      center: jittered,
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: 'cooperative',
    });

    circle = new google.maps.Circle({
      map,
      center: jittered,
      radius: milesToMeters(LISTING_MAP_DISPLAY_RADIUS_MILES),
      strokeColor: '#3880ff',
      strokeOpacity: 0.85,
      strokeWeight: 2,
      fillColor: '#3880ff',
      fillOpacity: 0.18,
      clickable: false,
    });

    const bounds = circle.getBounds();
    if (bounds) {
      map.fitBounds(bounds, 24);
    }

    resizeObserver = new ResizeObserver(() => {
      if (bounds) {
        map?.fitBounds(bounds, 24);
      }
    });
    resizeObserver.observe(mapHostRef.value);
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : 'Could not load map preview.';
  }
}

function destroyMap() {
  resizeObserver?.disconnect();
  resizeObserver = undefined;
  circle?.setMap(null);
  circle = undefined;
  map = undefined;
  mapHostRef.value?.replaceChildren();
}

onMounted(() => {
  registerGoogleMapsAuthFailure(() => {
    loadError.value = 'Google Maps authentication failed.';
  });
  void initMap();
});

onUnmounted(() => {
  destroyMap();
});

watch(
  () => [props.listingId, props.location?.lat, props.location?.lng] as const,
  () => {
    destroyMap();
    void initMap();
  },
);
</script>

<style scoped>
.rough-location {
  margin: 1rem 0 0;
}

.rough-location__heading {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.rough-location__map {
  width: 100%;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--ion-color-step-150);
  background: var(--ion-color-step-50);
}

.rough-location__label {
  margin: 0.5rem 0 0;
  font-weight: 500;
}

.rough-location__privacy,
.rough-location__empty,
.rough-location__hint {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.rough-location__hint.warning {
  color: var(--ion-color-warning-shade);
}
</style>
