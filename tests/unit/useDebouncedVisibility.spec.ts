import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, nextTick, ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';

import {
  LOADING_SPINNER_MIN_DISPLAY_MS,
  useDebouncedVisibility,
  useMinimumDisplayVisibility,
} from '@/common/composables/useDebouncedVisibility';

function mountVisibility(
  factory: (source: Ref<boolean>) => ReturnType<typeof useDebouncedVisibility>,
  initial = false,
) {
  let visible!: ReturnType<typeof useDebouncedVisibility>;
  let source!: Ref<boolean>;

  const wrapper = mount(
    defineComponent({
      setup() {
        source = ref(initial);
        visible = factory(source);
        return () => null;
      },
    }),
  );

  return {
    wrapper,
    get visible() {
      return visible;
    },
    get source() {
      return source;
    },
  };
}

describe('useDebouncedVisibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces show by delayMs', async () => {
    const harness = mountVisibility((source) => useDebouncedVisibility(source, 300));

    harness.source.value = true;
    await nextTick();
    expect(harness.visible.value).toBe(false);

    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(harness.visible.value).toBe(true);

    harness.wrapper.unmount();
  });

  it('keeps spinner visible for minDisplayMs after source clears', async () => {
    const harness = mountVisibility((source) =>
      useDebouncedVisibility(source, { delayMs: 0, minDisplayMs: 500 }),
    );

    harness.source.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(harness.visible.value).toBe(true);

    harness.source.value = false;
    await nextTick();
    expect(harness.visible.value).toBe(true);

    await vi.advanceTimersByTimeAsync(500);
    await nextTick();
    expect(harness.visible.value).toBe(false);

    harness.wrapper.unmount();
  });

  it('exports a 500ms default minimum display constant', () => {
    expect(LOADING_SPINNER_MIN_DISPLAY_MS).toBe(500);
  });

  it('useMinimumDisplayVisibility shows immediately with minimum hide delay', async () => {
    const harness = mountVisibility((source) => useMinimumDisplayVisibility(source));

    harness.source.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(harness.visible.value).toBe(true);

    harness.source.value = false;
    await nextTick();
    expect(harness.visible.value).toBe(true);

    await vi.advanceTimersByTimeAsync(LOADING_SPINNER_MIN_DISPLAY_MS);
    await nextTick();
    expect(harness.visible.value).toBe(false);

    harness.wrapper.unmount();
  });
});
