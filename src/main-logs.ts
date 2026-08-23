import { createApp } from 'vue';
import AppLogs from './AppLogs.vue';
import logsOnlyRouter from './router/logsOnlyRouter';

import { IonicVue } from '@ionic/vue';

import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';
import '@ionic/vue/css/palettes/dark.class.css';

import './theme/variables.css';
import './theme/layout.css';

import { debugLog } from '@/common/debug/debugLog';
import { initThemePreferenceOnBoot } from '@/common/services/themePreference';

initThemePreferenceOnBoot();

debugLog.info('app', 'FirmShake debug logs starting (minimal boot)', {
  href: typeof window !== 'undefined' ? window.location.href : undefined,
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
});

const app = createApp(AppLogs)
  .use(IonicVue, { animated: false })
  .use(logsOnlyRouter);

app.mount('#app');

// Belt-and-suspenders: remove boot shell even if router readiness races.
document.getElementById('app-boot-shell')?.remove();
