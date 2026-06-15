import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';

import { app, db, isFirebaseConfigured } from './firebase';

export type PushRoutePayload = {
  type?: string;
  listingId?: string;
  actorId?: string;
};

let navigateFromPush: ((payload: PushRoutePayload) => void) | null = null;
let initializedForUserId: string | null = null;
let messagingInstance: Messaging | null = null;

function tokenDocId(token: string): string {
  let hash = 5381;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 33) ^ token.charCodeAt(i);
  }
  return `t${(hash >>> 0).toString(36)}`;
}

function currentPlatform(): 'web' | 'ios' | 'android' {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') {
    return 'ios';
  }
  if (platform === 'android') {
    return 'android';
  }
  return 'web';
}

async function saveFcmToken(userId: string, token: string): Promise<void> {
  if (!db) {
    return;
  }

  await setDoc(
    doc(db, 'users', userId, 'fcmTokens', tokenDocId(token)),
    {
      token,
      platform: currentPlatform(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

function handlePushNavigation(data: Record<string, unknown> | undefined): void {
  if (!data || !navigateFromPush) {
    return;
  }

  navigateFromPush({
    type: data.type ? String(data.type) : undefined,
    listingId: data.listingId ? String(data.listingId) : undefined,
    actorId: data.actorId ? String(data.actorId) : undefined,
  });
}

async function initNativePush(userId: string): Promise<void> {
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (event) => {
    if (event.value) {
      await saveFcmToken(userId, event.value);
    }
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.warn('Push registration failed', error);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    handlePushNavigation(event.notification.data);
  });
}

async function initWebPush(userId: string): Promise<void> {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey || !app || !isFirebaseConfigured) {
    return;
  }

  const supported = await isSupported();
  if (!supported) {
    return;
  }

  messagingInstance = getMessaging(app);
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messagingInstance, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (token) {
    await saveFcmToken(userId, token);
  }

  onMessage(messagingInstance, (payload) => {
    const title = payload.notification?.title ?? 'FirmShake';
    const body = payload.notification?.body ?? '';
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notification = new Notification(title, { body, data: payload.data });
      notification.onclick = () => {
        handlePushNavigation(payload.data);
        notification.close();
      };
    }
  });
}

export function registerPushNavigationHandler(
  handler: (payload: PushRoutePayload) => void,
): () => void {
  navigateFromPush = handler;
  return () => {
    navigateFromPush = null;
  };
}

export async function initPushNotifications(userId: string): Promise<void> {
  if (!isFirebaseConfigured || initializedForUserId === userId) {
    return;
  }

  initializedForUserId = userId;

  try {
    if (Capacitor.isNativePlatform()) {
      await initNativePush(userId);
      return;
    }

    await initWebPush(userId);
  } catch (error) {
    console.warn('Push notifications are unavailable', error);
  }
}

export function resetPushNotifications(): void {
  initializedForUserId = null;
  messagingInstance = null;
}
