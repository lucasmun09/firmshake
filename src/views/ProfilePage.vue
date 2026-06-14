<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Profile</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="currentUser" class="profile-card">
        <h2>{{ currentUser.displayName ?? 'FirmShake User' }}</h2>
        <p>{{ currentUser.email }}</p>
      </div>

      <ion-list>
        <ion-item>
          <ion-label>
            <h3>API status</h3>
            <p>{{ apiHealthy ? 'Flask server reachable' : 'Flask server offline' }}</p>
          </ion-label>
          <ion-badge :color="apiHealthy ? 'success' : 'warning'" slot="end">
            {{ apiHealthy ? 'Online' : 'Offline' }}
          </ion-badge>
        </ion-item>

        <ion-item>
          <ion-label>
            <h3>Firebase</h3>
            <p>{{ firebaseStatus }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-button expand="block" color="medium" class="logout-btn" @click="handleLogout">
        Sign out
      </ion-button>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import { checkApiHealth } from '@/services/api';
import { currentUser, logout } from '@/services/auth';
import { isFirebaseConfigured } from '@/services/firebase';

const router = useRouter();
const apiHealthy = ref(false);

const firebaseStatus = isFirebaseConfigured
  ? 'Configured'
  : 'Not configured — add .env.local';

onMounted(async () => {
  apiHealthy.value = await checkApiHealth();
});

async function handleLogout() {
  await logout();
  router.replace('/login');
}
</script>

<style scoped>
.profile-card {
  margin-bottom: 1rem;
}

.profile-card h2 {
  margin: 0;
}

.profile-card p {
  color: var(--ion-color-medium);
}

.logout-btn {
  margin-top: 2rem;
}
</style>
