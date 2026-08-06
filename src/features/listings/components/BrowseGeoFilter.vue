<template>
  <div class="browse-geo-filter">
    <ion-item lines="none" class="toggle-row">
      <ion-toggle
        :checked="modelValue.enabled"
        @ionChange="onToggle"
      >
        Search by distance
      </ion-toggle>
    </ion-item>

    <template v-if="modelValue.enabled">
      <p v-if="centerLabel" class="center-label">
        Near {{ centerLabel }}
      </p>
      <p v-else-if="modelValue.locating" class="hint">Finding your location…</p>
      <p v-else-if="geoError" class="hint warning">{{ geoError }}</p>
      <p v-else class="hint">Set a location to search nearby listings.</p>

      <div class="radius-block">
        <ion-label class="radius-label">Within {{ modelValue.radiusMiles }} mi</ion-label>
        <ion-range
          :min="MIN_RADIUS_MILES"
          :max="MAX_RADIUS_MILES"
          :step="5"
          :value="modelValue.radiusMiles"
          @ionInput="onRadiusInput"
        />
      </div>

      <div class="location-actions">
        <ion-button
          expand="block"
          fill="outline"
          size="small"
          :disabled="modelValue.locating"
          @click="useMyLocation"
        >
          {{ modelValue.locating ? 'Locating…' : 'Use my location' }}
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonRange,
  IonToggle,
} from '@ionic/vue';

import AddressAutocomplete from '@/components/AddressAutocomplete.vue';
import { getCurrentCoordinates } from '@/common/services/locationTracking';
import { currentUser } from '@/features/auth/services/auth';
import { getCacheOwnerUid } from '@/common/services/responseCache';
import {
  hydrateGeoFilterFromPrefs,
  saveGeoFilterPrefs,
  type GeoFilterState,
} from '@/features/listings/services/geoFilterStorage';
import {
  clampRadiusMiles,
  MAX_RADIUS_MILES,
  MIN_RADIUS_MILES,
} from '@/features/listings/utils/geoDistance';
import { logGeoFilterInputChanged } from '@/features/listings/utils/geoDebugLog';
import type { MeetupLocation } from '@/features/meetups/types/meetupLocation';
import { isApiConfigured } from '@/utils/apiBaseUrl';
import { reverseGeocodeCoordinates, isGoogleMapsConfigured } from '@/utils/googleMaps';

const props = defineProps<{
  modelValue: GeoFilterState & { locating?: boolean };
}>();

const emit = defineEmits<{
  'update:modelValue': [value: GeoFilterState & { locating?: boolean }];
  apply: [];
}>();

const geoError = ref('');
const apiConfigured = isApiConfigured();
let radiusDebounceTimer: ReturnType<typeof setTimeout> | undefined;

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

function persist(state: GeoFilterState & { locating?: boolean }) {
  const uid = currentUser.value?.uid ?? getCacheOwnerUid() ?? 'anonymous';
  saveGeoFilterPrefs(uid, state);
}

function emitState(patch: Partial<GeoFilterState & { locating?: boolean }>) {
  const next = { ...props.modelValue, ...patch };
  emit('update:modelValue', next);
  persist(next);
}

watch(
  () => currentUser.value?.uid,
  (uid) => {
    if (!uid) {
      return;
    }
    const hydrated = hydrateGeoFilterFromPrefs(uid, props.modelValue);
    logGeoFilterInputChanged({ ...hydrated, locating: false }, 'hydrate', { uid });
    emit('update:modelValue', { ...hydrated, locating: false });
  },
);

async function onToggle(event: CustomEvent) {
  const enabled = event.detail.checked;
  geoError.value = '';

  if (!enabled) {
    const next = { ...props.modelValue, enabled: false, locating: false };
    logGeoFilterInputChanged(next, 'toggle-off');
    emitState({ enabled: false, locating: false });
    emit('apply');
    return;
  }

  const next = { ...props.modelValue, enabled: true };
  logGeoFilterInputChanged(next, 'toggle-on');
  emitState({ enabled: true });

  if (props.modelValue.lat != null && props.modelValue.lng != null) {
    emit('apply');
    return;
  }

  await resolveCenterFromGeolocation();
}

function onRadiusInput(event: CustomEvent) {
  const radiusMiles = clampRadiusMiles(Number(event.detail.value));
  const next = { ...props.modelValue, radiusMiles };
  logGeoFilterInputChanged(next, 'radius');
  emitState({ radiusMiles });

  if (radiusDebounceTimer) {
    clearTimeout(radiusDebounceTimer);
  }
  radiusDebounceTimer = setTimeout(() => {
    if (props.modelValue.enabled && hasActiveCenter.value) {
      emit('apply');
    }
  }, 300);
}

async function resolveCenterFromGeolocation() {
  emitState({ locating: true });
  geoError.value = '';

  try {
    const coords = await getCurrentCoordinates();
    let label = 'Your location';

    if (isGoogleMapsConfigured()) {
      try {
        label = await reverseGeocodeCoordinates(coords.lat, coords.lng);
      } catch {
        // Keep generic label when reverse geocode fails.
      }
    }

    const next = {
      ...props.modelValue,
      lat: coords.lat,
      lng: coords.lng,
      label,
      locating: false,
    };
    logGeoFilterInputChanged(next, 'geolocation');
    emitState({
      lat: coords.lat,
      lng: coords.lng,
      label,
      locating: false,
    });
    emit('apply');
  } catch (error) {
    geoError.value =
      error instanceof Error
        ? error.message
        : 'Location access denied. Search an address below.';
    emitState({ locating: false });
  }
}

async function useMyLocation() {
  await resolveCenterFromGeolocation();
}

function onAddressSelected(location: MeetupLocation | null) {
  geoError.value = '';

  if (!location) {
    const cleared = { ...props.modelValue, lat: null, lng: null, label: '' };
    logGeoFilterInputChanged(cleared, 'address', { addressCleared: true });
    emitState({ lat: null, lng: null, label: '' });
    return;
  }

  const shortLabel = shortenAddressLabel(location.address);
  const next = {
    ...props.modelValue,
    lat: location.lat,
    lng: location.lng,
    label: shortLabel,
    locating: false,
  };
  logGeoFilterInputChanged(next, 'address', {
    fullAddress: location.address,
  });
  emitState({
    lat: location.lat,
    lng: location.lng,
    label: shortLabel,
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
    enabled: false,
    lat: null,
    lng: null,
    label: '',
    locating: false,
  };
  logGeoFilterInputChanged(next, 'clear');
  emitState({
    enabled: false,
    lat: null,
    lng: null,
    label: '',
    locating: false,
  });
  emit('apply');
}
</script>

<style scoped>
.browse-geo-filter {
  width: 100%;
}

.toggle-row {
  --padding-start: 0;
  --inner-padding-end: 0;
  --min-height: 2.25rem;
  font-size: 0.88rem;
}

.center-label {
  margin: 0.35rem 0 0.5rem;
  font-size: 0.82rem;
  color: var(--ion-color-success-shade);
  line-height: 1.35;
}

.hint {
  margin: 0.35rem 0 0.5rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  line-height: 1.35;
}

.hint.warning {
  color: var(--ion-color-warning-shade);
}

.radius-block {
  margin-top: 0.25rem;
}

.radius-label {
  display: block;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.location-actions {
  margin: 0.5rem 0;
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
