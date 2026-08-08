<template>
  <div class="browse-map-wrap">
    <div class="browse-map-toolbar">
      <ion-searchbar
        :model-value="addressQuery"
        class="browse-map-toolbar__search"
        placeholder="Search an address"
        :debounce="0"
        @update:model-value="onAddressQueryUpdate"
        @keyup.enter="goToAddress"
      />
      <div class="browse-map-toolbar__actions">
        <ion-button size="small" :disabled="geoBusy" @click="goToAddress">
          Go
        </ion-button>
        <ion-button size="small" fill="outline" :disabled="geoBusy" @click="goToCurrentLocation">
          {{ geoBusy ? 'Locating…' : 'Go to current location' }}
        </ion-button>
      </div>
      <p v-if="geoError" class="browse-map-toolbar__error">{{ geoError }}</p>
    </div>
    <div ref="mapContainerRef" class="browse-map-view" aria-label="Listings map" />
    <div
      v-if="loading"
      class="browse-map-loading"
      aria-busy="true"
      aria-live="polite"
    >
      <ion-spinner name="crescent" />
    </div>
    <Transition name="map-popup-fade">
      <article
        v-if="activeListing && popupPosition"
        class="map-listing-popup"
        :style="popupStyle"
        role="dialog"
        :aria-label="activeListing.title"
        @mouseenter="onPopupMouseEnter"
        @mouseleave="onPopupMouseLeave"
        @click.stop
      >
        <div v-if="activeListing.imageUrl" class="map-listing-popup__media">
          <AuthenticatedImage
            :src="activeListing.imageUrl"
            :alt="activeListing.title"
            class="map-listing-popup__image"
          />
        </div>
        <div class="map-listing-popup__body">
          <h3 class="map-listing-popup__title">{{ activeListing.title }}</h3>
          <p class="map-listing-popup__price">{{ formatPrice(activeListing.price) }}</p>
          <p v-if="activeListing.description" class="map-listing-popup__description">
            {{ truncateDescription(activeListing.description) }}
          </p>
          <p v-if="isActiveListingUnavailable" class="map-listing-popup__unavailable">
            This listing is no longer available.
          </p>
          <RouterLink
            v-if="!isActiveListingUnavailable"
            :to="listingDetailPath(activeListing.id)"
            class="map-listing-popup__cta"
          >
            View listing
          </RouterLink>
          <span
            v-else
            class="map-listing-popup__cta map-listing-popup__cta--disabled"
            aria-disabled="true"
          >
            No longer available
          </span>
        </div>
      </article>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { IonButton, IonSearchbar, IonSpinner } from '@ionic/vue';

import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import {
  getCurrentCoordinates,
  getGeolocationErrorMessage,
} from '@/common/services/locationTracking';
import {
  BROWSE_MAP_BOUNDS_DEBOUNCE_MS,
  BROWSE_MAP_DEFAULT_RADIUS_MILES,
  BROWSE_MAP_HIDE_DELAY_MS,
  BROWSE_MAP_HOVER_DELAY_MS,
  BROWSE_MAP_STYLES,
  isCoarsePointer,
  latLngBoundsForRadius,
  latLngToContainerPixel,
  listingDetailPath,
  truncateDescription,
  viewportBoundsToSearch,
  type MapGeoSearchPayload,
  type MapViewportSearch,
} from '@/features/listings/utils/browseMapView';
import type { Listing } from '@/types';
import { formatPrice } from '@/utils/currency';
import {
  forwardGeocodeAddress,
  loadMapsLibrary,
  isGoogleMapsConfigured,
  reverseGeocodeCoordinates,
  reverseGeocodeCityRegion,
} from '@/utils/googleMaps';
import { validateListingAvailability } from '@/features/listings/services/listingStatus';

export type { MapGeoSearchPayload };

const props = defineProps<{
  listings: Listing[];
  center?: { lat: number; lng: number } | null;
  centerRadiusMiles?: number;
  addressQuery?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  'bounds-change': [viewport: MapViewportSearch];
  'geo-search': [payload: MapGeoSearchPayload];
  'listing-unavailable': [listingId: string];
  'update:addressQuery': [value: string];
}>();

