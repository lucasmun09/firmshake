<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary" class="auth-toolbar">
        <div class="auth-toolbar-brand">
          <FirmShakeLogo size="brand" />
          <ion-title>Login / Create</ion-title>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <AppContentFrame class="login-create-shell">
        <h1 class="title">Join FirmShake</h1>
        <p class="subtitle">
          Sign in to message sellers, propose FirmShakes, and manage your buying and selling.
        </p>

        <ion-button expand="block" router-link="/login" class="action-btn">
          Sign in
        </ion-button>

        <ion-button expand="block" fill="outline" router-link="/register" class="action-btn">
          Create account
        </ion-button>

        <ion-button expand="block" fill="clear" router-link="/tabs/home">
          Continue browsing
        </ion-button>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import FirmShakeLogo from '@/components/FirmShakeLogo.vue';
import AppContentFrame from '@/components/AppContentFrame.vue';
</script>

<style scoped>
.auth-toolbar-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-inline: var(--fs-toolbar-inset);
}

.login-create-shell {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.5rem;
}

.title {
  margin: 0 0 0.35rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.subtitle {
  margin: 0 0 1rem;
  color: var(--ion-color-medium, #92949c);
  line-height: 1.45;
}

.action-btn {
  margin-top: 0.25rem;
}
</style>
