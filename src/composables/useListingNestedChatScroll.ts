import { nextTick, onUnmounted, ref, type Ref } from 'vue';
import type { IonContent } from '@ionic/vue';

const CHAT_BOTTOM_THRESHOLD = 48;

export function useListingNestedChatScroll(
  contentRef: Ref<InstanceType<typeof IonContent> | null>,
  chatScrollPanelRef: Ref<HTMLElement | null>,
  stickyBlockRef: Ref<HTMLElement | null>,
) {
  const chatPanelMaxHeight = ref<number | null>(null);
  let resizeObserver: ResizeObserver | undefined;

  async function getPageScrollElement(): Promise<HTMLElement | null> {
    const content = contentRef.value;
    if (!content?.$el) {
      return null;
    }

    try {
      return await (content.$el as HTMLIonContentElement).getScrollElement();
    } catch {
      return null;
    }
  }

  function measureChatPanelHeight() {
    const sticky = stickyBlockRef.value;
    if (!sticky || typeof window === 'undefined') {
      return;
    }

    const page = sticky.closest('ion-page');
    const header = page?.querySelector('ion-header');
    const footer = page?.querySelector('ion-footer');
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    const footerHeight = footer?.getBoundingClientRect().height ?? 0;
    const stickyHeight = sticky.getBoundingClientRect().height;
    const nextHeight = Math.max(160, window.innerHeight - headerHeight - stickyHeight - footerHeight);

    chatPanelMaxHeight.value = nextHeight;
  }

  function setupPanelHeightObserver() {
    resizeObserver?.disconnect();

    if (typeof ResizeObserver === 'undefined') {
      measureChatPanelHeight();
      return;
    }

    resizeObserver = new ResizeObserver(() => {
      measureChatPanelHeight();
    });

    if (stickyBlockRef.value) {
      resizeObserver.observe(stickyBlockRef.value);
    }

    const page = stickyBlockRef.value?.closest('ion-page');
    const footer = page?.querySelector('ion-footer');
    if (footer) {
      resizeObserver.observe(footer);
    }

    measureChatPanelHeight();
    window.addEventListener('resize', measureChatPanelHeight);
  }

  function teardownPanelHeightObserver() {
    resizeObserver?.disconnect();
    window.removeEventListener('resize', measureChatPanelHeight);
  }

  function isChatAtBottom(): boolean {
    const panel = chatScrollPanelRef.value;
    if (!panel) {
      return true;
    }

    return panel.scrollTop + panel.clientHeight >= panel.scrollHeight - CHAT_BOTTOM_THRESHOLD;
  }

  async function scrollPageToBottom() {
    await nextTick();

    const scrollEl = await getPageScrollElement();
    if (!scrollEl) {
      return;
    }

    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  async function scrollChatToBottom() {
    await nextTick();

    const panel = chatScrollPanelRef.value;
    if (!panel) {
      return;
    }

    panel.scrollTop = panel.scrollHeight;
  }

  async function scrollToLatest() {
    await scrollPageToBottom();
    await scrollChatToBottom();
  }

  async function scrollChatIfAtBottom() {
    if (isChatAtBottom()) {
      await scrollChatToBottom();
    }
  }

  onUnmounted(() => {
    teardownPanelHeightObserver();
  });

  return {
    chatPanelMaxHeight,
    measureChatPanelHeight,
    setupPanelHeightObserver,
    teardownPanelHeightObserver,
    isChatAtBottom,
    scrollPageToBottom,
    scrollChatToBottom,
    scrollToLatest,
    scrollChatIfAtBottom,
  };
}
