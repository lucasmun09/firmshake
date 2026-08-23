<template>
  <div class="browse-map-wrap">
    <div class="browse-map-toolbar">
      <div class="browse-map-toolbar__address-row">
        <label class="browse-map-toolbar__label" for="browse-map-address-search">
          Nearby address
        </label>
        <ion-searchbar
          id="browse-map-address-search"
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
      </div>
      <p v-if="geoError" class="browse-map-toolbar__error">{{ geoError }}</p>
    </div>
    <div class="browse-map-container">
      <div
        ref="mapContainerRef"
        class="browse-map-view"
        :class="{ 'browse-map-view--blocked': communityLoading }"
        aria-label="Listings map"
      />
      <Transition name="map-community-loading">
        <div
          v-if="communityLoading"
          class="browse-map-community-loading"
          aria-busy="true"
          aria-live="polite"
        >
          <ion-spinner name="circular" />
          <span>Loading listings…</span>
        </div>
      </Transition>
      <Transition name="map-loading-banner">
        <div
          v-if="loading && !communityLoading"
          class="browse-map-loading-banner"
          aria-busy="true"
          aria-live="polite"
        >
          <ion-spinner name="crescent" />
          <span>Loading more listings</span>
        </div>
      </Transition>
      <Transition name="map-popup-fade">
        <article
          v-if="activePinGroup && popupPosition"
          ref="popupRef"
          class="map-listing-popup"
          :class="{ 'map-listing-popup--aggregated': activePinGroup.kind === 'aggregated' }"
          :style="popupStyle"
          role="dialog"
          :aria-label="activePopupAriaLabel"
          @mouseenter="onPopupMouseEnter"
          @mouseleave="onPopupMouseLeave"
          @click.stop
        >
          <template v-if="activePinGroup.kind === 'single'">
            <div
              v-if="activeSingleListing?.imageUrl"
              class="map-listing-popup__media"
              @dblclick.prevent.stop="onPopupListingDoubleClick(activeSingleListing)"
            >
              <ListingBookmarkButton
                v-if="activeSingleListing"
                class="map-listing-popup__bookmark"
                :saved="isPopupListingSaved(activeSingleListing.id)"
                @toggle="onPopupBookmarkToggle(activeSingleListing)"
              />
              <AuthenticatedImage
                :src="activeSingleListing.imageUrl"
                :alt="activeSingleListing.title"
                variant="thumbnail"
                class="map-listing-popup__image"
              />
            </div>
            <div
              class="map-listing-popup__body"
              @dblclick.prevent.stop="activeSingleListing && onPopupListingDoubleClick(activeSingleListing)"
            >
              <h3 class="map-listing-popup__title">{{ activeSingleListing?.title }}</h3>
              <p class="map-listing-popup__price">{{ formatPrice(activeSingleListing?.price ?? 0) }}</p>
              <p v-if="activeSingleListing?.description" class="map-listing-popup__description">
                {{ truncateDescription(activeSingleListing.description) }}
              </p>
              <p v-if="isActiveSingleListingUnavailable" class="map-listing-popup__unavailable">
                This listing is no longer available.
              </p>
              <RouterLink
                v-if="activeSingleListing && !isActiveSingleListingUnavailable"
                :to="listingDetailPath(activeSingleListing.id)"
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
          </template>
          <template v-else>
            <div class="map-listing-popup__body map-listing-popup__body--aggregated">
              <h3 class="map-listing-popup__title">
                {{ activePinGroup.listings.length }} listings here
              </h3>
              <ul class="map-listing-popup__list">
                <li
                  v-for="listing in activePinGroup.listings"
                  :key="listing.id"
                  class="map-listing-popup__list-item"
                >
                  <div
                    v-if="!isListingUnavailable(listing.id)"
                    class="map-listing-popup__row"
                    role="link"
                    tabindex="0"
                    @click="onPopupRowClick(listing)"
                    @dblclick.prevent.stop="onPopupListingDoubleClick(listing)"
                    @keyup.enter="onPopupRowClick(listing)"
                  >
                    <ListingBookmarkButton
                      class="map-listing-popup__row-bookmark"
                      :saved="isPopupListingSaved(listing.id)"
                      @toggle="onPopupBookmarkToggle(listing)"
                    />
                    <div v-if="listing.imageUrl" class="map-listing-popup__row-media">
                      <AuthenticatedImage
                        :src="listing.imageUrl"
                        :alt="listing.title"
                        variant="thumbnail"
                        class="map-listing-popup__row-image"
                      />
                    </div>
                    <div class="map-listing-popup__row-body">
                      <span class="map-listing-popup__row-title">{{ listing.title }}</span>
                      <span class="map-listing-popup__row-price">{{ formatPrice(listing.price) }}</span>
                    </div>
                  </div>
                  <div
                    v-else
                    class="map-listing-popup__row map-listing-popup__row--unavailable"
                    aria-disabled="true"
                  >
                    <div v-if="listing.imageUrl" class="map-listing-popup__row-media">
                      <AuthenticatedImage
                        :src="listing.imageUrl"
                        :alt="listing.title"
                        variant="thumbnail"
                        class="map-listing-popup__row-image"
                      />
                    </div>
                    <div class="map-listing-popup__row-body">
                      <span class="map-listing-popup__row-title">{{ listing.title }}</span>
                      <span class="map-listing-popup__row-unavailable">No longer available</span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </template>
        </article>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { IonButton, IonSearchbar, IonSpinner } from '@ionic/vue';

