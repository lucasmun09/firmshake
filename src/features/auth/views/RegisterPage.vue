<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Create account</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame v-if="completingAuth || googleRedirectProcessing" class="auth-complete-state">
        <ion-spinner name="crescent" />
        <p>Logging in...</p>
      </AppContentFrame>

      <AppContentFrame v-else>
      <form @submit.prevent="handleRegister">
        <ion-item>
          <ion-input
            v-model="firstName"
            label="First name"
            label-placement="stacked"
            autocomplete="given-name"
            required
          />
        </ion-item>

        <ion-item>
          <ion-input
            v-model="lastName"
            label="Last name"
            label-placement="stacked"
            autocomplete="family-name"
            required
          />
        </ion-item>

        <ion-item>
          <ion-input
            v-model="email"
            type="email"
            label="Email"
            label-placement="stacked"
            autocomplete="email"
            required
          />
        </ion-item>

        <ion-item>
          <ion-input
            v-model="password"
            type="password"
            label="Password"
            label-placement="stacked"
            autocomplete="new-password"
            required
            :minlength="6"
          />
        </ion-item>

        <PhoneNumberInput ref="phoneInputRef" v-model="phoneNumber" />

        <ion-text v-if="error" color="danger">
          <p class="error">{{ error }}</p>
        </ion-text>

        <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
          {{ loading ? verifyingLabel : 'Create account' }}
        </ion-button>
      </form>

      <ion-button fill="clear" expand="block" router-link="/login">
        Already have an account? Sign in
      </ion-button>

      <div class="divider">or</div>

      <ion-button
        expand="block"
        fill="outline"
        color="medium"
        :disabled="loading"
        @click="handleGoogleRegister"
      >
        {{ loading ? verifyingLabel : 'Continue with Google' }}
      </ion-button>

      <RecaptchaNotice />
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import type { User } from 'firebase/auth';

import {
  authReady,
  currentUser,
  googleRedirectError,
  googleRedirectProcessing,
  loginWithGoogle,
  navigateAfterAuthentication,
  registerWithEmail,
} from '@/features/auth/services/auth';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import AppContentFrame from '@/components/AppContentFrame.vue';
import PhoneNumberInput from '@/components/PhoneNumberInput.vue';
import RecaptchaNotice from '@/components/RecaptchaNotice.vue';
import { getPendingMfaResolver } from '@/features/auth/services/mfa';
import { formatAuthError, type AuthErrorContext } from '@/features/auth/utils/authErrors';
import { waitForAuthSuccessScreen } from '@/features/auth/utils/authTransition';
import {
  guessDefaultCountryCode,
  isValidPhoneNumber,
  nationalPhoneValidationMessage,
  stashPendingMfaPhone,
} from '@/utils/phoneNumber';
import { isRecaptchaConfigured, loadRecaptcha } from '@/utils/recaptcha';

const router = useRouter();
const recaptchaEnabled = isRecaptchaConfigured();
const verifyingLabel = recaptchaEnabled ? 'Verifying security...' : 'Creating account...';

const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const phoneInputRef = ref<InstanceType<typeof PhoneNumberInput> | null>(null);
const phoneNumber = ref('');
const error = ref('');
const loading = ref(false);
const completingAuth = ref(false);

onMounted(() => {
  if (googleRedirectError.value) {
    error.value = googleRedirectError.value;
  }

  if (recaptchaEnabled) {
    void loadRecaptcha().catch(() => {
      // Submit handler will surface a useful error if loading fails.
    });
  }
});

watch(googleRedirectError, (message) => {
  if (message) {
    error.value = message;
  }
});

let redirectRecoveryAttempted = false;

watch(
  () => ({
    processing: googleRedirectProcessing.value,
    ready: authReady.value,
    userUid: currentUser.value?.uid ?? null,
    redirectError: googleRedirectError.value,
  }),
  async (state, previous) => {
    const redirectJustFinished = previous?.processing && !state.processing;

    if (!redirectJustFinished || redirectRecoveryAttempted) {
      return;
    }

    if (!state.ready || !state.userUid || state.redirectError) {
      return;
    }

    redirectRecoveryAttempted = true;
    debugLog.info('auth', 'RegisterPage: redirect finished with active session; navigating', {
      uid: state.userUid,
    });

    completingAuth.value = true;
    try {
      await navigateAfterAuthentication(router, currentUser.value!);
    } catch (err) {
      completingAuth.value = false;
      error.value = formatAuthError(err, 'google');
      debugLog.error('auth', 'RegisterPage: post-redirect navigation failed', {
        error: serializeError(err),
      });
    }
  },
);

async function completeAuthAndNavigate(user: User, context: AuthErrorContext) {
  completingAuth.value = true;
  try {
    await waitForAuthSuccessScreen();
    await navigateAfterAuthentication(router, user);
  } catch (err) {
    completingAuth.value = false;
    error.value = formatAuthError(err, context);
  }
}

async function handleRegister() {
  error.value = '';
  loading.value = true;

  if (!isValidPhoneNumber(phoneNumber.value)) {
    const countryCode = phoneInputRef.value?.countryCode ?? guessDefaultCountryCode();
    error.value = nationalPhoneValidationMessage(countryCode);
    loading.value = false;
    return;
  }

  try {
    stashPendingMfaPhone(phoneNumber.value);
    const user = await registerWithEmail(email.value, password.value, firstName.value, lastName.value);
    loading.value = false;
    await completeAuthAndNavigate(user, 'register');
  } catch (err) {
    error.value = formatAuthError(err, 'register');
    loading.value = false;
  }
}

async function handleGoogleRegister() {
  error.value = '';
  loading.value = true;

  try {
    const user = await loginWithGoogle('google_register');
    loading.value = false;

    if (user) {
      await completeAuthAndNavigate(user, 'google');
      return;
    }

    if (getPendingMfaResolver()) {
      await router.push('/mfa-challenge');
    }
  } catch (err) {
    error.value = formatAuthError(err, 'google');
    loading.value = false;
  }
}
</script>

<style scoped>
.error {
  padding: 0.5rem 1rem;
}

.submit-btn {
  margin-top: 1rem;
}

.divider {
  text-align: center;
  color: var(--ion-color-medium);
  margin: 1rem 0;
}

.auth-complete-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 50vh;
  color: var(--ion-color-medium);
  text-align: center;
}

.auth-complete-state p {
  margin: 0;
  font-size: 1rem;
}
</style>
