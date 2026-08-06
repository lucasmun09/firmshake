<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ isPasswordResetFlow ? 'Verify reset' : 'Verify sign-in' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
        <p class="intro">
          <template v-if="isPasswordResetFlow">
            Enter the SMS code sent to
            <strong>{{ maskedPhone ?? 'your phone' }}</strong>
            to continue resetting your password.
          </template>
          <template v-else>
            Enter the SMS code sent to
            <strong>{{ maskedPhone ?? 'your phone' }}</strong>.
          </template>
        </p>

        <form @submit.prevent="handleVerify">
          <ion-item>
            <ion-input
              v-model="verificationCode"
              label="Verification code"
              label-placement="stacked"
              inputmode="numeric"
              autocomplete="one-time-code"
              required
            />
          </ion-item>

          <ion-text v-if="error" color="danger">
            <p class="error">{{ error }}</p>
          </ion-text>

          <ion-button expand="block" type="submit" :disabled="busy || !verificationId" class="action-btn">
            {{ buttonLabel }}
          </ion-button>
        </form>

        <ion-button
          expand="block"
          fill="outline"
          :disabled="busy || sendingCode"
          @click="handleResend"
        >
          {{ sendingCode ? 'Sending code...' : 'Resend code' }}
        </ion-button>

        <ion-button expand="block" fill="clear" router-link="/login">
          Back to sign in
        </ion-button>

        <div id="mfa-challenge-recaptcha" />
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import { debugLog } from '@/common/debug/debugLog';
import { auth } from '@/common/services/firebase';
import AppContentFrame from '@/components/AppContentFrame.vue';
import { navigateAfterAuthentication, setPostAuthBypass } from '@/features/auth/services/auth';
import { markPasswordResetPending } from '@/features/auth/services/passwordReset';
import {
  completeMfaSignIn,
  getMaskedPhoneHint,
  getPendingMfaResolver,
  sendMfaSignInCode,
} from '@/features/auth/services/mfa';
import { formatMfaError, getAuthErrorCode } from '@/features/auth/utils/authErrors';

const router = useRouter();
const route = useRoute();
const MFA_NAV_TIMEOUT_MS = 8000;

const isPasswordResetFlow = computed(() => route.query.flow === 'password-reset');

const verificationId = ref('');
const verificationCode = ref('');
const maskedPhone = ref<string | null>(null);
const error = ref('');
const loading = ref(false);
const signingIn = ref(false);
const sendingCode = ref(false);

const busy = computed(() => loading.value || signingIn.value);
const buttonLabel = computed(() => {
  if (signingIn.value) {
    return 'Signing you in...';
  }
  if (loading.value) {
    return 'Verifying...';
  }
  return 'Verify and continue';
});

onMounted(async () => {
  if (!getPendingMfaResolver()) {
    await router.replace('/login');
    return;
  }

  maskedPhone.value = getMaskedPhoneHint();
  await handleResend();
});

async function handleResend() {
  error.value = '';
  sendingCode.value = true;

  try {
    verificationId.value = await sendMfaSignInCode('mfa-challenge-recaptcha');
  } catch (err) {
    error.value = formatMfaError(err);
  } finally {
    sendingCode.value = false;
  }
}

async function recoverMfaNavigation(uid: string, reason: string): Promise<void> {
  debugLog.warn('mfa', 'MfaChallengePage: auto-recovering navigation', {
    uid,
    reason,
  });
  setPostAuthBypass(uid);
  window.location.assign('/tabs/home');
}

async function handleVerify() {
  error.value = '';
  loading.value = true;
  const started = Date.now();
  let signedInUid: string | null = null;

  try {
    debugLog.info('mfa', 'MfaChallengePage: verify started');
    const user = await completeMfaSignIn(verificationId.value, verificationCode.value.trim());
    signedInUid = user.uid;
    loading.value = false;
    signingIn.value = true;

    debugLog.info('mfa', 'MfaChallengePage: sign-in complete', {
      uid: user.uid,
      elapsedMs: Date.now() - started,
    });

    if (isPasswordResetFlow.value) {
      markPasswordResetPending();
      debugLog.info('mfa', 'MfaChallengePage: MFA complete for password reset', {
        uid: user.uid,
        elapsedMs: Date.now() - started,
      });
      await router.replace({ path: '/reset-password', query: { step: 'password' } });
      return;
    }

    debugLog.info('mfa', 'MfaChallengePage: navigating after auth', {
      uid: user.uid,
      elapsedMs: Date.now() - started,
    });

    let fallbackTimer: number | undefined;
    const fallbackNavigate = () => {
      if (router.currentRoute.value.path !== '/mfa-challenge') {
        return;
      }

      debugLog.warn('mfa', 'MfaChallengePage: navigation timeout, fallback to home', {
        uid: user.uid,
        elapsedMs: Date.now() - started,
        timeoutMs: MFA_NAV_TIMEOUT_MS,
      });
      void recoverMfaNavigation(user.uid, 'navigation-timeout');
    };

    fallbackTimer = window.setTimeout(fallbackNavigate, MFA_NAV_TIMEOUT_MS);

    try {
      await navigateAfterAuthentication(router, user, { fromMfaChallenge: true });
    } finally {
      window.clearTimeout(fallbackTimer);
    }

    if (router.currentRoute.value.path === '/mfa-challenge') {
      await recoverMfaNavigation(user.uid, 'still-on-challenge-page');
      return;
    }

    debugLog.info('mfa', 'MfaChallengePage: navigation complete', {
      uid: user.uid,
      elapsedMs: Date.now() - started,
      routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  } catch (err) {
    const errorCode = getAuthErrorCode(err);
    const mfaStep = typeof err === 'object' && err !== null && 'mfaStep' in err
      ? String((err as { mfaStep: unknown }).mfaStep)
      : null;
    const activeUid = signedInUid ?? auth?.currentUser?.uid ?? null;

    if (
      activeUid
      && mfaStep === 'reloadUser'
      && (errorCode === 'auth/internal-error' || errorCode === 'permission-denied')
    ) {
      if (isPasswordResetFlow.value) {
        markPasswordResetPending();
        await router.replace({ path: '/reset-password', query: { step: 'password' } });
        return;
      }

      await recoverMfaNavigation(activeUid, 'reload-user-failure');
      return;
    }

    error.value = formatMfaError(err);
  } finally {
    loading.value = false;
    signingIn.value = false;
  }
}
</script>

<style scoped>
.intro {
  color: var(--ion-color-medium);
  line-height: 1.45;
  margin-bottom: 1rem;
}

.error {
  padding: 0.5rem 1rem;
}

.action-btn {
  margin-top: 1rem;
}
</style>