const mapContainerRef = ref<HTMLElement | null>(null);
const localAddressQuery = ref(props.addressQuery ?? '');
const geoBusy = ref(false);
const geoError = ref('');
const activeListing = ref<Listing | null>(null);
const popupPosition = ref<{ x: number; y: number } | null>(null);
const popupPinned = ref(false);
const unavailableListingIds = ref<Set<string>>(new Set());
const statusCheckTokens = new Map<string, number>();

let map: google.maps.Map | undefined;
let clusterer: { clearMarkers: () => void; addMarkers: (markers: google.maps.Marker[]) => void } | undefined;
let markers: google.maps.Marker[] = [];
let markersByListingId = new Map<string, google.maps.Marker>();
let markerListeners: google.maps.MapsEventListener[] = [];
let mapListeners: google.maps.MapsEventListener[] = [];
let projectionOverlay: google.maps.OverlayView | undefined;
let hoverShowTimer: ReturnType<typeof setTimeout> | undefined;
let hoverHideTimer: ReturnType<typeof setTimeout> | undefined;
let boundsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let activeMarkerPosition: google.maps.LatLngLiteral | null = null;
let userHasMovedMap = false;
let lastBoundsKey = '';
let lastMarkerListingIds = '';
const coarsePointer = isCoarsePointer();

const addressQuery = computed({
  get: () => props.addressQuery ?? localAddressQuery.value,
  set: (value: string) => {
    localAddressQuery.value = value;
    emit('update:addressQuery', value);
  },
});

function onAddressQueryUpdate(value: string) {
  addressQuery.value = value;
}

function resolveCenterRadiusMiles(): number {
  return props.centerRadiusMiles ?? BROWSE_MAP_DEFAULT_RADIUS_MILES;
}

function fitMapToRadius(center: google.maps.LatLngLiteral, radiusMiles: number) {
  if (!map) {
    return;
  }

  const boundsLiteral = latLngBoundsForRadius(center.lat, center.lng, radiusMiles);
  const bounds = new google.maps.LatLngBounds(
    { lat: boundsLiteral.south, lng: boundsLiteral.west },
    { lat: boundsLiteral.north, lng: boundsLiteral.east },
  );
  userHasMovedMap = false;
  map.fitBounds(bounds, 48);
  lastBoundsKey = '';
  scheduleViewportBoundsEmit();
}

async function emitGeoSearch(
  lat: number,
  lng: number,
  label: string,
  city?: string,
  region?: string,
) {
  const radiusMiles = resolveCenterRadiusMiles();
  fitMapToRadius({ lat, lng }, radiusMiles);
  emit('geo-search', { lat, lng, label, radiusMiles, city, region });
}

async function goToAddress() {
  geoError.value = '';
  const query = addressQuery.value.trim();
  if (!query) {
    geoError.value = 'Enter an address to search.';
    return;
  }

  if (!isGoogleMapsConfigured()) {
    geoError.value = 'Address search requires Google Maps configuration.';
    return;
  }

  geoBusy.value = true;
  try {
    const result = await forwardGeocodeAddress(query);
    addressQuery.value = result.formattedAddress;
    await emitGeoSearch(
      result.lat,
      result.lng,
      result.formattedAddress,
      result.city,
      result.region,
    );
  } catch (error: unknown) {
    geoError.value =
      error instanceof Error ? error.message : 'Could not find that address.';
  } finally {
    geoBusy.value = false;
  }
}

async function goToCurrentLocation() {
  geoError.value = '';
  geoBusy.value = true;

  try {
    const coords = await getCurrentCoordinates();
    let label = 'Your location';
    let city: string | undefined;
    let region: string | undefined;

    if (isGoogleMapsConfigured()) {
      try {
        label = await reverseGeocodeCoordinates(coords.lat, coords.lng);
        const cityRegion = await reverseGeocodeCityRegion(coords.lat, coords.lng);
        city = cityRegion.city;
        region = cityRegion.region;
      } catch {
        // Keep generic label when reverse geocode fails.
      }
    }

    addressQuery.value = label;
    await emitGeoSearch(coords.lat, coords.lng, label, city, region);
  } catch (error: unknown) {
    geoError.value = getGeolocationErrorMessage(error);
  } finally {
    geoBusy.value = false;
  }
}

const popupStyle = computed(() => {
  if (!popupPosition.value) {
    return undefined;
  }
  return {
    left: `${popupPosition.value.x}px`,
    top: `${popupPosition.value.y}px`,
  };
});

