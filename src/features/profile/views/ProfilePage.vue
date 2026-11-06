<template>
  <ion-page>
    <AppTopToolbar title="Settings" />

    <ion-content>
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

        <ion-button expand="block" fill="outline" router-link="/tabs/savedlistings" class="shortcut-btn">
          Saved listings
        </ion-button>

        <ion-button expand="block" fill="outline" router-link="/tabs/blockedusers" class="shortcut-btn">
          Blocked users
        </ion-button>

        <section class="appearance-section">
          <h3 class="section-heading">Appearance</h3>
          <ion-segment
            v-model="themePreference"
            class="theme-segment"
            @ionChange="onThemePreferenceChange"
          >
            <ion-segment-button value="light">
              <ion-label>Light</ion-label>
            </ion-segment-button>
            <ion-segment-button value="dark">
              <ion-label>Dark</ion-label>
            </ion-segment-button>
            <ion-segment-button value="system">
              <ion-label>System</ion-label>
            </ion-segment-button>
          </ion-segment>
        </section>

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
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
} from '@ionic/vue';
import {
  readThemePreference,
  setThemePreference,
  type ThemePreference,
} from '@/common/services/themePreference';

import AppContentFrame from '@/components/AppContentFrame.vue';
import AppTopToolbar from '@/components/AppTopToolbar.vue';
import ProfilePhotoEditor from '@/features/profile/components/ProfilePhotoEditor.vue';
import { currentUser, logout } from '@/features/auth/services/auth';
import { isMfaEnrolled, isPasswordAuthUser } from '@/features/auth/services/mfa';
import { subscribeUserProfile } from '@/common/services/users';
import type { UserProfile } from '@/types';
import { isSuperAdmin } from '@/utils/moderation';

const router = useRouter();
const profile = ref<UserProfile | null>(null);
const themePreference = ref<ThemePreference>(readThemePreference());

const communityIds = computed(() => profile.value?.communityIds ?? ['all']);
const showAdminBadge = computed(() => isSuperAdmin(profile.value));
const profileDisplayName = computed(
  () => profile.value?.displayName ?? currentUser.value?.displayName ?? 'FirmShake User',
);
const profileEmail = computed(
  () => profile.value?.email ?? currentUser.value?.email ?? '',
);
/** Optional SMS setup is for email/password accounts only — Google/OAuth skips SMS MFA. */
const showSmsSecurityLink = computed(() => {
  const user = currentUser.value;
  return Boolean(user && isPasswordAuthUser(user) && !isMfaEnrolled(user));
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

function onThemePreferenceChange(event: CustomEvent) {
  const next = event.detail.value;
  if (next === 'light' || next === 'dark' || next === 'system') {
    themePreference.value = next;
    setThemePreference(next);
  }
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
  color: var(--ion-color-primary-contrast);
}

.profile-card p {
  color: var(--ion-color-medium);
}

.logout-btn {
  margin-top: 1.5rem;
}

.shortcut-btn {
  margin-top: var(--fs-form-field-gap);
}

.appearance-section {
  margin-top: var(--fs-section-gap);
}

.section-heading {
  margin: 0 0 0.65rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}

.theme-segment {
  width: 100%;
}
</style>