import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import ListingBookmarkButton from '@/features/listings/components/ListingBookmarkButton.vue';
import {
  resolveListingPrefsUid,
  savedListingsRevision,
  useListingBookmark,
} from '@/features/listings/composables/useListingBookmark';
import { getSavedListings } from '@/features/listings/services/savedListings';
import {
  getCurrentCoordinates,
  getGeolocationErrorMessage,
} from '@/common/services/locationTracking';
import {
  BROWSE_MAP_BOUNDS_DEBOUNCE_MS,
  BROWSE_MAP_DEFAULT_RADIUS_MILES,
  BROWSE_MAP_HIDE_DELAY_MS,
  BROWSE_MAP_HOVER_DELAY_MS,
  BROWSE_MAP_POPUP_ANCHOR_OFFSET_PX,
  BROWSE_MAP_POPUP_DISMISS_EVENTS,
  BROWSE_MAP_POPUP_REPOSITION_EVENTS,
  BROWSE_MAP_STYLES,
  computePinClickPanByOffset,
  isCoarsePointer,
  latLngBoundsForRadius,
  latLngToContainerPixel,
  listingDetailPath,
  truncateDescription,
  viewportBoundsToSearch,
  type MapGeoSearchPayload,
  type MapViewportSearch,
} from '@/features/listings/utils/browseMapView';
import {
  aggregateBrowseMapPins,
  browseMapPinGroupHasAvailableListing,
  browseMapPinGroupsSyncKey,
  browseMapPinIconConfig,
  browseMapPinLabelConfig,
  isBrowseMapPinGroupFullyUnavailable,
  shouldPanMapOnPinClick,
  type BrowseMapPinGroup,
} from '@/features/listings/utils/browseMapPinAggregation';
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
  serverPinGroups?: BrowseMapPinGroup[] | null;
  center?: { lat: number; lng: number } | null;
  centerRadiusMiles?: number;
  addressQuery?: string;
  loading?: boolean;
  communityLoading?: boolean;
}>();

const emit = defineEmits<{
  'bounds-change': [viewport: MapViewportSearch];
  'geo-search': [payload: MapGeoSearchPayload];
  'listing-unavailable': [listingId: string];
  'update:addressQuery': [value: string];
}>();

const router = useRouter();
const { toggleBookmark } = useListingBookmark(() => '');
const popupSavedIds = computed(() => {
  savedListingsRevision.value;
  return new Set(getSavedListings(resolveListingPrefsUid()).map((entry) => entry.id));
});

let popupRowClickTimer: ReturnType<typeof setTimeout> | null = null;

const mapContainerRef = ref<HTMLElement | null>(null);
const popupRef = ref<HTMLElement | null>(null);
const localAddressQuery = ref(props.addressQuery ?? '');
const geoBusy = ref(false);
const geoError = ref('');
const activePinGroup = ref<BrowseMapPinGroup | null>(null);
const popupPosition = ref<{ x: number; y: number } | null>(null);
const popupPinned = ref(false);
const unavailableListingIds = ref<Set<string>>(new Set());
const statusCheckTokens = new Map<string, number>();

let map: google.maps.Map | undefined;
let clusterer: { clearMarkers: () => void; addMarkers: (markers: google.maps.Marker[]) => void } | undefined;
let markers: google.maps.Marker[] = [];
let markersByPinKey = new Map<string, google.maps.Marker>();
let pinKeyByListingId = new Map<string, string>();
let markerListeners: google.maps.MapsEventListener[] = [];
let mapListeners: google.maps.MapsEventListener[] = [];
let projectionOverlay: google.maps.OverlayView | undefined;
let hoverShowTimer: ReturnType<typeof setTimeout> | undefined;
let hoverHideTimer: ReturnType<typeof setTimeout> | undefined;
let boundsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let activeMarkerPosition: google.maps.LatLngLiteral | null = null;
let userHasMovedMap = false;
let lastBoundsKey = '';
let lastPinGroupsSyncKey = '';
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

