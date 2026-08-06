<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Reset password</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame v-if="phase === 'verifying'" class="center-state">
        <ion-spinner name="crescent" />
        <p>Verifying your link...</p>
      </AppContentFrame>

      <AppContentFrame v-else-if="phase === 'confirm-email'">
        <h1 class="title">Confirm your email</h1>
        <p class="subtitle">
          For security, confirm the email address that received the reset link. If you requested
          the link on this device and browser, we may already have it saved.
        </p>

        <form @submit.prevent="handleConfirmEmail">
          <ion-item>
            <ion-input
              v-model="confirmEmail"
              type="email"
              label="Email"
              label-placement="stacked"
              autocomplete="email"
              required
            />
          </ion-item>

          <ion-text v-if="error" color="danger">
            <p class="error">{{ error }}</p>
          </ion-text>

          <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
            {{ loading ? 'Verifying...' : 'Continue' }}
          </ion-button>
        </form>

        <ion-button expand="block" fill="clear" router-link="/forgot-password">
          Request a new link
        </ion-button>
      </AppContentFrame>

      <AppContentFrame v-else-if="phase === 'password'">
        <h1 class="title">Choose a new password</h1>
        <p class="subtitle">
          Verification complete. Enter a new password for
          <strong>{{ verifiedEmail ?? 'your account' }}</strong>.
        </p>

        <form @submit.prevent="handlePasswordSubmit">
          <ion-item>
            <ion-input
              v-model="password"
              type="password"
              label="New password"
              label-placement="stacked"
              autocomplete="new-password"
              required
              :minlength="PASSWORD_MIN_LENGTH"
            />
          </ion-item>

          <ion-item>
            <ion-input
              v-model="confirmPassword"
              type="password"
              label="Confirm password"
              label-placement="stacked"
              autocomplete="new-password"
              required
              :minlength="PASSWORD_MIN_LENGTH"
            />
          </ion-item>

          <ion-text v-if="error" color="danger">
            <p class="error">{{ error }}</p>
          </ion-text>

          <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
            {{ loading ? 'Updating password...' : 'Update password' }}
          </ion-button>
        </form>
      </AppContentFrame>

      <AppContentFrame v-else-if="phase === 'success'" class="center-state">
        <ion-text color="success">
          <p class="success-message">Your password has been updated.</p>
        </ion-text>
        <p class="subtitle">You can now sign in with your new password.</p>
        <ion-button expand="block" router-link="/login">
          Back to sign in
        </ion-button>
      </AppContentFrame>

      <AppContentFrame v-else-if="phase === 'error'">
        <h1 class="title">Reset link problem</h1>
        <ion-text color="danger">
          <p class="error">{{ error }}</p>
        </ion-text>
        <ion-button expand="block" router-link="/forgot-password" class="submit-btn">
          Request a new link
        </ion-button>
        <ion-button expand="block" fill="clear" router-link="/login">
          Back to sign in
        </ion-button>
      </AppContentFrame>

      <AppContentFrame v-else class="center-state">
        <ion-spinner name="crescent" />
        <p>Loading...</p>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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

import { auth } from '@/common/services/firebase';
import AppContentFrame from '@/components/AppContentFrame.vue';
import { isMultiFactorRequiredError, isPasswordAuthUser } from '@/features/auth/services/mfa';
import {
  PASSWORD_MIN_LENGTH,
  completePasswordResetEmailLink,
  finalizePasswordReset,
  isPasswordResetEmailLink,
  isPasswordResetFlowActive,
  markPasswordResetPending,
  readStoredPasswordResetEmail,
  validateNewPassword,
} from '@/features/auth/services/passwordReset';
import { formatPasswordResetError } from '@/features/auth/utils/authErrors';

type Phase = 'loading' | 'verifying' | 'confirm-email' | 'password' | 'success' | 'error';

const route = useRoute();
const router = useRouter();

const phase = ref<Phase>('loading');
const confirmEmail = ref('');
const verifiedEmail = ref<string | null>(null);
const password = ref('');
const confirmPassword = ref('');
const error = ref('');
const loading = ref(false);

function emailLinkUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.href;
}

async function proceedToPasswordStep(email: string | null | undefined): Promise<void> {
  const sessionEmail = email ?? auth?.currentUser?.email ?? readStoredPasswordResetEmail();
  verifiedEmail.value = sessionEmail;
  markPasswordResetPending();
  phase.value = 'password';
  await router.replace({ path: '/reset-password', query: { step: 'password' } });
}

function isRecoverableVerifyError(err: unknown): boolean {
  const code = typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : null;

  return code === 'auth/missing-email'
    || code === 'auth/invalid-email'
    || code === 'auth/invalid-credential';
}

async function handleEmailLinkSignIn(emailOverride?: string): Promise<void> {
  phase.value = 'verifying';
  error.value = '';

  try {
    const user = await completePasswordResetEmailLink(emailLinkUrl(), emailOverride);
    await proceedToPasswordStep(user.email);
  } catch (err) {
    if (isMultiFactorRequiredError(err)) {
      await router.replace({
        path: '/mfa-challenge',
        query: { flow: 'password-reset' },
      });
      return;
    }

    error.value = formatPasswordResetError(err, 'verify');
    phase.value = isRecoverableVerifyError(err) ? 'confirm-email' : 'error';
  }
}

async function handleConfirmEmail() {
  error.value = '';
  loading.value = true;

  try {
    await handleEmailLinkSignIn(confirmEmail.value);
  } catch (err) {
    error.value = formatPasswordResetError(err, 'verify');
    phase.value = 'confirm-email';
  } finally {
    loading.value = false;
  }
}

async function handlePasswordSubmit() {
  error.value = '';

  const validationError = validateNewPassword(password.value, confirmPassword.value);
  if (validationError) {
    error.value = validationError;
    return;
  }

  loading.value = true;

  try {
    await finalizePasswordReset(password.value);
    phase.value = 'success';
    await router.replace({ path: '/reset-password', query: { reset: 'success' } });
  } catch (err) {
    error.value = formatPasswordResetError(err, 'update');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (route.query.reset === 'success') {
    phase.value = 'success';
    return;
  }

  if (route.query.step === 'password' && auth?.currentUser && isPasswordResetFlowActive()) {
    if (!isPasswordAuthUser(auth.currentUser)) {
      error.value = 'This account uses Google sign-in. Sign in with Google instead.';
      phase.value = 'error';
      return;
    }

    await proceedToPasswordStep(auth.currentUser.email);
    return;
  }

  // Signed in mid-reset (e.g. after MFA) — skip re-consuming an already-used email link.
  if (auth?.currentUser && isPasswordResetFlowActive()) {
    if (!isPasswordAuthUser(auth.currentUser)) {
      error.value = 'This account uses Google sign-in. Sign in with Google instead.';
      phase.value = 'error';
      return;
    }

    await proceedToPasswordStep(auth.currentUser.email);
    return;
  }

  const link = emailLinkUrl();
  if (isPasswordResetEmailLink(link)) {
    const storedEmail = readStoredPasswordResetEmail();
    if (!storedEmail) {
      confirmEmail.value = '';
      phase.value = 'confirm-email';
      return;
    }

    await handleEmailLinkSignIn();
    return;
  }

  if (isPasswordResetFlowActive()) {
    phase.value = 'confirm-email';
    return;
  }

  await router.replace('/forgot-password');
});
</script>

<style scoped>
.title {
  margin-top: 0;
}

.subtitle {
  color: var(--ion-color-medium);
  margin-bottom: 1.5rem;
  line-height: 1.45;
}

.error {
  padding: 0.5rem 1rem;
  line-height: 1.45;
}

.submit-btn {
  margin-top: 1rem;
}

.center-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 50vh;
  color: var(--ion-color-medium);
  text-align: center;
}

.center-state p,
.success-message {
  margin: 0;
  line-height: 1.45;
}
</style>
