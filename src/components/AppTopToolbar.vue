<template>
  <ion-header>
    <ion-toolbar color="primary" class="app-top-toolbar">
      <div class="toolbar-layout">
        <div class="toolbar-left">
          <ion-buttons v-if="showBackButton" class="toolbar-back">
            <ion-back-button :default-href="backHref" />
          </ion-buttons>
          <div class="toolbar-titles">
            <FirmShakeLogo link-to-home class="toolbar-logo" />
            <span class="toolbar-title toolbar-title--desktop">{{ displayTitle }}</span>
            <span class="toolbar-title toolbar-title--mobile" aria-hidden="true">
              <span class="toolbar-title__line">{{ titleLines.line1 }}</span>
              <span class="toolbar-title__line">{{ titleLines.line2 }}</span>
            </span>
            <span class="toolbar-title-sr">{{ displayTitle }}</span>
          </div>
        </div>

        <div class="toolbar-right">
          <template v-if="isGuest">
            <ion-button class="login-create-btn" @click="goToLoginCreate">
              Login/Create
            </ion-button>
          </template>

          <template v-else>
            <button
              id="toolbar-profile-menu"
              type="button"
              class="profile-menu-trigger"
              aria-label="Profile menu"
              aria-haspopup="menu"
              data-testid="toolbar-profile-menu"
            >
              <div class="profile-text">
                <span v-if="showAdminBadge" class="admin-badge admin-badge--inline">ADMIN</span>
                <span class="profile-name">{{ profileDisplayName }}</span>
                <span v-if="profileEmail" class="profile-email">{{ profileEmail }}</span>
              </div>

              <div class="profile-avatar-wrap">
                <UserAvatar
                  :name="profile?.displayName"
                  :photo-url="profile?.photoUrl"
                  :size="avatarSize"
                />
                <span v-if="showAdminBadge" class="admin-badge admin-badge--overlay">ADMIN</span>
              </div>
            </button>

            <ion-popover
              trigger="toolbar-profile-menu"
              dismiss-on-select
              side="bottom"
              alignment="end"
              class="profile-menu-popover"
            >
              <ion-content>
                <ion-list lines="none" class="profile-menu-list">
                  <ion-item
                    button
                    :detail="false"
                    data-testid="toolbar-menu-settings"
                    @click="goToSettings"
                  >
                    <ion-icon slot="start" :icon="settingsOutline" aria-hidden="true" />
                    <ion-label>Settings</ion-label>
                  </ion-item>
                  <ion-item
                    button
                    :detail="false"
                    data-testid="toolbar-menu-logout"
                    @click="handleLogout"
                  >
                    <ion-icon slot="start" :icon="logOutOutline" aria-hidden="true" />
                    <ion-label>Log out</ion-label>
                  </ion-item>
                </ion-list>
              </ion-content>
            </ion-popover>

            <ion-button
              aria-label="Notifications"
              class="notification-btn"
              @click="notificationsOpen = true"
            >
              <ion-icon slot="icon-only" :icon="notificationsOutline" />
              <ion-badge v-if="unreadCount > 0" color="danger" class="notification-badge">
                {{ unreadCount > 99 ? '99+' : unreadCount }}
              </ion-badge>
            </ion-button>
          </template>
        </div>
      </div>
    </ion-toolbar>
    <slot />
  </ion-header>

  <NotificationPanel :is-open="notificationsOpen" @close="notificationsOpen = false" />
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonToolbar,
  useIonRouter,
} from '@ionic/vue';
import { logOutOutline, notificationsOutline, settingsOutline } from 'ionicons/icons';

import NotificationPanel from '@/features/messages/components/NotificationPanel.vue';
import FirmShakeLogo from '@/components/FirmShakeLogo.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { bootstrapProfile } from '@/common/services/appBootstrap';
import {
  formatToolbarTitle,
  splitToolbarTitle,
} from '@/common/utils/toolbarTitle';
import { authReady, logout, resolveSessionUser } from '@/features/auth/services/auth';
import { subscribeUnreadNotificationCount } from '@/features/messages/services/notifications';
import { isSuperAdmin } from '@/utils/moderation';
import { isMobileWeb, isMobileWebViewport } from '@/utils/platform';

const props = withDefaults(
  defineProps<{
    title: string;
    showBackButton?: boolean;
    backHref?: string;
  }>(),
  {
    showBackButton: false,
    backHref: '/tabs/home',
  },
);

const displayTitle = computed(() => formatToolbarTitle(props.title));
const titleLines = computed(() => splitToolbarTitle(props.title));

const avatarSize = computed(() => (isMobileWebViewport() ? 'sm' : 'xs'));

const notificationsOpen = ref(false);
const unreadCount = ref(0);
const ionRouter = useIonRouter();

const profile = bootstrapProfile;

const isGuest = computed(
  () => authReady.value && !resolveSessionUser(),
);

const showAdminBadge = computed(() => isSuperAdmin(profile.value));
const profileDisplayName = computed(
  () => profile.value?.displayName ?? resolveSessionUser()?.displayName ?? 'FirmShake User',
);
const profileEmail = computed(
  () => profile.value?.email ?? resolveSessionUser()?.email ?? '',
);

