<template>
  <div v-if="manageable" class="moderator-panel">
    <h4>Moderators</h4>
    <p class="hint">
      Moderators can remove listings posted in {{ communityName }} and grant moderator access
      to others.
    </p>

    <form class="grant-form" @submit.prevent="handleGrant">
      <ion-item>
        <ion-input
          v-model="email"
          type="email"
          label="User email"
          label-placement="stacked"
          placeholder="person@example.com"
          required
        />
      </ion-item>
      <ion-button expand="block" type="submit" :disabled="busy || !email.trim()">
        {{ busy ? 'Saving...' : 'Grant moderator' }}
      </ion-button>
    </form>

    <ion-list v-if="moderators.length > 0" class="moderator-list">
      <ion-item v-for="moderator in moderators" :key="moderator.uid">
        <ion-label>
          <h3>{{ moderator.displayName }}</h3>
          <p>{{ moderator.email }}</p>
        </ion-label>
        <ion-button
          v-if="canRevoke(moderator)"
          slot="end"
          fill="clear"
          color="danger"
          size="small"
          :disabled="busy"
          @click="handleRevoke(moderator.uid)"
        >
          Revoke
        </ion-button>
      </ion-item>
    </ion-list>

    <p v-else class="empty">No moderators assigned yet.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  toastController,
} from '@ionic/vue';

import { currentUser } from '@/features/auth/services/auth';
import {
  fetchCommunityModerators,
  findUserByEmail,
  grantCommunityModerator,
  revokeCommunityModerator,
} from '@/common/services/users';
import type { UserProfile } from '@/types';
import { canManageCommunityModerators, isSuperAdmin } from '@/utils/moderation';

const props = defineProps<{
  communityId: string;
  communityName: string;
  profile: UserProfile | null;
}>();

const moderators = ref<UserProfile[]>([]);
const email = ref('');
const busy = ref(false);

const manageable = computed(() =>
  canManageCommunityModerators(props.profile, props.communityId),
);

watch(
  () => props.communityId,
  () => {
    void loadModerators();
  },
);

onMounted(() => {
  void loadModerators();
});

async function loadModerators() {
  if (!manageable.value) {
    moderators.value = [];
    return;
  }

  moderators.value = await fetchCommunityModerators(props.communityId);
}

function canRevoke(moderator: UserProfile): boolean {
  if (!props.profile || isSuperAdmin(moderator)) {
    return false;
  }

  if (moderator.uid === currentUser.value?.uid) {
    return false;
  }

  return canManageCommunityModerators(props.profile, props.communityId);
}

async function handleGrant() {
  const actor = props.profile;
  if (!actor) {
    return;
  }

  busy.value = true;

  try {
    const target = await findUserByEmail(email.value);
    if (!target) {
      throw new Error('No user found with that email');
    }

    await grantCommunityModerator(actor, target.uid, props.communityId);
    email.value = '';
    await loadModerators();
    await showToast('Moderator access granted', 'success');
  } catch (error) {
    await showToast(error instanceof Error ? error.message : 'Could not grant moderator access', 'danger');
  } finally {
    busy.value = false;
  }
}

async function handleRevoke(targetUid: string) {
  const actor = props.profile;
  if (!actor) {
    return;
  }

  busy.value = true;

  try {
    await revokeCommunityModerator(actor, targetUid, props.communityId);
    await loadModerators();
    await showToast('Moderator access revoked', 'success');
  } catch (error) {
    await showToast(error instanceof Error ? error.message : 'Could not revoke moderator access', 'danger');
  } finally {
    busy.value = false;
  }
}

async function showToast(message: string, color: 'success' | 'danger') {
  const toast = await toastController.create({
    message,
    duration: 2500,
    color,
  });
  await toast.present();
}
</script>

<style scoped>
.moderator-panel {
  margin: 1.5rem 0;
  padding-top: 1rem;
  border-top: 1px solid var(--ion-color-step-150);
}

.moderator-panel h4 {
  margin: 0 0 0.25rem;
}

.hint,
.empty {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.grant-form {
  margin: 0.75rem 0 1rem;
}

.moderator-list {
  margin-top: 0.5rem;
}
</style>
