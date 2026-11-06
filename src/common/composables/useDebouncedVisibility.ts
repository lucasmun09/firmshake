import { onUnmounted, ref, watch, type Ref } from 'vue';

/** Minimum time a spinner stays visible once shown — avoids flicker on fast loads. */
export const LOADING_SPINNER_MIN_DISPLAY_MS = 500;

export interface DebouncedVisibilityOptions {
  /** Delay before showing when source becomes active (default 300). */
  delayMs?: number;
  /** Minimum visible time once shown before hiding (default 0). */
  minDisplayMs?: number;
}

function resolveOptions(
  delayMsOrOptions: number | DebouncedVisibilityOptions,
): Required<DebouncedVisibilityOptions> {
  if (typeof delayMsOrOptions === 'number') {
    return { delayMs: delayMsOrOptions, minDisplayMs: 0 };
  }

  return {
    delayMs: delayMsOrOptions.delayMs ?? 300,
    minDisplayMs: delayMsOrOptions.minDisplayMs ?? 0,
  };
}

export function useDebouncedVisibility(
  source: Ref<boolean>,
  delayMsOrOptions: number | DebouncedVisibilityOptions = 300,
) {
  const { delayMs, minDisplayMs } = resolveOptions(delayMsOrOptions);
  const visible = ref(false);
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let shownAt: number | null = null;

  function clearShowTimer() {
    if (showTimer !== undefined) {
      clearTimeout(showTimer);
      showTimer = undefined;
    }
  }

  function clearHideTimer() {
    if (hideTimer !== undefined) {
      clearTimeout(hideTimer);
      hideTimer = undefined;
    }
  }

  function hideImmediately() {
    clearHideTimer();
    visible.value = false;
    shownAt = null;
  }

  function scheduleHide() {
    clearHideTimer();

    if (!visible.value) {
      return;
    }

    const elapsed = shownAt != null ? Date.now() - shownAt : minDisplayMs;
    const remaining = Math.max(0, minDisplayMs - elapsed);

    if (remaining === 0) {
      hideImmediately();
      return;
    }

    hideTimer = setTimeout(() => {
      if (!source.value) {
        hideImmediately();
      }
      hideTimer = undefined;
    }, remaining);
  }

  watch(
    source,
    (active) => {
      if (active) {
        clearHideTimer();
        clearShowTimer();
        showTimer = setTimeout(() => {
          if (source.value) {
            visible.value = true;
            shownAt = Date.now();
          }
          showTimer = undefined;
        }, delayMs);
        return;
      }

      clearShowTimer();

      if (!visible.value) {
        return;
      }

      scheduleHide();
    },
    { immediate: true },
  );

  onUnmounted(() => {
    clearShowTimer();
    clearHideTimer();
  });

  return visible;
}

/** Show immediately; enforce minimum visible duration on hide. */
export function useMinimumDisplayVisibility(
  source: Ref<boolean>,
  minDisplayMs = LOADING_SPINNER_MIN_DISPLAY_MS,
) {
  return useDebouncedVisibility(source, { delayMs: 0, minDisplayMs });
}
