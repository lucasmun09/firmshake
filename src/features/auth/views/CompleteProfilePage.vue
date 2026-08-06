<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Complete profile</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
        <p class="intro">
          Google sign-in does not share your full name with FirmShake. Please confirm
          your first and last name to continue.
        </p>

        <form @submit.prevent="handleSubmit">
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

          <ion-text v-if="error" color="danger">
            <p class="error">{{ error }}</p>
          </ion-text>

          <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
            {{ loading ? 'Saving...' : 'Continue' }}
          </ion-button>
        </form>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { updateProfile } from 'firebase/auth';
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
import { currentUser, navigateAfterAuthentication } from '@/features/auth/services/auth';
import { bootstrapProfile } from '@/common/services/appBootstrap';
import { completeUserProfileNames } from '@/common/services/users';
import { formatDisplayName } from '@/utils/displayName';
import { waitForAuthSuccessScreen } from '@/features/auth/utils/authTransition';

const router = useRouter();

const firstName = ref('');
const lastName = ref('');
const error = ref('');
const loading = ref(false);

onMounted(() => {
  const profile = bootstrapProfile.value;
  firstName.value = profile?.firstName ?? '';
  lastName.value = profile?.lastName ?? '';
});

async function handleSubmit() {
  error.value = '';
  loading.value = true;

  try {
    const user = currentUser.value;
    if (!user) {
      throw new Error('You must be signed in to continue');
    }

    await completeUserProfileNames(user.uid, firstName.value, lastName.value);

    const displayName = formatDisplayName(firstName.value, lastName.value);
    await updateProfile(user, { displayName });

    await waitForAuthSuccessScreen();
    await navigateAfterAuthentication(router);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not save your profile';
    loading.value = false;
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

.submit-btn {
  margin-top: 1rem;
}
</style>