const isActiveListingUnavailable = computed(() => {
  const listingId = activeListing.value?.id;
  return listingId ? unavailableListingIds.value.has(listingId) : false;
});

function markListingUnavailable(listingId: string) {
  if (unavailableListingIds.value.has(listingId)) {
    return;
  }

  const next = new Set(unavailableListingIds.value);
  next.add(listingId);
  unavailableListingIds.value = next;
  updateMarkerAvailability(listingId, true);
  emit('listing-unavailable', listingId);
}

function updateMarkerAvailability(listingId: string, unavailable: boolean) {
  const marker = markersByListingId.get(listingId);
  if (!marker) {
    return;
  }

  marker.setOpacity(unavailable ? 0.35 : 1);
  marker.setClickable(!unavailable);
}

async function validateActiveListingStatus(listingId: string) {
  if (unavailableListingIds.value.has(listingId)) {
    return;
  }

  const token = (statusCheckTokens.get(listingId) ?? 0) + 1;
  statusCheckTokens.set(listingId, token);

  const available = await validateListingAvailability(listingId);
  if (statusCheckTokens.get(listingId) !== token) {
    return;
  }

  if (!available) {
    markListingUnavailable(listingId);
  }
}

function listingsWithLocation(): Listing[] {
  return props.listings.filter(
    (listing) => listing.location?.lat != null && listing.location?.lng != null,
  );
}

function clearHoverTimers() {
  if (hoverShowTimer) {
    clearTimeout(hoverShowTimer);
    hoverShowTimer = undefined;
  }
  if (hoverHideTimer) {
    clearTimeout(hoverHideTimer);
    hoverHideTimer = undefined;
  }
}

function clearBoundsDebounceTimer() {
  if (boundsDebounceTimer) {
    clearTimeout(boundsDebounceTimer);
    boundsDebounceTimer = undefined;
  }
}

function updatePopupPosition() {
  if (!map || !activeMarkerPosition || !projectionOverlay) {
    return;
  }
  const projection = projectionOverlay.getProjection();
  if (!projection) {
    return;
  }
  popupPosition.value = latLngToContainerPixel(map, projection, activeMarkerPosition);
}

function showPopupForListing(listing: Listing, pinned = false) {
  if (unavailableListingIds.value.has(listing.id)) {
    return;
  }

  clearHoverTimers();
  activeListing.value = listing;
  activeMarkerPosition = {
    lat: listing.location!.lat,
    lng: listing.location!.lng,
  };
  popupPinned.value = pinned;
  updatePopupPosition();
  void validateActiveListingStatus(listing.id);
}

function hidePopup(force = false) {
  if (!force && popupPinned.value) {
    return;
  }
  clearHoverTimers();
  activeListing.value = null;
  activeMarkerPosition = null;
  popupPosition.value = null;
  popupPinned.value = false;
}

function scheduleShowPopup(listing: Listing) {
  if (coarsePointer || unavailableListingIds.value.has(listing.id)) {
    return;
  }
  clearHoverTimers();
  hoverShowTimer = setTimeout(() => {
    showPopupForListing(listing, false);
  }, BROWSE_MAP_HOVER_DELAY_MS);
}

function scheduleHidePopup() {
  if (coarsePointer || popupPinned.value) {
    return;
  }
  clearHoverTimers();
  hoverHideTimer = setTimeout(() => {
    hidePopup();
  }, BROWSE_MAP_HIDE_DELAY_MS);
}

function onPopupMouseEnter() {
  clearHoverTimers();
}

function onPopupMouseLeave() {
  scheduleHidePopup();
}

function attachMarkerListeners(marker: google.maps.Marker, listing: Listing) {
  markerListeners.push(
    marker.addListener('click', () => {
      if (unavailableListingIds.value.has(listing.id)) {
        return;
      }
      if (activeListing.value?.id === listing.id && popupPinned.value) {
        hidePopup(true);
        return;
      }
      showPopupForListing(listing, true);
    }),
  );

  if (!coarsePointer) {
    markerListeners.push(
      marker.addListener('mouseover', () => {
        scheduleShowPopup(listing);
      }),
    );
    markerListeners.push(
      marker.addListener('mouseout', () => {
        scheduleHidePopup();
      }),
    );
  }
}

