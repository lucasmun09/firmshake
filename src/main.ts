import { createApp } from 'vue'
import App from './App.vue'
import router from './router';

import { IonicVue } from '@ionic/vue';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
/* @import '@ionic/vue/css/palettes/dark.class.css'; */
import '@ionic/vue/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';
import './theme/layout.css';
import './theme/google-maps.css';

import { debugLog } from '@/common/debug/debugLog';
import { initResponseCacheOnPageLoad, getCacheOwnerUid } from '@/common/services/responseCache';
import { hydrateBootstrapFromCache } from '@/common/services/appBootstrap';
import { bootstrapDirectTabEntry } from '@/common/services/tabPrefetch';

const BOOTSTRAP_RELOAD_KEY = 'firmshake:bootstrap-reload';
const BOOTSTRAP_RELOAD_COUNT_KEY = 'firmshake:bootstrap-reload-count';
const CHUNK_RELOAD_KEY = 'firmshake:chunk-reload';
const GOOGLE_REDIRECT_PENDING_KEY = 'firmshake:googleRedirectPending';

function hasGoogleRedirectPending(): boolean {
  return typeof sessionStorage !== 'undefined'
    && sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) !== null;
}

initResponseCacheOnPageLoad();
const cacheOwnerUid = getCacheOwnerUid() ?? undefined;
hydrateBootstrapFromCache(cacheOwnerUid);

if (typeof window !== 'undefined') {
  bootstrapDirectTabEntry(window.location.pathname, cacheOwnerUid);
}

debugLog.info('app', 'FirmShake starting', {
  href: typeof window !== 'undefined' ? window.location.href : undefined,
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  googleRedirectPending: hasGoogleRedirectPending(),
});

const app = createApp(App)
  .use(IonicVue)
  .use(router);

app.mount('#app');

router.isReady().then(() => {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  sessionStorage.removeItem(BOOTSTRAP_RELOAD_KEY);
  sessionStorage.removeItem(BOOTSTRAP_RELOAD_COUNT_KEY);
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
});
