import { ref } from 'vue';

import { debugLog, serializeError } from '@/common/debug/debugLog';

export const TAB_FEED_LOAD_TIMEOUT_MS = 8_000;

export function useTabFeedLoader(tab: 'buying' | 'selling' | 'inbox') {
  const loading = ref(true);
  const refreshing = ref(false);
  const error = ref('');

  let loadGeneration = 0;
  let loadTimeoutId: number | undefined;

  function clearLoadTimeout() {
    if (loadTimeoutId !== undefined) {
      window.clearTimeout(loadTimeoutId);
      loadTimeoutId = undefined;
    }
  }

  function logLoading(next: boolean, reason: string, generation: number) {
    debugLog.debug(tab, `loading → ${next}`, { reason, generation });
  }

  function beginLoad(): number {
    const generation = ++loadGeneration;
    error.value = '';
    clearLoadTimeout();

    loadTimeoutId = window.setTimeout(() => {
      if (generation !== loadGeneration || !loading.value) {
        return;
      }

      debugLog.warn(tab, 'Load timeout — clearing spinner', {
        generation,
        timeoutMs: TAB_FEED_LOAD_TIMEOUT_MS,
      });
      loading.value = false;
      refreshing.value = false;
      error.value = 'Loading is taking longer than expected. Try again.';
    }, TAB_FEED_LOAD_TIMEOUT_MS);

    return generation;
  }

  function finishLoad(generation: number, reason = 'data') {
    if (generation !== loadGeneration) {
      return;
    }

    clearLoadTimeout();
    if (loading.value) {
      logLoading(false, reason, generation);
    }
    loading.value = false;
    refreshing.value = false;
    error.value = '';
  }

  function failLoad(generation: number, message: string, err?: unknown) {
    if (generation !== loadGeneration) {
      return;
    }

    clearLoadTimeout();
    if (loading.value) {
      logLoading(false, 'error', generation);
    }
    loading.value = false;
    refreshing.value = false;
    error.value = message;

    debugLog.warn(tab, 'Load failed', {
      generation,
      message,
      error: err ? serializeError(err) : undefined,
    });
  }

  function hydrateFromCache<T>(
    readCache: () => T[] | null,
    apply: (data: T[]) => void,
    uid: string,
  ): boolean {
    const cached = readCache();
    if (cached === null) {
      return false;
    }

    apply(cached);
    if (loading.value) {
      logLoading(false, 'cache', loadGeneration);
    }
    loading.value = false;
    refreshing.value = true;
    debugLog.debug(tab, 'Cache hit — hydrating placeholder', {
      uid,
      count: cached.length,
    });
    return true;
  }

  function startLoadingSpinner() {
    if (!loading.value) {
      logLoading(true, 'subscribe', loadGeneration);
    }
    loading.value = true;
    refreshing.value = false;
  }

  function cancelLoad() {
    loadGeneration += 1;
    clearLoadTimeout();
  }

  function isCurrentGeneration(generation: number): boolean {
    return generation === loadGeneration;
  }

  return {
    loading,
    refreshing,
    error,
    beginLoad,
    finishLoad,
    failLoad,
    hydrateFromCache,
    startLoadingSpinner,
    cancelLoad,
    isCurrentGeneration,
  };
}
