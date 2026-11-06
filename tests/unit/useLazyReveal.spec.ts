import { describe, expect, it, vi } from 'vitest';
import { defineComponent, ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';

import { useLazyReveal } from '@/common/composables/useLazyReveal';

function mountLazyReveal<T>(
  items: T[],
  options: Parameters<typeof useLazyReveal<T>>[1] = {},
) {
  const itemsRef = ref(items) as Ref<T[]>;
  let reveal!: ReturnType<typeof useLazyReveal<T>>;

  mount(
    defineComponent({
      setup() {
        reveal = useLazyReveal(itemsRef, options);
        return () => null;
      },
    }),
  );

  return { reveal, itemsRef };
}

describe('useLazyReveal', () => {
  it('does not show trailing skeletons for cards grid when listings remain in memory', () => {
    const items = Array.from({ length: 50 }, (_, index) => ({ id: `item-${index}` }));
    const loading = ref(false);

    const { reveal } = mountLazyReveal(items, {
      loading,
      gridColumnCount: ref(5),
      gridRowCount: ref(3),
      minSkeletonMs: 0,
    });

    expect(reveal.visibleItems.value.length).toBe(30);
    expect(reveal.visibleItems.value.length).toBeLessThan(items.length);
    expect(reveal.trailingSkeletonCount.value).toBe(0);
  });

  it('uses a larger initial batch for cards grid than one viewport page', () => {
    const items = Array.from({ length: 40 }, (_, index) => ({ id: `item-${index}` }));
    const loading = ref(false);

    const { reveal } = mountLazyReveal(items, {
      loading,
      gridColumnCount: ref(5),
      gridRowCount: ref(3),
      minSkeletonMs: 0,
    });

    expect(reveal.visibleItems.value.length).toBe(30);
  });

  it('still shows trailing skeletons for list mode', () => {
    vi.stubGlobal('innerHeight', 640);

    const items = Array.from({ length: 100 }, (_, index) => ({ id: `item-${index}` }));
    const loading = ref(false);

    const { reveal } = mountLazyReveal(items, {
      loading,
      estimatedItemHeight: 77,
      minSkeletonMs: 0,
    });

    expect(reveal.visibleItems.value.length).toBeLessThan(items.length);
    expect(reveal.trailingSkeletonCount.value).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });
});
