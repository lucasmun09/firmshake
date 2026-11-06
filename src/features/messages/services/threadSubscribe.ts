import {
  collection,
  onSnapshot,
  query,
  type Unsubscribe,
} from 'firebase/firestore';

import type { AppNotification, MessageThread } from '@/types';
import { db } from '@/common/services/firebase';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import {
  attachRetriableSnapshot,
  createFirestoreSnapshotErrorHandler,
  ensureFirestoreAuth,
  isSessionExpiredError,
  SessionExpiredError,
} from '@/common/services/firestoreAuth';
import { subscribeNotifications } from '@/features/messages/services/notifications';
import {
  FIRESTORE_INBOX_THREAD_CAP,
  capSortedInboxThreads,
  enrichThreads,
  mapThread,
  mergeThreads,
  sortThreads,
} from '@/features/messages/services/threadModel';
import { rebuildThreadsForUser } from '@/features/messages/services/threadRebuild';

export function subscribeInboxThreads(
  userId: string,
  onData: (threads: MessageThread[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  let storedThreads: MessageThread[] = [];
  let notifications: AppNotification[] = [];
  let threadUnsub: Unsubscribe | undefined;
  let notificationUnsub: Unsubscribe | undefined;
  let cancelled = false;
  let rebuildPromise: Promise<void> | null = null;
  let rebuildDebounceTimer: number | undefined;
  let emitGeneration = 0;

  const emit = () => {
    const generation = ++emitGeneration;
    const merged = mergeThreads(storedThreads, notifications);

    void enrichThreads(merged)
      .then((enriched) => {
        if (!cancelled && generation === emitGeneration) {
          onData(sortThreads(enriched));
        }
      })
      .catch((error) => {
        debugLog.warn('threads', 'Thread enrich batch failed; emitting unenriched threads', {
          userId,
          count: merged.length,
          error: serializeError(error),
        });
        if (!cancelled && generation === emitGeneration) {
          onData(sortThreads(merged));
        }
      });
  };

  const scheduleRebuild = (debounceMs = 0) => {
    if (rebuildPromise) {
      return;
    }

    if (rebuildDebounceTimer !== undefined) {
      window.clearTimeout(rebuildDebounceTimer);
      rebuildDebounceTimer = undefined;
    }

    const run = () => {
      rebuildPromise = rebuildThreadsForUser(userId)
        .catch((error) => {
          if (isSessionExpiredError(error)) {
            return;
          }
          console.warn('Thread rebuild failed (inbox will still show notification threads)', error);
        })
        .finally(() => {
          rebuildPromise = null;
        });
    };

    if (debounceMs > 0) {
      rebuildDebounceTimer = window.setTimeout(run, debounceMs);
      return;
    }

    run();
  };

  void ensureFirestoreAuth()
    .then(() => {
      if (cancelled || !db) {
        return;
      }

      debugLog.debug('threads', 'subscribeInboxThreads: Firestore auth ready', { userId });
      scheduleRebuild();

      threadUnsub = attachRetriableSnapshot(
        (onSnapshotError) => onSnapshot(
          query(collection(db!, 'users', userId, 'threads')),
          (snapshot) => {
            storedThreads = capSortedInboxThreads(
              snapshot.docs.map((entry) => mapThread(entry.id, entry.data())),
              FIRESTORE_INBOX_THREAD_CAP,
            );
            debugLog.debug('threads', 'Inbox threads snapshot', {
              userId,
              count: storedThreads.length,
              cap: FIRESTORE_INBOX_THREAD_CAP,
              rawCount: snapshot.docs.length,
            });
            emit();
          },
          createFirestoreSnapshotErrorHandler(onSnapshotError, 'subscribeInboxThreads'),
        ),
        onError,
        'subscribeInboxThreads',
      );

      notificationUnsub = subscribeNotifications(
        userId,
        (nextNotifications) => {
          notifications = nextNotifications;
          emit();
          if (storedThreads.length === 0) {
            scheduleRebuild(1500);
          }
        },
        (notificationError) => {
          if (isSessionExpiredError(notificationError)) {
            onError?.(notificationError instanceof Error ? notificationError : new SessionExpiredError());
            return;
          }
          console.warn('Notifications subscription failed (inbox threads still load)', notificationError);
        },
      );
    })
    .catch((error) => {
      if (isSessionExpiredError(error)) {
        onError?.(error instanceof Error ? error : new SessionExpiredError());
        return;
      }
      debugLog.warn('threads', 'subscribeInboxThreads: ensureFirestoreAuth failed', {
        userId,
        error: serializeError(error),
      });
      onError?.(error instanceof Error ? error : new Error(String(error)));
    });

  return () => {
    cancelled = true;
    if (rebuildDebounceTimer !== undefined) {
      window.clearTimeout(rebuildDebounceTimer);
    }
    threadUnsub?.();
    notificationUnsub?.();
  };
}