function goToCurrentLocation() {
  geoError.value = '';
  geoBusy.value = true;

  const coordsPromise = getCurrentCoordinates();

  void coordsPromise
    .then(async (coords) => {
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
    })
    .catch((error: unknown) => {
      geoError.value = getGeolocationErrorMessage(error);
    })
    .finally(() => {
      geoBusy.value = false;
    });
}

const popupStyle = computed(() => {
  if (!popupPosition.value) {
    return undefined;
  }
  return {
    left: `${popupPosition.value.x}px`,
    top: `${popupPosition.value.y}px`,
    transform: `translate(-50%, calc(-100% - ${BROWSE_MAP_POPUP_ANCHOR_OFFSET_PX}px))`,
  };
});

const activeSingleListing = computed(() =>
  activePinGroup.value?.kind === 'single' ? activePinGroup.value.listings[0] : null,
);

const activePopupAriaLabel = computed(() => {
  if (!activePinGroup.value) {
    return '';
  }
  if (activePinGroup.value.kind === 'single') {
    return activePinGroup.value.listings[0]?.title ?? 'Listing';
  }
  return `${activePinGroup.value.listings.length} listings here`;
});

const isActiveSingleListingUnavailable = computed(() => {
  const listingId = activeSingleListing.value?.id;
  return listingId ? unavailableListingIds.value.has(listingId) : false;
});

function isListingUnavailable(listingId: string): boolean {
  return unavailableListingIds.value.has(listingId);
}

function isPopupListingSaved(listingId: string): boolean {
  return popupSavedIds.value.has(listingId);
}

function onPopupRowClick(listing: Listing) {
  if (popupRowClickTimer) {
    clearTimeout(popupRowClickTimer);
  }

  popupRowClickTimer = setTimeout(() => {
    void router.push(listingDetailPath(listing.id));
    popupRowClickTimer = null;
  }, 250);
}

async function onPopupBookmarkToggle(listing: Listing) {
  if (popupRowClickTimer) {
    clearTimeout(popupRowClickTimer);
    popupRowClickTimer = null;
  }
  await toggleBookmark(listing);
}

async function onPopupListingDoubleClick(listing: Listing) {
  if (popupRowClickTimer) {
    clearTimeout(popupRowClickTimer);
    popupRowClickTimer = null;
  }
  await toggleBookmark(listing);
}

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
  void unavailable;
  const pinKey = pinKeyByListingId.get(listingId);
  if (!pinKey) {
    return;
  }

  const marker = markersByPinKey.get(pinKey);
  const pinGroup = aggregateBrowseMapPins(listingsWithLocation()).find((group) => group.key === pinKey);
  if (!marker || !pinGroup) {
    return;
  }

  const fullyUnavailable = isBrowseMapPinGroupFullyUnavailable(
    pinGroup,
    unavailableListingIds.value,
  );
  marker.setOpacity(fullyUnavailable ? 0.35 : 1);
  marker.setClickable(!fullyUnavailable);
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

function panMapToPinGroup(pinGroup: BrowseMapPinGroup, popupHeightPx?: number) {
  if (!map) {
    return;
  }

  const markerLatLng = { lat: pinGroup.position.lat, lng: pinGroup.position.lng };
  const container = mapContainerRef.value;

  map.panTo(markerLatLng);

  if (container) {
    const panByY = computePinClickPanByOffset(container.clientHeight, popupHeightPx);
    if (panByY !== 0) {
      map.panBy(0, panByY);
    }
  }
}

async function refinePanForMeasuredPopup(pinned: boolean) {
  if (!pinned || !map || !activeMarkerPosition) {
    return;
  }

  await nextTick();
  const popupEl = popupRef.value;
  const container = mapContainerRef.value;
  if (!popupEl || !container) {
    return;
  }

  const measuredHeight = popupEl.offsetHeight;
  if (measuredHeight <= 0) {
    return;
  }

  const panByY = computePinClickPanByOffset(container.clientHeight, measuredHeight);
  map.panTo(activeMarkerPosition);
  if (panByY !== 0) {
    map.panBy(0, panByY);
  }
}

async function validatePinGroupListingStatuses(pinGroup: BrowseMapPinGroup) {
  await Promise.all(
    pinGroup.listings.map((listing) => validateActiveListingStatus(listing.id)),
  );
}

