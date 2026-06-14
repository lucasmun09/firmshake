<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Create account</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
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

import { registerWithEmail } from '@/services/auth';

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
    error.value = err instanceof Error ? err.message : 'Registration failed';
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
</style>
