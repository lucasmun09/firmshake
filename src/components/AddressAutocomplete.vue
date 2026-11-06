<template>
  <div class="address-autocomplete">
    <div class="address-field">
      <label class="field-label">Meetup address</label>
      <div
        ref="hostRef"
        class="autocomplete-host"
        :class="{ 'is-disabled': disabled || !mapsReady }"
      />
    </div>

    <p v-if="!mapsConfigured" class="hint warning">
      Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to enable address search.
    </p>
    <p v-else-if="loadError" class="hint warning">{{ loadError }}</p>
    <p v-else-if="modelValue" class="hint selected">
      Selected: {{ modelValue.address }}
    </p>
    <p v-else class="hint">Start typing an address and pick a suggestion.</p>

    <ion-button
      v-if="showCurrentLocation"
      expand="block"
      fill="outline"
      size="small"
      class="location-btn"
      :disabled="disabled || locating"
      @click="useCurrentLocation"
    >
      {{ locating ? 'Finding address…' : 'Use my current location' }}
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { IonButton, toastController } from '@ionic/vue';

import { getCurrentCoordinates } from '@/common/services/locationTracking';
import type { MeetupLocation } from '@/features/meetups/types/meetupLocation';
import {
  isGoogleMapsConfigured,
  loadGoogleMaps,
  registerGoogleMapsAuthFailure,
  reverseGeocodeCoordinates,
} from '@/utils/googleMaps';

const props = withDefaults(
  defineProps<{
    modelValue: MeetupLocation | null;
    disabled?: boolean;
    placeholder?: string;
    showCurrentLocation?: boolean;
  }>(),
  {
    disabled: false,
    placeholder: 'Search for an address',
    showCurrentLocation: true,
  },
);

const emit = defineEmits<{
  'update:modelValue': [location: MeetupLocation | null];
}>();

const hostRef = ref<HTMLDivElement | null>(null);
const mapsConfigured = isGoogleMapsConfigured();
const mapsReady = ref(false);
const loadError = ref('');
const locating = ref(false);

let autocomplete: google.maps.places.PlaceAutocompleteElement | undefined;
let selectListener: ((event: Event) => void) | undefined;
let errorListener: (() => void) | undefined;

onMounted(() => {
  registerGoogleMapsAuthFailure(() => {
    loadError.value =
      'Google Maps authentication failed. Enable Maps JavaScript API and Places API (New), turn on billing, and allow this site in your API key HTTP referrer restrictions.';
  });
  void initAutocomplete();
});

onUnmounted(() => {
  if (autocomplete && selectListener) {
    autocomplete.removeEventListener('gmp-select', selectListener);
  }
  if (autocomplete && errorListener) {
    autocomplete.removeEventListener('gmp-error', errorListener);
  }
  autocomplete?.remove();
  autocomplete = undefined;
});

watch(
  () => props.disabled,
  (disabled) => {
    if (autocomplete) {
      autocomplete.disabled = disabled || !mapsReady.value;
    }
  },
);

async function initAutocomplete() {
  if (!mapsConfigured || !hostRef.value) {
    return;
  }

  try {
    await loadGoogleMaps();
    const { PlaceAutocompleteElement } = (await google.maps.importLibrary(
      'places',
    )) as google.maps.PlacesLibrary;

    autocomplete = new PlaceAutocompleteElement({
      placeholder: props.placeholder,
    });
    autocomplete.disabled = props.disabled;

    selectListener = (event: Event) => {
      void onPlaceSelected(event as google.maps.places.PlacePredictionSelectEvent);
    };
    errorListener = () => {
      loadError.value =
        'Google Places could not load. Enable Places API (New) and Maps JavaScript API in Google Cloud Console.';
    };

    autocomplete.addEventListener('gmp-select', selectListener);
    autocomplete.addEventListener('gmp-error', errorListener);
    hostRef.value.replaceChildren(autocomplete);
    mapsReady.value = true;
    autocomplete.disabled = props.disabled;
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : 'Could not load Google Maps.';
  }
}

async function onPlaceSelected(
  event: google.maps.places.PlacePredictionSelectEvent,
) {
  try {
    const place = event.placePrediction.toPlace();
    await place.fetchFields({
      fields: ['formattedAddress', 'location', 'displayName'],
    });

    const location = place.location;
    if (!location) {
      return;
    }

    emit('update:modelValue', {
      address:
        place.formattedAddress ?? place.displayName ?? 'Selected location',
      lat: location.lat(),
      lng: location.lng(),
    });
  } catch {
    loadError.value = 'Could not load the selected address. Try again.';
  }
}

async function useCurrentLocation() {
  if (!mapsConfigured) {
    const toast = await toastController.create({
      message: 'Google Maps is required to convert your location to an address.',
      duration: 3500,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  locating.value = true;
  try {
    const coords = await getCurrentCoordinates();
    const address = await reverseGeocodeCoordinates(coords.lat, coords.lng);

    emit('update:modelValue', {
      address,
      lat: coords.lat,
      lng: coords.lng,
    });
  } catch (error) {
    const toast = await toastController.create({
      message:
        error instanceof Error ? error.message : 'Could not get your location',
      duration: 3500,
      color: 'danger',
    });
    await toast.present();
  } finally {
    locating.value = false;
  }
}
</script>

<style scoped>
.address-autocomplete {
  width: 100%;
}

.address-field {
  padding: 0 1rem;
}

.field-label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.autocomplete-host {
  width: 100%;
}

.autocomplete-host.is-disabled {
  opacity: 0.55;
  pointer-events: none;
}

.hint {
  margin: 0.5rem 1rem 0;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.hint.warning {
  color: var(--ion-color-warning-shade);
}

.hint.selected {
  color: var(--ion-color-success-shade);
}

.location-btn {
  margin: 0.75rem 1rem 0;
}
</style>
