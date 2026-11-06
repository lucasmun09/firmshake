import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router';

import { auth } from '@/common/services/firebase';
import {
  authReady,
  currentUser,
  ensureAuthInitialized,
  resolveSessionUser,
  shouldBypassPostAuthGuard,
} from '@/features/auth/services/auth';
import { isSessionExpiredError } from '@/common/services/firestoreAuth';
import { registerPushNavigationHandler } from '@/common/services/pushNotifications';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import TabsPage from '@/features/shell/views/TabsPage.vue';
import { isLogsRoute, shouldSkipAuthReadyWait } from '@/router/logsRoute';
import { updateDocumentTitle } from '@/router/pageTitle';
import {
  AUTHENTICATED_ROOT_PATH,
  GUEST_BROWSE_PATH,
  resolveRootDestination,
} from '@/router/rootRoute';
import {
  isLeavingSettingsHub,
  normalizeRoutePath,
  shouldDeferPostAuthChecks,
} from '@/router/tabsRoute';
import { isMobileWeb } from '@/utils/platform';
import type { User } from 'firebase/auth';

const ROUTER_AUTH_READY_MAX_MS = 10000;

const routes: Array<RouteRecordRaw> = [
  {
    path: '/welcome',
    name: 'Welcome',
    component: () => import('@/features/shell/views/LandingPage.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'Root',
    // Guard in beforeEach resolves auth-aware destination; no route redirect here
    // (Vue Router applies record redirects before guards, which bypassed auth checks).
    component: {
      template: '<ion-page />',
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/features/auth/views/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/features/auth/views/RegisterPage.vue'),
    meta: { public: true },
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('@/features/auth/views/ForgotPasswordPage.vue'),
    meta: { public: true, authFlow: true },
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('@/features/auth/views/ResetPasswordPage.vue'),
    meta: { public: true, authFlow: true, passwordReset: true },
  },
  {
    path: '/complete-profile',
    name: 'CompleteProfile',
    component: () => import('@/features/auth/views/CompleteProfilePage.vue'),
    meta: { requiresAuth: true, authFlow: true },
  },
  {
    path: '/mfa-enroll',
    name: 'MfaEnroll',
    component: () => import('@/features/auth/views/MfaEnrollPage.vue'),
    meta: { requiresAuth: true, authFlow: true },
  },
  {
    path: '/mfa-challenge',
    name: 'MfaChallenge',
    component: () => import('@/features/auth/views/MfaChallengePage.vue'),
    meta: { public: true, authFlow: true },
  },
  {
    path: '/logs',
    name: 'Logs',
    component: () => import('@/features/debug/views/LogsPage.vue'),
    meta: { public: true, skipAuthFlow: true },
  },
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      {
        path: '',
        redirect: '/tabs/home',
      },
      {
        path: 'home/recent',
        name: 'RecentListings',
        component: () => import('@/features/listings/views/RecentListingsPage.vue'),
        meta: { guestAccessible: true },
      },
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/features/listings/views/HomePage.vue'),
        meta: { guestAccessible: true },
      },
      {
        path: 'login-create',
        name: 'LoginCreate',
        component: () => import('@/features/auth/views/LoginCreatePage.vue'),
        meta: { public: true, guestAccessible: true },
      },
      {
        path: 'communities/create',
        name: 'CreateCommunity',
        component: () => import('@/features/communities/views/CreateCommunityPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'communities',
        name: 'Communities',
        component: () => import('@/features/communities/views/CommunitiesPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'buying/listing/:id',
        name: 'BuyingListingMessages',
        component: () => import('@/features/messages/views/ListingMessagesPage.vue'),
        meta: { requiresAuth: true, messagesBack: '/tabs/buying' },
      },
      {
        path: 'buying',
        name: 'Buying',
        component: () => import('@/features/buying/views/BuyingPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'selling/listing/:id/firmshakes',
        redirect: (to) => `/tabs/selling/listing/${String(to.params.id)}`,
      },
      {
        path: 'selling/listing/:id',
        name: 'SellingListingMessages',
        component: () => import('@/features/messages/views/ListingMessagesPage.vue'),
        meta: { requiresAuth: true, messagesBack: '/tabs/selling' },
      },
      {
        path: 'selling',
        name: 'Selling',
        component: () => import('@/features/selling/views/SellingPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'sell',
        name: 'Sell',
        component: () => import('@/features/listings/views/CreateListingPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'inbox/listing/:id',
        name: 'InboxListingMessages',
        component: () => import('@/features/messages/views/ListingMessagesPage.vue'),
        meta: { requiresAuth: true, messagesBack: '/tabs/inbox' },
      },
      {
        path: 'inbox',
        name: 'Inbox',
        component: () => import('@/features/messages/views/InboxPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'firmshake/:id',
        name: 'FirmShakeView',
        component: () => import('@/features/meetups/views/FirmShakeViewPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/features/profile/views/ProfilePage.vue'),
        meta: { requiresAuth: true, skipAuthFlow: true },
      },
      {
        path: 'savedlistings',
        name: 'SavedListings',
        component: () => import('@/features/listings/views/SavedListingsPage.vue'),
        meta: { guestAccessible: true },
      },
      {
        path: 'blockedusers',
        name: 'BlockedUsers',
        component: () => import('@/features/profile/views/BlockedUsersPage.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },
  {
    path: '/communities/create',
    redirect: '/tabs/communities/create',
  },
  {
    path: '/recent-listings',
    redirect: '/tabs/home/recent',
  },
  {
    path: '/saved-listings',
    redirect: '/tabs/savedlistings',
  },
  {
    path: '/blockedusers',
    redirect: '/tabs/blockedusers',
  },
  {
    path: '/buying/listing/:id',
    redirect: (to) => ({
      path: `/tabs/buying/listing/${String(to.params.id)}`,
      query: to.query,
    }),
  },
  {
    path: '/selling/listing/:id',
    redirect: (to) => ({
      path: `/tabs/selling/listing/${String(to.params.id)}`,
      query: to.query,
    }),
  },
  {
    path: '/inbox/listing/:id',
    redirect: (to) => ({
      path: `/tabs/inbox/listing/${String(to.params.id)}`,
      query: to.query,
    }),
  },
  {
    path: '/listing/:id/propose-meetup',
    name: 'MeetupProposal',
    component: () => import('@/features/meetups/views/MeetupProposalPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/listing/:id/edit',
    name: 'EditListing',
    component: () => import('@/features/listings/views/CreateListingPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/listing/:id',
    name: 'ListingDetail',
    component: () => import('@/features/listings/views/ListingDetailPage.vue'),
    meta: { guestAccessible: true },
  },
  {
    path: '/seller/:sellerId',
    name: 'SellerProfile',
    component: () => import('@/features/listings/views/SellerProfilePage.vue'),
    meta: { guestAccessible: true },
  },
  {
    path: '/meetup/:id',
    name: 'Meetup',
    component: () => import('@/features/meetups/views/MeetupPage.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

const CHUNK_RELOAD_KEY = 'firmshake:chunk-reload';

function isStaleChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Failed to fetch dynamically imported module')
    || message.includes('Importing a module script failed')
    || message.includes('error loading dynamically imported module')
    || message.includes('Expected a JavaScript or WASM module script');
}

function resolveLoggedInUser() {
  return resolveSessionUser();
}

function isEntryRoute(to: RouteLocationNormalized): boolean {
  const normalizedPath = normalizeRoutePath(to.path);
  return normalizedPath === '/' || to.name === 'Welcome';
}

async function recoverSessionUserForEntryRoute(
  to: RouteLocationNormalized,
  seq: number,
  logRouter: boolean,
): Promise<User | null> {
  if (!authReady.value && !shouldSkipAuthReadyWait(to)) {
    if (logRouter) {
      debugLog.info('auth', 'Router guard: waiting for auth on entry route', {
        seq,
        to: to.fullPath,
      });
    }
    await ensureAuthInitialized(ROUTER_AUTH_READY_MAX_MS);
  }

  let sessionUser = resolveLoggedInUser();

  if (!sessionUser && auth) {
    try {
      await auth.authStateReady();
    } catch (err) {
      debugLog.warn('auth', 'Router guard: authStateReady failed on entry route', {
        seq,
        to: to.fullPath,
        error: serializeError(err),
      });
    }
    sessionUser = resolveLoggedInUser();
  }

  return sessionUser;
}

async function resolveEntryRouteRedirect(
  to: RouteLocationNormalized,
  seq: number,
  logRouter: boolean,
): Promise<string | true | null> {
  if (!isEntryRoute(to)) {
    return null;
  }

  const normalizedPath = normalizeRoutePath(to.path);
  const sessionUser = await recoverSessionUserForEntryRoute(to, seq, logRouter);

  if (sessionUser) {
    if (logRouter) {
      debugLog.info('auth', 'Router guard: signed-in entry → browse', {
        seq,
        from: to.fullPath,
      });
    }
    return AUTHENTICATED_ROOT_PATH;
  }

  if (to.name === 'Welcome' && isMobileWeb()) {
    if (logRouter) {
      debugLog.info('auth', 'Router guard: mobile guest leaving landing for browse', {
        seq,
        from: to.fullPath,
      });
    }
    return GUEST_BROWSE_PATH;
  }

  if (normalizedPath === '/') {
    const guestRoot = resolveRootDestination(false);
    if (logRouter) {
      debugLog.info('auth', 'Router guard: guest root redirect', {
        seq,
        destination: guestRoot,
      });
    }
    return guestRoot;
  }

  return true;
}

function shouldLogRouterEvent(to: RouteLocationNormalized, from: RouteLocationNormalized): boolean {
  return !isLogsRoute(to) && !isLogsRoute(from);
}

let routerGuardSeq = 0;
const deferredPostAuthUids = new Set<string>();

function scheduleDeferredPostAuthCheck(user: User): void {
  if (deferredPostAuthUids.has(user.uid)) {
    return;
  }

  deferredPostAuthUids.add(user.uid);

  void (async () => {
    try {
      const { getUserProfile } = await import('@/common/services/users');
      const { needsProfileCompletion, needsMfaEnrollment } = await import('@/features/auth/services/postAuthFlow');
      const { waitForFirestoreAuthNavigation } = await import('@/common/services/firestoreAuth');

      await waitForFirestoreAuthNavigation(user);
      const profile = await getUserProfile(user.uid);

      if (needsProfileCompletion(profile, user)) {
        debugLog.info('auth', 'Deferred post-auth: redirecting to complete profile', {
          uid: user.uid,
        });
        void router.replace({ name: 'CompleteProfile' });
        return;
      }

      if (needsMfaEnrollment(user, profile)) {
        debugLog.info('auth', 'Deferred post-auth: redirecting to MFA enroll', {
          uid: user.uid,
        });
        void router.replace({ name: 'MfaEnroll' });
        return;
      }

      debugLog.debug('auth', 'Deferred post-auth checks passed', { uid: user.uid });
    } catch (err) {
      if (isSessionExpiredError(err)) {
        void router.replace({ name: 'Login', query: { sessionExpired: '1' } });
        return;
      }
      debugLog.warn('auth', 'Deferred post-auth check failed', {
        uid: user.uid,
        error: serializeError(err),
      });
    }
  })();
}

router.onError((error, to) => {
  if (!isStaleChunkLoadError(error)) {
    return;
  }

  const reloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY);
  if (!reloaded) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    debugLog.warn('app', 'Stale chunk detected; reloading for fresh assets', {
      to: to.fullPath,
      error: serializeError(error),
    });
    window.location.assign(to.fullPath);
    return;
  }

  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  debugLog.error('app', 'Chunk reload failed', {
    to: to.fullPath,
    error: serializeError(error),
  });
});

router.beforeEach(async (to, from) => {
  const seq = ++routerGuardSeq;
  const logRouter = shouldLogRouterEvent(to, from);

  const entryRedirect = await resolveEntryRouteRedirect(to, seq, logRouter);
  if (entryRedirect !== null) {
    return entryRedirect;
  }

  if (isLogsRoute(to)) {
    debugLog.info('auth', 'Router guard: allowing /logs (exempt from all redirects)', {
      seq,
      to: to.fullPath,
      from: from.fullPath,
      fromName: from.name,
      isLoggedIn: Boolean(resolveLoggedInUser()),
      currentUserUid: currentUser.value?.uid ?? null,
    });
    return true;
  }

  if (!authReady.value && !shouldSkipAuthReadyWait(to)) {
    if (logRouter) {
      debugLog.info('auth', 'Router guard: waiting for authReady', {
        seq,
        to: to.fullPath,
        from: from.fullPath,
      });
    }

    await ensureAuthInitialized(ROUTER_AUTH_READY_MAX_MS);
  }

  const isPublic = to.meta.public === true;
  const requiresAuth = to.meta.requiresAuth === true;
  const isAuthFlow = to.meta.authFlow === true;
  let sessionUser = resolveLoggedInUser();
  let isLoggedIn = Boolean(sessionUser);

  if (requiresAuth && !isLoggedIn && auth) {
    try {
      await auth.authStateReady();
    } catch (err) {
      debugLog.warn('auth', 'Router guard: authStateReady failed while recovering session', {
        seq,
        to: to.fullPath,
        error: serializeError(err),
      });
    }

    sessionUser = resolveLoggedInUser();
    isLoggedIn = Boolean(sessionUser);

    if (isLoggedIn && logRouter) {
      debugLog.info('auth', 'Router guard: recovered Firebase session before auth redirect', {
        seq,
        to: to.fullPath,
        uid: sessionUser?.uid ?? null,
      });
    }
  }

  if (logRouter) {
    debugLog.info('auth', 'Router guard: evaluating', {
      seq,
      to: to.fullPath,
      toName: to.name,
      from: from.fullPath,
      fromName: from.name,
      requiresAuth,
      isPublic,
      isAuthFlow,
      isLoggedIn,
      currentUserUid: currentUser.value?.uid ?? null,
      authCurrentUserUid: auth?.currentUser?.uid ?? null,
      authReady: authReady.value,
    });
  }

  if (requiresAuth && !isLoggedIn) {
    if (logRouter) {
      debugLog.warn('auth', 'Router guard: redirecting to login (auth required)', {
        seq,
        target: to.fullPath,
        from: from.fullPath,
      });
    }
    return { name: 'Login', query: { redirect: to.fullPath } };
  }

  if (isPublic && isLoggedIn && (to.name === 'Login' || to.name === 'Register' || to.name === 'ForgotPassword')) {
    try {
      const { getUserProfile } = await import('@/common/services/users');
      const { resolvePostAuthPath } = await import('@/features/auth/services/postAuthFlow');
      const { waitForFirestoreAuth } = await import('@/common/services/firestoreAuth');
      const user = sessionUser!;
      await waitForFirestoreAuth(user);
      const profile = await getUserProfile(user.uid);
      const destination = resolvePostAuthPath(user, profile);
      if (logRouter) {
        debugLog.info('auth', 'Router guard: signed-in user leaving auth page', {
          seq,
          from: to.fullPath,
          destination,
        });
      }
      return { path: destination };
    } catch (err) {
      if (isSessionExpiredError(err)) {
        return { name: 'Login', query: { sessionExpired: '1' } };
      }
      debugLog.error('auth', 'Router guard: failed redirect from auth page', {
        seq,
        error: serializeError(err),
      });
      throw err;
    }
  }

  const deferPostAuthChecks = shouldDeferPostAuthChecks(from, to);
  const leavingSettingsHub = isLeavingSettingsHub(from, to);

  if (
    isLoggedIn
    && !isAuthFlow
    && !to.meta.skipAuthFlow
    && !leavingSettingsHub
    && to.name !== 'MfaChallenge'
    && to.meta.passwordReset !== true
  ) {
    const user = sessionUser!;

    if (shouldBypassPostAuthGuard(user.uid)) {
      if (logRouter) {
        debugLog.debug('auth', 'Router guard: skipping post-auth checks (recent navigation)', {
          seq,
          to: to.fullPath,
          uid: user.uid,
        });
      }
    } else {
      const { getCachedUserProfile, getUserProfile } = await import('@/common/services/users');
      const { needsProfileCompletion, needsMfaEnrollment } = await import('@/features/auth/services/postAuthFlow');
      const { waitForFirestoreAuthNavigation } = await import('@/common/services/firestoreAuth');

      const cachedProfile = getCachedUserProfile(user.uid);
      if (cachedProfile) {
        if (needsProfileCompletion(cachedProfile, user)) {
          if (logRouter) {
            debugLog.info('auth', 'Router guard: redirecting to complete profile (cached)', { seq, from: to.fullPath });
          }
          return { name: 'CompleteProfile' };
        }

        if (needsMfaEnrollment(user, cachedProfile)) {
          if (logRouter) {
            debugLog.info('auth', 'Router guard: redirecting to MFA enroll (cached)', { seq, from: to.fullPath });
          }
          return { name: 'MfaEnroll' };
        }

        if (logRouter) {
          debugLog.debug('auth', 'Router guard: post-auth checks passed via cache', {
            seq,
            to: to.fullPath,
            uid: user.uid,
          });
        }
      } else if (deferPostAuthChecks) {
        if (logRouter) {
          debugLog.debug('auth', 'Router guard: deferring post-auth checks (tabs shell)', {
            seq,
            to: to.fullPath,
            from: from.fullPath,
          });
        }
        scheduleDeferredPostAuthCheck(user);
      } else {
        try {
          await waitForFirestoreAuthNavigation(user);
          const profile = await getUserProfile(user.uid);

          if (needsProfileCompletion(profile, user)) {
            if (logRouter) {
              debugLog.info('auth', 'Router guard: redirecting to complete profile', { seq, from: to.fullPath });
            }
            return { name: 'CompleteProfile' };
          }

          if (needsMfaEnrollment(user, profile)) {
            if (logRouter) {
              debugLog.info('auth', 'Router guard: redirecting to MFA enroll', { seq, from: to.fullPath });
            }
            return { name: 'MfaEnroll' };
          }
        } catch (err) {
          if (isSessionExpiredError(err)) {
            return { name: 'Login', query: { sessionExpired: '1' } };
          }
          debugLog.warn('auth', 'Router guard: post-auth checks skipped', {
            seq,
            to: to.fullPath,
            error: serializeError(err),
          });
        }
      }
    }
  }

  if (logRouter) {
    debugLog.debug('auth', 'Router guard: allowing navigation', {
      seq,
      to: to.fullPath,
      isLoggedIn,
    });
  }

  return true;
});

router.afterEach((to, from, failure) => {
  if (!failure) {
    updateDocumentTitle(to);
  }

  if (!shouldLogRouterEvent(to, from)) {
    return;
  }

  debugLog.info('auth', 'Router navigation settled', {
    to: to.fullPath,
    toName: to.name,
    from: from.fullPath,
    fromName: from.name,
    failure: failure ? String(failure) : null,
    currentUserUid: currentUser.value?.uid ?? null,
    authCurrentUserUid: auth?.currentUser?.uid ?? null,
  });
});

registerPushNavigationHandler(async (payload) => {
  if (payload.listingId && payload.type === 'message') {
    const user = currentUser.value;
    if (user) {
      const { getListingById } = await import('@/features/listings/services/listings');
      const listing = await getListingById(payload.listingId);
      if (listing?.sellerId === user.uid) {
        const path = payload.actorId
          ? `/tabs/selling/listing/${payload.listingId}?buyerId=${encodeURIComponent(payload.actorId)}`
          : `/tabs/selling/listing/${payload.listingId}`;
        void router.push(path);
        return;
      }
    }

    void router.push(`/tabs/buying/listing/${payload.listingId}`);
    return;
  }

  if (payload.listingId) {
    void router.push(`/listing/${payload.listingId}`);
    return;
  }

  void router.push('/tabs/inbox');
});

export default router;
