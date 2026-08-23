<template>
  <div class="browse-geo-filter">
    <p v-if="isLocating" class="hint">Finding your location…</p>
    <p v-else-if="geoError" class="hint">{{ geoError }}</p>
    <p v-else-if="centerLabel" class="center-label">
      Near {{ centerLabel }}
    </p>
    <p v-else class="hint">Set a location to search nearby listings.</p>

    <div class="radius-block">
      <ion-select
        :value="modelValue.radiusMiles"
        :interface="selectInterface"
        class="radius-select"
        aria-label="Search radius in miles"
        @ionChange="onRadiusChange"
      >
        <ion-select-option
          v-for="option in RADIUS_OPTIONS_MILES"
          :key="option"
          :value="option"
        >
          Within {{ option }} mi
        </ion-select-option>
      </ion-select>
    </div>

    <div class="location-actions">
      <ion-button
        expand="block"
        fill="outline"
        size="small"
        :disabled="isLocating"
        @click="useMyLocation"
      >
        {{ isLocating ? 'Locating…' : 'Use my location' }}
      </ion-button>
    </div>

    <div class="address-block">
      <AddressAutocomplete
        :model-value="addressLocation"
        placeholder="Or search an address"
        :show-current-location="false"
        @update:model-value="onAddressSelected"
      />
    </div>

    <ion-note v-if="!apiConfigured" class="api-hint">
      Distance search uses cached listings when the API is unavailable; results may be incomplete.
    </ion-note>

    <ion-button
      v-if="hasActiveCenter"
      expand="block"
      fill="clear"
      size="small"
      class="clear-btn"
      @click="clearFilter"
    >
      Clear distance filter
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonButton,
  IonNote,
  IonSelect,
  IonSelectOption,
} from '@ionic/vue';

import { useIonSelectInterface } from '@/common/composables/useIonSelectInterface';
import AddressAutocomplete from '@/components/AddressAutocomplete.vue';

const { selectInterface } = useIonSelectInterface();
import {
  getCurrentCoordinates,
  getGeolocationErrorMessage,
} from '@/common/services/locationTracking';
import {
  parseCityRegionFromAddress,
  type GeoFilterState,
} from '@/features/listings/services/geoFilterStorage';
import {
  normalizeRadiusMiles,
  RADIUS_OPTIONS_MILES,
} from '@/features/listings/utils/geoDistance';
import { logGeoFilterInputChanged } from '@/features/listings/utils/geoDebugLog';
import type { MeetupLocation } from '@/features/meetups/types/meetupLocation';
import { isApiConfigured } from '@/utils/apiBaseUrl';
import { reverseGeocodeCoordinates, reverseGeocodeCityRegion, isGoogleMapsConfigured } from '@/utils/googleMaps';

const props = defineProps<{
  modelValue: GeoFilterState & { locating?: boolean };
  /** When set, location/address picks use this radius (e.g. map view default 5 mi). */
  defaultLocationRadiusMiles?: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: GeoFilterState & { locating?: boolean }];
  apply: [];
}>();

const geoError = ref('');
const locatingLocally = ref(false);
const apiConfigured = isApiConfigured();
let radiusDebounceTimer: ReturnType<typeof setTimeout> | undefined;

const isLocating = computed(
  () => locatingLocally.value || Boolean(props.modelValue.locating),
);

const centerLabel = computed(() => {
  if (props.modelValue.label) {
    return props.modelValue.label;
  }
  if (props.modelValue.lat != null && props.modelValue.lng != null) {
    return 'your location';
  }
  return '';
});

const hasActiveCenter = computed(
  () => props.modelValue.lat != null && props.modelValue.lng != null,
);

const addressLocation = computed<MeetupLocation | null>(() => {
  if (props.modelValue.lat == null || props.modelValue.lng == null) {
    return null;
  }

  return {
    address: props.modelValue.label || 'Selected location',
    lat: props.modelValue.lat,
    lng: props.modelValue.lng,
  };
});

function emitState(patch: Partial<GeoFilterState & { locating?: boolean }>) {
  const next = { ...props.modelValue, enabled: true, ...patch };
  emit('update:modelValue', next);
}

function onRadiusChange(event: CustomEvent) {
  const radiusMiles = normalizeRadiusMiles(Number(event.detail.value));
  const next = { ...props.modelValue, enabled: true, radiusMiles };
  logGeoFilterInputChanged(next, 'radius');
  emitState({ radiusMiles });

  if (radiusDebounceTimer) {
    clearTimeout(radiusDebounceTimer);
  }
  radiusDebounceTimer = setTimeout(() => {
    if (hasActiveCenter.value) {
      emit('apply');
    }
  }, 300);
}