let unsubscribeNotifications: (() => void) | undefined;

function goToSettings() {
  ionRouter.navigate('/tabs/profile', 'forward', 'push');
}

async function handleLogout() {
  await logout();
  ionRouter.navigate('/login', 'root', 'replace');
}

function goToLoginCreate() {
  if (isMobileWeb()) {
    ionRouter.navigate('/tabs/login-create', 'forward', 'push');
    return;
  }
  ionRouter.navigate('/login', 'forward', 'push');
}

function bindNotificationSubscription() {
  unsubscribeNotifications?.();
  unsubscribeNotifications = undefined;

  if (!authReady.value) {
    return;
  }

  const user = resolveSessionUser();
  if (!user) {
    unreadCount.value = 0;
    return;
  }

  unsubscribeNotifications = subscribeUnreadNotificationCount(user.uid, (count) => {
    unreadCount.value = count;
  });
}

watch([authReady, () => resolveSessionUser()?.uid], bindNotificationSubscription, {
  immediate: true,
});

onUnmounted(() => {
  unsubscribeNotifications?.();
});
</script>

<style scoped>
:global(ion-header:has(.refresh-indicator)) {
  position: relative;
}

.app-top-toolbar {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  --min-height: 0;
}

.toolbar-layout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.15rem var(--fs-toolbar-inset) 0.15rem calc(var(--fs-toolbar-inset) + 0.15rem);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}

.toolbar-back {
  margin: 0;
}

.toolbar-titles {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.toolbar-logo {
  margin-inline-end: 0.05rem;
}

.toolbar-title {
  font-weight: 700;
  line-height: 1.15;
  color: var(--fs-toolbar-contrast);
}

.toolbar-title--desktop {
  font-size: 1.05rem;
  white-space: nowrap;
}

.toolbar-title--mobile {
  display: none;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.toolbar-title__line {
  display: block;
  font-size: 0.92rem;
  line-height: 1.1;
  white-space: nowrap;
}

.toolbar-title-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.toolbar-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
  min-width: 0;
  flex-shrink: 0;
}

.profile-text {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 0.3rem;
  min-width: 0;
  margin-inline-end: 0.05rem;
}

.admin-badge {
  flex-shrink: 0;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.22);
  color: var(--fs-toolbar-contrast);
}

.admin-badge--inline {
  font-size: 0.5rem;
  padding: 0.18rem 0.3rem;
}

.admin-badge--overlay {
  display: none;
}

.profile-name {
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.15;
  color: var(--fs-toolbar-contrast);
  white-space: nowrap;
  flex-shrink: 0;
}

.profile-email {
  font-size: 0.62rem;
  line-height: 1.15;
  color: rgba(255, 255, 255, 0.82);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: end;
}

.profile-menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  max-width: min(100%, 22rem);
}

.profile-menu-trigger:focus-visible {
  outline: 2px solid var(--ion-color-primary-contrast);
  outline-offset: 2px;
  border-radius: 0.35rem;
}

.profile-avatar-wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding-inline: 0.1rem 0.05rem;
}

.notification-btn,
.login-create-btn {
  flex-shrink: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  margin: 0;
  height: 2rem;
  min-height: 2rem;
}

.login-create-btn {
  --padding-start: 0.65rem;
  --padding-end: 0.65rem;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: none;
}

.notification-btn {
  position: relative;
  --padding-start: 0.2rem;
  --padding-end: 0.3rem;
}

.notification-btn ion-icon {
  font-size: 1.35rem;
}

.profile-menu-list {
  margin: 0;
  padding: var(--fs-space-xs) 0;
  min-width: 11rem;
}

.profile-menu-list ion-icon {
  color: var(--ion-color-medium);
  font-size: 1.15rem;
  margin-inline-end: var(--fs-space-xs);
}

.notification-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  font-size: 0.65rem;
  line-height: 16px;
  padding: 0 4px;
}

@media (max-width: 767.98px) {
  .app-top-toolbar {
    --min-height: 3.35rem;
  }

  .toolbar-layout {
    align-items: center;
    padding-block: 0.35rem;
  }

  .toolbar-title--desktop {
    display: none;
  }

  .toolbar-title--mobile {
    display: flex;
  }

  .profile-text {
    display: none;
  }

  .admin-badge--overlay {
    display: block;
    position: absolute;
    right: -2px;
    bottom: -2px;
    z-index: 1;
    font-size: 0.42rem;
    padding: 0.12rem 0.22rem;
    border-radius: 3px;
    box-shadow: 0 0 0 1px var(--ion-color-primary);
  }

  .toolbar-logo :deep(.firmshake-logo__img) {
    width: 2rem;
    height: 2rem;
  }

  .notification-btn {
    height: 2.35rem;
    min-height: 2.35rem;
  }

  .notification-btn ion-icon {
    font-size: 1.55rem;
  }
}

@media (min-width: 768px) {
  .toolbar-layout {
    padding: 0.25rem var(--fs-toolbar-inset);
  }

  .toolbar-title--desktop {
    font-size: 1.15rem;
  }

  .profile-name {
    font-size: 0.82rem;
  }

  .profile-email {
    font-size: 0.68rem;
    max-width: min(22rem, 32vw);
  }
}
</style>
