<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>FirmShake</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
      <h1 class="title">Sign in</h1>
      <p class="subtitle">Community marketplace with binding meetups.</p>

      <form @submit.prevent="handleLogin">
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
            autocomplete="current-password"
            required
          />
        </ion-item>

        <ion-text v-if="error" color="danger">
          <p class="error">{{ error }}</p>
        </ion-text>

        <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
          {{ loading ? 'Signing in...' : 'Sign in' }}
        </ion-button>
      </form>

      <ion-button fill="clear" expand="block" router-link="/register">
        Create an account
      </ion-button>

      <div class="divider">or</div>

      <ion-button
        expand="block"
        fill="outline"
        color="medium"
        :disabled="loading"
        @click="handleGoogleLogin"
      >
        {{ loading ? 'Signing in...' : 'Continue with Google' }}
      </ion-button>

      <ion-note v-if="!isFirebaseConfigured" class="setup-note">
        Firebase is not configured. Copy <code>.env.example</code> to
        <code>.env.local</code> and follow <code>docs/FIREBASE_SETUP.md</code>.
      </ion-note>
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
  IonNote,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import { loginWithEmail, loginWithGoogle } from '@/services/auth';
import AppContentFrame from '@/components/AppContentFrame.vue';
import { isFirebaseConfigured } from '@/services/firebase';
import { formatAuthError } from '@/utils/authErrors';

const router = useRouter();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  error.value = '';
  loading.value = true;

  try {
    await loginWithEmail(email.value, password.value);
    router.replace('/tabs/home');
  } catch (err) {
    error.value = formatAuthError(err, 'login');
  } finally {
    loading.value = false;
  }
}
async function handleGoogleLogin() {
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
.title {
  margin-top: 0;
}

.subtitle {
  color: var(--ion-color-medium);
  margin-bottom: 1.5rem;
}

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

.setup-note {
  display: block;
  margin-top: 2rem;
  line-height: 1.4;
}
</style>