function resolveLocationRadiusMiles(): number {
  if (props.defaultLocationRadiusMiles != null) {
    return normalizeRadiusMiles(props.defaultLocationRadiusMiles);
  }

  return props.modelValue.radiusMiles;
}

function resolveCenterFromGeolocation() {
  locatingLocally.value = true;
  emitState({ locating: true });
  geoError.value = '';

  const coordsPromise = getCurrentCoordinates();

  void coordsPromise
    .then(async (coords) => {
      let label = 'Your location';
      let city = '';
      let region = '';

      if (isGoogleMapsConfigured()) {
        try {
          label = await reverseGeocodeCoordinates(coords.lat, coords.lng);
          const cityRegion = await reverseGeocodeCityRegion(coords.lat, coords.lng);
          city = cityRegion.city ?? '';
          region = cityRegion.region ?? '';
        } catch {
          // Keep generic label when reverse geocode fails.
        }
      }

      const next = {
        ...props.modelValue,
        enabled: true,
        lat: coords.lat,
        lng: coords.lng,
        label,
        city,
        region,
        radiusMiles: resolveLocationRadiusMiles(),
        locating: false,
      };
      logGeoFilterInputChanged(next, 'geolocation');
      emitState({
        lat: coords.lat,
        lng: coords.lng,
        label,
        city,
        region,
        radiusMiles: resolveLocationRadiusMiles(),
        locating: false,
      });
      emit('apply');
    })
    .catch((error: unknown) => {
      geoError.value = getGeolocationErrorMessage(error);
      emitState({ locating: false });
    })
    .finally(() => {
      locatingLocally.value = false;
    });
}

function useMyLocation() {
  resolveCenterFromGeolocation();
}

function onAddressSelected(location: MeetupLocation | null) {
  geoError.value = '';

  if (!location) {
    const cleared = {
      ...props.modelValue,
      enabled: true,
      lat: null,
      lng: null,
      label: '',
      city: '',
      region: '',
    };
    logGeoFilterInputChanged(cleared, 'address', { addressCleared: true });
    emitState({ lat: null, lng: null, label: '', city: '', region: '' });
    return;
  }

  const shortLabel = shortenAddressLabel(location.address);
  const { city, region } = parseCityRegionFromAddress(location.address);
  const radiusMiles = resolveLocationRadiusMiles();
  const next = {
    ...props.modelValue,
    enabled: true,
    lat: location.lat,
    lng: location.lng,
    label: shortLabel,
    city,
    region,
    radiusMiles,
    locating: false,
  };
  logGeoFilterInputChanged(next, 'address', {
    fullAddress: location.address,
  });
  emitState({
    lat: location.lat,
    lng: location.lng,
    label: shortLabel,
    city,
    region,
    radiusMiles,
    locating: false,
  });
  emit('apply');
}

function shortenAddressLabel(address: string): string {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1]}`;
  }
  return address;
}

function clearFilter() {
  geoError.value = '';
  const next = {
    ...props.modelValue,
    enabled: true,
    lat: null,
    lng: null,
    label: '',
    city: '',
    region: '',
    locating: false,
  };
  logGeoFilterInputChanged(next, 'clear');
  emitState({
    lat: null,
    lng: null,
    label: '',
    city: '',
    region: '',
    locating: false,
  });
  emit('apply');
}

</script>

<style scoped>
.browse-geo-filter {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--fs-space-xs);
}

.center-label {
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
  color: var(--ion-color-success-shade);
  line-height: 1.35;
}

.hint {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  line-height: 1.35;
}

.radius-block {
  margin-top: 0.25rem;
}

.radius-select {
  width: 100%;
  max-width: 100%;
  --padding-start: 0;
  --padding-end: 0;
  font-size: 0.88rem;
}

.location-actions {
  margin: var(--fs-space-xs) 0;
}

.address-block :deep(.address-field) {
  padding: 0;
}

.address-block :deep(.hint) {
  margin-left: 0;
  margin-right: 0;
}

.address-block :deep(.location-btn) {
  margin-left: 0;
  margin-right: 0;
}

.api-hint {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--ion-color-medium);
}

.clear-btn {
  margin-top: 0.25rem;
  --padding-start: 0;
  --padding-end: 0;
}
</style>
