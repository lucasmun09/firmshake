<template>
  <ion-note v-if="enabled" class="recaptcha-notice">
    <p class="recaptcha-notice__title">Secured with reCAPTCHA</p>
    <p class="recaptcha-notice__body">
      A security check runs automatically when you sign in, create an account, or
      continue with Google. You will not see a checkbox — that is normal for
      reCAPTCHA v3.
    </p>
    <p class="recaptcha-notice__legal">
      Google
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      and
      <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
      apply.
    </p>
  </ion-note>
</template>

<script setup lang="ts">
import { IonNote } from '@ionic/vue';

import { isRecaptchaConfigured } from '@/utils/recaptcha';

const enabled = isRecaptchaConfigured();
</script>

<style scoped>
.recaptcha-notice {
  display: block;
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: var(--ion-color-step-50);
  line-height: 1.4;
}

.recaptcha-notice__title {
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

.recaptcha-notice__body,
.recaptcha-notice__legal {
  margin: 0;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.recaptcha-notice__legal {
  margin-top: 0.5rem;
}

.recaptcha-notice a {
  color: inherit;
}
</style>
