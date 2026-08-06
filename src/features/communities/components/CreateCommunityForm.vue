<template>
  <form class="create-form" @submit.prevent="handleSubmit">
    <ion-item>
      <ion-input
        v-model="name"
        label="Name"
        label-placement="stacked"
        required
      />
    </ion-item>
    <ion-item>
      <ion-textarea
        v-model="description"
        label="Description"
        label-placement="stacked"
        :auto-grow="true"
      />
    </ion-item>
    <ion-button expand="block" type="submit" :disabled="creating || !name.trim()">
      {{ creating ? 'Creating...' : submitLabel }}
    </ion-button>
  </form>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonButton, IonInput, IonItem, IonTextarea } from '@ionic/vue';

import { createUserCommunity } from '@/features/communities/services/communities';
import { currentUser } from '@/features/auth/services/auth';
import type { Community } from '@/types';

const props = withDefaults(
  defineProps<{
    initialName?: string;
    initialDescription?: string;
    submitLabel?: string;
  }>(),
  {
    initialName: '',
    initialDescription: '',
    submitLabel: 'Create community',
  },
);

const emit = defineEmits<{
  created: [community: Community];
  error: [message: string];
}>();

const name = ref(props.initialName);
const description = ref(props.initialDescription);
const creating = ref(false);

watch(
  () => props.initialName,
  (value) => {
    name.value = value;
  },
);

watch(
  () => props.initialDescription,
  (value) => {
    description.value = value;
  },
);

async function handleSubmit() {
  const user = currentUser.value;
  if (!user || !name.value.trim()) return;

  creating.value = true;

  try {
    const community = await createUserCommunity(
      user.uid,
      name.value,
      description.value,
    );
    emit('created', community);
    name.value = '';
    description.value = '';
  } catch (err) {
    emit('error', err instanceof Error ? err.message : 'Could not create community');
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped>
.create-form {
  margin-top: 0.5rem;
}
</style>
