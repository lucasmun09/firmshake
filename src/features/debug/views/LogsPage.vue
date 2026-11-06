<template>
  <ion-page class="logs-page">
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button :default-href="authBackHref" />
        </ion-buttons>
        <ion-title>Debug logs</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content ref="contentRef" class="logs-content" @ionScroll="handleScroll">
      <AppContentFrame>
        <p class="intro">
          Logs are saved in this browser's local storage so they survive refresh. Opening this page
          in its own tab uses a minimal boot (no Firebase or Firestore) so it does not interfere
          with the main app tab.
        </p>

        <div class="actions">
          <ion-button expand="block" @click="shareLogsViaEmail">
            Share logs via email
          </ion-button>
          <ion-button expand="block" fill="outline" color="medium" @click="downloadLogs">
            Download logs
          </ion-button>
          <ion-button expand="block" fill="outline" color="medium" @click="copyLogs">
            Copy to clipboard
          </ion-button>
          <ion-button expand="block" fill="outline" color="medium" @click="refreshLogs">
            Refresh
          </ion-button>
          <ion-button expand="block" fill="outline" color="danger" @click="clearLogs">
            Clear logs
          </ion-button>
        </div>

        <p class="meta">
          {{ allEntries.length }} entries<template v-if="hasMoreLogs">
            (showing {{ visibleEntries.length }}, {{ hiddenOlderCount }} older not loaded)
          </template>
        </p>

        <ion-list v-if="visibleEntries.length">
          <ion-item
            v-for="entry in visibleEntries"
            :key="entry.id"
            lines="full"
            button
            :detail="false"
            class="log-item"
            @click="toggleEntry(entry.id)"
          >
            <ion-icon
              slot="start"
              :icon="isEntryExpanded(entry.id) ? chevronDownOutline : chevronForwardOutline"
              class="expand-icon"
              aria-hidden="true"
            />

            <ion-label class="log-entry">
              <div class="log-header">
                <ion-badge :color="badgeColor(entry.level)">{{ entry.level }}</ion-badge>
                <span class="category">{{ entry.category }}</span>
                <span v-if="isMetaLogEntry(entry)" class="meta-tag">meta</span>
                <span class="time">{{ formatTime(entry.timestamp) }}</span>
              </div>

              <p class="message" :class="{ collapsed: !isEntryExpanded(entry.id) }">
                {{ entry.message }}
              </p>

              <pre
                v-if="entry.data && isEntryExpanded(entry.id)"
                class="data"
              >{{ formatData(entry.data) }}</pre>
            </ion-label>
          </ion-item>
        </ion-list>

        <p v-else class="empty">No logs yet. Use the app and return here to inspect activity.</p>

        <div v-if="loadingOlder" class="loading-older">
          <ion-spinner name="crescent" />
        </div>

        <div
          v-if="hasMoreLogs"
          ref="bottomSentinelRef"
          class="bottom-sentinel"
          aria-hidden="true"
        />
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import { useRoute } from 'vue-router';
import { chevronDownOutline, chevronForwardOutline } from 'ionicons/icons';
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
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';

import AppContentFrame from '@/components/AppContentFrame.vue';
import {
  buildDebugLogShareMailtoUrl,
  clearDebugLogs,
  debugLog,
  downloadDebugLogs,
  exportDebugLogsJson,
  getDebugLogs,
  isMetaLogEntry,
  reloadDebugLogsFromStorage,
  subscribeDebugLogs,
  type DebugLogEntry,
  type DebugLogLevel,
} from '@/common/debug/debugLog';

const route = useRoute();

/** Collapsed ion-item height (meta entries default collapsed). */
const COLLAPSED_ROW_HEIGHT = 72;
const VIEWPORT_MULTIPLIER = 2;
const LOAD_BATCH_MIN = 15;
const AT_TOP_THRESHOLD_PX = 32;

const contentRef = ref<InstanceType<typeof IonContent>>();
const bottomSentinelRef = ref<HTMLElement>();
const allEntries = ref<DebugLogEntry[]>(getDebugLogs());
const oldestVisibleIndex = ref(0);
const isUserAtTop = ref(true);
const loadingOlder = ref(false);
const expandOverrides = ref(new Map<string, boolean>());

let unsubscribe: (() => void) | undefined;
let bottomObserver: IntersectionObserver | undefined;
let loadMoreLock = false;

