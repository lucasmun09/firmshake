import { onUnmounted, ref, type Ref } from 'vue';

import {
  getMessageAccessOptions,
  subscribeListingMessages,
  type MessageSnapshotMeta,
} from '@/features/messages/services/messages';
import type { Listing, Message } from '@/types';

export function useListingMessages(
  listing: Ref<Listing | null>,
  userId: Ref<string | undefined>,
) {
  const messages = ref<Message[]>([]);
  const error = ref('');
  const ready = ref(false);
  const syncingFromServer = ref(false);

  let unsubscribe: (() => void) | undefined;

  function stop() {
    unsubscribe?.();
    unsubscribe = undefined;
  }

  function handleSnapshot(nextMessages: Message[], meta: MessageSnapshotMeta) {
    messages.value = nextMessages;
    error.value = '';
    ready.value = true;
    syncingFromServer.value = meta.fromCache;
  }

  function start() {
    stop();

    const loadedListing = listing.value;
    const uid = userId.value;
    if (!loadedListing || !uid) {
      messages.value = [];
      ready.value = false;
      syncingFromServer.value = false;
      return;
    }

    ready.value = messages.value.length > 0;
    syncingFromServer.value = !ready.value;
    error.value = '';

    const access = getMessageAccessOptions(loadedListing, uid);

    unsubscribe = subscribeListingMessages(
      loadedListing.id,
      handleSnapshot,
      (loadError) => {
        error.value = 'Unable to fetch messages';
        ready.value = true;
        syncingFromServer.value = false;
        console.error(loadError);
      },
      access,
    );
  }

  onUnmounted(stop);

  return {
    messages,
    error,
    ready,
    syncingFromServer,
    start,
    stop,
  };
}
