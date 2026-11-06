<template>
  <ion-page>
    <AppTopToolbar title="Create Community" show-back-button back-href="/tabs/communities" />

    <ion-content>
      <AppContentFrame>
        <p class="section-hint">
          {{
            initialName
              ? `No community named "${initialName}" exists yet. Create it so others can join too.`
              : 'Start a new community for people with shared interests.'
          }}
        </p>

        <CreateCommunityForm
          :initial-name="initialName"
          :submit-label="initialName ? 'Create and join' : 'Create community'"
          @created="handleCreated"
          @error="showError"
        />
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonContent,
  IonPage,
  toastController,
} from '@ionic/vue';

import AppContentFrame from '@/components/AppContentFrame.vue';
import AppTopToolbar from '@/components/AppTopToolbar.vue';
import CreateCommunityForm from '@/features/communities/components/CreateCommunityForm.vue';
import type { Community } from '@/types';

const route = useRoute();
const router = useRouter();

const initialName = computed(() => {
  const name = route.query.name;
  return typeof name === 'string' ? name : '';
});

async function handleCreated(community: Community) {
  const toast = await toastController.create({
    message: `Created ${community.name}`,
    duration: 2000,
    color: 'success',
  });
  await toast.present();
  await router.replace('/tabs/communities');
}

async function showError(message: string) {
  const toast = await toastController.create({
    message,
    duration: 2500,
    color: 'danger',
  });
  await toast.present();
}
</script>

<style scoped>
.section-hint {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  margin: 0 0 1rem;
  line-height: 1.4;
}
</style>
