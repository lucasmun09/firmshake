import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';

import { shouldLoadMoreAtScroll } from '@/common/utils/scrollLoadThreshold';
import {
  incompleteRowSlots,
  roundUpToMultiple,
} from '@/features/listings/utils/browseGridLayout';

type IonContentRef = Ref<{ $el?: { getScrollElement: () => Promise<HTMLElement> } } | null>;

interface LazyRevealOptions {
  contentRef?: IonContentRef;
  loading?: Ref<boolean>;
  estimatedItemHeight?: number;
  /** When set, batch sizes align to full grid rows (Browse cards). */
  gridColumnCount?: Ref<number | undefined>;
  gridRowCount?: Ref<number | undefined>;
  gridRowHeightPx?: Ref<number | undefined>;
  minSkeletonMs?: number;
}

const DEFAULT_MIN_SKELETON_MS = 500;
const SCROLLABLE_THRESHOLD_PX = 8;

export function useLazyReveal<T>(items: Ref<T[]>, options: LazyRevealOptions = {}) {
  const itemsPerScreen = ref(6);
  const visibleCount = ref(0);
  const estimatedItemHeight = options.estimatedItemHeight ?? 77;
  const minSkeletonMs = options.minSkeletonMs ?? DEFAULT_MIN_SKELETON_MS;

  function gridColumns(): number {
    const columns = options.gridColumnCount?.value;
    return columns && columns > 0 ? columns : 0;
  }

  function gridRows(): number {
    const rows = options.gridRowCount?.value;
    return rows && rows > 0 ? rows : 0;
  }

  function gridPageSize(): number {
    const columns = gridColumns();
    const rows = gridRows();
    if (columns <= 0 || rows <= 0) {
      return 0;
    }

    return columns * rows;
  }

  function updateItemsPerScreen() {
    const viewport = window.innerHeight || 640;
    const pageSize = gridPageSize();

    if (pageSize > 0) {
      itemsPerScreen.value = pageSize;
      return;
    }

    const columns = gridColumns();
    if (columns > 0) {
      const rowHeight = options.gridRowHeightPx?.value ?? estimatedItemHeight;
      const rowsPerScreen = Math.max(1, Math.floor(viewport / rowHeight));
      itemsPerScreen.value = columns * rowsPerScreen;
      return;
    }

    itemsPerScreen.value = Math.max(4, Math.ceil(viewport / estimatedItemHeight));
  }

  const batchSize = computed(() => {
    const pageSize = gridPageSize();
    if (pageSize > 0) {
      return pageSize;
    }

    return itemsPerScreen.value * 2;
  });

  const loadMoreStep = computed(() => {
    const pageSize = gridPageSize();
    if (pageSize > 0) {
      return pageSize;
    }

    return itemsPerScreen.value;
  });
  const skeletonCount = computed(() => batchSize.value);

  const loading = computed(() => options.loading?.value ?? false);

  const showSkeletons = ref(false);
  const skeletonShownAt = ref<number | null>(null);
  let revealTimer: ReturnType<typeof setTimeout> | undefined;

  function clearRevealTimer() {
    if (revealTimer !== undefined) {
      clearTimeout(revealTimer);
      revealTimer = undefined;
    }
  }

  function beginSkeletonDisplay() {
    clearRevealTimer();
    skeletonShownAt.value = Date.now();
    showSkeletons.value = true;
  }

  function scheduleReveal() {
    clearRevealTimer();
    const startedAt = skeletonShownAt.value ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, minSkeletonMs - elapsed);

    if (remaining === 0) {
      showSkeletons.value = false;
      syncVisibleCount();
      return;
    }

    revealTimer = setTimeout(() => {
      showSkeletons.value = false;
      syncVisibleCount();
    }, remaining);
  }

  const showEmpty = computed(
    () => !loading.value && !showSkeletons.value && items.value.length === 0,
  );

  const allItemsRevealed = computed(
    () =>
      !showSkeletons.value &&
      !loading.value &&
      visibleCount.value >= items.value.length,
  );

  const isScrollable = ref(false);
  let scrollResizeObserver: ResizeObserver | undefined;
  let measureScrollabilityTimer: ReturnType<typeof setTimeout> | undefined;

  const showEndOfList = computed(
    () => allItemsRevealed.value && isScrollable.value,
  );

  function clearMeasureScrollabilityTimer() {
    if (measureScrollabilityTimer !== undefined) {
      clearTimeout(measureScrollabilityTimer);
      measureScrollabilityTimer = undefined;
    }
  }

  function scheduleScrollabilityMeasure() {
    clearMeasureScrollabilityTimer();
    measureScrollabilityTimer = setTimeout(() => {
      measureScrollabilityTimer = undefined;
      void measureScrollability();
    }, 0);
  }

  async function measureScrollability() {
    const ionContent = options.contentRef?.value;
    if (!ionContent?.$el) {
      isScrollable.value = false;
      return;
    }

    try {
      const scrollEl = await ionContent.$el.getScrollElement();
      isScrollable.value =
        scrollEl.scrollHeight - scrollEl.clientHeight > SCROLLABLE_THRESHOLD_PX;
      setupScrollResizeObserver(scrollEl);
    } catch {
      isScrollable.value = false;
    }
  }

  function setupScrollResizeObserver(scrollEl: HTMLElement) {
    scrollResizeObserver?.disconnect();
    scrollResizeObserver = undefined;

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observeTarget = scrollEl.firstElementChild ?? scrollEl;
    scrollResizeObserver = new ResizeObserver(() => {
      isScrollable.value =
        scrollEl.scrollHeight - scrollEl.clientHeight > SCROLLABLE_THRESHOLD_PX;
    });
    scrollResizeObserver.observe(observeTarget);
  }

  const visibleItems = computed(() => {
    if (showSkeletons.value) {
      return [];
    }
    return items.value.slice(0, visibleCount.value);
  });

  const hasMore = computed(() => visibleCount.value < items.value.length);

  const trailingSkeletonCount = computed(() => {
    if (showSkeletons.value || !hasMore.value) {
      return 0;
    }

    const remaining = items.value.length - visibleCount.value;
    const columns = gridColumns();
    if (columns > 0) {
      const incomplete = incompleteRowSlots(visibleCount.value, columns);
      if (incomplete > 0) {
        return Math.min(incomplete, remaining);
      }

      const pageSize = gridPageSize();
      const previewRows = pageSize > 0 ? Math.max(1, Math.min(gridRows(), 2)) : 2;
      return Math.min(columns * previewRows, remaining);
    }

    return Math.min(itemsPerScreen.value, remaining);
  });

  function capVisibleCount(count: number): number {
    const total = items.value.length;
    const capped = Math.min(count, total);
    const columns = gridColumns();

    if (columns <= 0 || capped >= total) {
      return capped;
    }

    return Math.min(roundUpToMultiple(capped, columns), total);
  }

  function syncVisibleCount() {
    if (showSkeletons.value) {
      visibleCount.value = 0;
      return;
    }

    updateItemsPerScreen();
    visibleCount.value = capVisibleCount(batchSize.value);
  }

  watch(items, (newItems, oldItems) => {
    const previousLength = oldItems?.length ?? 0;

    if (
      !showSkeletons.value &&
      newItems.length > previousLength &&
      visibleCount.value >= previousLength
    ) {
      visibleCount.value = capVisibleCount(
        visibleCount.value + (newItems.length - previousLength),
      );
    } else {
      syncVisibleCount();
      if (
        !showSkeletons.value &&
        !loading.value &&
        newItems.length > 0 &&
        visibleCount.value === 0
      ) {
        visibleCount.value = capVisibleCount(batchSize.value);
      }
    }
  });
  watch(
    () => options.loading?.value,
    (isLoading) => {
      if (isLoading) {
        beginSkeletonDisplay();
        syncVisibleCount();
        return;
      }

      if (items.value.length > 0) {
        clearRevealTimer();
        showSkeletons.value = false;
        syncVisibleCount();
        return;
      }

      if (showSkeletons.value) {
        scheduleReveal();
        return;
      }

      syncVisibleCount();
    },
    { immediate: true },
  );

  function loadMore() {
    if (loading.value || !hasMore.value) {
      return;
    }

    visibleCount.value = capVisibleCount(visibleCount.value + loadMoreStep.value);
    scheduleScrollabilityMeasure();
  }

  async function onScroll() {
    const ionContent = options.contentRef?.value;
    if (!ionContent?.$el || !hasMore.value) {
      return;
    }

    const scrollEl = await ionContent.$el.getScrollElement();
    if (shouldLoadMoreAtScroll(scrollEl)) {
      loadMore();
    }
  }

  function handleResize() {
    updateItemsPerScreen();
    if (!showSkeletons.value && visibleCount.value > 0) {
      visibleCount.value = capVisibleCount(Math.max(visibleCount.value, batchSize.value));
    }
    scheduleScrollabilityMeasure();
  }

  watch(
    () => [
      options.gridColumnCount?.value,
      options.gridRowCount?.value,
      options.gridRowHeightPx?.value,
    ],
    () => {
      updateItemsPerScreen();
      if (!showSkeletons.value && visibleCount.value > 0) {
        visibleCount.value = capVisibleCount(Math.max(visibleCount.value, batchSize.value));
      }
    },
  );

  watch(
    () => options.contentRef?.value,
    () => {
      void nextTick(() => scheduleScrollabilityMeasure());
    },
  );

  watch(
    [visibleCount, () => items.value.length, showSkeletons, loading],
    () => {
      void nextTick(() => scheduleScrollabilityMeasure());
    },
  );

  onMounted(() => {
    updateItemsPerScreen();
    window.addEventListener('resize', handleResize);
    void nextTick(() => scheduleScrollabilityMeasure());
  });

  onUnmounted(() => {
    clearRevealTimer();
    clearMeasureScrollabilityTimer();
    scrollResizeObserver?.disconnect();
    window.removeEventListener('resize', handleResize);
  });

  return {
    visibleItems,
    showSkeletons,
    skeletonCount,
    trailingSkeletonCount,
    showEmpty,
    allItemsRevealed,
    isScrollable,
    showEndOfList,
    hasMore,
    onScroll,
    loadMore,
  };
}