const visibleEntries = computed(() => {
  const entries = allEntries.value;
  if (entries.length === 0) {
    return [];
  }

  const start = Math.max(0, oldestVisibleIndex.value);
  const end = entries.length - 1;
  if (start > end) {
    return [];
  }

  return entries.slice(start, end + 1).reverse();
});

const hasMoreLogs = computed(() => oldestVisibleIndex.value > 0);
const hiddenOlderCount = computed(() => oldestVisibleIndex.value);

const authFlowBackRoutes: Record<string, string> = {
  MfaEnroll: '/mfa-enroll',
  CompleteProfile: '/complete-profile',
  Login: '/login',
  Register: '/register',
  MfaChallenge: '/mfa-challenge',
};

const authBackHref = computed(() => {
  const fromName = typeof route.query.from === 'string' ? route.query.from : null;
  if (fromName && fromName in authFlowBackRoutes) {
    return authFlowBackRoutes[fromName];
  }

  return '/mfa-enroll';
});

function windowSizeForViewport(viewportHeight: number): number {
  return Math.max(
    LOAD_BATCH_MIN,
    Math.ceil((VIEWPORT_MULTIPLIER * viewportHeight) / COLLAPSED_ROW_HEIGHT),
  );
}

async function getScrollElement(): Promise<HTMLElement | null> {
  const ionContent = contentRef.value;
  if (!ionContent?.$el) {
    return null;
  }

  return ionContent.$el.getScrollElement();
}

async function getViewportHeight(): Promise<number> {
  const scrollEl = await getScrollElement();
  if (scrollEl?.clientHeight) {
    return scrollEl.clientHeight;
  }

  return window.innerHeight || 640;
}

async function resetVisibleWindow(): Promise<void> {
  await nextTick();
  const total = allEntries.value.length;
  if (total === 0) {
    oldestVisibleIndex.value = 0;
    return;
  }

  const viewportHeight = await getViewportHeight();
  const windowSize = windowSizeForViewport(viewportHeight);
  oldestVisibleIndex.value = Math.max(0, total - windowSize);
  isUserAtTop.value = true;
  await nextTick();
  setupBottomObserver();
}

function entriesGrewAtEnd(previous: DebugLogEntry[], next: DebugLogEntry[]): boolean {
  if (next.length <= previous.length) {
    return false;
  }

  if (previous.length === 0) {
    return next.length > 0;
  }

  return previous.every((entry, index) => entry.id === next[index]?.id);
}

async function handleEntriesUpdate(next: DebugLogEntry[]): Promise<void> {
  const previous = allEntries.value;
  const grewAtEnd = entriesGrewAtEnd(previous, next);

  if (grewAtEnd && !isUserAtTop.value) {
    const scrollEl = await getScrollElement();
    const previousScrollTop = scrollEl?.scrollTop ?? 0;
    const previousScrollHeight = scrollEl?.scrollHeight ?? 0;

    allEntries.value = next;

    await nextTick();
    if (scrollEl) {
      scrollEl.scrollTop = previousScrollTop + (scrollEl.scrollHeight - previousScrollHeight);
    }
  } else {
    allEntries.value = next;
  }

  if (next.length === 0) {
    oldestVisibleIndex.value = 0;
    return;
  }

  if (oldestVisibleIndex.value >= next.length) {
    await resetVisibleWindow();
    return;
  }

  if (previous.length === 0) {
    await resetVisibleWindow();
  }
}

async function loadOlderEntries(): Promise<void> {
  if (!hasMoreLogs.value || loadMoreLock) {
    return;
  }

  loadMoreLock = true;
  loadingOlder.value = true;

  try {
    const viewportHeight = await getViewportHeight();
    const batch = windowSizeForViewport(viewportHeight);
    oldestVisibleIndex.value = Math.max(0, oldestVisibleIndex.value - batch);
    await nextTick();
    setupBottomObserver();
  } finally {
    loadingOlder.value = false;
    loadMoreLock = false;
  }
}

function setupBottomObserver(): void {
  bottomObserver?.disconnect();
  bottomObserver = undefined;

  if (!hasMoreLogs.value || !bottomSentinelRef.value) {
    return;
  }

  bottomObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (visible) {
        void loadOlderEntries();
      }
    },
    {
      root: null,
      threshold: 0.01,
    },
  );

  bottomObserver.observe(bottomSentinelRef.value);
}

async function handleScroll(): Promise<void> {
  const scrollEl = await getScrollElement();
  if (!scrollEl) {
    return;
  }

  isUserAtTop.value = scrollEl.scrollTop < AT_TOP_THRESHOLD_PX;
}

