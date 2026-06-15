<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Create account</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
      <form @submit.prevent="handleRegister">
        <ion-item>
          <ion-input
            v-model="displayName"
            label="Display name"
            label-placement="stacked"
            autocomplete="name"
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

        <ion-text v-if="error" color="danger">
          <p class="error">{{ error }}</p>
        </ion-text>

        <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
          {{ loading ? 'Creating account...' : 'Create account' }}
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
        {{ loading ? 'Signing in...' : 'Continue with Google' }}
      </ion-button>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
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

import { loginWithGoogle, registerWithEmail } from '@/services/auth';
import AppContentFrame from '@/components/AppContentFrame.vue';
import { formatAuthError } from '@/utils/authErrors';

const router = useRouter();

const displayName = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleRegister() {
  error.value = '';
  loading.value = true;

  try {
    await registerWithEmail(email.value, password.value, displayName.value);
    router.replace('/tabs/home');
  } catch (err) {
    error.value = formatAuthError(err, 'register');
  } finally {
    loading.value = false;
  }
}

async function handleGoogleRegister() {
  error.value = '';
  loading.value = true;

  try {
    const user = await loginWithGoogle();
    if (user) {
      router.replace('/tabs/home');
    }
  } catch (err) {
    error.value = formatAuthError(err, 'google');
  } finally {
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
</style>
