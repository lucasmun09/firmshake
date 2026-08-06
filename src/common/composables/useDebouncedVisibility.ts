import { onUnmounted, ref, watch, type Ref } from 'vue';

export function useDebouncedVisibility(source: Ref<boolean>, delayMs = 300) {
  const visible = ref(false);
  let showTimer: ReturnType<typeof setTimeout> | undefined;

  function clearShowTimer() {
    if (showTimer !== undefined) {
      clearTimeout(showTimer);
      showTimer = undefined;
    }
  }

  watch(
    source,
    (active) => {
      if (active) {
        clearShowTimer();
        showTimer = setTimeout(() => {
          if (source.value) {
            visible.value = true;
          }
          showTimer = undefined;
        }, delayMs);
        return;
      }

      clearShowTimer();
      visible.value = false;
    },
    { immediate: true },
  );

  onUnmounted(() => {
    clearShowTimer();
  });

  return visible;
}
