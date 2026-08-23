<template>
  <div ref="rootRef" class="google-sign-in">
    <div
      v-show="gisActive"
      ref="gisHostRef"
      class="gis-button-host"
      role="group"
      aria-label="Continue with Google"
    />

    <ion-button
      v-if="!gisActive"
      expand="block"
      fill="outline"
      color="medium"
      :disabled="disabled || loading"
      @click="onFallbackClick"
    >
      {{ loading ? loadingLabel : label }}
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IonButton } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';

import { debugLog, serializeError } from '@/common/debug/debugLog';
import {
  initializeGoogleIdentity,
  isGoogleIdentityConfigured,
  loadGoogleIdentityServices,
  renderGoogleSignInButton,
  type GoogleIdCredentialResponse,
} from '@/features/auth/services/googleIdentity';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    loading?: boolean;
    label?: string;
    loadingLabel?: string;
    context?: 'signin' | 'signup';
  }>(),
  {
    disabled: false,
    loading: false,
    label: 'Continue with Google',
    loadingLabel: 'Connecting…',
    context: 'signin',
  },
);

const emit = defineEmits<{
  credential: [idToken: string];
  fallback: [];
  error: [message: string];
}>();

const rootRef = ref<HTMLElement | null>(null);
const gisHostRef = ref<HTMLElement | null>(null);
const gisActive = ref(false);
let resizeObserver: ResizeObserver | null = null;

function resolveButtonWidth(): number {
  return Math.max(
    220,
    Math.floor(rootRef.value?.clientWidth || gisHostRef.value?.clientWidth || 320),
  );
}

function paintGisButton() {
  const host = gisHostRef.value;
  if (!host) {
    return;
  }

  host.replaceChildren();
  renderGoogleSignInButton(host, {
    text: props.context === 'signup' ? 'signup_with' : 'continue_with',
    width: resolveButtonWidth(),
  });
}

async function mountGisButton() {
  if (Capacitor.isNativePlatform() || !isGoogleIdentityConfigured()) {
    gisActive.value = false;
    return;
  }

  try {
    await loadGoogleIdentityServices();

    // Show the host before measuring so width is accurate.
    gisActive.value = true;
    await nextTick();

    const host = gisHostRef.value;
    if (!host) {
      gisActive.value = false;
      return;
    }

    initializeGoogleIdentity({
      context: props.context,
      callback: (response: GoogleIdCredentialResponse) => {
        if (!response.credential) {
          emit('error', 'Google sign-in returned no credential.');
          return;
        }
        debugLog.info('auth', 'GoogleSignInButton: GIS credential', {
          selectBy: response.select_by ?? null,
          context: props.context,
        });
        emit('credential', response.credential);
      },
    });

    paintGisButton();

    resizeObserver?.disconnect();
    if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
      resizeObserver = new ResizeObserver(() => {
        if (!gisActive.value) {
          return;
        }
        paintGisButton();
      });
      resizeObserver.observe(rootRef.value);
    }

    debugLog.info('auth', 'GoogleSignInButton: GIS button mounted', {
      context: props.context,
      width: resolveButtonWidth(),
    });
  } catch (err) {
    gisActive.value = false;
    debugLog.warn('auth', 'GoogleSignInButton: GIS unavailable; using fallback button', {
      error: serializeError(err),
    });
  }
}

function onFallbackClick() {
  emit('fallback');
}

onMounted(() => {
  void mountGisButton();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

watch(
  () => props.context,
  () => {
    void mountGisButton();
  },
);
</script>

<style scoped>
.google-sign-in {
  width: 100%;
}

.gis-button-host {
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 44px;
}

.gis-button-host :deep(div) {
  width: 100% !important;
}
</style>