function detachMarkerListeners() {
  markerListeners.forEach((listener) => listener.remove());
  markerListeners = [];
}

function ensureProjectionOverlay(activeMap: google.maps.Map) {
  if (projectionOverlay) {
    return;
  }
  projectionOverlay = new google.maps.OverlayView();
  projectionOverlay.onAdd = () => {};
  projectionOverlay.draw = () => {};
  projectionOverlay.onRemove = () => {};
  projectionOverlay.setMap(activeMap);
}

function emitViewportBounds() {
  if (!map) {
    return;
  }

  const bounds = map.getBounds();
  if (!bounds) {
    return;
  }

  const zoom = map.getZoom() ?? 10;
  const viewport = viewportBoundsToSearch(bounds, zoom);
  const boundsKey = [
    viewport.north.toFixed(4),
    viewport.south.toFixed(4),
    viewport.east.toFixed(4),
    viewport.west.toFixed(4),
    String(viewport.zoom),
  ].join(':');

  if (boundsKey === lastBoundsKey) {
    return;
  }

  lastBoundsKey = boundsKey;
  emit('bounds-change', viewport);
}

function scheduleViewportBoundsEmit() {
  clearBoundsDebounceTimer();
  boundsDebounceTimer = setTimeout(() => {
    emitViewportBounds();
  }, BROWSE_MAP_BOUNDS_DEBOUNCE_MS);
}

function attachMapListeners(activeMap: google.maps.Map) {
  mapListeners.push(
    activeMap.addListener('click', () => {
      hidePopup(true);
    }),
  );

  const reposition = () => {
    updatePopupPosition();
  };
  mapListeners.push(activeMap.addListener('bounds_changed', reposition));
  mapListeners.push(activeMap.addListener('zoom_changed', reposition));
  mapListeners.push(activeMap.addListener('dragend', reposition));

  mapListeners.push(
    activeMap.addListener('dragstart', () => {
      userHasMovedMap = true;
    }),
  );
  mapListeners.push(
    activeMap.addListener('zoom_changed', () => {
      userHasMovedMap = true;
    }),
  );
  mapListeners.push(activeMap.addListener('idle', scheduleViewportBoundsEmit));
}

function resolveInitialCenter(): google.maps.LatLngLiteral {
  if (props.center) {
    return { lat: props.center.lat, lng: props.center.lng };
  }

  const located = listingsWithLocation();
  if (located[0]?.location) {
    return { lat: located[0].location.lat, lng: located[0].location.lng };
  }

  return { lat: 38.75, lng: -77.47 };
}

async function ensureMapInitialized() {
  if (!mapContainerRef.value || !isGoogleMapsConfigured()) {
    return false;
  }

  await loadMapsLibrary();

  if (!map) {
    map = new google.maps.Map(mapContainerRef.value, {
      center: resolveInitialCenter(),
      zoom: (props.center || listingsWithLocation().length <= 1) ? 11 : 10,
      mapId: 'firmshake-browse-map',
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
      styles: BROWSE_MAP_STYLES,
    });
    ensureProjectionOverlay(map);
    attachMapListeners(map);
  }

  return Boolean(map);
}

async function syncMarkers() {
  if (!(await ensureMapInitialized()) || !map) {
    return;
  }

  const located = listingsWithLocation();
  const idsKey = located.map((listing) => listing.id).join(',');
  if (idsKey === lastMarkerListingIds) {
    return;
  }
  lastMarkerListingIds = idsKey;

  const activeMap = map;
  const { Marker } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;

  detachMarkerListeners();
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
  markersByListingId.clear();
  markers = located.map((listing) => {
    const unavailable = unavailableListingIds.value.has(listing.id);
    const marker = new Marker({
      map: activeMap,
      position: { lat: listing.location!.lat, lng: listing.location!.lng },
      title: listing.title,
      opacity: unavailable ? 0.35 : 1,
      clickable: !unavailable,
    }) as google.maps.Marker;
    markersByListingId.set(listing.id, marker);
    attachMarkerListeners(marker, listing);
    return marker;
  });

  clusterer?.clearMarkers();
  try {
    const { MarkerClusterer } = await import('@googlemaps/markerclusterer');
    clusterer = new MarkerClusterer({
      map: activeMap,
      markers,
      onClusterClick: (_event, cluster, mapInstance) => {
        hidePopup(true);
        const bounds = cluster.bounds;
        if (bounds) {
          mapInstance.fitBounds(bounds);
        }
      },
    });
  } catch {
    markers.forEach((marker) => marker.setMap(activeMap));
  }

  if (!userHasMovedMap && located.length > 1) {
    const bounds = new google.maps.LatLngBounds();
    located.forEach((listing) => {
      bounds.extend({ lat: listing.location!.lat, lng: listing.location!.lng });
    });
    activeMap.fitBounds(bounds, 48);
  }

  if (activeListing.value) {
    const stillVisible = located.find((listing) => listing.id === activeListing.value?.id);
    if (stillVisible) {
      showPopupForListing(stillVisible, popupPinned.value);
    } else {
      hidePopup(true);
    }
  }
}