onMounted(() => {
  // Ensure boot shell is gone even when opened via the full app router.
  document.getElementById('app-boot-shell')?.remove();

  unsubscribe = subscribeDebugLogs((next) => {
    void handleEntriesUpdate(next);
  });
  void resetVisibleWindow();
});

onIonViewWillEnter(() => {
  debugLog.debug('debug', 'LogsPage opened', {
    routePath: route.fullPath,
    memoryEntryCount: getDebugLogs().length,
    storageEntryCount: reloadDebugLogsFromStorage().length,
  });
  void resetVisibleWindow();
});

watch(visibleEntries, () => {
  void nextTick(() => setupBottomObserver());
});

onUnmounted(() => {
  unsubscribe?.();
  bottomObserver?.disconnect();
});

function isEntryExpanded(entryId: string): boolean {
  const entry = allEntries.value.find((item) => item.id === entryId);
  const override = expandOverrides.value.get(entryId);

  if (override !== undefined) {
    return override;
  }

  return entry ? !isMetaLogEntry(entry) : true;
}

function toggleEntry(entryId: string): void {
  const next = new Map(expandOverrides.value);
  next.set(entryId, !isEntryExpanded(entryId));
  expandOverrides.value = next;
}

async function refreshLogs(): Promise<void> {
  reloadDebugLogsFromStorage();
  await resetVisibleWindow();
}

function clearLogs(): void {
  clearDebugLogs();
  expandOverrides.value = new Map();
}

function downloadLogs(): void {
  downloadDebugLogs();
}

const MAILTO_OPEN_DELAY_MS = 350;

async function shareLogsViaEmail(): Promise<void> {
  const exportedAt = new Date();
  const filename = downloadDebugLogs(exportedAt);

  debugLog.info('debug', 'Share logs via email started', {
    filename,
    recipient: 'lucasmun09@gmail.com',
  });

  await showToast(
    `Downloading ${filename}. Your email app will open — please attach the file.`,
    'primary',
  );

  window.setTimeout(() => {
    window.location.href = buildDebugLogShareMailtoUrl(exportedAt);
  }, MAILTO_OPEN_DELAY_MS);
}

async function copyLogs(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exportDebugLogsJson());
    await showToast('Logs copied to clipboard', 'success');
  } catch {
    await showToast('Could not copy logs — check clipboard permissions', 'danger');
  }
}

async function showToast(message: string, color: string): Promise<void> {
  const toast = await toastController.create({ message, duration: 2500, color });
  await toast.present();
}

function badgeColor(level: DebugLogLevel): string {
  if (level === 'error') {
    return 'danger';
  }
  if (level === 'warn') {
    return 'warning';
  }
  if (level === 'info') {
    return 'primary';
  }
  return 'medium';
}

function formatTime(timestamp: string): string {
  return timestamp;
}

function formatData(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
</script>

<style scoped>
/*
 * Keep log copy readable in dark palette. Avoid relying solely on inherited
 * ion-text tokens in case the page is painted before Ionic CSS vars settle.
 */
.logs-page {
  --background: var(--ion-background-color, #ffffff);
  color: var(--ion-text-color, #111111);
}

.intro,
.meta,
.empty {
  color: var(--ion-color-medium, #92949c);
  line-height: 1.45;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.meta {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
}

.loading-older {
  display: flex;
  justify-content: center;
  padding: 0.75rem 0;
}

.bottom-sentinel {
  height: 1px;
}

.log-item {
  --padding-start: 0.5rem;
  align-items: flex-start;
}

.expand-icon {
  margin-top: 0.35rem;
  font-size: 1rem;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.log-entry {
  white-space: normal;
}

.log-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.category {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.03em;
  color: var(--ion-text-color, #111111);
}

.meta-tag {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ion-color-medium);
  border: 1px solid var(--ion-color-medium);
  border-radius: 4px;
  padding: 0.05rem 0.35rem;
}

.time {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.message {
  margin: 0;
  font-size: 0.95rem;
  color: var(--ion-text-color, #111111);
}

.message.collapsed {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data {
  margin: 0.5rem 0 0;
  padding: 0.5rem;
  border-radius: 6px;
  background: var(--ion-color-light, #f4f5f8);
  color: var(--ion-color-dark, #222428);
  font-size: 0.75rem;
  overflow-x: auto;
  max-height: 12rem;
}
</style>
