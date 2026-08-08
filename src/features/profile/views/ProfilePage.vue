<template>
  <ion-page>
    <AppTopToolbar title="Settings" />

    <ion-content class="ion-padding">
      <AppContentFrame>
        <div v-if="currentUser" class="profile-card">
          <ProfilePhotoEditor :community-ids="communityIds" />
          <div class="profile-name-row">
            <span v-if="showAdminBadge" class="admin-badge">ADMIN</span>
            <h2>{{ profileDisplayName }}</h2>
          </div>
          <p>{{ profileEmail }}</p>
        </div>

        <ion-button expand="block" fill="outline" router-link="/tabs/communities" class="shortcut-btn">
          Communities
        </ion-button>
        <ion-button expand="block" fill="outline" router-link="/tabs/sell" class="shortcut-btn">
          Post a listing
        </ion-button>

        <ion-button expand="block" fill="outline" router-link="/tabs/blockedusers" class="shortcut-btn">
          Blocked users
        </ion-button>

        <ion-button
          v-if="showSmsSecurityLink"
          expand="block"
          fill="outline"
          router-link="/mfa-enroll"
          class="shortcut-btn"
        >
          Verify phone number
        </ion-button>

        <ion-button expand="block" color="medium" class="logout-btn" @click="handleLogout">
          Sign out
        </ion-button>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonContent,
  IonPage,
} from '@ionic/vue';

import AppContentFrame from '@/components/AppContentFrame.vue';
import AppTopToolbar from '@/components/AppTopToolbar.vue';
import ProfilePhotoEditor from '@/features/profile/components/ProfilePhotoEditor.vue';
import { currentUser, logout } from '@/features/auth/services/auth';
import { isMfaEnrolled } from '@/features/auth/services/mfa';
import { subscribeUserProfile } from '@/common/services/users';
import type { UserProfile } from '@/types';
import { isSuperAdmin } from '@/utils/moderation';

const router = useRouter();
const profile = ref<UserProfile | null>(null);

const communityIds = computed(() => profile.value?.communityIds ?? ['all']);
const showAdminBadge = computed(() => isSuperAdmin(profile.value));
const profileDisplayName = computed(
  () => profile.value?.displayName ?? currentUser.value?.displayName ?? 'FirmShake User',
);
const profileEmail = computed(
  () => profile.value?.email ?? currentUser.value?.email ?? '',
);
const showSmsSecurityLink = computed(() => {
  const user = currentUser.value;
  return Boolean(user && !isMfaEnrolled(user));
});

let unsubscribeProfile: (() => void) | undefined;

onMounted(() => {
  const user = currentUser.value;
  if (user) {
    unsubscribeProfile = subscribeUserProfile(user.uid, (nextProfile) => {
      profile.value = nextProfile;
    });
  }
});

onUnmounted(() => {
  unsubscribeProfile?.();
});

async function handleLogout() {
  await logout();
  router.replace('/login');
}
</script>

<style scoped>
.profile-card {
  margin-bottom: 1rem;
  text-align: center;
}

.profile-card h2 {
  margin: 0;
}

.profile-name-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.admin-badge {
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
  padding: 0.25rem 0.4rem;
  border-radius: 4px;
  background: var(--ion-color-primary);
  color: #fff;
}

.profile-card p {
  color: var(--ion-color-medium);
}

.logout-btn {
  margin-top: 1.5rem;
}

.shortcut-btn {
  margin-top: 0.75rem;
}
</style>
