import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import type { AppNotification, NotificationType } from '@/types';
import { sendPushNotification } from './api';
import { db } from './firebase';

function mapNotification(id: string, data: Record<string, unknown>): AppNotification {
  const createdAt = data.createdAt;
  return {
    id,
    recipientId: String(data.recipientId ?? ''),
    actorId: String(data.actorId ?? ''),
    type: (data.type as NotificationType) ?? 'system',
    title: String(data.title ?? 'Update'),
    body: String(data.body ?? ''),
    listingId: data.listingId ? String(data.listingId) : undefined,
    read: Boolean(data.read),
    createdAt:
      createdAt && typeof createdAt === 'object' && 'toDate' in createdAt
        ? (createdAt as { toDate: () => Date }).toDate()
        : undefined,
  };
}

function sortNotifications(notifications: AppNotification[]): AppNotification[] {
  return [...notifications].sort((left, right) => {
    const leftTime = left.createdAt?.getTime() ?? 0;
    const rightTime = right.createdAt?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

export function subscribeNotifications(
  userId: string,
  onData: (notifications: AppNotification[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const notificationsQuery = query(
    collection(db, 'users', userId, 'notifications'),
    where('recipientId', '==', userId),
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      onData(
        sortNotifications(
          snapshot.docs.map((entry) => mapNotification(entry.id, entry.data())),
        ),
      );
    },
    (error) => onError?.(error),
  );
}

export function subscribeUnreadNotificationCount(
  userId: string,
  onData: (count: number) => void,
): Unsubscribe {
  return subscribeNotifications(userId, (notifications) => {
    onData(notifications.filter((notification) => !notification.read).length);
  });
}

export async function createNotification(input: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body: string;
  listingId?: string;
}): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  if (input.recipientId === input.actorId) {
    return;
  }

  const notificationRef = doc(collection(db, 'users', input.recipientId, 'notifications'));
  await setDoc(notificationRef, {
    recipientId: input.recipientId,
    actorId: input.actorId,
    type: input.type,
    title: input.title,
    body: input.body,
    listingId: input.listingId ?? null,
    read: false,
    createdAt: Timestamp.now(),
  });

  try {
    await sendPushNotification(input);
  } catch (error) {
    console.warn('In-app notification saved, but push delivery failed', error);
  }
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  await setDoc(
    doc(db, 'users', userId, 'notifications', notificationId),
    { read: true },
    { merge: true },
  );
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  const notificationsQuery = query(
    collection(db, 'users', userId, 'notifications'),
    where('recipientId', '==', userId),
    where('read', '==', false),
  );

  return new Promise((resolve, reject) => {
    const unsubscribe = onSnapshot(
      notificationsQuery,
      async (snapshot) => {
        unsubscribe();
        try {
          await Promise.all(
            snapshot.docs.map((entry) =>
              setDoc(entry.ref, { read: true }, { merge: true }),
            ),
          );
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      reject,
    );
  });
}

export async function markListingNotificationsRead(
  userId: string,
  listingId: string,
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  const notificationsQuery = query(
    collection(db, 'users', userId, 'notifications'),
    where('recipientId', '==', userId),
    where('listingId', '==', listingId),
    where('read', '==', false),
  );

  const snapshot = await getDocs(notificationsQuery);
  await Promise.all(snapshot.docs.map((entry) => setDoc(entry.ref, { read: true }, { merge: true })));
}

export async function markListingThreadRead(userId: string, listingId: string): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  await setDoc(
    doc(db, 'users', userId, 'inboxState', listingId),
    {
      listingId,
      lastReadAt: serverTimestamp(),
    },
    { merge: true },
  );
}
