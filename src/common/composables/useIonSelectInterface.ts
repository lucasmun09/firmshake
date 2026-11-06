import { onMounted, onUnmounted, ref } from 'vue';

import {
  resolveIonSelectInterface,
  type IonSelectInterface,
} from '@/common/utils/ionSelectInterface';
import { MOBILE_WEB_MEDIA_QUERY } from '@/utils/platform';

export function useIonSelectInterface() {
  const selectInterface = ref<IonSelectInterface>(resolveIonSelectInterface());

  let mediaQuery: MediaQueryList | undefined;

  function sync() {
    selectInterface.value = resolveIonSelectInterface();
  }

  onMounted(() => {
    mediaQuery = window.matchMedia(MOBILE_WEB_MEDIA_QUERY);
    sync();
    mediaQuery.addEventListener('change', sync);
  });

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', sync);
  });

  return { selectInterface };
}
