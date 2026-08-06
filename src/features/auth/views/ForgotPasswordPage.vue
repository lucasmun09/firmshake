<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Reset password</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
        <h1 class="title">Forgot password?</h1>
        <p class="subtitle">
          Enter your email and we will send a sign-in link. After you open the link and complete SMS
          verification (if enabled on your account), you can choose a new password.
        </p>

        <form v-if="!sent" @submit.prevent="handleSubmit">
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

          <ion-text v-if="error" color="danger">
            <p class="error">{{ error }}</p>
          </ion-text>

          <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
            {{ loading ? verifyingLabel : 'Send verification link' }}
          </ion-button>
        </form>

        <div v-else class="sent-state">
          <ion-text color="success">
            <p class="sent-message">
              If an account exists for <strong>{{ sentEmail }}</strong>, we sent a sign-in link.
              Open it on this device and browser to continue automatically, or enter your email on
              the next screen if you open the link elsewhere.
            </p>
          </ion-text>
          <p class="hint">
            The link expires after a short time. Check spam if you do not see it within a few
            minutes.
          </p>
          <ion-button expand="block" fill="outline" :disabled="loading" @click="handleResend">
            {{ loading ? verifyingLabel : 'Resend link' }}
          </ion-button>
        </div>

        <ion-button expand="block" fill="clear" router-link="/login">
          Back to sign in
        </ion-button>

        <RecaptchaNotice />
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
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

import AppContentFrame from '@/components/AppContentFrame.vue';
import RecaptchaNotice from '@/components/RecaptchaNotice.vue';
import { sendPasswordResetVerificationEmail } from '@/features/auth/services/passwordReset';
import { formatPasswordResetError } from '@/features/auth/utils/authErrors';
import { isRecaptchaConfigured } from '@/utils/recaptcha';

const recaptchaEnabled = isRecaptchaConfigured();
const verifyingLabel = recaptchaEnabled ? 'Verifying security...' : 'Sending link...';

const email = ref('');
const sentEmail = ref('');
const sent = ref(false);
const error = ref('');
const loading = ref(false);

async function handleSubmit() {
  error.value = '';
  loading.value = true;

  try {
    await sendPasswordResetVerificationEmail(email.value);
    sentEmail.value = email.value.trim().toLowerCase();
    sent.value = true;
  } catch (err) {
    error.value = formatPasswordResetError(err, 'request');
  } finally {
    loading.value = false;
  }
}

async function handleResend() {
  error.value = '';
  loading.value = true;

  try {
    await sendPasswordResetVerificationEmail(sentEmail.value || email.value);
  } catch (err) {
    error.value = formatPasswordResetError(err, 'request');
  } finally {
    loading.value = false;
  }
}
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
}

.submit-btn {
  margin-top: 1rem;
}

.sent-state {
  margin-bottom: 1rem;
}

.sent-message {
  line-height: 1.45;
  margin: 0 0 0.75rem;
}

.hint {
  color: var(--ion-color-medium);
  line-height: 1.45;
  margin: 0 0 1rem;
}
</style>