function showPopupForPinGroup(pinGroup: BrowseMapPinGroup, pinned = false) {
  if (!browseMapPinGroupHasAvailableListing(pinGroup, unavailableListingIds.value)) {
    return;
  }

  clearHoverTimers();
  activePinGroup.value = pinGroup;
  activeMarkerPosition = {
    lat: pinGroup.position.lat,
    lng: pinGroup.position.lng,
  };
  popupPinned.value = pinned;
  updatePopupPosition();
  void validatePinGroupListingStatuses(pinGroup);
  if (pinned) {
    void refinePanForMeasuredPopup(true);
  }
}

function hidePopup(force = false) {
  if (!force && popupPinned.value) {
    return;
  }
  clearHoverTimers();
  activePinGroup.value = null;
  activeMarkerPosition = null;
  popupPosition.value = null;
  popupPinned.value = false;
}

function scheduleShowPopup(pinGroup: BrowseMapPinGroup) {
  if (coarsePointer || !browseMapPinGroupHasAvailableListing(pinGroup, unavailableListingIds.value)) {
    return;
  }
  clearHoverTimers();
  hoverShowTimer = setTimeout(() => {
    showPopupForPinGroup(pinGroup, false);
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

function attachMarkerListeners(marker: google.maps.Marker, pinGroup: BrowseMapPinGroup) {
  markerListeners.push(
    marker.addListener('click', () => {
      if (!browseMapPinGroupHasAvailableListing(pinGroup, unavailableListingIds.value)) {
        return;
      }
      if (activePinGroup.value?.key === pinGroup.key && popupPinned.value) {
        hidePopup(true);
        return;
      }
      if (shouldPanMapOnPinClick(activePinGroup.value?.key, pinGroup.key, popupPinned.value)) {
        panMapToPinGroup(pinGroup);
      }
      showPopupForPinGroup(pinGroup, true);
    }),
  );

  if (!coarsePointer) {
    markerListeners.push(
      marker.addListener('mouseover', () => {
        scheduleShowPopup(pinGroup);
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
  projectionOverlay.draw = () => {
    updatePopupPosition();
  };
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
  for (const eventName of BROWSE_MAP_POPUP_REPOSITION_EVENTS) {
    mapListeners.push(activeMap.addListener(eventName, reposition));
  }

  for (const eventName of BROWSE_MAP_POPUP_DISMISS_EVENTS) {
    mapListeners.push(
      activeMap.addListener(eventName, () => {
        if (eventName === 'dragstart') {
          userHasMovedMap = true;
        }
        hidePopup(true);
      }),
    );
  }
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

function buildMarkerIcon(kind: BrowseMapPinGroup['kind']): google.maps.Icon {
  const iconConfig = browseMapPinIconConfig(kind);
  return {
    url: iconConfig.url,
    scaledSize: new google.maps.Size(iconConfig.scaledWidth, iconConfig.scaledHeight),
    anchor: new google.maps.Point(iconConfig.anchorX, iconConfig.anchorY),
  };
}

async function syncMarkers() {
  if (!(await ensureMapInitialized()) || !map) {
    return;
  }

  const located = listingsWithLocation();
  const pinGroups =
    props.serverPinGroups && props.serverPinGroups.length > 0
      ? props.serverPinGroups
      : aggregateBrowseMapPins(located);
  const syncKey = browseMapPinGroupsSyncKey(pinGroups);
  if (syncKey === lastPinGroupsSyncKey) {
    return;
  }
  lastPinGroupsSyncKey = syncKey;

  const activeMap = map;
  const { Marker } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;

  detachMarkerListeners();
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
  markersByPinKey.clear();
  pinKeyByListingId.clear();

  markers = pinGroups.map((pinGroup) => {
    const fullyUnavailable = isBrowseMapPinGroupFullyUnavailable(
      pinGroup,
      unavailableListingIds.value,
    );
    const labelConfig = browseMapPinLabelConfig(pinGroup);
    const marker = new Marker({
      map: activeMap,
      position: pinGroup.position,
      title:
        pinGroup.kind === 'aggregated'
          ? `${pinGroup.listings.length} listings`
          : pinGroup.listings[0]?.title,
      icon: buildMarkerIcon(pinGroup.kind),
      label: labelConfig,
      opacity: fullyUnavailable ? 0.35 : 1,
      clickable: !fullyUnavailable,
    }) as google.maps.Marker;

    markersByPinKey.set(pinGroup.key, marker);
    for (const listing of pinGroup.listings) {
      pinKeyByListingId.set(listing.id, pinGroup.key);
    }
    attachMarkerListeners(marker, pinGroup);
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

  if (!userHasMovedMap && pinGroups.length > 1) {
    const bounds = new google.maps.LatLngBounds();
    pinGroups.forEach((pinGroup) => {
      bounds.extend(pinGroup.position);
    });
    activeMap.fitBounds(bounds, 48);
  }

  if (activePinGroup.value) {
    const stillVisible = pinGroups.find((pinGroup) => pinGroup.key === activePinGroup.value?.key);
    if (stillVisible) {
      showPopupForPinGroup(stillVisible, popupPinned.value);
    } else {
      hidePopup(true);
    }
  }
}

watch(
  () => [props.listings, props.serverPinGroups] as const,
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

.browse-map-toolbar__address-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.browse-map-toolbar__label {
  flex: 0 0 auto;
  margin: 0;
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.3;
  color: var(--ion-color-step-600, rgba(255, 255, 255, 0.72));
  white-space: nowrap;
}

.browse-map-toolbar__search {
  flex: 1 1 180px;
  min-width: 0;
  --background: var(--ion-color-step-50, rgba(255, 255, 255, 0.06));
  --border-radius: 8px;
  padding: 0;
}

.browse-map-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex: 0 0 auto;
}

.browse-map-toolbar__error {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  color: var(--ion-color-danger, #eb445a);
  line-height: 1.35;
}

.browse-map-container {
  position: relative;
  width: 100%;
}

.browse-map-view {
  width: 100%;
  min-height: 320px;
  height: min(55vh, 520px);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.12));
}

.browse-map-view--blocked {
  pointer-events: none;
}

.browse-map-community-loading {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.3;
  pointer-events: all;
}

.browse-map-community-loading ion-spinner {
  width: 32px;
  height: 32px;
}

.map-community-loading-enter-active,
.map-community-loading-leave-active {
  transition: opacity 0.2s ease;
}

.map-community-loading-enter-from,
.map-community-loading-leave-to {
  opacity: 0;
}

.browse-map-loading-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem;
  border-radius: 8px 8px 0 0;
  background: rgba(18, 18, 18, 0.82);
  border-bottom: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.12));
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.3;
  color: #fff;
  pointer-events: none;
  backdrop-filter: blur(4px);
}

.browse-map-loading-banner ion-spinner {
  width: 18px;
  height: 18px;
}

.map-loading-banner-enter-active,
.map-loading-banner-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.map-loading-banner-enter-from,
.map-loading-banner-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.map-listing-popup {
  position: absolute;
  z-index: 2;
  width: min(280px, calc(100% - 24px));
  /* transform set inline from BROWSE_MAP_POPUP_ANCHOR_OFFSET_PX */
  border-radius: 12px;
  overflow: hidden;
  background: var(--ion-background-color);
  border: 1px solid var(--ion-color-step-150);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
}

.map-listing-popup__media {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--ion-color-step-100, rgba(255, 255, 255, 0.08));
  overflow: hidden;
}

.map-listing-popup__bookmark {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  z-index: 2;
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
  color: var(--ion-text-color);
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

.map-listing-popup--aggregated {
  width: min(320px, calc(100% - 24px));
}

.map-listing-popup__body--aggregated {
  padding-bottom: 10px;
}

.map-listing-popup__list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  max-height: min(280px, 45vh);
  overflow-y: auto;
}

.map-listing-popup__list-item + .map-listing-popup__list-item {
  margin-top: 0.35rem;
}

.map-listing-popup__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 0.5rem;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  background: var(--ion-color-step-50, rgba(255, 255, 255, 0.04));
  border: 1px solid transparent;
  cursor: pointer;
}

.map-listing-popup__row-bookmark {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  z-index: 2;
  width: 1.65rem;
  height: 1.65rem;
}

.map-listing-popup__row-bookmark ion-icon {
  font-size: 0.95rem;
}

.map-listing-popup__row:hover,
.map-listing-popup__row:focus-visible {
  border-color: var(--ion-color-step-150, rgba(255, 255, 255, 0.12));
  filter: brightness(1.05);
}

.map-listing-popup__row--unavailable {
  opacity: 0.55;
  cursor: not-allowed;
}

.map-listing-popup__row-media {
  flex: 0 0 52px;
  width: 52px;
  height: 52px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--ion-color-step-100, rgba(255, 255, 255, 0.08));
}

.map-listing-popup__row-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.map-listing-popup__row-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.map-listing-popup__row-title {
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ion-text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.map-listing-popup__row-price {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ion-color-primary, #3880ff);
}

.map-listing-popup__row-unavailable {
  font-size: 0.78rem;
  color: var(--ion-color-warning, #ffc409);
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
  transform: translate(-50%, calc(-100% - 72px)) scale(0.98);
}
</style>