watch(
  () => props.listings,
  () => {
    void syncMarkers();
  },
  { deep: true },
);

watch(
  () => [props.center?.lat, props.center?.lng, props.centerRadiusMiles] as const,
  ([lat, lng]) => {
    if (!map || lat == null || lng == null) {
      return;
    }
    fitMapToRadius({ lat, lng }, resolveCenterRadiusMiles());
  },
);

watch(
  () => props.addressQuery,
  (value) => {
    if (value != null && value !== localAddressQuery.value) {
      localAddressQuery.value = value;
    }
  },
);

onMounted(() => {
  void ensureMapInitialized().then(() => {
    void syncMarkers();
    scheduleViewportBoundsEmit();
  });
});

onUnmounted(() => {
  clearHoverTimers();
  clearBoundsDebounceTimer();
  detachMarkerListeners();
  mapListeners.forEach((listener) => listener.remove());
  mapListeners = [];
  clusterer?.clearMarkers();
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
  projectionOverlay?.setMap(null);
  projectionOverlay = undefined;
  map = undefined;
  clusterer = undefined;
});
</script>

<style scoped>
.browse-map-wrap {
  position: relative;
  width: 100%;
}

.browse-map-toolbar {
  margin-bottom: 0.65rem;
}

.browse-map-toolbar__search {
  --background: var(--ion-color-step-50, rgba(255, 255, 255, 0.06));
  --border-radius: 8px;
  padding: 0;
}

.browse-map-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.browse-map-toolbar__error {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  color: var(--ion-color-danger, #eb445a);
  line-height: 1.35;
}

.browse-map-view {
  width: 100%;
  min-height: 320px;
  height: min(55vh, 520px);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.12));
}

.browse-map-loading {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.map-listing-popup {
  position: absolute;
  z-index: 2;
  width: min(280px, calc(100% - 24px));
  transform: translate(-50%, calc(-100% - 14px));
  border-radius: 12px;
  overflow: hidden;
  background: var(--ion-background-color, #121212);
  border: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.12));
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
}

.map-listing-popup__media {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--ion-color-step-100, rgba(255, 255, 255, 0.08));
  overflow: hidden;
}

.map-listing-popup__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.map-listing-popup__body {
  padding: 12px 14px 14px;
}

.map-listing-popup__title {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ion-text-color, #fff);
}

.map-listing-popup__price {
  margin: 0 0 8px;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ion-color-primary, #3880ff);
}

.map-listing-popup__description {
  margin: 0 0 12px;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--ion-color-step-600, rgba(255, 255, 255, 0.7));
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.map-listing-popup__cta {
  display: block;
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  text-align: center;
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ion-color-primary-contrast, #fff);
  background: var(--ion-color-primary, #3880ff);
}

.map-listing-popup__cta:hover,
.map-listing-popup__cta:focus-visible {
  filter: brightness(1.08);
}

.map-listing-popup__unavailable {
  margin: 0 0 12px;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--ion-color-warning, #ffc409);
}

.map-listing-popup__cta--disabled {
  display: block;
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  text-align: center;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ion-color-step-500, rgba(255, 255, 255, 0.55));
  background: var(--ion-color-step-100, rgba(255, 255, 255, 0.08));
  cursor: not-allowed;
  pointer-events: none;
}

.map-popup-fade-enter-active,
.map-popup-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.map-popup-fade-enter-from,
.map-popup-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-100% - 10px)) scale(0.98);
}
</style>
